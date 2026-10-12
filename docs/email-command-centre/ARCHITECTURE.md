# Email Command Centre: architecture

Concludo Workspace, Email Command Centre module. Final, Stage 7.

Concludo is an independent product and is not affiliated with or endorsed by
Microsoft, Google or any device maker. Platform names below identify APIs only.

---

## 1. The shape of it

```
                  PERSON'S BROWSER
  +--------------------------------------------------------------+
  |  Concludo Workspace (React 19, Vite)                          |
  |   /email  -> EmailModuleLayout -> ten module tabs             |
  |   reads only: aggregated analysis for the selected account    |
  |   holds: no token, no client secret, no raw mailbox page       |
  +----------------------------+---------------------------------+
                               | HTTPS, session cookie
                               v
  +--------------------------------------------------------------+
  |  CONCLUDO SERVER  (not built in this environment)             |
  |                                                              |
  |  +-------------------+     +------------------------------+   |
  |  | OAuth broker      |     | Token store                  |   |
  |  | auth code + PKCE  |---->| encrypted at rest, per       |   |
  |  | client secret     |     | account, never returned to   |   |
  |  | never leaves here |     | the browser or written to a  |   |
  |  +-------------------+     | log. Handles only outside.   |   |
  |                            +---------------+--------------+   |
  |                                            |                  |
  |                             TokenHandle (no token value)      |
  |                                            v                  |
  |  +--------------------------------------------------------+   |
  |  |  PIPELINE RUNNER   src/lib/email/pipeline/runner.ts     |   |
  |  |  22 declared stages, in order, per account              |   |
  |  |                                                        |   |
  |  |  capability gate -> stage -> result (completed |        |   |
  |  |                              skipped | failed |        |   |
  |  |                              blocked)                  |   |
  |  +------+--------------------+----------------+----------+   |
  |         |                    |                |              |
  |         v                    v                v              |
  |  +-------------+   +------------------+   +---------------+   |
  |  | Mail        |   | Local analysis   |   | Model calls   |   |
  |  | provider    |   | thread rebuild,  |   | classify,     |   |
  |  | READ ONLY   |   | priority, risk,  |   | summarise,    |   |
  |  | Graph/Gmail |   | aggregation      |   | extract       |   |
  |  +------+------+   +--------+---------+   +-------+-------+   |
  |         |                   |                     |          |
  |         |                   v                     |          |
  |         |          +------------------+           |          |
  |         |          | Analysis store   |<----------+          |
  |         |          | (Supabase)       |                      |
  |         |          | analysis + audit |                      |
  |         |          | NOT a mail copy  |                      |
  |         |          +------------------+                      |
  |         v                                                     |
  |  +--------------------------------------------------------+   |
  |  |  AUDIT TRAIL  append-only, redacted, no message bodies  |   |
  |  +--------------------------------------------------------+   |
  +--------------------------------------------------------------+
                               ^
                               | read-only HTTPS, least privilege
                               v
        Microsoft Graph  /  Gmail API      (independent third parties)
```

In this environment, everything to the right of the token store runs against
`MockMailProvider` and the synthetic dataset. The OAuth broker and token store
are specified and not built, because both need a registered application and a
server that can hold a client secret. See `docs/KNOWN_LIMITATIONS.md`.

## 2. Layers, and what each one is allowed to know

| Layer | File | Knows | Must never know |
|---|---|---|---|
| OAuth broker | not built | client secret, authorisation code | nothing about analysis |
| Token store | not built | access and refresh tokens | nothing about analysis |
| Provider adapter | `providers/types.ts` | a `TokenHandle`, one account | any other account's data, any token value |
| Sync | `sync/incrementalSync.ts` | one cursor, one account | message content semantics |
| Safety preprocess | `security/injection.ts` | message text as data | nothing it reads is an instruction |
| Analysis | `pipeline/*`, `priority.ts` | one account's messages | provider credentials |
| Aggregation and views | `views.ts`, `aggregation.ts` | analysed threads for the selected account | raw provider payloads |
| Audit | `privacy.ts`, runner `audit_log` | what the system did | message bodies |

