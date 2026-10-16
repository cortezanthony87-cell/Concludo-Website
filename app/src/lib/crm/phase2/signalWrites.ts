/**
 * Deciding something about an attention condition.
 *
 * Two acts, and they are different: acknowledging a condition says "I have
 * seen this and I am dealing with it", and dismissing it says "this is not a
 * problem here". Both stay on the record, both carry a reason, and both go
 * through the one `commit()` so they arrive with an audit row like every other
 * write in the product.
 *
 * WHY A DISMISSAL EXPIRES.
 *
 * A dismissal with no end date is how an attention list quietly empties
 * itself. Somebody dismisses "renewal approaching" in March because the
 * renewal was handled by a colleague, and in August the product has stopped
 * mentioning the renewal that is now two weeks away. The decision was right
 * and it was about March.
 *
 * So a dismissal defaults to 90 days and can be set shorter. It cannot be set
 * to never: `forever` is not a value this module accepts, and the database
 * does not have a column that would hold it. Where a condition genuinely does
 * not apply to an account, the answer is to change the record that makes it
 * fire, which is what `whatWouldClearIt` tells the person on every signal.
 *
 * WHAT IS NOT HERE. There is no bulk dismiss. Dismissing eleven conditions on
 * forty accounts with one click is the feature that turns this page into a
 * page nobody reads, and a reason typed once and applied to four hundred and
 * forty signals is not a reason.
 */

import { AttentionCondition, CrmWorkspaceData, RelationshipSignalState } from '../domain';
import { CrmContext, CrmRefused } from '../repositories/repository';
import { commit, newId } from '../stage5/writes';
import { attentionFor } from './signals';

const DAY = 86_400_000;

/** The default life of a dismissal, and the longest one this module allows. */
export const DEFAULT_DISMISSAL_DAYS = 90;
export const MAX_DISMISSAL_DAYS = 180;

export interface DecideSignal {
  organisationId: string;
  condition: AttentionCondition;
  state: 'acknowledged' | 'dismissed';
  /** Required. Never defaulted, never blank. */
  reason: string;
  /** Days until the decision lapses. Clamped to MAX_DISMISSAL_DAYS. */
  forDays?: number;
}

export function decideSignal(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: DecideSignal
): RelationshipSignalState {
  const reason = input.reason.trim();

  if (reason === '') {
    throw new CrmRefused(
      'invalid',
      'A reason is needed. It is the only record of why this stopped being shown, and the person who sees the account next is the one who needs it.'
    );
  }
  if (reason.length < 10) {
    throw new CrmRefused(
      'invalid',
      'A reason of a few words is not a reason. Write the sentence somebody reading this account in three months would need.'
    );
  }

  const organisation = data.organisations.find(
    (candidate) => candidate.id === input.organisationId && candidate.deletedAt === null
  );
  if (!organisation) {
    throw new CrmRefused('not_found', 'That organisation is not in this workspace.');
  }

  // The condition has to actually be true before somebody can decide about it.
  // Dismissing a condition that is not firing records a decision about nothing
  // and, worse, suppresses the condition the day it becomes true.
  const attention = attentionFor(data, input.organisationId, context.now);
  const live = [...(attention?.signals ?? []), ...(attention?.dismissed ?? [])].find(
    (signal) => signal.condition === input.condition
  );
  if (!live) {
    throw new CrmRefused(
      'not_permitted',
      'That condition is not currently true of this account, so there is nothing to decide about. A condition can only be dismissed while it is showing.'
    );
  }

  const days = Math.min(input.forDays ?? DEFAULT_DISMISSAL_DAYS, MAX_DISMISSAL_DAYS);

  const row: RelationshipSignalState = {
    id: newId('rsig'),
    crmWorkspaceId: context.workspaceId,
    organisationId: input.organisationId,
    condition: input.condition,
    state: input.state,
    reason,
    decidedBy: context.userId,
    decidedAt: context.now,
    expiresAt: new Date(Date.parse(context.now) + days * DAY).toISOString(),
    // What it said at the moment it was decided. A dismissal read a year later
    // without this is a reason with nothing to attach it to.
    detailAtDecision: live.detail,
    computedAt: null,
    createdAt: context.now,
    updatedAt: context.now,
  };

  return commit({
    context,
    data,
    // Contributor, not approver. Deciding that a condition does not apply to an
    // account is ordinary work on a record, and putting it behind the approver
    // role would mean nobody tidies the list.
    role: 'crm_contributor',
    doing: input.state === 'dismissed' ? 'Dismissing an attention condition' : 'Acknowledging an attention condition',
    eventType:
      input.state === 'dismissed' ? 'attention_condition_dismissed' : 'attention_condition_acknowledged',
    subjectTable: 'crm_relationship_signals',
    detail: `${input.condition}: ${reason}`,
    apply: () => {
      data.relationshipSignals.push(row);
      return row;
    },
    subjectId: (written) => written.id,
    after: (written) => ({
      organisationId: written.organisationId,
      condition: written.condition,
      state: written.state,
      expiresAt: written.expiresAt,
    }),
  });
}

/**
 * Undo a decision, which is a decision in its own right.
 *
 * It does not delete the row. The history of what was dismissed and why is
 * worth more than a tidy table, and a dismissal that vanishes when it is
 * reversed is a dismissal nobody can learn from.
 */
export function restoreSignal(
  context: CrmContext,
  data: CrmWorkspaceData,
  signalStateId: string,
  reason: string
): RelationshipSignalState {
  const row = data.relationshipSignals.find((candidate) => candidate.id === signalStateId);
  if (!row) {
    throw new CrmRefused('not_found', 'That decision is not in this workspace.');
  }
  if (reason.trim().length < 10) {
    throw new CrmRefused(
      'invalid',
      'A reason is needed for putting a condition back, the same as for taking it away.'
    );
  }

  const before = { state: row.state, expiresAt: row.expiresAt };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Putting an attention condition back',
    eventType: 'attention_condition_restored',
    subjectTable: 'crm_relationship_signals',
    before,
    detail: reason.trim(),
    apply: () => {
      // Expiring it now rather than deleting it: the row stays, the condition
      // comes back, and the audit trail reads as a sequence of decisions.
      row.expiresAt = context.now;
      row.updatedAt = context.now;
      return row;
    },
    subjectId: (written) => written.id,
    after: (written) => ({ state: written.state, expiresAt: written.expiresAt }),
  });
}
