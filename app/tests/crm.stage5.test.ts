/**
 * Concludo CRM, Stage 5: the workflow layer.
 *
 * WHAT THIS SUITE COVERS, AND WHAT THE BROWSER SUITE COVERS.
 *
 * The brief names eleven areas. Nine of them are questions about what the
 * composition and the write path do, and they are here, where they run in a
 * second and fail with a sentence somebody can act on:
 *
 *   lead deduplication, human-confirmed creation, stage movement,
 *   exit criteria, override reason, forecast explanation,
 *   lost and reopened states, custom terminology, source evidence.
 *
 * Two of them are only answerable in a rendered page. Mobile Kanban is a
 * question about what a 390 pixel viewport does, and account permissions on a
 * surface that writes is a question about whether a viewer can REACH the
 * controls, not only whether the function refuses: a page that renders a
 * working save button and then refuses the save has failed, even though the
 * refusal was correct. Both live in `tests/browser/crm.stage5.test.mjs`. The
 * refusals themselves are tested here, because they are the thing that must
 * hold when the page is bypassed.
 *
 * EVERY WRITE IN THIS FILE RUNS AGAINST A COPY.
 *
 * `CRM_WORKSPACES` is a module-level constant three other suites read. Each
 * group deep-copies the workspace it needs, so a test that moves a deal cannot
 * change what another suite sees.
 *
 * Run: bun tests/crm.stage5.test.ts
 */
import { CRM_WORKSPACES, USERS } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { CrmWorkspaceData } from '../src/lib/crm/domain';
import { CrmContext, CrmRefused } from '../src/lib/crm/repositories/repository';
import {
  LEAD_SOURCES,
  SOURCE_CONSENT,
  findPossibleMatches,
  leadSourceOf,
  proposeNextAction,
  proposeRouting,
  reviewInbox,
  reviewLead,
} from '../src/lib/crm/stage5/leadIntake';
import {
  boardAsList,
  buildBoard,
  lostReasons,
  pipelinesIn,
} from '../src/lib/crm/stage5/pipeline';
import {
  buildForecast,
  clearForecastSubmissions,
  estimateFactors,
  submitForecast,
  systemEstimate,
} from '../src/lib/crm/stage5/forecast';
import { buildWorkItemWorkspace } from '../src/lib/crm/stage5/workItemWorkspace';
import {
  auditFor,
  captureServiceCase,
  captureTask,
  closeDateHistory,
  closeWorkItem,
  convertLead,
  declineLead,
  moveStage,
  reopenWorkItem,
  resetIdCounter,
  setExpectedCloseDate,
} from '../src/lib/crm/stage5/writes';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual, assertRefused } = makeAssert(r);

const NOW = CRM_DEMO_NOW;

/** A private copy, so nothing here can be seen by another suite or another group. */
function copyOf(workspaceId: string): CrmWorkspaceData {
  const source = CRM_WORKSPACES.find((d) => d.workspace.id === workspaceId);
  if (!source) throw new Error(`No workspace ${workspaceId} in the fixture.`);
  resetIdCounter();
  return JSON.parse(JSON.stringify(source)) as CrmWorkspaceData;
}

function contextFor(
  data: CrmWorkspaceData,
  role: 'crm_viewer' | 'crm_contributor' | 'crm_approver' | 'crm_admin'
): CrmContext {
  const member =
    data.members.find((m) => m.crmRole === role) ??
    data.members.find((m) => m.crmRole === 'crm_admin') ??
    data.members[0];
  return { userId: member.userId, workspaceId: data.workspace.id, role, now: NOW };
}

/** A conversion that links nothing and creates the contact only. */
const convert = (leadId: string, confirmedBy: string) => ({
  leadId,
  confirmedBy,
  personId: null,
  organisationId: null,
  pipelineId: null,
});

const refused = (code: string) => (error: unknown) =>
  error instanceof CrmRefused && error.code === code;

