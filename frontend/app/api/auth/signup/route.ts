import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

const WINDOW_MS = 60 * 1000;
const LIMIT = 5; // Stricter for signup

export async function POST(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes("YOUR_") || supabaseServiceKey.includes("YOUR_")) {
            return NextResponse.json(
                { error: "Supabase is not configured. Please update .env.local with valid credentials." },
                { status: 503 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const ip = getClientIp(request.headers);
        const { allowed, remaining, reset } = await rateLimit(`signup:${ip}`, LIMIT, WINDOW_MS);
        if (!allowed) {
            return NextResponse.json(
                { error: "Too many requests" },
                { status: 429, headers: rateHeaders(remaining, reset) }
            );
        }

        const { email, password } = await request.json().catch(() => ({
            email: "",
            password: "",
        }));

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password required" }, { status: 400 });
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        if (data.user) {
            // Create profile
            await supabase.from('profiles').insert({
                id: data.user.id,
                email: email,
            });
        }

        return NextResponse.json({ ok: true }, { headers: rateHeaders(remaining, reset) });
    } catch (err: unknown) {
        console.error("Signup error:", err);
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

function rateHeaders(remaining: number, reset: number) {
    return {
        "x-rate-limit-remaining": String(remaining),
        "x-rate-limit-reset": String(reset),
    };
}
