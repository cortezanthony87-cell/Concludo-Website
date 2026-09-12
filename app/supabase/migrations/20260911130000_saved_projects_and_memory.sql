-- ==============================================================================
-- Concludo Workspace: Saved Projects, Transcript Archive & Meeting Memory
-- Tasklet 13: Saved Projects, Transcript Archive and Meeting Memory Foundation
-- ==============================================================================

-- 1. Add Tasklet 13 required columns to public.projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_name TEXT DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS transcript TEXT DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- 2. Populate client_name and project_name from legacy client_or_project where null
UPDATE public.projects
SET client_name = client_or_project
WHERE client_name IS NULL AND client_or_project IS NOT NULL;

-- 3. Indexes for text search and sorting
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_meeting_date ON public.projects(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_client_name ON public.projects(client_name);
CREATE INDEX IF NOT EXISTS idx_projects_project_name ON public.projects(project_name);

-- 4. Trigger on projects to maintain legacy client_or_project compatibility
CREATE OR REPLACE FUNCTION public.handle_project_compatibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If client_name or project_name provided, keep client_or_project populated for backward compatibility
    IF NEW.client_or_project IS NULL THEN
        NEW.client_or_project := COALESCE(NEW.client_name, NEW.project_name);
    END IF;

    -- If client_or_project provided without client_name, populate client_name
    IF NEW.client_name IS NULL AND NEW.client_or_project IS NOT NULL THEN
        NEW.client_name := NEW.client_or_project;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_compatibility_before_insert ON public.projects;
CREATE TRIGGER trg_project_compatibility_before_insert
    BEFORE INSERT OR UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_project_compatibility();

-- 5. Search Function: search_meeting_history
-- Searches only records owned by current authenticated user (auth.uid())
-- Excludes soft-deleted records (deleted_at is not null)
CREATE OR REPLACE FUNCTION public.search_meeting_history(p_query TEXT)
RETURNS TABLE (
    project_id UUID,
    project_title TEXT,
    match_field TEXT,
    preview TEXT,
    meeting_date DATE,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_user_id UUID;
    v_clean_query TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    v_clean_query := trim(p_query);
    IF length(v_clean_query) = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    -- A. Match on Project Title
    SELECT
        p.id AS project_id,
        p.title AS project_title,
        'Project Title' AS match_field,
        p.title AS preview,
        p.meeting_date,
        p.updated_at
    FROM public.projects p
    WHERE p.user_id = v_user_id
      AND p.deleted_at IS NULL
      AND p.title ILIKE '%' || v_clean_query || '%'

    UNION ALL

    -- B. Match on Client Name
    SELECT
        p.id AS project_id,
        p.title AS project_title,
        'Client Name' AS match_field,
        COALESCE(p.client_name, p.client_or_project, '') AS preview,
        p.meeting_date,
        p.updated_at
    FROM public.projects p
    WHERE p.user_id = v_user_id
      AND p.deleted_at IS NULL
      AND (
          (p.client_name IS NOT NULL AND p.client_name ILIKE '%' || v_clean_query || '%')
          OR (p.client_or_project IS NOT NULL AND p.client_or_project ILIKE '%' || v_clean_query || '%')
      )

    UNION ALL

    -- C. Match on Project Name
    SELECT
        p.id AS project_id,
        p.title AS project_title,
        'Project Name' AS match_field,
        COALESCE(p.project_name, '') AS preview,
        p.meeting_date,
        p.updated_at
    FROM public.projects p
    WHERE p.user_id = v_user_id
      AND p.deleted_at IS NULL
      AND p.project_name IS NOT NULL
      AND p.project_name ILIKE '%' || v_clean_query || '%'

    UNION ALL

    -- D. Match on Project Notes
    SELECT
        p.id AS project_id,
        p.title AS project_title,
        'Notes' AS match_field,
        substring(p.notes FROM greatest(1, position(lower(v_clean_query) in lower(p.notes)) - 40) FOR 160) AS preview,
        p.meeting_date,
        p.updated_at
    FROM public.projects p
    WHERE p.user_id = v_user_id
      AND p.deleted_at IS NULL
      AND p.notes IS NOT NULL
      AND p.notes ILIKE '%' || v_clean_query || '%'

    UNION ALL

    -- E. Match on Project Transcript (directly on projects table)
    SELECT
        p.id AS project_id,
        p.title AS project_title,
        'Transcript' AS match_field,
        substring(p.transcript FROM greatest(1, position(lower(v_clean_query) in lower(p.transcript)) - 40) FOR 160) AS preview,
        p.meeting_date,
        p.updated_at
    FROM public.projects p
    WHERE p.user_id = v_user_id
      AND p.deleted_at IS NULL
      AND p.transcript IS NOT NULL
      AND p.transcript ILIKE '%' || v_clean_query || '%'

    UNION ALL

    -- F. Match on child transcripts table (Tasklet 7 archive)
    SELECT
        p.id AS project_id,
        p.title AS project_title,
        'Transcript Archive' AS match_field,
        substring(t.raw_text FROM greatest(1, position(lower(v_clean_query) in lower(t.raw_text)) - 40) FOR 160) AS preview,
        p.meeting_date,
        p.updated_at
    FROM public.transcripts t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND t.raw_text ILIKE '%' || v_clean_query || '%'
      AND (p.transcript IS NULL OR NOT (p.transcript ILIKE '%' || v_clean_query || '%'))

    UNION ALL

    -- G. Match on Output Content (Tasklet 8 outputs)
    SELECT
        p.id AS project_id,
        p.title AS project_title,
        ('Output: ' || o.output_type) AS match_field,
        substring(o.content FROM greatest(1, position(lower(v_clean_query) in lower(o.content)) - 40) FOR 160) AS preview,
        p.meeting_date,
        o.updated_at
    FROM public.outputs o
    JOIN public.projects p ON p.id = o.project_id
    WHERE o.user_id = v_user_id
      AND o.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND o.content IS NOT NULL
      AND o.content ILIKE '%' || v_clean_query || '%'

    ORDER BY updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.search_meeting_history(TEXT) TO authenticated, service_role;
