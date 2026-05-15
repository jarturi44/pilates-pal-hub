import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronUp, Loader2, Play, X } from "lucide-react";
import { EXERCISE_CATEGORIES, EXERCISE_DIFFICULTIES, type ExerciseCategory } from "@/lib/exercise-categories";
import { toEmbedUrl } from "@/lib/content-categories";
import { cn } from "@/lib/utils";

type Exercise = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  category: string | null;
  difficulty: string | null;
  tags: string[];
  active: boolean;
};

function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

export function ExerciseLibraryClient() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState<ExerciseCategory | "All">("All");
  const [diff, setDiff] = useState<string>("All");
  const [programOpen, setProgramOpen] = useState(true);

  // Active assignment + program detail
  const { data: assignment, isLoading: assignLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["my-program-assignment", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_assignments")
        .select("id, assigned_at, program:programs(id, name, description, frequency, active)")
        .eq("user_id", userId!)
        .eq("active", true)
        .maybeSingle();
      return data as any;
    },
  });

  const programId = assignment?.program?.id ?? null;

  const { data: programItems } = useQuery({
    enabled: !!programId,
    queryKey: ["program-items", programId],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_exercises")
        .select("id, position, notes, exercise:exercises(*)")
        .eq("program_id", programId!)
        .order("position");
      return (data ?? []) as { id: string; position: number; notes: string | null; exercise: Exercise }[];
    },
  });

  const { data: allExercises, isLoading: libLoading } = useQuery({
    queryKey: ["client-exercises"],
    queryFn: async () => {
      const { data } = await supabase.from("exercises").select("*").eq("active", true).order("title");
      return (data ?? []) as Exercise[];
    },
  });

  const { data: exerciseCompletions } = useQuery({
    enabled: !!userId,
    queryKey: ["my-exercise-completions", userId],
    queryFn: async () => {
      const since = startOfDay().toISOString();
      const { data } = await supabase.from("exercise_completions")
        .select("exercise_id, completed_at")
        .eq("user_id", userId!)
        .gte("completed_at", since);
      return (data ?? []) as { exercise_id: string; completed_at: string }[];
    },
  });

  const completedToday = useMemo(() => new Set((exerciseCompletions ?? []).map((c) => c.exercise_id)), [exerciseCompletions]);

  const filteredLibrary = useMemo(() => {
    return (allExercises ?? []).filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (diff !== "All" && e.difficulty !== diff) return false;
      return true;
    });
  }, [allExercises, cat, diff]);

  async function markExercise(exerciseId: string) {
    if (!userId) return;
    if (completedToday.has(exerciseId)) return;
    const { error } = await supabase.from("exercise_completions")
      .insert({ user_id: userId, exercise_id: exerciseId, program_id: programId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-exercise-completions", userId] });
  }

  async function logSession() {
    if (!userId || !programId || !programItems) return;
    const { error: pcErr } = await supabase.from("program_completions").insert({ user_id: userId, program_id: programId });
    if (pcErr) return toast.error(pcErr.message);
    const toMark = programItems.filter((it) => !completedToday.has(it.exercise.id));
    if (toMark.length > 0) {
      await supabase.from("exercise_completions").insert(
        toMark.map((it) => ({ user_id: userId, exercise_id: it.exercise.id, program_id: programId })),
      );
    }
    toast.success("Session logged. Strong work.");
    qc.invalidateQueries({ queryKey: ["my-exercise-completions", userId] });
    qc.invalidateQueries({ queryKey: ["progress-data", userId] });
  }

  const open = (allExercises ?? []).find((e) => e.id === openId)
    ?? (programItems ?? []).map((p) => p.exercise).find((e) => e.id === openId)
    ?? null;

  return (
    <div className="space-y-8">
      {/* Assigned program */}
      {assignLoading ? (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : assignment && assignment.program?.active ? (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <button onClick={() => setProgramOpen((v) => !v)} className="w-full flex items-start justify-between gap-3 text-left">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-primary mb-1">Your program</div>
              <h2 className="font-display text-2xl text-foreground">{assignment.program.name}</h2>
              {assignment.program.frequency && <div className="text-xs text-muted-foreground mt-1">{assignment.program.frequency}</div>}
              {assignment.program.description && <p className="text-sm text-foreground/90 mt-2">{assignment.program.description}</p>}
            </div>
            {programOpen ? <ChevronUp size={18} className="text-muted-foreground shrink-0" /> : <ChevronDown size={18} className="text-muted-foreground shrink-0" />}
          </button>

          {programOpen && (
            <>
              <ol className="space-y-2 mt-4">
                {(programItems ?? []).map((it, idx) => {
                  const done = completedToday.has(it.exercise.id);
                  return (
                    <li key={it.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <div className="font-display text-lg text-muted-foreground w-6 shrink-0">{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">{it.exercise.title}</div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {it.exercise.category}{it.exercise.difficulty && ` · ${it.exercise.difficulty}`}
                          </div>
                          {it.notes && <div className="text-xs text-foreground/80 mt-1 italic">{it.notes}</div>}
                          {it.exercise.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.exercise.description}</div>}
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => setOpenId(it.exercise.id)} className="inline-flex items-center gap-1 text-xs text-primary"><Play size={12} /> Watch</button>
                          </div>
                        </div>
                        <button
                          onClick={() => markExercise(it.exercise.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                            done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Check size={12} /> {done ? "Done" : "Mark"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <button
                onClick={logSession}
                className="mt-4 w-full rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2"
              >
                <Check size={14} /> Log this session
              </button>
            </>
          )}
        </section>
      ) : null}

      {/* Browse library */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-xl text-foreground">Explore the library</h3>
          <span className="text-xs text-muted-foreground">{filteredLibrary.length} exercises</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["All", ...EXERCISE_CATEGORIES] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn(
              "rounded-full border px-3 py-1.5 text-xs",
              cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(["All", ...EXERCISE_DIFFICULTIES] as const).map((d) => (
            <button key={d} onClick={() => setDiff(d)} className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              diff === d ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}>{d}</button>
          ))}
        </div>

        {libLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filteredLibrary.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No exercises match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredLibrary.map((e) => {
              const done = completedToday.has(e.id);
              return (
                <button key={e.id} onClick={() => setOpenId(e.id)}
                  className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors relative">
                  {done && (
                    <span className="absolute top-3 right-3 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
                      <Check size={14} />
                    </span>
                  )}
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {e.category}{e.difficulty && ` · ${e.difficulty}`}
                  </div>
                  <div className="font-medium text-foreground mb-2">{e.title}</div>
                  {e.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {e.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {open && <ExerciseDetail exercise={open} done={completedToday.has(open.id)} onClose={() => setOpenId(null)} onMark={() => markExercise(open.id)} />}
    </div>
  );
}

function ExerciseDetail({ exercise, done, onClose, onMark }: { exercise: Exercise; done: boolean; onClose: () => void; onMark: () => void }) {
  const embed = toEmbedUrl(exercise.video_url);
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-2xl bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">{exercise.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          {exercise.category}{exercise.difficulty && ` · ${exercise.difficulty}`}
        </div>
        {embed ? (
          <div className="aspect-video rounded-lg overflow-hidden border border-border bg-black mb-4">
            <iframe src={embed} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={exercise.title} />
          </div>
        ) : exercise.video_url ? (
          <a href={exercise.video_url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border bg-card p-4 mb-4 text-sm text-primary">Open video ↗</a>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground mb-4">No video attached.</div>
        )}
        {exercise.description && <p className="text-sm text-foreground/90 leading-relaxed mb-6 whitespace-pre-line">{exercise.description}</p>}
        <button
          onClick={onMark}
          disabled={done}
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Check size={14} /> {done ? "Completed today" : "Mark as complete"}
        </button>
      </aside>
    </div>
  );
}
