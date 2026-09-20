-- Concludo security lab schema.
--
-- A minimal but REAL multi-tenant schema with Row Level Security enabled,
-- used to prove tenant isolation by attacking it rather than asserting it.
--
-- The Supabase pattern is reproduced faithfully: auth.uid() reads the
-- authenticated user from a request-scoped setting, exactly as Supabase
-- derives it from the JWT. If isolation holds here it holds there.

DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE
);

-- auth.uid() is the whole security model. It must never be spoofable by a
-- client. In Supabase it comes from a signed JWT the client cannot forge.
-- Here it comes from a session setting the application sets per request.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
    LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

CREATE TABLE public.organisation_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER','ADMIN','OWNER')),
    UNIQUE (organisation_id, user_id)
);

CREATE TABLE public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    transcript TEXT NOT NULL,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL
);

CREATE TABLE public.organisation_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter','pro_subscription','team')),
    capabilities TEXT[] NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

DO $$BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
DO $$BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
DO $$BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END$$;

GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role, anon;

-- anon gets nothing on public. An unauthenticated caller reads no business data.

-- ---------------------------------------------------------------------------
-- Row Level Security. This is the primary boundary, not a secondary check.
-- ---------------------------------------------------------------------------

-- A helper so every policy expresses membership identically. One definition,
-- one place to get wrong, one place to fix.
CREATE OR REPLACE FUNCTION public.is_member_of(org UUID) RETURNS BOOLEAN
    LANGUAGE sql STABLE SECURITY INVOKER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organisation_memberships m
        WHERE m.organisation_id = org AND m.user_id = auth.uid()
    )
$$;

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisations FORCE ROW LEVEL SECURITY;
CREATE POLICY orgs_select ON public.organisations FOR SELECT TO authenticated
    USING (public.is_member_of(id));

ALTER TABLE public.organisation_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY memberships_select ON public.organisation_memberships FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_member_of(organisation_id));
-- Deliberately no INSERT/UPDATE/DELETE policy for authenticated: a user cannot
-- add themselves to an organisation. That is the classic privilege escalation.

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings FORCE ROW LEVEL SECURITY;
CREATE POLICY meetings_select ON public.meetings FOR SELECT TO authenticated
    USING (public.is_member_of(organisation_id) AND suspended_at IS NULL);
CREATE POLICY meetings_insert ON public.meetings FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of(organisation_id));
CREATE POLICY meetings_update ON public.meetings FOR UPDATE TO authenticated
    USING (public.is_member_of(organisation_id))
    WITH CHECK (public.is_member_of(organisation_id));
-- WITH CHECK on UPDATE is what stops a row being moved into another tenant.

ALTER TABLE public.outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outputs FORCE ROW LEVEL SECURITY;
CREATE POLICY outputs_select ON public.outputs FOR SELECT TO authenticated
    USING (public.is_member_of(organisation_id));
CREATE POLICY outputs_insert ON public.outputs FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of(organisation_id));

ALTER TABLE public.organisation_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subs_select ON public.organisation_subscriptions FOR SELECT TO authenticated
    USING (public.is_member_of(organisation_id));
-- No write policy for authenticated. A customer cannot upgrade their own tier.
