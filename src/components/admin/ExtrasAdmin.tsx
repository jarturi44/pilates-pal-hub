import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X, Play } from "lucide-react";

const EXTRA_CATEGORY = "10_min_morning_extra";

type Extra = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  created_at: string;
};

type Draft = {
  title: string;
  video_url: string;
  description: string;
  duration_minutes: string;
};

const emptyDraft: Draft = { title: "", video_url: "", description: "", duration_minutes: "" };

export function ExtrasAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Extra | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: extras, isLoading } = useQuery({
    queryKey: ["admin-extras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, description, video_url, duration_minutes, created_at")
        .eq("category", EXTRA_CATEGORY)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Extra[];
    },
  });

  async function remove(x: Extra) {
    if (!confirm(`Delete "${x.title}"? This removes it from every client's portal and can't be undone.`)) return;
    const { error } = await supabase.from("videos").delete().eq("id", x.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-extras"] });
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <p className="text-sm text-muted-foreground">
          Extras are short bonus videos that appear in the <strong className="text-foreground">10 Minute Mornings</strong> area
          of every client's portal, under an "Extras" heading. They don't count toward the weekly goal.
          Paste a YouTube or Vimeo link.
        </p>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h2 className="font-display text-2xl text-foreground">Extras library</h2>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90"
        ><Plus size={14} /> New extra</button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (extras ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No extras yet. Click "New extra" to add your first short video.
        </div>
      ) : (
        <ul className="space-y-2">
          {(extras ?? []).map((x) => (
            <li key={x.id} className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{x.title}</div>
                {x.description && <div className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{x.description}</div>}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {x.duration_minutes ? <span>{x.duration_minutes} min</span> : null}
                  {x.video_url ? (
                    <a href={x.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      <Play size={11} /> Preview link
                    </a>
                  ) : <span className="text-destructive">No video link</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditing(x)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil size={15} /></button>
                <button onClick={() => remove(x)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete"><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <ExtraForm
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-extras"] }); }}
        />
      )}
    </>
  );
}

function ExtraForm({
  initial, onClose, onSaved,
}: { initial: Extra | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(
    initial
      ? {
          title: initial.title,
          video_url: initial.video_url ?? "",
          description: initial.description ?? "",
          duration_minutes: initial.duration_minutes != null ? String(initial.duration_minutes) : "",
        }
      : emptyDraft,
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft.title.trim()) return toast.error("Title is required");
    if (!draft.video_url.trim()) return toast.error("A video link is required");
    const mins = draft.duration_minutes.trim() ? Number(draft.duration_minutes.trim()) : null;
    if (mins != null && (!Number.isFinite(mins) || mins < 0)) return toast.error("Duration must be a positive number");

    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      video_url: draft.video_url.trim(),
      description: draft.description.trim() || null,
      duration_minutes: mins,
      category: EXTRA_CATEGORY,
    };
    const { error } = initial
      ? await supabase.from("videos").update(payload).eq("id", initial.id)
      : await supabase.from("videos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Updated" : "Extra added");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-foreground">{initial ? "Edit extra" : "New extra"}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close"><X size={18} /></button>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Title</label>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="e.g. Quick Neck & Shoulder Release"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Video link (YouTube or Vimeo)</label>
          <input
            value={draft.video_url}
            onChange={(e) => setDraft((d) => ({ ...d, video_url: e.target.value }))}
            placeholder="https://youtu.be/…"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Length in minutes <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input
            value={draft.duration_minutes}
            onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: e.target.value }))}
            inputMode="numeric"
            placeholder="e.g. 5"
            className="mt-1 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? "Save changes" : "Add extra"}
          </button>
        </div>
      </div>
    </div>
  );
}
