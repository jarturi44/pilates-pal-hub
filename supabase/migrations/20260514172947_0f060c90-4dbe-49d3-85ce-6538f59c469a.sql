
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS commitment_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_uniq
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.equipment_fulfillment
  ADD CONSTRAINT equipment_fulfillment_user_unique UNIQUE (user_id);

-- Seed plans
INSERT INTO public.plans (type, display_name, sessions_per_week, price_per_month, stripe_price_id, includes_mornings) VALUES
  ('mornings',     '10 Minute Mornings',          NULL, 80,  'price_1TX0rcGcIsRXsqWIKtMQNPs2', true),
  ('semi_private', 'Semi-Private 1x',             1,    120, 'price_1TX0vIGcIsRXsqWIvryye2UU', true),
  ('semi_private', 'Semi-Private 2x',             2,    240, 'price_1TX10FGcIsRXsqWINWjUe7Qa', true),
  ('semi_private', 'Semi-Private 3x',             3,    360, 'price_1TX15kGcIsRXsqWIShMQDzkm', true),
  ('private',      'Private 1x',                  1,    240, 'price_1TX1AjGcIsRXsqWI7pU3DVQ3', true),
  ('private',      'Private 2x',                  2,    480, 'price_1TX1BeGcIsRXsqWIIZOem1VI', true),
  ('private',      'Private 3x',                  3,    720, 'price_1TX1CeGcIsRXsqWI1Fqs9bDt', true),
  ('combo',        'Combo 1: 1 Semi + 1 Private', 2,    360, 'price_1TX1KSGcIsRXsqWI6sqCiPlv', true),
  ('combo',        'Combo 2: 1 Private + 2 Semi', 3,    480, 'price_1TX1NDGcIsRXsqWI5XekzZNt', true),
  ('combo',        'Combo 3: 2 Private + 1 Semi', 3,    600, 'price_1TX1OtGcIsRXsqWIQzQjPQ17', true)
ON CONFLICT DO NOTHING;
