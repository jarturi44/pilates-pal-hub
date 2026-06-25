// Daily billing housekeeping:
// - auto-suspend past_due subs whose grace window (7 days) has elapsed
// - send commitment-ending reminders at 30 days and 7 days out
import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { enqueueTemplateEmail, notifyUser } from '@/lib/email/enqueue.server';

const GRACE_DAYS = 7;
const APP_BASE_URL = 'https://pilateswithjon.com';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export const Route = createFileRoute('/api/public/hooks/billing-jobs')({
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

        const now = new Date();
        const cutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

        // 1) Auto-suspend past_due past grace
        const { data: toSuspend } = await supabase
          .from('subscriptions')
          .select('id, user_id, past_due_since')
          .eq('status', 'past_due')
          .eq('access_suspended', false)
          .lte('past_due_since', cutoff);

        let suspended = 0;
        for (const s of toSuspend ?? []) {
          await supabase.from('subscriptions').update({ access_suspended: true }).eq('id', s.id);
          const { data: u } = await supabase.from('users').select('email, name').eq('id', s.user_id).maybeSingle();
          await notifyUser(supabase, {
            userId: s.user_id,
            type: 'access_suspended',
            title: 'Access paused — please update payment',
            message: 'Your subscription has been paused after 7 days past due. Update your payment to restore access.',
            link: '/settings',
          });
          if (u?.email) {
            await enqueueTemplateEmail(supabase, {
              templateName: 'payment-failed',
              recipientEmail: u.email,
              templateData: { name: u.name ?? undefined, suspended: true },
              idempotencyKey: `suspend-${s.id}`,
            });
          }
          suspended++;
        }

        // 2) Commitment-ending reminders (30 days and 7 days out)
        const windows = [30, 7];
        let commitmentReminders = 0;
        for (const days of windows) {
          const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          const dayStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())).toISOString();
          const dayEnd = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() + 1)).toISOString();

          const { data: subs } = await supabase
            .from('subscriptions')
            .select('id, user_id, commitment_end_date, status')
            .in('status', ['active', 'trialing'])
            .gte('commitment_end_date', dayStart)
            .lt('commitment_end_date', dayEnd);

          for (const s of subs ?? []) {
            const dedupeKey = `commitment-ending-${s.id}-${days}d`;
            const { data: dup } = await supabase
              .from('notification_dedupe').select('id').eq('dedupe_key', dedupeKey).maybeSingle();
            if (dup) continue;

            const { data: u } = await supabase.from('users').select('email, name').eq('id', s.user_id).maybeSingle();
            const endStr = s.commitment_end_date ? fmtDate(s.commitment_end_date) : '';
            await notifyUser(supabase, {
              userId: s.user_id,
              type: 'commitment_ending',
              title: `Your commitment ends in ${days} days`,
              message: `Your initial 3-month commitment ends ${endStr}. After that, your subscription continues month-to-month.`,
              link: '/settings',
            });
            if (u?.email) {
              await enqueueTemplateEmail(supabase, {
                templateName: 'commitment-ending',
                recipientEmail: u.email,
                templateData: { name: u.name ?? undefined, commitmentEnd: endStr },
                idempotencyKey: dedupeKey,
              });
            }
            await supabase.from('notification_dedupe').insert({ user_id: s.user_id, dedupe_key: dedupeKey });
            commitmentReminders++;
          }
        }

        return Response.json({ suspended, commitment_reminders: commitmentReminders, app: APP_BASE_URL });
      },
    },
  },
});
