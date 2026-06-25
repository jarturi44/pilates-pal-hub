
-- 1) studio_settings: restrict reads to admins only
DROP POLICY IF EXISTS ss_select_authed ON public.studio_settings;
-- ss_admin_all already grants admin full access, so no replacement needed.

-- Remove the SECURITY DEFINER RPC wrappers (admins read/write the table directly now)
DROP FUNCTION IF EXISTS public.get_studio_admin_email();
DROP FUNCTION IF EXISTS public.set_studio_admin_email(text);

-- 2) waiver_versions: restrict reads to admins only
DROP POLICY IF EXISTS wv_versions_select_authed ON public.waiver_versions;
-- wv_versions_admin_all already grants admin full access.

-- 3) user_roles: explicit restrictive insert policy blocking non-admins
DROP POLICY IF EXISTS user_roles_insert_admin_only ON public.user_roles;
CREATE POLICY user_roles_insert_admin_only ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) storage.objects: admin-only write policies for the 'branding' bucket
DROP POLICY IF EXISTS branding_admin_insert ON storage.objects;
DROP POLICY IF EXISTS branding_admin_update ON storage.objects;
DROP POLICY IF EXISTS branding_admin_delete ON storage.objects;

CREATE POLICY branding_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY branding_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY branding_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
