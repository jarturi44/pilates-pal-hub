CREATE OR REPLACE FUNCTION public.record_waiver_completion(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.waiver_completions (email)
  VALUES (lower(trim(p_email)))
  ON CONFLICT (email) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.record_waiver_completion(text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_waiver_completion(text) TO anon, authenticated;