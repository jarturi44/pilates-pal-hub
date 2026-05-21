ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_onboarding_reminder_at timestamptz,
ADD COLUMN IF NOT EXISTS onboarding_reminder_count integer NOT NULL DEFAULT 0;