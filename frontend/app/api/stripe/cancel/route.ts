import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 60 * 1000;
const LIMIT = 5; // 5 req/min for cancellation

export async function POST(req: Request) {
    const ip = getClientIp(req.headers);
    const { allowed, remaining, reset } = await rateLimit(`cancel:${ip}`, LIMIT, WINDOW_MS);
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await getSessionFromRequest(req as any);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2023-10-16",
    });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('email', session.email)
            .single();

        if (!profile?.stripe_customer_id) {
            return NextResponse.json({ error: "No customer ID found" }, { status: 404 });
        }

        const subscriptions = await stripe.subscriptions.list({
            customer: profile.stripe_customer_id,
            status: 'active',
            limit: 1,
        });

        if (subscriptions.data.length === 0) {
            return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
        }

        const sub = subscriptions.data[0];

        // Cancel at period end
        await stripe.subscriptions.update(sub.id, {
            cancel_at_period_end: true,
        });

        return NextResponse.json({ success: true, message: "Subscription will be cancelled at the end of the period" });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
