import { Mutex } from "async-mutex";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import { logger } from "../utils/logger.js";

// Interfaces
interface FileLock {
    agentId: string;
    filePath: string;
    intent: string;
    userPrompt: string;
    timestamp: number;
}

interface Job {
    id: string;
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical";
    status: "todo" | "in_progress" | "done" | "cancelled";
    assignedTo?: string; // agentId
    dependencies?: string[]; // IDs of other jobs
    createdAt: number;
    updatedAt: number;
}

interface JobRecord {
    id: string;
    title: string;
    description: string;
    priority: Job["priority"];
    status: Job["status"];
    assigned_to: string | null;
    dependencies: string[] | null;
    created_at: string;
    updated_at: string;
}

interface NerveCenterState {
    locks: Record<string, FileLock>; // Fallback local locks
    jobs: Record<string, Job>; // Fallback local jobs
    liveNotepad: string;
}

const STATE_FILE = process.env.NERVE_CENTER_STATE_FILE || path.join(process.cwd(), "history", "nerve-center-state.json");
const LOCK_TIMEOUT_DEFAULT = 30 * 60 * 1000; // 30 minutes

interface NerveCenterOptions {
    stateFilePath?: string;
    lockTimeout?: number;
    supabaseUrl?: string;
    supabaseServiceRoleKey?: string;
    projectName?: string;
}

/**
 * The Central Brain of the Shared Context System.
 * Manages concurrency (File Locks), Orchestration (Job Board), and Short-term Memory (Live Notepad).
 */
export class NerveCenter {
    private mutex: Mutex;
    private state: NerveCenterState;
    private contextManager: any;
    private stateFilePath: string;
    private lockTimeout: number;
    private supabase?: SupabaseClient;
    private projectId?: string;
    private projectName: string;
    private useSupabase: boolean;

