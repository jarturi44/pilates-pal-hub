import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { DIFFICULTIES, type Difficulty } from "@/lib/content-categories";
import { cn } from "@/lib/utils";

type Warmup = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  difficulty: Difficulty | null;
  duration_minutes: number | null;
  active: boolean;
  sort_order: number;
};

export function WarmupLibraryAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Warmup | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-warmups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warmup_content")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Warmup[];
    },
  });

  const list = items ?? [];

  async function toggleActive(w: Warmup) {
    const { error } = await supabase.from("warmup_content").update({ active: !w.active }).eq("id", w.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-warmups"] });
  }

  async function remove(w: Warmup) {
    if (!confirm(`Delete "${w.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("warmup_content").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-warmups"] });
  }

  async function move(w: Warmup, dir: -1 | 1) {
    const idx = list.findIndex((x) => x.id === w.id);
    const swap = list[idx + dir];
    if (!swap) return;
    const aOrder = w.sort_order;
    const bOrder = swap.sort_order;
    const newA = bOrder, newB = aOrder === bOrder ? bOrder + dir : aOrder;
    const { error } = await supabase.from("warmup_content").upsert([
      { ...w, sort_order: newA },
      { ...swap, sort_order: newB },
    ]);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-warmups"] });
  }

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-display text-2xl text-foreground">Warm-Up Videos</h2>
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus size={14} /> New warm-up
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">No warm-up videos yet.</div>
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

      {(editing || creating) && (
        <WarmupEditor
          warmup={editing}
          existingMaxOrder={list.reduce((m, w) => Math.max(m, w.sort_order), 0)}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ["admin-warmups"] }); }}
        />
      )}
    </>
  );
}

function WarmupEditor({ warmup, existingMaxOrder, onClose, onSaved }: {
  warmup: Warmup | null;
  existingMaxOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(warmup?.title ?? "");
  const [description, setDescription] = useState(warmup?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(warmup?.video_url ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>((warmup?.difficulty as Difficulty) ?? "beginner");
  const [duration, setDuration] = useState<string>(warmup?.duration_minutes?.toString() ?? "5");
  const [active, setActive] = useState(warmup?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
      difficulty,
      duration_minutes: duration ? parseInt(duration, 10) : null,
      active,
    };
    const res = warmup
      ? await supabase.from("warmup_content").update(payload).eq("id", warmup.id)
      : await supabase.from("warmup_content").insert({ ...payload, sort_order: existingMaxOrder + 1 });
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
          <h2 className="font-display text-2xl text-foreground">{warmup ? "Edit warm-up" : "New warm-up"}</h2>
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
            <Field label="Difficulty">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </Field>
          </div>
          <Field label="Status">
            <label className="flex items-center gap-2 text-sm pt-1">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (visible to eligible clients)
            </label>
          </Field>
          <button onClick={save} disabled={saving} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save warm-up
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
