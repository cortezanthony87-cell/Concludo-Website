/**
 * Record quality: nine measures about a record, and never a score.
 *
 * THE LINE THIS FILE HOLDS.
 *
 * Concludo measures work, records and relationships, never employee
 * performance. A record-quality feature is where that line is crossed, because
 * the step from "this opportunity is missing a next step" to "this person's
 * records are 62% complete" is one `group by owner` away, and nobody writing
 * that query would feel they were building a surveillance tool.
 *
 * So three things are structural rather than conventional:
 *
 * 1. `RecordQuality` has no overall score, grade, rating or percentage, and
 *    the database verification fails if such a column appears.
 * 2. `summariseQuality` returns the nine measures and refuses to produce a
 *    single number from them. There is no `overallScore()` in this file and
 *    adding one is the change to argue about.
 * 3. `aggregateByOwner` does not exist. The reporting view in SQL carries no
 *    owner column for the same reason. Counting open work per owner is a
 *    workload question and is fine; counting record quality per owner is a
 *    performance question and is not.
 *
 * WHAT COMPLETENESS MEANS, AND WHAT IT DOES NOT.
 *
 * Completeness is "how much of what this kind of record needs is present",
 * with the gaps named. It is not a judgement about whether the record is good.
 * A new lead with three fields filled is not a bad record; it is a new record.
 * That is why the measure is present-over-expected plus a list, rather than a
 * fraction a reader will round into an opinion.
 */
import {
  Activity,
  DuplicateCandidate,
  Evidence,
  Organisation,
  Person,
  RecordQuality,
  ReviewStatus,
  WorkItem,
} from './domain';

/** The measures, as the interface shows them. */
export interface QualityView {
  subjectTable: string;
  subjectId: string;

  completeness: {
    present: number;
    expected: number;
    /** The names of the gaps. This is what a person acts on. */
    missing: string[];
  };
  /** Days since anything at all happened, or null where nothing ever has. */
  freshnessDays: number | null;
  /** Days since contact with the customer, which is a different question. */
  daysSinceMeaningfulContact: number | null;
  lastMeaningfulActivityAt: string | null;
  sourceCoverage: {
    traced: number;
    total: number;
    /** True when nothing on the record can be traced to a source at all. */
    untraced: boolean;
  };
  openConflicts: number;
  openDuplicates: number;
  nextStep: string | null;
  nextStepDue: string | null;
  missingNextStep: boolean;
  reviewStatus: ReviewStatus;
  /**
   * Why this record would appear on a review list. Empty when it would not.
   * A list of reasons, never a ranking.
   */
  reviewReasons: string[];
}

