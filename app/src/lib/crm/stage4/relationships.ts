/**
 * The eight questions the Relationships view has to answer.
 *
 * WHAT THIS FILE REFUSES TO DO, AND WHY IT MATTERS MORE THAN WHAT IT DOES.
 *
 * The brief says: do not rank people, and do not infer personal
 * characteristics. Those are easy to agree with and easy to violate by
 * accident, because almost every convenient implementation of "who needs
 * attention" is a score, and almost every convenient implementation of
 * "relationship strength" is a judgement about a human being.
 *
 * So three rules hold through the whole file:
 *
 *   1. Every answer is a LIST with a stated reason, never an ordered league
 *      table. Where an order is needed for the list to be usable, it is by a
 *      recorded fact, days since contact, and the number is shown so the person
 *      can disagree with it.
 *
 *   2. Nothing here describes a person. "Nobody has recorded a conversation
 *      with Nadia for 94 days" is a fact about the RECORD. "Nadia is
 *      disengaged" is an inference about a human being from an absence in a
 *      database, and it is both rude and usually wrong: the most likely
 *      explanation for a gap in a CRM is that somebody did not write it down.
 *
 *   3. Relationship strength, where the model carries it, is reported as the
 *      recorded value with its own words, never computed. A computed strength
 *      is a score for a person wearing a different name.
 */
import { CrmWorkspaceData, Organisation, Person, StakeholderRole } from '../domain';
import { ApprovedPhrase } from '../language';
import { onWriteInvalidate } from '../cacheBus';

const DAY = 86_400_000;

function daysBetween(iso: string, now: string): number {
  return Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / DAY);
}

export interface RelationshipAnswer {
  /** The question, in the words the interface shows. */
  question: string;
  /** What the person can do with the answer. */
  purpose: string;
  rows: RelationshipRow[];
  /** Said when there are no rows. Never "no results". */
  emptyMessage: string;
}

export interface RelationshipRow {
  id: string;
  /** Who or what this row is about. */
  name: string;
  /** Organisation, role, or whatever places the row. */
  context: string | null;
  /** Why this row is in this answer. A fact, never a judgement. */
  reason: string;
  /**
   * The approved standing phrase, where one applies.
   *
   * Typed as `ApprovedPhrase` rather than `string` on purpose: a label written
   * inline is a label nobody reviewed, and the whole point of the list is that
   * the words used to tell somebody their work needs attention are decided
   * once, in the open.
   */
  standing: ApprovedPhrase | null;
  /** Days, where the answer turns on elapsed time. Shown, not hidden. */
  days: number | null;
  personId: string | null;
  organisationId: string | null;
  workItemId: string | null;
}

/** People who are live and are their own record. */
function livePeople(data: CrmWorkspaceData): Person[] {
  return data.people.filter((p) => p.deletedAt === null && p.mergedIntoPersonId === null);
}

function liveOrganisations(data: CrmWorkspaceData): Organisation[] {
  return data.organisations.filter((o) => o.deletedAt === null);
}

function organisationName(data: CrmWorkspaceData, id: string | null): string | null {
  return data.organisations.find((o) => o.id === id)?.name ?? null;
}

/** The last activity a person was actually present at. */
export function lastContactWith(data: CrmWorkspaceData, personId: string): string | null {
  const activityIds = data.activityParticipants
    .filter((p) => p.personId === personId)
    .map((p) => p.activityId);

  return (
    data.activities
      .filter((a) => a.deletedAt === null && activityIds.includes(a.id))
      .map((a) => a.occurredAt)
      .sort()
      .at(-1) ?? null
  );
}

/** The last activity that counted as contact with the customer. */
/* ------------------------------------------------- the contact lookup
 *
 * Indexed in Stage 8. The earlier version read every participant row and then
 * every activity, with an `includes` against a list, for EACH person asked
 * about. One call looked cheap; the relationship views and the data-quality
 * dashboard call it once per person, which at ten thousand people was the
 * single slowest thing in the product.
 *
 * Same signature, same answer, one pass per dataset instead of one pass per
 * question. Cached in a WeakMap against the dataset object, and dropped on
 * every write through `onWriteInvalidate` at the bottom of this file, because
 * the session store mutates one workspace in place rather than replacing it.
 */

const lastContactCache = new WeakMap<CrmWorkspaceData, Map<string, string>>();

