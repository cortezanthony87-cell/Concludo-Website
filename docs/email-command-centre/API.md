# Email Command Centre: API documentation

Concludo Workspace. Final, Stage 7.

Two layers are documented here, and the distinction matters.

**The module API** is TypeScript, it exists, and it is what the eleven views are
built on. Every function listed under section 2 is implemented and tested.

**The server API** is HTTP, it does **not** exist, and section 3 is a
specification. It is written out because the module was built against it as a
contract: the module reads from one adapter, and swapping the synthetic
adapter for an HTTP client is the only change needed in the views. Nothing in
section 3 has been built, no endpoint has ever been called, and no mailbox has
ever been connected.

Concludo is an independent product and is not affiliated with or endorsed by
Microsoft, Google or any device maker.

---

## 1. The shape of the data

Defined in `src/lib/email/model.ts`. The types a caller needs:

| Type | What it is |
|---|---|
| `ConnectedAccount` | One mailbox, its owned addresses, its folder exclusions, its time zone |
| `EmailThread` | A conversation: subject, folder, participants, message ids, read state |
| `EmailMessage` | One message: participants, timestamps, body, quoted history, attachments |
| `ThreadAnalysis` | Everything derived from a thread: summary, status, priority, extractions |
| `Deadline`, `Action`, `Decision`, `Commitment`, `OpenQuestion`, `Conflict`, `Risk` | The extractions, each `Traceable` |
| `SecurityAlert` | Flags, severity, explanation, recommended check, always `advisory` |
| `ReplyDraft` | Three style variants, or a refusal with the reason |
| `Priority` | Score, band, the eleven factors with reasons, escalation |
| `AccountDataset` | One account's whole world, which is the unit every selector takes |

Two interfaces carry the product's guarantees in the type system:

```ts
interface Traceable {
  /** Non-empty for anything extracted from a message. */
  source: readonly SourceRef[];
  basis: 'stated' | 'inferred' | 'calculated';
  confidence: 'high' | 'medium' | 'low';
}

interface SourceRef {
  threadId: string;
  messageId: string;
  /** Verbatim from the message, so a person can find it. */
  quote?: string;
}
```

`basis` is the field the product rests on. A date a person acts on has to say
whether the sender wrote it or Concludo worked it out.

## 2. The module API, which exists

### Reading a dataset

```ts
recordsFor(dataset: AccountDataset): ThreadRecord[]
```

The only entry point into a dataset. Returns a thread, its analysis, its
messages and the derived fields every view needs, in one object. Indexed
internally: O(n) in the number of threads.

```ts
applyFilter(records: readonly ThreadRecord[], filter: ThreadFilter): ThreadRecord[]
```

Every filter dimension, combined with AND. Bulk mail, resolved threads and
duplicates are excluded **by default** and have to be asked for.

### The dashboard

```ts
metricCounts(records, now): MetricCount[]          // the eight numbers
queueRecords(records, key, now): ThreadRecord[]    // one queue
buildDashboard(dataset, now, extra?): DashboardData
```

`buildDashboard` caps each queue at `QUEUE_PREVIEW_SIZE` (ten) and reports
`totalRecords`, so a page never holds a whole mailbox.

### The eight views

```ts
needsAttentionItems(records, accountLabel, now): NeedsAttentionItem[]
replyQueueItems(records, drafts, now, activeFilters?, style?): ReplyQueueItem[]
datedItems(records, now, userDates?): DatedItem[]
waitingItems(records, now): WaitingItem[]
quickWinItems(records, now): QuickWinItem[]
allEmailRecords(dataset, state, now): ThreadRecord[]
draftItems(records, drafts, style, statuses?): DraftItem[]
securityItems(records, now): SecurityItem[]
sortAllEmail(records, sort, now): ThreadRecord[]
paginate<T>(items, pageIndex, pageSize): Page<T>
```

### Thread intelligence

```ts
reconstructThread(input): ThreadReconstruction
```

Nine determinations, each a `Determination<T>` carrying `value`, `confidence`,
`basis` and `evidence`: latest meaningful message, whether the user replied,
answered and unanswered questions, changed deadlines, conflicts, the current
owner, whether it is resolved, and who is waiting.

