-- =====================================================================
-- Tasklet 18: Integrations, Automation Exports and Workflow Connectivity
-- =====================================================================

-- 1. Integrations Table
CREATE TABLE IF NOT EXISTS public.integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    provider text NOT NULL,
    status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing', 'paused')),
    connected_at timestamptz DEFAULT now(),
    last_sync_at timestamptz,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz DEFAULT NULL,
    deleted_by uuid REFERENCES auth.users(id) DEFAULT NULL,
    purge_after timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_team_id ON public.integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON public.integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_deleted_at ON public.integrations(deleted_at);

-- 2. Integration Sync Logs Table
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    provider text NOT NULL,
    sync_type text NOT NULL DEFAULT 'manual' CHECK (sync_type IN ('manual', 'scheduled', 'export', 'one_way')),
    records_processed integer NOT NULL DEFAULT 0,
    success_count integer NOT NULL DEFAULT 0,
    failure_count integer NOT NULL DEFAULT 0,
    duration_ms integer NOT NULL DEFAULT 0,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'partial')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_integration_id ON public.integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON public.integration_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.integration_sync_logs(created_at DESC);

-- 3. Automation Exports Table
CREATE TABLE IF NOT EXISTS public.automation_exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    export_type text NOT NULL CHECK (export_type IN ('action', 'decision', 'project', 'report', 'intelligence', 'bulk')),
    destination text NOT NULL,
    records_count integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
    payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_message text DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exports_user_id ON public.automation_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_team_id ON public.automation_exports(team_id);
CREATE INDEX IF NOT EXISTS idx_exports_org_id ON public.automation_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON public.automation_exports(created_at DESC);

-- 4. Webhooks Table
CREATE TABLE IF NOT EXISTS public.webhooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    name text NOT NULL,
    endpoint_url text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed')),
    secret_key text NOT NULL,
    events text[] NOT NULL DEFAULT '{}'::text[],
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz DEFAULT NULL,
    deleted_by uuid REFERENCES auth.users(id) DEFAULT NULL,
    purge_after timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhooks_owner_id ON public.webhooks(owner_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_team_id ON public.webhooks(team_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_org_id ON public.webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_deleted_at ON public.webhooks(deleted_at);

-- 5. Webhook Delivery Logs Table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id uuid REFERENCES public.webhooks(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    status text NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'failed', 'retrying')),
    request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    response_code integer DEFAULT 200,
    attempt_count integer NOT NULL DEFAULT 1,
    error_message text DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- 6. API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    name text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    key_prefix text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz DEFAULT NULL,
    last_used_at timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_owner_id ON public.api_keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON public.api_keys(status);

-- 7. Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integrations_updated_at ON public.integrations;
CREATE TRIGGER trg_integrations_updated_at
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON public.webhooks;
CREATE TRIGGER trg_webhooks_updated_at
    BEFORE UPDATE ON public.webhooks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at_timestamp();

-- 8. Enable Row-Level Security (RLS)
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies: integrations
DROP POLICY IF EXISTS "Users can view own or team/org integrations" ON public.integrations;
CREATE POLICY "Users can view own or team/org integrations" ON public.integrations
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert own integrations" ON public.integrations;
CREATE POLICY "Users can insert own integrations" ON public.integrations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON public.integrations;
CREATE POLICY "Users can update own integrations" ON public.integrations
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete own integrations" ON public.integrations;
CREATE POLICY "Users can delete own integrations" ON public.integrations
    FOR DELETE TO authenticated
    USING (
        auth.uid() = user_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

-- 10. RLS Policies: integration_sync_logs
DROP POLICY IF EXISTS "Users can view own sync logs" ON public.integration_sync_logs;
CREATE POLICY "Users can view own sync logs" ON public.integration_sync_logs
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users or service role can insert sync logs" ON public.integration_sync_logs;
CREATE POLICY "Users or service role can insert sync logs" ON public.integration_sync_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 11. RLS Policies: automation_exports
DROP POLICY IF EXISTS "Users can view own exports" ON public.automation_exports;
CREATE POLICY "Users can view own exports" ON public.automation_exports
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert own exports" ON public.automation_exports;
CREATE POLICY "Users can insert own exports" ON public.automation_exports
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 12. RLS Policies: webhooks
DROP POLICY IF EXISTS "Users can view own or team/org webhooks" ON public.webhooks;
CREATE POLICY "Users can view own or team/org webhooks" ON public.webhooks
    FOR SELECT TO authenticated
    USING (
        auth.uid() = owner_id
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert own webhooks" ON public.webhooks;
CREATE POLICY "Users can insert own webhooks" ON public.webhooks
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own webhooks" ON public.webhooks;
CREATE POLICY "Users can update own webhooks" ON public.webhooks
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete own webhooks" ON public.webhooks;
CREATE POLICY "Users can delete own webhooks" ON public.webhooks
    FOR DELETE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

-- 13. RLS Policies: webhook_logs
DROP POLICY IF EXISTS "Users can view webhook logs for visible webhooks" ON public.webhook_logs;
CREATE POLICY "Users can view webhook logs for visible webhooks" ON public.webhook_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.webhooks w
            WHERE w.id = webhook_logs.webhook_id
            AND (
                w.owner_id = auth.uid()
                OR (w.team_id IS NOT NULL AND is_team_member(w.team_id, auth.uid()))
                OR (w.organization_id IS NOT NULL AND is_org_member(w.organization_id, auth.uid()))
            )
        )
    );

DROP POLICY IF EXISTS "Users or service role can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "Users or service role can insert webhook logs" ON public.webhook_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.webhooks w
            WHERE w.id = webhook_logs.webhook_id
            AND w.owner_id = auth.uid()
        )
    );

-- 14. RLS Policies: api_keys
DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;
CREATE POLICY "Users can view own api keys" ON public.api_keys
    FOR SELECT TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert own api keys" ON public.api_keys;
CREATE POLICY "Users can insert own api keys" ON public.api_keys
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own api keys" ON public.api_keys;
CREATE POLICY "Users can update own api keys" ON public.api_keys
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete own api keys" ON public.api_keys;
CREATE POLICY "Users can delete own api keys" ON public.api_keys
    FOR DELETE TO authenticated
    USING (
        auth.uid() = owner_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );
