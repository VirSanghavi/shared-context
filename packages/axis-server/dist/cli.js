#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// bin/cli.ts
var import_commander = require("commander");
var import_chalk = __toESM(require("chalk"));
var import_child_process = require("child_process");
var import_path = __toESM(require("path"));
var import_url = require("url");
var import_fs = __toESM(require("fs"));
var import_child_process2 = require("child_process");
var __filename2 = (0, import_url.fileURLToPath)(importMetaUrl);
var __dirname = import_path.default.dirname(__filename2);
var HOMED\u0130R = process.env.HOME || process.env.USERPROFILE || process.cwd();
var AXIS_DIR = import_path.default.join(HOMED\u0130R, ".axis");
if (!import_fs.default.existsSync(AXIS_DIR)) {
  import_fs.default.mkdirSync(AXIS_DIR, { recursive: true });
}
var PID_FILE = import_path.default.join(AXIS_DIR, "server.pid");
var LOG_FILE = import_path.default.join(AXIS_DIR, "server.log");
function getPid() {
  if (import_fs.default.existsSync(PID_FILE)) {
    return parseInt(import_fs.default.readFileSync(PID_FILE, "utf8").trim());
  }
  return null;
}
function isRunning(pid) {
  try {
    (0, import_child_process2.execSync)(`ps -p ${pid}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
import_commander.program.name("axis-server").description("Start the Axis Shared Context MCP Server").version("1.0.0");
import_commander.program.command("start").description("Start the server in the background").option("-d, --daemon", "Run in background mode", true).action((options) => {
  const pid = getPid();
  if (pid && isRunning(pid)) {
    console.error(import_chalk.default.yellow(`Server is already running (PID: ${pid})`));
    process.exit(0);
  }
  console.error(import_chalk.default.bold.blue("Starting Axis MCP Server in background..."));
  const serverScript = import_path.default.resolve(__dirname, "../dist/mcp-server.mjs");
  const logStream = import_fs.default.openSync(LOG_FILE, "a");
  const proc = (0, import_child_process.spawn)("sh", ["-c", `tail -f /dev/null | node "${serverScript}"`], {
    detached: true,
    stdio: ["ignore", logStream, logStream],
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: "1" }
  });
  console.error(import_chalk.default.gray(`Target PID file: ${PID_FILE}`));
  try {
    import_fs.default.writeFileSync(PID_FILE, proc.pid.toString());
    console.error(import_chalk.default.green(`Wrote PID ${proc.pid} to file.`));
  } catch (e) {
    console.error(import_chalk.default.red(`FATAL: Could not write PID file: ${e}`));
  }
  import_fs.default.fsyncSync(import_fs.default.openSync(PID_FILE, "r"));
  proc.unref();
  console.error(import_chalk.default.green(`Server started (PID: ${proc.pid})`));
  console.error(import_chalk.default.gray(`Logs available at: ${LOG_FILE}`));
  setTimeout(() => {
    process.exit(0);
  }, 100);
});
import_commander.program.command("stop").description("Stop the background server").action(() => {
  const pid = getPid();
  if (!pid || !isRunning(pid)) {
    console.error(import_chalk.default.yellow("Server is not running."));
    if (import_fs.default.existsSync(PID_FILE)) import_fs.default.unlinkSync(PID_FILE);
    return;
  }
  console.error(import_chalk.default.blue(`Stopping server (PID: ${pid})...`));
  try {
    process.kill(pid, "SIGINT");
    let attempts = 0;
    const interval = setInterval(() => {
      if (!isRunning(pid) || attempts > 10) {
        clearInterval(interval);
        if (import_fs.default.existsSync(PID_FILE)) import_fs.default.unlinkSync(PID_FILE);
        console.error(import_chalk.default.green("Server stopped."));
      }
      attempts++;
    }, 500);
  } catch (err) {
    console.error(import_chalk.default.red(`Error stopping server: ${err}`));
  }
});
import_commander.program.command("status").description("Check server status").action(() => {
  const pid = getPid();
  if (pid && isRunning(pid)) {
    console.error(import_chalk.default.green(`\u25CF Axis MCP Server is running (PID: ${pid})`));
    console.error(import_chalk.default.gray(`Logs: ${LOG_FILE}`));
  } else if (pid) {
    console.error(import_chalk.default.red(`\u25CB Axis MCP Server is not running.`));
    console.error(import_chalk.default.gray(`Found stale PID file (${pid}). Run stop to clean up.`));
  } else {
    console.error(import_chalk.default.red(`\u25CB Axis MCP Server is not running.`));
  }
});
import_commander.program.command("logs").description("Show server logs").option("-f, --follow", "Follow log output").action((options) => {
  if (!import_fs.default.existsSync(LOG_FILE)) {
    console.error(import_chalk.default.yellow("No log file found."));
    return;
  }
  if (options.follow) {
    (0, import_child_process.spawn)("tail", ["-f", LOG_FILE], { stdio: "inherit" });
  } else {
    console.log(import_fs.default.readFileSync(LOG_FILE, "utf8"));
  }
});
import_commander.program.command("server [root]", { isDefault: true }).description("Start the server in the foreground (default)").action((root) => {
  const pid = getPid();
  if (pid && isRunning(pid)) {
    console.error(import_chalk.default.yellow(`Axis server is already running in the background (PID: ${pid}).`));
    console.error(import_chalk.default.gray(`To stop it, run: npx @virsanghavi/axis-server stop`));
  }
  console.error(import_chalk.default.bold.blue("Axis MCP Server Starting..."));
  if (root) {
    const resolvedRoot = import_path.default.resolve(root);
    if (import_fs.default.existsSync(resolvedRoot)) {
      console.error(import_chalk.default.blue(`Setting CWD to: ${resolvedRoot}`));
      process.chdir(resolvedRoot);
    } else {
      console.error(import_chalk.default.red(`Error: Project root not found: ${resolvedRoot}`));
      process.exit(1);
    }
  }
  const serverScript = import_path.default.resolve(__dirname, "../dist/mcp-server.mjs");
  if (!import_fs.default.existsSync(serverScript)) {
    console.error(import_chalk.default.red("Error: Server script not found."));
    console.error(import_chalk.default.yellow(`Expected at: ${serverScript}`));
    console.error(import_chalk.default.gray("Did you run 'npm run build'?"));
    process.exit(1);
  }
  console.error(import_chalk.default.gray(`Launching server context...`));
  const args = [serverScript, ...process.argv.slice(2)];
  const proc = (0, import_child_process.spawn)("node", args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: "1" }
  });
  proc.on("close", (code) => {
    if (code !== 0) {
      console.error(import_chalk.default.red(`Server process exited with code ${code}`));
    } else {
      console.error(import_chalk.default.green("Server stopped gracefully."));
    }
  });
  process.on("SIGINT", () => {
    proc.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    proc.kill("SIGTERM");
  });
});
import_commander.program.parse();
