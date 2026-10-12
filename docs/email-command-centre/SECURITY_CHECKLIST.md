# Email Command Centre: manual security review checklist

Concludo Workspace, Email Command Centre module. Final, Stage 7. Concludo is an
independent product, not affiliated with or endorsed by Microsoft, Google or any
device maker.

Work through this before any real mailbox is connected, and again before any
release that touches `providers/`, `sync/`, `security/`, `pipeline/` or
`privacy.ts`. The automated suite covers what can be asserted in code; this
covers what a person has to look at.

The first connected mailbox must be a Concludo mailbox with nothing in it that
matters. Do not run this against a customer mailbox.

---

## A. Before the first connection

- [ ] Registered application scopes at Microsoft match `MICROSOFT_BASE` in
      `scopes.ts` exactly. No extra permission, no application permission, no
      `.All`.
- [ ] Registered scopes at Google match `GOOGLE_BASE` exactly. Gmail API
      enabled, nothing else.
- [ ] `Mail.ReadWrite` and `gmail.compose` are **not** in the base registration.
- [ ] Every scope in the registration appears in `scopes.ts` with a written
      justification. A scope nobody can justify in a sentence is removed.
- [ ] No scope in the registration appears in `FORBIDDEN_SCOPES`.
- [ ] Client secret is in the secret manager. Grep the repository, the build
      output and the container image for it and find nothing.
- [ ] `.env.local` is in `.gitignore`, and `git log -p` contains no credential
      anywhere in history.
- [ ] No `VITE_`-prefixed variable holds a secret. Open the built bundle and
      search it for any value that should be server side.
- [ ] Privacy policy published, naming mailbox access specifically.
- [ ] Token store encryption and key rotation reviewed by someone who did not
      build it.

## B. Consent and connection

- [ ] The scope list and its justification are shown **before** the provider
      consent screen, not after.
- [ ] The wording on that screen matches what the provider will actually ask
      for. A difference here is the one a customer notices.
- [ ] Declining consent leaves no partial account record behind.
- [ ] Connecting a second account does not alter the first account's grants.
- [ ] Deliberately request a forbidden scope in a scratch branch and confirm
      `assertScopesPermitted()` throws before an authorisation URL is built.
- [ ] Deliberately request an undeclared but harmless scope and confirm it is
      also refused.

## C. Token handling

- [ ] Search every log sink for `access_token`, `refresh_token`, `Bearer`,
      `client_secret`, `api_key`. Nothing.
- [ ] Trigger a provider error on purpose (bad token) and read the resulting
      log line and audit event. Neither contains a credential or a message body.
- [ ] Confirm nothing in the browser's network tab, local storage or session
      storage holds a token.
- [ ] Revoke the grant at the provider. The next run reports
      `credential_revoked`, stops, and does not retry.
- [ ] Let an access token expire. Refresh happens server side, and the person is
      not asked to sign in again.

## D. Read-only, proven by trying

- [ ] Read the diff of `providers/types.ts`. `ReadOnlyMailProvider` has five
      methods. No send, reply, forward, delete, archive or label method exists.
- [ ] Attempt to call `grant()` on each of the seventeen denied capabilities.
      Every one throws.
- [ ] Check the provider's own audit log after a full analysis run. It shows
      reads only. No message was marked read, moved, labelled or deleted.
- [ ] Confirm a message's read state in the real mailbox is unchanged after
      analysis.
- [ ] With draft saving off, confirm nothing appears in the Drafts folder.
- [ ] With draft saving on and a draft approved, confirm exactly one draft
      appears, unsent, and that nothing was sent.

## E. Untrusted content

- [ ] Send yourself the dataset's injection message, or one like it, and run an
      analysis. The attempt is flagged, quoted verbatim, and nothing in the
      analysis obeys it: priority is not raised by the instruction, no warning is
      suppressed, the thread is not described as internal, and no data is sent
      anywhere.
- [ ] Send a message containing the wrapper's own fence markers. Confirm the
      content cannot close its wrapper.
- [ ] Send a message with a tracking pixel. Confirm it is reported and that no
      request was made to the tracker: check the tracker's own logs if you
      control it, or watch outbound requests during the run.
- [ ] Send an HTML message with a remote stylesheet and a script. Confirm both
      are stripped and that the removal is visible in the text.
- [ ] Send an ordinary business email containing "I will send the invoice
      through tomorrow". Confirm it is **not** flagged.

## F. Account and tenant separation

- [ ] Connect a work and a personal account. Confirm each view names the account
      and states the separation.
- [ ] Generate a draft on a work thread and read every quoted fragment and
      figure in it. Nothing comes from the personal account.
- [ ] With the combined view off, confirm no screen shows both accounts' threads
      together.
- [ ] In the database, confirm every analysis and audit row carries an
      `account_id`, and that row-level security blocks a second user from
      reading them.
- [ ] Attempt a run with a cursor from another account. It throws rather than
      correcting itself quietly.

## G. Sync and recovery

- [ ] Interrupt a sync mid-run. Confirm the stored cursor is unchanged and the
      next run picks up the same messages rather than skipping them.
- [ ] Force a rate limit. Confirm the backoff honours `Retry-After` and that the
      same page is retried rather than skipped.
- [ ] Invalidate the delta token or history id. Confirm a full resynchronisation
      runs and that no duplicate analysis is produced.
