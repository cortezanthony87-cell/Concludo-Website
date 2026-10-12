# Email Command Centre: production deployment

Concludo Workspace. Final, Stage 7.

**Read this first.** The module is ready to deploy as a reviewable, usable
feature running on synthetic data. It is **not** ready to connect a customer
mailbox, because the OAuth flow, the token store and the model calls are
specified and not built. Deploying it dark, behind a flag, with the flag off,
is the correct production step today. Deploying it with mailbox connection
turned on is not possible, and would not be safe if it were.

Concludo is pre-revenue. Nothing in this document implies live sales, validated
pricing or customer traction.

---

## 1. The gate

Do not deploy with `VITE_ECC_ENABLED=true` until **all** of the following are
true. Each one is a hard gate, not a preference.

| # | Gate | Where it is proven |
|---|---|---|
| 1 | Every test suite passes on the commit being deployed | `docs/TEST_REPORT.md` |
| 2 | `tsc --noEmit` clean, production build clean | CI |
| 3 | Migrations applied, and `0099_verify.sql` passed on staging | `docs/migrations/` |
| 4 | Row-level security enabled **and forced** on all fifteen tables | the query in `docs/SETUP_STAGING.md` section 4 |
| 5 | The server component exists: OAuth broker, encrypted token store, key rotation, reviewed by somebody who did not build it | `docs/SETUP.md` |
| 6 | `docs/SECURITY_CHECKLIST.md` worked through on a Concludo test mailbox, sections A to G with no unchecked box | that file |
| 7 | Privacy policy published, naming mailbox access specifically | legal |
| 8 | Monitoring and alerting live, with the four page-worthy alerts firing in a test | `docs/MONITORING.md`, `docs/ALERTING.md` |
| 9 | Backup and restore rehearsed, not just configured | `docs/BACKUP_AND_RECOVERY.md` |
| 10 | Incident response has a named owner and a tested notification path | `docs/INCIDENT_RESPONSE.md` |

Gates 5 to 10 are not met today. That is why the flag stays off.

## 2. Deploying dark, which is today's step

```
# Build
bun install --frozen-lockfile
npx tsc --noEmit
bun run build

# Environment, production
VITE_ECC_ENABLED=false
VITE_ECC_PROVIDERS=
```

With the flag off, the sidebar entry is hidden and the eleven routes are not
registered. The module ships in the bundle and does nothing. This is worth
doing: it means the code is deployed, the build is proven on the production
pipeline, and turning it on later is a flag rather than a release.

Apply the migrations at the same time. An empty schema costs nothing and means
the database work is not sitting in a branch when the server component lands:

```
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" \
  -f docs/migrations/0001_email_command_centre_core.sql \
  -f docs/migrations/0002_row_level_security.sql \
  -f docs/migrations/0003_retention_and_deletion.sql
```

Do **not** run `0099_verify.sql` against production. It writes before it rolls
back. It belongs on staging.

## 3. Turning it on, when the gates are met

In this order. Each step is reversible, and each one is a day or more apart from
the next, so a problem surfaces before the next change hides it.

**Step 1. Internal only.** Enable the flag for Concludo accounts alone. One
provider, Microsoft. Connect the Concludo test mailbox and nothing else. Leave
it a week and read the audit trail at the end of it.

**Step 2. One real mailbox, with consent.** The first non-test mailbox should
belong to somebody who knows exactly what is being connected and has read the
permissions document. Not a paying customer.

**Step 3. A small cohort.** Five to ten accounts, hand-chosen, each told
plainly that the feature is new. Watch the four page-worthy alerts and the
weekly review in `docs/MONITORING.md`.

**Step 4. Available on Pro and Team.** With the Starter cap of three threads
per week enforced server side, not in the browser.

**Step 5. Gmail.** Only after the restricted-scope assessment is complete. It
is the longest lead time in the whole integration and it costs money.

## 4. Rollback

The flag is the rollback for the user-facing part:

```
VITE_ECC_ENABLED=false
```

That hides the module immediately and stops any new analysis being requested.
It does not stop a scheduled synchronisation, so also:

- pause the synchronisation scheduler for the module;
- leave the stored cursors **alone**. A cursor is how a resumed sync knows what
  it has already seen; resetting one causes a full resynchronisation, which is
  safe but slow and loud.

The migrations are additive and are not rolled back as part of an incident.
Nothing in the application reads a table that was not there before, so leaving
the schema in place is the safer option. If a migration itself has to be undone,
that is a new migration with its own review, not a `down` script run under
pressure.

## 5. What a deployment must not include

- A secret in any `VITE_`-prefixed variable. That prefix compiles the value into
  the browser bundle. Grep the built bundle before shipping.
- A production token store key shared with staging.
- A copy of production data anywhere other than production and its backups.
- Any scope beyond the four Microsoft and two Google scopes in
  `docs/PERMISSIONS.md`.
- `0099_verify.sql`.

## 6. Post-deployment checks

Immediately after enabling the flag for any cohort:

1. Open all eleven tabs. No console error, no blank view.
2. Confirm the account note on every view names the account and states the
   separation.
3. Open Settings and read the register of external actions. Four unavailable,
   one needing approval. If any row says something else, the code and the page
   have diverged, which is itself the alarm.
4. Confirm the Drafts page has no send control.
5. Start and pause a backlog session, reload, and resume it.
6. Check the audit trail has a row for the analysis that just ran, and that it
   contains no message content.
7. Watch the error rate and the synchronisation outcome mix for an hour.

## 7. Scheduled work

| Job | Cadence | Notes |
|---|---|---|
| Incremental synchronisation | Every 15 minutes per connected account | Honours `Retry-After`. Cursor advances only on a completed run |
| Retention sweep | Daily, 03:00 Australia/Melbourne | `ecc_retention_sweep` |
| Starter entitlement reset | Weekly, Monday 05:30 Australia/Melbourne | Cron `30 5 * * 1`, zone `Australia/Melbourne` |
| Subscription renewal | Daily | Only if provider notifications are used. Graph subscriptions and Gmail watches both expire |
| Token refresh | On demand, not scheduled | Two terminal states are never retried: expired permission, revoked credential |

Every scheduled job writes an audit event. A job that silently did not run is
the failure mode these alerts exist for.
