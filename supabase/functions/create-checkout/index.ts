// Creates a Stripe Checkout Session for the authenticated user.
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Payments are not configured yet." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { plan_id, return_url } = await req.json();
    if (!plan_id) {
      return new Response(JSON.stringify({ error: "plan_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("display_name, price_per_month, stripe_price_id")
      .eq("id", plan_id)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = return_url || req.headers.get("origin") || "";
    const baseSessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer_email: user.email!,
      success_url: `${origin}/onboarding?step=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding?step=plan`,
      metadata: { user_id: user.id, plan_id },
      subscription_data: { metadata: { user_id: user.id, plan_id } },
    };

    const fallbackLineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(Number(plan.price_per_month) * 100),
        recurring: { interval: "month" },
        product_data: { name: plan.display_name ?? "Pilates with Jon membership" },
      },
    };

    const isTestMode = stripeSecretKey.startsWith("sk_test_");
    const lineItems = isTestMode || !plan.stripe_price_id
      ? [fallbackLineItem]
      : [{ price: plan.stripe_price_id, quantity: 1 }];

    const session = await stripe.checkout.sessions.create({
      ...baseSessionParams,
      line_items: lineItems,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
