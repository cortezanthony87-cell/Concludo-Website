/**
 * Draft review, approval and invalidation.
 *
 * This file carries the single most consequential rule in the module:
 *
 *   An approval is valid only for the exact thing that was reviewed.
 *
 * Not "the draft for this thread". The exact account, sender, recipients,
 * subject, body and attachments that were on screen when the person pressed
 * approve. Change any one of them and the approval is gone, with a status that
 * says so in plain words.
 *
 * The rule is enforced by comparing a FINGERPRINT taken at approval time
 * against a fingerprint of the current draft. Nothing else decides. There is no
 * code path that marks a draft approved without recording what was approved,
 * because `ApprovalRecord` cannot be constructed without the fingerprint.
 *
 * Nothing in this file sends an email. There is no send function, no transport,
 * and no API call. Approval means a person has agreed the text may be SAVED to
 * a mailbox as a draft, which is itself not built yet.
 */
import { DraftStyle, FactToVerify, SourceRef } from './model';

/* ------------------------------------------------------------ fingerprint */

export interface DraftRecipient {
  address: string;
  displayName: string;
  field: 'to' | 'cc' | 'bcc';
}

/**
 * Everything an approval is "for". Exactly the six things the brief lists.
 */
export interface DraftFingerprintInput {
  accountId: string;
  fromAddress: string;
  recipients: readonly DraftRecipient[];
  subject: string;
  body: string;
  /** Attachment identifiers, in whatever order. */
  attachmentIds: readonly string[];
}

/**
 * A stable, order-independent fingerprint.
 *
 * Recipients and attachments are sorted before hashing, so reordering the To
 * line does not invalidate an approval while adding to it does. Subject and
 * body are compared with their leading and trailing whitespace trimmed and
 * nothing else normalised: a change in the middle of a sentence is a change,
 * and so is a changed number.
 *
 * This is a content fingerprint, not a security hash. It exists to detect
 * honest edits between review and save, not to resist an attacker, and it is
 * never used as a credential.
 */
export function fingerprintOf(input: DraftFingerprintInput): string {
  const recipients = input.recipients
    .map((r) => `${r.field}:${r.address.trim().toLowerCase()}`)
    .sort()
    .join(',');
  const attachments = input.attachmentIds.map((a) => a.trim()).sort().join(',');

  const parts = [
    `account=${input.accountId}`,
    `from=${input.fromAddress.trim().toLowerCase()}`,
    `recipients=${recipients}`,
    `subject=${input.subject.trim()}`,
    `attachments=${attachments}`,
    `body=${input.body.trim()}`,
  ].join('\n');

  return `fp-${djb2(parts)}-${parts.length}`;
}

