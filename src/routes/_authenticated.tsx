import { createFileRoute, Outlet, Navigate, useRouterState, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { AlertOctagon } from "lucide-react";
import { LoadingScreen } from "@/components/Wordmark";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { loading, session, role, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const location = useRouterState({ select: (s) => s.location });

  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ["onboarding-gate", user?.id],
    enabled: !!user?.id && role === "client",
    queryFn: async () => {
      const [subRes, userRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id, status, access_suspended, past_due_since")
          .eq("user_id", user!.id)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
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
    return <LoadingScreen />;
  }
  if (!session) {
    const redirect = `${location.pathname}${location.searchStr || ""}`;
    return <Navigate to="/login" search={{ redirect }} />;
  }

  const isOnOnboarding = pathname.startsWith("/onboarding");
  if (role === "client" && gate && !isOnOnboarding) {
    if (!gate.activeSub) {
      return <Navigate to="/onboarding" search={{ step: "plan" }} />;
    }
    if (!gate.onboardingComplete) {
      return <Navigate to="/onboarding" search={{ step: "welcome" }} />;
    }
    if (gate.activeSub.access_suspended && !pathname.startsWith("/settings") && !pathname.startsWith("/notifications")) {
      return <SuspendedScreen />;
    }
  }

  return (
    <AppShell>
      {role === "client" && gate?.activeSub?.status === "past_due" && !gate.activeSub.access_suspended && (
        <PastDueBanner since={gate.activeSub.past_due_since} />
      )}
      <Outlet />
    </AppShell>
  );
}

function PastDueBanner({ since }: { since: string | null }) {
  const daysLeft = since
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(since).getTime()) / (24 * 60 * 60 * 1000)))
    : 7;
  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
      <AlertOctagon size={18} className="text-amber-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-medium text-foreground">Payment failed — update your card</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Access will pause in {daysLeft} day{daysLeft === 1 ? "" : "s"} unless your payment is updated.
        </div>
      </div>
      <Link to="/settings" className="rounded-md bg-amber-500 text-amber-950 px-3 py-1.5 text-xs font-semibold">
        Update payment
      </Link>
    </div>
  );
}

function SuspendedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertOctagon size={22} />
        </div>
        <h1 className="font-display text-2xl text-foreground">Access paused</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your subscription is past due. Update your payment method to restore access immediately.
        </p>
        <Link
          to="/settings"
          className="mt-6 inline-block rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
        >
          Update payment
        </Link>
      </div>
    </div>
  );
}
