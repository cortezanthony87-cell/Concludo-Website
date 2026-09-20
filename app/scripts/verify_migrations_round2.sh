#!/usr/bin/env bash
# Concludo Workspace: migration replay harness.
#
# Replays every migration against a scratch PostgreSQL database, one file per
# transaction, stopping on the first error in each file. Prints how many applied
# and names every file that failed with its first error.
#
# Usage, from the repository root:
#   PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres ./verify_migrations.sh
#
# This does NOT touch the Supabase project. It builds and drops its own database.

set -uo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
DB="${DB:-concludo_migration_replay}"
MIGRATIONS="${MIGRATIONS:-supabase/migrations}"
export PGHOST PGPORT PGUSER PGPASSWORD

if [ ! -d "$MIGRATIONS" ]; then
  echo "No migrations directory at $MIGRATIONS. Run this from the repository root."
  exit 1
fi

psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;" >/dev/null || exit 1

# Minimal stand-in for the parts of Supabase the migrations depend on.
# Supabase provides these in a real project. They are recreated here so the
# replay exercises the migrations themselves rather than the platform.
psql -q -d "$DB" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
DO $$BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
DO $$BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
DO $$BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role, anon;
SQL

log=$(mktemp)
pass=0
fail=0
failed=""

for f in $(ls "$MIGRATIONS"/*.sql | sort); do
  if psql -q -d "$DB" -v ON_ERROR_STOP=1 -1 -f "$f" >"$log" 2>&1; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    failed="${failed}
  $(basename "$f")
      $(grep -m1 ERROR "$log")"
  fi
done

total=$((pass + fail))
echo
echo "Migrations applied: $pass of $total. Failed: $fail."

if [ "$fail" -gt 0 ]; then
  echo "$failed"
  echo
  echo "Replay incomplete. Do not apply to Supabase."
  exit 1
fi

echo
psql -q -d "$DB" -tAc "SELECT 'Tables: ' || count(*) ||
  '   RLS enabled: ' || count(*) FILTER (WHERE c.relrowsecurity) ||
  '   RLS forced: ' || count(*) FILTER (WHERE c.relforcerowsecurity)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';"
psql -q -d "$DB" -tAc "SELECT 'Policies: ' || count(*) FROM pg_policies WHERE schemaname = 'public';"

echo
echo "Tables with row level security NOT enabled (must be empty):"
psql -q -d "$DB" -tAc "SELECT '  ' || c.relname FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;"

echo
echo "Replay clean. This proves the migrations apply. It does not prove the"
echo "policies are correct. Run the attack suite for that."
