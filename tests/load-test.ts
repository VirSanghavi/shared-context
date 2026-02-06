
import { NerveCenter } from "../src/local/nerve-center.js";
import { ContextManager } from "../src/local/context-manager.js";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";

// Mock env
process.env.SHARED_CONTEXT_API_URL = "http://localhost:3000";
process.env.SHARED_CONTEXT_API_SECRET = "test";

const STATE_FILE = join(process.cwd(), "tests", "load-test-state.json");

// Mock Context Manager
class MockContextManager extends ContextManager {
    constructor() { super("url", "key"); }
    async search() { return []; }
    async storeMemory() { return true; }
}

async function runLoadTest() {
    console.log("🚀 Starting Load Test...");
    
    // Clean up
    if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);

    const nerveCenter = new NerveCenter(new MockContextManager(), { stateFilePath: STATE_FILE });
    await nerveCenter.init();

    const NUM_AGENTS = 50;
    const OPS_PER_AGENT = 20;
    let errors = 0;
    let successfulLocks = 0;
    let conflicts = 0;

    const agents = Array.from({ length: NUM_AGENTS }, (_, i) => `Agent_${i}`);
    const fileTarget = "critical-file.ts";

    console.log(`Simulating ${NUM_AGENTS} agents performing ${OPS_PER_AGENT} operations each concurrently...`);
    const startTime = Date.now();

    await Promise.all(agents.map(async (agentId) => {
        for (let i = 0; i < OPS_PER_AGENT; i++) {
            // Random delay to simulate real world chaos
            await new Promise(r => setTimeout(r, Math.random() * 10));

            try {
                // Try to acquire lock
                const result = await nerveCenter.proposeFileAccess(
                    agentId, 
                    fileTarget, 
                    "edit", 
                    "I want to edit this file"
                );

                if (result.status === "GRANTED") {
                    successfulLocks++;
                    // Hold it briefly
                    await new Promise(r => setTimeout(r, Math.random() * 5));
                    // We don't have an explicit 'unlock' API exposed publicly in the minimal interface yet 
                    // (it's usually auto-expired or done via finalize, but for this test we mainly check for RACE CONDITIONS in the Lock acquisition)
                } else if (result.status === "REQUIRES_ORCHESTRATION" && result.message.includes("locked by")) {
                    conflicts++;
                }
            } catch (e) {
                console.error(e);
                errors++;
            }
        }
    }));

    const duration = Date.now() - startTime;
    console.log("\n📊 Load Test Results:");
    console.log("-----------------------");
    console.log(`Total Operations: ${NUM_AGENTS * OPS_PER_AGENT}`);
    console.log(`Duration:         ${duration}ms`);
    console.log(`Successful Locks: ${successfulLocks}`);
    console.log(`Conflicts:        ${conflicts}`);
    console.log(`Errors:           ${errors}`);
    
    // Integrity Check
    // If mutex works, we should never throw unexpected internal errors
    // The sum of Granted + Conflicts might vary, but we shouldn't crash.
    
    if (errors > 0) {
        console.error("❌ Load Test FAILED with errors.");
        process.exit(1);
    } else {
        console.log("✅ Load Test PASSED: System handled concurrency stability.");
        process.exit(0);
    }
}

runLoadTest();
