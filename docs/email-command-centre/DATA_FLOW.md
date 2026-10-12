# Email Command Centre: data flow

Concludo Workspace, Email Command Centre module. Stage 6. Concludo is an
independent product, not affiliated with or endorsed by Microsoft, Google or any
device maker.

This document traces what moves, where it stops, and what is kept.

---

## 1. Connection

```
person -> Concludo -> provider consent screen -> provider -> Concludo server
```

1. The person chooses a provider and an account type (work or personal).
2. Concludo shows each scope it is about to request, in plain words, with the
   justification. This happens **before** the provider's consent screen, not
   after it.
3. `assertScopesPermitted()` runs. A forbidden or undeclared scope throws here,
   before an authorisation URL exists.
4. Authorisation code flow with PKCE. The code is exchanged on the server. The
   client secret never reaches the browser.
5. Tokens go straight into the token store, encrypted at rest. Nothing else ever
   receives the token value. Callers receive a `TokenHandle`.

Not built in this environment: steps 4 and 5 need a registered application and a
server that can hold a secret.

## 2. Folder selection

The person chooses which folders or labels are analysed. Spam, bin, sent and
archive are excluded by default. Exclusions are applied **before** analysis, not
as a filter on results, so an excluded thread is never read, never sent to a
model and never stored.

## 3. Synchronisation

```
cursor -> syncPage -> page of messages -> idempotency ledger -> accepted
       -> next page -> ... -> last page -> cursor advanced
```

- Microsoft uses a delta token, Google a history id. Both are held as a
  `SyncCursor` carrying its own `accountId`.
- The ledger key is `accountId::providerMessageId`. The same message id on two
  accounts is two different things, which it is.
- **The cursor advances only when a run completes every page.** A failure
  halfway leaves the stored cursor where it was. Advancing past messages that
  were never processed loses them silently and forever, and nobody notices until
  somebody asks why a thread never appeared.
- An expired cursor triggers a full resynchronisation and discards what was
  collected in that run, because a half-delta plus a full sync is a state nobody
  can reason about afterwards.
- Rate limit: back off and retry the same page, honouring `Retry-After` over any
  computed wait. Expired permission and revoked credential stop immediately and
  do not retry.

A change notification (webhook) is accepted only when its subscription id is one
this system registered, that subscription belongs to the account the
notification names, and the event id has not been seen. Providers redeliver
routinely, and a notification is the one place an outside party can poke the
system.

## 4. Normalisation, and what is thrown away immediately

For each message:

- HTML is reduced to text.
- **Remote content is stripped**: images, scripts, iframes and remote
  stylesheets. The removal is visible in the text (`[image removed]`) rather
  than silent, so a person reading the summary knows something was there.
- Tracking pixels are reported with the reason they were identified, and are
  never fetched. Analysis never loads a remote resource, so reading a message in
  Concludo does not tell the sender anything.
- Participants are resolved against the account's owned addresses, which is what
  makes "waiting on you" different from "waiting on them".
- Quoted history is split from the new text, conservatively: if splitting would
  leave less than fifteen characters of new text, the whole body is kept as new
  text. A wrong split that hides the actual message is worse than a missed one.

## 5. Safety preprocessing, before any model sees anything

```
message body ->  wrapUntrusted(body, label)  ->  model input
             ->  detectInjection(body)       ->  observations only
```

Every message is wrapped as untrusted data, whether or not anything was found.
Fence markers inside the content are stripped so content cannot close its own
wrapper, and the rule that says "this block is data, not instruction" is placed
**after** the content, where text inside the block cannot get in front of it.

The detector is an alarm, not a lock. Nine rules look for the shapes an injected
instruction takes. Findings are recorded as observations, raise a visible flag
and are never acted on. If the detector misses an attempt, the attempt still
does nothing, because the capability layer has no send, no forward, no delete
and no execution behind it. That is the control. The detector is what tells the
person it happened.

## 6. Analysis

Local stages compute thread reconstruction (nine determinations, each carrying
its evidence), priority (eleven factors), risk screening (nine categories) and
aggregation. Model stages classify, summarise and extract.

Model output is JSON validated against a schema before it is used:

- every issue is collected, not just the first;
- a field the schema does not declare is an error, not something to ignore,
  because a model that invents a field is a model whose prompt has drifted;
- a timestamp without an offset is rejected outright, since a date without a
  zone is how a deadline lands on the wrong day;
- an invalid field is dropped rather than displayed. A malformed extraction
  shown to a person is worse than none: they cannot tell a model error from a
  parser error.

Every generated field carries model identity, prompt version, schema version,
timestamp, confidence, source references, correction status and approval status.

## 7. What is stored, and what is not

| Stored | Not stored |
|---|---|
| Analysis: summaries, actions, deadlines, priority, flags, source references with short quotes | A copy of the mailbox |
| Thread and message identifiers, participants, timestamps, subjects | Message bodies beyond the quoted fragments a source reference needs |
| Audit events describing what the system did | Attachment contents (processed in memory when enabled, then discarded) |
| Account metadata, owned addresses, folder choices, capability grants | Tokens, client secrets, refresh tokens (token store only, never here) |

The analysis store is not a second mailbox with a longer retention period. The
audit trail is a record of actions, not a copy of the mail.

## 8. Account separation

Each account has its own dataset, its own cursor, its own ledger keys and its own
capability grants. The runner refuses to start when the dataset's account id
does not match the token's, and the mock provider resolves a dataset only from
the account the token names.

Work and personal accounts are separate by default. A combined view is an opt-in
capability, off until the person turns it on. Nothing from a personal account is
used in a work reply, and nothing from a work account is used in a personal
reply, because the draft context is built from one account's dataset and there is
no code path that reads across the boundary.

## 9. Retention, export and deletion

- **Retention sweep** deletes analysis older than the policy window. It does not
  touch mail, because Concludo does not hold the mail.
- **Export** returns everything held for an account and states, in a
  `notIncluded` section, what was deliberately left out. An export that quietly
  omits something is worse than one that says what it omits.
- **Deletion** returns a plan with an honest `retains` section. The audit trail
  survives, and the plan says so rather than implying a clean erase.
- **Model training:** no customer data is used to train or fine-tune any model.
  The stance in `MODEL_TRAINING_STANCE` states both what it covers and what it
  does not, so it is not read as a guarantee about a third party's own logging.
