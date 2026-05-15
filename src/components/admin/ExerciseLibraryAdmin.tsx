import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X, Search, Play } from "lucide-react";
import { EXERCISE_CATEGORIES, EXERCISE_DIFFICULTIES, type ExerciseCategory, type ExerciseDifficulty } from "@/lib/exercise-categories";
import { toEmbedUrl } from "@/lib/content-categories";
import { cn } from "@/lib/utils";

export type Exercise = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  category: string | null;
  difficulty: string | null;
  tags: string[];
  active: boolean;
  sort_order: number;
};

export function ExerciseLibraryAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<Exercise | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [diff, setDiff] = useState<string>("All");

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["admin-exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (exercises ?? []).filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (diff !== "All" && e.difficulty !== diff) return false;
      if (!term) return true;
      const hay = [e.title, e.description ?? "", (e.tags ?? []).join(" ")].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [exercises, q, cat, diff]);

  async function toggleActive(e: Exercise) {
    const { error } = await supabase.from("exercises").update({ active: !e.active }).eq("id", e.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-exercises"] });
  }

  async function remove(e: Exercise) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    const { error } = await supabase.from("exercises").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-exercises"] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search title, cues, tags…"
            className="w-full pl-9 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-md border border-border bg-background px-2 py-2 text-sm">
          <option value="All">All categories</option>
          {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={diff} onChange={(e) => setDiff(e.target.value)} className="rounded-md border border-border bg-background px-2 py-2 text-sm">
          <option value="All">All levels</option>
          {EXERCISE_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus size={14} /> New exercise
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">No exercises match.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {filtered.map((e) => (
            <div key={e.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("font-medium truncate", e.active ? "text-foreground" : "text-muted-foreground line-through")}>{e.title}</span>
                  {e.category && <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{e.category}</span>}
                  {e.difficulty && <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{e.difficulty}</span>}
                </div>
                {e.tags?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {e.tags.map((t) => <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPreviewing(e)} title="Preview as client" className="p-2 text-muted-foreground hover:text-foreground"><Play size={14} /></button>
                <button onClick={() => toggleActive(e)} title={e.active ? "Hide" : "Show"} className="p-2 text-muted-foreground hover:text-foreground">
                  {e.active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => setEditing(e)} className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                <button onClick={() => remove(e)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <ExerciseEditor
          exercise={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ["admin-exercises"] }); }}
        />
      )}
      {previewing && <ExercisePreview exercise={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

function ExerciseEditor({ exercise, onClose, onSaved }: { exercise: Exercise | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(exercise?.title ?? "");
  const [description, setDescription] = useState(exercise?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(exercise?.video_url ?? "");
  const [category, setCategory] = useState<ExerciseCategory>((exercise?.category as ExerciseCategory) ?? "Mat Work");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>((exercise?.difficulty as ExerciseDifficulty) ?? "Beginner");
  const [tagsStr, setTagsStr] = useState((exercise?.tags ?? []).join(", "));
  const [active, setActive] = useState(exercise?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
      category,
      difficulty,
      tags,
      active,
    };
    const res = exercise
      ? await supabase.from("exercises").update(payload).eq("id", exercise.id)
      : await supabase.from("exercises").insert(payload);
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
          <h2 className="font-display text-2xl text-foreground">{exercise ? "Edit exercise" : "New exercise"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Description / coaching cues">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Video URL">
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Difficulty">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as ExerciseDifficulty)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {EXERCISE_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Tags (comma separated)">
            <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="core, hip flexors, posture" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (visible to clients)
          </label>
          <button onClick={save} disabled={saving} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />} Save exercise
          </button>
        </div>
      </aside>
    </div>
  );
}

function ExercisePreview({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const embed = toEmbedUrl(exercise.video_url);
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-2xl bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Client preview</div>
            <h2 className="font-display text-2xl text-foreground">{exercise.title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          {exercise.category}{exercise.difficulty && ` · ${exercise.difficulty}`}
        </div>
        {embed ? (
          <div className="aspect-video rounded-lg overflow-hidden border border-border bg-black mb-4">
            <iframe src={embed} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={exercise.title} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground mb-4">No video attached.</div>
        )}
        {exercise.description && <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{exercise.description}</p>}
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
