/**
 * The Stage 6 write path.
 *
 * Built on the same `commit` discipline as Stage 5: workspace, membership,
 * role, validation, mutation, audit row, in that order, with no path that
 * changes a record without leaving one. What is specific to this stage is the
 * set of things it REFUSES, and each refusal is here rather than in the
 * interface because an interface is one of several ways to reach a write.
 *
 *   - Nobody is recorded as a blocker without a person's name and a sentence.
 *   - How a relationship stands is never set without the name of whoever is
 *     describing it, because it is a description and not a measurement.
 *   - A whitespace cell cannot be moved off "not known yet" anonymously, and
 *     cannot be set to "not relevant" without a reason, because an unexplained
 *     "not relevant" is indistinguishable from nobody having asked.
 *   - A joint plan is approved by an approver, never by the person who wrote
 *     it acting alone, and the approval carries their name and the time.
 *   - There is no function in this file, or anywhere in this release, that
 *     shares a joint plan outside the workspace.
 */
import {
  AccountPlan,
  AccountPlanAction,
  AccountPlanEntry,
  AccountReview,
  CrmWorkspaceData,
  JointPlan,
  JointPlanAction,
  PersonOrganisationRole,
  PlanSection,
  RelationshipState,
  ReviewCadence,
  StakeholderRole,
  WhitespaceAxis,
  WhitespaceCell,
  WhitespaceState,
} from '../domain';
import { CrmContext, CrmRefused, requireRole } from '../repositories/repository';
import {
  validateJointPlan,
  validatePlanEntry,
  validateRelationshipState,
  validateStakeholderRole,
  validateWhitespaceCell,
} from '../validation';
import { commit, newId } from '../stage5/writes';

function base(now: string) {
  return { createdAt: now, updatedAt: now, deletedAt: null, deletedBy: null, purgeAfter: null };
}

/* ============================================ turning planning on */

/**
 * Switching account planning on for a workspace.
 *
 * An administrator's act, because it changes what every other person in the
 * workspace sees. There is no matching "turn it off and delete the plans":
 * switching it off hides the destinations and leaves the plans alone, so
 * turning it back on does not cost somebody a quarter of writing.
 */
export function setAccountPlanning(
  context: CrmContext,
  data: CrmWorkspaceData,
  enabled: boolean
): CrmWorkspaceData['workspace'] {
  return commit({
    context,
    data,
    role: 'crm_admin',
    doing: enabled ? 'Turning account planning on' : 'Turning account planning off',
    eventType: enabled ? 'account_planning_enabled' : 'account_planning_disabled',
    subjectTable: 'crm_workspaces',
    before: { accountPlanningEnabled: data.workspace.accountPlanningEnabled },
    detail: enabled
      ? 'Account planning is now visible in this workspace.'
      : 'Account planning is hidden. Existing plans are kept and are not deleted.',
    apply: () => {
      data.workspace.accountPlanningEnabled = enabled;
      data.workspace.updatedAt = context.now;
      return data.workspace;
    },
    subjectId: (w) => w.id,
    after: (w) => ({ accountPlanningEnabled: w.accountPlanningEnabled }),
  });
}

/* ================================================= the plan itself */

export interface StartPlan {
  organisationId: string;
  objective: string;
  reviewCadence?: ReviewCadence;
  summary?: string | null;
}

export function startAccountPlan(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: StartPlan
): AccountPlan {
  if (!data.workspace.accountPlanningEnabled) {
    throw new CrmRefused(
      'not_permitted',
      'Account planning is turned off for this workspace. An administrator turns it on.'
    );
  }

  const existing = data.accountPlans.find(
    (p) => p.organisationId === input.organisationId && p.deletedAt === null
  );
  if (existing) {
    throw new CrmRefused('invalid', 'This account already has a plan.');
  }

  if (input.objective.trim().length < 3) {
    throw new CrmRefused(
      'invalid',
      'Say what this account is for. A plan with no objective is a folder.'
    );
  }

  const plan: AccountPlan = {
    id: newId('plan'),
    crmWorkspaceId: context.workspaceId,
    organisationId: input.organisationId,
    objective: input.objective.trim(),
    reviewDate: null,
    lastReviewedAt: null,
    planOwnerUserId: context.userId,
    reviewCadence: input.reviewCadence ?? 'not_set',
    summary: input.summary?.trim() || null,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Starting an account plan',
    eventType: 'account_plan_started',
    subjectTable: 'crm_account_plans',
    apply: () => {
      data.accountPlans.push(plan);
      return plan;
    },
    subjectId: (p) => p.id,
    after: (p) => ({ objective: p.objective, organisationId: p.organisationId }),
  });
}

