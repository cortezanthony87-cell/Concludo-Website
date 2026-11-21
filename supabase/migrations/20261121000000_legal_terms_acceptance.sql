-- Migration: 20261121000000_legal_terms_acceptance.sql
-- Description: Add legal terms acceptance timestamp and version to public.profiles table
-- Status: Staged only. Tested on staging Supabase (ovnfvcxewhygipdtmowj). Not applied to production.

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS legal_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_terms_version TEXT;

COMMENT ON COLUMN public.profiles.legal_terms_accepted_at IS 'Timestamp when user accepted the pre-release preview legal terms';
COMMENT ON COLUMN public.profiles.legal_terms_version IS 'Version date of accepted legal terms (e.g. 2026-11-21)';
