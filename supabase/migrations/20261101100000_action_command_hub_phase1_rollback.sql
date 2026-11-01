-- Rollback for Phase 1 Additive Migration
-- Completely safe rollback: leaves all 128 existing rows and their 19 pre-existing columns untouched.

DROP TRIGGER IF EXISTS trg_action_tracker_version ON public.action_tracker;
DROP FUNCTION IF EXISTS public.handle_action_tracker_version();

DROP TABLE IF EXISTS public.action_sync_jobs CASCADE;
DROP TABLE IF EXISTS public.action_audit_events CASCADE;
DROP TABLE IF EXISTS public.action_approval_events CASCADE;
DROP TABLE IF EXISTS public.action_external_links CASCADE;
DROP TABLE IF EXISTS public.action_source_links CASCADE;
DROP TABLE IF EXISTS public.action_candidates CASCADE;

DROP INDEX IF EXISTS public.idx_action_tracker_owner_status_due;
DROP INDEX IF EXISTS public.idx_action_tracker_archived;

ALTER TABLE public.action_tracker
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS due_time,
  DROP COLUMN IF EXISTS due_timezone,
  DROP COLUMN IF EXISTS all_day,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS completed_by,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archived_by,
  DROP COLUMN IF EXISTS source_type,
  DROP COLUMN IF EXISTS source_id,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS approval_state,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS origin_marker;
