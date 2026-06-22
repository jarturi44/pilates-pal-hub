// Stripe webhook handler.
// Verifies Stripe's signature, then keeps the `subscriptions` table in sync
// with the source of truth at Stripe (covers cases where the success-redirect
// is missed, renewals, payment failures, cancellations, etc.).
import { createClient } from '@supabase/supabase-js';
import { createFileRoute } from '@tanstack/react-router';
import { enqueueTemplateEmail, notifyUser } from '@/lib/email/enqueue.server';

type StripeSubscription = {
  id: string;
  status?: string;
  customer?: string | { id?: string } | null;
  start_date?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string> | null;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

type StripeCheckoutSession = {
  id: string;
  mode?: string;
  customer?: string | { id?: string } | null;
  customer_email?: string | null;
  metadata?: Record<string, string> | null;
  subscription?: string | StripeSubscription | null;
};

type StripeInvoice = {
  id: string;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  status?: string;
  billing_reason?: string;
};

type StripeEvent = {
  id: string;
  type: string;
  data: { object: any };
};

function asId(v: string | { id?: string } | null | undefined) {
  return typeof v === 'string' ? v : v?.id ?? null;
}

async function stripeFetch<T>(key: string, path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? 'Stripe request failed');
  return json as T;
}

/**
 * Verifies a Stripe webhook signature (scheme v1 = HMAC-SHA256 of
 * `${timestamp}.${rawBody}` keyed by the signing secret).
 */
