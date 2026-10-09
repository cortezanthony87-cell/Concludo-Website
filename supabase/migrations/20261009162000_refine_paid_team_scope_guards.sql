DROP POLICY IF EXISTS paid_team_scope_guard ON public.teams;
CREATE POLICY paid_team_scope_guard ON public.teams
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR (owner_id = auth.uid() AND public.can_use_feature(auth.uid(), 'team_workspace'))
  OR public.has_active_team_seat(id, auth.uid())
);

DROP POLICY IF EXISTS paid_team_member_scope_guard ON public.team_members;
CREATE POLICY paid_team_member_scope_guard ON public.team_members
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR user_id = auth.uid()
  OR public.has_active_team_seat(team_id, auth.uid())
);

DROP POLICY IF EXISTS paid_team_activity_scope_guard ON public.team_activities;
CREATE POLICY paid_team_activity_scope_guard ON public.team_activities
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR public.has_active_team_seat(team_id, auth.uid())
);