/** A small, fast, dependency-free string hash. Not cryptographic. */
function djb2(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/* -------------------------------------------------------------- approval */

export type ApprovalState = 'none' | 'approved' | 'expired';

export interface ApprovalRecord {
  id: string;
  threadId: string;
  /** What was approved. Taken at the moment of approval and never updated. */
  fingerprint: string;
  /** A readable copy of what was approved, for the audit trail and the UI. */
  approvedSnapshot: DraftFingerprintInput;
  approvedAt: string;
  approvedBy: string;
  /**
   * Always `write_draft_to_mailbox`. There is no approval kind that authorises
   * sending, because sending is not modelled anywhere in this product.
   */
  authorises: 'write_draft_to_mailbox';
}

/** What the six fields can differ by. Used to say exactly what changed. */
export type ApprovalDiffField =
  | 'account'
  | 'sender'
  | 'recipients'
  | 'subject'
  | 'body'
  | 'attachments';

export const APPROVAL_FIELD_LABEL: Readonly<Record<ApprovalDiffField, string>> = {
  account: 'the sending account',
  sender: 'the from address',
  recipients: 'the recipients',
  subject: 'the subject',
  body: 'the message body',
  attachments: 'the attachments',
};

export interface ApprovalStatus {
  state: ApprovalState;
  /** The fields that differ from what was approved. Empty unless expired. */
  changed: ApprovalDiffField[];
  /** One sentence, written for the person about to save the draft. */
  message: string;
  record: ApprovalRecord | null;
}

/**
 * Compares the current draft against what was approved.
 *
 * The comparison is per field rather than on the fingerprint alone, so the
 * status can name what changed. A bare "approval expired" leaves a person
 * hunting for the difference, and a person hunting for a difference is a person
 * who will eventually stop reading the warning.
 */
export function approvalStatus(
  current: DraftFingerprintInput,
  record: ApprovalRecord | null
): ApprovalStatus {
  if (!record) {
    return {
      state: 'none',
      changed: [],
      message: 'Not approved. Nothing is saved to a mailbox without your approval of this exact text.',
      record: null,
    };
  }

  const changed = changedFields(record.approvedSnapshot, current);

  if (changed.length === 0) {
    return {
      state: 'approved',
      changed: [],
      message:
        'Approved for saving as a draft. Nothing has been sent, and nothing has been written to a mailbox.',
      record,
    };
  }

  // Deliberately not an em dash. The brief's example wording uses one; the
  // Concludo style rule does not allow them, and the brief says "a clear status
  // such as", so the sentence is kept and the punctuation is corrected.
  const list = changed.map((f) => APPROVAL_FIELD_LABEL[f]).join(', ');
  return {
    state: 'expired',
    changed,
    message: `Approval expired. The draft changed after review: ${list}. Review it again before approving.`,
    record,
  };
}

export function changedFields(
  approved: DraftFingerprintInput,
  current: DraftFingerprintInput
): ApprovalDiffField[] {
  const out: ApprovalDiffField[] = [];

  if (approved.accountId !== current.accountId) out.push('account');
  if (approved.fromAddress.trim().toLowerCase() !== current.fromAddress.trim().toLowerCase()) {
    out.push('sender');
  }
  if (recipientKey(approved.recipients) !== recipientKey(current.recipients)) out.push('recipients');
  if (approved.subject.trim() !== current.subject.trim()) out.push('subject');
  if (approved.body.trim() !== current.body.trim()) out.push('body');
  if (attachmentKey(approved.attachmentIds) !== attachmentKey(current.attachmentIds)) {
    out.push('attachments');
  }

  return out;
}

function recipientKey(recipients: readonly DraftRecipient[]): string {
  return recipients
    .map((r) => `${r.field}:${r.address.trim().toLowerCase()}`)
    .sort()
    .join(',');
}

function attachmentKey(ids: readonly string[]): string {
  return ids.map((i) => i.trim()).sort().join(',');
}

export function createApproval(
  threadId: string,
  current: DraftFingerprintInput,
  approvedBy: string,
  at: string
): ApprovalRecord {
  return {
    id: `apr-${threadId}-${djb2(at + current.body)}`,
    threadId,
    fingerprint: fingerprintOf(current),
    // A deep copy. If the snapshot shared a reference with the live draft, a
    // later edit would quietly rewrite the thing that was approved, and the
    // comparison would always pass. That is the one bug this whole mechanism
    // exists to prevent.
    approvedSnapshot: {
      accountId: current.accountId,
      fromAddress: current.fromAddress,
      recipients: current.recipients.map((r) => ({ ...r })),
      subject: current.subject,
      body: current.body,
      attachmentIds: [...current.attachmentIds],
    },
    approvedAt: at,
    approvedBy,
    authorises: 'write_draft_to_mailbox',
  };
}

/* ------------------------------------------- dates and amounts in a draft */

/**
 * Every date and money figure in the draft text.
 *
 * Shown to the person before they approve, because these are the parts of a
 * reply that are expensive to get wrong and easy to skim past. A draft that
 * promises Thursday when you meant Tuesday reads perfectly well.
 *
 * The matching is deliberately broad and the result is labelled as "found in
 * the text", not as a commitment the module has verified. It is a reading aid.
 */
export interface DraftFigure {
  kind: 'date' | 'time' | 'amount';
  text: string;
  /** Character offset into the body, for highlighting. */
  index: number;
}

const DAY_NAMES =
  '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)';
const MONTH_NAMES =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';

const PATTERNS: readonly { kind: DraftFigure['kind']; re: RegExp }[] = [
  // AU$1,234.56 and $1,234
  { kind: 'amount', re: /(?:AU\$|A\$|\$)\s?\d[\d,]*(?:\.\d{2})?/g },
  // 1,234 dollars
  { kind: 'amount', re: /\b\d[\d,]*(?:\.\d{2})?\s?(?:dollars|AUD)\b/gi },
  // 9:30, 9:30am, 5pm
  { kind: 'time', re: /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi },
  { kind: 'time', re: /\b\d{1,2}:\d{2}\b/g },
  // 13 October, 13 Oct 2026
  { kind: 'date', re: new RegExp(`\\b\\d{1,2}\\s${MONTH_NAMES}\\b(?:\\s\\d{4})?`, 'gi') },
  // October 13
  { kind: 'date', re: new RegExp(`\\b${MONTH_NAMES}\\s\\d{1,2}\\b(?:,?\\s\\d{4})?`, 'gi') },
  // 13/10/2026
  { kind: 'date', re: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g },
  // Thursday, next Tuesday
  { kind: 'date', re: new RegExp(`\\b(?:next\\s|this\\s|last\\s)?${DAY_NAMES}\\b`, 'gi') },
  // today, tomorrow, tonight
  { kind: 'date', re: /\b(?:today|tomorrow|tonight|yesterday)\b/gi },
];

export function figuresInDraft(body: string): DraftFigure[] {
  const found: DraftFigure[] = [];

  for (const { kind, re } of PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      found.push({ kind, text: match[0], index: match.index });
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    }
  }

  // Overlapping matches are collapsed, keeping the longest. "9:30 am" should
  // not also report "9:30", and "13 October 2026" should not also report "13
  // October".
  found.sort((a, b) => (a.index === b.index ? b.text.length - a.text.length : a.index - b.index));

  const kept: DraftFigure[] = [];
  for (const figure of found) {
    const overlaps = kept.some(
      (k) => figure.index < k.index + k.text.length && k.index < figure.index + figure.text.length
    );
    if (!overlaps) kept.push(figure);
  }

  return kept;
}

