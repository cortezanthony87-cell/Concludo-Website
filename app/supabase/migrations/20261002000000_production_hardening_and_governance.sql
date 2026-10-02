-- Migration: 20261002000000_production_hardening_and_governance.sql
-- Description: Phase 4 Production Hardening, Risk Model, Policies, Audits, Kill Switches, Dead Letters, and Provenance

-- 1. Extend workflows table for governance, risk, and kill switch
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'restricted')),
  ADD COLUMN IF NOT EXISTS risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS test_status TEXT NOT NULL DEFAULT 'untested' CHECK (test_status IN ('untested', 'passed', 'stale', 'failed')),
  ADD COLUMN IF NOT EXISTS is_emergency_stopped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_stopped_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_stopped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emergency_stop_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_risk_level ON public.workflows(risk_level);
CREATE INDEX IF NOT EXISTS idx_workflows_test_status ON public.workflows(test_status);

-- 2. Extend workflow_incidents table for comprehensive SEV 1-4 tracking
ALTER TABLE public.workflow_incidents
  ADD COLUMN IF NOT EXISTS run_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS connector TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS technical_classification TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_safe_explanation TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_affected JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS objects_affected JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS containment_status TEXT DEFAULT 'none' CHECK (containment_status IN ('none', 'contained', 'monitoring', 'resolved')),
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS root_cause TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preventive_action TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT DEFAULT NULL;

-- 3. Workflow Policies Table
CREATE TABLE IF NOT EXISTS public.workflow_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    policy_key TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, policy_key)
);

ALTER TABLE public.workflow_policies ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workflow_policies_org ON public.workflow_policies(organization_id);

-- 4. Workflow Audits Table (Standardized lifecycle auditing)
CREATE TABLE IF NOT EXISTS public.workflow_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    event_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    object_version INTEGER DEFAULT NULL,
    request_id TEXT,
    run_id UUID DEFAULT NULL,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    step_key TEXT DEFAULT NULL,
    policy_result TEXT DEFAULT NULL,
    source TEXT DEFAULT 'system',
    outcome TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_audits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workflow_audits_org ON public.workflow_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audits_wf ON public.workflow_audits(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audits_created_at ON public.workflow_audits(created_at DESC);

-- 5. Workflow Emergency Stops (Kill Switches)
CREATE TABLE IF NOT EXISTS public.workflow_emergency_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('workflow', 'organisation', 'connector')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    invoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at TIMESTAMPTZ DEFAULT NULL,
    released_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.workflow_emergency_stops ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workflow_emergency_stops_org ON public.workflow_emergency_stops(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_emergency_stops_active ON public.workflow_emergency_stops(scope, target_id, is_active);

-- 6. Workflow Dead-Letter Queue
CREATE TABLE IF NOT EXISTS public.workflow_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    execution_id UUID DEFAULT NULL,
    step_key TEXT NOT NULL,
    error_category TEXT NOT NULL,
    error_message TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 3,
    payload_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'exhausted' CHECK (status IN ('exhausted', 'retrying', 'resolved', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_dead_letters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workflow_dead_letters_org ON public.workflow_dead_letters(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_dead_letters_wf ON public.workflow_dead_letters(workflow_id);

-- 7. Source Provenance Table
CREATE TABLE IF NOT EXISTS public.workflow_provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_location TEXT,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    workflow_version INTEGER NOT NULL,
    run_id UUID DEFAULT NULL,
    agent_id TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_provenance ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workflow_provenance_org ON public.workflow_provenance(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_provenance_resource ON public.workflow_provenance(resource_type, resource_id);

-- 8. Row-Level Security Policies for Tenant Isolation
CREATE POLICY wf_policies_org_isolation ON public.workflow_policies
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wf_audits_org_isolation ON public.workflow_audits
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wf_emergency_stops_org_isolation ON public.workflow_emergency_stops
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wf_dead_letters_org_isolation ON public.workflow_dead_letters
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wf_provenance_org_isolation ON public.workflow_provenance
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
