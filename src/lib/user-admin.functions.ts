import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Server-side writes to sensitive `users` columns that clients no longer have
 * direct UPDATE privileges on (role, intake_paid_at, intake_completed_at,
 * onboarding_complete). All writes go through supabaseAdmin after an explicit
 * authorization check here.
 */

/** Signed-in user marks their own onboarding as complete. */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("users")
      .update({ onboarding_complete: true })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Admin toggles the intake_completed_at timestamp on a user row. */
export const adminSetIntakeCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), completed: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("users")
      .update({ intake_completed_at: data.completed ? new Date().toISOString() : null })
      .eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });
