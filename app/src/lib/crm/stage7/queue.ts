/**
 * The proposal queue: where a person disposes.
 *
 * This is the only place an agent's work becomes anything, and it is built
 * around one asymmetry. Reading a proposal is cheap and approving one is not,
 * so everything here is arranged to make the reading easy and the approving
 * deliberate: the eleven explanation fields in the same order every time, the
 * field-by-field difference shown rather than described, the source quoted
 * rather than summarised, and every decision other than approval available
 * without leaving the row.
 *
 * APPROVE ALL EXISTS AND IS DELIBERATELY NARROW.
 *
 * A queue without a batch action is a queue people stop using by Thursday. A
 * queue where everything can be batched is a queue where the one proposal that
 * mattered goes through with forty that did not. So approve-all covers only
 * proposals that are reversible, carry no external action, carry no content
 * addressed to software, and need no more than the approver's own role. The
 * rest are `individualOnly` and the batch skips them, saying how many it
 * skipped and why.
 */
import { CrmWorkspaceData } from '../domain';
import { AGENT_LABELS, AgentName, AgentProposal } from './contract';
import {
  ApprovalRecord,
  ValidityCheck,
  changeKey,
  digestOf,
  snapshot,
  stillValid,
} from './fingerprint';
import { BuildContext, makeIds } from './agents/build';
import { captureAgent, followThroughAgent } from './agents/intake';
import { dataStewardAgent, pipelineAgent } from './agents/hygiene';
import { relationshipAgent, renewalAgent, serviceContextAgent } from './agents/briefing';
import { kamCopilotAgent } from './agents/kam';
import { accountPlanningAgent, draftingAgent, privacyConsentAgent } from './agents/drafting';

/* ======================================================= running them */

export interface QueueRun {
  proposals: AgentProposal[];
  /** What each agent produced, for the page that groups by agent. */
  byAgent: { agent: AgentName; label: string; proposals: AgentProposal[] }[];
  /** Proposals the door refused, with why. Shown to developers, not customers. */
  refused: { agent: AgentName; because: string[] }[];
}

/**
 * Every agent, over one workspace.
 *
 * Deterministic: same data and same `now` produce the same proposals with the
 * same ids, every time. That is what makes the test suite meaningful and it is
 * what will have to be re-established, differently, when a model sits behind
 * any of these.
 */
export function runAgents(
  data: CrmWorkspaceData,
  now: string,
  otherWorkspaces: CrmWorkspaceData[] = []
): QueueRun {
  const runners: { agent: AgentName; run: (context: BuildContext) => { proposals: AgentProposal[]; refused: { because: string[] }[] } }[] = [
    { agent: 'capture', run: captureAgent },
    { agent: 'follow_through', run: followThroughAgent },
    { agent: 'relationship', run: relationshipAgent },
    { agent: 'pipeline', run: pipelineAgent },
    { agent: 'data_steward', run: dataStewardAgent },
    { agent: 'drafting', run: draftingAgent },
    { agent: 'account_planning', run: accountPlanningAgent },
    { agent: 'service_context', run: serviceContextAgent },
    { agent: 'renewal', run: renewalAgent },
    { agent: 'privacy_consent', run: privacyConsentAgent },
    { agent: 'kam_copilot', run: kamCopilotAgent },
  ];

  const proposals: AgentProposal[] = [];
  const byAgent: QueueRun['byAgent'] = [];
  const refused: QueueRun['refused'] = [];

  for (const { agent, run } of runners) {
    const context: BuildContext = {
      data,
      now,
      otherWorkspaces,
      nextId: makeIds(`${agent.replace(/_/g, '')}`),
    };
    const result = run(context);
    proposals.push(...result.proposals);
    byAgent.push({ agent, label: AGENT_LABELS[agent], proposals: result.proposals });
    for (const entry of result.refused) refused.push({ agent, because: entry.because });
  }

  return { proposals, byAgent, refused };
}

/* ====================================================== the queue state */

/**
 * The decisions a person can make, and what each one means.
 *
 * `request_more_information` and `defer` exist because the real alternative to
 * them is a person approving something they are unsure about in order to clear
 * the list. A queue with only approve and reject teaches people to approve.
 */
export type Decision =
  | 'approve'
  | 'approve_selected'
  | 'reject'
  | 'edit'
  | 'request_more_information'
  | 'defer';

export interface QueueEntry {
  proposal: AgentProposal;
  /** Set once somebody has approved it, whole or in part. */
  approval: ApprovalRecord | null;
  /** Re-checked every time the queue is read. */
  validity: ValidityCheck;
  /** What a person did and when. Append only. */
  history: QueueEvent[];
}

export interface QueueEvent {
  at: string;
  by: string;
  decision: Decision | 'proposed' | 'invalidated';
  note: string | null;
  /** For a partial approval, which changes it covered. */
  changeKeys?: string[];
}

