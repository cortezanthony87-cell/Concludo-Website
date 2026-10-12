/**
 * Email Command Centre, Stage 3 model tests.
 *
 * House style, matching tests/: plain assertions, no framework, exit code 1 on
 * any failure, nothing treated as a warning.
 *
 * What these hold to account is not "does the code run". It is the handful of
 * promises the module makes to the person reading it: that work and personal
 * never merge, that a card and the page behind it agree, that an inferred date
 * is never shown as a stated one, that a resolved thread stops appearing, and
 * that every claim can be traced back to the message it came from.
 *
 * Run: bun app/tests/emailCommandCentre.model.test.ts
 */
import {
  WORK_DATASET,
  PERSONAL_DATASET,
  ACCOUNTS,
  getDataset,
} from '../src/lib/email/data';
import { DEMO_NOW } from '../src/lib/email/data/clock';
import { recordsFor, applyFilter, ThreadRecord } from '../src/lib/email/filters';
import {
  METRICS,
  QUEUES,
  buildDashboard,
  metricRecords,
  queueRecords,
} from '../src/lib/email/aggregation';
import { savedViews, runSavedView } from '../src/lib/email/savedViews';
import { bandForScore, bandRank, scoreFromFactors, PRIORITY_FACTOR_KEYS } from '../src/lib/email/priority';
import { PRIORITY_WEIGHTS, Traceable } from '../src/lib/email/model';
import { syntheticMetrics, syntheticPanels, toPanelItem } from '../src/lib/email/shellAdapter';

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

const work = recordsFor(WORK_DATASET);
const personal = recordsFor(PERSONAL_DATASET);
const NOW = DEMO_NOW;

/* ------------------------------------------------- 1. account separation */

group('Account separation');

assert(ACCOUNTS.length === 2, 'Two accounts exist.');
assert(getDataset('acct-work-01') !== null, 'The work dataset resolves.');
assert(getDataset('acct-personal-01') !== null, 'The personal dataset resolves.');
assert(
  getDataset('acct-does-not-exist') === null,
  'An unknown account id returns null rather than falling back to the work account.'
);

for (const r of work) {
  assert(r.thread.accountId === 'acct-work-01', `Work record ${r.thread.id} belongs to the work account.`);
  assert(r.analysis.accountId === 'acct-work-01', `Work analysis ${r.thread.id} belongs to the work account.`);
}
for (const r of personal) {
  assert(
    r.thread.accountId === 'acct-personal-01',
    `Personal record ${r.thread.id} belongs to the personal account.`
  );
}

/* ------------------------------------- 9. work and personal data separation */

group('Work and personal data never merge');

const workIds = new Set(work.map((r) => r.thread.id));
const personalIds = new Set(personal.map((r) => r.thread.id));
assert(
  [...workIds].every((id) => !personalIds.has(id)),
  'No thread id appears in both accounts.'
);

const workAddresses = new Set(WORK_DATASET.messages.flatMap((m) => m.participants.map((p) => p.address)));
const personalAddresses = new Set(
  PERSONAL_DATASET.messages.flatMap((m) => m.participants.map((p) => p.address))
);
assert(
  !workAddresses.has('you@personal.example'),
  'The personal address never appears in the work account.'
);
assert(
  !personalAddresses.has('you@your-practice.example'),
  'The work address never appears in the personal account.'
);

for (const account of ACCOUNTS) {
  const dashboard = buildDashboard(getDataset(account.id)!, NOW);
  for (const queue of dashboard.queues) {
    for (const record of queue.records) {
      assert(
        record.thread.accountId === account.id,
        `${queue.key} for ${account.id} holds only that account's threads.`
      );
    }
  }
}

assert(
  WORK_DATASET.auditEvents.every((e) => e.accountId === 'acct-work-01'),
  'Audit events are written against the account they belong to.'
);

/* ------------------------------------------------ fictional data only */

group('The dataset is entirely fictional');

const allAddresses = [...workAddresses, ...personalAddresses];
assert(allAddresses.length > 0, 'There are addresses to check.');
assert(
  allAddresses.every((a) => a.endsWith('.example')),
  'Every address uses the reserved .example domain, which cannot be registered.'
);

/* --------------------------------------------- 10. source traceability */

group('Source traceability');

