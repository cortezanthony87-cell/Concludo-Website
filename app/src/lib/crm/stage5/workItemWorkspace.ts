/**
 * The opportunity or job workspace: one record, everything about it.
 *
 * Nineteen things the brief lists, on one page, because the alternative is the
 * thing every CRM does: a record with six tabs, where the decision somebody
 * made in March is two clicks from the quote it was about, and nobody ever
 * reads both.
 *
 * TWO OF THE NINETEEN DESERVE A NOTE.
 *
 * COMPETITION. The model has no competitor table and this stage does not add
 * one, because a competitor field is almost always a text box somebody fills in
 * once and never updates, and a stale competitor name is worse than none: it
 * gets repeated in a meeting as if it were current. So competition is drawn
 * from what was actually said: decisions and notes that name an alternative,
 * with the sentence and the date. Where nothing was said, the view says nothing
 * was said rather than showing an empty field that looks like "no competition".
 *
 * REQUIRED APPROVALS. Likewise: there is no approval-workflow engine here. What
 * exists is the proposal and approval pair from Stage 3, and the stage exit
 * criteria. Both are real, both are recorded, and together they answer "what
 * has to happen before this can move". Inventing a third mechanism that nothing
 * enforces would be a screen that lies.
 */
import {
  AccountPlan,
  Activity,
  Commitment,
  CrmWorkspaceData,
  Decision,
  Note,
  Organisation,
  Person,
  Product,
  Proposal,
  Quote,
  QuoteLine,
  ServiceCase,
  StageMove,
  WorkItem,
} from '../domain';
import { SourceTrail, trailsFor } from '../stage4/sources';
import { TimelineEntry, buildTimeline, filterTimeline } from '../stage4/timeline';
import { ROLE_WORDS } from '../stage4/relationships';
import { PipelineCard, buildCard } from './pipeline';
import { WorkItemEstimate, estimateFor } from './forecast';
import { CloseDateChange } from './writes';
import { auditFor } from './writes';

const DAY = 86_400_000;
const daysBetween = (from: string, to: string): number =>
  Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY);

export interface StakeholderOnWork {
  person: Person;
  role: string;
  isPrimary: boolean;
  lastContactAt: string | null;
  /** True where this person is the one the work hangs on. */
  isOnlyContact: boolean;
}

export interface CompetitionMention {
  /** What was said. */
  quote: string;
  when: string;
  /** Where it was said: a decision, a note, a meeting. */
  from: string;
  /** The record to open. */
  subjectTable: string;
  subjectId: string;
}

export interface RequiredApproval {
  what: string;
  /** Met, outstanding, or waiting on a person. */
  state: 'met' | 'outstanding' | 'awaiting_a_person';
  detail: string;
  /** Where it comes from, so nobody thinks this is a workflow engine. */
  origin: 'stage criterion' | 'proposed update';
}

export interface WorkItemWorkspace {
  item: WorkItem;
  card: PipelineCard;
  recordWord: string;

  organisation: Organisation | null;
  contacts: StakeholderOnWork[];
  missingRoles: string[];

  /** What they actually want, from what was recorded. */
  need: string | null;
  needSource: string | null;

  products: Product[];
  quotes: { quote: Quote; lines: QuoteLine[] }[];

  stageHistory: { move: StageMove; fromName: string | null; toName: string }[];
  closeDateChanges: CloseDateChange[];

  timeline: TimelineEntry[];
  meetings: Activity[];
  communications: TimelineEntry[];
  decisions: Decision[];
  commitments: { ours: Commitment[]; theirs: Commitment[] };
  notes: Note[];
  serviceCases: ServiceCase[];
  accountPlan: AccountPlan | null;

  requiredApprovals: RequiredApproval[];
  competition: CompetitionMention[];
  risks: { what: string; because: string }[];

  proposals: Proposal[];
  evidence: SourceTrail[];
  estimate: WorkItemEstimate;
  audit: { at: string; what: string; detail: string | null; by: string | null }[];
}

/** Words that mean somebody else is in the conversation. */
const COMPETITION_WORDS = [
  'incumbent',
  'competitor',
  'another provider',
  'another supplier',
  'alternative',
  'also looking at',
  'also talking to',
  'other quotes',
  'another quote',
  'went to',
  'rival',
];

function mentionsCompetition(text: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return COMPETITION_WORDS.some((word) => lower.includes(word));
}

