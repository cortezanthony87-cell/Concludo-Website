-- ==============================================================================
-- Concludo Workspace: Soft Delete System Architecture
-- Tasklet 11B: Soft Delete System for Projects and Outputs
-- ==============================================================================

-- 1. Update outputs output_type check constraint to support all required and future types
-- Supported types:
-- - Summary (summary)
-- - Action Items (action_items)
-- - Follow-Up Email (follow_up_email)
-- - Decision Log (decision_log)
-- - Action Plan (action_plan)
-- - Business Plan Draft (business_plan_draft)
-- - Workflow Chart (workflow_chart)
-- - Endpoint Report (endpoint_report)
-- - Future output types (non-empty trimmed string)
ALTER TABLE public.outputs DROP CONSTRAINT IF EXISTS outputs_output_type_check;

ALTER TABLE public.outputs ADD CONSTRAINT outputs_output_type_check CHECK (
    length(trim(output_type)) > 0
);

-- 2. Hard deletion prevention at PostgreSQL permission level
-- Ensure authenticated users and anon can NEVER execute hard DELETE on projects or outputs
REVOKE DELETE ON public.projects FROM anon, authenticated;
REVOKE DELETE ON public.outputs FROM anon, authenticated;
REVOKE DELETE ON public.transcripts FROM anon, authenticated;

-- Service role retains full administrative privileges for automated retention purges
GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.outputs TO service_role;
GRANT ALL ON public.transcripts TO service_role;

-- 3. Confirm retention lifecycle triggers for projects and outputs
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

    -- Lifecycle: Restoration from soft-deleted back to active (for 11C restore flow)
    IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        NEW.deleted_by := NULL;
        NEW.purge_after := NULL;
    END IF;

    -- Ownership and creation timestamp immutability enforcement for authenticated users
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

    -- Lifecycle: Restoration from soft-deleted back to active (for 11C restore flow)
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
