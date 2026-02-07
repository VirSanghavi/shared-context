import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        console.error(`Webhook signature verification failed: ${errorMessage}`);
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const customerId = session.customer as string;
                const email = session.customer_details?.email || session.metadata?.email;

                if (email) {
                    console.log(`[Webhook] Processing checkout for email: ${email}, customer: ${customerId}`);
                    const { error } = await supabase
                        .from("profiles")
                        .update({
                            stripe_customer_id: customerId,
                            subscription_status: 'pro'
                        })
                        .ilike("email", email);

                    if (error) {
                        console.error(`[Webhook] Profile update failed: ${error.message}`);
                    } else {
                        console.log(`[Webhook] Profile updated successfully for ${email}`);
                    }
                } else {
                    console.warn(`[Webhook] No email found in session`);
                }
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;
                // Status is pro if active, trialing, past_due, or canceled but not yet expired
                const isPro = subscription.status === 'active' ||
                    subscription.status === 'trialing' ||
                    subscription.status === 'past_due' ||
                    (subscription.status === 'canceled' && subscription.current_period_end > Math.floor(Date.now() / 1000));

                const status = isPro ? 'pro' : 'free';

                await supabase
                    .from("profiles")
                    .update({
                        subscription_status: status,
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    })
                    .eq("stripe_customer_id", customerId);
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                await supabase
                    .from("profiles")
                    .update({
                        subscription_status: 'free',
                        current_period_end: null
                    })
                    .eq("stripe_customer_id", customerId);
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        console.error(`Webhook processing failed: ${errorMessage}`);
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }
}
