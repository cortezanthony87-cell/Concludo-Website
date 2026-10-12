/**
 * The eight operational views.
 *
 * Every view is a pure function from a set of thread records to the shape its
 * page renders. Keeping the selection here rather than inside the components
 * means the rules can be tested without a browser, and it means a view cannot
 * quietly develop its own idea of what "waiting" means.
 *
 * Nothing in this file performs an action. Concludo proposes; a person
 * disposes.
 */
import {
  DraftStyle,
  ReplyDraft,
  SecurityFlag,
  ThreadFilter,
  AccountDataset,
} from './model';
import { ThreadRecord, applyFilter, recordsFor } from './filters';
import { sortRecords } from './savedViews';
import { metricRecords, queueRecords } from './aggregation';

/* ====================================================== shared helpers */

const DAY = 24 * 3600_000;

/**
 * A DEFECT FOUND IN STAGE 4 TESTING, CORRECTED HERE AND IN filters.ts.
 *
 * ISO timestamps were being compared as STRINGS. That works only while every
 * value carries the same offset, and it silently stops working the moment one
 * side is a `+11:00` literal from the dataset and the other is a `Z` value from
 * `toISOString()`. A deadline of 5pm today compared against a day boundary of
 * `2026-10-12T13:00:00.000Z` sorted as "17" against "13" and landed in
 * Tomorrow.
 *
 * Every date comparison in the views now goes through this. Comparing two
 * instants means comparing two numbers, not two pieces of text that happen to
 * sort correctly most of the time.
 */
export function ms(iso: string): number {
  return new Date(iso).getTime();
}

export function isBefore(a: string, b: string): boolean {
  return ms(a) < ms(b);
}

export function isAtOrAfter(a: string, b: string): boolean {
  return ms(a) >= ms(b);
}

export function startOfDayIso(iso: string, offsetHours = 11): string {
  const shifted = new Date(new Date(iso).getTime() + offsetHours * 3600_000);
  return `${shifted.toISOString().slice(0, 10)}T00:00:00+${String(offsetHours).padStart(2, '0')}:00`;
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString();
}

/** Whole days between two instants, rounded down. Never negative. */
export function ageInDays(from: string, now: string): number {
  return Math.max(0, Math.floor((new Date(now).getTime() - new Date(from).getTime()) / DAY));
}

/* ================================================== 1. Needs Attention */

/**
 * Everything one card has to show. Assembled here so the component renders
 * fields rather than deciding what they mean.
 */
export interface NeedsAttentionItem {
  threadId: string;
  accountId: string;
  accountLabel: string;
  accountType: 'work' | 'personal';
  sender: string;
  senderAddress: string;
  subject: string;
  summary: string;
  whyItMatters: string;
  priorityBand: string;
  priorityScore: number;
  priorityReasons: readonly string[];
  /** Null when the thread carries no date of any kind. */
  deadline: { dueAt: string; basis: 'stated' | 'inferred' | 'calculated'; consequence: string } | null;
  status: string;
  recommendedNextStep: string;
  draftStatus: ReplyDraft['status'];
  draftStatusReason: string | null;
  confidence: 'high' | 'medium' | 'low';
  attachmentCount: number;
  awaitingAttachment: boolean;
  /** Set when the thread is security flagged or classified sensitive. */
  warning: { kind: 'security' | 'sensitive'; text: string } | null;
}

export function needsAttentionItems(
  records: readonly ThreadRecord[],
  accountLabel: string,
  now: string
): NeedsAttentionItem[] {
  return queueRecords(records, 'handle_first', now).map((r) => toNeedsAttentionItem(r, accountLabel));
}

