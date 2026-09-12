-- ==============================================================================
-- Concludo Workspace: Automated Retention Enforcement & Purge Process
-- Tasklet 11E: Automatic Purge and Settings Integration
-- ==============================================================================

-- 1. System-Wide Automated Purge Function (Service Role & Scheduled Worker)
-- Frequency: Daily
-- Criteria: deleted_at is not null and purge_after < now()
-- Purges: Expired projects and outputs
-- Future-ready for Decision Memory and Action Tracker tables
CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_purged_outputs_count int := 0;
    v_purged_projects_count int := 0;
    v_now timestamptz := now();
BEGIN
    -- 1. Purge expired standalone outputs (or outputs whose parent project is not yet expired)
    WITH deleted_outputs AS (
        DELETE FROM public.outputs
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_outputs_count FROM deleted_outputs;

    -- 2. Purge cascading transcripts of expired projects
    DELETE FROM public.transcripts
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
    );

    -- 3. Purge cascading outputs of expired projects (if any remained)
    DELETE FROM public.outputs
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
    );

    -- 4. Purge expired projects
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
        'purged_outputs', v_purged_outputs_count
    );
END;
$$;

-- 2. User-Scoped Purge Function (Authenticated User Context or Backend Dispatch)
-- Allows purging expired records owned by a user
-- If called by authenticated user, strictly enforces user_id = auth.uid()
-- If called by service_role, purges for specified user_id
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

    -- 1. Purge expired outputs owned by the user
    WITH deleted_outputs AS (
        DELETE FROM public.outputs
        WHERE user_id = v_user_id
          AND deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_outputs_count FROM deleted_outputs;

    -- 2. Purge transcripts belonging to expired projects owned by the user
    DELETE FROM public.transcripts
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE user_id = v_user_id
          AND deleted_at IS NOT NULL
          AND purge_after < v_now
    );

    -- 3. Purge outputs belonging to expired projects owned by the user
    DELETE FROM public.outputs
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE user_id = v_user_id
          AND deleted_at IS NOT NULL
          AND purge_after < v_now
    );

    -- 4. Purge expired projects owned by the user
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
        'purged_outputs', v_purged_outputs_count
    );
END;
$$;

-- 3. Security & Access Permissions
-- System-wide purge can only be executed by service_role (backend worker / cron)
REVOKE EXECUTE ON FUNCTION public.purge_expired_records() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_records() TO service_role;

-- User-scoped purge can be executed by authenticated users for their own records
GRANT EXECUTE ON FUNCTION public.purge_user_expired_records(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.purge_user_expired_records(uuid) FROM anon;

-- 4. Future Team Retention Support Architecture Note:
-- The data model supports retention_policy_days and team_retention_override.
-- When teams/organizations are provisioned in future tasklets, the handle_project_update
-- and handle_output_update triggers will evaluate:
--   v_days := COALESCE(team_policy.retention_policy_days, 30);
--   NEW.purge_after := NEW.deleted_at + make_interval(days => v_days);
