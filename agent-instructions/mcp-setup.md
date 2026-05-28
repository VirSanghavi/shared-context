# Axis MCP Server Documentation

The Axis Shared Context MCP Server is a powerful bridge between your AI agents and your project's context, governance, and billing systems. It implements the [Model Context Protocol](https://modelcontextprotocol.io) to provide a standardized way for agents to read file context, manage tasks, and check subscription status.

## Features

- **Context Management**: Read and update shared context files (`context.md`, `conventions.md`).
- **Live Notepad**: A real-time, in-memory scratchpad for agents to collaborate (`mcp://context/current`).
- **Task Orchestration**: A built-in Job Board to post, claim, and complete tasks (`post_job`, `claim_next_job`).
- **File Locking**: Prevent race conditions by locking files before editing (`propose_file_access`).
- **Billing Integration**: Check user subscription status and API usage limits (`get_subscription_status`).
- **Documentation Access**: Search and read project documentation directly.

## Governance & Philosophy

Axis isn't just a memory server; it's a **Governance Layer** for autonomous agents.

### 1. Concurrency Control (File Locking)
To prevent multiple agents from overwriting each other's work, Axis implements a **File Locking Protocol**.
- Agents must call `propose_file_access` before writing to a file.
- The server checks if the file is currently locked by another agent.
- If locked, the request is denied (or queued), forcing the agent to wait or collaborate.
- This ensures atomic edits and prevents "merge hell" in multi-agent environments.

### 2. Task Orchestration (Job Board)
Agents shouldn't just run wild. Axis provides a structured **Job Board** to maintain order.
- **Post**: High-level planners break down objectives into distinct Jobs (`post_job`).
- **Claim**: Workers request work (`claim_next_job`), ensuring they only work on high-priority, unblocked tasks.
- **Complete**: Agents report outcomes (`complete_job`), updating the shared state.
- **Dependencies**: Jobs can depend on others, pausing execution until prerequisites are met.

### 3. Header-Based Context Injection
For high-fidelity context without token bloat, Axis supports specialized HTTP headers (if supported by your agent client):
- `X-Axis-Context`: Injects the "Live Notepad" summary directly into the system prompt.
- `X-Axis-Soul`: Injects the high-level project goals and conventions.
- `X-Axis-Org`: Selects the active org to scope coordination + search to (see Teams).

## Teams

An **org** is the unit of collaboration and billing. Members of an org share its
projects — and therefore the same **job board, file locks, and codebase index**.
Every account starts as a one-person org, so single users are unaffected; once you
invite someone, all of your agents (and theirs) coordinate on the same project
without clobbering each other.

### Create an org
Open the org switcher in the dashboard header → **+ new org**. The creator becomes
its admin. Existing personal projects keep working unchanged.

### Invite teammates
On the **/team** page, enter a teammate's email, choose `member` or `admin`, and
send. You get a shareable invite link immediately (`/invite/<token>`); the teammate
joins by opening it and logging in. Change roles or remove members from the same
table. An org always keeps at least one admin.

### Commit a shared project so agents auto-coordinate
Check a `.axis/axis.json` into the repo naming the shared project. Every teammate's
agent reads it on startup and coordinates on the same board, locks, and index — no
per-machine setup:

```json
{
  "projectName": "acme-app"
}
```

Because the project belongs to the org (not a single owner), any member who connects
sees the same jobs, locks, and search index. Agents may pass `X-Axis-Org: <orgId>`
to switch which org they're acting under; otherwise the personal org is used.

### Billing — $20 / seat
Orgs are billed per active member: **$20/seat/month**, quantity = active member
count. Adding a member adds a seat; removing one frees it (prorated via Stripe).
Admins manage it from **/billing**.

**Open core:** orchestration (job board, file locks, notepad, sessions) is **free**
for everyone. The intelligence layer (`search_codebase`, `deep_search`,
`index_codebase`) is the paid tier. Free orgs coordinate fully; they get an upgrade

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (for persistence and billing)
- A Stripe account (optional, for billing)

### Configuration

There are three ways to connect, easiest first. **All of them are zero-install
and nothing to update over time** except the legacy npm option.

#### Option A — One-click OAuth (recommended, no API key)

