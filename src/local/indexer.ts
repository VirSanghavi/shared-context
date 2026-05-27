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