function lastMeaningfulByPerson(data: CrmWorkspaceData): Map<string, string> {
  const cached = lastContactCache.get(data);
  if (cached) return cached;

  const peopleByActivity = new Map<string, string[]>();
  for (const participant of data.activityParticipants) {
    if (participant.personId === null) continue;
    const existing = peopleByActivity.get(participant.activityId);
    if (existing) existing.push(participant.personId);
    else peopleByActivity.set(participant.activityId, [participant.personId]);
  }

  const latest = new Map<string, string>();
  for (const activity of data.activities) {
    if (activity.deletedAt !== null || !activity.isMeaningfulContact) continue;
    for (const personId of peopleByActivity.get(activity.id) ?? []) {
      const held = latest.get(personId);
      // Parsed, not compared as text: these timestamps carry a zone offset in
      // some places and a Z in others.
      if (held === undefined || Date.parse(activity.occurredAt) > Date.parse(held)) {
        latest.set(personId, activity.occurredAt);
      }
    }
  }

  lastContactCache.set(data, latest);
  return latest;
}

/** Drops the cached lookup, for a caller that mutates a dataset in place. */
export function forgetContactIndex(data: CrmWorkspaceData): void {
  lastContactCache.delete(data);
}

export function lastMeaningfulContactWith(
  data: CrmWorkspaceData,
  personId: string
): string | null {
  return lastMeaningfulByPerson(data).get(personId) ?? null;
}

/* ================================================= 1. not contacted recently */

export function notContactedRecently(
  data: CrmWorkspaceData,
  now: string,
  afterDays = 45
): RelationshipAnswer {
  const rows: RelationshipRow[] = [];

  for (const person of livePeople(data)) {
    const last = lastMeaningfulContactWith(data, person.id);

    if (last === null) {
      rows.push({
        id: `nc-${person.id}`,
        name: person.fullName,
        context: organisationName(data, person.organisationId),
        // The honest sentence. Not "has gone quiet", which says something about
        // them; this says something about what we wrote down.
        reason: 'No conversation has ever been recorded with this person.',
        standing: 'No recorded activity',
        days: null,
        personId: person.id,
        organisationId: person.organisationId,
        workItemId: null,
      });
      continue;
    }

    const days = daysBetween(last, now);
    if (days >= afterDays) {
      rows.push({
        id: `nc-${person.id}`,
        name: person.fullName,
        context: organisationName(data, person.organisationId),
        reason: `The last recorded conversation was ${days} days ago.`,
        standing: 'No recorded activity',
        days,
        personId: person.id,
        organisationId: person.organisationId,
        workItemId: null,
      });
    }
  }

  // Ordered by a recorded number that is on the screen, so the order is
  // checkable. This is not a ranking of people; it is a sort by a date.
  rows.sort((a, b) => (b.days ?? Number.MAX_SAFE_INTEGER) - (a.days ?? Number.MAX_SAFE_INTEGER));

  return {
    question: 'Who have we not contacted recently?',
    purpose: 'People where the record shows a long gap. The gap may be in the record rather than the relationship.',
    rows,
    emptyMessage: `Every person here has a conversation recorded in the last ${afterDays} days.`,
  };
}

/* ====================================================== 2. waiting for us */

export function waitingForUs(data: CrmWorkspaceData, now: string): RelationshipAnswer {
  const rows: RelationshipRow[] = [];

  for (const commitment of data.commitments) {
    if (commitment.deletedAt !== null || commitment.state !== 'open') continue;
    if (!commitment.ownedByUs) continue;

    const person = data.people.find((p) => p.id === commitment.ownerPersonId);
    const overdue =
      commitment.dueDate !== null && daysBetween(commitment.dueDate, now) > 0
        ? daysBetween(commitment.dueDate, now)
        : null;

    rows.push({
      id: `wfu-${commitment.id}`,
      name: commitment.description,
      context:
        organisationName(data, commitment.organisationId) ?? person?.fullName ?? null,
      reason:
        commitment.dueDate === null
          ? 'We promised this and no date was agreed.'
          : overdue !== null
            ? `We promised this by ${commitment.dueDate}, which was ${overdue} days ago.`
            : `We promised this by ${commitment.dueDate}.`,
      standing: overdue !== null ? 'Waiting on us' : 'Waiting on us',
      days: overdue,
      personId: commitment.ownerPersonId,
      organisationId: commitment.organisationId,
      workItemId: commitment.workItemId,
    });
  }

  rows.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return {
    question: 'Who is waiting for us?',
    purpose: 'Open promises we made. These are the ones a customer remembers.',
    rows,
    emptyMessage: 'Nothing we promised is still open.',
  };
}

