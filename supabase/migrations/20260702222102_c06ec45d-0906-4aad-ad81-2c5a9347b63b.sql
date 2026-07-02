
-- 1) Prevent clients from writing to sensitive intake/onboarding columns via RLS.
--    Postgres RLS can't gate column subsets on UPDATE, so we use a trigger.
CREATE OR REPLACE FUNCTION public.protect_user_intake_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- service_role bypasses RLS but still fires triggers; allow it.
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.intake_paid_at IS DISTINCT FROM OLD.intake_paid_at
     OR NEW.intake_completed_at IS DISTINCT FROM OLD.intake_completed_at
     OR NEW.onboarding_complete IS DISTINCT FROM OLD.onboarding_complete
     OR NEW.intake_scheduled_at IS DISTINCT FROM OLD.intake_scheduled_at
     OR NEW.role IS DISTINCT FROM OLD.role
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected intake/onboarding fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_intake_fields ON public.users;
CREATE TRIGGER trg_protect_user_intake_fields
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_intake_fields();

-- 2) Let a signed-in claimant read their own pending intake row.
CREATE POLICY "pi_claimant_select_own"
ON public.pending_intakes
FOR SELECT
TO authenticated
USING (claimed_by_user_id = auth.uid());

-- 3) Lock down SECURITY DEFINER functions. PUBLIC gets EXECUTE by default;
--    revoke it, then grant only where signed-in users must invoke.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_user_intake_fields() FROM PUBLIC;

-- has_role is referenced from RLS policies evaluated as the invoker, so
-- authenticated must retain EXECUTE. Everything else stays service_role-only.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_user_intake_fields() TO service_role;
