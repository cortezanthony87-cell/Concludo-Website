/**
 * The Capture Agent and the Follow-through Agent.
 *
 * Both work on what came out of a conversation, and both are governed by one
 * rule each that matters more than everything else they do.
 *
 * CAPTURE: it must never silently attach sensitive information to the wrong
 * customer record. So it proposes a link only where the record itself gives a
 * reason, it says which reason, and where two customers are plausible it
 * proposes NOTHING and asks a person. A capture agent that guesses between two
 * accounts is a capture agent that eventually files one client's service
 * complaint against another client, and nobody finds out until a review.
 *
 * FOLLOW-THROUGH: it must never invent an owner or a date. This sounds obvious
 * and it is the single most common failure of meeting-summary tooling, because
 * "we'll get that over to you next week" has no owner and no date in it, and an
 * extractor that fills them in produces a task list that looks complete and is
 * fiction. Here, an unnamed owner stays unnamed and appears as missing
 * information.
 */
import { CrmWorkspaceData } from '../../domain';
import { AgentProposal } from '../contract';
import { quoteForDisplay, untrusted } from '../untrusted';
import {
  AgentRun,
  BuildContext,
  activitySource,
  emptyRun,
  organisationSource,
  personSource,
  propose,
  sources,
  workItemSource,
} from './build';

/* =========================================================== capture */

/**
 * What a conversation should be attached to.
 *
 * The agent looks at activities that are not yet attached to an organisation or
 * to work, and proposes the attachment the record already implies: a
 * participant who belongs to one organisation, an organisation with exactly one
 * open piece of work, an email address whose domain matches one account.
 *
 * Where more than one customer is plausible, it proposes nothing and raises the
 * ambiguity instead. That is the whole design.
 */
