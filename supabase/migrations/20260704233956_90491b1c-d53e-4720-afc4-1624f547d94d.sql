DO $$
BEGIN
  ALTER TABLE public.users DISABLE TRIGGER USER;

  UPDATE public.users
  SET onboarding_complete = true
  WHERE lower(email) = 'chad.vanko@yahoo.com'
    AND EXISTS (
      SELECT 1
      FROM public.onboarding_progress op
      WHERE op.user_id = public.users.id
        AND op.shipping_completed_at IS NOT NULL
        AND op.waiver_completed_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.waivers w
      WHERE w.user_id = public.users.id
    );

  ALTER TABLE public.users ENABLE TRIGGER USER;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.users ENABLE TRIGGER USER;
  RAISE;
END $$;