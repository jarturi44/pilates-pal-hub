import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDefaultMeetingUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Only clients with an active/trialing/past_due subscription — or admins —
    // should see the live-session meeting URL.
    const { supabase, userId } = context;

    const [{ data: isAdmin }, { data: sub }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle(),
    ]);

    if (!isAdmin && !sub) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("studio_settings")
      .select("default_meeting_url")
      .eq("id", 1)
      .maybeSingle();
    return (data?.default_meeting_url as string | null) ?? null;
  });
