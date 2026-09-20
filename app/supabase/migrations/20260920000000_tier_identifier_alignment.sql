-- ==============================================================================
-- Migration: 20260920000000_tier_identifier_alignment.sql
-- Purpose:   Make the database tier identifiers match the product rule and the
--            deterministic engine, before any customer row exists.
--
-- Decision recorded 20 September 2026:
--   'pro'         becomes 'pro_subscription'
--   'pro_trial'   becomes 'pro_subscription_trial'
--   'enterprise'  is removed. There is no Enterprise tier.
--
-- Why this matters. src/services/entitlement/entitlementResolver.mjs declares
--   PLAN_TIERS = ['starter', 'pro_subscription', 'team']
-- and throws on any other value. The profiles table could only ever hold 'pro',
-- so the Pro tier could not resolve at all. This migration closes that gap.
--
-- The organisation governance capabilities previously reserved for 'enterprise'
-- move to 'team', which is the top commercial tier. This is a commercial choice
-- and it is reversible: narrow the team feature list below if Team should not
-- include single sign on and advanced governance.
-- ==============================================================================

BEGIN;

-- 1. Migrate any existing rows. Pre-revenue, so this should affect zero rows.
--    Reported so a surprise is visible rather than silent.
DO $$
DECLARE
    v_pro INTEGER;
    v_pro_trial INTEGER;
    v_enterprise INTEGER;
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_allowed_plan;

    UPDATE public.profiles SET plan = 'pro_subscription'       WHERE plan = 'pro';
    GET DIAGNOSTICS v_pro = ROW_COUNT;

    UPDATE public.profiles SET plan = 'pro_subscription_trial' WHERE plan = 'pro_trial';
    GET DIAGNOSTICS v_pro_trial = ROW_COUNT;

    UPDATE public.profiles SET plan = 'team'                   WHERE plan = 'enterprise';
    GET DIAGNOSTICS v_enterprise = ROW_COUNT;

    RAISE NOTICE 'Tier alignment: % pro, % pro_trial, % enterprise rows migrated.',
        v_pro, v_pro_trial, v_enterprise;
END $$;

-- 2. The final allowed set. 'pro' and 'enterprise' can never be written again.
ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_allowed_plan
    CHECK (plan IN (
        'free_preview',
        'starter_trial',
        'starter',
        'pro_subscription_trial',
        'pro_subscription',
        'team',
        'admin'
    ));

-- 3. Rewrite can_use_feature. This is the live definition, replacing the one
--    created in migration 17. Note: no DROP. Other functions depend on it and
--    the signature is unchanged, which is the defect fixed in fix 01.
CREATE OR REPLACE FUNCTION public.can_use_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan TEXT;
    v_is_suspended BOOLEAN;
BEGIN
    IF p_user_id IS NULL OR p_feature_key IS NULL THEN
        RETURN false;
    END IF;

    SELECT plan, COALESCE(is_suspended, false) INTO v_plan, v_is_suspended
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_plan IS NULL OR v_is_suspended = true THEN
        RETURN false;
    END IF;

    -- Admin is an internal role, not a sold tier.
    IF v_plan = 'admin' THEN
        RETURN true;
    END IF;

    -- Team. Holds the organisation governance capabilities that previously sat
    -- under the removed Enterprise tier. These are multi-seat by nature and Team
    -- is the only multi-seat tier, so this is where they belonged, not a giveaway.
    --
    -- The single sign on key is deliberately NOT granted. The organization_sso_configs
    -- table exists but there is no SAML or OIDC implementation in src. Granting
    -- a permission for a feature that does not exist is how a demo breaks in
    -- front of a buyer. Add the key back the day SSO is built and asked for.
    --
    -- Note: retention and legal hold BEHAVIOUR is unconditional. The 30 day
    -- purge and the legal hold suspension run for every account at every tier,
    -- in the retention migrations, not through this function. The keys below
    -- gate the admin screens, not the protection. Marketing must never imply
    -- that a Starter or Pro customer's data is handled less carefully.
    IF v_plan = 'team' THEN
        RETURN p_feature_key IN (
            'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
            'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
            'insight', 'stats', 'endpoint_report', 'automation_export',
            'saved_projects', 'transcript_archive', 'manual_outputs',
            'next_best_action', 'meeting_health_dashboard',
            'team_workspace', 'team_administration', 'shared_projects',
            'shared_decisions', 'shared_actions', 'shared_insights',
            'audit_logging', 'advanced_governance',
            'compliance_controls', 'organization_admin', 'retention_policies',
            'legal_hold', 'security_controls', 'organization_analytics'
        );
    END IF;

    -- Pro subscription, and the Pro trial.
    IF v_plan IN ('pro_subscription', 'pro_subscription_trial') THEN
        RETURN p_feature_key IN (
            'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
            'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
            'insight', 'stats', 'endpoint_report', 'automation_export',
            'saved_projects', 'transcript_archive', 'manual_outputs',
            'next_best_action', 'meeting_health_dashboard'
        );
    END IF;

    IF v_plan IN ('starter', 'starter_trial') THEN
        RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output', 'json_export');
    END IF;

    IF v_plan = 'free_preview' THEN
        RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output');
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_use_feature(UUID, TEXT) TO authenticated, service_role;

COMMIT;

-- ==============================================================================
-- Verify after applying:
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'check_profiles_allowed_plan';
--   -- must not contain 'pro' on its own, and must not contain 'enterprise'
--
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND (p.prosrc LIKE '%''pro''%' OR p.prosrc LIKE '%''enterprise''%');
--   -- must be 0
-- ==============================================================================
