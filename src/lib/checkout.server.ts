import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PlanForCheckout = {
  id: string;
  display_name: string | null;
  price_per_month: number | string;
  stripe_price_id: string | null;
};

type StripeCheckoutSession = {
  id: string;
  url?: string;
  customer?: string | { id?: string } | null;
  customer_email?: string | null;
  metadata?: Record<string, string> | null;
  subscription?: string | StripeSubscription | null;
};

type StripeSubscription = {
  id: string;
  status?: string;
  customer?: string | { id?: string } | null;
  start_date?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
};

function asId(value: string | { id?: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function stripeFetch<T>(stripeSecretKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Stripe request failed");
  return json as T;
}

export async function createCheckoutSessionOnServer(args: {
  stripeSecretKey: string;
  userId: string;
  userEmail?: string;
  planId: string;
  returnUrl: string;
}) {
  const { data: plan, error } = await supabaseAdmin
    .from("plans")
    .select("id, display_name, price_per_month, stripe_price_id")
    .eq("id", args.planId)
    .maybeSingle();
  if (error) throw error;
  if (!plan) throw new Error("Invalid plan");

  const checkoutPlan = plan as PlanForCheckout;
  const origin = args.returnUrl || "";
  const successUrl = `${origin}/onboarding?step=sub_success&plan_id=${encodeURIComponent(args.planId)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/onboarding`;
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: "true",
    "metadata[user_id]": args.userId,
    "metadata[plan_id]": args.planId,
    "subscription_data[metadata][user_id]": args.userId,
    "subscription_data[metadata][plan_id]": args.planId,
    "line_items[0][quantity]": "1",
  });

  if (args.userEmail) body.set("customer_email", args.userEmail);
  if (!args.stripeSecretKey.startsWith("sk_test_") && checkoutPlan.stripe_price_id) {
    body.set("line_items[0][price]", checkoutPlan.stripe_price_id);
  } else {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(checkoutPlan.price_per_month) * 100)));
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", checkoutPlan.display_name ?? "Pilates with Jon membership");
  }

  const session = await stripeFetch<StripeCheckoutSession>(args.stripeSecretKey, "/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!session.url) throw new Error("No checkout URL returned");
  return { url: session.url };
}

export async function syncCheckoutSessionOnServer(args: {
  stripeSecretKey: string;
  userId: string;
  sessionId: string;
}) {
  const session = await stripeFetch<StripeCheckoutSession>(
    args.stripeSecretKey,
    `/checkout/sessions/${encodeURIComponent(args.sessionId)}?expand[]=subscription`,
  );
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const subscription = session.subscription;
  const sub = typeof subscription === "string" ? null : subscription;
  const subscriptionId = typeof subscription === "string" ? subscription : subscription?.id;

  if (userId !== args.userId) {
    // Stale session_id from a different account in the URL — don't error out,
    // let the Stripe webhook reconcile and let the user keep moving.
    console.warn("[syncCheckoutSession] session.user_id mismatch", { sessionUserId: userId, callerUserId: args.userId });
    return { subscription: null };
  }
  if (!planId || !subscriptionId) return { subscription: null };

  const fullSub = sub ?? await stripeFetch<StripeSubscription>(args.stripeSecretKey, `/subscriptions/${subscriptionId}`);
  const start = new Date((fullSub.start_date ?? Math.floor(Date.now() / 1000)) * 1000);
  const commitmentEnd = new Date(start);
  commitmentEnd.setMonth(commitmentEnd.getMonth() + 3);
  const periodEndSeconds = fullSub.current_period_end ?? Math.floor(Date.now() / 1000);

  const { data, error } = await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId,
    plan_id: planId,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: asId(fullSub.customer) ?? asId(session.customer),
    status: fullSub.status ?? "active",
    start_date: start.toISOString(),
    commitment_end_date: commitmentEnd.toISOString(),
    current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
    cancel_at_period_end: !!fullSub.cancel_at_period_end,
    past_due_since: null,
    access_suspended: false,
  }, { onConflict: "stripe_subscription_id" }).select("*, plan:plans(*)").maybeSingle();
  if (error) throw error;
  return { subscription: data };
}

