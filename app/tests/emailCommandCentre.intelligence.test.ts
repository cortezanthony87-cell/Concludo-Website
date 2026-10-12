/**
 * Email Command Centre, Stage 5 tests.
 *
 * The approval rule is the reason this file exists. An approval that survives
 * an edit is the single worst defect this module could ship, because it would
 * let text a person never read go out under their name. Most of what follows
 * tries to make that happen and checks that it cannot.
 *
 * Keyboard and layout behaviour are covered in the browser suite, which runs
 * against a real browser.
 *
 * Run: bun app/tests/emailCommandCentre.intelligence.test.ts
 */
import { WORK_DATASET, PERSONAL_DATASET, getDataset } from '../src/lib/email/data';
import { DEMO_NOW } from '../src/lib/email/data/clock';
import {
  INTELLIGENCE_TABS,
  locateSource,
  locationsFor,
  overviewEvidence,
  tabCounts,
  threadDetail,
  threadListFor,
} from '../src/lib/email/threadIntelligence';
import {
  APPROVAL_FIELD_LABEL,
  DRAFT_ACTIONS,
  SAFETY_STATEMENTS,
  approvalStatus,
  changedFields,
  createApproval,
  figuresInDraft,
  fingerprintOf,
  DraftFingerprintInput,
} from '../src/lib/email/draftReview';
import { seedFromReplyDraft } from '../src/lib/email/draftSession';
import { EMAIL_DETAIL_ROUTES } from '../src/pages/email/emailRouteTable';

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

/* ============================================= 1. the workspace loads */

group('The workspace loads one thread from one account');

const outage = threadDetail(WORK_DATASET, 'thr-w-001');
assert(outage !== null, 'A work thread loads from the work dataset.');
assert(outage!.messages.length === 2, 'It carries its messages.');
assert(outage!.accountLabel === 'Work', 'It names the account it came from.');

assert(INTELLIGENCE_TABS.length === 8, 'There are eight intelligence tabs.');
assert(
  new Set(INTELLIGENCE_TABS.map((t) => t.key)).size === 8,
  'Every tab key is unique.'
);
const expectedTabs = ['overview', 'actions', 'decisions', 'deadlines', 'questions', 'attachments', 'draft', 'risks'];
for (const key of expectedTabs) {
  assert(INTELLIGENCE_TABS.some((t) => t.key === key), `The "${key}" tab exists.`);
}

const counts = tabCounts(outage!.analysis);
assert(counts.actions === outage!.analysis.actions.length, 'The Actions badge equals the actions.');
assert(
  counts.deadlines ===
    outage!.analysis.explicitDeadlines.length + outage!.analysis.suggestedDates.length,
  'The Deadlines badge counts stated and suggested dates together.'
);
assert(
  counts.risks === outage!.analysis.risks.length + (outage!.analysis.securityAlert ? 1 : 0),
  'The Risks badge includes a security advisory.'
);

/* ======================================== 9. account isolation */

group('Account isolation');

assert(
  threadDetail(PERSONAL_DATASET, 'thr-w-001') === null,
  'A work thread is not found in the personal dataset.'
);
assert(
  threadDetail(WORK_DATASET, 'thr-p-001') === null,
  'A personal thread is not found in the work dataset.'
);
assert(threadDetail(null, 'thr-w-001') === null, 'No dataset means no thread, not a fallback.');
assert(
  threadDetail(WORK_DATASET, 'thr-does-not-exist') === null,
  'An unknown thread id returns null rather than the nearest match.'
);
assert(
  getDataset('acct-nope') === null,
  'An unknown account returns null, which the workspace turns into an error.'
);

const workList = threadListFor(WORK_DATASET);
const personalList = threadListFor(PERSONAL_DATASET);
assert(
  workList.every((r) => r.thread.accountId === 'acct-work-01'),
  'The thread list holds only the account it was asked for.'
);
assert(
  personalList.every((r) => r.thread.accountId === 'acct-personal-01'),
  'The personal list holds only personal threads.'
);
assert(
  workList.every((w) => !personalList.some((p) => p.thread.id === w.thread.id)),
  'No thread appears in both lists.'
);

/* ============================================= 1. source navigation */

group('Source navigation');

const harrington = threadDetail(WORK_DATASET, 'thr-w-003')!;
assert(harrington.extractions.length > 0, 'The thread has selectable extractions.');

