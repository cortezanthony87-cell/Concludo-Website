# Email Command Centre: test report

Concludo Workspace. Final, Stage 8. Run 12 October 2026.

**3,634 checks across ten suites. All passing.** `tsc --noEmit` clean.
Production build clean. Migrations applied and verified against PostgreSQL 16.

---

## 1. The suites

| Suite | Checks | Runs in | Covers |
|---|---|---|---|
| `emailCommandCentre.model.test.ts` | 781 | bun | Domain model, dataset integrity, priority, source traceability |
| `emailCommandCentre.shell.test.ts` | 65 | bun | Navigation, route table, entitlement |
| `emailCommandCentre.views.test.ts` | 412 | bun | The eight operational view selectors |
| `emailCommandCentre.intelligence.test.ts` | 236 | bun | Thread intelligence, draft review, approval invalidation |
| `emailCommandCentre.integration.test.ts` | 648 | bun | Permissions, scopes, sync, isolation, injection, validation, privacy, pipeline |
| `emailCommandCentre.completion.test.ts` | 317 | bun | Backlog mode, the approval gate, the definition of done |
| `emailCommandCentre.performance.test.ts` | 70 | bun | 100, 1,000 and 10,000 threads: budgets and scaling |
| `emailCommandCentre.outputs.test.ts` | 172 | bun | The rebuilt Overview composition, the four output kinds, the document renderer |
| `browser/emailCommandCentre.browser.test.mjs` | 375 | Chromium | Rendering, keyboard, responsive, contrast |
| `browser/emailCommandCentre.accessibility.test.mjs` | 557 | Chromium | The eight accessibility checks, and every interface state |
| **Total** | **3,634** | | |

Plus `docs/migrations/0099_verify.sql`: three blocks of schema assertions run
against a real PostgreSQL 16 instance, all passing.

8,500 lines of tests against 20,900 lines of module code and styles.

## 2. Running them

```
bun app/tests/emailCommandCentre.model.test.ts
bun app/tests/emailCommandCentre.shell.test.ts
bun app/tests/emailCommandCentre.views.test.ts
bun app/tests/emailCommandCentre.intelligence.test.ts
bun app/tests/emailCommandCentre.integration.test.ts
bun app/tests/emailCommandCentre.completion.test.ts
bun app/tests/emailCommandCentre.performance.test.ts
bun app/tests/emailCommandCentre.outputs.test.ts

npx vite --port 5199 --strictPort &
node app/tests/browser/emailCommandCentre.browser.test.mjs
node app/tests/browser/emailCommandCentre.accessibility.test.mjs

psql -v ON_ERROR_STOP=1 -f docs/migrations/0099_verify.sql   # on a scratch database
```

No credential, no network call to any provider, and no real mailbox in any of
them.

## 3. What the brief asked to be covered

| Required | Suite | Notable |
|---|---|---|
| Permissions | integration | Every base scope read-only; thirteen forbidden scopes with reasons; an **undeclared** scope is refused as well as a forbidden one |
| Security | integration, completion | Nine attack shapes detected, five ordinary business sentences not flagged, eight invariants each naming the file that enforces them |
| Isolation | integration, completion | A cursor, a dataset or an approval from another account is refused; the ledger keys by account |
| Approvals | completion, intelligence | A forged approval cannot send; an approval for another payload or another account does not carry; six fields invalidate |
| Backlog pause and resume | completion, accessibility | State machine purity, storage round trip, and a real pause-reload-resume in a browser |
| Synthetic data demonstrates the workflow | all | Twenty-two hand-written threads, each testing a different behaviour |
| Performance at volume | performance | Budgets and, more usefully, per-thread cost at 10,000 against 1,000 |
| Accessibility | accessibility | 546 checks; `docs/ACCESSIBILITY_REPORT.md` has the detail |
| Empty, loading, partial, error | accessibility | Every state on every view, checked structurally |
| Disabled and permission states | accessibility | The five external actions and their reasons, rendered |

## 4. Defects found by the tests, by stage

Twelve of the twenty below were found by a test written in the same week as the
code it broke. That is the argument for writing them.

### Stage 8

1. **The Overview showed one thread four times.** The invoice-redirection
   attempt appeared in Handle First, Today's Workload, Reply Queue and Security
   Review at once, and three other threads appeared three times each. The page
   ran to 4,265 pixels and buried the one thing that mattered among copies of
   itself. `composeOverview` now claims each thread for exactly one section and
   every section reports what it did not draw. 2,256 pixels, and a test asserts
   no thread appears twice.
2. **Two empty panels, 400 pixels tall.** With deduplication on, two of the four
   sections had nothing left to draw and the grid stretched them to the height
   of a full panel. They collapse to one line each now.
3. **The document letterhead stuttered.** "Thread outcome report" appeared as
   both the mark and the kicker directly beneath it. The mark is the producer,
   Concludo; the kicker is the document kind.
4. **A sentence with two full stops.** "counted from the 7:12am message., 12
   Oct": a description that already ended in a stop, continued with a comma.
