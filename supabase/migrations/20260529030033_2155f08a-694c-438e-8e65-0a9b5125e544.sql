-- 1. Rename enum values
ALTER TYPE public.plan_type RENAME VALUE 'private' TO 'one_on_one';
ALTER TYPE public.plan_type RENAME VALUE 'semi_private' TO 'small_group';
ALTER TYPE public.session_type RENAME VALUE 'private' TO 'one_on_one';
ALTER TYPE public.session_type RENAME VALUE 'semi_private' TO 'small_group';

-- 2. Add new fields to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS intake_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS intake_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_notes text,
  ADD COLUMN IF NOT EXISTS intake_stripe_session_id text;

-- 3. Update plan display names to match new naming
UPDATE public.plans SET display_name = REPLACE(display_name, 'Semi-Private', 'Small Group') WHERE display_name LIKE '%Semi-Private%';
UPDATE public.plans SET display_name = REPLACE(display_name, 'Private', 'One-On-One') WHERE display_name LIKE '%Private%';
UPDATE public.plans SET display_name = REPLACE(REPLACE(display_name, '1 Semi', '1 Small Group'), '2 Semi', '2 Small Group') WHERE display_name LIKE '%Semi%';

-- 4. Backfill intake fields for existing subscribed users so they don't get bounced back
UPDATE public.users u
SET intake_paid_at = COALESCE(u.intake_paid_at, now()),
    intake_completed_at = COALESCE(u.intake_completed_at, now())
WHERE EXISTS (
  SELECT 1 FROM public.subscriptions s
  WHERE s.user_id = u.id AND s.status IN ('active','trialing','past_due')
);