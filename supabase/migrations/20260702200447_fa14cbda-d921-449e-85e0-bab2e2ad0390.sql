
CREATE TABLE public.waiver_completions (
  email text PRIMARY KEY,
  completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.waiver_completions TO authenticated;
GRANT ALL ON public.waiver_completions TO service_role;
ALTER TABLE public.waiver_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own waiver completion"
  ON public.waiver_completions FOR SELECT
  TO authenticated
  USING (lower(email) = lower((auth.jwt() ->> 'email')));
CREATE POLICY "Admins can read all waiver completions"
  ON public.waiver_completions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
