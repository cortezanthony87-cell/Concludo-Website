/**
 * The person record, the organisation record, and Account 360.
 *
 * WHY ACCOUNT 360 IS THE ORGANISATION RECORD RATHER THAN A SEPARATE PAGE.
 *
 * The brief asks for both an organisation record and an Account 360 that
 * "combines the relevant customer history without forcing the user to open
 * multiple modules". Read as two pages, those are the same page twice: a
 * organisation record that does not combine the history is the thing Account
 * 360 exists to fix, and an Account 360 that is not the organisation record is
 * a second place to look for the same account.
 *
 * So there is one page. Its first screen is the 360, the answer to "what is
 * going on with this account", and everything below it is the record that
 * answer is drawn from. `account360()` composes the first; `organisationRecord()`
 * composes the whole thing and carries the 360 inside it.
 *
 * WHAT NEITHER OF THEM DOES.
 *
 * Neither infers anything about a person. The person record shows what was
 * recorded: a role somebody wrote down, a preference somebody stated, a consent
 * somebody captured with a basis and a date. There is no engagement level, no
 * responsiveness, no propensity and no sentiment, because every one of those is
 * a number about a human being derived from how often a salesperson wrote
 * something down.
 */
import {
  AccountPlan,
  AccountPlanOutcome,
  Activity,
  Commitment,
  CommunicationPreference,
  ConsentRecord,
  CrmWorkspaceData,
  Decision,
  InvoiceReference,
  Meeting,
  Note,
  Organisation,
  Person,
  Product,
  Proposal,
  Quote,
  ServiceCase,
  Tag,
  WorkItem,
} from '../domain';
import { QualityFlag, organisationFlags, personFlags, reviewRecommended } from './quality';
import { SourceTrail, trailsFor } from './sources';
import { TimelineEntry, buildTimeline, filterTimeline } from './timeline';
import { Coverage, ancestryOf, childrenOf, coverageFor } from './hierarchy';
import { ROLE_WORDS } from './relationships';
import { lastContactWith, lastMeaningfulContactWith } from './relationships';
import { personName } from './workspace';

const DAY = 86_400_000;
const daysBetween = (iso: string, now: string): number =>
  Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / DAY);

/* ================================================= the person record */

export interface ConsentView {
  type: string;
  basis: string;
  capturedAt: string;
  capturedFrom: string | null;
  expiresAt: string | null;
  withdrawnAt: string | null;
  withdrawalNote: string | null;
  /** The whole thing in one sentence, for a reader who will not parse a table. */
  sentence: string;
}

export interface PersonRecord {
  person: Person;
  organisation: Organisation | null;
  /** The role as recorded against the organisation, where there is one. */
  stakeholderRole: string | null;
  roleLabel: string | null;
  relationshipOwner: string | null;

  preferences: CommunicationPreference[];
  consents: ConsentView[];
  /** True where any preference says do not contact. Shown before anything else. */
  doNotContact: CommunicationPreference | null;

  lastMeaningfulAt: string | null;
  lastMeaningfulDays: number | null;
  lastAnythingAt: string | null;

  upcomingCommitments: Commitment[];
  openWork: WorkItem[];
  openServiceCases: ServiceCase[];
  recentMeetings: { meeting: Meeting | null; activity: Activity }[];
  /** Approved, recorded communications. Never the message itself. */
  recentCommunications: TimelineEntry[];
  notes: Note[];
  tags: Tag[];

  flags: QualityFlag[];
  reviewFlag: QualityFlag | null;
  trails: SourceTrail[];
  proposals: Proposal[];
  timeline: TimelineEntry[];
}

const CONSENT_WORDS: Record<string, string> = {
  contact: 'Contact',
  marketing: 'Marketing',
  recording: 'Recording',
  data_retention: 'Data retention',
  third_party_sharing: 'Sharing with third parties',
};

const BASIS_WORDS: Record<string, string> = {
  express: 'expressly given',
  implied: 'implied',
  legitimate_interest: 'relied on as legitimate interest',
  not_obtained: 'not obtained',
  withdrawn: 'withdrawn',
};

