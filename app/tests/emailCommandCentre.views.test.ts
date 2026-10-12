/**
 * Email Command Centre, Stage 4 view tests.
 *
 * These cover the selection rules behind the eight views: what each one holds,
 * how its filters combine, how dates are grouped and labelled, and the two
 * rules that are easy to break and expensive to break quietly, which are that a
 * high-consequence thread is never hidden for being quick, and that a suggested
 * date is never presented as a stated one.
 *
 * Rendering, keyboard and responsive behaviour are covered separately, in a
 * real browser, by tests/browser/emailCommandCentre.browser.test.mjs. A test
 * that asserts a component "renders" without a browser asserts very little.
 *
 * Run: bun app/tests/emailCommandCentre.views.test.ts
 */
import { WORK_DATASET, PERSONAL_DATASET, getDataset } from '../src/lib/email/data';
import { DEMO_NOW } from '../src/lib/email/data/clock';
import { recordsFor } from '../src/lib/email/filters';
import { withoutDeferred } from '../src/lib/email/localActions';
import { ITEM_ACTIONS } from '../src/lib/email/localActions';
import {
  needsAttentionItems,
  replyQueueItems,
  REPLY_FILTERS,
  datedItems,
  groupDatedItems,
  groupForDate,
  DEADLINE_GROUP_ORDER,
  DATE_ORIGIN_LABEL,
  waitingItems,
  quickWinItems,
  QUICK_WIN_LABEL,
  classifyQuickWin,
  allEmailRecords,
  sortAllEmail,
  paginate,
  ALL_EMAIL_COLUMNS,
  draftItems,
  securityItems,
  SECURITY_CATEGORIES,
  SECURITY_DISCLAIMER,
  ageInDays,
} from '../src/lib/email/views';

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

const NOW = DEMO_NOW;
const work = recordsFor(WORK_DATASET);
const personal = recordsFor(PERSONAL_DATASET);
const drafts = WORK_DATASET.drafts;

/* ===================================================== 1. Needs Attention */

group('Needs Attention shows everything a decision needs');

const na = needsAttentionItems(work, 'Work', NOW);
assert(na.length > 0, 'Needs Attention is not empty.');

for (const item of na) {
  assert(item.sender.trim().length > 0, `${item.threadId}: a sender is shown.`);
  assert(item.subject.trim().length > 0, `${item.threadId}: a subject is shown.`);
  assert(item.accountLabel.trim().length > 0, `${item.threadId}: an account badge is shown.`);
  assert(item.summary.trim().length > 0, `${item.threadId}: a one-line summary is shown.`);
  assert(item.whyItMatters.trim().length > 0, `${item.threadId}: why it matters is shown.`);
  assert(item.priorityBand.trim().length > 0, `${item.threadId}: a priority band is shown.`);
  assert(item.priorityReasons.length > 0, `${item.threadId}: priority reasons are shown.`);
  assert(item.status.trim().length > 0, `${item.threadId}: a status is shown.`);
  assert(item.recommendedNextStep.trim().length > 0, `${item.threadId}: a next step is shown.`);
  assert(
    ['available', 'clarification_required', 'withheld_for_safety'].includes(item.draftStatus),
    `${item.threadId}: draft availability is shown.`
  );
  assert(['high', 'medium', 'low'].includes(item.confidence), `${item.threadId}: confidence is shown.`);
  assert(item.attachmentCount >= 0, `${item.threadId}: an attachment count is shown.`);
}

const flaggedCard = na.find((i) => i.threadId === 'thr-w-007');
assert(flaggedCard !== undefined, 'The suspected payment attack appears in Needs Attention.');
assert(flaggedCard!.warning?.kind === 'security', 'It carries a security warning.');
assert(
  (flaggedCard!.warning?.text ?? '').length > 40,
  'The warning explains itself rather than showing a code.'
);

const naDeadlines = na.filter((i) => i.deadline !== null);
for (const item of naDeadlines) {
  assert(
    item.deadline!.consequence.trim().length > 0,
    `${item.threadId}: a date is shown with what happens if it passes.`
  );
}

group('Deferring removes a thread from the working queues, not from the record');

