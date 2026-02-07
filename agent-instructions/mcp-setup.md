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

Create a `.env.local` file in the `shared-context` directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Context API (Optional, for RAG)
SHARED_CONTEXT_API_URL=https://api.axis.dev/v1
SHARED_CONTEXT_API_SECRET=your-api-secret

# Project Identity
PROJECT_NAME=my-axis-project
```

### Running the Server

To start the MCP server locally (using stdio transport for Agent integration):

```bash
cd shared-context
npx tsx src/local/mcp-server.ts
```

## Tools Reference

### Context & Memory

#### `read_context`
Reads a file from the shared context directory (`agent-instructions/`).
- **Arguments**: `filename` (string) - e.g., `context.md`

#### `update_context`
Updates a shared context file.
- **Arguments**: 
  - `filename` (string)
  - `content` (string)
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

- **Server fails to start**: Check `.env.local` for valid Supabase keys.
- **"Profile not found"**: Ensure the user has signed up via the frontend and a record exists in the `profiles` table.
- **RAG/Search fails**: Ensure `SHARED_CONTEXT_API_URL` is set if using remote embeddings, otherwise it falls back to simple text search (if implemented).