/* ==================================================== 3. we are waiting on */

export function weAreWaitingOn(data: CrmWorkspaceData, now: string): RelationshipAnswer {
  const rows: RelationshipRow[] = [];

  for (const commitment of data.commitments) {
    if (commitment.deletedAt !== null || commitment.state !== 'open') continue;
    if (commitment.ownedByUs) continue;

    const overdue =
      commitment.dueDate !== null && daysBetween(commitment.dueDate, now) > 0
        ? daysBetween(commitment.dueDate, now)
        : null;

    rows.push({
      id: `wwo-${commitment.id}`,
      name: commitment.description,
      context: `${commitment.ownerName}. ${organisationName(data, commitment.organisationId) ?? 'No organisation recorded'}`,
      reason:
        commitment.dueDate === null
          ? `${commitment.ownerName} said they would do this. No date was agreed.`
          : overdue !== null
            ? `${commitment.ownerName} said they would do this by ${commitment.dueDate}, which was ${overdue} days ago.`
            : `${commitment.ownerName} said they would do this by ${commitment.dueDate}.`,
      standing: 'Waiting on them',
      days: overdue,
      personId: commitment.ownerPersonId,
      organisationId: commitment.organisationId,
      workItemId: commitment.workItemId,
    });
  }

  rows.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return {
    question: 'Who are we waiting on?',
    purpose: 'Promises made to us. A chase is a decision, so these are listed rather than actioned.',
    rows,
    emptyMessage: 'Nothing promised to us is still open.',
  };
}

/* ======================================================= 4. what we promised */

export function whatWePromised(data: CrmWorkspaceData): RelationshipAnswer {
  const rows: RelationshipRow[] = [];

  for (const commitment of data.commitments) {
    if (commitment.deletedAt !== null || !commitment.ownedByUs) continue;

    const activity = data.activities.find((a) => a.id === commitment.activityId);

    rows.push({
      id: `wp-${commitment.id}`,
      name: commitment.description,
      context: organisationName(data, commitment.organisationId),
      reason: activity
        ? `Recorded in ${activity.title}. ${commitment.state === 'done' ? 'Done.' : commitment.state === 'open' ? 'Still open.' : 'No longer needed.'}`
        : `${commitment.state === 'done' ? 'Done.' : commitment.state === 'open' ? 'Still open.' : 'No longer needed.'}`,
      standing: commitment.state === 'open' ? 'Waiting on us' : null,
      days: null,
      personId: commitment.ownerPersonId,
      organisationId: commitment.organisationId,
      workItemId: commitment.workItemId,
    });
  }

  return {
    question: 'What did we promise?',
    purpose: 'Every commitment we made, open or not, with the conversation it came from.',
    rows,
    emptyMessage: 'No commitments are recorded against this workspace.',
  };
}

/* ======================================================= 5. what changed */

