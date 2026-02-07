import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
    const session = await getSessionFromRequest(req as any);

    // For demo purposes, we allow unauthenticated access if it's a "preview" key, 
    // but in reality we'd check the exact key.
    // const authHeader = req.headers.get("Authorization");

    // Mock response matching the docs
    const mockMirror = {
        root: "src/lib",
        timestamp: new Date().toISOString(),
        nodes: [
            { name: "auth.ts", type: "file", size: 1024, hash: "a1b2c3d4" },
            { name: "db.ts", type: "file", size: 2048, hash: "e5f6g7h8" },
            { name: "utils", type: "directory", children: ["logger.ts", "format.ts"] }
        ],
        metadata: {
            governance: "strict",
            sync_status: "live"
        }
    };

    return NextResponse.json(mockMirror);
}
