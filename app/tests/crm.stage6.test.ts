/**
 * Concludo CRM, Stage 6: account planning.
 *
 * WHAT THIS SUITE COVERS, AND WHAT THE BROWSER SUITE COVERS.
 *
 * Eight of the nine areas the brief names are questions about what the
 * composition and the write path do, and they are here: plan permissions,
 * stakeholder source evidence, whitespace states, joint-plan approvals, the
 * single-contact risk, the missing decision maker, unknown-state preservation
 * and audit history.
 *
 * The ninth, using an account plan on a phone, is only answerable in a rendered
 * page and lives in `tests/browser/crm.stage6.test.mjs` along with the thing
 * this stage exists to get right: that a workspace with planning off shows no
 * trace of it anywhere in the interface.
 *
 * THE TWO PROPERTIES THIS SUITE DEFENDS HARDEST.
 *
 * Unknown is a state, not an absence. Half of these checks exist because the
 * cheapest way to make a whitespace grid look impressive is to render the cells
 * nobody has asked about as "no", and the first consequence of that is somebody
 * pitching a product the customer already declined, in front of the customer.
 *
 * Nobody is scored. The second half exists because a stakeholder map is one
 * refactor away from a leaderboard, and a number beside a person's name gets
 * acted on as though it were measured.
 *
 * Run: bun tests/crm.stage6.test.ts
 */
import { CRM_WORKSPACES, USERS } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { CrmWorkspaceData, UNCONFIRMED_ROLES } from '../src/lib/crm/domain';
import { CrmContext, CrmRefused } from '../src/lib/crm/repositories/repository';
import { auditFor, resetIdCounter } from '../src/lib/crm/stage5/writes';
import {
  accountPlansIn,
  buildAccountPlan,
} from '../src/lib/crm/stage6/accountPlan';
import { buildAccountReview } from '../src/lib/crm/stage6/accountReview';
import {
  ROLE_MEANINGS,
  buildStakeholderMap,
} from '../src/lib/crm/stage6/stakeholderMap';
import {
  buildWhitespaceGrid,
  questionsWorthAsking,
} from '../src/lib/crm/stage6/whitespace';
import { buildJointPlan, previewOf } from '../src/lib/crm/stage6/jointPlan';
import {
  affordanceFor,
  mayApprove,
  mayStartPlan,
  maySwitchPlanningOn,
  planCandidates,
  planFor,
  planningEnabled,
  planningVisibility,
} from '../src/lib/crm/stage6/visibility';
import {
  addPlanEntry,
  approveJointPlan,
  createJointPlan,
  describeRelationship,
  recordReview,
  sendForReview,
  setAccountPlanning,
  setStakeholderRole,
  setWhitespace,
  startAccountPlan,
  withdrawJointPlan,
} from '../src/lib/crm/stage6/planWrites';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual, assertRefused } = makeAssert(r);

const NOW = CRM_DEMO_NOW;
const PLANNED = 'ws-key-accounts';
const UNPLANNED = 'ws-sole-trader';

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

const refused = (code: string) => (error: unknown) =>
  error instanceof CrmRefused && error.code === code;

/* ============================================ 1. account-plan permissions */

group('Account planning is off until somebody turns it on', () => {
  const off = copyOf(UNPLANNED);
  const on = copyOf(PLANNED);

  assertEqual(planningEnabled(off), false, 'the sole trader workspace has planning off');
  assertEqual(planningEnabled(on), true, 'the key accounts workspace has it on');

  // Every fixture workspace defaults to off unless it deliberately turned it
  // on, which is what "hidden by default" has to mean in the data as well as
  // in the interface.
  const enabled = CRM_WORKSPACES.filter((d) => d.workspace.accountPlanningEnabled);
  const disabled = CRM_WORKSPACES.filter((d) => !d.workspace.accountPlanningEnabled);
  assert(disabled.length > 0, 'at least one workspace demonstrates the off state');
  assert(enabled.length > 0, 'and at least one demonstrates the on state');
  assert(
    disabled.length >= enabled.length,
    'the off state is the common one in the demonstration data, as it is in life'
  );

  // Off means nothing to see, not a locked door.
  const visibility = planningVisibility(off);
  assertEqual(visibility.showDestinations, false, 'the destinations are not offered');
  assertEqual(visibility.plannedCount, 0, 'no plans are reported');
  assert(
    (visibility.offBecause ?? '').length > 20,
    'and there is a sentence saying why, rather than an empty screen'
  );

  // The composition refuses to build a plan in a workspace that has it off,
  // even for an organisation that would otherwise have one.
  const anyOrganisation = off.organisations.find((o) => o.deletedAt === null)!;
  assertEqual(
    planFor(off, anyOrganisation.id),
    null,
    'no plan resolves while planning is off'
  );
  assertEqual(
    buildAccountPlan(off, anyOrganisation.id, NOW),
    null,
    'and the plan composition returns nothing rather than an empty scaffold'
  );
  assertEqual(planCandidates(off).length, 0, 'nothing is suggested either');
});

