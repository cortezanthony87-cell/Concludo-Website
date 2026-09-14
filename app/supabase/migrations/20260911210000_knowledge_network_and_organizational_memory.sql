-- Migration: 20260911210000_knowledge_network_and_organizational_memory.sql
-- Description: Tasklet 21 Knowledge Graph, Organizational Memory Graph, Lessons Learned, and Retention

-- 1. Alter organizations table to support team knowledge graph enablement
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS allow_team_knowledge BOOLEAN NOT NULL DEFAULT false;

-- 2. Knowledge Nodes table
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_type TEXT NOT NULL CHECK (node_type IN (
        'project', 'transcript', 'output', 'decision', 'action',
        'insight', 'risk', 'opportunity', 'recommendation',
        'report', 'forecast', 'team', 'user', 'organization'
    )),
    source_entity_type TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_type ON public.knowledge_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_source ON public.knowledge_nodes(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_owner ON public.knowledge_nodes(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_team ON public.knowledge_nodes(team_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_org ON public.knowledge_nodes(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_deleted_at ON public.knowledge_nodes(deleted_at);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_knowledge_nodes_source'
    ) THEN
        ALTER TABLE public.knowledge_nodes ADD CONSTRAINT uq_knowledge_nodes_source UNIQUE (source_entity_type, source_entity_id);
    END IF;
END $$;

-- 3. Knowledge Relationships table
CREATE TABLE IF NOT EXISTS public.knowledge_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'references', 'related_to', 'depends_on', 'caused_by',
        'resulted_in', 'blocks', 'supports', 'conflicts_with',
        'owned_by', 'assigned_to', 'derived_from', 'influences',
        'contributes_to', 'escalates_to', 'mitigates'
    )),
    confidence_score NUMERIC NOT NULL DEFAULT 85 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    context_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
ALTER TABLE public.knowledge_relationships ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_knowledge_rel_source ON public.knowledge_relationships(source_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_rel_target ON public.knowledge_relationships(target_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_rel_type ON public.knowledge_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_rel_deleted_at ON public.knowledge_relationships(deleted_at);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_knowledge_rel_source_target_type'
    ) THEN
        ALTER TABLE public.knowledge_relationships ADD CONSTRAINT uq_knowledge_rel_source_target_type UNIQUE (source_node_id, target_node_id, relationship_type);
    END IF;
END $$;

-- 4. Lessons Learned table
CREATE TABLE IF NOT EXISTS public.lessons_learned (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    outcome TEXT NOT NULL,
    cluster_category TEXT NOT NULL DEFAULT 'operational_excellence' CHECK (cluster_category IN (
        'customer_delivery',
        'project_governance',
        'product_strategy',
        'operational_excellence',
        'compliance',
        'transformation_programs',
        'risk_management'
    )),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
ALTER TABLE public.lessons_learned ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lessons_learned_org ON public.lessons_learned(organization_id);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_team ON public.lessons_learned(team_id);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_project ON public.lessons_learned(project_id);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_creator ON public.lessons_learned(created_by);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_cluster ON public.lessons_learned(cluster_category);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_deleted_at ON public.lessons_learned(deleted_at);

-- 5. RLS Policies
CREATE POLICY "Users can view authorized knowledge nodes" ON public.knowledge_nodes
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            auth.uid() = owner_id
            OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
            OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        )
    );

CREATE POLICY "Users can insert knowledge nodes" ON public.knowledge_nodes
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update authorized knowledge nodes" ON public.knowledge_nodes
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can delete authorized knowledge nodes" ON public.knowledge_nodes
    FOR DELETE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can view authorized knowledge relationships" ON public.knowledge_relationships
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn
            WHERE kn.id = source_node_id
              AND kn.deleted_at IS NULL
              AND (
                  kn.owner_id = auth.uid()
                  OR (kn.organization_id IS NOT NULL AND is_org_member(kn.organization_id, auth.uid()))
                  OR (kn.team_id IS NOT NULL AND is_team_member(kn.team_id, auth.uid()))
              )
        )
        AND EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn2
            WHERE kn2.id = target_node_id
              AND kn2.deleted_at IS NULL
              AND (
                  kn2.owner_id = auth.uid()
                  OR (kn2.organization_id IS NOT NULL AND is_org_member(kn2.organization_id, auth.uid()))
                  OR (kn2.team_id IS NOT NULL AND is_team_member(kn2.team_id, auth.uid()))
              )
        )
    );

