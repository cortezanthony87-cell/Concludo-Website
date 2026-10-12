/**
 * The approval gate for every action that would reach outside Concludo.
 *
 * Stage 5 built approval for one action: saving a draft. This generalises it to
 * the five external actions the product will ever plausibly want, and makes the
 * gate the only way any of them can be reached.
 *
 * Three properties matter, and all three are enforced by the types rather than
 * by discipline.
 *
 * 1. **Approval is per action, per payload.** An approval for saving a draft
 *    does not authorise archiving the thread, and an approval of one body of
 *    text does not survive an edit to that text. There is no "approve
 *    everything" and no session-wide consent.
 *
 * 2. **An action with no implementation cannot be approved into existence.**
 *    Four of the five are disabled in this release. `planAction` refuses them
 *    before it looks at approvals at all, so a forged or replayed approval
 *    reaches nothing.
 *
 * 3. **Two independent locks on sending.** The release state refuses it, and
 *    the capability behind it (`send_message`) is denied and ungrantable in
 *    `providers/capabilities.ts`. Removing either one still leaves the other.
 *
 * Nothing in this file performs an action. `planAction` returns what WOULD
 * happen, which is all this release is willing to claim.
 */
import { CapabilityGrants, CapabilityKey, isAllowed } from './providers/capabilities';
import {
  ApprovalRecord,
  DraftFingerprintInput,
  approvalStatus,
  changedFields,
  createApproval,
  fingerprintOf,
} from './draftReview';

/* ------------------------------------------------------------ the actions */

export type ExternalActionKind =
  | 'save_draft_to_mailbox'
  | 'send_reviewed_draft'
  | 'archive_messages'
  | 'create_task'
  | 'create_reminder';

export type ActionRelease =
  /** Built, and reachable only with a matching approval and a granted capability. */
  | 'available_with_approval'
  /** Specified, deliberately off in this release, with a reason. */
  | 'disabled_this_release'
  /** Never, by design. No implementation exists to enable. */
  | 'denied_by_design';

export interface ExternalActionDefinition {
  kind: ExternalActionKind;
  label: string;
  /** What it would do, in one sentence a person can hold us to. */
  description: string;
  /** What it would touch outside Concludo. */
  touchesOutside: string;
  release: ActionRelease;
  /** Why it is in that release state. Never blank. */
  releaseReason: string;
  /** The Stage 6 capability it needs. Null where no provider scope is involved. */
  capability: CapabilityKey | null;
  /**
   * Always true. Written out rather than implied, because a reader checking
   * whether anything can happen without approval should find the answer here
   * and find the same answer for every row.
   */
  requiresApproval: true;
  /** True only where a single approval may cover more than one item. */
  bulkAllowed: boolean;
  /** Whether a code path exists behind the gate today. */
  implemented: boolean;
}

