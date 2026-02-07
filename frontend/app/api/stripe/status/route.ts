import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const dynamic = 'force-dynamic'; // Ensure we don't cache this

export async function GET(req: NextRequest) {
    try {
        const session = await getSessionFromRequest(req);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error("Missing Supabase credentials");
            return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', session.email)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        let stripeData = null;
        if (profile.stripe_customer_id) {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (stripeKey) {
                const stripe = new Stripe(stripeKey, {
                    apiVersion: "2023-10-16",
                });

                const subscriptions = await stripe.subscriptions.list({
                    customer: profile.stripe_customer_id as string,
                    status: 'all',
                    limit: 1,
                    expand: ['data.discounts'] // Ensure we get objects, not IDs
                });

                if (subscriptions.data.length > 0) {
                    const sub = subscriptions.data[0];
                    stripeData = {
                        status: sub.status,
                        current_period_end: sub.current_period_end,
                        cancel_at_period_end: sub.cancel_at_period_end,
                        plan_name: 'pro',
                        has_retention_offer: sub.discounts && Array.isArray(sub.discounts) 
                            ? sub.discounts.some((d: any) => typeof d === 'object' && d.coupon?.id === 'RETENTION_50') 
                            : false
                    };
                }
            }
        }

        return NextResponse.json({
            subscription_status: profile.subscription_status || 'free',
            current_period_end: profile.current_period_end,
            stripe: stripeData
        });

    } catch (error: any) {
        console.error("Stripe Status API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
