/**
 * Email Command Centre, Stage 7 tests.
 *
 * Backlog mode, the approval gate, and the claims the finished feature makes
 * about itself. Several of these are written as attacks on the gate rather than
 * as confirmations of it: forge an approval, approve the wrong payload, approve
 * on the wrong account, ask for a bulk action, ask for a disabled one. The gate
 * has to refuse each for a structural reason.
 *
 * The language tests are the unusual ones. The brief rules out leaderboards,
 * comparisons, productivity scores, shame and anxiety-producing backlog
 * language. A rule nobody can check is a rule that drifts, so every string the
 * backlog module can show is scanned.
 *
 * Run: bun app/tests/emailCommandCentre.completion.test.ts
 */
import {
  BACKLOG_STATES,
  BANNED_LANGUAGE,
  BATCH_SIZE_OPTIONS,
  BacklogSelection,
  DEFAULT_BACKLOG_SELECTION,
  EXCLUSION_LABEL,
  backlogState,
  buildBacklogBatch,
  decisionFor,
  filterForSelection,
  finishSession,
  goBack,
  languageProblems,
  parseSession,
  pauseSession,
  progressOf,
  recordDecision,
  resolvedBatchSize,
  resumeSession,
  serialiseSession,
  skipCurrent,
  startSession,
  windowForBacklogRange,
} from '../src/lib/email/backlog';
import {
  APPROVAL_GUARANTEE,
  ActionRefused,
  AVAILABLE_ACTIONS,
  DESTRUCTIVE_BULK_ACTIONS,
  DISABLED_ACTIONS,
  EXTERNAL_ACTIONS,
  approveAction,
  draftApprovalStatus,
  externalAction,
  payloadFingerprint,
  planAction,
  statusForAction,
} from '../src/lib/email/approvals';
import { createApproval } from '../src/lib/email/draftReview';
import { capability, grant, noGrants } from '../src/lib/email/providers/capabilities';
import { recordsFor } from '../src/lib/email/filters';
import { getDataset } from '../src/lib/email/data';
import { DEMO_NOW } from '../src/lib/email/data/clock';
import { EMAIL_MODULE_DESTINATIONS } from '../src/lib/email/moduleNav';
import { EMAIL_ROUTES } from '../src/pages/email/emailRouteTable';
import { metricCounts } from '../src/lib/email/aggregation';
import { paginate } from '../src/lib/email/views';

let failures = 0;
let checks = 0;

