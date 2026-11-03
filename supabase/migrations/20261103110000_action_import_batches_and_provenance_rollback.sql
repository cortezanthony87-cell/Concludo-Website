-- Rollback for 20261103110000_action_import_batches_and_provenance.sql
DROP INDEX IF EXISTS public.idx_action_tracker_batch;
ALTER TABLE public.action_tracker
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS origin,
  DROP COLUMN IF EXISTS source_line,
  DROP COLUMN IF EXISTS provenance,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS deleted_reason,
  DROP COLUMN IF EXISTS purge_after;

DROP TABLE IF EXISTS public.import_batches CASCADE;
DROP TYPE IF EXISTS public.action_origin CASCADE;
