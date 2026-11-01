-- Phase 1 Additive Migration for Action Command Hub
-- Authorised by Anthony Cortez (1 Nov 2026)
-- Additive only: adds columns and tables without dropping or modifying existing data.

-- 1. Additive columns on action_tracker
ALTER TABLE public.action_tracker
  ADD COLUMN IF NOT EXISTS priority text NULL CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS due_time time without time zone NULL,
  ADD COLUMN IF NOT EXISTS due_timezone text NOT NULL DEFAULT 'Australia/Melbourne',
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS completed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL,
  ADD COLUMN IF NOT EXISTS source_type text NULL,
  ADD COLUMN IF NOT EXISTS source_id text NULL,
  ADD COLUMN IF NOT EXISTS source_url text NULL,
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'manual' CHECK (approval_state IN ('manual', 'approved_from_candidate')),
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS origin_marker text NULL;

CREATE INDEX IF NOT EXISTS idx_action_tracker_owner_status_due ON public.action_tracker(assigned_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_action_tracker_archived ON public.action_tracker(archived_at);

-- 2. Optimistic version increment trigger (separate additive trigger)
CREATE OR REPLACE FUNCTION public.handle_action_tracker_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_tracker_version ON public.action_tracker;
CREATE TRIGGER trg_action_tracker_version
  BEFORE UPDATE ON public.action_tracker
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_action_tracker_version();

-- 3. Auxiliary tables
CREATE TABLE IF NOT EXISTS public.action_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NULL,
  user_id uuid NOT NULL,
  proposed_owner_id uuid NULL,
  proposed_owner_label text NULL,
  title text NOT NULL,
  proposed_priority text NULL CHECK (proposed_priority IN ('high', 'medium', 'low')),
  proposed_due date NULL,
  due_basis text NOT NULL DEFAULT 'none' CHECK (due_basis IN ('stated', 'inferred', 'none')),
  owner_basis text NOT NULL DEFAULT 'unresolved' CHECK (owner_basis IN ('stated', 'inferred', 'unresolved')),
  source_type text NULL,
  source_id text NULL,
  source_revision text NULL,
  source_excerpt text NULL,
  project_id uuid NULL,
  fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'deferred', 'dismissed', 'approved', 'superseded')),
  approved_action_id uuid NULL REFERENCES public.action_tracker(id) ON DELETE SET NULL,
  duplicate_of_action_id uuid NULL REFERENCES public.action_tracker(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_action_candidates_user_state ON public.action_candidates(user_id, state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_candidates_user_fingerprint ON public.action_candidates(user_id, fingerprint);

CREATE TABLE IF NOT EXISTS public.action_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.action_tracker(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id text NOT NULL,
  deep_link text NULL,
  revision text NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_source_links_source ON public.action_source_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_action_source_links_action ON public.action_source_links(action_id);

CREATE TABLE IF NOT EXISTS public.action_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.action_tracker(id) ON DELETE CASCADE,
  system text NOT NULL CHECK (system IN ('calendar', 'crm')),
  external_id text NOT NULL,
  origin_marker text NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'synced', 'failed', 'disconnected')),
  last_error_code text NULL,
  last_synced_at timestamptz NULL,
  authority_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_external_links_action ON public.action_external_links(action_id);

CREATE TABLE IF NOT EXISTS public.action_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NULL,
  action_id uuid NOT NULL REFERENCES public.action_tracker(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'dismissed', 'deferred', 'linked', 'updated_existing', 'kept_separate')),
  edited_fields text[] NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_approval_events_action ON public.action_approval_events(action_id);

CREATE TABLE IF NOT EXISTS public.action_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.action_tracker(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  event text NOT NULL,
  changed_fields jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_audit_events_action ON public.action_audit_events(action_id);

CREATE TABLE IF NOT EXISTS public.action_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.action_tracker(id) ON DELETE CASCADE,
  system text NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_action_sync_jobs_idempotency ON public.action_sync_jobs(idempotency_key);

-- 4. Enable RLS on all new tables
ALTER TABLE public.action_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_candidates' AND policyname = 'action_candidates_owner_all') THEN
    CREATE POLICY action_candidates_owner_all ON public.action_candidates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_source_links' AND policyname = 'action_source_links_owner_select') THEN
    CREATE POLICY action_source_links_owner_select ON public.action_source_links FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_external_links' AND policyname = 'action_external_links_owner_all') THEN
    CREATE POLICY action_external_links_owner_all ON public.action_external_links FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_approval_events' AND policyname = 'action_approval_events_owner_all') THEN
    CREATE POLICY action_approval_events_owner_all ON public.action_approval_events FOR ALL TO authenticated USING (actor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))) WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_audit_events' AND policyname = 'action_audit_events_owner_all') THEN
    CREATE POLICY action_audit_events_owner_all ON public.action_audit_events FOR ALL TO authenticated USING (actor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))) WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_sync_jobs' AND policyname = 'action_sync_jobs_owner_all') THEN
    CREATE POLICY action_sync_jobs_owner_all ON public.action_sync_jobs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.action_tracker t WHERE t.id = action_id AND (t.user_id = auth.uid() OR t.assigned_user_id = auth.uid())));
  END IF;
END $$;