export function captureAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data } = context;

  const unattached = data.activities.filter(
    (activity) => activity.deletedAt === null && activity.organisationId === null
  );

  for (const activity of unattached) {
    const participantIds = data.activityParticipants
      .filter((participant) => participant.activityId === activity.id && participant.personId)
      .map((participant) => participant.personId as string);

    const people = data.people.filter(
      (person) => participantIds.includes(person.id) && person.deletedAt === null
    );

    const organisationIds = [
      ...new Set(people.map((person) => person.organisationId).filter((id): id is string => id !== null)),
    ];

    const content = untrusted(activity.summary, 'crm_activities', activity.id);

    /* ---- the ambiguous case, which is the one that matters ---- */
    if (organisationIds.length > 1) {
      const names = organisationIds
        .map((id) => data.organisations.find((o) => o.id === id)?.name)
        .filter((name): name is string => Boolean(name));

      propose(
        context,
        {
          agent: 'capture',
          kind: 'flag_for_attention',
          observed: `People from ${names.length} different organisations were in "${activity.title}", and it is not attached to any account.`,
          sources: sources(
            activitySource(data, activity.id),
            ...organisationIds.map((id) => organisationSource(data, id))
          ),
          proposes:
            'Somebody decides which account this belongs to. Nothing is attached until they do.',
          changes: [],
          confidence: 'high',
          assumptions: [],
          conflicts: [
            `This conversation could belong to ${names.join(' or ')}. Attaching it to the wrong one would file what was said against the wrong customer.`,
          ],
          missingInformation: ['Which account this conversation was actually about'],
          consequences: [
            'Nothing changes until a person chooses. That is deliberate: a guess here puts one customer’s conversation on another customer’s record.',
          ],
          approval: {
            role: 'crm_contributor',
            because: 'Attaching a conversation to an account is a records change.',
            individualOnly: true,
          },
          scanned: [content.text],
        },
        run
      );
      continue;
    }

    /* ---- the clear case ---- */
    if (organisationIds.length === 1) {
      const organisationId = organisationIds[0];
      const organisation = data.organisations.find((o) => o.id === organisationId);
      if (!organisation) continue;

      const openWork = data.workItems.filter(
        (item) =>
          item.organisationId === organisationId &&
          item.status === 'open' &&
          item.deletedAt === null
      );

      const changes = [
        {
          table: 'crm_activities',
          recordId: activity.id,
          field: 'organisationId',
          from: null,
          to: organisationId,
          fromLabel: 'Not attached',
          toLabel: organisation.name,
        },
      ];

      // Work is attached only where there is exactly one candidate. Two open
      // deals at one account is the same ambiguity one level down.
      if (openWork.length === 1) {
        changes.push({
          table: 'crm_activities',
          recordId: activity.id,
          field: 'workItemId',
          from: null,
          to: openWork[0].id,
          fromLabel: 'Not attached',
          toLabel: openWork[0].title,
        });
      }

      propose(
        context,
        {
          agent: 'capture',
          kind: 'update_work_item',
          observed: `"${activity.title}" has ${people.length} ${people.length === 1 ? 'participant' : 'participants'} recorded, and ${people.length === 1 ? 'they work' : 'all of them work'} at ${organisation.name}. The conversation is not attached to any account.`,
          sources: sources(
            activitySource(data, activity.id),
            organisationSource(data, organisationId),
            ...people.map((person) => personSource(data, person.id))
          ),
          proposes: `Attach it to ${organisation.name}${openWork.length === 1 ? ` and to "${openWork[0].title}"` : ''}.`,
          changes,
          confidence: people.length > 1 ? 'high' : 'moderate',
          assumptions:
            people.length === 1
              ? [
                  `That this conversation was about ${organisation.name}, because the one person in it works there.`,
                ]
              : [],
          conflicts: [],
          missingInformation:
            openWork.length > 1
              ? [`Which of the ${openWork.length} open pieces of work at ${organisation.name} this was about`]
              : [],
          consequences: [
            `This conversation, including anything said in it, becomes part of ${organisation.name}’s record and visible to everybody who can see that account.`,
          ],
          approval: {
            role: 'crm_contributor',
            because: 'Attaching a conversation to an account is a records change.',
            individualOnly: false,
          },
          scanned: [content.text],
        },
        run
      );
      continue;
    }

    /* ---- nobody identifiable ---- */
    const unresolved = data.activityParticipants.filter(
      (participant) => participant.activityId === activity.id && participant.unresolvedName
    );
    if (unresolved.length > 0) {
      propose(
        context,
        {
          agent: 'capture',
          kind: 'flag_for_attention',
          observed: `"${activity.title}" has ${unresolved.length} ${unresolved.length === 1 ? 'participant' : 'participants'} nobody has matched to a person, and no account attached.`,
          sources: sources(activitySource(data, activity.id)),
          proposes: 'Somebody says who was in this conversation, so it can be filed.',
          changes: [],
          confidence: 'moderate',
          assumptions: [],
          conflicts: [],
          missingInformation: [
            `Who ${unresolved.map((p) => `"${p.unresolvedName}"`).join(' and ')} ${unresolved.length === 1 ? 'is' : 'are'}`,
          ],
          consequences: [
            'Nothing is attached. An unattached conversation is findable; one attached to the wrong account is not.',
          ],
          approval: {
            role: 'crm_contributor',
            because: 'Identifying a participant creates a link between a person and a conversation.',
            individualOnly: false,
          },
          scanned: [content.text],
        },
        run
      );
    }
  }

  return run;
}

/* ==================================================== follow-through */

/**
 * What was promised, by whom, and by when.
 *
 * THE RULE: never invent an owner or a date. Where a commitment has neither,
 * the proposal says so in `missingInformation` and proposes the commitment
 * WITHOUT them, because a promise with no owner is still a promise and losing
 * it is worse than recording it incompletely. What it will not do is pick a
 * plausible owner from the people in the room.
 */
