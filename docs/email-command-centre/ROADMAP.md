# Email Command Centre: future roadmap

Concludo Workspace. Final, Stage 7.

Gated, not scheduled. Each release below has a condition that has to be true
before it starts, because a roadmap with dates and no gates is a wish list.

Concludo Pty Ltd is pre-revenue, in build, unpublished and not yet sold. Nothing
here is a commitment to a customer, and prices remain indicative until
validated with real buyers.

---

## Where this sits in the Concludo plan

The Email Command Centre is an add-on inside the Concludo Workspace
application. It is not a separate product, not a new tier, and not the
company's core offer: Concludo turns conversation transcripts into finished
work, and this module does the same job for a mailbox.

Its place in the five-year path is narrow and specific. The Year 1 gates are
demand interviews, the first Pro conversions and the first Team pilot. A mailbox
feature serves those only if it makes Pro worth paying for and gives a Team
pilot a second reason to stay. If it is not doing that, it should be
deprioritised rather than extended, and the next release below should not start.

---

## Release 1: make it real

**Gate:** the module is deployed dark and the Stage 7 definition of done holds.
Met today.

**Contents:** none. This release is the one just finished.

**What it is worth:** the feature can be demonstrated, reviewed and criticised
by somebody who is not the author, on synthetic data, with no credential and no
risk. That is the cheapest useful state a feature can be in, and most never
reach it.

---

## Release 2: the server component

**Gate:** somebody is willing to connect a mailbox and say why. One real person,
not a hypothetical.

Without that, this release is speculative infrastructure. The module is already
reviewable; building an OAuth broker and a token store before anybody wants to
connect anything is building the expensive half first.

**Contents**

1. The OAuth broker: authorisation code flow with PKCE, client secret server
   side.
2. The token store: encrypted at rest, key rotation, refresh handling, the two
   terminal states that are never retried.
3. The read endpoints in `docs/API.md`, backed by the migrations that already
   exist.
4. Microsoft 365 only. Gmail waits for its assessment.
5. Scheduled incremental synchronisation, honouring `Retry-After`.
6. The monitoring and alerting in `docs/MONITORING.md` and
   `docs/ALERTING.md`, with the four page-worthy alerts fired deliberately on
   staging.

**Done when:** the Concludo test mailbox has been connected for a fortnight, the
provider's own audit log shows reads only, and
`docs/SECURITY_CHECKLIST.md` sections A to G have no unchecked box.

**Risks:** publisher verification at Microsoft has lead time. The token store is
the piece most likely to be built adequately rather than well, and it is the
piece where adequate is not enough.

---

## Release 3: the model calls

**Gate:** Release 2 running on at least three real mailboxes, and a written
agreement with a model provider that customer data is not used for training.

**Contents**

1. The six model stages, each against the output contract and validator that
   already exist: classify, summarise, extract actions, deadlines, decisions,
   commitments and open questions.
2. Reply-draft generation in three styles, with the withholding rules that are
   already built and tested.
3. Per-account spend limits. The Starter cap of three threads per week is an
   entitlement control, not a cost control.
4. The validation-failure metric wired to an alert, because it is the
   prompt-drift detector.

**Done when:** on a real mailbox, five extracted deadlines can each be traced to
a verbatim sentence in the right message, every inferred date is labelled as
inferred, and the validation-failure rate is under one per cent.

**The thing to watch:** this is the release where the product starts making
claims about somebody's business. A wrong deadline is worse than no deadline,
and the whole traceability apparatus exists for this moment.

---

## Release 4: saving drafts, and the first real external action

**Gate:** Release 3 has run for a month and people are reading the drafts.
Nobody should be offered the ability to save a draft they do not already want.

**Contents**

1. `write_draft_to_mailbox` turned on as an opt-in capability, per account.
2. Incremental scope request, so the broader `Mail.ReadWrite` grant is asked for
   only at that moment, with the reason on the screen.
3. The approval gate's one implemented path finally doing something.
4. The P3 alert from `docs/ALERTING.md` live before the first save.

