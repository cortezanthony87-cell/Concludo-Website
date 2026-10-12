/**
 * Small constructors for the synthetic dataset.
 *
 * These exist so that every extraction in the dataset carries a real source
 * reference without three lines of boilerplate per fact. The point is not
 * brevity for its own sake: when traceability is cheap to write, it gets
 * written, and when it is expensive, it quietly stops happening.
 */
import {
  Attachment,
  Confidence,
  EmailMessage,
  EmailThread,
  EvidenceBasis,
  Participant,
  ReplyDraft,
  SourceRef,
  ThreadAnalysis,
  Traceable,
  Classification,
  Priority,
  SecurityAlert,
  DraftStatus,
  ThreadStatus,
  AccountType,
  DraftStyle,
} from '../model';

/** The traceability fields, in one call. */
export function from(
  threadId: string,
  messageId: string,
  quote: string,
  basis: EvidenceBasis = 'stated',
  confidence: Confidence = 'high'
): Traceable {
  const source: SourceRef[] = [{ threadId, messageId, quote }];
  return { source, basis, confidence };
}

/** Traceability across two messages, for a fact that needs both to make sense. */
export function fromBoth(
  threadId: string,
  a: [string, string],
  b: [string, string],
  basis: EvidenceBasis = 'stated',
  confidence: Confidence = 'high'
): Traceable {
  return {
    source: [
      { threadId, messageId: a[0], quote: a[1] },
      { threadId, messageId: b[0], quote: b[1] },
    ],
    basis,
    confidence,
  };
}

export function person(
  address: string,
  displayName: string,
  role: Participant['role'],
  options: { isSelf?: boolean; organisation?: string; isPriorityContact?: boolean } = {}
): Participant {
  return {
    address,
    displayName,
    role,
    isSelf: options.isSelf ?? false,
    ...(options.organisation ? { organisation: options.organisation } : {}),
    ...(options.isPriorityContact ? { isPriorityContact: true } : {}),
  };
}

export interface MessageSpec {
  id: string;
  sentAt: string;
  participants: Participant[];
  subject: string;
  body: string;
  quotedHistory?: string;
  isFromSelf?: boolean;
  isRead?: boolean;
  replyToAddress?: string;
  attachmentIds?: string[];
  injection?: EmailMessage['injection'];
}

export function message(
  threadId: string,
  accountId: string,
  folder: string,
  labels: readonly string[],
  spec: MessageSpec
): EmailMessage {
  return {
    id: spec.id,
    threadId,
    accountId,
    sentAt: spec.sentAt,
    participants: spec.participants,
    subject: spec.subject,
    body: spec.body,
    isRead: spec.isRead ?? true,
    isFromSelf: spec.isFromSelf ?? false,
    folder,
    labels,
    attachmentIds: spec.attachmentIds ?? [],
    ...(spec.quotedHistory ? { quotedHistory: spec.quotedHistory } : {}),
    ...(spec.replyToAddress ? { replyToAddress: spec.replyToAddress } : {}),
    ...(spec.injection ? { injection: spec.injection } : {}),
  };
}

export interface ThreadSpec {
  id: string;
  accountId: string;
  accountType: AccountType;
  subject: string;
  folder: string;
  labels?: string[];
  isRead?: boolean;
  duplicateOf?: string;
  messages: MessageSpec[];
}

export function thread(spec: ThreadSpec): { thread: EmailThread; messages: EmailMessage[] } {
  const labels = spec.labels ?? [];
  const messages = spec.messages.map((m) =>
    message(spec.id, spec.accountId, spec.folder, labels, m)
  );
  // Sorted by instant, not by text. Two messages in the same thread can carry
  // different offsets across a daylight saving boundary, and this dataset has
  // exactly that: 29 September is +10:00 and 12 October is +11:00.
  const sorted = messages
    .slice()
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  const last = sorted[sorted.length - 1];
  const addresses = new Set<string>();
  for (const m of messages) for (const p of m.participants) addresses.add(p.address);

  return {
    thread: {
      id: spec.id,
      accountId: spec.accountId,
      accountType: spec.accountType,
      subject: spec.subject,
      messageIds: sorted.map((m) => m.id),
      firstMessageAt: sorted[0].sentAt,
      lastMessageAt: last.sentAt,
      participantAddresses: [...addresses],
      folder: spec.folder,
      labels,
      isRead: spec.isRead ?? messages.every((m) => m.isRead),
      lastMessageFromSelf: last.isFromSelf,
      ...(spec.duplicateOf ? { duplicateOf: spec.duplicateOf } : {}),
    },
    messages,
  };
}

export function attachment(
  base: Traceable,
  spec: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number | null;
    disposition: Attachment['disposition'];
    note?: string;
  }
): Attachment {
  return { ...base, ...spec };
}

