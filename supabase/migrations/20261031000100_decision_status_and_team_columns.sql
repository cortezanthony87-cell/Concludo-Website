-- Migration applied to Supabase dikthezsghsssnwtctem on 2026-10-30 with director authorization
-- Purpose: give decisions a recorded status and impact so "resolved" can be measured (defect D3),
-- and make sure the team columns the application already writes exist (defect D4 note).
-- Safe by design: every column is nullable or has a default, every statement is idempotent.
-- NULL status means "not recorded". It must never be read as "unresolved".

ALTER TABLE public.decision_memory
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS impact TEXT,
  ADD COLUMN IF NOT EXISTS superseded_by UUID,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  -- The application (decisionClient.saveDecision) already writes these two. The shipped migrations do not
  -- define them. IF NOT EXISTS makes this a no-op if the live database already has them.
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decision_memory_status_check') THEN
    ALTER TABLE public.decision_memory ADD CONSTRAINT decision_memory_status_check
      CHECK (status IS NULL OR status IN ('pending','under_review','approved','implemented','completed','rejected','delayed','superseded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decision_memory_impact_check') THEN
    ALTER TABLE public.decision_memory ADD CONSTRAINT decision_memory_impact_check
      CHECK (impact IS NULL OR impact IN ('low','moderate','high','critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decision_memory_ownership_type_check') THEN
    ALTER TABLE public.decision_memory ADD CONSTRAINT decision_memory_ownership_type_check
      CHECK (ownership_type IN ('personal','team'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decision_memory_superseded_by_fkey') THEN
    ALTER TABLE public.decision_memory ADD CONSTRAINT decision_memory_superseded_by_fkey
      FOREIGN KEY (superseded_by) REFERENCES public.decision_memory(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decision_memory_no_self_supersede') THEN
    ALTER TABLE public.decision_memory ADD CONSTRAINT decision_memory_no_self_supersede
      CHECK (superseded_by IS NULL OR superseded_by <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decision_memory_status ON public.decision_memory(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_decision_memory_team_id ON public.decision_memory(team_id) WHERE team_id IS NOT NULL;