**Done when:** every draft that reached a mailbox has an approval row, and the
count of saved drafts equals the count of approvals that authorised them. Not
approximately.

**Explicitly not in this release:** sending. It stays denied, with two
independent locks. If it is ever built it is its own controlled release with its
own threat model, and the current `docs/THREAT_MODEL.md` would have to be
rewritten rather than amended.

---

## Release 5: the gaps the limitations document names

**Gate:** Releases 2 to 4 stable, and at least one of the items below has been
asked for by somebody using the feature.

Ordered by how likely a real user is to hit it, not by how interesting it is to
build.

1. **Server-side backlog sessions.** Today a paused session lives in one
   browser. The table exists; the API does not. The first person who pauses on
   a laptop and opens their phone will ask for this.
2. **The mailbox's own time zone.** `MailboxSettings.Read` is already requested
   and the renderer does not consume it. This is a deadline-on-the-wrong-day
   bug waiting for the first interstate customer.
3. **A shared idempotency ledger.** Needed before a second worker exists, not
   after.
4. **Request ids in audit events.** Cheap, and the thing that will be missing
   during the first incident.
5. **Per-folder or per-client retention.** A real request from anybody with
   mixed client work.
6. **Gmail.** Only after the restricted-scope assessment.

---

## Release 6: things worth doing only with evidence

Each needs a reason from a user, not a reason from a backlog.

- **Attachment content processing.** The gate, the size limit and the refusal
  path are built. A parser is not, and every parser is an attack surface. It
  needs its own stage and its own review.
- **Priority calibration.** Replace hand-chosen weights with something tied to
  what people actually acted on. Needs months of outcome data and a careful
  answer to "whose outcomes".
- **Trimming the eleven factors to seven.** Four carry weights of 0.05 or less
  and may be noise dressed as rigour.
- **A second provider shape** such as IMAP, for the customers who are on
  neither Microsoft nor Google.
- **Multi-tenant hardening**, with two real tenants rather than one and a
  boundary.

---

## Where it connects to the rest of Concludo

Worth naming, because an email module that stays an email module is a feature,
and the thing that makes it Concludo is the join.

| Join | What it would do | Gate |
|---|---|---|
| Transcript to thread | A meeting transcript and the email thread it came from, in one place: the decisions on both sides of the same conversation | Release 3, plus somebody who has both |
| Outputs | Turn a thread into the branded outputs Concludo already produces: a decision log, an action plan, a follow-up email | Release 3 |
| Workflow builder | A thread as a trigger for the workflows the Workspace already runs | Release 2 |
| Calendar | Deadlines extracted from mail beside meeting commitments | Release 3, and the creation of events stays denied |
| Curriculum | The meeting workflow material has an email counterpart: how to run a mailbox so it does not run you | Any time. It is writing, not engineering |

The curriculum join is the cheapest and the most underrated. It needs no
release.

---

## What is deliberately not on this roadmap

- **Sending email.** Not a feature with a later date. A thing the product does
  not do.
- **Deleting, archiving, labelling or marking as read.** Same.
- **Automatic actions of any kind.** Concludo proposes; a person disposes. That
  is the whole product.
- **Productivity scoring, leaderboards, team comparisons, time-saved claims.**
  There is a test that fails if the words appear.
- **Training on customer data.**
- **A combined work and personal view by default.** It stays opt-in.
- **Generic meeting or inbox SaaS positioning.** The go-to market is Australian
  consultants and coaches on Pro, and real estate agencies as the Team
  beachhead. An email module does not change that.

---

## The honest summary

Release 1 is done. Release 2 should not start until somebody wants to connect a
mailbox and says why. Everything after that is gated on the release before it
working on real mail, for real people, for long enough to find out what is
wrong with it.

The temptation with a module this complete is to keep building it, because the
next piece is always clear. The discipline is that the next piece is worth
nothing until a person with a full inbox has used the last one and said what
they actually needed.
