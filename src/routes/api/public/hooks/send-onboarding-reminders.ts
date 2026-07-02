import * as React from 'react';
import { render } from '@react-email/components';
import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { TEMPLATES } from '@/lib/email-templates/registry';
import { verifyCronSecret } from '@/lib/cron-auth.server';

const SITE_NAME = 'Pilates with Jon';
const SENDER_DOMAIN = 'mail.pilateswithjon.com';
const FROM_DOMAIN = 'mail.pilateswithjon.com';

const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'];
const MAX_REMINDERS = 3;
const MIN_HOURS_SINCE_SIGNUP = 24;
const MIN_HOURS_BETWEEN_REMINDERS = 48;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const Route = createFileRoute('/api/public/hooks/send-onboarding-reminders')({
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

        // Find active subscribers whose onboarding isn't complete
        const { data: subs } = await supabase
          .from('subscriptions').select('user_id').in('status', ACTIVE_SUB_STATUSES);
        const userIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id)));
        if (userIds.length === 0) {
          return Response.json({ sent: 0, reason: 'no_active_subs' });
        }

        const { data: allUsers } = await supabase
          .from('users')
          .select('id, email, name, created_at, onboarding_reminder_count, last_onboarding_reminder_at')
          .in('id', userIds);

        // Nudge anyone missing a shipping address OR a signed waiver,
        // regardless of the onboarding_complete flag.
        const [{ data: shipRows }, { data: progressRows }] = await Promise.all([
          supabase.from('equipment_fulfillment').select('user_id, street').in('user_id', userIds),
          supabase.from('onboarding_progress').select('user_id, waiver_completed_at').in('user_id', userIds),
        ]);
        const hasShipping = new Set((shipRows ?? []).filter((r: any) => r.street && r.street.trim()).map((r: any) => r.user_id));
        const hasWaiver = new Set((progressRows ?? []).filter((r: any) => r.waiver_completed_at).map((r: any) => r.user_id));
        const users = (allUsers ?? []).filter((u: any) => !hasShipping.has(u.id) || !hasWaiver.has(u.id));

        const template = TEMPLATES['onboarding-reminder'];
        const now = Date.now();
        let sent = 0;
        let skipped = 0;

        for (const u of users ?? []) {
          if (!u.email) { skipped++; continue; }
          if ((u.onboarding_reminder_count ?? 0) >= MAX_REMINDERS) { skipped++; continue; }

          const signupAge = (now - new Date(u.created_at).getTime()) / 3600_000;
          if (signupAge < MIN_HOURS_SINCE_SIGNUP) { skipped++; continue; }

          if (u.last_onboarding_reminder_at) {
            const sinceLast = (now - new Date(u.last_onboarding_reminder_at).getTime()) / 3600_000;
            if (sinceLast < MIN_HOURS_BETWEEN_REMINDERS) { skipped++; continue; }
          }

          const recipient = u.email.toLowerCase();
          const { data: suppressed } = await supabase
            .from('suppressed_emails').select('id').eq('email', recipient).maybeSingle();
          if (suppressed) { skipped++; continue; }

          // Get/create unsubscribe token
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
          const element = React.createElement(template.component, { name: u.name ?? undefined });
          const html = await render(element);
          const text = await render(element, { plainText: true });

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'onboarding-reminder',
            recipient_email: recipient,
            status: 'pending',
          });

          const { error: enqErr } = await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: recipient,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: typeof template.subject === 'function' ? template.subject({}) : template.subject,
              html,
              text,
              purpose: 'transactional',
              label: 'onboarding-reminder',
              idempotency_key: `onboarding-reminder-${u.id}-${(u.onboarding_reminder_count ?? 0) + 1}`,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          });

          if (enqErr) {
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'onboarding-reminder',
              recipient_email: recipient,
              status: 'failed',
              error_message: enqErr.message,
            });
            continue;
          }

          await supabase.from('users').update({
            last_onboarding_reminder_at: new Date().toISOString(),
            onboarding_reminder_count: (u.onboarding_reminder_count ?? 0) + 1,
          }).eq('id', u.id);

          sent++;
        }

        return Response.json({ sent, skipped, total_candidates: users?.length ?? 0 });
      },
    },
  },
});
