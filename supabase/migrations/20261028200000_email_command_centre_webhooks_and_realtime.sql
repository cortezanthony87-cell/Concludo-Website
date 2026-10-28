-- ==============================================================================
-- Migration: Email Command Centre Provider Subscriptions and Push Sync
-- Purpose: Store active Gmail (Pub/Sub watch) and Microsoft Outlook Graph
--          webhook subscriptions with automatic renewal and realtime push syncing.
-- Governance: Multi-tenant isolated, strictly scoped with Row Level Security (RLS).
-- ==============================================================================

-- 1. Create table for mailbox push subscriptions
CREATE TABLE IF NOT EXISTS public.provider_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('gmail', 'microsoft_outlook')),
    subscription_id text NOT NULL, -- Microsoft subscription ID or Google watch resourceId
    topic_name text,               -- Google Cloud Pub/Sub topic if applicable
    client_state_secret text,      -- Verifiable shared secret for Microsoft Graph validation
    history_id text,               -- Gmail historyId checkpoint
    delta_token text,              -- Microsoft Graph delta link / token checkpoint
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'renewing', 'failed')),
    last_event_at timestamptz,
    last_renewed_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_provider_subscription_conn UNIQUE (connection_id, provider)
);

-- Indexing for fast webhook callback lookup and background renewal cron
CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_lookup 
    ON public.provider_subscriptions(subscription_id, provider) 
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_user 
    ON public.provider_subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_expiry 
    ON public.provider_subscriptions(expires_at) 
    WHERE status = 'active';

-- 2. Row Level Security
ALTER TABLE public.provider_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.provider_subscriptions FROM anon;
REVOKE ALL ON public.provider_subscriptions FROM authenticated;
GRANT SELECT, DELETE ON public.provider_subscriptions TO authenticated;
GRANT ALL ON public.provider_subscriptions TO service_role;

DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.provider_subscriptions;
CREATE POLICY "Users can read own subscriptions"
    ON public.provider_subscriptions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.provider_subscriptions;
CREATE POLICY "Users can delete own subscriptions"
    ON public.provider_subscriptions FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- 3. Enable Supabase Realtime publication on user_notifications
-- Ensures that when an incoming email triggers a notification insertion,
-- every connected workspace client receives the event instantly.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
    END IF;
END $$;
