/**
 * The agent proposal contract.
 *
 * WHAT THIS RELEASE ACTUALLY CONTAINS, SAID PLAINLY.
 *
 * There is no model call anywhere in Stage 7. Concludo Pty Ltd is pre-revenue,
 * nothing is connected, and shipping a demonstration that quietly called an API
 * would be the first thing in this product that was not what it said it was.
 *
 * What is built here is the part that has to be right BEFORE a model is wired
 * in: the contract a proposal must satisfy, the validation that refuses one
 * that does not, the grounding check that refuses a claim pointing at nothing,
 * the injection boundary, the approval digest, and the queue a person works
 * through. The ten agents produce their proposals deterministically from the
 * records, which means every test in this stage asserts a property of the
 * RAILS rather than of a model's mood.
 *
 * That ordering is deliberate and it is the opposite of the usual one. A team
 * that wires the model first and builds the rails afterwards ships the rails
 * that the model's existing output happens to pass. Building them first means
 * the model arrives behind a contract that already refuses the things it must
 * never do, and the day it starts hallucinating owners is a day the validator
 * catches rather than a day a customer does.
 *
 * THE PRINCIPLE EVERY TYPE HERE ENFORCES.
 *
 * AI proposes. A human disposes. An agent's only write target is a proposal.
 * No agent writes a CRM entity, sends anything, or merges anything, and there
 * is no code path in this release by which one could: the appliers live behind
 * the queue, and the queue runs only on a human decision.
 */
import {
  Confidence,
  CrmWorkspaceData,
  ProposalKind,
  ProposedChange,
  Uuid,
} from '../domain';

/* ================================================= what an agent is */

export type AgentName =
  | 'capture'
  | 'follow_through'
  | 'relationship'
  | 'pipeline'
  | 'data_steward'
  | 'drafting'
  | 'account_planning'
  | 'service_context'
  | 'renewal'
  | 'privacy_consent';

export const AGENT_NAMES: AgentName[] = [
  'capture',
  'follow_through',
  'relationship',
  'pipeline',
  'data_steward',
  'drafting',
  'account_planning',
  'service_context',
  'renewal',
  'privacy_consent',
];

export const AGENT_LABELS: Record<AgentName, string> = {
  capture: 'Capture',
  follow_through: 'Follow-through',
  relationship: 'Relationship',
  pipeline: 'Pipeline',
  data_steward: 'Data steward',
  drafting: 'Drafting',
  account_planning: 'Account planning',
  service_context: 'Service context',
  renewal: 'Renewal',
  privacy_consent: 'Privacy and consent',
};

export const AGENT_PURPOSES: Record<AgentName, string> = {
  capture: 'Proposes what a conversation should be attached to.',
  follow_through: 'Proposes what was promised, by whom, and by when.',
  relationship: 'Prepares a briefing before somebody talks to a customer.',
  pipeline: 'Proposes what a piece of work needs next.',
  data_steward: 'Finds records that disagree with each other.',
  drafting: 'Writes a message for a person to read, change and send.',
  account_planning: 'Drafts the parts of a plan nobody has written.',
  service_context: 'Says what is wrong for a customer, without the detail.',
  renewal: 'Assembles what is actually recorded before a renewal.',
  privacy_consent: 'Finds what the law and the record require before contact.',
};

/* ========================================== what a proposal must carry */

/**
 * A record this proposal looked at.
 *
 * Carried as a table and an id so grounding can be checked mechanically: every
 * source must resolve to a row that exists, in THIS workspace. A source that
 * does not resolve is how a confident sentence about a customer turns out to be
 * about nobody.
 */
export interface ProposalSource {
  table: string;
  id: Uuid;
  /** What it is, for a person reading the proposal. */
  label: string;
  /** The sentence from the record, where the proposal leans on one. */
  quote: string | null;
  /** Where to open it. Null where the record has no page of its own. */
  path: string | null;
}

