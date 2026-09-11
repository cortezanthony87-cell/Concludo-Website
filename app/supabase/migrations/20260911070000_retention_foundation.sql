-- ==============================================================================
-- Concludo Workspace: Data Retention Foundation Schema
-- Tasklet 11A: Database and Retention Foundation
-- ==============================================================================

-- 1. Add retention fields to projects table
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS purge_after timestamptz;

-- Ensure default active state for projects
ALTER TABLE public.projects ALTER COLUMN deleted_at SET DEFAULT NULL;
ALTER TABLE public.projects ALTER COLUMN deleted_by SET DEFAULT NULL;
ALTER TABLE public.projects ALTER COLUMN purge_after SET DEFAULT NULL;

-- Indexes for performance and future purge workers
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_by ON public.projects(deleted_by);
CREATE INDEX IF NOT EXISTS idx_projects_purge_after ON public.projects(purge_after);

-- 2. Add retention fields to outputs table
ALTER TABLE public.outputs
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS purge_after timestamptz;

-- Ensure default active state for outputs
ALTER TABLE public.outputs ALTER COLUMN deleted_at SET DEFAULT NULL;
ALTER TABLE public.outputs ALTER COLUMN deleted_by SET DEFAULT NULL;
ALTER TABLE public.outputs ALTER COLUMN purge_after SET DEFAULT NULL;

-- Indexes for performance and future purge workers
CREATE INDEX IF NOT EXISTS idx_outputs_deleted_at ON public.outputs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_outputs_deleted_by ON public.outputs(deleted_by);
CREATE INDEX IF NOT EXISTS idx_outputs_purge_after ON public.outputs(purge_after);

-- 3. Grants for authenticated users and service_role
GRANT SELECT, INSERT, UPDATE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.outputs TO authenticated;
GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.outputs TO service_role;

-- 4. Update project update trigger to handle retention lifecycle
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
    END IF;

    -- Lifecycle: Restoration from soft-deleted back to active
    IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        NEW.deleted_by := NULL;
        NEW.purge_after := NULL;
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

DROP TRIGGER IF EXISTS before_project_update ON public.projects;
CREATE TRIGGER before_project_update
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_project_update();

-- 5. Update output update trigger to handle retention lifecycle
CREATE OR REPLACE FUNCTION public.handle_output_update()
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
            RAISE EXCEPTION 'Changing output ownership is not permitted';
        END IF;
        IF NEW.project_id <> OLD.project_id THEN
            RAISE EXCEPTION 'Changing output project association is not permitted';
        END IF;
        IF NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'Changing output creation timestamp is not permitted';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_output_update ON public.outputs;
CREATE TRIGGER before_output_update
    BEFORE UPDATE ON public.outputs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_output_update();