export function whatChangedRecently(
  data: CrmWorkspaceData,
  now: string,
  withinDays = 14
): RelationshipAnswer {
  const rows: RelationshipRow[] = [];
  const cutoff = new Date(new Date(now).getTime() - withinDays * DAY).toISOString();

  for (const move of data.stageMoves) {
    if (move.movedAt < cutoff) continue;
    const item = data.workItems.find((w) => w.id === move.workItemId);
    if (!item || item.deletedAt !== null) continue;
    const to = data.stages.find((s) => s.id === move.toStageId)?.name ?? 'a new stage';

    rows.push({
      id: `wc-move-${move.id}`,
      name: `${item.title} moved to ${to}`,
      context: organisationName(data, item.organisationId),
      reason:
        move.criteriaUnmet.length > 0
          ? `Moved with ${move.criteriaUnmet.length} exit ${move.criteriaUnmet.length === 1 ? 'criterion' : 'criteria'} unmet. Reason: ${move.overrideReason}`
          : 'All required exit criteria were met.',
      standing: move.criteriaUnmet.length > 0 ? 'Needs review' : null,
      days: daysBetween(move.movedAt, now),
      personId: null,
      organisationId: item.organisationId,
      workItemId: item.id,
    });
  }

  for (const serviceCase of data.serviceCases) {
    if (serviceCase.deletedAt !== null) continue;
    const at = serviceCase.resolvedAt ?? serviceCase.raisedAt;
    if (at < cutoff) continue;

    rows.push({
      id: `wc-svc-${serviceCase.id}`,
      name: serviceCase.resolvedAt ? `${serviceCase.title}: resolved` : serviceCase.title,
      context: organisationName(data, serviceCase.organisationId),
      reason: serviceCase.relationshipEffect ?? 'A service matter was recorded.',
      standing: serviceCase.resolvedAt ? null : 'Needs review',
      days: daysBetween(at, now),
      personId: serviceCase.personId,
      organisationId: serviceCase.organisationId,
      workItemId: serviceCase.workItemId,
    });
  }

  for (const decision of data.decisions) {
    if (decision.deletedAt !== null) continue;
    const at = decision.decidedOn ?? decision.createdAt;
    if (at < cutoff.slice(0, at.length)) continue;

    rows.push({
      id: `wc-dec-${decision.id}`,
      name: decision.title,
      context: organisationName(data, decision.organisationId),
      reason: decision.summary ?? 'A decision was recorded.',
      standing: null,
      days: daysBetween(at, now),
      personId: decision.decidedByPersonId,
      organisationId: decision.organisationId,
      workItemId: decision.workItemId,
    });
  }

  rows.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  return {
    question: 'What changed recently?',
    purpose: `Stage moves, service matters and decisions in the last ${withinDays} days.`,
    rows,
    emptyMessage: `Nothing has changed in the last ${withinDays} days.`,
  };
}

/* ======================================== 6. relationships on one person */

export function dependOnOnePerson(data: CrmWorkspaceData): RelationshipAnswer {
  const rows: RelationshipRow[] = [];

  for (const organisation of liveOrganisations(data)) {
    const people = livePeople(data).filter((p) => p.organisationId === organisation.id);
    if (people.length !== 1) continue;

    const openWork = data.workItems.filter(
      (w) => w.deletedAt === null && w.organisationId === organisation.id && w.status === 'open'
    );

    rows.push({
      id: `dep-${organisation.id}`,
      name: organisation.name,
      context: `One contact recorded: ${people[0].fullName}`,
      // About the record, and about the business risk, not about the person.
      reason:
        openWork.length > 0
          ? `${openWork.length} open ${openWork.length === 1 ? 'item' : 'items'} and one recorded contact. If they move on there is nobody else recorded here.`
          : 'One recorded contact. If they move on there is nobody else recorded here.',
      standing: 'Needs review',
      days: null,
      personId: people[0].id,
      organisationId: organisation.id,
      workItemId: openWork[0]?.id ?? null,
    });
  }

  return {
    question: 'Which relationships depend on one person?',
    purpose: 'Organisations with a single recorded contact. The fix is another name, not a warning.',
    rows,
    emptyMessage: 'Every organisation here has more than one contact recorded.',
  };
}

/* ======================================================= 7. missing roles */

/** The roles a decision usually needs somebody in. */
export const ROLES_THAT_MATTER: StakeholderRole[] = ['decision_maker', 'influencer', 'user'];

export const ROLE_WORDS: Record<StakeholderRole, string> = {
  decision_maker: 'Decision maker',
  economic_buyer: 'Economic buyer',
  influencer: 'Influencer',
  user: 'User',
  champion: 'Champion',
  gatekeeper: 'Gatekeeper',
  adviser: 'Adviser',
  blocker: 'Blocker',
  unknown: 'Role not recorded',
};

