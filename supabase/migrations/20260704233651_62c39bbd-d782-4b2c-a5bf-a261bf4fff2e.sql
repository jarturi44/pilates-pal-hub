DO $$
BEGIN
  ALTER TABLE public.users DISABLE TRIGGER USER;
  UPDATE public.users SET onboarding_complete = false WHERE email = 'wilson.colleen@gmail.com';
  ALTER TABLE public.users ENABLE TRIGGER USER;
END $$;