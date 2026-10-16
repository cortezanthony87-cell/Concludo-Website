/**
 * Email Command Centre, Stage 3 domain model.
 *
 * The unit of work is the THREAD, not the message. A person does not owe a
 * reply to a message; they owe it to a conversation. Every count, queue and
 * recommendation in this module is computed per thread.
 *
 * Two rules are enforced by the types themselves rather than left to a
 * convention someone has to remember:
 *
 *   1. SOURCE TRACEABILITY. Every extracted fact, action, deadline, decision,
 *      commitment, question and risk carries a `source` naming the message it
 *      came from. The `Traceable` interface makes that field mandatory, so an
 *      untraceable extraction will not compile.
 *
 *   2. STATED IS NOT INFERRED. Anything derived carries `basis`, which is
 *      'stated', 'inferred' or 'calculated'. An inferred date is never typed
 *      the same way as a date the sender actually wrote, so the interface
 *      cannot present one as the other by accident.
 *
 * Concludo proposes; a person disposes. Nothing in this model represents a send,
 * a delete, a file or an archive, because the module performs none of them.
 */

/* ------------------------------------------------------------------ basics */

/** ISO-8601 with an offset, for example 2026-10-12T07:42:00+11:00. */
export type IsoDateTime = string;

/** Where a piece of information came from. */
export type EvidenceBasis =
  /** The sender wrote it. Quote it and attribute it. */
  | 'stated'
  /** Read between the lines. Must be labelled wherever it is shown. */
  | 'inferred'
  /** Worked out from stated values. Show the working. */
  | 'calculated';

/** How much weight to put on an extraction. */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * A pointer back to the message an extraction came from.
 *
 * `quote` is optional because a calculated value may have no single sentence
 * behind it, but `messageId` never is. A claim with no message behind it does
 * not belong in this model.
 */
export interface SourceRef {
  messageId: string;
  threadId: string;
  /** The sentence or phrase the extraction rests on. Verbatim. */
  quote?: string;
  /** Character offset into the message body, where known. */
  offset?: number;
}

/** Everything extracted from a conversation implements this. */
export interface Traceable {
  /** At least one. The first is the primary source. */
  source: SourceRef[];
  basis: EvidenceBasis;
  confidence: Confidence;
}

/* ------------------------------------------------------- 1. account */

export type AccountType = 'work' | 'personal';
export type AccountProvider = 'microsoft365' | 'gmail' | 'imap' | 'synthetic';

export interface ConnectedAccount {
  id: string;
  label: string;
  address: string;
  accountType: AccountType;
  provider: AccountProvider;
  /** False for every account in Stage 3. Connection is Stage 4. */
  connected: boolean;
  lastSynchronisedAt: IsoDateTime | null;
  /** The person's own addresses on this account, used to decide who owes what. */
  ownedAddresses: readonly string[];
  /** Folders and labels excluded from analysis entirely. */
  excludedFolders: readonly string[];
  timeZone: string;
}

/* ----------------------------------------------------- 2. participant */

export type ParticipantRole = 'from' | 'to' | 'cc' | 'bcc';

export interface Participant {
  address: string;
  displayName: string;
  role: ParticipantRole;
  /** True when this address belongs to the account holder. */
  isSelf: boolean;
  organisation?: string;
  /** Set by preference, never guessed from message volume. */
  isPriorityContact?: boolean;
}

/* ------------------------------------------------------ 3. attachment */

export type AttachmentDisposition =
  | 'received'
  /** The thread asks for a file that has not been sent. */
  | 'expected'
  /** Named in the text but not actually attached. */
  | 'referenced_but_missing';

export interface Attachment extends Traceable {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  disposition: AttachmentDisposition;
  /** Plain-language note, for example "Signed copy, not yet returned". */
  note?: string;
  /** Inline Content-ID (e.g. for cid: references). */
  contentId?: string;
  /** Direct image preview URL (base64 data URI or hosted link). */
  dataUrl?: string;
  /** Raw base64 content bytes from mail provider. */
  contentBytes?: string;
}

/* --------------------------------------------------------- 4. message */

