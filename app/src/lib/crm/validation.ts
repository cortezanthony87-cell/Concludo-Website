/**
 * Validation, mirroring the database constraints.
 *
 * WHY VALIDATE TWICE.
 *
 * The database is the authority. Every rule here also exists as a constraint
 * or a trigger in `docs/migrations`, and the database refuses the write
 * whatever this file says, which is the only arrangement that survives a
 * client somebody else wrote.
 *
 * This layer exists for two other reasons. It produces a message a person can
 * act on: Postgres says `new row for relation "crm_work_items" violates check
 * constraint "crm_work_items_resolution_recorded"`, and a person needs "an
 * opportunity marked won has to record when it was resolved". And it catches
 * the mistake before a round trip, which matters on a form with twelve fields.
 *
 * The rule is that this file never knows a rule the database does not. If a
 * check appears here and nowhere in the migrations, it is advice rather than
 * validation, and advice gets bypassed.
 */
import {
  AccountPlanEntry,
  Commitment,
  CustomFieldDefinition,
  CustomFieldValue,
  Evidence,
  JointPlan,
  Lead,
  Organisation,
  Person,
  Proposal,
  Quote,
  RelationshipState,
  ServiceCase,
  StageMove,
  StakeholderRole,
  Uuid,
  WhitespaceCell,
  WorkItem,
} from './domain';

export interface ValidationProblem {
  /** The field a person should look at. */
  field: string;
  /** What is wrong, in words a person can act on. */
  message: string;
  /** The database constraint or trigger that also enforces this. */
  enforcedBy: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; problems: ValidationProblem[] };

function result(problems: ValidationProblem[]): ValidationResult {
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

const isBlank = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim().length === 0;

/* ------------------------------------------------------- organisations */

export function validateOrganisation(
  organisation: Partial<Organisation>,
  context: { allOrganisations?: Pick<Organisation, 'id' | 'parentOrganisationId' | 'crmWorkspaceId'>[] } = {}
): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (isBlank(organisation.name)) {
    problems.push({
      field: 'name',
      message: 'An organisation needs a name.',
      enforcedBy: 'crm_organisations.name NOT NULL',
    });
  }

  if (organisation.parentOrganisationId && organisation.parentOrganisationId === organisation.id) {
    problems.push({
      field: 'parentOrganisationId',
      message: 'An organisation cannot be its own parent.',
      enforcedBy: 'crm_organisations_not_own_parent',
    });
  }

  // The cycle check, which the database also performs. Done here so a person
  // choosing a parent in a picker is told immediately rather than after a
  // failed save.
  const all = context.allOrganisations ?? [];
  if (organisation.parentOrganisationId && organisation.id && all.length > 0) {
    const byId = new Map(all.map((o) => [o.id, o]));
    let cursor: string | null | undefined = organisation.parentOrganisationId;
    let depth = 0;
    while (cursor) {
      depth += 1;
      if (cursor === organisation.id) {
        problems.push({
          field: 'parentOrganisationId',
          message: 'That parent would create a loop in the organisation hierarchy.',
          enforcedBy: 'crm_guard_organisation_hierarchy',
        });
        break;
      }
      if (depth > 12) {
        problems.push({
          field: 'parentOrganisationId',
          message: 'The organisation hierarchy cannot be more than twelve levels deep.',
          enforcedBy: 'crm_guard_organisation_hierarchy',
        });
        break;
      }
      cursor = byId.get(cursor)?.parentOrganisationId ?? null;
    }
  }

  const parent = all.find((o) => o.id === organisation.parentOrganisationId);
  if (parent && organisation.crmWorkspaceId && parent.crmWorkspaceId !== organisation.crmWorkspaceId) {
    problems.push({
      field: 'parentOrganisationId',
      message: 'A parent organisation has to be in the same workspace.',
      enforcedBy: 'crm_guard_organisation_hierarchy',
    });
  }

  return result(problems);
}

/* -------------------------------------------------------------- people */

