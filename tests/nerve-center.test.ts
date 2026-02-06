import { describe, expect, test, beforeEach } from "bun:test";
import { NerveCenter } from "../src/local/nerve-center.js";

// Mock ContextManager
class MockManager {
    logs = [];
    async embedContent(items: any) { this.logs.push(items); }
    async readFile(f: string) { return "content"; }
}

describe("NerveCenter", () => {
    let nerveCenter: NerveCenter;
    let manager: MockManager;

    beforeEach(async () => {
        // Reset state on disk
        const cleanState = { locks: {}, jobs: {}, liveNotepad: "Fresh Start" };
        await Bun.write("tests/temp-state.json", JSON.stringify(cleanState));

        manager = new MockManager();
        nerveCenter = new NerveCenter(manager, { stateFilePath: "tests/temp-state.json" });
        await nerveCenter.init();
    });

    test("should post a job", async () => {
        const res = await nerveCenter.postJob("Test Job", "Desc");
        expect(res.status).toBe("POSTED");
        expect(res.jobId).toBeDefined();
    });

    test("should claim a job", async () => {
        await nerveCenter.postJob("Test Job", "Desc");
        const res = await nerveCenter.claimNextJob("Agent007");
        expect(res.status).toBe("CLAIMED");
        expect(res.job.assignedTo).toBe("Agent007");
    });

    test("should lock file", async () => {
        const res = await nerveCenter.proposeFileAccess("AgentA", "file.ts", "edit", "prompt");
        expect(res.status).toBe("GRANTED");
    });

    test("should detect conflict", async () => {
        await nerveCenter.proposeFileAccess("AgentA", "file.ts", "edit", "prompt");
        const res = await nerveCenter.proposeFileAccess("AgentB", "file.ts", "edit", "prompt");
        expect(res.status).toBe("REQUIRES_ORCHESTRATION");
    });
});
