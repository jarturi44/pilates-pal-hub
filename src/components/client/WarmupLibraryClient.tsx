import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Check, Play, X } from "lucide-react";
import { toEmbedUrl } from "@/lib/content-categories";

type Warmup = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  difficulty: string | null;
  duration_minutes: number | null;
  active: boolean;
  sort_order: number;
};

export function WarmupLibraryClient() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["warmups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warmup_content")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Warmup[];
    },
  });

  const { data: completions } = useQuery({
    enabled: !!userId,
    queryKey: ["warmup-completions", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("warmup_completions")
        .select("content_id, completed_at")
        .eq("user_id", userId!);
      return (data ?? []) as { content_id: string; completed_at: string }[];
    },
  });

  const doneToday = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const set = new Set<string>();
    (completions ?? []).forEach((c) => {
      if (new Date(c.completed_at) >= today) set.add(c.content_id);
    });
    return set;
  }, [completions]);

  const open = (items ?? []).find((w) => w.id === openId) ?? null;

  async function markDone(w: Warmup) {
    if (!userId) return;
    const { error } = await supabase.from("warmup_completions").insert({ user_id: userId, content_id: w.id });
    if (error) return toast.error(error.message);
    toast.success("Nice — you're warmed up.");
    qc.invalidateQueries({ queryKey: ["warmup-completions", userId] });
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 mb-6 text-sm text-foreground/90 leading-relaxed">
        Before your session, take a few minutes to warm up. Your body will thank you — and so will I. Pick one of these and get moving before we work together. See you in there! 💪
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading warm-ups…</div>
      ) : (items ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No warm-up videos yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(items ?? []).map((w) => {
            const done = doneToday.has(w.id);
            return (
              <button key={w.id} onClick={() => setOpenId(w.id)}
                className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors relative">
                {done && (
                  <span className="absolute top-3 right-3 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
                    <Check size={14} />
                  </span>
                )}
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  {w.duration_minutes != null && <span>{w.duration_minutes} min</span>}
                  {w.duration_minutes != null && w.difficulty && <span>·</span>}
                  {w.difficulty && <span>{w.difficulty}</span>}
                </div>
                <div className="font-medium text-foreground mb-2">{w.title}</div>
                <div className="inline-flex items-center gap-1 text-xs text-primary"><Play size={12} /> Watch</div>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <WarmupDetail
          warmup={open}
          completed={doneToday.has(open.id)}
          onClose={() => setOpenId(null)}
          onComplete={() => markDone(open)}
        />
      )}
    </>
  );
}

function WarmupDetail({ warmup, completed, onClose, onComplete }: {
  warmup: Warmup;
  completed: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const embed = toEmbedUrl(warmup.video_url);
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-2xl bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">{warmup.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          Warm-up{warmup.difficulty && ` · ${warmup.difficulty}`}{warmup.duration_minutes != null && ` · ${warmup.duration_minutes} min`}
        </div>
        {embed ? (
          <div className="aspect-video rounded-lg overflow-hidden border border-border bg-black mb-4">
            <iframe src={embed} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={warmup.title} />
          </div>
        ) : warmup.video_url ? (
          <a href={warmup.video_url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border bg-card p-4 mb-4 text-sm text-primary">Open video ↗</a>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground mb-4">No video attached.</div>
        )}
        {warmup.description && <p className="text-sm text-foreground/90 leading-relaxed mb-6 whitespace-pre-line">{warmup.description}</p>}
        <button
          onClick={onComplete}
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2"
        >
          <Check size={14} />
          {completed ? "Mark done again" : "Mark warm-up done for today"}
        </button>
      </aside>
    </div>
  );
}
