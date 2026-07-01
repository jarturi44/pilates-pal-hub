// Server-only helper to render a template and enqueue it via the pgmq pipeline.
// Intended for cron jobs and webhooks that run with the service role client.
import * as React from 'react';
import { render } from '@react-email/components';
import { TEMPLATES } from '@/lib/email-templates/registry';

const SITE_NAME = 'Pilates with Jon';
const SENDER_DOMAIN = 'mail.pilateswithjon.com';
const FROM_DOMAIN = 'mail.pilateswithjon.com';

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function enqueueTemplateEmail(
  supabase: any,
  args: {
    templateName: string;
    recipientEmail: string;
    templateData?: Record<string, any>;
    idempotencyKey: string;
  },
): Promise<{ ok: boolean; reason?: string; error?: string }> {
  const tpl = TEMPLATES[args.templateName];
  if (!tpl) return { ok: false, reason: 'unknown_template' };
  const recipient = args.recipientEmail.toLowerCase();

  const { data: suppressed } = await supabase
    .from('suppressed_emails').select('id').eq('email', recipient).maybeSingle();
  if (suppressed) return { ok: false, reason: 'suppressed' };

  // Get or create unsubscribe token
  let token: string;
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', recipient).maybeSingle();
  if (existing && !existing.used_at) {
    token = existing.token;
  } else if (!existing) {
    token = generateToken();
    await supabase.from('email_unsubscribe_tokens')
      .upsert({ token, email: recipient }, { onConflict: 'email', ignoreDuplicates: true });
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens').select('token').eq('email', recipient).maybeSingle();
    token = stored?.token ?? token;
  } else {
    return { ok: false, reason: 'previously_unsubscribed' };
  }

  const messageId = crypto.randomUUID();
  const element = React.createElement(tpl.component, args.templateData ?? {});
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof tpl.subject === 'function' ? tpl.subject(args.templateData ?? {}) : tpl.subject;

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: args.templateName,
    recipient_email: recipient,
    status: 'pending',
  });

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: args.templateName,
      idempotency_key: args.idempotencyKey,
      unsubscribe_token: token,
      queued_at: new Date().toISOString(),
    },
  });
  if (error) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function notifyUser(
  supabase: any,
  args: { userId: string; type: string; title: string; message: string; link?: string },
) {
  await supabase.from('notifications').insert({
    user_id: args.userId,
    type: args.type,
    title: args.title,
    message: args.message,
    link: args.link ?? null,
  });
}
