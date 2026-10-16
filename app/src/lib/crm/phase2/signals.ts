/**
 * Relationship attention: the eleven conditions, and the count that is not a
 * score.
 *
 * WHAT THIS MODULE IS, AND WHAT IT IS NOT.
 *
 * It is a composition over work that already exists. Stage 4 answers eight of
 * these questions already (`notContactedRecently`, `dependOnOnePerson`,
 * `missingRoles`, `waitingForUs`, `weAreWaitingOn`, `whatWePromised`,
 * `coverageFor`, `recommendedNextInteraction`), Stage 5 knows what is open,
 * Stage 6 holds the plan and the renewal date, and Stage 8 holds the service
 * inbox. Nothing here re-derives any of that. What was missing was one place
 * that puts them together and answers the first question the product exists to
 * answer: **who needs attention, and why.**
 *
 * THE COUNT IS NOT A SCORE, AND THE DIFFERENCE IS LOAD BEARING.
 *
 * `attentionCount` is the number of the eleven conditions currently true of an
 * account. It is an integer, not a weighted figure, and that is a product
 * decision rather than an implementation shortcut:
 *
 *   A weight is an opinion nobody can check. "Renewal approaching counts
 *   double" is a judgement somebody made once, and after it ships nobody can
 *   tell whether an account scoring 7 is in more trouble than one scoring 5.
 *
 *   A count can be argued with. Five conditions means five sentences, each
 *   with a link to the records behind it, and a person who disagrees with one
 *   can dismiss it and say why.
 *
 *   A weighted score sorts. An unweighted count of named conditions sorts
 *   too, but it carries its own explanation with it, so a list ordered by it
 *   reads as "these accounts have more unanswered questions" rather than as a
 *   ranking.
 *
 * AND IT IS NEVER GROUPED BY A PERSON. There is no function in this file that
 * takes a user id, and no function that returns a figure keyed to one. Owner
 * appears nowhere in the output. `attentionFor` and `workspaceAttention` are
 * about accounts; "show me mine" is a filter the caller applies to accounts it
 * can already see, and there is no parameter that would return one person's
 * accounts to somebody else. A database check fails the migration if a column
 * appears that would allow the rollup.
 *
 * EVERY SIGNAL NAMES ITS EVIDENCE. `evidence` is never empty. A condition that
 * cannot show the records it was read from is refused by the type, by the
 * database and by the test, because an attention list nobody can audit is a
 * list people learn to distrust and then to ignore.
 *
 * NOTHING HERE INFERS ANYTHING ABOUT A PERSON. No sentiment, no engagement
 * level, no personality, no judgement about whether somebody is doing their
 * job. Every condition is a fact about what is or is not recorded.
 */

import {
  AttentionCondition,
  ATTENTION_CONDITIONS,
  CrmWorkspaceData,
  Organisation,
  RelationshipSignalState,
} from '../domain';
import { lastMeaningfulContactWith } from '../stage4/relationships';
import { indexFor } from '../stage8/paging';

const DAY = 86_400_000;

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / DAY);
}

function daysUntil(date: string, now: string): number {
  return Math.ceil((Date.parse(date) - Date.parse(now)) / DAY);
}

/* ===================================================== the shape */

export interface EvidenceRef {
  table: string;
  id: string;
  /** What this record contributes, in a few words. */
  what: string;
}

/**
 * What the attention list says about an organisation.
 *
 * Deliberately NOT the organisation record. The record carries three owner
 * columns, and returning it would hand every caller the owner of every
 * account on the list, which is one `groupBy` from the league table this
 * module exists not to build. The page needs the name and the lifecycle
 * state, so those are what it gets, and the structural guarantee is checkable
 * by a test rather than maintained by everybody who writes a component.
 */
export interface AttentionOrganisation {
  id: string;
  name: string;
  lifecycleState: Organisation['lifecycleState'];
}

/**
 * A decision somebody made about a condition, as the page shows it.
 *
 * Carries the reason, the state and when it ends. It does NOT carry who made
 * it. That is an audit fact and the audit trail has it; on a page about
 * accounts it would be a person's name beside a judgement, and the first
 * question somebody asks of a column like that is who has the most.
 */