export function toNeedsAttentionItem(r: ThreadRecord, accountLabel: string): NeedsAttentionItem {
  const a = r.analysis;
  const stated = a.explicitDeadlines[0];
  const suggested = a.suggestedDates[0];
  const deadline = stated ?? suggested ?? null;

  return {
    threadId: r.thread.id,
    accountId: r.thread.accountId,
    accountLabel,
    accountType: r.thread.accountType,
    sender: r.counterpartyName,
    senderAddress: r.counterpartyAddress,
    subject: r.thread.subject,
    summary: a.oneLineSummary,
    whyItMatters: a.whyItMatters,
    priorityBand: a.priorityBand,
    priorityScore: a.priorityScore,
    priorityReasons: a.priorityReasons,
    deadline: deadline
      ? { dueAt: deadline.dueAt, basis: deadline.basis, consequence: deadline.consequence }
      : null,
    status: a.currentStatus,
    recommendedNextStep: a.recommendedNextStep,
    draftStatus: a.draftStatus,
    draftStatusReason: null,
    confidence: a.confidence,
    attachmentCount: a.attachments.filter((x) => x.disposition === 'received').length,
    awaitingAttachment: r.awaitingAttachment,
    warning: a.securityAlert
      ? { kind: 'security', text: a.securityAlert.explanation }
      : a.classification.sensitivity === 'sensitive'
        ? {
            kind: 'sensitive',
            text: 'Classified sensitive. Nothing is drafted and nothing here is summarised into a shared view.',
          }
        : null,
  };
}

/* ======================================================= 2. Reply Queue */

export type ReplyFilterKey =
  | 'reply_today'
  | 'quick_reply'
  | 'needs_information'
  | 'needs_decision'
  | 'needs_attachment'
  | 'sensitive'
  | 'draft_ready'
  | 'clarification_required'
  | 'draft_withheld';

export interface ReplyFilterDefinition {
  key: ReplyFilterKey;
  label: string;
  /** One sentence for the control's accessible description. */
  description: string;
  match: (r: ThreadRecord, now: string) => boolean;
}

export const REPLY_FILTERS: readonly ReplyFilterDefinition[] = [
  {
    key: 'reply_today',
    label: 'Reply today',
    description: 'A date falls today, or the thread is in the immediate or today band.',
    match: (r, now) => {
      const band = r.analysis.priorityBand;
      if (band === 'immediate' || band === 'today') return true;
      const d = r.nextStatedDeadline;
      if (d === null) return false;
      return isAtOrAfter(d, startOfDayIso(now)) && isBefore(d, addDaysIso(startOfDayIso(now), 1));
    },
  },
  {
    key: 'quick_reply',
    label: 'Quick reply',
    description: 'Estimated at two minutes or under.',
    match: (r) =>
      r.analysis.estimatedEffortMinutes !== null &&
      r.analysis.estimatedEffortMinutes > 0 &&
      r.analysis.estimatedEffortMinutes <= 2,
  },
  {
    key: 'needs_information',
    label: 'Needs information',
    description: 'A question is open that nothing in the thread answers.',
    match: (r) => r.analysis.openQuestions.some((q) => !q.answered),
  },
  {
    key: 'needs_decision',
    label: 'Needs decision',
    description: 'A choice is blocked on you.',
    match: (r) => r.analysis.decisionsRequired.length > 0 || r.analysis.currentStatus === 'decision_required',
  },
  {
    key: 'needs_attachment',
    label: 'Needs attachment',
    description: 'A file has to be sent before a reply is any use.',
    match: (r) => r.awaitingAttachment,
  },
  {
    key: 'sensitive',
    label: 'Sensitive',
    description: 'Employment, legal, health or hardship content. Never drafted.',
    match: (r) => r.analysis.classification.sensitivity === 'sensitive',
  },
  {
    key: 'draft_ready',
    label: 'Draft ready',
    description: 'A draft is prepared for your review. Nothing is sent from here.',
    match: (r) => r.analysis.draftStatus === 'available',
  },
  {
    key: 'clarification_required',
    label: 'Clarification required',
    description: 'Something is missing, so nothing has been drafted.',
    match: (r) => r.analysis.draftStatus === 'clarification_required',
  },
  {
    key: 'draft_withheld',
    label: 'Draft withheld',
    description: 'Deliberately not drafted: security flagged, sensitive, or already closed.',
    match: (r) => r.analysis.draftStatus === 'withheld_for_safety',
  },
];

export interface ReplyQueueItem {
  record: ThreadRecord;
  /** What the sender is asking for, in their terms. */
  senderRequest: string;
  /** Questions still waiting on an answer. */
  openQuestions: readonly { id: string; question: string; blockedBy?: string }[];
  draft: ReplyDraft | null;
  /** The text for the currently selected style, or null. */
  draftBody: string | null;
  factsToVerify: readonly { id: string; claim: string; howToVerify: string }[];
  commitmentsInDraft: readonly string[];
  missingInformation: readonly string[];
  recipients: readonly { address: string; displayName: string; role: 'to' | 'cc' }[];
  attachmentReminder: string | null;
  confidence: 'high' | 'medium' | 'low';
  sensitive: boolean;
}

