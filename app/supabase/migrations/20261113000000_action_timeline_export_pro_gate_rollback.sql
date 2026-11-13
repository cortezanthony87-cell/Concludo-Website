-- ==============================================================================
-- Concludo Workspace: Action Timeline PowerPoint Export Rollback
-- ==============================================================================

BEGIN;

-- Restore previous check_feature_access
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
        'meeting_health_dashboard', 'admin_tools', 'follow_up_email_draft', 'deck_export'
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
        RETURN jsonb_build_object('allowed', true, 'statusCode', 200, 'plan', v_plan, 'feature', p_feature_key);
    ELSE
        RETURN jsonb_build_object('allowed', false, 'statusCode', 403, 'plan', v_plan, 'feature', p_feature_key, 'error', 'feature_not_available', 'message', 'Your current plan does not include this feature.', 'requiredUpgrade', true);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Restore previous Users can create their own outputs policy
DROP POLICY IF EXISTS "Users can create their own outputs" ON public.outputs;
CREATE POLICY "Users can create their own outputs" ON public.outputs
FOR INSERT
WITH CHECK (
    (user_id = auth.uid())
    AND ((output_type <> 'follow_up_email'::text) OR can_use_feature(auth.uid(), 'follow_up_email_draft'::text))
    AND (EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = outputs.project_id
          AND p.user_id = auth.uid()
          AND p.deleted_at IS NULL
    ))
);

COMMIT;
