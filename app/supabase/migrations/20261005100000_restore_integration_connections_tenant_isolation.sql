-- =====================================================================
-- Migration: 20261005100000_restore_integration_connections_tenant_isolation.sql
-- Purpose:   Close the cross-tenant exposure introduced by
--            20261003000000_sync_all_integration_providers_and_relax_fk.sql
--
-- Problem:   That migration replaced the SELECT, INSERT and UPDATE policies on
--            public.integration_connections with policies granted TO public
--            whose only checks were "deleted_at IS NULL" (SELECT, UPDATE) and
--            "true" (INSERT). Any session, including an unauthenticated (anon)
--            one, could read every organisation's connection names, account
--            references (email addresses), settings and health details, insert
--            connections for any user or organisation, and update any live row.
--
-- Fix:       Recreate the three policies for the authenticated role only,
--            scoped to the caller's own rows and their organisations, add
--            WITH CHECK clauses so rows cannot be written into another user or
--            organisation, revoke table privileges from anon, and fail the
--            migration if any policy on the table is still granted to public
--            or anon.
--
-- Unchanged: The provider foreign-key relaxation and the public read policy on
--            public.integration_providers (a non-secret catalogue). The DELETE
--            policy from 20261002100000 is left as it is.
--
-- Impact:    Any "demo session" flow that relied on anon access to
--            integration_connections will stop working. That is intended.
--            Credentials are not stored in this table (credential_reference
--            points to the vault), but connection metadata is tenant data.
-- =====================================================================


ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- Defence in depth: anon has no business with this table.
REVOKE ALL ON public.integration_connections FROM anon;

-- ---------------------------------------------------------------------
-- SELECT: own rows, or rows in an organisation the caller belongs to.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view connections for their organization" ON public.integration_connections;
CREATE POLICY "Users can view connections for their organization"
    ON public.integration_connections FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL AND (
            user_id = auth.uid() OR
            (organization_id IS NOT NULL AND organization_id IN (
                SELECT om.organization_id
                FROM public.organization_members om
                WHERE om.user_id = auth.uid()
            ))
        )
    );

-- ---------------------------------------------------------------------
-- INSERT: only as yourself, and only into an organisation you belong to
-- (or with no organisation). Tighter than 20261002100000, which did not
-- check organisation membership on insert.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert connections for their organization" ON public.integration_connections;
CREATE POLICY "Users can insert connections for their organization"
    ON public.integration_connections FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND (
            organization_id IS NULL OR organization_id IN (
                SELECT om.organization_id
                FROM public.organization_members om
                WHERE om.user_id = auth.uid()
            )
        )
    );

-- ---------------------------------------------------------------------
-- UPDATE: your own rows, or rows in an organisation where you are owner or
-- admin. WITH CHECK stops a row being moved to another organisation, or
-- reassigned to another user by a non-admin.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their connections" ON public.integration_connections;
CREATE POLICY "Users can update their connections"
    ON public.integration_connections FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        ))
    )
    WITH CHECK (
        (
            organization_id IS NULL OR organization_id IN (
                SELECT om.organization_id
                FROM public.organization_members om
                WHERE om.user_id = auth.uid()
            )
        ) AND (
            user_id = auth.uid() OR
            (organization_id IS NOT NULL AND organization_id IN (
                SELECT om.organization_id
                FROM public.organization_members om
                WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
            ))
        )
    );

-- ---------------------------------------------------------------------
-- Guard: fail loudly if anything on this table is still open to public or
-- anon (for example a policy created by hand in the dashboard).
-- ---------------------------------------------------------------------
DO $$
DECLARE
    open_policies text;
BEGIN
    SELECT string_agg(policyname, ', ')
      INTO open_policies
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'integration_connections'
       AND (roles @> ARRAY['public']::name[] OR roles @> ARRAY['anon']::name[]);

    IF open_policies IS NOT NULL THEN
        RAISE EXCEPTION
          'integration_connections still has policies granted to public or anon: %. Review and drop them, then rerun.',
          open_policies;
    END IF;
END
$$;