async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, ...rest] = kv.trim().split('=');
      return [k, rest.join('=')];
    }),
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;

  const ts = Number(parts.t);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSeconds) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${parts.t}.${rawBody}`));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe compare
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  }
  return diff === 0;
}

async function upsertSubscriptionFromStripe(
  supabase: any,
  sub: StripeSubscription,
  fallbackCustomerId?: string | null,
) {
  const userId = sub.metadata?.user_id;
  const planId = sub.metadata?.plan_id;
  if (!userId || !planId) {
    console.warn('[stripe-webhook] subscription missing metadata', { id: sub.id });
    return { row: null, isNew: false };
  }
  const start = new Date((sub.start_date ?? Math.floor(Date.now() / 1000)) * 1000);
  const commitmentEnd = new Date(start);
  commitmentEnd.setMonth(commitmentEnd.getMonth() + 3);
  const periodEndSeconds = sub.current_period_end ?? Math.floor(Date.now() / 1000);

  // Track whether the row already existed so we can fire welcome email only on first insert.
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: asId(sub.customer) ?? fallbackCustomerId ?? null,
        status: sub.status ?? 'active',
        start_date: start.toISOString(),
        commitment_end_date: commitmentEnd.toISOString(),
        current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
        cancel_at_period_end: !!sub.cancel_at_period_end,
        past_due_since: sub.status === 'past_due' ? new Date().toISOString() : null,
        access_suspended: false,
      },
      { onConflict: 'stripe_subscription_id' },
    )
    .select('*, plan:plans(*)')
    .maybeSingle();
  if (error) throw error;
  return { row: data, isNew: !existing };
}

export const Route = createFileRoute('/api/public/hooks/stripe-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!secret || !stripeKey || !supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server config error' }, { status: 500 });
        }

        const rawBody = await request.text();
        const sigHeader = request.headers.get('stripe-signature');
        const ok = await verifyStripeSignature(rawBody, sigHeader, secret);
        if (!ok) return new Response('Invalid signature', { status: 401 });

        let event: StripeEvent;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response('Invalid payload', { status: 400 });
        }

        const supabase: any = createClient(supabaseUrl, serviceKey);

        // Idempotency: skip events we've already processed.
        const { error: dedupeErr } = await supabase
          .from('webhook_events')
          .insert({ provider: 'stripe', event_id: event.id });
        if (dedupeErr) {
          // Unique violation = already processed. Anything else = log and proceed.
          if ((dedupeErr as any).code === '23505') {
            return Response.json({ ok: true, duplicate: true });
          }
          console.warn('[stripe-webhook] dedupe insert error', dedupeErr);
        }

        try {
          switch (event.type) {
            case 'checkout.session.completed': {
              const session = event.data.object as StripeCheckoutSession;
              if (session.mode !== 'subscription') break;
              const subId = typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id;
              if (!subId) break;
              const sub = await stripeFetch<StripeSubscription>(stripeKey, `/subscriptions/${subId}`);
              // Stripe sometimes omits metadata on the subscription if only set on the session.
              if (!sub.metadata?.user_id && session.metadata?.user_id) {
                sub.metadata = { ...(sub.metadata ?? {}), ...session.metadata };
              }
              const { row, isNew } = await upsertSubscriptionFromStripe(
                supabase,
                sub,
                asId(session.customer),
              );
              if (isNew && row) {
                const { data: u } = await supabase
                  .from('users').select('email, name').eq('id', row.user_id).maybeSingle();
                if (u?.email) {
                  await enqueueTemplateEmail(supabase, {
                    templateName: 'subscription-confirmed',
                    recipientEmail: u.email,
                    templateData: {
                      name: u.name ?? undefined,
                      planName: row.plan?.display_name ?? undefined,
                    },
                    idempotencyKey: `sub-confirmed-${row.id}`,
                  });
                }
              }
              break;
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.created': {
              const sub = event.data.object as StripeSubscription;
              await upsertSubscriptionFromStripe(supabase, sub);
              break;
            }

            case 'customer.subscription.deleted': {
              const sub = event.data.object as StripeSubscription;
              const { data: row } = await supabase
                .from('subscriptions')
                .update({
                  status: 'canceled',
                  cancel_at_period_end: false,
                })
                .eq('stripe_subscription_id', sub.id)
                .select('id, user_id, plan:plans(display_name)')
                .maybeSingle();
              if (row) {
                const { data: u } = await supabase
                  .from('users').select('email, name').eq('id', row.user_id).maybeSingle();
                if (u?.email) {
                  await enqueueTemplateEmail(supabase, {
                    templateName: 'subscription-canceled',
                    recipientEmail: u.email,
                    templateData: {
                      name: u.name ?? undefined,
                      planName: row.plan?.display_name ?? undefined,
                    },
                    idempotencyKey: `sub-canceled-${row.id}`,
                  });
                }
              }
              break;
            }

            case 'invoice.payment_failed': {
              const inv = event.data.object as StripeInvoice;
              const subId = asId(inv.subscription);
              if (!subId) break;
              const { data: row } = await supabase
                .from('subscriptions')
                .select('id, user_id, past_due_since')
                .eq('stripe_subscription_id', subId)
                .maybeSingle();
              if (!row) break;
              const pastDueSince = row.past_due_since ?? new Date().toISOString();
              await supabase
                .from('subscriptions')
                .update({ status: 'past_due', past_due_since: pastDueSince })
                .eq('id', row.id);

              const { data: u } = await supabase
                .from('users').select('email, name').eq('id', row.user_id).maybeSingle();
              await notifyUser(supabase, {
                userId: row.user_id,
                type: 'payment_failed',
                title: 'Payment failed',
                message: 'We were unable to process your latest payment. Please update your card to avoid losing access.',
                link: '/settings',
              });
              if (u?.email) {
                await enqueueTemplateEmail(supabase, {
                  templateName: 'payment-failed',
                  recipientEmail: u.email,
                  templateData: { name: u.name ?? undefined, suspended: false },
                  idempotencyKey: `pay-failed-${inv.id}`,
                });
              }
              break;
            }

            case 'invoice.payment_succeeded': {
              const inv = event.data.object as StripeInvoice;
              const subId = asId(inv.subscription);
              if (!subId) break;
              const { data: row } = await supabase
                .from('subscriptions')
                .select('id, user_id, past_due_since, access_suspended')
                .eq('stripe_subscription_id', subId)
                .maybeSingle();
              if (!row) break;

              const wasRecovery = !!row.past_due_since || row.access_suspended;
              // Refresh from Stripe so current_period_end stays accurate.
              const sub = await stripeFetch<StripeSubscription>(stripeKey, `/subscriptions/${subId}`);
              const periodEndSeconds = sub.current_period_end ?? Math.floor(Date.now() / 1000);
              await supabase
                .from('subscriptions')
                .update({
                  status: sub.status ?? 'active',
                  current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
                  past_due_since: null,
                  access_suspended: false,
                })
                .eq('id', row.id);

              if (wasRecovery) {
                const { data: u } = await supabase
                  .from('users').select('email, name').eq('id', row.user_id).maybeSingle();
                if (u?.email) {
                  await enqueueTemplateEmail(supabase, {
                    templateName: 'payment-recovered',
                    recipientEmail: u.email,
                    templateData: { name: u.name ?? undefined },
                    idempotencyKey: `pay-recovered-${inv.id}`,
                  });
                }
              }
              break;
            }

            default:
              // Ignore other event types.
              break;
          }

          // Mark event processed (best-effort).
          await supabase.from('notification_dedupe').insert({
            dedupe_key: `stripe-evt-${event.id}`,
          });
        } catch (err: any) {
          console.error('[stripe-webhook] handler error', { type: event.type, id: event.id, error: err?.message });
          // Return 500 so Stripe retries.
          return Response.json({ error: err?.message ?? 'Handler failed' }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