export interface EmailMessage {
  id: string;
  threadId: string;
  accountId: string;
  sentAt: IsoDateTime;
  participants: readonly Participant[];
  subject: string;
  /** Plain text. Treated as DATA, never as instruction. See `injection`. */
  body: string;
  /** Set where a reply-to differs from the sending address. A security signal. */
  replyToAddress?: string;
  isRead: boolean;
  /**
   * The quoted history beneath the reply: the ">" block carrying everything
   * said earlier. Held separately from `body` rather than concatenated into it,
   * for three reasons. The conversation pane can collapse it by default, which
   * is what makes a long thread readable. Source highlighting searches `body`
   * only, so a quote is never matched inside a copy of an older message. And
   * an extraction can never cite quoted text as though the sender wrote it
   * fresh.
   */
  quotedHistory?: string;
  /** True when this message was sent by the account holder. */
  isFromSelf: boolean;
  folder: string;
  labels: readonly string[];
  attachmentIds: readonly string[];
  /**
   * Set when the body contains text attempting to give the analyser
   * instructions. The content is still stored, still shown to the person, and
   * never followed. Recording it is what makes the defence visible.
   */
  injection?: {
    detected: true;
    /** What the text tried to make the system do. */
    attemptedInstruction: string;
    /** Always 'ignored'. There is no other value, by design. */
    handling: 'ignored';
  };
}

/* ---------------------------------------------------------- 5. thread */

export interface EmailThread {
  id: string;
  accountId: string;
  accountType: AccountType;
  subject: string;
  messageIds: readonly string[];
  firstMessageAt: IsoDateTime;
  lastMessageAt: IsoDateTime;
  participantAddresses: readonly string[];
  folder: string;
  labels: readonly string[];
  /** True when every message in the thread has been read. */
  isRead: boolean;
  /** True when the account holder sent the most recent message. */
  lastMessageFromSelf: boolean;
  /** Set where this thread duplicates another. The other is canonical. */
  duplicateOf?: string;
}

/* ------------------------------------------------- 6. classification */

export type ThreadCategory =
  | 'customer_issue'
  | 'meeting'
  | 'request'
  | 'invoice_or_payment'
  | 'notification'
  | 'newsletter'
  | 'delivery'
  | 'employment'
  | 'personal'
  | 'acknowledgement'
  | 'security'
  | 'other';

export type ThreadSensitivity =
  /** Ordinary business correspondence. */
  | 'standard'
  /** Employment, health, legal, complaint or financial hardship content.
   *  Never auto-drafted and never summarised in a shared view. */
  | 'sensitive';

export interface Classification extends Traceable {
  category: ThreadCategory;
  sensitivity: ThreadSensitivity;
  /** Secondary labels, for example 'duplicate', 'bulk', 'automated'. */
  tags: readonly string[];
  /** True for marketing, system and no-reply mail. Keeps noise out of queues. */
  isBulk: boolean;
}

/* ------------------------------------------------------- 7. priority */

/**
 * The eleven weighted factors, version 2.
 *
 * MIGRATED IN STAGE 6. The module previously used ten factors. The Stage 6
 * specification sets out eleven, and they are better in three specific ways,
 * which is why the change was made rather than argued against:
 *
 *   - `work_blocked` separates "this matters" from "someone else cannot move
 *     until you answer". The old model had no way to express the second, and it
 *     is often the real reason a thread is urgent.
 *   - `unresolved_age` gives weight to a thread that has simply sat. Nothing in
 *     the old model noticed a conversation quietly ageing.
 *   - `confidence_adjustment` lets a thread the module understands poorly score
 *     LOWER rather than the same. A confident wrong answer and an unconfident
 *     one were previously indistinguishable in the ranking.
 *
 * Three old factors were merged rather than dropped. `risk` and `financial`
 * became one `sensitivity` factor, because in practice they fired together and
 * double-counted the same thread. `decision` merged into `explicit_request`,
 * since the specification treats a decision request as a kind of request.
 *
 * The weights sum to exactly 1.00, and a test asserts it.
 */
export type PriorityFactorKey =
  | 'deadline_proximity'
  | 'consequence_of_delay'
  | 'explicit_request'
  | 'work_blocked'
  | 'sensitivity'
  | 'prior_commitment'
  | 'unanswered_follow_ups'
  | 'relationship_impact'
  | 'unresolved_age'
  | 'ease_of_resolution'
  | 'confidence_adjustment';

