-- Migration: 20261001200000_natural_language_workflow_builder.sql
-- Description: Natural-Language Workflow Builder schemas, immutable versions, dry runs, incidents, idempotency

-- 1. Extend workflows table
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS workflow_key TEXT,
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted_for_review', 'approved', 'published', 'paused', 'deprecated', 'archived')),
  ADD COLUMN IF NOT EXISTS definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS graph_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_version_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_workflow_key ON public.workflows(workflow_key);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);

-- 2. Workflow Versions Table (Immutable published snapshots)
CREATE TABLE IF NOT EXISTS public.workflow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'rolled_back', 'archived')),
    definition_json JSONB NOT NULL,
    plain_language_explanation JSONB NOT NULL DEFAULT '[]'::jsonb,
    changelog_summary TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ DEFAULT NULL,
    published_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workflow_id, version_number)
);

ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflow_versions_wf_id ON public.workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_org_id ON public.workflow_versions(organization_id);

-- 3. Workflow Dry Runs & Test Runs Table
CREATE TABLE IF NOT EXISTS public.workflow_dry_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    initiated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_scenario TEXT NOT NULL,
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    step_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    passed BOOLEAN NOT NULL DEFAULT true,
    error_summary TEXT DEFAULT NULL,
    execution_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_dry_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflow_dry_runs_wf_id ON public.workflow_dry_runs(workflow_id);

-- 4. Workflow Incidents Table
CREATE TABLE IF NOT EXISTS public.workflow_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,
    step_key TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    error_message TEXT NOT NULL,
    context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_incidents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflow_incidents_org_id ON public.workflow_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_incidents_wf_id ON public.workflow_incidents(workflow_id);

-- 5. Workflow Idempotency Records Table
CREATE TABLE IF NOT EXISTS public.workflow_idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,
    created_resource_type TEXT NOT NULL,
    created_resource_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, idempotency_key)
);

ALTER TABLE public.workflow_idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wf_idempotency_key ON public.workflow_idempotency_records(organization_id, idempotency_key);

-- 6. Basic RLS Policies for Tenant Isolation
CREATE POLICY wf_versions_org_isolation ON public.workflow_versions
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wf_dry_runs_org_isolation ON public.workflow_dry_runs
  FOR ALL USING (
    initiated_by = auth.uid()
  );

CREATE POLICY wf_incidents_org_isolation ON public.workflow_incidents
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wf_idempotency_org_isolation ON public.workflow_idempotency_records
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );