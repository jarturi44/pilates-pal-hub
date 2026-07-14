import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { Check, Play, X, Video as VideoIcon, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDefaultMeetingUrl } from "@/lib/studio.functions";

export const Route = createFileRoute("/_authenticated/portal")({
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
  category: "warmup" | "10_min_morning" | "10_min_morning_extra" | "cool_down";
  thumbnail_url: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  created_at?: string;
};

function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
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

  const { data: sub, isLoading: isSubLoading } = useQuery({
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
      // Sessions are scheduled as recurring weekly slots (slots + client_slots),
      // NOT individual `live_sessions` rows (that table is never populated).
      // Derive this week's dated occurrences from the client's assigned slots.
      const { data: cs } = await supabase
        .from("client_slots")
        .select("id, slot:slots(id, day_of_week, time, session_type)")
        .eq("user_id", userId!);
      const weekStart = startOfWeek(); // Monday 00:00 local
      return (cs ?? [])
        .map((row: any): LiveSession | null => {
          const slot = row.slot;
          if (!slot) return null;
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + ((slot.day_of_week + 6) % 7)); // Mon..Sun
          const [hh, mm] = String(slot.time ?? "0:0").split(":");
          d.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
          return {
            id: row.id,
            title: slot.session_type === "one_on_one" ? "One-on-One Session" : "Small Group Session",
            scheduled_at: d.toISOString(),
            duration_minutes: 30,
            meeting_url: null,
          };
        })
        .filter((x: LiveSession | null): x is LiveSession => x !== null)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    },
  });

  const { data: videos } = useQuery({
    queryKey: ["program-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
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

  const WARMUP_ORDER = ["Knee Folds + Arm Circles", "Side Lying Arms", "Seated Arms", "Mermaid", "Hip Up Legs", "Resistance Stretching"];
  const COOLDOWN_ORDER = ["Seal", "Knee, Ankle, Foot", "Running + Breathing"];
  function sortByOrder(list: VideoRow[], order: string[]) {
    const map = new Map(order.map((t, i) => [t.toLowerCase().replace(/[^a-z0-9]/g, ""), i]));
    return [...list].sort((a, b) => {
      const ai = map.get(a.title.toLowerCase().replace(/[^a-z0-9]/g, "")) ?? 999;
      const bi = map.get(b.title.toLowerCase().replace(/[^a-z0-9]/g, "")) ?? 999;
      return ai - bi;
    });
  }

  const library = sortByOrder((videos ?? []).filter((v) => v.category === "warmup"), WARMUP_ORDER);
  const TUTORIAL_ORDER = ["Welcome", "The 100", "The Roll Up", "Rolling Like a Ball", "Single Leg Circle", "Spine Stretch"];
  const TUTORIAL_SET = new Set(TUTORIAL_ORDER.map((t) => t.toLowerCase()));
  const morningsAll = (videos ?? []).filter((v) => v.category === "10_min_morning");
  const morningsRegular = morningsAll.filter((v) => !TUTORIAL_SET.has(v.title.toLowerCase()));
  const morningsTutorials = sortByOrder(morningsAll.filter((v) => TUTORIAL_SET.has(v.title.toLowerCase())), TUTORIAL_ORDER);
  const cooldowns = sortByOrder((videos ?? []).filter((v) => v.category === "cool_down"), COOLDOWN_ORDER);
  const extras = (videos ?? [])
    .filter((v) => v.category === "10_min_morning_extra")
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

  const morningIds = useMemo(() => new Set(morningsRegular.map((m) => m.id)), [morningsRegular]);
  const morningsThisWeek = useMemo(() => {
    const start = startOfWeek();
    return (activity ?? []).filter(
      (a) => a.reference_id && morningIds.has(a.reference_id) && new Date(a.occurred_at) >= start,
    ).length;
  }, [activity, morningIds]);
  const MORNING_GOAL = 2;
  const morningPct = Math.min(100, (morningsThisWeek / MORNING_GOAL) * 100);
  const morningExtra = Math.max(0, morningsThisWeek - MORNING_GOAL);

  const fetchDefaultUrl = useServerFn(getDefaultMeetingUrl);
  const { data: defaultMeetingUrl } = useQuery({
    queryKey: ["default-meeting-url"],
    queryFn: () => fetchDefaultUrl(),
    staleTime: 5 * 60 * 1000,
  });

  // Keep a session visible while it's upcoming AND for ~90 min after it starts,
  // so a client joining a few minutes late still sees it.
  const upcoming = (sessions ?? []).filter(
    (s) => new Date(s.scheduled_at).getTime() + 90 * 60_000 >= Date.now(),
  );

  async function joinSession(s: LiveSession) {
    const url = s.meeting_url || defaultMeetingUrl || null;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
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
  const planType = sub?.plan?.type?.toLowerCase() ?? "";
  const isMorningsOnly = planType === "mornings" || planName?.toLowerCase().includes("10 minute mornings") === true;
  const showFullPortal = !!sub?.plan && !isMorningsOnly;

  if (!userId || isSubLoading) {
    return (
      <>
        <PageHeader title="Welcome back" subtitle="Making you Stronger, more Flexible, and more Pain Free" />
        <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-8 md:p-12 text-center mb-10">
          <div className="text-sm text-muted-foreground">Loading your portal…</div>
        </section>
      </>
    );
  }

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

      {showFullPortal && (
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
                      disabled={!(s.meeting_url || defaultMeetingUrl)}
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

      {showFullPortal && (
        <VideoSection
          heading="Warm-Up & Exercise Library"
          intro="One library, organized by exercise. Pick the warm-up that matches what we're working on."
          videos={library}
          completedIds={completedVideoIds}
          onOpen={setOpenVideo}
        />
      )}

      {showFullPortal && (
        <VideoSection
          heading="Cool Down"
          intro="Wind down after your session. Pick a cool down to stretch and recover."
          videos={cooldowns}
          completedIds={completedVideoIds}
          onOpen={setOpenVideo}
        />
      )}

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

        {morningsRegular.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No videos yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {morningsRegular.map((v) => {
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

      {extras.length > 0 && (
        <VideoSection
          heading="Extras"
          intro="Short bonus videos to mix into your week whenever you'd like."
          videos={extras}
          completedIds={completedVideoIds}
          onOpen={setOpenVideo}
        />
      )}

      <section className="mb-12">
        <h3 className="font-display text-2xl text-foreground">Tutorials</h3>
        <p className="mt-1 text-sm text-muted-foreground mb-5 max-w-3xl">
          Reference videos for form and technique.
        </p>

        {morningsTutorials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No tutorials yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {morningsTutorials.map((v) => {
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