Connect by URL and log in through the browser — the same flow as Supabase's MCP.
You never paste or manage a key.

```bash
# 1. Add the server (no secret in the command)
claude mcp add --scope project --transport http axis https://useaxis.dev/api/mcp

# 2. Authenticate — run in a real terminal (not the IDE extension)
claude /mcp        # select "axis" → Authenticate → log in in the browser
```

This works in any MCP client that supports remote-server OAuth (Claude Code,
Cursor, etc.). Under the hood Axis is a full OAuth 2.1 authorization server
(PKCE, dynamic client registration, rotating refresh tokens); your client
discovers it automatically from `/api/mcp` and stores the resulting token for
you. For stdio-only clients (incl. Codex), bridge with `mcp-remote` and it will
run the same OAuth flow:

```toml
# ~/.codex/config.toml — Codex via the mcp-remote bridge (OAuth, no key)
[mcp_servers.axis]
command = "npx"
args = ["-y", "mcp-remote", "https://useaxis.dev/api/mcp"]
```

#### Option B — Hosted with an API key (no OAuth client needed)

If your client doesn't do OAuth, point it at the same URL and pass your key as a
Bearer header. The dashboard has a **"Copy connect command"** button that emits
this one-liner pre-filled with your key:

```bash
claude mcp add --transport http axis https://useaxis.dev/api/mcp \
  --header "Authorization: Bearer sk_sc_your_key"
```

```jsonc
// or as MCP config (native remote MCP)
{ "mcpServers": { "axis": {
  "url": "https://useaxis.dev/api/mcp",
  "headers": { "Authorization": "Bearer sk_sc_your_key" }
} } }
```

```toml
# Codex via mcp-remote bridge with a key
[mcp_servers.axis]
command = "npx"
args = ["-y", "mcp-remote", "https://useaxis.dev/api/mcp", "--header", "Authorization: Bearer sk_sc_your_key"]
```

#### Option C — Local npm server (legacy)

Runs the server on your machine via stdio. **You only need your Axis API key** —
the API URL defaults to the hosted backend (`https://useaxis.dev/api/v1`), the
project name is auto-derived from the working directory, and no Supabase/OpenAI
keys are needed locally (all of that lives server-side). Note this path requires
`npm` updates to get new tools, and `deep_search` is hosted-only.

```jsonc
// .cursor/mcp.json, ~/.claude.json / .mcp.json, or windsurf mcp_config.json
{
  "mcpServers": {
    "axis": {
      "command": "npx",
      "args": ["-y", "@virsanghavi/axis-server"],
      "env": { "AXIS_API_KEY": "sk_sc_your_key" }
    }
  }
}
```

```toml
# ~/.codex/config.toml
[mcp_servers.axis]
command = "npx"
args = ["-y", "@virsanghavi/axis-server"]
env = { AXIS_API_KEY = "sk_sc_your_key" }
```

**Project auto-detection:** the project name is derived from your **repo root**
(nearest `.git`/`package.json` walking up), so every repo maps to its own Axis
project automatically and launching from a subdirectory still resolves to the
same project. Override only if you want to — set `PROJECT_NAME`, or commit a
`.axis/axis.json` with `{ "project": "name" }`.

### Running the Server (local dev)

```bash
cd shared-context
AXIS_API_KEY=sk_sc_your_key npx tsx src/local/mcp-server.ts
```

### Indexing your codebase

`search_codebase`/`deep_search` only return what's been indexed. Populate the
index once (and refresh after big changes) with the CLI — it walks the repo,
respects `.gitignore`, and is **incremental + content-hashed**, so re-runs only
upload changed files:

```bash
AXIS_API_KEY=sk_sc_your_key npx @virsanghavi/axis-server index
# optional: index a specific path / project
AXIS_API_KEY=sk_sc_your_key npx @virsanghavi/axis-server index ./packages/api --project my-api
```

Agents keep it fresh in-session by calling the `index_codebase` tool after they
write files. Great as a pre-commit/CI step too — it's cheap when nothing changed.

## Tools Reference

