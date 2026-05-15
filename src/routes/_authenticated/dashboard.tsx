import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { AlertCircle, AlertOctagon, Users, CalendarCheck, PackageCheck, Megaphone, Flag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [activeSubs, needsSlot, pendingShip] = await Promise.all([
        supabase.from("subscriptions").select("id", { count: "exact", head: true })
          .in("status", ["active", "trialing", "past_due"]),
        supabase.from("users").select("id", { count: "exact", head: true })
          .eq("needs_slot_assignment", true),
        supabase.from("equipment_fulfillment").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      return {
        activeSubs: activeSubs.count ?? 0,
        needsSlot: needsSlot.count ?? 0,
        pendingShip: pendingShip.count ?? 0,
      };
    },
  });

  const { data: flagged } = useQuery({
    queryKey: ["admin-flagged-items"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [pastDue, broadcasts] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id, user_id, past_due_since, access_suspended")
          .eq("status", "past_due")
          .order("past_due_since", { ascending: true }),
        supabase
          .from("broadcasts")
          .select("id, subject, audience_label, recipient_count, created_at")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false }),
      ]);
      const userIds = (pastDue.data ?? []).map((s) => s.user_id);
      const { data: users } = userIds.length
        ? await supabase.from("users").select("id, name, email").in("id", userIds)
        : { data: [] as { id: string; name: string | null; email: string }[] };
      const userMap = new Map((users ?? []).map((u) => [u.id, u]));
      const now = Date.now();
      const items = (pastDue.data ?? []).map((s) => {
        const u = userMap.get(s.user_id);
        const daysOverdue = s.past_due_since
          ? Math.floor((now - new Date(s.past_due_since).getTime()) / (24 * 60 * 60 * 1000))
          : 0;
        const inGrace = !s.access_suspended;
        const daysRemaining = inGrace ? Math.max(0, 7 - daysOverdue) : 0;
        return {
          id: s.id,
          name: u?.name || u?.email || "Unknown client",
          daysOverdue,
          daysRemaining,
          suspended: s.access_suspended,
        };
      });
      return { pastDue: items, broadcasts: broadcasts.data ?? [] };
    },
  });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Studio overview." />

      {stats && stats.needsSlot > 0 && (
        <Link
          to="/clients"
          className="block mb-6 rounded-xl border border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/15 text-primary inline-flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
            <div className="flex-1">
              <div className="font-medium text-foreground">
                {stats.needsSlot} new client{stats.needsSlot > 1 ? "s" : ""} need{stats.needsSlot > 1 ? "" : "s"} a slot assignment
              </div>
              <div className="text-xs text-muted-foreground">Review onboarded clients and assign their recurring sessions.</div>
            </div>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Stat icon={<Users size={16} />} label="Active subscribers" value={stats?.activeSubs ?? 0} />
        <Stat icon={<CalendarCheck size={16} />} label="Need slot assignment" value={stats?.needsSlot ?? 0} />
        <Stat icon={<PackageCheck size={16} />} label="Pending fulfillments" value={stats?.pendingShip ?? 0} />
      </div>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Flag size={14} className="text-muted-foreground" />
          <h2 className="font-display text-lg text-foreground">Flagged items</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-3">
              <AlertOctagon size={14} /> Billing issues
            </div>
            {flagged?.pastDue.length ? (
              <ul className="divide-y divide-border">
                {flagged.pastDue.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.suspended
                          ? `Access suspended · ${p.daysOverdue}d overdue`
                          : `In grace · ${p.daysRemaining}d remaining (${p.daysOverdue}d overdue)`}
                      </div>
                    </div>
                    <span
                      className={
                        "rounded-full text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide " +
                        (p.suspended ? "bg-destructive/10 text-destructive" : "bg-amber-500/15 text-amber-600")
                      }
                    >
                      {p.suspended ? "Suspended" : "Grace"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No billing issues.</div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-3">
              <Megaphone size={14} /> Recent broadcasts (7d)
            </div>
            {flagged?.broadcasts.length ? (
              <ul className="divide-y divide-border">
                {flagged.broadcasts.map((b) => (
                  <li key={b.id} className="py-2.5">
                    <div className="text-sm font-medium text-foreground truncate">{b.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.audience_label || "All clients"} · {b.recipient_count} recipient{b.recipient_count === 1 ? "" : "s"} ·{" "}
                      {new Date(b.created_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No broadcasts in the last 7 days.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="font-display text-4xl text-foreground mt-2">{value}</div>
    </div>
  );
}
