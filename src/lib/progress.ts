// Shared progress + badge helpers.
export type ProgressEvent = { date: Date; kind: "live" | "mornings" };

export type ProgressStats = {
  total: number;
  liveTotal: number;
  morningsTotal: number;
  thisMonth: number;
  consistencyPct: number; // last 30d attendance rate
  streakWeeks: number;
  weekly: { weekStart: Date; live: number; mornings: number }[];
};

function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day + 6) % 7; // Mon
  x.setDate(x.getDate() - diff);
  return x;
}

export function computeStats(events: ProgressEvent[], opts: { weeklyGoal: number }): ProgressStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now); last30.setDate(now.getDate() - 30);

  const liveTotal = events.filter((e) => e.kind === "live").length;
  const morningsTotal = events.filter((e) => e.kind === "mornings").length;
  const total = events.length;
  const thisMonth = events.filter((e) => e.date >= monthStart).length;

  // Consistency: sessions in last 30d / target (goal/week * ~4.3)
  const last30Count = events.filter((e) => e.date >= last30).length;
  const target = Math.max(1, Math.round(opts.weeklyGoal * 4.285));
  const consistencyPct = Math.min(100, Math.round((last30Count / target) * 100));

  // Weekly buckets for last 8 weeks
  const weekly: ProgressStats["weekly"] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = startOfWeek(now);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws); we.setDate(ws.getDate() + 7);
    const inWeek = events.filter((e) => e.date >= ws && e.date < we);
    weekly.push({
      weekStart: ws,
      live: inWeek.filter((e) => e.kind === "live").length,
      mornings: inWeek.filter((e) => e.kind === "mornings").length,
    });
  }

  // Streak: consecutive weeks ending this week with at least one event
  let streakWeeks = 0;
  for (let i = 0; ; i++) {
    const ws = startOfWeek(now); ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws); we.setDate(ws.getDate() + 7);
    const has = events.some((e) => e.date >= ws && e.date < we);
    if (has) streakWeeks++; else break;
    if (i > 520) break; // safety
  }

  return { total, liveTotal, morningsTotal, thisMonth, consistencyPct, streakWeeks, weekly };
}

export type Badge = {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  progressLabel?: string;
};

export function computeBadges(stats: ProgressStats, memberSince: Date | null): Badge[] {
  const sessionThresholds = [1, 10, 25, 50, 100];
  const sessionBadges = sessionThresholds.map((n) => ({
    id: `sessions_${n}`,
    label: n === 1 ? "First session" : `${n} sessions`,
    description: n === 1 ? "Completed your first session" : `${n} sessions completed`,
    unlocked: stats.total >= n,
    progressLabel: stats.total >= n ? undefined : `${stats.total} / ${n}`,
  }));

  const streakBadges = [4, 8].map((w) => ({
    id: `streak_${w}`,
    label: `${w}-week streak`,
    description: `${w} consecutive weeks active`,
    unlocked: stats.streakWeeks >= w,
    progressLabel: stats.streakWeeks >= w ? undefined : `${stats.streakWeeks} / ${w} weeks`,
  }));

  const now = new Date();
  const monthsAsMember = memberSince
    ? (now.getFullYear() - memberSince.getFullYear()) * 12 + (now.getMonth() - memberSince.getMonth())
    : 0;

  const tenureBadges: Badge[] = [
    {
      id: "member_6mo",
      label: "6 months strong",
      description: "Member for 6 months",
      unlocked: monthsAsMember >= 6,
      progressLabel: monthsAsMember >= 6 ? undefined : `${monthsAsMember} / 6 mo`,
    },
    {
      id: "member_1yr",
      label: "1 year",
      description: "Member for a full year",
      unlocked: monthsAsMember >= 12,
      progressLabel: monthsAsMember >= 12 ? undefined : `${monthsAsMember} / 12 mo`,
    },
  ];

  return [...sessionBadges, ...streakBadges, ...tenureBadges];
}
