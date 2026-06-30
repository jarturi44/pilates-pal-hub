
-- 1. Make has_role SECURITY DEFINER so it safely bypasses RLS when used in policies
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

-- 2. Let a claiming user read their own pending intake record
CREATE POLICY "pi_select_own_claimed"
ON public.pending_intakes
FOR SELECT
TO authenticated
USING (claimed_by_user_id = auth.uid());

-- 4. Allow authenticated users to read waiver versions so they can sign them
CREATE POLICY "waiver_versions_select_authenticated"
ON public.waiver_versions
FOR SELECT
TO authenticated
USING (true);
