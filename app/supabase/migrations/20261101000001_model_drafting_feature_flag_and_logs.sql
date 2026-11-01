-- ==============================================================================
-- Migration: Model Drafting Feature Flag & Privacy-Safe Draft Logs (Branch First)
-- Staged on branch feature/day14-engineering-conditions
-- ==============================================================================

-- 1. Feature flag control table: model_drafting_control
CREATE TABLE IF NOT EXISTS public.model_drafting_control (
  id text PRIMARY KEY DEFAULT 'global',
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Allowlist for user-level testing
CREATE TABLE IF NOT EXISTS public.model_drafting_allowlist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.model_drafting_control (id, enabled)
VALUES ('global', false)
ON CONFLICT (id) DO NOTHING;

-- Enforce strict Row Level Security with NO policies for anon or authenticated
-- Only the service_role (and superuser/functions running as SECURITY DEFINER) can read or write
ALTER TABLE public.model_drafting_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_drafting_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages model drafting control"
  ON public.model_drafting_control
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages model drafting allowlist"
  ON public.model_drafting_allowlist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Create privacy-safe draft_logs table: NEVER stores transcript or item text
CREATE TABLE IF NOT EXISTS public.draft_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  validator_drops integer NOT NULL DEFAULT 0,
  dates_nulled integer NOT NULL DEFAULT 0,
  owners_nulled integer NOT NULL DEFAULT 0,
  redactions integer NOT NULL DEFAULT 0,
  drafting_method text NOT NULL CHECK (drafting_method IN ('model', 'basic')),
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_logs_user_month ON public.draft_logs(user_id, created_at);

ALTER TABLE public.draft_logs ENABLE ROW LEVEL SECURITY;

-- Service role and admin only can read/write logs
CREATE POLICY "Service role manages draft logs"
  ON public.draft_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Update can_use_feature with explicit, default-off control for model_drafting
-- Global kill-switch: if global enabled is false, denies everyone immediately!
CREATE OR REPLACE FUNCTION public.can_use_feature(p_user_id uuid, p_feature_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan TEXT;
  v_global_enabled BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_feature_key IS NULL THEN
    RETURN false;
  END IF;

  -- Controlled feature flag: model_drafting (default off for everyone)
  IF p_feature_key = 'model_drafting' THEN
    -- Check global kill-switch first
    SELECT enabled INTO v_global_enabled FROM public.model_drafting_control WHERE id = 'global';
    IF v_global_enabled IS NOT TRUE THEN
      RETURN false; -- Kill switch off denies everyone, including allowlisted users
    END IF;

    -- If global is enabled, check if user is on the allowlist
    IF EXISTS (SELECT 1 FROM public.model_drafting_allowlist WHERE user_id = p_user_id AND enabled = true) THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  v_plan := public.effective_plan_for_user(p_user_id);
  IF v_plan IS NULL THEN
    RETURN false;
  END IF;

  IF v_plan = 'admin' THEN
    RETURN true;
  END IF;

  IF v_plan = 'team' THEN
    RETURN p_feature_key IN (
      'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
      'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
      'insight', 'stats', 'endpoint_report', 'automation_export',
      'saved_projects', 'transcript_archive', 'manual_outputs',
      'next_best_action', 'meeting_health_dashboard',
      'follow_up_email_draft', 'deck_export',
      'team_workspace', 'team_administration', 'shared_projects',
      'shared_decisions', 'shared_actions', 'shared_insights',
      'audit_logging', 'advanced_governance',
      'compliance_controls', 'organization_admin', 'retention_policies',
      'legal_hold', 'security_controls', 'organization_analytics'
    );
  END IF;

  IF v_plan IN ('pro_subscription', 'pro_subscription_trial', 'pro_trial') THEN
    RETURN p_feature_key IN (
      'workspace_basic', 'core_outputs', 'copy_output', 'json_export',
      'meeting_memory', 'decision_memory', 'action_tracker', 'keyword_search',
      'insight', 'stats', 'endpoint_report', 'automation_export',
      'saved_projects', 'transcript_archive', 'manual_outputs',
      'next_best_action', 'meeting_health_dashboard',
      'follow_up_email_draft', 'deck_export'
    );
  END IF;

  IF v_plan IN ('starter', 'starter_trial') THEN
    RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output', 'json_export');
  END IF;

  IF v_plan = 'free_preview' THEN
    RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output');
  END IF;

  RETURN p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_use_feature(UUID, TEXT) TO authenticated, service_role;

-- 4. Create system_alerts table to track spend and operational threshold alerts
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text UNIQUE NOT NULL,
  alert_type text NOT NULL,
  threshold_aud numeric(10, 2),
  actual_spend_aud numeric(10, 2),
  recipient_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages system alerts"
  ON public.system_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
