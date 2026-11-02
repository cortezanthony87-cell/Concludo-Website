-- Migration: 20261102100000_action_hub_edit_controls_status_priority.sql
-- Action Command Hub v1 edit controls addendum (2 Nov 2026)
-- STAGING FIRST. Do not execute in production without Anthony Cortez's written approval.
--
-- Purpose:
-- 1. Updates action_tracker_status_check to add 'waiting'
--    Allowed statuses: 'not_started', 'in_progress', 'completed', 'waiting', 'blocked', 'overdue'
-- 2. Updates action_tracker_priority_check to add 'normal'
--    Allowed priorities: 'high', 'medium', 'normal', 'low'
-- 3. Adds deterministic priority ranking function and composite index for query ordering:
--    High -> Medium -> Normal -> Low, then due_date ASC NULLS LAST, then created_at ASC

-- 1. Status check constraint update
ALTER TABLE public.action_tracker
  DROP CONSTRAINT IF EXISTS action_tracker_status_check;

ALTER TABLE public.action_tracker
  ADD CONSTRAINT action_tracker_status_check
  CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'waiting'::text, 'blocked'::text, 'overdue'::text]));

-- 2. Priority check constraint update
ALTER TABLE public.action_tracker
  DROP CONSTRAINT IF EXISTS action_tracker_priority_check;

ALTER TABLE public.action_tracker
  ADD CONSTRAINT action_tracker_priority_check
  CHECK (priority = ANY (ARRAY['high'::text, 'medium'::text, 'normal'::text, 'low'::text]));

-- 3. Deterministic priority rank function and ordering index
CREATE OR REPLACE FUNCTION public.get_action_priority_rank(p_priority text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(COALESCE(p_priority, 'normal'))
    WHEN 'high' THEN 0
    WHEN 'medium' THEN 1
    WHEN 'normal' THEN 2
    WHEN 'low' THEN 3
    ELSE 2
  END;
$$;

CREATE INDEX IF NOT EXISTS idx_action_tracker_priority_rank_due
  ON public.action_tracker(
    public.get_action_priority_rank(priority),
    due_date ASC NULLS LAST,
    created_at ASC
  );