const deferred = ['thr-w-007'];
const afterDefer = needsAttentionItems(withoutDeferred(work, deferred), 'Work', NOW);
assert(
  !afterDefer.some((i) => i.threadId === 'thr-w-007'),
  'A deferred thread leaves Needs Attention.'
);
assert(
  afterDefer.length === na.length - 1,
  'Deferring removes exactly one thread, not a category of them.'
);
assert(
  allEmailRecords(WORK_DATASET, {}, { key: 'priority', direction: 'desc' }).some(
    (r) => r.thread.id === 'thr-w-007'
  ),
  'A deferred thread is still findable in All Email. Nothing is taken from the person.'
);

group('Every item action says what it does, and none of them reach outside');

assert(ITEM_ACTIONS.length === 8, 'There are eight actions.');
for (const action of ITEM_ACTIONS) {
  assert(action.label.trim().length > 0, `${action.kind} has a label.`);
  assert(action.effect.trim().length > 0, `${action.kind} says what it does.`);
}
assert(
  ITEM_ACTIONS.filter((a) => a.mutatesSession).every((a) => /nothing is saved|No task is created|copy/i.test(a.effect)),
  'Every action that changes something says plainly that nothing is saved.'
);
assert(
  !ITEM_ACTIONS.some((a) => /\bsend\b|\barchive\b|\bdelete\b|\bfile it\b/i.test(a.label)),
  'No action sends, archives, deletes or files.'
);

/* ========================================================= 2. Reply Queue */

group('Reply Queue filters');

assert(REPLY_FILTERS.length === 9, 'There are nine reply filters.');
assert(
  new Set(REPLY_FILTERS.map((f) => f.key)).size === 9,
  'Every reply filter key is unique.'
);
for (const f of REPLY_FILTERS) {
  assert(f.description.trim().length > 0, `${f.key} says what it selects.`);
}

const allReplies = replyQueueItems(work, drafts, NOW);
assert(allReplies.length > 0, 'The reply queue is not empty.');

for (const f of REPLY_FILTERS) {
  const got = replyQueueItems(work, drafts, NOW, [f.key]);
  assert(got.length <= allReplies.length, `${f.key} narrows rather than widens.`);
  assert(got.every((i) => f.match(i.record, NOW)), `${f.key} returns only what it selects.`);
}

const two = replyQueueItems(work, drafts, NOW, ['needs_decision', 'draft_ready']);
const justDecision = replyQueueItems(work, drafts, NOW, ['needs_decision']);
assert(two.length <= justDecision.length, 'Two filters together narrow further than one.');
assert(
  two.every(
    (i) =>
      i.record.analysis.draftStatus === 'available' &&
      (i.record.analysis.decisionsRequired.length > 0 ||
        i.record.analysis.currentStatus === 'decision_required')
  ),
  'Two filters combine with AND, not OR.'
);

const impossible = replyQueueItems(work, drafts, NOW, ['draft_ready', 'draft_withheld']);
assert(impossible.length === 0, 'A contradictory pair returns nothing rather than throwing.');

group('Reply Queue shows what the sender wants and what the draft commits you to');

for (const item of allReplies) {
  assert(item.senderRequest.trim().length > 0, `${item.record.thread.id}: what the sender wants is shown.`);
  assert(['high', 'medium', 'low'].includes(item.confidence), 'Confidence is shown.');
}

const withDraft = allReplies.filter((i) => i.draftBody !== null);
assert(withDraft.length > 0, 'At least one reply has a draft ready.');
for (const item of withDraft) {
  assert(item.recipients.length > 0, `${item.record.thread.id}: a ready draft names its recipients.`);
  assert(
    item.commitmentsInDraft.length > 0,
    `${item.record.thread.id}: a ready draft lists what it commits you to.`
  );
}

const blocked = allReplies.filter((i) => i.draftBody === null);
for (const item of blocked) {
  assert(
    item.missingInformation.length > 0 || item.draft?.statusReason !== null,
    `${item.record.thread.id}: a thread with no draft says what is missing or why.`
  );
}

const needsFile = allReplies.find((i) => i.record.thread.id === 'thr-w-018');
assert(needsFile !== undefined, 'The signed variation thread is in the reply queue.');
assert(
  (needsFile!.attachmentReminder ?? '').length > 0,
  'It carries an attachment reminder, because a reply without the file is no use.'
);

