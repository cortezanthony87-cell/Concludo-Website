/**
 * Concludo CRM: the domain model, Stage 3.
 *
 * This is the TypeScript half of the schema in `docs/migrations`. Every type
 * here has a table behind it and every field name matches a column, so a
 * reader can hold one model in their head rather than two.
 *
 * ITS RELATIONSHIP TO STAGE 2.
 *
 * Stage 2's `types.ts` is a view model: the shape the fourteen views render.
 * This is the record model: the shape the database holds. They are
 * deliberately separate, and `projection.ts` maps one to the other. Collapsing
 * them would mean every schema change rippling into a page, and every display
 * convenience creeping into a column.
 *
 * WHAT THE TYPES ENFORCE THAT A COMMENT CANNOT.
 *
 * 1. `Evidence` carries fourteen fields, and `basis: 'unknown'` is a value
 *    rather than an absence. "We do not know the budget" and "nobody has
 *    looked" are different facts and a CRM that renders both as a blank cell
 *    will have somebody act on the wrong one.
 * 2. `RecordQuality` has nine named measures and **no overall score**. There is
 *    no `score`, `grade` or `rating` field, and adding one is the single change
 *    that would turn this product into an employee performance tool.
 * 3. A `Proposal` has `appliedAt` only alongside `state: 'confirmed'`, which is
 *    a database constraint as well as a type.
 */

/* ===================================================== shared vocabulary */

export type Uuid = string;
export type IsoDateTime = string;
export type IsoDate = string;

/** How a value is known. `unknown` is a value, never an absence. */
export type Basis = 'stated' | 'inferred' | 'calculated' | 'unknown';

/** A word, never a percentage. A heuristic that prints "87%" is lying. */
export type Confidence = 'high' | 'moderate' | 'low';

/** Columns every soft-deletable record carries. */
export interface SoftDeletable {
  deletedAt: IsoDateTime | null;
  deletedBy: Uuid | null;
  purgeAfter: IsoDateTime | null;
}

export interface Timestamped {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/* ============================================= 1. workspace configuration */

export type WorkspaceDepth = 'sole_trader' | 'small_team' | 'mid_market' | 'enterprise';
export type WorkItemType =
  | 'opportunity'
  | 'project'
  | 'engagement'
  | 'matter'
  | 'case'
  | 'job'
  | 'mandate'
  | 'deal'
  | 'contract'
  | 'assignment'
  | 'brief'
  | 'service';
export type WorkspaceScope = 'work' | 'personal';

export interface CrmWorkspace extends Timestamped, SoftDeletable {
  id: Uuid;
  name: string;
  depth: WorkspaceDepth;
  /** What this workspace calls a work item. One table, configurable label. */
  recordTerminology: WorkItemType;
  recordTerminologyPlural: string;
  /** Every other noun this workspace renames. */
  terminology: Record<string, string>;
  linkedTeamId: Uuid | null;
  linkedOrganizationId: Uuid | null;
  workspaceScope: WorkspaceScope;
  createdBy: Uuid | null;

  /**
   * Account planning is OFF until somebody turns it on.
   *
   * A sole trader with eleven customers does not need a SWOT, and a product
   * that shows them one has told them they are doing their job wrong. The
   * switch is per workspace, and inside an enabled workspace a plan still only
   * exists for the accounts somebody started one for. Default false, in the
   * fixture, in the factory and in the migration.
   */
  accountPlanningEnabled: boolean;
}

export type CrmRole = 'crm_viewer' | 'crm_contributor' | 'crm_approver' | 'crm_admin';

export interface CrmWorkspaceMember extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  userId: Uuid;
  crmRole: CrmRole;
}

/** Roles are ordered. Admin implies approver implies contributor implies viewer. */
export const ROLE_ORDER: CrmRole[] = ['crm_viewer', 'crm_contributor', 'crm_approver', 'crm_admin'];

export function roleAtLeast(held: CrmRole, required: CrmRole): boolean {
  return ROLE_ORDER.indexOf(held) >= ROLE_ORDER.indexOf(required);
}

/* ============================================ 2, 3, 4. parties and links */

export type OrganisationLifecycle = 'prospect' | 'active' | 'dormant' | 'closed';

export interface Organisation extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  name: string;
  legalName: string | null;
  tradingName: string | null;
  abn: string | null;
  industry: string | null;
  website: string | null;
  /** The hierarchy. Guarded against cycles and cross-workspace parents. */
  parentOrganisationId: Uuid | null;
  hierarchyDepth: number;
  /** Ownership is responsibility for work, never a measure of performance. */
  ownerUserId: Uuid | null;
  relationshipOwnerUserId: Uuid | null;
  dataQualityOwnerUserId: Uuid | null;
  lifecycleState: OrganisationLifecycle;
  renewalDate: IsoDate | null;
}

export type EmailScope = 'work' | 'personal' | 'unknown';

export interface Person extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  fullName: string;
  givenName: string | null;
  familyName: string | null;
  /** Null is normal. Many people arrive from a transcript with no address. */
  primaryEmail: string | null;
  secondaryEmail: string | null;
  phone: string | null;
  primaryEmailScope: EmailScope;
  organisationId: Uuid | null;
  roleLabel: string | null;
  ownerUserId: Uuid | null;
  relationshipOwnerUserId: Uuid | null;
  /** A merge keeps the row, so the merge is reversible and ids still resolve. */
  mergedIntoPersonId: Uuid | null;
}

