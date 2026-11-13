-- Concludo Video Meeting Centre: Stage 0 Owner Lock Migration (Staging Specification)
-- Replaces hardcoded UUIDs across RLS policies, CHECK constraints, and functions
-- with a single-row setting table and a security-definer helper function.
-- Authority: Business Plan v6.2 (1 November 2026) | Staging Only

-- 1. Create single-row owner configuration table
CREATE TABLE IF NOT EXISTS public.video_centre_owner (
  id integer PRIMARY KEY DEFAULT 1,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  owner_email text NOT NULL,
  configured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_centre_owner_single_row CHECK (id = 1)
);

-- Revoke all permissions on owner configuration table from public
REVOKE ALL ON public.video_centre_owner FROM PUBLIC;
GRANT SELECT ON public.video_centre_owner TO authenticated, service_role;

-- Enable RLS on configuration table: only the verified owner can inspect it
ALTER TABLE public.video_centre_owner ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS video_centre_owner_read ON public.video_centre_owner;
CREATE POLICY video_centre_owner_read ON public.video_centre_owner
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- 2. Security Definer helper function used by RLS and Edge Functions
CREATE OR REPLACE FUNCTION public.is_video_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Read owner_user_id from single-row table
  SELECT owner_user_id INTO v_owner_id FROM public.video_centre_owner WHERE id = 1;
  IF v_owner_id IS NULL THEN
    RETURN false;
  END IF;
  -- Compare caller auth.uid() against single configured owner
  RETURN auth.uid() = v_owner_id;
END;
$$;

-- Protect function permissions: only authenticated callers and service role can invoke
REVOKE ALL ON FUNCTION public.is_video_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_video_owner() TO authenticated, service_role;

-- 3. Staging isolated tables for Video Meeting Centre (Behind video_meeting_centre_v1)
CREATE TABLE IF NOT EXISTS public.video_meeting_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_title text NOT NULL,
  purpose text,
  desired_outcome text,
  company_context jsonb DEFAULT '{}'::jsonb,
  contacts jsonb DEFAULT '[]'::jsonb,
  questions jsonb DEFAULT '[]'::jsonb,
  boundaries jsonb DEFAULT '[]'::jsonb,
  things_not_to_promise jsonb DEFAULT '[]'::jsonb,
  selected_email_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_meeting_preparations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS video_preparations_owner_all ON public.video_meeting_preparations;
CREATE POLICY video_preparations_owner_all ON public.video_meeting_preparations
  FOR ALL TO authenticated
  USING (public.is_video_owner())
  WITH CHECK (public.is_video_owner());

CREATE TABLE IF NOT EXISTS public.video_meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preparation_id uuid REFERENCES public.video_meeting_preparations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_transcript text,
  summary_draft text,
  decisions_draft jsonb DEFAULT '[]'::jsonb,
  actions_draft jsonb DEFAULT '[]'::jsonb,
  open_questions_draft jsonb DEFAULT '[]'::jsonb,
  followup_email_draft text,
  review_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_meeting_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS video_notes_owner_all ON public.video_meeting_notes;
CREATE POLICY video_notes_owner_all ON public.video_meeting_notes
  FOR ALL TO authenticated
  USING (public.is_video_owner())
  WITH CHECK (public.is_video_owner());