group('Draft styles are three written drafts, not one with the adjectives changed');

for (const style of ['concise', 'warm', 'detailed'] as const) {
  const items = replyQueueItems(work, drafts, NOW, ['draft_ready'], style);
  assert(items.length > 0, `The ${style} style returns drafts.`);
  for (const item of items) {
    assert((item.draftBody ?? '').length > 0, `${item.record.thread.id}: the ${style} draft has text.`);
  }
}

const concise = replyQueueItems(work, drafts, NOW, ['draft_ready'], 'concise');
const detailed = replyQueueItems(work, drafts, NOW, ['draft_ready'], 'detailed');
for (let i = 0; i < concise.length; i += 1) {
  assert(
    concise[i].draftBody !== detailed[i].draftBody,
    `${concise[i].record.thread.id}: the concise and detailed drafts are genuinely different text.`
  );
  assert(
    (detailed[i].draftBody ?? '').length > (concise[i].draftBody ?? '').length,
    `${concise[i].record.thread.id}: the detailed draft is the longer of the two.`
  );
}

group('Sensitive and flagged threads are never drafted, in any style');

for (const style of ['concise', 'warm', 'detailed'] as const) {
  const items = replyQueueItems(work, drafts, NOW, [], style);
  assert(
    items.filter((i) => i.sensitive).every((i) => i.draftBody === null),
    `No sensitive thread has a ${style} draft.`
  );
  assert(
    items.filter((i) => i.record.analysis.securityAlert !== null).every((i) => i.draftBody === null),
    `No flagged thread has a ${style} draft.`
  );
}

/* ================================================== 3. Actions & Deadlines */

group('Deadline grouping');

assert(DEADLINE_GROUP_ORDER.length === 6, 'Five time groups plus the undated group.');
assert(
  groupForDate('2026-10-11T09:00:00+11:00', NOW) === 'overdue',
  'Yesterday is overdue.'
);
assert(groupForDate('2026-10-12T17:00:00+11:00', NOW) === 'today', 'Later today is today.');
assert(groupForDate('2026-10-13T09:00:00+11:00', NOW) === 'tomorrow', 'Tomorrow is tomorrow.');
assert(groupForDate('2026-10-16T17:00:00+11:00', NOW) === 'this_week', 'Friday is this week.');
assert(groupForDate('2026-10-29T09:00:00+11:00', NOW) === 'later', 'Late October is later.');
assert(groupForDate(null, NOW) === 'undated', 'No date means the undated group.');

const dated = datedItems(work, NOW);
assert(dated.length > 0, 'There are dated items.');

const grouped = groupDatedItems(dated);
assert(grouped.length === 6, 'All six groups are returned, empty ones included.');
assert(
  grouped.map((g) => g.key).join(',') === DEADLINE_GROUP_ORDER.join(','),
  'The groups come back in the order they are read in.'
);
assert(
  grouped.reduce((n, g) => n + g.items.length, 0) === dated.length,
  'Grouping loses nothing.'
);

for (const g of grouped) {
  for (let i = 1; i < g.items.length; i += 1) {
    const a = g.items[i - 1].dueAt;
    const b = g.items[i].dueAt;
    if (a && b) assert(a <= b, `${g.key} runs soonest first.`);
  }
}

group('The three date origins are distinguished');

const origins = new Set(dated.map((d) => d.origin));
assert(origins.has('explicit_email'), 'Dates stated in an email are present.');
assert(origins.has('suggested'), 'Suggested dates are present.');
assert(
  DATE_ORIGIN_LABEL.suggested === 'Suggested date, confirm',
  'A suggested date says "Suggested date, confirm" in words, not only by colour.'
);
assert(DATE_ORIGIN_LABEL.explicit_email === 'Stated in the email', 'A stated date says so.');
assert(DATE_ORIGIN_LABEL.user_created === 'Added by you', 'A date the person set says so.');

