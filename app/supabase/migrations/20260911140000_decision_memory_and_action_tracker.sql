-- ==============================================================================
-- Concludo Workspace: Decision Memory & Action Accountability Tracker
-- Tasklet 14: Keyword Search, Decision Memory and Action Accountability Tracker
-- ==============================================================================

-- 1. Create decision_memory table
CREATE TABLE IF NOT EXISTS public.decision_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    decision_title TEXT NOT NULL,
    decision_summary TEXT DEFAULT NULL,
    decision_reasoning TEXT DEFAULT NULL,
    decision_owner TEXT DEFAULT NULL,
    decision_date DATE DEFAULT CURRENT_DATE,
    source_output_id UUID REFERENCES public.outputs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

-- 2. Create action_tracker table
CREATE TABLE IF NOT EXISTS public.action_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    action_title TEXT NOT NULL,
    action_description TEXT DEFAULT NULL,
    owner_name TEXT DEFAULT NULL,
    due_date DATE DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked', 'overdue')),
    source_output_id UUID REFERENCES public.outputs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

-- 3. Indexes for performance, search, and sorting
CREATE INDEX IF NOT EXISTS idx_decision_memory_user_id ON public.decision_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_memory_project_id ON public.decision_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_decision_memory_deleted_at ON public.decision_memory(deleted_at);
CREATE INDEX IF NOT EXISTS idx_decision_memory_decision_date ON public.decision_memory(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_decision_memory_updated_at ON public.decision_memory(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_tracker_user_id ON public.action_tracker(user_id);
CREATE INDEX IF NOT EXISTS idx_action_tracker_project_id ON public.action_tracker(project_id);
CREATE INDEX IF NOT EXISTS idx_action_tracker_deleted_at ON public.action_tracker(deleted_at);
CREATE INDEX IF NOT EXISTS idx_action_tracker_status ON public.action_tracker(status);
CREATE INDEX IF NOT EXISTS idx_action_tracker_due_date ON public.action_tracker(due_date ASC);
CREATE INDEX IF NOT EXISTS idx_action_tracker_updated_at ON public.action_tracker(updated_at DESC);

-- 4. Triggers on decision_memory for lifecycle & retention
CREATE OR REPLACE FUNCTION public.handle_decision_memory_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at := now();

    -- Lifecycle: Transition from active to soft-deleted
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        IF NEW.deleted_by IS NULL THEN
            NEW.deleted_by := COALESCE(auth.uid(), NEW.user_id);
        END IF;
        IF NEW.purge_after IS NULL THEN
            NEW.purge_after := NEW.deleted_at + interval '30 days';
        END IF;
    END IF;

    -- Lifecycle: Restoration from soft-deleted back to active
    IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        NEW.deleted_by := NULL;
        NEW.purge_after := NULL;
    END IF;

    -- Immutability enforcement for authenticated users
    IF auth.role() = 'authenticated' THEN
        IF NEW.user_id <> OLD.user_id THEN
            RAISE EXCEPTION 'Changing decision record ownership is not permitted';
        END IF;
        IF NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'Changing decision record creation timestamp is not permitted';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decision_memory_update ON public.decision_memory;
CREATE TRIGGER trg_decision_memory_update
    BEFORE UPDATE ON public.decision_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_decision_memory_update();

-- 5. Triggers on action_tracker for lifecycle, retention & automated overdue status
CREATE OR REPLACE FUNCTION public.handle_action_tracker_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at := now();

    -- Automated overdue status: if not completed and due date is in the past
    IF NEW.status <> 'completed' AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
        NEW.status := 'overdue';
    END IF;

    -- Lifecycle: Transition from active to soft-deleted
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        IF NEW.deleted_by IS NULL THEN
            NEW.deleted_by := COALESCE(auth.uid(), NEW.user_id);
        END IF;
        IF NEW.purge_after IS NULL THEN
            NEW.purge_after := NEW.deleted_at + interval '30 days';
        END IF;
    END IF;

    -- Lifecycle: Restoration from soft-deleted back to active
    IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        NEW.deleted_by := NULL;
        NEW.purge_after := NULL;
    END IF;

    -- Immutability enforcement for authenticated users
    IF auth.role() = 'authenticated' THEN
        IF NEW.user_id <> OLD.user_id THEN
            RAISE EXCEPTION 'Changing action record ownership is not permitted';
        END IF;
        IF NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'Changing action record creation timestamp is not permitted';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_tracker_update ON public.action_tracker;
CREATE TRIGGER trg_action_tracker_update
    BEFORE UPDATE ON public.action_tracker
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_action_tracker_update();

-- Auto-overdue trigger on action insert
CREATE OR REPLACE FUNCTION public.handle_action_tracker_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status <> 'completed' AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
        NEW.status := 'overdue';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_tracker_insert ON public.action_tracker;
CREATE TRIGGER trg_action_tracker_insert
    BEFORE INSERT ON public.action_tracker
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_action_tracker_insert();

-- 6. Backend Feature Permission Checks (decision_memory & action_tracker)
CREATE OR REPLACE FUNCTION public.check_decision_memory_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT public.can_use_feature(auth.uid(), 'decision_memory') THEN
            RAISE EXCEPTION 'Feature not available: decision_memory requires Pro plan';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decision_memory_permission ON public.decision_memory;
CREATE TRIGGER trg_decision_memory_permission
    BEFORE INSERT ON public.decision_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.check_decision_memory_permission();

CREATE OR REPLACE FUNCTION public.check_action_tracker_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT public.can_use_feature(auth.uid(), 'action_tracker') THEN
            RAISE EXCEPTION 'Feature not available: action_tracker requires Pro plan';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_tracker_permission ON public.action_tracker;
CREATE TRIGGER trg_action_tracker_permission
    BEFORE INSERT ON public.action_tracker
    FOR EACH ROW
    EXECUTE FUNCTION public.check_action_tracker_permission();

-- 7. Row Level Security Policies
ALTER TABLE public.decision_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_tracker ENABLE ROW LEVEL SECURITY;

-- Decision Memory Policies
DROP POLICY IF EXISTS "Users can view their own non-deleted decision records" ON public.decision_memory;
CREATE POLICY "Users can view their own non-deleted decision records"
    ON public.decision_memory
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL AND public.can_use_feature(auth.uid(), 'decision_memory'));

DROP POLICY IF EXISTS "Users can view their own soft-deleted decision records" ON public.decision_memory;
CREATE POLICY "Users can view their own soft-deleted decision records"
    ON public.decision_memory
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NOT NULL AND public.can_use_feature(auth.uid(), 'decision_memory'));