const AGENCY = 'ws-agency';

/* ======================================================= 1. deduplication */

group('Lead deduplication finds what is already here, and says what differs', () => {
  const agency = copyOf(AGENCY);
  const inbox = reviewInbox(agency, NOW);

  assert(inbox.length > 0, 'the inbox has leads in it');

  // Every one of the eight sources the brief names is represented somewhere in
  // the demonstration data, because the consent basis and the proposed action
  // differ by source and an inbox showing one source demonstrates nothing.
  const sources = new Set(agency.leads.map((l) => leadSourceOf(l)));
  assertEqual(sources.size, LEAD_SOURCES.length, 'every lead source is demonstrated');

  // The strongest signal: the same email address as somebody already here.
  const sameAddress = inbox.find((review) =>
    review.matches.some((m) => m.kind === 'person' && m.strength === 'the same address')
  );
  assert(sameAddress !== undefined, 'a lead with a known email address is matched to that person');

  // A close name, which is the usual shape of a typed duplicate.
  const closeName = inbox.find((review) =>
    review.matches.some((m) => m.strength === 'a close name')
  );
  assert(closeName !== undefined, 'a name a character or two away is matched');

  // An organisation reached by email domain under a name nobody holds.
  const byDomain = inbox.find((review) =>
    review.matches.some((m) => m.kind === 'organisation' && m.strength === 'the same organisation')
  );
  assert(byDomain !== undefined, 'an organisation is matched by email domain');

  // THE PROPERTY THAT MATTERS MOST. A list that only ever says "these look the
  // same" trains somebody to press yes without reading, so every match carries
  // what matched AND the match is never offered without a reason in words.
  let matchesChecked = 0;
  for (const review of inbox) {
    for (const match of review.matches) {
      matchesChecked += 1;
      assert(match.matching.length > 0, `${match.name}: the match says what matched`);
      assert(match.reason.trim().length > 20, `${match.name}: the match says why, in words`);
      assert(Array.isArray(match.differing), `${match.name}: what differs is carried, even if empty`);
    }
  }
  assert(matchesChecked >= 6, 'enough matches exist in the data to be worth testing');

  // Nothing is ranked and nobody is scored: no match carries a number.
  const anyNumber = inbox
    .flatMap((review) => review.matches)
    .some((m) => /\d+\s*%/.test(m.reason) || /score/i.test(m.reason));
  assert(!anyNumber, 'no match is expressed as a percentage or a score');
});

group('An ambiguous lead blocks creation rather than guessing', () => {
  const agency = copyOf(AGENCY);
  const ambiguous = agency.leads.find((l) => l.personName === 'Nadia Cort');
  assert(ambiguous !== undefined, 'the ambiguous lead is in the fixture');

  const matches = findPossibleMatches(agency, ambiguous!);
  const routing = proposeRouting(agency, ambiguous!, matches);
  assertEqual(routing.blocked, true, 'routing is blocked when more than one person could be it');

  const action = proposeNextAction(ambiguous!, matches, routing);
  assert(
    action.what.toLowerCase().includes('decide'),
    'and the proposed action is for a person to decide which it is'
  );
});

group('A source that gives no basis does not propose contacting them', () => {
  const agency = copyOf(AGENCY);
  const imported = agency.leads.find((l) => leadSourceOf(l) === 'imported_list');
  assert(imported !== undefined, 'a purchased-list lead is in the fixture');

  const review = reviewLead(agency, imported!, NOW);
  assertEqual(review.consent.basis, 'not_obtained', 'its consent basis is recorded as not obtained');
  assertEqual(review.consent.checkBeforeContact, true, 'and it is flagged for a check first');
  assert(
    !review.nextAction.what.toLowerCase().startsWith('reply'),
    'the proposed action is not a cheerful reply to somebody who never asked to hear from us'
  );
  assert(
    review.nextAction.beforeYouContact !== null,
    'and the card carries what has to be true before anybody contacts them'
  );

  // Each of the eight sources states a basis and what it depends on, so this is
  // never a shrug.
  for (const source of LEAD_SOURCES) {
    const consent = SOURCE_CONSENT[source];
    assert(consent.meaning.trim().length > 10, `${source}: the basis means something, in words`);
    assert(consent.requires.trim().length > 10, `${source}: what it depends on is stated`);
  }
});