export const EXTERNAL_ACTIONS: readonly ExternalActionDefinition[] = [
  {
    kind: 'save_draft_to_mailbox',
    label: 'Save this draft to my Drafts folder',
    description:
      'Writes the approved text into your own Drafts folder, unsent, for you to read and send yourself in your mail client.',
    touchesOutside: 'One new unsent draft in the connected mailbox.',
    release: 'available_with_approval',
    releaseReason:
      'The only external write the product wants. Gated behind an opt-in capability, a provider scope requested incrementally, and an approval of this exact text.',
    capability: 'write_draft_to_mailbox',
    requiresApproval: true,
    bulkAllowed: false,
    implemented: true,
  },
  {
    kind: 'send_reviewed_draft',
    label: 'Send a reviewed draft',
    description:
      'Would send an approved reply. Not available. If it is ever built, it will be its own controlled release with its own review.',
    touchesOutside: 'A message leaving the mailbox, which cannot be recalled.',
    release: 'disabled_this_release',
    releaseReason:
      'Sending is the one action that cannot be undone and cannot be checked afterwards. The capability behind it is denied and ungrantable, so this row has two independent locks rather than one setting.',
    capability: 'send_message',
    requiresApproval: true,
    bulkAllowed: false,
    implemented: false,
  },
  {
    kind: 'archive_messages',
    label: 'Archive the selected messages',
    description:
      'Would move messages out of the inbox. Not available in this release, in bulk or singly.',
    touchesOutside: 'The location of messages in the mailbox.',
    release: 'disabled_this_release',
    releaseReason:
      'Archiving needs a write scope broad enough to modify mail, and the benefit is a tidier inbox rather than a decision a person could not otherwise make. Not worth the grant. Nothing in Concludo needs it.',
    capability: 'archive_message',
    requiresApproval: true,
    bulkAllowed: false,
    implemented: false,
  },
  {
    kind: 'create_task',
    label: 'Create a task in a connected system',
    description:
      'Would create a task in a task tracker. Not available. Concludo writes a task line for you to copy instead.',
    touchesOutside: 'A new record in a third-party system.',
    release: 'disabled_this_release',
    releaseReason:
      'A task created from a misread email is a task somebody chases. The suggestion path writes a line of text, touches nothing, and is what the module does today.',
    capability: 'create_external_task',
    requiresApproval: true,
    bulkAllowed: false,
    implemented: false,
  },
  {
    kind: 'create_reminder',
    label: 'Create a calendar reminder',
    description:
      'Would create a calendar event or reminder. Not available. Concludo writes a reminder line and shows its date under Actions and Deadlines.',
    touchesOutside: 'A new event in the person’s calendar.',
    release: 'disabled_this_release',
    releaseReason:
      'A date read out of an email can be wrong, and a wrong calendar entry is acted on by other people. The suggestion path carries the same information and nobody else sees it.',
    capability: 'create_calendar_event',
    requiresApproval: true,
    bulkAllowed: false,
    implemented: false,
  },
];

export function externalAction(kind: ExternalActionKind): ExternalActionDefinition {
  const found = EXTERNAL_ACTIONS.find((a) => a.kind === kind);
  if (!found) throw new Error(`Unknown external action: ${kind}`);
  return found;
}

/** Every action that is reachable at all in this release. */
export const AVAILABLE_ACTIONS = EXTERNAL_ACTIONS.filter(
  (a) => a.release === 'available_with_approval'
);

/** Everything explicitly off, with its reason, for the interface to show. */
export const DISABLED_ACTIONS = EXTERNAL_ACTIONS.filter(
  (a) => a.release !== 'available_with_approval'
);

/** Bulk destructive actions, as a named concept, so the answer is checkable. */
export const DESTRUCTIVE_BULK_ACTIONS: readonly {
  name: string;
  state: 'disabled';
  why: string;
}[] = [
  {
    name: 'Bulk delete',
    state: 'disabled',
    why: 'Deletion is a denied capability. No code path deletes a message.',
  },
  {
    name: 'Bulk archive',
    state: 'disabled',
    why: 'Archiving is disabled in this release, singly and in bulk.',
  },
  {
    name: 'Bulk mark as read',
    state: 'disabled',
    why: 'Changing read state silently rewrites what a person has actually read.',
  },
  {
    name: 'Bulk send',
    state: 'disabled',
    why: 'Sending does not exist in this product.',
  },
  {
    name: 'Bulk unsubscribe',
    state: 'disabled',
    why: 'Confirms a live address to whoever sent the mail. Denied capability.',
  },
];

/* ---------------------------------------------------------- the approvals */

/**
 * An approval for one action on one payload.
 *
 * `payloadFingerprint` is what makes an approval specific. For a draft it is
 * the six-field fingerprint from Stage 5; for anything else it is a stable
 * digest of the item ids. Either way, a changed payload no longer matches.
 */
export interface ActionApproval {
  id: string;
  kind: ExternalActionKind;
  /** The thread the action concerns, or null for a multi-item action. */
  threadId: string | null;
  payloadFingerprint: string;
  /** A readable copy of what was approved, for the audit trail. */
  approvedSummary: string;
  approvedAt: string;
  approvedBy: string;
  accountId: string;
}

