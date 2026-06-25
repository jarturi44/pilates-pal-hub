
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.pending_intakes ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE public.equipment_fulfillment
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text;

ALTER TABLE public.onboarding_progress
  ADD COLUMN IF NOT EXISTS shipping_completed_at timestamptz;

-- Ensure each user can have at most one equipment_fulfillment row
CREATE UNIQUE INDEX IF NOT EXISTS equipment_fulfillment_user_id_key
  ON public.equipment_fulfillment(user_id);
