-- Every table in public must have row level security ENABLED. No exceptions.
-- Run against the migration replay database; this query must return zero rows.
SELECT c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
