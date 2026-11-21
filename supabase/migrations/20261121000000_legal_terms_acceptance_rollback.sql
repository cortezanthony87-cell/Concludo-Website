-- Rollback for 20261121000000_legal_terms_acceptance.sql
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS legal_terms_accepted_at,
  DROP COLUMN IF EXISTS legal_terms_version;
