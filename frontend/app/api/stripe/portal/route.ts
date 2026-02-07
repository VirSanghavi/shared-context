import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req as any);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get stripe_customer_id from DB
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('email', session.email)
        .single();
    
    if (!profile?.stripe_customer_id) {
         return NextResponse.json({ error: "No subscription found" }, { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.headers.get("origin")}/`,
    });

    return NextResponse.redirect(portalSession.url);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
