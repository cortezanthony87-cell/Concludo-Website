-- ==============================================================================
-- Migration: 20260920010000_access_grants.sql
-- Purpose:   Give Phase 12 access grants a database. Until this migration runs,
--            a redeemed access code grants nothing that survives a page reload,
--            because grantRedemptionService.mjs holds entitlements in a
--            JavaScript Map that row level security cannot see.
--
-- Must run AFTER 20260920000000_tier_identifier_alignment.sql, because it
-- rewrites can_use_feature and depends on the aligned tier identifiers.
--
-- SECRET HANDLING. The plaintext code is never stored and never reaches this
-- database. Only the scrypt hash and its salt are stored. PostgreSQL has no
-- scrypt, so verification happens in the Node server, which then calls
-- redeem_access_grant as service_role. That function is deliberately NOT
-- granted to authenticated: a browser must never be able to call it.
-- ==============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The codes. Column names match tools/Concludo_grant_codes_seed.sql exactly,
--    so the existing seed file applies without modification.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_grant_codes (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id            TEXT NOT NULL UNIQUE,
    secret_hash          TEXT NOT NULL,
    secret_salt          TEXT NOT NULL,
    hash_params          JSONB NOT NULL,
    grants_tier          TEXT NOT NULL
                         CHECK (grants_tier IN ('starter', 'pro_subscription', 'team')),
    grants_capabilities  TEXT[] NOT NULL DEFAULT '{}',
    label                TEXT NOT NULL,
    max_redemptions      INTEGER NOT NULL DEFAULT 1 CHECK (max_redemptions >= 1),
    redemption_count     INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
    counts_toward_revenue BOOLEAN NOT NULL DEFAULT false,
    issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at           TIMESTAMPTZ NOT NULL,
    revoked_at           TIMESTAMPTZ DEFAULT NULL,
    revoked_reason       TEXT DEFAULT NULL,

    -- Phase 14 rule: an internal grant is never revenue. Enforced, not documented.
    CONSTRAINT grants_are_not_revenue CHECK (counts_toward_revenue = false),
    CONSTRAINT redemptions_within_limit CHECK (redemption_count <= max_redemptions),
    CONSTRAINT public_id_shape CHECK (public_id ~ '^[0-9A-Z]{8}$')
);

COMMENT ON TABLE public.access_grant_codes IS
    'Access grant codes. Plaintext codes are never stored here and must never be '
    'pasted into a document, issue, support ticket or AI prompt.';