/**
 * The buying centre, as Stage 6 needs it.
 *
 * Three were added here: economic buyer (the one whose budget it is, who is
 * often not the decision maker), champion (somebody inside who argues for you
 * when you are not in the room) and adviser (consulted, no authority). They are
 * the roles a strategic account plan is actually about, and collapsing them
 * into "influencer" is how a plan ends up with four influencers and no idea who
 * signs.
 *
 * `blocker` is different from all the others and is treated differently
 * everywhere below. Recording a named human being as an obstacle is a judgement
 * about a person, not an observation about a process, so it is never inferred,
 * never derived from silence or a lost deal, and never set without a person
 * confirming it. See `roleConfirmedBy` on PersonOrganisationRole.
 */
export type StakeholderRole =
  | 'decision_maker'
  | 'economic_buyer'
  | 'influencer'
  | 'user'
  | 'champion'
  | 'gatekeeper'
  | 'adviser'
  | 'blocker'
  | 'unknown';

/** The roles a person may hold without anybody confirming them. */
export const UNCONFIRMED_ROLES: StakeholderRole[] = [
  'decision_maker',
  'economic_buyer',
  'influencer',
  'user',
  'champion',
  'gatekeeper',
  'adviser',
  'unknown',
];

/**
 * How the working relationship stands, in the words of the person who said so.
 *
 * Never computed, never ordered, never a number. A relationship that has not
 * been described is `not_recorded`, which is a different fact from a difficult
 * one and is stored as such.
 */
export type RelationshipState =
  | 'not_recorded'
  | 'new'
  | 'working_well'
  | 'needs_attention'
  | 'on_hold';

export interface PersonOrganisationRole extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  personId: Uuid;
  organisationId: Uuid;
  roleLabel: string | null;
  stakeholderRole: StakeholderRole;
  isPrimary: boolean;
  startedOn: IsoDate | null;
  endedOn: IsoDate | null;

  /* ---- Stage 6: what a plan needs to know about a relationship ---- */

  /** Who confirmed the role, where one was confirmed. Required for `blocker`. */
  roleConfirmedBy: Uuid | null;
  roleConfirmedAt: IsoDateTime | null;
  /** The sentence somebody gave for the role. Not a model's reasoning. */
  roleEvidence: string | null;

  /** How they prefer to be contacted, as they said it. */
  preferredContactMethod: string | null;
  /** What this person is trying to achieve, in their words, not ours. */
  currentObjective: string | null;

  /** Descriptive, user-confirmed, never inferred and never ranked. */
  relationshipState: RelationshipState;
  relationshipStateBy: Uuid | null;
  relationshipStateAt: IsoDateTime | null;
}

/* ====================================================== 5. relationships */

export type RelationshipType =
  | 'reports_to'
  | 'works_with'
  | 'introduced_by'
  | 'refers_to'
  | 'subsidiary_of'
  | 'partner_of'
  | 'former_colleague_of'
  | 'advises';

export interface Relationship extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  fromKind: 'person' | 'organisation';
  fromId: Uuid;
  toKind: 'person' | 'organisation';
  toId: Uuid;
  relationshipType: RelationshipType;
  /**
   * How well the two parties work together. About the business relationship,
   * never about the person: describing a working relationship is legitimate,
   * scoring a human being is not, and that line is the difference between a
   * CRM and a surveillance tool.
   */
  strength: 'strong' | 'working' | 'weak' | 'unknown' | null;
  notes: string | null;
}

/* ============================================================== 6. leads */

export type LeadState = 'awaiting_review' | 'in_review' | 'converted' | 'not_proceeding';

export interface Lead extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  personName: string | null;
  organisationName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  summary: string | null;
  /** A list of what is missing, never a quality grade. */
  missingInformation: string[];
  state: LeadState;
  notProceedingReason: string | null;
  convertedPersonId: Uuid | null;
  convertedOrganisationId: Uuid | null;
  convertedWorkItemId: Uuid | null;
  convertedAt: IsoDateTime | null;
  convertedBy: Uuid | null;
  ownerUserId: Uuid | null;
  receivedAt: IsoDateTime;
}

/* ============================= 7 to 11. pipelines, stages, criteria, work */

export interface Pipeline extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  name: string;
  workItemType: WorkItemType;
  isDefault: boolean;
}

export interface PipelineStage extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  pipelineId: Uuid;
  name: string;
  stageOrder: number;
  /** For "34 days, where 21 is usual here" rather than a global target. */
  typicalDays: number;
  isClosed: boolean;
  closedDisposition: 'won' | 'not_proceeding' | 'on_hold' | null;
}

export interface StageCriterion extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  stageId: Uuid;
  /** Plain words. A criterion nobody can read is one nobody meets on purpose. */
  description: string;
  criterionOrder: number;
  isRequired: boolean;
}

export type WorkItemStatus = 'open' | 'won' | 'not_proceeding' | 'on_hold';

export interface WorkItem extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  title: string;
  workItemType: WorkItemType;
  organisationId: Uuid | null;
  primaryPersonId: Uuid | null;
  pipelineId: Uuid;
  stageId: Uuid;
  enteredStageAt: IsoDateTime;
  valueAmount: number | null;
  valueCurrency: string;
  /** A stated figure and an inferred one are different facts. */
  valueBasis: Basis;
  expectedCloseDate: IsoDate | null;
  status: WorkItemStatus;
  /** A resolved item must not appear as active. */
  resolvedAt: IsoDateTime | null;
  resolutionReason: string | null;
  nextStep: string | null;
  nextStepDue: IsoDate | null;
  ownerUserId: Uuid | null;
  actionOwnerUserId: Uuid | null;
}

export interface StageMove {
  id: Uuid;
  crmWorkspaceId: Uuid;
  workItemId: Uuid;
  fromStageId: Uuid | null;
  toStageId: Uuid;
  movedBy: Uuid | null;
  movedAt: IsoDateTime;
  criteriaMet: Uuid[];
  criteriaUnmet: Uuid[];
  /** Required when anything is unmet. The rule is not silent, not blocked. */
  overrideReason: string | null;
}

