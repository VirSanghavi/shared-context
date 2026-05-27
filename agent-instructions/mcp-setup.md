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
[mcp_servers.axis]
command = "npx"
args = ["-y", "@virsanghavi/axis-server"]
env = { AXIS_API_KEY = "sk_sc_your_key" }
```

**Hosted (zero-install, nothing to update — recommended)** — point any client
that supports remote MCP at the URL; for stdio-only clients (incl. Codex), use
the `mcp-remote` bridge:

```jsonc
// native remote MCP (Claude Code, etc.)
{ "mcpServers": { "axis": {
  "url": "https://useaxis.dev/api/mcp",
  "headers": { "Authorization": "Bearer sk_sc_your_key" }
} } }
```

```toml
# Codex via mcp-remote bridge
[mcp_servers.axis]
command = "npx"
args = ["-y", "mcp-remote", "https://useaxis.dev/api/mcp", "--header", "Authorization: Bearer sk_sc_your_key"]
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

## Tools Reference

### Context & Memory

#### `read_context`
Reads a file from the shared context directory (`agent-instructions/`).
- **Arguments**: `filename` (string) - e.g., `context.md`

#### `update_project_soul`
Updates the project soul in a single call.
- The project soul = `context.md` (goals, architecture, features) + `conventions.md` (coding standards, agent norms).
- **Arguments**:
  - `context` (string, optional) — full content for `context.md`
  - `conventions` (string, optional) — full content for `conventions.md`

#### `update_context`
Updates any shared context file (for files beyond the soul, or for appending).
- **Arguments**:
  - `filename` (string) — e.g., `"activity.md"`
  - `content` (string) — the full file content (or text to append)
  - `append` (boolean, default: false)

#### `search_context` / `search_docs`
Semantically searches the project context or documentation.
- **Arguments**: `query` (string)

#### `update_shared_context`
Appends text to the Live Notepad (short-term memory).
- **Arguments**:
  - `agentId` (string)
  - `text` (string)

### Task Orchestration (Job Board)

#### `post_job`
Creates a new task on the job board.
- **Arguments**:
  - `title` (string)
  - `description` (string)
  - `priority` ("low" | "medium" | "high" | "critical")
  - `dependencies` (string array, optional)

#### `claim_next_job`
Auto-assigns the highest priority available job to the agent.
- **Arguments**: `agentId` (string)

#### `complete_job`
Marks a job as done.
- **Arguments**:
  - `agentId` (string)
  - `jobId` (string)
  - `outcome` (string)

### Governance & Billing

#### `propose_file_access`
Requests a lock on a file to prevent conflicts.
- **Arguments**:
  - `agentId` (string)
  - `filePath` (string)
  - `intent` (string)
  - `userPrompt` (string)

#### `get_subscription_status`
Checks if a user has an active Pro subscription.
- **Arguments**: `email` (string)
- **Returns**: Plan status ("Pro" or "Free"), validity period.

#### `get_usage_stats`
Retrieves API usage metrics for the current billing period.
- **Arguments**: `email` (string)

## Resources

- `mcp://context/current`: The real-time snapshot of the session, including active jobs, file locks, and the Live Notepad.
- `context://local/[filename]`: Direct access to files in `agent-instructions/`.
- `context://docs/[filename]`: Direct access to files in `docs/`.

## Troubleshooting

- **Server fails to start**: Ensure `AXIS_API_KEY` is set (it's the only required value).
- **"Profile not found"**: Ensure the user has signed up via the frontend and a record exists in the `profiles` table.
- **RAG/Search fails**: Ensure `SHARED_CONTEXT_API_URL` is set if using remote embeddings, otherwise it falls back to simple text search (if implemented).
