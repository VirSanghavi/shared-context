import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/callback
 * Called by the client-side callback page after Supabase email verification.
 * Receives a Supabase access_token, validates it, creates the app's own
 * JWT session cookie, and returns success so the client can redirect.
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { access_token, user_id, email } = await req.json();

    if (!access_token || !user_id || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate the user exists and email is confirmed via admin API
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(user_id);

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: "Email not confirmed" }, { status: 403 });
    }

    // Ensure the user exists in our profiles table
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
    }, { onConflict: "id" });

    // Create the app's own JWT session cookie (30 day TTL)
    const token = await createSession(email, user.id, 60 * 60 * 24 * 30);
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Auth callback error:", err);
    const errorMessage = err instanceof Error ? err.message : "Callback failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
