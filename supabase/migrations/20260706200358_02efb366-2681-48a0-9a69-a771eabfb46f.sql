CREATE TABLE IF NOT EXISTS public.mornings_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mornings_recipients TO authenticated;
GRANT ALL ON public.mornings_recipients TO service_role;

ALTER TABLE public.mornings_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mr_admin_all" ON public.mornings_recipients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.mornings_recipients (email) VALUES
  ('tomshimandle12@gmail.com'),
  ('marybwynn@gmail.com'),
  ('gregvanhorn@sbcglobal.net'),
  ('dianaperez1630@gmail.com')
ON CONFLICT (email) DO NOTHING;