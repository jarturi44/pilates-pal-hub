CREATE OR REPLACE FUNCTION public.protect_user_intake_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );

  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
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

UPDATE public.users
SET intake_paid_at = COALESCE(intake_paid_at, now())
WHERE lower(email) = 'jon.arturi+test@gmail.com';