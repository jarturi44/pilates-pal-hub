GRANT INSERT ON public.waiver_completions TO anon;

DROP POLICY IF EXISTS "Anyone can record a waiver completion" ON public.waiver_completions;
CREATE POLICY "Anyone can record a waiver completion"
  ON public.waiver_completions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL);