import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 60 * 1000;
const LIMIT = 30; // 30 req/min for key management

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key || url.includes("<") || url.includes("your-project")) {
        return null;
    }
    
    return createClient(url, key);
}

export async function GET(req: Request) {
    const ip = getClientIp(req.headers);
    const { allowed, remaining, reset } = rateLimit(`keys:${ip}`, LIMIT, WINDOW_MS);
    if (!allowed) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: rateHeaders(remaining, reset) }
        );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    
    const session = await getSessionFromRequest(req as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const userId = session.sub || session.id || await getUserId(supabase, session.email);
        
        const { data: keys, error } = await supabase
            .from("api_keys")
            .select("id, name, created_at, last_used_at")
            .eq("user_id", userId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ keys: keys || [] }, { headers: rateHeaders(remaining, reset) });
    } catch (err: any) {
        console.error("Keys GET error:", err);
        return NextResponse.json({ error: err?.message || "Failed to fetch keys" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const ip = getClientIp(req.headers);
    const { allowed, remaining, reset } = rateLimit(`keys:${ip}`, LIMIT, WINDOW_MS);
    if (!allowed) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: rateHeaders(remaining, reset) }
        );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    
    const session = await getSessionFromRequest(req as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const name = body.name || "Default Key";

        const userId = session.sub || session.id || await getUserId(supabase, session.email);
        if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // Generate Key
        const rawKey = `sk_sc_${crypto.randomBytes(24).toString("hex")}`;
        const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

        const { data, error } = await supabase
            .from("api_keys")
            .insert({
                user_id: userId,
                name,
                key_hash: keyHash,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Return the RAW key only now
        return NextResponse.json({
            key: { ...data, secret: rawKey }
        }, { headers: rateHeaders(remaining, reset) });
    } catch (err: any) {
        console.error("Keys POST error:", err);
        return NextResponse.json({ error: err?.message || "Failed to create key" }, { status: 500 });
    }
}

async function getUserId(supabase: any, email: string) {
    try {
        // Try to find user by email in auth.users via admin
        const { data: users } = await supabase.auth.admin.listUsers();
        if (users?.users) {
            const user = users.users.find((u: any) => u.email === email);
            if (user) return user.id;
        }
        
        // Fallback: check profiles table
        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .single();
        
        return profile?.id;
    } catch (err) {
        console.error("getUserId error:", err);
        return null;
    }
}

function rateHeaders(remaining: number, reset: number) {
  return {
    "x-rate-limit-remaining": String(remaining),
    "x-rate-limit-reset": String(reset),
  };
}
