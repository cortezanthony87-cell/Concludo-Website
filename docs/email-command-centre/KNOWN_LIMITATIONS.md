# Email Command Centre: known limitations

Concludo Workspace. Final, Stage 7.

The honest list. Everything built and tested is in `docs/TEST_REPORT.md`; this
is what is missing, what is partial, and what cannot be fixed by code.

It replaces the Stage 6 security-limitations document and keeps everything from
it that is still true.

---

## 1. Not built, and why

| Thing | Built and tested | Missing |
|---|---|---|
| OAuth authorisation flow | Scope declarations, per-scope justification, forbidden-scope guard that refuses forbidden **and** undeclared scopes | A registered application at each provider and a server that can hold a client secret |
| Token store | The `TokenHandle` type that keeps token values out of every caller | The encrypted store, key rotation, refresh handling |
| The server API | The contract, in `docs/API.md` | Every endpoint. Nothing has ever been called |
| Six model stages (classify, summarise, extract actions, deadlines, decisions, commitments, questions) | Output contracts, schema validation, provenance requirement, refusal paths | The model calls, a provider agreement, a key |
| Reply-draft generation | Withholding rules, the three-style contract, approval and invalidation | Generation itself |
| Attachment content processing | The capability gate, the size limit, the refusal path | Any document parser. Deliberately: every parser is an attack surface and adding one belongs in its own stage |
| Server-side backlog sessions | The table (`ecc_backlog_session`), the state machine, the serialisation | The API. Sessions live in the browser today |
| Change-notification signatures | Subscription ownership and event deduplication | Payload signature verification, which belongs to the server |

Eight of the twenty-two pipeline stages report `skipped` with the reason. The
runner refuses to report `completed` for a stage that does not exist, because
"ran and found nothing" and "did not run" look identical downstream and mean
opposite things.

Because none of this is built, **no mailbox has ever been connected and no
model has ever been called.** That is a property of the environment, not a
security control, and it disappears the moment the server component exists.

## 1a. The outputs surface, added in Stage 8

| Thing | Built and tested | Missing |
|---|---|---|
| Four output kinds, as payloads against `Concludo_Output_Payload_Schema_v1` | The builders, the availability rules, the evidence requirement, 172 checks | Nothing. They produce a complete payload today |
| The document, rendered | Full HTML drawn with the Workspace's own `/brand/concludo-documents.css`, in an iframe | A server-side PDF renderer. The payload is the contract it would consume |
| The follow-up email | The text, the recipients, and the list of what sending it would commit you to | Any way to send it. Copying it is the only way it leaves the page, by design |

Two dependencies worth naming, because the module now reads them from the
application rather than carrying its own copies:

- `/brand/concludo-documents.css`, the authority for colour and type in every
  Concludo output document.
- `/brand/Concludo_lockup_horizontal_760w.png`, the supplied lockup. The module
  never redraws the mark.

Both are in the application today. If either moves, the document renders
unstyled or without its lockup, and nothing else breaks.

**What the documents cannot do yet:** produce a PDF. The download is HTML,
which prints correctly from a browser and is honest about what it is. A real
PDF needs the server-side renderer that the payload schema was written for.

## 2. Built, and deliberately partial

### A paused backlog session lives in one browser

`localStorage`, key `concludo.ecc.backlog.session.v1`, seven-day expiry.
Clearing site data loses it. It does not follow a person to another device or
another browser. The interface says so rather than implying a server-side
record.

Nothing in a mailbox is affected: the decisions were notes. The table exists in
migration 0001 and the fix is the API.

### The injection detector will miss things

Nine rules over the shapes an injected instruction takes. It is an alarm, not a
lock. It will miss novel phrasings, non-English attempts, instructions split
across quoted history, and instructions inside an attachment that is not read.

Accepted, because a missed detection costs a warning rather than an action:
there is no send, forward, delete or execution behind the capability layer for
a missed instruction to reach. The rule set was **narrowed** in Stage 6 after it
flagged "I will send the invoice through tomorrow" as exfiltration. A warning
that is usually wrong stops being read, which costs more than the attempts the
broader rule caught. That trade is deliberate and recorded rather than hidden
in a commit.

### The approval fingerprint covers six fields

Account, from address, recipients, subject, body, attachments. A change to
anything outside those six does not invalidate an approval. Adding a field to a
draft means adding it to the fingerprint, and nothing enforces that
automatically.

### Priority weights are a judgement, not a measurement

Eleven weighted factors with hand-chosen weights, validated against no outcome
data because there is no outcome data. The scores are defensible and
explainable; they are not calibrated. Every score carries its factors and
reasons so a person can disagree with it, which is the only honest mitigation
at this stage.

### Time zones are pinned, not resolved