group('Turning planning on is an administrator’s act, and keeps what exists', () => {
  const data = copyOf(UNPLANNED);

  assertEqual(maySwitchPlanningOn('crm_contributor'), false, 'a contributor may not switch it on');
  assertEqual(maySwitchPlanningOn('crm_approver'), false, 'nor an approver');
  assertEqual(maySwitchPlanningOn('crm_admin'), true, 'an administrator may');

  assertRefused(
    () => setAccountPlanning(contextFor(data, 'crm_contributor'), data, true),
    refused('insufficient_role'),
    'the write refuses a contributor'
  );
  assertEqual(
    data.workspace.accountPlanningEnabled,
    false,
    'and the switch did not move on the way out'
  );

  setAccountPlanning(contextFor(data, 'crm_admin'), data, true);
  assertEqual(data.workspace.accountPlanningEnabled, true, 'an administrator turns it on');

  // Turning it off hides it and keeps the plans, so turning it back on does
  // not cost somebody a quarter of writing.
  const plan = startAccountPlan(contextFor(data, 'crm_contributor'), data, {
    organisationId: data.organisations[0].id,
    objective: 'Something worth planning.',
  });
  setAccountPlanning(contextFor(data, 'crm_admin'), data, false);
  assertEqual(planningEnabled(data), false, 'it goes off again');
  assert(
    data.accountPlans.some((p) => p.id === plan.id && p.deletedAt === null),
    'and the plan written while it was on is still there, undeleted'
  );
});

group('Starting a plan needs the feature on, a contributor, and an objective', () => {
  const off = copyOf(UNPLANNED);
  assertRefused(
    () =>
      startAccountPlan(contextFor(off, 'crm_admin'), off, {
        organisationId: off.organisations[0].id,
        objective: 'Anything.',
      }),
    refused('not_permitted'),
    'starting a plan while the feature is off is refused'
  );

  const on = copyOf(PLANNED);
  const unplanned = on.organisations.find((o) => !planFor(on, o.id))!;

  assertRefused(
    () =>
      startAccountPlan(contextFor(on, 'crm_viewer'), on, {
        organisationId: unplanned.id,
        objective: 'Anything.',
      }),
    refused('insufficient_role'),
    'a viewer is refused on role'
  );
  assertRefused(
    () =>
      startAccountPlan(contextFor(on, 'crm_contributor'), on, {
        organisationId: unplanned.id,
        objective: '',
      }),
    refused('invalid'),
    'a plan with no objective is refused'
  );

  // Checked BEFORE the plan is started, because starting one changes the
  // answer and an assertion that runs afterwards proves nothing.
  assertEqual(
    affordanceFor(on, unplanned, 'crm_viewer'),
    'nothing',
    'an account with no plan offers a viewer nothing, not a disabled button'
  );
  assertEqual(
    affordanceFor(on, unplanned, 'crm_contributor'),
    'offer_to_start',
    'and offers somebody who could start one the chance to'
  );

  const started = startAccountPlan(contextFor(on, 'crm_contributor'), on, {
    organisationId: unplanned.id,
    objective: 'Decide whether this is worth holding open.',
  });
  assert(started.id.length > 0, 'with all three, the plan is started');

  assertRefused(
    () =>
      startAccountPlan(contextFor(on, 'crm_contributor'), on, {
        organisationId: unplanned.id,
        objective: 'A second one.',
      }),
    refused('invalid'),
    'a second plan for the same account is refused'
  );

  // What an account page offers, which is usually nothing at all.
  const withPlan = on.organisations.find((o) => planFor(on, o.id))!;
  assertEqual(
    affordanceFor(on, withPlan, 'crm_contributor'),
    'open_plan',
    'an account with a plan offers the plan'
  );
  assertEqual(
    affordanceFor(copyOf(UNPLANNED), copyOf(UNPLANNED).organisations[0], 'crm_admin'),
    'nothing',
    'and a workspace with planning off offers nothing to anybody'
  );
});

