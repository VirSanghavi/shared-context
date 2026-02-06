import { Mutex } from "async-mutex";
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

interface NerveCenterState {
    locks: Record<string, FileLock>;
    jobs: Record<string, Job>;
    liveNotepad: string;
}

const STATE_FILE = process.env.NERVE_CENTER_STATE_FILE || path.join(process.cwd(), "history", "nerve-center-state.json");
const LOCK_TIMEOUT_DEFAULT = 30 * 60 * 1000; // 30 minutes

interface NerveCenterOptions {
    stateFilePath?: string;
    lockTimeout?: number;
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

    /**
     * @param contextManager - Instance of ContextManager for legacy operations
     * @param options - Configuration options for state persistence and timeouts
     */
    constructor(contextManager: any, options: NerveCenterOptions = {}) {
        this.mutex = new Mutex();
        this.contextManager = contextManager;
        this.stateFilePath = options.stateFilePath || STATE_FILE;
        this.lockTimeout = options.lockTimeout || LOCK_TIMEOUT_DEFAULT;
        this.state = {
            locks: {},
            jobs: {},
            liveNotepad: "Session Start: " + new Date().toISOString() + "\n"
        };
    }

    async init() {
         await this.loadState();
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

    /**
     * Posts a new job to the Job Board.
     * @param title - Short concise title of the task
     * @param description - Detailed instructions
     * @param priority - Urgency level (default: medium)
     * @param dependencies - Array of Job IDs that must be completed first
     */
    async postJob(title: string, description: string, priority: Job["priority"] = "medium", dependencies: string[] = []) {
        return await this.mutex.runExclusive(async () => {
             // Refresh state from disk just in case? No, memory is source of truth in single process.
            const id = `job-${Date.now()}-${Math.floor(Math.random()*1000)}`;
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
            const depText = dependencies.length ? ` (Depends on: ${dependencies.join(", ")})` : "";
            this.state.liveNotepad += `\n- [JOB POSTED] [${priority.toUpperCase()}] ${title} (ID: ${id})${depText}`;
            logger.info(`Job posted: ${title}`, { jobId: id, priority });
            await this.saveState();
            return { jobId: id, status: "POSTED" };
        });
    }

    async claimNextJob(agentId: string) {
        return await this.mutex.runExclusive(async () => {
            // Find first unassigned todo job
            // Priority: Critical > High > Medium > Low
            // Then check dependencies
            const priorities = ["critical", "high", "medium", "low"];
            
            const availableJobs = Object.values(this.state.jobs)
                .filter(j => j.status === "todo")
                .filter(j => {
                    // Check dependencies
                    if (!j.dependencies || j.dependencies.length === 0) return true;
                    return j.dependencies.every(depId => {
                        const depJob = this.state.jobs[depId];
                        return depJob && depJob.status === "done";
                    });
                })
                .sort((a, b) => {
                    const pA = priorities.indexOf(a.priority);
                    const pB = priorities.indexOf(b.priority);
                    if (pA !== pB) return pA - pB;
                    return a.createdAt - b.createdAt;
                });
            
            const job = availableJobs[0];
            
            if (!job) {
                return { status: "NO_JOBS_AVAILABLE", message: "Relax. No open tickets (or dependencies not met)." };
            }

            job.status = "in_progress";
            job.assignedTo = agentId;
            job.updatedAt = Date.now();
            
            this.state.liveNotepad += `\n- [JOB CLAIMED] Agent '${agentId}' picked up: ${job.title}`;
            logger.info(`Job claimed`, { jobId: job.id, agentId });
            await this.saveState();
            
            return { 
                status: "CLAIMED", 
                job 
            };
        });
    }

    async cancelJob(jobId: string, reason: string) {
        return await this.mutex.runExclusive(async () => {
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
            const lock = this.state.locks[filePath];
            if (!lock) return { message: "File was not locked." };

            delete this.state.locks[filePath];
            this.state.liveNotepad += `\n- [ADMIN] Force unlocked '${filePath}'. Reason: ${adminReason}`;
            logger.warn(`Force unlock`, { filePath, reason: adminReason });
            await this.saveState();
            return { status: "UNLOCKED", previousOwner: lock.agentId };
        });
    }

    async completeJob(agentId: string, jobId: string, outcome: string) {
        return await this.mutex.runExclusive(async () => {
            const job = this.state.jobs[jobId];
            if (!job) return { error: "Job not found" };
            
            if (job.assignedTo !== agentId) return { error: "You don't own this job." };

            job.status = "done";
            job.updatedAt = Date.now();
            this.state.liveNotepad += `\n- [JOB DONE] ${job.title} by ${agentId}. Outcome: ${outcome}`;
            
            // Auto-release locks held by this agent?
            // Optional but good practice. For now manual release via finalize or explicit unlock is safer.
            
            logger.info(`Job completed`, { jobId: job.id, agentId });
            await this.saveState();
            
            return { status: "COMPLETED" };
        });
    }

    // --- Core State Management ---

    private cleanStaleLocks() {
        const now = Date.now();
        let changed = false;
        for (const [path, lock] of Object.entries(this.state.locks)) {
            if (now - lock.timestamp > this.lockTimeout) {
                delete this.state.locks[path];
                this.state.liveNotepad += `\n- [SYSTEM] Lock expired for '${path}' (held by ${lock.agentId})`;
                logger.warn(`Lock expired`, { filePath: path, agentId: lock.agentId });
                changed = true;
            }
        }
        return changed;
    }

    async getLiveContext(): Promise<string> {
        // Cleaning stale locks on read is lazy expiration
        const changed = this.cleanStaleLocks();
        if (changed) await this.saveState();

        const lockSummary = Object.values(this.state.locks).map(l => 
            `- [LOCKED] ${l.filePath} by ${l.agentId}\n  Intent: ${l.intent}\n  Prompt: "${l.userPrompt.substring(0, 100)}..."`
        ).join("\n");
        
        const jobSummary = Object.values(this.state.jobs).map(j => 
            `- [${j.status.toUpperCase()}] ${j.title} ${j.assignedTo ? '('+j.assignedTo+')' : '(Open)'}\n  ID: ${j.id}`
        ).join("\n");

        return `# Active Session Context\n\n## Job Board (Active Orchestration)\n${jobSummary || "No active jobs."}\n\n## Task Registry (Locks)\n${lockSummary || "No active locks."}\n\n## Live Notepad\n${this.state.liveNotepad}`;
    }

    // --- Decision & Orchestration ---

    /**
     * Attempts to acquire a lock on a specific file.
     * @param agentId - The identity of the requesting agent
     * @param filePath - The project-relative path to the file
     * @param intent - "read" or "edit" (informative only)
     * @param userPrompt - The semantic intent/prompt causing this lock request
     * @returns GRANTED or REQUIRES_ORCHESTRATION status
     */
    async proposeFileAccess(agentId: string, filePath: string, intent: string, userPrompt: string) {
        return await this.mutex.runExclusive(async () => {
            this.cleanStaleLocks();
            const currentLock = this.state.locks[filePath];

            // Check if locked by someone else
            if (currentLock && currentLock.agentId !== agentId) {
                 return {
                    status: "REQUIRES_ORCHESTRATION",
                    message: `Conflict: File '${filePath}' is currently locked by agent '${currentLock.agentId}' who is working on: "${currentLock.userPrompt}".`,
                    currentLock
                };
            }

            // Grant Lock
            this.state.locks[filePath] = {
                agentId,
                filePath,
                intent,
                userPrompt,
                timestamp: Date.now()
            };

            // Log intention AND Prompt to Notepad automatically
            this.state.liveNotepad += `\n\n### [${agentId}] Locked '${filePath}'\n**Intent:** ${intent}\n**Prompt:** "${userPrompt}"`;
            logger.info(`Lock granted`, { agentId, filePath });
            
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

    // --- Permanent Memory ---

    async finalizeSession() {
        return await this.mutex.runExclusive(async () => {
            const content = this.state.liveNotepad;
            const filename = `session-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
            const historyPath = path.join(process.cwd(), "history", filename);
            
            // 1. Archive to disk
            await fs.writeFile(historyPath, content);
            
            // 2. Index for RAG
            let ragStatus = "RAG Indexing Skipped";
            try {
                // Chunking Strategy: Split by Agent Actions (###)
                const chunks = content.split('###').filter(c => c.trim().length > 0).map(c => '###' + c);
                
                const items = chunks.map((chunk, index) => ({
                    content: chunk.trim(),
                    metadata: {
                        filename: filename,
                        source: "nerve-center-history",
                        chunkIndex: index,
                        timestamp: new Date().toISOString()
                    }
                }));

                if (items.length > 0 && this.contextManager.embedContent) {
                    await this.contextManager.embedContent(items);
                    ragStatus = `Indexed ${items.length} chunks to Vector DB.`;
                }
            } catch (e) {
                ragStatus = `Indexing Error: ${e}`;
                logger.error("RAG indexing failed", e);
            }

            // 3. Clear State
            this.state.liveNotepad = "Session Start: " + new Date().toISOString() + "\n";
            this.state.locks = {};
            // Move finished jobs to history (delete from active)
            // But keep todo/in_progress? Or clear all? "Session" implies a sprint usually.
            // Let's clear done/cancelled. Keep todo.
            this.state.jobs = Object.fromEntries(
                Object.entries(this.state.jobs).filter(([_, j]) => j.status !== 'done' && j.status !== 'cancelled')
            );
            
            // Backup mechanism (Item 9)
            const backupPath = this.stateFilePath + ".backup";
            try {
                await fs.copyFile(this.stateFilePath, backupPath);
            } catch (e) {
                logger.warn("Backup failed during finalize", e);
            }

            await this.saveState();

            return {
                status: "SESSION_FINALIZED",
                archivePath: historyPath,
                ragStatus
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
}
