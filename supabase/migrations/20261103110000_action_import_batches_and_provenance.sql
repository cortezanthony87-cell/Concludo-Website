-- Migration: Action Tracker Import Batches & Provenance
-- Feature branch: feat/document-mode-actions-v1 (PR #9)
-- Staging only; not to be applied to production without Anthony's explicit written approval.

-- 0. Action Origin Enum
DO $$ BEGIN
  CREATE TYPE public.action_origin AS ENUM ('stated_in_plan', 'derived_by_reviewer', 'inferred_by_concludo');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Create import_batches table
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NULL,
  source_file text NOT NULL,
  content_hash text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  undone_at timestamp with time zone NULL,
  deleted_by uuid NULL,
  deleted_reason text NULL
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_batches_user_select ON public.import_batches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY import_batches_user_insert ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY import_batches_user_update ON public.import_batches
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_import_batches_user_hash ON public.import_batches(user_id, content_hash);

-- 2. Additive columns on public.action_tracker
ALTER TABLE public.action_tracker
  ADD COLUMN IF NOT EXISTS batch_id uuid NULL,
  ADD COLUMN IF NOT EXISTS origin public.action_origin DEFAULT 'stated_in_plan',
  ADD COLUMN IF NOT EXISTS source_line integer NULL,
  ADD COLUMN IF NOT EXISTS provenance jsonb NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_action_tracker_batch ON public.action_tracker(batch_id) WHERE batch_id IS NOT NULL;
