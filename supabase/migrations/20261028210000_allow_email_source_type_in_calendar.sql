-- Allow 'email' as a valid source_type in calendar_items
-- Enables Email Command Centre deadlines and reminders to be saved directly to Concludo Calendar

ALTER TABLE public.calendar_items
  DROP CONSTRAINT IF EXISTS calendar_items_source_type_check;

ALTER TABLE public.calendar_items
  ADD CONSTRAINT calendar_items_source_type_check
  CHECK (source_type = ANY (ARRAY['meeting'::text, 'report'::text, 'project'::text, 'decision_register'::text, 'risk_register'::text, 'board_paper'::text, 'email'::text, 'other'::text]));
