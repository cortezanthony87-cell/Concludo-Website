/**
 * The internal account review: what changed, what is owed, what to decide.
 *
 * WHAT A REVIEW IS FOR, AND WHY THAT SHAPES THIS FILE.
 *
 * An account review meeting fails in a predictable way. Somebody opens the plan
 * and reads it aloud. Everybody already knows what it says, nobody can remember
 * which parts are new, the hour goes on confirming things that have not changed,
 * and the two decisions that actually needed making get four minutes at the end.
 *
 * So this workspace is built around one question: WHAT IS DIFFERENT SINCE THE
 * LAST TIME WE LOOKED. Everything here is anchored to `lastReviewedAt`, and the
 * things that have not changed are deliberately absent. The plan is one click
 * away for anybody who wants to read it.
 *
 * The second thing it is built around is what the meeting owes and is owed:
 * commitments completed and overdue, on both sides. A review that does not
 * check whether we did what we said is a review that teaches the customer that
 * what we say does not mean much.
 *
 * NOTHING HERE DECIDES ANYTHING. "Decisions required" lists the things that
 * need a person, with what each one is waiting on. It never proposes which way
 * to go, never ranks them by value, and never estimates a consequence. The
 * agenda is a list of headings, not a script.
 */
import {
  AccountReview,
  Activity,
  Commitment,
  CrmWorkspaceData,
  Decision,
  Proposal,
  ServiceCase,
  WorkItem,
} from '../domain';
import { AccountPlanView } from './accountPlan';
import { ProcessRisk } from './stakeholderMap';

/* ------------------------------------------------- what has changed */

export type ChangeKind =
  | 'work_opened'
  | 'work_resolved'
  | 'case_raised'
  | 'case_resolved'
  | 'decision_recorded'
  | 'person_added'
  | 'meeting_held'
  | 'plan_changed';

export interface ReviewChange {
  kind: ChangeKind;
  at: string;
  what: string;
  /** The detail, where there is one worth reading in a meeting. */
  detail: string | null;
  /** Where to look. Null where the thing has no page of its own. */
  path: string | null;
}

const CHANGE_WORDS: Record<ChangeKind, string> = {
  work_opened: 'Work opened',
  work_resolved: 'Work resolved',
  case_raised: 'Case raised',
  case_resolved: 'Case resolved',
  decision_recorded: 'Decision recorded',
  person_added: 'Person added',
  meeting_held: 'Meeting held',
  plan_changed: 'Plan changed',
};

export { CHANGE_WORDS };

/* --------------------------------------------------- the whole review */

export interface AccountReviewView {
  plan: AccountPlanView;
  /** The review this one follows, where there is one. */
  lastReview: AccountReview | null;
  /** The moment everything below is measured from, and where it came from. */
  since: string | null;
  sinceLabel: string;

  changes: ReviewChange[];
  completedCommitments: Commitment[];
  overdueCommitments: Commitment[];
  /** Theirs as well as ours, kept apart, because the asymmetry is the point. */
  commitmentsBySide: {
    oursCompleted: Commitment[];
    oursOverdue: Commitment[];
    theirsCompleted: Commitment[];
    theirsOverdue: Commitment[];
  };

  opportunities: WorkItem[];
  serviceIssues: ServiceCase[];
  relationshipGaps: ProcessRisk[];

  /** Things that need a person. Never answered here. */
  decisionsRequired: { what: string; waitingOn: string; path: string | null }[];
  /** Headings for the next conversation, in the order they are worth having. */
  nextAgenda: { heading: string; because: string }[];
  /** Proposals about this account that nobody has confirmed. */
  proposedChanges: Proposal[];

  /** True where nothing has changed at all, which is itself worth saying. */
  nothingChanged: boolean;
  history: AccountReview[];
}

function recentDecisions(
  data: CrmWorkspaceData,
  organisationId: string,
  since: string | null
): Decision[] {
  // A decision carries the DAY it was made, not a timestamp, so a decision
  // made on the day of the last review counts as after it. Treating the date
  // as midnight would silently drop the decision the review itself produced.
  return data.decisions.filter(
    (d) =>
      d.deletedAt === null &&
      d.organisationId === organisationId &&
      (since === null || (d.decidedOn ?? d.createdAt.slice(0, 10)) >= since.slice(0, 10))
  );
}

