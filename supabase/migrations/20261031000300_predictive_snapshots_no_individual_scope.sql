-- Migration applied to Supabase dikthezsghsssnwtctem on 2026-10-30 with director authorization
-- Purpose: defect D12. Concludo measures work, never people. Remove the 'individual' scope.
-- Preflight: refuses to run if any 'individual' rows exist, so nothing is lost silently.
-- If rows exist, the director decides whether to archive them first. This migration never deletes data.

DO $$
DECLARE n BIGINT;
BEGIN
  SELECT count(*) INTO n FROM public.predictive_snapshots WHERE scope_type = 'individual';
  IF n > 0 THEN
    RAISE EXCEPTION 'Found % predictive_snapshots rows with scope_type individual. Decide what to do with them before running this migration.', n;
  END IF;
END $$;

ALTER TABLE public.predictive_snapshots DROP CONSTRAINT IF EXISTS predictive_snapshots_scope_type_check;
ALTER TABLE public.predictive_snapshots
  ADD CONSTRAINT predictive_snapshots_scope_type_check CHECK (scope_type IN ('organization', 'team'));
