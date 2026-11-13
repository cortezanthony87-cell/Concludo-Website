-- ==============================================================================
-- Concludo Workspace: Action Timeline PowerPoint Export (action_timeline_export)
-- Stage 2 Gate: Additive entitlement for Pro and Team tiers
-- STAGED ONLY: Do not apply to production without Anthony's explicit written approval
-- ==============================================================================

BEGIN;

-- 1. Update can_use_feature to include action_timeline_export for Pro and Team
CREATE OR REPLACE FUNCTION public.can_use_feature(p_user_id uuid, p_feature_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan TEXT;
BEGIN
  IF p_user_id IS NULL OR p_feature_key IS NULL THEN
    RETURN false;
  END IF;

  v_plan := public.effective_plan_for_user(p_user_id);
  IF v_plan = 'admin' THEN
    RETURN true;
  END IF;

  IF v_plan = 'team' THEN
    RETURN p_feature_key IN (
      'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
      'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
      'insight', 'stats', 'endpoint_report', 'automation_export',
      'saved_projects', 'transcript_archive', 'manual_outputs',
      'next_best_action', 'meeting_health_dashboard',
      'follow_up_email_draft', 'deck_export', 'action_timeline_export',
      'team_workspace', 'team_administration', 'shared_projects',
      'shared_decisions', 'shared_actions', 'shared_insights',
      'audit_logging', 'advanced_governance',
      'compliance_controls', 'organization_admin', 'retention_policies',
      'legal_hold', 'security_controls', 'organization_analytics'
    );
  END IF;

  IF v_plan IN ('pro_subscription', 'pro_subscription_trial', 'pro', 'pro_trial') THEN
    RETURN p_feature_key IN (
      'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
      'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
      'insight', 'stats', 'endpoint_report', 'automation_export',
      'saved_projects', 'transcript_archive', 'manual_outputs',
      'next_best_action', 'meeting_health_dashboard',
      'follow_up_email_draft', 'deck_export', 'action_timeline_export'
    );
  END IF;

  IF v_plan IN ('starter', 'starter_trial') THEN
    RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output', 'json_export');
  END IF;

  IF v_plan = 'free_preview' THEN
    RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output');
  END IF;

  RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_use_feature(UUID, TEXT) TO authenticated, service_role;

-- 2. Update check_feature_access RPC endpoint to recognise action_timeline_export
CREATE OR REPLACE FUNCTION public.check_feature_access(p_feature_key TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_allowed BOOLEAN;
    v_plan TEXT;
BEGIN
    IF p_feature_key NOT IN (
        'workspace_basic', 'meeting_memory', 'decision_memory', 'action_tracker',
        'keyword_search', 'insight', 'stats', 'endpoint_report', 'automation_export',
        'team_workspace', 'admin_dashboard', 'core_outputs', 'copy_output', 'json_export',
        'saved_projects', 'transcript_archive', 'manual_outputs', 'next_best_action',
        'meeting_health_dashboard', 'admin_tools', 'follow_up_email_draft', 'deck_export',
        'action_timeline_export'
    ) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'statusCode', 400,
            'error', 'invalid_feature_key',
            'message', 'Invalid feature key: ' || COALESCE(p_feature_key, 'null')
        );
    END IF;

    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'statusCode', 401,
            'error', 'unauthorized',
            'message', 'Authentication required'
        );
    END IF;

    v_plan := public.effective_plan_for_user(v_user_id);

    IF v_plan IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'statusCode', 404,
            'error', 'profile_not_found',
            'message', 'User profile not found in database'
        );
    END IF;

    v_allowed := public.can_use_feature(v_user_id, p_feature_key);

    IF v_allowed THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'statusCode', 200,
            'plan', v_plan,
            'feature', p_feature_key
        );
    ELSE
        RETURN jsonb_build_object(
            'allowed', false,
            'statusCode', 403,
            'plan', v_plan,
            'feature', p_feature_key,
            'error', 'feature_not_available',
            'message', 'Your current plan does not include this feature.',
            'requiredUpgrade', true
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.check_feature_access(TEXT) TO authenticated, service_role;

-- 3. Update public.outputs output_type check constraint to permit 'action_timeline'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'outputs_output_type_check'
          AND conrelid = 'public.outputs'::regclass
    ) THEN
        ALTER TABLE public.outputs DROP CONSTRAINT outputs_output_type_check;
        ALTER TABLE public.outputs ADD CONSTRAINT outputs_output_type_check CHECK (output_type IN (
            'summary',
            'action_items',
            'follow_up_email',
            'decision_log',
            'action_plan',
            'endpoint_report',
            'action_timeline'
        ));
    END IF;
END $$;

-- 4. Server-side RLS enforcement for action_timeline on public.outputs insert
DROP POLICY IF EXISTS "Users can create their own outputs" ON public.outputs;
CREATE POLICY "Users can create their own outputs" ON public.outputs
FOR INSERT
WITH CHECK (
    (user_id = auth.uid())
    AND ((output_type <> 'follow_up_email'::text) OR can_use_feature(auth.uid(), 'follow_up_email_draft'::text))
    AND ((output_type <> 'action_timeline'::text) OR can_use_feature(auth.uid(), 'action_timeline_export'::text))
    AND (EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = outputs.project_id
          AND p.user_id = auth.uid()
          AND p.deleted_at IS NULL
    ))
);

COMMIT;
