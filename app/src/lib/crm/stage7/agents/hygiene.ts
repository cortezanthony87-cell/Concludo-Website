/**
 * The Pipeline Agent and the Data Steward Agent.
 *
 * PIPELINE: it must not close, advance or reassign work without approval. That
 * is the whole constraint, and it is enforced structurally rather than by
 * discipline: this file produces proposals and proposals are not writes. There
 * is no function here that touches a work item, and the only code that moves a
 * stage is Stage 5's `moveStage`, which runs from the queue on a human
 * decision.
 *
 * DATA STEWARD: exact-duplicate automatic merging stays disabled by default. A
 * merge is the one change that cannot be undone by editing a field, so it is
 * marked destructive, it is individually approved, and it never rides in an
 * approve-all. The agent is deliberately generous about what it SHOWS and
 * deliberately conservative about what it would DO: four candidate pairs a
 * person dismisses in a minute cost less than one merge that silently combined
 * two different people with the same name.
 */
import { CrmWorkspaceData } from '../../domain';
import { buildBoard, pipelinesIn } from '../stage5Bridge';
import {
  AgentRun,
  BuildContext,
  emptyRun,
  organisationSource,
  personSource,
  propose,
  sources,
  workItemSource,
} from './build';

/* ========================================================== pipeline */

export function pipelineAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data, now } = context;

  for (const pipeline of pipelinesIn(data)) {
    const board = buildBoard(data, pipeline.id, now);
    if (!board) continue;

    for (const column of board.columns) {
      for (const card of column.cards) {
        const item = card.item;

        /* ---- stale work ---- */
        if (card.stale) {
          propose(
            context,
            {
              agent: 'pipeline',
              kind: 'review_request',
              observed: `"${item.title}" has been at ${card.stage.name} for ${card.daysInStage} days, where ${card.typicalDays} is usual here. ${card.staleReason ?? ''}`.trim(),
              sources: sources(
                workItemSource(data, item.id),
                item.organisationId ? organisationSource(data, item.organisationId) : null
              ),
              proposes:
                'Somebody looks at this and decides whether it is still live. Concludo is not proposing to close it or move it.',
              changes: [],
              confidence: 'high',
              assumptions: [],
              conflicts: [],
              missingInformation: card.missing,
              consequences: [
                'Nothing changes. Closing or moving work is a decision for a person, and this agent cannot do either.',
              ],
              approval: {
                role: 'crm_contributor',
                because: 'Acting on this changes the work item, although reading it does not.',
                individualOnly: false,
              },
            },
            run
          );
        }

        /* ---- unmet exit criteria ---- */
        const unmet = card.criteria.filter((entry) => !entry.met && entry.criterion.isRequired);
        if (unmet.length > 0) {
          propose(
            context,
            {
              agent: 'pipeline',
              kind: 'review_request',
              observed: `"${item.title}" is at ${card.stage.name} with ${unmet.length} required ${unmet.length === 1 ? 'criterion' : 'criteria'} unmet: ${unmet.map((entry) => entry.criterion.description).join('; ')}.`,
              sources: sources(workItemSource(data, item.id)),
              proposes:
                'Somebody either meets the criteria or records why the work moved past them.',
              changes: [],
              confidence: 'high',
              assumptions: [],
              conflicts: [],
              missingInformation: unmet.map((entry) => entry.criterion.description),
              consequences: [
                'Nothing changes. A stage move needs a person, and one past an unmet criterion needs a reason from them.',
              ],
              approval: {
                role: 'crm_contributor',
                because: 'Moving a stage is a records change and needs a person.',
                individualOnly: false,
              },
            },
            run
          );
        }

        /* ---- a close date that has moved repeatedly ---- */
        if (card.closeDateChanges.length >= 3) {
          propose(
            context,
            {
              agent: 'pipeline',
              kind: 'review_request',
              observed: `The expected close date on "${item.title}" has moved ${card.closeDateChanges.length} times. The last reason recorded was: ${card.closeDateChanges.at(-1)?.reason ?? 'none'}.`,
              sources: sources(workItemSource(data, item.id)),
              proposes:
                'Somebody checks whether the date on this record is one the customer has actually agreed to.',
              changes: [],
              confidence: 'high',
              assumptions: [],
              conflicts: [],
              missingInformation: [],
              consequences: ['Nothing changes. The date is only changed by a person.'],
              approval: {
                role: 'crm_contributor',
                because: 'Changing an expected date changes a record.',
                individualOnly: false,
              },
            },
            run
          );
        }

        /* ---- no next step ---- */
        if (!item.nextStep) {
          propose(
            context,
            {
              agent: 'pipeline',
              kind: 'update_next_step',
              observed: `"${item.title}" is open at ${card.stage.name} with no next step recorded.`,
              sources: sources(workItemSource(data, item.id)),
              proposes: 'Somebody records what happens next.',
              changes: [],
              confidence: 'high',
              assumptions: [],
              conflicts: [],
              missingInformation: ['What the next step is. Nothing here states one.'],
              consequences: ['Nothing changes until a person writes one.'],
              approval: {
                role: 'crm_contributor',
                because: 'A next step is a field on the work item.',
                individualOnly: false,
              },
            },
            run
          );
        }
      }
    }
  }

  /* ---- missing stakeholder roles on accounts with open work ---- */
  const accountsWithWork = [
    ...new Set(
      data.workItems
        .filter((item) => item.status === 'open' && item.deletedAt === null)
        .map((item) => item.organisationId)
        .filter((id): id is string => id !== null)
    ),
  ];

  for (const organisationId of accountsWithWork) {
    const roles = data.personOrganisationRoles.filter(
      (role) => role.organisationId === organisationId && role.endedOn === null
    );
    const held = new Set(roles.map((role) => role.stakeholderRole));
    if (held.has('decision_maker')) continue;

    propose(
      context,
      {
        agent: 'pipeline',
        kind: 'review_request',
        observed: `There is open work at this account and nobody is recorded as the person who says yes.`,
        sources: sources(organisationSource(data, organisationId)),
        proposes: 'Somebody asks who signs this off and records the answer.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: ['Who makes the decision at this account'],
        consequences: ['Nothing changes. Recording a role is a person’s job.'],
        approval: {
          role: 'crm_contributor',
          because: 'Recording a stakeholder role changes a record.',
          individualOnly: false,
        },
      },
      run
    );
  }

  return run;
}

