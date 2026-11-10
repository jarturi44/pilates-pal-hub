ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS duration_label text;
GRANT SELECT (duration_label) ON public.videos TO authenticated;
GRANT ALL (duration_label) ON public.videos TO service_role;