export const PRIORITY_WEIGHTS: Readonly<Record<PriorityFactorKey, number>> = {
  deadline_proximity: 0.2,
  consequence_of_delay: 0.18,
  explicit_request: 0.12,
  work_blocked: 0.1,
  sensitivity: 0.1,
  prior_commitment: 0.08,
  unanswered_follow_ups: 0.07,
  relationship_impact: 0.05,
  unresolved_age: 0.05,
  ease_of_resolution: 0.03,
  confidence_adjustment: 0.02,
};

/** Human labels, used by the explanation panel and the tests. */
export const PRIORITY_FACTOR_LABEL: Readonly<Record<PriorityFactorKey, string>> = {
  deadline_proximity: 'Deadline proximity',
  consequence_of_delay: 'Consequence of delay',
  explicit_request: 'Explicit reply or decision request',
  work_blocked: 'Other work blocked',
  sensitivity: 'Financial, legal, privacy, security or compliance sensitivity',
  prior_commitment: 'Prior commitment by you',
  unanswered_follow_ups: 'Unanswered follow-ups',
  relationship_impact: 'Customer or relationship impact',
  unresolved_age: 'Unresolved age',
  ease_of_resolution: 'Ease of resolution',
  confidence_adjustment: 'Confidence adjustment',
};

export type PriorityBand = 'immediate' | 'today' | 'soon' | 'batch' | 'low';

export interface PriorityFactor {
  key: PriorityFactorKey;
  /** 0 to 10. */
  value: number;
  /** Why this factor scored what it did, in plain words. */
  reason: string;
}

export interface Priority {
  /** 0 to 100, rounded. The weighted sum of the ten factors, times ten. */
  score: number;
  band: PriorityBand;
  factors: readonly PriorityFactor[];
  /**
   * Two or three short lines naming a CONSEQUENCE, shown under the thread.
   * "Their site team books trades off your answer", not "contains the word
   * urgent".
   */
  reasons: readonly string[];
  confidence: Confidence;
}

/* --------------------------------------------- 8. status and extractions */

export type ThreadStatus =
  | 'waiting_on_user'
  | 'waiting_on_other'
  | 'decision_required'
  | 'action_required'
  | 'information_only'
  | 'resolved'
  | 'security_review'
  | 'unclear';

export interface Action extends Traceable {
  id: string;
  description: string;
  /** The address that owes it, or 'self'. */
  owner: string;
  ownerIsSelf: boolean;
  /** Null when the thread states no date. */
  dueAt: IsoDateTime | null;
  /** Minutes. Used by Quick Wins, which is under two minutes. */
  estimatedMinutes: number | null;
  status: 'open' | 'done' | 'blocked';
  /** What is blocking it, for example "needs the signed variation". */
  blockedBy?: string;
}

export interface Deadline extends Traceable {
  id: string;
  description: string;
  dueAt: IsoDateTime;
  /**
   * 'stated' means the sender wrote the date. 'inferred' means the module
   * worked it out, for example from "end of next week". The interface must
   * label inferred dates wherever they appear.
   */
  basis: EvidenceBasis;
  /** What happens if the date passes. Blank is not acceptable. */
  consequence: string;
  ownerIsSelf: boolean;
}

export interface Decision extends Traceable {
  id: string;
  description: string;
  /** Set for a decision already made. */
  decidedAt?: IsoDateTime;
  decidedBy?: string;
  /** Set for a decision still required. */
  options?: readonly string[];
  requiredBy?: IsoDateTime | null;
  blocks?: string;
}

export interface Commitment extends Traceable {
  id: string;
  description: string;
  /** Who promised. */
  promisedBy: string;
  promisedByIsSelf: boolean;
  promisedAt: IsoDateTime;
  dueAt: IsoDateTime | null;
  status: 'outstanding' | 'met' | 'overdue' | 'unclear';
}

export interface OpenQuestion extends Traceable {
  id: string;
  question: string;
  askedBy: string;
  askedByIsSelf: boolean;
  askedAt: IsoDateTime;
  answered: boolean;
  /** Set where answering needs something the person does not have yet. */
  blockedBy?: string;
}

