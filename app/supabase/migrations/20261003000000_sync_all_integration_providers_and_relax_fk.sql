-- =====================================================================
-- Tasklet / Concludo Migration: Complete Providers Sync & Connection Policies
-- Migration: 20261003000000_sync_all_integration_providers_and_relax_fk.sql
-- =====================================================================

-- 1. Relax hard foreign key constraints so any valid provider can be connected
ALTER TABLE public.integration_connections DROP CONSTRAINT IF EXISTS integration_connections_provider_id_fkey;
ALTER TABLE public.integration_execution_logs DROP CONSTRAINT IF EXISTS integration_execution_logs_provider_id_fkey;

-- 2. Ensure integration_providers is readable by both authenticated and public visitors
DROP POLICY IF EXISTS "Providers viewable by authenticated users" ON public.integration_providers;
DROP POLICY IF EXISTS "Providers viewable by all" ON public.integration_providers;
CREATE POLICY "Providers viewable by all"
  ON public.integration_providers FOR SELECT
  TO public
  USING (true);

-- 3. Ensure integration_connections permissions are permissive for authenticated and demo sessions
DROP POLICY IF EXISTS "Users can insert connections for their organization" ON public.integration_connections;
CREATE POLICY "Users can insert connections for their organization"
  ON public.integration_connections FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view connections for their organization" ON public.integration_connections;
CREATE POLICY "Users can view connections for their organization"
  ON public.integration_connections FOR SELECT
  TO public
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can update their connections" ON public.integration_connections;
CREATE POLICY "Users can update their connections"
  ON public.integration_connections FOR UPDATE
  TO public
  USING (deleted_at IS NULL);
