-- ==============================================================================
-- Concludo Workspace: Row Level Security & Column-Level Privilege Architecture
-- Tasklet 5: Enable Row-Level Security
-- ==============================================================================

-- 1. Ensure RLS is active on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Revoke all permissions from anon (unauthenticated/logged-out visitors)
REVOKE ALL ON public.profiles FROM anon;

-- 3. Reset table-level and column-level privileges for authenticated users
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
-- Grant UPDATE only on allowed fields: full_name and updated_at
GRANT UPDATE (full_name, updated_at) ON public.profiles TO authenticated;

-- Service role retains full administrative privileges for server-side maintenance
GRANT ALL ON public.profiles TO service_role;

-- 4. Clean up existing policies on profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own initial profile" ON public.profiles;

-- 5. Create policy for reading own profile:
-- A logged-in user can select a profile only when: profiles.id = auth.uid()
CREATE POLICY "Users can read their own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (profiles.id = auth.uid());

-- 6. Create policy for updating own profile:
-- A logged-in user can update a profile only when: profiles.id = auth.uid()
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (profiles.id = auth.uid())
    WITH CHECK (profiles.id = auth.uid());

-- 7. Fallback policy for inserting own initial profile on signup
CREATE POLICY "Users can insert their own initial profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        profiles.id = auth.uid()
        AND plan = 'free_preview'
        AND role = 'user'
    );

-- (Note: No DELETE policy is created for authenticated, ensuring users cannot delete their own profile from the app)

-- 8. Enforce trigger for protecting immutable fields (plan, role, email, created_at, id)
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();

    IF auth.role() = 'authenticated' THEN
        IF NEW.plan IS DISTINCT FROM OLD.plan THEN
            RAISE EXCEPTION 'Users are not permitted to change their plan';
        END IF;
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Users are not permitted to change their role';
        END IF;
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Users are not permitted to change their email directly';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Profile ID cannot be changed';
        END IF;
        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Created date cannot be changed';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_profile_update ON public.profiles;
CREATE TRIGGER before_profile_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.protect_profile_fields();

-- 9. Dynamic conditional check for other tables if they already exist
-- (Do not create tables if they do not exist)
DO $$
BEGIN
    -- projects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
        EXECUTE 'ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Users can read their own projects" ON public.projects;';
        EXECUTE 'CREATE POLICY "Users can read their own projects" ON public.projects FOR SELECT TO authenticated USING (projects.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;';
        EXECUTE 'CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (projects.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;';
        EXECUTE 'CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE TO authenticated USING (projects.user_id = auth.uid()) WITH CHECK (projects.user_id = auth.uid());';
    END IF;

    -- transcripts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transcripts') THEN
        EXECUTE 'ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Users can read their own transcripts" ON public.transcripts;';
        EXECUTE 'CREATE POLICY "Users can read their own transcripts" ON public.transcripts FOR SELECT TO authenticated USING (transcripts.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create their own transcripts" ON public.transcripts;';
        EXECUTE 'CREATE POLICY "Users can create their own transcripts" ON public.transcripts FOR INSERT TO authenticated WITH CHECK (transcripts.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their own transcripts" ON public.transcripts;';
        EXECUTE 'CREATE POLICY "Users can update their own transcripts" ON public.transcripts FOR UPDATE TO authenticated USING (transcripts.user_id = auth.uid()) WITH CHECK (transcripts.user_id = auth.uid());';
    END IF;

    -- outputs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outputs') THEN
        EXECUTE 'ALTER TABLE public.outputs ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Users can read their own outputs" ON public.outputs;';
        EXECUTE 'CREATE POLICY "Users can read their own outputs" ON public.outputs FOR SELECT TO authenticated USING (outputs.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create their own outputs" ON public.outputs;';
        EXECUTE 'CREATE POLICY "Users can create their own outputs" ON public.outputs FOR INSERT TO authenticated WITH CHECK (outputs.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their own outputs" ON public.outputs;';
        EXECUTE 'CREATE POLICY "Users can update their own outputs" ON public.outputs FOR UPDATE TO authenticated USING (outputs.user_id = auth.uid()) WITH CHECK (outputs.user_id = auth.uid());';
    END IF;

    -- decisions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'decisions') THEN
        EXECUTE 'ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Users can read their own decisions" ON public.decisions;';
        EXECUTE 'CREATE POLICY "Users can read their own decisions" ON public.decisions FOR SELECT TO authenticated USING (decisions.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create their own decisions" ON public.decisions;';
        EXECUTE 'CREATE POLICY "Users can create their own decisions" ON public.decisions FOR INSERT TO authenticated WITH CHECK (decisions.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their own decisions" ON public.decisions;';
        EXECUTE 'CREATE POLICY "Users can update their own decisions" ON public.decisions FOR UPDATE TO authenticated USING (decisions.user_id = auth.uid()) WITH CHECK (decisions.user_id = auth.uid());';
    END IF;

    -- actions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'actions') THEN
        EXECUTE 'ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Users can read their own actions" ON public.actions;';
        EXECUTE 'CREATE POLICY "Users can read their own actions" ON public.actions FOR SELECT TO authenticated USING (actions.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create their own actions" ON public.actions;';
        EXECUTE 'CREATE POLICY "Users can create their own actions" ON public.actions FOR INSERT TO authenticated WITH CHECK (actions.user_id = auth.uid());';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their own actions" ON public.actions;';
        EXECUTE 'CREATE POLICY "Users can update their own actions" ON public.actions FOR UPDATE TO authenticated USING (actions.user_id = auth.uid()) WITH CHECK (actions.user_id = auth.uid());';
    END IF;

    -- usage_events
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_events') THEN
        EXECUTE 'ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Users can read their own usage events" ON public.usage_events;';
        EXECUTE 'CREATE POLICY "Users can read their own usage events" ON public.usage_events FOR SELECT TO authenticated USING (usage_events.user_id = auth.uid());';
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.usage_events FROM authenticated, anon;';
    END IF;
END $$;