The hosted server (`https://useaxis.dev/api/mcp`) exposes **15 tools** — the
canonical set. Every tool is scoped to your account by your OAuth token or API
key, and most accept an optional `projectName` (defaults to the auto-detected
project). The legacy local npm server exposes the same orchestration core plus
project-soul/context helpers (`get_project_soul`, `update_project_soul`,
`update_shared_context`, `search_docs`, `index_file`, `force_unlock`) but does
**not** include `deep_search`, `claim_job`, `list_jobs`, `list_locks`, or
`release_file_access` — use the hosted server for the full set.

### Search & Discovery

#### `search_codebase`
Hybrid semantic + full-text + trigram search over the indexed codebase,
reranked. Returns ranked hits with `file:line`, plus `related` files that
historically change together and `definitions` of what a top hit calls. Use it
by default for "where is X" / before creating or refactoring code.
- **Arguments**: `query` (string), `projectName` (string, optional)

#### `deep_search`
Agentic answer engine for "how does X work / where is Y handled and why" — reads
across files over multiple hops and returns a **cited** answer. *(Hosted only.)*
- **Arguments**: `query` (string), `projectName` (string, optional)

#### `index_codebase`
Index files so search works and stays fresh. **Incremental + content-hashed** —
unchanged files are skipped server-side (no re-embedding), so it's cheap to call
repeatedly; pass `prune: true` + `allPaths` to drop deleted files. Agents pass
the files they edited as `files: [{path, content}]`. For a full initial index of
a repo, the `axis index` CLI (below) is faster — it walks the repo and uploads
only deltas.
- **Arguments**: `files` ([{path, content}]), `prune` (bool, optional), `allPaths` (string[], optional), `projectName` (string, optional)

### Task Orchestration (Job Board)

#### `post_job`
Posts a task to the job board.
- **Arguments**: `title` (string), `description` (string), `priority` ("low" | "medium" | "high" | "critical", optional), `dependencies` (string[] of job IDs, optional)

#### `claim_next_job`
Claims the highest-priority unblocked job (load-balanced pickup across agents).
- **Arguments**: `agentId` (string)

#### `claim_job`
Claims a **specific** job by ID — preferred in multi-agent runs so each agent's
context stays focused. Rejected if the job's dependencies aren't done
(`BLOCKED_BY_DEPENDENCIES`).
- **Arguments**: `jobId` (string), `agentId` (string)

#### `complete_job`
Marks a job done and releases its file locks.
- **Arguments**: `jobId` (string), `agentId` (string, optional), `outcome` (string, optional)

#### `cancel_job`
Cancels a job that's no longer needed.
- **Arguments**: `jobId` (string), `reason` (string, optional)

#### `list_jobs`
Lists jobs on the board for the project.
- **Arguments**: `projectName` (string, optional)

### File Locking

#### `propose_file_access`
Requests a lock on a single file before editing. Returns `GRANTED`,
`REQUIRES_ORCHESTRATION` (another agent holds it), or `REJECTED` (e.g. a
directory). Use a descriptive `intent`.
- **Arguments**: `filePath` (string), `agentId` (string), `intent` (string)

#### `release_file_access`
Releases a lock you hold.
- **Arguments**: `filePath` (string), `reason` (string, optional)

#### `list_locks`
Lists active file locks for the project.
- **Arguments**: `projectName` (string, optional)

### Session

#### `finalize_session`
**Mandatory cleanup** when the user's request is fully complete — clears ALL
remaining locks and archives the session. Never end a session holding locks.
- **Arguments**: `content` (string, optional summary)

### Billing

#### `get_subscription_status`
Returns the caller's plan (Pro/Free) and validity period. Resolved from the
authenticated token — no email argument needed.

#### `get_usage_stats`
Returns the caller's API usage for the current billing period.

## Resources

- `mcp://context/current`: The real-time snapshot of the session, including active jobs, file locks, and the Live Notepad.
- `context://local/[filename]`: Direct access to files in `agent-instructions/`.
- `context://docs/[filename]`: Direct access to files in `docs/`.

## Troubleshooting

- **Server fails to start**: Ensure `AXIS_API_KEY` is set (it's the only required value).
- **"Profile not found"**: Ensure the user has signed up via the frontend and a record exists in the `profiles` table.
- **RAG/Search fails**: Ensure `SHARED_CONTEXT_API_URL` is set if using remote embeddings, otherwise it falls back to simple text search (if implemented).