### Priority

```ts
buildPriority(factors, confidence?, escalation?, derived?): Priority
compareByPriority(a, b): number
```

Eleven weighted factors. `compareByPriority` sorts by **band first, then
score**, so an escalation cannot be defeated by a higher raw number.

### Backlog mode

```ts
buildBacklogBatch(records, selection, now): BacklogBatch
startSession(batch, now, id?): BacklogSession
recordDecision(session, threadId, state, now, note?): BacklogSession
skipCurrent(session, now): BacklogSession
goBack(session, now): BacklogSession
pauseSession(session, now): BacklogSession
resumeSession(session, now): BacklogSession
progressOf(session): BacklogProgress
serialiseSession(session): string
parseSession(raw, now): BacklogSession | null
```

Every transition is pure: the session is replaced, never mutated. A state whose
definition does not close the item records the decision without advancing.

### The approval gate

```ts
planAction(request: PlanRequest): ActionPlan   // throws ActionRefused
statusForAction(kind, fingerprint, approvals): ActionApprovalStatus
approveAction(kind, options): ActionApproval
draftApprovalStatus(current, record): ActionApprovalStatus
payloadFingerprint(itemIds): string
```

`planAction` is the single entry point for anything external. It checks, in
order: the release state, whether anything is implemented, bulk, the
capability, the approval for that exact payload, and the account boundary. It
returns a **plan** and performs nothing, because in this release there is
nothing behind it to perform.

```ts
class ActionRefused extends Error {
  kind: ExternalActionKind;
  because: 'release_disabled' | 'capability_not_granted' | 'not_approved'
         | 'approval_expired' | 'not_implemented' | 'bulk_not_allowed'
         | 'account_mismatch';
}
```

### Permissions

```ts
capability(key): CapabilityDefinition
isAllowed(key, grants): boolean
assertCapability(key, grants): void     // throws CapabilityError
grant(grants, key, at): CapabilityGrants  // throws on a denied capability
assertScopesPermitted(providerId, requested): void  // throws on forbidden OR undeclared
```

### Privacy

```ts
redact(text): string
redactDeep(value): unknown
threadIsIncluded(thread, messages, preference): { included: boolean; reason?: string }
retentionSweep(dataset, now): SweepResult
exportAccount(dataset): AccountExport     // carries a notIncluded list
deletionPlan(dataset): DeletionPlan       // carries a retains list
auditLineLeaks(line): string[]
```

### The provider interface

```ts
interface ReadOnlyMailProvider {
  getProfile(token: TokenHandle): Promise<Profile>;
  listFolders(token: TokenHandle): Promise<Folder[]>;
  syncPage(token: TokenHandle, cursor: SyncCursor, options): Promise<SyncPage>;
  getAttachmentMetadata(token: TokenHandle, messageId: string): Promise<AttachmentMeta[]>;
  getAttachmentContents(token: TokenHandle, attachmentId: string, grants): Promise<Uint8Array>;
}

/** Separate and optional. Its only method is saveDraft. */
interface DraftWritingMailProvider { saveDraft(...): Promise<DraftRef>; }
```

There is no send, reply, forward, delete, archive or label method anywhere. The
absence is a property of the type system, not a policy somebody remembers.

`TokenHandle` carries `{ handle, accountId, provider, expiresAt, grantedScopes }`
and **no token value**, so a function that wants to log "the token" can only log
an opaque handle.

## 3. The server API, which does not exist yet

Specification. Nothing below is built. Every route is authenticated as the
signed-in person and scoped to accounts they own; row-level security in the
database is the second control, and `docs/migrations/0002_row_level_security.sql`
is where it lives.

### Conventions

- `Authorization: Bearer <session token>` on every request.
- All timestamps ISO-8601 **with an offset**. A timestamp without one is
  rejected, not normalised: a date without a zone is how a deadline lands on
  the wrong day.
- Errors: `{ error: { code, message, retryable } }`. `message` is written for a
  person, and never carries a token, a secret or message content.
- Idempotency: every write takes `Idempotency-Key`.

