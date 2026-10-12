# Email Command Centre: setup requirements

Concludo Workspace, Email Command Centre module. Stage 6. Concludo is an
independent product, not affiliated with or endorsed by Microsoft, Google or any
device maker.

Nothing in this list has been done. The module runs today on the synthetic
dataset with no mailbox, no token and no network call to any provider. This is
the list of what a real connection would require, in the order it has to happen.

---

## 1. What runs today, with no setup at all

```
bun install
bun run dev          # the Workspace, module at /email
bun run build        # production build
```

Tests:

```
bun app/tests/emailCommandCentre.model.test.ts
bun app/tests/emailCommandCentre.shell.test.ts
bun app/tests/emailCommandCentre.views.test.ts
bun app/tests/emailCommandCentre.intelligence.test.ts
bun app/tests/emailCommandCentre.integration.test.ts

# browser suite needs the dev server on 5199 first
npx vite --port 5199 --strictPort
node app/tests/browser/emailCommandCentre.browser.test.mjs
```

No environment variable is needed for any of the above. That is deliberate: a
module that cannot be run and reviewed without credentials does not get
reviewed.

## 2. Server component (prerequisite, not built)

The OAuth flow needs a server that can hold a client secret. The browser cannot.
Required of it:

1. An HTTPS endpoint for the redirect URI, on a registered domain.
2. Authorisation code flow with PKCE. The code exchange happens server side.
3. A token store: encrypted at rest, per account, with key rotation, and no read
   path that returns a token value to anything other than the provider adapter.
   Callers get a `TokenHandle`.
4. Refresh handling, including the two terminal states the sync already
   distinguishes: `expired_permission` and `revoked_credential`. Neither is
   retried.
5. Request logging that cannot contain a token. `redactDeep` is available and
   should wrap every log and error path.

Until this exists, `oauth_connect` reports `skipped` with the reason, and no
other stage can reach a real mailbox.

## 3. Microsoft 365 registration

1. Register an application in Microsoft Entra ID. Record the tenant model
   (single tenant for a pilot, multi-tenant later) as a deliberate decision.
2. Add the redirect URI. Web platform, not single-page application, because the
   secret stays on the server.
3. Add delegated permissions only, exactly these four:
   `offline_access`, `User.Read`, `Mail.Read`, `MailboxSettings.Read`.
4. Do **not** add `Mail.ReadWrite` here. It is requested incrementally, and only
   if a person turns on saving drafts to their own Drafts folder.
5. Add no application permissions at all. Every `.All` scope is on the forbidden
   list for a reason (see `docs/PERMISSIONS.md`).
6. Create a client secret or, preferably, a certificate. Store it in the secret
   manager, never in the repository, never in a build artefact.
7. Publisher verification and the privacy and terms URLs are required before any
   customer outside the development tenant can consent. Treat this as lead time,
   not paperwork.

## 4. Google Workspace registration

1. Create a Google Cloud project. Enable the Gmail API and nothing else.
2. Configure the OAuth consent screen. Scopes: `gmail.readonly` and
   `userinfo.email`. `gmail.compose` is added later, incrementally.
3. `gmail.readonly` is a **restricted** scope. Publishing requires an
   independent security assessment (a CASA tier-two assessment, annually), a
   demonstrated limited-use justification and a verified application. This is
   the single longest lead time in the whole integration and costs real money.
   Plan for it before promising a Gmail connection to anybody.
4. Until the assessment is complete, the application stays in testing mode with
   a hard cap on test users. That is a legitimate way to pilot, but it is not a
   product that can be sold.
5. Create OAuth client credentials of type Web application. Add the redirect
   URI. Store the secret in the secret manager.

## 5. Change notifications (optional, later)

- Microsoft Graph: a subscription per mailbox, renewed before expiry, with a
  validation token handshake on creation and signature validation on delivery.
- Gmail: a Pub/Sub topic with a push subscription, and a watch request per
  mailbox renewed at least every seven days.

Both are optional. Scheduled incremental sync works without either and is what
the built code assumes. `acceptNotification` already enforces subscription
ownership and deduplication for when they are added.

## 6. Analysis store

Supabase, with:

- row-level security keyed to the owning person, on every analysis table;
- `account_id` on every row, so a cross-account bug is visible in the data;
- the audit table append-only: no update and no delete grant to the application
  role;
- a retention job calling the sweep in `privacy.ts` on a schedule;
- backups that are themselves access controlled, because a backup of this
  database is a backup of commercially sensitive client correspondence.

## 7. Model provider

Six stages are model calls and none is built. Before they are:

1. A written agreement with the provider stating that customer data is not used
   for training. The stance in `MODEL_TRAINING_STANCE` is Concludo's own
   commitment and does not bind anybody else.
2. A key in the secret manager, never in the client bundle.
3. The prompt version recorded with every output, which `Generated<T>` already
   requires.
4. Rate limiting and cost control per account. The Starter cap of three analysed
   threads per week, resetting Monday 5:30am Melbourne time, is the entitlement
   control; it is not a substitute for a spend limit.

## 8. Legal and privacy prerequisites

- A privacy policy that names mailbox access specifically, not in general terms.
- A data processing position for Australian Privacy Principles purposes, since
  the content being analysed is largely third-party personal information that
  the Concludo customer holds and Concludo processes.
- The consent and recording guidance already in the Concludo toolkit applies
  here too: a person connecting a mailbox is consenting on behalf of
  correspondents who have not been asked.
- A data breach response position, because mailbox analysis is the kind of
  processing where a breach is notifiable.

None of these is optional before a real mailbox is connected, and none is
engineering work.

## 9. The gate

A real connection should not be attempted until, at minimum: the server
component exists, the token store is encrypted and reviewed, the manual
checklist in `docs/SECURITY_CHECKLIST.md` has been worked through on a test
mailbox that belongs to Concludo, and the privacy policy is published. The first
connected mailbox should be a Concludo one, with nothing in it that matters.