export interface QueueState {
  entries: QueueEntry[];
}

export function openQueue(run: QueueRun, now: string): QueueState {
  return {
    entries: run.proposals.map((proposal) => ({
      proposal,
      approval: null,
      validity: { valid: true, reasons: [], message: null },
      history: [
        { at: now, by: 'agent', decision: 'proposed', note: `Proposed by the ${AGENT_LABELS[proposal.agent].toLowerCase()} agent.` },
      ],
    })),
  };
}

/* ====================================================== the decisions */

export interface DecisionResult {
  ok: boolean;
  /** Why not, in words. */
  because: string | null;
  entry: QueueEntry;
}

function refuse(entry: QueueEntry, because: string): DecisionResult {
  return { ok: false, because, entry };
}

/**
 * Approve a proposal, whole or in part.
 *
 * The approval is bound to a snapshot and a digest taken here, not to the
 * proposal's id. Everything after this compares against that snapshot.
 */
export function approve(
  entry: QueueEntry,
  by: string,
  now: string,
  options: { changeKeys?: string[]; note?: string | null; role: string } = { role: 'crm_viewer' }
): DecisionResult {
  if (entry.proposal.state !== 'awaiting_confirmation' && entry.proposal.state !== 'deferred') {
    return refuse(entry, 'This has already been decided.');
  }

  const required = entry.proposal.approval.role;
  const order = ['crm_viewer', 'crm_contributor', 'crm_approver', 'crm_admin'];
  if (order.indexOf(options.role) < order.indexOf(required)) {
    return refuse(
      entry,
      `This needs ${required.replace('crm_', '')}. ${entry.proposal.approval.because}`
    );
  }

  const keys = options.changeKeys ?? entry.proposal.changes.map(changeKey);

  entry.approval = {
    proposalId: entry.proposal.id,
    approvedSnapshot: snapshot(entry.proposal),
    digest: digestOf(entry.proposal),
    approvedBy: by,
    approvedAt: now,
    approvedChangeKeys: keys,
    note: options.note ?? null,
  };
  entry.proposal.state = 'confirmed';
  entry.history.push({
    at: now,
    by,
    decision: keys.length === entry.proposal.changes.length ? 'approve' : 'approve_selected',
    note: options.note ?? null,
    changeKeys: keys,
  });

  return { ok: true, because: null, entry };
}

export function reject(
  entry: QueueEntry,
  by: string,
  now: string,
  note: string
): DecisionResult {
  if (note.trim().length === 0) {
    return refuse(
      entry,
      'Say why. A rejected proposal with no reason teaches the next person nothing, and teaches the agent nothing either.'
    );
  }
  entry.proposal.state = 'declined';
  entry.history.push({ at: now, by, decision: 'reject', note });
  return { ok: true, because: null, entry };
}

export function requestMoreInformation(
  entry: QueueEntry,
  by: string,
  now: string,
  question: string
): DecisionResult {
  if (question.trim().length === 0) {
    return refuse(entry, 'Say what is missing.');
  }
  entry.proposal.state = 'needs_more_information';
  entry.history.push({ at: now, by, decision: 'request_more_information', note: question });
  return { ok: true, because: null, entry };
}

export function defer(entry: QueueEntry, by: string, now: string, note: string | null): DecisionResult {
  entry.proposal.state = 'deferred';
  entry.history.push({ at: now, by, decision: 'defer', note });
  return { ok: true, because: null, entry };
}

/**
 * Edit a proposal before approving it.
 *
 * An edit INVALIDATES any existing approval, by construction: the digest is
 * taken over the changes, so editing one moves the digest. That is why editing
 * is a first-class decision rather than something done quietly in a form.
 */
export function editProposal(
  entry: QueueEntry,
  by: string,
  now: string,
  mutate: (proposal: AgentProposal) => void,
  note: string | null = null
): DecisionResult {
  mutate(entry.proposal);
  entry.history.push({ at: now, by, decision: 'edit', note });

  if (entry.approval) {
    entry.validity = stillValid(entry.approval, entry.proposal);
    if (!entry.validity.valid) {
      entry.proposal.state = 'invalidated';
      entry.history.push({
        at: now,
        by: 'system',
        decision: 'invalidated',
        note: entry.validity.message,
      });
    }
  }

  return { ok: true, because: null, entry };
}

/**
 * Re-check every approval in the queue against what the proposals are now.
 *
 * Called when the queue is read and before anything is applied. An approval
 * that no longer holds moves the proposal to `invalidated` and says which of
 * the nine parts moved.
 */
export function revalidate(state: QueueState, now: string): QueueState {
  for (const entry of state.entries) {
    if (!entry.approval) continue;
    entry.validity = stillValid(entry.approval, entry.proposal);
    if (entry.validity.valid) continue;
    if (entry.proposal.state === 'invalidated') continue;

    entry.proposal.state = 'invalidated';
    entry.history.push({
      at: now,
      by: 'system',
      decision: 'invalidated',
      note: entry.validity.message,
    });
  }
  return state;
}