export function replyQueueItems(
  records: readonly ThreadRecord[],
  drafts: readonly ReplyDraft[],
  now: string,
  active: readonly ReplyFilterKey[] = [],
  style: DraftStyle = 'concise'
): ReplyQueueItem[] {
  const base = queueRecords(records, 'reply_queue', now);
  // Indexed rather than scanned. This is the same shape of bug the Stage 7
  // load test found in `recordsFor`: a `.find` over the drafts inside a loop
  // over the queue is O(threads x drafts), which is free on twenty-two threads
  // and quadratic on a real mailbox where most threads carry a draft.
  const draftByThread = new Map(drafts.map((d) => [d.threadId, d]));

  // Several filters chosen at once narrow, they do not widen. A person ticking
  // "needs decision" and "draft ready" is asking for the overlap.
  const filtered = base.filter((r) =>
    active.every((key) => {
      const definition = REPLY_FILTERS.find((f) => f.key === key);
      return definition ? definition.match(r, now) : true;
    })
  );

  return filtered.map((r) => {
    const draft = draftByThread.get(r.thread.id) ?? null;
    const available = draft?.status === 'available' && draft.variants !== null;

    return {
      record: r,
      senderRequest: r.analysis.senderRequest ?? 'Not stated plainly in the thread.',
      openQuestions: r.analysis.openQuestions
        .filter((q) => !q.answered)
        .map((q) => ({ id: q.id, question: q.question, blockedBy: q.blockedBy })),
      draft,
      draftBody: available ? (draft!.variants as Record<DraftStyle, string>)[style] : null,
      factsToVerify: (draft?.factsToVerify ?? r.analysis.factsToVerify).map((f) => ({
        id: f.id,
        claim: f.claim,
        howToVerify: f.howToVerify,
      })),
      commitmentsInDraft: draft?.commitmentsInDraft ?? [],
      missingInformation: draft?.missingInformation ?? [],
      recipients: draft?.recipients ?? [],
      attachmentReminder: r.awaitingAttachment
        ? 'This reply needs a file attached before it is any use to them.'
        : null,
      confidence: r.analysis.confidence,
      sensitive: r.analysis.classification.sensitivity === 'sensitive',
    };
  });
}

/* ================================================ 3. Actions & Deadlines */

export type DateOrigin = 'explicit_email' | 'suggested' | 'user_created';

export const DATE_ORIGIN_LABEL: Readonly<Record<DateOrigin, string>> = {
  explicit_email: 'Stated in the email',
  suggested: 'Suggested date, confirm',
  user_created: 'Added by you',
};

export type DeadlineGroupKey = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'undated';

export const DEADLINE_GROUP_LABEL: Readonly<Record<DeadlineGroupKey, string>> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This week',
  later: 'Later',
  undated: 'No date',
};

export interface DatedItem {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  description: string;
  /** Null for an action with no date at all. */
  dueAt: string | null;
  origin: DateOrigin;
  consequence: string;
  ownerIsSelf: boolean;
  group: DeadlineGroupKey;
  priorityBand: string;
  blockedBy?: string;
}

/** A date the person added in this session. Nothing is stored. */
export interface UserDate {
  id: string;
  threadId: string;
  description: string;
  dueAt: string;
}

export function groupForDate(dueAt: string | null, now: string): DeadlineGroupKey {
  if (!dueAt) return 'undated';
  const dayStart = startOfDayIso(now);
  const tomorrowStart = addDaysIso(dayStart, 1);
  const dayAfter = addDaysIso(dayStart, 2);
  const weekEnd = addDaysIso(dayStart, 7);

  if (isBefore(dueAt, now)) return 'overdue';
  if (isBefore(dueAt, tomorrowStart)) return 'today';
  if (isBefore(dueAt, dayAfter)) return 'tomorrow';
  if (isBefore(dueAt, weekEnd)) return 'this_week';
  return 'later';
}