/** A field this proposal would change, with what it is now and what it becomes. */
export interface FieldChange extends ProposedChange {
  table: string;
  recordId: Uuid | null;
  /** What a person sees, where the stored value is an id or a code. */
  fromLabel: string | null;
  toLabel: string | null;
}

/**
 * An action that would reach outside Concludo.
 *
 * Nothing in this release performs one. The type exists so that a proposal has
 * to DECLARE whether it would, which is what lets the queue show it, the digest
 * cover it and the tests assert that nothing is ever marked as sent.
 */
export interface ExternalAction {
  kind: 'send_email' | 'send_message' | 'create_calendar_event' | 'none';
  /** Who it would reach. Taken from the record, never from message content. */
  recipients: string[];
  subject: string | null;
  body: string | null;
  attachments: string[];
  /** True only where a person has separately authorised sending. Never set here. */
  authorisedToSend: false;
  /** Said on screen wherever a draft appears. */
  note: string;
}

export const NO_EXTERNAL_ACTION: ExternalAction = {
  kind: 'none',
  recipients: [],
  subject: null,
  body: null,
  attachments: [],
  authorisedToSend: false,
  note: 'This proposal changes records only. Nothing leaves Concludo.',
};

/**
 * The eleven things the brief requires every proposal to explain.
 *
 * Not optional, not "where applicable", and not a free-text blob. Each is its
 * own field so the validator can refuse a proposal that leaves one empty, and
 * so the interface renders the same eleven headings every time. A person
 * approving the fortieth proposal of the morning should never have to work out
 * which parts of this one are missing.
 */
export interface AgentProposal {
  id: Uuid;
  crmWorkspaceId: Uuid;
  agent: AgentName;
  kind: ProposalKind | 'draft_message' | 'briefing' | 'review_request' | 'flag_for_attention';

  /** 1. What the agent observed. */
  observed: string;
  /** 2. Which source records it used. At least one, all resolving. */
  sources: ProposalSource[];
  /** 3. What it proposes, in a sentence a person can disagree with. */
  proposes: string;
  /** 4. Which records and fields would change. Empty for a read-only briefing. */
  changes: FieldChange[];
  /** 5. Whether any external action would occur. */
  externalAction: ExternalAction;
  /** 6. Confidence, in words, never a percentage. */
  confidence: Confidence;
  /** 7. What it assumed. Empty array is allowed; the field is not. */
  assumptions: string[];
  /** 8. What disagrees with it. */
  conflicts: string[];
  /** 9. What it did not have. */
  missingInformation: string[];
  /** 10. What happens if this is approved, including what cannot be undone. */
  consequences: string[];
  /** 11. Who has to approve it, and why that role. */
  approval: ApprovalRequirement;

  /** True where applying it cannot be undone by editing a field. */
  isDestructive: boolean;
  /**
   * Set where any source carried content that tried to give instructions.
   * A flagged proposal can still be approved by a person who reads it, but it
   * can never be part of an approve-all.
   */
  injectionFlags: string[];
  proposedAt: string;
  state: ProposalState;
}

export type ProposalState =
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'declined'
  | 'deferred'
  | 'needs_more_information'
  | 'superseded'
  | 'invalidated';

export interface ApprovalRequirement {
  /** The least role that may approve this. */
  role: 'crm_contributor' | 'crm_approver' | 'crm_admin';
  /** Why that role, in words. */
  because: string;
  /** True where this may never be part of an approve-all. */
  individualOnly: boolean;
}

/* ================================== structured output validation */

export interface ContractProblem {
  field: string;
  message: string;
}

export interface ContractResult {
  ok: boolean;
  problems: ContractProblem[];
}

const blank = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim().length === 0;

/**
 * Does this proposal satisfy the contract.
 *
 * Run before a proposal is allowed into the queue, not when it is rendered. A
 * malformed proposal that reaches a screen has already cost somebody the time
 * to read it and work out what is wrong with it, and a malformed one that
 * reaches the applier is a defect with a customer's name on it.
 */
