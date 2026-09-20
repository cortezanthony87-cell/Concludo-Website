-- =====================================================================
-- Tasklet 23: Autonomous Strategic Operations, Digital Twin Organization & Executive Command Center
-- Migration: 20260911230000_autonomous_strategic_operations.sql
-- =====================================================================

-- 1. Digital Twin Snapshots / State Table
CREATE TABLE IF NOT EXISTS public.strategic_digital_twins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Enterprise Digital Twin',
    operational_health NUMERIC NOT NULL DEFAULT 80,
    strategic_health NUMERIC NOT NULL DEFAULT 80,
    execution_health NUMERIC NOT NULL DEFAULT 80,
    collaboration_health NUMERIC NOT NULL DEFAULT 80,
    decision_health NUMERIC NOT NULL DEFAULT 80,
    knowledge_health NUMERIC NOT NULL DEFAULT 80,
    risk_exposure NUMERIC NOT NULL DEFAULT 20,
    opportunity_score NUMERIC NOT NULL DEFAULT 75,
    model_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.strategic_digital_twins ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_digital_twins_org ON public.strategic_digital_twins(organization_id);
CREATE INDEX IF NOT EXISTS idx_digital_twins_team ON public.strategic_digital_twins(team_id);
CREATE INDEX IF NOT EXISTS idx_digital_twins_creator ON public.strategic_digital_twins(created_by);
CREATE INDEX IF NOT EXISTS idx_digital_twins_deleted_at ON public.strategic_digital_twins(deleted_at);
CREATE INDEX IF NOT EXISTS idx_digital_twins_updated ON public.strategic_digital_twins(updated_at DESC);

-- 2. Strategic Health Scores Table
CREATE TABLE IF NOT EXISTS public.strategic_health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    overall_score NUMERIC NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    classification TEXT NOT NULL CHECK (classification IN ('Exceptional', 'Strong', 'Stable', 'Watch Required', 'At Risk', 'Critical Attention Required')),
    categories JSONB NOT NULL DEFAULT '{}'::jsonb,
    supporting_rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
    recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.strategic_health_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_strategic_health_org ON public.strategic_health_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_strategic_health_team ON public.strategic_health_scores(team_id);
CREATE INDEX IF NOT EXISTS idx_strategic_health_deleted_at ON public.strategic_health_scores(deleted_at);
CREATE INDEX IF NOT EXISTS idx_strategic_health_created ON public.strategic_health_scores(created_at DESC);

-- 3. Strategic Scenarios & Simulations Table
CREATE TABLE IF NOT EXISTS public.strategic_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    scenario_type TEXT NOT NULL CHECK (scenario_type IN ('delivery_slowdown', 'velocity_improvement', 'action_backlog_surge', 'initiative_delay', 'capacity_expansion', 'custom')),
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    simulation_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_level TEXT NOT NULL DEFAULT 'High' CHECK (confidence_level IN ('Low', 'Moderate', 'High', 'Very High')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.strategic_scenarios ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_strategic_scenarios_org ON public.strategic_scenarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_strategic_scenarios_team ON public.strategic_scenarios(team_id);
CREATE INDEX IF NOT EXISTS idx_strategic_scenarios_creator ON public.strategic_scenarios(created_by);
CREATE INDEX IF NOT EXISTS idx_strategic_scenarios_deleted_at ON public.strategic_scenarios(deleted_at);
CREATE INDEX IF NOT EXISTS idx_strategic_scenarios_created ON public.strategic_scenarios(created_at DESC);

-- 4. Strategic Briefings & Board Reports Table
CREATE TABLE IF NOT EXISTS public.strategic_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    briefing_type TEXT NOT NULL CHECK (briefing_type IN (
        'board_update', 'executive_strategic_briefing', 'quarterly_operating_review',
        'transformation_report', 'enterprise_performance_report', 'risk_review', 'opportunity_review'
    )),
    sections JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.strategic_briefings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_strategic_briefings_org ON public.strategic_briefings(organization_id);
CREATE INDEX IF NOT EXISTS idx_strategic_briefings_team ON public.strategic_briefings(team_id);
CREATE INDEX IF NOT EXISTS idx_strategic_briefings_creator ON public.strategic_briefings(generated_by);
CREATE INDEX IF NOT EXISTS idx_strategic_briefings_deleted_at ON public.strategic_briefings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_strategic_briefings_created ON public.strategic_briefings(created_at DESC);

-- 5. Strategic Alerts Table
CREATE TABLE IF NOT EXISTS public.strategic_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'critical_risk_emerging', 'major_initiative_delayed', 'execution_health_declining',
        'decision_backlog_increasing', 'knowledge_gap_detected', 'strategic_opportunity_identified'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_entity_type TEXT,
    source_entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.strategic_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_strategic_alerts_org ON public.strategic_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_strategic_alerts_team ON public.strategic_alerts(team_id);
CREATE INDEX IF NOT EXISTS idx_strategic_alerts_type ON public.strategic_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_strategic_alerts_dismissed ON public.strategic_alerts(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_strategic_alerts_deleted_at ON public.strategic_alerts(deleted_at);

-- 6. RLS Policies for Digital Twins
CREATE POLICY "Users can view accessible digital twins"
ON public.strategic_digital_twins
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND (
        created_by = auth.uid()
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    )
);

CREATE POLICY "Users can insert digital twins"
ON public.strategic_digital_twins
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = created_by
    AND (organization_id IS NULL OR is_org_member(organization_id, auth.uid()))
);

