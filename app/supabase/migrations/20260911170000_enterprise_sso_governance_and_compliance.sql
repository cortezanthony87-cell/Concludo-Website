-- ==============================================================================
-- Migration: 20260911170000_enterprise_sso_governance_and_compliance.sql
-- Description: Tasklet 17 - Enterprise SSO, Governance, Compliance & Org Controls
-- Tables: organizations, organization_members, organization_domains,
--         organization_sso_configs, audit_logs, retention_policies,
--         legal_holds, access_reviews
-- Tier: enterprise, admin
-- ==============================================================================

-- 1. Update profiles table to support 'enterprise' plan and 'is_suspended'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_allowed_plan;
ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_allowed_plan
    CHECK (plan IN ('free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'enterprise', 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- 2. Update can_use_feature function in database to recognize enterprise features
DROP FUNCTION IF EXISTS public.can_use_feature(UUID, TEXT);
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

    -- Admin has access to all features
    IF v_plan = 'admin' THEN
        RETURN true;
    END IF;

    -- Enterprise plan
    IF v_plan = 'enterprise' THEN
        RETURN p_feature_key IN (
            'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
            'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
            'insight', 'stats', 'endpoint_report', 'automation_export',
            'saved_projects', 'transcript_archive', 'manual_outputs', 'next_best_action', 'meeting_health_dashboard',
            'team_workspace', 'team_administration', 'shared_projects', 'shared_decisions', 'shared_actions', 'shared_insights',
            'enterprise_sso', 'audit_logging', 'advanced_governance', 'compliance_controls',
            'organization_admin', 'retention_policies', 'legal_hold', 'security_controls', 'organization_analytics'
        );
    END IF;

    -- Team plan
    IF v_plan = 'team' THEN
        RETURN p_feature_key IN (
            'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
            'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
            'insight', 'stats', 'endpoint_report', 'automation_export',
            'saved_projects', 'transcript_archive', 'manual_outputs', 'next_best_action', 'meeting_health_dashboard',
            'team_workspace', 'team_administration', 'shared_projects', 'shared_decisions', 'shared_actions', 'shared_insights'
        );
    END IF;

    -- Pro & Pro Trial
    IF v_plan IN ('pro', 'pro_trial') THEN
        RETURN p_feature_key IN (
            'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
            'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
            'insight', 'stats', 'endpoint_report', 'automation_export',
            'saved_projects', 'transcript_archive', 'manual_outputs', 'next_best_action', 'meeting_health_dashboard'
        );
    END IF;

    -- Starter & Starter Trial
    IF v_plan IN ('starter', 'starter_trial') THEN
        RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output', 'json_export');
    END IF;

    -- Free Preview
    IF v_plan = 'free_preview' THEN
        RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output');
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

-- 4. Create Organization Members table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('organization_owner', 'organization_admin', 'security_admin', 'compliance_admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, user_id)
);

-- 5. Create Organization Domains table
CREATE TABLE IF NOT EXISTS public.organization_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    verified BOOLEAN NOT NULL DEFAULT false,
    verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    verified_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create Organization SSO Configs table
CREATE TABLE IF NOT EXISTS public.organization_sso_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    provider_name TEXT NOT NULL,
    protocol TEXT NOT NULL CHECK (protocol IN ('saml', 'oidc')),
    login_url TEXT NOT NULL,
    issuer TEXT,
    certificate TEXT,
    client_id TEXT,
    client_secret TEXT,
    domain_mapping TEXT,
    sso_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Create Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT DEFAULT '127.0.0.1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create Retention Policies table
CREATE TABLE IF NOT EXISTS public.retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'transcript', 'decision', 'action', 'output', 'endpoint_report')),
    retention_days INTEGER NOT NULL, -- 30, 90, 180, 365, -1
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, entity_type)
);