CREATE POLICY "Users can insert knowledge relationships" ON public.knowledge_relationships
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn
            WHERE kn.id = source_node_id
              AND (
                  kn.owner_id = auth.uid()
                  OR (kn.organization_id IS NOT NULL AND is_org_member(kn.organization_id, auth.uid()))
                  OR (kn.team_id IS NOT NULL AND is_team_member(kn.team_id, auth.uid()))
              )
        )
        AND EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn2
            WHERE kn2.id = target_node_id
              AND (
                  kn2.owner_id = auth.uid()
                  OR (kn2.organization_id IS NOT NULL AND is_org_member(kn2.organization_id, auth.uid()))
                  OR (kn2.team_id IS NOT NULL AND is_team_member(kn2.team_id, auth.uid()))
              )
        )
    );

CREATE POLICY "Users can update knowledge relationships" ON public.knowledge_relationships
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn
            WHERE kn.id = source_node_id
              AND (
                  kn.owner_id = auth.uid()
                  OR (kn.organization_id IS NOT NULL AND is_org_admin(kn.organization_id, auth.uid()))
              )
        )
        AND EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn2
            WHERE kn2.id = target_node_id
              AND (
                  kn2.owner_id = auth.uid()
                  OR (kn2.organization_id IS NOT NULL AND is_org_admin(kn2.organization_id, auth.uid()))
              )
        )
    );

CREATE POLICY "Users can delete knowledge relationships" ON public.knowledge_relationships
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn
            WHERE kn.id = source_node_id
              AND (
                  kn.owner_id = auth.uid()
                  OR (kn.organization_id IS NOT NULL AND is_org_admin(kn.organization_id, auth.uid()))
              )
        )
        AND EXISTS (
            SELECT 1 FROM public.knowledge_nodes kn2
            WHERE kn2.id = target_node_id
              AND (
                  kn2.owner_id = auth.uid()
                  OR (kn2.organization_id IS NOT NULL AND is_org_admin(kn2.organization_id, auth.uid()))
              )
        )
    );

CREATE POLICY "Users can view authorized lessons learned" ON public.lessons_learned
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            auth.uid() = created_by
            OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
            OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        )
    );

