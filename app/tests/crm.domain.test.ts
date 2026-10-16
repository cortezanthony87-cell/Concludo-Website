/**
 * Concludo CRM, Stage 3: validation, quality, duplicates.
 *
 * WHAT THIS SUITE IS FOR.
 *
 * The rules in the brief that are easy to state and easy to implement
 * backwards. Three of them carry most of the weight:
 *
 *   A record must not advance silently, and must not be blocked either. The
 *   failure in both directions is testable: a validator that refuses an
 *   authorised move is as wrong as one that lets it through unrecorded.
 *
 *   The nine quality measures must not collapse into a score. A test can check
 *   that no function returns one and that the summary takes no owner, which is
 *   a weaker guarantee than it sounds but is the strongest one available: the
 *   thing to catch is the shape of the output, before somebody asks for a
 *   chart of it.
 *
 *   A duplicate detector has to be able to say "these are not one record".
 *   The parent-and-subsidiary pair is the case that costs real data.
 *
 * Run: bun tests/crm.domain.test.ts
 */
import {
  CustomFieldDefinition,
  Organisation,
  Person,
  ROLE_ORDER,
  roleAtLeast,
} from '../src/lib/crm/domain';
import {
  describeStageMove,
  validateCommitment,
  validateCustomFieldValue,
  validateEmailReferenceBoundary,
  validateEvidence,
  validateLead,
  validateOrganisation,
  validatePerson,
  validateProposal,
  validateQuote,
  validateServiceCase,
  validateStageMove,
  validateStageMoveRecord,
  validateWorkItem,
} from '../src/lib/crm/validation';
import {
  EXPECTED_FIELDS,
  computeOrganisationQuality,
  computePersonQuality,
  computeWorkItemQuality,
  summariseQuality,
  toRecordQualityRow,
} from '../src/lib/crm/recordQuality';
import {
  describeMerge,
  findOrganisationDuplicates,
  findPersonDuplicates,
  normaliseOrganisationName,
  proposeCandidates,
  withinEditDistance,
} from '../src/lib/crm/duplicates';
import {
  CRM_DEMO_NOW,
  activity,
  daysAgo,
  evidence,
  organisation,
  person,
  workItem,
} from '../src/lib/crm/data/factory';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual } = makeAssert(r);

const W = 'ws-test';

/** The problems a result carries, or an empty list when it is fine. */
function problemsOf(result: ReturnType<typeof validatePerson>): { field: string; message: string; enforcedBy: string }[] {
  return result.ok ? [] : result.problems;
}

function fields(result: ReturnType<typeof validatePerson>): string[] {
  return problemsOf(result).map((p) => p.field);
}

/* ============================================================== roles */

group('Roles are ordered, and the order is the whole permission model', () => {
  assertEqual(ROLE_ORDER.length, 4, 'There are four roles');
  assert(roleAtLeast('crm_admin', 'crm_viewer'), 'An admin can do what a viewer can');
  assert(roleAtLeast('crm_approver', 'crm_contributor'), 'An approver can contribute');
  assert(!roleAtLeast('crm_viewer', 'crm_contributor'), 'A viewer cannot contribute');
  assert(!roleAtLeast('crm_contributor', 'crm_approver'), 'A contributor cannot approve');
  assert(roleAtLeast('crm_viewer', 'crm_viewer'), 'A role satisfies itself');
});

/* ================================================= 1. organisations */