/* ===================================================== data steward */

export function dataStewardAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data, now } = context;

  /* ---- possible duplicates ---- */
  const live = data.people.filter((p) => p.deletedAt === null && p.mergedIntoPersonId === null);

  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      if (a.organisationId !== b.organisationId) continue;

      const sameEmail =
        a.primaryEmail !== null &&
        b.primaryEmail !== null &&
        a.primaryEmail.toLowerCase() === b.primaryEmail.toLowerCase();

      const closeName =
        a.fullName.toLowerCase().replace(/\s+/g, '') ===
          b.fullName.toLowerCase().replace(/\s+/g, '') ||
        editDistance(a.fullName.toLowerCase(), b.fullName.toLowerCase()) <= 2;

      if (!sameEmail && !closeName) continue;

      const differences: string[] = [];
      if (a.primaryEmail !== b.primaryEmail) {
        differences.push(`Different addresses: ${a.primaryEmail ?? 'none'} and ${b.primaryEmail ?? 'none'}`);
      }
      if (a.roleLabel !== b.roleLabel) {
        differences.push(`Different roles: ${a.roleLabel ?? 'none'} and ${b.roleLabel ?? 'none'}`);
      }
      if (a.phone !== b.phone && (a.phone || b.phone)) {
        differences.push(`Different phone numbers`);
      }

      propose(
        context,
        {
          agent: 'data_steward',
          kind: 'merge_duplicate',
          observed: `${a.fullName} and ${b.fullName} are both recorded at the same organisation, and ${sameEmail ? 'they share an email address' : 'their names differ by a character or two'}.`,
          sources: sources(personSource(data, a.id), personSource(data, b.id)),
          proposes: `A person decides whether these are the same human being. Concludo does not merge records on its own, and automatic merging of exact duplicates is off.`,
          changes: [],
          confidence: sameEmail ? 'high' : 'moderate',
          assumptions: [],
          conflicts: differences,
          missingInformation: differences.length === 0 ? [] : ['Which of the differing values is right'],
          consequences: [
            'A merge cannot be undone by editing a field. Everything attached to one record moves to the other, including conversations and commitments.',
            'If these are two different people who happen to share a name, merging them puts one person’s conversations on the other’s record.',
          ],
          approval: {
            role: 'crm_approver',
            because: 'A merge is the one change that cannot be undone by editing a field.',
            individualOnly: true,
          },
          isDestructive: true,
        },
        run
      );
    }
  }

  /* ---- records nobody has touched ---- */
  const cutoff = new Date(new Date(now).getTime() - 180 * 86_400_000).toISOString();
  const untouched = data.organisations.filter(
    (organisation) =>
      organisation.deletedAt === null &&
      organisation.updatedAt < cutoff &&
      organisation.lifecycleState !== 'dormant'
  );

  for (const organisation of untouched) {
    propose(
      context,
      {
        agent: 'data_steward',
        kind: 'review_request',
        observed: `Nothing on ${organisation.name} has been updated since ${organisation.updatedAt.slice(0, 10)}, and it is not recorded as dormant.`,
        sources: sources(organisationSource(data, organisation.id)),
        proposes: 'Somebody decides whether this account is still active, or marks it dormant.',
        changes: [],
        confidence: 'moderate',
        assumptions: [
          'That no update means no activity. A conversation that happened and was never recorded looks the same from here.',
        ],
        conflicts: [],
        missingInformation: ['Whether anything has happened that was not written down'],
        consequences: ['Nothing changes. Marking an account dormant is a person’s decision.'],
        approval: {
          role: 'crm_contributor',
          because: 'Changing a lifecycle state changes a record.',
          individualOnly: false,
        },
      },
      run
    );
  }

  /* ---- unlinked activities ---- */
  const unlinked = data.activities.filter(
    (activity) =>
      activity.deletedAt === null &&
      activity.organisationId === null &&
      activity.workItemId === null
  );
  if (unlinked.length > 0) {
    propose(
      context,
      {
        agent: 'data_steward',
        kind: 'review_request',
        observed: `${unlinked.length} ${unlinked.length === 1 ? 'conversation is' : 'conversations are'} recorded against no account and no work.`,
        sources: sources(...unlinked.slice(0, 5).map((a) => ({
          table: 'crm_activities',
          id: a.id,
          label: a.title,
          quote: a.summary,
          path: '/crm/activities',
        }))),
        proposes:
          'Somebody files them. The capture agent has proposed where it can; these are the ones it could not.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: ['Which account each one belongs to'],
        consequences: ['Nothing changes.'],
        approval: {
          role: 'crm_contributor',
          because: 'Filing a conversation changes a record.',
          individualOnly: false,
        },
        scanned: unlinked.map((a) => a.summary),
      },
      run
    );
  }

  /* ---- invalid formatting ---- */
  const badEmails = data.people.filter(
    (person) =>
      person.deletedAt === null &&
      person.primaryEmail !== null &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.primaryEmail)
  );

  for (const person of badEmails) {
    propose(
      context,
      {
        agent: 'data_steward',
        kind: 'correct_field',
        observed: `The address recorded for ${person.fullName} is "${person.primaryEmail}", which is not a usable email address.`,
        sources: sources(personSource(data, person.id)),
        proposes: 'Somebody corrects it or clears it. Concludo is not guessing what it should be.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: ['What the address actually is'],
        consequences: [
          'Nothing changes. Anything sent to this address would not arrive, so nothing is addressed to it.',
        ],
        approval: {
          role: 'crm_contributor',
          because: 'Correcting a contact detail changes a record.',
          individualOnly: false,
        },
      },
      run
    );
  }

  /* ---- conflicting values, from the evidence table ---- */
  const conflicted = data.evidence.filter(
    (evidence) => evidence.conflictState === 'open' && evidence.deletedAt === null
  );

  for (const evidence of conflicted) {
    const other = data.evidence.find((e) => e.id === evidence.conflictsWithId);
    propose(
      context,
      {
        agent: 'data_steward',
        kind: 'correct_field',
        observed: `Two records disagree about ${evidence.fieldName}: "${evidence.assertedValue ?? 'nothing'}" and "${other?.assertedValue ?? 'nothing'}".`,
        sources: sources(
          { table: 'crm_evidence', id: evidence.id, label: `${evidence.fieldName}, one version`, quote: evidence.sourceText, path: null },
          other
            ? { table: 'crm_evidence', id: other.id, label: `${evidence.fieldName}, the other version`, quote: other.sourceText, path: null }
            : null
        ),
        proposes: 'Somebody says which is right. Concludo is not choosing between two things a customer said.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [
          `"${evidence.assertedValue ?? 'nothing'}" against "${other?.assertedValue ?? 'nothing'}". Both were recorded from a conversation.`,
        ],
        missingInformation: ['Which of the two is current'],
        consequences: ['Nothing changes until a person settles it.'],
        approval: {
          role: 'crm_contributor',
          because: 'Settling a conflict writes one of the two values onto the record.',
          individualOnly: false,
        },
        scanned: [evidence.sourceText, other?.sourceText],
      },
      run
    );
  }

  return run;
}

/** Levenshtein, small and local, because this is the only place it is needed. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] =
        a[i - 1] === b[j - 1]
          ? rows[i - 1][j - 1]
          : 1 + Math.min(rows[i - 1][j], rows[i][j - 1], rows[i - 1][j - 1]);
    }
  }
  return rows[a.length][b.length];
}

/**
 * Automatic merging, which is off.
 *
 * The constant exists so a test can assert its value and so a future change has
 * to be a deliberate edit to a named thing rather than a default somebody
 * drifted past. Turning it on would also need the merge path to stop being
 * `individualOnly`, which the contract validator enforces separately.
 */
export const AUTOMATIC_EXACT_DUPLICATE_MERGE_ENABLED = false;

export function mergeWouldBeAutomatic(): boolean {
  return AUTOMATIC_EXACT_DUPLICATE_MERGE_ENABLED;
}
