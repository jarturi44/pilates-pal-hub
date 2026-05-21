
-- live_sessions
CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  meeting_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_sessions_user_time ON public.live_sessions(user_id, scheduled_at);
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ls_admin_all" ON public.live_sessions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ls_select_own" ON public.live_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- videos
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('warmup','10_min_morning')),
  thumbnail_url text,
  video_url text,
  duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos_admin_all" ON public.videos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "videos_select_authed" ON public.videos
  FOR SELECT TO authenticated
  USING (true);

-- client_activity
CREATE TABLE public.client_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('live_session_join','video_complete')),
  reference_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_activity_user ON public.client_activity(user_id, occurred_at DESC);
ALTER TABLE public.client_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_admin_all" ON public.client_activity
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ca_select_own" ON public.client_activity
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ca_insert_own" ON public.client_activity
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