export type RiskKind =
  | 'financial'
  | 'legal'
  | 'relationship'
  | 'operational'
  | 'security'
  | 'reputational';

export interface Risk extends Traceable {
  id: string;
  kind: RiskKind;
  description: string;
  severity: 'high' | 'medium' | 'low';
  /** What would reduce it. Advisory. */
  suggestedMitigation?: string;
}

/** Two statements in the thread that cannot both be true. */
export interface Conflict extends Traceable {
  id: string;
  description: string;
  /** The competing statements, each with its own source. */
  positions: readonly { statement: string; source: SourceRef }[];
}

/** A claim the person should check before relying on it. */
export interface FactToVerify extends Traceable {
  id: string;
  claim: string;
  /** How to check it, for example "ring the number on the last invoice". */
  howToVerify: string;
}

/* ------------------------------------------------ 9. security alert */

/**
 * The detector's output.
 *
 * Extended in Stage 4 so that every warning category the Security Review view
 * has to show has a flag behind it. The alternative was a presentation layer
 * that invented categories the detector never produced, which would have meant
 * the screen and the data disagreeing about what was found.
 */
export type SecurityFlag =
  | 'unexpected_payment'
  | 'payment_details_changed'
  | 'credential_request'
  | 'lookalike_domain'
  | 'urgency_pressure'
  | 'unexpected_attachment'
  | 'prompt_injection'
  | 'reply_to_mismatch'
  | 'sensitive_data_request'
  | 'unverified_sender';

export interface SecurityAlert extends Traceable {
  id: string;
  threadId: string;
  flags: readonly SecurityFlag[];
  severity: 'high' | 'medium' | 'low';
  /** Plain language, written for a person who is about to pay an invoice. */
  explanation: string;
  recommendedCheck: string;
  /**
   * Always advisory. The module never blocks, quarantines or deletes, so this
   * is the only value.
   */
  disposition: 'advisory';
}

/* ------------------------------------------------- 10. reply draft */

export type DraftStatus =
  /** A draft can be written and is ready for review. */
  | 'available'
  /** Something is missing. The module asks rather than inventing it. */
  | 'clarification_required'
  /** Deliberately not drafted: sensitive, security-flagged, or a legal matter. */
  | 'withheld_for_safety';

/**
 * The three draft styles the brief asks for.
 *
 * They are three written drafts, not one draft run through a tone setting. A
 * tone slider applied to generated text changes the adjectives and leaves the
 * commitments alone, which is the part that matters when a person is about to
 * send something.
 */
export type DraftStyle = 'concise' | 'warm' | 'detailed';

export const DRAFT_STYLE_LABEL: Readonly<Record<DraftStyle, string>> = {
  concise: 'Concise',
  warm: 'Warm and professional',
  detailed: 'Detailed',
};

export interface ReplyDraft {
  id: string;
  threadId: string;
  status: DraftStatus;
  /** Null unless status is 'available'. The currently selected style's text. */
  body: string | null;
  /** All three styles. Null unless status is 'available'. */
  variants: Readonly<Record<DraftStyle, string>> | null;
  /**
   * Anything the draft text commits you to, pulled out so it is read before
   * the draft is approved rather than after it is sent.
   */
  commitmentsInDraft: readonly string[];
  /** Who the reply would go to, if it were ever sent. It is not. */
  recipients: readonly { address: string; displayName: string; role: 'to' | 'cc' }[];
  /** Why a draft was withheld or what is needed. Always set when body is null. */
  statusReason: string | null;
  /** Facts in the draft the person should confirm before sending. */
  factsToVerify: readonly FactToVerify[];
  /** What the module needs in order to draft. Set for clarification_required. */
  missingInformation: readonly string[];
  createdAt: IsoDateTime;
  /**
   * A draft is written nowhere until a person approves this exact text. No
   * value of this field permits sending; sending is not implemented at all.
   */
  approval: ApprovalRequest | null;
}

/* --------------------------------------------- 11. approval request */

export interface ApprovalRequest {
  id: string;
  /** What is being asked for. Writing a draft to the mailbox is the only one. */
  kind: 'write_draft_to_mailbox';
  threadId: string;
  /** The exact text the person is approving. Changing it voids the approval. */
  contentHash: string;
  requestedAt: IsoDateTime;
  state: 'pending' | 'approved' | 'declined' | 'expired';
  decidedAt: IsoDateTime | null;
  decidedBy: string | null;
}

