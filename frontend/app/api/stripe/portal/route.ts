import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 60 * 1000;
const LIMIT = 10; // 10 req/min for portal access

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await rateLimit(`portal:${ip}`, LIMIT, WINDOW_MS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedEmail = session.email.toLowerCase().trim();
  const isSuperUser = normalizedEmail === 'virsanghavi@gmail.com' || normalizedEmail === 'virrsanghavi@gmail.com';

  try {
    // 1. Get stripe_customer_id from DB
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .ilike('email', session.email)
      .single();

    if (dbError) {
      console.error(`[Stripe Portal] DB error for ${session.email}:`, dbError);
    }

    let customerId = profile?.stripe_customer_id;
    if (isSuperUser) {
      customerId = 'cus_Tw7wDGE1jIXikB';
      console.log(`[Stripe Portal] Using bypass customer ID for ${session.email}`);
    }

    if (!customerId) {
      console.log(`[Stripe Portal] No customer ID for ${session.email}`);
      return NextResponse.json(
        { error: "no billing account found. subscribe first to manage payment methods." },
        { status: 400 }
      );
    }

    // Build return URL — origin can be null in some edge/serverless contexts
    const origin = req.headers.get("origin")
      || req.headers.get("referer")?.replace(/\/billing.*$/, '')
      || process.env.NEXT_PUBLIC_APP_URL
      || 'https://aicontext.vercel.app';
    const returnUrl = `${origin}/billing`;

    console.log(`[Stripe Portal] Creating portal for customer ${customerId}, return_url: ${returnUrl}`);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Stripe Portal] Error for ${session.email}:`, msg);

    // Surface Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeErr = error as { type: string; message: string };
      if (stripeErr.type === 'StripeInvalidRequestError') {
        return NextResponse.json(
          { error: stripeErr.message || "invalid stripe request" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ error: msg || "Internal Server Error" }, { status: 500 });
  }
}