-- 9. Create Legal Holds table
CREATE TABLE IF NOT EXISTS public.legal_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'released')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create Access Reviews table
CREATE TABLE IF NOT EXISTS public.access_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    target_user_id UUID NOT NULL REFERENCES auth.users(id),
    role TEXT NOT NULL,
    teams JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('approved', 'revoked', 'pending')) DEFAULT 'pending',
    notes TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Add organization_id to teams table if not exists
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 12. Helper Functions for Organization Security & Permissions
DROP FUNCTION IF EXISTS public.is_organization_member(UUID, UUID);
CREATE OR REPLACE FUNCTION public.is_organization_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_org_id IS NULL OR p_user_id IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_org_id AND user_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = p_org_id AND owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.get_organization_role(UUID, UUID);
CREATE OR REPLACE FUNCTION public.get_organization_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
    v_is_owner BOOLEAN;
BEGIN
    IF p_org_id IS NULL OR p_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT (owner_id = p_user_id) INTO v_is_owner
    FROM public.organizations
    WHERE id = p_org_id;

    IF v_is_owner THEN
        RETURN 'organization_owner';
    END IF;

    SELECT role INTO v_role
    FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = p_user_id;

    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Legal Hold Checker: Checks if a record or user is subject to an active Legal Hold
DROP FUNCTION IF EXISTS public.is_record_on_legal_hold(UUID, UUID);
CREATE OR REPLACE FUNCTION public.is_record_on_legal_hold(p_user_id UUID, p_team_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_hold BOOLEAN := false;
BEGIN
    IF p_user_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.organization_members om
            JOIN public.legal_holds lh ON lh.organization_id = om.organization_id
            WHERE om.user_id = p_user_id AND lh.status = 'active'
        ) OR EXISTS (
            SELECT 1
            FROM public.organizations o
            JOIN public.legal_holds lh ON lh.organization_id = o.id
            WHERE o.owner_id = p_user_id AND lh.status = 'active'
        ) INTO v_has_hold;

        IF v_has_hold THEN
            RETURN true;
        END IF;
    END IF;

    IF p_team_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.teams t
            JOIN public.legal_holds lh ON lh.organization_id = t.organization_id
            WHERE t.id = p_team_id AND lh.status = 'active'
        ) INTO v_has_hold;

        IF v_has_hold THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Update Purge Functions to respect Legal Hold
DROP FUNCTION IF EXISTS public.purge_expired_records();
CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_purged_projects_count INT := 0;
    v_purged_outputs_count INT := 0;
    v_purged_decisions_count INT := 0;
    v_purged_actions_count INT := 0;
    v_purged_reports_count INT := 0;