export function validateProposalContract(proposal: Partial<AgentProposal>): ContractResult {
  const problems: ContractProblem[] = [];

  if (blank(proposal.observed)) {
    problems.push({
      field: 'observed',
      message: 'A proposal says what it observed. Without that nobody can check it.',
    });
  }
  if (blank(proposal.proposes)) {
    problems.push({
      field: 'proposes',
      message: 'A proposal says what it proposes, in a sentence somebody can disagree with.',
    });
  }

  if (!proposal.sources || proposal.sources.length === 0) {
    problems.push({
      field: 'sources',
      message:
        'A proposal names the records it used. One with no sources is an assertion, and an assertion about a customer is how this goes wrong.',
    });
  }

  for (const [index, source] of (proposal.sources ?? []).entries()) {
    if (blank(source.table) || blank(source.id)) {
      problems.push({ field: `sources[${index}]`, message: 'A source names a table and a row.' });
    }
  }

  // The eleven fields are PRESENT even when empty. An absent array and an empty
  // one are different claims: "nothing was assumed" and "nobody checked".
  for (const field of [
    'assumptions',
    'conflicts',
    'missingInformation',
    'consequences',
  ] as const) {
    if (!Array.isArray(proposal[field])) {
      problems.push({
        field,
        message: `${field} is stated even when it is empty, because an absent list and an empty one mean different things.`,
      });
    }
  }

  if (!proposal.externalAction) {
    problems.push({
      field: 'externalAction',
      message:
        'Every proposal declares whether anything would leave Concludo, including when the answer is no.',
    });
  } else {
    const action = proposal.externalAction;
    if (action.kind !== 'none' && action.recipients.length === 0) {
      problems.push({
        field: 'externalAction.recipients',
        message: 'A proposed message with no recipient cannot be reviewed.',
      });
    }
    // THE HARD LINE. Nothing in this release may be marked as authorised to
    // send, by any agent, under any circumstances.
    if ((action as { authorisedToSend: boolean }).authorisedToSend === true) {
      problems.push({
        field: 'externalAction.authorisedToSend',
        message:
          'No agent may authorise sending. A person authorises sending, separately, after reading the draft.',
      });
    }
  }

  if (!proposal.approval) {
    problems.push({
      field: 'approval',
      message: 'A proposal says who has to approve it and why that role.',
    });
  } else if (blank(proposal.approval.because)) {
    problems.push({
      field: 'approval.because',
      message: 'Say why that role, so a person can tell a real constraint from a habit.',
    });
  }

  if (!proposal.confidence) {
    problems.push({ field: 'confidence', message: 'Confidence is stated, in words.' });
  }

  // A destructive proposal is individually approved, always. The one change
  // that cannot be undone by editing a field must not ride along in a batch.
  if (proposal.isDestructive && proposal.approval && !proposal.approval.individualOnly) {
    problems.push({
      field: 'approval.individualOnly',
      message:
        'Something that cannot be undone is approved on its own, never as part of an approve-all.',
    });
  }

  for (const [index, change] of (proposal.changes ?? []).entries()) {
    if (blank(change.field) || blank(change.table)) {
      problems.push({
        field: `changes[${index}]`,
        message: 'A change names the table and the field it would change.',
      });
    }
    if (change.to === undefined) {
      problems.push({
        field: `changes[${index}].to`,
        message: 'A change says what the value would become.',
      });
    }
  }

  return { ok: problems.length === 0, problems };
}

/* ========================================= source grounding */

export interface GroundingResult {
  ok: boolean;
  /** Sources that do not resolve to a row in this workspace. */
  ungrounded: ProposalSource[];
  /** Sources that resolve in another workspace, which is the serious one. */
  crossTenant: ProposalSource[];
  /** Changes aimed at a record the proposal never looked at. */
  unsourcedChanges: FieldChange[];
  problems: string[];
}

