-- Fix: protect_user_intake_fields() was blocking the app's OWN server from
-- recording intake payments.
--
-- The original guard only allowed the write through if it detected the caller
-- as service_role via the LEGACY GUC `request.jwt.claim.role`. Current Supabase
-- (PostgREST) often does not populate that legacy GUC, so the app's server-side
-- writes (supabaseAdmin) via claimIntakeForUser / syncIntakeCheckout /
-- markIntakeSkipped / completeOnboarding were failing with
-- "Not allowed to modify protected intake/onboarding fields", leaving paid
-- clients with intake_paid_at = null and re-prompting them to pay.
--
-- This version reads the caller's role from BOTH the modern JSON claims GUC
-- (`request.jwt.claims`) and the legacy per-claim GUC, and also allows direct
-- database contexts (migrations / SQL editor / trusted server), which have no
-- PostgREST JWT at all. End-user requests always carry a JWT with role
-- 'authenticated' or 'anon', so clients are still blocked from editing these
-- protected columns. No security regression: clients cannot forge these GUCs —
-- PostgREST sets them from the verified JWT.

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
  -- Resolve the caller's role from JWT claims. Prefer the legacy per-claim GUC
  -- when present, else fall back to the modern JSON claims GUC.
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );

  -- Trusted contexts:
  --   * jwt_role IS NULL  -> direct DB connection (migration / SQL editor / server
  --                          with no PostgREST JWT). Only DB-credential holders
  --                          reach this; inherently trusted.
  --   * 'service_role'    -> the app's own server (supabaseAdmin).
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins may edit these fields via their authenticated session.
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Everyone else (authenticated clients, anon) is blocked from changing the
  -- protected intake/onboarding columns.
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

-- Recover the stuck test account: it paid in Stripe but intake_paid_at was
-- never set because the old trigger rejected the claim write. Safe + scoped to
-- the single test email; runs in a direct-DB context so the (now-fixed) trigger
-- allows it.
UPDATE public.users
SET intake_paid_at = COALESCE(intake_paid_at, now())
WHERE lower(email) = 'jon.arturi+test@gmail.com';