function consentView(record: ConsentRecord): ConsentView {
  const type = CONSENT_WORDS[record.consentType] ?? record.consentType;
  const basis = BASIS_WORDS[record.basis] ?? record.basis;

  let sentence = `${type} consent was ${basis}`;
  sentence += record.capturedFrom
    ? `, recorded from ${record.capturedFrom} on ${record.capturedAt.slice(0, 10)}.`
    : ` on ${record.capturedAt.slice(0, 10)}.`;
  if (record.withdrawnAt) {
    sentence += ` Withdrawn on ${record.withdrawnAt.slice(0, 10)}.`;
    if (record.withdrawalNote) sentence += ` ${record.withdrawalNote}`;
  } else if (record.expiresAt) {
    sentence += ` Expires ${record.expiresAt.slice(0, 10)}.`;
  }

  return {
    type,
    basis,
    capturedAt: record.capturedAt,
    capturedFrom: record.capturedFrom,
    expiresAt: record.expiresAt,
    withdrawnAt: record.withdrawnAt,
    withdrawalNote: record.withdrawalNote,
    sentence,
  };
}

export function personRecord(
  data: CrmWorkspaceData,
  personId: string,
  now: string,
  timeline?: TimelineEntry[]
): PersonRecord | null {
  const person = data.people.find((p) => p.id === personId);
  if (!person) return null;

  const organisation = data.organisations.find((o) => o.id === person.organisationId) ?? null;
  const role = data.personOrganisationRoles.find(
    (r) => r.personId === person.id && r.endedOn === null
  );

  const built = timeline ?? buildTimeline(data);
  const personTimeline = filterTimeline(built, { personId: person.id });

  const lastMeaningfulAt = lastMeaningfulContactWith(data, person.id);
  const preferences = data.communicationPreferences.filter((p) => p.personId === person.id);

  const activityIds = data.activityParticipants
    .filter((p) => p.personId === person.id)
    .map((p) => p.activityId);

  const recentMeetings = data.activities
    .filter(
      (a) => a.deletedAt === null && a.activityType === 'meeting' && activityIds.includes(a.id)
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5)
    .map((activity) => ({
      activity,
      meeting: data.meetings.find((m) => m.activityId === activity.id) ?? null,
    }));

  const tagIds = data.recordTags
    .filter((t) => t.subjectTable === 'crm_people' && t.subjectId === person.id)
    .map((t) => t.tagId);

  const flags = personFlags(data, person, now);

  return {
    person,
    organisation,
    stakeholderRole: role ? ROLE_WORDS[role.stakeholderRole] : null,
    roleLabel: person.roleLabel ?? role?.roleLabel ?? null,
    relationshipOwner: personName(data, person.relationshipOwnerUserId),

    preferences,
    consents: data.consentRecords
      .filter((c) => c.personId === person.id)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .map(consentView),
    doNotContact: preferences.find((p) => p.preference === 'do_not_contact') ?? null,

    lastMeaningfulAt,
    lastMeaningfulDays: lastMeaningfulAt === null ? null : daysBetween(lastMeaningfulAt, now),
    lastAnythingAt: lastContactWith(data, person.id),

    upcomingCommitments: data.commitments.filter(
      (c) => c.deletedAt === null && c.state === 'open' && c.ownerPersonId === person.id
    ),
    openWork: data.workItems.filter(
      (w) => w.deletedAt === null && w.status === 'open' && w.primaryPersonId === person.id
    ),
    openServiceCases: data.serviceCases.filter(
      (c) =>
        c.deletedAt === null &&
        c.personId === person.id &&
        c.state !== 'resolved' &&
        c.state !== 'closed'
    ),
    recentMeetings,
    recentCommunications: personTimeline.filter(
      (e) => e.kind === 'email' || e.kind === 'call' || e.kind === 'ai_update'
    ),
    notes: data.notes.filter((n) => n.deletedAt === null && n.personId === person.id),
    tags: data.tags.filter((t) => tagIds.includes(t.id)),

    flags,
    reviewFlag: reviewRecommended(flags),
    trails: trailsFor(data, 'crm_people', person.id),
    proposals: data.proposals.filter(
      (p) =>
        p.deletedAt === null &&
        p.state === 'awaiting_confirmation' &&
        p.subjectTable === 'crm_people' &&
        p.subjectId === person.id
    ),
    timeline: personTimeline,
  };
}

/* ============================================== the organisation record */

