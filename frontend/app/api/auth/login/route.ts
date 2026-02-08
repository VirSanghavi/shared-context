import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

const WINDOW_MS = 60 * 1000;
const LIMIT = 10;

export async function POST(request: Request) {
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
    if (!userId) {
      return NextResponse.json(
        { error: "No account found for this email" },
        { status: 401, headers: rateHeaders(remaining, reset) }
      );
    }
  } else {
    // Try Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error || !data.user) {
      // Modern Supabase returns "Invalid login credentials" for BOTH wrong
      // passwords AND unconfirmed emails (security feature). Check the user's
      // actual confirmation status via profiles table + admin API.
      if (email) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .single();
          if (profile?.id) {
            const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
            if (authUser && !authUser.email_confirmed_at) {
              return NextResponse.json(
                { error: "Email not confirmed" },
                { status: 403, headers: rateHeaders(remaining, reset) }
              );
            }
          }
        } catch {
          // Admin lookup failed — fall through to generic error
        }
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