group('Organisation validation, including the hierarchy', () => {
  assert(validateOrganisation({ name: 'Harbourline' }).ok, 'A named organisation is valid');
  assert(fields(validateOrganisation({ name: '   ' })).includes('name'), 'A blank name is refused');

  assert(
    fields(validateOrganisation({ id: 'a', name: 'A', parentOrganisationId: 'a' })).includes(
      'parentOrganisationId'
    ),
    'An organisation cannot be its own parent'
  );

  // A two-step loop: a is parented to b, and b to a. The database refuses this
  // with a trigger; the validator refuses it in the picker so a person is told
  // before they save rather than after.
  const all = [
    { id: 'a', parentOrganisationId: 'b', crmWorkspaceId: W },
    { id: 'b', parentOrganisationId: null as string | null, crmWorkspaceId: W },
  ];
  const loop = validateOrganisation(
    { id: 'b', name: 'B', parentOrganisationId: 'a', crmWorkspaceId: W },
    { allOrganisations: all }
  );
  assert(!loop.ok, 'A loop in the hierarchy is refused');
  assert(
    problemsOf(loop).some((p) => p.enforcedBy === 'crm_guard_organisation_hierarchy'),
    'And the refusal names the trigger that also enforces it'
  );

  // Thirteen levels. Twelve is the limit, which exists because an unbounded
  // hierarchy makes every ancestry query a potential hang.
  const deep: { id: string; parentOrganisationId: string | null; crmWorkspaceId: string }[] = [];
  for (let i = 0; i < 14; i += 1) {
    deep.push({
      id: `d${i}`,
      parentOrganisationId: i === 0 ? null : `d${i - 1}`,
      crmWorkspaceId: W,
    });
  }
  const tooDeep = validateOrganisation(
    { id: 'd14', name: 'Deep', parentOrganisationId: 'd13', crmWorkspaceId: W },
    { allOrganisations: deep }
  );
  assert(!tooDeep.ok, 'A hierarchy deeper than twelve levels is refused');

  // A parent in another workspace. The one that looks harmless and is the
  // tenancy model failing.
  const crossed = validateOrganisation(
    { id: 'x', name: 'X', parentOrganisationId: 'y', crmWorkspaceId: 'ws-one' },
    { allOrganisations: [{ id: 'y', parentOrganisationId: null, crmWorkspaceId: 'ws-two' }] }
  );
  assert(!crossed.ok, 'A parent in another workspace is refused');

  // And the ordinary case, which must still pass after all that.
  const fine = validateOrganisation(
    { id: 'c', name: 'C', parentOrganisationId: 'b', crmWorkspaceId: W },
    { allOrganisations: all }
  );
  assert(fine.ok, 'A legitimate parent is accepted');
});

/* ======================================================= 2. people */

group('Person validation keeps almost everything optional', () => {
  assert(validatePerson({ fullName: 'Nadia Court' }).ok, 'A name is all a person needs');
  assert(
    fields(validatePerson({ fullName: '' })).includes('fullName'),
    'A person with no name is refused'
  );
  assert(
    validatePerson({ fullName: 'Nadia Court', primaryEmail: null, phone: null }).ok,
    'No address and no phone is normal, not an error'
  );
  assert(
    fields(validatePerson({ fullName: 'A', id: 'p1', mergedIntoPersonId: 'p1' })).includes(
      'mergedIntoPersonId'
    ),
    'A person cannot be merged into themselves'
  );

  // A malformed address is flagged and still stored as written. Refusing to
  // store what somebody actually typed loses information.
  const odd = validatePerson({ fullName: 'A', primaryEmail: 'not-an-address' });
  assert(!odd.ok, 'A malformed address is flagged');
  assert(
    problemsOf(odd)[0].message.includes('stored as written'),
    'And the message says it will be kept anyway'
  );
});

/* ======================================================== 3. leads */

group('Lead validation', () => {
  assert(validateLead({ state: 'awaiting_review' }).ok, 'A new lead needs nothing else');
  assert(
    fields(validateLead({ state: 'not_proceeding' })).includes('notProceedingReason'),
    'A lead that is not proceeding needs a reason'
  );
  assert(
    validateLead({ state: 'not_proceeding', notProceedingReason: 'Budget withdrawn' }).ok,
    'With a reason it is fine'
  );
  assert(
    fields(validateLead({ state: 'converted' })).includes('convertedPersonId'),
    'A converted lead says what it became'
  );
});

/* ==================================================== 4. work items */

group('Work item validation ties status to resolution', () => {
  assert(validateWorkItem({ title: 'Branch rollout', status: 'open' }).ok, 'An open item is fine');

  assert(
    fields(validateWorkItem({ title: 'A', status: 'won' })).includes('resolvedAt'),
    'Something won records when'
  );
  assert(
    fields(validateWorkItem({ title: 'A', status: 'open', resolvedAt: CRM_DEMO_NOW })).includes(
      'status'
    ),
    'An open item with a resolution date is contradictory'
  );
  assert(
    fields(validateWorkItem({ title: 'A', status: 'not_proceeding', resolvedAt: CRM_DEMO_NOW })).includes(
      'resolutionReason'
    ),
    'Not proceeding needs a reason'
  );
  assert(
    validateWorkItem({
      title: 'A',
      status: 'not_proceeding',
      resolvedAt: CRM_DEMO_NOW,
      resolutionReason: 'Went to an incumbent',
    }).ok,
    'With a reason and a date it is fine'
  );

  // A figure with no basis. Legal in the database, useless in a forecast, so
  // the validator says so without refusing the save.
  assert(
    fields(validateWorkItem({ title: 'A', status: 'open', valueAmount: 18000, valueBasis: 'unknown' })).includes(
      'valueBasis'
    ),
    'A figure whose basis is unknown is flagged'
  );
  assert(
    validateWorkItem({ title: 'A', status: 'open', valueAmount: 18000, valueBasis: 'inferred' }).ok,
    'An inferred figure is a legitimate figure'
  );
});

