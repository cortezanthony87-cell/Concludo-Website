-- Concludo: functional test for the tier alignment and access grant migrations.
--
-- Run AFTER applying 20260920000000 and 20260920010000 and after seeding
-- tools/Concludo_grant_codes_seed.sql, against a SCRATCH database only.
-- It creates a test user and redeems a real seeded code, which consumes it.
--
--   psql -d concludo_migration_replay -f test_access_grants.sql
--
-- Every line must print PASS.

\set QUIET on
\pset tuples_only on
\pset format unaligned

-- ---------------------------------------------------------------------------
-- Tier identifiers
-- ---------------------------------------------------------------------------
SELECT 'A. constraint carries no bare pro and no enterprise: ' ||
       CASE WHEN pg_get_constraintdef(oid) NOT LIKE '%''pro''%'
             AND pg_get_constraintdef(oid) NOT LIKE '%enterprise%'
            THEN 'PASS' ELSE 'FAIL' END
  FROM pg_constraint WHERE conname = 'check_profiles_allowed_plan';

SELECT 'B. no function body carries bare pro or enterprise: ' ||
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL, ' || count(*) || ' functions' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.prosrc LIKE '%''pro''%' OR p.prosrc LIKE '%''enterprise''%');

-- ---------------------------------------------------------------------------
-- Test subject
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'grant-test@example.invalid')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'grant-test@example.invalid')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grant lifecycle
-- ---------------------------------------------------------------------------
SELECT 'C. before redemption, team_workspace denied: ' ||
       CASE WHEN public.can_use_feature('11111111-1111-1111-1111-111111111111', 'team_workspace')
            THEN 'FAIL' ELSE 'PASS' END;

SELECT 'D. redemption returns the granted tier: ' ||
       CASE WHEN public.redeem_access_grant('X57TFC6D', '11111111-1111-1111-1111-111111111111') = 'team'
            THEN 'PASS' ELSE 'FAIL' END;

SELECT 'E. after redemption, team_workspace allowed: ' ||
       CASE WHEN public.can_use_feature('11111111-1111-1111-1111-111111111111', 'team_workspace')
            THEN 'PASS' ELSE 'FAIL' END;

SELECT 'F. redemption did not mutate profiles.plan: ' ||
       CASE WHEN plan = 'free_preview' THEN 'PASS' ELSE 'FAIL, plan is ' || plan END
  FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT 'G. revocation removes access: ' ||
       CASE WHEN public.revoke_access_grant('X57TFC6D', 'test') >= 0
             AND NOT public.can_use_feature('11111111-1111-1111-1111-111111111111', 'team_workspace')
            THEN 'PASS' ELSE 'FAIL' END;

UPDATE public.profiles SET is_suspended = true
 WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT 'H. suspension denies everything: ' ||
       CASE WHEN public.can_use_feature('11111111-1111-1111-1111-111111111111', 'workspace_basic')
            THEN 'FAIL' ELSE 'PASS' END;

-- ---------------------------------------------------------------------------
-- Tier scope. A Team grant gets the governance screens and does not get single
-- sign on, because single sign on is not built.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email)
VALUES ('22222222-2222-2222-2222-222222222222', 'tier-test@example.invalid')
ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, email)
VALUES ('22222222-2222-2222-2222-222222222222', 'tier-test@example.invalid')
ON CONFLICT (id) DO NOTHING;
SELECT public.redeem_access_grant('JZZ7B98Y', '22222222-2222-2222-2222-222222222222');

SELECT 'I. Team is denied enterprise_sso: ' ||
       CASE WHEN public.can_use_feature('22222222-2222-2222-2222-222222222222', 'enterprise_sso')
            THEN 'FAIL, a permission was granted for a feature that does not exist'
            ELSE 'PASS' END;

SELECT 'J. Team is granted audit_logging: ' ||
       CASE WHEN public.can_use_feature('22222222-2222-2222-2222-222222222222', 'audit_logging')
            THEN 'PASS' ELSE 'FAIL' END;

-- ---------------------------------------------------------------------------
-- Isolation. These three must each raise. Run them one at a time and confirm
-- the error, because a passing SELECT here would be the finding.
-- ---------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SELECT count(*) FROM public.access_grant_codes;
--   expected: ERROR permission denied for table access_grant_codes
--
-- SET LOCAL ROLE authenticated;
-- INSERT INTO public.access_grant_redemptions (grant_code_id, user_id)
--   SELECT id, auth.uid() FROM public.access_grant_codes LIMIT 1;
--   expected: ERROR permission denied
--
-- SET LOCAL ROLE authenticated;
-- SELECT public.redeem_access_grant('JZZ7B98Y', auth.uid());
--   expected: ERROR permission denied for function redeem_access_grant
