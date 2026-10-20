-- ==============================================================================
-- Migration: User Notifications and Persistent Project Files
-- Scoped to authentic users and organisations with strict RLS
-- ==============================================================================

-- 1. User Notifications Table
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('message', 'email', 'calendar_invitation', 'approval', 'task', 'shared_org_request', 'system_alert')),
    title text NOT NULL,
    summary text NOT NULL,
    source_room text,
    sender_name text,
    target_url text NOT NULL DEFAULT '/dashboard',
    reference_id text,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id, is_read) WHERE deleted_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_notifications FROM anon;
REVOKE ALL ON public.user_notifications FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.user_notifications;
CREATE POLICY "Users can read own notifications"
    ON public.user_notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.user_notifications;
CREATE POLICY "Users can insert own notifications"
    ON public.user_notifications FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.user_notifications;
CREATE POLICY "Users can update own notifications"
    ON public.user_notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.user_notifications;
CREATE POLICY "Users can delete own notifications"
    ON public.user_notifications FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- 2. Project File Storage Table
CREATE TABLE IF NOT EXISTS public.project_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    file_type text NOT NULL DEFAULT 'document',
    mime_type text NOT NULL DEFAULT 'text/plain',
    file_size_bytes bigint NOT NULL DEFAULT 0,
    source text NOT NULL DEFAULT 'device_upload',
    content text,
    storage_path text,
    version integer NOT NULL DEFAULT 1,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON public.project_files(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_files FROM anon;
REVOKE ALL ON public.project_files FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;

DROP POLICY IF EXISTS "Users can read own project files" ON public.project_files;
CREATE POLICY "Users can read own project files"
    ON public.project_files FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_files.project_id AND (
          p.user_id = auth.uid() OR
          (p.team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid()
          ))
        )
      )
    );

DROP POLICY IF EXISTS "Users can insert own project files" ON public.project_files;
CREATE POLICY "Users can insert own project files"
    ON public.project_files FOR INSERT
    TO authenticated
    WITH CHECK (
      user_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_files.project_id AND (
          p.user_id = auth.uid() OR
          (p.team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid()
          ))
        )
      )
    );

DROP POLICY IF EXISTS "Users can update own project files" ON public.project_files;
CREATE POLICY "Users can update own project files"
    ON public.project_files FOR UPDATE
    TO authenticated
    USING (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_files.project_id AND (
          p.user_id = auth.uid() OR
          (p.team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid()
          ))
        )
      )
    );

DROP POLICY IF EXISTS "Users can soft-delete own project files" ON public.project_files;
CREATE POLICY "Users can soft-delete own project files"
    ON public.project_files FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());


-- 3. Storage Bucket and Storage Policies for project-files
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can read own project files" ON storage.objects;
CREATE POLICY "Authenticated users can read own project files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'project-files' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id::text = (storage.foldername(name))[2] AND (
            p.user_id = auth.uid() OR
            (p.team_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.team_members tm
              WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid()
            ))
          )
        )
      )
    );

DROP POLICY IF EXISTS "Authenticated users can upload project files" ON storage.objects;
CREATE POLICY "Authenticated users can upload project files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'project-files' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Authenticated users can update own project files" ON storage.objects;
CREATE POLICY "Authenticated users can update own project files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'project-files' AND
      (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'project-files' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Authenticated users can delete own project files" ON storage.objects;
CREATE POLICY "Authenticated users can delete own project files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'project-files' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
