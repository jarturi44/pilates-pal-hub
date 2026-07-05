import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { enqueueTemplateEmail, notifyUser } from '@/lib/email/enqueue.server';
import { verifyCronSecret } from '@/lib/cron-auth.server';

// Studio local timezone. Sessions' day_of_week + time are interpreted in this
// zone. Jon's studio is Central (Wisconsin).
const STUDIO_TZ = 'America/Chicago';
// Notify a client when their session starts within this many minutes.
const LEAD_MINUTES = 60;

const TYPE_LABEL: Record<string, string> = {
  small_group: 'Small Group',
  one_on_one: 'One-On-One',
  combo: 'Combo',
};

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function formatTime(t: string) {
  // t = "HH:MM:SS"
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${period}`;
}

/** Current wall-clock in the studio timezone: day-of-week, minutes-of-day, YYYY-MM-DD. */
function studioNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDIO_TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dow = WD[get('weekday')] ?? 0;
  const hour = parseInt(get('hour'), 10) % 24; // guard against '24' at midnight
  const minute = parseInt(get('minute'), 10);
  return { dow, minutesOfDay: hour * 60 + minute, date: `${get('year')}-${get('month')}-${get('day')}` };
}

export const Route = createFileRoute('/api/public/hooks/send-session-starting-soon')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = verifyCronSecret(request);
        if (unauth) return unauth;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server config error' }, { status: 500 });
        }
        const supabase: any = createClient(supabaseUrl, serviceKey);

        const { dow, minutesOfDay, date } = studioNow();

        // Slots happening today (studio-local day) that start within the lead window.
        const { data: slots } = await supabase
          .from('slots').select('id, day_of_week, time, session_type').eq('day_of_week', dow);
        if (!slots || slots.length === 0) return Response.json({ sent: 0, reason: 'no_slots_today' });

        const soonSlots = (slots as any[]).filter((s) => {
          const [hh, mm] = String(s.time ?? '0:0').split(':');
          const slotMin = (parseInt(hh, 10) || 0) * 60 + (parseInt(mm, 10) || 0);
          const until = slotMin - minutesOfDay;
          return until >= 0 && until <= LEAD_MINUTES;
        });
        if (soonSlots.length === 0) return Response.json({ sent: 0, reason: 'no_slots_soon' });

        const slotIds = soonSlots.map((s) => s.id);
        const { data: assignments } = await supabase
          .from('client_slots').select('user_id, slot_id').in('slot_id', slotIds);
        if (!assignments || assignments.length === 0) return Response.json({ sent: 0, reason: 'no_assignments' });

        const userIds = Array.from(new Set(assignments.map((a: any) => a.user_id)));

        const { data: subs } = await supabase
          .from('subscriptions').select('user_id, status, access_suspended').in('user_id', userIds);
        const eligible = new Set(
          (subs ?? []).filter((s: any) =>
            ['active', 'trialing'].includes(s.status) && !s.access_suspended,
          ).map((s: any) => s.user_id),
        );

        const { data: users } = await supabase
          .from('users').select('id, email, name').in('id', userIds);
        const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));
        const slotMap = new Map(soonSlots.map((s) => [s.id, s]));

        let sent = 0;
        let skipped = 0;
        for (const a of assignments) {
          if (!eligible.has(a.user_id)) { skipped++; continue; }
          const u: any = userMap.get(a.user_id);
          const slot: any = slotMap.get(a.slot_id);
          if (!u?.email || !slot) { skipped++; continue; }

          // Dedupe so each session's "starting soon" fires only once per day.
          const idempotencyKey = `session-soon-${a.user_id}-${a.slot_id}-${date}`;
          const { data: dup } = await supabase
            .from('notification_dedupe').select('id').eq('dedupe_key', idempotencyKey).maybeSingle();
          if (dup) { skipped++; continue; }

          const time = formatTime(slot.time);
          const sessionType = TYPE_LABEL[slot.session_type] ?? slot.session_type;

          await notifyUser(supabase, {
            userId: a.user_id,
            type: 'session_reminder',
            title: 'Session starting soon',
            message: `Today at ${time} — ${sessionType}`,
            link: '/portal',
          });

          await enqueueTemplateEmail(supabase, {
            templateName: 'session-starting-soon',
            recipientEmail: u.email,
            templateData: { name: u.name ?? undefined, time, sessionType },
            idempotencyKey,
          });

          await supabase.from('notification_dedupe').insert({
            user_id: a.user_id, dedupe_key: idempotencyKey,
          });
          sent++;
        }

        return Response.json({ sent, skipped, studio_date: date, lead_minutes: LEAD_MINUTES });
      },
    },
  },
});