for (const item of dated.filter((d) => d.origin === 'suggested')) {
  const record = work.find((r) => r.thread.id === item.threadId)!;
  assert(
    record.analysis.suggestedDates.some((d) => d.id === item.id),
    `${item.id}: a suggested date comes from the suggested list, never from the stated one.`
  );
}
for (const item of dated.filter((d) => d.origin === 'explicit_email' && d.dueAt)) {
  const record = work.find((r) => r.thread.id === item.threadId)!;
  const fromDeadlines = record.analysis.explicitDeadlines.some((d) => d.id === item.id);
  const fromActions = record.analysis.actions.some((a) => a.id === item.id);
  assert(
    fromDeadlines || fromActions,
    `${item.id}: a stated date comes from the thread, not from an inference.`
  );
}

group('A date the person adds in session appears as theirs');

const withUserDate = datedItems(work, NOW, [
  { id: 'usr-1', threadId: 'thr-w-004', description: 'Ring Dan about the regional offices', dueAt: '2026-10-13T10:00:00+11:00' },
]);
const mine = withUserDate.find((d) => d.id === 'usr-1');
assert(mine !== undefined, 'A user-created date appears.');
assert(mine!.origin === 'user_created', 'It is labelled as the person’s own.');
assert(mine!.group === 'tomorrow', 'It is grouped by its date like any other.');
assert(
  withUserDate.length === dated.length + 1,
  'Adding a date adds one item and changes nothing else.'
);

/* ============================================================= 4. Waiting */

group('Waiting');

const waiting = waitingItems(work, NOW);
assert(waiting.length > 0, 'Something is waiting on someone else.');

for (const item of waiting) {
  assert(item.waitingOn.trim().length > 0, `${item.threadId}: who is being waited on is named.`);
  assert(item.outstandingItem.trim().length > 0, `${item.threadId}: the outstanding item is shown.`);
  assert(item.lastMeaningfulMessageAt.length > 0, `${item.threadId}: the last meaningful message is dated.`);
  assert(item.threadAgeDays >= 0, `${item.threadId}: thread age is shown and never negative.`);
  assert(
    ['high', 'medium', 'low'].includes(item.ownershipConfidence),
    `${item.threadId}: ownership confidence is shown.`
  );
  assert(
    item.ownershipBasis.trim().length > 0,
    `${item.threadId}: ownership confidence carries its evidence rather than being asserted.`
  );
  assert(
    ['none_sent', 'overdue', 'awaiting_their_date'].includes(item.followUpStatus),
    `${item.threadId}: follow-up status is shown.`
  );
}

const belmont = waiting.find((w) => w.threadId === 'thr-w-010');
assert(belmont !== undefined, 'The Belmont quote is in Waiting.');
assert(belmont!.expectedAt !== null, 'It carries the date they actually gave.');
assert(belmont!.followUpStatus === 'overdue', 'That date has passed, and it says so.');
assert(belmont!.ownershipConfidence === 'high', 'They put it in writing, so confidence is high.');
assert(
  belmont!.ownershipBasis.includes('They wrote'),
  'High confidence quotes what they wrote.'
);
assert(
  belmont!.suggestedFollowUpAt !== null,
  'A follow-up date is suggested, and it is labelled as a suggestion wherever it is shown.'
);

assert(ageInDays('2026-10-05T11:02:00+11:00', NOW) === 6, 'Thread age counts whole days.');
assert(ageInDays(NOW, NOW) === 0, 'A thread started now is zero days old, not negative.');

/* ========================================================== 5. Quick Wins */

group('Quick Wins uses neutral labels');

assert(Object.keys(QUICK_WIN_LABEL).length === 4, 'There are four labels.');
assert(QUICK_WIN_LABEL.short_response === 'Short response', 'Short response.');
assert(QUICK_WIN_LABEL.simple_confirmation === 'Simple confirmation', 'Simple confirmation.');
assert(QUICK_WIN_LABEL.no_action_detected === 'No action detected', 'No action detected.');
assert(
  QUICK_WIN_LABEL.possible_archive_candidate === 'Possible archive candidate',
  'Possible archive candidate.'
);
assert(
  !Object.values(QUICK_WIN_LABEL).some((l) => /junk|spam|ignore|delete|unimportant|trash/i.test(l)),
  'No label tells a person to discard their own correspondence.'
);

const quick = quickWinItems(work, NOW);
assert(quick.length > 0, 'Quick Wins is not empty.');
for (const item of quick) {
  assert(item.labelReason.trim().length > 0, `${item.record.thread.id}: the label says why it applies.`);
  assert(item.label in QUICK_WIN_LABEL, `${item.record.thread.id}: the label is one of the four.`);
}