export interface SignalDecision {
  id: string;
  state: 'acknowledged' | 'dismissed';
  reason: string;
  decidedAt: string;
  expiresAt: string | null;
  detailAtDecision: string | null;
}

export interface Signal {
  condition: AttentionCondition;
  organisationId: string;
  organisationName: string;
  /** The heading, from the fixed list. Never written at the point of use. */
  label: string;
  /** What is true, as a sentence somebody can check. Never a judgement. */
  detail: string;
  /** What would clear it. Never blank, never "review this". */
  whatWouldClearIt: string;
  /** Never empty. The records this was read from. */
  evidence: EvidenceRef[];
  /** Days, where the condition turns on elapsed time. Shown, not hidden. */
  days: number | null;
  /** Where to go. */
  path: string;
  /** Set where a person has decided something about this condition. */
  decision: SignalDecision | null;
}

export interface AccountAttention {
  organisation: AttentionOrganisation;
  /** The conditions currently true. */
  signals: Signal[];
  /** Dismissed and not yet expired. Shown separately, never silently dropped. */
  dismissed: Signal[];
  /**
   * How many of the eleven are true and not dismissed. A count of named
   * conditions. Not a score, not weighted, not comparable between businesses.
   */
  attentionCount: number;
  /** Conditions that could not be judged, and why. */
  notAssessable: { condition: AttentionCondition; because: string }[];
}

export const CONDITION_LABELS: Record<AttentionCondition, string> = {
  single_contact_dependency: 'Everything rests on one person',
  no_executive_relationship: 'Nobody senior is recorded',
  no_interaction_90: 'No conversation for a long time',
  renewal_approaching: 'Renewal is coming',
  service_issue_unresolved: 'A service issue is open',
  follow_ups_ignored: 'We are waiting on them',
  no_stakeholder_coverage: 'Roles that matter are not recorded',
  no_decision_maker: 'Nobody is recorded as able to decide',
  no_next_engagement: 'Nothing is planned next',
  no_recorded_value: 'Nothing is recorded about what they get out of it',
  plan_overdue_for_review: 'The account plan is overdue for review',
};

/** What each condition is for, shown once on the page rather than per row. */
export const CONDITION_PURPOSE: Record<AttentionCondition, string> = {
  single_contact_dependency:
    'One contact leaving should not end the relationship. This says where it would.',
  no_executive_relationship:
    'A relationship held only below the decision line ends when the person holding it moves.',
  no_interaction_90:
    'Internal activity is not contact. This counts conversations with the customer.',
  renewal_approaching: 'A renewal nobody has started is the most expensive kind of surprise.',
  service_issue_unresolved:
    'What is going wrong for them changes how the next conversation should go.',
  follow_ups_ignored:
    'Something was asked and nothing came back. Not a judgement about them, a fact about the thread.',
  no_stakeholder_coverage:
    'A buying group with no recorded users or influencers is one nobody can read.',
  no_decision_maker: 'Work with nobody recorded as able to decide is work that cannot close.',
  no_next_engagement: 'An account with no next step is one that goes quiet without anybody deciding to.',
  no_recorded_value:
    'The hardest section to fill in, and the one a renewal conversation needs most.',
  plan_overdue_for_review: 'A plan nobody revisits is a document, not a plan.',
};

/* ===================================================== the thresholds */

/**
 * Every number a condition turns on, in one place, with the reason.
 *
 * They are arguments rather than constants because what counts as a long time
 * is a property of the business and not of the software. A bookkeeper sees a
 * client quarterly; a key account team sees one weekly. One threshold for both
 * makes the list noise for one of them.
 */
export interface AttentionThresholds {
  /** Days with no meaningful contact. */
  quietAfterDays: number;
  /** Days before a renewal at which it needs attention. */
  renewalWithinDays: number;
  /** Days a request can sit with the customer before it is worth saying. */
  waitingAfterDays: number;
  /** Days past a plan review date. */
  reviewOverdueByDays: number;
}

export const DEFAULT_THRESHOLDS: AttentionThresholds = {
  quietAfterDays: 90,
  renewalWithinDays: 90,
  waitingAfterDays: 14,
  reviewOverdueByDays: 0,
};