### Accounts and permissions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/email/accounts` | The person's connected accounts. Never returns a token. |
| `POST` | `/api/email/accounts/connect` | Starts the OAuth flow. Returns the authorisation URL and a PKCE state. Refuses any scope not declared in `scopes.ts`. |
| `GET` | `/api/email/accounts/callback` | Exchanges the code server side. The token goes straight to the token store. |
| `DELETE` | `/api/email/accounts/:id` | Disconnects. Stops synchronisation, clears the handle and the cursor. |
| `GET` | `/api/email/accounts/:id/capabilities` | The three opt-in capabilities and their state. |
| `PUT` | `/api/email/accounts/:id/capabilities/:key` | Turns one on. **Returns 409 for any of the seventeen denied capabilities**, with the rationale. |

### Reading analysis

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/email/accounts/:id/dashboard` | The eight metrics and the seven panels, each capped at ten rows with its true total. |
| `GET` | `/api/email/accounts/:id/threads` | Paginated. `page`, `pageSize` (max 100), `sort`, `dir`, plus every filter dimension. |
| `GET` | `/api/email/accounts/:id/threads/:threadId` | One thread, its messages and its full analysis with sources. |
| `GET` | `/api/email/accounts/:id/views/:viewKey` | One of the eight operational views, paginated. |
| `POST` | `/api/email/accounts/:id/analyse` | Queues analysis for named threads. Subject to the Starter cap. |

`pageSize` is capped server side at 100. A client asking for more gets 100 and a
header saying so, rather than a mailbox.

### Backlog sessions

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/email/accounts/:id/backlog` | Builds a batch from a selection and opens a session. |
| `GET` | `/api/email/backlog/:sessionId` | The session, its order, its cursor and its decisions. |
| `POST` | `/api/email/backlog/:sessionId/decisions` | Records one decision. Idempotent on `(session, thread)`. |
| `POST` | `/api/email/backlog/:sessionId/pause` | Pauses. |
| `POST` | `/api/email/backlog/:sessionId/resume` | Resumes, rebuilding the analysis rather than returning a stored copy. |
| `GET` | `/api/email/accounts/:id/backlog/resumable` | The paused session, if any, for the resume offer. |

### Approvals and external actions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/email/actions` | The five external actions and their release state. Generated from `approvals.ts`. |
| `POST` | `/api/email/actions/:kind/approve` | Records an approval for one payload fingerprint. |
| `POST` | `/api/email/actions/:kind/execute` | **Returns 409 for four of the five kinds, always.** For `save_draft_to_mailbox`, requires the capability grant and a matching approval, and returns 403 or 409 with the reason otherwise. |

There is no endpoint that sends, deletes, archives, labels or marks as read.
Not disabled by configuration: absent.

### Privacy

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/email/accounts/:id/export` | Everything held, with the `not_included` list. |
| `DELETE` | `/api/email/accounts/:id/data` | Deletes analysis and working state. Returns what was removed and what is retained. |
| `POST` | `/api/email/accounts/:id/retention/sweep` | Runs the sweep. Normally scheduled, exposed for support. |

Both the export and the deletion are the SQL functions in
`docs/migrations/0003_retention_and_deletion.sql`, which are the behaviour of
record. The endpoints are wrappers.

### Provider notifications

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/email/webhooks/microsoft` | Graph change notifications. Validation handshake on creation, signature check on delivery, subscription ownership and event deduplication before anything is acted on. |
| `POST` | `/api/email/webhooks/google` | Gmail Pub/Sub push, same checks. |

A notification is the one place an outside party can poke the system. An event
for a subscription this system did not register is refused and recorded as
worth investigating.

## 4. Rate limits, as specified

| Surface | Limit |
|---|---|
| Read endpoints | 120 requests per minute per person |
| `POST /analyse` | Starter: 3 threads per week, resetting Monday 05:30 Australia/Melbourne. Pro and Team: a burst limit only |
| Export | 2 per day per account |
| Deletion | 1 per hour per account |
| Webhooks | Per subscription, with deduplication rather than throttling |

The Starter cap is an entitlement control, not a cost control. A spend limit on
the model provider is a separate thing and is listed in `docs/SETUP.md`.