let located = 0;
let withQuote = 0;
for (const extraction of harrington.extractions) {
  const places = locationsFor(harrington.messages, extraction);
  assert(places.length > 0, `${extraction.id} resolves to at least one message.`);
  for (const place of places) {
    located += 1;
    assert(
      harrington.messages.some((m) => m.id === place.messageId),
      `${extraction.id} points at a message that exists in this thread.`
    );
    if (place.quote !== null && place.index !== null) {
      withQuote += 1;
      const message = harrington.messages.find((m) => m.id === place.messageId)!;
      assert(
        message.body.slice(place.index, place.index + place.quote.length) === place.quote,
        `${extraction.id}: the highlighted range really is the quoted text.`
      );
    }
  }
}
assert(located > 5, `Enough sources resolved to be meaningful (${located}).`);
assert(withQuote > 3, `Several resolved to exact words, not just a message (${withQuote}).`);

group('Across every thread on both accounts');

// The real invariant is completeness, not a threshold: every source reference
// recorded anywhere in the dataset must resolve to a message, and every quote
// must be findable in that message's body.
let totalRefs = 0;
let allResolved = 0;
let notFound = 0;
for (const dataset of [WORK_DATASET, PERSONAL_DATASET]) {
  for (const thread of dataset.threads) {
    const detail = threadDetail(dataset, thread.id)!;
    for (const extraction of detail.extractions) {
      totalRefs += extraction.source.length;
      for (const place of locationsFor(detail.messages, extraction)) {
        allResolved += 1;
        if (place.quoteNotFound) notFound += 1;
      }
    }
  }
}
assert(totalRefs > 30, `There are enough source references to be meaningful (${totalRefs}).`);
assert(
  allResolved === totalRefs,
  `Every source reference resolves to a message (${allResolved} of ${totalRefs}).`
);
assert(
  notFound === 0,
  `Every recorded quote is findable in its message body (${notFound} could not be located).`
);

group('A quote is never matched inside quoted history');

const withHistory = WORK_DATASET.messages.filter((m) => m.quotedHistory);
assert(withHistory.length >= 4, 'The dataset has messages carrying quoted history.');

for (const message of withHistory) {
  const historyPhrase = (message.quotedHistory ?? '')
    .split('\n')
    .map((l) => l.replace(/^>\s?/, '').trim())
    .find((l) => l.length > 25);
  if (!historyPhrase) continue;
  const found = locateSource(WORK_DATASET.messages, {
    threadId: message.threadId,
    messageId: message.id,
    quote: historyPhrase,
  });
  assert(
    found !== null && found.index === null && found.quoteNotFound,
    `${message.id}: text that appears only in the quoted history is not located in the body.`
  );
}

group('A missing quote is reported, never silently ignored');

const missing = locateSource(harrington.messages, {
  threadId: 'thr-w-003',
  messageId: 'msg-w-003-3',
  quote: 'these words were never written in this message',
});
assert(missing !== null, 'The message is still found.');
assert(missing!.quoteNotFound, 'The failure to locate the words is reported.');
assert(missing!.index === null, 'No range is returned for a quote that was not found.');

assert(
  locateSource(harrington.messages, {
    threadId: 'thr-w-003',
    messageId: 'msg-does-not-exist',
    quote: 'anything',
  }) === null,
  'A reference to a message outside the thread resolves to nothing.'
);

/* ============================================ overview separation */

group('Facts, inferences and unknowns are kept apart');

for (const dataset of [WORK_DATASET, PERSONAL_DATASET]) {
  for (const analysis of dataset.analyses) {
    const e = overviewEvidence(analysis);
    const factIds = new Set(e.facts.map((f) => f.id));
    assert(
      e.inferences.every((i) => !factIds.has(i.id)),
      `${analysis.threadId}: nothing is both a fact and an inference.`
    );
    for (const inference of e.inferences) {
      const suggested = analysis.suggestedDates.some((d) => d.id === inference.id);
      const other = [...analysis.actions, ...analysis.decisionsRequired, ...analysis.decisionsMade, ...analysis.commitments].some(
        (x) => x.id === inference.id && x.basis !== 'stated'
      );
      assert(
        suggested || other,
        `${analysis.threadId}: an inference really is non-stated in the model.`
      );
    }
    for (const unknown of e.unknowns) {
      assert(unknown.why.trim().length > 0, `${analysis.threadId}: an unknown says why it is unknown.`);
    }
  }
}

const needsInfo = threadDetail(WORK_DATASET, 'thr-w-014')!;
assert(needsInfo.evidence.inferences.length > 0, 'The ambiguous date thread carries an inference.');
assert(needsInfo.evidence.unknowns.length > 0, 'It also carries unknowns.');

/* ======================================== 2. approval creation */

group('Approval creation');