/* ===================================================== the conditions */

/**
 * Each condition is a function of the same shape: it returns a signal where
 * the condition is true, null where it is false, and a `notAssessable` reason
 * where there is not enough recorded to judge.
 *
 * The third case is the one most products get wrong. An account with no
 * recorded renewal date does not have a renewal that is far away; it has a
 * renewal nobody knows about. Returning null for that would quietly report it
 * as healthy.
 */
type ConditionResult =
  | { kind: 'met'; signal: Omit<Signal, 'condition' | 'organisationId' | 'organisationName' | 'label' | 'path' | 'decision'> }
  | { kind: 'clear' }
  | { kind: 'not_assessable'; because: string };

type ConditionFn = (
  data: CrmWorkspaceData,
  organisation: Organisation,
  now: string,
  thresholds: AttentionThresholds
) => ConditionResult;

/* ---- 1. everything rests on one person ---- */

const singleContactDependency: ConditionFn = (data, organisation) => {
  const index = indexFor(data);
  const people = index.peopleByOrganisation.get(organisation.id) ?? [];

  if (people.length === 0) {
    return {
      kind: 'not_assessable',
      because: 'Nobody is recorded at this organisation at all, so there is no dependency to read.',
    };
  }
  if (people.length > 1) return { kind: 'clear' };

  const person = people[0];
  return {
    kind: 'met',
    signal: {
      detail: `${person.fullName} is the only person recorded here. If they move on, nothing about this relationship is recorded anywhere else.`,
      whatWouldClearIt:
        'Record a second contact. One name and a role is enough to start, and the next conversation is the moment to get it.',
      evidence: [
        { table: 'crm_organisations', id: organisation.id, what: 'the organisation' },
        { table: 'crm_people', id: person.id, what: 'the only recorded contact' },
      ],
      days: null,
    },
  };
};

/* ---- 2. nobody senior is recorded ---- */

const noExecutiveRelationship: ConditionFn = (data, organisation) => {
  const index = indexFor(data);
  const people = index.peopleByOrganisation.get(organisation.id) ?? [];
  if (people.length === 0) {
    return { kind: 'not_assessable', because: 'Nobody is recorded at this organisation.' };
  }

  const roles = data.personOrganisationRoles.filter(
    (role) => role.organisationId === organisation.id && role.endedOn === null
  );
  const senior = roles.filter(
    (role) => role.stakeholderRole === 'economic_buyer' || role.stakeholderRole === 'decision_maker'
  );
  if (senior.length > 0) return { kind: 'clear' };

  // PRECEDENCE. Where nobody here has any role recorded at all, this is not a
  // separate finding: it is one gap, and reporting it four times as "no
  // executive", "no decision maker", "no coverage" and "one contact" turns one
  // missing piece of information into an account that looks like it is on
  // fire. The broad condition reports it; this one says why it stood down.
  if (roles.length === 0) {
    return {
      kind: 'not_assessable',
      because:
        'No role is recorded for anybody here, so this cannot be judged on its own. It is covered by "Roles that matter are not recorded".',
    };
  }

  return {
    kind: 'met',
    signal: {
      detail:
        people.length === 1
          ? 'The one person recorded here is not recorded as an economic buyer or a decision maker.'
          : `${people.length} people are recorded here with a role, and none of them is recorded as an economic buyer or a decision maker.`,
      whatWouldClearIt:
        'Record who holds the budget and who signs. If nobody here does, the relationship sits below the line where it can be ended without a conversation.',
      evidence: [
        { table: 'crm_organisations', id: organisation.id, what: 'the organisation' },
        ...people.slice(0, 5).map((person) => ({
          table: 'crm_people',
          id: person.id,
          what: 'recorded contact',
        })),
      ],
      days: null,
    },
  };
};

/* ---- 3. no conversation for a long time ---- */