export type ActionApprovalState =
  | 'not_approved'
  | 'approved'
  | 'expired'
  /** Approved, but the action cannot run in this release regardless. */
  | 'approved_but_unavailable';

export interface ActionApprovalStatus {
  kind: ExternalActionKind;
  state: ActionApprovalState;
  /** One sentence for the person about to act. */
  message: string;
  /** For a draft, the fields that changed since approval. */
  changed: string[];
  approval: ActionApproval | null;
}

export function payloadFingerprint(itemIds: readonly string[]): string {
  const key = itemIds.map((i) => i.trim()).sort().join('|');
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  return `pl-${hash.toString(36)}-${itemIds.length}`;
}

export function approveAction(
  kind: ExternalActionKind,
  options: {
    threadId: string | null;
    accountId: string;
    fingerprint: string;
    summary: string;
    by: string;
    at: string;
  }
): ActionApproval {
  return {
    id: `apr-${kind}-${options.fingerprint}`,
    kind,
    threadId: options.threadId,
    payloadFingerprint: options.fingerprint,
    approvedSummary: options.summary,
    approvedAt: options.at,
    approvedBy: options.by,
    accountId: options.accountId,
  };
}

export function statusForAction(
  kind: ExternalActionKind,
  fingerprint: string,
  approvals: readonly ActionApproval[]
): ActionApprovalStatus {
  const definition = externalAction(kind);
  const forKind = approvals.filter((a) => a.kind === kind);
  const exact = forKind.find((a) => a.payloadFingerprint === fingerprint) ?? null;

  if (!exact) {
    const stale = forKind[forKind.length - 1] ?? null;
    return {
      kind,
      state: stale ? 'expired' : 'not_approved',
      message: stale
        ? 'Approval expired. What is in front of you is not what was approved. Review it again.'
        : `Not approved. ${definition.label} needs your approval of exactly this, every time.`,
      changed: [],
      approval: null,
    };
  }

  if (definition.release !== 'available_with_approval') {
    return {
      kind,
      state: 'approved_but_unavailable',
      message: `Approved, and still unavailable. ${definition.releaseReason}`,
      changed: [],
      approval: exact,
    };
  }

  return {
    kind,
    state: 'approved',
    message: `Approved. ${definition.description}`,
    changed: [],
    approval: exact,
  };
}

/** The draft-specific path, which keeps the Stage 5 six-field comparison. */
export function draftApprovalStatus(
  current: DraftFingerprintInput,
  record: ApprovalRecord | null
): ActionApprovalStatus {
  const status = approvalStatus(current, record);
  const changed = record ? changedFields(record.approvedSnapshot, current) : [];
  return {
    kind: 'save_draft_to_mailbox',
    state:
      status.state === 'approved' ? 'approved' : status.state === 'expired' ? 'expired' : 'not_approved',
    message: status.message,
    changed,
    approval: record
      ? {
          id: record.id,
          kind: 'save_draft_to_mailbox',
          threadId: record.threadId,
          payloadFingerprint: record.fingerprint,
          approvedSummary: `Draft for ${record.threadId}, subject "${record.approvedSnapshot.subject}"`,
          approvedAt: record.approvedAt,
          approvedBy: record.approvedBy,
          accountId: record.approvedSnapshot.accountId,
        }
      : null,
  };
}

/* -------------------------------------------------------------- the gate */

export class ActionRefused extends Error {
  readonly kind: ExternalActionKind;
  readonly because:
    | 'release_disabled'
    | 'capability_not_granted'
    | 'not_approved'
    | 'approval_expired'
    | 'not_implemented'
    | 'bulk_not_allowed'
    | 'account_mismatch';

  constructor(kind: ExternalActionKind, because: ActionRefused['because'], message: string) {
    super(message);
    this.name = 'ActionRefused';
    this.kind = kind;
    this.because = because;
  }
}

