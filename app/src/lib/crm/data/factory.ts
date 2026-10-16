/**
 * Builders for the synthetic workspaces.
 *
 * Every record in the demonstration data has forty-odd fields and most of them
 * are the same in every row. Writing them out longhand five times would bury
 * the handful of fields that are the point of each record, which is exactly
 * what makes hand-written fixtures unreadable and generated ones useless.
 *
 * So each builder fills the boilerplate and leaves the meaningful fields to the
 * caller. A record in `workspaces.ts` then reads as the two or three facts it
 * exists to demonstrate.
 *
 * NOTHING HERE COULD REACH A REAL PERSON. Every address uses `.example`, which
 * RFC 2606 reserves and nobody can ever register, and every phone number is in
 * a reserved fictional range. A test asserts both.
 */
import {
  AccountPlan,
  AccountPlanAction,
  AccountPlanEntry,
  AttentionCondition,
  ImportKind,
  ImportRow,
  ImportRun,
  IntegrationConnection,
  RelationshipSignalState,
  MemoryRead,
  AccountPlanOutcome,
  AccountReview,
  JointPlan,
  JointPlanAction,
  PlanSection,
  WhitespaceAxis,
  WhitespaceCell,
  WhitespaceState,
  Activity,
  ActivityParticipant,
  Approval,
  AttachmentReference,
  Commitment,
  CommunicationPreference,
  ConsentRecord,
  CrmWorkspace,
  CrmWorkspaceData,
  CrmWorkspaceMember,
  CustomFieldDefinition,
  CustomFieldValue,
  CustomObjectDefinition,
  CustomObjectRecord,
  Decision,
  DuplicateCandidate,
  EmailReference,
  Evidence,
  InvoiceReference,
  Lead,
  Meeting,
  Note,
  OrderReference,
  Organisation,
  Person,
  PersonOrganisationRole,
  Pipeline,
  PipelineStage,
  Product,
  Proposal,
  Quote,
  QuoteLine,
  RecordTag,
  Relationship,
  RetentionPolicy,
  ServiceCase,
  StageCriterion,
  StageMove,
  Tag,
  Task,
  WorkItem,
} from '../domain';

/** The fixed moment the whole demonstration is dated against. */
export const CRM_DEMO_NOW = '2026-10-13T09:00:00+11:00';

const MS_PER_DAY = 86_400_000;

/** A timestamp N days before the fixed moment. */
export function daysAgo(days: number): string {
  return new Date(new Date(CRM_DEMO_NOW).getTime() - days * MS_PER_DAY).toISOString();
}

