/**
 * The service module.
 *
 * PRIORITY IS BASED ON CONSEQUENCE, NOT ON WHO SHOUTED.
 *
 * The brief says "priority based on consequence" and that is the one design
 * decision in this file worth defending. Every service desk starts with
 * low/medium/high/urgent, and within six weeks everything is high, because
 * priority with no definition is decided by whoever is most annoyed. The
 * customer who escalates gets served; the quiet customer whose problem is
 * worse does not.
 *
 * So priority here is DERIVED from what the case says about its consequence,
 * and the derivation is shown: who is affected, whether they can work, whether
 * money or an obligation is at stake, and whether the relationship is already
 * under strain. A person can override it, and the override records who and why,
 * because a derived priority that cannot be overridden is a different kind of
 * wrong.
 *
 * SLA IS A TARGET, NOT A PROMISE.
 *
 * Nothing here has been sold to anybody, so no SLA has been agreed with any
 * customer. The targets are Concludo's own internal intention, and the module
 * says so wherever one appears. Shipping a field called "SLA breached" against
 * a target nobody agreed to is how a support team gets measured on a number
 * that means nothing.
 */
import { indexFor } from './paging';
import { CrmWorkspaceData, Organisation, Person, ServiceCase, WorkItem } from '../domain';
import { CrmRole } from '../domain';
import { maySeeField } from './governance';

/* ======================================================= priority */

export type Consequence =
  | 'cannot_work'
  | 'work_impaired'
  | 'obligation_at_risk'
  | 'money_at_risk'
  | 'inconvenience'
  | 'not_recorded';

export const CONSEQUENCE_WORDS: Record<Consequence, string> = {
  cannot_work: 'They cannot do the work at all',
  work_impaired: 'They can work, with difficulty',
  obligation_at_risk: 'An obligation of theirs is at risk',
  money_at_risk: 'Money is at risk',
  inconvenience: 'It is an inconvenience',
  not_recorded: 'Nobody has recorded what the consequence is',
};

export type Priority = 'now' | 'today' | 'this_week' | 'when_we_can' | 'undecided';

export const PRIORITY_WORDS: Record<Priority, string> = {
  now: 'Now',
  today: 'Today',
  this_week: 'This week',
  when_we_can: 'When we can',
  undecided: 'Not decided',
};

export interface PriorityDerivation {
  priority: Priority;
  /** Each fact that pushed it, in words. Never a score. */
  because: string[];
  /** True where a person set it rather than the rules. */
  overridden: boolean;
  overriddenBy: string | null;
  overrideReason: string | null;
}

/**
 * Priority from consequence, with the reasoning shown.
 *
 * The rules are deliberately coarse. Four levels, derived from at most four
 * facts, because a priority formula with eleven inputs is one nobody can
 * predict and therefore one everybody overrides.
 */
export function derivePriority(
  kase: ServiceCase,
  context: { consequence: Consequence; peopleAffected: number; relationshipUnderStrain: boolean }
): PriorityDerivation {
  const because: string[] = [];
  let priority: Priority = 'when_we_can';

  if (context.consequence === 'cannot_work') {
    priority = 'now';
    because.push('Somebody cannot do their work at all.');
  } else if (context.consequence === 'obligation_at_risk' || context.consequence === 'money_at_risk') {
    priority = 'today';
    because.push(
      context.consequence === 'obligation_at_risk'
        ? 'An obligation of the customer’s is at risk.'
        : 'Money is at risk.'
    );
  } else if (context.consequence === 'work_impaired') {
    priority = 'this_week';
    because.push('They can work, with difficulty.');
  } else if (context.consequence === 'not_recorded') {
    priority = 'undecided';
    because.push(
      'Nobody has recorded what this does to the customer, so there is nothing to base a priority on.'
    );
  } else {
    because.push('Recorded as an inconvenience.');
  }

  if (context.peopleAffected > 5 && priority !== 'now') {
    because.push(`${context.peopleAffected} people are affected rather than one.`);
    priority = priority === 'today' ? 'now' : 'today';
  }

  if (context.relationshipUnderStrain && priority !== 'now') {
    because.push(
      'This account already has something unresolved, so another unanswered issue costs more than the issue itself.'
    );
  }

  if (kase.severity === 'high' && priority === 'when_we_can') {
    because.push('Recorded as high severity by the person who raised it.');
    priority = 'this_week';
  }

  return {
    priority,
    because,
    overridden: false,
    overriddenBy: null,
    overrideReason: null,
  };
}

