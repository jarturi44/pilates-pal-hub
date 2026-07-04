GRANT INSERT ON public.waiver_completions TO anon;
GRANT INSERT, SELECT ON public.waiver_completions TO authenticated;
GRANT ALL ON public.waiver_completions TO service_role;

CREATE POLICY "Anyone can record a waiver completion"
  ON public.waiver_completions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL);