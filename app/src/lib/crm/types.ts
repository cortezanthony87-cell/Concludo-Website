/**
 * Concludo CRM: the domain model for the Stage 2 shell.
 *
 * Stage 1 settled the shape. This file is the TypeScript half of it, carrying
 * only what the shell needs to render. Nothing here writes anything, nothing
 * here calls a model, and nothing here reaches a mailbox, an accounting system
 * or a real person. The whole module runs on the synthetic workspace in
 * `lib/crm/data`.
 *
 * TWO RULES ARE ENCODED IN THE TYPES RATHER THAN LEFT TO DISCIPLINE.
 *
 * 1. **Every derived fact carries its basis.** `Traceable` is on every value
 *    the module did not read straight from a record a person typed. A reader
 *    can always tell a stated fact from an inference, and an unknown from a
 *    zero. The interface is required to show it, not merely able to.
 *
 * 2. **An AI proposal is a staged payload, never an applied change.** A
 *    `CrmProposal` holds what would change, why, and the evidence for it. The
 *    shell renders proposals and records a decision locally for this visit. It
 *    does not apply one, because the applier is Stage 5 and a shell that
 *    pretended to apply would be the dishonest kind of demonstration.
 */

/* ------------------------------------------------------------ provenance */

/**
 * Where a value came from.
 *
 * - `stated`: a person wrote it, or it was said in a meeting and quoted.
 * - `inferred`: the module worked it out from something stated.
 * - `calculated`: arithmetic over stated values, such as days since contact.
 * - `unknown`: deliberately absent. Not zero, not blank, not an empty string.
 */
export type Basis = 'stated' | 'inferred' | 'calculated' | 'unknown';

export interface Traceable {
  basis: Basis;
  /** The sentence or record the value came from. Null only when unknown. */
  evidence: string | null;
  /** What produced the evidence, for the "source needs review" control. */
  sourceKind: 'meeting' | 'manual_entry' | 'import' | 'derived' | 'none';
  /** The id of the source record, where one exists. */
  sourceId: string | null;
}

/** A value plus where it came from. */
export interface Traced<T> extends Traceable {
  value: T;
}

/* ------------------------------------------------------------- entities */

export type CrmRecordTerminology = 'opportunity' | 'job' | 'case' | 'application';

export interface CrmOrganisation {
  id: string;
  name: string;
  /** Parent and child organisations, Stage 1 section 7. */
  parentOrganisationId: string | null;
  industry: string;
  /** Relationship health, shown with a label and a shape, never colour alone. */
  health: 'steady' | 'needs_attention' | 'new' | 'dormant';
  healthReason: string;
  /** ISO date of the last recorded activity of any kind, or null. */
  lastActivityAt: string | null;
  openRecordCount: number;
  peopleCount: number;
  /** Renewal or review date where one is recorded. */
  renewalDate: string | null;
  ownerName: string;
  createdAt: string;
}

export interface CrmPerson {
  id: string;
  fullName: string;
  /** Null is normal: many people are captured from a transcript with no address. */
  email: string | null;
  phone: string | null;
  organisationId: string | null;
  roleLabel: string;
  /** How this person relates to a decision, in the account's own terms. */
  stakeholderRole: 'decision_maker' | 'influencer' | 'user' | 'gatekeeper' | 'unknown';
  lastContactAt: string | null;
  /** Why this person may need attention, or null when nothing is outstanding. */
  attentionReason: string | null;
  /** Consent and contact preference, Stage 1 section 14. */
  contactPreference: 'open' | 'limited' | 'do_not_contact';
  contactPreferenceNote: string;
  createdAt: string;
  /** How the person entered the workspace. */
  origin: Traceable;
}

export interface CrmLead {
  id: string;
  personName: string;
  organisationName: string;
  source: string;
  receivedAt: string;
  /** Awaiting review until a person decides. The shell never auto-qualifies. */
  state: 'awaiting_review' | 'in_review' | 'converted' | 'not_proceeding';
  summary: string;
  /** What is missing before a decision can be made, where anything is. */
  missing: string[];
}