group('A high-consequence thread is never hidden for being quick');

// The client outage: five minutes to acknowledge, and the most consequential
// thread in the inbox. Exactly the case the brief's rule exists for.
const outage = quick.find((q) => q.record.thread.id === 'thr-w-001');
assert(outage !== undefined, 'The client outage is in Quick Wins despite being high consequence.');
assert(outage!.highConsequence, 'It is marked as high consequence.');
assert(
  (outage!.estimatedMinutes ?? 0) > 2,
  'It is above the two minute line, so only the high-consequence rule keeps it here.'
);
assert(quick[0].highConsequence, 'High-consequence threads sort to the top.');

// The renewal terms thread is high consequence but takes forty minutes. It is
// correctly NOT a quick win, and it is not hidden either: it leads Needs
// Attention and Today's Workload.
const tender = quick.find((q) => q.record.thread.id === 'thr-w-017');
assert(tender === undefined, 'A forty minute job is not called a quick win.');
assert(
  na.some((i) => i.threadId === 'thr-w-017'),
  'It is surfaced in Needs Attention instead, so nothing is lost by keeping Quick Wins honest.'
);

const highFirst = quick.findIndex((q) => !q.highConsequence);
if (highFirst > -1) {
  assert(
    quick.slice(highFirst).every((q) => !q.highConsequence),
    'High-consequence threads are not interleaved with the rest.'
  );
}

assert(
  quick.every((q) => q.record.analysis.securityAlert === null),
  'A security-flagged thread is never offered as a quick win, however little time it takes.'
);

const newsletter = work.find((r) => r.thread.id === 'thr-w-008')!;
assert(
  classifyQuickWin(newsletter).label === 'no_action_detected',
  'A newsletter is labelled as no action detected, not as junk.'
);
const resolvedThread = work.find((r) => r.thread.id === 'thr-w-005')!;
assert(
  classifyQuickWin(resolvedThread).label === 'possible_archive_candidate',
  'A closed thread is a possible archive candidate, and the choice stays the person’s.'
);

/* =========================================================== 6. All Email */

group('All Email includes everything, then narrows');

const everything = allEmailRecords(WORK_DATASET, {}, { key: 'priority', direction: 'desc' });
assert(everything.length === work.length, 'All Email starts from every thread on the account.');
assert(
  everything.some((r) => r.analysis.classification.isBulk),
  'Bulk mail is findable here.'
);
assert(everything.some((r) => r.thread.duplicateOf), 'A duplicate is findable here.');
assert(
  everything.some((r) => r.analysis.currentStatus === 'resolved'),
  'A resolved thread is findable here.'
);

const searched = allEmailRecords(WORK_DATASET, { search: 'harrington' }, { key: 'priority', direction: 'desc' });
assert(searched.length === 1, 'Search narrows to one thread.');
assert(searched[0].thread.id === 'thr-w-003', 'It finds the right one.');
assert(
  allEmailRecords(WORK_DATASET, { search: 'HARRINGTON' }, { key: 'priority', direction: 'desc' }).length === 1,
  'Search ignores case.'
);
assert(
  allEmailRecords(WORK_DATASET, { search: 'zzzz-nothing' }, { key: 'priority', direction: 'desc' }).length === 0,
  'A search with no match returns nothing rather than everything.'
);

group('Sorting');

assert(ALL_EMAIL_COLUMNS.length === 6, 'Six sortable columns.');
for (const column of ALL_EMAIL_COLUMNS) {
  for (const direction of ['asc', 'desc'] as const) {
    const sorted = sortAllEmail(everything, { key: column.key, direction });
    assert(sorted.length === everything.length, `Sorting by ${column.key} ${direction} loses nothing.`);
  }
}

const byPriority = sortAllEmail(everything, { key: 'priority', direction: 'desc' });
for (let i = 1; i < byPriority.length; i += 1) {
  assert(
    byPriority[i - 1].analysis.priorityScore >= byPriority[i].analysis.priorityScore,
    'Priority descending runs highest first.'
  );
}

