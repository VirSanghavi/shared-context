// ../../src/local/mcp-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

// ../../src/local/context-manager.ts
import fs from "fs/promises";
import path from "path";
import { Mutex } from "async-mutex";
var INSTRUCTIONS_DIR = path.resolve(process.cwd(), "agent-instructions");
var ContextManager = class {
  mutex;
  apiUrl;
  apiSecret;
  constructor(apiUrl, apiSecret) {
    this.mutex = new Mutex();
    this.apiUrl = apiUrl;
    this.apiSecret = apiSecret;
  }
  resolveFilePath(filename) {
    if (!filename || filename.includes("\0")) {
      throw new Error("Invalid filename");
    }
    const resolved = path.resolve(INSTRUCTIONS_DIR, filename);
    if (!resolved.startsWith(INSTRUCTIONS_DIR + path.sep)) {
      throw new Error("Invalid file path");
    }
    return resolved;
  }
  async listFiles() {
    try {
      const files = await fs.readdir(INSTRUCTIONS_DIR);
      const docFiles = await this.listDocs();
      const instructionFiles = files.filter((f) => f.endsWith(".md")).map((f) => ({
        uri: `context://local/${f}`,
        name: f,
        mimeType: "text/markdown",
        description: `Shared context file: ${f}`
      }));
      return [...instructionFiles, ...docFiles];
    } catch (error) {
      console.error("Error listing resources:", error);
      return [];
    }
  }
  async listDocs() {
    const docsDir = path.resolve(process.cwd(), "docs");
    try {
      await fs.access(docsDir);
      const files = await fs.readdir(docsDir);
      return files.filter((f) => f.endsWith(".md")).map((f) => ({
        uri: `context://docs/${f}`,
        name: `Docs: ${f}`,
        mimeType: "text/markdown",
        description: `Documentation file: ${f}`
      }));
    } catch {
      return [];
    }
  }
  async readFile(filename) {
    if (filename.startsWith("docs/")) {
      const docName = filename.replace("docs/", "");
      const docPath = path.resolve(process.cwd(), "docs", docName);
      if (!docPath.startsWith(path.resolve(process.cwd(), "docs"))) {
        throw new Error("Invalid doc path");
      }
      return await fs.readFile(docPath, "utf-8");
    }
    const filePath = this.resolveFilePath(filename);
    return await fs.readFile(filePath, "utf-8");
  }
  async updateFile(filename, content, append = false) {
    const filePath = this.resolveFilePath(filename);
    return await this.mutex.runExclusive(async () => {
      if (append) {
        await fs.appendFile(filePath, "\n" + content);
      } else {
        await fs.writeFile(filePath, content);
      }
      return `Updated ${filename}`;
    });
  }
  async searchContext(query) {
    if (!this.apiUrl) {
      throw new Error("SHARED_CONTEXT_API_URL not configured.");
    }
    const response = await fetch(`${this.apiUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiSecret || ""}`
      },
      body: JSON.stringify({ query })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error ${response.status}: ${text}`);
    }
    const result = await response.json();
    if (result.results && Array.isArray(result.results)) {
      return result.results.map(
        (r) => `[Similarity: ${(r.similarity * 100).toFixed(1)}%] ${r.content}`
      ).join("\n\n---\n\n") || "No results found.";
    }
    throw new Error("No results format recognized.");
  }
  async embedContent(items) {
    if (!this.apiUrl) {
      console.warn("Skipping RAG embedding: SHARED_CONTEXT_API_URL not configured.");
      return;
    }
    const response = await fetch(`${this.apiUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiSecret || ""}`
      },
      body: JSON.stringify({ items })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error ${response.status}: ${text}`);
    }
    return await response.json();
  }
};

// ../../src/local/nerve-center.ts
import { Mutex as Mutex2 } from "async-mutex";
import { createClient } from "@supabase/supabase-js";
import fs2 from "fs/promises";
import path2 from "path";