const noInteraction90: ConditionFn = (data, organisation, now, thresholds) => {
  if (organisation.lifecycleState === 'closed') {
    return { kind: 'not_assessable', because: 'This organisation is recorded as closed.' };
  }

  const index = indexFor(data);
  const people = index.peopleByOrganisation.get(organisation.id) ?? [];
  const contacts = people
    .map((person) => lastMeaningfulContactWith(data, person.id))
    .filter((at): at is string => at !== null)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  const last = contacts.at(-1) ?? null;

  if (last === null) {
    return {
      kind: 'met',
      signal: {
        detail:
          people.length === 0
            ? 'No conversation has ever been recorded here, and nobody is recorded at this organisation.'
            : 'No conversation with anybody here has ever been recorded as meaningful contact. Internal activity does not count.',
        whatWouldClearIt:
          'Record the last conversation, or decide the account is no longer current and say so on the record.',
        evidence: [
          { table: 'crm_organisations', id: organisation.id, what: 'the organisation' },
        ],
        days: null,
      },
    };
  }

  const quiet = daysBetween(last, now);
  if (quiet < thresholds.quietAfterDays) return { kind: 'clear' };

  const activity = (index.activitiesByOrganisation.get(organisation.id) ?? [])
    .filter((item) => item.isMeaningfulContact)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];

  return {
    kind: 'met',
    signal: {
      detail: `${quiet} days since the last recorded conversation with anybody here. Still recorded as ${organisation.lifecycleState}.`,
      whatWouldClearIt:
        'Have the conversation, or record the one that already happened. Where neither applies, the lifecycle state is the thing to change.',
      evidence: [
        { table: 'crm_organisations', id: organisation.id, what: 'the organisation' },
        ...(activity
          ? [{ table: 'crm_activities', id: activity.id, what: 'the last recorded conversation' }]
          : []),
      ],
      days: quiet,
    },
  };
};

/* ---- 4. renewal is coming ---- */

const renewalApproaching: ConditionFn = (data, organisation, now, thresholds) => {
  if (organisation.lifecycleState !== 'active') {
    return {
      kind: 'not_assessable',
      because: `This organisation is recorded as ${organisation.lifecycleState}, so a renewal date would not mean anything yet.`,
    };
  }
  if (organisation.renewalDate === null) {
    return {
      kind: 'not_assessable',
      because:
        'No renewal date is recorded. That is not the same as a renewal that is far away, and it is worth recording before it is worth tracking.',
    };
  }

  const until = daysUntil(organisation.renewalDate, now);
  if (until > thresholds.renewalWithinDays) return { kind: 'clear' };

  const plan = data.accountPlans.find(
    (candidate) => candidate.organisationId === organisation.id && candidate.deletedAt === null
  );
  const openWork = (indexFor(data).workItemsByOrganisation.get(organisation.id) ?? []).filter(
    (item) => item.status === 'open'
  );

  return {
    kind: 'met',
    signal: {
      detail:
        until < 0
          ? `The recorded renewal date passed ${Math.abs(until)} days ago and nothing is recorded about what happened.`
          : `Renewal is recorded for ${organisation.renewalDate}, which is ${until} ${until === 1 ? 'day' : 'days'} away. ${
              openWork.length > 0
                ? `${countPhrase(openWork.length, 'piece of work', 'pieces of work')} open against it.`
                : 'No work is open against it.'
            }`,
      whatWouldClearIt:
        'Start the renewal conversation, and record what was agreed. Moving the date without a conversation behind it is how a renewal is lost quietly.',
      evidence: [
        { table: 'crm_organisations', id: organisation.id, what: 'the recorded renewal date' },
        ...(plan ? [{ table: 'crm_account_plans', id: plan.id, what: 'the account plan' }] : []),
      ],
      days: until,
    },
  };
};

/* ---- 5. a service issue is open ---- */

