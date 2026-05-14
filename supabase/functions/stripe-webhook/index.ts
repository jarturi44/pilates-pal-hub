// Stripe webhook handler — keeps subscriptions table in sync.
// verify_jwt is disabled in supabase/config.toml for this function.
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function getPlanIdByPrice(priceId: string): Promise<string | null> {
  const { data } = await supabase
    .from("plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("Signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const subscriptionId = session.subscription as string | null;
        if (!userId || !planId || !subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const start = new Date(sub.start_date * 1000);
        const commitmentEnd = new Date(start);
        commitmentEnd.setMonth(commitmentEnd.getMonth() + 3);
        const periodEnd = new Date(sub.current_period_end * 1000);

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          plan_id: planId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer as string,
          status: "active",
          start_date: start.toISOString(),
          commitment_end_date: commitmentEnd.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        }, { onConflict: "stripe_subscription_id" });
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string | null;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        await supabase.from("subscriptions")
          .update({
            status: "active",
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subId);
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string | null;
        if (!subId) break;
        await supabase.from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from("subscriptions")
          .update({
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from("subscriptions")
          .update({ status: "canceled", cancel_at_period_end: false })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
