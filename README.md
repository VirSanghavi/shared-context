# Shared Context Layer for AI Coding Agents via MCP

A shared context server that allows different AI agents (Claude Code, Cursor, Windsurf) to share knowledge about project architecture, conventions, and recent activity.

## features

1.  **Local Context Storage**: Markdown files in `./agent-instructions/` (`context.md`, `conventions.md`, `activity.md`).
2.  **MCP Server**: Exposes these files to any MCP-compatible agent.
3.  **Smart Retrieval (RAG)**: (Planned) Vector search via hosted API.

## Setup

1.  **Install Dependencies**:
    ```bash
    bun install
    ```

2.  **Initialize Context**:
    ```bash
    bun cli init
    ```

3.  **Start MCP Server**:
    To run the server locally for testing/connection:
    ```bash
    bun start:local
    ```
    
    *Address for MCP Clients*: Since it runs on stdio, you typically configure your agent (e.g., in `claude_desktop_config.json` or Cursor settings) to run:
    ```json
    {
      "mcpServers": {
        "shared-context": {
          "command": "bun",
          "args": ["run", "/path/to/shared-context/src/local/mcp-server.ts"]
        }
      }
    }
    ```

4.  **CLI Usage**:
    ```bash
    # Add an entry to activity.md
    bun cli add-context "Refactored the API to use Hono"
    ```

## Zero-Touch Philosophy

The key to this system is that **you (the human) should never manually edit the shared context**.

1.  **Just talk to your agents.**
2.  If you tell Claude: "Build a todo app", Claude will automatically:
    *   Create 3-4 jobs on the "Invisible Job Board".
    *   Start working on the first one.
3.  If you open Cursor and say "Help out", Cursor will:
    *   Automatically check the board.
    *   Claim the next open job.
    *   Start working without you explaining anything.

The "Notebook" manages itself.

### Architecture

- **Active Orchestrator (`src/local/server.ts`)**: A single-process HTTP/SSE server that holds memorystate.
- **Job Board**: In-memory task registry.
- **RAG Memory**: Vector embeddings of all past decisions and prompts.

## Setup