/* ================================= 12 to 16. activity, meetings, email */

export type ActivityType =
  | 'meeting'
  | 'call'
  | 'note'
  | 'email'
  | 'document'
  | 'task_completed'
  | 'stage_change';

export interface Activity extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  activityType: ActivityType;
  title: string;
  summary: string | null;
  occurredAt: IsoDateTime;
  organisationId: Uuid | null;
  workItemId: Uuid | null;
  /**
   * Whether this counts as contact with the customer. A stage change by
   * somebody in the office is activity; it is not contact, and treating it as
   * contact is how an account looks healthy for six months while nobody
   * speaks to anyone.
   */
  isMeaningfulContact: boolean;
  followThroughOutstanding: boolean;
  followThroughReason: string | null;
  createdBy: Uuid | null;
}

export interface ActivityParticipant {
  id: Uuid;
  crmWorkspaceId: Uuid;
  activityId: Uuid;
  personId: Uuid | null;
  /** Where a name was captured but not yet confirmed as a person. */
  unresolvedName: string | null;
  participantRole: 'organiser' | 'attendee' | 'apology' | 'mentioned' | null;
}

export type CaptureMethod =
  | 'pasted_text'
  | 'uploaded_file'
  | 'recorder'
  | 'smart_pen'
  | 'phone_recording'
  | 'platform_transcript'
  | 'unknown';

export interface Meeting extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  activityId: Uuid;
  /** The Workspace project holding the transcript, where there is one. */
  sourceProjectId: Uuid | null;
  meetingType: string | null;
  durationMinutes: number | null;
  location: string | null;
  /**
   * Capture agnostic. Concludo is independent of every recorder, smart pen and
   * meeting platform, and this column records what was used, not an
   * endorsement of it.
   */
  captureMethod: CaptureMethod | null;
}

/**
 * A pointer, never the mail.
 *
 * No body, no recipient list, no attachments. Storing the message is a
 * different product with a different privacy position, and the CRM does not
 * need it to do its job.
 */
export interface EmailReference extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  activityId: Uuid | null;
  provider: 'microsoft' | 'google' | 'imap' | 'other';
  /** Opaque, never an address. */
  accountReference: string;
  threadReference: string;
  messageReference: string | null;
  subject: string | null;
  occurredAt: IsoDateTime;
  /** The boundary, enforced at write by a database trigger. */
  accountScope: 'work' | 'personal';
  organisationId: Uuid | null;
  workItemId: Uuid | null;
  personId: Uuid | null;
}

export interface Note extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  body: string;
  organisationId: Uuid | null;
  personId: Uuid | null;
  workItemId: Uuid | null;
  activityId: Uuid | null;
  authorUserId: Uuid | null;
  isPrivate: boolean;
}

/* ============================== 16 to 18. tasks, commitments, decisions */

export interface Task extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  title: string;
  detail: string | null;
  dueDate: IsoDate | null;
  state: 'open' | 'done' | 'no_longer_needed';
  completedAt: IsoDateTime | null;
  actionOwnerUserId: Uuid | null;
  organisationId: Uuid | null;
  personId: Uuid | null;
  workItemId: Uuid | null;
}

/**
 * What somebody said they would do.
 *
 * Distinct from a task: a task is something you created, a commitment is
 * something that was promised. The difference matters when you are deciding
 * whether to chase somebody.
 */
export interface Commitment extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  description: string;
  ownerName: string;
  ownerPersonId: Uuid | null;
  ownerUserId: Uuid | null;
  ownedByUs: boolean;
  dueDate: IsoDate | null;
  state: 'open' | 'done' | 'no_longer_needed';
  completedAt: IsoDateTime | null;
  organisationId: Uuid | null;
  workItemId: Uuid | null;
  activityId: Uuid | null;
}

export interface Decision extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  title: string;
  summary: string | null;
  reasoning: string | null;
  decidedOn: IsoDate | null;
  decidedByName: string | null;
  decidedByPersonId: Uuid | null;
  organisationId: Uuid | null;
  workItemId: Uuid | null;
  activityId: Uuid | null;
}

/* ================================ 19 to 23. commerce and service */

export interface Product extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  name: string;
  description: string | null;
  kind: 'product' | 'service' | 'subscription';
  unitPrice: number | null;
  currency: string;
  isActive: boolean;
}

export type QuoteState =
  | 'draft'
  | 'sent'
  | 'awaiting_response'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'withdrawn';

export interface Quote extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  reference: string;
  workItemId: Uuid | null;
  organisationId: Uuid | null;
  personId: Uuid | null;
  state: QuoteState;
  sentOn: IsoDate | null;
  validUntil: IsoDate | null;
  respondedOn: IsoDate | null;
  declineReason: string | null;
  subtotal: number | null;
  total: number | null;
  currency: string;
  ownerUserId: Uuid | null;
}

export interface QuoteLine {
  id: Uuid;
  crmWorkspaceId: Uuid;
  quoteId: Uuid;
  productId: Uuid | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineOrder: number;
}

/**
 * A reference, not a record.
 *
 * Concludo is not an accounting system and must not become the place a figure
 * is authored. These point at a system of record, cache what was last read,
 * and say when it was read, so the CRM can show status without ever being the
 * source of truth for it. A cached figure with no read time is a figure nobody
 * can tell is six months stale.
 */
export interface OrderReference extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  externalSystem: string;
  externalId: string;
  externalUrl: string | null;
  workItemId: Uuid | null;
  organisationId: Uuid | null;
  cachedStatus: string | null;
  cachedTotal: number | null;
  cachedCurrency: string | null;
  cachedAt: IsoDateTime | null;
}

export type InvoiceStatus = 'draft' | 'sent' | 'part_paid' | 'paid' | 'overdue' | 'void';