CREATE POLICY "Users can update own or org digital twins"
ON public.strategic_digital_twins
FOR UPDATE TO authenticated
USING (
    auth.uid() = created_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

CREATE POLICY "Users can delete own or org digital twins"
ON public.strategic_digital_twins
FOR DELETE TO authenticated
USING (
    auth.uid() = created_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

-- 7. RLS Policies for Strategic Health Scores
CREATE POLICY "Users can view accessible strategic health scores"
ON public.strategic_health_scores
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND (
        recorded_by = auth.uid()
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    )
);

CREATE POLICY "Users can insert strategic health scores"
ON public.strategic_health_scores
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = recorded_by
    AND (organization_id IS NULL OR is_org_member(organization_id, auth.uid()))
);

CREATE POLICY "Users can update own or org strategic health scores"
ON public.strategic_health_scores
FOR UPDATE TO authenticated
USING (
    auth.uid() = recorded_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

CREATE POLICY "Users can delete own or org strategic health scores"
ON public.strategic_health_scores
FOR DELETE TO authenticated
USING (
    auth.uid() = recorded_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

-- 8. RLS Policies for Strategic Scenarios
CREATE POLICY "Users can view accessible strategic scenarios"
ON public.strategic_scenarios
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND (
        created_by = auth.uid()
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    )
);

CREATE POLICY "Users can insert strategic scenarios"
ON public.strategic_scenarios
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = created_by
    AND (organization_id IS NULL OR is_org_member(organization_id, auth.uid()))
);

CREATE POLICY "Users can update own or org strategic scenarios"
ON public.strategic_scenarios
FOR UPDATE TO authenticated
USING (
    auth.uid() = created_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

CREATE POLICY "Users can delete own or org strategic scenarios"
ON public.strategic_scenarios
FOR DELETE TO authenticated
USING (
    auth.uid() = created_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

-- 9. RLS Policies for Strategic Briefings
CREATE POLICY "Users can view accessible strategic briefings"
ON public.strategic_briefings
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND (
        generated_by = auth.uid()
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    )
);

CREATE POLICY "Users can insert strategic briefings"
ON public.strategic_briefings
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = generated_by
    AND (organization_id IS NULL OR is_org_member(organization_id, auth.uid()))
);

