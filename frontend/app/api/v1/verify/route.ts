import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase configuration missing");
    return createClient(url, key);
}

/**
 * When DB says free but profile has stripe_customer_id, sync from Stripe.
 * Returns { isActive, current_period_end } or null if no Stripe data.
 */
async function syncFromStripe(
    customerId: string
): Promise<{ isActive: boolean; current_period_end: string | null } | null> {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return null;

    try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
        const { data: subs } = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 1,
        });
        if (subs.length === 0) return { isActive: false, current_period_end: null };

        const sub = subs[0];
        const now = Math.floor(Date.now() / 1000);
        const isActive =
            sub.status === "active" ||
            sub.status === "trialing" ||
            sub.status === "past_due" ||
            (sub.status === "canceled" && sub.current_period_end > now);

        return {
            isActive,
            current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
        };
    } catch (e) {
        console.error("[Verify] Stripe sync failed:", e);
        return null;
    }
}

/**
 * GET /api/v1/verify
 *
 * Lightweight endpoint for MCP servers to verify that the API key
 * belongs to an active subscriber. Called on server startup and
 * periodically during the session.
 *
 * When the DB shows "free" but the user has stripe_customer_id, we
 * sync from Stripe and update the profile so webhook gaps don't block
 * valid subscribers.
 *
 * Returns:
 *   { valid: true, plan: "Pro", validUntil: "2026-03-01T..." }
 *   { valid: false, reason: "subscription_expired" }
 *   { valid: false, reason: "unauthorized" }
 */
export async function GET(req: NextRequest) {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json(
            { valid: false, reason: "unauthorized" },
            { status: 401 }
        );
    }

    try {
        const userId = session.sub;
        if (!userId) {
            return NextResponse.json(
                { valid: false, reason: "no_user_id" },
                { status: 401 }
            );
        }

        const supabase = getSupabase();

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("subscription_status, current_period_end, stripe_customer_id, email")
            .eq("id", userId)
            .single();

        if (error || !profile) {
            return NextResponse.json(
                { valid: false, reason: "profile_not_found" },
                { status: 404 }
            );
        }

        let isActive =
            profile.subscription_status === "pro" ||
            (profile.current_period_end &&
                new Date(profile.current_period_end) > new Date());

        let currentPeriodEnd = profile.current_period_end;
        let customerId = profile.stripe_customer_id;

        // Recover stripe_customer_id if missing (webhook may have failed)
        if (!customerId && profile.email) {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (stripeKey) {
                try {
                    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
                    const { data: customers } = await stripe.customers.list({
                        email: profile.email,
                        limit: 1,
                    });
                    if (customers[0]) {
                        customerId = customers[0].id;
                        await supabase
                            .from("profiles")
                            .update({ stripe_customer_id: customerId })
                            .eq("id", userId);
                    }
                } catch (e) {
                    console.error("[Verify] Stripe customer lookup failed:", e);
                }
            }
        }

        // DB says free but we have Stripe customer — sync from Stripe
        if (!isActive && customerId) {
            const stripeResult = await syncFromStripe(customerId);
            if (stripeResult?.isActive) {
                isActive = true;
                currentPeriodEnd = stripeResult.current_period_end;
                // Persist so future verify calls don't need Stripe
                await supabase
                    .from("profiles")
                    .update({
                        subscription_status: "pro",
                        current_period_end: stripeResult.current_period_end,
                    })
                    .eq("id", userId);
            }
        }

        if (!isActive) {
            return NextResponse.json({
                valid: false,
                reason: "subscription_expired",
                plan: "Free",
                status: profile.subscription_status || "free",
            });
        }

        return NextResponse.json({
            valid: true,
            plan: "Pro",
            status: "pro",
            validUntil: currentPeriodEnd,
        });
    } catch (e: unknown) {
        console.error("[Verify] Server error:", e);
        return NextResponse.json(
            { valid: false, reason: "server_error" },
            { status: 500 }
        );
    }
}