/* ========================================= 5. pipeline exit criteria */

group('A record does not advance silently, and is not blocked either', () => {
  const criteria = [
    { id: 'c1', description: 'Budget confirmed', isRequired: true },
    { id: 'c2', description: 'Decision maker identified', isRequired: true },
    { id: 'c3', description: 'Site visit done', isRequired: false },
  ];

  assert(
    validateStageMove({ criteria, metCriterionIds: ['c1', 'c2'], overrideReason: null }).ok,
    'With every required criterion met, no reason is needed'
  );

  const unmet = validateStageMove({ criteria, metCriterionIds: ['c1'], overrideReason: null });
  assert(!unmet.ok, 'An unmet required criterion needs a reason');
  assert(
    problemsOf(unmet)[0].message.includes('Decision maker identified'),
    'And the message names which criterion, not just a count'
  );
  assert(
    problemsOf(unmet)[0].message.includes('You can still move this'),
    'And says the move is possible, because the rule is a reason, not a block'
  );

  // The point of the whole design: an authorised person may always proceed.
  assert(
    validateStageMove({
      criteria,
      metCriterionIds: ['c1'],
      overrideReason: 'Client confirmed verbally at the site meeting on Tuesday',
    }).ok,
    'With a reason, the move past an unmet criterion is allowed'
  );

  // A reason of "ok" is not a reason. Ten characters is low enough not to be
  // an obstacle and high enough to stop a single keystroke.
  assert(
    !validateStageMove({ criteria, metCriterionIds: ['c1'], overrideReason: 'ok' }).ok,
    'A two-character reason is not a reason'
  );
  assert(
    !validateStageMove({ criteria, metCriterionIds: ['c1'], overrideReason: '          ' }).ok,
    'Nor is ten spaces'
  );

  // An unmet OPTIONAL criterion must not demand a reason. Requiring one for
  // every box is how the override reason becomes "n/a" on every record.
  assert(
    validateStageMove({ criteria, metCriterionIds: ['c1', 'c2'], overrideReason: null }).ok,
    'An unmet optional criterion needs nothing'
  );

  const described = describeStageMove({ criteria, metCriterionIds: ['c1'], overrideReason: null });
  assertEqual(described.met.length, 1, 'The description lists what is met');
  assertEqual(described.unmet.length, 1, 'And what is required and unmet');
  assertEqual(described.optionalUnmet.length, 1, 'And what is optional and unmet, separately');
  assert(described.needsOverrideReason, 'And says a reason will be needed');

  const clear = describeStageMove({ criteria, metCriterionIds: ['c1', 'c2', 'c3'], overrideReason: null });
  assert(!clear.needsOverrideReason, 'With everything met, no reason is asked for');

  // The stored record carries the same rule, so a move written straight to the
  // table cannot dodge it.
  assert(
    !validateStageMoveRecord({ criteriaUnmet: ['c2'], overrideReason: null }).ok,
    'A stage history row with unmet criteria and no reason is refused'
  );
  assert(
    validateStageMoveRecord({ criteriaUnmet: [], overrideReason: null }).ok,
    'And one with nothing unmet needs no reason'
  );
  assertEqual(
    problemsOf(validateStageMoveRecord({ criteriaUnmet: ['c2'], overrideReason: 'no' }))[0]
      .enforcedBy,
    'crm_stage_history_override_has_reason',
    'The refusal names the database constraint that also enforces it'
  );
});

/* ========================================= 6. evidence and conflict */

