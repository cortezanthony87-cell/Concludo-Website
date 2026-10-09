GRANT EXECUTE ON FUNCTION public.can_use_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_plan(uuid) TO authenticated;
