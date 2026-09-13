-- Migration: 20260911190000_ai_agents_workflows_and_approvals.sql
-- Description: AI Agents, Workflow Orchestration, Agent Memory, Approvals and Agent Activity

-- 1. Ensure allow_team_agents on organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS allow_team_agents BOOLEAN NOT NULL DEFAULT false;

-- 2. Agent Memory Table
CREATE TABLE IF NOT EXISTS public.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    memory_key TEXT NOT NULL,
    memory_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_memory_owner_id ON public.agent_memory(owner_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_team_id ON public.agent_memory(team_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_org_id ON public.agent_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_type ON public.agent_memory(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_key ON public.agent_memory(memory_key);
CREATE INDEX IF NOT EXISTS idx_agent_memory_deleted_at ON public.agent_memory(deleted_at);

-- 3. Workflows Table
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    trigger_type TEXT NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_type TEXT NOT NULL DEFAULT 'approval_required' CHECK (execution_type IN ('automatic', 'approval_required', 'manual_only')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflows_owner_id ON public.workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflows_team_id ON public.workflows(team_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org_id ON public.workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON public.workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_deleted_at ON public.workflows(deleted_at);

-- 4. Workflow Executions Table
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    triggered_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'requires_approval', 'rejected', 'cancelled')),
    trigger_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    steps_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT DEFAULT NULL,
    execution_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_triggered_by ON public.workflow_executions(triggered_by);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON public.workflow_executions(created_at DESC);

-- 5. Workflow Approvals Table
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    action_type TEXT NOT NULL,
    action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ DEFAULT NULL,
    rejected_at TIMESTAMPTZ DEFAULT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow_id ON public.workflow_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_execution_id ON public.workflow_approvals(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_requester_id ON public.workflow_approvals(requester_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver_id ON public.workflow_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON public.workflow_approvals(status);

-- 6. Agent Activity Table
CREATE TABLE IF NOT EXISTS public.agent_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type TEXT NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending', 'requires_approval', 'skipped')),
    entity_type TEXT DEFAULT NULL,
    entity_id UUID DEFAULT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_activity_agent_type ON public.agent_activity(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_activity_user_id ON public.agent_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_team_id ON public.agent_activity(team_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_org_id ON public.agent_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_created_at ON public.agent_activity(created_at DESC);

-- 7. RLS Policies

-- Agent Memory Policies
CREATE POLICY "Users can view own or team/org agent memory" ON public.agent_memory
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            auth.uid() = owner_id
            OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
            OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
        )
    );

CREATE POLICY "Users can insert own agent memory" ON public.agent_memory
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own agent memory" ON public.agent_memory
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can delete own agent memory" ON public.agent_memory
    FOR DELETE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

-- Workflows Policies
CREATE POLICY "Users can view own or team/org workflows" ON public.workflows
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            auth.uid() = owner_id
            OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
            OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
        )
    );

CREATE POLICY "Users can insert own workflows" ON public.workflows
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own workflows" ON public.workflows
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can delete own workflows" ON public.workflows
    FOR DELETE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

-- Workflow Executions Policies
CREATE POLICY "Users can view own or team/org workflow executions" ON public.workflow_executions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workflows w
            WHERE w.id = workflow_executions.workflow_id
            AND (
                w.owner_id = auth.uid()
                OR (w.team_id IS NOT NULL AND is_team_member(w.team_id, auth.uid()))
                OR (w.organization_id IS NOT NULL AND is_org_member(w.organization_id, auth.uid()))
            )
        )
    );

CREATE POLICY "Users can insert workflow executions" ON public.workflow_executions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = triggered_by);

CREATE POLICY "Users can update workflow executions" ON public.workflow_executions
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = triggered_by
        OR EXISTS (
            SELECT 1 FROM public.workflows w
            WHERE w.id = workflow_executions.workflow_id
            AND (
                w.owner_id = auth.uid()
                OR (w.organization_id IS NOT NULL AND is_org_admin(w.organization_id, auth.uid()))
            )
        )
    );

-- Workflow Approvals Policies
CREATE POLICY "Users can view visible workflow approvals" ON public.workflow_approvals
    FOR SELECT TO authenticated
    USING (
        auth.uid() = requester_id
        OR auth.uid() = approver_id
        OR EXISTS (
            SELECT 1 FROM public.workflows w
            WHERE w.id = workflow_approvals.workflow_id
            AND (
                w.owner_id = auth.uid()
                OR (w.team_id IS NOT NULL AND is_team_member(w.team_id, auth.uid()))
                OR (w.organization_id IS NOT NULL AND is_org_member(w.organization_id, auth.uid()))
            )
        )
    );

CREATE POLICY "Users can insert workflow approvals" ON public.workflow_approvals
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update workflow approvals" ON public.workflow_approvals
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = approver_id
        OR auth.uid() = requester_id
        OR EXISTS (
            SELECT 1 FROM public.workflows w
            WHERE w.id = workflow_approvals.workflow_id
            AND (
                w.owner_id = auth.uid()
                OR (w.organization_id IS NOT NULL AND is_org_admin(w.organization_id, auth.uid()))
            )
        )
    );

-- Agent Activity Policies
CREATE POLICY "Users can view own or team/org agent activity" ON public.agent_activity
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    );

CREATE POLICY "Users can insert agent activity" ON public.agent_activity
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 8. Retention purge update to include Tasklet 19 tables
CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_purged_projects_count INT := 0;
    v_purged_outputs_count INT := 0;
    v_purged_decisions_count INT := 0;
    v_purged_actions_count INT := 0;
    v_purged_reports_count INT := 0;
    v_purged_memory_count INT := 0;
    v_purged_workflows_count INT := 0;
    v_purged_approvals_count INT := 0;
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

    -- 5. Purge expired projects (and cascades outputs, transcripts) (exclude records on legal hold)
    DELETE FROM public.projects p
    WHERE p.deleted_at IS NOT NULL
      AND p.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(p.user_id, p.team_id);
    GET DIAGNOSTICS v_purged_projects_count = ROW_COUNT;

    -- 6. Purge expired agent memory (exclude records on legal hold)
    DELETE FROM public.agent_memory am
    WHERE am.deleted_at IS NOT NULL
      AND am.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(am.owner_id, am.team_id);
    GET DIAGNOSTICS v_purged_memory_count = ROW_COUNT;

    -- 7. Purge expired workflows (exclude records on legal hold)
    DELETE FROM public.workflows wf
    WHERE wf.deleted_at IS NOT NULL
      AND wf.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(wf.owner_id, wf.team_id);
    GET DIAGNOSTICS v_purged_workflows_count = ROW_COUNT;

    -- 8. Purge expired approvals (exclude records on legal hold)
    DELETE FROM public.workflow_approvals wa
    WHERE wa.deleted_at IS NOT NULL
      AND wa.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(wa.requester_id, NULL);
    GET DIAGNOSTICS v_purged_approvals_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count,
        'purged_agent_memory', v_purged_memory_count,
        'purged_workflows', v_purged_workflows_count,
        'purged_approvals', v_purged_approvals_count,
        'purged_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
