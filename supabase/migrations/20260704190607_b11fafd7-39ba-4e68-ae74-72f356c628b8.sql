CREATE OR REPLACE FUNCTION public.protect_user_intake_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
BEGIN
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
     OR NEW.role IS DISTINCT FROM OLD.role
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected intake/onboarding fields';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.users DISABLE TRIGGER trg_protect_user_intake_fields;
UPDATE public.users SET onboarding_complete = false WHERE id = '4c168a0c-9917-403a-91b3-f1aa07bd7912';
ALTER TABLE public.users ENABLE TRIGGER trg_protect_user_intake_fields;