DROP POLICY IF EXISTS "Users can insert their own decision records" ON public.decision_memory;
CREATE POLICY "Users can insert their own decision records"
    ON public.decision_memory
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.can_use_feature(auth.uid(), 'decision_memory'));

DROP POLICY IF EXISTS "Users can update their own decision records" ON public.decision_memory;
CREATE POLICY "Users can update their own decision records"
    ON public.decision_memory
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND public.can_use_feature(auth.uid(), 'decision_memory'))
    WITH CHECK (user_id = auth.uid());

REVOKE DELETE ON public.decision_memory FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.decision_memory TO authenticated;
GRANT ALL ON public.decision_memory TO service_role;

-- Action Tracker Policies
DROP POLICY IF EXISTS "Users can view their own non-deleted action records" ON public.action_tracker;
CREATE POLICY "Users can view their own non-deleted action records"
    ON public.action_tracker
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL AND public.can_use_feature(auth.uid(), 'action_tracker'));

DROP POLICY IF EXISTS "Users can view their own soft-deleted action records" ON public.action_tracker;
CREATE POLICY "Users can view their own soft-deleted action records"
    ON public.action_tracker
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NOT NULL AND public.can_use_feature(auth.uid(), 'action_tracker'));

DROP POLICY IF EXISTS "Users can insert their own action records" ON public.action_tracker;
CREATE POLICY "Users can insert their own action records"
    ON public.action_tracker
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.can_use_feature(auth.uid(), 'action_tracker'));

DROP POLICY IF EXISTS "Users can update their own action records" ON public.action_tracker;
CREATE POLICY "Users can update their own action records"
    ON public.action_tracker
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND public.can_use_feature(auth.uid(), 'action_tracker'))
    WITH CHECK (user_id = auth.uid());

