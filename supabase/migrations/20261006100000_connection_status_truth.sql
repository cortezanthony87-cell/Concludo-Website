-- =====================================================================
-- Migration: 20261006100000_connection_status_truth.sql
-- Phase 0 of the Integrations and Trust Redesign (approved 6 October 2026)
--
-- Rule: only the server may say a connection works, and only after a real
-- call to the provider succeeded.
--
-- Requires: 20261005100000_restore_integration_connections_tenant_isolation.sql
--
-- What this does
--   1. Widens the status values to the connection lifecycle, plus 'unverified'
--      for rows created before Concludo checked connections.
--   2. Moves every existing row to an honest status. Nothing created before
--      today was verified with the provider, so no row stays 'connected'.
--   3. Changes the defaults: status 'not_connected', health_details empty.
--   4. Adds evidence columns (verified_at, last_test_at, ...).
--   5. Makes 'connected' impossible without verified_at, at the database level.
--   6. Takes write access to status and evidence away from signed-in users.
--      They may rename a connection; everything else, including disconnect
--      and removal, is done by server functions using the service role.
--
-- Not changed: RLS policies (from 20261005100000), credential storage, the
-- integration_providers catalogue, execution logs.
-- =====================================================================

-- 1. Drop whatever CHECK constraint currently limits status (its name is generated).
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'integration_connections'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.integration_connections DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$$;

-- 2. Evidence columns.
ALTER TABLE public.integration_connections
    ADD COLUMN IF NOT EXISTS verified_at       timestamptz,
    ADD COLUMN IF NOT EXISTS last_test_at      timestamptz,
    ADD COLUMN IF NOT EXISTS last_test_result  text,
    ADD COLUMN IF NOT EXISTS last_error_code   text,
    ADD COLUMN IF NOT EXISTS status_reason     text,
    ADD COLUMN IF NOT EXISTS account_label     text,
    ADD COLUMN IF NOT EXISTS granted_scopes    jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

-- 3. Honest status for every existing row. Legacy values map as follows:
--      connected           -> unverified        (never checked with the provider)
--      needs_reauth        -> reauth_required
--      permission_required -> permission_required
--      service_issue       -> provider_unavailable
--      disconnected        -> disconnected
--      setup_required      -> not_connected
UPDATE public.integration_connections
SET status = CASE status
        WHEN 'connected'      THEN 'unverified'
        WHEN 'needs_reauth'   THEN 'reauth_required'
        WHEN 'service_issue'  THEN 'provider_unavailable'
        WHEN 'setup_required' THEN 'not_connected'
        ELSE status
    END,
    status_reason = CASE status
        WHEN 'connected' THEN 'Added before Concludo checked connections with the app. Reconnect to verify.'
        ELSE status_reason
    END,
    health_details = '{}'::jsonb
-- A row verified by the new server flow has verified_at set and is left alone,
-- so rerunning this migration never downgrades a real connection.
WHERE (status = 'connected' AND verified_at IS NULL)
   OR status IN ('needs_reauth', 'service_issue', 'setup_required');

-- 4. New allowed values and honest defaults.
ALTER TABLE public.integration_connections
    ADD CONSTRAINT integration_connections_status_check CHECK (status IN (
        'not_connected',
        'authorising',
        'verifying',
        'connected',
        'failed',
        'reauth_required',
        'permission_required',
        'expired',
        'provider_unavailable',
        'disconnected',
        'unverified'
    ));

ALTER TABLE public.integration_connections ALTER COLUMN status SET DEFAULT 'not_connected';
ALTER TABLE public.integration_connections ALTER COLUMN health_details SET DEFAULT '{}'::jsonb;

-- 5. 'connected' requires evidence.
ALTER TABLE public.integration_connections
    ADD CONSTRAINT integration_connections_connected_requires_verification
    CHECK (status <> 'connected' OR (verified_at IS NOT NULL AND last_test_result = 'success'));

-- 6. Writes: server only, except rename. Removal goes through a server function
--    because it must also revoke tokens and delete the vault secret (and a
--    client soft-delete fails the SELECT policy on the new row anyway).
--    Column privileges are enforced by PostgREST and by Postgres itself, on top of RLS.
REVOKE INSERT, UPDATE ON public.integration_connections FROM authenticated;
GRANT UPDATE (connection_name) ON public.integration_connections TO authenticated;

-- Keep status_changed_at honest whenever status changes (server writes included).
CREATE OR REPLACE FUNCTION public.integration_connections_touch_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.status_changed_at := now();
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS integration_connections_touch_status ON public.integration_connections;
CREATE TRIGGER integration_connections_touch_status
    BEFORE UPDATE ON public.integration_connections
    FOR EACH ROW EXECUTE FUNCTION public.integration_connections_touch_status();

-- 7. Guard: fail if any row still claims to be connected without evidence.
DO $$
DECLARE
    bad int;
BEGIN
    SELECT count(*) INTO bad
    FROM public.integration_connections
    WHERE status = 'connected' AND (verified_at IS NULL OR last_test_result IS DISTINCT FROM 'success');
    IF bad > 0 THEN
        RAISE EXCEPTION '% connection rows are connected without verification evidence', bad;
    END IF;
END
$$;