export function validatePerson(person: Partial<Person>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (isBlank(person.fullName)) {
    problems.push({
      field: 'fullName',
      message: 'A person needs a name. Everything else is optional, including an address.',
      enforcedBy: 'crm_people.full_name NOT NULL',
    });
  }

  if (person.mergedIntoPersonId && person.mergedIntoPersonId === person.id) {
    problems.push({
      field: 'mergedIntoPersonId',
      message: 'A person cannot be merged into themselves.',
      enforcedBy: 'crm_people_not_merged_into_self',
    });
  }

  // Not a database constraint, and deliberately a warning rather than a
  // refusal: a malformed address is worth flagging, and refusing to store what
  // somebody actually wrote loses information.
  if (person.primaryEmail && !person.primaryEmail.includes('@')) {
    problems.push({
      field: 'primaryEmail',
      message: 'That does not look like an email address. It will be stored as written.',
      enforcedBy: 'not enforced in the database, by design',
    });
  }

  return result(problems);
}

/* --------------------------------------------------------------- leads */

export function validateLead(lead: Partial<Lead>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (lead.state === 'not_proceeding' && isBlank(lead.notProceedingReason)) {
    problems.push({
      field: 'notProceedingReason',
      message:
        'A lead that is not proceeding needs a reason. Without one the list fills with rows nobody can tell apart from rows that were never looked at.',
      enforcedBy: 'crm_leads_not_proceeding_has_reason',
    });
  }

  if (lead.state === 'converted' && !lead.convertedPersonId) {
    problems.push({
      field: 'convertedPersonId',
      message: 'A converted lead has to say which person it became.',
      enforcedBy: 'crm_leads_converted_has_person',
    });
  }

  return result(problems);
}

/* ---------------------------------------------------------- work items */

export function validateWorkItem(item: Partial<WorkItem>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (isBlank(item.title)) {
    problems.push({
      field: 'title',
      message: 'Work needs a title.',
      enforcedBy: 'crm_work_items.title NOT NULL',
    });
  }

  const isResolved = item.status === 'won' || item.status === 'not_proceeding';

  if (isResolved && !item.resolvedAt) {
    problems.push({
      field: 'resolvedAt',
      message: 'Something marked won or not proceeding has to record when it was resolved.',
      enforcedBy: 'crm_work_items_resolution_recorded',
    });
  }

  if (!isResolved && item.resolvedAt) {
    problems.push({
      field: 'status',
      message: 'This has a resolution date but is still open or on hold. One of the two is wrong.',
      enforcedBy: 'crm_work_items_resolution_recorded',
    });
  }

  if (item.status === 'not_proceeding' && isBlank(item.resolutionReason)) {
    problems.push({
      field: 'resolutionReason',
      message: 'Say why this is not proceeding. In six months it is the only thing anybody will want to know.',
      enforcedBy: 'crm_work_items_resolution_has_reason',
    });
  }

  if (item.valueAmount !== null && item.valueAmount !== undefined && item.valueBasis === 'unknown') {
    problems.push({
      field: 'valueBasis',
      message:
        'There is a figure but its basis is unknown. Say whether the customer stated it or it was worked out.',
      enforcedBy: 'not a database constraint; a figure with no basis is legal and unhelpful',
    });
  }

  return result(problems);
}

/* ----------------------------------------------------------- stage move */

export interface StageMoveCheck {
  /** The criteria the stage declares. */
  criteria: { id: string; description: string; isRequired: boolean }[];
  /** Which of them the person says are met. */
  metCriterionIds: string[];
  overrideReason: string | null;
}

/**
 * A record must not advance silently.
 *
 * The rule is an override with a reason, not a block. An authorised person may
 * always proceed, and the CRM records that they did and why. A CRM that
 * refuses to let somebody move a deal they know is ready is a CRM people stop
 * updating, and a CRM nobody updates is worse than none.
 */
export function validateStageMove(check: StageMoveCheck): ValidationResult {
  const problems: ValidationProblem[] = [];

  const required = check.criteria.filter((c) => c.isRequired);
  const unmet = required.filter((c) => !check.metCriterionIds.includes(c.id));

  if (unmet.length > 0) {
    const reason = check.overrideReason ?? '';
    if (reason.trim().length < 10) {
      problems.push({
        field: 'overrideReason',
        message:
          unmet.length === 1
            ? `One exit criterion is not met: ${unmet[0].description}. You can still move this, with a reason of at least ten characters.`
            : `${unmet.length} exit criteria are not met: ${unmet.map((c) => c.description).join('; ')}. You can still move this, with a reason of at least ten characters.`,
        enforcedBy: 'crm_stage_history_override_has_reason',
      });
    }
  }

  return result(problems);
}