export interface CrmPipeline {
  id: string;
  name: string;
  recordTerminology: CrmRecordTerminology;
  stageIds: string[];
}

export interface CrmPipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  /** Named, checkable conditions. An empty list is allowed and says so. */
  exitCriteria: string[];
  /** Days a record normally sits here, used for the quiet check. */
  typicalDays: number;
}

export interface CrmRecord {
  id: string;
  title: string;
  organisationId: string;
  primaryPersonId: string | null;
  pipelineId: string;
  stageId: string;
  /** Indicative value in AUD. Null where no figure has been stated. */
  value: number | null;
  valueBasis: Basis;
  expectedCloseDate: string | null;
  enteredStageAt: string;
  lastActivityAt: string | null;
  ownerName: string;
  /** The single next thing to do, or null when none is recorded. */
  nextStep: string | null;
  nextStepDue: string | null;
  status: 'open' | 'won' | 'not_proceeding' | 'on_hold';
  createdAt: string;
}

export type CrmActivityKind = 'meeting' | 'call' | 'note' | 'email' | 'document';

export interface CrmActivity {
  id: string;
  kind: CrmActivityKind;
  title: string;
  occurredAt: string;
  organisationId: string | null;
  recordId: string | null;
  peopleIds: string[];
  summary: string;
  /** True when the meeting has produced no recorded follow-through. */
  followThroughOutstanding: boolean;
  followThroughReason: string | null;
  /** Where the activity came from, so the timeline can show its evidence. */
  source: Traceable;
}

export interface CrmCommitment {
  id: string;
  description: string;
  /** Who said they would do it, in their own words where it was said aloud. */
  ownerName: string;
  /** True when the owner is the person using the workspace. */
  ownedByUser: boolean;
  dueDate: string | null;
  organisationId: string | null;
  recordId: string | null;
  state: 'open' | 'done' | 'no_longer_needed';
  /** The sentence it was taken from. */
  source: Traceable;
}

export interface CrmServiceIssue {
  id: string;
  title: string;
  organisationId: string;
  raisedAt: string;
  severity: 'low' | 'moderate' | 'high';
  state: 'open' | 'with_customer' | 'resolved';
  /** How this bears on the relationship, which is why the CRM shows it. */
  relationshipEffect: string;
}

export interface CrmAccountPlan {
  id: string;
  organisationId: string;
  objective: string;
  reviewDate: string | null;
  /** Named outcomes with a measure, or an empty list with a reason. */
  outcomes: { label: string; measure: string; state: 'on_track' | 'at_risk' | 'not_started' }[];
  lastReviewedAt: string | null;
}

/* ------------------------------------------------------------ proposals */

export type CrmProposalKind =
  | 'create_person'
  | 'link_person_to_organisation'
  | 'update_next_step'
  | 'record_commitment'
  | 'update_stage'
  | 'merge_duplicate'
  | 'correct_field';

export interface CrmProposal {
  id: string;
  kind: CrmProposalKind;
  /** One line, in plain words, of what would change. */
  headline: string;
  /** The subject, named for a reader rather than by id. */
  subjectLabel: string;
  subjectTable: 'crm_people' | 'crm_organisations' | 'crm_records' | 'crm_commitments';
  subjectId: string | null;
  /** Field by field, what it is now and what it would become. */
  changes: { field: string; from: string | null; to: string }[];
  /** Why the module is proposing it. */
  rationale: string;
  /** Confidence as a word, never as a false percentage. */
  confidence: 'high' | 'moderate' | 'low';
  evidence: Traceable;
  proposedAt: string;
  state: 'awaiting_confirmation' | 'confirmed' | 'declined';
  /** True where the proposal would merge or delete, which needs more care. */
  destructive: boolean;
}