-- ---------------------------------------------------------------------------
-- 2. Redemptions. One row per person who used a code.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_grant_redemptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_code_id   UUID NOT NULL REFERENCES public.access_grant_codes(id) ON DELETE RESTRICT,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_ip     INET DEFAULT NULL,
    revoked_at      TIMESTAMPTZ DEFAULT NULL,
    revoked_reason  TEXT DEFAULT NULL,

    -- One person cannot redeem the same code twice.
    CONSTRAINT one_redemption_per_user_per_code UNIQUE (grant_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_grant_redemptions_user
    ON public.access_grant_redemptions(user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Row level security. Codes are invisible to every customer. A person can
--    see that they hold a grant, and nothing about anyone else's.
-- ---------------------------------------------------------------------------
ALTER TABLE public.access_grant_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_grant_redemptions ENABLE ROW LEVEL SECURITY;

-- Deliberately no policy of any kind for authenticated on access_grant_codes.
-- Row level security with no policy denies everything. Only service_role, which
-- carries BYPASSRLS, can read or write codes.

DROP POLICY IF EXISTS grant_redemptions_select_own ON public.access_grant_redemptions;
CREATE POLICY grant_redemptions_select_own ON public.access_grant_redemptions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- No insert, update or delete policy for authenticated. A person cannot grant
-- themselves access, revoke a revocation, or delete the evidence.

REVOKE ALL ON public.access_grant_codes FROM authenticated, anon;
GRANT SELECT ON public.access_grant_redemptions TO authenticated;
GRANT ALL ON public.access_grant_codes, public.access_grant_redemptions TO service_role;

-- ---------------------------------------------------------------------------
-- 4. The effective tier. NULL when the person holds no live grant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.active_grant_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT c.grants_tier
      FROM public.access_grant_redemptions r
      JOIN public.access_grant_codes c ON c.id = r.grant_code_id
     WHERE r.user_id = p_user_id
       AND r.revoked_at IS NULL
       AND c.revoked_at IS NULL
       AND c.expires_at > now()
     ORDER BY CASE c.grants_tier
                WHEN 'team' THEN 3 WHEN 'pro_subscription' THEN 2 ELSE 1 END DESC
     LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.active_grant_tier(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Redemption. service_role only. The Node server verifies the scrypt hash
--    first, because PostgreSQL cannot. Returns the tier granted, or raises.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_access_grant(p_public_id TEXT, p_user_id UUID, p_ip INET DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code public.access_grant_codes%ROWTYPE;
BEGIN
    IF p_public_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'redeem_access_grant requires a code and a user.';
    END IF;

    -- FOR UPDATE closes the race where two people redeem the last slot at once.
    SELECT * INTO v_code FROM public.access_grant_codes
     WHERE public_id = p_public_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'grant_not_found';
    END IF;
    IF v_code.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'grant_revoked';
    END IF;
    IF v_code.expires_at <= now() THEN
        RAISE EXCEPTION 'grant_expired';
    END IF;
    IF v_code.redemption_count >= v_code.max_redemptions THEN
        RAISE EXCEPTION 'grant_exhausted';
    END IF;

    INSERT INTO public.access_grant_redemptions (grant_code_id, user_id, redeemed_ip)
    VALUES (v_code.id, p_user_id, p_ip)
    ON CONFLICT (grant_code_id, user_id) DO NOTHING;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'grant_already_redeemed_by_this_user';
    END IF;

    UPDATE public.access_grant_codes
       SET redemption_count = redemption_count + 1
     WHERE id = v_code.id;

    RETURN v_code.grants_tier;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_access_grant(TEXT, UUID, INET) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.redeem_access_grant(TEXT, UUID, INET) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Revocation. Kills the code and every redemption made from it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_access_grant(p_public_id TEXT, p_reason TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id UUID;
    v_count INTEGER;
BEGIN
    SELECT id INTO v_id FROM public.access_grant_codes WHERE public_id = p_public_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'grant_not_found';
    END IF;

    UPDATE public.access_grant_codes
       SET revoked_at = now(), revoked_reason = p_reason
     WHERE id = v_id AND revoked_at IS NULL;

    UPDATE public.access_grant_redemptions
       SET revoked_at = now(), revoked_reason = p_reason
     WHERE grant_code_id = v_id AND revoked_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_access_grant(TEXT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.revoke_access_grant(TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. can_use_feature now honours a live grant. One code path, one source of
--    truth: the effective plan is the granted tier if there is one, otherwise
--    the profile plan.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_use_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan TEXT;
    v_is_suspended BOOLEAN;
    v_grant_tier TEXT;
BEGIN
    IF p_user_id IS NULL OR p_feature_key IS NULL THEN
        RETURN false;
    END IF;

    SELECT plan, COALESCE(is_suspended, false) INTO v_plan, v_is_suspended
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_plan IS NULL THEN
        RETURN false;
    END IF;

    -- Suspension beats everything, including a grant. A suspended account is
    -- suspended whoever gave them a code.
    IF v_is_suspended = true THEN
        RETURN false;
    END IF;

    IF v_plan = 'admin' THEN
        RETURN true;
    END IF;

    v_grant_tier := public.active_grant_tier(p_user_id);
    IF v_grant_tier IS NOT NULL THEN
        v_plan := v_grant_tier;
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
-- After applying, seed the codes:
--   psql ... -f tools/Concludo_grant_codes_seed.sql
--
-- Then confirm a customer cannot read the codes:
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) FROM public.access_grant_codes;   -- must be 0 rows or denied
-- ==============================================================================
