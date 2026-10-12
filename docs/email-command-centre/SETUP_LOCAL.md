# Email Command Centre: local setup

Concludo Workspace. Final, Stage 7.

The module runs locally with **no credentials, no mailbox and no network
calls**. That is deliberate: a module that cannot be run and reviewed without
credentials does not get reviewed.

---

## 1. What you need

| Thing | Version | Why |
|---|---|---|
| bun | 1.3 or later | The Workspace's package manager and test runner |
| Node | 22 or later | Only for the two browser suites, which use Playwright |
| Chromium | any recent | Only for the two browser suites |

No database, no Supabase project, no API key, no OAuth application.

## 2. Install and run

```
bun install
bun run dev
```

Open the application, sign in with whatever the Workspace's local development
flow uses, and go to **Email Command Centre** in the sidebar, or straight to
`/email`.

Eleven tabs, twenty-two synthetic threads across two accounts, every analysis
populated, every extraction carrying its source. Nothing is connected to
anything.

## 3. Seeing the states

Each view's four states are reachable from the URL, because a state that cannot
be reached is a state nobody has ever looked at:

```
/email/needs-attention?demo=loading
/email/needs-attention?demo=empty
/email/needs-attention?demo=error
```

The Overview page has buttons for the same thing, under "Review controls".

## 4. The module preview harness

The browser suites do not drive the whole application. They mount the module on
its own, with the synthetic dataset and no authentication:

```
npx vite --port 5199 --strictPort
# then open
http://localhost:5199/email-preview.html?p=/email/clear-backlog
```

The `p` parameter is the module path. This is also how to look at a single view
quickly without clicking through the application.

## 5. Running the tests

Seven suites run with bun and need nothing else:

```
bun app/tests/emailCommandCentre.model.test.ts          #   781 checks
bun app/tests/emailCommandCentre.shell.test.ts          #    65 checks
bun app/tests/emailCommandCentre.views.test.ts          #   412 checks
bun app/tests/emailCommandCentre.intelligence.test.ts   #   236 checks
bun app/tests/emailCommandCentre.integration.test.ts    #   648 checks
bun app/tests/emailCommandCentre.completion.test.ts     #   317 checks
bun app/tests/emailCommandCentre.performance.test.ts    #    70 checks
```

Two run in a real browser and need the dev server on port 5199 first:

```
npx vite --port 5199 --strictPort &
node app/tests/browser/emailCommandCentre.browser.test.mjs         # 375 checks
node app/tests/browser/emailCommandCentre.accessibility.test.mjs   # 546 checks
```

If Chromium is not where Playwright expects it:

```
PW_CHROMIUM=/path/to/chromium node app/tests/browser/...
```

The performance suite generates 100, 1,000 and 10,000 thread datasets and takes
about twenty seconds. The accessibility suite opens every view at three widths
and takes a few minutes.

## 6. Typecheck and build

```
npx tsc --noEmit
bun run build
```

Both must be clean. `tsc` is not optional on this module: several of its
guarantees are type-level, and a module that only passes at runtime has lost
them.

## 7. The database, locally

Not needed to run the module, which uses the synthetic dataset. Needed to work
on the migrations.

With Docker:

```
docker run --rm -e POSTGRES_PASSWORD=dev -p 5433:5432 postgres:16
```

Or with a local Postgres 16. Then, against a scratch database:

```
# Supabase provides auth.users and auth.uid() in a real project. Locally,
# create the minimum the migrations reference:
psql -h localhost -p 5433 -U postgres -d postgres -c "create database ecc_dev"
psql -h localhost -p 5433 -U postgres -d ecc_dev <<'SQL'
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable
  as $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;
create role anon;
create role authenticated;
SQL

psql -v ON_ERROR_STOP=1 -h localhost -p 5433 -U postgres -d ecc_dev \
  -f docs/migrations/0001_email_command_centre_core.sql \
  -f docs/migrations/0002_row_level_security.sql \
  -f docs/migrations/0003_retention_and_deletion.sql
```

Then prove the schema does what it claims:

```
psql -v ON_ERROR_STOP=1 -h localhost -p 5433 -U postgres -d ecc_dev \
  -f docs/migrations/0099_verify.sql
```

That file tries to cross every boundary the schema is meant to hold: read
another person's rows, write a child row against the wrong account, rewrite an
audit line, store an extraction with no source, store an analysed row with no
provenance, grant a denied capability, approve an undeclared action. All of them
have to fail. It rolls back, so it is safe to re-run. Three notices mean it
passed:

```
NOTICE:  All schema checks passed.
NOTICE:  Row-level security checks passed.
NOTICE:  Audit append-only checks passed.
```

All three migrations are idempotent and were verified against PostgreSQL 16 on
12 October 2026.

## 8. What you cannot do locally

- Connect a real mailbox. There is no OAuth application and no token store.
- Call a model. There is no key and no provider agreement.
- Save a draft to a mailbox. It needs all of the above.

Those are listed in `docs/SETUP.md` as prerequisites and in
`docs/KNOWN_LIMITATIONS.md` as the honest state of the feature.

## 9. Common problems

| Symptom | Cause |
|---|---|
| Three tabs redirect to the login page | The route registration drifted from the destination list. Routes are derived from it in `emailRouteTable.ts`; check that patch applied. |
| Every deadline renders a day early | A date formatted without `timeZone`. The module pins `Australia/Melbourne`; a new call site missed it. |
| A queue sorted oddly | Comparing ISO timestamps as strings. The dataset mixes `+11:00` and `+10:00`; use `ms()` from `views.ts`. |
| Small grey text looks washed out | The Workspace's own `--text-muted` fails AA on these surfaces. Use `--ecc-text-quiet`. |
| The accessibility suite times out | The dev server is not on 5199, or it is `vite preview` rather than `vite`. The harness is served by the dev server. |
