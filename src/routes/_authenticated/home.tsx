import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { Check, Play, X, Video as VideoIcon, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  category: "warmup" | "10_min_morning" | "cool_down";
  thumbnail_url: string | null;
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

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function isExternalEmbed(url: string | null | undefined): boolean {
  if (!url) return false;
  return /zoom\.us\//i.test(url);
}
function videoThumb(v: { video_url: string | null; thumbnail_url: string | null }): string | null {
  if (v.thumbnail_url) return v.thumbnail_url;
  const id = getYouTubeId(v.video_url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function HomePage() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const [openVideo, setOpenVideo] = useState<VideoRow | null>(null);

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

  const { data: videos } = useQuery({
    queryKey: ["program-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VideoRow[];
    },
  });

  const { data: activity } = useQuery({
    enabled: !!userId,
    queryKey: ["program-activity", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_activity")
        .select("activity_type, reference_id, occurred_at")
        .eq("user_id", userId!)
        .eq("activity_type", "video_complete");
      return (data ?? []) as { activity_type: string; reference_id: string | null; occurred_at: string }[];
    },
  });

  const completedVideoIds = useMemo(
    () => new Set((activity ?? []).map((a) => a.reference_id).filter(Boolean) as string[]),
    [activity],
  );

  const library = (videos ?? []).filter((v) => v.category === "warmup");
  const mornings = (videos ?? []).filter((v) => v.category === "10_min_morning");
  const cooldowns = (videos ?? []).filter((v) => v.category === "cool_down");

  const morningIds = useMemo(() => new Set(mornings.map((m) => m.id)), [mornings]);
  const morningsThisWeek = useMemo(() => {
    const start = startOfWeek();
    return (activity ?? []).filter(
      (a) => a.reference_id && morningIds.has(a.reference_id) && new Date(a.occurred_at) >= start,
    ).length;
  }, [activity, morningIds]);
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

  async function markVideoDone(v: VideoRow) {
    if (!userId) return;
    const { error } = await supabase.from("client_activity").insert({
      user_id: userId,
      activity_type: "video_complete",
      reference_id: v.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Logged. Nice work.");
    qc.invalidateQueries({ queryKey: ["program-activity", userId] });
    setOpenVideo(null);
  }

  const planName = sub?.plan?.display_name ?? null;

  return (
    <>
      <PageHeader title="Welcome back" subtitle="Making you Stronger, more Flexible, and more Pain Free" />

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

      <VideoSection
        heading="Warm-Up & Exercise Library"
        intro="One library, organized by exercise. Pick the warm-up that matches what we're working on."
        videos={library}
        completedIds={completedVideoIds}
        onOpen={setOpenVideo}
      />

      <section className="mb-12">
        <h3 className="font-display text-2xl text-foreground">10 Minute Mornings</h3>
        <p className="mt-1 text-sm text-muted-foreground mb-5 max-w-3xl">
          On days without a live session, fit in a 10 Minute Mornings video. Aim for 2 a week — every extra one counts.
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

        {mornings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No videos yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mornings.slice(0, 2).map((v) => {
              const done = completedVideoIds.has(v.id);
              return (
                <div key={v.id} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                  <div className="relative aspect-video bg-muted">
                    {(() => { const t = videoThumb(v); return t ? (
                      <img src={t} alt={v.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <VideoIcon size={28} />
                      </div>
                    ); })()}
                    {done && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-1">
                        <Check size={12} /> Completed
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="font-medium text-foreground">{v.title}</div>
                    {v.description && <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{v.description}</div>}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {v.duration_minutes ? `${v.duration_minutes} min` : ""}
                    </div>
                    <button
                      onClick={() => setOpenVideo(v)}
                      className="mt-4 w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <Play size={14} /> Watch
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <VideoSection
        heading="Cool Down"
        intro="Wind down after your session. Pick a cool down to stretch and recover."
        videos={cooldowns}
        completedIds={completedVideoIds}
        onOpen={setOpenVideo}
      />



      {openVideo && (
        <VideoModal
          video={openVideo}
          completed={completedVideoIds.has(openVideo.id)}
          onClose={() => setOpenVideo(null)}
          onMarkDone={() => markVideoDone(openVideo)}
        />
      )}
    </>
  );
}

function VideoSection({
  heading, intro, videos, completedIds, onOpen,
}: {
  heading: string;
  intro?: string;
  videos: VideoRow[];
  completedIds: Set<string>;
  onOpen: (v: VideoRow) => void;
}) {
  return (
    <section className="mb-12">
      {heading && <h3 className="font-display text-2xl text-foreground">{heading}</h3>}
      {intro && <p className="mt-1 text-sm text-muted-foreground mb-5 max-w-3xl">{intro}</p>}
      {!intro && heading && <div className="mb-5" />}

      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No videos yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {videos.map((v) => {
            const done = completedIds.has(v.id);
            return (
              <div key={v.id} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                <div className="relative aspect-video bg-muted">
                  {(() => { const t = videoThumb(v); return t ? (
                    <img src={t} alt={v.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <VideoIcon size={28} />
                    </div>
                  ); })()}
                  {done && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-1">
                      <Check size={12} /> Completed
                    </span>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="font-medium text-foreground">{v.title}</div>
                  {v.description && <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{v.description}</div>}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {v.duration_minutes ? `${v.duration_minutes} min` : ""}
                  </div>
                  <button
                    onClick={() => onOpen(v)}
                    className={cn(
                      "mt-4 w-full rounded-md px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-1.5",
                      "bg-primary text-primary-foreground hover:opacity-90",
                    )}
                  >
                    <Play size={14} /> Watch
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VideoModal({
  video, completed, onClose, onMarkDone,
}: {
  video: VideoRow;
  completed: boolean;
  onClose: () => void;
  onMarkDone: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl bg-background border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-xl text-foreground">{video.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {(() => {
            const ytId = getYouTubeId(video.video_url);
            if (ytId) {
              return (
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                  title={video.title}
                  className="w-full h-full"
                  allow="accelerated-sensors; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              );
            }
            if (isExternalEmbed(video.video_url) && video.video_url) {
              return (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm text-background/80">This recording opens in a new tab.</p>
                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium inline-flex items-center gap-1.5 hover:opacity-90"
                  >
                    <Play size={14} /> Open recording
                  </a>
                </div>
              );
            }
            return video.video_url ? (
              <video src={video.video_url} controls className="w-full h-full" poster={video.thumbnail_url ?? undefined} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No video available.</div>
            );
          })()}
        </div>
        {video.description && (
          <div className="p-4 text-sm text-foreground/90 whitespace-pre-line">{video.description}</div>
        )}
        <div className="p-4 border-t border-border">
          <button
            onClick={onMarkDone}
            className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Check size={14} />
            {completed ? "Mark as done again" : "Mark as Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