export interface Account360 {
  /** Where the relationship stands, in facts. */
  relationship: {
    contactCount: number;
    lastMeaningfulAt: string | null;
    lastMeaningfulDays: number | null;
    singleContact: boolean;
    coverage: Coverage;
  };
  commercial: {
    openWork: WorkItem[];
    openValue: number | null;
    /** True where any open figure is inferred rather than stated. */
    anyValueInferred: boolean;
    activeQuotes: Quote[];
    invoices: InvoiceReference[];
    renewalDate: string | null;
    renewalInDays: number | null;
  };
  service: {
    open: ServiceCase[];
    resolvedRecently: ServiceCase[];
  };
  recentDecisions: Decision[];
  outstandingCommitments: { ours: Commitment[]; theirs: Commitment[] };
  keyContacts: { person: Person; role: string; lastContactAt: string | null }[];
  missingRoles: string[];
  nextActions: { what: string; why: string; workItemId: string | null }[];
  /** Named conditions, each with the fact behind it. Never a risk score. */
  risks: { what: string; because: string }[];
  evidence: SourceTrail[];
  proposals: Proposal[];
}

export interface OrganisationRecord {
  organisation: Organisation;
  summary: string;
  parent: Organisation | null;
  ancestry: Organisation[];
  children: Organisation[];

  people: { person: Person; role: string; isPrimary: boolean; lastContactAt: string | null }[];
  workItems: WorkItem[];
  products: Product[];
  quotes: Quote[];
  accountPlan: { plan: AccountPlan; outcomes: AccountPlanOutcome[] } | null;
  commitments: Commitment[];
  decisions: Decision[];
  serviceCases: ServiceCase[];
  invoices: InvoiceReference[];
  meetings: { meeting: Meeting | null; activity: Activity }[];
  timeline: TimelineEntry[];
  coverage: Coverage;
  renewalDate: string | null;
  renewalInDays: number | null;

  flags: QualityFlag[];
  reviewFlag: QualityFlag | null;
  trails: SourceTrail[];
  /** What was done to this account's records, and by whom. */
  audit: { at: string; what: string; by: string | null }[];

  account360: Account360;
}

