import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});
function ProfilePage() {
  const { user } = useAuth();

  const { data: sub } = useQuery({

    queryKey: ["my-subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:plans(display_name, price_per_month)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const commitmentEnd = sub?.commitment_end_date ? new Date(sub.commitment_end_date) : null;
  const lockedIn = commitmentEnd ? commitmentEnd > new Date() : false;

  return (
    <>

      <PageHeader title="Profile" subtitle="Manage your account and subscription." />
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl text-foreground mb-3">Account</h2>
          <div className="text-sm text-muted-foreground">{user?.email}</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl text-foreground mb-4">Subscription</h2>
          {!sub ? (
            <p className="text-sm text-muted-foreground">No active subscription.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-medium text-foreground">{(sub.plan as any)?.display_name ?? "Plan"}</div>
                  <div className="text-xs text-muted-foreground capitalize">Status: {sub.status}{sub.cancel_at_period_end ? " · cancels at period end" : ""}</div>
                </div>
                <div className="font-display text-xl">${(sub.plan as any)?.price_per_month}<span className="text-sm text-muted-foreground">/mo</span></div>
              </div>
              {commitmentEnd && (
                <div className="text-sm rounded-md bg-muted/50 p-3 text-foreground">
                  {lockedIn
                    ? <>You're within your 3-month commitment. You'll be eligible to cancel on <strong>{commitmentEnd.toLocaleDateString()}</strong>.</>
                    : <>Commitment period ended on {commitmentEnd.toLocaleDateString()}. You can cancel anytime.</>}
                </div>
              )}
              <div className="pt-2">
                <div className="text-sm text-muted-foreground mb-3">
                  All plans require a <strong>3-month minimum commitment</strong>. Your subscription will renew monthly, and you cannot cancel from within the app before the 3-month commitment period ends. <strong>Cancellation must be submitted in writing 3 weeks before end of billing cycle in order to not be charged for the next month.</strong>
                </div>
                <a
                  href={`mailto:jon@pilateswithjon.com?subject=${encodeURIComponent("Cancel Subscription")}&body=${encodeURIComponent("Please briefly describe why you want to cancel.")}`}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                  aria-label="Cancel subscription by email"
                >
                  Cancel subscription
                </a>
              </div>

            </div>
          )}
        </section>
      </div>
    </>
  );
}