/** What the interface should show before a move, met and unmet side by side. */
export function describeStageMove(check: StageMoveCheck): {
  met: { id: string; description: string }[];
  unmet: { id: string; description: string }[];
  optionalUnmet: { id: string; description: string }[];
  needsOverrideReason: boolean;
} {
  const met = check.criteria.filter((c) => check.metCriterionIds.includes(c.id));
  const unmet = check.criteria.filter(
    (c) => c.isRequired && !check.metCriterionIds.includes(c.id)
  );
  const optionalUnmet = check.criteria.filter(
    (c) => !c.isRequired && !check.metCriterionIds.includes(c.id)
  );

  return {
    met: met.map((c) => ({ id: c.id, description: c.description })),
    unmet: unmet.map((c) => ({ id: c.id, description: c.description })),
    optionalUnmet: optionalUnmet.map((c) => ({ id: c.id, description: c.description })),
    needsOverrideReason: unmet.length > 0,
  };
}

export function validateStageMoveRecord(move: Partial<StageMove>): ValidationResult {
  const problems: ValidationProblem[] = [];
  const unmet = move.criteriaUnmet ?? [];

  if (unmet.length > 0 && (move.overrideReason ?? '').trim().length < 10) {
    problems.push({
      field: 'overrideReason',
      message: 'Moving past an unmet criterion needs a reason of at least ten characters.',
      enforcedBy: 'crm_stage_history_override_has_reason',
    });
  }

  return result(problems);
}

/* ------------------------------------------------------------ evidence */

export function validateEvidence(evidence: Partial<Evidence>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (evidence.basis === 'unknown') {
    if (!isBlank(evidence.sourceText) || !isBlank(evidence.sourceLocation)) {
      problems.push({
        field: 'basis',
        message:
          'An unknown carries no evidence. If there is a quote behind this, it is stated or inferred, not unknown.',
        enforcedBy: 'crm_evidence_unknown_has_no_source',
      });
    }
  } else if (
    evidence.sourceType !== 'none' &&
    isBlank(evidence.sourceText) &&
    isBlank(evidence.sourceLocation) &&
    !evidence.sourceRecordId
  ) {
    problems.push({
      field: 'sourceText',
      message:
        'A stated, inferred or calculated value has to say where it came from: a quote, a location in the source, or the source record.',
      enforcedBy: 'crm_evidence_known_has_source',
    });
  }

  const hasModel = !isBlank(evidence.modelVersion);
  const hasPrompt = !isBlank(evidence.promptVersion);
  if (hasModel !== hasPrompt) {
    problems.push({
      field: 'modelVersion',
      message:
        'An AI-generated assertion names both the model version and the prompt version, so a bad extraction can be traced to what produced it.',
      enforcedBy: 'crm_evidence_ai_has_versions',
    });
  }

  if ((evidence.confirmedBy === null) !== (evidence.confirmedAt === null)) {
    problems.push({
      field: 'confirmedAt',
      message: 'A confirmation records both who confirmed it and when.',
      enforcedBy: 'crm_evidence_confirmation_is_complete',
    });
  }

  if (evidence.supersededById && evidence.supersededById === evidence.id) {
    problems.push({
      field: 'supersededById',
      message: 'An assertion cannot supersede itself.',
      enforcedBy: 'crm_evidence_not_superseded_by_self',
    });
  }

  if ((evidence.conflictState === 'none') !== (evidence.conflictsWithId === null)) {
    problems.push({
      field: 'conflictsWithId',
      message: 'A conflict names the assertion it conflicts with, and vice versa.',
      enforcedBy: 'crm_evidence_conflict_is_complete',
    });
  }

  return result(problems);
}

/* ----------------------------------------------------------- proposals */

