import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { Check, Loader2, Play, X } from "lucide-react";
import { CONTENT_CATEGORIES, toEmbedUrl, type ContentCategory } from "@/lib/content-categories";
import { cn } from "@/lib/utils";
import { ExerciseLibraryClient } from "@/components/client/ExerciseLibraryClient";

export const Route = createFileRoute("/_authenticated/my-program")({
  component: MyProgramPage,
});

type Workout = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  category: string | null;
  difficulty: string | null;
  duration_minutes: number | null;
  active: boolean;
  sort_order: number;
};

const ACTIVE_SUB_STATUSES = ["active", "trialing"];

function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day + 6) % 7; // Mon as start
  x.setDate(x.getDate() - diff);
  return x;
}

function MyProgramPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<ContentCategory | "All">("All");

  const [tab, setTab] = useState<"mornings" | "exercises">("mornings");

  const { data: sub } = useQuery({
    enabled: !!userId,
    queryKey: ["my-sub", userId],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("status, plan:plans(type)")
        .eq("user_id", userId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data as { status: string; plan: { type: string } | null } | null;
    },
  });

  const { data: intake } = useQuery({
    enabled: !!userId,
    queryKey: ["my-intake", userId],
    queryFn: async () => {
      const { data } = await supabase.from("intake_forms").select("days_per_week")
        .eq("user_id", userId!).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
      return data as { days_per_week: number | null } | null;
    },
  });

  const accessGranted = !!sub && ACTIVE_SUB_STATUSES.includes(sub.status);

  const { data: workouts, isLoading } = useQuery({
    enabled: accessGranted,
    queryKey: ["library"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content").select("*").eq("active", true)
        .order("category", { ascending: true }).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Workout[];
    },
  });

  const { data: completions } = useQuery({
    enabled: !!userId,
    queryKey: ["my-completions", userId],
    queryFn: async () => {
      const { data } = await supabase.from("content_completions").select("content_id, completed_at")
        .eq("user_id", userId!);
      return (data ?? []) as { content_id: string; completed_at: string }[];
    },
  });

  const completedSet = useMemo(() => new Set((completions ?? []).map((c) => c.content_id)), [completions]);

  const completedThisWeek = useMemo(() => {
    const start = startOfWeek();
    return (completions ?? []).filter((c) => new Date(c.completed_at) >= start).length;
  }, [completions]);

  const goal = intake?.days_per_week ?? 3;
  const progressPct = Math.min(100, Math.round((completedThisWeek / goal) * 100));

  const filtered = useMemo(() => {
    const list = workouts ?? [];
    return activeCat === "All" ? list : list.filter((w) => w.category === activeCat);
  }, [workouts, activeCat]);

  const open = (workouts ?? []).find((w) => w.id === openId) ?? null;

  async function markComplete(w: Workout) {
    if (!userId) return;
    const { error } = await supabase.from("content_completions").insert({ user_id: userId, content_id: w.id });
    if (error) return toast.error(error.message);
    toast.success("Logged. Nice work.");
    qc.invalidateQueries({ queryKey: ["my-completions", userId] });
  }

  if (sub === undefined) {
    return <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  }

  if (!accessGranted) {
    return (
      <>
        <PageHeader title="My Program" subtitle="Your 10 Minute Mornings library." />
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="font-display text-2xl text-foreground mb-2">Library access paused</h2>
          <p className="text-sm text-muted-foreground">
            {sub?.status === "past_due"
              ? "Your subscription has a past-due payment. Update your billing to restore access."
              : "Your subscription isn't active. Reactivate to access the library."}
          </p>
        </div>
      </>
    );
  }

  const showExercisesTab = sub?.plan?.type && sub.plan.type !== "mornings";

  return (
    <>
      <PageHeader title="My Program" subtitle="A short session today is a long-term investment." />

      {showExercisesTab && (
        <div className="flex gap-2 mb-6 border-b border-border">
          {([
            { id: "mornings" as const, label: "10 Minute Mornings" },
            { id: "exercises" as const, label: "Exercise Library" },
          ]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn(
              "px-3 py-2 text-sm border-b-2 -mb-px",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}>{t.label}</button>
          ))}
        </div>
      )}

      {tab === "exercises" && showExercisesTab ? (
        <ExerciseLibraryClient />
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-4 mb-6">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">This week</span>
              <span className="text-sm text-foreground"><strong>{completedThisWeek}</strong> / {goal} sessions</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </section>

          <div className="flex flex-wrap gap-2 mb-4">
            {(["All", ...CONTENT_CATEGORIES] as const).map((c) => (
              <button key={c} onClick={() => setActiveCat(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs",
                  activeCat === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}>{c}</button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading library…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No workouts yet in this category.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((w) => {
                const done = completedSet.has(w.id);
                return (
                  <button key={w.id} onClick={() => setOpenId(w.id)}
                    className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors relative">
                    {done && (
                      <span className="absolute top-3 right-3 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
                        <Check size={14} />
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      <span>{w.category}</span>
                      {w.difficulty && <><span>·</span><span>{w.difficulty}</span></>}
                      {w.duration_minutes != null && <><span>·</span><span>{w.duration_minutes} min</span></>}
                    </div>
                    <div className="font-medium text-foreground mb-2">{w.title}</div>
                    <div className="inline-flex items-center gap-1 text-xs text-primary"><Play size={12} /> Watch</div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {open && (
        <WorkoutDetail
          workout={open}
          completed={completedSet.has(open.id)}
          onClose={() => setOpenId(null)}
          onComplete={() => markComplete(open)}
        />
      )}
    </>
  );
}

function WorkoutDetail({ workout, completed, onClose, onComplete }: {
  workout: Workout;
  completed: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const embed = toEmbedUrl(workout.video_url);
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-2xl bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">{workout.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          {workout.category}{workout.difficulty && ` · ${workout.difficulty}`}{workout.duration_minutes != null && ` · ${workout.duration_minutes} min`}
        </div>
        {embed ? (
          <div className="aspect-video rounded-lg overflow-hidden border border-border bg-black mb-4">
            <iframe src={embed} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={workout.title} />
          </div>
        ) : workout.video_url ? (
          <a href={workout.video_url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border bg-card p-4 mb-4 text-sm text-primary">Open video ↗</a>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground mb-4">No video attached.</div>
        )}
        {workout.description && <p className="text-sm text-foreground/90 leading-relaxed mb-6 whitespace-pre-line">{workout.description}</p>}
        <button
          onClick={onComplete}
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2"
        >
          <Check size={14} />
          {completed ? "Mark complete again" : "Mark as complete"}
        </button>
      </aside>
    </div>
  );
}