const serviceIssueUnresolved: ConditionFn = (data, organisation, now) => {
  const open = data.serviceCases.filter(
    (kase) =>
      kase.organisationId === organisation.id &&
      kase.deletedAt === null &&
      kase.state !== 'resolved' &&
      kase.state !== 'closed'
  );
  if (open.length === 0) return { kind: 'clear' };

  const oldest = [...open].sort((a, b) => Date.parse(a.raisedAt) - Date.parse(b.raisedAt))[0];
  const age = daysBetween(oldest.raisedAt, now);

  return {
    kind: 'met',
    signal: {
      // The detail says THAT something is open and what it means for the
      // relationship. It never carries the case detail, which is restricted by
      // role and is not this page's to show.
      detail: `${open.length} open service ${open.length === 1 ? 'case' : 'cases'}, the oldest raised ${age} ${age === 1 ? 'day' : 'days'} ago.${
        oldest.relationshipEffect ? ` Recorded effect: ${oldest.relationshipEffect}` : ''
      }`,
      whatWouldClearIt:
        'Resolve it, or tell them where it stands. An open case nobody has mentioned is the thing that comes up in the renewal conversation.',
      evidence: open
        .slice(0, 5)
        .map((kase) => ({ table: 'crm_service_cases', id: kase.id, what: 'an open case' })),
      days: age,
    },
  };
};

/* ---- 6. we are waiting on them ---- */

const followUpsIgnored: ConditionFn = (data, organisation, now, thresholds) => {
  const waiting = data.commitments.filter(
    (commitment) =>
      commitment.organisationId === organisation.id &&
      commitment.deletedAt === null &&
      commitment.state === 'open' &&
      commitment.ownedByUs === false
  );
  if (waiting.length === 0) return { kind: 'clear' };

  const overdue = waiting.filter(
    (commitment) =>
      commitment.dueDate !== null && daysBetween(commitment.dueDate, now) > thresholds.waitingAfterDays
  );
  const undated = waiting.filter((commitment) => commitment.dueDate === null);

  if (overdue.length === 0 && undated.length === 0) return { kind: 'clear' };

  const worst = overdue
    .map((commitment) => ({ commitment, days: daysBetween(commitment.dueDate as string, now) }))
    .sort((a, b) => b.days - a.days)[0];

  return {
    kind: 'met',
    signal: {
      // The recorded description is quoted rather than folded into a
      // sentence. Rewriting it produced things like "Rosa Pintos was going to
      // rosa to name the approver", because the description already names the
      // person. What somebody wrote down is what gets shown.
      detail: worst
        ? `Recorded as theirs to do: "${worst.commitment.description}". Due ${worst.commitment.dueDate}, ${worst.days} ${worst.days === 1 ? 'day' : 'days'} ago.`
        : `${countPhrase(undated.length, 'thing', 'things')} recorded as theirs to do with no date against ${undated.length === 1 ? 'it' : 'them'}, so nothing will ever flag ${undated.length === 1 ? 'it' : 'them'} as late.`,
      whatWouldClearIt: worst
        ? 'Ask. Where it is no longer needed, close it rather than leaving it open, because an open commitment nobody intends to chase is noise on every future list.'
        : 'Put a date on it, or agree there is not one and close it.',
      evidence: [...overdue, ...undated]
        .slice(0, 5)
        .map((commitment) => ({
          table: 'crm_commitments',
          id: commitment.id,
          what: 'recorded as theirs to do',
        })),
      days: worst?.days ?? null,
    },
  };
};