/* ============================================== 2. human-confirmed creation */

group('Nothing is created from a lead without a person confirming it', () => {
  const agency = copyOf(AGENCY);
  const context = contextFor(agency, 'crm_contributor');
  const lead = agency.leads.find((l) => l.state === 'awaiting_review')!;
  const peopleBefore = agency.people.length;

  assertRefused(
    () => convertLead(context, agency, convert(lead.id, '')),
    refused('not_permitted'),
    'a conversion with no confirmer is refused'
  );
  assertEqual(agency.people.length, peopleBefore, 'and nothing was created on the way out');

  const converted = convertLead(context, agency, convert(lead.id, USERS.anthony));
  assert(converted.person !== null, 'with a confirmer, the person is created');
  assertEqual(converted.lead.state, 'converted', 'and the lead is marked converted');
  assert(
    converted.lead.convertedBy !== null,
    'the record keeps who confirmed it, not only that somebody did'
  );

  const audit = auditFor(agency, 'crm_leads', lead.id);
  assert(audit.length > 0, 'the conversion is in the audit trail');
  assert(
    (audit[0].detail ?? '').includes('Confirmed by'),
    'and the audit row names the confirmation'
  );

  assertRefused(
    () => convertLead(context, agency, convert(lead.id, USERS.anthony)),
    refused('invalid'),
    'converting the same lead twice is refused'
  );
});

group('Declining a lead needs a reason, and keeps it', () => {
  const agency = copyOf(AGENCY);
  const context = contextFor(agency, 'crm_contributor');
  const lead = agency.leads.find((l) => l.state === 'awaiting_review')!;

  assertRefused(
    () => declineLead(context, agency, lead.id, ''),
    refused('invalid'),
    'a decline with no reason is refused'
  );

  const declined = declineLead(context, agency, lead.id, 'Outside what this workspace handles.');
  assertEqual(declined.state, 'not_proceeding', 'with a reason, the lead is closed');
  assert(
    (declined.notProceedingReason ?? '').length > 10,
    'and the reason is kept on the record, not only in the audit row'
  );
});

group('A viewer cannot write, whatever the page offers', () => {
  const agency = copyOf(AGENCY);
  const viewer = contextFor(agency, 'crm_viewer');
  const lead = agency.leads.find((l) => l.state === 'awaiting_review')!;

  assertRefused(
    () => convertLead(viewer, agency, convert(lead.id, USERS.anthony)),
    refused('insufficient_role'),
    'a viewer converting a lead is refused on role'
  );
  assertRefused(
    () => captureTask(viewer, agency, { title: 'Ring them back' }),
    refused('insufficient_role'),
    'a viewer creating a task is refused on role'
  );
});

group('A member of one workspace cannot write into another', () => {
  const agency = copyOf(AGENCY);
  const other = CRM_WORKSPACES.find((d) => d.workspace.id !== AGENCY)!;
  const foreign: CrmContext = {
    userId: agency.members[0].userId,
    workspaceId: other.workspace.id,
    role: 'crm_admin',
    now: NOW,
  };

  assertRefused(
    () => captureTask(foreign, agency, { title: 'Write into the wrong tenant' }),
    refused('cross_workspace'),
    'a context pointed at another workspace is refused before anything is written'
  );

  const outsider: CrmContext = {
    userId: 'user-not-a-member',
    workspaceId: agency.workspace.id,
    role: 'crm_admin',
    now: NOW,
  };
  assertRefused(
    () => captureTask(outsider, agency, { title: 'Write without a membership' }),
    refused('not_a_member'),
    'and a claimed administrator who is not a member is refused too'
  );
});

