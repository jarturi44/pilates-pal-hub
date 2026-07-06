import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only read of recently-sent reminder emails from `email_send_log`.
 * That table is service_role-only via RLS, so admins can't query it directly
 * from the client — this routes the read through supabaseAdmin after an admin
 * check.
 */
const REMINDER_TEMPLATES = [
  "mornings-reminder",
  "session-reminder",
  "session-starting-soon",
  "onboarding-reminder",
];

export type ReminderEmailRow = {
  template_name: string;
  recipient_email: string;
  status: string;
  created_at: string;
};

export const adminReminderEmailLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReminderEmailRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("email_send_log")
      .select("template_name, recipient_email, status, created_at")
      .in("template_name", REMINDER_TEMPLATES)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []) as ReminderEmailRow[];
  });