/** Every collection a source may point at, and how to find a row in it. */
function rowExists(data: CrmWorkspaceData, table: string, id: string): boolean {
  const collections: Record<string, { id: string }[]> = {
    crm_people: data.people,
    crm_organisations: data.organisations,
    crm_work_items: data.workItems,
    crm_activities: data.activities,
    crm_meetings: data.meetings,
    crm_notes: data.notes,
    crm_tasks: data.tasks,
    crm_commitments: data.commitments,
    crm_decisions: data.decisions,
    crm_leads: data.leads,
    crm_service_cases: data.serviceCases,
    crm_account_plans: data.accountPlans,
    crm_evidence: data.evidence,
    crm_quotes: data.quotes,
    crm_products: data.products,
    crm_consent_records: data.consentRecords,
    crm_communication_preferences: data.communicationPreferences,
    crm_person_organisation_roles: data.personOrganisationRoles,
    crm_whitespace_cells: data.whitespaceCells,
    crm_joint_plans: data.jointPlans,
    crm_email_references: data.emailReferences,
    crm_pipeline_stages: data.stages,
  };

  const rows = collections[table];
  if (!rows) return false;
  return rows.some((row) => row.id === id);
}

/**
 * Is every claim in this proposal attached to something real and ours.
 *
 * Three separate failures, kept apart because they mean different things:
 *
 *   ungrounded   a source that resolves to nothing. The proposal is about a
 *                record that does not exist, which is the shape of a
 *                hallucination.
 *   crossTenant  a source that resolves in another workspace. This is the
 *                serious one: it is one customer's information appearing in
 *                another customer's proposal, and it is refused outright.
 *   unsourced    a change aimed at a record the proposal never looked at.
 *                Changing something you did not read is how the right edit
 *                lands on the wrong row.
 */
export function checkGrounding(
  data: CrmWorkspaceData,
  proposal: AgentProposal,
  otherWorkspaces: CrmWorkspaceData[] = []
): GroundingResult {
  const ungrounded: ProposalSource[] = [];
  const crossTenant: ProposalSource[] = [];
  const problems: string[] = [];

  if (proposal.crmWorkspaceId !== data.workspace.id) {
    problems.push(
      'This proposal belongs to another workspace. Nothing about it may be shown here.'
    );
  }

  for (const source of proposal.sources) {
    if (rowExists(data, source.table, source.id)) continue;

    const elsewhere = otherWorkspaces.find((other) => rowExists(other, source.table, source.id));
    if (elsewhere) {
      crossTenant.push(source);
      problems.push(
        `${source.label} is a record in another workspace. A proposal here may not be built on it.`
      );
      continue;
    }

    ungrounded.push(source);
    problems.push(`${source.label} does not resolve to any record in this workspace.`);
  }

  const sourcedIds = new Set(proposal.sources.map((source) => source.id));
  const unsourcedChanges = proposal.changes.filter(
    (change) => change.recordId !== null && !sourcedIds.has(change.recordId)
  );
  for (const change of unsourcedChanges) {
    problems.push(
      `This would change ${change.table}.${change.field} on a record it never looked at.`
    );
  }

  return {
    ok: problems.length === 0,
    ungrounded,
    crossTenant,
    unsourcedChanges,
    problems,
  };
}

/* ============================================= admission to the queue */

export interface Admission {
  admitted: boolean;
  /** Why not, in words a person can act on. */
  refusedBecause: string[];
}

/**
 * The one door into the queue.
 *
 * A proposal that fails the contract or the grounding check is not rendered
 * with a warning on it: it does not enter the queue at all, and the refusal is
 * recorded. A queue that shows broken proposals teaches people to skim, and a
 * person who skims approves the one that mattered.
 */
export function admit(
  data: CrmWorkspaceData,
  proposal: AgentProposal,
  otherWorkspaces: CrmWorkspaceData[] = []
): Admission {
  const contract = validateProposalContract(proposal);
  const grounding = checkGrounding(data, proposal, otherWorkspaces);

  return {
    admitted: contract.ok && grounding.ok,
    refusedBecause: [...contract.problems.map((p) => `${p.field}: ${p.message}`), ...grounding.problems],
  };
}
