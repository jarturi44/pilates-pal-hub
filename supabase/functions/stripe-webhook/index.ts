// Stripe webhook handler — keeps subscriptions table in sync.
// verify_jwt is disabled in supabase/config.toml for this function.
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
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

async function getUserEmail(userId: string): Promise<{ email: string | null; name: string | null }> {
  const { data } = await supabase.from("users").select("email, name").eq("id", userId).maybeSingle();
  return { email: data?.email ?? null, name: data?.name ?? null };
}

async function notifyAndEmail(args: {
  userId: string; type: string; title: string; message: string;
  templateName: string; templateData?: Record<string, any>; idempotencyKey: string;
}) {
  await supabase.from("notifications").insert({
    user_id: args.userId, type: args.type, title: args.title, message: args.message,
  });
  const { email, name } = await getUserEmail(args.userId);
  if (!email) return;
  // Enqueue email through the same pgmq pipeline used by the app.
  // We render a minimal subject/body pointer via the transactional send route would need an auth token,
  // so we directly enqueue here using the registered template name as the label.
  // The dispatcher will need a pre-rendered HTML — instead we just record a notification and skip email here
  // unless a template render path is available. To keep parity, we'll trigger the public send via service role.
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/`; // not used
    // Best effort: insert into email_send_log + enqueue using the same RPC the app uses.
    // We can't easily render React Email in Deno here, so we send a plain-text fallback.
    const messageId = crypto.randomUUID();
    await supabase.from("email_send_log").insert({
      message_id: messageId, template_name: args.templateName,
      recipient_email: email, status: "pending",
    });
    const text = args.message + (args.templateData?.portalUrl ? `\n\nUpdate your payment method: ${args.templateData.portalUrl}` : "");
    const html = `<p>${args.message.replace(/\n/g, "<br>")}</p>${args.templateData?.portalUrl ? `<p><a href="${args.templateData.portalUrl}">Update payment method</a></p>` : ""}`;
    await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: email,
        from: "Pilates with Jon <noreply@notify.pilateswithjon.com>",
        sender_domain: "notify.pilateswithjon.com",
        subject: args.title,
        html, text,
        purpose: "transactional",
        label: args.templateName,
        idempotency_key: args.idempotencyKey,
        queued_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("email enqueue failed", e);
  }
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
          past_due_since: null,
          access_suspended: false,
        }, { onConflict: "stripe_subscription_id" });
        await notifyAndEmail({
          userId,
          type: "subscription_confirmed",
          title: "Subscription confirmed",
          message: "Welcome to Pilates with Jon. Your subscription is active.",
          templateName: "subscription-confirmed",
          idempotencyKey: `subconfirm-${subscriptionId}`,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string | null;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const { data: prev } = await supabase
          .from("subscriptions").select("user_id, status, access_suspended")
          .eq("stripe_subscription_id", subId).maybeSingle();
        await supabase.from("subscriptions")
          .update({
            status: "active",
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            past_due_since: null,
            access_suspended: false,
          })
          .eq("stripe_subscription_id", subId);
        if (prev?.user_id && (prev.status === "past_due" || prev.access_suspended)) {
          await notifyAndEmail({
            userId: prev.user_id,
            type: "payment_recovered",
            title: "Payment received — you're all set",
            message: "Thanks! Your payment went through and your access is restored.",
            templateName: "payment-recovered",
            idempotencyKey: `recovered-${subId}-${inv.id}`,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string | null;
        if (!subId) break;
        const { data: prev } = await supabase
          .from("subscriptions").select("user_id, past_due_since")
          .eq("stripe_subscription_id", subId).maybeSingle();
        const updates: Record<string, any> = { status: "past_due" };
        if (!prev?.past_due_since) updates.past_due_since = new Date().toISOString();
        await supabase.from("subscriptions").update(updates).eq("stripe_subscription_id", subId);
        if (prev?.user_id) {
          await notifyAndEmail({
            userId: prev.user_id,
            type: "payment_failed",
            title: "Payment failed — please update your card",
            message: "We couldn't process your most recent payment. You have 7 days to update your payment method before access is paused.",
            templateName: "payment-failed",
            idempotencyKey: `failed-${subId}-${inv.id}`,
          });
        }
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
        const { data: prev } = await supabase
          .from("subscriptions").select("user_id")
          .eq("stripe_subscription_id", sub.id).maybeSingle();
        await supabase.from("subscriptions")
          .update({ status: "canceled", cancel_at_period_end: false })
          .eq("stripe_subscription_id", sub.id);
        if (prev?.user_id) {
          await notifyAndEmail({
            userId: prev.user_id,
            type: "subscription_canceled",
            title: "Your subscription is canceled",
            message: "Your subscription has been canceled. You're welcome back anytime.",
            templateName: "subscription-canceled",
            idempotencyKey: `canceled-${sub.id}`,
          });
        }
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
