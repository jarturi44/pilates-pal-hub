
-- 1. Function search_path — set on functions that lacked it
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/public
--    (trigger + queue-internal functions should only be callable by backend/triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
-- has_role IS intentionally callable by authenticated (used in RLS USING clauses)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 3. user_roles hardening: scope permissive policies to authenticated role,
--    plus add a RESTRICTIVE guard so only admins can write regardless of any
--    future permissive rule
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Restrictive guard: writes always require admin, even if another policy is added later
CREATE POLICY "user_roles_write_admin_only" ON public.user_roles
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. notification_dedupe: let users read their own rows
CREATE POLICY "nd_select_own" ON public.notification_dedupe
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5. plans: revoke SELECT on stripe_price_id column from anon/authenticated;
--    server functions using service_role retain access
REVOKE SELECT (stripe_price_id) ON public.plans FROM anon, authenticated;

-- 6. studio_settings: allow authenticated users to read the row (they need
--    default_meeting_url and studio_name), but hide admin_email column.
--    Grant only safe columns explicitly, revoke admin_email.
CREATE POLICY "ss_select_authed" ON public.studio_settings
  FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT ON public.studio_settings FROM authenticated;
GRANT SELECT (
  id,
  studio_name,
  grace_period_days,
  commitment_months,
  current_waiver_version_id,
  updated_at,
  shop_url,
  default_meeting_url
) ON public.studio_settings TO authenticated;