export function buildWorkItemWorkspace(
  data: CrmWorkspaceData,
  workItemId: string,
  now: string
): WorkItemWorkspace | null {
  const item = data.workItems.find((w) => w.id === workItemId);
  if (!item) return null;

  const card = buildCard(data, item, now);
  if (!card) return null;

  const organisation =
    data.organisations.find((o) => o.id === item.organisationId) ?? null;

  const lastContact = (personId: string): string | null => {
    const activityIds = data.activityParticipants
      .filter((p) => p.personId === personId)
      .map((p) => p.activityId);
    return (
      data.activities
        .filter((a) => a.deletedAt === null && a.isMeaningfulContact && activityIds.includes(a.id))
        .map((a) => a.occurredAt)
        .sort()
        .at(-1) ?? null
    );
  };

  const people = data.people.filter(
    (p) =>
      p.deletedAt === null &&
      p.mergedIntoPersonId === null &&
      organisation !== null &&
      p.organisationId === organisation.id
  );

  const contacts: StakeholderOnWork[] = people.map((person) => {
    const role = data.personOrganisationRoles.find(
      (r) =>
        r.personId === person.id &&
        r.organisationId === organisation?.id &&
        r.endedOn === null
    );
    return {
      person,
      role: role ? ROLE_WORDS[role.stakeholderRole] : ROLE_WORDS.unknown,
      isPrimary: role?.isPrimary ?? person.id === item.primaryPersonId,
      lastContactAt: lastContact(person.id),
      isOnlyContact: people.length === 1,
    };
  });

  const heldRoles = new Set(
    data.personOrganisationRoles
      .filter((r) => r.organisationId === organisation?.id && r.endedOn === null)
      .map((r) => r.stakeholderRole)
  );
  const missingRoles = (['decision_maker', 'influencer', 'user'] as const)
    .filter((role) => !heldRoles.has(role))
    .map((role) => ROLE_WORDS[role]);

  /* ------------------------------------------------------------ the need */

  // Drawn from what was recorded rather than from a field somebody has to
  // remember to fill in. The summary of the meeting this work came out of is
  // usually the best statement of what they want that exists anywhere.
  const originMeeting = data.activities
    .filter((a) => a.deletedAt === null && a.workItemId === item.id && a.summary !== null)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];

  /* ------------------------------------------------------- stage history */

  const stageHistory = data.stageMoves
    .filter((m) => m.workItemId === item.id)
    .sort((a, b) => b.movedAt.localeCompare(a.movedAt))
    .map((move) => ({
      move,
      fromName: data.stages.find((s) => s.id === move.fromStageId)?.name ?? null,
      toName: data.stages.find((s) => s.id === move.toStageId)?.name ?? 'a stage that is gone',
    }));

  /* ------------------------------------------------------------ timeline */

  const timeline = filterTimeline(buildTimeline(data), { workItemId: item.id });

  /* -------------------------------------------------------- competition */

  const competition: CompetitionMention[] = [];

  for (const decision of data.decisions.filter(
    (d) => d.deletedAt === null && d.workItemId === item.id
  )) {
    const text = decision.reasoning ?? decision.summary;
    if (mentionsCompetition(text)) {
      competition.push({
        quote: text!,
        when: decision.decidedOn ?? decision.createdAt,
        from: `Decision: ${decision.title}`,
        subjectTable: 'crm_decisions',
        subjectId: decision.id,
      });
    }
  }

  for (const note of data.notes.filter(
    (n) => n.deletedAt === null && n.workItemId === item.id
  )) {
    if (mentionsCompetition(note.body)) {
      competition.push({
        quote: note.body,
        when: note.createdAt,
        from: 'Note',
        subjectTable: 'crm_notes',
        subjectId: note.id,
      });
    }
  }

  for (const activity of data.activities.filter(
    (a) => a.deletedAt === null && a.workItemId === item.id
  )) {
    if (mentionsCompetition(activity.summary)) {
      competition.push({
        quote: activity.summary!,
        when: activity.occurredAt,
        from: activity.title,
        subjectTable: 'crm_activities',
        subjectId: activity.id,
      });
    }
  }

  competition.sort((a, b) => b.when.localeCompare(a.when));

  /* ------------------------------------------------- required approvals */

  const requiredApprovals: RequiredApproval[] = card.criteria
    .filter((c) => c.criterion.isRequired)
    .map((c) => ({
      what: c.criterion.description,
      state: c.met ? ('met' as const) : ('outstanding' as const),
      detail: c.met
        ? 'Recorded as met when this moved to this stage.'
        : 'Not recorded as met. An authorised person can still move this, with a reason.',
      origin: 'stage criterion' as const,
    }));

  const proposals = data.proposals.filter(
    (p) =>
      p.deletedAt === null &&
      p.state === 'awaiting_confirmation' &&
      ((p.subjectTable === 'crm_work_items' && p.subjectId === item.id) ||
        (organisation !== null &&
          p.subjectTable === 'crm_organisations' &&
          p.subjectId === organisation.id))
  );

  for (const proposal of proposals) {
    requiredApprovals.push({
      what: proposal.headline,
      state: 'awaiting_a_person',
      detail: `${proposal.changes.length} ${proposal.changes.length === 1 ? 'field' : 'fields'} would change. Nothing is applied until somebody confirms it.`,
      origin: 'proposed update',
    });
  }

  /* ------------------------------------------------------------- risks */

  const serviceCases = data.serviceCases.filter(
    (c) => c.deletedAt === null && organisation !== null && c.organisationId === organisation.id
  );
  const unresolved = serviceCases.filter(
    (c) => c.state !== 'resolved' && c.state !== 'closed'
  );

  const risks: { what: string; because: string }[] = [];
  if (contacts.length === 1) {
    risks.push({
      what: 'Everything here rests on one recorded contact.',
      because: `${contacts[0].person.fullName} is the only person recorded at ${organisation?.name ?? 'this organisation'}.`,
    });
  }
  if (missingRoles.length > 0) {
    risks.push({
      what: `No ${missingRoles.map((r) => r.toLowerCase()).join(' and no ')} is recorded.`,
      because: 'A decision usually needs somebody in each of those roles, and none is written down.',
    });
  }
  if (unresolved.length > 0) {
    risks.push({
      what: `${unresolved.length} unresolved service ${unresolved.length === 1 ? 'matter' : 'matters'}.`,
      because:
        unresolved.map((c) => c.relationshipEffect).filter(Boolean)[0] ??
        'An open service matter sits between the customer and anything else being agreed.',
    });
  }
  if (card.closeDateChanges.filter((c) => (c.movedDays ?? 0) > 0).length >= 2) {
    risks.push({
      what: 'The expected date has moved later more than once.',
      because: card.closeDateChanges
        .filter((c) => (c.movedDays ?? 0) > 0)
        .map((c) => c.reason ?? 'no reason recorded')
        .join('; '),
    });
  }
  if (item.nextStep === null && item.status === 'open') {
    risks.push({
      what: 'No next step is recorded.',
      because: 'Nothing is scheduled to happen, so nothing is scheduled to happen.',
    });
  }
  if (competition.length > 0) {
    risks.push({
      what: 'Somebody else is in the conversation.',
      because: `${competition[0].quote} (${competition[0].from}, ${competition[0].when.slice(0, 10)})`,
    });
  }

  /* -------------------------------------------------------------- audit */

  const audit = auditFor(data, 'crm_work_items', item.id).map((event) => ({
    at: event.createdAt,
    what: event.eventType.replace(/_/g, ' '),
    detail: event.detail,
    by: event.actorId,
  }));

  const quotes = data.quotes
    .filter((q) => q.deletedAt === null && q.workItemId === item.id)
    .map((quote) => ({
      quote,
      lines: data.quoteLines.filter((l) => l.quoteId === quote.id),
    }));

  return {
    item,
    card,
    recordWord: data.workspace.recordTerminology,

    organisation,
    contacts,
    missingRoles,

    need: originMeeting?.summary ?? null,
    needSource: originMeeting
      ? `${originMeeting.title}, ${originMeeting.occurredAt.slice(0, 10)}`
      : null,

    products: data.products.filter((p) => p.deletedAt === null && p.isActive),
    quotes,

    stageHistory,
    closeDateChanges: card.closeDateChanges,

    timeline,
    meetings: data.activities.filter(
      (a) => a.deletedAt === null && a.workItemId === item.id && a.activityType === 'meeting'
    ),
    communications: timeline.filter(
      (e) => e.kind === 'email' || e.kind === 'call' || e.kind === 'ai_update'
    ),
    decisions: data.decisions.filter((d) => d.deletedAt === null && d.workItemId === item.id),
    commitments: {
      ours: data.commitments.filter(
        (c) => c.deletedAt === null && c.workItemId === item.id && c.ownedByUs
      ),
      theirs: data.commitments.filter(
        (c) => c.deletedAt === null && c.workItemId === item.id && !c.ownedByUs
      ),
    },
    notes: data.notes.filter((n) => n.deletedAt === null && n.workItemId === item.id),
    serviceCases,
    accountPlan:
      data.accountPlans.find(
        (p) => p.deletedAt === null && organisation !== null && p.organisationId === organisation.id
      ) ?? null,

    requiredApprovals,
    competition,
    risks,

    proposals,
    evidence: trailsFor(data, 'crm_work_items', item.id),
    estimate: estimateFor(data, card, now),
    audit,
  };
}

/** Days since the record was last touched at all, for the header. */
export function daysSinceTouched(workspace: WorkItemWorkspace, now: string): number {
  return daysBetween(workspace.item.updatedAt, now);
}
