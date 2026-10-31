-- PREPARED, NOT RUN. Needs the director's written approval. Version 2 (31 Oct 2026): surgical.
-- Purpose: defect D19. A trigger that overwrites status with 'overdue' for any non-completed past-due action
-- destroys 'blocked' and 'in_progress'. After this migration, status is never overwritten and overdue is computed:
-- due_date before today in Australia/Melbourne, and not completed.
--
-- Why v2: the live database does not match the shipped migration (the live insert trigger function does not exist,
-- and the live update function has extra logic around it). v1 replaced whole function bodies from the shipped file, which could
-- have removed live logic. v2 reads the LIVE definition, removes only the overdue-overwrite block, and re-creates it.
--   * If the live function has no overdue block, it is left untouched (a NOTICE is raised).
--   * If it has one in a form this migration does not recognise, the migration stops with an error and changes nothing.
--   * It never creates handle_action_tracker_insert; it only edits it if it already exists.
-- BEFORE RUNNING: save the output of pg_get_functiondef for each function (this is the rollback source).
-- Rows already overwritten to 'overdue' cannot be recovered (the earlier status was not kept).
-- The 'overdue' value stays in the CHECK list so existing rows remain valid.

CREATE OR REPLACE FUNCTION public.is_action_overdue(p_status TEXT, p_due_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_status IS DISTINCT FROM 'completed'
     AND p_due_date IS NOT NULL
     AND p_due_date < (now() AT TIME ZONE 'Australia/Melbourne')::date;
$$;

DO $$
DECLARE
  fname TEXT;
  def TEXT;
  new_def TEXT;
  block_re CONSTANT TEXT :=
    'IF\s+NEW\.status\s*<>\s*''completed''\s+AND\s+NEW\.due_date\s+IS\s+NOT\s+NULL\s+AND\s+NEW\.due_date\s*<\s*CURRENT_DATE\s+THEN\s+NEW\.status\s*:=\s*''overdue'';\s+END\s+IF;';
BEGIN
  FOREACH fname IN ARRAY ARRAY['handle_action_tracker_update', 'handle_action_tracker_insert'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO def
      FROM pg_proc p WHERE p.proname = fname AND p.pronamespace = 'public'::regnamespace;
    IF def IS NULL THEN
      RAISE NOTICE '% does not exist; nothing to change', fname;
      CONTINUE;
    END IF;
    IF def !~ 'NEW\.status\s*:=\s*''overdue''' THEN
      RAISE NOTICE '% has no overdue overwrite; left unchanged', fname;
      CONTINUE;
    END IF;
    new_def := regexp_replace(def, block_re, '-- (Removed) automated overdue status. Use public.is_action_overdue(status, due_date).', 'g');
    IF new_def = def OR new_def ~ 'NEW\.status\s*:=\s*''overdue''' THEN
      RAISE EXCEPTION '% has an overdue overwrite in a form this migration does not recognise; nothing changed. Review the live definition.', fname;
    END IF;
    EXECUTE new_def;
    RAISE NOTICE '% updated: overdue overwrite removed', fname;
  END LOOP;
END $$;