REVOKE DELETE ON public.action_tracker FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.action_tracker TO authenticated;
GRANT ALL ON public.action_tracker TO service_role;

-- 8. Update Project Update Trigger to cascade soft-delete and restore to decisions and actions
CREATE OR REPLACE FUNCTION public.handle_project_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at := now();

    -- Lifecycle: Transition from active to soft-deleted
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        IF NEW.deleted_by IS NULL THEN
            NEW.deleted_by := COALESCE(auth.uid(), NEW.user_id);
        END IF;
        IF NEW.purge_after IS NULL THEN
            NEW.purge_after := NEW.deleted_at + interval '30 days';
        END IF;

        -- Cascade soft-delete to outputs and transcripts
        UPDATE public.outputs
        SET deleted_at = NEW.deleted_at,
            deleted_by = NEW.deleted_by,
            purge_after = NEW.purge_after
        WHERE project_id = NEW.id AND deleted_at IS NULL;

        UPDATE public.transcripts
        SET deleted_at = NEW.deleted_at
        WHERE project_id = NEW.id AND deleted_at IS NULL;

        -- Cascade soft-delete to decision_memory and action_tracker
        UPDATE public.decision_memory
        SET deleted_at = NEW.deleted_at,
            deleted_by = NEW.deleted_by,
            purge_after = NEW.purge_after
        WHERE project_id = NEW.id AND deleted_at IS NULL;

        UPDATE public.action_tracker
        SET deleted_at = NEW.deleted_at,
            deleted_by = NEW.deleted_by,
            purge_after = NEW.purge_after
        WHERE project_id = NEW.id AND deleted_at IS NULL;
    END IF;

    -- Lifecycle: Restoration from soft-deleted back to active
    IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        NEW.deleted_by := NULL;
        NEW.purge_after := NULL;

        -- Cascade restore to outputs and transcripts
        UPDATE public.outputs
        SET deleted_at = NULL,
            deleted_by = NULL,
            purge_after = NULL
        WHERE project_id = NEW.id;

        UPDATE public.transcripts
        SET deleted_at = NULL
        WHERE project_id = NEW.id;

        -- Cascade restore to decision_memory and action_tracker
        UPDATE public.decision_memory
        SET deleted_at = NULL,
            deleted_by = NULL,
            purge_after = NULL
        WHERE project_id = NEW.id;

        UPDATE public.action_tracker
        SET deleted_at = NULL,
            deleted_by = NULL,
            purge_after = NULL
        WHERE project_id = NEW.id;
    END IF;

    -- Immutability enforcement for authenticated users
    IF auth.role() = 'authenticated' THEN
        IF NEW.user_id <> OLD.user_id THEN
            RAISE EXCEPTION 'Changing project ownership is not permitted';
        END IF;
        IF NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'Changing project creation timestamp is not permitted';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 9. Soft Delete, Restore & Permanent Delete for Decisions & Actions
