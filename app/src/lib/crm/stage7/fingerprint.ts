/**
 * Approval is bound to a payload, not to a proposal id.
 *
 * THE FAILURE THIS FILE EXISTS TO PREVENT.
 *
 * A person reads a proposal, agrees with it, and approves it. Between the
 * approval and the apply, something changes: the record moved on, the draft was
 * edited, an attachment was swapped, the agent re-ran and produced a different
 * recipient. The apply then performs something nobody approved, and the audit
 * trail says a person approved it, with their name on it.
 *
 * This is not hypothetical and it is not rare. Any system with a queue and a
 * delay has this gap, and the wider the gap the worse it gets. The brief names
 * nine things that must invalidate an approval, and the honest way to implement
 * "if any of these changes" is not nine comparisons scattered through the
 * applier: it is one fingerprint taken over all nine at approval time, taken
 * again at apply time, and compared.
 *
 * WHAT THE FINGERPRINT COVERS, AND WHY EACH ONE.
 *
 *   record          approving a change to one row is not approving it to another
 *   field           the fields named, so a tenth cannot be added afterwards
 *   value           the values, so "update stage to Pilot" cannot become "to Won"
 *   recipient       who a message reaches, which is the whole risk of a draft
 *   body            what it says, so the text cannot be edited after approval
 *   attachment      what travels with it
 *   source          what the proposal was built on, so the evidence cannot shift
 *   account         which customer this is about
 *   external action whether anything leaves at all
 *
 * The digest is deliberately readable rather than cryptographic. This runs in a
 * browser against synthetic data, there is no adversary who benefits from
 * forging it, and a developer who has to debug an invalidation can read the
 * string and see which part moved. When this sits behind a real database the
 * same canonical string goes through a real hash; the canonicalisation is the
 * part that matters and it is the part that is here.
 */
import { AgentProposal, ExternalAction, FieldChange, ProposalSource } from './contract';

/* ========================================== canonical form */

function canonicalChange(change: FieldChange): string {
  // Order inside a change is fixed, and nulls are spelled rather than dropped,
  // so a missing value and an empty string cannot produce the same digest.
  return [
    `t=${change.table}`,
    `r=${change.recordId ?? '-'}`,
    `f=${change.field}`,
    `from=${change.from ?? '∅'}`,
    `to=${change.to}`,
  ].join('|');
}

function canonicalSource(source: ProposalSource): string {
  return `${source.table}:${source.id}`;
}

function canonicalExternal(action: ExternalAction): string {
  return [
    `kind=${action.kind}`,
    // Recipients sorted: approving "a and b" is approving "b and a", and a
    // digest that disagreed would invalidate approvals for no reason.
    `to=${[...action.recipients].map((r) => r.trim().toLowerCase()).sort().join(',')}`,
    `subject=${action.subject ?? '∅'}`,
    // The body is included in full. Truncating it would mean an edit beyond the
    // truncation point survived approval, which is exactly the case this
    // protects against.
    `body=${action.body ?? '∅'}`,
    `attach=${[...action.attachments].sort().join(',')}`,
    `authorised=${action.authorisedToSend}`,
  ].join('|');
}

/**
 * The canonical string a digest is taken over.
 *
 * Exported because the tests assert on it directly: a test that only compares
 * digests can pass while covering nothing, and reading the canonical form is
 * how somebody checks that a new field was actually included.
 */
export function canonicalForm(proposal: AgentProposal): string {
  const changes = proposal.changes.map(canonicalChange).sort().join(';');
  const sources = proposal.sources.map(canonicalSource).sort().join(';');

  return [
    `proposal=${proposal.id}`,
    `account=${proposal.crmWorkspaceId}`,
    `kind=${proposal.kind}`,
    `changes=[${changes}]`,
    `sources=[${sources}]`,
    `external=(${canonicalExternal(proposal.externalAction)})`,
    `destructive=${proposal.isDestructive}`,
  ].join('\n');
}

/**
 * A short, stable digest of the canonical form.
 *
 * FNV-1a, 32 bit, rendered as hex. Not a cryptographic hash and not pretending
 * to be: see the file header. What it must be is deterministic across runs and
 * sensitive to any character of the canonical form, and it is both.
 */
