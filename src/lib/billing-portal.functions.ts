import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    returnUrl: z.string().url(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");

    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.stripe_customer_id) throw new Error("No billing account found.");

    const body = new URLSearchParams({
      customer: sub.stripe_customer_id,
      return_url: data.returnUrl,
    });

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) {
      throw new Error(json.error?.message ?? "Could not open billing portal.");
    }
    return { url: json.url };
  });