CREATE POLICY "Users can update own or org strategic briefings"
ON public.strategic_briefings
FOR UPDATE TO authenticated
USING (
    auth.uid() = generated_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

CREATE POLICY "Users can delete own or org strategic briefings"
ON public.strategic_briefings
FOR DELETE TO authenticated
USING (
    auth.uid() = generated_by
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

-- 10. RLS Policies for Strategic Alerts
CREATE POLICY "Users can view accessible strategic alerts"
ON public.strategic_alerts
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND (
        (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    )
);

CREATE POLICY "Users can insert strategic alerts"
ON public.strategic_alerts
FOR INSERT TO authenticated
WITH CHECK (
    organization_id IS NULL OR is_org_member(organization_id, auth.uid())
);

CREATE POLICY "Users can update strategic alerts"
ON public.strategic_alerts
FOR UPDATE TO authenticated
USING (
    (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
);

CREATE POLICY "Users can delete strategic alerts"
ON public.strategic_alerts
FOR DELETE TO authenticated
USING (
    organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid())
);

-- 11. RPC Functions for Retention, Soft-Delete, Restore and Permanent Delete
CREATE OR REPLACE FUNCTION public.soft_delete_strategic_scenario(
    p_scenario_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.strategic_scenarios
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = now() + INTERVAL '30 days',
        updated_at = now()
    WHERE id = p_scenario_id
      AND deleted_at IS NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_strategic_scenario(
    p_scenario_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.strategic_scenarios
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_scenario_id
      AND deleted_at IS NOT NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_strategic_scenario(
    p_scenario_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
BEGIN
    SELECT organization_id, created_by, team_id INTO v_item
    FROM public.strategic_scenarios
    WHERE id = p_scenario_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Strict check: Legal Hold must block permanent deletion
    IF (v_item.organization_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.legal_holds WHERE organization_id = v_item.organization_id AND status = 'active'
    )) OR public.is_record_on_legal_hold(v_item.created_by, v_item.team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete scenario: An active legal hold applies.';
    END IF;

    DELETE FROM public.strategic_scenarios
    WHERE id = p_scenario_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.soft_delete_strategic_briefing(
    p_briefing_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.strategic_briefings
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = now() + INTERVAL '30 days',
        updated_at = now()
    WHERE id = p_briefing_id
      AND deleted_at IS NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_strategic_briefing(
    p_briefing_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.strategic_briefings
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_briefing_id
      AND deleted_at IS NOT NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_strategic_briefing(
    p_briefing_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
BEGIN
    SELECT organization_id, generated_by, team_id INTO v_item
    FROM public.strategic_briefings
    WHERE id = p_briefing_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Strict check: Legal Hold must block permanent deletion
    IF (v_item.organization_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.legal_holds WHERE organization_id = v_item.organization_id AND status = 'active'
    )) OR public.is_record_on_legal_hold(v_item.generated_by, v_item.team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete briefing: An active legal hold applies.';
    END IF;

    DELETE FROM public.strategic_briefings
    WHERE id = p_briefing_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.soft_delete_strategic_digital_twin(
    p_twin_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.strategic_digital_twins
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = now() + INTERVAL '30 days',
        updated_at = now()
    WHERE id = p_twin_id
      AND deleted_at IS NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_strategic_digital_twin(
    p_twin_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.strategic_digital_twins
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_twin_id
      AND deleted_at IS NOT NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_strategic_digital_twin(
    p_twin_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
BEGIN
    SELECT organization_id, created_by, team_id INTO v_item
    FROM public.strategic_digital_twins
    WHERE id = p_twin_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Strict check: Legal Hold must block permanent deletion
    IF (v_item.organization_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.legal_holds WHERE organization_id = v_item.organization_id AND status = 'active'
    )) OR public.is_record_on_legal_hold(v_item.created_by, v_item.team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete digital twin: An active legal hold applies.';
    END IF;

    DELETE FROM public.strategic_digital_twins
    WHERE id = p_twin_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Update purge_expired_records() with Tasklet 23 tables
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
    v_purged_briefings_count INT := 0;
    v_purged_lessons_count INT := 0;
    v_purged_conversations_count INT := 0;
    v_purged_prompts_count INT := 0;
    v_purged_twins_count INT := 0;
    v_purged_scenarios_count INT := 0;
    v_purged_strat_briefings_count INT := 0;
    v_purged_health_scores_count INT := 0;
    v_purged_alerts_count INT := 0;
BEGIN
    DELETE FROM public.decision_memory dm
    WHERE dm.deleted_at IS NOT NULL
      AND dm.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(dm.user_id, dm.team_id);
    GET DIAGNOSTICS v_purged_decisions_count = ROW_COUNT;

    DELETE FROM public.action_tracker at
    WHERE at.deleted_at IS NOT NULL
      AND at.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(at.user_id, at.team_id);
    GET DIAGNOSTICS v_purged_actions_count = ROW_COUNT;

    DELETE FROM public.endpoint_reports er
    WHERE er.deleted_at IS NOT NULL
      AND er.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(er.user_id, NULL);
    GET DIAGNOSTICS v_purged_reports_count = ROW_COUNT;

    DELETE FROM public.outputs o
    WHERE o.deleted_at IS NOT NULL
      AND o.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(o.user_id, NULL);
    GET DIAGNOSTICS v_purged_outputs_count = ROW_COUNT;

    DELETE FROM public.projects p
    WHERE p.deleted_at IS NOT NULL
      AND p.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(p.user_id, p.team_id);
    GET DIAGNOSTICS v_purged_projects_count = ROW_COUNT;

    DELETE FROM public.agent_memory am
    WHERE am.deleted_at IS NOT NULL
      AND am.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(am.owner_id, am.team_id);
    GET DIAGNOSTICS v_purged_memory_count = ROW_COUNT;

    DELETE FROM public.workflows wf
    WHERE wf.deleted_at IS NOT NULL
      AND wf.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(wf.owner_id, wf.team_id);
    GET DIAGNOSTICS v_purged_workflows_count = ROW_COUNT;

    DELETE FROM public.workflow_approvals wa
    WHERE wa.deleted_at IS NOT NULL
      AND wa.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(wa.requester_id, NULL);
    GET DIAGNOSTICS v_purged_approvals_count = ROW_COUNT;

    DELETE FROM public.executive_briefings eb
    WHERE eb.deleted_at IS NOT NULL
      AND eb.purge_after < v_now
      AND NOT (
        (eb.team_id IS NOT NULL AND public.is_record_on_legal_hold(eb.generated_by, eb.team_id))
        OR public.is_record_on_legal_hold(eb.generated_by, NULL)
      );
    GET DIAGNOSTICS v_purged_briefings_count = ROW_COUNT;

    DELETE FROM public.lessons_learned ll
    WHERE ll.deleted_at IS NOT NULL
      AND ll.purge_after < v_now
      AND NOT (
        (ll.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = ll.organization_id AND lh.status = 'active'
        ))
        OR public.is_record_on_legal_hold(ll.created_by, ll.team_id)
      );
    GET DIAGNOSTICS v_purged_lessons_count = ROW_COUNT;

    DELETE FROM public.copilot_conversations cc
    WHERE cc.deleted_at IS NOT NULL
      AND cc.purge_after < v_now
      AND NOT (
        (cc.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = cc.organization_id AND lh.status = 'active'
        ))
        OR public.is_record_on_legal_hold(cc.user_id, cc.team_id)
      );
    GET DIAGNOSTICS v_purged_conversations_count = ROW_COUNT;

    DELETE FROM public.copilot_prompts cp
    WHERE cp.deleted_at IS NOT NULL
      AND cp.purge_after < v_now
      AND NOT (
        (cp.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = cp.organization_id AND lh.status = 'active'
        ))
        OR public.is_record_on_legal_hold(cp.user_id, cp.team_id)
      );
    GET DIAGNOSTICS v_purged_prompts_count = ROW_COUNT;

    DELETE FROM public.strategic_digital_twins sdt
    WHERE sdt.deleted_at IS NOT NULL
      AND sdt.purge_after < v_now
      AND NOT (
        (sdt.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = sdt.organization_id AND lh.status = 'active'
        ))
        OR public.is_record_on_legal_hold(sdt.created_by, sdt.team_id)
      );
    GET DIAGNOSTICS v_purged_twins_count = ROW_COUNT;

    DELETE FROM public.strategic_scenarios ss
    WHERE ss.deleted_at IS NOT NULL
      AND ss.purge_after < v_now
      AND NOT (
        (ss.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = ss.organization_id AND lh.status = 'active'
        ))
        OR public.is_record_on_legal_hold(ss.created_by, ss.team_id)
      );
    GET DIAGNOSTICS v_purged_scenarios_count = ROW_COUNT;

    DELETE FROM public.strategic_briefings sb
    WHERE sb.deleted_at IS NOT NULL
      AND sb.purge_after < v_now
      AND NOT (
        (sb.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = sb.organization_id AND lh.status = 'active'
        ))
        OR public.is_record_on_legal_hold(sb.generated_by, sb.team_id)
      );
    GET DIAGNOSTICS v_purged_strat_briefings_count = ROW_COUNT;

    DELETE FROM public.strategic_health_scores shs
    WHERE shs.deleted_at IS NOT NULL
      AND shs.purge_after < v_now
      AND NOT (
        (shs.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = shs.organization_id AND lh.status = 'active'
        ))
        OR public.is_record_on_legal_hold(shs.recorded_by, shs.team_id)
      );
    GET DIAGNOSTICS v_purged_health_scores_count = ROW_COUNT;

    DELETE FROM public.strategic_alerts sa
    WHERE sa.deleted_at IS NOT NULL
      AND sa.purge_after < v_now
      AND NOT (
        (sa.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = sa.organization_id AND lh.status = 'active'
        ))
        OR (sa.deleted_by IS NOT NULL AND public.is_record_on_legal_hold(sa.deleted_by, sa.team_id))
      );
    GET DIAGNOSTICS v_purged_alerts_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count,
        'purged_agent_memory', v_purged_memory_count,
        'purged_workflows', v_purged_workflows_count,
        'purged_approvals', v_purged_approvals_count,
        'purged_briefings', v_purged_briefings_count,
        'purged_lessons', v_purged_lessons_count,
        'purged_copilot_conversations', v_purged_conversations_count,
        'purged_copilot_prompts', v_purged_prompts_count,
        'purged_digital_twins', v_purged_twins_count,
        'purged_strategic_scenarios', v_purged_scenarios_count,
        'purged_strategic_briefings', v_purged_strat_briefings_count,
        'purged_strategic_health_scores', v_purged_health_scores_count,
        'purged_strategic_alerts', v_purged_alerts_count,
        'purged_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
