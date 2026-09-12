-- ==============================================================================
-- Concludo Workspace: Production Authentication, Accounts, Tiers & Trials
-- Tasklet 12: Authentication, Accounts, Tier Enforcement and Trials
-- ==============================================================================

-- 1. Add Trial Columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ DEFAULT NULL;

-- 2. Ensure Plan Check Constraint matches allowed tiers
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_allowed_plan;
ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_allowed_plan
    CHECK (plan IN ('free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'admin'));

-- 3. Reset Column-Level Security & Grants on profiles
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 4. Update Profile Field Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();

    IF auth.role() = 'authenticated' THEN
        IF NOT public.is_admin() THEN
            IF NEW.plan IS DISTINCT FROM OLD.plan THEN
                RAISE EXCEPTION 'Users are not permitted to change their plan';
            END IF;
            IF NEW.role IS DISTINCT FROM OLD.role THEN
                RAISE EXCEPTION 'Users are not permitted to change their role';
            END IF;
            IF NEW.email IS DISTINCT FROM OLD.email THEN
                RAISE EXCEPTION 'Users are not permitted to change their email directly';
            END IF;
            IF NEW.id IS DISTINCT FROM OLD.id THEN
                RAISE EXCEPTION 'Profile ID cannot be changed';
            END IF;
            IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                RAISE EXCEPTION 'Created date cannot be changed';
            END IF;
            IF NEW.trial_start_date IS DISTINCT FROM OLD.trial_start_date THEN
                RAISE EXCEPTION 'Users are not permitted to change trial dates';
            END IF;
            IF NEW.trial_end_date IS DISTINCT FROM OLD.trial_end_date THEN
                RAISE EXCEPTION 'Users are not permitted to change trial dates';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_profile_update ON public.profiles;
CREATE TRIGGER before_profile_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.protect_profile_fields();

-- 5. Trigger on auth.users for Automatic Profile Creation on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        plan,
        role,
        created_at,
        updated_at,
        trial_start_date,
        trial_end_date
    )
    VALUES (
        NEW.id,
        NEW.email,
        NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
        'free_preview',
        'user',
        now(),
        now(),
        NULL,
        NULL
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Authoritative Backend Feature Check Function: can_use_feature
CREATE OR REPLACE FUNCTION public.can_use_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan TEXT;
BEGIN
    IF p_user_id IS NULL OR p_feature_key IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Validate feature key against known system feature keys
    IF p_feature_key NOT IN (
        'workspace_basic', 'meeting_memory', 'decision_memory', 'action_tracker',
        'keyword_search', 'insight', 'stats', 'endpoint_report', 'automation_export',
        'team_workspace', 'admin_dashboard', 'core_outputs', 'copy_output', 'json_export',
        'saved_projects', 'transcript_archive', 'manual_outputs', 'next_best_action',
        'meeting_health_dashboard', 'admin_tools'
    ) THEN
        RETURN FALSE;
    END IF;

    -- Fetch user plan directly from authoritative profiles table
    SELECT plan INTO v_plan
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_plan IS NULL THEN
        RETURN FALSE;
    END IF;

    -- ADMIN: Allowed all features
    IF v_plan = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- TEAM: Allowed all features except admin_dashboard / admin_tools
    IF v_plan = 'team' THEN
        IF p_feature_key IN ('admin_dashboard', 'admin_tools') THEN
            RETURN FALSE;
        END IF;
        RETURN TRUE;
    END IF;

    -- PRO & PRO TRIAL:
    -- Allowed: workspace_basic, meeting_memory, decision_memory, action_tracker, keyword_search,
    --          insight, stats, endpoint_report, automation_export, core_outputs, copy_output,
    --          json_export, saved_projects, transcript_archive, manual_outputs, next_best_action, meeting_health_dashboard
    -- Denied: team_workspace, admin_dashboard, admin_tools
    IF v_plan IN ('pro', 'pro_trial') THEN
        IF p_feature_key IN ('team_workspace', 'admin_dashboard', 'admin_tools') THEN
            RETURN FALSE;
        END IF;
        RETURN TRUE;
    END IF;

    -- STARTER & STARTER TRIAL:
    -- Allowed: workspace_basic, core_outputs, copy_output, json_export
    IF v_plan IN ('starter', 'starter_trial') THEN
        RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output', 'json_export');
    END IF;

    -- FREE PREVIEW:
    -- Allowed: workspace_basic, core_outputs, copy_output
    IF v_plan = 'free_preview' THEN
        RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output');
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. has_feature Function (Tasklet 12 helper)
CREATE OR REPLACE FUNCTION public.has_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.can_use_feature(p_user_id, p_feature_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. RPC Endpoint: check_feature_access
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
        'meeting_health_dashboard', 'admin_tools'
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.can_use_feature(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_feature(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_feature_access(TEXT) TO authenticated, service_role;
