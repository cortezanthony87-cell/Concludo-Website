-- Fix RLS WITH CHECK policy on action_approval_events and action_audit_events
-- Enforces parent action ownership on insert/update so actors cannot attach events to other users' actions.

DROP POLICY IF EXISTS action_approval_events_owner_all ON public.action_approval_events;
CREATE POLICY action_approval_events_owner_all ON public.action_approval_events
  FOR ALL TO authenticated
  USING (
    actor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))
  )
  WITH CHECK (
    actor_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS action_audit_events_owner_all ON public.action_audit_events;
CREATE POLICY action_audit_events_owner_all ON public.action_audit_events
  FOR ALL TO authenticated
  USING (
    actor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))
  )
  WITH CHECK (
    actor_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))
  );
