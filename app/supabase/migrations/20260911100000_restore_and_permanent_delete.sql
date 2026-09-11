-- ==============================================================================
-- Concludo Workspace: Record Restoration & Permanent Deletion Architecture
-- Tasklet 11D: Restore & Permanent Deletion
-- ==============================================================================

-- 1. Update Project Lifecycle Trigger to cascade soft-delete and restore to outputs and transcripts
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

-- 2. Restore Project Function
-- Restores a soft-deleted project owned by the authenticated user
-- Sets deleted_at = null, purge_after = null, deleted_by = null
-- Restores associated project outputs and transcripts so they immediately return to:
-- Dashboard, Projects, Search, Transcript Archive, and Outputs
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

    -- Restore project
    UPDATE public.projects
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_project_id
      AND user_id = v_user_id;

    -- Restore associated outputs for this project
    UPDATE public.outputs
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE project_id = p_project_id
      AND user_id = v_user_id;

    -- Restore associated transcripts for this project
    UPDATE public.transcripts
    SET deleted_at = NULL,
        updated_at = now()
    WHERE project_id = p_project_id
      AND user_id = v_user_id;

    RETURN true;
END;
$$;

-- 3. Restore Output Function
-- Restores a soft-deleted output owned by the authenticated user
-- Sets deleted_at = null, purge_after = null, deleted_by = null
-- If the parent project was soft-deleted, restores the parent project as well
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

    -- If parent project was also soft-deleted, restore parent project
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

-- 4. Permanent Delete Project Function
-- Available only from Recently Deleted (deleted_at IS NOT NULL)
-- Performs true database deletion of the project and associated outputs and transcripts
-- Enforces strict ownership (user_id = auth.uid()) so User A cannot delete User B records
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
    DELETE FROM public.outputs WHERE project_id = p_project_id;
    DELETE FROM public.transcripts WHERE project_id = p_project_id;
    DELETE FROM public.projects WHERE id = p_project_id AND user_id = v_user_id;

    RETURN true;
END;
$$;

-- 5. Permanent Delete Output Function
-- Available only from Recently Deleted (deleted_at IS NOT NULL)
-- Performs true database deletion of the output
-- Enforces strict ownership (user_id = auth.uid()) so User A cannot delete User B records
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

-- Set execution permissions
GRANT EXECUTE ON FUNCTION public.restore_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_output(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanent_delete_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanent_delete_output(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restore_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_output(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.permanent_delete_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.permanent_delete_output(uuid) FROM anon;