/* ========================================================= approve all */

export interface BatchResult {
  approved: QueueEntry[];
  /** Skipped, with the reason, because a silent skip is a lie about what happened. */
  skipped: { entry: QueueEntry; because: string }[];
}

/**
 * What may be approved in a batch.
 *
 * Four conditions, each one a thing that has gone wrong in somebody's product:
 *
 *   not destructive         a merge in a batch is a merge nobody read
 *   no external action      a message in a batch is a message nobody read
 *   no injection flags      content addressed to software is read by a person
 *   not individualOnly      the proposal itself said it needs its own decision
 */
export function batchable(entry: QueueEntry): { ok: boolean; because: string } {
  const proposal = entry.proposal;
  if (proposal.state !== 'awaiting_confirmation') {
    return { ok: false, because: 'It has already been decided.' };
  }
  if (proposal.isDestructive) {
    return { ok: false, because: 'It cannot be undone, so it is approved on its own.' };
  }
  if (proposal.externalAction.kind !== 'none') {
    return {
      ok: false,
      because: 'It carries a message. Anything addressed to a customer is read before it is approved.',
    };
  }
  if (proposal.injectionFlags.length > 0) {
    return {
      ok: false,
      because:
        'A record behind it contains text addressed to software, so a person reads this one.',
    };
  }
  if (proposal.approval.individualOnly) {
    return { ok: false, because: proposal.approval.because };
  }
  return { ok: true, because: '' };
}

export function approveAll(
  state: QueueState,
  by: string,
  now: string,
  role: string
): BatchResult {
  const approved: QueueEntry[] = [];
  const skipped: BatchResult['skipped'] = [];

  for (const entry of state.entries) {
    const check = batchable(entry);
    if (!check.ok) {
      if (entry.proposal.state === 'awaiting_confirmation') {
        skipped.push({ entry, because: check.because });
      }
      continue;
    }
    const result = approve(entry, by, now, { role, note: 'Approved as part of a batch.' });
    if (result.ok) approved.push(entry);
    else skipped.push({ entry, because: result.because ?? 'Refused.' });
  }

  return { approved, skipped };
}

/* ========================================================= reading it */

export interface QueueSummary {
  waiting: number;
  approved: number;
  declined: number;
  deferred: number;
  needsInformation: number;
  invalidated: number;
  /** How many of the waiting ones a batch would not cover, and why. */
  notBatchable: number;
  withExternalAction: number;
  withInjectionFlags: number;
  destructive: number;
}

export function summarise(state: QueueState): QueueSummary {
  const waiting = state.entries.filter((e) => e.proposal.state === 'awaiting_confirmation');
  return {
    waiting: waiting.length,
    approved: state.entries.filter((e) => e.proposal.state === 'confirmed').length,
    declined: state.entries.filter((e) => e.proposal.state === 'declined').length,
    deferred: state.entries.filter((e) => e.proposal.state === 'deferred').length,
    needsInformation: state.entries.filter((e) => e.proposal.state === 'needs_more_information')
      .length,
    invalidated: state.entries.filter((e) => e.proposal.state === 'invalidated').length,
    notBatchable: waiting.filter((e) => !batchable(e).ok).length,
    withExternalAction: waiting.filter((e) => e.proposal.externalAction.kind !== 'none').length,
    withInjectionFlags: waiting.filter((e) => e.proposal.injectionFlags.length > 0).length,
    destructive: waiting.filter((e) => e.proposal.isDestructive).length,
  };
}

/** One proposal, by id, so a detail page can open it. */
export function entryFor(state: QueueState, proposalId: string): QueueEntry | null {
  return state.entries.find((entry) => entry.proposal.id === proposalId) ?? null;
}

/* ================================================= the field difference */

export interface DiffRow {
  table: string;
  recordId: string | null;
  field: string;
  /** What it says now, as a person sees it. */
  from: string;
  /** What it would say. */
  to: string;
  key: string;
  /** True where this row is part of a partial approval. */
  included: boolean;
}

/**
 * The field-by-field difference, as rows rather than as a sentence.
 *
 * A proposal that says "updates the contact details" is one somebody approves
 * without knowing what changed. Rows with a before and an after are the whole
 * point of a queue.
 */
export function diffOf(entry: QueueEntry): DiffRow[] {
  const included = new Set(entry.approval?.approvedChangeKeys ?? []);
  const hasApproval = entry.approval !== null;

  return entry.proposal.changes.map((change) => ({
    table: change.table,
    recordId: change.recordId,
    field: change.field,
    from: change.fromLabel ?? change.from ?? 'Not recorded',
    to: change.toLabel ?? change.to,
    key: changeKey(change),
    included: hasApproval ? included.has(changeKey(change)) : true,
  }));
}
