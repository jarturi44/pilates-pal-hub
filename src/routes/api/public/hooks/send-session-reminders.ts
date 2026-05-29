import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { enqueueTemplateEmail, notifyUser } from '@/lib/email/enqueue.server';

const APP_BASE_URL = 'https://pilateswithjon.com';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TYPE_LABEL: Record<string, string> = {
  small_group: 'Small Group',
  one_on_one: 'One-On-One',
  combo: 'Combo',
};

function formatTime(t: string) {
  // t = "HH:MM:SS"
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${period}`;
}

export const Route = createFileRoute('/api/public/hooks/send-session-reminders')({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server config error' }, { status: 500 });
        }
        const supabase: any = createClient(supabaseUrl, serviceKey);

        // Tomorrow (UTC)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(now.getUTCDate() + 1);
        const tomorrowDate = tomorrow.toISOString().slice(0, 10);
        const tomorrowDow = tomorrow.getUTCDay();

        // Slots happening tomorrow
        const { data: slots } = await supabase
          .from('slots').select('id, day_of_week, time, session_type').eq('day_of_week', tomorrowDow);
        if (!slots || slots.length === 0) {
          return Response.json({ sent: 0, reason: 'no_slots' });
        }

        const slotIds = slots.map((s: any) => s.id);
        const { data: assignments } = await supabase
          .from('client_slots').select('user_id, slot_id').in('slot_id', slotIds);
        if (!assignments || assignments.length === 0) {
          return Response.json({ sent: 0, reason: 'no_assignments' });
        }

        const userIds = Array.from(new Set(assignments.map((a: any) => a.user_id)));

        // Filter out suspended/canceled subscribers
        const { data: subs } = await supabase
          .from('subscriptions').select('user_id, status, access_suspended').in('user_id', userIds);
        const eligible = new Set(
          (subs ?? []).filter((s: any) =>
            ['active', 'trialing'].includes(s.status) && !s.access_suspended
          ).map((s: any) => s.user_id),
        );

        const { data: users } = await supabase
          .from('users').select('id, email, name').in('id', userIds);
        const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));
        const slotMap = new Map(slots.map((s: any) => [s.id, s]));

        let sent = 0;
        let skipped = 0;
        for (const a of assignments) {
          if (!eligible.has(a.user_id)) { skipped++; continue; }
          const u: any = userMap.get(a.user_id);
          const slot: any = slotMap.get(a.slot_id);
          if (!u?.email || !slot) { skipped++; continue; }

          const idempotencyKey = `session-reminder-${a.user_id}-${a.slot_id}-${tomorrowDate}`;
          // Dedupe via notification_dedupe
          const { data: dup } = await supabase
            .from('notification_dedupe').select('id').eq('dedupe_key', idempotencyKey).maybeSingle();
          if (dup) { skipped++; continue; }

          const day = DAY_NAMES[tomorrowDow];
          const time = formatTime(slot.time);
          const sessionType = TYPE_LABEL[slot.session_type] ?? slot.session_type;

          await notifyUser(supabase, {
            userId: a.user_id,
            type: 'session_reminder',
            title: 'Session tomorrow',
            message: `${day} at ${time} — ${sessionType}`,
            link: '/home',
          });

          await enqueueTemplateEmail(supabase, {
            templateName: 'session-reminder',
            recipientEmail: u.email,
            templateData: { name: u.name ?? undefined, day, time, sessionType },
            idempotencyKey,
          });

          await supabase.from('notification_dedupe').insert({
            user_id: a.user_id, dedupe_key: idempotencyKey,
          });
          sent++;
        }

        return Response.json({ sent, skipped, target_date: tomorrowDate, app: APP_BASE_URL });
      },
    },
  },
});