/* -------------------------------------------------- 12. saved view */

export type SavedViewKey =
  | 'morning_review'
  | 'handle_today'
  | 'quick_replies'
  | 'waiting_this_week'
  | 'needs_a_decision'
  | 'needs_an_attachment'
  | 'security_review'
  | 'unprocessed';

export interface SavedView {
  key: SavedViewKey;
  label: string;
  description: string;
  /** The filter this view applies. */
  filter: ThreadFilter;
  /** How the results are ordered. */
  sort: 'priority_desc' | 'deadline_asc' | 'waiting_longest' | 'effort_asc';
}

/* --------------------------------------------- 13. user preference */

export interface UserPreference {
  accountId: string;
  workingHours: { start: string; end: string; days: readonly number[] };
  timeZone: string;
  replyTone: 'plain' | 'warm' | 'formal';
  signOff: string;
  priorityContacts: readonly string[];
  priorityDomains: readonly string[];
  /** Topics that always escalate regardless of score. */
  alwaysEscalate: readonly string[];
  excludedSenders: readonly string[];
  excludedFolders: readonly string[];
  /** Off by default. Turning it on still requires per-draft approval. */
  mayWriteDraftsToMailbox: boolean;
  /** Days. After this, analysis is deleted. */
  analysisRetentionDays: number;
}

/* ------------------------------------------------- 14. audit event */

export type AuditEventKind =
  | 'thread_analysed'
  | 'analysis_superseded'
  | 'draft_generated'
  | 'draft_withheld'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_declined'
  | 'draft_written_to_mailbox'
  | 'security_alert_raised'
  | 'user_correction_recorded'
  | 'view_exported';

export interface AuditEvent {
  id: string;
  at: IsoDateTime;
  kind: AuditEventKind;
  accountId: string;
  threadId: string | null;
  /** The person or the system. Never blank. */
  actor: string;
  /** One line, in plain words, that would make sense to an auditor. */
  description: string;
  analysisVersionId?: string;
}

/* ------------------------------------------ 15. AI analysis version */

export interface AnalysisVersion {
  id: string;
  threadId: string;
  /** Monotonic per thread, starting at 1. */
  version: number;
  analysedAt: IsoDateTime;
  /** Which model and prompt produced it, so a bad run can be identified. */
  engine: { name: string; version: string; promptVersion: string };
  /** Set when a later version replaced this one. */
  supersededAt: IsoDateTime | null;
  supersededBy: string | null;
  /** Number of messages in the thread at the time of analysis. */
  messageCountAtAnalysis: number;
}

/* -------------------------------------------- 16. user correction */

export interface UserCorrection {
  id: string;
  threadId: string;
  analysisVersionId: string;
  /** What the person changed. */
  field:
    | 'priority_band'
    | 'status'
    | 'deadline'
    | 'reply_required'
    | 'classification'
    | 'security_flag'
    | 'owner';
  wasValue: string;
  nowValue: string;
  /** Optional note. Feeds future tuning; never used to auto-change behaviour. */
  note?: string;
  correctedAt: IsoDateTime;
  correctedBy: string;
}

/* ------------------------------------------------ 17. thread analysis */

/**
 * The analysis contract, matching the Stage 3 brief field for field.
 *
 * The brief's loose arrays are typed here. `explicitDeadlines` holds only
 * deadlines whose basis is 'stated'; `suggestedDates` holds only those whose
 * basis is 'inferred' or 'calculated'. Splitting them at the type level is what
 * makes "never display inferred information as explicit information" something
 * the compiler helps with rather than something a reviewer has to catch.
 */