function traceables(r: ThreadRecord): { label: string; item: Traceable }[] {
  const a = r.analysis;
  return [
    ...a.explicitDeadlines.map((x) => ({ label: `deadline ${x.id}`, item: x })),
    ...a.suggestedDates.map((x) => ({ label: `suggested date ${x.id}`, item: x })),
    ...a.actions.map((x) => ({ label: `action ${x.id}`, item: x })),
    ...a.decisionsMade.map((x) => ({ label: `decision made ${x.id}`, item: x })),
    ...a.decisionsRequired.map((x) => ({ label: `decision required ${x.id}`, item: x })),
    ...a.commitments.map((x) => ({ label: `commitment ${x.id}`, item: x })),
    ...a.openQuestions.map((x) => ({ label: `question ${x.id}`, item: x })),
    ...a.conflicts.map((x) => ({ label: `conflict ${x.id}`, item: x })),
    ...a.risks.map((x) => ({ label: `risk ${x.id}`, item: x })),
    ...a.attachments.map((x) => ({ label: `attachment ${x.id}`, item: x })),
    ...a.factsToVerify.map((x) => ({ label: `fact ${x.id}`, item: x })),
    { label: `classification ${r.thread.id}`, item: a.classification },
    ...(a.securityAlert ? [{ label: `alert ${a.securityAlert.id}`, item: a.securityAlert }] : []),
  ];
}

let traced = 0;
for (const r of [...work, ...personal]) {
  const messageIds = new Set(r.thread.messageIds);
  for (const { label, item } of traceables(r)) {
    traced += 1;
    assert(item.source.length > 0, `${label} names at least one source message.`);
    for (const src of item.source) {
      assert(src.threadId === r.thread.id, `${label} cites a source in its own thread.`);
      assert(
        messageIds.has(src.messageId),
        `${label} cites a message that exists in the thread (${src.messageId}).`
      );
    }
  }
}
assert(traced > 60, `Enough extractions exist to make this meaningful (${traced} checked).`);

/* --------------------------------- stated is never presented as inferred */

group('Stated and inferred are never confused');

for (const r of [...work, ...personal]) {
  for (const d of r.analysis.explicitDeadlines) {
    assert(d.basis === 'stated', `Explicit deadline ${d.id} has a stated basis.`);
    assert(d.consequence.length > 0, `Explicit deadline ${d.id} names a consequence.`);
  }
  for (const d of r.analysis.suggestedDates) {
    assert(d.basis !== 'stated', `Suggested date ${d.id} is not marked as stated.`);
  }
}

for (const r of [...work, ...personal]) {
  const item = toPanelItem(r);
  if (item.deadline !== null && item.deadlineIsExplicit) {
    assert(
      r.analysis.explicitDeadlines.some((d) => d.dueAt === item.deadline),
      `${r.thread.id}: a row marked explicit shows a date the sender actually wrote.`
    );
  }
  if (item.deadline !== null && !item.deadlineIsExplicit) {
    assert(
      r.analysis.suggestedDates.some((d) => d.dueAt === item.deadline),
      `${r.thread.id}: a row marked inferred shows a date from the suggested list.`
    );
  }
}

/* ------------------------------------------------- 4. priority ordering */

group('Priority is calculated, not asserted');