export async function createBillingPortalSessionOnServer(args: {
  stripeSecretKey: string;
  userId: string;
  returnUrl: string;
}) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", args.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!sub?.stripe_customer_id) throw new Error("No Stripe customer on file yet.");

  const body = new URLSearchParams({
    customer: sub.stripe_customer_id,
    return_url: args.returnUrl,
  });
  const session = await stripeFetch<{ url?: string }>(args.stripeSecretKey, "/billing_portal/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!session.url) throw new Error("No portal URL returned");
  return { url: session.url };
}

type StripeListResponse<T> = { data: T[] };
type StripeCustomer = { id: string; email?: string | null };
type StripeSubscriptionWithMetadata = StripeSubscription & {
  metadata?: Record<string, string> | null;
};

/**
 * Recovery path: when a user has no subscription row (webhook + success-redirect
 * both missed), look up their Stripe customer by email and import any
 * active/trialing subscription whose metadata.user_id matches.
 */
export async function recoverSubscriptionByEmailOnServer(args: {
  stripeSecretKey: string;
  userId: string;
}) {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", args.userId)
    .maybeSingle();
  if (!user?.email) return { subscription: null };

  const customers = await stripeFetch<StripeListResponse<StripeCustomer>>(
    args.stripeSecretKey,
    `/customers?email=${encodeURIComponent(user.email)}&limit=10`,
  );

  for (const customer of customers.data) {
    const subs = await stripeFetch<StripeListResponse<StripeSubscriptionWithMetadata>>(
      args.stripeSecretKey,
      `/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=10`,
    );
    const match = subs.data.find(
      (s) =>
        s.metadata?.user_id === args.userId &&
        ["active", "trialing", "past_due"].includes(s.status ?? ""),
    );
    if (!match) continue;
    const planId = match.metadata?.plan_id;
    if (!planId) continue;

    const start = new Date((match.start_date ?? Math.floor(Date.now() / 1000)) * 1000);
    const commitmentEnd = new Date(start);
    commitmentEnd.setMonth(commitmentEnd.getMonth() + 3);
    const periodEndSeconds = match.current_period_end ?? Math.floor(Date.now() / 1000);

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: args.userId,
          plan_id: planId,
          stripe_subscription_id: match.id,
          stripe_customer_id: customer.id,
          status: match.status ?? "active",
          start_date: start.toISOString(),
          commitment_end_date: commitmentEnd.toISOString(),
          current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
          cancel_at_period_end: !!match.cancel_at_period_end,
          past_due_since: null,
          access_suspended: false,
        },
        { onConflict: "stripe_subscription_id" },
      )
      .select("*, plan:plans(*)")
      .maybeSingle();
    if (error) throw error;
    return { subscription: data };
  }

  return { subscription: null };
}