group('A plan entry carries who wrote it', () => {
  const data = copyOf(PLANNED);
  const plan = data.accountPlans[0];

  assertRefused(
    () =>
      addPlanEntry(contextFor(data, 'crm_viewer'), data, {
        accountPlanId: plan.id,
        section: 'risk',
        body: 'Something.',
      }),
    refused('insufficient_role'),
    'a viewer cannot write in a plan'
  );

  assertRefused(
    () =>
      addPlanEntry(contextFor(data, 'crm_contributor'), data, {
        accountPlanId: plan.id,
        section: 'risk',
        body: '   ',
      }),
    refused('invalid'),
    'an empty entry is refused'
  );

  const entry = addPlanEntry(contextFor(data, 'crm_contributor'), data, {
    accountPlanId: plan.id,
    section: 'risk',
    body: 'The security schedule is still unsigned.',
  });
  assert(entry.recordedBy !== null, 'a written entry records its author');

  // Every entry in the fixture does too, so the demonstration data cannot
  // quietly contain anonymous opinions.
  const anonymous = data.accountPlanEntries.filter((e) => !e.recordedBy);
  assertEqual(anonymous.length, 0, 'no plan entry anywhere has an anonymous author');
});

/* ======================================== 2. stakeholder source evidence */

group('A role is evidenced, and a blocker cannot be set without a person and a reason', () => {
  const data = copyOf(PLANNED);
  const map = buildStakeholderMap(data, 'org-ka-1', NOW)!;
  assert(map !== null, 'the map builds');

  // The eight roles the brief names all exist and all mean something.
  for (const role of UNCONFIRMED_ROLES) {
    assert(ROLE_MEANINGS[role].length > 10, `${role}: the role says what it means`);
  }
  assert(ROLE_MEANINGS.blocker.includes('person'), 'and blocker says it is only ever set by one');

  const blocker = map.stakeholders.find((s) => s.stakeholderRole === 'blocker');
  assert(blocker !== undefined, 'the fixture demonstrates a blocker');
  assert(blocker!.confirmedBy !== null, 'the blocker has somebody’s name against it');
  assert(
    (blocker!.roleEvidence ?? '').length > 20,
    'and the sentence that earned it, not just a label'
  );

  // Nothing in the fixture is a blocker without both, because the database
  // constraint and the write path both refuse it.
  const unconfirmed = data.personOrganisationRoles.filter(
    (role) =>
      role.stakeholderRole === 'blocker' && (!role.roleConfirmedBy || !role.roleEvidence)
  );
  assertEqual(unconfirmed.length, 0, 'no blocker anywhere lacks a confirmer or a reason');

  const context = contextFor(data, 'crm_contributor');
  const target = data.personOrganisationRoles.find((p) => p.stakeholderRole === 'user')!;

  assertRefused(
    () =>
      setStakeholderRole(context, data, {
        personId: target.personId,
        organisationId: target.organisationId,
        stakeholderRole: 'blocker',
      }),
    refused('invalid'),
    'setting somebody as a blocker with no reason is refused'
  );
  assertEqual(target.stakeholderRole, 'user', 'and the role did not change on the way out');

  // Every other role is set without ceremony, because none of them is a
  // judgement about a person.
  const moved = setStakeholderRole(context, data, {
    personId: target.personId,
    organisationId: target.organisationId,
    stakeholderRole: 'champion',
  });
  assertEqual(moved.stakeholderRole, 'champion', 'an ordinary role needs no confirmation');

  const confirmed = setStakeholderRole(context, data, {
    personId: target.personId,
    organisationId: target.organisationId,
    stakeholderRole: 'blocker',
    evidence: 'Has refused to release the figures twice, and said so again on 3 October.',
  });
  assertEqual(confirmed.stakeholderRole, 'blocker', 'with a reason, it is recorded');
  assert(confirmed.roleConfirmedBy !== null, 'with the name of whoever recorded it');
  assert(confirmed.roleConfirmedAt !== null, 'and when');
});