group('Evidence has to say where it came from', () => {
  const base = {
    subjectTable: 'crm_work_items',
    subjectId: 'wi-1',
    fieldName: 'expectedCloseDate',
    assertedValue: '2026-11-28',
    sourceType: 'meeting_transcript' as const,
    basis: 'stated' as const,
    confidence: 'high' as const,
    confirmedBy: null,
    confirmedAt: null,
    conflictState: 'none' as const,
    conflictsWithId: null,
  };

  assert(
    validateEvidence({ ...base, sourceText: 'We are aiming to sign by the end of November.' }).ok,
    'A stated value with a quote is valid'
  );
  assert(
    !validateEvidence({ ...base, sourceText: null, sourceLocation: null }).ok,
    'A stated value with no source at all is refused'
  );
  assert(
    validateEvidence({ ...base, sourceText: null, sourceLocation: 'Transcript, 00:14:22' }).ok,
    'A location in the source is a source'
  );

  // An unknown carries no evidence by definition. A quote behind it means it
  // is stated or inferred, and calling it unknown hides a fact that exists.
  assert(
    !validateEvidence({ ...base, basis: 'unknown', sourceText: 'Something was said' }).ok,
    'An unknown with a quote attached is refused'
  );
  assert(
    validateEvidence({ ...base, basis: 'unknown', sourceType: 'none', sourceText: null }).ok,
    'An unknown with nothing attached is valid'
  );

  // Model and prompt version travel together, so a bad extraction can be
  // traced to what produced it. One without the other traces nothing.
  assert(
    !validateEvidence({ ...base, sourceText: 'x', modelVersion: 'concludo-extract-3' }).ok,
    'A model version with no prompt version is refused'
  );
  assert(
    validateEvidence({
      ...base,
      sourceText: 'x',
      modelVersion: 'concludo-extract-3',
      promptVersion: 'crm-field-extract-7',
    }).ok,
    'Both together is valid'
  );

  assert(
    !validateEvidence({ ...base, sourceText: 'x', confirmedBy: 'u-1', confirmedAt: null }).ok,
    'A half-recorded confirmation is refused'
  );
  assert(
    !validateEvidence({ ...base, id: 'e1', sourceText: 'x', supersededById: 'e1' }).ok,
    'An assertion cannot supersede itself'
  );

  // Conflict is a pair of facts, not a flag. A state without a partner, or a
  // partner without a state, leaves one side looking settled.
  assert(
    !validateEvidence({ ...base, sourceText: 'x', conflictState: 'open', conflictsWithId: null }).ok,
    'An open conflict with no named partner is refused'
  );
  assert(
    !validateEvidence({ ...base, sourceText: 'x', conflictState: 'none', conflictsWithId: 'e2' }).ok,
    'A named partner with no conflict state is refused'
  );
  assert(
    validateEvidence({ ...base, sourceText: 'x', conflictState: 'open', conflictsWithId: 'e2' }).ok,
    'A complete conflict is valid'
  );
});

/* ======================================================= 7. proposals */

group('A proposal is a change somebody can disagree with', () => {
  const base = {
    proposalKind: 'update_work_item' as const,
    headline: 'Set the expected close date',
    rationale: 'The client named a date in the meeting on 2 October.',
    changes: [{ field: 'expectedCloseDate', from: null, to: '2026-11-28' }],
    state: 'awaiting_confirmation' as const,
    isDestructive: false,
    appliedAt: null,
  };

  assert(validateProposal(base).ok, 'A complete proposal is valid');
  assert(
    fields(validateProposal({ ...base, changes: [] })).includes('changes'),
    'A proposal with no field-level changes is refused'
  );
  assert(
    fields(validateProposal({ ...base, rationale: '  ' })).includes('rationale'),
    'A proposal with no rationale is refused'
  );
  assert(
    fields(
      validateProposal({ ...base, proposalKind: 'merge_duplicate', isDestructive: false })
    ).includes('isDestructive'),
    'A merge that claims not to be destructive is refused'
  );
  assert(
    fields(validateProposal({ ...base, appliedAt: CRM_DEMO_NOW })).includes('appliedAt'),
    'An unconfirmed proposal cannot have been applied'
  );
  assert(
    validateProposal({ ...base, state: 'confirmed', appliedAt: CRM_DEMO_NOW }).ok,
    'A confirmed and applied proposal is valid'
  );
});

/* ============================================ 8. quotes and service */

