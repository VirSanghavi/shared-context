import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(req: Request) {
    const session = await getSessionFromRequest(req as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: keys, error } = await supabase
        .from("api_keys")
        .select("id, name, created_at, last_used_at")
        .eq("user_id", session.sub || session.id || await getUserId(session.email)); // Need handling for user_id lookup if session only has email

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ keys });
}

export async function POST(req: Request) {
    const session = await getSessionFromRequest(req as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = body.name || "Default Key";

    const userId = await getUserId(session.email);
    if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Generate Key
    const rawKey = `sk_sc_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const { data, error } = await supabase
        .from("api_keys")
        .insert({
            user_id: userId,
            name,
            key_hash: keyHash
        })
        .select()
        .single();
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return the RAW key only now
    return NextResponse.json({ 
        key: { ...data, secret: rawKey } 
    });
}

async function getUserId(email: string) {
    // Ideally session has ID, but if only email, look it up via admin
    const { data } = await supabase.rpc('get_user_id_by_email', { email_input: email }); // Need RPC or lookup provided mainly by ensuring auth session has ID.
    // Fallback: lookup in profiles if we linked them, or just use auth.users if possible (supabase-js admin needed)
    
    // Better: Fix auth.ts to include 'sub' (subject/id) in jwt
    
    // For now, let's try to find user by email in profiles if that table is synced, or query auth.users via admin
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    return user?.id;
}
