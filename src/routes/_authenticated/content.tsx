import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { CONTENT_CATEGORIES, DIFFICULTIES, DAY_NAMES, type ContentCategory, type Difficulty } from "@/lib/content-categories";
import { cn } from "@/lib/utils";
import { ExerciseLibraryAdmin } from "@/components/admin/ExerciseLibraryAdmin";
import { ProgramsAdmin } from "@/components/admin/ProgramsAdmin";

export const Route = createFileRoute("/_authenticated/content")({
  component: AdminContentPage,
});

type Tab = "mornings" | "exercises" | "programs";

function AdminContentPage() {
  const [tab, setTab] = useState<Tab>("mornings");
  return (
    <>
      <PageHeader title="Content" subtitle="Manage everything clients see in My Program." />
      <div className="flex gap-2 mb-6 border-b border-border">
        {([
          { id: "mornings", label: "10 Minute Mornings" },
          { id: "exercises", label: "Exercise Library" },
          { id: "programs", label: "Programs" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            "px-3 py-2 text-sm border-b-2 -mb-px",
            tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}>{t.label}</button>
        ))}
      </div>
      {tab === "mornings" && <MorningsContentTab />}
      {tab === "exercises" && <ExerciseLibraryAdmin />}
      {tab === "programs" && <ProgramsAdmin />}
    </>
  );
}

type Workout = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  category: string | null;
  difficulty: Difficulty | null;
  duration_minutes: number | null;
  active: boolean;
  sort_order: number;
};

function MorningsContentTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Workout | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: workouts, isLoading } = useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Workout[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["reminder-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("reminder_settings").select("*").eq("id", 1).maybeSingle();
      return data as { id: number; reminder_days: number[] } | null;
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Workout[]>();
    CONTENT_CATEGORIES.forEach((c) => map.set(c, []));
    (workouts ?? []).forEach((w) => {
      const key = w.category && CONTENT_CATEGORIES.includes(w.category as ContentCategory) ? w.category : "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    });
    return map;
  }, [workouts]);

  async function toggleActive(w: Workout) {
    const { error } = await supabase.from("content").update({ active: !w.active }).eq("id", w.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-content"] });
  }

  async function remove(w: Workout) {
    if (!confirm(`Delete "${w.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("content").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-content"] });
  }

  async function move(w: Workout, dir: -1 | 1) {
    const list = grouped.get(w.category ?? "Uncategorized") ?? [];
    const idx = list.findIndex((x) => x.id === w.id);
    const swap = list[idx + dir];
    if (!swap) return;
    const aOrder = w.sort_order;
    const bOrder = swap.sort_order;
    // If equal, bump to keep distinct
    const newA = bOrder, newB = aOrder === bOrder ? bOrder + dir : aOrder;
    const { error } = await supabase.from("content").upsert([
      { ...w, sort_order: newA },
      { ...swap, sort_order: newB },
    ]);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-content"] });
  }

  async function toggleReminderDay(day: number) {
    if (!settings) return;
    const set = new Set<number>(settings.reminder_days);
    if (set.has(day)) set.delete(day); else set.add(day);
    const arr = Array.from(set).sort((a, b) => a - b);
    const { error } = await supabase.from("reminder_settings").update({ reminder_days: arr, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reminder-settings"] });
  }

  return (
    <>
      <PageHeader title="Content" subtitle="Curate the 10 Minute Mornings library." />

      <section className="rounded-xl border border-border bg-card p-4 mb-6">
        <h2 className="font-display text-lg text-foreground mb-1">Reminder days</h2>
        <p className="text-xs text-muted-foreground mb-3">Active subscribers receive a 10 Minute Mornings nudge on the days you select.</p>
        <div className="flex flex-wrap gap-2">
          {DAY_NAMES.map((label, i) => {
            const on = settings?.reminder_days?.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleReminderDay(i)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >{label}</button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-between items-center mb-3">
        <h2 className="font-display text-2xl text-foreground">Library</h2>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90"
        ><Plus size={14} /> New workout</button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6">
          {CONTENT_CATEGORIES.map((cat) => {
            const list = grouped.get(cat) ?? [];
            return (
              <section key={cat}>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{cat}</h3>
                {list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-card/50 p-4 text-xs text-muted-foreground">No workouts in this category yet.</div>
                ) : (
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {list.map((w, i) => (
                      <div key={w.id} className="p-3 flex items-center gap-3">
                        <div className="flex flex-col">
                          <button disabled={i === 0} onClick={() => move(w, -1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={12} /></button>
                          <button disabled={i === list.length - 1} onClick={() => move(w, 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={12} /></button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("font-medium truncate", w.active ? "text-foreground" : "text-muted-foreground line-through")}>{w.title}</span>
                            {w.difficulty && <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{w.difficulty}</span>}
                            {w.duration_minutes != null && <span className="text-[10px] text-muted-foreground">{w.duration_minutes} min</span>}
                          </div>
                          {w.description && <div className="text-xs text-muted-foreground truncate">{w.description}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleActive(w)} title={w.active ? "Hide" : "Show"} className="p-2 text-muted-foreground hover:text-foreground">
                            {w.active ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button onClick={() => setEditing(w)} className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                          <button onClick={() => remove(w)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <WorkoutEditor
          workout={editing}
          existingMaxOrder={(grouped.get(editing?.category ?? "Mat Work") ?? []).reduce((m, w) => Math.max(m, w.sort_order), 0)}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ["admin-content"] }); }}
        />
      )}
    </>
  );
}

function WorkoutEditor({ workout, existingMaxOrder, onClose, onSaved }: {
  workout: Workout | null;
  existingMaxOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(workout?.title ?? "");
  const [description, setDescription] = useState(workout?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(workout?.video_url ?? "");
  const [category, setCategory] = useState<ContentCategory>((workout?.category as ContentCategory) ?? "Mat Work");
  const [difficulty, setDifficulty] = useState<Difficulty>((workout?.difficulty as Difficulty) ?? "beginner");
  const [duration, setDuration] = useState<string>(workout?.duration_minutes?.toString() ?? "10");
  const [active, setActive] = useState(workout?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
      category,
      difficulty,
      duration_minutes: duration ? parseInt(duration, 10) : null,
      active,
    };
    const res = workout
      ? await supabase.from("content").update(payload).eq("id", workout.id)
      : await supabase.from("content").insert({ ...payload, sort_order: existingMaxOrder + 1 });
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-lg bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">{workout ? "Edit workout" : "New workout"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Video URL (YouTube or Vimeo)">
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as ContentCategory)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Difficulty">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (minutes)">
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 text-sm pt-2">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Active (visible to clients)
              </label>
            </Field>
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save workout
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