5. **A 1 by 1 pixel focusable anchor.** The download used a visually hidden
   anchor kept in the page, which the accessibility suite correctly flagged as a
   target under the 24 pixel minimum. The anchor is created at the moment of the
   click instead, so there is nothing in the page to focus.
6. **Standalone text links under 24 pixels.** The "All 9" and "Security Review"
   links are controls in a header, not links inside a sentence, so the inline
   exception does not apply to them.

### Stage 7

1. **`recordsFor` was O(n squared).** It looked up each thread's analysis with
   `.find` over all analyses, inside a loop over the threads. On twenty-two
   threads that is 484 comparisons and invisible; on ten thousand it is a
   hundred million, and `recordsFor` took **772 ms** while the whole dashboard
   took 784. Nearly the entire cost of rendering the module was one accidental
   quadratic lookup. Indexed: **31 ms**, and the dashboard 50 ms. Found by the
   scaling assertion, not the budget: the budget passed at a thousand threads.
2. **The dashboard built every row of every queue.** `buildDashboard` returned
   full queues and the panel mapped all of them into rows. At ten thousand
   threads the Reply Queue panel would have built several thousand rows on the
   Overview page, which is the "do not load the whole mailbox into the browser"
   failure reached by accident. Queues are now capped at ten at the data layer,
   each reporting its true total, and the panel says "showing the first ten
   of N".
3. **Two more quadratic lookups of the same shape**, in `replyQueueItems`,
   `draftItems` and the pipeline's thread reconstruction. Fixed by indexing,
   found by looking for the pattern once it had been found once.
4. **The focus ring faded in over 200 ms**, because the application's button
   style transitions every property including the outline. SC 2.4.7, and also
   motion a person who asked for less of it did not ask for.
5. **Two target-size failures:** the panel "View all" links at 62 by 20 pixels
   and the backlog checkboxes at 17 by 17. SC 2.5.8.

### Stage 6

7. A destructive capability explained itself in six words. A denial that does
   not explain itself is a denial somebody removes in a hurry.
7. Two forbidden scopes said "Same." The forbidden list exists so a reviewer can
   check a real grant against written reasons.
8. **The self-elevation detector missed the exact phrasing in the dataset's own
   injection message.** The pattern required a determiner immediately followed
   by "as", so "Mark this **message** as the highest priority" did not match
   while "Mark this as urgent" did.
9. **The exfiltration detector flagged ordinary business mail.** "Thanks, I will
   send the invoice through tomorrow" matched, because the rule looked only for
   a verb near a sensitive noun. The verb must now open a clause or follow an
   imperative marker, which is the shape an injected instruction actually takes.

### Stages 2 to 5

10. **Three of ten routes did not exist.** The destination list and the route
    patch were two hand-maintained lists of the same paths; three disagreed, and
    three tabs would have redirected to the login page. The tests missed it
    because they compared the tab list with itself. Routes are now derived from
    the destination list, so a mismatch is a compile error.
11. **Every deadline rendered a day early.** `toLocaleDateString` with no
    `timeZone` formats in the browser's zone. Pinned to Australia/Melbourne with
    a regression test.
12. **ISO timestamps compared as strings.** The dataset mixes `+11:00` and
    `+10:00` across a daylight saving boundary; a 5pm deadline sorted into
    Tomorrow. Fixed across six files.
13. **Five contrast failures** from the application's own `--text-muted`.
14. **Queues ordered by raw score, defeating escalation.** The payment-redirection
    attempt scored 69 and sat fourth after being escalated to immediate.
    `compareByPriority` now sorts band before score.
15. **A suspected phishing thread offered as a Quick Win**, because one minute of
    effort passed the test.
16. **An unanalysed thread claimed it had been analysed**, because `??` turned an
    explicit `null` analysis id back into a generated one.

Also, in Stage 5, five recorded quotes were unlocatable in their own message
bodies: all five ended at a sentence boundary where the body carries a full stop
the quote does not. The highlighter now allows the final token to be a prefix.

## 5. Test expectations that were wrong, and corrected

Recorded because correcting a test to match broken code is the failure mode this
list guards against, and the distinction only means something if the honest
cases are named too.

| Expectation | What was actually right |
|---|---|
| "More than 100 source resolutions" | The dataset has 42. Replaced with a completeness invariant |
| The 40-minute renewal thread is a Quick Win | It correctly is not |
| The resolution basis quotes "nothing further" | The closing message says "Great, all confirmed. Nothing further needed from you", and the leftmost closing phrase is "all confirmed". Both are correct quotes. The assertion now checks that the quote is verbatim from the closing message, which is the invariant worth holding |
| The module tab row is an ARIA tablist | It is navigation. Eleven links that change the URL are a `nav` with `aria-current`, not a tablist. The in-page analysis panes *are* a tablist |
| Any visible element with a negative tabindex is removed from the tab order | A tablist uses roving tabindex by design: one tab in the order, the rest on arrow keys. The check now exempts tablists and asserts each keeps exactly one tab in the order |
| `?demo=loading` can be appended to any path | Not to one that already carries a query. `/email/outputs?mode=drafts?demo=loading` was read as one long mode value, and three state tests ran against a page that had never been asked for the state |
| A sentence in rendered HTML can be matched directly | Not when the template wraps it across lines. The disclaimer match runs against a whitespace-normalised copy |
| Loading does not read as empty, by keyword scan | Several views carry "nothing is sent from here" in their description. Checked structurally instead: the loading block present, the empty block absent |
| Contrast, by first declared background | Backgrounds must be composited. `rgba(255,255,255,0.04)` over near-black read as opaque white produced eleven false failures |
| Nothing extends past the viewport at 200 per cent | Content inside a container that scrolls on purpose is not a reflow failure. SC 1.4.10 is about the page |