export interface AddPlanEntry {
  accountPlanId: string;
  section: PlanSection;
  body: string;
  evidenceId?: string | null;
}

export function addPlanEntry(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: AddPlanEntry
): AccountPlanEntry {
  const order = data.accountPlanEntries.filter(
    (e) => e.accountPlanId === input.accountPlanId && e.section === input.section
  ).length;

  const entry: AccountPlanEntry = {
    id: newId('pe'),
    crmWorkspaceId: context.workspaceId,
    accountPlanId: input.accountPlanId,
    section: input.section,
    body: input.body.trim(),
    evidenceId: input.evidenceId ?? null,
    // Not optional. A plan entry with no author is a rumour, and in six months
    // the only useful question about one is who wrote it.
    recordedBy: context.userId,
    entryOrder: order,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Writing in an account plan',
    validate: () => validatePlanEntry(entry),
    eventType: 'account_plan_entry_added',
    subjectTable: 'crm_account_plan_entries',
    apply: () => {
      data.accountPlanEntries.push(entry);
      return entry;
    },
    subjectId: (e) => e.id,
    after: (e) => ({ section: e.section, body: e.body }),
  });
}

export function addPlanAction(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: { accountPlanId: string; description: string; dueDate?: string | null; ownerUserId?: string | null }
): AccountPlanAction {
  if (input.description.trim().length < 3) {
    throw new CrmRefused('invalid', 'Say what the action is.');
  }

  const action: AccountPlanAction = {
    id: newId('pa'),
    crmWorkspaceId: context.workspaceId,
    accountPlanId: input.accountPlanId,
    description: input.description.trim(),
    actionOwnerUserId: input.ownerUserId ?? context.userId,
    dueDate: input.dueDate ?? null,
    state: 'open',
    completedAt: null,
    actionOrder: data.accountPlanActions.filter((a) => a.accountPlanId === input.accountPlanId).length,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Adding an action to an account plan',
    eventType: 'account_plan_action_added',
    subjectTable: 'crm_account_plan_actions',
    apply: () => {
      data.accountPlanActions.push(action);
      return action;
    },
    subjectId: (a) => a.id,
    after: (a) => ({ description: a.description, dueDate: a.dueDate }),
  });
}

/* ==================================== the stakeholder map's two rules */

export interface SetStakeholderRole {
  personId: string;
  organisationId: string;
  stakeholderRole: StakeholderRole;
  /** Required for `blocker`, and good practice for everything else. */
  evidence?: string | null;
  roleLabel?: string | null;
}

/**
 * Recording what part somebody plays.
 *
 * `blocker` is the only value that cannot be set without a sentence. Every
 * other role describes a position in a process; blocker describes a person as
 * an obstacle, and the refusal here is what stops that being set by an import,
 * a bulk edit or somebody in a bad mood after a lost deal.
 */
export function setStakeholderRole(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: SetStakeholderRole
): PersonOrganisationRole {
  const role = data.personOrganisationRoles.find(
    (r) =>
      r.personId === input.personId &&
      r.organisationId === input.organisationId &&
      r.endedOn === null
  );
  if (!role) {
    throw new CrmRefused('not_found', 'That person is not recorded against this organisation.');
  }

  const confirming = input.stakeholderRole === 'blocker';

  const before = {
    stakeholderRole: role.stakeholderRole,
    roleEvidence: role.roleEvidence,
  };

  const proposed = {
    stakeholderRole: input.stakeholderRole,
    roleConfirmedBy: confirming ? context.userId : role.roleConfirmedBy,
    roleEvidence: input.evidence?.trim() || role.roleEvidence,
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Recording what part somebody plays',
    validate: () => validateStakeholderRole(proposed),
    eventType: 'stakeholder_role_recorded',
    subjectTable: 'crm_person_organisation_roles',
    before,
    detail: confirming
      ? `Recorded as a blocker by this person, with a reason. ${proposed.roleEvidence ?? ''}`.trim()
      : null,
    apply: () => {
      role.stakeholderRole = input.stakeholderRole;
      role.roleEvidence = proposed.roleEvidence ?? null;
      if (confirming) {
        role.roleConfirmedBy = context.userId;
        role.roleConfirmedAt = context.now;
      }
      if (input.roleLabel !== undefined) role.roleLabel = input.roleLabel;
      role.updatedAt = context.now;
      return role;
    },
    subjectId: (r) => r.id,
    after: (r) => ({ stakeholderRole: r.stakeholderRole, roleEvidence: r.roleEvidence }),
  });
}

