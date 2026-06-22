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
      const { error: updErr } = await supabase.from("users").update(patch).eq("id", userId);
      if (updErr) throw updErr;
    }

    return { ok: true };
  });
