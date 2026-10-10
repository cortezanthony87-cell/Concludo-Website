-- =====================================================================
-- Migration: 20261010140000_allow_authenticated_update_account_label.sql
-- Purpose: Allow authenticated users to edit their account email / label
-- and connection name for multi-account management.
-- =====================================================================

GRANT UPDATE (connection_name, account_label) ON public.integration_connections TO authenticated;
