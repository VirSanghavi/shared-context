/**
 * Codebase indexer for filesystem-connected clients (the local MCP server and
 * the `axis index` CLI). Walks the repo, content-hashes every file, asks the
 * server which files changed (plan), uploads only those bodies, and prunes