    /**
     * @param contextManager - Instance of ContextManager for legacy operations
     * @param options - Configuration options for state persistence and timeouts
     */
    constructor(contextManager: any, options: NerveCenterOptions = {}) {
        this.mutex = new Mutex();
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
            liveNotepad: "Session Start: " + new Date().toISOString() + "\n"
        };
    }

    async init() {
        await this.loadState();
        if (this.useSupabase) {
            await this.ensureProjectId();
        }
    }

    private async ensureProjectId() {
        if (!this.supabase) return;

        const { data: project, error } = await this.supabase
            .from("projects")
            .select("id")
            .eq("name", this.projectName)
            .maybeSingle();

        if (error) {
            logger.error("Failed to load project", error);
            return;
        }

        if (project?.id) {
            this.projectId = project.id;
            return;
        }

        const { data: created, error: createError } = await this.supabase
            .from("projects")
            .insert({ name: this.projectName })
            .select("id")
            .single();

        if (createError) {
            logger.error("Failed to create project", createError);
            return;
        }

        this.projectId = created.id;
    }

    private jobFromRecord(record: JobRecord): Job {
        return {
            id: record.id,
            title: record.title,
            description: record.description,
            priority: record.priority,
            status: record.status,
            assignedTo: record.assigned_to || undefined,
            dependencies: record.dependencies || undefined,
            createdAt: Date.parse(record.created_at),
            updatedAt: Date.parse(record.updated_at)
        };
    }

    // --- Data Access Layers (Hybrid: Supabase > Local) ---

    private async listJobs(): Promise<Job[]> {
        if (!this.useSupabase || !this.supabase || !this.projectId) {
            return Object.values(this.state.jobs);
        }

        const { data, error } = await this.supabase
            .from("jobs")
            .select("id,title,description,priority,status,assigned_to,dependencies,created_at,updated_at")
            .eq("project_id", this.projectId);

        if (error || !data) {
            logger.error("Failed to load jobs", error);
            return [];
        }

        return data.map((record) => this.jobFromRecord(record as JobRecord));
    }

    private async getLocks(): Promise<FileLock[]> {
        if (!this.useSupabase || !this.supabase || !this.projectId) {
            // Local Fallback
            return Object.values(this.state.locks);
        }

        try {
            // Lazy clean
            await this.supabase.rpc('clean_stale_locks', {
                p_project_id: this.projectId,
                p_timeout_seconds: Math.floor(this.lockTimeout / 1000)
            });

            const { data, error } = await this.supabase
                .from('locks')
                .select('*')
                .eq('project_id', this.projectId);

            if (error) throw error;

            return (data || []).map((row: any) => ({
                agentId: row.agent_id,
                filePath: row.file_path,
                intent: row.intent,
                userPrompt: row.user_prompt,
                timestamp: Date.parse(row.updated_at)
            }));
        } catch (e) {
            logger.warn("Failed to fetch locks from DB, falling back to local memory", e as any);
            return Object.values(this.state.locks);
        }
    }

    private async saveState() {
        try {
            await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
            await fs.writeFile(this.stateFilePath, JSON.stringify(this.state, null, 2));
        } catch (error) {
            logger.error("Failed to persist state", error);
        }
    }

    private async loadState() {
        try {
            const data = await fs.readFile(this.stateFilePath, "utf-8");
            this.state = JSON.parse(data);
            logger.info("State loaded from disk");
        } catch (_error) {
            // Ignore ENOENT
        }
    }

    // --- Job Board Protocol (Active Orchestration) ---

    async postJob(title: string, description: string, priority: Job["priority"] = "medium", dependencies: string[] = []) {
        return await this.mutex.runExclusive(async () => {
            let id = `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            if (this.useSupabase && this.supabase && this.projectId) {
                const now = new Date().toISOString();
                const { data, error } = await this.supabase
                    .from("jobs")
                    .insert({
                        project_id: this.projectId,
                        title,
                        description,
                        priority,
                        status: "todo",
                        assigned_to: null,
                        dependencies,
                        created_at: now,
                        updated_at: now
                    })
                    .select("id")
                    .single();

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
            this.state.liveNotepad += `\n- [JOB POSTED] [${priority.toUpperCase()}] ${title} (ID: ${id})${depText}`;
            logger.info(`Job posted: ${title}`, { jobId: id, priority });
            await this.saveState();
            return { jobId: id, status: "POSTED" };
        });
    }

    async claimNextJob(agentId: string) {
        return await this.mutex.runExclusive(async () => {
            const priorities = ["critical", "high", "medium", "low"];
            const allJobs = await this.listJobs();
            const jobsById = new Map(allJobs.map((job) => [job.id, job]));
            const availableJobs = allJobs
                .filter((job) => job.status === "todo")
                .filter((job) => {
                    if (!job.dependencies || job.dependencies.length === 0) return true;
                    return job.dependencies.every((depId) => jobsById.get(depId)?.status === "done");
                })
                .sort((a, b) => {
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
                    const now = new Date().toISOString();
                    const { data, error } = await this.supabase
                        .from("jobs")
                        .update({
                            status: "in_progress",
                            assigned_to: agentId,
                            updated_at: now
                        })
                        .eq("id", candidate.id)
                        .eq("status", "todo")
                        .select("id,title,description,priority,status,assigned_to,dependencies,created_at,updated_at");

                    if (error) {
                        logger.error("Failed to claim job", error);
                        continue;
                    }

                    if (data && data.length > 0) {
                        const job = this.jobFromRecord(data[0] as JobRecord);
                        this.state.liveNotepad += `\n- [JOB CLAIMED] Agent '${agentId}' picked up: ${job.title}`;
                        logger.info(`Job claimed`, { jobId: job.id, agentId });
                        await this.saveState();
                        return { status: "CLAIMED", job };
                    }
                }
                return { status: "NO_JOBS_AVAILABLE", message: "All available jobs were just claimed." };
            }

            const job = availableJobs[0];
            job.status = "in_progress";
            job.assignedTo = agentId;
            job.updatedAt = Date.now();

            this.state.liveNotepad += `\n- [JOB CLAIMED] Agent '${agentId}' picked up: ${job.title}`;
            logger.info(`Job claimed`, { jobId: job.id, agentId });
            await this.saveState();

            return { status: "CLAIMED", job };
        });
    }

    async cancelJob(jobId: string, reason: string) {
        return await this.mutex.runExclusive(async () => {
            if (this.useSupabase && this.supabase) {
                const { data, error } = await this.supabase
                    .from("jobs")
                    .update({ status: "cancelled", cancel_reason: reason, updated_at: new Date().toISOString() })
                    .eq("id", jobId)
                    .select("id,title");

                if (error || !data || data.length === 0) {
                    return { error: "Job not found" };
                }

                this.state.liveNotepad += `\n- [JOB CANCELLED] ${data[0].title} (ID: ${jobId}). Reason: ${reason}`;
                await this.saveState();
                return { status: "CANCELLED" };
            }

            const job = this.state.jobs[jobId];
            if (!job) return { error: "Job not found" };

            job.status = "cancelled";
            job.updatedAt = Date.now();
            this.state.liveNotepad += `\n- [JOB CANCELLED] ${job.title} (ID: ${jobId}). Reason: ${reason}`;
            await this.saveState();
            return { status: "CANCELLED" };
        });
    }

    async forceUnlock(filePath: string, adminReason: string) {
        return await this.mutex.runExclusive(async () => {
            if (this.useSupabase && this.supabase && this.projectId) {
                const { error } = await this.supabase
                    .from('locks')
                    .delete()
                    .eq('project_id', this.projectId)
                    .eq('file_path', filePath);

                if (error) return { error: "DB Error" };

                this.state.liveNotepad += `\n- [ADMIN] Force unlocked '${filePath}'. Reason: ${adminReason}`;
                await this.saveState();
                return { status: "UNLOCKED" };
            }

            const lock = this.state.locks[filePath];
            if (!lock) return { message: "File was not locked." };

            delete this.state.locks[filePath];
            this.state.liveNotepad += `\n- [ADMIN] Force unlocked '${filePath}'. Reason: ${adminReason}`;
            await this.saveState();
            return { status: "UNLOCKED", previousOwner: lock.agentId };
        });
    }

    async completeJob(agentId: string, jobId: string, outcome: string) {
        return await this.mutex.runExclusive(async () => {
            if (this.useSupabase && this.supabase) {
                const { data, error } = await this.supabase
                    .from("jobs")
                    .select("id,title,assigned_to")
                    .eq("id", jobId)
                    .single();

                if (error || !data) return { error: "Job not found" };
                if (data.assigned_to !== agentId) return { error: "You don't own this job." };

                const { error: updateError } = await this.supabase
                    .from("jobs")
                    .update({ status: "done", updated_at: new Date().toISOString() })
                    .eq("id", jobId)
                    .eq("assigned_to", agentId);

                if (updateError) return { error: "Failed to complete job" };

                this.state.liveNotepad += `\n- [JOB DONE] ${data.title} by ${agentId}. Outcome: ${outcome}`;
                logger.info(`Job completed`, { jobId, agentId });
                await this.saveState();
                return { status: "COMPLETED" };
            }

            const job = this.state.jobs[jobId];
            if (!job) return { error: "Job not found" };

            if (job.assignedTo !== agentId) return { error: "You don't own this job." };

            job.status = "done";
            job.updatedAt = Date.now();
            this.state.liveNotepad += `\n- [JOB DONE] ${job.title} by ${agentId}. Outcome: ${outcome}`;
            await this.saveState();

            return { status: "COMPLETED" };
        });
    }

    // --- Core State Management ---

    async getLiveContext(): Promise<string> {
        const locks = await this.getLocks();

        const lockSummary = locks.map(l =>
            `- [LOCKED] ${l.filePath} by ${l.agentId}\n  Intent: ${l.intent}\n  Prompt: "${l.userPrompt?.substring(0, 100)}..."`
        ).join("\n");

        const jobs = await this.listJobs();
        const jobSummary = jobs.map(j =>
            `- [${j.status.toUpperCase()}] ${j.title} ${j.assignedTo ? '(' + j.assignedTo + ')' : '(Open)'}\n  ID: ${j.id}`
        ).join("\n");

        return `# Active Session Context\n\n## Job Board (Active Orchestration)\n${jobSummary || "No active jobs."}\n\n## Task Registry (Locks)\n${lockSummary || "No active locks."}\n\n## Live Notepad\n${this.state.liveNotepad}`;
    }

    // --- Decision & Orchestration ---

    async proposeFileAccess(agentId: string, filePath: string, intent: string, userPrompt: string) {
        return await this.mutex.runExclusive(async () => {
            // Supabase Logic
            if (this.useSupabase && this.supabase && this.projectId) {
                // 1. Check existing lock
                const { data: existing } = await this.supabase
                    .from('locks')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .eq('file_path', filePath)
                    .single();

                // 2. If locked, check if it's stale (lazy) or different agent
                if (existing) {
                    const updatedAt = new Date(existing.updated_at).getTime();
                    const isStale = (Date.now() - updatedAt) > this.lockTimeout;

                    if (!isStale && existing.agent_id !== agentId) {
                        return {
                            status: "REQUIRES_ORCHESTRATION",
                            message: `Conflict: File '${filePath}' is currently locked by agent '${existing.agent_id}'`,
                            currentLock: existing
                        };
                    }
                }

                // 3. Upsert Lock
                const { error } = await this.supabase
                    .from('locks')
                    .upsert({
                        project_id: this.projectId,
                        file_path: filePath,
                        agent_id: agentId,
                        intent,
                        user_prompt: userPrompt,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'project_id,file_path' });

                if (error) {
                    logger.error("Lock upsert failed", error);
                    return { status: "ERROR", message: "Database lock failed." };
                }

                this.state.liveNotepad += `\n\n### [${agentId}] Locked '${filePath}'\n**Intent:** ${intent}\n**Prompt:** "${userPrompt}"`;
                await this.saveState();
                return { status: "GRANTED", message: `Access granted for ${filePath}` };
            }

            // Fallback: Local Logic
            const now = Date.now();
            // Clean stale local
            for (const [path, lock] of Object.entries(this.state.locks)) {
                if (now - lock.timestamp > this.lockTimeout) {
                    delete this.state.locks[path];
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

            this.state.liveNotepad += `\n\n### [${agentId}] Locked '${filePath}'\n**Intent:** ${intent}\n**Prompt:** "${userPrompt}"`;
            await this.saveState();

            return {
                status: "GRANTED",
                message: `Access granted for ${filePath}`,
                lock: this.state.locks[filePath]
            };
        });
    }

    async updateSharedContext(text: string, agentId: string) {
        return await this.mutex.runExclusive(async () => {
            this.state.liveNotepad += `\n- [${agentId}] ${text}`;
            await this.saveState();
            return "Notepad updated.";
        });
    }

    async finalizeSession() {
        return await this.mutex.runExclusive(async () => {
            const content = this.state.liveNotepad;
            const filename = `session-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
            const historyPath = path.join(process.cwd(), "history", filename);

            await fs.writeFile(historyPath, content);

            // Clear State
            this.state.liveNotepad = "Session Start: " + new Date().toISOString() + "\n";
            this.state.locks = {};
            if (this.useSupabase && this.supabase && this.projectId) {
                // Clear done jobs
                await this.supabase
                    .from("jobs")
                    .delete()
                    .eq("project_id", this.projectId)
                    .in("status", ["done", "cancelled"]);

                // Clear all locks for this project? Maybe.
                await this.supabase
                    .from("locks")
                    .delete()
                    .eq("project_id", this.projectId);
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
            soul += `\n### Context\n${context}`;
            const conventions = await this.contextManager.readFile("conventions.md");
            soul += `\n### Conventions\n${conventions}`;
        } catch (_e) {
            soul += "\n(Could not read local context files)";
        }
        return soul;
    }

    // --- Billing & Usage ---

    async getSubscriptionStatus(email: string) {
        if (!this.useSupabase || !this.supabase) {
            return { error: "Supabase not configured." };
        }

        const { data: profile, error } = await this.supabase
            .from("profiles")
            .select("subscription_status, stripe_customer_id, current_period_end")
            .eq("email", email)
            .single();

        if (error || !profile) {
            return { status: "unknown", message: "Profile not found." };
        }

        const isActive = profile.subscription_status === 'pro' || 
            (profile.current_period_end && new Date(profile.current_period_end) > new Date());

        return {
            email,
            plan: isActive ? "Pro" : "Free",
            status: profile.subscription_status || "free",
            validUntil: profile.current_period_end
        };
    }

    async getUsageStats(email: string) {
         if (!this.useSupabase || !this.supabase) {
            return { error: "Supabase not configured." };
        }
        
        const { data: profile } = await this.supabase
            .from("profiles")
            .select("usage_count")
            .eq("email", email)
            .single();

        return {
            email,
            usageCount: profile?.usage_count || 0,
            limit: 1000 // Hardcoded placeholder limit
        };
    }
}
