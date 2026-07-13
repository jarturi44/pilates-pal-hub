import { createServerFn } from "@tanstack/react-start";

/**
 * Public, read-only list of plans for the marketing "Plans & Pricing" page
 * (/plans), which prospects can view BEFORE signing up or paying for an intake.
 *
 * The `plans` table is only readable by the `authenticated` role under RLS, so
 * a logged-out visitor's client query returns nothing. This server function
 * reads via the service role and returns ONLY safe, display-facing columns
 * (never stripe_price_id) so pricing can be shown publicly without exposing
 * billing internals. No auth middleware — intentionally callable by anyone.
 */
export type PublicPlan = {
  id: string;
  type: "mornings" | "small_group" | "one_on_one" | "combo";
  display_name: string;
  sessions_per_week: number | null;
  price_per_month: number;
  includes_mornings: boolean;
};

export const getPublicPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPlan[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("plans")
      .select("id, type, display_name, sessions_per_week, price_per_month, includes_mornings")
      .order("sessions_per_week", { ascending: true });
    if (error) throw error;
    return (data ?? []) as PublicPlan[];
  },
);
