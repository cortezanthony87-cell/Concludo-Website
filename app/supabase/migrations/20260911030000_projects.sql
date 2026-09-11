-- ==============================================================================
-- Concludo Workspace: Projects Schema & Row Level Security Architecture
-- Tasklet 6: Build Projects
-- ==============================================================================

-- 1. Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    meeting_type text,
    client_or_project text,
    meeting_date date,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);

-- 3. Enable Row-Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 4. Set permissions
-- Revoke all permissions from anon (logged-out visitors)
REVOKE ALL ON public.projects FROM anon;

-- Authenticated users can SELECT, INSERT, and UPDATE
REVOKE ALL ON public.projects FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.projects TO authenticated;

-- Service role retains full administrative privileges
GRANT ALL ON public.projects TO service_role;

-- 5. Drop existing policies if any
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can read their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can soft-delete their own projects" ON public.projects;

-- 6. Create RLS Policies
-- Logged-in users can read their own projects
CREATE POLICY "Users can read their own projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (projects.user_id = auth.uid());

-- Logged-in users can create their own projects
CREATE POLICY "Users can create their own projects"
    ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (projects.user_id = auth.uid());

-- Logged-in users can update their own projects (including soft-delete via deleted_at)
CREATE POLICY "Users can update their own projects"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (projects.user_id = auth.uid())
    WITH CHECK (projects.user_id = auth.uid());

-- 7. Trigger on update to refresh updated_at and prevent changing user_id or created_at
CREATE OR REPLACE FUNCTION public.handle_project_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at := now();

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
