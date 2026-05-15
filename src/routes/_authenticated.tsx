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

  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ["onboarding-gate", user?.id],
    enabled: !!user?.id && role === "client",
    queryFn: async () => {
      const [subRes, userRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id, status")
          .eq("user_id", user!.id)
          .in("status", ["active", "trialing", "past_due"])
          .limit(1)
          .maybeSingle(),
        supabase
          .from("users")
          .select("onboarding_complete")
          .eq("id", user!.id)
          .maybeSingle(),
      ]);
      return {
        activeSub: subRes.data,
        onboardingComplete: !!userRes.data?.onboarding_complete,
      };
    },
  });

  if (loading || (role === "client" && gateLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;

  // Force clients into onboarding until they have a subscription AND have
  // completed the post-checkout intake + waiver flow.
  const isOnOnboarding = pathname.startsWith("/onboarding");
  if (role === "client" && gate && !isOnOnboarding) {
    if (!gate.activeSub) {
      return <Navigate to="/onboarding" search={{ step: "plan" }} />;
    }
    if (!gate.onboardingComplete) {
      return <Navigate to="/onboarding" search={{ step: "welcome" }} />;
    }
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
