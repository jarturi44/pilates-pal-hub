import { createServerFn } from "@tanstack/react-start";

export const getDefaultMeetingUrl = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("studio_settings")
    .select("default_meeting_url")
    .eq("id", 1)
    .maybeSingle();
  return (data?.default_meeting_url as string | null) ?? null;
});
