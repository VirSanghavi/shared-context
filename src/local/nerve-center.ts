import { Mutex } from "async-mutex";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

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
    status: "todo" | "in_progress" | "done";
    assignedTo?: string; // agentId
    dependencies?: string[]; // IDs of other jobs
}

interface NerveCenterState {
    locks: Record<string, FileLock>;
    jobs: Record<string, Job>;
    liveNotepad: string;
}

export class NerveCenter {
    private mutex: Mutex;
    private state: NerveCenterState;
    private contextManager: any;

    constructor(contextManager: any) {
        this.mutex = new Mutex();
        this.contextManager = contextManager;
        this.state = {
            locks: {},
            jobs: {},
            liveNotepad: "Session Start: " + new Date().toISOString() + "\n"
        };
    }

    // --- Job Board Protocol (Active Orchestration) ---

    async postJob(title: string, description: string) {
        return await this.mutex.runExclusive(async () => {
            const id = `job-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            this.state.jobs[id] = {
                id,
                title,
                description,
                status: "todo"
            };
            this.state.liveNotepad += `\n- [JOB POSTED] ${title} (ID: ${id})`;
            return { jobId: id, status: "POSTED" };
        });
    }

    async claimNextJob(agentId: string) {
        return await this.mutex.runExclusive(async () => {
            // Find first unassigned todo job
            const job = Object.values(this.state.jobs).find(j => j.status === "todo");
            
            if (!job) {
                return { status: "NO_JOBS_AVAILABLE", message: "Relax. No open tickets." };
            }

            job.status = "in_progress";
            job.assignedTo = agentId;
            
            this.state.liveNotepad += `\n- [JOB CLAIMED] Agent '${agentId}' picked up: ${job.title}`;
            
            return { 
                status: "CLAIMED", 
                job 
            };
        });
    }

    async completeJob(agentId: string, jobId: string, outcome: string) {
        return await this.mutex.runExclusive(async () => {
            const job = this.state.jobs[jobId];
            if (!job) return { error: "Job not found" };
            
            if (job.assignedTo !== agentId) return { error: "You don't own this job." };

            job.status = "done";
            this.state.liveNotepad += `\n- [JOB DONE] ${job.title} by ${agentId}. Outcome: ${outcome}`;
            
            return { status: "COMPLETED" };
        });
    }

    // --- Core State Management ---

    async getLiveContext(): Promise<string> {
        // Return current locks + Notepad + Job Board
        const lockSummary = Object.values(this.state.locks).map(l => 
            `- [LOCKED] ${l.filePath} by ${l.agentId}\n  Intent: ${l.intent}`
        ).join("\n");
        
        const jobSummary = Object.values(this.state.jobs).map(j => 
            `- [${j.status.toUpperCase()}] ${j.title} ${j.assignedTo ? '('+j.assignedTo+')' : '(Open)'}\n  ID: ${j.id}`
        ).join("\n");

        return `# Active Session Context\n\n## Job Board (Active Orchestration)\n${jobSummary || "No active jobs."}\n\n## Task Registry (Locks)\n${lockSummary || "No active locks."}\n\n## Live Notepad\n${this.state.liveNotepad}`;
    }

    // --- Decision & Orchestration ---

    async proposeFileAccess(agentId: string, filePath: string, intent: string, userPrompt: string) {
        return await this.mutex.runExclusive(async () => {
            const currentLock = this.state.locks[filePath];

            // Check if locked by someone else
            if (currentLock && currentLock.agentId !== agentId) {
                // Check lock expiration (e.g., 30 mins) to prevent deadlocks
                const LOCK_TIMEOUT = 30 * 60 * 1000;
                if (Date.now() - currentLock.timestamp < LOCK_TIMEOUT) {
                    return {
                        status: "REQUIRES_ORCHESTRATION",
                        message: `Conflict: File '${filePath}' is currently locked by agent '${currentLock.agentId}' who is working on: "${currentLock.userPrompt}".`,
                        currentLock
                    };
                }
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

                if (items.length > 0) {
                    await this.contextManager.embedContent(items);
                    ragStatus = `Indexed ${items.length} chunks to Vector DB.`;
                }
            } catch (e) {
                ragStatus = `Indexing Error: ${e}`;
            }

            // 3. Clear State
            this.state.liveNotepad = "Session Start: " + new Date().toISOString() + "\n";
            this.state.locks = {};

            return {
                status: "SESSION_FINALIZED",
                archivePath: historyPath,
                ragStatus
            };
        });
    }

    async getProjectSoul() {
        // High-level summary from context.md or conventions.md
        // In a real usage, this would Query RAG for "Project Goals" + Read local context.md
        
        let soul = "## Project Soul\n";
        try {
            const context = await this.contextManager.readFile("context.md");
            soul += `\n### Context\n${context}`;
            const conventions = await this.contextManager.readFile("conventions.md");
            soul += `\n### Conventions\n${conventions}`;
        } catch (e) {
            soul += "\n(Could not read local context files)";
        }
        
        return soul;
    }
}
