-- ==============================================================================
-- Concludo Workspace: Outputs Schema & Row Level Security Architecture
-- Tasklet 8: Build Output Records
-- ==============================================================================

-- 1. Create outputs table
CREATE TABLE IF NOT EXISTS public.outputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    output_type text NOT NULL,
    content text,
    json_content jsonb,
    model_used text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT outputs_output_type_check CHECK (output_type IN (
        'summary',
        'action_items',
        'follow_up_email',
        'decision_log',
        'action_plan',
        'endpoint_report'
    )),
    CONSTRAINT outputs_content_or_json_check CHECK (
        (content IS NOT NULL AND length(trim(content)) > 0)
        OR (json_content IS NOT NULL)
    )
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_outputs_user_id ON public.outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_outputs_project_id ON public.outputs(project_id);
CREATE INDEX IF NOT EXISTS idx_outputs_deleted_at ON public.outputs(deleted_at);

-- 3. Enable Row-Level Security
ALTER TABLE public.outputs ENABLE ROW LEVEL SECURITY;

-- 4. Set permissions
-- Revoke all permissions from anon (logged-out visitors)
REVOKE ALL ON public.outputs FROM anon;

-- Authenticated users can SELECT, INSERT, and UPDATE
REVOKE ALL ON public.outputs FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.outputs TO authenticated;

-- Service role retains full administrative privileges
GRANT ALL ON public.outputs TO service_role;

-- 5. Drop existing policies if any
DROP POLICY IF EXISTS "Users can read their own outputs" ON public.outputs;
DROP POLICY IF EXISTS "Users can create their own outputs" ON public.outputs;
DROP POLICY IF EXISTS "Users can update their own outputs" ON public.outputs;

-- 6. Create RLS Policies
-- Logged-in users can read their own outputs
CREATE POLICY "Users can read their own outputs"
    ON public.outputs
    FOR SELECT
    TO authenticated
    USING (outputs.user_id = auth.uid());

-- Logged-in users can create their own outputs, provided the project belongs to them
CREATE POLICY "Users can create their own outputs"
    ON public.outputs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        outputs.user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = outputs.project_id
              AND p.user_id = auth.uid()
              AND p.deleted_at IS NULL
        )
    );

-- Logged-in users can update their own outputs (including soft-delete via deleted_at)
CREATE POLICY "Users can update their own outputs"
    ON public.outputs
    FOR UPDATE
    TO authenticated
    USING (outputs.user_id = auth.uid())
    WITH CHECK (
        outputs.user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = outputs.project_id
              AND p.user_id = auth.uid()
              AND p.deleted_at IS NULL
        )
    );

-- 7. Trigger on insert to ensure project ownership validation
CREATE OR REPLACE FUNCTION public.handle_output_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;

    IF auth.role() = 'authenticated' THEN
        IF NEW.user_id <> auth.uid() THEN
            RAISE EXCEPTION 'Users cannot create outputs for another user';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = NEW.project_id
              AND p.user_id = auth.uid()
              AND p.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Users cannot attach outputs to another user project';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_output_insert ON public.outputs;
CREATE TRIGGER before_output_insert
    BEFORE INSERT ON public.outputs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_output_insert();

-- 8. Trigger on update to refresh updated_at and prevent changing user_id, project_id, or created_at
CREATE OR REPLACE FUNCTION public.handle_output_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at := now();

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
