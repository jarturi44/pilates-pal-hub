import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Marks the currently-signed-in user as having already completed (and paid for)
 * their intake session. Used by the "existing client" signup flow so Jon can
 * onboard people he already knows without making them pay the $60 intake.
 *
 * Idempotent — won't overwrite timestamps that are already set.
 */
export const markIntakeSkipped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date().toISOString();
    const { supabase, userId } = context;

    // Only admins may bypass the intake payment for existing clients.
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");


    // Only set the columns that aren't already set
    const { data: existing, error: readErr } = await supabase
      .from("users")
      .select("intake_paid_at, intake_completed_at")
      .eq("id", userId)
      .maybeSingle();
    if (readErr) throw readErr;

    const patch: { intake_paid_at?: string; intake_completed_at?: string } = {};
    if (!existing?.intake_paid_at) patch.intake_paid_at = now;
    if (!existing?.intake_completed_at) patch.intake_completed_at = now;

    if (Object.keys(patch).length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: updErr } = await supabaseAdmin.from("users").update(patch).eq("id", userId);
      if (updErr) throw updErr;
    }

    return { ok: true };
  });

type StripeListResp<T> = { data: T[] };
type StripeCustomer = { id: string; email?: string | null };
type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number;
  start_date?: number;
  cancel_at_period_end?: boolean;
  items?: { data: Array<{ price: { id: string; product?: string } }> };
};

async function stripeGet<T>(key: string, path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Stripe ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/**
 * Looks up an existing Stripe customer/subscription by the signed-in user's
 * email and imports it into our subscriptions table so the portal recognizes
 * them as an active subscriber without re-charging.
 *
 * Used for migrating existing clients (e.g. 10 Minute Mornings) whose
 * Stripe subscription predates this site. Idempotent — safe to re-run.
 */
export const linkExistingStripeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("Stripe is not configured.");
    const { supabase, userId } = context;

    // Already linked? Bail out cleanly.
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingSub?.stripe_subscription_id) {
      return { linked: false, reason: "already_linked" as const };
    }

    // Need user's email — read from auth claims / users row
    const email = (context.claims as { email?: string } | undefined)?.email
      ?? (await supabase.from("users").select("email").eq("id", userId).maybeSingle()).data?.email;
    if (!email) return { linked: false, reason: "no_email" as const };

    // Find Stripe customer(s) by email
    const customers = await stripeGet<StripeListResp<StripeCustomer>>(
      stripeKey,
      `/customers?email=${encodeURIComponent(email.toLowerCase())}&limit=10`,
    );
    if (!customers.data.length) return { linked: false, reason: "no_stripe_customer" as const };

    // Search each customer for an active or trialing subscription
    let foundSub: StripeSubscription | null = null;
    for (const cust of customers.data) {
      const subs = await stripeGet<StripeListResp<StripeSubscription>>(
        stripeKey,
        `/subscriptions?customer=${cust.id}&status=all&limit=10`,
      );
      foundSub = subs.data.find((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      ) ?? null;
      if (foundSub) break;
    }
    if (!foundSub) return { linked: false, reason: "no_active_subscription" as const };

    const priceId = foundSub.items?.data?.[0]?.price?.id ?? null;

    // Match plan by price_id, otherwise default to 10 Minute Mornings
    let planId: string | null = null;
    if (priceId) {
      const { data: planByPrice } = await supabase
        .from("plans").select("id").eq("stripe_price_id", priceId).maybeSingle();
      planId = planByPrice?.id ?? null;
    }
    if (!planId) {
      const { data: morningsPlan } = await supabase
        .from("plans").select("id").eq("type", "mornings").maybeSingle();
      planId = morningsPlan?.id ?? null;
    }
    if (!planId) return { linked: false, reason: "no_matching_plan" as const };

    const { error: insertErr } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan_id: planId,
      stripe_subscription_id: foundSub.id,
      stripe_customer_id: foundSub.customer,
      status: foundSub.status === "past_due" ? "past_due" : "active",
      start_date: foundSub.start_date
        ? new Date(foundSub.start_date * 1000).toISOString()
        : new Date().toISOString(),
      current_period_end: foundSub.current_period_end
        ? new Date(foundSub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: foundSub.cancel_at_period_end ?? false,
    });
    if (insertErr) throw insertErr;

    // Mark waiver as the only remaining step — they've already "paid"
    await supabase.from("users").update({
      intake_paid_at: new Date().toISOString(),
      intake_completed_at: new Date().toISOString(),
    }).eq("id", userId);

    return { linked: true, plan_id: planId, subscription_id: foundSub.id };
  });