/** One-time $60 intake-session checkout. */
export async function createIntakeCheckoutOnServer(args: {
  stripeSecretKey: string;
  userId: string;
  userEmail?: string;
  returnUrl: string;
}) {
  const origin = args.returnUrl || "";
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/onboarding?intake=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/onboarding`,
    customer_creation: "always",
    allow_promotion_codes: "true",
    "payment_intent_data[setup_future_usage]": "off_session",
    "metadata[user_id]": args.userId,
    "metadata[purpose]": "intake_session",
    "line_items[0][quantity]": "1",
  });
  if (!args.stripeSecretKey.startsWith("sk_test_")) {
    body.set("line_items[0][price]", "price_1ToQe2GcIsRXsqWIqEk5nK51");
  } else {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", "6000");
    body.set("line_items[0][price_data][product_data][name]", "Pilates with Jon — Initial Intake Session");
    body.set(
      "line_items[0][price_data][product_data][description]",
      "45-minute virtual intake. We'll discuss your goals, frequency, and availability.",
    );
  }
  if (args.userEmail) body.set("customer_email", args.userEmail);

  const session = await stripeFetch<StripeCheckoutSession>(args.stripeSecretKey, "/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!session.url) throw new Error("No checkout URL returned");
  return { url: session.url };
}

/** Verifies the intake checkout session belongs to this user and was paid. */
export async function syncIntakeCheckoutOnServer(args: {
  stripeSecretKey: string;
  userId: string;
  sessionId: string;
}) {
  const session = await stripeFetch<StripeCheckoutSession & { payment_status?: string }>(
    args.stripeSecretKey,
    `/checkout/sessions/${encodeURIComponent(args.sessionId)}`,
  );
  if (session.metadata?.user_id !== args.userId) {
    return { paid: false };
  }
  if (session.metadata?.purpose !== "intake_session") {
    return { paid: false };
  }
  // "no_payment_required" covers 100%-off promo codes (e.g. COMP), which
  // Stripe marks as a $0 session rather than "paid".
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { paid: false };
  }
  const customerId = asId(session.customer);
  const { error } = await supabaseAdmin
    .from("users")
    .update({
      intake_paid_at: new Date().toISOString(),
      intake_stripe_session_id: session.id,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq("id", args.userId);
  if (error) throw error;
  return { paid: true };
}

/**
 * Charge the user's saved card (from intake checkout) for the chosen plan,
 * creating a subscription server-side. Returns { requiresCheckout: true } if
 * no saved payment method is available so the caller can fall back to Stripe Checkout.
 */
export async function subscribeWithSavedCardOnServer(args: {
  stripeSecretKey: string;
  userId: string;
  planId: string;
}) {
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("plans")
    .select("id, display_name, price_per_month, stripe_price_id")
    .eq("id", args.planId)
    .maybeSingle();
  if (planErr) throw planErr;
  if (!plan) throw new Error("Invalid plan");
  const checkoutPlan = plan as PlanForCheckout;

  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select("stripe_customer_id, email")
    .eq("id", args.userId)
    .maybeSingle();
  if (userErr) throw userErr;
  let customerId = user?.stripe_customer_id ?? null;

  // Fallback: look up by email if missing
  if (!customerId && user?.email) {
    const customers = await stripeFetch<StripeListResponse<StripeCustomer>>(
      args.stripeSecretKey,
      `/customers?email=${encodeURIComponent(user.email)}&limit=1`,
    );
    customerId = customers.data[0]?.id ?? null;
    if (customerId) {
      await supabaseAdmin.from("users").update({ stripe_customer_id: customerId }).eq("id", args.userId);
    }
  }

  if (!customerId) return { requiresCheckout: true as const };

  // Get the most recent saved card
  const pms = await stripeFetch<StripeListResponse<{ id: string }>>(
    args.stripeSecretKey,
    `/customers/${encodeURIComponent(customerId)}/payment_methods?type=card&limit=1`,
  );
  const paymentMethodId = pms.data[0]?.id;
  if (!paymentMethodId) return { requiresCheckout: true as const };

  // Build subscription create payload
  const subBody = new URLSearchParams({
    customer: customerId,
    default_payment_method: paymentMethodId,
    "metadata[user_id]": args.userId,
    "metadata[plan_id]": args.planId,
    "expand[]": "latest_invoice.payment_intent",
  });

  if (!args.stripeSecretKey.startsWith("sk_test_") && checkoutPlan.stripe_price_id) {
    subBody.set("items[0][price]", checkoutPlan.stripe_price_id);
  } else {
    // Inline price: need a product
    const product = await stripeFetch<{ id: string }>(args.stripeSecretKey, "/products", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: checkoutPlan.display_name ?? "Pilates with Jon membership" }),
    });
    const price = await stripeFetch<{ id: string }>(args.stripeSecretKey, "/prices", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        currency: "usd",
        unit_amount: String(Math.round(Number(checkoutPlan.price_per_month) * 100)),
        "recurring[interval]": "month",
        product: product.id,
      }),
    });
    subBody.set("items[0][price]", price.id);
  }

  type CreatedSub = StripeSubscription & { latest_invoice?: { payment_intent?: { status?: string; client_secret?: string } | null } | null };
  const newSub = await stripeFetch<CreatedSub>(args.stripeSecretKey, "/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: subBody,
  });

  const start = new Date((newSub.start_date ?? Math.floor(Date.now() / 1000)) * 1000);
  const commitmentEnd = new Date(start);
  commitmentEnd.setMonth(commitmentEnd.getMonth() + 3);
  const periodEndSeconds = newSub.current_period_end ?? Math.floor(Date.now() / 1000);

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: args.userId,
        plan_id: args.planId,
        stripe_subscription_id: newSub.id,
        stripe_customer_id: customerId,
        status: newSub.status ?? "active",
        start_date: start.toISOString(),
        commitment_end_date: commitmentEnd.toISOString(),
        current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
        cancel_at_period_end: !!newSub.cancel_at_period_end,
        past_due_since: null,
        access_suspended: false,
      },
      { onConflict: "stripe_subscription_id" },
    )
    .select("*, plan:plans(*)")
    .maybeSingle();
  if (error) throw error;

  return { requiresCheckout: false as const, subscription: data };
}