## 3. The token boundary

`TokenHandle` carries `{ handle, accountId, provider, expiresAt, grantedScopes }`
and no token value. That is a type-level boundary, not a convention: a function
that wants to log "the token" can only log an opaque handle, because the value
is not in the object it was given.

```ts
export interface TokenHandle {
  handle: string;        // opaque reference into the token store
  accountId: string;
  provider: ProviderId;
  expiresAt: string;
  grantedScopes: readonly string[];
}
```

## 4. The provider interface is read-only by type

`ReadOnlyMailProvider` has five methods and no others:

```
getProfile              listFolders              syncPage
getAttachmentMetadata   getAttachmentContents    (opt-in, in memory)
```

There is no `send`, no `reply`, no `forward`, no `delete`, no `modifyLabels`.
Saving an approved draft lives on a **separate, optional** interface,
`DraftWritingMailProvider`, whose only method is `saveDraft`. An installation
that never turns that capability on never has an object with a write method on
it. The absence of sending is therefore a property of the type system, not a
policy somebody has to remember.

## 5. The pipeline

Twenty-two stages, declared as data in `pipeline/stages.ts` so the order is
inspectable and each stage states what it may read.

| # | Stage | Kind | Fatal | Built |
|---|---|---|---|---|
| 1 | Secure OAuth connection | provider | yes | no |
| 2 | Account registration | local | yes | yes |
| 3 | Folder or label selection | provider | yes | yes |
| 4 | Incremental synchronisation | provider | yes | yes |
| 5 | Message normalisation | local | yes | yes |
| 6 | Thread reconstruction | local | no | yes |
| 7 | Quoted-history reduction | local | no | yes |
| 8 | Attachment metadata | provider | no | yes |
| 9 | Optional attachment processing | provider | no | no |
| 10 | AI safety preprocessing | local | yes | yes |
| 11 | Classification | model | no | no |
| 12 | Priority scoring | local | no | yes |
| 13 | Summary generation | model | no | no |
| 14 | Action extraction | model | no | no |
| 15 | Deadline extraction | model | no | no |
| 16 | Decision extraction | model | no | no |
| 17 | Commitment extraction | model | no | no |
| 18 | Open-question extraction | model | no | no |
| 19 | Risk and security screening | local | no | yes |
| 20 | Reply-draft generation | model | no | no |
| 21 | Dashboard aggregation | local | no | yes |
| 22 | Audit logging | local | no | yes |

Fourteen stages are built. Eight are specified and not built: the OAuth flow,
attachment content parsing, and the six model calls. For every one of those
eight, the contract, the validation and the refusal path **are** built and
tested; what is missing is the external dependency.

Two runner behaviours matter more than the rest:

- A stage that is not implemented returns `skipped` with the reason. It never
  returns `completed` with empty output, because "ran and found nothing" and
  "did not run" look identical downstream and mean opposite things.
- A non-fatal failure records itself and the run continues. One thread failing
  to analyse must not stop the other twenty-one, and the dashboard must be able
  to say which ones are missing rather than quietly showing fewer threads.

## 6. Priority scoring

Eleven weighted factors (`priority.ts`), each carrying its own reason and source:

| Factor | Weight |
|---|---|
| deadline proximity | 0.20 |
| consequence of delay | 0.18 |
| explicit request | 0.12 |
| work blocked | 0.10 |
| sensitivity | 0.10 |
| prior commitment | 0.08 |
| unanswered follow-ups | 0.07 |
| relationship impact | 0.05 |
| unresolved age | 0.05 |
| ease of resolution | 0.03 |
| confidence adjustment | 0.02 |