/* ===================================== 3, 4, 5. stage movement and criteria */

group('Stage movement records where it came from and where it went', () => {
  const agency = copyOf(AGENCY);
  const context = contextFor(agency, 'crm_contributor');
  const item = agency.workItems.find((w) => w.status === 'open' && w.pipelineId === 'pipe-ag-1')!;
  const stages = agency.stages
    .filter((s) => s.pipelineId === item.pipelineId && !s.isClosed)
    .sort((a, b) => a.stageOrder - b.stageOrder);
  const from = item.stageId;
  const to = stages.find((s) => s.id !== from)!;

  const criteria = agency.stageCriteria.filter((c) => c.stageId === from);
  const move = moveStage(context, agency, {
    workItemId: item.id,
    toStageId: to.id,
    metCriterionIds: criteria.map((c) => c.id),
  });

  assertEqual(move.fromStageId, from, 'the move keeps where it came from');
  assertEqual(move.toStageId, to.id, 'and where it went');
  assertEqual(item.stageId, to.id, 'the item is at the new stage');
  assertEqual(
    item.enteredStageAt,
    NOW,
    'and the stage clock restarts, so days-in-stage means what it says'
  );
  assertEqual(move.overrideReason, null, 'nothing was overridden, so no reason is stored');

  assertRefused(
    () =>
      moveStage(context, agency, {
        workItemId: item.id,
        toStageId: 'stg-ag-6',
        metCriterionIds: [],
      }),
    refused('invalid'),
    'a stage from another pipeline is refused'
  );
});

group('Unmet exit criteria need a reason, and the reason is kept', () => {
  const agency = copyOf(AGENCY);
  const context = contextFor(agency, 'crm_contributor');

  // A stage that actually has a required criterion, or this test proves nothing.
  const required = agency.stageCriteria.find((c) => c.isRequired)!;
  assert(required !== undefined, 'the fixture has a required exit criterion');
  const item = agency.workItems.find(
    (w) => w.stageId === required.stageId && w.status === 'open'
  )!;
  assert(item !== undefined, 'and an open item sitting at that stage');

  const stages = agency.stages
    .filter((s) => s.pipelineId === item.pipelineId && !s.isClosed)
    .sort((a, b) => a.stageOrder - b.stageOrder);
  const to = stages.find((s) => s.id !== item.stageId)!;

  assertRefused(
    () => moveStage(context, agency, { workItemId: item.id, toStageId: to.id, metCriterionIds: [] }),
    refused('invalid'),
    'moving past an unmet required criterion with no reason is refused'
  );
  assertEqual(item.stageId, required.stageId, 'and the item did not move');

  const move = moveStage(context, agency, {
    workItemId: item.id,
    toStageId: to.id,
    metCriterionIds: [],
    overrideReason: 'Client confirmed verbally at the site meeting; paperwork to follow.',
  });

  // NOT BLOCKED, NOT SILENT. The rule that cannot be overridden gets worked
  // around outside the system, where nobody can see it.
  assertEqual(item.stageId, to.id, 'with a reason, the move goes through');
  assert((move.criteriaUnmet ?? []).length > 0, 'the move records which criteria were unmet');
  assert(
    (move.overrideReason ?? '').length > 20,
    'and the reason is stored on the move itself'
  );

  const audit = auditFor(agency, 'crm_work_items', item.id);
  assert(
    audit.some((e) => (e.detail ?? '').includes('unmet')),
    'the audit row says it was moved with something unmet'
  );
});

/* ========================================= 6. forecast explanation */