export interface InvoiceReference extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  externalSystem: string;
  externalId: string;
  externalUrl: string | null;
  organisationId: Uuid | null;
  workItemId: Uuid | null;
  orderReferenceId: Uuid | null;
  cachedStatus: InvoiceStatus | null;
  cachedAmount: number | null;
  cachedCurrency: string | null;
  cachedDueDate: IsoDate | null;
  cachedAt: IsoDateTime | null;
}

export interface ServiceCase extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  title: string;
  detail: string | null;
  organisationId: Uuid;
  personId: Uuid | null;
  workItemId: Uuid | null;
  severity: 'low' | 'moderate' | 'high';
  state: 'open' | 'with_customer' | 'with_us' | 'resolved' | 'closed';
  raisedAt: IsoDateTime;
  resolvedAt: IsoDateTime | null;
  /** Why it belongs in a CRM at all: what it does to the relationship. */
  relationshipEffect: string | null;
  ownerUserId: Uuid | null;
}

/* ========================================= account plans */

export interface AccountPlan extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  organisationId: Uuid;
  objective: string;
  reviewDate: IsoDate | null;
  lastReviewedAt: IsoDateTime | null;
  planOwnerUserId: Uuid | null;
  /** How often this account is meant to be reviewed, in words. */
  reviewCadence: ReviewCadence;
  /** A short summary somebody wrote, not one assembled from fields. */
  summary: string | null;
}

export type ReviewCadence = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'not_set';

export interface AccountPlanOutcome extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  accountPlanId: Uuid;
  label: string;
  /** An outcome with no measure is an aspiration, so this is not nullable. */
  measure: string;
  state: 'not_started' | 'on_track' | 'needs_attention' | 'achieved' | 'abandoned';
  outcomeOrder: number;
}

/* ======================================= 25. Stage 6: account planning */

/**
 * One table for the written parts of a plan, not ten.
 *
 * Risks, constraints, competitive position, the four SWOT quadrants and growth
 * opportunities are all the same shape: a sentence somebody wrote, about this
 * account, that may point at evidence. Giving each its own table would mean six
 * migrations the first time a customer wants a seventh heading, and a join for
 * every section of one screen.
 *
 * Customer objectives and their measures of success are NOT here: they live in
 * `AccountPlanOutcome`, which already requires a measure, because an objective
 * with no measure is an aspiration and the model should keep saying so.
 */
export type PlanSection =
  | 'risk'
  | 'constraint'
  | 'competitive_position'
  | 'swot_strength'
  | 'swot_weakness'
  | 'swot_opportunity'
  | 'swot_threat'
  | 'growth_opportunity'
  | 'current_value';

export interface AccountPlanEntry extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  accountPlanId: Uuid;
  section: PlanSection;
  /** What was written. The whole point of the row. */
  body: string;
  /** Where it came from, where it came from anything. */
  evidenceId: Uuid | null;
  /** Who wrote it. A plan entry with no author is a rumour. */
  recordedBy: Uuid | null;
  entryOrder: number;
}

/** A step in the internal action plan. Owners are responsibility, not merit. */
export interface AccountPlanAction extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  accountPlanId: Uuid;
  description: string;
  actionOwnerUserId: Uuid | null;
  dueDate: IsoDate | null;
  state: 'open' | 'done' | 'no_longer_needed';
  completedAt: IsoDateTime | null;
  actionOrder: number;
}

/**
 * The whitespace grid.
 *
 * A cell is a product against a place: a business unit, a site or a region.
 * `unknown` is the DEFAULT and it is a real answer. A grid that renders absence
 * as "no" is a grid that quietly tells somebody they have asked a question they
 * have never asked, and the first time that is wrong it is wrong in front of a
 * customer. Nothing in this module ever writes `not_relevant` or `in_use` on
 * its own: those come from a person.
 */
export type WhitespaceAxis = 'business_unit' | 'site' | 'region';

export type WhitespaceState =
  | 'unknown'
  | 'in_use'
  | 'potential_need'
  | 'open_opportunity'
  | 'not_relevant';

export interface WhitespaceCell extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  organisationId: Uuid;
  productId: Uuid;
  /** Which kind of place this column is. */
  axis: WhitespaceAxis;
  /** The place itself, named as the customer names it. */
  axisValue: string;
  state: WhitespaceState;
  /** Why the cell says what it says. */
  evidenceId: Uuid | null;
  note: string | null;
  /** The work this cell points at, where somebody has opened one. */
  workItemId: Uuid | null;
  /** Who last said so. Absent on a cell nobody has touched. */
  statedBy: Uuid | null;
  statedAt: IsoDateTime | null;
}

/**
 * A plan written with the customer rather than about them.
 *
 * STAGE 6 DOES NOT SHARE THIS WITH ANYBODY. There is no external link, no
 * token, no export and no recipient field anywhere in this release, because a
 * customer-shareable surface is an authentication and disclosure problem before
 * it is a feature, and shipping the sharing switch before that design exists is
 * how the wrong account's plan reaches the wrong customer. The approval states
 * below stop at "approved internally", which is the furthest this stage goes.
 */
export type JointPlanApprovalState =
  | 'draft'
  | 'internal_review'
  | 'approved_internally'
  | 'withdrawn';

export interface JointPlan extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  organisationId: Uuid;
  accountPlanId: Uuid | null;
  /** What both sides are trying to achieve, in one sentence. */
  sharedObjective: string;
  approvalState: JointPlanApprovalState;
  approvedBy: Uuid | null;
  approvedAt: IsoDateTime | null;
  /** Why it was sent back, where it was. */
  reviewNote: string | null;
  planOwnerUserId: Uuid | null;
}

