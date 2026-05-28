#!/usr/bin/env node
// Tool-call pickup-rate analyzer for Axis.
//
// Reads a JSONL log produced by the MCP server when AXIS_TOOL_LOG is set,
// and computes the metrics that matter for adoption:
//   - per-session tool sequences (did the agent run the lifecycle?)
//   - cold-pickup rate: how often each tool fires unprompted in fresh sessions
//   - top-N tool usage and the orphan tools never called
//   - lock hygiene: did every propose_file_access have a matching complete_job
//     or finalize_session before the session ended?
//
// USAGE:
//   # In the agent's MCP config (mcp.json), add the env var to axis-server:
//   #   "AXIS_TOOL_LOG": "/tmp/axis-tools.jsonl"
//   # Then run any task, then:
//   node scripts/analyze-tool-log.mjs /tmp/axis-tools.jsonl
//   node scripts/analyze-tool-log.mjs /tmp/axis-tools.jsonl --json > report.json
//
// Exits 0 on success. The JSON output is suitable for piping into a dashboard.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const logPath = args.find(a => !a.startsWith("--"));

if (!logPath) {
  console.error("Usage: analyze-tool-log.mjs <path-to-jsonl> [--json]");
  process.exit(2);
}

const raw = readFileSync(logPath, "utf-8");
const entries = raw
  .split("\n")
  .filter(line => line.trim())
  .map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  })
  .filter(Boolean);

if (!entries.length) {
  console.error(`No entries in ${logPath}`);
  process.exit(1);
}

// ── Per-session grouping ──
const sessions = new Map();
for (const e of entries) {
  if (!sessions.has(e.session)) sessions.set(e.session, []);
  sessions.get(e.session).push(e);
}

// ── Tool taxonomy ──
const KNOWN_TOOLS = [
  "get_project_soul", "update_project_soul",
  "read_context", "update_context", "search_context",
  "search_codebase", "search_docs", "index_codebase", "index_file",
  "propose_file_access", "force_unlock",
  "post_job", "claim_next_job", "claim_job", "complete_job", "cancel_job", "list_jobs",
  "update_shared_context", "finalize_session",
  "get_subscription_status", "get_usage_stats",
];

// ── Per-tool stats ──
const toolCounts = new Map();
for (const e of entries) {
  toolCounts.set(e.tool, (toolCounts.get(e.tool) || 0) + 1);
}
const orphans = KNOWN_TOOLS.filter(t => !toolCounts.has(t));

// ── Lifecycle pickup ──
// A "complete lifecycle" session calls get_project_soul → post_job →
// propose_file_access → complete_job → finalize_session in that rough order.
function lifecycleScore(toolNames) {
  const set = new Set(toolNames);
  const checkpoints = [
    "get_project_soul",
    "post_job",
    "propose_file_access",
    "complete_job",
    "finalize_session",
  ];
  const hit = checkpoints.filter(t => set.has(t));
  return { hit: hit.length, of: checkpoints.length, missing: checkpoints.filter(t => !set.has(t)) };
}

// ── Lock hygiene ──
// For each session: count proposals vs. completes + finalize. If proposals > 0
// and the session has neither a complete_job nor a finalize_session, that's a
// dangling-lock pattern.
function lockHygiene(events) {
  const proposals = events.filter(e => e.tool === "propose_file_access").length;
  const completes = events.filter(e => e.tool === "complete_job").length;
  const finalizes = events.filter(e => e.tool === "finalize_session").length;
  return {
    proposals,
    completes,
    finalizes,
    dangling: proposals > 0 && completes === 0 && finalizes === 0,
  };
}

const perSession = [];
let coldOK = 0;
for (const [session, events] of sessions) {
  const tools = events.map(e => e.tool);
  const lifecycle = lifecycleScore(tools);
  const hygiene = lockHygiene(events);
  const firstTool = tools[0];
  const coldStartedWithSoul = firstTool === "get_project_soul";
  if (coldStartedWithSoul) coldOK++;
  perSession.push({
    session,
    calls: events.length,
    distinctTools: new Set(tools).size,
    firstTool,
    coldStartedWithSoul,
    lifecycle,
    hygiene,
  });
}

const report = {
  logPath,
  totalCalls: entries.length,
  sessions: sessions.size,
  coldPickupRate: sessions.size ? (coldOK / sessions.size) : 0,
  toolFrequency: Object.fromEntries(
    [...toolCounts.entries()].sort((a, b) => b[1] - a[1])
  ),
  orphanTools: orphans,
  perSession,
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// ── Human-readable report ──
console.log(`Axis tool-call analysis: ${logPath}\n`);
console.log(`  ${entries.length} calls across ${sessions.size} session(s)`);
console.log(`  Cold pickup rate (first call == get_project_soul): ${(report.coldPickupRate * 100).toFixed(1)}%\n`);

console.log("Tool frequency:");
for (const [tool, count] of Object.entries(report.toolFrequency)) {
  console.log(`  ${count.toString().padStart(4)}  ${tool}`);
}

if (orphans.length) {
  console.log("\nOrphan tools (never called):");
  for (const t of orphans) console.log(`  - ${t}`);
}

console.log("\nPer-session lifecycle:");
for (const s of perSession) {
  const lc = `${s.lifecycle.hit}/${s.lifecycle.of}`;
  const cold = s.coldStartedWithSoul ? "✓" : "✗";
  const dangling = s.hygiene.dangling ? "  ⚠ DANGLING LOCKS" : "";
  console.log(`  [${s.session.slice(0, 16)}] cold:${cold} lifecycle:${lc} calls:${s.calls}${dangling}`);
  if (s.lifecycle.missing.length) {
    console.log(`     missing: ${s.lifecycle.missing.join(", ")}`);
  }
}
