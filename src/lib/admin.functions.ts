import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");

    // Best-effort: cancel Stripe subs
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey) {
      try {
        const { data: subs } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_subscription_id")
          .eq("user_id", data.userId);
        for (const s of subs ?? []) {
          if (!s.stripe_subscription_id) continue;
          await fetch(`https://api.stripe.com/v1/subscriptions/${s.stripe_subscription_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${stripeSecretKey}` },
          }).catch(() => {});
        }
      } catch (e) { console.error("Stripe cancel error", e); }
    }

    // Wipe related rows in public schema (no FK cascades configured)
    const tables = [
      "attendance", "client_slots", "content_completions", "warmup_completions",
      "exercise_completions", "program_completions", "program_assignments",
      "intake_forms", "waivers", "equipment_fulfillment", "notifications",
      "notification_dedupe", "subscriptions", "client_activity", "activity_log",
      "live_sessions", "reminder_send_log", "user_roles",
    ];
    for (const t of tables) {
      await supabaseAdmin.from(t).delete().eq("user_id", data.userId);
    }
    await supabaseAdmin.from("users").delete().eq("id", data.userId);

    // Delete the auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