/* ------------------------------------------------- data quality and duplicates */

export interface CrmDuplicateCandidate {
  id: string;
  leftLabel: string;
  rightLabel: string;
  subjectTable: 'crm_people' | 'crm_organisations';
  /** What matches, and what does not, so a person can judge rather than trust. */
  matching: string[];
  differing: string[];
  recommendation: 'review_together' | 'likely_separate';
  reason: string;
}

export interface CrmReviewItem {
  id: string;
  label: string;
  /** Why the record needs a look. Never a score, never a grade. */
  reason: string;
  subjectTable: string;
  subjectId: string;
  /** What would resolve it. */
  suggestedCheck: string;
}

/* ------------------------------------------------------------- workspace */

export interface CrmWorkspace {
  id: string;
  name: string;
  /** Sole trader, small team, and so on. Drives which views show depth. */
  depth: 'sole_trader' | 'small_team' | 'mid_market';
  /** What this workspace calls a record. Stage 1 decision 11. */
  recordTerminology: CrmRecordTerminology;
  recordTerminologyPlural: string;
  owners: string[];
}

export interface CrmDataset {
  workspace: CrmWorkspace;
  organisations: CrmOrganisation[];
  people: CrmPerson[];
  leads: CrmLead[];
  pipelines: CrmPipeline[];
  stages: CrmPipelineStage[];
  records: CrmRecord[];
  activities: CrmActivity[];
  commitments: CrmCommitment[];
  serviceIssues: CrmServiceIssue[];
  accountPlans: CrmAccountPlan[];
  proposals: CrmProposal[];
  duplicates: CrmDuplicateCandidate[];
  reviewItems: CrmReviewItem[];
  /** When the synthetic workspace was last refreshed, for the header. */
  lastSynchronisedAt: string;
}

/* ------------------------------------------------------------ interface */

/** The four states every view must be able to show. */
export type AsyncState = 'loading' | 'ready' | 'empty' | 'partial' | 'error';

/** A module destination. */
export interface CrmDestination {
  path: CrmModulePath;
  label: string;
  iconName: string;
  /** The question this view answers, used as its accessible description. */
  accessibleDescription: string;
  /** Which cluster it belongs to, so seventeen tabs read as five groups. */
  group: 'Work' | 'Relationships' | 'Accounts' | 'Evidence' | 'Manage';
}

export type CrmModulePath =
  | '/crm'
  | '/crm/attention'
  | '/crm/dashboard'
  | '/crm/memory'
  | '/crm/kam'
  | '/crm/relationships'
  | '/crm/people'
  | '/crm/organisations'
  | '/crm/hierarchy'
  | '/crm/coverage'
  | '/crm/capture'
  | '/crm/forecast'
  | '/crm/leads'
  | '/crm/pipeline'
  | '/crm/activities'
  | '/crm/commitments'
  | '/crm/communicate'
  | '/crm/account-plans'
  | '/crm/service'
  | '/crm/proposals'
  | '/crm/reports'
  | '/crm/data-quality'
  | '/crm/imports'
  | '/crm/settings';

/** Everything the person has chosen, all of it carried in the query string. */
export interface CrmViewState {
  /**
   * Which workspace is being looked at.
   *
   * Stage 4 added this. It is deliberately NOT counted as a filter by
   * `crmFiltersAreActive`: a filter narrows what you see inside a tenant, and
   * this says which tenant exists at all. Counting it would put "clear
   * filters" one click away from silently changing workspace.
   */
  workspaceId: string;
  organisationId: string | 'all';
  pipelineId: string | 'all';
  owner: string | 'all';
  dateRange: 'last_7' | 'last_30' | 'last_90' | 'all';
  recordType: 'all' | CrmRecordTerminology;
  search: string;
  savedView: string | null;
}

export interface CrmSavedView {
  key: string;
  label: string;
  description: string;
  patch: Partial<CrmViewState>;
}
