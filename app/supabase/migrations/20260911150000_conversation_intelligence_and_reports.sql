-- ==============================================================================
-- Concludo Workspace: Conversation Intelligence, Insight, Stats & Endpoint Report
-- Tasklet 15: Conversation Intelligence, Insight, Stats and Endpoint Report
-- ==============================================================================

-- 1. Create endpoint_reports table
CREATE TABLE IF NOT EXISTS public.endpoint_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    report_period TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

-- 2. Create generated_intelligence table for cached/repeatable analysis
CREATE TABLE IF NOT EXISTS public.generated_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    intelligence_type TEXT NOT NULL, -- 'insight', 'stats', 'snapshot'
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT uq_generated_intelligence_user_type UNIQUE (user_id, intelligence_type)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_endpoint_reports_user ON public.endpoint_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_reports_deleted_at ON public.endpoint_reports(deleted_at);
CREATE INDEX IF NOT EXISTS idx_endpoint_reports_created ON public.endpoint_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_intelligence_user ON public.generated_intelligence(user_id, intelligence_type);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.endpoint_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_intelligence ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for endpoint_reports (Owner Only)
DROP POLICY IF EXISTS "endpoint_reports_select_owner" ON public.endpoint_reports;
CREATE POLICY "endpoint_reports_select_owner"
    ON public.endpoint_reports
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "endpoint_reports_insert_owner" ON public.endpoint_reports;
CREATE POLICY "endpoint_reports_insert_owner"
    ON public.endpoint_reports
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "endpoint_reports_update_owner" ON public.endpoint_reports;
CREATE POLICY "endpoint_reports_update_owner"
    ON public.endpoint_reports
    FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "endpoint_reports_delete_owner" ON public.endpoint_reports;
CREATE POLICY "endpoint_reports_delete_owner"
    ON public.endpoint_reports
    FOR DELETE
    USING (auth.uid() = user_id);

-- 6. RLS Policies for generated_intelligence (Owner Only)
DROP POLICY IF EXISTS "generated_intelligence_select_owner" ON public.generated_intelligence;
CREATE POLICY "generated_intelligence_select_owner"
    ON public.generated_intelligence
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "generated_intelligence_insert_owner" ON public.generated_intelligence;
CREATE POLICY "generated_intelligence_insert_owner"
    ON public.generated_intelligence
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "generated_intelligence_update_owner" ON public.generated_intelligence;
CREATE POLICY "generated_intelligence_update_owner"
    ON public.generated_intelligence
    FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "generated_intelligence_delete_owner" ON public.generated_intelligence;
CREATE POLICY "generated_intelligence_delete_owner"
    ON public.generated_intelligence
    FOR DELETE
    USING (auth.uid() = user_id);

-- 7. Database Triggers for Updated At
CREATE OR REPLACE FUNCTION public.handle_endpoint_report_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_endpoint_reports_updated_at ON public.endpoint_reports;
CREATE TRIGGER trg_endpoint_reports_updated_at
    BEFORE UPDATE ON public.endpoint_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_endpoint_report_update();

CREATE OR REPLACE FUNCTION public.handle_generated_intelligence_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generated_intelligence_updated_at ON public.generated_intelligence;
CREATE TRIGGER trg_generated_intelligence_updated_at
    BEFORE UPDATE ON public.generated_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_generated_intelligence_update();

-- 8. Backend-Authoritative Permission Check Triggers
CREATE OR REPLACE FUNCTION public.check_endpoint_report_permission()
RETURNS TRIGGER AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    v_has_permission := public.can_use_feature(NEW.user_id, 'endpoint_report');
    IF NOT v_has_permission THEN
        RAISE EXCEPTION 'Forbidden: Feature "endpoint_report" requires a Pro or higher subscription plan.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_endpoint_report_permission ON public.endpoint_reports;
CREATE TRIGGER trg_check_endpoint_report_permission
    BEFORE INSERT OR UPDATE ON public.endpoint_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.check_endpoint_report_permission();

-- 9. RPC Functions for Endpoint Reports (Soft Delete, Restore, Permanent Delete)
CREATE OR REPLACE FUNCTION public.soft_delete_endpoint_report(p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_updated_rows INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.endpoint_reports
    SET
        deleted_at = now(),
        deleted_by = COALESCE(v_user_id, user_id),
        purge_after = now() + interval '30 days',
        updated_at = now()
    WHERE id = p_report_id
      AND (auth.role() = 'service_role' OR user_id = v_user_id)
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    IF v_updated_rows = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Endpoint report not found or already deleted');
    END IF;

    RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'days_remaining', 30);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_endpoint_report(p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_updated_rows INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.endpoint_reports
    SET
        deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_report_id
      AND (auth.role() = 'service_role' OR user_id = v_user_id)
      AND deleted_at IS NOT NULL;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    IF v_updated_rows = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Endpoint report not found or not deleted');
    END IF;

    RETURN jsonb_build_object('success', true, 'report_id', p_report_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_endpoint_report(p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_deleted_rows INT;
    v_is_deleted TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Active record security guard: ensure report is soft-deleted before permanent delete
    SELECT deleted_at INTO v_is_deleted
    FROM public.endpoint_reports
    WHERE id = p_report_id
      AND (auth.role() = 'service_role' OR user_id = v_user_id);

    IF v_is_deleted IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Active reports cannot be permanently deleted. Soft delete first.'
        );
    END IF;

    DELETE FROM public.endpoint_reports
    WHERE id = p_report_id
      AND (auth.role() = 'service_role' OR user_id = v_user_id)
      AND deleted_at IS NOT NULL;

    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', v_deleted_rows > 0,
        'report_id', p_report_id,
        'deleted_count', v_deleted_rows
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Update Automated Daily Retention Purge Routine to Include Reports
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
    -- 1. Purge expired decisions
    DELETE FROM public.decision_memory
    WHERE deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_decisions_count = ROW_COUNT;

    -- 2. Purge expired actions
    DELETE FROM public.action_tracker
    WHERE deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_actions_count = ROW_COUNT;

    -- 3. Purge expired endpoint reports
    DELETE FROM public.endpoint_reports
    WHERE deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_reports_count = ROW_COUNT;

    -- 4. Purge expired outputs (standalone soft-deleted outputs)
    DELETE FROM public.outputs
    WHERE deleted_at IS NOT NULL AND purge_after < v_now;
    GET DIAGNOSTICS v_purged_outputs_count = ROW_COUNT;

    -- 5. Purge expired projects (cascading automatically deletes associated records)
    DELETE FROM public.projects
    WHERE deleted_at IS NOT NULL AND purge_after < v_now;
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
        'executed_at', v_now,
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.endpoint_reports TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_intelligence TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_endpoint_report(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_endpoint_report(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_endpoint_report(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_records() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_user_expired_records(UUID) TO authenticated, service_role;