group('The system estimate explains itself through ten named factors', () => {
  const agency = copyOf(AGENCY);
  const card = buildBoard(agency, 'pipe-ag-1', NOW)!.columns.flatMap((c) => c.cards)[0];
  const factors = estimateFactors(agency, card, NOW);

  assertEqual(factors.length, 10, 'ten factors, every time');

  const names = new Set(factors.map((f) => f.name));
  assertEqual(names.size, 10, 'each one named differently');

  for (const factor of factors) {
    assert(factor.fact.trim().length > 0, `${factor.name}: carries the fact behind it`);
    assert(
      ['supports', 'weakens', 'neutral'].includes(factor.direction),
      `${factor.name}: says which way it points`
    );
  }

  // THE LINE THE BRIEF DRAWS. Nothing in the estimate may be about a person.
  const words = factors.map((f) => `${f.name} ${f.fact}`).join(' ').toLowerCase();
  for (const forbidden of ['performance', 'rep ', 'quota', 'win rate', 'likelihood', 'probability']) {
    assert(!words.includes(forbidden), `the factors never mention "${forbidden.trim()}"`);
  }
});

group('The two forecast views are separate, and neither is presented as fact', () => {
  const agency = copyOf(AGENCY);
  clearForecastSubmissions();

  const forecast = buildForecast(agency, 'pipe-ag-1', NOW);

  assert('human' in forecast && 'system' in forecast, 'the view carries both, separately');
  assert(
    forecast.system.disclaimer.toLowerCase().includes('not a forecast'),
    'the system side says in words that it is not a forecast'
  );
  assert(
    !/\d+\s*%/.test(
      forecast.system.disclaimer + forecast.system.items.map((i) => i.explanation).join(' ')
    ),
    'and offers no percentage anywhere'
  );
  assert(
    forecast.human.notSubmitted.length > 0,
    'open work with nothing submitted against it is reported rather than filled in'
  );

  // A commitment is a statement somebody will stand behind, so it carries a
  // reason. This is the one field the forecast refuses to accept blank.
  const card = forecast.human.notSubmitted[0];
  let threw = false;
  try {
    submitForecast({
      workItemId: card.item.id,
      category: 'commit',
      amount: card.expectedValue,
      expectedCloseDate: card.item.expectedCloseDate,
      submittedBy: USERS.anthony,
      submittedAt: NOW,
      note: null,
    });
  } catch {
    threw = true;
  }
  assert(threw, 'a commitment with no reason is refused');

  submitForecast({
    workItemId: card.item.id,
    category: 'commit',
    amount: card.expectedValue,
    expectedCloseDate: card.item.expectedCloseDate,
    submittedBy: USERS.anthony,
    submittedAt: NOW,
    note: 'They have signed the scope and the date is in their diary.',
  });

  const after = buildForecast(agency, 'pipe-ag-1', NOW);
  assertEqual(after.human.submittedCount, 1, 'the submitted view counts what people have said');
  assert(
    after.human.entries[0].submittedBy.length > 0,
    'and every submission has an author, which is what makes it a statement'
  );

  // The two are never added together.
  const combined = after as unknown as Record<string, unknown>;
  assert(
    !('blended' in combined) && !('weighted' in combined) && !('total' in combined),
    'there is no combined number on the view at all'
  );

  clearForecastSubmissions();
});

group('The estimate is about the record, and never about a person', () => {
  const agency = copyOf(AGENCY);
  const cards = buildBoard(agency, 'pipe-ag-1', NOW)!.columns.flatMap((c) => c.cards);
  const estimate = systemEstimate(agency, cards, NOW);

  const text = [estimate.disclaimer, ...estimate.items.map((i) => `${i.band} ${i.explanation}`)]
    .join(' ')
    .toLowerCase();

  for (const forbidden of ['score', 'ranked', 'top performer', 'underperform']) {
    assert(!text.includes(forbidden), `the estimate never says "${forbidden}"`);
  }

  // The band is a word, not a number dressed as one.
  for (const item of estimate.items) {
    assert(!/\d/.test(item.band), `the band for ${item.card.item.title} is words, not digits`);
  }
});