/**
 * Describing how a relationship stands.
 *
 * A description, never a measurement, so it records who described it. The
 * software never sets this on its own, and there is no function that computes
 * it from contact frequency, reply rate or anything else about the person.
 */
export function describeRelationship(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: {
    personId: string;
    organisationId: string;
    relationshipState: RelationshipState;
    preferredContactMethod?: string | null;
    currentObjective?: string | null;
  }
): PersonOrganisationRole {
  const role = data.personOrganisationRoles.find(
    (r) =>
      r.personId === input.personId &&
      r.organisationId === input.organisationId &&
      r.endedOn === null
  );
  if (!role) {
    throw new CrmRefused('not_found', 'That person is not recorded against this organisation.');
  }

  const proposed = {
    relationshipState: input.relationshipState,
    relationshipStateBy: input.relationshipState === 'not_recorded' ? null : context.userId,
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Describing how a relationship stands',
    validate: () => validateRelationshipState(proposed),
    eventType: 'relationship_described',
    subjectTable: 'crm_person_organisation_roles',
    before: { relationshipState: role.relationshipState },
    apply: () => {
      role.relationshipState = input.relationshipState;
      role.relationshipStateBy = proposed.relationshipStateBy;
      role.relationshipStateAt = input.relationshipState === 'not_recorded' ? null : context.now;
      if (input.preferredContactMethod !== undefined) {
        role.preferredContactMethod = input.preferredContactMethod;
      }
      if (input.currentObjective !== undefined) role.currentObjective = input.currentObjective;
      role.updatedAt = context.now;
      return role;
    },
    subjectId: (r) => r.id,
    after: (r) => ({
      relationshipState: r.relationshipState,
      preferredContactMethod: r.preferredContactMethod,
    }),
  });
}

/* ================================================= the whitespace grid */

export interface SetWhitespace {
  organisationId: string;
  productId: string;
  axis: WhitespaceAxis;
  axisValue: string;
  state: WhitespaceState;
  note?: string | null;
  evidenceId?: string | null;
  workItemId?: string | null;
}

/**
 * Answering one cell.
 *
 * Moving a cell OFF "not known yet" is a claim about the customer's business,
 * so it carries the name of whoever made it. Moving a cell BACK to "not known
 * yet" is allowed and clears the author, because somebody realising they were
 * wrong should be cheaper than leaving a wrong answer in place.
 */
export function setWhitespace(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: SetWhitespace
): WhitespaceCell {
  const existing: WhitespaceCell | undefined = data.whitespaceCells.find(
    (c) =>
      c.organisationId === input.organisationId &&
      c.productId === input.productId &&
      c.axis === input.axis &&
      c.axisValue === input.axisValue &&
      c.deletedAt === null
  );

  const unknown = input.state === 'unknown';

  /**
   * A NOTE BELONGS TO THE STATE IT WAS WRITTEN FOR.
   *
   * The first version carried the existing note forward on every change, which
   * produced this: a cell that said "Asked in August, nobody has come back"
   * while somebody was still waiting, then said "Not relevant" with the same
   * sentence under it as though that were the reason. It is not the reason, and
   * worse, it satisfied the validator that requires a reason for "not
   * relevant", so the one rule protecting that state was defeated by a sentence
   * about something else.
   *
   * So the note carries forward only while the state is unchanged. A change of
   * state with no new note clears it, and for "not relevant" the validator then
   * refuses, which is the point.
   */
  const stateUnchanged = existing !== undefined && existing.state === input.state;
  const note = input.note ?? (stateUnchanged ? (existing?.note ?? null) : null);

  const proposed: Partial<WhitespaceCell> = {
    axisValue: input.axisValue,
    state: input.state,
    note,
    statedBy: unknown ? null : context.userId,
  };

  const before = existing ? { state: existing.state, note: existing.note } : null;

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Answering a whitespace cell',
    validate: () => validateWhitespaceCell(proposed),
    eventType: 'whitespace_cell_set',
    subjectTable: 'crm_whitespace_cells',
    before,
    apply: () => {
      if (existing) {
        existing.state = input.state;
        existing.note = proposed.note ?? null;
        existing.evidenceId = input.evidenceId ?? existing.evidenceId;
        existing.workItemId = input.workItemId ?? existing.workItemId;
        existing.statedBy = unknown ? null : context.userId;
        existing.statedAt = unknown ? null : context.now;
        existing.updatedAt = context.now;
        return existing;
      }

      const cell: WhitespaceCell = {
        id: newId('ws'),
        crmWorkspaceId: context.workspaceId,
        organisationId: input.organisationId,
        productId: input.productId,
        axis: input.axis,
        axisValue: input.axisValue,
        state: input.state,
        evidenceId: input.evidenceId ?? null,
        note: proposed.note ?? null,
        workItemId: input.workItemId ?? null,
        statedBy: unknown ? null : context.userId,
        statedAt: unknown ? null : context.now,
        ...base(context.now),
      };
      data.whitespaceCells.push(cell);
      return cell;
    },
    subjectId: (c) => c.id,
    after: (c) => ({ state: c.state, note: c.note }),
  });
}