export interface JointPlanAction extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  jointPlanId: Uuid;
  description: string;
  /** Ours or theirs. A joint plan where every action is ours is a to-do list. */
  ownedByUs: boolean;
  ownerUserId: Uuid | null;
  ownerName: string | null;
  dueDate: IsoDate | null;
  /** Actions this one waits on. Ids within the same plan. */
  dependsOnActionIds: Uuid[];
  state: 'not_started' | 'in_progress' | 'done' | 'blocked' | 'no_longer_needed';
  evidenceId: Uuid | null;
  actionOrder: number;
}

/** An internal review of an account, and what it decided. */
export interface AccountReview extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  accountPlanId: Uuid;
  reviewedAt: IsoDateTime;
  reviewedBy: Uuid | null;
  /** What the review settled. Decisions needed but not taken stay open. */
  summary: string | null;
  nextReviewDate: IsoDate | null;
}

/* ================== 24, 26 to 28. attachments, fields, objects, tags */

export interface AttachmentReference {
  id: Uuid;
  crmWorkspaceId: Uuid;
  storageSystem: string;
  storagePath: string;
  fileName: string;
  mediaType: string | null;
  byteSize: number | null;
  subjectTable: string;
  subjectId: Uuid;
  uploadedBy: Uuid | null;
  createdAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
}

export type CustomFieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'url';

export interface CustomFieldDefinition extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  subjectTable: string;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[];
  isRequired: boolean;
  helpText: string | null;
  fieldOrder: number;
}

export interface CustomFieldValue extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  definitionId: Uuid;
  subjectId: Uuid;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: IsoDate | null;
  valueBoolean: boolean | null;
  valueOptions: string[] | null;
}

export interface CustomObjectDefinition extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  objectKey: string;
  labelSingular: string;
  labelPlural: string;
  attachesTo: 'crm_organisations' | 'crm_people' | 'crm_work_items' | 'none' | null;
  schemaDefinition: Record<string, unknown>;
}

export interface CustomObjectRecord extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  definitionId: Uuid;
  subjectId: Uuid | null;
  payload: Record<string, unknown>;
  createdBy: Uuid | null;
}

export interface Tag {
  id: Uuid;
  crmWorkspaceId: Uuid;
  label: string;
  colourToken: string | null;
  createdAt: IsoDateTime;
}

export interface RecordTag {
  id: Uuid;
  crmWorkspaceId: Uuid;
  tagId: Uuid;
  subjectTable: string;
  subjectId: Uuid;
}

/* ============================= 29, 30. consent and communication */

export type ConsentType =
  | 'contact'
  | 'marketing'
  | 'recording'
  | 'data_retention'
  | 'third_party_sharing';

export type ConsentBasis =
  | 'express'
  | 'implied'
  | 'legitimate_interest'
  | 'not_obtained'
  | 'withdrawn';

/**
 * Consent is a record with a basis, a time and a source, not a checkbox.
 *
 * Under the Australian Privacy Principles, APP 3 governs collection and APP 5
 * requires notification at or near the time of collection. A CRM that holds a
 * boolean cannot answer either question.
 */
export interface ConsentRecord extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  personId: Uuid;
  consentType: ConsentType;
  basis: ConsentBasis;
  capturedAt: IsoDateTime;
  capturedFrom: string | null;
  capturedBy: Uuid | null;
  expiresAt: IsoDateTime | null;
  withdrawnAt: IsoDateTime | null;
  withdrawalNote: string | null;
}

export interface CommunicationPreference extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  personId: Uuid;
  channel: 'email' | 'phone' | 'sms' | 'post' | 'any';
  preference: 'open' | 'limited' | 'do_not_contact';
  /** A do-not-contact with no reason is one somebody overrides by accident. */
  note: string;
  effectiveFrom: IsoDate | null;
  effectiveUntil: IsoDate | null;
}

/* ======================================= 25. source evidence */

export type EvidenceSourceType =
  | 'meeting_transcript'
  | 'email'
  | 'document'
  | 'manual_entry'
  | 'import'
  | 'external_system'
  | 'derived'
  | 'none';

export type ConflictState = 'none' | 'open' | 'resolved_kept' | 'resolved_superseded';

/**
 * One assertion, with everything needed to judge it.
 *
 * Fourteen fields in one row rather than a value table joined to a source
 * table, because a join for every read of every fact is a join nobody will
 * write, and the provenance quietly stops being shown.
 */
export interface Evidence extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;

  subjectTable: string;
  subjectId: Uuid;
  fieldName: string;
  assertedValue: string | null;

  sourceType: EvidenceSourceType;
  sourceRecordTable: string | null;
  sourceRecordId: Uuid | null;
  /** The sentence it came from. */
  sourceText: string | null;
  /** Where in the source to find it, so context can be checked. */
  sourceLocation: string | null;
  capturedAt: IsoDateTime;

  basis: Basis;
  confidence: Confidence;

  /** Null where a person entered it; set where a model produced it. */
  modelVersion: string | null;
  promptVersion: string | null;

  confirmedBy: Uuid | null;
  confirmedAt: IsoDateTime | null;

  supersededById: Uuid | null;
  supersededAt: IsoDateTime | null;
  conflictsWithId: Uuid | null;
  conflictState: ConflictState;
  conflictNote: string | null;
}

/* ============================= 31, 32. proposals and approvals */

export type ProposalKind =
  | 'create_person'
  | 'update_person'
  | 'link_person_to_organisation'
  | 'create_organisation'
  | 'update_organisation'
  | 'create_work_item'
  | 'update_work_item'
  | 'update_stage'
  | 'update_next_step'
  | 'record_commitment'
  | 'record_decision'
  | 'merge_duplicate'
  | 'correct_field';

export interface ProposedChange {
  field: string;
  from: string | null;
  to: string;
}