/* ================================== 7. lost and reopened states */

group('Work that stops keeps its reason, and can start again without losing it', () => {
  const agency = copyOf(AGENCY);
  const context = contextFor(agency, 'crm_contributor');
  const item = agency.workItems.find((w) => w.status === 'open')!;

  assertRefused(
    () => closeWorkItem(context, agency, item.id, 'not_proceeding', ''),
    refused('invalid'),
    'closing work as lost with no reason is refused'
  );

  const closed = closeWorkItem(
    context,
    agency,
    item.id,
    'not_proceeding',
    'Budget deferred to the next financial year.'
  );
  assertEqual(closed.status, 'not_proceeding', 'with a reason, the work closes');
  assert(closed.resolvedAt !== null, 'and records when');

  assertRefused(
    () => closeWorkItem(context, agency, item.id, 'won', 'Already closed.'),
    refused('invalid'),
    'closing it twice is refused'
  );

  const reopened = reopenWorkItem(context, agency, item.id, 'They came back with the budget.');
  assertEqual(reopened.status, 'open', 'it reopens');
  assertEqual(reopened.resolvedAt, null, 'the resolution date is cleared');
  assert(
    (reopened.resolutionReason ?? '').length > 0,
    'but WHY IT STOPPED IS KEPT: a reopened record that forgets its history is how the same deal is lost twice'
  );

  const audit = auditFor(agency, 'crm_work_items', item.id);
  assert(
    audit.some((e) => e.eventType === 'work_item_reopened'),
    'the reopen is its own audit event, so the round trip is readable'
  );

  // A won close does not need a reason, because the question nobody asks in six
  // months is why something succeeded.
  const second = agency.workItems.find((w) => w.status === 'open' && w.id !== item.id)!;
  const won = closeWorkItem(context, agency, second.id, 'won', '');
  assertEqual(won.status, 'won', 'a win closes without one');
});

group('The board reports lost reasons, and the stale work it is not blaming anybody for', () => {
  const agency = copyOf(AGENCY);
  const board = buildBoard(agency, 'pipe-ag-1', NOW)!;

  assert(board.closed.length > 0, 'resolved work is carried, off the board');
  const reasons = lostReasons(board);
  assert(reasons.length > 0, 'and grouped by the reason recorded');
  assert(
    reasons.every((entry) => entry.reason.trim().length > 0),
    'every group has a reason in words'
  );

  assert(board.staleCount > 0, 'work that has gone quiet is counted');
  const stale = boardAsList(board).filter((c) => c.stale);
  for (const card of stale) {
    assert((card.staleReason ?? '').length > 0, `${card.item.title}: says WHY it is stale`);
    assert(
      !/\b(owner|rep|anthony|priya|tom)\b/i.test(card.staleReason ?? ''),
      `${card.item.title}: the stale reason is about the record, not about who owns it`
    );
  }

  // Close-date movement is readable as history rather than as a current value.
  const context = contextFor(agency, 'crm_contributor');
  const item = agency.workItems.find((w) => w.status === 'open' && w.expectedCloseDate)!;
  setExpectedCloseDate(context, agency, item.id, '2026-12-01', 'Client asked for more time.');
  const history = closeDateHistory(agency, item.id);
  assertEqual(history.length, 1, 'a close-date change is its own entry');
  assert(history[0].reason !== null, 'with the reason given at the time');
});

/* ========================================= 8. custom terminology */