/** "1 piece of work is", "3 pieces of work are". Written once. */
function countPhrase(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural} ${n === 1 ? 'is' : 'are'}`;
}

/* ---- 7. roles that matter are not recorded ---- */

const noStakeholderCoverage: ConditionFn = (data, organisation) => {
  const index = indexFor(data);
  const people = index.peopleByOrganisation.get(organisation.id) ?? [];
  if (people.length === 0) {
    return { kind: 'not_assessable', because: 'Nobody is recorded at this organisation.' };
  }

  const roles = data.personOrganisationRoles.filter(
    (role) => role.organisationId === organisation.id && role.endedOn === null
  );
  const withoutRole = people.filter(
    (person) => !roles.some((role) => role.personId === person.id)
  );

  if (withoutRole.length === 0) return { kind: 'clear' };

  const nobodyHasOne = withoutRole.length === people.length;

  return {
    kind: 'met',
    signal: {
      detail: nobodyHasOne
        ? people.length === 1
          ? `The only person recorded here has no role recorded, so there is no way to tell what they do.`
          : `None of the ${people.length} people recorded here has a role recorded, so there is no way to tell who does what.`
        : `${withoutRole.length} of the ${people.length} people recorded here have no role recorded.`,
      whatWouldClearIt:
        'Record what each person does. The role is the thing that makes a contact list a buying group.',
      evidence: [
        { table: 'crm_organisations', id: organisation.id, what: 'the organisation' },
        ...withoutRole.slice(0, 5).map((person) => ({
          table: 'crm_people',
          id: person.id,
          what: 'no role recorded',
        })),
      ],
      days: null,
    },
  };
};

/* ---- 8. nobody is recorded as able to decide ---- */

const noDecisionMaker: ConditionFn = (data, organisation) => {
  const openWork = (indexFor(data).workItemsByOrganisation.get(organisation.id) ?? []).filter(
    (item) => item.status === 'open'
  );
  if (openWork.length === 0) {
    return {
      kind: 'not_assessable',
      because: 'No work is open here, so there is nothing waiting on a decision.',
    };
  }

  const roles = data.personOrganisationRoles.filter(
    (role) => role.organisationId === organisation.id && role.endedOn === null
  );
  const decisionMakers = roles.filter((role) => role.stakeholderRole === 'decision_maker');
  if (decisionMakers.length > 0) return { kind: 'clear' };

  // Same precedence as the executive condition, for the same reason.
  if (roles.length === 0) {
    return {
      kind: 'not_assessable',
      because:
        'No role is recorded for anybody here, so this cannot be judged on its own. It is covered by "Roles that matter are not recorded".',
    };
  }

  return {
    kind: 'met',
    signal: {
      detail: `${countPhrase(openWork.length, 'piece of work', 'pieces of work')} open here and nobody is recorded as able to decide.`,
      whatWouldClearIt:
        'Find out who decides and record them. Asking is a normal question and the answer changes how the work should be run.',
      evidence: openWork.slice(0, 5).map((item) => ({
        table: 'crm_work_items',
        id: item.id,
        what: 'open work with no recorded decision maker',
      })),
      days: null,
    },
  };
};

/* ---- 9. nothing is planned next ---- */

const noNextEngagement: ConditionFn = (data, organisation) => {
  if (organisation.lifecycleState === 'closed') {
    return { kind: 'not_assessable', because: 'This organisation is recorded as closed.' };
  }

  const index = indexFor(data);
  const openWork = (index.workItemsByOrganisation.get(organisation.id) ?? []).filter(
    (item) => item.status === 'open'
  );
  const withNextStep = openWork.filter(
    (item) => item.nextStep !== null && item.nextStep.trim() !== ''
  );

  const openTasks = data.tasks.filter(
    (task) =>
      task.organisationId === organisation.id && task.deletedAt === null && task.state === 'open'
  );
  const ourCommitments = data.commitments.filter(
    (commitment) =>
      commitment.organisationId === organisation.id &&
      commitment.deletedAt === null &&
      commitment.state === 'open' &&
      commitment.ownedByUs
  );

  if (withNextStep.length > 0 || openTasks.length > 0 || ourCommitments.length > 0) {
    return { kind: 'clear' };
  }

  return {
    kind: 'met',
    signal: {
      detail:
        openWork.length > 0
          ? `${countPhrase(openWork.length, 'piece of work', 'pieces of work')} open here, and nothing is recorded as the next thing to do: no next step, no task, no commitment of ours.`
          : 'Nothing is recorded as the next thing to do with this account: no open work, no task, no commitment of ours.',
      whatWouldClearIt:
        'Record the next step and when it is due. Where there is genuinely nothing next, that is a decision worth recording too.',
      evidence: [
        { table: 'crm_organisations', id: organisation.id, what: 'the organisation' },
        ...openWork.slice(0, 3).map((item) => ({
          table: 'crm_work_items',
          id: item.id,
          what: 'open work with no next step',
        })),
      ],
      days: null,
    },
  };
};

/* ---- 10. nothing is recorded about what they get out of it ---- */

const noRecordedValue: ConditionFn = (data, organisation) => {
  const plan = data.accountPlans.find(
    (candidate) => candidate.organisationId === organisation.id && candidate.deletedAt === null
  );
  if (!plan) {
    return {
      kind: 'not_assessable',
      because:
        'No account plan exists here. Account planning is off until a workspace turns it on, and a business with eleven customers does not need one.',
    };
  }

  const valueEntries = data.accountPlanEntries.filter(
    (entry) =>
      entry.accountPlanId === plan.id &&
      entry.deletedAt === null &&
      entry.section === 'current_value'
  );
  if (valueEntries.length > 0) return { kind: 'clear' };

  return {
    kind: 'met',
    signal: {
      detail:
        'The plan records nothing about what this customer has actually got out of the relationship.',
      whatWouldClearIt:
        'Record one thing they got, and whether they said it or we did. The difference between a benefit and a claim is who said it.',
      evidence: [{ table: 'crm_account_plans', id: plan.id, what: 'the account plan' }],
      days: null,
    },
  };
};

/* ---- 11. the account plan is overdue for review ---- */

const planOverdueForReview: ConditionFn = (data, organisation, now, thresholds) => {
  const plan = data.accountPlans.find(
    (candidate) => candidate.organisationId === organisation.id && candidate.deletedAt === null
  );
  if (!plan) {
    return { kind: 'not_assessable', because: 'No account plan exists here.' };
  }
  if (plan.reviewDate === null) {
    return {
      kind: 'not_assessable',
      because: 'The plan has no review date, so there is nothing to be overdue against.',
    };
  }

  const overdue = daysBetween(plan.reviewDate, now);
  if (overdue <= thresholds.reviewOverdueByDays) return { kind: 'clear' };

  const lastReview = data.accountReviews
    .filter((review) => review.accountPlanId === plan.id)
    .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt))[0];

  return {
    kind: 'met',
    signal: {
      detail: `The plan was due for review on ${plan.reviewDate}, ${overdue} ${overdue === 1 ? 'day' : 'days'} ago.${
        lastReview
          ? ` The last recorded review was ${lastReview.reviewedAt.slice(0, 10)}.`
          : ' No review has ever been recorded against it.'
      }`,
      whatWouldClearIt:
        'Review it, and record what changed. A plan nobody revisits is a document.',
      evidence: [
        { table: 'crm_account_plans', id: plan.id, what: 'the plan and its review date' },
        ...(lastReview
          ? [{ table: 'crm_account_reviews', id: lastReview.id, what: 'the last recorded review' }]
          : []),
      ],
      days: overdue,
    },
  };
};

/* ===================================================== the register */

/**
 * The eleven, in the order the page shows them.
 *
 * The order is not a severity ranking. It runs from the conditions about the
 * relationship itself, through the ones about what is happening, to the ones
 * about what is written down, because that is the order somebody reads an
 * account in.
 */
const CONDITIONS: Record<AttentionCondition, ConditionFn> = {
  single_contact_dependency: singleContactDependency,
  no_executive_relationship: noExecutiveRelationship,
  no_interaction_90: noInteraction90,
  renewal_approaching: renewalApproaching,
  service_issue_unresolved: serviceIssueUnresolved,
  follow_ups_ignored: followUpsIgnored,
  no_stakeholder_coverage: noStakeholderCoverage,
  no_decision_maker: noDecisionMaker,
  no_next_engagement: noNextEngagement,
  no_recorded_value: noRecordedValue,
  plan_overdue_for_review: planOverdueForReview,
};

/* ===================================================== decisions */

/**
 * A dismissal that has expired is not a dismissal.
 *
 * The expiry is what stops the attention list being quietly emptied over a few
 * months. A person dismissing "renewal approaching" in March made a decision
 * about March.
 */
export function decisionFor(
  data: CrmWorkspaceData,
  organisationId: string,
  condition: AttentionCondition,
  now: string
): RelationshipSignalState | null {
  const live = data.relationshipSignals
    .filter(
      (row) =>
        row.organisationId === organisationId &&
        row.condition === condition &&
        (row.expiresAt === null || Date.parse(row.expiresAt) > Date.parse(now))
    )
    .sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));

  return live.at(-1) ?? null;
}

/* ===================================================== the answers */

export function attentionFor(
  data: CrmWorkspaceData,
  organisationId: string,
  now: string,
  thresholds: AttentionThresholds = DEFAULT_THRESHOLDS
): AccountAttention | null {
  const organisation = indexFor(data).organisationsById.get(organisationId);
  if (!organisation || organisation.deletedAt !== null) return null;

  const signals: Signal[] = [];
  const dismissed: Signal[] = [];
  const notAssessable: AccountAttention['notAssessable'] = [];

  for (const condition of ATTENTION_CONDITIONS) {
    const result = CONDITIONS[condition](data, organisation, now, thresholds);

    if (result.kind === 'not_assessable') {
      notAssessable.push({ condition, because: result.because });
      continue;
    }
    if (result.kind === 'clear') continue;

    const stored = decisionFor(data, organisationId, condition, now);
    const decision: SignalDecision | null = stored
      ? {
          id: stored.id,
          state: stored.state,
          reason: stored.reason,
          decidedAt: stored.decidedAt,
          expiresAt: stored.expiresAt,
          detailAtDecision: stored.detailAtDecision,
        }
      : null;
    const signal: Signal = {
      condition,
      organisationId,
      organisationName: organisation.name,
      label: CONDITION_LABELS[condition],
      path: `/crm/organisations/${organisationId}`,
      decision,
      ...result.signal,
    };

    if (decision?.state === 'dismissed') dismissed.push(signal);
    else signals.push(signal);
  }

  return {
    organisation: {
      id: organisation.id,
      name: organisation.name,
      lifecycleState: organisation.lifecycleState,
    },
    signals,
    dismissed,
    attentionCount: signals.length,
    notAssessable,
  };
}

export interface WorkspaceAttention {
  accounts: AccountAttention[];
  /** How many accounts have at least one condition true. */
  accountsNeedingAttention: number;
  /** How many conditions are true across the workspace, by condition. */
  byCondition: { condition: AttentionCondition; label: string; count: number }[];
  /** Accounts with nothing true, which is a fact worth showing. */
  clear: number;
  /** Said on the page, every time. */
  note: string;
  generatedAt: string;
}

export const ATTENTION_NOTE =
  'This page is about accounts, never about people. The number beside an account is how many of eleven named conditions are currently true of it, not a score: there is no weighting, nothing is added up into a judgement, and there is no view here that groups any of it by who owns the account.';

/**
 * Every account, ordered by how many conditions are true.
 *
 * Ordering by the count is the one place this could drift into ranking, so:
 * the count is of conditions rather than of anything about a person, the
 * ordering is stable and alphabetical within a count, and the page shows the
 * conditions rather than the number as its primary content.
 */
export function workspaceAttention(
  data: CrmWorkspaceData,
  now: string,
  thresholds: AttentionThresholds = DEFAULT_THRESHOLDS
): WorkspaceAttention {
  const index = indexFor(data);

  const accounts = index.liveOrganisations
    .map((organisation) => attentionFor(data, organisation.id, now, thresholds))
    .filter((entry): entry is AccountAttention => entry !== null)
    .sort((a, b) =>
      b.attentionCount === a.attentionCount
        ? a.organisation.name.localeCompare(b.organisation.name, 'en-AU')
        : b.attentionCount - a.attentionCount
    );

  const byCondition = ATTENTION_CONDITIONS.map((condition) => ({
    condition,
    label: CONDITION_LABELS[condition],
    count: accounts.filter((account) =>
      account.signals.some((signal) => signal.condition === condition)
    ).length,
  }));

  return {
    accounts,
    accountsNeedingAttention: accounts.filter((account) => account.attentionCount > 0).length,
    byCondition,
    clear: accounts.filter((account) => account.attentionCount === 0).length,
    note: ATTENTION_NOTE,
    generatedAt: now,
  };
}

/**
 * The signals for one account as the relationship agent reads them.
 *
 * Exported so the Stage 7 relationship agent can brief from the same
 * definitions the page shows, rather than from a second set that would
 * eventually disagree with it.
 */
export function signalsForBriefing(
  data: CrmWorkspaceData,
  organisationId: string,
  now: string
): Signal[] {
  return attentionFor(data, organisationId, now)?.signals ?? [];
}