export function followThroughAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data } = context;

  /* ---- commitments with nobody or no date against them ---- */
  const loose = data.commitments.filter(
    (commitment) =>
      commitment.deletedAt === null &&
      commitment.state === 'open' &&
      (commitment.dueDate === null || commitment.ownerName.trim().length === 0)
  );

  for (const commitment of loose) {
    const missing: string[] = [];
    if (!commitment.dueDate) missing.push('When it is due. Nobody said a date, so none is proposed.');
    if (commitment.ownerName.trim().length === 0) {
      missing.push('Who owns it. Nobody was named, so nobody is proposed.');
    }

    propose(
      context,
      {
        agent: 'follow_through',
        kind: 'record_commitment',
        observed: `"${commitment.description}" is recorded as an open promise with ${missing.length === 2 ? 'no owner and no date' : !commitment.dueDate ? 'no date' : 'no owner'}.`,
        sources: sources(
          commitment.organisationId ? organisationSource(data, commitment.organisationId) : null,
          commitment.activityId ? activitySource(data, commitment.activityId) : null,
          commitment.workItemId ? workItemSource(data, commitment.workItemId) : null
        ),
        proposes:
          'Somebody fills in what is missing. Concludo has not guessed, because a guessed owner is a task nobody is actually doing.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: missing,
        consequences: [
          'Nothing changes until a person says. The promise stays on the list either way.',
        ],
        approval: {
          role: 'crm_contributor',
          because: 'Filling in an owner or a date changes a record.',
          individualOnly: false,
        },
      },
      run
    );
  }

  /* ---- work with no next step, where a conversation suggests one ---- */
  const withoutNextStep = data.workItems.filter(
    (item) => item.deletedAt === null && item.status === 'open' && item.nextStep === null
  );

  for (const item of withoutNextStep) {
    const recent = data.activities
      .filter(
        (activity) =>
          activity.deletedAt === null &&
          (activity.workItemId === item.id || activity.organisationId === item.organisationId) &&
          activity.summary !== null
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

    if (!recent) {
      propose(
        context,
        {
          agent: 'follow_through',
          kind: 'update_next_step',
          observed: `"${item.title}" is open with no next step, and no conversation is recorded against it at all.`,
          sources: sources(workItemSource(data, item.id)),
          proposes:
            'Somebody records what happens next. There is nothing here to suggest one from.',
          changes: [],
          confidence: 'high',
          assumptions: [],
          conflicts: [],
          missingInformation: [
            'What the next step is. Nothing recorded against this work suggests one, so none is proposed.',
          ],
          consequences: ['Nothing changes until a person writes one.'],
          approval: {
            role: 'crm_contributor',
            because: 'A next step is a field on the work item.',
            individualOnly: false,
          },
        },
        run
      );
      continue;
    }

    const content = untrusted(recent.summary, 'crm_activities', recent.id);

    propose(
      context,
      {
        agent: 'follow_through',
        kind: 'update_next_step',
        observed: `"${item.title}" is open with no next step. The last thing recorded against this account was "${recent.title}" on ${recent.occurredAt.slice(0, 10)}.`,
        sources: sources(workItemSource(data, item.id), activitySource(data, recent.id)),
        proposes:
          'Somebody reads what was said and writes the next step. Concludo is not proposing wording, because what happens next was not stated.',
        changes: [],
        confidence: 'moderate',
        assumptions: [],
        conflicts: [],
        missingInformation: [
          `What was agreed. The record says: “${quoteForDisplay(content)}”, which does not name a next action.`,
        ],
        consequences: ['Nothing changes until a person writes one.'],
        approval: {
          role: 'crm_contributor',
          because: 'A next step is a field on the work item.',
          individualOnly: false,
        },
        scanned: [content.text],
      },
      run
    );
  }

  /* ---- follow-through that was recorded as outstanding ---- */
  const outstanding = data.activities.filter(
    (activity) => activity.deletedAt === null && activity.followThroughOutstanding
  );

  for (const activity of outstanding) {
    propose(
      context,
      {
        agent: 'follow_through',
        kind: 'flag_for_attention',
        observed: `"${activity.title}" is marked as having something outstanding: ${activity.followThroughReason ?? 'no reason was recorded'}.`,
        sources: sources(
          activitySource(data, activity.id),
          activity.organisationId ? organisationSource(data, activity.organisationId) : null
        ),
        proposes: 'Somebody closes this off or records why it is still open.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: activity.followThroughReason ? [] : ['Why it is still outstanding'],
        consequences: ['Nothing changes. This is a reminder, not an edit.'],
        approval: {
          role: 'crm_contributor',
          because: 'Nothing here changes a record, but acting on it will.',
          individualOnly: false,
        },
        scanned: [activity.summary, activity.followThroughReason],
      },
      run
    );
  }

  return run;
}

/** Everything both intake agents found, in one list. */
export function intakeProposals(context: BuildContext): AgentProposal[] {
  return [...captureAgent(context).proposals, ...followThroughAgent(context).proposals];
}

/** Exported for the tests: the collections these agents read. */
export function intakeInputs(data: CrmWorkspaceData): number {
  return data.activities.length + data.commitments.length + data.workItems.length;
}