export function datedItems(
  records: readonly ThreadRecord[],
  now: string,
  userDates: readonly UserDate[] = []
): DatedItem[] {
  const out: DatedItem[] = [];
  const visible = applyFilter(records, {});

  for (const r of visible) {
    const base = {
      threadId: r.thread.id,
      subject: r.thread.subject,
      sender: r.counterpartyName,
      priorityBand: r.analysis.priorityBand,
    };

    for (const d of r.analysis.explicitDeadlines) {
      out.push({
        ...base,
        id: d.id,
        description: d.description,
        dueAt: d.dueAt,
        origin: 'explicit_email',
        consequence: d.consequence,
        ownerIsSelf: d.ownerIsSelf,
        group: groupForDate(d.dueAt, now),
      });
    }

    for (const d of r.analysis.suggestedDates) {
      out.push({
        ...base,
        id: d.id,
        description: d.description,
        dueAt: d.dueAt,
        origin: 'suggested',
        consequence: d.consequence,
        ownerIsSelf: d.ownerIsSelf,
        group: groupForDate(d.dueAt, now),
      });
    }

    // Actions the person owns that carry no date of their own still belong
    // here. An undated commitment is the kind that disappears.
    for (const action of r.analysis.actions) {
      if (!action.ownerIsSelf || action.status === 'done') continue;
      const alreadyDated = r.analysis.explicitDeadlines.some((d) => d.dueAt === action.dueAt);
      if (action.dueAt && alreadyDated) continue;
      out.push({
        ...base,
        id: action.id,
        description: action.description,
        dueAt: action.dueAt,
        origin: 'explicit_email',
        // The blocker is shown on its own line. Using it here as well printed
        // the same sentence twice under one item.
        consequence: 'No consequence stated in the thread.',
        ownerIsSelf: true,
        group: groupForDate(action.dueAt, now),
        ...(action.blockedBy ? { blockedBy: action.blockedBy } : {}),
      });
    }
  }

  for (const u of userDates) {
    const r = visible.find((x) => x.thread.id === u.threadId);
    out.push({
      id: u.id,
      threadId: u.threadId,
      subject: r?.thread.subject ?? 'Thread',
      sender: r?.counterpartyName ?? '',
      description: u.description,
      dueAt: u.dueAt,
      origin: 'user_created',
      consequence: 'You set this one.',
      ownerIsSelf: true,
      group: groupForDate(u.dueAt, now),
      priorityBand: r?.analysis.priorityBand ?? 'low',
    });
  }

  return out;
}

export const DEADLINE_GROUP_ORDER: readonly DeadlineGroupKey[] = [
  'overdue',
  'today',
  'tomorrow',
  'this_week',
  'later',
  'undated',
];

export function groupDatedItems(items: readonly DatedItem[]): { key: DeadlineGroupKey; items: DatedItem[] }[] {
  return DEADLINE_GROUP_ORDER.map((key) => ({
    key,
    items: items
      .filter((i) => i.group === key)
      .sort((a, b) => {
        if (a.dueAt && b.dueAt && ms(a.dueAt) !== ms(b.dueAt)) return ms(a.dueAt) - ms(b.dueAt);
        if (a.dueAt && !b.dueAt) return -1;
        if (!a.dueAt && b.dueAt) return 1;
        return a.id < b.id ? -1 : 1;
      }),
  }));
}

/* =========================================================== 4. Waiting */

export interface WaitingItem {
  threadId: string;
  subject: string;
  /** Who owes it. A person where one is named, otherwise what is awaited. */
  waitingOn: string;
  waitingOnAddress: string;
  outstandingItem: string;
  /** The last message that moved the conversation, not a bare acknowledgement. */
  lastMeaningfulMessageAt: string;
  /** A date they actually gave. Null where they gave none. */
  expectedAt: string | null;
  /** The module's suggestion for when to chase. Always labelled as a suggestion. */
  suggestedFollowUpAt: string | null;
  /** Whether a follow-up has already gone, and when. */
  followUpStatus: 'none_sent' | 'overdue' | 'awaiting_their_date';
  threadAgeDays: number;
  /** How sure the module is that the next step is genuinely theirs. */
  ownershipConfidence: 'high' | 'medium' | 'low';
  ownershipBasis: string;
}