A weighted average almost never reaches 90, so escalation rules sit on top. An
escalation can only raise a band, never lower one, and it must carry a visible
reason. Queue ordering sorts by band first and then by score, so an escalated
thread cannot sit below an unescalated one with a higher raw number.

## 7. Provenance

`Generated<T>` in `pipeline/provenance.ts` makes all seven required provenance
fields mandatory in the type: model identity, prompt version, schema version,
timestamp, confidence, source references, correction status and approval status.
A generated value without its provenance does not compile, which is the only way
a rule like this survives a deadline.

## 8. The approval gate, added in Stage 7

Every action that would reach outside Concludo goes through one function,
`planAction` in `src/lib/email/approvals.ts`. There are five such actions and
four of them are off in this release.

```
                    planAction(request)
                            |
   1. release state --------+--> refused: release_disabled
   2. implemented? ---------+--> refused: not_implemented
   3. one item only --------+--> refused: bulk_not_allowed
   4. capability granted? --+--> refused: capability_not_granted
   5. approval for THIS ----+--> refused: not_approved | approval_expired
      payload
   6. same account? --------+--> refused: account_mismatch
                            |
                            v
                      ActionPlan  (what WOULD happen; nothing runs)
```

| Action | State | Capability behind it |
|---|---|---|
| Save a draft to the Drafts folder | Needs approval, every time | `write_draft_to_mailbox` (opt-in) |
| Send a reviewed draft | Not available | `send_message` (denied, ungrantable) |
| Archive messages | Not available | `archive_message` (denied) |
| Create a task in another system | Not available | `create_external_task` (denied) |
| Create a calendar reminder | Not available | `create_calendar_event` (denied) |

The order of the checks is the design. The release state is read first, so a
disabled action is refused before any approval is even looked at: a forged or
replayed approval reaches nothing. Sending therefore has two independent locks,
the release and the denied capability, and removing either still leaves the
other.

`planAction` returns a plan and performs nothing, because in this release there
is nothing behind it to perform: the one implemented action needs a connected
mailbox, and none has ever been connected.

## 9. Backlog mode, added in Stage 7

A queue with a cursor, where everything else in the module is a list.

```
selection  ->  applyFilter  ->  dedupe  ->  identify resolved
           ->  order by consequence, then band, then score
           ->  group related  ->  slice to batch size
           ->  BacklogBatch
                    |
                    v
   BacklogSession { order, cursor, decisions, status }
        |                                        ^
        +-- recordDecision / skip / back --------+
        +-- pause  ->  localStorage  ->  resume -+
```

Every transition is pure: the session is replaced rather than mutated, which is
what makes the state machine testable and an undo possible later without
unpicking anything. The eight progress states are records of a decision; not
one of them performs it.

The order is consequence first. Security-flagged, immediate-band and sensitive
threads are brought forward, each carrying the reason it was, and the ordinary
comparison sorts band before score so an escalation cannot be defeated by a
higher raw number. A mode that optimised for the number going down would teach
people to clear the cheap things.

What is stored for a resume: the selection, the thread ids and the decisions.
**Not the analysis.** A stored summary goes stale, and a resumed session showing
a stale summary is worse than no session at all.

## 10. The two volume fixes

Both found by the Stage 7 load test, both the same shape, and worth recording in
the architecture because they are about where work happens rather than about a
slow function.

**`recordsFor` was quadratic.** It scanned every analysis for each thread. At
ten thousand threads that was 772 ms, which was nearly the whole cost of
rendering the module. Analyses are now indexed by thread id, as the messages
already were: 31 ms. Three more lookups of the same shape were fixed with the
same change.

**The dashboard built every row of every queue.** `buildDashboard` returned
full queues and the panel mapped all of them. Queues are now capped at
`QUEUE_PREVIEW_SIZE` (ten) at the data layer, each reporting its true total, and
the panel says "showing the first ten of N". Capping in the component instead
would have left the cost of building the rows in place.