CREATE OR REPLACE FUNCTION public.soft_delete_decision(p_decision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.decision_memory
    SET deleted_at = now(),
        deleted_by = v_user_id,
        purge_after = now() + interval '30 days',
        updated_at = now()
    WHERE id = p_decision_id
      AND user_id = v_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Decision record not found or already deleted';
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_decision(p_decision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.decision_memory
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_decision_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Decision record not found';
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.permanent_delete_decision(p_decision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_deleted_at timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT deleted_at INTO v_deleted_at
    FROM public.decision_memory
    WHERE id = p_decision_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Decision record not found';
    END IF;

    IF v_deleted_at IS NULL THEN
        RAISE EXCEPTION 'Active records cannot be permanently deleted. Move to Recently Deleted first.';
    END IF;

    DELETE FROM public.decision_memory
    WHERE id = p_decision_id AND user_id = v_user_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_action(p_action_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.action_tracker
    SET deleted_at = now(),
        deleted_by = v_user_id,
        purge_after = now() + interval '30 days',
        updated_at = now()
    WHERE id = p_action_id
      AND user_id = v_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Action record not found or already deleted';
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_action(p_action_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.action_tracker
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_action_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Action record not found';
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.permanent_delete_action(p_action_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_deleted_at timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT deleted_at INTO v_deleted_at
    FROM public.action_tracker
    WHERE id = p_action_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Action record not found';
    END IF;

    IF v_deleted_at IS NULL THEN
        RAISE EXCEPTION 'Active records cannot be permanently deleted. Move to Recently Deleted first.';
    END IF;

    DELETE FROM public.action_tracker
    WHERE id = p_action_id AND user_id = v_user_id;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_decision(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_decision(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_decision(uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.soft_delete_action(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_action(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_action(uuid) TO authenticated, service_role;

-- 10. Update permanent_delete_project to purge decisions and actions
CREATE OR REPLACE FUNCTION public.permanent_delete_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_deleted_at timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT deleted_at INTO v_deleted_at
    FROM public.projects
    WHERE id = p_project_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project not found';
    END IF;

    IF v_deleted_at IS NULL THEN
        RAISE EXCEPTION 'Active projects cannot be permanently deleted. Move to Recently Deleted first.';
    END IF;

    -- Delete cascading records permanently
    DELETE FROM public.decision_memory WHERE project_id = p_project_id;
    DELETE FROM public.action_tracker WHERE project_id = p_project_id;
    DELETE FROM public.outputs WHERE project_id = p_project_id;
    DELETE FROM public.transcripts WHERE project_id = p_project_id;
    DELETE FROM public.projects WHERE id = p_project_id AND user_id = v_user_id;

    RETURN true;
END;
$$;

-- 11. Update Purge Routines to include decision_memory and action_tracker
CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_purged_outputs_count int := 0;
    v_purged_projects_count int := 0;
    v_purged_decisions_count int := 0;
    v_purged_actions_count int := 0;
    v_now timestamptz := now();
BEGIN
    -- 1. Purge expired decisions
    WITH deleted_decisions AS (
        DELETE FROM public.decision_memory
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_decisions_count FROM deleted_decisions;

    -- 2. Purge expired actions
    WITH deleted_actions AS (
        DELETE FROM public.action_tracker
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_actions_count FROM deleted_actions;

    -- 3. Purge expired standalone outputs
    WITH deleted_outputs AS (
        DELETE FROM public.outputs
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_outputs_count FROM deleted_outputs;

    -- 4. Purge cascading records of expired projects
    DELETE FROM public.decision_memory
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL AND purge_after < v_now
    );

    DELETE FROM public.action_tracker
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL AND purge_after < v_now
    );

    DELETE FROM public.transcripts
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL AND purge_after < v_now
    );

    DELETE FROM public.outputs
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL AND purge_after < v_now
    );

    -- 5. Purge expired projects
    WITH deleted_projects AS (
        DELETE FROM public.projects
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_projects_count FROM deleted_projects;

    RETURN jsonb_build_object(
        'success', true,
        'executed_at', v_now,
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_user_expired_records(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_purged_outputs_count int := 0;
    v_purged_projects_count int := 0;
    v_purged_decisions_count int := 0;
    v_purged_actions_count int := 0;
    v_now timestamptz := now();
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
    WITH deleted_decisions AS (
        DELETE FROM public.decision_memory
        WHERE user_id = v_user_id
          AND deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_decisions_count FROM deleted_decisions;

    -- 2. Purge expired actions
    WITH deleted_actions AS (
        DELETE FROM public.action_tracker
        WHERE user_id = v_user_id
          AND deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_actions_count FROM deleted_actions;

    -- 3. Purge expired outputs
    WITH deleted_outputs AS (
        DELETE FROM public.outputs
        WHERE user_id = v_user_id
          AND deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_outputs_count FROM deleted_outputs;

    -- 4. Purge cascading records of expired projects
    DELETE FROM public.decision_memory
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now
    );

    DELETE FROM public.action_tracker
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now
    );

    DELETE FROM public.transcripts
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now
    );

    DELETE FROM public.outputs
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE user_id = v_user_id AND deleted_at IS NOT NULL AND purge_after < v_now
    );

    -- 5. Purge expired projects
    WITH deleted_projects AS (
        DELETE FROM public.projects
        WHERE user_id = v_user_id
          AND deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_projects_count FROM deleted_projects;

    RETURN jsonb_build_object(
        'success', true,
        'executed_at', v_now,
        'user_id', v_user_id,
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count
    );
END;
$$;

-- 12. Comprehensive Keyword Search Function: search_meeting_history
-- Searches across:
-- Project titles, Project names, Client names, Meeting types, Transcripts,
-- Saved outputs, Decision records, and Action records.
-- Returns results ranked by relevance.
-- Rules: Owner only (auth.uid()), deleted_at is null, strict RLS, Pro permission required.
CREATE OR REPLACE FUNCTION public.search_meeting_history(
    p_query TEXT,
    p_type_filter TEXT DEFAULT 'all',
    p_meeting_type TEXT DEFAULT NULL,
    p_client_name TEXT DEFAULT NULL,
    p_project_name TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    project_id UUID,
    record_id UUID,
    project_title TEXT,
    record_type TEXT,
    match_field TEXT,
    preview TEXT,
    meeting_date DATE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    relevance_score INT
) AS $$
DECLARE
    v_user_id UUID;
    v_clean_query TEXT;
    v_filter TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Authoritative backend feature permission check
    IF NOT public.can_use_feature(v_user_id, 'keyword_search') THEN
        RAISE EXCEPTION 'Feature not available: keyword_search requires Pro plan';
    END IF;

    v_clean_query := trim(p_query);
    IF length(v_clean_query) = 0 THEN
        RETURN;
    END IF;

    v_filter := lower(COALESCE(p_type_filter, 'all'));

    RETURN QUERY
    WITH raw_matches AS (
        -- A. PROJECT MATCHES
        SELECT
            p.id AS r_project_id,
            p.id AS r_record_id,
            p.title AS r_project_title,
            'Project'::TEXT AS r_record_type,
            CASE
                WHEN p.title ILIKE '%' || v_clean_query || '%' THEN 'Project Title'
                WHEN p.client_name ILIKE '%' || v_clean_query || '%' OR p.client_or_project ILIKE '%' || v_clean_query || '%' THEN 'Client Name'
                WHEN p.project_name ILIKE '%' || v_clean_query || '%' THEN 'Project Name'
                WHEN p.meeting_type ILIKE '%' || v_clean_query || '%' THEN 'Meeting Type'
                WHEN p.notes ILIKE '%' || v_clean_query || '%' THEN 'Notes'
                ELSE 'Transcript'
            END AS r_match_field,
            CASE
                WHEN p.title ILIKE '%' || v_clean_query || '%' THEN p.title
                WHEN p.client_name ILIKE '%' || v_clean_query || '%' THEN COALESCE(p.client_name, '')
                WHEN p.project_name ILIKE '%' || v_clean_query || '%' THEN COALESCE(p.project_name, '')
                WHEN p.meeting_type ILIKE '%' || v_clean_query || '%' THEN COALESCE(p.meeting_type, '')
                WHEN p.notes ILIKE '%' || v_clean_query || '%' THEN substring(p.notes FROM greatest(1, position(lower(v_clean_query) in lower(p.notes)) - 40) FOR 160)
                WHEN p.transcript ILIKE '%' || v_clean_query || '%' THEN substring(p.transcript FROM greatest(1, position(lower(v_clean_query) in lower(p.transcript)) - 40) FOR 160)
                ELSE p.title
            END AS r_preview,
            p.meeting_date AS r_meeting_date,
            p.created_at AS r_created_at,
            p.updated_at AS r_updated_at,
            CASE
                WHEN p.title ILIKE v_clean_query THEN 100
                WHEN p.title ILIKE '%' || v_clean_query || '%' THEN 90
                WHEN p.project_name ILIKE '%' || v_clean_query || '%' OR p.client_name ILIKE '%' || v_clean_query || '%' THEN 80
                WHEN p.meeting_type ILIKE '%' || v_clean_query || '%' THEN 70
                ELSE 50
            END AS r_relevance
        FROM public.projects p
        WHERE p.user_id = v_user_id
          AND p.deleted_at IS NULL
          AND (v_filter IN ('all', 'projects', 'project'))
          AND (p_meeting_type IS NULL OR p.meeting_type ILIKE '%' || p_meeting_type || '%')
          AND (p_client_name IS NULL OR p.client_name ILIKE '%' || p_client_name || '%' OR p.client_or_project ILIKE '%' || p_client_name || '%')
          AND (p_project_name IS NULL OR p.project_name ILIKE '%' || p_project_name || '%')
          AND (p_start_date IS NULL OR p.meeting_date >= p_start_date)
          AND (p_end_date IS NULL OR p.meeting_date <= p_end_date)
          AND (
              p.title ILIKE '%' || v_clean_query || '%'
              OR (p.client_name IS NOT NULL AND p.client_name ILIKE '%' || v_clean_query || '%')
              OR (p.client_or_project IS NOT NULL AND p.client_or_project ILIKE '%' || v_clean_query || '%')
              OR (p.project_name IS NOT NULL AND p.project_name ILIKE '%' || v_clean_query || '%')
              OR (p.meeting_type IS NOT NULL AND p.meeting_type ILIKE '%' || v_clean_query || '%')
              OR (p.notes IS NOT NULL AND p.notes ILIKE '%' || v_clean_query || '%')
              OR (p.transcript IS NOT NULL AND p.transcript ILIKE '%' || v_clean_query || '%')
          )

        UNION ALL

        -- B. OUTPUT MATCHES
        SELECT
            p.id AS r_project_id,
            o.id AS r_record_id,
            p.title AS r_project_title,
            'Output'::TEXT AS r_record_type,
            ('Output: ' || o.output_type) AS r_match_field,
            substring(o.content FROM greatest(1, position(lower(v_clean_query) in lower(o.content)) - 40) FOR 160) AS r_preview,
            p.meeting_date AS r_meeting_date,
            o.created_at AS r_created_at,
            o.updated_at AS r_updated_at,
            65 AS r_relevance
        FROM public.outputs o
        JOIN public.projects p ON p.id = o.project_id
        WHERE o.user_id = v_user_id
          AND o.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND (v_filter IN ('all', 'outputs', 'output'))
          AND (p_meeting_type IS NULL OR p.meeting_type ILIKE '%' || p_meeting_type || '%')
          AND (p_client_name IS NULL OR p.client_name ILIKE '%' || p_client_name || '%' OR p.client_or_project ILIKE '%' || p_client_name || '%')
          AND (p_project_name IS NULL OR p.project_name ILIKE '%' || p_project_name || '%')
          AND (p_start_date IS NULL OR p.meeting_date >= p_start_date)
          AND (p_end_date IS NULL OR p.meeting_date <= p_end_date)
          AND o.content ILIKE '%' || v_clean_query || '%'

        UNION ALL

        -- C. DECISION MATCHES
        SELECT
            p.id AS r_project_id,
            d.id AS r_record_id,
            p.title AS r_project_title,
            'Decision'::TEXT AS r_record_type,
            CASE
                WHEN d.decision_title ILIKE '%' || v_clean_query || '%' THEN 'Decision: Title'
                WHEN d.decision_owner ILIKE '%' || v_clean_query || '%' THEN 'Decision: Owner'
                WHEN d.decision_summary ILIKE '%' || v_clean_query || '%' THEN 'Decision: Summary'
                ELSE 'Decision: Reasoning'
            END AS r_match_field,
            CASE
                WHEN d.decision_title ILIKE '%' || v_clean_query || '%' THEN d.decision_title
                WHEN d.decision_summary ILIKE '%' || v_clean_query || '%' THEN substring(d.decision_summary FROM greatest(1, position(lower(v_clean_query) in lower(d.decision_summary)) - 40) FOR 160)
                WHEN d.decision_reasoning ILIKE '%' || v_clean_query || '%' THEN substring(d.decision_reasoning FROM greatest(1, position(lower(v_clean_query) in lower(d.decision_reasoning)) - 40) FOR 160)
                ELSE COALESCE(d.decision_owner, d.decision_title)
            END AS r_preview,
            COALESCE(d.decision_date, p.meeting_date) AS r_meeting_date,
            d.created_at AS r_created_at,
            d.updated_at AS r_updated_at,
            CASE
                WHEN d.decision_title ILIKE v_clean_query THEN 95
                WHEN d.decision_title ILIKE '%' || v_clean_query || '%' THEN 85
                ELSE 70
            END AS r_relevance
        FROM public.decision_memory d
        JOIN public.projects p ON p.id = d.project_id
        WHERE d.user_id = v_user_id
          AND d.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND (v_filter IN ('all', 'decisions', 'decision'))
          AND (p_meeting_type IS NULL OR p.meeting_type ILIKE '%' || p_meeting_type || '%')
          AND (p_client_name IS NULL OR p.client_name ILIKE '%' || p_client_name || '%' OR p.client_or_project ILIKE '%' || p_client_name || '%')
          AND (p_project_name IS NULL OR p.project_name ILIKE '%' || p_project_name || '%')
          AND (p_start_date IS NULL OR COALESCE(d.decision_date, p.meeting_date) >= p_start_date)
          AND (p_end_date IS NULL OR COALESCE(d.decision_date, p.meeting_date) <= p_end_date)
          AND (
              d.decision_title ILIKE '%' || v_clean_query || '%'
              OR (d.decision_summary IS NOT NULL AND d.decision_summary ILIKE '%' || v_clean_query || '%')
              OR (d.decision_reasoning IS NOT NULL AND d.decision_reasoning ILIKE '%' || v_clean_query || '%')
              OR (d.decision_owner IS NOT NULL AND d.decision_owner ILIKE '%' || v_clean_query || '%')
          )

        UNION ALL

        -- D. ACTION MATCHES
        SELECT
            p.id AS r_project_id,
            a.id AS r_record_id,
            p.title AS r_project_title,
            'Action'::TEXT AS r_record_type,
            CASE
                WHEN a.action_title ILIKE '%' || v_clean_query || '%' THEN 'Action: Title'
                WHEN a.owner_name ILIKE '%' || v_clean_query || '%' THEN 'Action: Owner'
                WHEN a.status ILIKE '%' || v_clean_query || '%' THEN 'Action: Status'
                ELSE 'Action: Description'
            END AS r_match_field,
            CASE
                WHEN a.action_title ILIKE '%' || v_clean_query || '%' THEN a.action_title
                WHEN a.action_description ILIKE '%' || v_clean_query || '%' THEN substring(a.action_description FROM greatest(1, position(lower(v_clean_query) in lower(a.action_description)) - 40) FOR 160)
                ELSE COALESCE(a.owner_name, a.action_title)
            END AS r_preview,
            COALESCE(a.due_date, p.meeting_date) AS r_meeting_date,
            a.created_at AS r_created_at,
            a.updated_at AS r_updated_at,
            CASE
                WHEN a.action_title ILIKE v_clean_query THEN 95
                WHEN a.action_title ILIKE '%' || v_clean_query || '%' THEN 85
                ELSE 70
            END AS r_relevance
        FROM public.action_tracker a
        JOIN public.projects p ON p.id = a.project_id
        WHERE a.user_id = v_user_id
          AND a.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND (v_filter IN ('all', 'actions', 'action'))
          AND (p_meeting_type IS NULL OR p.meeting_type ILIKE '%' || p_meeting_type || '%')
          AND (p_client_name IS NULL OR p.client_name ILIKE '%' || p_client_name || '%' OR p.client_or_project ILIKE '%' || p_client_name || '%')
          AND (p_project_name IS NULL OR p.project_name ILIKE '%' || p_project_name || '%')
          AND (p_start_date IS NULL OR COALESCE(a.due_date, p.meeting_date) >= p_start_date)
          AND (p_end_date IS NULL OR COALESCE(a.due_date, p.meeting_date) <= p_end_date)
          AND (
              a.action_title ILIKE '%' || v_clean_query || '%'
              OR (a.action_description IS NOT NULL AND a.action_description ILIKE '%' || v_clean_query || '%')
              OR (a.owner_name IS NOT NULL AND a.owner_name ILIKE '%' || v_clean_query || '%')
              OR a.status ILIKE '%' || v_clean_query || '%'
          )
    )
    SELECT
        r_project_id,
        r_record_id,
        r_project_title,
        r_record_type,
        r_match_field,
        r_preview,
        r_meeting_date,
        r_created_at,
        r_updated_at,
        r_relevance
    FROM raw_matches
    ORDER BY r_relevance DESC, r_updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.search_meeting_history(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE) TO authenticated, service_role;