// ../../src/utils/logger.ts
var Logger = class {
  level = "info" /* INFO */;
  setLevel(level) {
    this.level = level;
  }
  log(level, message, meta) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    console.log(JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    }));
  }
  debug(message, meta) {
    if (this.level === "debug" /* DEBUG */) this.log("debug" /* DEBUG */, message, meta);
  }
  info(message, meta) {
    this.log("info" /* INFO */, message, meta);
  }
  warn(message, meta) {
    this.log("warn" /* WARN */, message, meta);
  }
  error(message, error, meta) {
    this.log("error" /* ERROR */, message, {
      ...meta,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
  }
};
var logger = new Logger();

// ../../src/local/nerve-center.ts
var STATE_FILE = process.env.NERVE_CENTER_STATE_FILE || path2.join(process.cwd(), "history", "nerve-center-state.json");
var LOCK_TIMEOUT_DEFAULT = 30 * 60 * 1e3;
var NerveCenter = class {
  mutex;
  state;
  contextManager;
  stateFilePath;
  lockTimeout;
  supabase;
  projectId;
  projectName;
  useSupabase;
  /**
   * @param contextManager - Instance of ContextManager for legacy operations
   * @param options - Configuration options for state persistence and timeouts
   */
  constructor(contextManager, options = {}) {
    this.mutex = new Mutex2();
    this.contextManager = contextManager;
    this.stateFilePath = options.stateFilePath || STATE_FILE;
    this.lockTimeout = options.lockTimeout || LOCK_TIMEOUT_DEFAULT;
    this.projectName = options.projectName || process.env.PROJECT_NAME || "default";
    const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.useSupabase = true;
    } else {
      this.useSupabase = false;
    }
    this.state = {
      locks: {},
      jobs: {},
      liveNotepad: "Session Start: " + (/* @__PURE__ */ new Date()).toISOString() + "\n"
    };
  }
  async init() {
    await this.loadState();
    if (this.useSupabase) {
      await this.ensureProjectId();
    }
  }
  async ensureProjectId() {
    if (!this.supabase) return;
    const { data: project, error } = await this.supabase.from("projects").select("id").eq("name", this.projectName).maybeSingle();
    if (error) {
      logger.error("Failed to load project", error);
      return;
    }
    if (project?.id) {
      this.projectId = project.id;
      return;
    }
    const { data: created, error: createError } = await this.supabase.from("projects").insert({ name: this.projectName }).select("id").single();
    if (createError) {
      logger.error("Failed to create project", createError);
      return;
    }
    this.projectId = created.id;
  }
  jobFromRecord(record) {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      priority: record.priority,
      status: record.status,
      assignedTo: record.assigned_to || void 0,
      dependencies: record.dependencies || void 0,
      createdAt: Date.parse(record.created_at),
      updatedAt: Date.parse(record.updated_at)
    };
  }
  // --- Data Access Layers (Hybrid: Supabase > Local) ---
  async listJobs() {
    if (!this.useSupabase || !this.supabase || !this.projectId) {
      return Object.values(this.state.jobs);
    }
    const { data, error } = await this.supabase.from("jobs").select("id,title,description,priority,status,assigned_to,dependencies,created_at,updated_at").eq("project_id", this.projectId);
    if (error || !data) {
      logger.error("Failed to load jobs", error);
      return [];
    }
    return data.map((record) => this.jobFromRecord(record));
  }
  async getLocks() {
    if (!this.useSupabase || !this.supabase || !this.projectId) {
      return Object.values(this.state.locks);
    }
    try {
      await this.supabase.rpc("clean_stale_locks", {
        p_project_id: this.projectId,
        p_timeout_seconds: Math.floor(this.lockTimeout / 1e3)
      });
      const { data, error } = await this.supabase.from("locks").select("*").eq("project_id", this.projectId);
      if (error) throw error;
      return (data || []).map((row) => ({
        agentId: row.agent_id,
        filePath: row.file_path,
        intent: row.intent,
        userPrompt: row.user_prompt,
        timestamp: Date.parse(row.updated_at)
      }));
    } catch (e) {
      logger.warn("Failed to fetch locks from DB, falling back to local memory", e);
      return Object.values(this.state.locks);
    }
  }
  async saveState() {
    try {
      await fs2.mkdir(path2.dirname(this.stateFilePath), { recursive: true });
      await fs2.writeFile(this.stateFilePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error("Failed to persist state", error);
    }
  }
  async loadState() {
    try {
      const data = await fs2.readFile(this.stateFilePath, "utf-8");
      this.state = JSON.parse(data);
      logger.info("State loaded from disk");
    } catch (_error) {
    }
  }
  // --- Job Board Protocol (Active Orchestration) ---
  async postJob(title, description, priority = "medium", dependencies = []) {
    return await this.mutex.runExclusive(async () => {
      let id = `job-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
      if (this.useSupabase && this.supabase && this.projectId) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { data, error } = await this.supabase.from("jobs").insert({
          project_id: this.projectId,
          title,
          description,
          priority,
          status: "todo",
          assigned_to: null,
          dependencies,
          created_at: now,
          updated_at: now
        }).select("id").single();
        if (error) {
          logger.error("Failed to post job", error);
        } else if (data?.id) {
          id = data.id;
        }
      } else {
        this.state.jobs[id] = {
          id,
          title,
          description,
          priority,
          dependencies,
          status: "todo",
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }
      const depText = dependencies.length ? ` (Depends on: ${dependencies.join(", ")})` : "";
      this.state.liveNotepad += `
- [JOB POSTED] [${priority.toUpperCase()}] ${title} (ID: ${id})${depText}`;
      logger.info(`Job posted: ${title}`, { jobId: id, priority });
      await this.saveState();
      return { jobId: id, status: "POSTED" };
    });
  }
  async claimNextJob(agentId) {
    return await this.mutex.runExclusive(async () => {
      const priorities = ["critical", "high", "medium", "low"];
      const allJobs = await this.listJobs();
      const jobsById = new Map(allJobs.map((job2) => [job2.id, job2]));
      const availableJobs = allJobs.filter((job2) => job2.status === "todo").filter((job2) => {
        if (!job2.dependencies || job2.dependencies.length === 0) return true;
        return job2.dependencies.every((depId) => jobsById.get(depId)?.status === "done");
      }).sort((a, b) => {
        const pA = priorities.indexOf(a.priority);
        const pB = priorities.indexOf(b.priority);
        if (pA !== pB) return pA - pB;
        return a.createdAt - b.createdAt;
      });
      if (availableJobs.length === 0) {
        return { status: "NO_JOBS_AVAILABLE", message: "Relax. No open tickets (or dependencies not met)." };
      }
      if (this.useSupabase && this.supabase) {
        for (const candidate of availableJobs) {
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const { data, error } = await this.supabase.from("jobs").update({
            status: "in_progress",
            assigned_to: agentId,
            updated_at: now
          }).eq("id", candidate.id).eq("status", "todo").select("id,title,description,priority,status,assigned_to,dependencies,created_at,updated_at");
          if (error) {
            logger.error("Failed to claim job", error);
            continue;
          }
          if (data && data.length > 0) {
            const job2 = this.jobFromRecord(data[0]);
            this.state.liveNotepad += `
- [JOB CLAIMED] Agent '${agentId}' picked up: ${job2.title}`;
            logger.info(`Job claimed`, { jobId: job2.id, agentId });
            await this.saveState();
            return { status: "CLAIMED", job: job2 };
          }
        }
        return { status: "NO_JOBS_AVAILABLE", message: "All available jobs were just claimed." };
      }
      const job = availableJobs[0];
      job.status = "in_progress";
      job.assignedTo = agentId;
      job.updatedAt = Date.now();
      this.state.liveNotepad += `
- [JOB CLAIMED] Agent '${agentId}' picked up: ${job.title}`;
      logger.info(`Job claimed`, { jobId: job.id, agentId });
      await this.saveState();
      return { status: "CLAIMED", job };
    });
  }
  async cancelJob(jobId, reason) {
    return await this.mutex.runExclusive(async () => {
      if (this.useSupabase && this.supabase) {
        const { data, error } = await this.supabase.from("jobs").update({ status: "cancelled", cancel_reason: reason, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", jobId).select("id,title");
        if (error || !data || data.length === 0) {
          return { error: "Job not found" };
        }
        this.state.liveNotepad += `
- [JOB CANCELLED] ${data[0].title} (ID: ${jobId}). Reason: ${reason}`;
        await this.saveState();
        return { status: "CANCELLED" };
      }
      const job = this.state.jobs[jobId];
      if (!job) return { error: "Job not found" };
      job.status = "cancelled";
      job.updatedAt = Date.now();
      this.state.liveNotepad += `
- [JOB CANCELLED] ${job.title} (ID: ${jobId}). Reason: ${reason}`;
      await this.saveState();
      return { status: "CANCELLED" };
    });
  }
  async forceUnlock(filePath, adminReason) {
    return await this.mutex.runExclusive(async () => {
      if (this.useSupabase && this.supabase && this.projectId) {
        const { error } = await this.supabase.from("locks").delete().eq("project_id", this.projectId).eq("file_path", filePath);
        if (error) return { error: "DB Error" };
        this.state.liveNotepad += `
- [ADMIN] Force unlocked '${filePath}'. Reason: ${adminReason}`;
        await this.saveState();
        return { status: "UNLOCKED" };
      }
      const lock = this.state.locks[filePath];
      if (!lock) return { message: "File was not locked." };
      delete this.state.locks[filePath];
      this.state.liveNotepad += `
- [ADMIN] Force unlocked '${filePath}'. Reason: ${adminReason}`;
      await this.saveState();
      return { status: "UNLOCKED", previousOwner: lock.agentId };
    });
  }
  async completeJob(agentId, jobId, outcome) {
    return await this.mutex.runExclusive(async () => {
      if (this.useSupabase && this.supabase) {
        const { data, error } = await this.supabase.from("jobs").select("id,title,assigned_to").eq("id", jobId).single();
        if (error || !data) return { error: "Job not found" };
        if (data.assigned_to !== agentId) return { error: "You don't own this job." };
        const { error: updateError } = await this.supabase.from("jobs").update({ status: "done", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", jobId).eq("assigned_to", agentId);
        if (updateError) return { error: "Failed to complete job" };
        this.state.liveNotepad += `
- [JOB DONE] ${data.title} by ${agentId}. Outcome: ${outcome}`;
        logger.info(`Job completed`, { jobId, agentId });
        await this.saveState();
        return { status: "COMPLETED" };
      }
      const job = this.state.jobs[jobId];
      if (!job) return { error: "Job not found" };
      if (job.assignedTo !== agentId) return { error: "You don't own this job." };
      job.status = "done";
      job.updatedAt = Date.now();
      this.state.liveNotepad += `
- [JOB DONE] ${job.title} by ${agentId}. Outcome: ${outcome}`;
      await this.saveState();
      return { status: "COMPLETED" };
    });
  }
  // --- Core State Management ---
  async getLiveContext() {
    const locks = await this.getLocks();
    const lockSummary = locks.map(
      (l) => `- [LOCKED] ${l.filePath} by ${l.agentId}
  Intent: ${l.intent}
  Prompt: "${l.userPrompt?.substring(0, 100)}..."`
    ).join("\n");
    const jobs = await this.listJobs();
    const jobSummary = jobs.map(
      (j) => `- [${j.status.toUpperCase()}] ${j.title} ${j.assignedTo ? "(" + j.assignedTo + ")" : "(Open)"}
  ID: ${j.id}`
    ).join("\n");
    return `# Active Session Context

## Job Board (Active Orchestration)
${jobSummary || "No active jobs."}

## Task Registry (Locks)
${lockSummary || "No active locks."}

## Live Notepad
${this.state.liveNotepad}`;
  }
  // --- Decision & Orchestration ---
  async proposeFileAccess(agentId, filePath, intent, userPrompt) {
    return await this.mutex.runExclusive(async () => {
      if (this.useSupabase && this.supabase && this.projectId) {
        const { data: existing } = await this.supabase.from("locks").select("*").eq("project_id", this.projectId).eq("file_path", filePath).single();
        if (existing) {
          const updatedAt = new Date(existing.updated_at).getTime();
          const isStale = Date.now() - updatedAt > this.lockTimeout;
          if (!isStale && existing.agent_id !== agentId) {
            return {
              status: "REQUIRES_ORCHESTRATION",
              message: `Conflict: File '${filePath}' is currently locked by agent '${existing.agent_id}'`,
              currentLock: existing
            };
          }
        }
        const { error } = await this.supabase.from("locks").upsert({
          project_id: this.projectId,
          file_path: filePath,
          agent_id: agentId,
          intent,
          user_prompt: userPrompt,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "project_id,file_path" });
        if (error) {
          logger.error("Lock upsert failed", error);
          return { status: "ERROR", message: "Database lock failed." };
        }
        this.state.liveNotepad += `

### [${agentId}] Locked '${filePath}'
**Intent:** ${intent}
**Prompt:** "${userPrompt}"`;
        await this.saveState();
        return { status: "GRANTED", message: `Access granted for ${filePath}` };
      }
      const now = Date.now();
      for (const [path3, lock] of Object.entries(this.state.locks)) {
        if (now - lock.timestamp > this.lockTimeout) {
          delete this.state.locks[path3];
        }
      }
      const currentLock = this.state.locks[filePath];
      if (currentLock && currentLock.agentId !== agentId) {
        return {
          status: "REQUIRES_ORCHESTRATION",
          message: `Conflict: File '${filePath}' is currently locked by agent '${currentLock.agentId}'`,
          currentLock
        };
      }
      this.state.locks[filePath] = {
        agentId,
        filePath,
        intent,
        userPrompt,
        timestamp: Date.now()
      };
      this.state.liveNotepad += `

### [${agentId}] Locked '${filePath}'
**Intent:** ${intent}
**Prompt:** "${userPrompt}"`;
      await this.saveState();
      return {
        status: "GRANTED",
        message: `Access granted for ${filePath}`,
        lock: this.state.locks[filePath]
      };
    });
  }
  async updateSharedContext(text, agentId) {
    return await this.mutex.runExclusive(async () => {
      this.state.liveNotepad += `
- [${agentId}] ${text}`;
      await this.saveState();
      return "Notepad updated.";
    });
  }
  async finalizeSession() {
    return await this.mutex.runExclusive(async () => {
      const content = this.state.liveNotepad;
      const filename = `session-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.md`;
      const historyPath = path2.join(process.cwd(), "history", filename);
      await fs2.writeFile(historyPath, content);
      this.state.liveNotepad = "Session Start: " + (/* @__PURE__ */ new Date()).toISOString() + "\n";
      this.state.locks = {};
      if (this.useSupabase && this.supabase && this.projectId) {
        await this.supabase.from("jobs").delete().eq("project_id", this.projectId).in("status", ["done", "cancelled"]);
        await this.supabase.from("locks").delete().eq("project_id", this.projectId);
      } else {
        this.state.jobs = Object.fromEntries(
          Object.entries(this.state.jobs).filter(([_, j]) => j.status !== "done" && j.status !== "cancelled")
        );
      }
      await this.saveState();
      return {
        status: "SESSION_FINALIZED",
        archivePath: historyPath
      };
    });
  }
  async getProjectSoul() {
    let soul = "## Project Soul\n";
    try {
      const context = await this.contextManager.readFile("context.md");
      soul += `
### Context
${context}`;
      const conventions = await this.contextManager.readFile("conventions.md");
      soul += `
### Conventions
${conventions}`;
    } catch (_e) {
      soul += "\n(Could not read local context files)";
    }
    return soul;
  }
  // --- Billing & Usage ---
  async getSubscriptionStatus(email) {
    if (!this.useSupabase || !this.supabase) {
      return { error: "Supabase not configured." };
    }
    const { data: profile, error } = await this.supabase.from("profiles").select("subscription_status, stripe_customer_id, current_period_end").eq("email", email).single();
    if (error || !profile) {
      return { status: "unknown", message: "Profile not found." };
    }
    const isActive = profile.subscription_status === "pro" || profile.current_period_end && new Date(profile.current_period_end) > /* @__PURE__ */ new Date();
    return {
      email,
      plan: isActive ? "Pro" : "Free",
      status: profile.subscription_status || "free",
      validUntil: profile.current_period_end
    };
  }
  async getUsageStats(email) {
    if (!this.useSupabase || !this.supabase) {
      return { error: "Supabase not configured." };
    }
    const { data: profile } = await this.supabase.from("profiles").select("usage_count").eq("email", email).single();
    return {
      email,
      usageCount: profile?.usage_count || 0,
      limit: 1e3
      // Hardcoded placeholder limit
    };
  }
};

// ../../src/local/mcp-server.ts
dotenv.config({ path: ".env.local" });
var manager = new ContextManager(
  process.env.SHARED_CONTEXT_API_URL,
  process.env.SHARED_CONTEXT_API_SECRET
);
var nerveCenter = new NerveCenter(manager);
var REQUIRED_DIRS = ["agent-instructions", "history"];
async function ensureFileSystem() {
  const fs3 = await import("fs/promises");
  const path3 = await import("path");
  for (const d of REQUIRED_DIRS) {
    const dirPath = path3.join(process.cwd(), d);
    try {
      await fs3.access(dirPath);
    } catch {
      logger.info("Creating required directory", { dir: d });
      await fs3.mkdir(dirPath, { recursive: true });
      if (d === "agent-instructions") {
        await fs3.writeFile(path3.join(dirPath, "context.md"), "# Project Context\n\n");
        await fs3.writeFile(path3.join(dirPath, "conventions.md"), "# Coding Conventions\n\n");
        await fs3.writeFile(path3.join(dirPath, "activity.md"), "# Activity Log\n\n");
      }
    }
  }
}
var server = new Server(
  {
    name: "shared-context-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      resources: {},
      tools: {}
    }
  }
);
var READ_CONTEXT_TOOL = "read_context";
var UPDATE_CONTEXT_TOOL = "update_context";
var SEARCH_CONTEXT_TOOL = "search_context";
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    return {
      resources: [
        {
          uri: "mcp://context/current",
          name: "Live Session Context",
          mimeType: "text/markdown",
          description: "The realtime state of the Nerve Center (Notepad + Locks)"
        },
        ...await manager.listFiles()
      ]
    };
  } catch (error) {
    logger.error("Error listing resources", error);
    return { resources: [] };
  }
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  try {
    if (uri === "mcp://context/current") {
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: await nerveCenter.getLiveContext()
        }]
      };
    }
    let fileName = uri;
    if (uri.startsWith("context://local/")) {
      fileName = uri.replace("context://local/", "");
    } else if (uri.startsWith("context://docs/")) {
      fileName = uri.replace("context://", "");
    }
    const content = await manager.readFile(fileName);
    return {
      contents: [{
        uri,
        mimeType: "text/markdown",
        text: content
      }]
    };
  } catch (_error) {
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
        }
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
          required: ["filename", "content"]
        }
      },
      {
        name: SEARCH_CONTEXT_TOOL,
        description: "Search shared context using RAG (Remote API)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" }
          },
          required: ["query"]
        }
      },
      // --- Billing & Usage ---
      {
        name: "get_subscription_status",
        description: "Check the subscription status of a user (Pro vs Free).",
        inputSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "User email to check." }
          },
          required: ["email"]
        }
      },
      {
        name: "get_usage_stats",
        description: "Get API usage statistics for a user.",
        inputSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "User email to check." }
          },
          required: ["email"]
        }
      },
      {
        name: "search_docs",
        description: "Search the Axis documentation.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query." }
          },
          required: ["query"]
        }
      },
      // --- Decision & Orchestration ---
      {
        name: "propose_file_access",
        description: "Request a lock on a file. Checks for conflicts with other agents.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            filePath: { type: "string" },
            intent: { type: "string" },
            userPrompt: { type: "string", description: "The full prompt provided by the user that initiated this action." }
          },
          required: ["agentId", "filePath", "intent", "userPrompt"]
        }
      },
      {
        name: "update_shared_context",
        description: "Write to the in-memory Live Notepad.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            text: { type: "string" }
          },
          required: ["agentId", "text"]
        }
      },
      // --- Permanent Memory ---
      {
        name: "finalize_session",
        description: "End the session, archive the notepad, and clear locks.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "get_project_soul",
        description: "Get high-level project goals and context.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      // --- Job Board (Task Orchestration) ---
      {
        name: "post_job",
        description: "Post a new job/ticket. Supports priority and dependencies.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            dependencies: { type: "array", items: { type: "string" } }
          },
          required: ["title", "description"]
        }
      },
      {
        name: "cancel_job",
        description: "Cancel a job that is no longer needed.",
        inputSchema: {
          type: "object",
          properties: {
            jobId: { type: "string" },
            reason: { type: "string" }
          },
          required: ["jobId", "reason"]
        }
      },
      {
        name: "force_unlock",
        description: "Admin tool to forcibly remove a lock from a file.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            reason: { type: "string" }
          },
          required: ["filePath", "reason"]
        }
      },
      {
        name: "claim_next_job",
        description: "Auto-assign the next available 'todo' job to yourself.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" }
          },
          required: ["agentId"]
        }
      },
      {
        name: "complete_job",
        description: "Mark your assigned job as done.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            jobId: { type: "string" },
            outcome: { type: "string" }
          },
          required: ["agentId", "jobId", "outcome"]
        }
      }
    ]
  };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info("Tool call", { name });
  if (name === READ_CONTEXT_TOOL) {
    const filename = String(args?.filename);
    try {
      const data = await manager.readFile(filename);
      return {
        content: [{ type: "text", text: data }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error reading file: ${err}` }],
        isError: true
      };
    }
  }
  if (name === UPDATE_CONTEXT_TOOL) {
    const filename = String(args?.filename);
    const content = String(args?.content);
    const append = Boolean(args?.append);
    try {
      await manager.updateFile(filename, content, append);
      return {
        content: [{ type: "text", text: `Updated ${filename}` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error updating file: ${err}` }],
        isError: true
      };
    }
  }
  if (name === SEARCH_CONTEXT_TOOL) {
    const query = String(args?.query);
    try {
      const formatted = await manager.searchContext(query);
      return { content: [{ type: "text", text: formatted }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Search Execution Error: ${err}` }],
        isError: true
      };
    }
  }
  if (name === "get_subscription_status") {
    const email = String(args?.email);
    const result = await nerveCenter.getSubscriptionStatus(email);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  if (name === "get_usage_stats") {
    const email = String(args?.email);
    const result = await nerveCenter.getUsageStats(email);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  if (name === "search_docs") {
    const query = String(args?.query);
    try {
      const formatted = await manager.searchContext(query);
      return { content: [{ type: "text", text: formatted }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Search Error: ${err}` }],
        isError: true
      };
    }
  }
  if (name === "propose_file_access") {
    const { agentId, filePath, intent, userPrompt } = args;
    const result = await nerveCenter.proposeFileAccess(agentId, filePath, intent, userPrompt);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  if (name === "update_shared_context") {
    const { agentId, text } = args;
    const result = await nerveCenter.updateSharedContext(text, agentId);
    return { content: [{ type: "text", text: result }] };
  }
  if (name === "finalize_session") {
    const result = await nerveCenter.finalizeSession();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  if (name === "get_project_soul") {
    const result = await nerveCenter.getProjectSoul();
    return { content: [{ type: "text", text: result }] };
  }
  if (name === "post_job") {
    const { title, description, priority, dependencies } = args;
    const result = await nerveCenter.postJob(title, description, priority, dependencies);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
  if (name === "cancel_job") {
    const { jobId, reason } = args;
    const result = await nerveCenter.cancelJob(jobId, reason);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
  if (name === "force_unlock") {
    const { filePath, reason } = args;
    const result = await nerveCenter.forceUnlock(filePath, reason);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
  if (name === "claim_next_job") {
    const { agentId } = args;
    const result = await nerveCenter.claimNextJob(agentId);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  if (name === "complete_job") {
    const { agentId, jobId, outcome } = args;
    const result = await nerveCenter.completeJob(agentId, jobId, outcome);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
  throw new Error(`Tool not found: ${name}`);
});
async function main() {
  await ensureFileSystem();
  await nerveCenter.init();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Shared Context MCP Server running on stdio");
}
main().catch((error) => {
  logger.error("Server error", error);
  process.exit(1);
});
