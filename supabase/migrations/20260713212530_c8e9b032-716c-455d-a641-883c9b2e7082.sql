ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_category_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_category_check
  CHECK (category = ANY (ARRAY['warmup'::text, '10_min_morning'::text, '10_min_morning_extra'::text, 'cool_down'::text]));