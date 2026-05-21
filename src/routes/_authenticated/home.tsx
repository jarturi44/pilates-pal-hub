import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { Check, Play, X, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toEmbedUrl } from "@/lib/content-categories";
import { WarmupLibraryClient } from "@/components/client/WarmupLibraryClient";
import { ExerciseLibraryClient } from "@/components/client/ExerciseLibraryClient";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

type Plan = { display_name: string | null; type: string | null };
type Sub = { status: string; plan: Plan | null };
type LiveSession = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
  meeting_url: string | null;
};
type MorningRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  video_url: string | null;
  duration_minutes: number | null;
};

function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const e = new Date(s); e.setDate(s.getDate() + 7);
  return e;
}

function HomePage() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const [openMorning, setOpenMorning] = useState<MorningRow | null>(null);

  const { data: sub } = useQuery({
    enabled: !!userId,
    queryKey: ["program-sub", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, plan:plans(display_name, type)")
        .eq("user_id", userId!)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as Sub | null) ?? null;
    },
  });

  const { data: sessions } = useQuery({
    enabled: !!userId,
    queryKey: ["program-live-sessions", userId],
    queryFn: async () => {
      const s = startOfWeek().toISOString();
      const e = endOfWeek().toISOString();
      const { data } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("user_id", userId!)
        .gte("scheduled_at", s)
        .lt("scheduled_at", e)
        .order("scheduled_at", { ascending: true });
      return (data ?? []) as LiveSession[];
    },
  });

  // 10 Minute Mornings — sourced from `content` table (admin: Content → 10 Minute Mornings tab)
  const { data: mornings } = useQuery({
    queryKey: ["mornings-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, description, category, difficulty, video_url, duration_minutes")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MorningRow[];
    },
  });

  // Completions for mornings (`content_completions`)
  const { data: morningCompletions } = useQuery({
    enabled: !!userId,
    queryKey: ["my-content-completions", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_completions")
        .select("content_id, completed_at")
        .eq("user_id", userId!);
      return (data ?? []) as { content_id: string; completed_at: string }[];
    },
  });

  const completedMorningIdsToday = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const s = new Set<string>();
    (morningCompletions ?? []).forEach((c) => {
      if (new Date(c.completed_at) >= today) s.add(c.content_id);
    });
    return s;
  }, [morningCompletions]);

  const morningsThisWeek = useMemo(() => {
    const start = startOfWeek();
    return (morningCompletions ?? []).filter((c) => new Date(c.completed_at) >= start).length;
  }, [morningCompletions]);

  const MORNING_GOAL = 2;
  const morningPct = Math.min(100, (morningsThisWeek / MORNING_GOAL) * 100);
  const morningExtra = Math.max(0, morningsThisWeek - MORNING_GOAL);

  const upcoming = (sessions ?? []).filter((s) => new Date(s.scheduled_at) >= new Date());

  async function joinSession(s: LiveSession) {
    if (s.meeting_url) window.open(s.meeting_url, "_blank", "noopener,noreferrer");
    if (!userId) return;
    const { error } = await supabase.from("client_activity").insert({
      user_id: userId,
      activity_type: "live_session_join",
      reference_id: s.id,
    });
    if (error) toast.error(error.message);
  }

  async function markMorningDone(m: MorningRow) {
    if (!userId) return;
    const { error } = await supabase.from("content_completions").insert({
      user_id: userId,
      content_id: m.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Logged. Nice work.");
    qc.invalidateQueries({ queryKey: ["my-content-completions", userId] });
    qc.invalidateQueries({ queryKey: ["progress-data", userId] });
    setOpenMorning(null);
  }

  const planName = sub?.plan?.display_name ?? null;
  const planType = sub?.plan?.type ?? null;
  const isLivePlan = planType && planType !== "mornings";

  return (
    <>
      <PageHeader title="Welcome back" subtitle="Your home for movement, mindfulness, and progress." />

      <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-8 md:p-12 text-center mb-10">
        {planName ? (
          <>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Your current plan</div>
            <h2 className="font-display text-3xl md:text-5xl text-foreground">{planName}</h2>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">No active plan</h2>
            <Link
              to="/onboarding"
              search={{ step: "plan" }}
              className="inline-block rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              Choose one
            </Link>
          </>
        )}
      </section>

      {isLivePlan && (
        <section className="mb-12">
          <h3 className="font-display text-2xl text-foreground">
            Your Live Sessions{planName ? ` — ${planName}` : ""}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground mb-5">
            This week's sessions for your {planName ?? "current"} plan. Warm up before each one.
          </p>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No upcoming sessions this week.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {upcoming.map((s) => {
                const d = new Date(s.scheduled_at);
                const dayLabel = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
                const timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      <CalendarIcon size={12} />
                      <span>{dayLabel}</span>
                    </div>
                    <div className="font-medium text-foreground">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {timeLabel}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                    </div>
                    <button
                      onClick={() => joinSession(s)}
                      disabled={!s.meeting_url}
                      className="mt-4 w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      Join Live Session
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Warm-Ups (admin: Content → Warm-Up Videos) */}
      {isLivePlan && (
        <section className="mb-12">
          <h3 className="font-display text-2xl text-foreground mb-1">Warm-Up Videos</h3>
          <p className="text-sm text-muted-foreground mb-5">Pick one before each live session.</p>
          <WarmupLibraryClient />
        </section>
      )}

      {/* Exercise Library + assigned Program (admin: Content → Exercise Library / Programs) */}
      {isLivePlan && (
        <section className="mb-12">
          <h3 className="font-display text-2xl text-foreground mb-1">Exercise Library & Your Program</h3>
          <p className="text-sm text-muted-foreground mb-5">Your assigned program plus the full library to explore.</p>
          <ExerciseLibraryClient />
        </section>
      )}

      {/* 10 Minute Mornings (admin: Content → 10 Minute Mornings) */}
      <section className="mb-12">
        <h3 className="font-display text-2xl text-foreground">10 Minute Mornings</h3>
        <p className="mt-1 text-sm text-muted-foreground mb-5 max-w-3xl">
          Short guided sessions you can fit into any day. Aim for {MORNING_GOAL} a week — every extra one counts.
        </p>

        <div className="rounded-xl border border-border bg-card p-4 mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">This week</span>
            <span className="text-sm text-foreground">
              <strong>{morningsThisWeek}</strong> / {MORNING_GOAL} sessions
              {morningExtra > 0 && (
                <span className="ml-2 text-xs text-primary">+{morningExtra} bonus 🎉</span>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${morningPct}%` }} />
          </div>
        </div>

        {!mornings?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No morning sessions available yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mornings.map((m) => {
              const done = completedMorningIdsToday.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setOpenMorning(m)}
                  className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors relative"
                >
                  {done && (
                    <span className="absolute top-3 right-3 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
                      <Check size={14} />
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {m.category && <span>{m.category}</span>}
                    {m.category && m.difficulty && <span>·</span>}
                    {m.difficulty && <span>{m.difficulty}</span>}
                  </div>
                  <div className="font-medium text-foreground mb-1">{m.title}</div>
                  {m.description && <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{m.description}</div>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {m.duration_minutes ? `${m.duration_minutes} min` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <Play size={12} /> Watch
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {openMorning && (
        <MorningModal
          item={openMorning}
          completed={completedMorningIdsToday.has(openMorning.id)}
          onClose={() => setOpenMorning(null)}
          onMarkDone={() => markMorningDone(openMorning)}
        />
      )}
    </>
  );
}

function MorningModal({
  item, completed, onClose, onMarkDone,
}: {
  item: MorningRow;
  completed: boolean;
  onClose: () => void;
  onMarkDone: () => void;
}) {
  const embed = toEmbedUrl(item.video_url);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl bg-background border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {item.category}{item.difficulty && ` · ${item.difficulty}`}
            </div>
            <h2 className="font-display text-xl text-foreground">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {embed ? (
            <iframe src={embed} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.title} />
          ) : item.video_url ? (
            <div className="w-full h-full flex items-center justify-center">
              <a href={item.video_url} target="_blank" rel="noreferrer" className="text-sm text-primary">Open video ↗</a>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No video available.</div>
          )}
        </div>
        {item.description && (
          <div className="p-4 text-sm text-foreground/90 whitespace-pre-line">{item.description}</div>
        )}
        <div className="p-4 border-t border-border">
          <button
            onClick={onMarkDone}
            className={cn(
              "w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-90",
            )}
          >
            <Check size={14} />
            {completed ? "Mark as done again" : "Mark as Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