export interface ActionPlan {
  kind: ExternalActionKind;
  /** What would happen, for the person to read before they approve. */
  wouldDo: string;
  /** What would NOT happen, because this is the sentence people need. */
  wouldNotDo: string;
  itemIds: readonly string[];
  accountId: string;
  fingerprint: string;
  approvalRequired: true;
}

export interface PlanRequest {
  kind: ExternalActionKind;
  accountId: string;
  itemIds: readonly string[];
  grants: CapabilityGrants;
  approvals: readonly ActionApproval[];
  /** The thread the action concerns, where there is exactly one. */
  threadId?: string | null;
}

/**
 * The single entry point for anything external.
 *
 * It returns a plan and never performs the action, because in this release
 * there is nothing behind it to perform: the one implemented action needs a
 * connected mailbox, and no mailbox has ever been connected. The checks below
 * are nonetheless real, in this order, so that the first thing to fail is the
 * cheapest and the most categorical.
 */
export function planAction(request: PlanRequest): ActionPlan {
  const definition = externalAction(request.kind);

  // 1. The release. Checked first, so a disabled action is refused before any
  //    approval is even looked at.
  if (definition.release !== 'available_with_approval') {
    throw new ActionRefused(
      request.kind,
      'release_disabled',
      `${definition.label} is not available. ${definition.releaseReason}`
    );
  }

  // 2. Nothing built behind it.
  if (!definition.implemented) {
    throw new ActionRefused(
      request.kind,
      'not_implemented',
      `${definition.label} has no implementation behind it, so it cannot run even with approval.`
    );
  }

  // 3. Bulk.
  if (request.itemIds.length > 1 && !definition.bulkAllowed) {
    throw new ActionRefused(
      request.kind,
      'bulk_not_allowed',
      `${definition.label} works on one item at a time. Bulk actions stay off by default.`
    );
  }

  if (request.itemIds.length === 0) {
    throw new ActionRefused(
      request.kind,
      'not_approved',
      `${definition.label} needs at least one item.`
    );
  }

  // 4. The capability, which is the provider-level lock.
  if (definition.capability && !isAllowed(definition.capability, request.grants)) {
    throw new ActionRefused(
      request.kind,
      'capability_not_granted',
      `${definition.label} needs the "${definition.capability}" capability, which is not turned on for this account.`
    );
  }

  // 5. The approval, for exactly this payload.
  const fingerprint = payloadFingerprint(request.itemIds);
  const status = statusForAction(request.kind, fingerprint, request.approvals);
  if (status.state !== 'approved') {
    throw new ActionRefused(
      request.kind,
      status.state === 'expired' ? 'approval_expired' : 'not_approved',
      status.message
    );
  }

  // 6. The account boundary. An approval granted on one account never
  //    authorises an action on another.
  if (status.approval && status.approval.accountId !== request.accountId) {
    throw new ActionRefused(
      request.kind,
      'account_mismatch',
      'The approval was given on a different account. Approve it again on this one.'
    );
  }

  return {
    kind: request.kind,
    wouldDo: definition.touchesOutside,
    wouldNotDo:
      'Nothing is sent, nothing is deleted, nothing is archived and no read state is changed.',
    itemIds: request.itemIds,
    accountId: request.accountId,
    fingerprint,
    approvalRequired: true,
  };
}

/**
 * The claim the interface makes, in one place so it can be tested.
 *
 * A sentence like this is worth asserting rather than writing, because it is
 * the sentence a person will quote back if it is ever untrue.
 */
export const APPROVAL_GUARANTEE = {
  statement:
    'No action outside Concludo happens without your approval of that exact action, every time. Sending, deletion and archiving are not available in this release at all.',
  provenBy: [
    'Every external action is declared in approvals.ts and routed through planAction.',
    'planAction refuses a disabled release before it reads any approval.',
    'The capability behind each disabled action is denied and ungrantable in providers/capabilities.ts.',
    'The read-only provider interface has no send, delete, archive or label method to call.',
    'An approval matches one payload fingerprint, so an edit invalidates it.',
  ],
} as const;

export { fingerprintOf, createApproval };