group('How a relationship stands is described, never computed', () => {
  const data = copyOf(PLANNED);
  const context = contextFor(data, 'crm_contributor');
  const role = data.personOrganisationRoles.find((p) => p.relationshipState === 'not_recorded')!;
  assert(role !== undefined, 'the fixture has a relationship nobody has described');

  const described = describeRelationship(context, data, {
    personId: role.personId,
    organisationId: role.organisationId,
    relationshipState: 'needs_attention',
    preferredContactMethod: 'A call, never email.',
  });
  assert(described.relationshipStateBy !== null, 'a described state carries who described it');
  assert(described.relationshipStateAt !== null, 'and when');

  // Back to not recorded clears the author, because the absence of a
  // description should not look like somebody's description.
  const cleared = describeRelationship(context, data, {
    personId: role.personId,
    organisationId: role.organisationId,
    relationshipState: 'not_recorded',
  });
  assertEqual(cleared.relationshipStateBy, null, 'clearing it clears the author too');

  // Nothing in the fixture has a state with nobody behind it.
  const unattributed = data.personOrganisationRoles.filter(
    (p) => p.relationshipState !== 'not_recorded' && !p.relationshipStateBy
  );
  assertEqual(unattributed.length, 0, 'no described relationship anywhere is unattributed');
});

group('Nothing on the stakeholder map scores, ranks or orders people by quality', () => {
  const data = copyOf(PLANNED);
  const map = buildStakeholderMap(data, 'org-ka-1', NOW)!;

  // Alphabetical, deliberately. Any other order is an argument about who
  // matters, and the module has no business making one.
  const names = map.stakeholders.map((s) => s.person.fullName);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  assertEqual(names.join('|'), sorted.join('|'), 'people are in alphabetical order');

  // No numeric field about a person anywhere in the output.
  for (const s of map.stakeholders) {
    const values = Object.entries(s).filter(
      ([key, value]) => typeof value === 'number' && key !== 'daysSinceContact'
    );
    assertEqual(
      values.length,
      0,
      `${s.person.fullName}: carries no number except days since contact (${values.map(([k]) => k).join(', ')})`
    );
  }

  const text = JSON.stringify(map).toLowerCase();
  for (const banned of ['engagement score', 'influence score', 'relationship score', 'leaderboard']) {
    assertEqual(text.includes(banned), false, `the map never says "${banned}"`);
  }

  // The risks are about the process, so none of them names a person as its
  // cause in the sentence itself.
  for (const risk of map.risks) {
    for (const person of map.stakeholders) {
      const first = person.person.fullName.split(' ')[0];
      if (risk.kind === 'single_contact') continue; // names the one contact, by design
      assertEqual(
        risk.what.includes(first),
        false,
        `${risk.kind}: the risk sentence does not name ${first}`
      );
    }
  }
});

/* ============================== 5 and 6. single contact, missing decision maker */

