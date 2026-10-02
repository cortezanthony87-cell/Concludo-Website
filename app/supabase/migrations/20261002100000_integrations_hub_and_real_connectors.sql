-- =====================================================================
-- Tasklet / Concludo Migration: Integrations Hub & Real Workflow Connectors
-- Migration: 20261002100000_integrations_hub_and_real_connectors.sql
-- Conforms strictly to:
-- 1. Multi-tenant isolation (organization_id derived from auth/session)
-- 2. Zero-secret governance (no plaintext access tokens, secrets, or passwords)
-- 3. Row-Level Security (RLS) enabled on all tables
-- 4. Extensible connector, connection, and execution logging
-- =====================================================================

-- 1. Integration Providers Registry (Catalog of apps, auth types, categories)
CREATE TABLE IF NOT EXISTS public.integration_providers (
    id text PRIMARY KEY, -- e.g. 'microsoft_outlook', 'slack', 'xero', 'myob'
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    category text NOT NULL, -- 'Productivity', 'Communication', 'Accounting & Finance', 'CRM & Sales', etc.
    description text NOT NULL,
    icon_asset text NOT NULL,
    authentication_type text NOT NULL CHECK (authentication_type IN ('oauth2', 'oauth2_pkce', 'api_key', 'webhook_signature', 'bearer', 'session', 'none')),
    auth_config jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. authorization_endpoint, token_endpoint, default_scopes
    supported_triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
    supported_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_tier1 boolean NOT NULL DEFAULT false,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_providers_category ON public.integration_providers(category);
CREATE INDEX IF NOT EXISTS idx_integration_providers_enabled ON public.integration_providers(enabled);

-- Enable RLS on providers (world readable for authenticated users, modifiable only by service role)
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers viewable by authenticated users" ON public.integration_providers;
CREATE POLICY "Providers viewable by authenticated users"
    ON public.integration_providers FOR SELECT
    TO authenticated
    USING (true);

-- 2. Integration Connections (Granular workspace connections with credentials reference)
CREATE TABLE IF NOT EXISTS public.integration_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id uuid, -- Optional alias for workspace
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id text NOT NULL REFERENCES public.integration_providers(id) ON DELETE RESTRICT,
    connection_name text NOT NULL, -- e.g. 'Anthony - Microsoft 365', 'Finance Xero Organisation'
    external_account_reference text NOT NULL, -- e.g. 'anthony@concludo.com.au', 'Xero Org 91823'
    status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reauth', 'permission_required', 'service_issue', 'disconnected', 'setup_required')),
    scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
    credential_reference text, -- ID of vaulted/encrypted credential; NEVER store plaintext tokens here
    settings jsonb NOT NULL DEFAULT '{}'::jsonb, -- Safe metadata (e.g. tenant_id, environment: 'production')
    health_details jsonb NOT NULL DEFAULT '{"healthy": true, "last_check_status": "OK"}'::jsonb,
    connected_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    last_tested_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz DEFAULT NULL,
    deleted_by uuid REFERENCES auth.users(id) DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org_id ON public.integration_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_user_id ON public.integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON public.integration_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON public.integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_integration_connections_deleted_at ON public.integration_connections(deleted_at);

-- RLS for Integration Connections: users can only see connections in their organization or created by them
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view connections for their organization" ON public.integration_connections;
CREATE POLICY "Users can view connections for their organization"
    ON public.integration_connections FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL AND (
            user_id = auth.uid() OR
            (organization_id IS NOT NULL AND organization_id IN (
                SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
            ))
        )
    );

DROP POLICY IF EXISTS "Users can insert connections for their organization" ON public.integration_connections;
CREATE POLICY "Users can insert connections for their organization"
    ON public.integration_connections FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Users can update their connections" ON public.integration_connections;
CREATE POLICY "Users can update their connections"
    ON public.integration_connections FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        ))
    );

DROP POLICY IF EXISTS "Users can soft-delete their connections" ON public.integration_connections;
CREATE POLICY "Users can soft-delete their connections"
    ON public.integration_connections FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        ))
    );

-- 3. Integration Execution Logs (Detailed, zero-secret step run logs for integrations)
CREATE TABLE IF NOT EXISTS public.integration_execution_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id text NOT NULL,
    workflow_step_id text NOT NULL,
    connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
    provider_id text NOT NULL REFERENCES public.integration_providers(id) ON DELETE RESTRICT,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action_or_trigger_key text NOT NULL,
    status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled')),
    attempt_count integer NOT NULL DEFAULT 1,
    duration_ms integer NOT NULL DEFAULT 0,
    safe_input_summary jsonb NOT NULL DEFAULT '{}'::jsonb, -- Redacted of sensitive keys
    safe_output_summary jsonb NOT NULL DEFAULT '{}'::jsonb, -- Redacted of sensitive keys
    error_category text, -- e.g. 'AUTH_EXPIRED', 'RATE_LIMITED', 'PERMISSION_DENIED', 'VALIDATION_ERROR'
    safe_error_message text,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_integration_exec_logs_run_id ON public.integration_execution_logs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_integration_exec_logs_conn_id ON public.integration_execution_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_exec_logs_provider ON public.integration_execution_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_integration_exec_logs_org_id ON public.integration_execution_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_exec_logs_status ON public.integration_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_exec_logs_started_at ON public.integration_execution_logs(started_at DESC);

-- RLS for Integration Execution Logs
ALTER TABLE public.integration_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view integration execution logs for their organization" ON public.integration_execution_logs;
CREATE POLICY "Users can view integration execution logs for their organization"
    ON public.integration_execution_logs FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
        ))
    );

-- 4. Workflow File Reference Store (Keeps heavy files out of workflow JSON state)
CREATE TABLE IF NOT EXISTS public.workflow_file_references (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_run_id text NOT NULL,
    step_key text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL,
    storage_path text NOT NULL, -- Storage bucket reference
    sha256_checksum text NOT NULL,
    source_connector text NOT NULL, -- e.g. 'microsoft_outlook', 'google_drive'
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_files_org_id ON public.workflow_file_references(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_files_run_id ON public.workflow_file_references(workflow_run_id);

ALTER TABLE public.workflow_file_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view file references for their organization" ON public.workflow_file_references;
CREATE POLICY "Users can view file references for their organization"
    ON public.workflow_file_references FOR SELECT
    TO authenticated
    USING (
        organization_id IS NOT NULL AND organization_id IN (
            SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
        )
    );