export function waitingItems(records: readonly ThreadRecord[], now: string): WaitingItem[] {
  return queueRecords(records, 'waiting', now).map((r) => {
    const a = r.analysis;
    const theirs = a.commitments.find((c) => !c.promisedByIsSelf);
    const inbound = r.messages.filter((m) => !m.isFromSelf);
    const lastInbound = inbound[inbound.length - 1];
    const outbound = r.messages.filter((m) => m.isFromSelf);
    const lastOutbound = outbound[outbound.length - 1];

    // The last meaningful message is the later of the two sides' last real
    // messages. A thread where you spoke last is waiting differently from one
    // where they did.
    const lastMeaningful =
      lastOutbound && lastInbound
        ? ms(lastOutbound.sentAt) > ms(lastInbound.sentAt)
          ? lastOutbound.sentAt
          : lastInbound.sentAt
        : (lastOutbound ?? lastInbound)?.sentAt ?? r.thread.lastMessageAt;

    const expected = theirs?.dueAt ?? null;

    return {
      threadId: r.thread.id,
      subject: r.thread.subject,
      waitingOn: r.counterpartyName,
      waitingOnAddress: r.counterpartyAddress,
      outstandingItem: theirs?.description ?? a.oneLineSummary,
      lastMeaningfulMessageAt: lastMeaningful,
      expectedAt: expected,
      suggestedFollowUpAt: a.recommendedFollowUpDate,
      followUpStatus:
        expected && isBefore(expected, now)
          ? 'overdue'
          : expected
            ? 'awaiting_their_date'
            : 'none_sent',
      threadAgeDays: ageInDays(r.thread.firstMessageAt, now),
      // Ownership is high confidence only when they said in writing that the
      // next move was theirs. Otherwise it is a reading of the thread, and the
      // view says so rather than asserting it.
      ownershipConfidence: theirs ? 'high' : 'medium',
      ownershipBasis: theirs
        ? `They wrote: "${theirs.source[0]?.quote ?? theirs.description}"`
        : 'Read from the shape of the thread rather than from anything they wrote.',
    };
  });
}

/* ======================================================== 5. Quick Wins */

/**
 * The four neutral labels the brief asks for.
 *
 * Neutral matters here. "Junk" and "ignore" are judgements the module is not
 * entitled to make on someone's correspondence, and a label that tells a person
 * what to do with a message is a label that will eventually be wrong about one
 * that mattered.
 */
export type QuickWinLabel =
  | 'short_response'
  | 'simple_confirmation'
  | 'no_action_detected'
  | 'possible_archive_candidate';

export const QUICK_WIN_LABEL: Readonly<Record<QuickWinLabel, string>> = {
  short_response: 'Short response',
  simple_confirmation: 'Simple confirmation',
  no_action_detected: 'No action detected',
  possible_archive_candidate: 'Possible archive candidate',
};

export interface QuickWinItem {
  record: ThreadRecord;
  label: QuickWinLabel;
  /** Why this label, in one line. */
  labelReason: string;
  /** True where the thread is short to answer but expensive to get wrong. */
  highConsequence: boolean;
  estimatedMinutes: number | null;
}

export function classifyQuickWin(r: ThreadRecord): { label: QuickWinLabel; reason: string } {
  const a = r.analysis;
  if (a.currentStatus === 'resolved' || a.classification.tags.includes('duplicate')) {
    return { label: 'possible_archive_candidate', reason: 'Closed or duplicated. Yours to archive if you want to.' };
  }
  if (a.classification.isBulk || a.currentStatus === 'information_only') {
    return { label: 'no_action_detected', reason: 'Nothing in the thread asks anything of you.' };
  }
  if (a.decisionsRequired.length === 0 && a.openQuestions.filter((q) => !q.answered).length <= 1) {
    return { label: 'simple_confirmation', reason: 'One question, and a yes or no closes it.' };
  }
  return { label: 'short_response', reason: 'A short answer is enough, but it is more than a yes or no.' };
}

/**
 * Quick Wins, with the brief's rule enforced.
 *
 * A short response is not the same as a small consequence. The renewal terms
 * thread takes one line and costs a year of revenue if it is missed. Threads in
 * the immediate or today band are kept, flagged, and sorted to the top rather
 * than filtered out for being quick.
 */
