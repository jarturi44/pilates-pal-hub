ALTER POLICY plans_select_safe ON public.plans USING (auth.uid() IS NOT NULL);
ALTER POLICY slots_select ON public.slots USING (auth.uid() IS NOT NULL);
ALTER POLICY pe_select_authed ON public.program_exercises USING (auth.uid() IS NOT NULL);
ALTER POLICY rs_select_authed ON public.reminder_settings USING (auth.uid() IS NOT NULL);
ALTER POLICY waiver_versions_select_authenticated ON public.waiver_versions USING (auth.uid() IS NOT NULL);
ALTER POLICY videos_select_authed ON public.videos USING (auth.uid() IS NOT NULL);