group('A single contact and a missing decision maker are both found', () => {
  const data = copyOf(PLANNED);

  // Westmoor: one person, no role recorded, nobody holding the relationship.
  const thin = buildStakeholderMap(data, 'org-ka-4', NOW)!;
  const kinds = thin.risks.map((risk) => risk.kind);

  assert(kinds.includes('single_contact'), 'the single-contact dependency is found');
  assert(kinds.includes('no_decision_maker'), 'the missing decision maker is found');
  assert(kinds.includes('owner_unclear'), 'and the unclear relationship owner');

  const single = thin.risks.find((risk) => risk.kind === 'single_contact')!;
  assertEqual(single.people.length, 1, 'the single-contact risk names the one person');
  assert(
    single.whatWouldHelp.toLowerCase().includes('ask'),
    'and says what would help, as an action rather than a judgement'
  );

  const noDecision = thin.risks.find((risk) => risk.kind === 'no_decision_maker')!;
  assertEqual(
    noDecision.people.length,
    0,
    'the missing decision maker names nobody, because it is a gap in what we know'
  );

  // The healthy account does not report either.
  const full = buildStakeholderMap(data, 'org-ka-1', NOW)!;
  const fullKinds = full.risks.map((risk) => risk.kind);
  assertEqual(fullKinds.includes('single_contact'), false, 'an account with four people does not');
  assertEqual(
    fullKinds.includes('no_decision_maker'),
    false,
    'and one with a decision maker recorded does not either'
  );

  // The quiet threshold is the workspace's, not a hidden constant.
  const strict = buildStakeholderMap(data, 'org-ka-1', NOW, { quietAfterDays: 1 })!;
  const lax = buildStakeholderMap(data, 'org-ka-1', NOW, { quietAfterDays: 3650 })!;
  assert(
    strict.risks.filter((risk) => risk.kind === 'important_contact_quiet').length >=
      lax.risks.filter((risk) => risk.kind === 'important_contact_quiet').length,
    'a shorter quiet period finds at least as many quiet contacts as a longer one'
  );
  assertEqual(strict.quietAfterDays, 1, 'and the threshold used is reported back');
});

/* ==================================== 3 and 7. whitespace states and unknown */

group('Unknown is a state, is the default, and is never overwritten by absence', () => {
  const data = copyOf(PLANNED);
  const grid = buildWhitespaceGrid(data, 'org-ka-1', 'business_unit')!;
  assert(grid !== null, 'the grid builds');

  // THE CENTRAL PROPERTY. A cell with no row behind it is unknown, not "no".
  const neverAsked = grid.rows.flatMap((row) => row.cells).filter((cell) => cell.neverAsked);
  assert(neverAsked.length > 0, 'the fixture has cells nobody has ever recorded');
  for (const cell of neverAsked) {
    assertEqual(
      cell.state,
      'unknown',
      `${cell.product.name} at ${cell.axisValue}: a missing row renders as not known yet`
    );
    assertEqual(cell.statedBy, null, 'and carries no author, because nobody said anything');
  }

  // Unknown is counted and named, so a page cannot present a partial grid as
  // a complete one.
  assert(grid.unknownCount > 0, 'unknown cells are counted');
  assertEqual(
    grid.unknownCount,
    grid.counts.unknown,
    'and the count agrees with the state tally'
  );
  assert(
    grid.unknownNote.toLowerCase().includes('not known yet'),
    'the grid carries the sentence that explains what the state means'
  );

  // All five states are reachable, and each one says what it means.
  const states = new Set(grid.rows.flatMap((row) => row.cells).map((cell) => cell.state));
  assert(states.has('unknown'), 'unknown is demonstrated');
  assert(states.has('in_use'), 'in use is demonstrated');
  assert(states.has('not_relevant'), 'not relevant is demonstrated');
  assert(
    states.has('potential_need') || states.has('open_opportunity'),
    'and at least one of the two opportunity states'
  );

  for (const cell of grid.rows.flatMap((row) => row.cells)) {
    assert(cell.stateWord.length > 0, 'every cell says its state in words, not only a colour');
    assert(cell.stateMeaning.length > 10, 'and what that state means');
    if (cell.state === 'not_relevant') {
      assert(
        (cell.note ?? '').length > 0,
        `${cell.product.name} at ${cell.axisValue}: "not relevant" carries the reason`
      );
    }
    if (cell.state !== 'unknown' && !cell.derived) {
      assert(
        cell.statedBy !== null,
        `${cell.product.name} at ${cell.axisValue}: a claim about the customer has a claimant`
      );
    }
  }

  // The questions are the unknowns, which is the useful half of the grid.
  const questions = questionsWorthAsking(grid);
  assertEqual(questions.length, grid.unknownCount, 'every unknown cell becomes a question');
});