The rule both express: a page holds a page. All Email paginates at 25, a backlog
batch is the chosen size, a dashboard queue is ten. At ten thousand threads the
whole dataset is 46 MB of JSON and one page of threads is 10.7 kB.

## 11. Outputs, added in Stage 8

The module's reason for being inside Concludo rather than beside it. Concludo
turns conversations into finished work; until Stage 8 the email reader stopped
at analysis, which is the useful half of a product rather than a product.

```
  ThreadRecord  ->  availabilityFor(kind, record)
                         |
                 refused |  "no action in this thread, so an action plan
                         |   would be an empty page"
                         v
                 buildOutputPayload(kind, { record, tier, now })
                         |
                         v
            OutputPayload  (Concludo_Output_Payload_Schema_v1)
                         |
          +--------------+---------------+
          |                              |
   renderOutputDocument            buildFollowUpEmail
   HTML + /brand/concludo-         plain text, plus the list of
   documents.css, in an            what sending it would commit
   iframe                          the sender to
```

**It does not define a second document standard.** The Workspace already has
one: `Concludo_Output_Document_Design_Spec_v1` for the rules and
`Concludo_Output_Payload_Schema_v1` for the contract. The builders fill that
payload, and the renderer writes markup that `/brand/concludo-documents.css`
already styles. A second look would have drifted from the first within a month.

**It renders into an iframe.** That stylesheet styles bare elements: `h1`,
`table`, `td`, `p`, `section`, `body`. Loading it into the application would
restyle every page in the Workspace. The iframe gives exact fidelity with no
leakage, and it is also what a preview should be: the document is a separate
thing from the interface showing it, which is why that stylesheet's own
`--desk` token is described there as "the ground the sheet sits on".

Three rules the builders enforce, each with a test:

- **Every register row carries the point in the record it came from.** A row
  with no evidence is not written, which is why `evidenceFor` returns null
  rather than an empty string.
- **Every inference is labelled.** A date the sender wrote and a date Concludo
  worked out are different kinds of fact, and the register says which, in the
  row.
- **A section with nothing in it is omitted.** An empty "Decisions" heading
  reads as "no decisions were made"; absent reads as "none found", which is the
  truth.

Email content reaching a renderer that builds HTML is the obvious attack, so
everything is escaped and a test feeds it a subject containing a script tag.

## 12. The Overview, rebuilt in Stage 8

`composeOverview` in `lib/email/overview.ts` composes the page rather than
rendering every queue at once.

The defect it fixes: the first dashboard drew eight equal metric cards and
seven equal panels, ran to 4,265 pixels, and showed the single most
consequential thread in the inbox **four times**, in four different panels.
Nothing was wrong with the queues. The mistake was showing all of them in full
with no notion that a thread already shown is a thread already seen.

```
  security claimed first, and never released
          |
          v
  lead = highest-consequence unflagged thread, claimed
          |
          v
  four sections, in order of consequence, each taking only
  threads no earlier section claimed, capped at four rows
          |
          v
  each section reports its own TRUE total and how many it
  did not draw, so deduplication hides nothing
```

The page is now 2,256 pixels and no thread appears twice.

## 13. Where the code lives

```
src/lib/email/
  providers/   capabilities.ts  scopes.ts  types.ts  mockProvider.ts
  sync/        incrementalSync.ts
  security/    injection.ts
  pipeline/    stages.ts  runner.ts  threadReconstruction.ts  provenance.ts
  backlog.ts   approvals.ts                      <- Stage 7
  outputs.ts   outputDocument.ts  outputFormat.ts  overview.ts   <- Stage 8
  privacy.ts   priority.ts  model.ts  views.ts  aggregation.ts  filters.ts
  moduleNav.ts types.ts  draftReview.ts  threadIntelligence.ts  ...

src/components/email/      14 components
src/pages/email/           11 tab pages + the thread workspace + the route table
src/styles/email-command-centre.css

docs/migrations/           0001 core, 0002 row-level security,
                           0003 retention and deletion, 0099 verification
```