/* ================================================= the joint plan */

export function createJointPlan(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: { organisationId: string; sharedObjective: string; accountPlanId?: string | null }
): JointPlan {
  const plan: JointPlan = {
    id: newId('jp'),
    crmWorkspaceId: context.workspaceId,
    organisationId: input.organisationId,
    accountPlanId: input.accountPlanId ?? null,
    sharedObjective: input.sharedObjective.trim(),
    approvalState: 'draft',
    approvedBy: null,
    approvedAt: null,
    reviewNote: null,
    planOwnerUserId: context.userId,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Starting a joint plan',
    validate: () => validateJointPlan(plan),
    eventType: 'joint_plan_created',
    subjectTable: 'crm_joint_plans',
    apply: () => {
      data.jointPlans.push(plan);
      return plan;
    },
    subjectId: (p) => p.id,
    after: (p) => ({ sharedObjective: p.sharedObjective, approvalState: p.approvalState }),
  });
}

export function addJointAction(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: {
    jointPlanId: string;
    description: string;
    ownedByUs: boolean;
    ownerName?: string | null;
    dueDate?: string | null;
    dependsOnActionIds?: string[];
  }
): JointPlanAction {
  const plan = data.jointPlans.find((p) => p.id === input.jointPlanId && p.deletedAt === null);
  if (!plan) throw new CrmRefused('not_found', 'That joint plan is not in this workspace.');
  if (plan.approvalState === 'approved_internally') {
    throw new CrmRefused(
      'invalid',
      'This plan is approved. Changing it after approval would make the approval mean nothing, so put it back into review first.'
    );
  }
  if (input.description.trim().length < 3) {
    throw new CrmRefused('invalid', 'Say what the action is.');
  }

  const action: JointPlanAction = {
    id: newId('ja'),
    crmWorkspaceId: context.workspaceId,
    jointPlanId: input.jointPlanId,
    description: input.description.trim(),
    ownedByUs: input.ownedByUs,
    ownerUserId: input.ownedByUs ? context.userId : null,
    ownerName: input.ownerName?.trim() || null,
    dueDate: input.dueDate ?? null,
    dependsOnActionIds: input.dependsOnActionIds ?? [],
    state: 'not_started',
    evidenceId: null,
    actionOrder: data.jointPlanActions.filter((a) => a.jointPlanId === input.jointPlanId).length,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Adding an action to a joint plan',
    eventType: 'joint_plan_action_added',
    subjectTable: 'crm_joint_plan_actions',
    apply: () => {
      data.jointPlanActions.push(action);
      return action;
    },
    subjectId: (a) => a.id,
    after: (a) => ({ description: a.description, ownedByUs: a.ownedByUs }),
  });
}

/** Asking somebody here to look at it. A contributor's act. */
export function sendForReview(
  context: CrmContext,
  data: CrmWorkspaceData,
  jointPlanId: string
): JointPlan {
  const plan = data.jointPlans.find((p) => p.id === jointPlanId && p.deletedAt === null);
  if (!plan) throw new CrmRefused('not_found', 'That joint plan is not in this workspace.');
  if (plan.approvalState === 'approved_internally') {
    throw new CrmRefused('invalid', 'It is already approved.');
  }

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Sending a joint plan for review',
    eventType: 'joint_plan_sent_for_review',
    subjectTable: 'crm_joint_plans',
    before: { approvalState: plan.approvalState },
    apply: () => {
      plan.approvalState = 'internal_review';
      plan.updatedAt = context.now;
      return plan;
    },
    subjectId: (p) => p.id,
    after: (p) => ({ approvalState: p.approvalState }),
  });
}

