import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

const WINDOW_MS = 60 * 1000;
const LIMIT = 10;

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
  const ip = getClientIp(request.headers);
  const { allowed, remaining, reset } = await rateLimit(`login:${ip}`, LIMIT, WINDOW_MS);
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

  // Hybrid Auth: 
  // 1. Check Env Password (Admin/Simple Mode)
  // 2. Or check Supabase Auth (Real User Mode)

  let userId: string | undefined;

  const expected = process.env.APP_LOGIN_PASSWORD;
  if (expected && password === expected) {
    // Admin login - Lookup user by email in profiles to get ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();
    userId = profile?.id;
  } else {
    // Try Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error || !data.user) {
      // Check for specific email confirmation error
      if (error?.message === "Email not confirmed") {
        return NextResponse.json(
          { error: "Email not confirmed" },
          { status: 403, headers: rateHeaders(remaining, reset) }
        );
      }

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401, headers: rateHeaders(remaining, reset) }
      );
    }
    userId = data.user.id;
  }

  // Create user in profiles if not exists (lazy sync)
  if (userId) {
    await supabase.from('profiles').insert({
      id: userId,
      email: email
    });
    // Ignore error if already exists as per RLS or unique constraint
  }

  const token = await createSession(email, userId, 60 * 60 * 24 * 30);
  await setSessionCookie(token);
  return NextResponse.json(
    { ok: true },
    { headers: rateHeaders(remaining, reset) }
  );
}

function rateHeaders(remaining: number, reset: number) {
  return {
    "x-rate-limit-remaining": String(remaining),
    "x-rate-limit-reset": String(reset),
  };
}
