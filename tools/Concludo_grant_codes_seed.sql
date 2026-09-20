-- Concludo access grant codes, seed statements.
-- Contains no secret. The plaintext codes exist only in the .txt file and
-- in the hands of the people you gave them to.
-- Label: Concludo internal: founder and staff   Tier: team   Expires: 3650 days   Count: 5

INSERT INTO public.access_grant_codes
  (public_id, secret_hash, secret_salt, hash_params, grants_tier, grants_capabilities,
   label, max_redemptions, expires_at)
VALUES
  ('X57TFC6D', '153e716de5c5debcbc602b5751c77391ff264e60883b55a2f53b23ac49740f66', '10f71095f03ca29b3f64bd459b4c42d8',
   '{"algorithm":"scrypt","N":16384,"r":8,"p":1,"keylen":32}'::jsonb,
   'team', ARRAY['governance_policy','legal_hold','audit_log']::TEXT[],
   'Concludo internal: founder and staff', 1, now() + interval '3650 days');

INSERT INTO public.access_grant_codes
  (public_id, secret_hash, secret_salt, hash_params, grants_tier, grants_capabilities,
   label, max_redemptions, expires_at)
VALUES
  ('JZZ7B98Y', 'ff78dd239556b2574b1b7873a4f997f1af84562426de9f96791b626dd74477a4', '2b185648bc0d14f41dd26ff9574f773d',
   '{"algorithm":"scrypt","N":16384,"r":8,"p":1,"keylen":32}'::jsonb,
   'team', ARRAY['governance_policy','legal_hold','audit_log']::TEXT[],
   'Concludo internal: founder and staff', 1, now() + interval '3650 days');

INSERT INTO public.access_grant_codes
  (public_id, secret_hash, secret_salt, hash_params, grants_tier, grants_capabilities,
   label, max_redemptions, expires_at)
VALUES
  ('QDYA1TK7', '6f0e9a6b5e6964df2bd198a6731e886fee4de57a9dac4fc8fbc87a67f50e8e43', '5a8d3c5f97571bec68622a14b60d546c',
   '{"algorithm":"scrypt","N":16384,"r":8,"p":1,"keylen":32}'::jsonb,
   'team', ARRAY['governance_policy','legal_hold','audit_log']::TEXT[],
   'Concludo internal: founder and staff', 1, now() + interval '3650 days');

INSERT INTO public.access_grant_codes
  (public_id, secret_hash, secret_salt, hash_params, grants_tier, grants_capabilities,
   label, max_redemptions, expires_at)
VALUES
  ('HM1CHC20', '495eb31a16602cd692855b480930d72a771b46aa6c72b816a1516fcb57559789', '7c8f31b6cdbf169139a601210193c403',
   '{"algorithm":"scrypt","N":16384,"r":8,"p":1,"keylen":32}'::jsonb,
   'team', ARRAY['governance_policy','legal_hold','audit_log']::TEXT[],
   'Concludo internal: founder and staff', 1, now() + interval '3650 days');

INSERT INTO public.access_grant_codes
  (public_id, secret_hash, secret_salt, hash_params, grants_tier, grants_capabilities,
   label, max_redemptions, expires_at)
VALUES
  ('770YK3AW', '084d7275289d67d5e37f0de5b3ca9af8c311095bfcac8ac1e3aaae00018c917b', '2406afdd2870f6089662d06a0a218e10',
   '{"algorithm":"scrypt","N":16384,"r":8,"p":1,"keylen":32}'::jsonb,
   'team', ARRAY['governance_policy','legal_hold','audit_log']::TEXT[],
   'Concludo internal: founder and staff', 1, now() + interval '3650 days');