export function quickWinItems(records: readonly ThreadRecord[], now: string): QuickWinItem[] {
  const byEffort = metricRecords(records, 'quick_wins', now);

  const alsoHighConsequence = applyFilter(records, {
    priorityBands: ['immediate', 'today'],
  }).filter(
    (r) =>
      r.analysis.estimatedEffortMinutes !== null &&
      r.analysis.estimatedEffortMinutes > 0 &&
      r.analysis.estimatedEffortMinutes <= 10 &&
      r.analysis.securityAlert === null
  );

  const seen = new Set<string>();
  const merged: ThreadRecord[] = [];
  for (const r of [...alsoHighConsequence, ...byEffort]) {
    if (seen.has(r.thread.id)) continue;
    seen.add(r.thread.id);
    merged.push(r);
  }

  return merged
    .map((r) => {
      const { label, reason } = classifyQuickWin(r);
      return {
        record: r,
        label,
        labelReason: reason,
        highConsequence: r.analysis.priorityBand === 'immediate' || r.analysis.priorityBand === 'today',
        estimatedMinutes: r.analysis.estimatedEffortMinutes,
      };
    })
    .sort((a, b) => {
      if (a.highConsequence !== b.highConsequence) return a.highConsequence ? -1 : 1;
      return (a.estimatedMinutes ?? 99) - (b.estimatedMinutes ?? 99);
    });
}

/* ========================================================= 6. All Email */

export type AllEmailSortKey = 'priority' | 'date' | 'sender' | 'subject' | 'status' | 'deadline';
export type SortDirection = 'asc' | 'desc';

export interface AllEmailSort {
  key: AllEmailSortKey;
  direction: SortDirection;
}

export const ALL_EMAIL_COLUMNS: readonly {
  key: AllEmailSortKey;
  label: string;
  /** The direction a first click applies, chosen so the useful end comes first. */
  firstClick: SortDirection;
}[] = [
  { key: 'priority', label: 'Priority', firstClick: 'desc' },
  { key: 'sender', label: 'From', firstClick: 'asc' },
  { key: 'subject', label: 'Subject', firstClick: 'asc' },
  { key: 'status', label: 'Status', firstClick: 'asc' },
  { key: 'deadline', label: 'Deadline', firstClick: 'asc' },
  { key: 'date', label: 'Last message', firstClick: 'desc' },
];

export function sortAllEmail(
  records: readonly ThreadRecord[],
  sort: AllEmailSort
): ThreadRecord[] {
  const dir = sort.direction === 'asc' ? 1 : -1;
  const out = records.slice();

  out.sort((a, b) => {
    switch (sort.key) {
      case 'priority':
        return (a.analysis.priorityScore - b.analysis.priorityScore) * dir;
      case 'sender':
        return a.counterpartyName.localeCompare(b.counterpartyName, 'en-AU') * dir;
      case 'subject':
        return a.thread.subject.localeCompare(b.thread.subject, 'en-AU') * dir;
      case 'status':
        return a.analysis.currentStatus.localeCompare(b.analysis.currentStatus, 'en-AU') * dir;
      case 'deadline': {
        // Threads with no date sort last whichever way the column runs. A
        // person sorting by deadline wants the dated ones, in order.
        const x = a.nextAnyDeadline;
        const y = b.nextAnyDeadline;
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return (ms(x) - ms(y)) * dir;
      }
      case 'date':
        return (ms(a.thread.lastMessageAt) - ms(b.thread.lastMessageAt)) * dir;
    }
  });
  return out;
}

export interface Page<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  /** 1-based, inclusive, for the "showing x to y of z" line. */
  from: number;
  to: number;
}

/**
 * Pagination rather than virtualisation.
 *
 * Twenty-two threads do not need a windowing library, and adding one here
 * would be a dependency chosen for a problem the data does not have. The
 * boundary is in one function, so the day a real mailbox makes this the wrong
 * call, it is one function to change.
 */