- [ ] Replay a change notification. Confirm the duplicate is ignored.
- [ ] Send a notification naming a subscription this system did not register.
      Confirm it is refused and recorded as worth investigating.

## H. Output honesty

- [ ] Pick five extracted deadlines and locate each quoted source sentence in
      the actual message. All five are verbatim and in the right message.
- [ ] Confirm each deadline is labelled `stated`, `inferred` or `calculated`,
      and that an inferred one is not presented as stated.
- [ ] Set the browser to a non-Australian time zone and confirm no date moves.
- [ ] Find an unanalysed thread. It says it is unanalysed rather than appearing
      analysed with nothing in it.
- [ ] Take a thread the module calls resolved and read it. It is resolved.
- [ ] Approve a draft, change one word of the body, and confirm the approval is
      invalidated and the changed field is named.

## I. Retention, export, deletion

- [ ] Run the retention sweep. Analysis older than the window is gone. No mail
      is touched, which is trivially true because Concludo holds none.
- [ ] Export an account. Read the `notIncluded` section and confirm it is
      accurate rather than reassuring.
- [ ] Search the export for anything resembling a credential. Nothing.
- [ ] Request deletion. Read the `retains` section, confirm the audit trail is
      named, and confirm the analysis is actually gone from the database and not
      only hidden.
- [ ] Confirm disconnecting an account stops all synchronisation immediately.

## J. The approval gate (added in Stage 7)

- [ ] Open Settings and read the register of external actions. Four unavailable,
      one needing approval. If it says anything else, the code and the page have
      diverged, which is itself the alarm: the table is generated from
      `approvals.ts`.
- [ ] Forge an approval for `send_reviewed_draft` in a scratch branch and call
      `planAction`. It is refused with `release_disabled`, **before** the
      approval is read.
- [ ] Call `planAction` for `archive_messages`, `create_task` and
      `create_reminder`. All three refused by the release.
- [ ] Call `planAction` for `save_draft_to_mailbox` with two item ids. Refused
      as a bulk action.
- [ ] Call it with the capability off. Refused.
- [ ] Call it with an approval for a different payload. Refused as expired.
- [ ] Call it with an approval granted on the other account. Refused as an
      account mismatch.
- [ ] Approve a draft, change one word of the body, and confirm the approval is
      invalidated and the changed field is named. Repeat for the subject, a
      recipient, the from address, the account and an attachment.
- [ ] Confirm that adding a space to the body does **not** invalidate it.
      Treating whitespace as a material edit trains people to re-approve
      reflexively, which is how approval becomes a formality.
- [ ] In the database, confirm `ecc_action_approval` has no row with
      `executed_at` set and no corresponding approval, and none where
      `invalidated_at` is earlier than `executed_at`.

## K. Backlog mode (added in Stage 7)

- [ ] Start a session, decide an item, pause, close the tab, reopen. The paused
      session is **offered**, not resumed silently. Nobody is dropped into the
      middle of a queue they did not start.
- [ ] Read what is in `localStorage` under
      `concludo.ecc.backlog.session.v1`. It holds the selection, the thread ids
      and the decisions, and **no copy of the analysis**.
- [ ] Decide one item in each of the eight states. Confirm in the provider's own
      audit log that nothing was sent, archived, deleted, labelled or marked as
      read by any of them.
- [ ] Confirm the two states that do not close an item leave the person on it: a
      drafted reply and one sent to manual review.
- [ ] Run a backlog selection on the work account while the personal account has
      threads matching the same criteria. No personal thread appears.
- [ ] Read every string on the page. No leaderboard, no score, no comparison, no
      "behind", no "only N left". There is a test for this and it should agree
      with you.

## L. Database (added in Stage 7)

- [ ] Migrations 0001 to 0003 applied. `0099_verify.sql` run on staging, three
      passing notices.
- [ ] Row-level security **enabled and forced** on all fifteen tables. Any `f`
      in either column is a stop: without `force`, the table owner bypasses
      every policy.
- [ ] `ecc_audit_event` grants to `authenticated` are `SELECT` and `INSERT`
      only. Try an update and a delete as that role and confirm both are refused.
- [ ] Insert a child row whose `account_id` differs from its thread's account.
      Refused by the trigger, with a message naming the separation.
- [ ] Insert an analysed row with no model or prompt version. Refused.
- [ ] Insert an extraction with an empty `sources` array. Refused.
- [ ] Try to grant a denied capability through `ecc_capability_grant`. Refused
      by the check constraint, independently of the application.
- [ ] Run `ecc_export_account` and confirm no token handle is in the output and
      the `not_included` list is accurate rather than reassuring.
- [ ] Run `ecc_delete_account_data` on a test account. Read the `retains`
      block. It names the audit trail, the account row, the provider's own copy
      of the mail, and the stored token.

## M. Sign-off

- [ ] Every automated suite passes on the commit under review. Nine suites,
      3,450 checks, plus the schema verification.
- [ ] `docs/KNOWN_LIMITATIONS.md` is current. Anything found during this review
      that is not fixed is added to it before sign-off.
- [ ] The seven "push back on" items in that document were discussed, with a
      decision recorded for each.
- [ ] Reviewer name and date recorded, and it is not the person who wrote the
      code.

---

Any unchecked box in sections A to G, J, K or L is a stop. Sections H and I can
carry a recorded exception with an owner and a date. A review with no findings
has usually not happened.