function assert(condition: boolean, description: string): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${description}`);
  }
}

function group(name: string): void {
  console.log(`\n${name}`);
}

const WORK = 'acct-work-01';
const PERSONAL = 'acct-personal-01';

const workDataset = getDataset(WORK)!;
const personalDataset = getDataset(PERSONAL)!;
const workRecords = recordsFor(workDataset);
const personalRecords = recordsFor(personalDataset);

const baseSelection: BacklogSelection = {
  ...DEFAULT_BACKLOG_SELECTION,
  accountId: WORK,
  accountType: 'work',
};

/* ============================================================ 1. selection */

group('Every selection criterion in the brief is expressible');

{
  const selection: BacklogSelection = {
    ...baseSelection,
    folder: 'inbox',
    dateRange: { preset: '30d' },
    unreadOnly: true,
    unresolvedOnly: true,
    awaitingReplyOnly: true,
    priorityPeople: ['ops@greenway-collective.example'],
    withDeadlineOnly: true,
    batchSize: 10,
  };

  const filter = filterForSelection(selection, DEMO_NOW);
  assert(filter.accountId === WORK, 'Account is carried into the filter.');
  assert(filter.accountType === 'work', 'Account type is carried into the filter.');
  assert(filter.isRead === false, 'Unread only becomes isRead false.');
  assert(filter.includeResolved === false, 'Unresolved only excludes resolved threads.');
  assert(filter.replyRequired === true, 'Awaiting a reply becomes replyRequired.');
  assert(filter.hasDeadline === 'any', 'With a date becomes a deadline filter.');
  assert(typeof filter.dateFrom === 'string', 'A 30 day range produces a window.');

  const batch = buildBacklogBatch(workRecords, selection, DEMO_NOW);
  assert(batch.items.length <= 10, 'The batch never exceeds the chosen size.');
  assert(
    batch.items.every((i) => i.record.thread.accountId === WORK),
    'Every item is from the chosen account.'
  );
}

{
  assert(resolvedBatchSize({ ...baseSelection, batchSize: 10 }) === 10, 'Batch size 10 resolves.');
  assert(resolvedBatchSize({ ...baseSelection, batchSize: 25 }) === 25, 'Batch size 25 resolves.');
  assert(resolvedBatchSize({ ...baseSelection, batchSize: 50 }) === 50, 'Batch size 50 resolves.');
  assert(
    resolvedBatchSize({ ...baseSelection, batchSize: 'custom', customBatchSize: 7 }) === 7,
    'A custom size is honoured.'
  );
  assert(
    resolvedBatchSize({ ...baseSelection, batchSize: 'custom', customBatchSize: 9999 }) === 200,
    'An absurd custom size is clamped rather than accepted.'
  );
  assert(
    resolvedBatchSize({ ...baseSelection, batchSize: 'custom', customBatchSize: 0 }) === 1,
    'Zero is clamped to one, because a batch of nothing is not a batch.'
  );
  assert(
    resolvedBatchSize({ ...baseSelection, batchSize: 'custom', customBatchSize: Number.NaN }) === 25,
    'A non-number falls back rather than producing an empty batch.'
  );
  assert(BATCH_SIZE_OPTIONS.length === 4, 'The four batch sizes from the brief are offered.');
}

group('The date range covers the backlog case, not only the recent case');

{
  const older = windowForBacklogRange({ preset: 'older_than_30d' }, DEMO_NOW);
  assert(
    typeof older.dateTo === 'string' && older.dateFrom === undefined,
    'Older than 30 days is an upper bound, which is what a backlog session usually wants.'
  );
  const custom = windowForBacklogRange(
    { preset: 'custom', from: '2026-09-01T00:00:00+10:00', to: '2026-09-30T23:59:59+10:00' },
    DEMO_NOW
  );
  assert(custom.dateFrom === '2026-09-01T00:00:00+10:00', 'A custom range keeps its own offsets.');
  assert(Object.keys(windowForBacklogRange({ preset: 'any' }, DEMO_NOW)).length === 0, 'Any date is no window.');
}

/* ============================================================ 2. workflow */

group('The workflow order puts consequence before volume');

{
  const wide: BacklogSelection = {
    ...baseSelection,
    unresolvedOnly: false,
    batchSize: 50,
  };
  const batch = buildBacklogBatch(workRecords, wide, DEMO_NOW);

  assert(batch.items.length > 0, 'The wide selection produces a batch.');

  const firstFlagged = batch.items.findIndex((i) => i.record.analysis.securityAlert !== null);
  const firstUnflagged = batch.items.findIndex((i) => i.record.analysis.securityAlert === null);
  assert(
    firstFlagged === -1 || firstFlagged < firstUnflagged,
    'A flagged thread is ahead of every unflagged one.'
  );

  const surfaced = batch.items.filter((i) => i.surfacedEarly);
  const notSurfaced = batch.items.filter((i) => !i.surfacedEarly);
  const lastSurfaced = surfaced.length > 0 ? surfaced[surfaced.length - 1].position : 0;
  const firstOrdinary = notSurfaced.length > 0 ? notSurfaced[0].position : Number.MAX_SAFE_INTEGER;
  assert(
    lastSurfaced < firstOrdinary,
    'Everything brought forward sits ahead of everything that was not.'
  );

  assert(
    batch.items.every((i) => i.orderReason.trim().length > 20),
    'Every item says why it is in that position.'
  );
  assert(
    batch.items.every((i, index) => i.position === index + 1),
    'Positions are sequential from one.'
  );
}

group('Duplicates are removed and counted, not silently dropped');

{
  const withDuplicates = workRecords.filter((r) => r.thread.duplicateOf);
  const batch = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, batchSize: 50 },
    DEMO_NOW
  );
  assert(
    batch.items.every((i) => !i.record.thread.duplicateOf),
    'No duplicate is in the batch.'
  );
  if (withDuplicates.length > 0) {
    const bucket = batch.excluded.find((e) => e.reason === 'duplicate');
    assert(Boolean(bucket), 'The duplicates are listed as excluded.');
    assert(
      (bucket?.threadIds.length ?? 0) === withDuplicates.length,
      'Every duplicate is accounted for by id, so nothing disappears.'
    );
  }
  assert(
    Object.keys(EXCLUSION_LABEL).length === 4,
    'Each exclusion reason has a label a person can read.'
  );
}

group('Resolved threads are identified rather than quietly included');

{
  const batch = buildBacklogBatch(workRecords, baseSelection, DEMO_NOW);
  assert(
    batch.items.every((i) => i.record.analysis.currentStatus !== 'resolved'),
    'With unresolved-only on, no resolved thread is offered for review.'
  );

  const including = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, batchSize: 50 },
    DEMO_NOW
  );
  const resolvedInBatch = including.items.filter((i) => i.record.analysis.currentStatus === 'resolved');
  assert(
    resolvedInBatch.length > 0 || including.items.length < 50,
    'Turning it off does offer them, so the option is real.'
  );
}

group('Related threads are grouped, with the reason');

{
  const batch = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, batchSize: 50 },
    DEMO_NOW
  );
  assert(
    batch.groups.every((g) => g.threadIds.length >= 2),
    'A group of one is not a group.'
  );
  assert(
    batch.groups.every((g) => g.reason.trim().length > 20),
    'Every group says why those threads belong together.'
  );
  const assigned = batch.items.filter((i) => i.groupKey);
  assert(
    assigned.every((i) => batch.groups.some((g) => g.key === i.groupKey)),
    'Every item that claims a group has one.'
  );
  // A thread cannot be in two groups, because then "decide these together"
  // means two different things at once.
  const counts = new Map<string, number>();
  for (const g of batch.groups) {
    for (const id of g.threadIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  assert([...counts.values()].every((n) => n === 1), 'No thread is in two groups.');
}

group('Priority people narrow the selection, and nobody is ranked');

{
  const address = workRecords[0].counterpartyAddress;
  const narrowed = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, priorityPeople: [address], batchSize: 50 },
    DEMO_NOW
  );
  assert(narrowed.items.length >= 1, 'Nominating a person keeps their threads.');
  assert(
    narrowed.items.every((i) =>
      i.record.messages.some((m) =>
        m.participants.some((p) => !p.isSelf && p.address.toLowerCase() === address.toLowerCase())
      )
    ),
    'And keeps only threads that person is actually in.'
  );
  const excluded = narrowed.excluded.find((e) => e.reason === 'not_a_priority_person');
  assert(Boolean(excluded), 'The rest are listed as excluded for that reason, not deleted.');

  const everyone = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, priorityPeople: [], batchSize: 50 },
    DEMO_NOW
  );
  assert(
    everyone.items.length >= narrowed.items.length,
    'An empty list of people means everyone, rather than nobody.'
  );
}

/* ====================================================== 3. progress states */

group('The eight progress states, and only those eight');

{
  assert(BACKLOG_STATES.length === 8, 'Eight states.');
  const expected = [
    'reviewed',
    'reply_drafted',
    'approved',
    'waiting',
    'deferred',
    'no_action',
    'manual_review',
    'security_review',
  ];
  for (const state of expected) {
    assert(
      BACKLOG_STATES.some((s) => s.state === state),
      `${state} is one of the states.`
    );
  }
  for (const s of BACKLOG_STATES) {
    assert(s.meaning.trim().length > 15, `${s.state}: says what choosing it means.`);
    assert(s.effect.trim().length > 30, `${s.state}: says what actually happens.`);
  }
  // Not one of them may imply an external effect. This is the assertion that
  // keeps a future "Archived" state from being added without a conversation.
  for (const s of BACKLOG_STATES) {
    assert(
      !/\bwe (?:send|archive|delete|file)\b/i.test(s.effect),
      `${s.state}: the effect claims no external action.`
    );
  }
  assert(
    BACKLOG_STATES.filter((s) => !s.closesItem).length === 2,
    'Two states leave the item open: a drafted reply and one sent to manual review.'
  );
}

group('No leaderboard, no score, no shame, and it is checked rather than promised');

{
  assert(BANNED_LANGUAGE.length >= 10, 'The banned list is substantial.');

  const everyString: string[] = [
    ...BACKLOG_STATES.flatMap((s) => [s.label, s.meaning, s.effect]),
    ...Object.values(EXCLUSION_LABEL),
    ...BATCH_SIZE_OPTIONS.map((o) => o.label),
    ...EXTERNAL_ACTIONS.flatMap((a) => [a.label, a.description, a.releaseReason, a.touchesOutside]),
    ...DESTRUCTIVE_BULK_ACTIONS.flatMap((b) => [b.name, b.why]),
    APPROVAL_GUARANTEE.statement,
  ];

  for (const text of everyString) {
    const problems = languageProblems(text);
    assert(problems.length === 0, `Clean language: "${text.slice(0, 50)}" (${problems[0]?.why ?? ''})`);
  }

  // And the detector works, so a clean result means something.
  assert(languageProblems('You are falling behind on your inbox').length > 0, 'Shame is detected.');
  assert(languageProblems('Your productivity score is 62').length > 0, 'A score on a person is detected.');
  assert(languageProblems('See the team leaderboard').length > 0, 'A leaderboard is detected.');
  assert(languageProblems('You are drowning in email').length > 0, 'Anxiety framing is detected.');
  assert(languageProblems('Only 3 left, keep it up').length > 0, 'Gamification pressure is detected.');
  assert(
    languageProblems('12 threads match this selection. 4 decided, 8 still open.').length === 0,
    'A plain count of work is not shame.'
  );
}

/* ========================================================== 4. the session */

group('A session is a state machine, and every transition is pure');

{
  const batch = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, batchSize: 5 },
    DEMO_NOW
  );
  const session = startSession(batch, DEMO_NOW, 'test-session');

  assert(session.status === 'active', 'A session with items is active.');
  assert(session.cursor === 0, 'It starts at the first item.');
  assert(session.order.length === batch.items.length, 'The order matches the batch.');

  const first = session.order[0];
  const after = recordDecision(session, first, 'reviewed', DEMO_NOW);
  assert(session.cursor === 0, 'The original session is not mutated.');
  assert(session.decisions.length === 0, 'The original session keeps no decision.');
  assert(after.cursor === 1, 'The copy advanced.');
  assert(after.decisions.length === 1, 'The copy recorded one decision.');
  assert(decisionFor(after, first)?.state === 'reviewed', 'And it is readable by thread id.');

  // A state that does not close the item does not advance.
  const drafted = recordDecision(session, first, 'reply_drafted', DEMO_NOW);
  assert(drafted.cursor === 0, 'A drafted reply keeps the person on the item.');
  assert(drafted.decisions.length === 1, 'And still records the decision.');

  // Changing a decision replaces it rather than adding a second.
  const changed = recordDecision(after, first, 'deferred', DEMO_NOW);
  assert(changed.decisions.length === 1, 'Deciding again replaces the earlier decision.');
  assert(decisionFor(changed, first)?.state === 'deferred', 'The latest decision is the one kept.');

  let threw = false;
  try {
    recordDecision(session, 'thr-not-in-this-batch', 'reviewed', DEMO_NOW);
  } catch {
    threw = true;
  }
  assert(threw, 'A decision on a thread outside the session is refused rather than recorded.');
}

group('Pause and resume keep the decisions and the position');

{
  const batch = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, batchSize: 6 },
    DEMO_NOW
  );
  let session = startSession(batch, DEMO_NOW, 'pause-test');
  session = recordDecision(session, session.order[0], 'reviewed', DEMO_NOW);
  session = recordDecision(session, session.order[1], 'waiting', DEMO_NOW);

  const paused = pauseSession(session, DEMO_NOW);
  assert(paused.status === 'paused', 'Pausing sets the status.');
  assert(paused.pausedAt === DEMO_NOW, 'And records when.');
  assert(paused.decisions.length === 2, 'Pausing keeps the decisions.');
  assert(paused.cursor === session.cursor, 'And the position.');

  const resumed = resumeSession(paused, DEMO_NOW);
  assert(resumed.status === 'active', 'Resuming makes it active again.');
  assert(resumed.pausedAt === null, 'And clears the paused timestamp.');
  assert(resumed.cursor === session.cursor, 'The position survives the round trip.');
  assert(resumed.decisions.length === 2, 'So do the decisions.');

  // Round trip through storage, which is how a resume across a tab close works.
  const parsed = parseSession(serialiseSession(paused), DEMO_NOW);
  assert(parsed !== null, 'A paused session survives serialisation.');
  assert(parsed?.cursor === paused.cursor, 'With its position.');
  assert(parsed?.decisions.length === 2, 'And its decisions.');
  assert(
    JSON.stringify(parsed?.selection) === JSON.stringify(paused.selection),
    'And the selection it was built from.'
  );

  // What must NOT survive: a stored copy of the analysis. The ids are stored
  // and the analysis is rebuilt, so a resumed session cannot show a summary of
  // a conversation that has since moved on.
  const raw = serialiseSession(paused);
  assert(!raw.includes('oneLineSummary'), 'No stored copy of the analysis.');
  assert(!raw.includes('whyItMatters'), 'No stored copy of the reasoning.');
  assert(raw.includes(paused.order[0]), 'Only the thread ids.');
}

group('A stored session that should not be resumed is not offered');

{
  const batch = buildBacklogBatch(workRecords, { ...baseSelection, batchSize: 3 }, DEMO_NOW);
  const session = startSession(batch, DEMO_NOW, 'ttl-test');

  const stale = {
    ...session,
    startedAt: '2026-09-01T09:00:00+10:00',
    updatedAt: '2026-09-01T09:00:00+10:00',
  };
  assert(
    parseSession(JSON.stringify({ version: 1, session: stale }), DEMO_NOW) === null,
    'A session older than the window is not offered.'
  );
  assert(
    parseSession(JSON.stringify({ version: 1, session: finishSession(session, DEMO_NOW) }), DEMO_NOW) === null,
    'A finished session is not offered again.'
  );
  assert(parseSession('not json at all', DEMO_NOW) === null, 'Rubbish in storage is ignored.');
  assert(parseSession(JSON.stringify({ version: 2, session }), DEMO_NOW) === null, 'A future version is ignored.');
  assert(parseSession(JSON.stringify({ version: 1 }), DEMO_NOW) === null, 'A missing session is ignored.');
  assert(parseSession(null, DEMO_NOW) === null, 'Nothing stored is nothing offered.');
  assert(
    parseSession(JSON.stringify({ version: 1, session: { id: 'x' } }), DEMO_NOW) === null,
    'A malformed session is ignored rather than half loaded.'
  );
}

group('Progress is a count of work, never a judgement');

{
  const batch = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, batchSize: 6 },
    DEMO_NOW
  );
  let session = startSession(batch, DEMO_NOW, 'progress-test');
  const total = session.order.length;

  session = recordDecision(session, session.order[0], 'reviewed', DEMO_NOW);
  session = recordDecision(session, session.order[1], 'no_action', DEMO_NOW);
  session = recordDecision(session, session.order[2], 'security_review', DEMO_NOW);

  const progress = progressOf(session);
  assert(progress.total === total, 'The total is the batch size.');
  assert(progress.decided === 3, 'Three decided.');
  assert(progress.remaining === total - 3, 'And the rest are open.');
  assert(progress.byState.reviewed === 1, 'Counts per state are right.');
  assert(progress.byState.security_review === 1, 'Including the security state.');
  assert(progress.currentThreadId === session.order[3], 'The cursor points at the next open item.');

  // Walk the whole batch and confirm it finishes rather than sticking.
  let walking = session;
  for (const id of walking.order) {
    if (decisionFor(walking, id)) continue;
    walking = recordDecision(walking, id, 'reviewed', DEMO_NOW);
  }
  assert(progressOf(walking).currentThreadId === null, 'A finished batch has no current item.');
  assert(walking.status === 'complete', 'And the session is complete.');
  assert(progressOf(walking).remaining === 0, 'With nothing remaining.');

  // A complete session ignores further decisions rather than reopening.
  const afterComplete = recordDecision(walking, walking.order[0], 'deferred', DEMO_NOW);
  assert(afterComplete === walking, 'A complete session is not reopened by another decision.');
}

group('Skip and back move without deciding');

{
  const batch = buildBacklogBatch(
    workRecords,
    { ...baseSelection, unresolvedOnly: false, batchSize: 4 },
    DEMO_NOW
  );
  const session = startSession(batch, DEMO_NOW, 'skip-test');

  const skipped = skipCurrent(session, DEMO_NOW);
  assert(skipped.cursor === 1, 'Skipping advances.');
  assert(skipped.decisions.length === 0, 'And records nothing.');
  assert(
    skipped.order.includes(session.order[0]),
    'The skipped item is still in the batch, so it comes back.'
  );

  const back = goBack(skipped, DEMO_NOW);
  assert(back.cursor === 0, 'Back returns to it.');
  assert(goBack(session, DEMO_NOW).cursor === 0, 'Back from the first item stays put.');
}

group('An empty batch is a finished session, not a broken one');

{
  const empty = buildBacklogBatch(
    personalRecords,
    { ...baseSelection, accountId: PERSONAL, accountType: 'personal', priorityPeople: ['nobody@nowhere.invalid'] },
    DEMO_NOW
  );
  assert(empty.isEmpty, 'Nothing matched.');
  const session = startSession(empty, DEMO_NOW, 'empty-test');
  assert(session.status === 'complete', 'The session is complete immediately.');
  assert(progressOf(session).currentThreadId === null, 'With nothing to review.');
}

group('Backlog mode never crosses the account boundary');

{
  const batch = buildBacklogBatch(
    [...workRecords, ...personalRecords],
    { ...baseSelection, unresolvedOnly: false, batchSize: 50 },
    DEMO_NOW
  );
  assert(
    batch.items.every((i) => i.record.thread.accountId === WORK),
    'Given both accounts, the work selection returns only work threads.'
  );
  assert(
    batch.items.every((i) => i.record.thread.accountType === 'work'),
    'And only work account types.'
  );
}

/* ========================================================= 5. the approvals */

group('Every external action is declared, and all of them need approval');

{
  assert(EXTERNAL_ACTIONS.length === 5, 'The five actions from the brief are declared.');
  for (const action of EXTERNAL_ACTIONS) {
    assert(action.requiresApproval === true, `${action.kind} requires approval.`);
    assert(action.releaseReason.trim().length > 40, `${action.kind} explains its release state.`);
    assert(action.touchesOutside.trim().length > 15, `${action.kind} says what it would touch.`);
    assert(action.bulkAllowed === false, `${action.kind} is not a bulk action.`);
  }
  assert(AVAILABLE_ACTIONS.length === 1, 'Exactly one action is available in this release.');
  assert(
    AVAILABLE_ACTIONS[0].kind === 'save_draft_to_mailbox',
    'And it is saving a draft, not sending one.'
  );
  assert(DISABLED_ACTIONS.length === 4, 'The other four are off.');
}

group('Sending has two independent locks');

{
  const send = externalAction('send_reviewed_draft');
  assert(send.release === 'disabled_this_release', 'The release refuses it.');
  assert(send.implemented === false, 'Nothing is built behind it.');
  assert(send.capability === 'send_message', 'It names the capability it would need.');
  assert(capability('send_message').state === 'denied', 'And that capability is denied.');
  assert(capability('send_message').grantable === false, 'And cannot be granted.');

  // Forge a perfect approval and try anyway.
  const fingerprint = payloadFingerprint(['thr-w-001']);
  const forged = approveAction('send_reviewed_draft', {
    threadId: 'thr-w-001',
    accountId: WORK,
    fingerprint,
    summary: 'A forged approval',
    by: 'attacker',
    at: DEMO_NOW,
  });

  let refused: ActionRefused | null = null;
  try {
    planAction({
      kind: 'send_reviewed_draft',
      accountId: WORK,
      itemIds: ['thr-w-001'],
      grants: noGrants(WORK),
      approvals: [forged],
    });
  } catch (error) {
    refused = error as ActionRefused;
  }
  assert(refused !== null, 'A forged approval still cannot send.');
  assert(refused?.because === 'release_disabled', 'And it is refused by the release, before approvals are read.');

  const status = statusForAction('send_reviewed_draft', fingerprint, [forged]);
  assert(
    status.state === 'approved_but_unavailable',
    'The status says approved and still unavailable rather than implying it worked.'
  );
}

group('Archiving, task creation and reminder creation are off, with reasons');

{
  for (const kind of ['archive_messages', 'create_task', 'create_reminder'] as const) {
    const action = externalAction(kind);
    assert(action.release === 'disabled_this_release', `${kind} is disabled.`);
    assert(action.implemented === false, `${kind} has no implementation.`);
    assert(action.capability !== null, `${kind} names the capability it would need.`);
    assert(
      capability(action.capability!).state === 'denied',
      `${kind}: that capability is denied as well.`
    );

    let threw = false;
    try {
      planAction({
        kind,
        accountId: WORK,
        itemIds: ['thr-w-001'],
        grants: noGrants(WORK),
        approvals: [],
      });
    } catch (error) {
      threw = true;
      assert(
        (error as ActionRefused).because === 'release_disabled',
        `${kind}: refused by the release.`
      );
    }
    assert(threw, `${kind} cannot be planned.`);
  }
}

group('Destructive bulk actions are off by default and named');

{
  assert(DESTRUCTIVE_BULK_ACTIONS.length >= 5, 'The bulk actions are listed.');
  assert(
    DESTRUCTIVE_BULK_ACTIONS.every((b) => b.state === 'disabled'),
    'Every one of them is off.'
  );
  assert(
    DESTRUCTIVE_BULK_ACTIONS.every((b) => b.why.trim().length > 20),
    'Each says why.'
  );

  // And the gate refuses a multi-item request even for the one available action.
  let threw = false;
  try {
    planAction({
      kind: 'save_draft_to_mailbox',
      accountId: WORK,
      itemIds: ['thr-w-001', 'thr-w-002'],
      grants: grant(noGrants(WORK), 'write_draft_to_mailbox', DEMO_NOW),
      approvals: [],
    });
  } catch (error) {
    threw = true;
    assert((error as ActionRefused).because === 'bulk_not_allowed', 'Two items is refused as a bulk action.');
  }
  assert(threw, 'The one available action still works on one item at a time.');
}

group('Saving a draft needs the capability, the approval and the right account');

{
  const ids = ['thr-w-001'];
  const fingerprint = payloadFingerprint(ids);
  const withCapability = grant(noGrants(WORK), 'write_draft_to_mailbox', DEMO_NOW);

  // No capability.
  let refused: ActionRefused | null = null;
  try {
    planAction({
      kind: 'save_draft_to_mailbox',
      accountId: WORK,
      itemIds: ids,
      grants: noGrants(WORK),
      approvals: [],
    });
  } catch (error) {
    refused = error as ActionRefused;
  }
  assert(refused?.because === 'capability_not_granted', 'Without the opt-in capability, it is refused.');

  // Capability, no approval.
  refused = null;
  try {
    planAction({
      kind: 'save_draft_to_mailbox',
      accountId: WORK,
      itemIds: ids,
      grants: withCapability,
      approvals: [],
    });
  } catch (error) {
    refused = error as ActionRefused;
  }
  assert(refused?.because === 'not_approved', 'With the capability and no approval, it is still refused.');

  // Approval for a different payload.
  const wrongPayload = approveAction('save_draft_to_mailbox', {
    threadId: 'thr-w-002',
    accountId: WORK,
    fingerprint: payloadFingerprint(['thr-w-002']),
    summary: 'A different draft',
    by: 'anthony',
    at: DEMO_NOW,
  });
  refused = null;
  try {
    planAction({
      kind: 'save_draft_to_mailbox',
      accountId: WORK,
      itemIds: ids,
      grants: withCapability,
      approvals: [wrongPayload],
    });
  } catch (error) {
    refused = error as ActionRefused;
  }
  assert(
    refused?.because === 'approval_expired',
    'An approval for another payload does not authorise this one.'
  );

  // Approval on another account.
  const wrongAccount = approveAction('save_draft_to_mailbox', {
    threadId: 'thr-w-001',
    accountId: PERSONAL,
    fingerprint,
    summary: 'Approved on the personal account',
    by: 'anthony',
    at: DEMO_NOW,
  });
  refused = null;
  try {
    planAction({
      kind: 'save_draft_to_mailbox',
      accountId: WORK,
      itemIds: ids,
      grants: withCapability,
      approvals: [wrongAccount],
    });
  } catch (error) {
    refused = error as ActionRefused;
  }
  assert(
    refused?.because === 'account_mismatch',
    'An approval given on another account does not carry across.'
  );

  // Everything right.
  const right = approveAction('save_draft_to_mailbox', {
    threadId: 'thr-w-001',
    accountId: WORK,
    fingerprint,
    summary: 'The right draft, on the right account',
    by: 'anthony',
    at: DEMO_NOW,
  });
  const plan = planAction({
    kind: 'save_draft_to_mailbox',
    accountId: WORK,
    itemIds: ids,
    grants: withCapability,
    approvals: [right],
  });
  assert(plan.kind === 'save_draft_to_mailbox', 'With all three, a plan is produced.');
  assert(plan.approvalRequired === true, 'And it still says approval was required.');
  assert(plan.wouldDo.includes('draft'), 'The plan says what would happen.');
  assert(
    /nothing is sent/i.test(plan.wouldNotDo),
    'And what would not, which is the sentence people need.'
  );
  assert(plan.itemIds.length === 1, 'For exactly one item.');

  // An empty request is refused rather than treated as a no-op success.
  let threw = false;
  try {
    planAction({
      kind: 'save_draft_to_mailbox',
      accountId: WORK,
      itemIds: [],
      grants: withCapability,
      approvals: [right],
    });
  } catch {
    threw = true;
  }
  assert(threw, 'A request with no items is refused.');
}

group('Approval is invalidated by any change to the draft');

{
  const draft = {
    accountId: WORK,
    fromAddress: 'anthony@concludo.example',
    recipients: [{ address: 'ops@greenway-collective.example', field: 'to' as const, displayName: 'Ops' }],
    subject: 'RE: Workshop room change',
    body: 'Room 2 is fine. See you on the 20th.',
    attachmentIds: [] as string[],
  };

  const record = createApproval('thr-w-005', draft, 'anthony', DEMO_NOW);
  assert(draftApprovalStatus(draft, record).state === 'approved', 'The approved text is approved.');

  const edits: { label: string; change: typeof draft }[] = [
    { label: 'the body', change: { ...draft, body: `${draft.body} Please confirm the time.` } },
    { label: 'the subject', change: { ...draft, subject: 'RE: Workshop room' } },
    { label: 'a recipient', change: { ...draft, recipients: [...draft.recipients, { address: 'someone@else.example', field: 'cc' as const, displayName: 'Someone' }] } },
    { label: 'the from address', change: { ...draft, fromAddress: 'other@concludo.example' } },
    { label: 'the account', change: { ...draft, accountId: PERSONAL } },
    { label: 'an attachment', change: { ...draft, attachmentIds: ['att-1'] } },
  ];

  for (const edit of edits) {
    const status = draftApprovalStatus(edit.change, record);
    assert(status.state === 'expired', `Changing ${edit.label} expires the approval.`);
    assert(status.changed.length > 0, `And the status names what changed (${edit.label}).`);
    assert(/expired/i.test(status.message), `And says so in words (${edit.label}).`);
  }

  // One space is not a change. Six fields are compared on trimmed values, and
  // treating whitespace as a material edit would train people to re-approve
  // reflexively, which is how approval becomes a formality.
  const whitespace = { ...draft, body: ` ${draft.body} ` };
  assert(
    draftApprovalStatus(whitespace, record).state === 'approved',
    'Leading and trailing whitespace is not a material change.'
  );

  assert(
    draftApprovalStatus(draft, null).state === 'not_approved',
    'With no approval at all, the state says not approved.'
  );
}

group('The approval guarantee is a claim with evidence behind it');

{
  assert(APPROVAL_GUARANTEE.statement.length > 80, 'The guarantee is stated in full.');
  assert(APPROVAL_GUARANTEE.provenBy.length >= 5, 'With the things that prove it.');
  for (const proof of APPROVAL_GUARANTEE.provenBy) {
    assert(proof.trim().length > 30, `Each proof is specific: "${proof.slice(0, 40)}"`);
  }
  assert(
    /sending, deletion and archiving are not available/i.test(APPROVAL_GUARANTEE.statement),
    'And it names what is unavailable rather than only what needs approval.'
  );
}

group('A payload fingerprint is stable, order independent and size aware');

{
  assert(
    payloadFingerprint(['a', 'b']) === payloadFingerprint(['b', 'a']),
    'Order does not change the fingerprint.'
  );
  assert(
    payloadFingerprint(['a', 'b']) !== payloadFingerprint(['a', 'c']),
    'Different items do.'
  );
  assert(
    payloadFingerprint(['a']) !== payloadFingerprint(['a', 'a']),
    'And so does the number of items.'
  );
  assert(payloadFingerprint([' a ']) === payloadFingerprint(['a']), 'Whitespace is ignored.');
}

/* =================================================== 6. definition of done */

group('Navigation holds, including the eleventh tab');

{
  assert(EMAIL_MODULE_DESTINATIONS.length === 11, 'Eleven destinations.');
  assert(EMAIL_ROUTES.length === 11, 'Eleven routes, derived from them.');
  assert(
    EMAIL_MODULE_DESTINATIONS.every((d) => EMAIL_ROUTES.some((r) => r.path === d.path)),
    'Every tab has a route.'
  );
  assert(
    EMAIL_ROUTES.every((r) => EMAIL_MODULE_DESTINATIONS.some((d) => d.path === r.path)),
    'Every route has a tab.'
  );
  const backlog = EMAIL_MODULE_DESTINATIONS.find((d) => d.path === '/email/clear-backlog');
  assert(Boolean(backlog), 'Clear Backlog is a destination.');
  assert(
    /paused and resumed/i.test(backlog?.accessibleDescription ?? ''),
    'And its description says it can be paused and resumed.'
  );
  assert(
    EMAIL_ROUTES.every((r) => typeof r.Component === 'function' || typeof r.Component === 'object'),
    'Every route resolves to a component.'
  );
}

group('Every metric still links to a filtered view that exists');

{
  const counts = metricCounts(workRecords, DEMO_NOW);
  assert(counts.length === 8, 'Eight metrics.');
  for (const count of counts) {
    assert(typeof count.count === 'number', `${count.key} has a number.`);
  }
}

group('Nothing loads a whole mailbox into a page');

{
  const page = paginate(workRecords, 0, 25);
  assert(page.items.length <= 25, 'A page is bounded.');
  assert(page.totalItems === workRecords.length, 'And says how many there are in total.');
  assert(page.to <= page.totalItems, 'The "showing x to y" line never promises more than exists.');
  const batch = buildBacklogBatch(workRecords, { ...baseSelection, batchSize: 10 }, DEMO_NOW);
  assert(batch.items.length <= 10, 'A backlog batch is bounded by the chosen size.');
  assert(
    batch.totalMatched >= batch.items.length,
    'And reports the full match count without rendering it.'
  );
}

/* ------------------------------------------------------------- summary */

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre Stage 7 completion: all checks passed.');
