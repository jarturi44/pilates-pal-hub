
DROP POLICY IF EXISTS al_insert_self ON public.activity_log;
CREATE POLICY al_insert_admin ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS notif_insert_own ON public.notifications;
CREATE POLICY notif_insert_admin ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS subs_insert_own ON public.subscriptions;

REVOKE UPDATE (role, intake_paid_at, intake_completed_at, onboarding_complete)
  ON public.users FROM authenticated;
REVOKE UPDATE (role, intake_paid_at, intake_completed_at, onboarding_complete)
  ON public.users FROM anon;

DO $$
DECLARE
  r RECORD;
  args TEXT;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname <> 'has_role'
  LOOP
    args := pg_get_function_identity_arguments(r.oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, args);
  END LOOP;
END $$;