const baseline: DraftFingerprintInput = {
  accountId: 'acct-work-01',
  fromAddress: 'you@your-practice.example',
  recipients: [
    { address: 'dana.prosser@linwood-property.example', displayName: 'Dana Prosser', field: 'to' },
  ],
  subject: 'RE: Reporting portal down',
  body: 'Seen it, on it now. I will come back to you by 9:30.',
  attachmentIds: [],
};

const record = createApproval('thr-w-001', baseline, 'you', NOW);
assert(record.threadId === 'thr-w-001', 'The approval is bound to its thread.');
assert(record.fingerprint === fingerprintOf(baseline), 'It records the fingerprint of what was approved.');
assert(record.authorises === 'write_draft_to_mailbox', 'It authorises saving a draft, and nothing else.');
assert(
  record.approvedSnapshot.body === baseline.body,
  'It keeps a readable copy of what was approved.'
);

const unchanged = approvalStatus(baseline, record);
assert(unchanged.state === 'approved', 'An unchanged draft is approved.');
assert(unchanged.changed.length === 0, 'Nothing is reported as changed.');
assert(
  /nothing has been sent/i.test(unchanged.message),
  'Even the approved message says nothing has been sent.'
);

assert(
  approvalStatus(baseline, null).state === 'none',
  'With no approval record the state is none, not approved.'
);
assert(
  /not approved/i.test(approvalStatus(baseline, null).message),
  'And it says so plainly.'
);

group('The approved snapshot is a copy, not a reference');

const live: DraftFingerprintInput = {
  ...baseline,
  recipients: baseline.recipients.map((r) => ({ ...r })),
  attachmentIds: [...baseline.attachmentIds],
};
const snapshotRecord = createApproval('thr-w-001', live, 'you', NOW);
// Mutate the live object the way a careless edit path might.
(live.recipients as { address: string }[]).push({ address: 'someone@else.example' } as never);
assert(
  snapshotRecord.approvedSnapshot.recipients.length === 1,
  'Mutating the live draft does not rewrite what was approved. This is the bug the whole mechanism exists to prevent.'
);

/* ========================================= 3 to 6. invalidation */

group('Approval invalidation: body change');

const bodyChanged = { ...baseline, body: baseline.body + ' One more thing.' };
const bodyStatus = approvalStatus(bodyChanged, record);
assert(bodyStatus.state === 'expired', 'Changing the body expires the approval.');
assert(bodyStatus.changed.includes('body'), 'It names the body as what changed.');
assert(
  bodyStatus.message.startsWith('Approval expired.'),
  'The status opens with "Approval expired."'
);
assert(
  bodyStatus.message.includes(APPROVAL_FIELD_LABEL.body),
  'The message says which field changed rather than leaving a person hunting.'
);
assert(!bodyStatus.message.includes('—'), 'The message contains no em dash.');

assert(
  approvalStatus({ ...baseline, body: '  ' + baseline.body + '  ' }, record).state === 'approved',
  'Leading and trailing whitespace alone does not expire an approval.'
);
assert(
  approvalStatus({ ...baseline, body: baseline.body.replace('9:30', '10:30') }, record).state ===
    'expired',
  'Changing a time inside the body expires it. This is the case that matters most.'
);

group('Approval invalidation: recipient change');

const added = {
  ...baseline,
  recipients: [
    ...baseline.recipients,
    { address: 'someone.else@linwood-property.example', displayName: 'Someone Else', field: 'cc' as const },
  ],
};
assert(approvalStatus(added, record).state === 'expired', 'Adding a recipient expires the approval.');
assert(
  approvalStatus(added, record).changed.includes('recipients'),
  'It names the recipients as what changed.'
);

const removed = { ...baseline, recipients: [] };
assert(approvalStatus(removed, record).state === 'expired', 'Removing every recipient expires it.');

const retyped = {
  ...baseline,
  recipients: [{ address: 'DANA.PROSSER@Linwood-Property.Example', displayName: 'Dana', field: 'to' as const }],
};
assert(
  approvalStatus(retyped, record).state === 'approved',
  'The same address in different case is the same address.'
);

const reordered = {
  ...added,
  recipients: [...added.recipients].reverse(),
};
assert(
  approvalStatus(reordered, createApproval('t', added, 'you', NOW)).state === 'approved',
  'Reordering the recipients is not a change. Adding to them is.'
);

const movedField = {
  ...baseline,
  recipients: [{ ...baseline.recipients[0], field: 'bcc' as const }],
};
assert(
  approvalStatus(movedField, record).state === 'expired',
  'Moving a recipient from To to BCC is a change, because it changes who sees what.'
);

