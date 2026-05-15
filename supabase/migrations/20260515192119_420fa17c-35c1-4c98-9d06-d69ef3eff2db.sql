
-- Extend content table for library
ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Constrain difficulty values
ALTER TABLE public.content DROP CONSTRAINT IF EXISTS content_difficulty_check;
ALTER TABLE public.content ADD CONSTRAINT content_difficulty_check
  CHECK (difficulty IS NULL OR difficulty IN ('beginner','intermediate','advanced'));

-- Constrain category values
ALTER TABLE public.content DROP CONSTRAINT IF EXISTS content_category_check;
ALTER TABLE public.content ADD CONSTRAINT content_category_check
  CHECK (category IS NULL OR category IN ('Mat Work','Stretching','Foam Roller','Resistance Bands','Ring Work','Strap Work'));

CREATE INDEX IF NOT EXISTS content_category_sort_idx ON public.content (category, sort_order);

-- Reminder settings (single row)
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id integer PRIMARY KEY DEFAULT 1,
  reminder_days smallint[] NOT NULL DEFAULT ARRAY[1,4]::smallint[], -- 0=Sun..6=Sat; 1=Mon, 4=Thu
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reminder_settings_singleton CHECK (id = 1)
);

INSERT INTO public.reminder_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rs_select_authed ON public.reminder_settings;
CREATE POLICY rs_select_authed ON public.reminder_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rs_admin_write ON public.reminder_settings;
CREATE POLICY rs_admin_write ON public.reminder_settings
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Track sent reminders to avoid duplicates per day
CREATE TABLE IF NOT EXISTS public.reminder_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  send_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, send_date)
);

ALTER TABLE public.reminder_send_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rsl_admin ON public.reminder_send_log;
CREATE POLICY rsl_admin ON public.reminder_send_log
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