/* ------------------------------------------------- the review panel shape */

export type DraftAction =
  | 'edit'
  | 'regenerate_style'
  | 'save_proposed'
  | 'request_clarification'
  | 'discard'
  | 'approve';

export interface DraftActionDefinition {
  kind: DraftAction;
  label: string;
  iconName: string;
  /** What it does, in plain words. Used as the accessible description. */
  effect: string;
  /** True where the action is the one that changes approval state. */
  affectsApproval: boolean;
}

export const DRAFT_ACTIONS: readonly DraftActionDefinition[] = [
  {
    kind: 'edit',
    label: 'Edit draft',
    iconName: 'PenLine',
    effect:
      'Opens the subject, recipients and body for editing. Any edit invalidates an approval already given.',
    affectsApproval: true,
  },
  {
    kind: 'regenerate_style',
    label: 'Regenerate style',
    iconName: 'RefreshCw',
    effect:
      'Replaces the body with another written style. This is a change to the body, so it invalidates an approval already given.',
    affectsApproval: true,
  },
  {
    kind: 'save_proposed',
    label: 'Save as proposed draft',
    iconName: 'Save',
    effect:
      'Keeps this version for the rest of this visit. Nothing is written to a mailbox and nothing is sent.',
    affectsApproval: false,
  },
  {
    kind: 'request_clarification',
    label: 'Request clarification',
    iconName: 'CircleHelp',
    effect:
      'Marks the draft as needing information before it can be used, and records what is missing. Clears any approval.',
    affectsApproval: true,
  },
  {
    kind: 'discard',
    label: 'Discard draft',
    iconName: 'Trash2',
    effect:
      'Removes this draft for the rest of this visit. Nothing in a mailbox is touched, because nothing was ever written there.',
    affectsApproval: true,
  },
  {
    kind: 'approve',
    label: 'Approve for saving',
    iconName: 'ShieldCheck',
    effect:
      'Records that you approve this exact account, sender, recipients, subject, body and attachments to be saved as a draft. It does not send the email and it does not write anything yet.',
    affectsApproval: true,
  },
];

/* ----------------------------------------------------- safety statements */

/**
 * The five things the interface must never imply, each with the wording used
 * wherever that situation arises. Exported so the tests can assert that the
 * exact phrases are on screen rather than something approximate.
 */
export const SAFETY_STATEMENTS = {
  unknownFact: 'Not confirmed. Check this before relying on it.',
  inferredDate: 'Suggested date, confirm',
  attachmentNotReviewed: 'Attached, contents not read by Concludo.',
  recommendedNotDone: 'Recommended. Nothing has been done for you.',
  savedNotSent: 'Saved for review only. Nothing has been sent.',
  approvedNotSent: 'Approved for saving as a draft. Nothing has been sent.',
  withheld: 'Draft withheld pending clarification.',
} as const;

export interface DraftSourceReference {
  label: string;
  source: SourceRef;
}

/** Facts in the draft that the person should check. Carried through unchanged. */
export type DraftFactToVerify = FactToVerify;

export const DRAFT_STYLES: readonly DraftStyle[] = ['concise', 'warm', 'detailed'];