group('Quotes, service cases and commitments', () => {
  assert(validateQuote({ state: 'draft' }).ok, 'A draft quote needs no sent date');
  assert(
    fields(validateQuote({ state: 'sent' })).includes('sentOn'),
    'A sent quote records when it was sent'
  );
  assert(
    fields(validateQuote({ state: 'declined', sentOn: '2026-09-01' })).includes('declineReason'),
    'A declined quote records why'
  );

  assert(
    fields(validateServiceCase({ state: 'open', relationshipEffect: 'Trust is strained' })).length === 0,
    'An open case with a stated effect is valid'
  );
  assert(
    fields(validateServiceCase({ state: 'resolved', relationshipEffect: 'Recovered' })).includes(
      'resolvedAt'
    ),
    'A resolved case records when it was resolved'
  );
  assert(
    fields(validateServiceCase({ state: 'open' })).includes('relationshipEffect'),
    'A case with no relationship effect is flagged, because that is the only reason it is here'
  );

  assert(
    validateCommitment({ description: 'Send the statements', ownerName: 'Ruth', state: 'open' }).ok,
    'An open commitment is valid'
  );
  assert(
    fields(validateCommitment({ description: 'x', ownerName: '', state: 'open' })).includes(
      'ownerName'
    ),
    'A commitment has to say who made it'
  );
  assert(
    fields(validateCommitment({ description: 'x', ownerName: 'R', state: 'done' })).includes(
      'completedAt'
    ),
    'A commitment marked done records when'
  );
});

/* ======================================================= 9. custom fields */