BEGIN
    -- 1. Purge expired decisions (exclude records on legal hold)
    DELETE FROM public.decision_memory dm
    WHERE dm.deleted_at IS NOT NULL
      AND dm.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(dm.user_id, dm.team_id);
    GET DIAGNOSTICS v_purged_decisions_count = ROW_COUNT;

    -- 2. Purge expired actions (exclude records on legal hold)
    DELETE FROM public.action_tracker at
    WHERE at.deleted_at IS NOT NULL
      AND at.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(at.user_id, at.team_id);
    GET DIAGNOSTICS v_purged_actions_count = ROW_COUNT;

    -- 3. Purge expired endpoint reports (exclude records on legal hold)
    DELETE FROM public.endpoint_reports er
    WHERE er.deleted_at IS NOT NULL
      AND er.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(er.user_id, NULL);
    GET DIAGNOSTICS v_purged_reports_count = ROW_COUNT;

    -- 4. Purge expired standalone outputs (exclude records on legal hold)
    DELETE FROM public.outputs o
    WHERE o.deleted_at IS NOT NULL
      AND o.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(o.user_id, NULL);
    GET DIAGNOSTICS v_purged_outputs_count = ROW_COUNT;

    -- 5. Purge expired projects (exclude records on legal hold)
    DELETE FROM public.projects p
    WHERE p.deleted_at IS NOT NULL
      AND p.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(p.user_id, p.team_id);
    GET DIAGNOSTICS v_purged_projects_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'executed_at', v_now,
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.purge_user_expired_records(UUID);
CREATE OR REPLACE FUNCTION public.purge_user_expired_records(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_now TIMESTAMPTZ := now();
    v_purged_projects_count INT := 0;
    v_purged_outputs_count INT := 0;
    v_purged_decisions_count INT := 0;
    v_purged_actions_count INT := 0;
    v_purged_reports_count INT := 0;
BEGIN
    IF auth.role() = 'service_role' THEN
        v_user_id := COALESCE(p_user_id, auth.uid());
    ELSE
        v_user_id := auth.uid();
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user is subject to active legal hold
    IF public.is_record_on_legal_hold(v_user_id, NULL) THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Retention purge skipped: User organization is subject to active Legal Hold.',
            'purged_projects', 0,
            'purged_outputs', 0,
            'purged_decisions', 0,
            'purged_actions', 0,
            'purged_reports', 0
        );
    END IF;

    -- 1. Purge expired decisions
    DELETE FROM public.decision_memory
    WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_decisions_count = ROW_COUNT;

    -- 2. Purge expired actions
    DELETE FROM public.action_tracker
    WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_actions_count = ROW_COUNT;

    -- 3. Purge expired endpoint reports
    DELETE FROM public.endpoint_reports
    WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_reports_count = ROW_COUNT;

    -- 4. Purge expired outputs
    DELETE FROM public.outputs
    WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_outputs_count = ROW_COUNT;

    -- 5. Purge expired projects
    DELETE FROM public.projects
    WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_projects_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Update Permanent Delete Functions to Guard against Active Legal Holds