group('Answering a cell needs a person, and going back to unknown clears them', () => {
  const data = copyOf(PLANNED);
  const context = contextFor(data, 'crm_contributor');
  const product = data.products[0];

  const answered = setWhitespace(context, data, {
    organisationId: 'org-ka-1',
    productId: product.id,
    axis: 'business_unit',
    axisValue: 'Fabrication',
    state: 'potential_need',
  });
  assert(answered.statedBy !== null, 'answering a cell records who answered it');
  assert(answered.statedAt !== null, 'and when');

  const back = setWhitespace(context, data, {
    organisationId: 'org-ka-1',
    productId: product.id,
    axis: 'business_unit',
    axisValue: 'Fabrication',
    state: 'unknown',
  });
  assertEqual(back.state, 'unknown', 'a cell can go back to not known yet');
  assertEqual(
    back.statedBy,
    null,
    'and the author is cleared, because an unknown is nobody’s statement'
  );

  assertRefused(
    () =>
      setWhitespace(context, data, {
        organisationId: 'org-ka-1',
        productId: product.id,
        axis: 'business_unit',
        axisValue: 'Fabrication',
        state: 'not_relevant',
      }),
    refused('invalid'),
    '"not relevant" with no reason is refused, because it reads the same as nobody having asked'
  );

  assertRefused(
    () =>
      setWhitespace(contextFor(data, 'crm_viewer'), data, {
        organisationId: 'org-ka-1',
        productId: product.id,
        axis: 'business_unit',
        axisValue: 'Fabrication',
        state: 'in_use',
      }),
    refused('insufficient_role'),
    'and a viewer cannot answer a cell at all'
  );
});

group('The grid invents nothing the customer has not told us', () => {
  const data = copyOf(PLANNED);

  // An organisation with no recorded places gets an empty grid, not a grid of
  // plausible-sounding divisions.
  const bare = buildWhitespaceGrid(data, 'org-ka-4', 'business_unit')!;
  assertEqual(bare.columns.length, 0, 'no places are invented for an account that has none');
  assertEqual(bare.empty, true, 'and the grid reports itself as empty');
  assertEqual(bare.totalCells, 0, 'with no cells at all, rather than a grid of unknowns');
});

/* ======================================= 4. joint-plan approvals */

group('A joint plan is approved internally, by an approver, and goes no further', () => {
  const data = copyOf(PLANNED);

  const created = createJointPlan(contextFor(data, 'crm_contributor'), data, {
    organisationId: 'org-ka-1',
    sharedObjective: 'Get the second division live before the audit.',
  });
  assertEqual(created.approvalState, 'draft', 'a new plan starts as a draft');

  assertRefused(
    () => approveJointPlan(contextFor(data, 'crm_approver'), data, created.id),
    refused('invalid'),
    'a draft cannot be approved without somebody deliberately sending it for review'
  );

  sendForReview(contextFor(data, 'crm_contributor'), data, created.id);

  assertRefused(
    () => approveJointPlan(contextFor(data, 'crm_contributor'), data, created.id),
    refused('insufficient_role'),
    'a contributor cannot approve, even their own plan'
  );

  const approved = approveJointPlan(contextFor(data, 'crm_approver'), data, created.id);
  assertEqual(approved.approvalState, 'approved_internally', 'an approver can');
  assert(approved.approvedBy !== null, 'and the approval carries their name');
  assert(approved.approvedAt !== null, 'and the time');

  // THE LINE THIS STAGE DOES NOT CROSS. There is no state after approved
  // internally, and nothing anywhere that would send it.
  const states = data.jointPlans.map((p) => p.approvalState);
  for (const state of states) {
    assert(
      ['draft', 'internal_review', 'approved_internally', 'withdrawn'].includes(state),
      `${state} is one of the four internal states`
    );
  }

  // FIELD NAMES, not a substring search of the whole object: "share" is a
  // substring of `sharedObjective`, which is the one field a joint plan must
  // have. The property being tested is that no field exists that could send
  // this anywhere.
  const fields = new Set(data.jointPlans.flatMap((p) => Object.keys(p)));
  for (const banned of [
    'shareToken',
    'shareUrl',
    'sharedWith',
    'recipient',
    'recipientEmail',
    'publicLink',
    'externalUrl',
    'sentAt',
  ]) {
    assertEqual([...fields].includes(banned), false, `no joint plan carries a "${banned}" field`);
  }
  assert(fields.has('sharedObjective'), 'but it does carry the shared objective itself');

  const withdrawn = withdrawJointPlan(
    contextFor(data, 'crm_approver'),
    data,
    created.id,
    'The division changed its mind about the timetable.'
  );
  assertEqual(withdrawn.approvalState, 'withdrawn', 'an approved plan can be withdrawn');
  assertEqual(withdrawn.approvedAt, null, 'and the approval is cleared with it');
  assert((withdrawn.reviewNote ?? '').length > 10, 'with the reason kept');
});

