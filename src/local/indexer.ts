/**
 * Codebase indexer for filesystem-connected clients (the local MCP server and
 * the `axis index` CLI). Walks the repo, content-hashes every file, asks the
 * server which files changed (plan), uploads only those bodies, and prunes
 * deleted files. Re-running after editing a few files is near-instant and
 * costs almost nothing — only changed files are re-embedded server-side.
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const DEFAULT_IGNORE_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", "out", "coverage",
  "venv", ".venv", "__pycache__", ".turbo", ".cache", "vendor", ".idea",
  ".vscode", "target", "bin", "obj", ".pytest_cache", ".mypy_cache",
]);

const BINARY_EXT = new Set([
  "png","jpg","jpeg","gif","webp","ico","bmp","tiff","svg","pdf","zip","gz",
  "tar","tgz","rar","7z","mp3","mp4","mov","avi","wav","woff","woff2","ttf",
  "otf","eot","exe","dll","so","dylib","bin","wasm","class","jar","pyc","lock",
  "min.js","min.css","map","ds_store",
]);

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
  "Cargo.lock", "composer.lock", ".DS_Store",
]);

const MAX_FILE_BYTES = 256 * 1024; // skip files larger than 256KB
const UPLOAD_BATCH = 40; // files per /index call

export interface IndexLogger {
  info: (msg: string) => void;
  warn?: (msg: string) => void;
}

export interface IndexSummary {
  scanned: number;
  uploaded: number;
  unchanged: number;
  pruned: number;
  chunks: number;
}

/** Parse a .gitignore into a simple matcher (dir names, exact paths, *.ext). */
function loadGitignore(root: string): (rel: string) => boolean {
  const file = path.join(root, ".gitignore");
  let patterns: string[] = [];
  try {
    patterns = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    /* no .gitignore */
  }
  const exts = patterns.filter((p) => p.startsWith("*.")).map((p) => p.slice(1));
  const names = new Set(patterns.filter((p) => !p.includes("/") && !p.startsWith("*")).map((p) => p.replace(/\/$/, "")));
  const prefixes = patterns.filter((p) => p.includes("/")).map((p) => p.replace(/^\//, "").replace(/\/$/, ""));
  return (rel: string) => {
    const base = path.basename(rel);
    if (names.has(base)) return true;
    if (exts.some((e) => rel.endsWith(e))) return true;
    if (prefixes.some((p) => rel === p || rel.startsWith(p + "/"))) return true;
    return false;
  };
}

function isBinaryPath(rel: string): boolean {
  const lower = rel.toLowerCase();
  if (SKIP_FILES.has(path.basename(rel))) return true;
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  if (BINARY_EXT.has(ext)) return true;
  if (lower.endsWith(".min.js") || lower.endsWith(".min.css")) return true;
  return false;
}

function walk(root: string, ignored: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const stack = ["."];
  while (stack.length) {
    const relDir = stack.pop()!;
    const absDir = path.join(root, relDir);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const rel = relDir === "." ? e.name : `${relDir}/${e.name}`;
      if (e.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(e.name) || ignored(rel)) continue;
        stack.push(rel);
      } else if (e.isFile()) {
        if (isBinaryPath(rel) || ignored(rel)) continue;
        out.push(rel);
      }
    }
  }
  return out;
}

function indexEndpoint(apiUrl: string, suffix: string): string {
  const base = apiUrl.endsWith("/v1") ? apiUrl : `${apiUrl}/v1`;
  return `${base}${suffix}`;
}

async function post(url: string, secret: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
