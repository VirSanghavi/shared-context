import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const session = await getSessionFromRequest(request);
    const { email, subject, message } = await request.json().catch(() => ({}));

    if (!email || !subject || !message) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await supabase.from("support_requests").insert({
        email,
        subject,
        message,
        user_id: session?.sub
    });

    if (error) {
        console.error("Support request error:", error);
        return NextResponse.json({ error: "Failed to submit support request" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