/**
 * The invariant this type exists to carry.
 *
 * No agent writes to a CRM entity table. An agent's only write target is a
 * proposal. The only code that writes an entity is the applier, and it runs
 * only on a confirmed proposal. `appliedAt` is non-null only alongside
 * `state: 'confirmed'`, which is a database constraint as well as a type.
 */
export interface Proposal extends Timestamped, SoftDeletable {
  id: Uuid;
  crmWorkspaceId: Uuid;
  proposalKind: ProposalKind;
  headline: string;
  rationale: string;
  subjectTable: string;
  subjectId: Uuid | null;
  changes: ProposedChange[];
  confidence: Confidence;
  evidenceId: Uuid | null;
  modelVersion: string | null;
  promptVersion: string | null;
  state: 'awaiting_confirmation' | 'confirmed' | 'declined' | 'superseded' | 'expired';
  /** A merge is the one change that cannot be undone by editing a field. */
  isDestructive: boolean;
  proposedAt: IsoDateTime;
  appliedAt: IsoDateTime | null;
  applicationResult: Record<string, unknown> | null;
}

export interface Approval {
  id: Uuid;
  crmWorkspaceId: Uuid;
  proposalId: Uuid;
  decision: 'confirmed' | 'declined';
  decidedBy: Uuid;
  decidedAt: IsoDateTime;
  note: string | null;
  /** Bound to a payload, not to a permission. */
  approvedChanges: ProposedChange[];
  approvedChangesDigest: string;
  /** Recorded rather than forbidden, so a team can see if it is routine. */
  selfApproved: boolean;
}

/* ======================================== 33. audit events */

export interface AuditEvent {
  id: Uuid;
  crmWorkspaceId: Uuid;
  actorId: Uuid | null;
  actorKind: 'user' | 'agent' | 'system';
  eventType: string;
  subjectTable: string;
  subjectId: Uuid | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  proposalId: Uuid | null;
  outcome: 'success' | 'failure' | 'refused';
  detail: string | null;
  requestId: Uuid | null;
  createdAt: IsoDateTime;
}

/* ================================= 34. duplicate candidates */

export interface DuplicateCandidate extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  subjectTable: 'crm_people' | 'crm_organisations';
  leftId: Uuid;
  rightId: Uuid;
  /** What matches AND what differs, so a person can judge rather than trust. */
  matchingFields: string[];
  differingFields: string[];
  recommendation: 'review_together' | 'likely_separate';
  reason: string;
  state: 'open' | 'merged' | 'kept_separate' | 'dismissed';
  decidedBy: Uuid | null;
  decidedAt: IsoDateTime | null;
  decisionNote: string | null;
}

/* ============================ 35. record quality assessment */

export type ReviewStatus = 'not_reviewed' | 'needs_review' | 'reviewed' | 'accepted_as_is';

/**
 * Nine named measures about a RECORD.
 *
 * There is no `score`, no `grade`, no `rating` and no percentage, and adding
 * one is the single change that would turn this product into an employee
 * performance tool. The database has a verification block that fails if such a
 * column appears, and the reporting view carries no owner so it cannot be
 * grouped into a per-person number.
 */
export interface RecordQuality extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  subjectTable: string;
  subjectId: Uuid;

  /** 1. Completeness, as present over expected plus the names of the gaps. */
  completenessPresent: number;
  completenessExpected: number;
  completenessMissingFields: string[];

  /** 2. Freshness: days since anything happened. */
  freshnessDays: number | null;
  /** 3. Last meaningful contact, which is a different question. */
  lastMeaningfulActivityAt: IsoDateTime | null;

  /** 4. Source coverage: how much of this record can be traced. */
  sourceCoverageTraced: number;
  sourceCoverageTotal: number;

  /** 5, 6. Open conflicts and possible duplicates. */
  openConflicts: number;
  openDuplicates: number;

  /** 7, 8. The next step and its date, or their absence. */
  nextStep: string | null;
  nextStepDue: IsoDate | null;

  /** 9. Where the record stands in a review. */
  reviewStatus: ReviewStatus;
  reviewedBy: Uuid | null;
  reviewedAt: IsoDateTime | null;

  /** Responsibility for keeping the record good. Not a measure of anybody. */
  dataQualityOwnerUserId: Uuid | null;
  computedAt: IsoDateTime;
}

/* ================================ 36. retention policy */

export interface RetentionPolicy extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  subjectTable: string;
  retainDeletedDays: number;
  /**
   * A prompt to review, never an automatic deletion. Destroying a customer
   * record because nobody opened it is not a retention policy, it is data loss
   * with a schedule.
   */
  reviewAfterInactiveDays: number | null;
  legalHold: boolean;
  legalHoldReason: string | null;
}

/* ============================ 37. integration connections */

export type ConnectionState =
  | 'never_connected'
  | 'connected'
  | 'expired'
  | 'revoked'
  | 'failed';

export type SyncOutcome = 'never_run' | 'ok' | 'partial' | 'failed';

/**
 * One workspace's connection to one outside system.
 *
 * The scopes granted are stored as granted, not as requested, because the two
 * differ in practice and a product that shows the request rather than the grant
 * tells people they have access they do not have. `canSend` is a column rather
 * than a derived value so that turning sending on is an auditable change to a
 * record and not a side effect of an OAuth scope arriving.
 */