export function digestOf(proposal: AgentProposal): string {
  const text = canonicalForm(proposal);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/* ========================================== what changed, in words */

export interface InvalidationReason {
  /** Which of the nine things the brief names. */
  part:
    | 'record'
    | 'field'
    | 'value'
    | 'recipient'
    | 'body'
    | 'attachment'
    | 'source'
    | 'account'
    | 'external action';
  /** What it was when it was approved, and what it is now. */
  was: string;
  now: string;
}

/**
 * Why an approval no longer holds.
 *
 * The digest answers WHETHER something changed. This answers WHAT, because
 * "your approval is no longer valid" with no explanation is the kind of message
 * that teaches people to click through warnings.
 */
export function whatChanged(
  approved: AgentProposal,
  current: AgentProposal
): InvalidationReason[] {
  const reasons: InvalidationReason[] = [];

  if (approved.crmWorkspaceId !== current.crmWorkspaceId) {
    reasons.push({
      part: 'account',
      was: approved.crmWorkspaceId,
      now: current.crmWorkspaceId,
    });
  }

  const approvedRecords = new Set(approved.changes.map((c) => `${c.table}:${c.recordId ?? '-'}`));
  const currentRecords = new Set(current.changes.map((c) => `${c.table}:${c.recordId ?? '-'}`));
  if (![...approvedRecords].every((r) => currentRecords.has(r)) ||
      approvedRecords.size !== currentRecords.size) {
    reasons.push({
      part: 'record',
      was: [...approvedRecords].sort().join(', ') || 'none',
      now: [...currentRecords].sort().join(', ') || 'none',
    });
  }

  const approvedFields = new Set(approved.changes.map((c) => `${c.table}.${c.field}`));
  const currentFields = new Set(current.changes.map((c) => `${c.table}.${c.field}`));
  if (![...approvedFields].every((f) => currentFields.has(f)) ||
      approvedFields.size !== currentFields.size) {
    reasons.push({
      part: 'field',
      was: [...approvedFields].sort().join(', ') || 'none',
      now: [...currentFields].sort().join(', ') || 'none',
    });
  }

  for (const change of approved.changes) {
    const match = current.changes.find(
      (c) => c.table === change.table && c.field === change.field && c.recordId === change.recordId
    );
    if (match && match.to !== change.to) {
      reasons.push({
        part: 'value',
        was: `${change.table}.${change.field} = ${change.to}`,
        now: `${match.table}.${match.field} = ${match.to}`,
      });
    }
  }

  const approvedTo = [...approved.externalAction.recipients].sort().join(', ');
  const currentTo = [...current.externalAction.recipients].sort().join(', ');
  if (approvedTo !== currentTo) {
    reasons.push({ part: 'recipient', was: approvedTo || 'nobody', now: currentTo || 'nobody' });
  }

  if ((approved.externalAction.body ?? '') !== (current.externalAction.body ?? '')) {
    reasons.push({
      part: 'body',
      was: approved.externalAction.body ?? 'nothing',
      now: current.externalAction.body ?? 'nothing',
    });
  }

  const approvedAttachments = [...approved.externalAction.attachments].sort().join(', ');
  const currentAttachments = [...current.externalAction.attachments].sort().join(', ');
  if (approvedAttachments !== currentAttachments) {
    reasons.push({
      part: 'attachment',
      was: approvedAttachments || 'none',
      now: currentAttachments || 'none',
    });
  }

  const approvedSources = approved.sources.map(canonicalSource).sort().join(', ');
  const currentSources = current.sources.map(canonicalSource).sort().join(', ');
  if (approvedSources !== currentSources) {
    reasons.push({ part: 'source', was: approvedSources, now: currentSources });
  }

  if (approved.externalAction.kind !== current.externalAction.kind) {
    reasons.push({
      part: 'external action',
      was: approved.externalAction.kind,
      now: current.externalAction.kind,
    });
  }

  return reasons;
}

/* ============================================= the approval record */

export interface ApprovalRecord {
  proposalId: string;
  /** Exactly what was approved, kept whole, not a reference to a live object. */
  approvedSnapshot: AgentProposal;
  digest: string;
  approvedBy: string;
  approvedAt: string;
  /** The subset approved, where somebody approved part of a proposal. */
  approvedChangeKeys: string[];
  note: string | null;
}

export interface ValidityCheck {
  valid: boolean;
  reasons: InvalidationReason[];
  /** What a person is told, in one sentence. */
  message: string | null;
}

/**
 * Does this approval still hold against what the proposal is now.
 *
 * Called immediately before anything is applied, every time, with no fast path
 * and no cache. The check is cheap and the failure it prevents is not.
 */
export function stillValid(approval: ApprovalRecord, current: AgentProposal): ValidityCheck {
  if (digestOf(current) === approval.digest) {
    return { valid: true, reasons: [], message: null };
  }

  const reasons = whatChanged(approval.approvedSnapshot, current);

  // The digest disagreed but no named part explains it. That should be
  // impossible; saying so plainly is better than applying something on the
  // grounds that we cannot explain the difference.
  if (reasons.length === 0) {
    return {
      valid: false,
      reasons: [],
      message:
        'This proposal has changed since it was approved, in a way that does not match any of the parts we track. It has not been applied. Approve it again after reading it.',
    };
  }

  const parts = [...new Set(reasons.map((reason) => reason.part))];
  return {
    valid: false,
    reasons,
    message: `The ${parts.join(', ')} changed after this was approved, so the approval no longer covers it. Nothing has been applied. Read it again and approve it again.`,
  };
}

/** A snapshot taken at approval time, deep enough that nothing can shift under it. */
export function snapshot(proposal: AgentProposal): AgentProposal {
  return JSON.parse(JSON.stringify(proposal)) as AgentProposal;
}

/** A stable key for one change, so a partial approval can name what it covered. */
export function changeKey(change: FieldChange): string {
  return `${change.table}:${change.recordId ?? '-'}:${change.field}`;
}