function daysBetween(fromIso: string, nowIso: string): number {
  return Math.floor((new Date(nowIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

/* ------------------------------------------- the expected field sets */

/**
 * What each kind of record needs to be actionable.
 *
 * Deliberately short. A long list makes every record look incomplete, which
 * makes the measure noise, which makes people ignore it. Six fields for a work
 * item, five for a person, four for an organisation: the ones whose absence
 * actually stops somebody doing something.
 */
export const EXPECTED_FIELDS = {
  crm_work_items: [
    { key: 'organisationId', label: 'organisation' },
    { key: 'primaryPersonId', label: 'primary contact' },
    { key: 'valueAmount', label: 'value' },
    { key: 'expectedCloseDate', label: 'expected close date' },
    { key: 'nextStep', label: 'next step' },
    { key: 'nextStepDue', label: 'next step date' },
  ],
  crm_people: [
    { key: 'fullName', label: 'name' },
    { key: 'organisationId', label: 'organisation' },
    { key: 'roleLabel', label: 'role' },
    { key: 'primaryEmail', label: 'a contact method' },
    { key: 'relationshipOwnerUserId', label: 'relationship owner' },
  ],
  crm_organisations: [
    { key: 'industry', label: 'industry' },
    { key: 'ownerUserId', label: 'owner' },
    { key: 'relationshipOwnerUserId', label: 'relationship owner' },
    { key: 'lifecycleState', label: 'lifecycle state' },
  ],
} as const;

/* --------------------------------------------------------- computation */

export interface QualityInputs {
  activities: Activity[];
  evidence: Evidence[];
  duplicates: DuplicateCandidate[];
  now: string;
}

export function computeWorkItemQuality(item: WorkItem, inputs: QualityInputs): QualityView {
  const fields = EXPECTED_FIELDS.crm_work_items;
  const missing: string[] = [];
  let present = 0;

  for (const field of fields) {
    const value = (item as unknown as Record<string, unknown>)[field.key];
    if (value === null || value === undefined || value === '') {
      missing.push(field.label);
    } else {
      present += 1;
    }
  }

  const own = inputs.activities.filter((a) => a.workItemId === item.id && a.deletedAt === null);
  const latest = own.map((a) => a.occurredAt).sort().at(-1) ?? null;

  const meaningful = own.filter((a) => a.isMeaningfulContact);
  const latestContact = meaningful.map((a) => a.occurredAt).sort().at(-1) ?? null;

  const about = inputs.evidence.filter(
    (e) =>
      e.subjectTable === 'crm_work_items' &&
      e.subjectId === item.id &&
      e.deletedAt === null &&
      e.supersededAt === null
  );
  const traced = about.filter(
    (e) => e.basis === 'stated' || e.basis === 'calculated' || e.sourceText !== null
  ).length;

  const conflicts = about.filter((e) => e.conflictState === 'open').length;
  const duplicates = inputs.duplicates.filter(
    (d) => d.state === 'open' && (d.leftId === item.id || d.rightId === item.id)
  ).length;

  return assemble({
    subjectTable: 'crm_work_items',
    subjectId: item.id,
    present,
    expected: fields.length,
    missing,
    latest,
    latestContact,
    traced,
    total: about.length,
    conflicts,
    duplicates,
    nextStep: item.nextStep,
    nextStepDue: item.nextStepDue,
    now: inputs.now,
  });
}

export function computePersonQuality(person: Person, inputs: QualityInputs): QualityView {
  const fields = EXPECTED_FIELDS.crm_people;
  const missing: string[] = [];
  let present = 0;

  for (const field of fields) {
    const value = (person as unknown as Record<string, unknown>)[field.key];
    if (value === null || value === undefined || value === '') {
      missing.push(field.label);
    } else {
      present += 1;
    }
  }

  const about = inputs.evidence.filter(
    (e) =>
      e.subjectTable === 'crm_people' &&
      e.subjectId === person.id &&
      e.deletedAt === null &&
      e.supersededAt === null
  );
  const traced = about.filter(
    (e) => e.basis === 'stated' || e.basis === 'calculated' || e.sourceText !== null
  ).length;

  const duplicates = inputs.duplicates.filter(
    (d) =>
      d.state === 'open' &&
      d.subjectTable === 'crm_people' &&
      (d.leftId === person.id || d.rightId === person.id)
  ).length;

  return assemble({
    subjectTable: 'crm_people',
    subjectId: person.id,
    present,
    expected: fields.length,
    missing,
    latest: null,
    latestContact: null,
    traced,
    total: about.length,
    conflicts: about.filter((e) => e.conflictState === 'open').length,
    duplicates,
    nextStep: null,
    nextStepDue: null,
    now: inputs.now,
    // A person record has no next step of its own, so its absence is not a
    // gap. Reporting one would put every contact on a review list forever.
    nextStepApplies: false,
  });
}

export function computeOrganisationQuality(
  organisation: Organisation,
  inputs: QualityInputs
): QualityView {
  const fields = EXPECTED_FIELDS.crm_organisations;
  const missing: string[] = [];
  let present = 0;

  for (const field of fields) {
    const value = (organisation as unknown as Record<string, unknown>)[field.key];
    if (value === null || value === undefined || value === '') {
      missing.push(field.label);
    } else {
      present += 1;
    }
  }

  const own = inputs.activities.filter(
    (a) => a.organisationId === organisation.id && a.deletedAt === null
  );
  const latest = own.map((a) => a.occurredAt).sort().at(-1) ?? null;
  const latestContact =
    own.filter((a) => a.isMeaningfulContact).map((a) => a.occurredAt).sort().at(-1) ?? null;

  const about = inputs.evidence.filter(
    (e) =>
      e.subjectTable === 'crm_organisations' &&
      e.subjectId === organisation.id &&
      e.deletedAt === null &&
      e.supersededAt === null
  );

  return assemble({
    subjectTable: 'crm_organisations',
    subjectId: organisation.id,
    present,
    expected: fields.length,
    missing,
    latest,
    latestContact,
    traced: about.filter((e) => e.basis === 'stated' || e.sourceText !== null).length,
    total: about.length,
    conflicts: about.filter((e) => e.conflictState === 'open').length,
    duplicates: inputs.duplicates.filter(
      (d) =>
        d.state === 'open' &&
        d.subjectTable === 'crm_organisations' &&
        (d.leftId === organisation.id || d.rightId === organisation.id)
    ).length,
    nextStep: null,
    nextStepDue: null,
    now: inputs.now,
    nextStepApplies: false,
  });
}

function assemble(args: {
  subjectTable: string;
  subjectId: string;
  present: number;
  expected: number;
  missing: string[];
  latest: string | null;
  latestContact: string | null;
  traced: number;
  total: number;
  conflicts: number;
  duplicates: number;
  nextStep: string | null;
  nextStepDue: string | null;
  now: string;
  nextStepApplies?: boolean;
}): QualityView {
  const nextStepApplies = args.nextStepApplies ?? true;
  const missingNextStep = nextStepApplies && args.nextStep === null;

  const reasons: string[] = [];
  if (args.conflicts > 0) {
    reasons.push(
      args.conflicts === 1
        ? 'One fact on this record is in conflict with another.'
        : `${args.conflicts} facts on this record are in conflict with others.`
    );
  }
  if (args.duplicates > 0) {
    reasons.push('This record may be a duplicate of another.');
  }
  if (missingNextStep) {
    reasons.push('No next step is recorded.');
  }
  if (args.total > 0 && args.traced === 0) {
    reasons.push('Nothing on this record can be traced to a source.');
  }
  if (args.missing.length > 0 && args.present === 0) {
    reasons.push('Nothing expected of this kind of record is filled in.');
  }

  return {
    subjectTable: args.subjectTable,
    subjectId: args.subjectId,
    completeness: { present: args.present, expected: args.expected, missing: args.missing },
    freshnessDays: args.latest ? daysBetween(args.latest, args.now) : null,
    daysSinceMeaningfulContact: args.latestContact
      ? daysBetween(args.latestContact, args.now)
      : null,
    lastMeaningfulActivityAt: args.latestContact,
    sourceCoverage: {
      traced: args.traced,
      total: args.total,
      untraced: args.total > 0 && args.traced === 0,
    },
    openConflicts: args.conflicts,
    openDuplicates: args.duplicates,
    nextStep: args.nextStep,
    nextStepDue: args.nextStepDue,
    missingNextStep,
    reviewStatus: reasons.length > 0 ? 'needs_review' : 'not_reviewed',
    reviewReasons: reasons,
  };
}

/** Projects a computed view into the stored row shape. */
export function toRecordQualityRow(
  view: QualityView,
  crmWorkspaceId: string,
  id: string,
  now: string
): RecordQuality {
  return {
    id,
    crmWorkspaceId,
    subjectTable: view.subjectTable,
    subjectId: view.subjectId,
    completenessPresent: view.completeness.present,
    completenessExpected: view.completeness.expected,
    completenessMissingFields: view.completeness.missing,
    freshnessDays: view.freshnessDays,
    lastMeaningfulActivityAt: view.lastMeaningfulActivityAt,
    sourceCoverageTraced: view.sourceCoverage.traced,
    sourceCoverageTotal: view.sourceCoverage.total,
    openConflicts: view.openConflicts,
    openDuplicates: view.openDuplicates,
    nextStep: view.nextStep,
    nextStepDue: view.nextStepDue,
    reviewStatus: view.reviewStatus,
    reviewedBy: null,
    reviewedAt: null,
    dataQualityOwnerUserId: null,
    computedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * What a data-quality view should show.
 *
 * Note what it returns: counts of RECORDS in each condition. There is no
 * breakdown by owner, and the function deliberately takes no owner parameter,
 * because the shape of the output is what decides whether a feature becomes a
 * performance tool, and the time to decide that is when the function is
 * written rather than when somebody asks for a chart.
 */
export function summariseQuality(views: QualityView[]): {
  total: number;
  missingNextStep: number;
  withOpenConflicts: number;
  withPossibleDuplicates: number;
  untraced: number;
  needingReview: number;
  /** Records with nothing at all recorded against them beyond their name. */
  barelyStarted: number;
} {
  return {
    total: views.length,
    missingNextStep: views.filter((v) => v.missingNextStep).length,
    withOpenConflicts: views.filter((v) => v.openConflicts > 0).length,
    withPossibleDuplicates: views.filter((v) => v.openDuplicates > 0).length,
    untraced: views.filter((v) => v.sourceCoverage.untraced).length,
    needingReview: views.filter((v) => v.reviewStatus === 'needs_review').length,
    barelyStarted: views.filter((v) => v.completeness.present <= 1).length,
  };
}