function definition(over: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition {
  return {
    id: 'cf-1',
    crmWorkspaceId: W,
    subjectTable: 'crm_work_items',
    fieldKey: 'referral_source',
    label: 'Referral source',
    fieldType: 'text',
    options: [],
    isRequired: false,
    helpText: null,
    fieldOrder: 1,
    createdAt: CRM_DEMO_NOW,
    updatedAt: CRM_DEMO_NOW,
    deletedAt: null,
    deletedBy: null,
    purgeAfter: null,
    ...over,
  };
}

group('Custom fields are typed, and the type is enforced', () => {
  assert(
    validateCustomFieldValue(definition(), { valueText: 'Referred by Nadia' }).ok,
    'Text in a text field is valid'
  );
  assert(
    !validateCustomFieldValue(definition(), { valueText: 'a', valueNumber: 1 }).ok,
    'Two populated value columns is a value nobody can read back'
  );
  assert(
    validateCustomFieldValue(definition(), {}).ok,
    'An optional field left empty is valid'
  );
  assert(
    !validateCustomFieldValue(definition({ isRequired: true }), {}).ok,
    'A required field left empty is refused'
  );
  assert(
    !validateCustomFieldValue(definition({ fieldType: 'number' }), { valueText: '12' }).ok,
    'Text in a number field is refused'
  );
  assert(
    validateCustomFieldValue(definition({ fieldType: 'currency' }), { valueNumber: 1200 }).ok,
    'A number in a currency field is valid'
  );
  assert(
    !validateCustomFieldValue(definition({ fieldType: 'boolean' }), { valueText: 'true' }).ok,
    'The string "true" is not a boolean'
  );
  assert(
    validateCustomFieldValue(definition({ fieldType: 'boolean' }), { valueBoolean: false }).ok,
    'And false is a value, not an absence'
  );

  const select = definition({
    fieldType: 'single_select',
    options: ['Referral', 'Inbound', 'Event'],
  });
  assert(validateCustomFieldValue(select, { valueText: 'Referral' }).ok, 'A listed option is valid');
  assert(
    !validateCustomFieldValue(select, { valueText: 'Cold call' }).ok,
    'An option that is not on the list is refused'
  );

  const multi = definition({ fieldType: 'multi_select', options: ['A', 'B'] });
  assert(validateCustomFieldValue(multi, { valueOptions: ['A', 'B'] }).ok, 'Listed options are valid');
  const bad = validateCustomFieldValue(multi, { valueOptions: ['A', 'C'] });
  assert(!bad.ok, 'An unlisted option in a multi-select is refused');
  assert(problemsOf(bad)[0].message.includes('C'), 'And the message names the bad one');
});

/* ================================= 10. work and personal boundary */

group('The work and personal boundary', () => {
  assert(
    validateEmailReferenceBoundary({
      accountScope: 'work',
      workItemId: 'wi-1',
      organisationId: 'org-1',
      workspaceScope: 'work',
    }).ok,
    'A work mailbox reference attached to work is fine'
  );

  const attached = validateEmailReferenceBoundary({
    accountScope: 'personal',
    workItemId: 'wi-1',
    organisationId: null,
    workspaceScope: 'personal',
  });
  assert(!attached.ok, 'A personal mailbox reference cannot be attached to work');
  assertEqual(
    problemsOf(attached)[0].enforcedBy,
    'crm_guard_personal_boundary',
    'And the refusal names the trigger that also enforces it'
  );

  assert(
    !validateEmailReferenceBoundary({
      accountScope: 'personal',
      workItemId: null,
      organisationId: 'org-1',
      workspaceScope: 'personal',
    }).ok,
    'Nor to an organisation'
  );

  assert(
    !validateEmailReferenceBoundary({
      accountScope: 'personal',
      workItemId: null,
      organisationId: null,
      workspaceScope: 'work',
    }).ok,
    'And a work workspace holds no personal references at all'
  );

  assert(
    validateEmailReferenceBoundary({
      accountScope: 'personal',
      workItemId: null,
      organisationId: null,
      workspaceScope: 'personal',
    }).ok,
    'An unattached personal reference in a personal workspace is allowed'
  );
});

/* ===================================== 11. record quality, nine measures */

group('Record quality reports nine measures and never a score', () => {
  const item = workItem('wi-q1', W, 'Branch rollout', 'pipe-1', 'stg-1', {
    organisationId: 'org-1',
    primaryPersonId: null,
    valueAmount: null,
    expectedCloseDate: null,
    nextStep: null,
    nextStepDue: null,
  });

  const view = computeWorkItemQuality(item, {
    activities: [],
    evidence: [],
    duplicates: [],
    now: CRM_DEMO_NOW,
  });

  assertEqual(view.completeness.expected, EXPECTED_FIELDS.crm_work_items.length,
    'Completeness is counted against the expected field set');
  assertEqual(view.completeness.present, 1, 'One of the six expected fields is filled');
  assert(view.completeness.missing.includes('next step'), 'And the gaps are named, not counted');
  assert(view.completeness.missing.includes('primary contact'), 'Including the primary contact');
  assertEqual(view.freshnessDays, null, 'Nothing has happened, so freshness is null rather than zero');
  assert(view.missingNextStep, 'A missing next step is its own measure');
  assertEqual(view.reviewStatus, 'needs_review', 'And is enough to put the record on a review list');
  assert(view.reviewReasons.length > 0, 'With the reasons given in words');

  // Null and zero must not look the same. "Nothing has ever happened" and
  // "something happened today" are different facts about a record.
  const touched = computeWorkItemQuality(item, {
    activities: [
      activity('act-1', W, 'call', 'Scoping call', daysAgo(4), {
        workItemId: 'wi-q1',
        isMeaningfulContact: true,
      }),
      activity('act-2', W, 'note', 'Internal note', daysAgo(1), {
        workItemId: 'wi-q1',
        isMeaningfulContact: false,
      }),
    ],
    evidence: [],
    duplicates: [],
    now: CRM_DEMO_NOW,
  });
  assertEqual(touched.freshnessDays, 1, 'Freshness counts anything at all');
  assertEqual(
    touched.daysSinceMeaningfulContact,
    4,
    'Contact with the customer is a different measure from activity, and an internal note is not contact'
  );

  // Source coverage. An untraced record is a reason to look, not a fault.
  const traced = computeWorkItemQuality(item, {
    activities: [],
    evidence: [
      evidence('ev-1', W, 'crm_work_items', 'wi-q1', 'valueAmount', {
        basis: 'inferred',
        sourceText: null,
        sourceLocation: null,
        sourceType: 'none',
        confidence: 'low',
      }),
    ],
    duplicates: [],
    now: CRM_DEMO_NOW,
  });
  assertEqual(traced.sourceCoverage.total, 1, 'The assertions about the record are counted');
  assertEqual(traced.sourceCoverage.traced, 0, 'An inferred value with no source is not traced');
  assert(traced.sourceCoverage.untraced, 'And the record is marked untraced');
  assert(
    traced.reviewReasons.some((reason) => reason.includes('traced')),
    'With a reason saying so'
  );

  // The guarantee the brief asks for, as directly as a test can put it.
  const keys = Object.keys(view);
  for (const banned of ['score', 'grade', 'rating', 'percentage', 'rank', 'health']) {
    assertEqual(
      keys.filter((k) => k.toLowerCase().includes(banned)).length,
      0,
      `A quality view carries no ${banned}`
    );
  }

  const row = toRecordQualityRow(view, W, 'rq-1', CRM_DEMO_NOW);
  for (const banned of ['score', 'grade', 'rating', 'rank']) {
    assertEqual(
      Object.keys(row).filter((k) => k.toLowerCase().includes(banned)).length,
      0,
      `The stored row carries no ${banned}`
    );
  }
  assertEqual(
    row.completenessMissingFields.length,
    view.completeness.missing.length,
    'The stored row keeps the named gaps rather than a count'
  );

  const summary = summariseQuality([view, touched, traced]);
  assertEqual(summary.total, 3, 'The summary counts records');
  assertEqual(summary.untraced, 1, 'And how many are untraced');
  assertEqual(
    summariseQuality.length,
    1,
    'And summariseQuality takes one argument, so there is no owner to break it down by'
  );
  assertEqual(
    Object.keys(summary).filter((k) => /owner|user|person|staff/i.test(k)).length,
    0,
    'The summary has no per-person breakdown'
  );
});

group('Quality for people and organisations', () => {
  const p = person('per-q1', W, 'Nadia Court', { organisationId: 'org-1' });
  const pv = computePersonQuality(p, { activities: [], evidence: [], duplicates: [], now: CRM_DEMO_NOW });
  assertEqual(
    pv.completeness.expected,
    EXPECTED_FIELDS.crm_people.length,
    'A person is measured against the person field set'
  );
  assert(pv.completeness.missing.includes('a contact method'), 'A missing address is named gently');
  assert(!pv.missingNextStep, 'A person is not expected to carry a next step');

  const o = organisation('org-q1', W, 'Harbourline', {});
  const ov = computeOrganisationQuality(o, {
    activities: [],
    evidence: [],
    duplicates: [],
    now: CRM_DEMO_NOW,
  });
  assertEqual(
    ov.completeness.expected,
    EXPECTED_FIELDS.crm_organisations.length,
    'An organisation is measured against the organisation field set'
  );
  assert(!ov.missingNextStep, 'Nor is an organisation');
  assertEqual(ov.nextStep, null, 'And it has no next step at all');
});

/* ================================================== 12. duplicates */

group('The duplicate detector finds both answers', () => {
  const alike = [
    person('p1', W, 'Nadia Court', {
      organisationId: 'org-1',
      roleLabel: 'Director',
      primaryEmail: 'nadia.court@northbridgeagency.example',
    }),
    person('p2', W, 'Nadia Courte', {
      organisationId: 'org-1',
      roleLabel: 'Director',
      primaryEmail: 'n.courte@northbridgeagency.example',
    }),
  ];
  const found = findPersonDuplicates(alike);
  assertEqual(found.length, 1, 'One letter apart at the same organisation is a candidate');
  assertEqual(found[0].recommendation, 'review_together', 'Recommended for review');
  assert(found[0].differingFields.length > 0, 'And it says what differs, not only what matches');

  // The same name at two different organisations. People move and people share
  // names: saying "probably separate" is a result, and it stops the pair being
  // re-proposed every week until somebody merges them by accident.
  const moved = [
    person('p3', W, 'James Hale', { organisationId: 'org-1' }),
    person('p4', W, 'James Hale', { organisationId: 'org-2' }),
  ];
  const separate = findPersonDuplicates(moved);
  assertEqual(separate.length, 1, 'The same name at two organisations is still surfaced');
  assertEqual(separate[0].recommendation, 'likely_separate', 'But recommended as separate');

  // The strongest signal there is, and the only one that stands alone.
  const sameAddress = [
    person('p5', W, 'R Fernlea', { organisationId: 'org-1', primaryEmail: 'ruth@fernleacafe.example' }),
    person('p6', W, 'Ruth Fernlea', { organisationId: 'org-2', primaryEmail: 'Ruth@FernleaCafe.example' }),
  ];
  const byEmail = findPersonDuplicates(sameAddress);
  assertEqual(byEmail.length, 1, 'The same address is a candidate across organisations');
  assert(byEmail[0].matchingFields.includes('Email address'), 'And says the address is what matched');

  // A merged person is not a separate person. Proposing a merge for a record
  // that has already been merged is how one gets merged twice.
  const merged = [
    person('p7', W, 'A Name', { organisationId: 'org-1', primaryEmail: 'a@x.example' }),
    person('p8', W, 'A Name', { organisationId: 'org-1', primaryEmail: 'a@x.example', mergedIntoPersonId: 'p7' }),
  ];
  assertEqual(findPersonDuplicates(merged).length, 0, 'An already-merged record is not re-proposed');
});

group('A parent and its subsidiary are not a duplicate', () => {
  const parent = organisation('o1', W, 'Northbridge Agency Group', { industry: 'Real estate' });
  const child = organisation('o2', W, 'Northbridge Residential', {
    industry: 'Real estate',
    parentOrganisationId: 'o1',
    hierarchyDepth: 1,
  });

  const found = findOrganisationDuplicates([parent, child]);
  assertEqual(found.length, 1, 'The pair is surfaced');
  assertEqual(found[0].recommendation, 'likely_separate', 'And recommended as separate');
  assert(
    found[0].reason.includes('parent'),
    'With the reason saying the relationship is already recorded'
  );

  // Company suffixes carry no identity, so the same firm written two ways is
  // one firm.
  assertEqual(
    normaliseOrganisationName('Harbourline Property Pty Ltd'),
    normaliseOrganisationName('Harbourline Property'),
    'Pty Ltd is not part of a name'
  );
  const twoWays = findOrganisationDuplicates([
    organisation('o3', W, 'Harbourline Property Pty Ltd', { industry: 'Real estate' }),
    organisation('o4', W, 'Harbourline Property', { industry: 'Property management' }),
  ]);
  assertEqual(twoWays.length, 1, 'The same firm written two ways is a candidate');
  assertEqual(twoWays[0].recommendation, 'review_together', 'Recommended for review');

  // One company has one ABN.
  const sameAbn = findOrganisationDuplicates([
    organisation('o5', W, 'Fernlea Cafe', { abn: '61 701 605 898' }),
    organisation('o6', W, 'Fernlea Hospitality', { abn: '61 701 605 898' }),
  ]);
  assertEqual(sameAbn.length, 1, 'Two records with one ABN is a candidate');
  assert(sameAbn[0].matchingFields.includes('ABN'), 'And the ABN is what matched');
});

group('Decided pairs are never proposed again', () => {
  const people = [
    person('p1', W, 'Nadia Court', { organisationId: 'org-1', primaryEmail: 'a@x.example' }),
    person('p2', W, 'Nadia Court', { organisationId: 'org-1', primaryEmail: 'b@x.example' }),
  ];

  const open = proposeCandidates({ people, organisations: [], existing: [] });
  assertEqual(open.length, 1, 'With nothing decided, the pair is proposed');

  const decided = proposeCandidates({
    people,
    organisations: [],
    existing: [
      {
        id: 'dup-1',
        crmWorkspaceId: W,
        subjectTable: 'crm_people',
        // Recorded the other way round on purpose: the order of a pair is not
        // information, and a detector that re-proposes a reversed pair is a
        // detector people learn to ignore.
        leftId: 'p2',
        rightId: 'p1',
        matchingFields: ['Name'],
        differingFields: ['Email address'],
        recommendation: 'review_together',
        reason: 'Checked and kept apart.',
        state: 'kept_separate',
        decidedBy: 'u-1',
        decidedAt: CRM_DEMO_NOW,
        decisionNote: 'Two different people, confirmed with the client.',
        createdAt: CRM_DEMO_NOW,
        updatedAt: CRM_DEMO_NOW,
      },
    ],
  });
  assertEqual(decided.length, 0, 'Once decided, in either order, it is never proposed again');
});

group('A merge says what would be lost', () => {
  const keep = person('p1', W, 'Nadia Court', {
    organisationId: 'org-1',
    roleLabel: 'Director',
    primaryEmail: 'nadia.court@northbridgeagency.example',
    phone: null,
  });
  const mergeIn = person('p2', W, 'Nadia Courte', {
    organisationId: 'org-1',
    roleLabel: 'Director',
    primaryEmail: 'n.courte@northbridgeagency.example',
    phone: '+61 2 5550 0331',
  });

  const described = describeMerge(keep, mergeIn);
  assert(described.carriedOver.includes('Phone'), 'An empty field is filled from the other record');
  assert(
    described.lost.some((l) => l.includes('n.courte@northbridgeagency.example')),
    'And a conflicting field says exactly what would be lost, with the value'
  );
  assert(described.kept.includes('Organisation'), 'What is kept is listed too');
  assert(described.lost.length > 0, 'The lost list is populated, which is the list a naive merge screen omits');
});

group('Edit distance is capped rather than unbounded', () => {
  assert(withinEditDistance('court', 'courte', 2), 'One insertion is within two');
  assert(withinEditDistance('smith', 'smyth', 2), 'One substitution is within two');
  assert(!withinEditDistance('court', 'fernlea', 2), 'Two unrelated names are not');
  assert(
    !withinEditDistance('a'.repeat(400), 'b'.repeat(400), 2),
    'Two long unrelated strings are rejected without computing a full matrix'
  );
});

report('Concludo CRM Stage 3, domain', r);

export type { Organisation, Person };