/** A date N days after the fixed moment, as a plain date. */
export function daysAhead(days: number): string {
  return new Date(new Date(CRM_DEMO_NOW).getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

const base = (createdAt = daysAgo(120)) => ({
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
  deletedBy: null,
  purgeAfter: null,
});

const timestamps = (createdAt = daysAgo(120)) => ({ createdAt, updatedAt: createdAt });

/* ------------------------------------------------------------ builders */

export function workspace(
  id: string,
  name: string,
  overrides: Partial<CrmWorkspace> = {}
): CrmWorkspace {
  return {
    id,
    name,
    depth: 'sole_trader',
    recordTerminology: 'opportunity',
    recordTerminologyPlural: 'Opportunities',
    terminology: {},
    linkedTeamId: null,
    linkedOrganizationId: null,
    workspaceScope: 'work',
    // Off until somebody turns it on. See the field's own note in domain.ts.
    accountPlanningEnabled: false,
    createdBy: null,
    ...base(daysAgo(400)),
    ...overrides,
  };
}

export function member(
  id: string,
  workspaceId: string,
  userId: string,
  role: CrmWorkspaceMember['crmRole']
): CrmWorkspaceMember {
  return { id, crmWorkspaceId: workspaceId, userId, crmRole: role, ...timestamps(daysAgo(400)) };
}

export function organisation(
  id: string,
  workspaceId: string,
  name: string,
  overrides: Partial<Organisation> = {}
): Organisation {
  return {
    id,
    crmWorkspaceId: workspaceId,
    name,
    legalName: null,
    tradingName: null,
    abn: null,
    industry: null,
    website: null,
    parentOrganisationId: null,
    hierarchyDepth: 0,
    ownerUserId: null,
    relationshipOwnerUserId: null,
    dataQualityOwnerUserId: null,
    lifecycleState: 'active',
    renewalDate: null,
    ...base(),
    ...overrides,
  };
}

export function person(
  id: string,
  workspaceId: string,
  fullName: string,
  overrides: Partial<Person> = {}
): Person {
  return {
    id,
    crmWorkspaceId: workspaceId,
    fullName,
    givenName: null,
    familyName: null,
    primaryEmail: null,
    secondaryEmail: null,
    phone: null,
    primaryEmailScope: 'work',
    organisationId: null,
    roleLabel: null,
    ownerUserId: null,
    relationshipOwnerUserId: null,
    mergedIntoPersonId: null,
    ...base(),
    ...overrides,
  };
}

export function personRole(
  id: string,
  workspaceId: string,
  personId: string,
  organisationId: string,
  overrides: Partial<PersonOrganisationRole> = {}
): PersonOrganisationRole {
  return {
    id,
    crmWorkspaceId: workspaceId,
    personId,
    organisationId,
    roleLabel: null,
    stakeholderRole: 'unknown',
    isPrimary: false,
    startedOn: null,
    endedOn: null,
    roleConfirmedBy: null,
    roleConfirmedAt: null,
    roleEvidence: null,
    preferredContactMethod: null,
    currentObjective: null,
    relationshipState: 'not_recorded',
    relationshipStateBy: null,
    relationshipStateAt: null,
    ...timestamps(),
    ...overrides,
  };
}

export function relationship(
  id: string,
  workspaceId: string,
  overrides: Partial<Relationship> & Pick<Relationship, 'fromKind' | 'fromId' | 'toKind' | 'toId' | 'relationshipType'>
): Relationship {
  return {
    id,
    crmWorkspaceId: workspaceId,
    strength: 'unknown',
    notes: null,
    ...base(),
    ...overrides,
  };
}

export function lead(
  id: string,
  workspaceId: string,
  overrides: Partial<Lead> = {}
): Lead {
  return {
    id,
    crmWorkspaceId: workspaceId,
    personName: null,
    organisationName: null,
    email: null,
    phone: null,
    source: null,
    summary: null,
    missingInformation: [],
    state: 'awaiting_review',
    notProceedingReason: null,
    convertedPersonId: null,
    convertedOrganisationId: null,
    convertedWorkItemId: null,
    convertedAt: null,
    convertedBy: null,
    ownerUserId: null,
    receivedAt: daysAgo(2),
    ...base(daysAgo(2)),
    ...overrides,
  };
}

export function pipeline(
  id: string,
  workspaceId: string,
  name: string,
  overrides: Partial<Pipeline> = {}
): Pipeline {
  return {
    id,
    crmWorkspaceId: workspaceId,
    name,
    workItemType: 'opportunity',
    isDefault: true,
    ...base(daysAgo(380)),
    ...overrides,
  };
}

export function stage(
  id: string,
  workspaceId: string,
  pipelineId: string,
  name: string,
  order: number,
  typicalDays: number,
  overrides: Partial<PipelineStage> = {}
): PipelineStage {
  return {
    id,
    crmWorkspaceId: workspaceId,
    pipelineId,
    name,
    stageOrder: order,
    typicalDays,
    isClosed: false,
    closedDisposition: null,
    ...timestamps(daysAgo(380)),
    ...overrides,
  };
}

export function criterion(
  id: string,
  workspaceId: string,
  stageId: string,
  description: string,
  order = 0,
  isRequired = true
): StageCriterion {
  return {
    id,
    crmWorkspaceId: workspaceId,
    stageId,
    description,
    criterionOrder: order,
    isRequired,
    ...timestamps(daysAgo(380)),
  };
}

export function workItem(
  id: string,
  workspaceId: string,
  title: string,
  pipelineId: string,
  stageId: string,
  overrides: Partial<WorkItem> = {}
): WorkItem {
  return {
    id,
    crmWorkspaceId: workspaceId,
    title,
    workItemType: 'opportunity',
    organisationId: null,
    primaryPersonId: null,
    pipelineId,
    stageId,
    enteredStageAt: daysAgo(14),
    valueAmount: null,
    valueCurrency: 'AUD',
    valueBasis: 'unknown',
    expectedCloseDate: null,
    status: 'open',
    resolvedAt: null,
    resolutionReason: null,
    nextStep: null,
    nextStepDue: null,
    ownerUserId: null,
    actionOwnerUserId: null,
    ...base(daysAgo(60)),
    ...overrides,
  };
}

export function stageMove(
  id: string,
  workspaceId: string,
  workItemId: string,
  toStageId: string,
  overrides: Partial<StageMove> = {}
): StageMove {
  return {
    id,
    crmWorkspaceId: workspaceId,
    workItemId,
    fromStageId: null,
    toStageId,
    movedBy: null,
    movedAt: daysAgo(14),
    criteriaMet: [],
    criteriaUnmet: [],
    overrideReason: null,
    ...overrides,
  };
}

export function activity(
  id: string,
  workspaceId: string,
  activityType: Activity['activityType'],
  title: string,
  occurredAt: string,
  overrides: Partial<Activity> = {}
): Activity {
  return {
    id,
    crmWorkspaceId: workspaceId,
    activityType,
    title,
    summary: null,
    occurredAt,
    organisationId: null,
    workItemId: null,
    isMeaningfulContact: true,
    followThroughOutstanding: false,
    followThroughReason: null,
    createdBy: null,
    ...base(occurredAt),
    ...overrides,
  };
}

export function participant(
  id: string,
  workspaceId: string,
  activityId: string,
  overrides: Partial<ActivityParticipant> = {}
): ActivityParticipant {
  return {
    id,
    crmWorkspaceId: workspaceId,
    activityId,
    personId: null,
    unresolvedName: null,
    participantRole: 'attendee',
    ...overrides,
  };
}

export function emailReference(
  id: string,
  workspaceId: string,
  overrides: Partial<EmailReference> & Pick<EmailReference, 'accountScope'>
): EmailReference {
  return {
    id,
    crmWorkspaceId: workspaceId,
    activityId: null,
    provider: 'microsoft',
    accountReference: 'acct-work-01',
    threadReference: `thread-${id}`,
    messageReference: null,
    subject: null,
    occurredAt: daysAgo(5),
    organisationId: null,
    workItemId: null,
    personId: null,
    ...base(daysAgo(5)),
    ...overrides,
  };
}

export function commitment(
  id: string,
  workspaceId: string,
  description: string,
  ownerName: string,
  overrides: Partial<Commitment> = {}
): Commitment {
  return {
    id,
    crmWorkspaceId: workspaceId,
    description,
    ownerName,
    ownerPersonId: null,
    ownerUserId: null,
    ownedByUs: false,
    dueDate: null,
    state: 'open',
    completedAt: null,
    organisationId: null,
    workItemId: null,
    activityId: null,
    ...base(daysAgo(10)),
    ...overrides,
  };
}

export function decision(
  id: string,
  workspaceId: string,
  title: string,
  overrides: Partial<Decision> = {}
): Decision {
  return {
    id,
    crmWorkspaceId: workspaceId,
    title,
    summary: null,
    reasoning: null,
    decidedOn: null,
    decidedByName: null,
    decidedByPersonId: null,
    organisationId: null,
    workItemId: null,
    activityId: null,
    ...base(daysAgo(20)),
    ...overrides,
  };
}

export function task(
  id: string,
  workspaceId: string,
  title: string,
  overrides: Partial<Task> = {}
): Task {
  return {
    id,
    crmWorkspaceId: workspaceId,
    title,
    detail: null,
    dueDate: null,
    state: 'open',
    completedAt: null,
    actionOwnerUserId: null,
    organisationId: null,
    personId: null,
    workItemId: null,
    ...base(daysAgo(8)),
    ...overrides,
  };
}

export function serviceCase(
  id: string,
  workspaceId: string,
  title: string,
  organisationId: string,
  overrides: Partial<ServiceCase> = {}
): ServiceCase {
  return {
    id,
    crmWorkspaceId: workspaceId,
    title,
    detail: null,
    organisationId,
    personId: null,
    workItemId: null,
    severity: 'low',
    state: 'open',
    raisedAt: daysAgo(15),
    resolvedAt: null,
    relationshipEffect: null,
    ownerUserId: null,
    ...base(daysAgo(15)),
    ...overrides,
  };
}

export function product(
  id: string,
  workspaceId: string,
  name: string,
  overrides: Partial<Product> = {}
): Product {
  return {
    id,
    crmWorkspaceId: workspaceId,
    name,
    description: null,
    kind: 'service',
    unitPrice: null,
    currency: 'AUD',
    isActive: true,
    ...base(daysAgo(300)),
    ...overrides,
  };
}

export function quote(
  id: string,
  workspaceId: string,
  reference: string,
  overrides: Partial<Quote> = {}
): Quote {
  return {
    id,
    crmWorkspaceId: workspaceId,
    reference,
    workItemId: null,
    organisationId: null,
    personId: null,
    state: 'draft',
    sentOn: null,
    validUntil: null,
    respondedOn: null,
    declineReason: null,
    subtotal: null,
    total: null,
    currency: 'AUD',
    ownerUserId: null,
    ...base(daysAgo(20)),
    ...overrides,
  };
}

export function accountPlan(
  id: string,
  workspaceId: string,
  organisationId: string,
  objective: string,
  overrides: Partial<AccountPlan> = {}
): AccountPlan {
  return {
    id,
    crmWorkspaceId: workspaceId,
    organisationId,
    objective,
    reviewDate: null,
    lastReviewedAt: null,
    planOwnerUserId: null,
    reviewCadence: 'not_set',
    summary: null,
    ...base(daysAgo(90)),
    ...overrides,
  };
}

export function planEntry(
  id: string,
  workspaceId: string,
  accountPlanId: string,
  section: PlanSection,
  body: string,
  order = 0,
  overrides: Partial<AccountPlanEntry> = {}
): AccountPlanEntry {
  return {
    id,
    crmWorkspaceId: workspaceId,
    accountPlanId,
    section,
    body,
    evidenceId: null,
    recordedBy: null,
    entryOrder: order,
    ...base(daysAgo(60)),
    ...overrides,
  };
}

export function planAction(
  id: string,
  workspaceId: string,
  accountPlanId: string,
  description: string,
  order = 0,
  overrides: Partial<AccountPlanAction> = {}
): AccountPlanAction {
  return {
    id,
    crmWorkspaceId: workspaceId,
    accountPlanId,
    description,
    actionOwnerUserId: null,
    dueDate: null,
    state: 'open',
    completedAt: null,
    actionOrder: order,
    ...base(daysAgo(60)),
    ...overrides,
  };
}

export function whitespaceCell(
  id: string,
  workspaceId: string,
  organisationId: string,
  productId: string,
  axis: WhitespaceAxis,
  axisValue: string,
  state: WhitespaceState = 'unknown',
  overrides: Partial<WhitespaceCell> = {}
): WhitespaceCell {
  return {
    id,
    crmWorkspaceId: workspaceId,
    organisationId,
    productId,
    axis,
    axisValue,
    state,
    evidenceId: null,
    note: null,
    workItemId: null,
    statedBy: null,
    statedAt: null,
    ...base(daysAgo(45)),
    ...overrides,
  };
}

export function jointPlan(
  id: string,
  workspaceId: string,
  organisationId: string,
  sharedObjective: string,
  overrides: Partial<JointPlan> = {}
): JointPlan {
  return {
    id,
    crmWorkspaceId: workspaceId,
    organisationId,
    accountPlanId: null,
    sharedObjective,
    approvalState: 'draft',
    approvedBy: null,
    approvedAt: null,
    reviewNote: null,
    planOwnerUserId: null,
    ...base(daysAgo(30)),
    ...overrides,
  };
}

export function jointAction(
  id: string,
  workspaceId: string,
  jointPlanId: string,
  description: string,
  ownedByUs: boolean,
  order = 0,
  overrides: Partial<JointPlanAction> = {}
): JointPlanAction {
  return {
    id,
    crmWorkspaceId: workspaceId,
    jointPlanId,
    description,
    ownedByUs,
    ownerUserId: null,
    ownerName: null,
    dueDate: null,
    dependsOnActionIds: [],
    state: 'not_started',
    evidenceId: null,
    actionOrder: order,
    ...base(daysAgo(30)),
    ...overrides,
  };
}

export function accountReview(
  id: string,
  workspaceId: string,
  accountPlanId: string,
  reviewedAt: string,
  overrides: Partial<AccountReview> = {}
): AccountReview {
  return {
    id,
    crmWorkspaceId: workspaceId,
    accountPlanId,
    reviewedAt,
    reviewedBy: null,
    summary: null,
    nextReviewDate: null,
    ...base(reviewedAt),
    ...overrides,
  };
}

export function planOutcome(
  id: string,
  workspaceId: string,
  accountPlanId: string,
  label: string,
  measure: string,
  state: AccountPlanOutcome['state'],
  order = 0
): AccountPlanOutcome {
  return {
    id,
    crmWorkspaceId: workspaceId,
    accountPlanId,
    label,
    measure,
    state,
    outcomeOrder: order,
    ...timestamps(daysAgo(90)),
  };
}

export function consent(
  id: string,
  workspaceId: string,
  personId: string,
  consentType: ConsentRecord['consentType'],
  basis: ConsentRecord['basis'],
  overrides: Partial<ConsentRecord> = {}
): ConsentRecord {
  return {
    id,
    crmWorkspaceId: workspaceId,
    personId,
    consentType,
    basis,
    capturedAt: daysAgo(100),
    capturedFrom: null,
    capturedBy: null,
    expiresAt: null,
    withdrawnAt: basis === 'withdrawn' ? daysAgo(30) : null,
    withdrawalNote: null,
    ...timestamps(daysAgo(100)),
    ...overrides,
  };
}

export function preference(
  id: string,
  workspaceId: string,
  personId: string,
  channel: CommunicationPreference['channel'],
  pref: CommunicationPreference['preference'],
  note: string
): CommunicationPreference {
  return {
    id,
    crmWorkspaceId: workspaceId,
    personId,
    channel,
    preference: pref,
    note,
    effectiveFrom: null,
    effectiveUntil: null,
    ...timestamps(daysAgo(100)),
  };
}

export function evidence(
  id: string,
  workspaceId: string,
  subjectTable: string,
  subjectId: string,
  fieldName: string,
  overrides: Partial<Evidence> = {}
): Evidence {
  return {
    id,
    crmWorkspaceId: workspaceId,
    subjectTable,
    subjectId,
    fieldName,
    assertedValue: null,
    sourceType: 'manual_entry',
    sourceRecordTable: null,
    sourceRecordId: null,
    sourceText: null,
    sourceLocation: null,
    capturedAt: daysAgo(10),
    basis: 'stated',
    confidence: 'high',
    modelVersion: null,
    promptVersion: null,
    confirmedBy: null,
    confirmedAt: null,
    supersededById: null,
    supersededAt: null,
    conflictsWithId: null,
    conflictState: 'none',
    conflictNote: null,
    ...base(daysAgo(10)),
    ...overrides,
  };
}

export function proposal(
  id: string,
  workspaceId: string,
  kind: Proposal['proposalKind'],
  headline: string,
  rationale: string,
  changes: Proposal['changes'],
  overrides: Partial<Proposal> = {}
): Proposal {
  return {
    id,
    crmWorkspaceId: workspaceId,
    proposalKind: kind,
    headline,
    rationale,
    subjectTable: 'crm_people',
    subjectId: null,
    changes,
    confidence: 'moderate',
    evidenceId: null,
    modelVersion: null,
    promptVersion: null,
    state: 'awaiting_confirmation',
    isDestructive: kind === 'merge_duplicate',
    proposedAt: daysAgo(1),
    appliedAt: null,
    applicationResult: null,
    ...base(daysAgo(1)),
    ...overrides,
  };
}

export function duplicate(
  id: string,
  workspaceId: string,
  subjectTable: DuplicateCandidate['subjectTable'],
  leftId: string,
  rightId: string,
  overrides: Partial<DuplicateCandidate> = {}
): DuplicateCandidate {
  return {
    id,
    crmWorkspaceId: workspaceId,
    subjectTable,
    leftId,
    rightId,
    matchingFields: [],
    differingFields: [],
    recommendation: 'review_together',
    reason: '',
    state: 'open',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    ...timestamps(daysAgo(3)),
    ...overrides,
  };
}

export function retention(
  id: string,
  workspaceId: string,
  subjectTable: string,
  overrides: Partial<RetentionPolicy> = {}
): RetentionPolicy {
  return {
    id,
    crmWorkspaceId: workspaceId,
    subjectTable,
    retainDeletedDays: 30,
    reviewAfterInactiveDays: null,
    legalHold: false,
    legalHoldReason: null,
    ...timestamps(daysAgo(300)),
    ...overrides,
  };
}

export function customField(
  id: string,
  workspaceId: string,
  subjectTable: string,
  fieldKey: string,
  label: string,
  fieldType: CustomFieldDefinition['fieldType'],
  overrides: Partial<CustomFieldDefinition> = {}
): CustomFieldDefinition {
  return {
    id,
    crmWorkspaceId: workspaceId,
    subjectTable,
    fieldKey,
    label,
    fieldType,
    options: [],
    isRequired: false,
    helpText: null,
    fieldOrder: 0,
    ...base(daysAgo(200)),
    ...overrides,
  };
}

export function customValue(
  id: string,
  workspaceId: string,
  definitionId: string,
  subjectId: string,
  overrides: Partial<CustomFieldValue> = {}
): CustomFieldValue {
  return {
    id,
    crmWorkspaceId: workspaceId,
    definitionId,
    subjectId,
    valueText: null,
    valueNumber: null,
    valueDate: null,
    valueBoolean: null,
    valueOptions: null,
    ...timestamps(daysAgo(50)),
    ...overrides,
  };
}

/**
 * A meeting, which is the record Concludo actually exists around.
 *
 * `captureMethod` records what the conversation came from and nothing more.
 * Concludo is independent of every recorder, smart pen and meeting platform:
 * the column is a fact about the input, never an endorsement of a device or a
 * claim of any relationship with its maker.
 */
export function meeting(
  id: string,
  workspaceId: string,
  activityId: string,
  overrides: Partial<Meeting> = {}
): Meeting {
  return {
    id,
    crmWorkspaceId: workspaceId,
    activityId,
    sourceProjectId: null,
    meetingType: null,
    durationMinutes: null,
    location: null,
    captureMethod: 'pasted_text',
    ...timestamps(daysAgo(30)),
    ...overrides,
  };
}

export function note(
  id: string,
  workspaceId: string,
  body: string,
  overrides: Partial<Note> = {}
): Note {
  return {
    id,
    crmWorkspaceId: workspaceId,
    body,
    organisationId: null,
    personId: null,
    workItemId: null,
    activityId: null,
    authorUserId: null,
    isPrivate: false,
    ...base(daysAgo(30)),
    ...overrides,
  };
}

export function quoteLine(
  id: string,
  workspaceId: string,
  quoteId: string,
  description: string,
  quantity: number,
  unitPrice: number,
  overrides: Partial<QuoteLine> = {}
): QuoteLine {
  return {
    id,
    crmWorkspaceId: workspaceId,
    quoteId,
    productId: null,
    description,
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
    lineOrder: 1,
    ...overrides,
  };
}

/**
 * A pointer at an accounting system, never a figure authored here.
 *
 * `cachedAt` is not optional in practice: a cached total with no read time is
 * a number nobody can tell is six months stale, and the interface has to be
 * able to say when it was last true.
 */
export function orderReference(
  id: string,
  workspaceId: string,
  externalSystem: string,
  externalId: string,
  overrides: Partial<OrderReference> = {}
): OrderReference {
  return {
    id,
    crmWorkspaceId: workspaceId,
    externalSystem,
    externalId,
    externalUrl: null,
    workItemId: null,
    organisationId: null,
    cachedStatus: null,
    cachedTotal: null,
    cachedCurrency: 'AUD',
    cachedAt: daysAgo(2),
    ...base(daysAgo(40)),
    ...overrides,
  };
}

export function invoiceReference(
  id: string,
  workspaceId: string,
  externalSystem: string,
  externalId: string,
  overrides: Partial<InvoiceReference> = {}
): InvoiceReference {
  return {
    id,
    crmWorkspaceId: workspaceId,
    externalSystem,
    externalId,
    externalUrl: null,
    organisationId: null,
    workItemId: null,
    orderReferenceId: null,
    cachedStatus: null,
    cachedAmount: null,
    cachedCurrency: 'AUD',
    cachedDueDate: null,
    cachedAt: daysAgo(2),
    ...base(daysAgo(40)),
    ...overrides,
  };
}

/** A pointer at a file in a storage system. The CRM never holds the bytes. */
export function attachmentReference(
  id: string,
  workspaceId: string,
  fileName: string,
  subjectTable: string,
  subjectId: string,
  overrides: Partial<AttachmentReference> = {}
): AttachmentReference {
  return {
    id,
    crmWorkspaceId: workspaceId,
    storageSystem: 'concludo_workspace',
    storagePath: `workspace/${workspaceId}/${fileName}`,
    fileName,
    mediaType: null,
    byteSize: null,
    subjectTable,
    subjectId,
    uploadedBy: null,
    createdAt: daysAgo(20),
    deletedAt: null,
    ...overrides,
  };
}

export function tag(
  id: string,
  workspaceId: string,
  label: string,
  overrides: Partial<Tag> = {}
): Tag {
  return {
    id,
    crmWorkspaceId: workspaceId,
    label,
    colourToken: null,
    createdAt: daysAgo(90),
    ...overrides,
  };
}

export function recordTag(
  id: string,
  workspaceId: string,
  tagId: string,
  subjectTable: string,
  subjectId: string
): RecordTag {
  return { id, crmWorkspaceId: workspaceId, tagId, subjectTable, subjectId };
}

/**
 * A custom object: the escape hatch that stops a vertical needing its own fork.
 *
 * A real estate agency tracks properties, which are not organisations, people
 * or deals. Without this they would be modelled as one of those three, badly.
 */
export function customObject(
  id: string,
  workspaceId: string,
  objectKey: string,
  labelSingular: string,
  labelPlural: string,
  overrides: Partial<CustomObjectDefinition> = {}
): CustomObjectDefinition {
  return {
    id,
    crmWorkspaceId: workspaceId,
    objectKey,
    labelSingular,
    labelPlural,
    attachesTo: 'crm_organisations',
    schemaDefinition: {},
    ...base(daysAgo(90)),
    ...overrides,
  };
}

export function customRecord(
  id: string,
  workspaceId: string,
  definitionId: string,
  payload: Record<string, unknown>,
  overrides: Partial<CustomObjectRecord> = {}
): CustomObjectRecord {
  return {
    id,
    crmWorkspaceId: workspaceId,
    definitionId,
    subjectId: null,
    payload,
    createdBy: null,
    ...base(daysAgo(60)),
    ...overrides,
  };
}

/**
 * The record of a person confirming a proposal.
 *
 * Bound to the payload, not to a permission: `approvedChanges` is what was
 * actually agreed and the digest is over that payload, so a proposal edited
 * after approval cannot be applied on the strength of the old decision.
 * `selfApproved` is recorded rather than forbidden, because a sole trader has
 * nobody else to ask and a team should be able to see whether it is routine.
 */
export function approval(
  id: string,
  workspaceId: string,
  proposalId: string,
  decidedBy: string,
  overrides: Partial<Approval> = {}
): Approval {
  return {
    id,
    crmWorkspaceId: workspaceId,
    proposalId,
    decision: 'confirmed',
    decidedBy,
    decidedAt: daysAgo(3),
    note: null,
    approvedChanges: [],
    approvedChangesDigest: `digest-${proposalId}`,
    selfApproved: false,
    ...overrides,
  };
}

/** An empty workspace, for a builder to fill. */
/* ============================ Stage 8: connections and imports */

/**
 * A connection to an outside system.
 *
 * The default is the honest one: never connected, nothing granted, sending off,
 * never synced. A fixture that wants a connected integration has to say so,
 * which keeps "connected" from being something a record drifts into.
 */
export function integrationConnection(
  id: string,
  workspaceId: string,
  integrationId: string,
  overrides: Partial<IntegrationConnection> = {}
): IntegrationConnection {
  return {
    id,
    crmWorkspaceId: workspaceId,
    integrationId,
    state: 'never_connected',
    grantedScopes: [],
    connectedBy: null,
    connectedAt: null,
    expiresAt: null,
    sendingEnabled: false,
    sendingEnabledBy: null,
    importScope: {},
    lastAttemptAt: null,
    lastOutcome: 'never_run',
    failureDetail: null,
    nextRetryAt: null,
    consecutiveFailures: 0,
    ...base(daysAgo(30)),
    ...overrides,
  };
}

export function importRun(
  id: string,
  workspaceId: string,
  kind: ImportKind,
  fileName: string,
  overrides: Partial<ImportRun> = {}
): ImportRun {
  return {
    id,
    crmWorkspaceId: workspaceId,
    kind,
    fileName,
    mapping: {},
    state: 'mapping',
    rowCount: 0,
    startedBy: null,
    dryRunAt: null,
    committedAt: null,
    committedBy: null,
    rolledBackAt: null,
    rolledBackBy: null,
    rollbackReason: null,
    auditEventId: null,
    ...base(daysAgo(3)),
    ...overrides,
  };
}

export function importRow(
  id: string,
  workspaceId: string,
  runId: string,
  rowNumber: number,
  source: Record<string, string>,
  overrides: Partial<ImportRow> = {}
): ImportRow {
  return {
    id,
    crmWorkspaceId: workspaceId,
    importRunId: runId,
    rowNumber,
    source,
    state: 'ready',
    issues: [],
    warnings: [],
    createdTable: null,
    createdId: null,
    mergedIntoId: null,
    ...overrides,
  };
}

/**
 * A decision somebody made about an attention condition.
 *
 * The default is `dismissed` with an expiry, because an acknowledgement that
 * never expires and a dismissal that never expires are the same bug: a
 * condition that stops being shown and is never reconsidered.
 */
export function relationshipSignalState(
  id: string,
  workspaceId: string,
  organisationId: string,
  condition: AttentionCondition,
  reason: string,
  decidedBy: string,
  overrides: Partial<RelationshipSignalState> = {}
): RelationshipSignalState {
  return {
    id,
    crmWorkspaceId: workspaceId,
    organisationId,
    condition,
    state: 'dismissed',
    reason,
    decidedBy,
    decidedAt: daysAgo(3),
    expiresAt: daysAhead(27),
    detailAtDecision: null,
    computedAt: null,
    ...base(daysAgo(3)),
    ...overrides,
  };
}

export function emptyData(ws: CrmWorkspace, members: CrmWorkspaceMember[]): CrmWorkspaceData {
  return {
    workspace: ws,
    members,
    organisations: [],
    people: [],
    personOrganisationRoles: [],
    relationships: [],
    leads: [],
    pipelines: [],
    stages: [],
    stageCriteria: [],
    workItems: [],
    stageMoves: [],
    activities: [],
    activityParticipants: [],
    meetings: [],
    emailReferences: [],
    notes: [],
    tasks: [],
    commitments: [],
    decisions: [],
    products: [],
    quotes: [],
    quoteLines: [],
    orderReferences: [],
    invoiceReferences: [],
    serviceCases: [],
    accountPlans: [],
    accountPlanOutcomes: [],
    attachmentReferences: [],
    tags: [],
    recordTags: [],
    customFieldDefinitions: [],
    customFieldValues: [],
    customObjectDefinitions: [],
    customObjectRecords: [],
    consentRecords: [],
    communicationPreferences: [],
    evidence: [],
    proposals: [],
    approvals: [],
    auditEvents: [],
    duplicateCandidates: [],
    recordQuality: [],
    retentionPolicies: [],
    integrationConnections: [],
    importRuns: [],
    importRows: [],
    relationshipSignals: [],
    memoryReads: [],
    accountPlanEntries: [],
    accountPlanActions: [],
    whitespaceCells: [],
    jointPlans: [],
    jointPlanActions: [],
    accountReviews: [],
  };
}

/**
 * A recorded memory read, for the fixture.
 *
 * The read log is the one table in this model that is produced by USE rather
 * than authored, so an empty one in the demonstration is honest and useless:
 * the control is invisible until somebody has clicked around for a while, and
 * a buyer being shown the product does not click around. A handful of seeded
 * reads make the control visible on the first screen, and the banner above
 * every CRM view already says the whole dataset is synthetic.
 */
export function memoryRead(
  id: string,
  workspaceId: string,
  organisationId: string | null,
  readBy: string,
  overrides: Partial<MemoryRead> = {}
): MemoryRead {
  const at = overrides.readAt ?? daysAgo(2);
  return {
    id,
    crmWorkspaceId: workspaceId,
    organisationId,
    kind: organisationId === null ? 'search' : 'explorer',
    question: null,
    query: null,
    entriesReturned: 0,
    readAs: 'crm_admin',
    readBy,
    readAt: at,
    createdAt: at,
    ...overrides,
  };
}