export function validateProposal(proposal: Partial<Proposal>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (!proposal.changes || proposal.changes.length === 0) {
    problems.push({
      field: 'changes',
      message:
        'A proposal has to say what would change, field by field. Approving a sentence is not approving a change.',
      enforcedBy: 'crm_proposals_has_changes',
    });
  }

  if (proposal.proposalKind === 'merge_duplicate' && proposal.isDestructive === false) {
    problems.push({
      field: 'isDestructive',
      message: 'A merge is always destructive. It cannot be undone by editing a field afterwards.',
      enforcedBy: 'crm_proposals_merge_is_destructive',
    });
  }

  if (proposal.appliedAt && proposal.state !== 'confirmed') {
    problems.push({
      field: 'appliedAt',
      message: 'Only a confirmed proposal can have been applied.',
      enforcedBy: 'crm_proposals_applied_only_when_confirmed',
    });
  }

  if (isBlank(proposal.rationale)) {
    problems.push({
      field: 'rationale',
      message: 'A proposal has to say why. A person who cannot see why cannot disagree.',
      enforcedBy: 'crm_proposals.rationale NOT NULL',
    });
  }

  return result(problems);
}

/* -------------------------------------------------------------- quotes */

export function validateQuote(quote: Partial<Quote>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (quote.state && quote.state !== 'draft' && !quote.sentOn) {
    problems.push({
      field: 'sentOn',
      message: 'A quote beyond draft has to record when it was sent.',
      enforcedBy: 'crm_quotes_sent_has_date',
    });
  }

  if (quote.state === 'declined' && isBlank(quote.declineReason)) {
    problems.push({
      field: 'declineReason',
      message: 'Record why the quote was declined. It is the most useful thing in the record later.',
      enforcedBy: 'crm_quotes_declined_has_reason',
    });
  }

  return result(problems);
}

/* ------------------------------------------------------- service cases */

export function validateServiceCase(serviceCase: Partial<ServiceCase>): ValidationResult {
  const problems: ValidationProblem[] = [];
  const isClosed = serviceCase.state === 'resolved' || serviceCase.state === 'closed';

  if (isClosed !== Boolean(serviceCase.resolvedAt)) {
    problems.push({
      field: 'resolvedAt',
      message: 'A resolved or closed case records when it was resolved, and an open one does not.',
      enforcedBy: 'crm_service_cases_resolution_recorded',
    });
  }

  if (isBlank(serviceCase.relationshipEffect)) {
    problems.push({
      field: 'relationshipEffect',
      message:
        'Say what this does to the relationship. It is the only reason a service case belongs in a CRM rather than a help desk.',
      enforcedBy: 'not a database constraint; a case with no effect is legal and pointless here',
    });
  }

  return result(problems);
}

/* --------------------------------------------------------- commitments */

export function validateCommitment(commitment: Partial<Commitment>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (isBlank(commitment.description)) {
    problems.push({
      field: 'description',
      message: 'A commitment needs to say what was promised.',
      enforcedBy: 'crm_commitments.description NOT NULL',
    });
  }

  if (isBlank(commitment.ownerName)) {
    problems.push({
      field: 'ownerName',
      message: 'A commitment needs to say who made it.',
      enforcedBy: 'crm_commitments.owner_name NOT NULL',
    });
  }

  if ((commitment.state === 'done') !== Boolean(commitment.completedAt)) {
    problems.push({
      field: 'completedAt',
      message: 'A commitment marked done records when it was done, and an open one does not.',
      enforcedBy: 'crm_commitments_completion_recorded',
    });
  }

  return result(problems);
}

/* ------------------------------------------------------- custom fields */

