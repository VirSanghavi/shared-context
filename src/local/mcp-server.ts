import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Configuration
const INSTRUCTIONS_DIR = path.resolve(process.cwd(), "agent-instructions");
const API_URL = process.env.SHARED_CONTEXT_API_URL;
const API_SECRET = process.env.SHARED_CONTEXT_API_SECRET;

// Initialize server
const server = new Server(
  {
    name: "shared-context-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Tools
const READ_CONTEXT_TOOL = "read_context";
const UPDATE_CONTEXT_TOOL = "update_context";
const SEARCH_CONTEXT_TOOL = "search_context";

server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
        const files = await fs.readdir(INSTRUCTIONS_DIR);
        return {
            resources: files
                .filter(f => f.endsWith('.md'))
                .map(f => ({
                    uri: `context://local/${f}`,
                    name: f,
                    mimeType: "text/markdown",
                    description: `Shared context file: ${f}`
                }))
        };
    } catch (error) {
        console.error("Error listing resources:", error);
        return { resources: [] };
    }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const fileName = uri.replace("context://local/", "");
    const filePath = path.join(INSTRUCTIONS_DIR, fileName);
    
    try {
        const content = await fs.readFile(filePath, "utf-8");
        return {
            contents: [{
                uri,
                mimeType: "text/markdown",
                text: content
            }]
        };
    } catch (error) {
        throw new Error(`Resource not found: ${uri}`);
    }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: READ_CONTEXT_TOOL,
        description: "Read the shared context files (context.md, conventions.md, activity.md)",
        inputSchema: {
          type: "object",
          properties: {
             filename: { type: "string", description: "The name of the file to read (e.g., 'context.md')" }
          },
          required: ["filename"]
        },
      },
      {
        name: UPDATE_CONTEXT_TOOL,
        description: "Update a shared context file",
        inputSchema: {
          type: "object",
          properties: {
            filename: { type: "string", description: "File to update" },
            content: { type: "string", description: "New content" },
            append: { type: "boolean", description: "Whether to append or overwrite (default: overwrite)" }
          },
          required: ["filename", "content"],
        },
      },
      {
        name: SEARCH_CONTEXT_TOOL,
        description: "Search shared context using RAG (Remote API)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === READ_CONTEXT_TOOL) {
      const filename = String(args?.filename);
      const filePath = path.join(INSTRUCTIONS_DIR, filename);
      try {
          const data = await fs.readFile(filePath, 'utf-8');
          return {
              content: [{ type: "text", text: data }]
          };
      } catch (err) {
          return {
              content: [{ type: "text", text: `Error reading file: ${err}` }],
              isError: true
          }
      }
  }

  if (name === UPDATE_CONTEXT_TOOL) {
      const filename = String(args?.filename);
      const content = String(args?.content);
      const append = Boolean(args?.append);
      
      const filePath = path.join(INSTRUCTIONS_DIR, filename);
      try {
          if (append) {
              await fs.appendFile(filePath, "\n" + content);
          } else {
              await fs.writeFile(filePath, content);
          }
          return {
              content: [{ type: "text", text: `Updated ${filename}` }]
          };
      } catch (err) {
          return {
              content: [{ type: "text", text: `Error updating file: ${err}` }],
              isError: true
          }
      }
  }

  if (name === SEARCH_CONTEXT_TOOL) {
     if (!API_URL) {
         return {
             content: [{ type: "text", text: "Error: SHARED_CONTEXT_API_URL not configured in environment." }],
             isError: true
         };
     }

     const query = String(args?.query);
     
     try {
         const response = await fetch(`${API_URL}/search`, {
             method: "POST",
             headers: {
                 "Content-Type": "application/json",
                 "Authorization": `Bearer ${API_SECRET || ""}`
             },
             body: JSON.stringify({ query })
         });
         
         if (!response.ok) {
              const text = await response.text();
              return {
                  content: [{ type: "text", text: `API Error ${response.status}: ${text}` }],
                  isError: true
              };
         }
         
         const result = await response.json() as any;
         
         if (result.results && Array.isArray(result.results)) {
             const formatted = result.results.map((r: any) => 
                 `[Similarity: ${(r.similarity * 100).toFixed(1)}%] ${r.content}`
             ).join("\n\n---\n\n");
             
             return {
                 content: [{ type: "text", text: formatted || "No results found." }]
             }
         }
         
         return {
             content: [{ type: "text", text: "No results format recognized." }]
         };

     } catch (err) {
         return {
             content: [{ type: "text", text: `Search Execution Error: ${err}` }],
             isError: true
         }
     }
  }

  throw new Error(`Tool not found: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Shared Context MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