group('The preview is internal, says so, and carries no way to send anything', () => {
  const data = copyOf(PLANNED);
  const view = buildJointPlan(data, 'jp-ka-1', NOW)!;
  assert(view !== null, 'the fixture has an approved joint plan');

  assert(
    view.sharingNote.toLowerCase().includes('not shared with the customer'),
    'every rendering carries the sentence saying it is not shared'
  );

  const preview = previewOf(view);
  assert(preview.actions.length > 0, 'the preview has the actions in it');
  assert(
    preview.notSharedNote === view.sharingNote,
    'and repeats the same sentence inside the preview itself'
  );

  const keys = Object.keys(preview).join(' ').toLowerCase();
  for (const banned of ['url', 'link', 'token', 'recipient', 'email', 'send']) {
    assertEqual(keys.includes(banned), false, `the preview has no "${banned}" field`);
  }

  // A plan that is not ready says what is missing rather than being silently
  // unapprovable.
  const notReady = buildJointPlan(data, 'jp-ka-2', NOW)!;
  assert(notReady.readiness.length > 0, 'an unready plan lists what to settle');
  assert(
    notReady.readiness.some((item) => item.includes('ours')),
    'including a plan where every action is ours, which is not a joint plan'
  );
  assertEqual(notReady.canBeApproved, false, 'and it cannot be approved while that is true');
});

/* ================================================ 9. audit history */

group('Every Stage 6 write leaves an audit row', () => {
  const data = copyOf(PLANNED);
  const before = data.auditEvents.length;

  const context = contextFor(data, 'crm_contributor');
  const plan = data.accountPlans[0];

  addPlanEntry(context, data, {
    accountPlanId: plan.id,
    section: 'risk',
    body: 'Something worth recording.',
  });
  setWhitespace(context, data, {
    organisationId: 'org-ka-1',
    productId: data.products[0].id,
    axis: 'business_unit',
    axisValue: 'Fabrication',
    state: 'potential_need',
  });
  describeRelationship(context, data, {
    personId: data.personOrganisationRoles[0].personId,
    organisationId: data.personOrganisationRoles[0].organisationId,
    relationshipState: 'working_well',
  });
  recordReview(context, data, { accountPlanId: plan.id, summary: 'Nothing much changed.' });

  assertEqual(
    data.auditEvents.length,
    before + 4,
    'four writes produce exactly four audit rows'
  );

  for (const event of data.auditEvents.slice(before)) {
    assert(event.actorId !== null, `${event.eventType}: the row names who did it`);
    assert(event.createdAt.length > 0, `${event.eventType}: and when`);
    assert(event.subjectTable.length > 0, `${event.eventType}: and what it was about`);
  }

  // The review moved the plan's own markers, so the next review measures from
  // the right moment without anybody remembering to update it.
  assertEqual(
    data.accountPlans.find((p) => p.id === plan.id)!.lastReviewedAt,
    NOW,
    'recording a review updates the plan it reviewed'
  );

  const planAudit = auditFor(data, 'crm_account_plan_entries', data.accountPlanEntries.at(-1)!.id);
  assert(planAudit.length > 0, 'and an entry’s own history is readable by subject');
});

/* ================================================ the plan and the review */

