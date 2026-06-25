import { supabaseAdmin } from "@/integrations/supabase/client.server";

type StripeCheckoutSession = {
  id: string;
  url?: string;
  customer?: string | { id?: string } | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  payment_status?: string;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
};

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

/** Create a $60 one-time Stripe checkout session for a NOT-YET-REGISTERED user. */
export async function createPublicIntakeCheckoutOnServer(args: {
  stripeSecretKey: string;
  name: string;
  email: string;
  returnUrl: string;
}) {
  const origin = args.returnUrl || "";
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/onboarding/create-account?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/get-started`,
    customer_email: args.email,
    customer_creation: "always",
    "payment_intent_data[setup_future_usage]": "off_session",
    "metadata[flow]": "intake",
    "metadata[purpose]": "intake_session",
    "metadata[name]": args.name,
    "metadata[email]": args.email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": "6000",
    "line_items[0][price_data][product_data][name]": "Pilates with Jon — Initial Intake Session",
    "line_items[0][price_data][product_data][description]":
      "60-minute virtual intake. We'll discuss your goals, frequency, and availability.",
  });

  const session = await stripeFetch<StripeCheckoutSession>(args.stripeSecretKey, "/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!session.url) throw new Error("No checkout URL returned");
  return { url: session.url };
}

/**
 * Verify a Stripe session is paid, upsert a pending_intakes row (idempotent),
 * and return { email, name } so the create-account page can prefill the form.
 */
export async function getIntakeSessionInfoOnServer(args: {
  stripeSecretKey: string;
  sessionId: string;
}) {
  const session = await stripeFetch<StripeCheckoutSession>(
    args.stripeSecretKey,
    `/checkout/sessions/${encodeURIComponent(args.sessionId)}`,
  );
  if (session.metadata?.flow !== "intake") {
    throw new Error("This checkout session is not an intake session.");
  }
  if (session.payment_status !== "paid") {
    throw new Error("Payment hasn't completed yet — please refresh in a moment.");
  }
  const email = (session.customer_details?.email || session.customer_email || session.metadata?.email || "").toLowerCase();
  const name = session.customer_details?.name || session.metadata?.name || "";
  if (!email) throw new Error("Stripe session is missing an email.");
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  // Idempotent upsert keyed on stripe_session_id
  await supabaseAdmin
    .from("pending_intakes")
    .upsert(
      {
        email,
        name,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: customerId,
        amount_paid: session.amount_total ?? 6000,
      },
      { onConflict: "stripe_session_id" },
    );

  // If somebody already claimed this session, surface that.
  const { data: pi } = await supabaseAdmin
    .from("pending_intakes")
    .select("claimed_by_user_id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  return { email, name, alreadyClaimed: !!pi?.claimed_by_user_id };
}

/** Same as above but resolves a pending_intakes row from a resume token. */
export async function getIntakeInfoByResumeTokenOnServer(args: { token: string }) {
  const { data, error } = await supabaseAdmin
    .from("pending_intakes")
    .select("email, name, claimed_by_user_id")
    .eq("resume_token", args.token)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Invalid or expired link.");
  return { email: data.email, name: data.name ?? "", alreadyClaimed: !!data.claimed_by_user_id };
}

/**
 * After signup, link the auth user to the pending_intakes row and mark the
 * users.intake_paid_at column. Public — verified by re-checking the Stripe
 * session is paid and that the email matches the just-created auth user.
 */
export async function claimIntakeForUserOnServer(args: {
  stripeSecretKey: string;
  sessionId?: string;
  resumeToken?: string;
  email: string;
}) {
  const normalizedEmail = args.email.toLowerCase();

  // Find the pending_intakes row
  let pendingRowQuery = supabaseAdmin
    .from("pending_intakes")
    .select("id, email, stripe_session_id, intake_completed_at")
    .limit(1);
  if (args.sessionId) {
    pendingRowQuery = pendingRowQuery.eq("stripe_session_id", args.sessionId);
  } else if (args.resumeToken) {
    pendingRowQuery = pendingRowQuery.eq("resume_token", args.resumeToken);
  } else {
    throw new Error("Missing session id or resume token.");
  }
  const { data: pending, error: pendingErr } = await pendingRowQuery.maybeSingle();
  if (pendingErr) throw pendingErr;
  if (!pending) throw new Error("Intake record not found.");
  if (pending.email.toLowerCase() !== normalizedEmail) {
    throw new Error("Email doesn't match the original payment.");
  }

  // If a sessionId was provided, verify with Stripe one more time.
  if (args.sessionId) {
    const session = await stripeFetch<StripeCheckoutSession>(
      args.stripeSecretKey,
      `/checkout/sessions/${encodeURIComponent(args.sessionId)}`,
    );
    if (session.payment_status !== "paid") throw new Error("Payment not complete.");
  }

  // Find the auth user by email (admin)
  const { data: usersList, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (usersErr) throw usersErr;
  const authUser = usersList.users.find((u) => (u.email ?? "").toLowerCase() === normalizedEmail);
  if (!authUser) throw new Error("Account not found. Try logging in again.");

  // Update users row
  const { error: updErr } = await supabaseAdmin
    .from("users")
    .update({
      intake_paid_at: new Date().toISOString(),
      intake_stripe_session_id: pending.stripe_session_id,
      ...(pending.intake_completed_at ? { intake_completed_at: pending.intake_completed_at } : {}),
    })
    .eq("id", authUser.id);
  if (updErr) throw updErr;

  // Mark pending row as claimed
  await supabaseAdmin
    .from("pending_intakes")
    .update({ claimed_by_user_id: authUser.id, claimed_at: new Date().toISOString() })
    .eq("id", pending.id);

  return { ok: true };
}
