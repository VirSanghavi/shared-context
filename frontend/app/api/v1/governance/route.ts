import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getSessionFromRequest(req as any);

    const body = await req.json();
    const { rule, target } = body;

    // specific logic for demo
    if (!rule || !target) {
        return NextResponse.json({ error: "Missing rule or target" }, { status: 400 });
    }

    // Mock governance update
    return NextResponse.json({
        status: "success",
        message: "Governance protocol updated",
        applied_rule: {
            id: "gov_" + Math.random().toString(36).substr(2, 9),
            rule,
            target,
            active: true,
            timestamp: new Date().toISOString()
        }
    });
}