group('The plan carries the twenty things, and says which half is derived', () => {
  const data = copyOf(PLANNED);
  const plan = buildAccountPlan(data, 'org-ka-1', NOW)!;

  for (const key of [
    'summary',
    'objectives',
    'sections',
    'swot',
    'actions',
    'reviewCadence',
    'planOwnerUserId',
    'productsInUse',
    'openWork',
    'openServiceCases',
    'openCommitments',
    'renewalDate',
    'coverage',
    'stakeholders',
    'whitespace',
    'jointPlans',
    'pendingProposals',
    'evidence',
    'lastReviewedAt',
    'notRecorded',
  ]) {
    assert(key in plan, `the plan carries ${key}`);
  }

  assert(
    plan.derivationNote.toLowerCase().includes('read from the records'),
    'and says which half is read from the records'
  );

  // A group's figures include its divisions, and the plan says so rather than
  // silently merging them.
  assert(plan.openWork.length > 0, 'a group plan sees the work at its divisions');
  assert(
    (plan.rollUpNote ?? '').includes('divisions'),
    'and says the figures include them'
  );

  // No completeness score anywhere. What is missing is named instead.
  const text = JSON.stringify(plan).toLowerCase();
  for (const banned of ['completeness', 'health score', 'account score', 'plan score']) {
    assertEqual(text.includes(banned), false, `the plan never carries "${banned}"`);
  }

  const bare = buildAccountPlan(data, 'org-ka-4', NOW)!;
  assert(bare.notRecorded.length > 5, 'a bare plan names many things nobody has written');
  assert(
    bare.notRecorded.some((item) => item.toLowerCase().includes('never been reviewed')),
    'including that it has never been reviewed'
  );
});

group('The review shows what changed, what is owed, and what needs a person', () => {
  const data = copyOf(PLANNED);
  const plan = buildAccountPlan(data, 'org-ka-1', NOW)!;
  const review = buildAccountReview(data, plan, NOW);

  assert(review.since !== null, 'the review measures from the last one');
  assert(review.changes.length > 0, 'and finds what has changed since');
  // By DAY, not by timestamp. A decision carries the day it was made, not the
  // hour, so a decision recorded on the day of the last review counts as part
  // of it rather than being dropped for happening at the wrong time of day.
  assert(
    review.changes.every(
      (change) => change.at.slice(0, 10) >= (review.since ?? '').slice(0, 10)
    ),
    'nothing older than the day of the last review is shown as a change'
  );

  for (const key of [
    'changes',
    'completedCommitments',
    'overdueCommitments',
    'opportunities',
    'serviceIssues',
    'relationshipGaps',
    'decisionsRequired',
    'nextAgenda',
    'proposedChanges',
  ]) {
    assert(key in review, `the review carries ${key}`);
  }

  // Decisions are listed, never answered.
  for (const decision of review.decisionsRequired) {
    assert(decision.waitingOn.length > 0, 'every decision says what it waits on');
    assertEqual(
      /we should|recommend|you should/i.test(decision.what),
      false,
      `"${decision.what.slice(0, 40)}" does not tell anybody what to decide`
    );
  }

  // The agenda is headings with reasons, not a script.
  for (const item of review.nextAgenda) {
    assert(item.because.length > 10, `${item.heading}: says why it is on the list`);
  }

  // An account with nothing recorded says so rather than inventing an agenda.
  const bare = buildAccountPlan(data, 'org-ka-4', NOW)!;
  const bareReview = buildAccountReview(data, bare, NOW);
  assert(bareReview.sinceLabel.includes('never been reviewed'), 'a never-reviewed plan says so');
});

group('The index reports what exists without ranking any of it', () => {
  const data = copyOf(PLANNED);
  const plans = accountPlansIn(data, NOW);
  assert(plans.length > 0, 'the index lists the plans');

  const names = plans.map((p) => p.organisation.name);
  assertEqual(
    names.join('|'),
    [...names].sort((a, b) => a.localeCompare(b)).join('|'),
    'in alphabetical order, not by value, size or anything that reads as a ranking'
  );

  const candidates = planCandidates(data);
  for (const candidate of candidates) {
    for (const reason of candidate.reasons) {
      assertEqual(
        /should|worth more|priority|important/i.test(reason),
        false,
        `"${reason}" is a fact, not a recommendation`
      );
    }
  }
});

report('Concludo CRM Stage 6, account planning', r);