group('The words are the workspace’s, not the software’s', () => {
  // Two pipelines in one workspace, with stage names of their own.
  const agency = copyOf(AGENCY);
  const pipelines = pipelinesIn(agency);
  assert(pipelines.length > 1, 'a workspace can hold more than one pipeline');

  const names = new Set<string>();
  for (const pipeline of pipelines) {
    const board = buildBoard(agency, pipeline.id, NOW)!;
    assertEqual(board.pipeline.id, pipeline.id, `${pipeline.name}: builds its own board`);
    for (const column of board.columns) names.add(column.stage.name);
    assert(
      board.recordsPlural.length > 0,
      `${pipeline.name}: the board carries the workspace's own plural`
    );
  }

  // The second pipeline's stage words are genuinely different, so the board is
  // reading them rather than supplying a vocabulary of its own.
  assert(names.has('Appraisal') && names.has('Enquiry'), 'each pipeline keeps its own stage words');

  // And across workspaces, the record word differs.
  const words = new Set(
    CRM_WORKSPACES.map((d) => d.workspace.recordTerminology.toLowerCase())
  );
  assert(words.size > 1, 'different workspaces call the thing different things');

  for (const data of CRM_WORKSPACES) {
    const first = pipelinesIn(data)[0];
    if (!first) continue;
    const board = buildBoard(data, first.id, NOW)!;
    assertEqual(
      board.recordsPlural,
      data.workspace.recordTerminologyPlural,
      `${data.workspace.name}: the heading uses this workspace's word`
    );
  }
});

/* ============================================ 9. source evidence */

group('An extracted value leads back to what was said', () => {
  const agency = copyOf(AGENCY);
  const withEvidence = agency.evidence.find(
    (e) => e.subjectTable === 'crm_work_items' && e.deletedAt === null
  )!;
  assert(withEvidence !== undefined, 'the fixture has work with evidence behind it');

  const workspace = buildWorkItemWorkspace(agency, withEvidence.subjectId, NOW)!;
  assert(workspace !== null, 'the workspace builds for that item');
  assert(workspace.evidence.length > 0, 'and carries the evidence');

  for (const trail of workspace.evidence) {
    assert(trail.fieldName.length > 0, 'each trail names the field it filled');
    // Either there is something to open, or there is a sentence saying why not.
    // An absent source with no explanation is indistinguishable from a bug.
    assert(
      trail.record !== null || (trail.unavailableBecause ?? '').length > 0,
      `${trail.fieldName}: either the source record resolves, or it says why it cannot`
    );
    assert(
      trail.sourceText !== null || (trail.unavailableBecause ?? '').length > 0,
      `${trail.fieldName}: the sentence is carried, or its absence is explained`
    );
    assert(trail.basis.length > 0, `${trail.fieldName}: says whether it was stated or inferred`);
  }

  // The nineteen things the brief asks the workspace to show are all present as
  // keys, so a missing section fails here rather than silently rendering blank.
  for (const key of [
    'organisation',
    'contacts',
    'need',
    'products',
    'quotes',
    'stageHistory',
    'closeDateChanges',
    'timeline',
    'meetings',
    'decisions',
    'commitments',
    'notes',
    'serviceCases',
    'accountPlan',
    'requiredApprovals',
    'competition',
    'risks',
    'proposals',
    'evidence',
  ]) {
    assert(key in workspace, `the work item workspace carries ${key}`);
  }
});

group('A case can be recorded in seconds, and still has to say why it belongs here', () => {
  const agency = copyOf(AGENCY);
  const context = contextFor(agency, 'crm_contributor');

  assertRefused(
    () =>
      captureServiceCase(context, agency, {
        title: 'Portal access failed',
        organisationId: 'org-ag-1',
        relationshipEffect: '',
      }),
    refused('invalid'),
    'a case with no stated effect on the relationship is refused'
  );

  const raised = captureServiceCase(context, agency, {
    title: 'Portal access failed for two offices',
    organisationId: 'org-ag-1',
    relationshipEffect: 'They have stopped using it, and the pilot is the reason they were asked to.',
  });
  assertEqual(raised.state, 'open', 'with one, the case is recorded as open');
  assertEqual(raised.resolvedAt, null, 'and carries no resolution date');
});

report('Concludo CRM Stage 5, workflows', r);
