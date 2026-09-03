import * as React from 'react';
import { render } from '@react-email/components';
import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { TEMPLATES } from '@/lib/email-templates/registry';
import { verifyCronSecret } from '@/lib/cron-auth.server';

const SITE_NAME = 'Pilates with Jon';
const SENDER_DOMAIN = 'mail.pilateswithjon.com';
const FROM_DOMAIN = 'mail.pilateswithjon.com';
const APP_BASE_URL = 'https://pilateswithjon.com';
const ADMIN_EMAIL = 'jon.arturi@gmail.com';

const ACTIVE_SUB_STATUSES = ['active', 'trialing'];

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Recipient = {
  email: string;
  name?: string;
  userId?: string;
  /** stable message id; when absent a uuid is generated */
  messageId?: string;
  subjectPrefix?: string;
  label: string;
  idempotencyKey: string;
};

export const Route = createFileRoute('/api/public/hooks/send-mornings-reminders')({
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

        // 1. Check today is a configured reminder day
        const { data: settings } = await supabase
          .from('reminder_settings').select('reminder_days').eq('id', 1).maybeSingle();
        const days: number[] = settings?.reminder_days ?? [2, 4];
        const today = new Date();
        const dow = today.getUTCDay();
        const force = new URL(request.url).searchParams.get('force') === '1';
        if (!days.includes(dow) && !force) {
          return Response.json({ skipped: true, reason: 'not_a_reminder_day', dow });
        }
        const sendDate = today.toISOString().slice(0, 10);

        const template = TEMPLATES['mornings-reminder'];

        // ---- Build one deduped recipient list -------------------------------
        const recipients: Recipient[] = [];
        const seen = new Set<string>();
        const add = (r: Recipient) => {
          const email = r.email.toLowerCase();
          if (!email || seen.has(email)) return;
          seen.add(email);
          recipients.push({ ...r, email });
        };

        // Active subscribers
        const { data: subs } = await supabase
          .from('subscriptions').select('user_id, status').in('status', ACTIVE_SUB_STATUSES);
        const userIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id)));
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users').select('id, email, name').in('id', userIds);
          for (const u of users ?? []) {
            if (!u.email) continue;
            add({
              email: u.email,
              name: u.name ?? undefined,
              userId: u.id,
              label: 'mornings-reminder',
              idempotencyKey: `mornings-${u.id}-${sendDate}`,
            });
          }
        }

        // Managed recipient list (legacy / manually-billed 10MM clients)
        const { data: mrRows } = await supabase
          .from('mornings_recipients').select('email, name').eq('active', true);
        for (const r of mrRows ?? []) {
          if (!r.email) continue;
          add({
            email: r.email,
            name: r.name ?? undefined,
            messageId: `mornings-extra-${String(r.email).toLowerCase()}-${sendDate}`,
            label: 'mornings-reminder-extra',
            idempotencyKey: `mornings-extra-${String(r.email).toLowerCase()}-${sendDate}`,
          });
        }

        // Admin monitoring copy — queued FIRST below so it never gets lost.
        const adminRecipient: Recipient = {
          email: ADMIN_EMAIL,
          name: 'Jon',
          messageId: `mornings-admin-copy-${sendDate}`,
          subjectPrefix: '[Copy] ',
          label: 'mornings-reminder-admin-copy',
          idempotencyKey: `mornings-admin-copy-${sendDate}`,
        };
        const adminAlreadyQueued = seen.has(ADMIN_EMAIL);
        const queue = adminAlreadyQueued ? recipients : [adminRecipient, ...recipients];

        // ---- Render once per unique name (rendering is the expensive part) --
        const baseSubject = typeof template.subject === 'function' ? template.subject({}) : template.subject;
        const renderCache = new Map<string, { html: string; text: string }>();
        const renderFor = async (name?: string) => {
          const key = name ?? '';
          const cached = renderCache.get(key);
          if (cached) return cached;
          const el = React.createElement(template.component, { name, appUrl: `${APP_BASE_URL}/portal` });
          const out = { html: await render(el), text: await render(el, { plainText: true }) };
          renderCache.set(key, out);
          return out;
        };

        let sent = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const r of queue) {
          try {
            // Already handled today?
            if (r.userId) {
              const { data: already } = await supabase
                .from('reminder_send_log').select('id')
                .eq('user_id', r.userId).eq('send_date', sendDate).maybeSingle();
              if (already) { skipped++; continue; }
            } else if (r.messageId) {
              const { data: already } = await supabase
                .from('email_send_log').select('id').eq('message_id', r.messageId).maybeSingle();
              if (already) { skipped++; continue; }
            }

            // Suppression
            const { data: suppressed } = await supabase
              .from('suppressed_emails').select('id').eq('email', r.email).maybeSingle();
            if (suppressed) { skipped++; continue; }

            // Unsubscribe token
            let unsubscribeToken: string | undefined;
            const { data: existing } = await supabase
              .from('email_unsubscribe_tokens').select('token, used_at').eq('email', r.email).maybeSingle();
            if (existing && !existing.used_at) {
              unsubscribeToken = existing.token;
            } else if (!existing) {
              unsubscribeToken = generateToken();
              await supabase.from('email_unsubscribe_tokens')
                .upsert({ token: unsubscribeToken, email: r.email }, { onConflict: 'email', ignoreDuplicates: true });
              const { data: stored } = await supabase
                .from('email_unsubscribe_tokens').select('token').eq('email', r.email).maybeSingle();
              unsubscribeToken = stored?.token ?? unsubscribeToken;
            } else {
              skipped++;
              continue;
            }

            const { html, text } = await renderFor(r.name);
            const messageId = r.messageId ?? crypto.randomUUID();

            const { error: enqErr } = await supabase.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: messageId,
                to: r.email,
                from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject: `${r.subjectPrefix ?? ''}${baseSubject}`,
                html,
                text,
                purpose: 'transactional',
                label: r.label,
                idempotency_key: r.idempotencyKey,
                unsubscribe_token: unsubscribeToken,
                queued_at: new Date().toISOString(),
              },
            });

            // Log after enqueue so a crash can't leave a phantom "pending" row.
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'mornings-reminder',
              recipient_email: r.email,
              status: enqErr ? 'failed' : 'pending',
              error_message: enqErr?.message ?? null,
            });

            if (enqErr) { errors.push(`${r.email}: ${enqErr.message}`); continue; }

            if (r.userId) {
              await supabase.from('reminder_send_log').insert({ user_id: r.userId, send_date: sendDate });
            }
            sent++;
          } catch (err: any) {
            skipped++;
            errors.push(`${r.email}: ${err?.message ?? 'unknown error'}`);
          }
        }

        return Response.json({
          sent,
          skipped,
          total_candidates: queue.length,
          send_date: sendDate,
          errors,
        });
      },
    },
  },
});