export function validateCustomFieldValue(
  definition: CustomFieldDefinition,
  value: Partial<CustomFieldValue>
): ValidationResult {
  const problems: ValidationProblem[] = [];

  const filled = [
    value.valueText,
    value.valueNumber,
    value.valueDate,
    value.valueBoolean,
    value.valueOptions,
  ].filter((v) => v !== null && v !== undefined).length;

  if (filled > 1) {
    problems.push({
      field: definition.fieldKey,
      message: 'Only one value can be set. Two populated columns is a value nobody can read back.',
      enforcedBy: 'crm_validate_custom_field_value',
    });
    return result(problems);
  }

  if (definition.isRequired && filled === 0) {
    problems.push({
      field: definition.fieldKey,
      message: `${definition.label} is required.`,
      enforcedBy: 'crm_validate_custom_field_value',
    });
    return result(problems);
  }

  if (filled === 0) return result(problems);

  const expectText = ['text', 'long_text', 'url', 'single_select'];
  if (expectText.includes(definition.fieldType) && value.valueText === undefined) {
    problems.push({
      field: definition.fieldKey,
      message: `${definition.label} expects text.`,
      enforcedBy: 'crm_validate_custom_field_value',
    });
  }

  if (['number', 'currency'].includes(definition.fieldType) && typeof value.valueNumber !== 'number') {
    problems.push({
      field: definition.fieldKey,
      message: `${definition.label} expects a number.`,
      enforcedBy: 'crm_validate_custom_field_value',
    });
  }

  if (definition.fieldType === 'date' && !value.valueDate) {
    problems.push({
      field: definition.fieldKey,
      message: `${definition.label} expects a date.`,
      enforcedBy: 'crm_validate_custom_field_value',
    });
  }

  if (definition.fieldType === 'boolean' && typeof value.valueBoolean !== 'boolean') {
    problems.push({
      field: definition.fieldKey,
      message: `${definition.label} expects true or false.`,
      enforcedBy: 'crm_validate_custom_field_value',
    });
  }

  if (definition.fieldType === 'single_select' && value.valueText) {
    if (!definition.options.includes(value.valueText)) {
      problems.push({
        field: definition.fieldKey,
        message: `"${value.valueText}" is not one of the options for ${definition.label}.`,
        enforcedBy: 'crm_validate_custom_field_value',
      });
    }
  }

  if (definition.fieldType === 'multi_select' && value.valueOptions) {
    const bad = value.valueOptions.filter((o) => !definition.options.includes(o));
    if (bad.length > 0) {
      problems.push({
        field: definition.fieldKey,
        message: `These are not options for ${definition.label}: ${bad.join(', ')}.`,
        enforcedBy: 'crm_validate_custom_field_value',
      });
    }
  }

  return result(problems);
}

/* --------------------------------------------- the personal boundary */

/**
 * The work and personal boundary.
 *
 * Enforced in the database by a trigger on insert and update, because a filter
 * at read is one forgotten WHERE clause from failing. This is the same rule,
 * so an interface can refuse before the round trip and say why.
 */
export function validateEmailReferenceBoundary(reference: {
  accountScope: 'work' | 'personal';
  workItemId: string | null;
  organisationId: string | null;
  workspaceScope: 'work' | 'personal';
}): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (reference.accountScope === 'personal') {
    if (reference.workItemId) {
      problems.push({
        field: 'workItemId',
        message: 'A personal mailbox reference cannot be attached to work.',
        enforcedBy: 'crm_guard_personal_boundary',
      });
    }
    if (reference.organisationId) {
      problems.push({
        field: 'organisationId',
        message: 'A personal mailbox reference cannot be attached to an organisation.',
        enforcedBy: 'crm_guard_personal_boundary',
      });
    }
    if (reference.workspaceScope === 'work') {
      problems.push({
        field: 'accountScope',
        message: 'A work workspace does not hold personal mailbox references at all.',
        enforcedBy: 'crm_guard_personal_boundary',
      });
    }
  }

  return result(problems);
}

/* ======================================== Stage 6: account planning */

/**
 * A stakeholder role, and the one role that is a judgement about a person.
 *
 * Every other role describes a position in a process: who signs, whose budget
 * it is, who uses the thing. `blocker` describes a human being as an obstacle,
 * and a CRM that lets that be inferred, imported or left over from an old deal
 * is a CRM that quietly accumulates a list of people somebody once found
 * difficult. So it needs a person's name against it and a sentence, every time,
 * and the rule is enforced here rather than left to the interface.
 */
export function validateStakeholderRole(role: {
  stakeholderRole?: StakeholderRole;
  roleConfirmedBy?: Uuid | null;
  roleEvidence?: string | null;
}): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (role.stakeholderRole === 'blocker') {
    if (!role.roleConfirmedBy) {
      problems.push({
        field: 'roleConfirmedBy',
        message:
          'Recording somebody as a blocker is a judgement about a person, so it needs the name of whoever is making it.',
        enforcedBy: 'crm_person_organisation_roles_blocker_confirmed',
      });
    }
    if (isBlank(role.roleEvidence)) {
      problems.push({
        field: 'roleEvidence',
        message:
          'Say what they did or said. In six months "blocker" with no sentence behind it is just a grudge in a database.',
        enforcedBy: 'crm_person_organisation_roles_blocker_confirmed',
      });
    }
  }

  return result(problems);
}

