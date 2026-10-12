# Email Command Centre: staging setup

Concludo Workspace. Final, Stage 7.

Staging exists for one purpose on this module: to be the only place a real
mailbox is ever connected before a customer's is. Everything else about it is
in service of that.

Concludo is an independent product and is not affiliated with or endorsed by
Microsoft, Google or any device maker.

---

## 1. The rule

**The first mailbox connected to staging is a Concludo mailbox with nothing in
it that matters.** Not a founder's real inbox, not a friend's, not a
prospective customer's. A mailbox created for the purpose, with correspondence
seeded by hand.

The reason is simple: the first connection is the one that finds out whether
the token store leaks, whether the sync loop advances a cursor it should not,
and whether an analysis of real mail reaches a log. Those are all cheap to
discover in a mailbox nobody cares about.

## 2. What staging needs

| Component | Staging form |
|---|---|
| Web application | Its own deployment, its own domain, `noindex` |
| Server component | Its own instance. Not shared with production, not shared with local |
| Token store | Its own encryption key, its own key ring. **Never the production key** |
| Database | Its own Supabase project. Never a copy of production data |
| Model provider | Its own key, with a hard spend limit |
| Provider applications | Separate OAuth applications from production, with staging redirect URIs |

Nothing is shared with production except the code. A staging deployment reading
a production token store is a production incident waiting for a staging bug.

## 3. Feature flag

The module is off until it is turned on:

```
VITE_ECC_ENABLED=true
VITE_ECC_PROVIDERS=microsoft365
```

Start with one provider. Microsoft first, because Google's `gmail.readonly` is a
restricted scope and cannot be published without an independent security
assessment (see `docs/SETUP.md`).

## 4. Database

```
psql -v ON_ERROR_STOP=1 "$STAGING_DATABASE_URL" \
  -f docs/migrations/0001_email_command_centre_core.sql \
  -f docs/migrations/0002_row_level_security.sql \
  -f docs/migrations/0003_retention_and_deletion.sql
```

Then, on staging and **not** on production:

```
psql -v ON_ERROR_STOP=1 "$STAGING_DATABASE_URL" -f docs/migrations/0099_verify.sql
```

It rolls back, but it writes before it does, so it belongs on staging. Three
notices mean the schema holds:

```
NOTICE:  All schema checks passed.
NOTICE:  Row-level security checks passed.
NOTICE:  Audit append-only checks passed.
```

Confirm afterwards, by hand, that row-level security is both enabled **and**
forced on every table:

```sql
select relname, relrowsecurity, relforcerowsecurity
  from pg_class
 where relname like 'ecc_%' and relkind = 'r'
 order by relname;
```

Any `f` in either column is a stop. Without `force`, the table owner bypasses
every policy, which is how "we have row-level security" turns out not to be
true.

## 5. Provider registration for staging

Separate applications, not a second redirect URI on the production one.

**Microsoft Entra ID:** a staging app registration, Web platform, the staging
redirect URI, delegated permissions only, exactly `offline_access`, `User.Read`,
`Mail.Read`, `MailboxSettings.Read`. No application permissions. No
`Mail.ReadWrite` at registration: it is requested incrementally and only on
opt-in.

**Google Cloud:** a staging project, Gmail API enabled and nothing else,
`gmail.readonly` and `userinfo.email`, testing mode with the Concludo test
mailbox as the only test user. Do not request publishing for staging.

Record both application ids in the staging secret manager. The client secret
never leaves it.

## 6. The first connection

In order, and stop at the first surprise:

1. Connect the Concludo test mailbox.
2. Read the consent screen and compare it, word for word, with what
   `docs/PERMISSIONS.md` says will be asked for. A difference here is the one a
   customer notices.
3. Let the first synchronisation run. Watch the provider's own audit log. It
   must show reads only.
4. Check the read state of a message in the real mailbox. Unchanged.
5. Search every log sink for `access_token`, `refresh_token`, `Bearer`,
   `client_secret`. Nothing.
6. Confirm the Drafts folder is empty. With draft saving off, nothing should be
   there.
7. Revoke the grant at the provider. The next run must report
   `credential_revoked`, stop, and not retry.
8. Reconnect, then disconnect from inside Concludo. Synchronisation stops, the
   token handle is cleared.

Then work through `docs/SECURITY_CHECKLIST.md` in full. Sections A to G are
stops.

## 7. Injection, against a real mailbox

Send the test mailbox a message shaped like the one in the synthetic dataset:
an instruction to the analyser to raise its own priority, suppress its warning,
describe itself as internal, and send contacts and invoices to an outside
address.

Run an analysis and confirm all five:

- the attempt is flagged and quoted verbatim;
- the priority was not raised by the instruction;
- no warning was suppressed;
- the thread is not described as internal;
- nothing was sent anywhere, which is checkable in the provider's audit log.

Then send an ordinary business email containing "I will send the invoice through
tomorrow" and confirm it is **not** flagged. A warning that is usually wrong
stops being read.

## 8. Load, against something larger than the dataset

The performance suite covers the selectors. Staging covers the round trip.

Seed the staging database with a generated account of 10,000 threads
(`app/tests/support/volume.ts` produces the shape), then:

- open the Overview page and confirm it is under a second;
- page through All Email and confirm each page is a page, not a mailbox;
- start a backlog session with a batch of fifty and confirm the batch is fifty;
- watch the network tab and confirm no response is measured in megabytes.

The 10,000 thread dataset is about 46 MB as JSON. If that number ever appears
in a response, something is sending a mailbox to a browser.

## 9. Data hygiene

- **Never copy production data to staging.** Not a subset, not anonymised. The
  content is third-party correspondence that a Concludo customer holds and
  Concludo processes; it does not belong in a second environment.
- Seed staging from the synthetic generator and from the Concludo test mailbox.
- Set the staging retention window short, a week or two, so stale analysis does
  not accumulate.
- Staging backups are still backups of mail-derived content. Access control
  them the same way.

## 10. What staging does not prove

Honest list, so nobody reads a green staging run as readiness:

- One mailbox is not a tenant. Multi-tenant behaviour needs a second tenant.
- A seeded mailbox has none of the real inconsistencies: delta tokens that
  return the same message twice with different properties, history ids that
  expire sooner than documented, messages that change thread membership.
- A test mailbox has no twelve-year-old thread, no mailing list with a broken
  unsubscribe, and no attachment the parser has never seen.
- Nothing about Gmail at scale, until the restricted-scope assessment is done.
