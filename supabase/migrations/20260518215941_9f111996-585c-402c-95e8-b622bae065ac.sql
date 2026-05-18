
CREATE TABLE public.warmup_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  duration_minutes INTEGER,
  difficulty TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warmup_content_admin_all" ON public.warmup_content
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "warmup_content_select_active" ON public.warmup_content
  FOR SELECT TO authenticated
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.warmup_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warmup_completions_admin_all" ON public.warmup_completions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "warmup_completions_insert_self" ON public.warmup_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "warmup_completions_select_own" ON public.warmup_completions
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_warmup_completions_user ON public.warmup_completions(user_id);
CREATE INDEX idx_warmup_completions_user_completed ON public.warmup_completions(user_id, completed_at DESC);
