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

