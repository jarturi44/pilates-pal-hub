
-- Exercises
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  category TEXT,
  difficulty TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY ex_admin_all ON public.exercises FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY ex_select_active ON public.exercises FOR SELECT TO authenticated USING (active = true OR has_role(auth.uid(),'admin'));

-- Programs
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_admin_all ON public.programs FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY pr_select_active ON public.programs FOR SELECT TO authenticated USING (active = true OR has_role(auth.uid(),'admin'));

-- Program exercises (ordered list)
CREATE TABLE public.program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  position INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_program_exercises_program ON public.program_exercises(program_id, position);
ALTER TABLE public.program_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY pe_admin_all ON public.program_exercises FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY pe_select_authed ON public.program_exercises FOR SELECT TO authenticated USING (true);

-- Program assignments (one active per user)
CREATE TABLE public.program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX idx_program_assignments_one_active
  ON public.program_assignments(user_id) WHERE active = true;
CREATE INDEX idx_program_assignments_user ON public.program_assignments(user_id);
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pa_admin_all ON public.program_assignments FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY pa_select ON public.program_assignments FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- Program completions
CREATE TABLE public.program_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_program_completions_user ON public.program_completions(user_id, completed_at DESC);
ALTER TABLE public.program_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_admin_all ON public.program_completions FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY pc_select ON public.program_completions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY pc_insert_self ON public.program_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Per-exercise completion log (to mark single exercises in a session)
CREATE TABLE public.exercise_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exercise_completions_user ON public.exercise_completions(user_id, completed_at DESC);
ALTER TABLE public.exercise_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ec_admin_all ON public.exercise_completions FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY ec_select ON public.exercise_completions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY ec_insert_self ON public.exercise_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
