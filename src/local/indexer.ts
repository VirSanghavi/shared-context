/**
 * Codebase indexer for filesystem-connected clients (the local MCP server and
 * the `axis index` CLI). Walks the repo, content-hashes every file, asks the
 * server which files changed (plan), uploads only those bodies, and prunes
 * deleted files. Re-running after editing a few files is near-instant and
 * costs almost nothing — only changed files are re-embedded server-side.
 */