group('Approval invalidation: attachment change');

const attached = { ...baseline, attachmentIds: ['att-new-1'] };
assert(approvalStatus(attached, record).state === 'expired', 'Adding an attachment expires it.');
assert(
  approvalStatus(attached, record).changed.includes('attachments'),
  'It names the attachments.'
);

const twoAttachments = { ...baseline, attachmentIds: ['a', 'b'] };
const twoRecord = createApproval('t', twoAttachments, 'you', NOW);
assert(
  approvalStatus({ ...baseline, attachmentIds: ['b', 'a'] }, twoRecord).state === 'approved',
  'Reordering attachments is not a change.'
);
assert(
  approvalStatus({ ...baseline, attachmentIds: ['a'] }, twoRecord).state === 'expired',
  'Removing an attachment is.'
);

group('Approval invalidation: account, sender and subject');

assert(
  approvalStatus({ ...baseline, accountId: 'acct-personal-01' }, record).changed.includes('account'),
  'Changing the sending account expires the approval and names it.'
);
assert(
  approvalStatus({ ...baseline, fromAddress: 'other@your-practice.example' }, record).changed.includes(
    'sender'
  ),
  'Changing the from address expires it and names it.'
);
assert(
  approvalStatus({ ...baseline, subject: 'Something else' }, record).changed.includes('subject'),
  'Changing the subject expires it and names it.'
);

group('Several changes at once are all reported');

const everything: DraftFingerprintInput = {
  accountId: 'acct-personal-01',
  fromAddress: 'other@personal.example',
  recipients: [{ address: 'new@example.example', displayName: 'New', field: 'to' }],
  subject: 'Different',
  body: 'Different body entirely.',
  attachmentIds: ['x'],
};
const allChanged = changedFields(record.approvedSnapshot, everything);
assert(allChanged.length === 6, 'All six fields are reported as changed.');
for (const field of ['account', 'sender', 'recipients', 'subject', 'body', 'attachments'] as const) {
  assert(allChanged.includes(field), `${field} is reported.`);
}

group('The fingerprint is stable and discriminating');

assert(fingerprintOf(baseline) === fingerprintOf({ ...baseline }), 'The same input gives the same fingerprint.');
assert(
  fingerprintOf(baseline) !== fingerprintOf({ ...baseline, body: baseline.body + '.' }),
  'A single character change gives a different fingerprint.'
);
assert(
  fingerprintOf(baseline) !==
    fingerprintOf({ ...baseline, subject: baseline.subject.replace('RE:', 'FW:') }),
  'A changed subject gives a different fingerprint.'
);

/* ================================== 7 and 8. missing information */

group('Missing information and withheld drafts');

assert(
  SAFETY_STATEMENTS.withheld === 'Draft withheld pending clarification.',
  'The withheld wording is exactly as the brief requires.'
);

const withheld = WORK_DATASET.drafts.filter((d) => d.status === 'withheld_for_safety');
assert(withheld.length > 0, 'Some drafts are withheld.');
for (const draft of withheld) {
  assert(draft.body === null, `${draft.id}: a withheld draft carries no text.`);
  assert(draft.variants === null, `${draft.id}: and no styles either.`);
  assert((draft.statusReason ?? '').length > 20, `${draft.id}: it says why, at length.`);
}

const blocked = WORK_DATASET.drafts.filter((d) => d.status === 'clarification_required');
assert(blocked.length > 0, 'Some drafts are blocked on missing information.');
for (const draft of blocked) {
  assert(draft.body === null, `${draft.id}: a blocked draft carries no text.`);
  assert(
    draft.missingInformation.length > 0,
    `${draft.id}: it lists what is missing rather than only saying something is.`
  );
  for (const item of draft.missingInformation) {
    assert(item.trim().length > 0, `${draft.id}: every missing item says something.`);
  }
}

const ambiguous = WORK_DATASET.drafts.find((d) => d.threadId === 'thr-w-014')!;
assert(
  ambiguous.missingInformation.some((m) => /month/i.test(m)),
  'The thread with an ambiguous date says the month is missing.'
);

/* ============================================= dates and amounts */

group('Dates and amounts in a draft are surfaced');

const figures = figuresInDraft(
  'Hi Dana, I will come back to you by 9:30 on Thursday. The invoice is AU$3,180 and is due 24 October 2026.'
);
assert(figures.some((f) => f.kind === 'amount' && f.text === 'AU$3,180'), 'A currency amount is found.');
assert(figures.some((f) => f.kind === 'time' && f.text === '9:30'), 'A time is found.');
assert(figures.some((f) => f.kind === 'date' && /Thursday/.test(f.text)), 'A weekday is found.');
assert(
  figures.some((f) => f.kind === 'date' && /24 October/.test(f.text)),
  'A written date is found.'
);
assert(figuresInDraft('Nothing numeric here at all.').length === 0, 'Plain text yields nothing.');