function recentMeetings(
  data: CrmWorkspaceData,
  organisationId: string,
  since: string | null
): Activity[] {
  return data.activities.filter(
    (a) =>
      a.deletedAt === null &&
      a.organisationId === organisationId &&
      a.activityType === 'meeting' &&
      (since === null || a.occurredAt > since)
  );
}

export function buildAccountReview(
  data: CrmWorkspaceData,
  plan: AccountPlanView,
  now: string
): AccountReviewView {
  const organisationId = plan.organisation.id;

  const history = data.accountReviews
    .filter((r) => r.accountPlanId === plan.plan.id && r.deletedAt === null)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));

  const lastReview = history[0] ?? null;
  const since = lastReview?.reviewedAt ?? plan.plan.lastReviewedAt ?? null;
  const sinceLabel = since
    ? `since the last review on ${since.slice(0, 10)}`
    : 'since this account was first recorded, because it has never been reviewed';

  /* ---- what changed ---- */

  const changes: ReviewChange[] = [];

  for (const item of data.workItems) {
    if (item.organisationId !== organisationId || item.deletedAt !== null) continue;
    if (since === null || item.createdAt > since) {
      changes.push({
        kind: 'work_opened',
        at: item.createdAt,
        what: item.title,
        detail: null,
        path: `/crm/work/${item.id}`,
      });
    }
    if (item.resolvedAt && (since === null || item.resolvedAt > since)) {
      changes.push({
        kind: 'work_resolved',
        at: item.resolvedAt,
        what: item.title,
        detail: item.resolutionReason,
        path: `/crm/work/${item.id}`,
      });
    }
  }

  for (const kase of data.serviceCases) {
    if (kase.organisationId !== organisationId || kase.deletedAt !== null) continue;
    if (since === null || kase.raisedAt > since) {
      changes.push({
        kind: 'case_raised',
        at: kase.raisedAt,
        what: kase.title,
        detail: kase.relationshipEffect,
        path: '/crm/service',
      });
    }
    if (kase.resolvedAt && (since === null || kase.resolvedAt > since)) {
      changes.push({
        kind: 'case_resolved',
        at: kase.resolvedAt,
        what: kase.title,
        detail: null,
        path: '/crm/service',
      });
    }
  }

  for (const decision of recentDecisions(data, organisationId, since)) {
    changes.push({
      kind: 'decision_recorded',
      at: decision.decidedOn ?? decision.createdAt.slice(0, 10),
      what: decision.title,
      detail: decision.summary ?? decision.reasoning,
      path: null,
    });
  }

  for (const meeting of recentMeetings(data, organisationId, since)) {
    changes.push({
      kind: 'meeting_held',
      at: meeting.occurredAt,
      what: meeting.title,
      detail: meeting.summary,
      path: '/crm/activities',
    });
  }

  for (const person of data.people) {
    if (person.organisationId !== organisationId || person.deletedAt !== null) continue;
    if (since !== null && person.createdAt > since) {
      changes.push({
        kind: 'person_added',
        at: person.createdAt,
        what: person.fullName,
        detail: person.roleLabel,
        path: `/crm/people/${person.id}`,
      });
    }
  }

  for (const entry of data.accountPlanEntries) {
    if (entry.accountPlanId !== plan.plan.id || entry.deletedAt !== null) continue;
    if (since !== null && entry.createdAt > since) {
      changes.push({
        kind: 'plan_changed',
        at: entry.createdAt,
        what: entry.body,
        detail: null,
        path: null,
      });
    }
  }

  changes.sort((a, b) => b.at.localeCompare(a.at));

  /* ---- what was owed ---- */

  const forAccount = data.commitments.filter(
    (c) => c.organisationId === organisationId && c.deletedAt === null
  );

  const completedCommitments = forAccount.filter(
    (c) => c.state === 'done' && c.completedAt !== null && (since === null || c.completedAt > since)
  );

  const today = now.slice(0, 10);
  const overdueCommitments = forAccount.filter(
    (c) => c.state === 'open' && c.dueDate !== null && c.dueDate < today
  );

  /* ---- what needs a person ---- */

  const decisionsRequired: AccountReviewView['decisionsRequired'] = [];

  for (const proposal of plan.pendingProposals) {
    decisionsRequired.push({
      what: proposal.headline,
      waitingOn: 'Somebody here has to confirm or decline it.',
      path: '/crm/proposals',
    });
  }

  for (const jointPlan of plan.jointPlans) {
    if (jointPlan.plan.approvalState === 'internal_review') {
      decisionsRequired.push({
        what: `The joint plan with ${plan.organisation.name} is waiting for approval.`,
        waitingOn: jointPlan.canBeApproved
          ? 'An approver.'
          : 'The things listed on the plan itself.',
        path: `/crm/joint-plans/${jointPlan.plan.id}`,
      });
    }
  }

  if (plan.reviewOverdueDays !== null) {
    decisionsRequired.push({
      what: `This review was due ${plan.reviewOverdueDays} days ago.`,
      waitingOn: 'Whoever owns the plan.',
      path: null,
    });
  }

  for (const risk of plan.stakeholders?.risks ?? []) {
    if (risk.kind === 'no_decision_maker' || risk.kind === 'owner_unclear') {
      decisionsRequired.push({
        what: risk.what,
        waitingOn: risk.whatWouldHelp,
        path: '/crm/coverage',
      });
    }
  }

  /* ---- the next agenda ---- */

  const nextAgenda: AccountReviewView['nextAgenda'] = [];

  if (plan.openServiceCases.length > 0) {
    nextAgenda.push({
      heading: 'Open service issues',
      because: `${plan.openServiceCases.length} ${plan.openServiceCases.length === 1 ? 'issue is' : 'issues are'} open, and each one has an effect on the relationship recorded against it.`,
    });
  }
  if (overdueCommitments.some((c) => c.ownedByUs)) {
    nextAgenda.push({
      heading: 'What we promised and have not done',
      because: 'Going first on our own overdue commitments is what makes the rest of the hour credible.',
    });
  }
  if (plan.renewalInDays !== null && plan.renewalInDays <= 90) {
    nextAgenda.push({
      heading: 'The renewal',
      because: `It is ${plan.renewalInDays} days away.`,
    });
  }
  if (plan.objectives.some((o) => o.state === 'needs_attention')) {
    nextAgenda.push({
      heading: 'The objectives that are not on track',
      because: 'Somebody recorded them as needing attention, and nothing has changed them since.',
    });
  }
  if ((plan.whitespace?.unknownCount ?? 0) > 0) {
    nextAgenda.push({
      heading: 'What we have never asked them',
      because: `${plan.whitespace?.unknownCount} cells on the whitespace grid are still not known.`,
    });
  }
  if (plan.notRecorded.length > 0) {
    nextAgenda.push({
      heading: 'Parts of the plan nobody has written',
      because: plan.notRecorded.slice(0, 3).join('; ') + '.',
    });
  }

  return {
    plan,
    lastReview,
    since,
    sinceLabel,
    changes,
    completedCommitments,
    overdueCommitments,
    commitmentsBySide: {
      oursCompleted: completedCommitments.filter((c) => c.ownedByUs),
      oursOverdue: overdueCommitments.filter((c) => c.ownedByUs),
      theirsCompleted: completedCommitments.filter((c) => !c.ownedByUs),
      theirsOverdue: overdueCommitments.filter((c) => !c.ownedByUs),
    },
    opportunities: plan.openWork,
    serviceIssues: plan.openServiceCases,
    relationshipGaps: plan.stakeholders?.risks ?? [],
    decisionsRequired,
    nextAgenda,
    proposedChanges: plan.pendingProposals,
    nothingChanged:
      changes.length === 0 && completedCommitments.length === 0 && overdueCommitments.length === 0,
    history,
  };
}
