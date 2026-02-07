#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

// ESM dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
    .name("axis-server")
    .description("Start the Axis Shared Context MCP Server")
    .version("1.0.0");

program.action(() => {
    console.log(chalk.bold.blue("Axis MCP Server Starting..."));

    // Locate the bundled server script
    const serverScript = path.resolve(__dirname, "../dist/mcp-server.mjs");

    if (!fs.existsSync(serverScript)) {
        console.error(chalk.red("Error: Server script not found."));
        console.error(chalk.yellow(`Expected at: ${serverScript}`));
        console.error(chalk.gray("Did you run 'npm run build'?"));
        process.exit(1);
    }

    console.log(chalk.gray(`Launching server context...`));
    
    // Pass through all arguments from the CLI to the underlying server
    const args = [serverScript, ...process.argv.slice(2)];

    // Spawn the node process with the bundled script
    const proc = spawn("node", args, { 
        stdio: "inherit",
        env: { ...process.env, FORCE_COLOR: '1' } 
    });
    
    proc.on("close", (code) => {
        if (code !== 0) {
            console.log(chalk.red(`Server process exited with code ${code}`));
        } else {
            console.log(chalk.green("Server stopped gracefully."));
        }
    });

    // Handle signals to cleanup child
    process.on('SIGINT', () => {
        proc.kill('SIGINT');
    });
    process.on('SIGTERM', () => {
        proc.kill('SIGTERM');
    });
});

program.parse();