export function missingRoles(data: CrmWorkspaceData): RelationshipAnswer {
  const rows: RelationshipRow[] = [];

  for (const organisation of liveOrganisations(data)) {
    const roles = data.personOrganisationRoles.filter(
      (r) => r.organisationId === organisation.id && r.endedOn === null
    );
    if (roles.length === 0) continue;

    const held = new Set(roles.map((r) => r.stakeholderRole));
    const absent = ROLES_THAT_MATTER.filter((role) => !held.has(role));
    if (absent.length === 0) continue;

    const openWork = data.workItems.filter(
      (w) => w.deletedAt === null && w.organisationId === organisation.id && w.status === 'open'
    );

    rows.push({
      id: `mr-${organisation.id}`,
      name: organisation.name,
      context: `${roles.length} ${roles.length === 1 ? 'role' : 'roles'} recorded`,
      reason:
        openWork.length > 0
          ? `No ${absent.map((r) => ROLE_WORDS[r].toLowerCase()).join(' and no ')} is recorded, and there ${openWork.length === 1 ? 'is' : 'are'} ${openWork.length} open ${openWork.length === 1 ? 'item' : 'items'}.`
          : `No ${absent.map((r) => ROLE_WORDS[r].toLowerCase()).join(' and no ')} is recorded.`,
      standing: 'Needs review',
      days: null,
      personId: null,
      organisationId: organisation.id,
      workItemId: openWork[0]?.id ?? null,
    });
  }

  return {
    question: 'Which important roles are missing?',
    purpose: 'Where nobody is recorded in a role a decision usually needs. This is about the record, not the account.',
    rows,
    emptyMessage: 'Every organisation with roles recorded has the usual ones covered.',
  };
}

/* ================================================ 8. next interaction */

/**
 * What to do next, and why.
 *
 * Every row here is drawn from something a person recorded: a next step they
 * wrote, a commitment they made, a date they agreed. Nothing is invented, and
 * nothing is scored. Where the module has no recorded basis for a suggestion it
 * says nothing rather than filling the list.
 */
export function recommendedNextInteraction(
  data: CrmWorkspaceData,
  now: string
): RelationshipAnswer {
  const rows: RelationshipRow[] = [];

  for (const item of data.workItems) {
    if (item.deletedAt !== null || item.status !== 'open' || item.nextStep === null) continue;

    const due = item.nextStepDue;
    const overdue = due !== null && daysBetween(due, now) > 0 ? daysBetween(due, now) : null;
    const person = data.people.find((p) => p.id === item.primaryPersonId);

    rows.push({
      id: `ni-${item.id}`,
      name: item.nextStep,
      context: `${item.title}. ${person ? person.fullName : 'No primary contact recorded'}`,
      reason:
        due === null
          ? 'Recorded as the next step, with no date agreed.'
          : overdue !== null
            ? `Recorded as the next step, due ${due}, which was ${overdue} days ago.`
            : `Recorded as the next step, due ${due}.`,
      standing: overdue !== null ? 'Waiting on us' : null,
      days: overdue,
      personId: item.primaryPersonId,
      organisationId: item.organisationId,
      workItemId: item.id,
    });
  }

  for (const organisation of liveOrganisations(data)) {
    if (organisation.renewalDate === null) continue;
    const until = -daysBetween(organisation.renewalDate, now);
    if (until < 0 || until > 60) continue;

    rows.push({
      id: `ni-renew-${organisation.id}`,
      name: `Open the renewal conversation with ${organisation.name}`,
      context: `Renewal or review date ${organisation.renewalDate}`,
      reason: `The recorded renewal date is ${until} days away.`,
      standing: 'Needs review',
      days: until,
      personId: null,
      organisationId: organisation.id,
      workItemId: null,
    });
  }

  rows.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return {
    question: 'What is the recommended next interaction?',
    purpose: 'Next steps somebody wrote down, and renewal dates somebody recorded. Nothing here is invented.',
    rows,
    emptyMessage: 'No next steps or renewal dates are recorded.',
  };
}

/** All eight, in the order the view asks them. */
export function relationshipAnswers(
  data: CrmWorkspaceData,
  now: string
): RelationshipAnswer[] {
  return [
    notContactedRecently(data, now),
    waitingForUs(data, now),
    weAreWaitingOn(data, now),
    whatWePromised(data),
    whatChangedRecently(data, now),
    dependOnOnePerson(data),
    missingRoles(data),
    recommendedNextInteraction(data, now),
  ];
}

/*
 * Drop the last-meaningful-contact lookup whenever anything is written.
 *
 * The session store mutates one workspace object in place, so a cache keyed on
 * that object outlives the data it was built from. Registering here means the
 * cache is dropped by the thing that knows a write happened, rather than by
 * every caller remembering to.
 */
onWriteInvalidate(forgetContactIndex);