/* ============================================================ SLA */

export interface SlaTarget {
  priority: Priority;
  /** Hours to first response, and to resolution. Concludo's own intention. */
  firstResponseHours: number;
  resolutionHours: number;
}

export const SLA_TARGETS: SlaTarget[] = [
  { priority: 'now', firstResponseHours: 1, resolutionHours: 8 },
  { priority: 'today', firstResponseHours: 4, resolutionHours: 24 },
  { priority: 'this_week', firstResponseHours: 24, resolutionHours: 120 },
  { priority: 'when_we_can', firstResponseHours: 72, resolutionHours: 336 },
  { priority: 'undecided', firstResponseHours: 24, resolutionHours: 120 },
];

/** Said wherever an SLA figure appears. Not configurable. */
export const SLA_NOTE =
  'These are Concludo’s own internal targets. No service level has been agreed with any customer, because Concludo has no customers yet. Nothing here is a contractual commitment.';

export interface SlaState {
  target: SlaTarget;
  hoursOpen: number;
  /** Null where nobody has responded yet. */
  hoursToFirstResponse: number | null;
  firstResponseOverdue: boolean;
  resolutionOverdue: boolean;
  /** Hours remaining, negative where past. */
  resolutionHoursRemaining: number;
  note: string;
}

/* ====================================================== the case */

export interface ServiceCaseView {
  kase: ServiceCase;
  organisation: Organisation | null;
  person: Person | null;
  workItem: WorkItem | null;

  consequence: Consequence;
  consequenceWord: string;
  priority: PriorityDerivation;
  sla: SlaState;

  /** The detail, or null where the reader may not see it. */
  detail: string | null;
  detailRedacted: boolean;
  detailRedactedBecause: string | null;

  /** Everything recorded with this customer, for context. */
  customerHistory: {
    at: string;
    what: string;
    kind: 'case' | 'conversation' | 'commitment' | 'work';
  }[];

  /** A knowledge reference, where one is recorded against the case. */
  knowledgeReference: string | null;

  /** A draft response, which is never sent. */
  draft: { body: string; approvedBy: string | null; approvedAt: string | null } | null;
  /**
   * Where a draft comes from, said on every case that has none.
   *
   * There is deliberately no second drafting path here. A reply to a customer
   * is an agent proposal, so it arrives through the approval queue built in
   * Stage 7, with the grounding check, the recipient taken from the record and
   * the refusal to send. A "quick reply" box on this screen would be a second,
   * weaker version of all of that, and it is the version people would use.
   */
  draftNote: string;

  /** Resolution and reopening. */
  resolvedAt: string | null;
  reopened: boolean;

  /** Said on every case that carries a draft. */
  sendingNote: string;
}

export const SERVICE_SENDING_NOTE =
  'A draft response is a draft. Concludo has no way to send anything in this release, so copy it, change it, and send it yourself.';