const overlapping = figuresInDraft('The meeting is at 11:00 am on 14 October 2026.');
const texts = overlapping.map((f) => f.text);
assert(
  !(texts.includes('11:00') && texts.includes('11:00 am')),
  'Overlapping matches are collapsed, so "11:00 am" is not also reported as "11:00".'
);
for (const figure of overlapping) {
  assert(
    'The meeting is at 11:00 am on 14 October 2026.'.slice(figure.index, figure.index + figure.text.length) ===
      figure.text,
    'Every figure records where it actually is in the text.'
  );
}

/* ======================================== draft actions and safety */

group('Draft actions');

assert(DRAFT_ACTIONS.length === 6, 'There are six draft actions.');
const actionKinds = DRAFT_ACTIONS.map((a) => a.kind);
for (const kind of ['edit', 'regenerate_style', 'save_proposed', 'request_clarification', 'discard', 'approve']) {
  assert(actionKinds.includes(kind as never), `The "${kind}" action exists.`);
}
for (const action of DRAFT_ACTIONS) {
  assert(action.effect.trim().length > 30, `${action.kind} explains what it does.`);
}
assert(
  !DRAFT_ACTIONS.some((a) => /\bsend\b/i.test(a.label)),
  'No action is called send.'
);
assert(
  DRAFT_ACTIONS.find((a) => a.kind === 'approve')!.effect.includes('does not send'),
  'Approve says in its own description that it does not send.'
);
assert(
  DRAFT_ACTIONS.filter((a) => a.affectsApproval).length === 5,
  'Five of the six actions affect approval. Only saving a proposed version does not.'
);

group('The five things the interface must never imply');

assert(
  /not confirmed/i.test(SAFETY_STATEMENTS.unknownFact),
  'An unknown fact is labelled as not confirmed.'
);
assert(
  SAFETY_STATEMENTS.inferredDate === 'Suggested date, confirm',
  'An inferred date is labelled as suggested.'
);
assert(
  /not read/i.test(SAFETY_STATEMENTS.attachmentNotReviewed),
  'An attachment is never implied to have been read.'
);
assert(
  /nothing has been done/i.test(SAFETY_STATEMENTS.recommendedNotDone),
  'A recommendation is never implied to have been done.'
);
assert(
  /nothing has been sent/i.test(SAFETY_STATEMENTS.savedNotSent),
  'Saving is never implied to be sending.'
);
assert(
  /nothing has been sent/i.test(SAFETY_STATEMENTS.approvedNotSent),
  'Approving is never implied to be sending.'
);
for (const statement of Object.values(SAFETY_STATEMENTS)) {
  assert(!statement.includes('—'), `"${statement}" contains no em dash.`);
}

/* ================================================== draft seeding */

group('Seeding a working draft');

const readyDraft = WORK_DATASET.drafts.find((d) => d.status === 'available')!;
const seeded = seedFromReplyDraft(readyDraft, 'acct-work-01', 'you@your-practice.example', 'Test subject', 'concise');
assert(seeded.body.length > 0, 'The working draft starts with the concise text.');
assert(seeded.subject === 'RE: Test subject', 'The subject gets a reply prefix.');
assert(
  seedFromReplyDraft(readyDraft, 'a', 'b', 'RE: Already replied', 'concise').subject ===
    'RE: Already replied',
  'A subject that already has one does not get a second.'
);
assert(seeded.recipients.length > 0, 'The recipients come across.');
assert(seeded.attachmentIds.length === 0, 'Nothing is attached by default.');
assert(
  seedFromReplyDraft(readyDraft, 'a', 'b', 'x', 'detailed').body !== seeded.body,
  'A different style seeds different text.'
);

/* ====================================================== routing */

group('The workspace route');

assert(EMAIL_DETAIL_ROUTES.length === 1, 'One detail route is registered.');
assert(
  EMAIL_DETAIL_ROUTES[0].segment === 'thread/:threadId',
  'It is the thread workspace, with its parameter.'
);
assert(
  EMAIL_DETAIL_ROUTES[0].buildPath('thr-w-001') === '/email/thread/thr-w-001',
  'Links into it are built from one place.'
);

/* ------------------------------------------------------------- summary */

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre Stage 5 intelligence: all checks passed.');
