
ALTER TABLE public.intake_forms
  ADD COLUMN IF NOT EXISTS fitness_level text,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS days_per_week integer,
  ADD COLUMN IF NOT EXISTS referral_source text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS needs_slot_assignment boolean NOT NULL DEFAULT false;