/**
 * How the relationship stands, when somebody has said so.
 *
 * Anything other than `not_recorded` is a described state, so it carries who
 * described it. The point is not bureaucracy: it is that a person reading
 * "needs attention" six months later can ask the person who wrote it what they
 * meant, which is impossible for a state the software decided on its own.
 */
export function validateRelationshipState(role: {
  relationshipState?: RelationshipState;
  relationshipStateBy?: Uuid | null;
}): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (role.relationshipState && role.relationshipState !== 'not_recorded') {
    if (!role.relationshipStateBy) {
      problems.push({
        field: 'relationshipStateBy',
        message:
          'How a relationship stands is somebody’s description, not a measurement, so it records who described it.',
        enforcedBy: 'crm_person_organisation_roles_state_attributed',
      });
    }
  }

  return result(problems);
}

/**
 * A whitespace cell.
 *
 * `unknown` is the only state that may exist without an author, because it is
 * what every cell is before anybody looks. Every other state is a claim about a
 * customer's business, and a claim has a claimant.
 */
export function validateWhitespaceCell(cell: Partial<WhitespaceCell>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (isBlank(cell.axisValue)) {
    problems.push({
      field: 'axisValue',
      message: 'A cell belongs to a named unit, site or region.',
      enforcedBy: 'crm_whitespace_cells_axis_value_present',
    });
  }

  if (cell.state && cell.state !== 'unknown' && !cell.statedBy) {
    problems.push({
      field: 'statedBy',
      message:
        'Anything other than "not known yet" is a statement about the customer’s business, so it records who made it.',
      enforcedBy: 'crm_whitespace_cells_stated_by',
    });
  }

  if (cell.state === 'not_relevant' && isBlank(cell.note)) {
    problems.push({
      field: 'note',
      message:
        'Say why it is not relevant. Otherwise the next person cannot tell a decision from a gap, and will ask the customer again.',
      enforcedBy: 'not a database constraint; a bare "not relevant" is indistinguishable from nobody having looked',
    });
  }

  return result(problems);
}

/**
 * A joint plan, and the line this release does not cross.
 *
 * Approval stops at "approved internally". There is no state beyond it, no
 * recipient, no link and no export, because sharing a plan outside the company
 * is an authentication and disclosure design that does not exist yet. The
 * validator refuses an approval with nobody's name on it and refuses a plan
 * with no shared objective, which is the thing that makes it joint rather than
 * a list of our own actions.
 */
export function validateJointPlan(plan: Partial<JointPlan>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (isBlank(plan.sharedObjective)) {
    problems.push({
      field: 'sharedObjective',
      message:
        'A joint plan needs something both sides are trying to achieve. Without one it is our to-do list with their name on it.',
      enforcedBy: 'crm_joint_plans_shared_objective_present',
    });
  }

  const approved = plan.approvalState === 'approved_internally';
  if (approved !== Boolean(plan.approvedAt)) {
    problems.push({
      field: 'approvedAt',
      message: 'An approved plan records when it was approved, and an unapproved one does not.',
      enforcedBy: 'crm_joint_plans_approval_recorded',
    });
  }
  if (approved && !plan.approvedBy) {
    problems.push({
      field: 'approvedBy',
      message: 'An approval is somebody taking responsibility, so it carries their name.',
      enforcedBy: 'crm_joint_plans_approval_recorded',
    });
  }

  return result(problems);
}

/** An entry in a plan: a sentence somebody wrote, with their name on it. */
export function validatePlanEntry(entry: Partial<AccountPlanEntry>): ValidationResult {
  const problems: ValidationProblem[] = [];

  if (isBlank(entry.body)) {
    problems.push({
      field: 'body',
      message: 'An empty plan entry is a heading pretending to be a thought.',
      enforcedBy: 'crm_account_plan_entries_body_present',
    });
  }

  if (!entry.recordedBy) {
    problems.push({
      field: 'recordedBy',
      message: 'A plan entry carries who wrote it, so the next person knows who to ask.',
      enforcedBy: 'crm_account_plan_entries_recorded_by',
    });
  }

  return result(problems);
}
