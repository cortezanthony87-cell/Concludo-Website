-- ==============================================================================
-- Migration: Server-side limits & trial expiry enforcement (Branch first)
-- Item C from Day 14 Engineering Conditions
-- ==============================================================================

-- 1. Helper function: monthly_transcripts_used
CREATE OR REPLACE FUNCTION public.monthly_transcripts_used(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer
  FROM public.transcripts
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND created_at >= date_trunc('month', now());
$$;

GRANT EXECUTE ON FUNCTION public.monthly_transcripts_used(uuid) TO authenticated, service_role;

-- 2. Trigger function on projects: enforce read-only after trial expiry
CREATE OR REPLACE FUNCTION public.handle_project_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Users cannot create projects for another user';
    END IF;

    v_plan := public.effective_plan_for_user(auth.uid());

    -- Expired trial / free preview read-only check
    IF v_plan = 'free_preview' THEN
      RAISE EXCEPTION 'Forbidden: Your trial has ended. Existing records are read-only. Please choose a plan to create new projects.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_project_insert ON public.projects;
CREATE TRIGGER before_project_insert
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_project_insert();

-- 3. Update handle_output_insert: enforce read-only after trial expiry + follow_up_email gate
CREATE OR REPLACE FUNCTION public.handle_output_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Users cannot create outputs for another user';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id
        AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Users cannot attach outputs to another user project';
    END IF;

    v_plan := public.effective_plan_for_user(auth.uid());

    -- Expired trial / free preview read-only check
    IF v_plan = 'free_preview' THEN
      RAISE EXCEPTION 'Forbidden: Your trial has ended. Existing records are read-only. Please choose a plan to create new outputs.';
    END IF;

    -- Plan Gate: follow_up_email requires follow_up_email_draft feature (Pro or Team)
    IF NEW.output_type = 'follow_up_email' THEN
      IF NOT public.can_use_feature(auth.uid(), 'follow_up_email_draft') THEN
        RAISE EXCEPTION 'Forbidden: Feature "follow_up_email_draft" requires a Pro or Team subscription plan.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_output_insert ON public.outputs;
CREATE TRIGGER before_output_insert
  BEFORE INSERT ON public.outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_output_insert();

-- 4. Update handle_transcript_insert: enforce read-only after trial expiry + Starter 20 transcripts/month ceiling
CREATE OR REPLACE FUNCTION public.handle_transcript_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan TEXT;
  v_used INTEGER;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Users cannot create transcripts for another user';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id
        AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Users cannot attach transcripts to another user project';
    END IF;

    v_plan := public.effective_plan_for_user(auth.uid());

    -- Expired trial / free preview read-only check
    IF v_plan = 'free_preview' THEN
      RAISE EXCEPTION 'Forbidden: Your trial has ended. Existing records are read-only. Please choose a plan to create new transcripts.';
    END IF;

    -- Starter monthly limit: 20 transcripts per month
    IF v_plan IN ('starter', 'starter_trial') THEN
      v_used := public.monthly_transcripts_used(auth.uid());
      IF v_used >= 20 THEN
        RAISE EXCEPTION 'Forbidden: Monthly transcript limit reached (20 of 20). Starter plans include 20 transcripts per month. Please upgrade to Pro for unlimited transcripts.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_transcript_insert ON public.transcripts;
CREATE TRIGGER before_transcript_insert
  BEFORE INSERT ON public.transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transcript_insert();