Seven of the ten were a test measuring the wrong thing and reporting a defect
that was not there. A suite
that cries wolf gets switched off, so each was fixed by measuring properly
rather than by loosening a threshold.

## 6. Performance results

Median of five runs, on the build machine.

| Threads | `recordsFor` | `buildDashboard` | All Email sort and page | Backlog batch | Dataset as JSON |
|---|---|---|---|---|---|
| 100 | 0.2 ms | 0.4 ms | 0.1 ms | 0.5 ms | 0.5 MB |
| 1,000 | 1.8 ms | 5.6 ms | 0.3 ms | 4.8 ms | 4.6 MB |
| 10,000 | 30.8 ms | 50.0 ms | 2.2 ms | 52.1 ms | 46.4 MB |

Per-thread cost at 10,000 against 1,000, which is the assertion that catches a
complexity change rather than a slow function:

```
recordsFor       1.20x        applyFilter      1.00x
metricCounts     0.77x        needsAttention   1.00x
replyQueue       1.82x        datedItems       0.57x
waitingItems     1.06x        quickWinItems    1.00x
sortAndPage      0.35x        backlogBatch     0.92x
```

All roughly linear. Before the fixes in section 4, `recordsFor` measured
**16.23x**.

What reaches a page at 10,000 threads: All Email renders 25 rows across 400
pages, one page of threads is 10.7 kB, a backlog batch is 50 items, and every
dashboard queue is capped at 10 with its true total reported. The 46.4 MB figure
is the whole dataset and should never appear in a response.

## 7. Database verification

`docs/migrations/0099_verify.sql`, against PostgreSQL 16.13. It tries to cross
every boundary the schema is meant to hold, and all of them fail as they should:

- an analysed row with no provenance → rejected by check constraint;
- an extraction with no source → rejected;
- an unknown `basis` value → rejected;
- a child row whose account differs from its thread's account → rejected by
  trigger, with a message naming the work and personal separation;
- five denied capabilities granted → each rejected by check constraint;
- a non-advisory security disposition → rejected;
- the same payload approved twice → rejected by unique constraint;
- an undeclared action kind approved → rejected;
- a ninth backlog state → rejected;
- one person reading another's rows → one row visible each, under RLS;
- one person inserting a row owned by another → rejected by the insert policy;
- an audit line updated → `insufficient_privilege`;
- an audit line deleted → `insufficient_privilege`;
- the export carrying a token handle → it does not, and it names what it omits;
- the deletion claiming to delete mail → it does not, and it names what
  survives.

All three migrations are idempotent: applied twice, clean both times.

## 8. What is not tested, and cannot be here

Honest list.

- **Sending.** There is nothing to test. The capability is denied and
  ungrantable and the read-only provider interface has no method to call. What
  is asserted is the absence.
- **The OAuth flow.** No registered application, no server to hold a secret.
  The scope declarations, the justifications and the guard are tested.
- **Real provider behaviour.** The mock reproduces rate limits, outages,
  expired permissions, revoked credentials and expired cursors. It does not
  reproduce Graph delta tokens that return the same message twice with
  different properties, Gmail history ids that expire sooner than documented,
  or messages that change thread membership. Those will be found in the first
  week against a real mailbox.
- **Model calls.** The output contracts and their validation are tested; the
  calls are not built.
- **A real screen reader.** Semantics are automated; the pass itself is
  outstanding and listed in `docs/ACCESSIBILITY_REPORT.md` section 5.
- **Multi-tenant behaviour.** One tenant is not two. Tenant isolation is
  tested as a boundary the code enforces, not as two real tenants.
- **Concurrency.** The idempotency ledger is correct for one process and wrong
  for a horizontally scaled worker. That is in
  `docs/KNOWN_LIMITATIONS.md`, not in a test.

## 9. The shape of the suites, and why

Three choices worth stating.

**Invariants over literals.** When the priority model went from ten factors to
eleven in Stage 6, exactly one assertion broke: "there are ten factors". Nothing
else, because the tests assert that every score carries its reasons and that
escalation can only raise a band, not that a particular thread scores 83. A
suite full of literal expected values would have taken a day to migrate and
would have taught nobody anything.

**Measure rather than assert.** The contrast suite computes ratios; the
performance suite computes per-thread cost; the keyboard suite reads the
computed outline at the moment of focus. Measuring is what found four of the
five Stage 7 defects. An assertion that the stylesheet contains a rule would
have found none of them.

**Attacks, not confirmations.** The security tests try to send, try to read
another account, try to escalate a capability, try to forge an approval. Each
has to fail for a structural reason rather than because a condition happened to
be false.
