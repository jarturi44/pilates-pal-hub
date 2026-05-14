import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [working, setWorking] = useState(false);

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

  async function cancel() {
    if (!sub) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { subscription_id: sub.id },
      });
      if (error) throw error;
      if (data?.error === "commitment_active") {
        toast.error("You can cancel after your 3-month commitment ends.");
      } else {
        toast.success("Your subscription will cancel at the end of the current period.");
        qc.invalidateQueries({ queryKey: ["my-subscription"] });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(false);
    }
  }

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
                <button
                  onClick={cancel}
                  disabled={working || lockedIn || sub.status === "canceled" || sub.cancel_at_period_end}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {working && <Loader2 size={14} className="animate-spin" />}
                  Cancel subscription
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
