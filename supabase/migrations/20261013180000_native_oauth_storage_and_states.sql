-- =====================================================================
-- Migration: 20261013180000_native_oauth_storage_and_states.sql
-- Native OAuth via Supabase ($0 Per-Connection Fee)
-- =====================================================================

-- 1. Extend integration_connections with native encrypted token storage
ALTER TABLE public.integration_connections
    ADD COLUMN IF NOT EXISTS auth_mode text NOT NULL DEFAULT 'nango',
    ADD COLUMN IF NOT EXISTS encrypted_access_token text,
    ADD COLUMN IF NOT EXISTS encrypted_refresh_token text,
    ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS token_type text DEFAULT 'Bearer';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'integration_connections_auth_mode_check'
    ) THEN
        ALTER TABLE public.integration_connections
            ADD CONSTRAINT integration_connections_auth_mode_check
            CHECK (auth_mode IN ('nango', 'native'));
    END IF;
END
$$;

-- 2. Create oauth_states table for PKCE code verifiers and CSRF tokens
CREATE TABLE IF NOT EXISTS public.oauth_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state text UNIQUE NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id text NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,
    code_verifier text,
    redirect_uri text NOT NULL,
    login_hint text,
    connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON public.oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- Security: Enable RLS on oauth_states
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oauth_states FROM anon, public;
GRANT ALL ON public.oauth_states TO service_role;
GRANT SELECT, INSERT ON public.oauth_states TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'oauth_states' AND policyname = 'Users can insert their own oauth states'
    ) THEN
        CREATE POLICY "Users can insert their own oauth states"
            ON public.oauth_states FOR INSERT TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'oauth_states' AND policyname = 'Users can view their own non-expired oauth states'
    ) THEN
        CREATE POLICY "Users can view their own non-expired oauth states"
            ON public.oauth_states FOR SELECT TO authenticated
            USING (auth.uid() = user_id AND expires_at > now() AND used_at IS NULL);
    END IF;
END
$$;

-- 3. Configure provider OAuth endpoints in auth_config for Google & Microsoft
UPDATE public.integration_providers
SET auth_config = jsonb_build_object(
    'provider_family', 'google',
    'authorize_url', 'https://accounts.google.com/o/oauth2/v2/auth',
    'token_url', 'https://oauth2.googleapis.com/token',
    'userinfo_url', 'https://www.googleapis.com/oauth2/v3/userinfo',
    'account_field', 'email',
    'client_id_env', 'GOOGLE_CLIENT_ID',
    'client_secret_env', 'GOOGLE_CLIENT_SECRET',
    'additional_params', jsonb_build_object(
        'access_type', 'offline',
        'prompt', 'consent select_account',
        'include_granted_scopes', 'true'
    )
)
WHERE provider_family = 'google';

UPDATE public.integration_providers
SET auth_config = jsonb_build_object(
    'provider_family', 'microsoft',
    'authorize_url', 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'token_url', 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'userinfo_url', 'https://graph.microsoft.com/v1.0/me',
    'account_field', 'mail',
    'fallback_field', 'userPrincipalName',
    'client_id_env', 'MICROSOFT_CLIENT_ID',
    'client_secret_env', 'MICROSOFT_CLIENT_SECRET',
    'additional_params', jsonb_build_object(
        'prompt', 'select_account',
        'response_mode', 'query'
    )
)
WHERE provider_family = 'microsoft';
