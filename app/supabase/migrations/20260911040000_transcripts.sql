-- ==============================================================================
-- Concludo Workspace: Transcripts Schema & Row Level Security Architecture
-- Tasklet 7: Build Transcript Archive
-- ==============================================================================

-- 1. Create transcripts table
CREATE TABLE IF NOT EXISTS public.transcripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_text text NOT NULL,
    speaker_labels_detected boolean DEFAULT false NOT NULL,
    source_type text DEFAULT 'pasted' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT transcripts_source_type_check CHECK (source_type IN ('pasted', 'manual', 'imported_later')),
    CONSTRAINT transcripts_raw_text_not_empty CHECK (length(trim(raw_text)) > 0)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON public.transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON public.transcripts(project_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_deleted_at ON public.transcripts(deleted_at);

-- 3. Enable Row-Level Security
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- 4. Set permissions
-- Revoke all permissions from anon (logged-out visitors)
REVOKE ALL ON public.transcripts FROM anon;

-- Authenticated users can SELECT, INSERT, and UPDATE
REVOKE ALL ON public.transcripts FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transcripts TO authenticated;

-- Service role retains full administrative privileges
GRANT ALL ON public.transcripts TO service_role;

-- 5. Drop existing policies if any
DROP POLICY IF EXISTS "Users can read their own transcripts" ON public.transcripts;
DROP POLICY IF EXISTS "Users can create their own transcripts" ON public.transcripts;
DROP POLICY IF EXISTS "Users can update their own transcripts" ON public.transcripts;

-- 6. Create RLS Policies
-- Logged-in users can read their own transcripts
CREATE POLICY "Users can read their own transcripts"
    ON public.transcripts
    FOR SELECT
    TO authenticated
    USING (transcripts.user_id = auth.uid());

-- Logged-in users can create their own transcripts, provided the project belongs to them
CREATE POLICY "Users can create their own transcripts"
    ON public.transcripts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        transcripts.user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = transcripts.project_id
              AND p.user_id = auth.uid()
              AND p.deleted_at IS NULL
        )
    );

-- Logged-in users can update their own transcripts (including soft-delete via deleted_at)
CREATE POLICY "Users can update their own transcripts"
    ON public.transcripts
    FOR UPDATE
    TO authenticated
    USING (transcripts.user_id = auth.uid())
    WITH CHECK (
        transcripts.user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = transcripts.project_id
              AND p.user_id = auth.uid()
              AND p.deleted_at IS NULL
        )
    );

-- 7. Trigger on insert to ensure project ownership validation
CREATE OR REPLACE FUNCTION public.handle_transcript_insert()
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
            RAISE EXCEPTION 'Users cannot create transcripts for another user';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = NEW.project_id
              AND p.user_id = auth.uid()
              AND p.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Users cannot attach transcripts to another user project';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_transcript_insert ON public.transcripts;
CREATE TRIGGER before_transcript_insert
    BEFORE INSERT ON public.transcripts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transcript_insert();

-- 8. Trigger on update to refresh updated_at and prevent changing user_id, project_id, or created_at
CREATE OR REPLACE FUNCTION public.handle_transcript_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at := now();

    IF auth.role() = 'authenticated' THEN
        IF NEW.user_id <> OLD.user_id THEN
            RAISE EXCEPTION 'Changing transcript ownership is not permitted';
        END IF;
        IF NEW.project_id <> OLD.project_id THEN
            RAISE EXCEPTION 'Changing transcript project association is not permitted';
        END IF;
        IF NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'Changing transcript creation timestamp is not permitted';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_transcript_update ON public.transcripts;
CREATE TRIGGER before_transcript_update
    BEFORE UPDATE ON public.transcripts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transcript_update();