/**
 * Approving a joint plan.
 *
 * The approver role, not the contributor one, and the name and the time are
 * recorded. This is the furthest a joint plan goes in this release: there is
 * nothing after `approved_internally`, and nothing anywhere that sends it.
 */
export function approveJointPlan(
  context: CrmContext,
  data: CrmWorkspaceData,
  jointPlanId: string
): JointPlan {
  const plan = data.jointPlans.find((p) => p.id === jointPlanId && p.deletedAt === null);
  if (!plan) throw new CrmRefused('not_found', 'That joint plan is not in this workspace.');
  if (plan.approvalState !== 'internal_review') {
    throw new CrmRefused(
      'invalid',
      'Only a plan that has been sent for review can be approved, so that somebody has deliberately asked for it.'
    );
  }

  const proposed = {
    ...plan,
    approvalState: 'approved_internally' as const,
    approvedBy: context.userId,
    approvedAt: context.now,
  };

  return commit({
    context,
    data,
    role: 'crm_approver',
    doing: 'Approving a joint plan',
    validate: () => validateJointPlan(proposed),
    eventType: 'joint_plan_approved',
    subjectTable: 'crm_joint_plans',
    before: { approvalState: plan.approvalState },
    detail:
      'Approved internally. This release has no way to share a plan outside the workspace, and this approval does not send it anywhere.',
    apply: () => {
      plan.approvalState = 'approved_internally';
      plan.approvedBy = context.userId;
      plan.approvedAt = context.now;
      plan.updatedAt = context.now;
      return plan;
    },
    subjectId: (p) => p.id,
    after: (p) => ({ approvalState: p.approvalState, approvedBy: p.approvedBy }),
  });
}

export function withdrawJointPlan(
  context: CrmContext,
  data: CrmWorkspaceData,
  jointPlanId: string,
  reason: string
): JointPlan {
  const plan = data.jointPlans.find((p) => p.id === jointPlanId && p.deletedAt === null);
  if (!plan) throw new CrmRefused('not_found', 'That joint plan is not in this workspace.');
  if (reason.trim().length < 3) {
    throw new CrmRefused('invalid', 'Say why it is being withdrawn.');
  }

  return commit({
    context,
    data,
    role: 'crm_approver',
    doing: 'Withdrawing a joint plan',
    eventType: 'joint_plan_withdrawn',
    subjectTable: 'crm_joint_plans',
    before: { approvalState: plan.approvalState },
    detail: reason.trim(),
    apply: () => {
      plan.approvalState = 'withdrawn';
      plan.approvedAt = null;
      plan.approvedBy = null;
      plan.reviewNote = reason.trim();
      plan.updatedAt = context.now;
      return plan;
    },
    subjectId: (p) => p.id,
    after: (p) => ({ approvalState: p.approvalState, reviewNote: p.reviewNote }),
  });
}

/* ================================================= the review */

export function recordReview(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: { accountPlanId: string; summary?: string | null; nextReviewDate?: string | null }
): AccountReview {
  const plan = data.accountPlans.find((p) => p.id === input.accountPlanId && p.deletedAt === null);
  if (!plan) throw new CrmRefused('not_found', 'That account plan is not in this workspace.');

  const review: AccountReview = {
    id: newId('rev'),
    crmWorkspaceId: context.workspaceId,
    accountPlanId: input.accountPlanId,
    reviewedAt: context.now,
    reviewedBy: context.userId,
    summary: input.summary?.trim() || null,
    nextReviewDate: input.nextReviewDate ?? null,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Recording an account review',
    eventType: 'account_review_recorded',
    subjectTable: 'crm_account_reviews',
    apply: () => {
      data.accountReviews.push(review);
      // The plan's own markers move with the review, so the next one measures
      // from the right moment without anybody having to remember to update it.
      plan.lastReviewedAt = context.now;
      plan.reviewDate = input.nextReviewDate ?? plan.reviewDate;
      plan.updatedAt = context.now;
      return review;
    },
    subjectId: (r) => r.id,
    after: (r) => ({ reviewedAt: r.reviewedAt, nextReviewDate: r.nextReviewDate }),
  });
}
