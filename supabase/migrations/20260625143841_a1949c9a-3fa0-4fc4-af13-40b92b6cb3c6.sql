
-- 1) Remove user-facing UPDATE on subscriptions (privilege escalation risk)
DROP POLICY IF EXISTS subs_update_own ON public.subscriptions;

-- 2) Restrict stripe_price_id on plans via column-level grants
DROP POLICY IF EXISTS plans_select_all ON public.plans;
CREATE POLICY plans_select_safe ON public.plans
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.plans FROM authenticated;
GRANT SELECT (id, type, sessions_per_week, price_per_month, includes_mornings, display_name, created_at)
  ON public.plans TO authenticated;

-- 3) Restrict admin_email on studio_settings; expose via RPC for admins
REVOKE SELECT ON public.studio_settings FROM authenticated;
GRANT SELECT (id, studio_name, grace_period_days, commitment_months, current_waiver_version_id, updated_at, shop_url)
  ON public.studio_settings TO authenticated;
REVOKE UPDATE ON public.studio_settings FROM authenticated;
GRANT UPDATE (studio_name, grace_period_days, commitment_months, current_waiver_version_id, updated_at, shop_url)
  ON public.studio_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.get_studio_admin_email()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT admin_email INTO v_email FROM public.studio_settings WHERE id = 1;
  RETURN v_email;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_studio_admin_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_studio_admin_email() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_studio_admin_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.studio_settings SET admin_email = _email, updated_at = now() WHERE id = 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_studio_admin_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_studio_admin_email(text) TO authenticated;

-- 4) Tighten always-true INSERT policy on activity_log
DROP POLICY IF EXISTS al_insert_authed ON public.activity_log;
CREATE POLICY al_insert_self ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 5) Drop branding bucket SELECT policy (public bucket files still served via public URL)
DROP POLICY IF EXISTS "Branding assets are publicly readable" ON storage.objects;

-- 6) Set search_path and lock down SECURITY DEFINER pgmq wrappers
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 7) Convert has_role to SECURITY INVOKER so it isn't a definer attack surface.
--    user_roles has RLS allowing users to read their own rows, so invoker calls still work.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
