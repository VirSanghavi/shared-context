#!/usr/bin/env bun
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const program = new Command();

program
  .name("agent-sync")
  .description("CLI for Shared Context Layer");

program
  .command("init")
  .description("Initialize agent-instructions in the current directory")
  .action(async () => {
    const dir = path.join(process.cwd(), "agent-instructions");
    try {
      await fs.mkdir(dir, { recursive: true });
      
      const files = ["context.md", "conventions.md", "activity.md"];
      for (const file of files) {
          const filePath = path.join(dir, file);
          try {
              await fs.access(filePath);
              console.log(`Skipping ${file} (already exists)`);
          } catch {
              await fs.writeFile(filePath, `# ${file.replace('.md', '')}\n\nAdd content here.`);
              console.log(`Created ${file}`);
          }
      }
      console.log("Initialization complete.");
    } catch (error) {
      console.error("Error initializing:", error);
    }
  });

program
  .command("add-context")
  .description("Add context to activity.md")
  .argument("<text>", "Text to add")
  .action(async (text) => {
      const filePath = path.join(process.cwd(), "agent-instructions", "activity.md");
      try {
          await fs.appendFile(filePath, `\n- ${text}`);
          console.log("Added context to activity.md");
      } catch (error) {
          console.error("Error writing file:", error);
      }
  });

program
  .command("sync")
  .description("Sync local context to Hosted API for RAG")
  .action(async () => {
    const apiUrl = process.env.SHARED_CONTEXT_API_URL;
    const apiSecret = process.env.SHARED_CONTEXT_API_SECRET;

    if (!apiUrl) {
        console.error("Error: SHARED_CONTEXT_API_URL is not set in .env.local");
        process.exit(1);
    }
    
    console.log(`Syncing to ${apiUrl}...`);

    const dir = path.join(process.cwd(), "agent-instructions");
    const items = [];

    try {
        const files = await fs.readdir(dir);
        for (const file of files) {
            if (!file.endsWith('.md')) continue;
            
            const filePath = path.join(dir, file);
            const content = await fs.readFile(filePath, "utf-8");
            
            // Chunking Strategy: Split by double newlines (paragraphs)
            // But keep chunks reasonable size.
            const chunks = content.split(/\n\s*\n/);
            
            for (const chunk of chunks) {
                if (chunk.trim().length === 0) continue;
                
                items.push({
                    content: chunk.trim(),
                    metadata: {
                        filename: file,
                        source: "agent-instructions"
                    }
                });
            }
        }

        if (items.length === 0) {
            console.log("No content to sync.");
            return;
        }

        // Send to API
        const response = await fetch(`${apiUrl}/embed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiSecret || ""}`
            },
            body: JSON.stringify({ items })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text}`);
        }

        const result = await response.json();
        console.log("Sync complete!", result);

    } catch (error) {
        console.error("Sync failed:", error);
        process.exit(1);
    }
  });

program.parse();