assert(
  Math.abs(Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9,
  'The ten weights sum to exactly 1.00.'
);
// Updated in Stage 6: the model moved from ten factors to the eleven in the
// Stage 6 specification. Every other assertion in this suite survived the
// migration untouched, because they check invariants rather than literal
// scores.
assert(PRIORITY_FACTOR_KEYS.length === 11, 'There are eleven factors.');

for (const r of [...work, ...personal]) {
  const recomputed = scoreFromFactors(r.analysis.priority.factors);
  assert(
    recomputed === r.analysis.priorityScore,
    `${r.thread.id}: the stored score equals the score recomputed from its factors.`
  );
  assert(
    r.analysis.priorityScore >= 0 && r.analysis.priorityScore <= 100,
    `${r.thread.id}: the score is within range.`
  );
  assert(
    bandRank(r.analysis.priorityBand) >= bandRank(bandForScore(r.analysis.priorityScore)),
    `${r.thread.id}: the band is never quieter than the score alone would give.`
  );
  if (bandRank(r.analysis.priorityBand) > bandRank(bandForScore(r.analysis.priorityScore))) {
    assert(
      r.analysis.priorityReasons.some((x) => x.startsWith('Escalated:')),
      `${r.thread.id}: a raised band says which rule raised it.`
    );
  }
}

const handleFirst = queueRecords(work, 'handle_first', NOW);
for (let i = 1; i < handleFirst.length; i += 1) {
  const prev = handleFirst[i - 1].analysis;
  const next = handleFirst[i].analysis;
  assert(
    bandRank(prev.priorityBand) >= bandRank(next.priorityBand),
    'Handle First never puts a quieter band above a louder one.'
  );
  if (prev.priorityBand === next.priorityBand) {
    assert(
      prev.priorityScore >= next.priorityScore,
      'Within a band, Handle First is ordered by score.'
    );
  }
}
assert(handleFirst.length > 0, 'Handle First is not empty in the demonstration data.');
assert(
  handleFirst[0].analysis.securityAlert !== null,
  'The suspected payment attack leads Handle First, which is the point of the escalation rule.'
);

group('Priority reasons name a consequence, not a keyword');

for (const r of [...work, ...personal]) {
  for (const reason of r.analysis.priorityReasons) {
    assert(reason.trim().length > 0, `${r.thread.id}: no blank reason is shown.`);
    assert(
      !/contains the word|keyword|marked urgent|subject line says/i.test(reason),
      `${r.thread.id}: a reason explains a consequence rather than a word match.`
    );
  }
}

/* --------------------------------------------- 7. resolved-thread exclusion */

group('Resolved threads stop appearing');

const resolved = [...work, ...personal].filter((r) => r.analysis.currentStatus === 'resolved');
assert(resolved.length >= 2, 'The dataset contains resolved threads to exclude.');

for (const account of ACCOUNTS) {
  const dashboard = buildDashboard(getDataset(account.id)!, NOW);
  for (const queue of dashboard.queues) {
    assert(
      queue.records.every((r) => r.analysis.currentStatus !== 'resolved'),
      `${queue.key} holds no resolved thread.`
    );
  }
  for (const metric of METRICS) {
    const got = metricRecords(recordsFor(getDataset(account.id)!), metric.key, NOW);
    assert(
      got.every((r) => r.analysis.currentStatus !== 'resolved'),
      `The ${metric.key} count excludes resolved threads.`
    );
  }
}

group('Bulk mail and duplicates stay out of the work queues');

const bulk = work.filter((r) => r.analysis.classification.isBulk);
const duplicates = work.filter((r) => r.thread.duplicateOf);
assert(bulk.length >= 2, 'The dataset contains bulk mail.');
assert(duplicates.length >= 1, 'The dataset contains a duplicate notification.');

for (const queue of QUEUES) {
  const got = queue.build(work, NOW);
  assert(got.every((r) => !r.analysis.classification.isBulk), `${queue.key} holds no bulk mail.`);
  assert(got.every((r) => !r.thread.duplicateOf), `${queue.key} holds no duplicate.`);
}

/* ------------------------------------------- 8. security review isolation */

group('Security Review is isolated and advisory');

const flagged = work.filter((r) => r.analysis.securityAlert !== null);
assert(flagged.length === 2, 'Two work threads are flagged: the payment request and the injection attempt.');
assert(
  flagged.every((r) => r.analysis.securityAlert?.disposition === 'advisory'),
  'Every alert is advisory. Nothing is blocked, quarantined or deleted.'
);
assert(
  flagged.every((r) => r.analysis.draftStatus === 'withheld_for_safety'),
  'No reply is drafted for a flagged thread.'
);
assert(
  flagged.every((r) => r.analysis.replyRequired === false),
  'A flagged thread never asks the person to reply.'
);
assert(
  flagged.every((r) => (r.analysis.securityAlert?.recommendedCheck ?? '').length > 0),
  'Every alert names a check the person can actually perform.'
);

const injection = work.find((r) => r.thread.id === 'thr-w-013');
assert(injection !== undefined, 'The injection thread exists.');
assert(
  injection!.messages.some((m) => m.injection?.handling === 'ignored'),
  'The injection attempt is recorded as read and ignored, not acted on.'
);
assert(
  (injection!.analysis.securityAlert?.flags ?? []).includes('prompt_injection'),
  'The injection attempt is flagged as such.'
);
assert(
  injection!.analysis.priorityBand === 'immediate',
  'The injection attempt did NOT succeed in hiding itself; it is surfaced, not suppressed.'
);

const securityCount = metricRecords(work, 'security_review', NOW).length;
assert(securityCount === flagged.length, 'The Security Review count equals the flagged threads.');

const replyQueue = queueRecords(work, 'reply_queue', NOW);
assert(
  replyQueue.every((r) => r.analysis.securityAlert === null),
  'No flagged thread leaks into the Reply Queue.'
);

/* -------------------------------------------------- 5. waiting ownership */

group('Waiting ownership');

const waitingOnOther = queueRecords(work, 'waiting', NOW);
assert(waitingOnOther.length > 0, 'Something is waiting on someone else.');
assert(
  waitingOnOther.every((r) => r.analysis.currentStatus === 'waiting_on_other'),
  'The waiting queue holds only threads where the next step is theirs.'
);
assert(
  waitingOnOther.every((r) => r.analysis.replyRequired === false),
  'A thread waiting on someone else never also asks you for a reply.'
);

const waitingOnUser = applyFilter(work, { waitingOn: 'user' });
assert(waitingOnUser.length > 0, 'Something is waiting on the person.');
assert(
  waitingOnUser.every((r) => !waitingOnOther.some((w) => w.thread.id === r.thread.id)),
  'No thread is in both waiting directions at once.'
);

const belmont = work.find((r) => r.thread.id === 'thr-w-010');
assert(
  belmont!.analysis.commitments.some((c) => !c.promisedByIsSelf && c.status === 'overdue'),
  'A promise made to you, and now overdue, is recorded against the other person.'
);
const harrington = work.find((r) => r.thread.id === 'thr-w-003');
assert(
  harrington!.analysis.commitments.some((c) => c.promisedByIsSelf),
  'A promise you made is recorded against you.'
);

/* --------------------------------------------------- 6. deadline grouping */

group('Deadline grouping');

const deadlineRecords = metricRecords(work, 'deadlines', NOW);
assert(
  deadlineRecords.every((r) => r.analysis.explicitDeadlines.length > 0),
  'The Deadlines count holds only threads with a date the sender wrote.'
);
assert(
  deadlineRecords.every((r) => r.nextStatedDeadline !== null),
  'Every counted thread has a stated deadline the person owns.'
);

const inferredOnly = work.filter(
  (r) => r.analysis.explicitDeadlines.length === 0 && r.analysis.suggestedDates.length > 0
);
assert(inferredOnly.length > 0, 'At least one thread has only an inferred date.');
assert(
  inferredOnly.every((r) => !deadlineRecords.some((d) => d.thread.id === r.thread.id)),
  'A thread with only a working guess is never counted as a deadline.'
);

const todaysWorkload = queueRecords(work, 'todays_workload', NOW);
assert(todaysWorkload.length > 0, "Today's Workload is not empty.");
for (const r of todaysWorkload) {
  const datedToday =
    r.nextStatedDeadline !== null &&
    r.nextStatedDeadline >= '2026-10-12T00:00:00+11:00' &&
    r.nextStatedDeadline <= '2026-10-12T23:59:59+11:00';
  assert(
    datedToday || r.analysis.priorityBand === 'immediate',
    `${r.thread.id} is on today because it is dated today or because it is immediate.`
  );
}

const deadlineOrder = todaysWorkload.map((r) => r.nextAnyDeadline).filter((d): d is string => d !== null);
for (let i = 1; i < deadlineOrder.length; i += 1) {
  assert(deadlineOrder[i - 1] <= deadlineOrder[i], "Today's Workload runs soonest first.");
}

/* --------------------------------------------------- 3. dashboard totals */

group('Dashboard totals agree with the pages behind them');

for (const account of ACCOUNTS) {
  const dataset = getDataset(account.id)!;
  const records = recordsFor(dataset);
  const dashboard = buildDashboard(dataset, NOW);

  for (const metric of dashboard.metrics) {
    const behind = metricRecords(records, metric.key, NOW);
    assert(
      metric.count === behind.length,
      `${account.id}: the ${metric.key} card equals the list it links to (${metric.count} vs ${behind.length}).`
    );
  }
  assert(dashboard.metrics.length === 8, `${account.id}: eight counts.`);
  assert(dashboard.queues.length === 5, `${account.id}: five queues.`);
}

const needsAttention = metricRecords(work, 'needs_attention', NOW);
assert(
  needsAttention.length === handleFirst.length,
  'Needs Attention and Handle First describe the same set, because they are the same promise.'
);

group('Counts are honest about what they measure');

for (const m of METRICS) {
  assert(m.explanation.trim().length > 0, `${m.key} says what it means.`);
  assert(
    !/time saved|hours saved|productivity|efficiency|score of your inbox/i.test(m.explanation),
    `${m.key} makes no claim about saved time or productivity.`
  );
}

const unprocessed = metricRecords(work, 'unprocessed', NOW);
assert(unprocessed.length === 2, 'Two work threads are not yet analysed.');
assert(
  unprocessed.every((r) => r.analysis.analysed === false),
  'The Unprocessed count holds only unanalysed threads.'
);
assert(
  unprocessed.every((r) => r.analysis.priorityScore === 0 && r.analysis.currentStatus === 'unclear'),
  'An unanalysed thread claims nothing: no score, no status, no summary.'
);
assert(
  unprocessed.every((r) => r.analysis.analysisVersionId === null),
  'An unanalysed thread has no analysis version, because no analysis was run.'
);

const quickWins = metricRecords(work, 'quick_wins', NOW);
assert(
  quickWins.every((r) => (r.analysis.estimatedEffortMinutes ?? 99) <= 2),
  'Quick Wins holds only threads estimated at two minutes or under.'
);
assert(quickWins.length > 0, 'There is at least one quick win.');
assert(
  quickWins.every((r) => r.analysis.securityAlert === null),
  'A security-flagged thread is never offered as a quick win, however little time it takes.'
);

group('Dates are shown in the account time zone, not the browser time zone');

const melbourneDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Melbourne' });
assert(
  melbourneDay('2026-10-12T09:12:00+11:00') === '12 Oct',
  'A 9:12am Melbourne deadline on the 12th renders as 12 Oct, not 11 Oct.'
);
assert(
  melbourneDay('2026-10-29T09:00:00+11:00') === '29 Oct',
  'A 9am Melbourne date on the 29th renders as 29 Oct.'
);

/* ------------------------------------------------ 2. filter combinations */

group('Filter combinations');

assert(
  applyFilter(work, {}).length < work.length,
  'The default filter excludes bulk, duplicates and resolved threads.'
);
assert(
  applyFilter(work, { includeBulk: true, includeDuplicates: true, includeResolved: true }).length ===
    work.length,
  'Asking for everything returns everything.'
);

const byStatus = applyFilter(work, { statuses: ['decision_required'] });
assert(byStatus.length > 0, 'Filtering by status returns something.');
assert(
  byStatus.every((r) => r.analysis.currentStatus === 'decision_required'),
  'Filtering by status returns only that status.'
);

const combined = applyFilter(work, {
  statuses: ['decision_required'],
  replyRequired: true,
  hasDeadline: 'stated',
});
assert(
  combined.every(
    (r) =>
      r.analysis.currentStatus === 'decision_required' &&
      r.analysis.replyRequired &&
      r.analysis.explicitDeadlines.length > 0
  ),
  'Three filters combine with AND, not OR.'
);
assert(
  combined.length <= byStatus.length,
  'Adding a filter never widens the result.'
);

const bySender = applyFilter(work, { sender: 'priya' });
assert(bySender.length === 1, 'A partial sender name matches one thread.');
assert(bySender[0].thread.id === 'thr-w-003', 'It matches the right thread.');
assert(
  applyFilter(work, { sender: 'PRIYA' }).length === 1,
  'Sender matching ignores case.'
);
assert(applyFilter(work, { sender: 'nobody-by-this-name' }).length === 0, 'An unmatched sender returns nothing.');

const unread = applyFilter(work, { isRead: false, includeBulk: true, includeDuplicates: true });
assert(unread.length > 0, 'Unread filtering returns something.');
assert(unread.every((r) => !r.thread.isRead), 'Unread filtering returns only unread threads.');

const withAttachment = applyFilter(work, { hasAttachment: true });
assert(withAttachment.length > 0, 'Attachment filtering returns something.');
assert(
  withAttachment.every((r) => r.analysis.attachments.some((a) => a.disposition === 'received')),
  'Attachment filtering means a file actually arrived.'
);

const awaiting = applyFilter(work, { awaitingAttachment: true });
assert(awaiting.length === 1, 'One thread is blocked waiting for a file to be sent.');
assert(awaiting[0].thread.id === 'thr-w-018', 'It is the signed variation thread.');

const impossible = applyFilter(work, { statuses: ['resolved'], securityFlagged: true });
assert(impossible.length === 0, 'A contradictory combination returns nothing rather than throwing.');

const narrow = applyFilter(work, { minPriorityScore: 70 });
assert(
  narrow.every((r) => r.analysis.priorityScore >= 70),
  'A minimum score filter is respected.'
);

/* ----------------------------------------------------- saved views */

group('Saved views');

const views = savedViews(NOW);
assert(views.length === 8, 'There are eight saved views.');
assert(
  new Set(views.map((v) => v.key)).size === 8,
  'Every saved view key is unique.'
);
for (const v of views) {
  assert(v.description.trim().length > 0, `${v.key} says what it shows.`);
  const got = runSavedView(work, v.key, NOW);
  assert(Array.isArray(got), `${v.key} runs without throwing.`);
}

assert(
  runSavedView(work, 'security_review', NOW).every((r) => r.analysis.securityAlert !== null),
  'Security Review shows only flagged threads.'
);
assert(
  runSavedView(work, 'needs_a_decision', NOW).every(
    (r) => r.analysis.currentStatus === 'decision_required'
  ),
  'Needs a Decision shows only threads blocked on a choice.'
);
assert(
  runSavedView(work, 'needs_an_attachment', NOW).every((r) => r.awaitingAttachment),
  'Needs an Attachment shows only threads waiting on a file.'
);
assert(
  runSavedView(work, 'unprocessed', NOW).every((r) => !r.analysis.analysed),
  'Unprocessed shows only unanalysed threads.'
);
assert(
  runSavedView(work, 'unprocessed', NOW).length === 2,
  'Unprocessed keeps its own inclusion rules when it runs.'
);
assert(
  runSavedView(work, 'handle_today', NOW).every((r) =>
    ['immediate', 'today'].includes(r.analysis.priorityBand)
  ),
  'Handle Today shows only the two urgent bands.'
);

const quickReplies = runSavedView(work, 'quick_replies', NOW);
assert(
  quickReplies.every((r) => r.analysis.replyRequired && r.analysis.draftStatus === 'available'),
  'Quick Replies shows only threads where a reply is owed and a draft is ready.'
);
const effort = quickReplies.map((r) => r.analysis.estimatedEffortMinutes ?? 9999);
for (let i = 1; i < effort.length; i += 1) {
  assert(effort[i - 1] <= effort[i], 'Quick Replies runs shortest first.');
}

assert(
  runSavedView(work, 'morning_review', NOW).every((r) => r.thread.accountId === 'acct-work-01'),
  'A saved view run against one account never reaches the other.'
);

const scoped = runSavedView(work, 'morning_review', NOW, { statuses: ['waiting_on_user'] });
assert(
  scoped.every((r) => r.analysis.currentStatus === 'waiting_on_user'),
  'Header state narrows a saved view rather than being ignored.'
);

/* ------------------------------------------- drafting and approval safety */

group('Drafting and approval');

for (const r of [...work, ...personal]) {
  const d = WORK_DATASET.drafts
    .concat(PERSONAL_DATASET.drafts)
    .find((x) => x.threadId === r.thread.id);
  assert(d !== undefined, `${r.thread.id} has a draft record.`);
  assert(d!.approval === null, `${r.thread.id}: no draft is approved, because nothing can approve one.`);
  if (d!.status === 'available') {
    assert((d!.body ?? '').length > 0, `${r.thread.id}: an available draft has text.`);
  } else {
    assert(d!.body === null, `${r.thread.id}: a withheld draft carries no text.`);
    assert((d!.statusReason ?? '').length > 0, `${r.thread.id}: a withheld draft says why.`);
  }
}

const sensitive = work.filter((r) => r.analysis.classification.sensitivity === 'sensitive');
assert(sensitive.length === 1, 'One thread is classified sensitive.');
assert(
  sensitive.every((r) => r.analysis.draftStatus === 'withheld_for_safety'),
  'Nothing is drafted on a sensitive thread.'
);

const allAudit = [...WORK_DATASET.auditEvents, ...PERSONAL_DATASET.auditEvents];
assert(allAudit.length > 0, 'An audit trail exists.');
assert(
  allAudit.every((e) => e.kind !== 'draft_written_to_mailbox' && e.kind !== 'approval_granted'),
  'Nothing has been written to a mailbox and nothing has been approved.'
);
assert(
  allAudit.every((e) => e.description.trim().length > 0 && e.actor.trim().length > 0),
  'Every audit event names an actor and says what happened.'
);

/* ------------------------------------------------- scenario coverage */

group('Scenario coverage');

const required: [string, (r: ThreadRecord) => boolean][] = [
  ['urgent customer issue', (r) => r.analysis.classification.category === 'customer_issue'],
  ['meeting confirmation', (r) => r.analysis.classification.category === 'meeting'],
  ['deadline buried in a long thread', (r) => r.thread.id === 'thr-w-003' && r.thread.messageIds.length >= 3],
  ['three unanswered questions', (r) => r.analysis.openQuestions.filter((q) => !q.answered).length >= 3],
  ['resolved thread', (r) => r.analysis.currentStatus === 'resolved'],
  ['invoice discrepancy', (r) => r.analysis.conflicts.length > 0],
  ['suspicious payment request', (r) => (r.analysis.securityAlert?.flags ?? []).includes('payment_details_changed')],
  ['newsletter', (r) => r.analysis.classification.category === 'newsletter'],
  ['delivery notification', (r) => r.analysis.classification.category === 'delivery'],
  ['waiting on another person', (r) => r.analysis.currentStatus === 'waiting_on_other'],
  ['acknowledgement', (r) => r.analysis.classification.category === 'acknowledgement'],
  ['sensitive employment matter', (r) => r.analysis.classification.category === 'employment'],
  ['prompt injection', (r) => r.messages.some((m) => m.injection?.detected === true)],
  ['missing information for a reply', (r) => r.thread.id === 'thr-w-014' && r.analysis.draftStatus === 'clarification_required'],
  ['duplicate notification', (r) => Boolean(r.thread.duplicateOf)],
  ['short but high consequence', (r) => r.thread.id === 'thr-w-017'],
  ['needs an attachment first', (r) => r.awaitingAttachment],
  ['unprocessed', (r) => !r.analysis.analysed],
];

for (const [label, predicate] of required) {
  assert(work.some(predicate), `The work inbox contains: ${label}.`);
}
assert(
  personal.some((r) => r.analysis.classification.category === 'personal'),
  'The personal inbox contains a personal email.'
);
assert(work.length === 19, 'The work inbox holds nineteen threads.');
assert(personal.length === 3, 'The personal inbox holds three threads.');

const short = work.find((r) => r.thread.id === 'thr-w-017')!;
assert(
  short.messages[0].body.split(/\s+/).length < 35,
  'The high consequence thread really is short.'
);
assert(
  short.analysis.priorityBand === 'today' || short.analysis.priorityBand === 'immediate',
  'A short message with a same-day deadline is not buried by its length.'
);

/* -------------------------------------------------- shell adapter */

group('The shell shows what the model computed');

const shellMetrics = syntheticMetrics('acct-work-01', 'ready', NOW);
assert(shellMetrics.length === 8, 'The shell renders eight cards.');
for (const m of shellMetrics) {
  const behind = metricRecords(work, m.key, NOW).length;
  assert(m.count === behind, `The ${m.key} card shows the computed count, not a typed one.`);
  assert(
    m.state === (behind === 0 ? 'empty' : 'ready'),
    `The ${m.key} card is in the state its count implies.`
  );
}

const errorCards = syntheticMetrics('acct-does-not-exist', 'ready', NOW);
assert(
  errorCards.every((m) => m.state === 'error' && m.count === null),
  'An unknown account shows an error on every card rather than eight zeroes.'
);

const shellPanels = syntheticPanels('acct-work-01', 'ready', NOW);
assert(shellPanels.length === 7, 'The shell renders seven panels.');
for (const p of shellPanels) {
  assert(
    p.items.every((i) => i.accountId === 'acct-work-01'),
    `${p.key} shows only the selected account.`
  );
  assert(
    p.state === (p.items.length === 0 ? 'empty' : 'ready'),
    `${p.key} is in the state its contents imply.`
  );
  assert(p.emptyMessage.trim().length > 0, `${p.key} has something to say when it is empty.`);
}

const personalPanels = syntheticPanels('acct-personal-01', 'ready', NOW);
assert(
  personalPanels.every((p) => p.items.every((i) => i.accountType === 'personal')),
  'Switching to the personal account shows no work thread.'
);

/* ------------------------------------------------------------- summary */

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre Stage 3 model: all checks passed.');
