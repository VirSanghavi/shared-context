import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";
import { isValidEmail, isValidPassword } from "@/lib/validation";
import { logAndSanitize } from "@/lib/safe-error";
import { getSafeOrigin } from "@/lib/allowed-origins";

const WINDOW_MS = 60 * 1000;
const LIMIT = 5; // Stricter for signup

/** Map Supabase auth errors to user-friendly messages. */
function mapSignupError(error: { message?: string; code?: string }): string {
    const msg = (error.message || "").toLowerCase();
    const code = (error.code || "").toLowerCase();

    if (code === "signup_disabled" || msg.includes("signup disabled") || msg.includes("email logins are disabled")) {
        return "Signup is currently disabled. Please contact support.";
    }
    if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
        return "An account with this email already exists. Try signing in instead.";
    }
    if (msg.includes("invalid format") || msg.includes("invalid email")) {
        return "Invalid email format.";
    }
    if (msg.includes("password") && (msg.includes("weak") || msg.includes("invalid") || msg.includes("required"))) {
        return "Password must be between 8 and 128 characters.";
    }
    if (msg.includes("rate limit") || msg.includes("too many")) {
        return "Too many attempts. Please try again in a few minutes.";
    }
    if (msg.includes("email not confirmed") || msg.includes("confirm your email")) {
        return "Please confirm your email address. Check your inbox for a verification link.";
    }
    if (msg.includes("database") || msg.includes("schema") || msg.includes("500")) {
        return "A server error occurred. Please try again later or contact support.";
    }

    return "Signup failed. Please try again.";
}

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

        let body: { email?: unknown; password?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid request body" },
                { status: 400, headers: rateHeaders(remaining, reset) }
            );
        }

        const { email, password } = body;

        // Input validation
        if (!isValidEmail(email)) {
            return NextResponse.json(
                { error: "Invalid email format" },
                { status: 400, headers: rateHeaders(remaining, reset) }
            );
        }

        if (!isValidPassword(password)) {
            return NextResponse.json(
                { error: "Password must be between 8 and 128 characters" },
                { status: 400, headers: rateHeaders(remaining, reset) }
            );
        }

        // Validate redirect origin against allowlist
        const origin = request.headers.get('origin');
        const appUrl = getSafeOrigin(origin);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${appUrl}/auth/callback`,
            },
        });

        if (error) {
            console.error("[auth/signup] Supabase error:", error);
            const userMessage = mapSignupError(error);
            return NextResponse.json({ error: userMessage }, { status: 400 });
        }

        // Supabase returns a user with empty identities if the email already exists
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
        }

        if (data.user) {
            await supabase.from('profiles').insert({
                id: data.user.id,
                email: email,
            });
        }

        return NextResponse.json({ ok: true }, { headers: rateHeaders(remaining, reset) });
    } catch (err: unknown) {
        const msg = logAndSanitize("Signup", err, "An unexpected error occurred");
        return NextResponse.json(
            { error: msg },
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
