// One-off hook: sends the "late video" notice to active small-group and
// 10MM members. Protected by the shared cron secret like the other hooks.
import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { enqueueTemplateEmail } from '@/lib/email/enqueue.server';
import { verifyCronSecret } from '@/lib/cron-auth.server';

const ACTIVE_SUB_STATUSES = ['active', 'trialing'];

export const Route = createFileRoute('/api/public/hooks/send-late-video-notice')({
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

        const sendDate = new Date().toISOString().slice(0, 10);

        // Build one deduped recipient list: active subscribers + managed 10MM list
        const recipients: { email: string; name?: string }[] = [];
        const seen = new Set<string>();
        const add = (email: string | null | undefined, name?: string | null) => {
          const e = (email ?? '').toLowerCase().trim();
          if (!e || seen.has(e)) return;
          seen.add(e);
          recipients.push({ email: e, name: name ?? undefined });
        };

        const { data: subs } = await supabase
          .from('subscriptions').select('user_id, status').in('status', ACTIVE_SUB_STATUSES);
        const userIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id)));
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users').select('id, email, name').in('id', userIds);
          for (const u of users ?? []) add(u.email, u.name);
        }

        const { data: mrRows } = await supabase
          .from('mornings_recipients').select('email, name').eq('active', true);
        for (const r of mrRows ?? []) add(r.email, r.name);

        let sent = 0;
        const results: any[] = [];
        for (const r of recipients) {
          const res = await enqueueTemplateEmail(supabase, {
            templateName: 'late-video-notice',
            recipientEmail: r.email,
            templateData: { name: r.name },
            idempotencyKey: `late-video-notice-${sendDate}-${r.email}`,
          });
          if (res.ok) sent++;
          results.push({ email: r.email, ...res });
        }

        return Response.json({
          sent,
          skipped: recipients.length - sent,
          total_candidates: recipients.length,
          results,
        });
      },
    },
  },
});
