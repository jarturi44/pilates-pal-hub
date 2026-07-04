import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { AlertCircle, Users, CalendarCheck, PackageCheck, DollarSign, UserPlus, AlertTriangle, ClipboardList, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function planNeedsEquipment(planType?: string | null) {
  return planType === "small_group" || planType === "one_on_one" || planType === "combo";
}

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats-v2"],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      const [activeSubs, byPlan, newThisMonth, pastDue, pendingShip, needsSlot, clientSubs, progress, allClients] = await Promise.all([
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing"]),
        supabase.from("subscriptions").select("plan_id, plan:plans(display_name, price_per_month)").in("status", ["active", "trialing"]),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "client").gte("created_at", monthStart.toISOString()),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "past_due"),
        supabase.from("equipment_fulfillment").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("needs_slot_assignment", true),
        supabase.from("subscriptions").select("user_id, status, plan:plans(type)").in("status", ["active", "trialing", "past_due"]),
        supabase.from("onboarding_progress").select("user_id, waiver_completed_at, shipping_completed_at"),
        supabase.from("users").select("id").eq("role", "client"),
      ]);

      const planCounts = new Map<string, { name: string; count: number; price: number }>();
      let mrr = 0;
      (byPlan.data ?? []).forEach((s: any) => {
        const name = s.plan?.display_name ?? "Unknown";
        const price = Number(s.plan?.price_per_month ?? 0);
        mrr += price;
        const cur = planCounts.get(name) ?? { name, count: 0, price };
        cur.count++;
        planCounts.set(name, cur);
      });

      const progressBy = new Map<string, any>();
      (progress.data ?? []).forEach((p: any) => progressBy.set(p.user_id, p));
      const subBy = new Map<string, any>();
      (clientSubs.data ?? []).forEach((s: any) => { if (!subBy.has(s.user_id)) subBy.set(s.user_id, s); });
      const onboardingIncomplete = (allClients.data ?? []).filter((u: any) => {
        const sub = subBy.get(u.id);
        const prog = progressBy.get(u.id);
        const shippingDone = !planNeedsEquipment(sub?.plan?.type) || !!prog?.shipping_completed_at;
        return !sub || !prog?.waiver_completed_at || !shippingDone;
      }).length;

      return {
        activeSubs: activeSubs.count ?? 0,
        mrr,
        newThisMonth: newThisMonth.count ?? 0,
        pastDue: pastDue.count ?? 0,
        pendingShip: pendingShip.count ?? 0,
        needsSlot: needsSlot.count ?? 0,
        onboardingIncomplete,
        planBreakdown: Array.from(planCounts.values()).sort((a, b) => b.count - a.count),
      };
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
      const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Studio command center." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat icon={<Users size={16} />} label="Active subscribers" value={stats?.activeSubs ?? 0} />
        <Stat icon={<DollarSign size={16} />} label="MRR" value={`$${(stats?.mrr ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat icon={<UserPlus size={16} />} label="New this month" value={stats?.newThisMonth ?? 0} />
        <LinkStat icon={<AlertTriangle size={16} />} label="Past due" value={stats?.pastDue ?? 0} to="/clients" />
        <LinkStat icon={<PackageCheck size={16} />} label="Pending fulfillment" value={stats?.pendingShip ?? 0} to="/fulfillment" />
        <LinkStat icon={<CalendarCheck size={16} />} label="Pending slot assignments" value={stats?.needsSlot ?? 0} to="/slots" />
        <LinkStat icon={<ClipboardList size={16} />} label="Onboarding incomplete" value={stats?.onboardingIncomplete ?? 0} to="/clients" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-lg text-foreground mb-3">Plan breakdown</h3>
          {!stats?.planBreakdown.length ? (
            <p className="text-sm text-muted-foreground">No active subscriptions.</p>
          ) : (
            <ul className="space-y-2">
              {stats.planBreakdown.map((p) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {p.count} × ${Number(p.price).toLocaleString()} = <span className="text-foreground font-medium">${(p.count * Number(p.price)).toLocaleString()}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-lg text-foreground mb-3 inline-flex items-center gap-2"><Activity size={16} /> Recent activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((a: any) => (
                <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-foreground truncate">{a.message}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{a.type}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{relTime(a.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(stats?.needsSlot ?? 0) > 0 && (
        <Link to="/clients" className="block rounded-xl border border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition-colors">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-primary" />
            <div className="text-sm text-foreground">{stats!.needsSlot} new client{stats!.needsSlot > 1 ? "s" : ""} need a slot assignment.</div>
          </div>
        </Link>
      )}
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">{icon}{label}</div>
      <div className="font-display text-2xl text-foreground mt-1">{value}</div>
    </div>
  );
}
function LinkStat(props: { icon: React.ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={props.to} className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">{props.icon}{props.label}</div>
      <div className="font-display text-2xl text-foreground mt-1">{props.value}</div>
    </Link>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
