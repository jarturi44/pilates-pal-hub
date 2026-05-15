
-- Studio-wide settings (single row, id=1)
CREATE TABLE IF NOT EXISTS public.studio_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  studio_name TEXT NOT NULL DEFAULT 'Studio',
  admin_email TEXT,
  grace_period_days INTEGER NOT NULL DEFAULT 3 CHECK (grace_period_days BETWEEN 1 AND 7),
  commitment_months INTEGER NOT NULL DEFAULT 3 CHECK (commitment_months BETWEEN 1 AND 24),
  current_waiver_version_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.studio_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ss_admin_all ON public.studio_settings FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY ss_select_authed ON public.studio_settings FOR SELECT TO authenticated USING (true);

-- Waiver versions (immutable snapshots)
CREATE TABLE IF NOT EXISTS public.waiver_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS waiver_versions_version_uidx ON public.waiver_versions(version);
ALTER TABLE public.waiver_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY wv_versions_admin_all ON public.waiver_versions FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY wv_versions_select_authed ON public.waiver_versions FOR SELECT TO authenticated USING (true);

-- Add active flag to slots
ALTER TABLE public.slots ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Activity log (lightweight)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log(created_at DESC);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY al_admin_all ON public.activity_log FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY al_insert_authed ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);
