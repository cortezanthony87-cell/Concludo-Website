-- ==============================================================================
-- Concludo Workspace: Server-Side Permission Checking Architecture
-- Tasklet 9: Build Backend Permission Checking
-- ==============================================================================

-- 1. Helper function to check if a user has access to a specific feature key based on their profile plan
CREATE OR REPLACE FUNCTION public.can_use_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan TEXT;
BEGIN
    IF p_user_id IS NULL OR p_feature_key IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Fetch user's plan directly from profiles table
    SELECT plan INTO v_plan
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_plan IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin has access to all features
    IF v_plan = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Team has access to all features except admin_tools
    IF v_plan = 'team' THEN
        IF p_feature_key = 'admin_tools' THEN
            RETURN FALSE;
        END IF;
        RETURN TRUE;
    END IF;

    -- Pro has access to all features except team_workspace and admin_tools
    IF v_plan = 'pro' THEN
        IF p_feature_key IN ('admin_tools', 'team_workspace') THEN
            RETURN FALSE;
        END IF;
        RETURN TRUE;
    END IF;

    -- Pro Trial has access to memory and intelligence features, but not automation_export, team_workspace, admin_tools
    IF v_plan = 'pro_trial' THEN
        IF p_feature_key IN ('admin_tools', 'team_workspace', 'automation_export') THEN
            RETURN FALSE;
        END IF;
        RETURN TRUE;
    END IF;

    -- Starter and Starter Trial allow core_outputs, copy_output, and json_export
    IF v_plan IN ('starter', 'starter_trial') THEN
        RETURN p_feature_key IN ('core_outputs', 'copy_output', 'json_export');
    END IF;

    -- Free Preview allows core_outputs and copy_output only
    IF v_plan = 'free_preview' THEN
        RETURN p_feature_key IN ('core_outputs', 'copy_output');
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Secure RPC endpoint callable by authenticated clients to test feature access
CREATE OR REPLACE FUNCTION public.check_feature_access(p_feature_key TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_allowed BOOLEAN;
    v_plan TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'statusCode', 401,
            'error', 'unauthorized',
            'message', 'Authentication required'
        );
    END IF;

    SELECT plan INTO v_plan FROM public.profiles WHERE id = v_user_id;

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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.can_use_feature(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_feature_access(TEXT) TO authenticated, service_role;