const bySubject = sortAllEmail(everything, { key: 'subject', direction: 'asc' });
for (let i = 1; i < bySubject.length; i += 1) {
  assert(
    bySubject[i - 1].thread.subject.localeCompare(bySubject[i].thread.subject, 'en-AU') <= 0,
    'Subject ascending is alphabetical.'
  );
}

const byDeadline = sortAllEmail(everything, { key: 'deadline', direction: 'asc' });
const firstUndated = byDeadline.findIndex((r) => r.nextAnyDeadline === null);
if (firstUndated > -1) {
  assert(
    byDeadline.slice(firstUndated).every((r) => r.nextAnyDeadline === null),
    'Undated threads sort last, so a person sorting by deadline sees the dated ones in order.'
  );
}
const byDeadlineDesc = sortAllEmail(everything, { key: 'deadline', direction: 'desc' });
const firstUndatedDesc = byDeadlineDesc.findIndex((r) => r.nextAnyDeadline === null);
if (firstUndatedDesc > -1) {
  assert(
    byDeadlineDesc.slice(firstUndatedDesc).every((r) => r.nextAnyDeadline === null),
    'Undated threads sort last in both directions.'
  );
}

group('Pagination');

const page0 = paginate(everything, 0, 10);
assert(page0.items.length === 10, 'A full page holds the page size.');
assert(page0.from === 1 && page0.to === 10, 'The showing line counts from one.');
assert(page0.totalPages === Math.ceil(everything.length / 10), 'Page count is right.');

const lastPage = paginate(everything, page0.totalPages - 1, 10);
assert(lastPage.to === everything.length, 'The last page ends at the last item.');

const overshoot = paginate(everything, 99, 10);
assert(overshoot.pageIndex === page0.totalPages - 1, 'An out-of-range page clamps to the last one.');
const undershoot = paginate(everything, -5, 10);
assert(undershoot.pageIndex === 0, 'A negative page clamps to the first one.');

const emptyPage = paginate([], 0, 10);
assert(
  emptyPage.totalPages === 1 && emptyPage.from === 0 && emptyPage.to === 0,
  'An empty list is one empty page, not zero pages.'
);

const seen = new Set<string>();
for (let i = 0; i < page0.totalPages; i += 1) {
  for (const r of paginate(everything, i, 10).items) {
    assert(!seen.has(r.thread.id), 'No thread appears on two pages.');
    seen.add(r.thread.id);
  }
}
assert(seen.size === everything.length, 'Every thread appears on exactly one page.');

group('All Email never reaches the other account');

const personalAll = allEmailRecords(PERSONAL_DATASET, {}, { key: 'priority', direction: 'desc' });
assert(personalAll.length === personal.length, 'The personal account shows its own threads.');
assert(
  personalAll.every((r) => r.thread.accountType === 'personal'),
  'No work thread appears in the personal account.'
);
assert(
  everything.every((r) => r.thread.accountType === 'work'),
  'No personal thread appears in the work account.'
);

/* ============================================================== 7. Drafts */

group('Drafts');

const allDrafts = draftItems(work, drafts, 'concise');
assert(allDrafts.length > 0, 'There are drafts to show.');

const order = allDrafts.map((d) => d.draft.status);
const firstNotReady = order.findIndex((s) => s !== 'available');
if (firstNotReady > -1) {
  assert(
    order.slice(firstNotReady).every((s) => s !== 'available'),
    'Drafts ready for review come first.'
  );
}

for (const item of allDrafts) {
  if (item.draft.status === 'available') {
    assert((item.bodyForStyle ?? '').length > 0, `${item.draft.id}: a ready draft has text.`);
    assert(item.draft.recipients.length > 0, `${item.draft.id}: a ready draft names its recipients.`);
  } else {
    assert(item.bodyForStyle === null, `${item.draft.id}: a draft that is not ready carries no text.`);
    assert(
      (item.draft.statusReason ?? '').length > 0,
      `${item.draft.id}: a draft that is not ready says why.`
    );
  }
  assert(item.draft.approval === null, `${item.draft.id}: nothing is approved.`);
}

