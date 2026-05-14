import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { loading, session, role, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: activeSub, isLoading: subLoading } = useQuery({
    queryKey: ["active-sub-check", user?.id],
    enabled: !!user?.id && role === "client",
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("user_id", user!.id)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (loading || (role === "client" && subLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;

  // Force new clients (no active subscription) through onboarding.
  const isOnOnboarding = pathname.startsWith("/onboarding");
  if (role === "client" && !activeSub && !isOnOnboarding) {
    return <Navigate to="/onboarding" search={{ step: "plan" }} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