export function organisationRecord(
  data: CrmWorkspaceData,
  organisationId: string,
  now: string,
  timeline?: TimelineEntry[]
): OrganisationRecord | null {
  const organisation = data.organisations.find((o) => o.id === organisationId);
  if (!organisation) return null;

  const built = timeline ?? buildTimeline(data);
  const orgTimeline = filterTimeline(built, { organisationId: organisation.id });

  const lastContact = (personId: string) => lastMeaningfulContactWith(data, personId);
  const coverage = coverageFor(data, organisation, lastContact);

  const people = data.people
    .filter(
      (p) =>
        p.deletedAt === null &&
        p.mergedIntoPersonId === null &&
        p.organisationId === organisation.id
    )
    .map((person) => {
      const role = data.personOrganisationRoles.find(
        (r) => r.personId === person.id && r.organisationId === organisation.id && r.endedOn === null
      );
      return {
        person,
        role: role ? ROLE_WORDS[role.stakeholderRole] : ROLE_WORDS.unknown,
        isPrimary: role?.isPrimary ?? false,
        lastContactAt: lastContact(person.id),
      };
    });

  const workItems = data.workItems.filter(
    (w) => w.deletedAt === null && w.organisationId === organisation.id
  );
  const openWork = workItems.filter((w) => w.status === 'open');

  const quotes = data.quotes.filter(
    (q) => q.deletedAt === null && q.organisationId === organisation.id
  );
  const activeQuotes = quotes.filter(
    (q) => q.state === 'sent' || q.state === 'awaiting_response' || q.state === 'draft'
  );

  const serviceCases = data.serviceCases.filter(
    (c) => c.deletedAt === null && c.organisationId === organisation.id
  );

  const commitments = data.commitments.filter(
    (c) => c.deletedAt === null && c.organisationId === organisation.id
  );

  const decisions = data.decisions.filter(
    (d) => d.deletedAt === null && d.organisationId === organisation.id
  );

  const plan = data.accountPlans.find(
    (p) => p.deletedAt === null && p.organisationId === organisation.id
  );

  const meetings = data.activities
    .filter(
      (a) =>
        a.deletedAt === null &&
        a.organisationId === organisation.id &&
        a.activityType === 'meeting'
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((activity) => ({
      activity,
      meeting: data.meetings.find((m) => m.activityId === activity.id) ?? null,
    }));

  const flags = organisationFlags(data, organisation, now);

  const lastMeaningfulAt =
    people
      .map((p) => p.lastContactAt)
      .filter((a): a is string => a !== null)
      .sort()
      .at(-1) ?? null;

  const renewalInDays =
    organisation.renewalDate === null ? null : -daysBetween(organisation.renewalDate, now);

  const openValues = openWork.map((w) => w.valueAmount).filter((v): v is number => v !== null);

  /* ------------------------------------------------- the risks, as facts */

  const risks: { what: string; because: string }[] = [];
  if (coverage.singleContact) {
    risks.push({
      what: 'The relationship rests on one recorded contact.',
      because: 'Only one person is recorded here. If they move on there is nobody else recorded.',
    });
  }
  if (coverage.absent.length > 0) {
    risks.push({
      what: `No ${coverage.absent.map((r) => ROLE_WORDS[r].toLowerCase()).join(' and no ')} is recorded.`,
      because: 'A decision usually needs somebody in each of those roles, and none is written down.',
    });
  }
  const unresolved = serviceCases.filter((c) => c.state !== 'resolved' && c.state !== 'closed');
  if (unresolved.length > 0) {
    risks.push({
      what: `${unresolved.length} service ${unresolved.length === 1 ? 'matter is' : 'matters are'} unresolved.`,
      because:
        unresolved
          .map((c) => c.relationshipEffect)
          .filter((e): e is string => e !== null)[0] ??
        'An open service matter sits between the customer and anything else being agreed.',
    });
  }
  const noNextStep = openWork.filter((w) => w.nextStep === null);
  if (noNextStep.length > 0) {
    risks.push({
      what: `${noNextStep.length} open ${noNextStep.length === 1 ? 'item has' : 'items have'} no next step recorded.`,
      because: 'Nothing is written down as the next thing to do, so nothing is scheduled to happen.',
    });
  }
  if (lastMeaningfulAt !== null && daysBetween(lastMeaningfulAt, now) > 60) {
    risks.push({
      what: `No conversation recorded for ${daysBetween(lastMeaningfulAt, now)} days.`,
      because: 'The gap may be in the record rather than the relationship, and either is worth knowing.',
    });
  }

  /* --------------------------------------------- the next actions, as facts */

  const nextActions: { what: string; why: string; workItemId: string | null }[] = [];
  for (const item of openWork) {
    if (item.nextStep === null) continue;
    nextActions.push({
      what: item.nextStep,
      why:
        item.nextStepDue === null
          ? `Recorded against ${item.title}, with no date agreed.`
          : `Recorded against ${item.title}, due ${item.nextStepDue}.`,
      workItemId: item.id,
    });
  }
  for (const commitment of commitments.filter((c) => c.state === 'open' && c.ownedByUs)) {
    nextActions.push({
      what: commitment.description,
      why:
        commitment.dueDate === null
          ? 'We promised this and no date was agreed.'
          : `We promised this by ${commitment.dueDate}.`,
      workItemId: commitment.workItemId,
    });
  }
  if (renewalInDays !== null && renewalInDays >= 0 && renewalInDays <= 60) {
    nextActions.push({
      what: 'Open the renewal conversation.',
      why: `The recorded renewal or review date is ${renewalInDays} days away.`,
      workItemId: null,
    });
  }

  const account360: Account360 = {
    relationship: {
      contactCount: people.length,
      lastMeaningfulAt,
      lastMeaningfulDays: lastMeaningfulAt === null ? null : daysBetween(lastMeaningfulAt, now),
      singleContact: coverage.singleContact,
      coverage,
    },
    commercial: {
      openWork,
      openValue: openValues.length > 0 ? openValues.reduce((a, b) => a + b, 0) : null,
      anyValueInferred: openWork.some((w) => w.valueAmount !== null && w.valueBasis === 'inferred'),
      activeQuotes,
      invoices: data.invoiceReferences.filter(
        (i) => i.deletedAt === null && i.organisationId === organisation.id
      ),
      renewalDate: organisation.renewalDate,
      renewalInDays,
    },
    service: {
      open: unresolved,
      resolvedRecently: serviceCases.filter(
        (c) => c.resolvedAt !== null && daysBetween(c.resolvedAt, now) <= 90
      ),
    },
    recentDecisions: decisions
      .sort((a, b) => (b.decidedOn ?? '').localeCompare(a.decidedOn ?? ''))
      .slice(0, 5),
    outstandingCommitments: {
      ours: commitments.filter((c) => c.state === 'open' && c.ownedByUs),
      theirs: commitments.filter((c) => c.state === 'open' && !c.ownedByUs),
    },
    keyContacts: people
      .filter((p) => p.isPrimary || p.role !== ROLE_WORDS.unknown)
      .map((p) => ({ person: p.person, role: p.role, lastContactAt: p.lastContactAt })),
    missingRoles: coverage.absent.map((r) => ROLE_WORDS[r]),
    nextActions,
    risks,
    evidence: trailsFor(data, 'crm_organisations', organisation.id),
    proposals: data.proposals.filter(
      (p) =>
        p.deletedAt === null &&
        p.state === 'awaiting_confirmation' &&
        ((p.subjectTable === 'crm_organisations' && p.subjectId === organisation.id) ||
          (p.subjectTable === 'crm_work_items' &&
            workItems.some((w) => w.id === p.subjectId)))
    ),
  };

  /* -------------------------------------------------------- audit history */

  const audit = data.auditEvents
    .filter((e) => e.subjectId === organisation.id || workItems.some((w) => w.id === e.subjectId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({
      at: e.createdAt,
      what: `${e.eventType.replace(/_/g, ' ')} on ${e.subjectTable.replace('crm_', '').replace(/_/g, ' ')}`,
      by: personName(data, e.actorId),
    }));

  const summaryParts: string[] = [];
  summaryParts.push(organisation.industry ?? 'Industry not recorded');
  summaryParts.push(
    `${people.length} ${people.length === 1 ? 'contact' : 'contacts'} recorded`
  );
  summaryParts.push(
    openWork.length === 0
      ? 'no open work'
      : `${openWork.length} open ${openWork.length === 1 ? 'item' : 'items'}`
  );
  summaryParts.push(`lifecycle ${organisation.lifecycleState}`);

  return {
    organisation,
    summary: summaryParts.join('. ') + '.',
    parent: data.organisations.find((o) => o.id === organisation.parentOrganisationId) ?? null,
    ancestry: ancestryOf(data, organisation.id),
    children: childrenOf(data, organisation.id),

    people,
    workItems,
    products: data.products.filter((p) => p.deletedAt === null && p.isActive),
    quotes,
    accountPlan: plan
      ? {
          plan,
          outcomes: data.accountPlanOutcomes
            .filter((o) => o.accountPlanId === plan.id)
            .sort((a, b) => a.outcomeOrder - b.outcomeOrder),
        }
      : null,
    commitments,
    decisions,
    serviceCases,
    invoices: account360.commercial.invoices,
    meetings,
    timeline: orgTimeline,
    coverage,
    renewalDate: organisation.renewalDate,
    renewalInDays,

    flags,
    reviewFlag: reviewRecommended(flags),
    trails: trailsFor(data, 'crm_organisations', organisation.id),
    audit,

    account360,
  };
}

/** Every person in the workspace, for the People list. */
export interface PersonSummary {
  person: Person;
  organisationName: string | null;
  role: string;
  relationshipOwner: string | null;
  lastMeaningfulAt: string | null;
  lastMeaningfulDays: number | null;
  doNotContact: boolean;
  openWorkCount: number;
  flagCount: number;
  /** Why this person would be worth opening, where there is a reason. */
  note: string | null;
}

export function peopleSummaries(data: CrmWorkspaceData, now: string): PersonSummary[] {
  return data.people
    .filter((p) => p.deletedAt === null && p.mergedIntoPersonId === null)
    .map((person) => {
      const last = lastMeaningfulContactWith(data, person.id);
      const flags = personFlags(data, person, now);
      const preferences = data.communicationPreferences.filter((p) => p.personId === person.id);
      const role = data.personOrganisationRoles.find(
        (r) => r.personId === person.id && r.endedOn === null
      );

      const openWorkCount = data.workItems.filter(
        (w) => w.deletedAt === null && w.status === 'open' && w.primaryPersonId === person.id
      ).length;

      const doNotContact = preferences.some((p) => p.preference === 'do_not_contact');

      let note: string | null = null;
      if (doNotContact) {
        note = preferences.find((p) => p.preference === 'do_not_contact')?.note ?? null;
      } else if (last === null) {
        note = 'No conversation has ever been recorded with this person.';
      } else if (daysBetween(last, now) > 60) {
        note = `The last recorded conversation was ${daysBetween(last, now)} days ago.`;
      }

      return {
        person,
        organisationName:
          data.organisations.find((o) => o.id === person.organisationId)?.name ?? null,
        role: role ? ROLE_WORDS[role.stakeholderRole] : ROLE_WORDS.unknown,
        relationshipOwner: personName(data, person.relationshipOwnerUserId),
        lastMeaningfulAt: last,
        lastMeaningfulDays: last === null ? null : daysBetween(last, now),
        doNotContact,
        openWorkCount,
        flagCount: flags.length,
        note,
      };
    });
}