const onlyWithheld = draftItems(work, drafts, 'concise', ['withheld_for_safety']);
assert(onlyWithheld.length > 0, 'Filtering by withheld returns something.');
assert(
  onlyWithheld.every((d) => d.draft.status === 'withheld_for_safety'),
  'Filtering by status returns only that status.'
);
assert(
  onlyWithheld.every((d) => d.bodyForStyle === null),
  'A withheld draft carries no text in any filter.'
);

/* ===================================================== 8. Security Review */

group('Security Review');

assert(
  SECURITY_DISCLAIMER ===
    'Automated detection can assist review but cannot guarantee that an email is safe or malicious.',
  'The disclaimer is the exact wording required.'
);
assert(SECURITY_CATEGORIES.length === 9, 'Nine warning categories.');
assert(
  new Set(SECURITY_CATEGORIES.map((c) => c.flag)).size === 9,
  'Every category maps to a distinct flag.'
);
for (const c of SECURITY_CATEGORIES) {
  assert(c.meaning.trim().length > 0, `${c.label} explains what it means.`);
}

const expected = [
  'Unexpected payment',
  'Bank-detail change',
  'Password or login request',
  'Look-alike domain',
  'Urgent secrecy',
  'Suspicious attachment',
  'Prompt injection',
  'Unusual recipient change',
  'Sensitive-data request',
];
for (const label of expected) {
  assert(
    SECURITY_CATEGORIES.some((c) => c.label === label),
    `The brief's category "${label}" is present.`
  );
}

const security = securityItems(work);
assert(security.length === 2, 'Two threads are flagged.');
for (const item of security) {
  assert(item.categories.length > 0, `${item.record.thread.id}: at least one category is shown.`);
  assert(item.explanation.trim().length > 0, `${item.record.thread.id}: the warning explains itself.`);
  assert(
    item.recommendedCheck.trim().length > 0,
    `${item.record.thread.id}: a check the person can actually perform is named.`
  );
  assert(
    item.categories.every((c) => item.record.analysis.securityAlert!.flags.includes(c.flag)),
    `${item.record.thread.id}: every category shown was actually detected.`
  );
  assert(
    item.record.analysis.draftStatus === 'withheld_for_safety',
    `${item.record.thread.id}: no draft exists for a flagged thread.`
  );
}
assert(security[0].severity === 'high', 'The highest severity sorts first.');

const payment = security.find((i) => i.record.thread.id === 'thr-w-007')!;
assert(
  payment.categories.some((c) => c.label === 'Bank-detail change'),
  'The payment thread shows a bank-detail change.'
);
assert(
  payment.categories.some((c) => c.label === 'Unexpected payment'),
  'It also shows an unexpected payment.'
);

const injection = security.find((i) => i.record.thread.id === 'thr-w-013')!;
assert(
  injection.categories.some((c) => c.label === 'Prompt injection'),
  'The injection thread shows prompt injection.'
);
assert(
  injection.categories.some((c) => c.label === 'Sensitive-data request'),
  'It also shows a sensitive-data request.'
);

group('Security Review is separate from the priority views');

const naIds = new Set(na.map((i) => i.threadId));
assert(
  security.every((s) => naIds.has(s.record.thread.id)),
  'A flagged thread is still surfaced, not hidden.'
);
assert(
  replyQueueItems(work, drafts, NOW).every((i) => i.record.analysis.securityAlert === null),
  'A flagged thread never enters the Reply Queue.'
);
assert(
  quick.every((q) => q.record.analysis.securityAlert === null),
  'A flagged thread never enters Quick Wins.'
);

/* ------------------------------------------------- empty and error states */

group('Empty and error states are reachable and distinct');

assert(needsAttentionItems([], 'Work', NOW).length === 0, 'An empty record set gives an empty view.');
assert(replyQueueItems([], [], NOW).length === 0, 'An empty reply queue is empty, not an error.');
assert(waitingItems([], NOW).length === 0, 'An empty waiting view is empty.');
assert(quickWinItems([], NOW).length === 0, 'An empty quick wins view is empty.');
assert(securityItems([]).length === 0, 'An empty security view is empty.');
assert(groupDatedItems(datedItems([], NOW)).every((g) => g.items.length === 0), 'Empty groups stay empty.');
assert(getDataset('acct-nope') === null, 'An unknown account is null, which the views turn into an error.');

/* ------------------------------------------------------------- summary */

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre Stage 4 views: all checks passed.');