/** Assembles a ThreadAnalysis, filling the fields that are always the same shape. */
export function analysis(input: {
  threadId: string;
  accountId: string;
  accountType: AccountType;
  subject: string;
  oneLineSummary: string;
  whyItMatters: string;
  currentStatus: ThreadStatus;
  priority: Priority;
  replyRequired: boolean;
  replyReason: string;
  recommendedNextStep: string;
  senderRequest?: string;
  draftStatus: DraftStatus;
  classification: Classification;
  confidence?: Confidence;
  analysed?: boolean;
  analysisVersionId?: string | null;
  estimatedEffortMinutes?: number | null;
  recommendedFollowUpDate?: string | null;
  securityAlert?: SecurityAlert | null;
  explicitDeadlines?: ThreadAnalysis['explicitDeadlines'];
  suggestedDates?: ThreadAnalysis['suggestedDates'];
  actions?: ThreadAnalysis['actions'];
  decisionsMade?: ThreadAnalysis['decisionsMade'];
  decisionsRequired?: ThreadAnalysis['decisionsRequired'];
  commitments?: ThreadAnalysis['commitments'];
  openQuestions?: ThreadAnalysis['openQuestions'];
  conflicts?: ThreadAnalysis['conflicts'];
  attachments?: ThreadAnalysis['attachments'];
  risks?: ThreadAnalysis['risks'];
  factsToVerify?: ThreadAnalysis['factsToVerify'];
}): ThreadAnalysis {
  return {
    threadId: input.threadId,
    accountId: input.accountId,
    accountType: input.accountType,
    subject: input.subject,
    oneLineSummary: input.oneLineSummary,
    whyItMatters: input.whyItMatters,
    currentStatus: input.currentStatus,
    priorityScore: input.priority.score,
    priorityBand: input.priority.band,
    priorityReasons: input.priority.reasons,
    confidence: input.confidence ?? input.priority.confidence,
    replyRequired: input.replyRequired,
    replyReason: input.replyReason,
    explicitDeadlines: input.explicitDeadlines ?? [],
    suggestedDates: input.suggestedDates ?? [],
    actions: input.actions ?? [],
    decisionsMade: input.decisionsMade ?? [],
    decisionsRequired: input.decisionsRequired ?? [],
    commitments: input.commitments ?? [],
    openQuestions: input.openQuestions ?? [],
    conflicts: input.conflicts ?? [],
    attachments: input.attachments ?? [],
    risks: input.risks ?? [],
    recommendedNextStep: input.recommendedNextStep,
    ...(input.senderRequest ? { senderRequest: input.senderRequest } : {}),
    draftStatus: input.draftStatus,
    factsToVerify: input.factsToVerify ?? [],
    recommendedFollowUpDate: input.recommendedFollowUpDate ?? null,
    classification: input.classification,
    priority: input.priority,
    securityAlert: input.securityAlert ?? null,
    analysed: input.analysed ?? true,
    // `??` would turn an explicit null back into a generated id, which is how
    // an unanalysed thread ended up claiming it had been analysed. An explicit
    // null means "no analysis was run" and has to survive.
    analysisVersionId:
      input.analysisVersionId !== undefined ? input.analysisVersionId : `ver-${input.threadId}-1`,
    estimatedEffortMinutes: input.estimatedEffortMinutes ?? null,
  };
}

/**
 * A draft record. `body` and `variants` are only ever set when the status is
 * 'available'; a withheld or blocked draft carries no text at all, so there is
 * nothing for a person to copy out by accident.
 */
export function draft(spec: {
  threadId: string;
  status: DraftStatus;
  variants?: Record<DraftStyle, string>;
  commitmentsInDraft?: string[];
  recipients?: ReplyDraft['recipients'];
  statusReason?: string;
  missingInformation?: string[];
  factsToVerify?: ReplyDraft['factsToVerify'];
  createdAt: string;
}): ReplyDraft {
  const available = spec.status === 'available';
  const variants = available ? (spec.variants ?? null) : null;
  return {
    id: `drf-${spec.threadId}`,
    threadId: spec.threadId,
    status: spec.status,
    body: variants ? variants.concise : null,
    variants,
    commitmentsInDraft: available ? (spec.commitmentsInDraft ?? []) : [],
    recipients: spec.recipients ?? [],
    statusReason: available ? null : (spec.statusReason ?? 'No reason recorded.'),
    factsToVerify: spec.factsToVerify ?? [],
    missingInformation: spec.missingInformation ?? [],
    createdAt: spec.createdAt,
    // No draft is approved. Approval is per draft, per text, by a person, and
    // nothing in Stage 4 can grant it.
    approval: null,
  };
}

/**
 * Whole days between a thread's first message and the demonstration clock.
 *
 * Used to feed the unresolved-age factor, so a thread that has simply sat
 * contributes its own age to its score rather than needing a hand-written
 * number that goes stale the moment the dataset moves.
 */
export function ageInDaysAt(firstMessageAt: string, now: string): number {
  const ms = new Date(now).getTime() - new Date(firstMessageAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** One complete scenario: the raw thread and everything derived from it. */
export interface Scenario {
  thread: EmailThread;
  messages: EmailMessage[];
  attachments: Attachment[];
  analysis: ThreadAnalysis;
  draft: ReplyDraft;
  securityAlert: SecurityAlert | null;
}