CREATE POLICY "Users can insert lessons learned" ON public.lessons_learned
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update authorized lessons learned" ON public.lessons_learned
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = created_by
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can delete authorized lessons learned" ON public.lessons_learned
    FOR DELETE TO authenticated
    USING (
        auth.uid() = created_by
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

-- 6. Retention RPC Functions
CREATE OR REPLACE FUNCTION public.soft_delete_knowledge_node(p_node_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_retention_days INT := 30;
    v_org_id UUID;
    v_purge_time TIMESTAMPTZ;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.knowledge_nodes
    WHERE id = p_node_id;

    IF v_org_id IS NOT NULL THEN
        SELECT retention_days INTO v_retention_days
        FROM public.retention_policies
        WHERE organization_id = v_org_id AND entity_type = 'project';
        IF v_retention_days IS NULL THEN v_retention_days := 30; END IF;
    END IF;

    IF v_retention_days = -1 THEN
        v_purge_time := NULL;
    ELSE
        v_purge_time := now() + (v_retention_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.knowledge_nodes
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = v_purge_time,
        updated_at = now()
    WHERE id = p_node_id;

    -- Also soft delete attached relationships
    UPDATE public.knowledge_relationships
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = v_purge_time,
        updated_at = now()
    WHERE source_node_id = p_node_id OR target_node_id = p_node_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_knowledge_node(p_node_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.knowledge_nodes
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_node_id;

    UPDATE public.knowledge_relationships
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE source_node_id = p_node_id OR target_node_id = p_node_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_knowledge_node(p_node_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
    v_owner_id UUID;
    v_team_id UUID;
BEGIN
    SELECT organization_id, owner_id, team_id INTO v_org_id, v_owner_id, v_team_id
    FROM public.knowledge_nodes
    WHERE id = p_node_id;

    -- Legal hold check: strictly block permanent deletion if active legal hold exists
    IF (v_org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.legal_holds WHERE organization_id = v_org_id AND status = 'active'
    )) OR public.is_record_on_legal_hold(v_owner_id, v_team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete record: Active Legal Hold in effect.';
    END IF;

    DELETE FROM public.knowledge_nodes
    WHERE id = p_node_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.soft_delete_lesson_learned(p_lesson_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_retention_days INT := 30;
    v_org_id UUID;
    v_purge_time TIMESTAMPTZ;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.lessons_learned
    WHERE id = p_lesson_id;

    IF v_org_id IS NOT NULL THEN
        SELECT retention_days INTO v_retention_days
        FROM public.retention_policies
        WHERE organization_id = v_org_id AND entity_type = 'project';
        IF v_retention_days IS NULL THEN v_retention_days := 30; END IF;
    END IF;

    IF v_retention_days = -1 THEN
        v_purge_time := NULL;
    ELSE
        v_purge_time := now() + (v_retention_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.lessons_learned
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = v_purge_time,
        updated_at = now()
    WHERE id = p_lesson_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_lesson_learned(p_lesson_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.lessons_learned
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_lesson_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_lesson_learned(p_lesson_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
    v_creator_id UUID;
    v_team_id UUID;
BEGIN
    SELECT organization_id, created_by, team_id INTO v_org_id, v_creator_id, v_team_id
    FROM public.lessons_learned
    WHERE id = p_lesson_id;

    -- Legal hold check: strictly block permanent deletion if active legal hold exists
    IF (v_org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.legal_holds WHERE organization_id = v_org_id AND status = 'active'
    )) OR public.is_record_on_legal_hold(v_creator_id, v_team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete record: Active Legal Hold in effect.';
    END IF;

    DELETE FROM public.lessons_learned
    WHERE id = p_lesson_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update purge_expired_records() to include knowledge nodes, relationships, and lessons learned
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
    v_purged_nodes_count INT := 0;
    v_purged_lessons_count INT := 0;
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

    -- 8. Purge expired workflow approvals (exclude records on legal hold)
    DELETE FROM public.workflow_approvals wa
    WHERE wa.deleted_at IS NOT NULL
      AND wa.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(wa.requester_id, NULL);
    GET DIAGNOSTICS v_purged_approvals_count = ROW_COUNT;

    -- 9. Purge expired executive briefings (exclude records on legal hold)
    DELETE FROM public.executive_briefings eb
    WHERE eb.deleted_at IS NOT NULL
      AND eb.purge_after < v_now
      AND NOT (
          (eb.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = eb.organization_id AND lh.status = 'active'
          ))
          OR public.is_record_on_legal_hold(eb.generated_by, eb.team_id)
      );
    GET DIAGNOSTICS v_purged_briefings_count = ROW_COUNT;

    -- 10. Purge expired predictive snapshots
    DELETE FROM public.predictive_snapshots ps
    WHERE ps.deleted_at IS NOT NULL
      AND ps.purge_after < v_now
      AND NOT (
          (ps.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = ps.organization_id AND lh.status = 'active'
          ))
          OR (ps.user_id IS NOT NULL AND public.is_record_on_legal_hold(ps.user_id, ps.team_id))
      );

    -- 11. Purge expired knowledge nodes (exclude records on legal hold)
    DELETE FROM public.knowledge_nodes kn
    WHERE kn.deleted_at IS NOT NULL
      AND kn.purge_after < v_now
      AND NOT (
          (kn.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.legal_holds lh WHERE lh.organization_id = kn.organization_id AND lh.status = 'active'
          ))
          OR public.is_record_on_legal_hold(kn.owner_id, kn.team_id)
      );
    GET DIAGNOSTICS v_purged_nodes_count = ROW_COUNT;

    -- 12. Purge expired lessons learned (exclude records on legal hold)
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

    RETURN jsonb_build_object(
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count,
        'purged_agent_memory', v_purged_memory_count,
        'purged_workflows', v_purged_workflows_count,
        'purged_approvals', v_purged_approvals_count,
        'purged_executive_briefings', v_purged_briefings_count,
        'purged_knowledge_nodes', v_purged_nodes_count,
        'purged_lessons_learned', v_purged_lessons_count,
        'purged_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.soft_delete_knowledge_node(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_knowledge_node(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_knowledge_node(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_lesson_learned(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_lesson_learned(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_lesson_learned(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_records() TO service_role;