Dates render in Australia/Melbourne. `MailboxSettings.Read` is requested so the
mailbox's own zone can be used, and the renderer does not yet consume it. For
Australian customers this is right today and wrong for anybody else, and it is
a deadline-on-the-wrong-day bug waiting for the first overseas customer.

### The idempotency ledger is in one process

In memory, bounded at fifty thousand keys. Correct for a single worker and wrong
for a horizontally scaled one: two workers would each have their own ledger and
could process the same message twice. A shared store is needed before a second
worker exists.

### Quoted-history reduction is conservative, and therefore sometimes wrong

If splitting would leave less than fifteen characters of new text, the whole
body is treated as new. Some analyses therefore include quoted history. The
alternative, a wrong split that hides the actual message, is worse.

### The mock provider is a mock

It reproduces rate limits, outages, expired permissions, revoked credentials,
pagination and expired cursors. It does not reproduce either real API's specific
inconsistencies: Graph delta tokens that return the same message twice with
different properties, Gmail history ids that expire sooner than documented,
messages that change thread membership. Those will be found in the first week
against a real mailbox, not before.

### Retention is one window per account

A single `analysis_retention_days`. A customer will eventually ask for
per-folder or per-client retention, and the schema does not support it.

### No request id in audit events

Audit rows carry the account and the stage but not a request id, so correlating
one run across services will be harder than it should be.

## 3. Cannot be fixed by this module

### `Mail.ReadWrite` is broader than drafting

Microsoft offers no draft-only scope. Somebody who turns on saving drafts to
their own Drafts folder grants read and write across their mail. The module's
code still cannot send, because the capability is denied and the interface has
no method, but the **grant** is broader than the use. It is stated on the
consent screen rather than minimised.

### A tenant administrator can grant more than is asked

Application-wide permissions can be granted independently of what this module
requests. The forbidden list is what a reviewer checks the actual grant against.

### Gmail needs an annual security assessment

`gmail.readonly` is a restricted scope. Publishing requires an independent
security assessment (CASA tier two), renewed annually, and it costs real money.
Until it is complete, Gmail support is limited to testing mode with a hard cap
on users. That is a legitimate way to pilot and it is not a product that can be
sold. **The single longest lead time in the whole integration.**

### Correspondents have not consented

The person connecting a mailbox consents for themselves. The people who wrote to
them did not, and most of them have never heard of Concludo. No technical
control resolves that. What reduces it is storing analysis rather than mail,
storing a quoted sentence rather than a body, short default retention, and
excluding folders before analysis rather than filtering afterwards.
`docs/PRIVACY_DELETION.md` section 6 is the fuller answer.

### What the providers and the model provider log

The no-training stance binds Concludo and nobody else. What Microsoft, Google or
a model provider retains is governed by the agreement with them, and getting
that in writing is a prerequisite before a single model call.

### One person responds to incidents

There is no rota and no second engineer. `docs/ALERTING.md` has a 45-minute
automatic fallback to the safe state because of it. That is a mitigation, not a
solution, and it is the most significant operational limitation on this list.

## 4. Product limitations, not technical ones

- **The synthetic dataset is twenty-two threads.** Each tests a different
  behaviour, which makes it the right dataset for correctness and the wrong one
  for judging whether the priority model feels right on a real inbox.
- **Nobody has used this on their own mail.** Every design decision is reasoned
  and none is validated. The first week on a real mailbox will change things.
- **The eight views may be too many.** Or the wrong eight. That is a question
  for a person with a real backlog, not for a test.
- **Backlog mode assumes a person wants to be shown one thing at a time.**
  Plausible, and unproven.
- **No pricing validation.** The Starter cap of three analysed threads per week
  is a guess at where the line between tiers should sit. Prices remain
  indicative until validated with real buyers.

## 5. Things a reviewer should push back on

Listed so they get argued about rather than assumed.

1. **Eleven tabs is a lot.** Stage 1 settled on ten and Stage 7 added one.
   Stage 8 honoured this by replacing Drafts with Outputs rather than adding a
   twelfth. The next addition should do the same.
2. **The audit trail survives deletion.** Defensible and worth stating out loud:
   somebody will eventually object, and the answer has to be better than "it is
   how we built it".
3. **The queue preview is ten rows.** Chosen, not measured. It might be five.
4. **The eleven priority factors could be seven.** Four of them carry weights of
   0.05 or less and may be noise dressed as rigour.
5. **No per-folder retention** (section 2).
6. **The approval fingerprint is six fields** (section 2).
7. **Nothing proves the eight invariants hold end to end**, because the system
   is not built end to end. Each control is tested in isolation.

## 6. What would change this document

Three changes would require it to be rewritten rather than amended: adding any
send capability, adding a document parser for attachment contents, or making the
combined work and personal view the default. None is planned, and each would
need its own threat model.
