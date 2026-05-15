import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeStats, computeBadges, type ProgressEvent } from "@/lib/progress";
import { Award, Lock, Loader2, Flame, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressDashboard({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["progress-data", userId],
    queryFn: async () => {
      const [att, comp, prog, usr, intake] = await Promise.all([
        supabase.from("attendance").select("session_date, status").eq("user_id", userId).eq("status", "present"),
        supabase.from("content_completions").select("completed_at").eq("user_id", userId),
        supabase.from("program_completions").select("completed_at").eq("user_id", userId),
        supabase.from("users").select("created_at").eq("id", userId).maybeSingle(),
        supabase.from("intake_forms").select("days_per_week").eq("user_id", userId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const events: ProgressEvent[] = [
        ...((att.data ?? []) as { session_date: string }[]).map((r) => ({ date: new Date(r.session_date + "T12:00:00"), kind: "live" as const })),
        ...((comp.data ?? []) as { completed_at: string }[]).map((r) => ({ date: new Date(r.completed_at), kind: "mornings" as const })),
        ...((prog.data ?? []) as { completed_at: string }[]).map((r) => ({ date: new Date(r.completed_at), kind: "mornings" as const })),
      ];
      return {
        events,
        memberSince: usr.data?.created_at ? new Date(usr.data.created_at) : null,
        weeklyGoal: intake.data?.days_per_week ?? 3,
      };
    },
  });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  }

  const stats = computeStats(data.events, { weeklyGoal: data.weeklyGoal });
  const badges = computeBadges(stats, data.memberSince);
  const maxWeek = Math.max(1, ...stats.weekly.map((w) => w.live + w.mornings));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Consistency (30d)" value={`${stats.consistencyPct}%`} icon={TrendingUp} />
        <Stat label="Current streak" value={`${stats.streakWeeks} wk`} icon={Flame} />
        <Stat label="This month" value={stats.thisMonth} icon={Calendar} />
        <Stat label="All time" value={stats.total} icon={Award} />
      </div>

      {data.memberSince && (
        <div className="text-xs text-muted-foreground">
          Member since {data.memberSince.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-lg text-foreground">Last 8 weeks</h3>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-primary" /> Live</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-primary/40" /> Mornings</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {stats.weekly.map((w, i) => {
            const total = w.live + w.mornings;
            const totalPct = (total / maxWeek) * 100;
            const livePct = total === 0 ? 0 : (w.live / total) * totalPct;
            const mornPct = total === 0 ? 0 : (w.mornings / total) * totalPct;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse h-full">
                  <div className="w-full bg-primary" style={{ height: `${livePct}%` }} title={`${w.live} live`} />
                  <div className="w-full bg-primary/40" style={{ height: `${mornPct}%` }} title={`${w.mornings} mornings`} />
                </div>
                <div className="text-[9px] text-muted-foreground">{w.weekStart.getMonth() + 1}/{w.weekStart.getDate()}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="font-display text-lg text-foreground mb-3">Milestones</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {badges.map((b) => (
            <div key={b.id} className={cn(
              "rounded-xl border p-4 flex items-start gap-3",
              b.unlocked ? "border-primary/40 bg-primary/5" : "border-border bg-card opacity-70",
            )}>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                b.unlocked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}>
                {b.unlocked ? <Award size={18} /> : <Lock size={16} />}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-foreground text-sm">{b.label}</div>
                <div className="text-xs text-muted-foreground">{b.description}</div>
                {b.progressLabel && <div className="text-[10px] mt-1 text-muted-foreground">{b.progressLabel}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}
