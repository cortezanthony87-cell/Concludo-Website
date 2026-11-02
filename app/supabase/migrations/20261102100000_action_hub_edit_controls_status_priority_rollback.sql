-- Rollback Migration: 20261102100000_action_hub_edit_controls_status_priority_rollback.sql
-- Restores previous Phase 1 constraints on action_tracker

DROP INDEX IF EXISTS public.idx_action_tracker_priority_rank_due;
DROP FUNCTION IF EXISTS public.get_action_priority_rank(text);

ALTER TABLE public.action_tracker
  DROP CONSTRAINT IF EXISTS action_tracker_priority_check;

ALTER TABLE public.action_tracker
  ADD CONSTRAINT action_tracker_priority_check
  CHECK (priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]));

ALTER TABLE public.action_tracker
  DROP CONSTRAINT IF EXISTS action_tracker_status_check;

ALTER TABLE public.action_tracker
  ADD CONSTRAINT action_tracker_status_check
  CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'blocked'::text, 'overdue'::text]));
