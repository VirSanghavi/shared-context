import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const session = await getSessionFromRequest(request);
    const { category, email, message } = await request.json().catch(() => ({}));

    if (!message) {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const { error } = await supabase.from("feedback").insert({
        category: category || "other",
        email: email || session?.email,
        message,
        user_id: session?.sub
    });

    if (error) {
        console.error("Feedback submission error:", error);
        return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
