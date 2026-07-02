-- Tighten SELECT policies to admin-only; server code uses service role.

DROP POLICY IF EXISTS ss_select_authed ON public.studio_settings;
-- ss_admin_all (FOR ALL, has_role admin) already covers admin SELECT.

DROP POLICY IF EXISTS pi_select_own_claimed ON public.pending_intakes;
-- pi_admin_all (FOR ALL, has_role admin) still covers admin ops. Server
-- functions read pending_intakes with the service-role client, which bypasses
-- RLS, so end-user reads of stripe_customer_id / stripe_session_id /
-- stripe_payment_intent_id are no longer possible from the Data API.