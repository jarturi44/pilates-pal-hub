import * as React from 'react';
import { render } from '@react-email/components';
import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { TEMPLATES } from '@/lib/email-templates/registry';
import { verifyCronSecret } from '@/lib/cron-auth.server';

const SITE_NAME = 'Pilates with Jon';
const SENDER_DOMAIN = 'notify.pilateswithjon.com';
const FROM_DOMAIN = 'notify.pilateswithjon.com';
const APP_BASE_URL = 'https://pilateswithjon.com';
const IDEMPOTENCY_TAG = 'portal-launch-2026-07-01';
const ACTIVE_SUB_STATUSES = ['active', 'trialing'];

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const Route = createFileRoute('/api/public/hooks/send-portal-launch')({
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

        // Active subscribers with mornings access
        const { data: subs } = await supabase
          .from('subscriptions').select('user_id, status').in('status', ACTIVE_SUB_STATUSES);
        const userIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id)));
        if (userIds.length === 0) {
          return Response.json({ sent: 0, reason: 'no_active_subs' });
        }

        const { data: users } = await supabase
          .from('users').select('id, email, name').in('id', userIds);

        const template = TEMPLATES['portal-launch'];
        let sent = 0;
        let skipped = 0;

        for (const u of users ?? []) {
          if (!u.email) continue;
          const recipient = u.email.toLowerCase();
          const idempotencyKey = `${IDEMPOTENCY_TAG}-${u.id}`;

          // Skip if already sent (idempotency via email_send_log)
          const { data: already } = await supabase
            .from('email_send_log').select('id')
            .eq('template_name', 'portal-launch')
            .eq('recipient_email', u.email)
            .in('status', ['pending', 'sent'])
            .maybeSingle();
          if (already) { skipped++; continue; }

          const { data: suppressed } = await supabase
            .from('suppressed_emails').select('id').eq('email', recipient).maybeSingle();
          if (suppressed) { skipped++; continue; }

          let unsubscribeToken: string;
          const { data: existing } = await supabase
            .from('email_unsubscribe_tokens').select('token, used_at').eq('email', recipient).maybeSingle();
          if (existing && !existing.used_at) {
            unsubscribeToken = existing.token;
          } else if (!existing) {
            unsubscribeToken = generateToken();
            await supabase.from('email_unsubscribe_tokens')
              .upsert({ token: unsubscribeToken, email: recipient }, { onConflict: 'email', ignoreDuplicates: true });
            const { data: stored } = await supabase
              .from('email_unsubscribe_tokens').select('token').eq('email', recipient).maybeSingle();
            unsubscribeToken = stored?.token ?? unsubscribeToken;
          } else {
            skipped++;
            continue;
          }

          const messageId = crypto.randomUUID();
          const element = React.createElement(template.component, {
            name: u.name ?? undefined,
            appUrl: `${APP_BASE_URL}/my-program`,
          });
          const html = await render(element);
          const text = await render(element, { plainText: true });

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'portal-launch',
            recipient_email: u.email,
            status: 'pending',
          });

          const { error: enqErr } = await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: u.email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: typeof template.subject === 'function' ? template.subject({}) : template.subject,
              html,
              text,
              purpose: 'transactional',
              label: 'portal-launch',
              idempotency_key: idempotencyKey,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          });

          if (enqErr) {
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'portal-launch',
              recipient_email: u.email,
              status: 'failed',
              error_message: enqErr.message,
            });
            continue;
          }
          sent++;
        }

        // Send an admin copy to Jon for monitoring (once per run)
        try {
          const adminEmail = 'jon.arturi@gmail.com';
          const adminMessageId = `${IDEMPOTENCY_TAG}-admin-copy`;
          const { data: alreadyCopy } = await supabase
            .from('email_send_log').select('id')
            .eq('message_id', adminMessageId).maybeSingle();
          if (!alreadyCopy) {
            const adminEl = React.createElement(template.component, {
              name: 'Jon',
              appUrl: `${APP_BASE_URL}/my-program`,
            });
            const adminHtml = await render(adminEl);
            const adminText = await render(adminEl, { plainText: true });
            const baseSubject = typeof template.subject === 'function' ? template.subject({}) : template.subject;
            await supabase.from('email_send_log').insert({
              message_id: adminMessageId,
              template_name: 'portal-launch',
              recipient_email: adminEmail,
              status: 'pending',
            });
            await supabase.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: adminMessageId,
                to: adminEmail,
                from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject: `[Copy] ${baseSubject}`,
                html: adminHtml,
                text: adminText,
                purpose: 'transactional',
                label: 'portal-launch-admin-copy',
                idempotency_key: adminMessageId,
                queued_at: new Date().toISOString(),
              },
            });
          }
        } catch (e) {
          // non-fatal
        }

        return Response.json({ sent, skipped, total_candidates: users?.length ?? 0 });


      },
    },
  },
});