export function paginate<T>(items: readonly T[], pageIndex: number, pageSize: number): Page<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeIndex = Math.min(Math.max(0, pageIndex), totalPages - 1);
  const start = safeIndex * pageSize;
  const slice = items.slice(start, start + pageSize);

  return {
    items: slice,
    pageIndex: safeIndex,
    pageSize,
    totalItems,
    totalPages,
    from: totalItems === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

export function allEmailRecords(
  dataset: AccountDataset,
  filter: ThreadFilter,
  sort: AllEmailSort
): ThreadRecord[] {
  // All Email means all of it. Bulk, duplicates and resolved threads are
  // included here by default, because this is the view a person opens when
  // they are looking for something they know exists.
  const everything = applyFilter(recordsFor(dataset), {
    includeBulk: true,
    includeDuplicates: true,
    includeResolved: true,
    ...filter,
  });
  return sortAllEmail(everything, sort);
}

/* ============================================================ 7. Drafts */

export interface DraftItem {
  record: ThreadRecord;
  draft: ReplyDraft;
  bodyForStyle: string | null;
}

export function draftItems(
  records: readonly ThreadRecord[],
  drafts: readonly ReplyDraft[],
  style: DraftStyle,
  statuses: readonly ReplyDraft['status'][] = ['available', 'clarification_required', 'withheld_for_safety']
): DraftItem[] {
  const visible = applyFilter(records, {});
  const draftByThread = new Map(drafts.map((d) => [d.threadId, d]));
  return visible
    .map((r) => {
      const draft = draftByThread.get(r.thread.id);
      return draft ? { record: r, draft } : null;
    })
    .filter((x): x is { record: ThreadRecord; draft: ReplyDraft } => x !== null)
    .filter((x) => statuses.includes(x.draft.status))
    .sort((a, b) => {
      const order = { available: 0, clarification_required: 1, withheld_for_safety: 2 } as const;
      if (order[a.draft.status] !== order[b.draft.status]) {
        return order[a.draft.status] - order[b.draft.status];
      }
      return b.record.analysis.priorityScore - a.record.analysis.priorityScore;
    })
    .map((x) => ({
      ...x,
      bodyForStyle: x.draft.variants ? x.draft.variants[style] : null,
    }));
}

/* =================================================== 8. Security Review */

/** The nine categories the brief asks to be shown, and the flags behind them. */
export const SECURITY_CATEGORIES: readonly {
  flag: SecurityFlag;
  label: string;
  /** What it means, written for a person about to pay an invoice. */
  meaning: string;
}[] = [
  {
    flag: 'unexpected_payment',
    label: 'Unexpected payment',
    meaning: 'A payment is being asked for that was not expected, or on terms that changed.',
  },
  {
    flag: 'payment_details_changed',
    label: 'Bank-detail change',
    meaning: 'Bank or remittance details differ from what was used before.',
  },
  {
    flag: 'credential_request',
    label: 'Password or login request',
    meaning: 'The message asks for a password, a code, or a sign-in.',
  },
  {
    flag: 'lookalike_domain',
    label: 'Look-alike domain',
    meaning: 'A domain closely resembles one you already correspond with.',
  },
  {
    flag: 'urgency_pressure',
    label: 'Urgent secrecy',
    meaning: 'Pressure to act immediately, or to avoid checking with anyone.',
  },
  {
    flag: 'unexpected_attachment',
    label: 'Suspicious attachment',
    meaning: 'An attachment that was not expected, or whose contents would change a payment.',
  },
  {
    flag: 'prompt_injection',
    label: 'Prompt injection',
    meaning: 'Text written to instruct an automated assistant rather than to address you.',
  },
  {
    flag: 'reply_to_mismatch',
    label: 'Unusual recipient change',
    meaning: 'A reply would go somewhere other than where the message appears to come from.',
  },
  {
    flag: 'sensitive_data_request',
    label: 'Sensitive-data request',
    meaning: 'The message asks for contacts, account details or other data it has no reason to need.',
  },
];

/** The one statement that has to appear on the Security Review view. */
export const SECURITY_DISCLAIMER =
  'Automated detection can assist review but cannot guarantee that an email is safe or malicious.';

export interface SecurityItem {
  record: ThreadRecord;
  categories: { flag: SecurityFlag; label: string; meaning: string }[];
  /** Flags with no category of their own, listed so nothing is dropped. */
  otherFlags: SecurityFlag[];
  severity: 'high' | 'medium' | 'low';
  explanation: string;
  recommendedCheck: string;
}

export function securityItems(records: readonly ThreadRecord[]): SecurityItem[] {
  return applyFilter(records, {
    securityFlagged: true,
    includeBulk: true,
    includeDuplicates: true,
    includeResolved: true,
  })
    .map((r) => {
      const alert = r.analysis.securityAlert!;
      const categories = SECURITY_CATEGORIES.filter((c) => alert.flags.includes(c.flag));
      const known = new Set(SECURITY_CATEGORIES.map((c) => c.flag));
      return {
        record: r,
        categories: categories.map((c) => ({ flag: c.flag, label: c.label, meaning: c.meaning })),
        otherFlags: alert.flags.filter((f) => !known.has(f)),
        severity: alert.severity,
        explanation: alert.explanation,
        recommendedCheck: alert.recommendedCheck,
      };
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
      return b.record.analysis.priorityScore - a.record.analysis.priorityScore;
    });
}