export interface IntegrationConnection extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  /** Matches an id in the Stage 8 integration register. */
  integrationId: string;
  state: ConnectionState;
  /** What the provider actually granted. */
  grantedScopes: string[];
  connectedBy: Uuid | null;
  connectedAt: IsoDateTime | null;
  expiresAt: IsoDateTime | null;
  /** Sending stays off until somebody turns it on, per connection. */
  sendingEnabled: boolean;
  sendingEnabledBy: Uuid | null;
  /** Which accounts, folders, labels and dates may be read. Never "all". */
  importScope: Record<string, string>;
  lastAttemptAt: IsoDateTime | null;
  lastOutcome: SyncOutcome;
  /** Plain words, for the person. Never a stack trace. */
  failureDetail: string | null;
  /** Null unless a retry is scheduled, so a failure cannot look handled. */
  nextRetryAt: IsoDateTime | null;
  consecutiveFailures: number;
}

/* ============================ 38. guided import */

export type ImportKind =
  | 'contacts'
  | 'organisations'
  | 'leads'
  | 'opportunities'
  | 'jobs'
  | 'activities'
  | 'custom_fields';

export type ImportRunState =
  | 'mapping'
  | 'validated'
  | 'dry_run'
  | 'committed'
  | 'rolled_back'
  | 'abandoned';

export interface ImportRun extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  kind: ImportKind;
  fileName: string;
  /** Source column to CRM field. Unmapped columns stay unmapped, not guessed. */
  mapping: Record<string, string>;
  state: ImportRunState;
  rowCount: number;
  startedBy: Uuid | null;
  dryRunAt: IsoDateTime | null;
  committedAt: IsoDateTime | null;
  committedBy: Uuid | null;
  rolledBackAt: IsoDateTime | null;
  rolledBackBy: Uuid | null;
  rollbackReason: string | null;
  /** The audit event written when the run was committed or rolled back. */
  auditEventId: Uuid | null;
}

export type ImportRowState =
  | 'ready'
  | 'blocked'
  | 'needs_duplicate_review'
  | 'created'
  | 'updated'
  | 'skipped'
  | 'rolled_back';

export interface ImportRow {
  id: Uuid;
  crmWorkspaceId: Uuid;
  importRunId: Uuid;
  rowNumber: number;
  /** The source row as read, so an error file can reproduce it exactly. */
  source: Record<string, string>;
  state: ImportRowState;
  /**
   * Problems that STOP the row. One sentence each, naming the column.
   *
   * Separate from `warnings` because the two have to behave differently and a
   * single list makes that impossible: a row whose organisation name matches
   * nothing should import without the organisation, not be rejected, and a
   * product that rejects it teaches people to clean the file by deleting the
   * column.
   */
  issues: string[];
  /** Things worth knowing that do not stop the row. */
  warnings: string[];
  /** Set only once the row has created something. */
  createdTable: string | null;
  createdId: Uuid | null;
  /** The record a person decided this row was, where one was chosen. */
  mergedIntoId: Uuid | null;
}

/* ===================== 39. relationship attention (Phase 2A) */

/**
 * The eleven named conditions that put a relationship on the attention list.
 *
 * They are an enumerated type rather than free text for the same reason the
 * approved phrases are a list: a condition invented at the point of use is a
 * condition nobody reviewed, and the set of reasons a product tells somebody
 * their customer needs attention should be decided once, in the open.
 */
export type AttentionCondition =
  | 'single_contact_dependency'
  | 'no_executive_relationship'
  | 'no_interaction_90'
  | 'renewal_approaching'
  | 'service_issue_unresolved'
  | 'follow_ups_ignored'
  | 'no_stakeholder_coverage'
  | 'no_decision_maker'
  | 'no_next_engagement'
  | 'no_recorded_value'
  | 'plan_overdue_for_review';

export const ATTENTION_CONDITIONS: AttentionCondition[] = [
  'single_contact_dependency',
  'no_executive_relationship',
  'no_interaction_90',
  'renewal_approaching',
  'service_issue_unresolved',
  'follow_ups_ignored',
  'no_stakeholder_coverage',
  'no_decision_maker',
  'no_next_engagement',
  'no_recorded_value',
  'plan_overdue_for_review',
];

/**
 * WHAT THIS TABLE HOLDS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * It holds the STATE a person has put a condition into: dismissed, or
 * acknowledged. It does not hold the computed signals themselves.
 *
 * That is a deliberate narrowing of the Phase 2 plan's sketch. The signals are
 * derived from records that already exist, so storing them would create a
 * second copy that can disagree with the records, and in a release with no
 * nightly job to refresh it, every row would be stale the moment somebody
 * logged a call. Computing them on read cannot go stale and, measured over the
 * fixture workspaces, costs under a millisecond.
 *
 * The columns a materialised signal needs are here and nullable
 * (`computedAt`, `detailAtDecision`), so the job that Phase 2A-ii adds writes
 * into this table rather than a new one. What it must never do is write a
 * score: there is no score column, by design, and the verification pass fails
 * the migration if one appears.
 */
export interface RelationshipSignalState extends Timestamped {
  id: Uuid;
  crmWorkspaceId: Uuid;
  /** Always an organisation today. A person-level signal would be a judgement
   *  about a person, which this product does not make. */
  organisationId: Uuid;
  condition: AttentionCondition;
  state: 'acknowledged' | 'dismissed';
  /** Never blank. The only record of why something stopped being shown. */
  reason: string;
  decidedBy: Uuid;
  decidedAt: IsoDateTime;
  /**
   * A dismissal expires. A condition dismissed in March is not a decision
   * about August, and a permanent dismissal is how a product quietly stops
   * telling somebody the thing they most need to know.
   */
  expiresAt: IsoDateTime | null;
  /** What the condition said at the moment it was decided, for the audit. */
  detailAtDecision: string | null;
  /** Set only by the materialising job. Null while computed on read. */
  computedAt: IsoDateTime | null;
}