function consequenceOf(kase: ServiceCase): Consequence {
  const effect = (kase.relationshipEffect ?? '').toLowerCase();
  if (!effect) return 'not_recorded';
  if (/cannot|can't|unable to|blocked|stopped/.test(effect)) return 'cannot_work';
  if (/invoice|payment|money|charge|refund/.test(effect)) return 'money_at_risk';
  if (/deadline|audit|compliance|obligation|report by/.test(effect)) return 'obligation_at_risk';
  if (/slow|workaround|difficult|awkward/.test(effect)) return 'work_impaired';
  return 'inconvenience';
}

export function buildCase(
  data: CrmWorkspaceData,
  caseId: string,
  now: string,
  role: CrmRole
): ServiceCaseView | null {
  const kase = data.serviceCases.find((c) => c.id === caseId && c.deletedAt === null);
  if (!kase) return null;

  // Map reads rather than scans. A service inbox builds one of these per open
  // case, and a scan of the contact table per case is how an inbox of forty
  // cases reads a hundred thousand contacts forty times.
  const index = indexFor(data);

  const organisation =
    kase.organisationId === null
      ? null
      : (index.organisationsById.get(kase.organisationId) ?? null);
  const person = kase.personId ? (index.peopleById.get(kase.personId) ?? null) : null;
  const workItem = kase.workItemId
    ? (data.workItems.find((w) => w.id === kase.workItemId && w.deletedAt === null) ?? null)
    : null;

  const consequence = consequenceOf(kase);

  const peopleAffected =
    kase.organisationId === null
      ? 0
      : (index.peopleByOrganisation.get(kase.organisationId) ?? []).length;

  const otherOpen = data.serviceCases.filter(
    (c) =>
      c.organisationId === kase.organisationId &&
      c.id !== kase.id &&
      c.deletedAt === null &&
      c.state !== 'resolved' &&
      c.state !== 'closed'
  );

  const priority = derivePriority(kase, {
    consequence,
    peopleAffected,
    relationshipUnderStrain: otherOpen.length > 0,
  });

  const target =
    SLA_TARGETS.find((entry) => entry.priority === priority.priority) ?? SLA_TARGETS[3];

  const hoursOpen = Math.max(
    0,
    (new Date(now).getTime() - new Date(kase.raisedAt).getTime()) / 3_600_000
  );

  const firstResponse = data.activities
    .filter(
      (activity) =>
        activity.organisationId === kase.organisationId &&
        activity.deletedAt === null &&
        Date.parse(activity.occurredAt) > Date.parse(kase.raisedAt)
    )
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];

  const hoursToFirstResponse = firstResponse
    ? (new Date(firstResponse.occurredAt).getTime() - new Date(kase.raisedAt).getTime()) / 3_600_000
    : null;

  const resolved = kase.state === 'resolved' || kase.state === 'closed';

  const sla: SlaState = {
    target,
    hoursOpen: Math.round(hoursOpen),
    hoursToFirstResponse:
      hoursToFirstResponse === null ? null : Math.round(hoursToFirstResponse),
    firstResponseOverdue:
      hoursToFirstResponse === null
        ? hoursOpen > target.firstResponseHours
        : hoursToFirstResponse > target.firstResponseHours,
    resolutionOverdue: !resolved && hoursOpen > target.resolutionHours,
    resolutionHoursRemaining: Math.round(target.resolutionHours - hoursOpen),
    // Per case, in hours a person can act on. The standing sentence about
    // these being Concludo's own targets is said once at the top of the
    // screen rather than on every card, where it stops being read.
    note: (() => {
      const open = `${Math.round(hoursOpen)} ${Math.round(hoursOpen) === 1 ? 'hour' : 'hours'} open.`;
      const response =
        hoursToFirstResponse === null
          ? 'Nothing has been recorded back to the customer yet.'
          : `First response after ${Math.round(hoursToFirstResponse)} ${Math.round(hoursToFirstResponse) === 1 ? 'hour' : 'hours'}.`;
      const against = resolved
        ? 'Resolved, so the clock has stopped.'
        : hoursOpen > target.resolutionHours
          ? `Concludo's own target of ${target.resolutionHours} hours passed ${Math.round(hoursOpen - target.resolutionHours)} hours ago.`
          : `${Math.round(target.resolutionHours - hoursOpen)} hours left against Concludo's own target of ${target.resolutionHours}.`;
      return `${open} ${response} ${against}`;
    })(),
  };

  /* ---- the restricted field ---- */
  const maySeeDetail = maySeeField(role, 'crm_service_cases', 'detail');

  /* ---- customer history, which is the point of putting this in a CRM ---- */
  const history: ServiceCaseView['customerHistory'] = [
    ...data.serviceCases
      .filter((c) => c.organisationId === kase.organisationId && c.deletedAt === null)
      .map((c) => ({ at: c.raisedAt, what: c.title, kind: 'case' as const })),
    ...data.activities
      .filter((a) => a.organisationId === kase.organisationId && a.deletedAt === null)
      .map((a) => ({ at: a.occurredAt, what: a.title, kind: 'conversation' as const })),
    ...data.commitments
      .filter((c) => c.organisationId === kase.organisationId && c.deletedAt === null)
      .map((c) => ({ at: c.createdAt, what: c.description, kind: 'commitment' as const })),
    ...data.workItems
      .filter((w) => w.organisationId === kase.organisationId && w.deletedAt === null)
      .map((w) => ({ at: w.createdAt, what: w.title, kind: 'work' as const })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    kase,
    organisation,
    person,
    workItem,
    consequence,
    consequenceWord: CONSEQUENCE_WORDS[consequence],
    priority,
    sla,
    detail: maySeeDetail ? kase.detail : null,
    detailRedacted: !maySeeDetail && kase.detail !== null,
    detailRedactedBecause: maySeeDetail
      ? null
      : 'Not shown here. A service case detail is the customer’s own account of a problem, and it is withheld from anybody whose role would not let them open the case.',
    customerHistory: history,
    // A knowledge reference is a POINTER somebody recorded against this case,
    // never an article Concludo wrote. Concludo has no knowledge base, and a
    // field that invented one would be the kind of helpfulness that puts a
    // wrong answer in front of a customer.
    knowledgeReference:
      data.attachmentReferences.find(
        (reference) =>
          reference.deletedAt === null &&
          reference.subjectTable === 'crm_service_cases' &&
          reference.subjectId === kase.id
      )?.fileName ?? null,
    // A draft response is an agent proposal, which means it arrives through
    // the approval queue built in Stage 7 rather than through a second,
    // weaker path of its own. If there is no proposal for this case, there is
    // no draft, and the screen says where one would come from.
    draft: (() => {
      const proposal = data.proposals.find(
        (candidate) =>
          candidate.deletedAt === null &&
          candidate.subjectTable === 'crm_service_cases' &&
          candidate.subjectId === kase.id
      );
      if (!proposal) return null;

      const approval = data.approvals.find(
        (candidate) => candidate.proposalId === proposal.id && candidate.decision === 'confirmed'
      );
      return {
        body: proposal.headline,
        approvedBy: approval?.decidedBy ?? null,
        approvedAt: approval?.decidedAt ?? null,
      };
    })(),
    draftNote:
      'A reply to a customer is drafted by the drafting agent and approved in the proposal queue, not here. It is the same path as every other message, with the same checks, and nothing on it sends.',
    resolvedAt: kase.resolvedAt,
    reopened: false,
    sendingNote: SERVICE_SENDING_NOTE,
  };
}

/* =================================================== the shared inbox */

export interface ServiceInbox {
  /** Everything open, ordered by what the consequence says, not by age. */
  open: ServiceCaseView[];
  waitingOnCustomer: ServiceCaseView[];
  resolved: ServiceCaseView[];
  /** Counts for the rail. */
  counts: Record<Priority, number>;
  /** Cases past a target, which is a Concludo target and says so. */
  atRisk: ServiceCaseView[];
  unassigned: ServiceCaseView[];
  withoutConsequence: ServiceCaseView[];
  slaNote: string;
}

const PRIORITY_ORDER: Priority[] = ['now', 'today', 'this_week', 'when_we_can', 'undecided'];

export function buildServiceInbox(
  data: CrmWorkspaceData,
  now: string,
  role: CrmRole
): ServiceInbox {
  const views = data.serviceCases
    .filter((kase) => kase.deletedAt === null)
    .map((kase) => buildCase(data, kase.id, now, role))
    .filter((view): view is ServiceCaseView => view !== null);

  const byPriority = (a: ServiceCaseView, b: ServiceCaseView) =>
    PRIORITY_ORDER.indexOf(a.priority.priority) - PRIORITY_ORDER.indexOf(b.priority.priority);

  const counts: Record<Priority, number> = {
    now: 0,
    today: 0,
    this_week: 0,
    when_we_can: 0,
    undecided: 0,
  };
  for (const view of views) {
    if (view.kase.state === 'resolved' || view.kase.state === 'closed') continue;
    counts[view.priority.priority] += 1;
  }

  return {
    open: views
      .filter((view) => view.kase.state === 'open' || view.kase.state === 'with_us')
      .sort(byPriority),
    waitingOnCustomer: views.filter((view) => view.kase.state === 'with_customer'),
    resolved: views.filter(
      (view) => view.kase.state === 'resolved' || view.kase.state === 'closed'
    ),
    counts,
    atRisk: views
      .filter(
        (view) =>
          view.kase.state !== 'resolved' &&
          view.kase.state !== 'closed' &&
          (view.sla.resolutionOverdue || view.sla.firstResponseOverdue)
      )
      .sort(byPriority),
    unassigned: views.filter(
      (view) => view.kase.ownerUserId === null && view.kase.state !== 'closed'
    ),
    withoutConsequence: views.filter((view) => view.consequence === 'not_recorded'),
    slaNote: SLA_NOTE,
  };
}
