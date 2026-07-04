ALTER TABLE public.users DISABLE TRIGGER USER;
UPDATE public.users SET intake_paid_at = now(), intake_completed_at = now() WHERE id = '918f297e-cb84-4c9e-8c3c-c0f8d07b4cf0';
ALTER TABLE public.users ENABLE TRIGGER USER;