/**
 * WHY A READ IS WRITTEN DOWN, WHEN NOTHING ELSE IN THIS PRODUCT RECORDS READS.
 *
 * Phase 2B-i makes a customer's whole history answerable in one query. That is
 * the single largest change this product makes to its own risk surface, and it
 * is not a change to what is stored: every record the memory page shows was
 * already there. What changes is how easily one person can assemble all of it.
 *
 * The Australian Privacy Principles do not require a read log. APP 11.2
 * requires reasonable steps to protect personal information, and the
 * notifiable data breaches scheme requires an entity to assess whether a
 * breach is likely to cause serious harm within thirty days. An entity that
 * cannot say which customers' histories were read, and by whom, cannot make
 * that assessment, so it must notify on the worst assumption. The log is the
 * difference between answering the question and guessing.
 *
 * WHAT THIS TABLE MUST NEVER BECOME.
 *
 * It holds `readBy` because the obligation above is about who. It does not
 * follow that the product shows anybody a count of reads per user. There is no
 * function in this module that groups by `readBy`, no page that ranks by it,
 * and migration 0009 fails the deploy if a view appears that does. A read log
 * exposed as a productivity figure is staff surveillance wearing a privacy
 * control's clothes, and it would also make people stop reading the records
 * they need before a meeting.
 */
export interface MemoryRead {
  id: Uuid;
  crmWorkspaceId: Uuid;
  /** Null for a workspace-wide search, which is not about one customer. */
  organisationId: Uuid | null;
  /** 'explorer' for opening one customer's memory, 'search' for a query. */
  kind: 'explorer' | 'search';
  /** The question asked, where one was. Never the answer. */
  question: string | null;
  /** The words searched for, where it was a search. */
  query: string | null;
  /** How many entries the read returned, so an unusual read is visible. */
  entriesReturned: number;
  /** The role the read was made under, because the role decides what it saw. */
  readAs: CrmRole;
  readBy: Uuid;
  readAt: IsoDateTime;
  createdAt: IsoDateTime;
}

/* ===================================================== the whole thing */

/**
 * One workspace's records, as the synthetic data holds them and as a
 * repository returns them.
 */
export interface CrmWorkspaceData {
  workspace: CrmWorkspace;
  members: CrmWorkspaceMember[];
  organisations: Organisation[];
  people: Person[];
  personOrganisationRoles: PersonOrganisationRole[];
  relationships: Relationship[];
  leads: Lead[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  stageCriteria: StageCriterion[];
  workItems: WorkItem[];
  stageMoves: StageMove[];
  activities: Activity[];
  activityParticipants: ActivityParticipant[];
  meetings: Meeting[];
  emailReferences: EmailReference[];
  notes: Note[];
  tasks: Task[];
  commitments: Commitment[];
  decisions: Decision[];
  products: Product[];
  quotes: Quote[];
  quoteLines: QuoteLine[];
  orderReferences: OrderReference[];
  invoiceReferences: InvoiceReference[];
  serviceCases: ServiceCase[];
  accountPlans: AccountPlan[];
  accountPlanOutcomes: AccountPlanOutcome[];
  accountPlanEntries: AccountPlanEntry[];
  accountPlanActions: AccountPlanAction[];
  whitespaceCells: WhitespaceCell[];
  jointPlans: JointPlan[];
  jointPlanActions: JointPlanAction[];
  accountReviews: AccountReview[];
  attachmentReferences: AttachmentReference[];
  tags: Tag[];
  recordTags: RecordTag[];
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldValues: CustomFieldValue[];
  customObjectDefinitions: CustomObjectDefinition[];
  customObjectRecords: CustomObjectRecord[];
  consentRecords: ConsentRecord[];
  communicationPreferences: CommunicationPreference[];
  evidence: Evidence[];
  proposals: Proposal[];
  approvals: Approval[];
  auditEvents: AuditEvent[];
  duplicateCandidates: DuplicateCandidate[];
  recordQuality: RecordQuality[];
  retentionPolicies: RetentionPolicy[];
  integrationConnections: IntegrationConnection[];
  importRuns: ImportRun[];
  importRows: ImportRow[];
  relationshipSignals: RelationshipSignalState[];
  memoryReads: MemoryRead[];
}

/** Every table name the model knows, for the repository and the tests. */
export const CRM_TABLES = [
  'crm_workspaces',
  'crm_workspace_members',
  'crm_organisations',
  'crm_people',
  'crm_person_organisation_roles',
  'crm_relationships',
  'crm_leads',
  'crm_pipelines',
  'crm_pipeline_stages',
  'crm_stage_criteria',
  'crm_work_items',
  'crm_work_item_stage_history',
  'crm_activities',
  'crm_activity_participants',
  'crm_meetings',
  'crm_email_references',
  'crm_notes',
  'crm_tasks',
  'crm_commitments',
  'crm_decisions',
  'crm_products',
  'crm_quotes',
  'crm_quote_lines',
  'crm_order_references',
  'crm_invoice_references',
  'crm_service_cases',
  'crm_account_plans',
  'crm_account_plan_outcomes',
  'crm_account_plan_entries',
  'crm_account_plan_actions',
  'crm_whitespace_cells',
  'crm_joint_plans',
  'crm_joint_plan_actions',
  'crm_account_reviews',
  'crm_attachment_references',
  'crm_tags',
  'crm_record_tags',
  'crm_custom_field_definitions',
  'crm_custom_field_values',
  'crm_custom_object_definitions',
  'crm_custom_object_records',
  'crm_consent_records',
  'crm_communication_preferences',
  'crm_evidence',
  'crm_proposals',
  'crm_approvals',
  'crm_audit_events',
  'crm_duplicate_candidates',
  'crm_record_quality',
  'crm_retention_policies',
  'crm_integration_connections',
  'crm_import_runs',
  'crm_import_rows',
  'crm_relationship_signals',
  'crm_memory_reads',
] as const;

export type CrmTable = (typeof CRM_TABLES)[number];