export interface ThreadAnalysis {
  threadId: string;
  accountId: string;
  accountType: AccountType;
  subject: string;
  /** One sentence. What this conversation is. */
  oneLineSummary: string;
  /** One sentence. Why it matters to this person, with the consequence named. */
  whyItMatters: string;
  currentStatus: ThreadStatus;
  /** 0 to 100. */
  priorityScore: number;
  priorityBand: PriorityBand;
  priorityReasons: readonly string[];
  confidence: Confidence;
  replyRequired: boolean;
  /** Why a reply is or is not required. Never blank. */
  replyReason: string;
  /** Dates the sender actually wrote. */
  explicitDeadlines: readonly Deadline[];
  /** Dates the module worked out. Labelled as such wherever shown. */
  suggestedDates: readonly Deadline[];
  actions: readonly Action[];
  decisionsMade: readonly Decision[];
  decisionsRequired: readonly Decision[];
  commitments: readonly Commitment[];
  openQuestions: readonly OpenQuestion[];
  conflicts: readonly Conflict[];
  attachments: readonly Attachment[];
  risks: readonly Risk[];
  /** One sentence. The single next thing to do. */
  recommendedNextStep: string;
  /**
   * What the SENDER is asking for, in their terms. Distinct from
   * `recommendedNextStep`, which is what you should do about it. The Reply
   * Queue shows both, because they are not always the same thing: sometimes
   * what a person is asking for is not what they should get.
   *
   * Absent where nobody is asking for anything.
   */
  senderRequest?: string;
  draftStatus: DraftStatus;
  factsToVerify: readonly FactToVerify[];
  recommendedFollowUpDate: IsoDateTime | null;

  /* Fields beyond the brief's shape, needed to drive the dashboard. */

  classification: Classification;
  priority: Priority;
  securityAlert: SecurityAlert | null;
  /** False until the thread has been analysed. Drives the Unprocessed count. */
  analysed: boolean;
  analysisVersionId: string | null;
  /** Minutes of effort, where it can be estimated. Drives Quick Wins. */
  estimatedEffortMinutes: number | null;
}

/* ------------------------------------------------------------ filters */

/**
 * Every filter dimension in the brief. All fields are optional and all are
 * combined with AND, which is the behaviour a person expects when they tick
 * two boxes.
 */
export interface ThreadFilter {
  accountId?: string;
  accountType?: AccountType;
  /** Matches sender address or display name, case-insensitive, partial. */
  sender?: string;
  dateFrom?: IsoDateTime;
  dateTo?: IsoDateTime;
  priorityBands?: readonly PriorityBand[];
  minPriorityScore?: number;
  statuses?: readonly ThreadStatus[];
  replyRequired?: boolean;
  draftStatuses?: readonly DraftStatus[];
  /** 'any' means a deadline of either kind; 'stated' excludes inferred ones. */
  hasDeadline?: 'any' | 'stated' | 'inferred' | 'none';
  deadlineBefore?: IsoDateTime;
  hasAttachment?: boolean;
  /** True selects threads needing a file before a reply can be sent. */
  awaitingAttachment?: boolean;
  waitingOn?: 'user' | 'other' | 'either';
  securityFlagged?: boolean;
  isRead?: boolean;
  analysed?: boolean;
  /** Excludes bulk mail. Defaults to excluding it in the work queues. */
  includeBulk?: boolean;
  /** Excludes resolved threads. Defaults to excluding them. */
  includeResolved?: boolean;
  /** Excludes duplicates. Defaults to excluding them. */
  includeDuplicates?: boolean;
  /** Free text across subject, summary and sender. */
  search?: string;
}

/* --------------------------------------------------- dashboard shapes */

export type DashboardMetricKey =
  | 'needs_attention'
  | 'replies_due'
  | 'actions_required'
  | 'deadlines'
  | 'waiting_on_others'
  | 'quick_wins'
  | 'security_review'
  | 'unprocessed';

export type QueueKey =
  | 'handle_first'
  | 'todays_workload'
  | 'reply_queue'
  | 'waiting'
  | 'quick_wins';

/**
 * One account's full dataset: the raw material and the analysis over it.
 * Keeping them in one object per account is what makes it structurally
 * impossible to mix a work thread into a personal queue.
 */
export interface AccountDataset {
  account: ConnectedAccount;
  messages: readonly EmailMessage[];
  threads: readonly EmailThread[];
  attachments: readonly Attachment[];
  analyses: readonly ThreadAnalysis[];
  drafts: readonly ReplyDraft[];
  securityAlerts: readonly SecurityAlert[];
  analysisVersions: readonly AnalysisVersion[];
  corrections: readonly UserCorrection[];
  auditEvents: readonly AuditEvent[];
  preference: UserPreference;
}