DROP FUNCTION IF EXISTS public.permanent_delete_project(uuid);
CREATE OR REPLACE FUNCTION public.permanent_delete_project(p_project_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_proj RECORD;
    v_now timestamptz := now();
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT id, user_id, team_id, deleted_at INTO v_proj
    FROM public.projects
    WHERE id = p_project_id;

    IF v_proj.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Project not found');
    END IF;

    IF v_proj.deleted_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active projects cannot be permanently deleted. Soft delete first.');
    END IF;

    IF auth.role() != 'service_role' AND v_proj.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to permanently delete this project');
    END IF;

    -- Legal Hold Check
    IF public.is_record_on_legal_hold(v_proj.user_id, v_proj.team_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot permanently delete: record is subject to active Legal Hold.');
    END IF;

    DELETE FROM public.decision_memory WHERE project_id = p_project_id;
    DELETE FROM public.action_tracker WHERE project_id = p_project_id;
    DELETE FROM public.outputs WHERE project_id = p_project_id;
    DELETE FROM public.transcripts WHERE project_id = p_project_id;
    DELETE FROM public.projects WHERE id = p_project_id;

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'deleted_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.permanent_delete_decision(uuid);
CREATE OR REPLACE FUNCTION public.permanent_delete_decision(p_decision_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_record RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT id, user_id, team_id, deleted_at INTO v_record
    FROM public.decision_memory
    WHERE id = p_decision_id;

    IF v_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Decision not found');
    END IF;

    IF v_record.deleted_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active decisions cannot be permanently deleted. Soft delete first.');
    END IF;

    IF auth.role() != 'service_role' AND v_record.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to permanently delete this decision');
    END IF;

    -- Legal Hold Check
    IF public.is_record_on_legal_hold(v_record.user_id, v_record.team_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot permanently delete: record is subject to active Legal Hold.');
    END IF;

    DELETE FROM public.decision_memory WHERE id = p_decision_id;

    RETURN jsonb_build_object('success', true, 'decision_id', p_decision_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.permanent_delete_action(uuid);
CREATE OR REPLACE FUNCTION public.permanent_delete_action(p_action_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_record RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT id, user_id, team_id, deleted_at INTO v_record
    FROM public.action_tracker
    WHERE id = p_action_id;

    IF v_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Action not found');
    END IF;

    IF v_record.deleted_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active actions cannot be permanently deleted. Soft delete first.');
    END IF;

    IF auth.role() != 'service_role' AND v_record.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to permanently delete this action');
    END IF;

    -- Legal Hold Check
    IF public.is_record_on_legal_hold(v_record.user_id, v_record.team_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot permanently delete: record is subject to active Legal Hold.');
    END IF;

    DELETE FROM public.action_tracker WHERE id = p_action_id;

    RETURN jsonb_build_object('success', true, 'action_id', p_action_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.permanent_delete_endpoint_report(UUID);
CREATE OR REPLACE FUNCTION public.permanent_delete_endpoint_report(p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_report RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT id, user_id, deleted_at INTO v_report
    FROM public.endpoint_reports
    WHERE id = p_report_id;

    IF v_report.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Report not found');
    END IF;

    IF v_report.deleted_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active reports cannot be permanently deleted. Soft delete first.');
    END IF;

    IF auth.role() != 'service_role' AND v_report.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to permanently delete this report');
    END IF;

    -- Legal Hold Check
    IF public.is_record_on_legal_hold(v_report.user_id, NULL) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot permanently delete: record is subject to active Legal Hold.');
    END IF;

    DELETE FROM public.endpoint_reports WHERE id = p_report_id;

    RETURN jsonb_build_object('success', true, 'report_id', p_report_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Enable Row Level Security (RLS) on all Enterprise tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_sso_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_reviews ENABLE ROW LEVEL SECURITY;

-- 17. RLS Policies: organizations
DROP POLICY IF EXISTS "org_select_policy" ON public.organizations;
CREATE POLICY "org_select_policy" ON public.organizations
    FOR SELECT TO authenticated
    USING (
        owner_id = auth.uid() OR
        public.is_organization_member(id, auth.uid())
    );

DROP POLICY IF EXISTS "org_insert_policy" ON public.organizations;
CREATE POLICY "org_insert_policy" ON public.organizations
    FOR INSERT TO authenticated
    WITH CHECK (
        owner_id = auth.uid() AND
        public.can_use_feature(auth.uid(), 'organization_admin')
    );

DROP POLICY IF EXISTS "org_update_policy" ON public.organizations;
CREATE POLICY "org_update_policy" ON public.organizations
    FOR UPDATE TO authenticated
    USING (
        owner_id = auth.uid() OR
        public.get_organization_role(id, auth.uid()) IN ('organization_owner', 'organization_admin')
    );

DROP POLICY IF EXISTS "org_delete_policy" ON public.organizations;
CREATE POLICY "org_delete_policy" ON public.organizations
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- 18. RLS Policies: organization_members
DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
CREATE POLICY "org_members_select" ON public.organization_members
    FOR SELECT TO authenticated
    USING (
        public.is_organization_member(organization_id, auth.uid())
    );

DROP POLICY IF EXISTS "org_members_insert" ON public.organization_members;
CREATE POLICY "org_members_insert" ON public.organization_members
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin')
    );

DROP POLICY IF EXISTS "org_members_update" ON public.organization_members;
CREATE POLICY "org_members_update" ON public.organization_members
    FOR UPDATE TO authenticated
    USING (
        public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin')
    );

DROP POLICY IF EXISTS "org_members_delete" ON public.organization_members;
CREATE POLICY "org_members_delete" ON public.organization_members
    FOR DELETE TO authenticated
    USING (
        public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin')
    );

-- 19. RLS Policies: organization_domains & organization_sso_configs
DROP POLICY IF EXISTS "org_domains_select" ON public.organization_domains;
CREATE POLICY "org_domains_select" ON public.organization_domains
    FOR SELECT TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "org_domains_all" ON public.organization_domains;
CREATE POLICY "org_domains_all" ON public.organization_domains
    FOR ALL TO authenticated
    USING (public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin'));

DROP POLICY IF EXISTS "org_sso_select" ON public.organization_sso_configs;
CREATE POLICY "org_sso_select" ON public.organization_sso_configs
    FOR SELECT TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "org_sso_all" ON public.organization_sso_configs;
CREATE POLICY "org_sso_all" ON public.organization_sso_configs
    FOR ALL TO authenticated
    USING (public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin'));

-- 20. RLS Policies: audit_logs
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        public.is_organization_member(organization_id, auth.uid()) AND
        public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin', 'security_admin')
    );

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- 21. RLS Policies: retention_policies
DROP POLICY IF EXISTS "retention_policies_select" ON public.retention_policies;
CREATE POLICY "retention_policies_select" ON public.retention_policies
    FOR SELECT TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "retention_policies_all" ON public.retention_policies;
CREATE POLICY "retention_policies_all" ON public.retention_policies
    FOR ALL TO authenticated
    USING (public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin', 'compliance_admin'));

-- 22. RLS Policies: legal_holds
DROP POLICY IF EXISTS "legal_holds_select" ON public.legal_holds;
CREATE POLICY "legal_holds_select" ON public.legal_holds
    FOR SELECT TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "legal_holds_all" ON public.legal_holds;
CREATE POLICY "legal_holds_all" ON public.legal_holds
    FOR ALL TO authenticated
    USING (public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin', 'compliance_admin'));

-- 23. RLS Policies: access_reviews
DROP POLICY IF EXISTS "access_reviews_select" ON public.access_reviews;
CREATE POLICY "access_reviews_select" ON public.access_reviews
    FOR SELECT TO authenticated
    USING (
        public.is_organization_member(organization_id, auth.uid()) AND
        public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin', 'security_admin', 'compliance_admin')
    );

DROP POLICY IF EXISTS "access_reviews_all" ON public.access_reviews;
CREATE POLICY "access_reviews_all" ON public.access_reviews
    FOR ALL TO authenticated
    USING (public.get_organization_role(organization_id, auth.uid()) IN ('organization_owner', 'organization_admin', 'security_admin'));

-- 24. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_domains TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_sso_configs TO authenticated, service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_holds TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_reviews TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_organization_role(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_record_on_legal_hold(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_decision(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_action(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_endpoint_report(UUID) TO authenticated, service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 25. Enterprise Administration RPCs & Governance Extensions
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_organization_retention_days(
    p_user_id UUID,
    p_team_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT 'projects'
)
RETURNS INT AS $$
DECLARE
    v_org_id UUID;
    v_retention_days INT;
BEGIN
    IF p_team_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.teams
        WHERE id = p_team_id;
    END IF;

    IF v_org_id IS NULL AND p_user_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.organization_members
        WHERE user_id = p_user_id
        LIMIT 1;

        IF v_org_id IS NULL THEN
            SELECT id INTO v_org_id
            FROM public.organizations
            WHERE owner_id = p_user_id
            LIMIT 1;
        END IF;
    END IF;

    IF v_org_id IS NOT NULL THEN
        SELECT retention_days INTO v_retention_days
        FROM public.retention_policies
        WHERE organization_id = v_org_id AND entity_type = p_entity_type;

        IF v_retention_days IS NOT NULL THEN
            RETURN v_retention_days;
        END IF;
    END IF;

    RETURN 30;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_organization_member_by_email(
    p_organization_id UUID,
    p_email TEXT,
    p_role TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_target_user_id UUID;
    v_member_id UUID;
    v_clean_email TEXT := lower(trim(p_email));
BEGIN
    IF auth.role() != 'service_role' THEN
        v_caller_role := public.get_organization_role(p_organization_id, auth.uid());
        IF v_caller_role NOT IN ('organization_owner', 'organization_admin') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only organization owners and admins can add members.');
        END IF;
    END IF;

    IF p_role NOT IN ('organization_admin', 'security_admin', 'compliance_admin', 'member', 'viewer') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid organization role.');
    END IF;

    SELECT id INTO v_target_user_id
    FROM public.profiles
    WHERE lower(email) = v_clean_email;

    IF v_target_user_id IS NULL THEN
        SELECT id INTO v_target_user_id
        FROM auth.users
        WHERE lower(email) = v_clean_email;
    END IF;

    IF v_target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', format('No user found with email %s. User must have an existing Concludo account.', p_email));
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (p_organization_id, v_target_user_id, p_role)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, updated_at = now()
    RETURNING id INTO v_member_id;

    INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    VALUES (
        p_organization_id,
        auth.uid(),
        'role_change',
        'organization_member',
        v_target_user_id,
        jsonb_build_object('action', 'member_added', 'email', p_email, 'role', p_role)
    );

    RETURN jsonb_build_object('success', true, 'member_id', v_member_id, 'user_id', v_target_user_id, 'role', p_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_set_user_suspension(
    p_organization_id UUID,
    p_target_user_id UUID,
    p_suspended BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_is_target_member BOOLEAN;
    v_target_role TEXT;
BEGIN
    IF auth.role() != 'service_role' THEN
        v_caller_role := public.get_organization_role(p_organization_id, auth.uid());
        IF v_caller_role NOT IN ('organization_owner', 'organization_admin', 'security_admin') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Insufficient organization privileges to modify user suspension.');
        END IF;
    END IF;

    SELECT (
        EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_id = p_organization_id AND user_id = p_target_user_id
        ) OR EXISTS (
            SELECT 1 FROM public.organizations
            WHERE id = p_organization_id AND owner_id = p_target_user_id
        )
    ) INTO v_is_target_member;

    IF NOT v_is_target_member THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user is not a member of this organization.');
    END IF;

    v_target_role := public.get_organization_role(p_organization_id, p_target_user_id);
    IF v_target_role = 'organization_owner' AND p_suspended THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot suspend the organization owner.');
    END IF;

    UPDATE public.profiles
    SET is_suspended = p_suspended,
        updated_at = now()
    WHERE id = p_target_user_id;

    INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    VALUES (
        p_organization_id,
        auth.uid(),
        'admin_action',
        'user_suspension',
        p_target_user_id,
        jsonb_build_object(
            'action', CASE WHEN p_suspended THEN 'user_suspended' ELSE 'user_reactivated' END,
            'target_user_id', p_target_user_id
        )
    );

    RETURN jsonb_build_object('success', true, 'target_user_id', p_target_user_id, 'is_suspended', p_suspended);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.verify_organization_domain(
    p_domain_id UUID,
    p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_domain TEXT;
    v_resolved_org_id UUID;
BEGIN
    SELECT domain, organization_id INTO v_domain, v_resolved_org_id
    FROM public.organization_domains
    WHERE id = p_domain_id;

    IF v_domain IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Domain record not found.');
    END IF;

    IF auth.role() != 'service_role' THEN
        v_caller_role := public.get_organization_role(v_resolved_org_id, auth.uid());
        IF v_caller_role NOT IN ('organization_owner', 'organization_admin') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only organization owners and admins can verify domains.');
        END IF;
    END IF;

    UPDATE public.organization_domains
    SET verified = true
    WHERE id = p_domain_id;

    INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    VALUES (
        v_resolved_org_id,
        auth.uid(),
        'governance_change',
        'organization_domain',
        p_domain_id,
        jsonb_build_object('action', 'domain_verified', 'domain', v_domain)
    );

    RETURN jsonb_build_object('success', true, 'domain_id', p_domain_id, 'domain', v_domain, 'verified', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_organization_retention_days(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_organization_member_by_email(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_suspension(UUID, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_organization_domain(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
