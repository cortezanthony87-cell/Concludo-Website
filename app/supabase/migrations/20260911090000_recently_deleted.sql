-- ==============================================================================
-- Concludo Workspace: Recently Deleted & Permanent Deletion Architecture
-- Tasklet 11C: Recently Deleted Experience, Restore, and Permanent Deletion
-- ==============================================================================

-- 1. Restore Project Function
-- Restores a soft-deleted project owned by the authenticated user
-- Idempotent: If already active, returns true gracefully
CREATE OR REPLACE FUNCTION public.restore_project(p_project_id uuid)
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
        RETURN true;
    END IF;

    UPDATE public.projects
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_project_id
      AND user_id = v_user_id;

    RETURN true;
END;
$$;

-- 2. Restore Output Function
-- Restores a soft-deleted output owned by the authenticated user
-- If the parent project was also soft-deleted, restores the project as well
-- Idempotent: If already active, returns true gracefully
CREATE OR REPLACE FUNCTION public.restore_output(p_output_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_project_id uuid;
    v_deleted_at timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT project_id, deleted_at INTO v_project_id, v_deleted_at
    FROM public.outputs
    WHERE id = p_output_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Output not found';
    END IF;

    IF v_deleted_at IS NULL THEN
        RETURN true;
    END IF;

    -- If parent project is also soft-deleted, restore parent project
    UPDATE public.projects
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = v_project_id
      AND user_id = v_user_id
      AND deleted_at IS NOT NULL;

    -- Restore output
    UPDATE public.outputs
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_output_id
      AND user_id = v_user_id;

    RETURN true;
END;
$$;

-- 3. Permanent Delete Project Function
-- Permanently deletes a project from Recently Deleted
-- STRICT GUARD: Only allows hard delete if deleted_at IS NOT NULL (cannot hard-delete active projects)
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

    -- Delete cascading records
    DELETE FROM public.outputs WHERE project_id = p_project_id;
    DELETE FROM public.transcripts WHERE project_id = p_project_id;
    DELETE FROM public.projects WHERE id = p_project_id AND user_id = v_user_id;

    RETURN true;
END;
$$;

-- 4. Permanent Delete Output Function
-- Permanently deletes an output from Recently Deleted
-- STRICT GUARD: Only allows hard delete if deleted_at IS NOT NULL (cannot hard-delete active outputs)
CREATE OR REPLACE FUNCTION public.permanent_delete_output(p_output_id uuid)
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
    FROM public.outputs
    WHERE id = p_output_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Output not found';
    END IF;

    IF v_deleted_at IS NULL THEN
        RAISE EXCEPTION 'Active outputs cannot be permanently deleted. Move to Recently Deleted first.';
    END IF;

    DELETE FROM public.outputs WHERE id = p_output_id AND user_id = v_user_id;

    RETURN true;
END;
$$;

-- 5. Set function execution privileges
GRANT EXECUTE ON FUNCTION public.restore_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_output(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanent_delete_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanent_delete_output(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restore_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_output(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.permanent_delete_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.permanent_delete_output(uuid) FROM anon;
