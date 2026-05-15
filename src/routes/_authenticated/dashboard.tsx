import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { AlertCircle, Users, CalendarCheck, PackageCheck } from "lucide-react";

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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Users size={16} />} label="Active subscribers" value={stats?.activeSubs ?? 0} />
        <Stat icon={<CalendarCheck size={16} />} label="Need slot assignment" value={stats?.needsSlot ?? 0} />
        <Stat icon={<PackageCheck size={16} />} label="Pending fulfillments" value={stats?.pendingShip ?? 0} />
      </div>
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
