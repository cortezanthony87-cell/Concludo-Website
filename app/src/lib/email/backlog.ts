/**
 * Backlog-clearing mode.
 *
 * A person with four hundred unread threads does not need a faster inbox. They
 * need to be shown one thing at a time, in an order that puts the expensive
 * mistakes first, with the option to stop.
 *
 * Three rules shaped every decision in this file.
 *
 * 1. The order is consequence, not volume. Security and high-consequence items
 *    come first even when they are old and even when clearing twenty
 *    newsletters would make the number drop faster. A mode that optimises for
 *    the number going down teaches people to clear the cheap things.
 *
 * 2. Pausing is a first-class outcome, not an abandonment. The session is
 *    resumable, the decisions already made are kept, and nothing anywhere says
 *    how far behind anybody is. `BANNED_LANGUAGE` below is enforced by a test
 *    over every string this module can show.
 *
 * 3. A decision is recorded, never acted on. Every progress state is a note
 *    about what the person decided. None of them sends, archives, deletes or
 *    files anything, and the two that point at an external system go through
 *    the approval gate in `approvals.ts`, which refuses them in this release.
 */
import { ThreadRecord } from './filters';
import { applyFilter } from './filters';
import { compareByPriority } from './priority';
import { AccountType, EmailMessage, ThreadFilter } from './model';
import { ms } from './views';

/* ------------------------------------------------------------- selection */

export type BacklogBatchSize = 10 | 25 | 50 | 'custom';

/** The date window, as a preset or as two dates the person typed. */
export interface BacklogDateRange {
  preset: 'any' | '7d' | '30d' | '90d' | 'older_than_30d' | 'custom';
  /** ISO-8601, inclusive. Only read when the preset is 'custom'. */
  from?: string;
  /** ISO-8601, inclusive. Only read when the preset is 'custom'. */
  to?: string;
}

export interface BacklogSelection {
  accountId: string;
  /** Narrows to one account type. Both accounts are never combined here. */
  accountType: AccountType;
  /** Folder or label. 'all' means every analysed folder. */
  folder: string;
  dateRange: BacklogDateRange;
  /** Each criterion narrows the selection. All of them off means everything. */
  unreadOnly: boolean;
  unresolvedOnly: boolean;
  awaitingReplyOnly: boolean;
  /** Addresses the person nominated. Empty means no person filter. */
  priorityPeople: readonly string[];
  /** True selects only threads carrying a date. */
  withDeadlineOnly: boolean;
  batchSize: BacklogBatchSize;
  /** Read only when batchSize is 'custom'. Clamped to 1 to 200. */
  customBatchSize?: number;
}

export const DEFAULT_BACKLOG_SELECTION: BacklogSelection = {
  accountId: '',
  accountType: 'work',
  folder: 'all',
  dateRange: { preset: 'any' },
  unreadOnly: false,
  // Unresolved is the one default that is on. A backlog session that offers
  // resolved threads for review is asking a person to re-read finished work.
  unresolvedOnly: true,
  awaitingReplyOnly: false,
  priorityPeople: [],
  withDeadlineOnly: false,
  batchSize: 25,
};

export const BATCH_SIZE_OPTIONS: readonly { value: BacklogBatchSize; label: string }[] = [
  { value: 10, label: '10 items' },
  { value: 25, label: '25 items' },
  { value: 50, label: '50 items' },
  { value: 'custom', label: 'A number I choose' },
];

export function resolvedBatchSize(selection: BacklogSelection): number {
  if (selection.batchSize !== 'custom') return selection.batchSize;
  const n = Math.round(selection.customBatchSize ?? 25);
  if (!Number.isFinite(n)) return 25;
  return Math.min(200, Math.max(1, n));
}

/** Translates the selection's date range into a filter window. */
export function windowForBacklogRange(
  range: BacklogDateRange,
  now: string
): { dateFrom?: string; dateTo?: string } {
  const day = 24 * 3600_000;
  const t = ms(now);

  switch (range.preset) {
    case 'any':
      return {};
    case '7d':
      return { dateFrom: new Date(t - 7 * day).toISOString() };
    case '30d':
      return { dateFrom: new Date(t - 30 * day).toISOString() };
    case '90d':
      return { dateFrom: new Date(t - 90 * day).toISOString() };
    case 'older_than_30d':
      // The opposite window, and the one a backlog session usually wants:
      // everything that has been sitting there long enough to be forgotten.
      return { dateTo: new Date(t - 30 * day).toISOString() };
    case 'custom':
      return {
        ...(range.from ? { dateFrom: range.from } : {}),
        ...(range.to ? { dateTo: range.to } : {}),
      };
  }
}

/** The selection as a `ThreadFilter`, so it reuses the tested filter layer. */
export function filterForSelection(selection: BacklogSelection, now: string): ThreadFilter {
  const window = windowForBacklogRange(selection.dateRange, now);

  return {
    accountId: selection.accountId,
    accountType: selection.accountType,
    ...window,
    ...(selection.unreadOnly ? { isRead: false } : {}),
    // `includeResolved` is the inverse of the person's "unresolved only", and
    // duplicates are handled separately below so they can be counted and
    // explained rather than silently dropped.
    includeResolved: !selection.unresolvedOnly,
    includeDuplicates: true,
    includeBulk: true,
    ...(selection.awaitingReplyOnly ? { replyRequired: true } : {}),
    ...(selection.withDeadlineOnly ? { hasDeadline: 'any' as const } : {}),
  };
}

/* --------------------------------------------------------- the eight states */

/**
 * The progress states, which are the only outcomes a review step can have.
 *
 * Each one is a record of a decision. Not one of them performs it.
 */
export type BacklogProgressState =
  | 'reviewed'
  | 'reply_drafted'
  | 'approved'
  | 'waiting'
  | 'deferred'
  | 'no_action'
  | 'manual_review'
  | 'security_review';

export interface BacklogStateDefinition {
  state: BacklogProgressState;
  label: string;
  /** What choosing it means. Shown beside the control. */
  meaning: string;
  /** What actually happens, said plainly. Never implies an external effect. */
  effect: string;
  iconName: string;
  /** True where the item is finished for this session. */
  closesItem: boolean;
}

export const BACKLOG_STATES: readonly BacklogStateDefinition[] = [
  {
    state: 'reviewed',
    label: 'Reviewed',
    meaning: 'You have read it and no further step is needed from you.',
    effect: 'Records your decision in this session. Nothing is sent, filed or changed in the mailbox.',
    iconName: 'Eye',
    closesItem: true,
  },
  {
    state: 'reply_drafted',
    label: 'Reply drafted',
    meaning: 'A reply has been prepared for you to read.',
    effect: 'Opens the draft for review. The draft is not saved to the mailbox and is never sent.',
    iconName: 'PenLine',
    closesItem: false,
  },
  {
    state: 'approved',
    label: 'Approved',
    meaning: 'You have approved the draft text exactly as it reads now.',
    effect:
      'Records the approval against this exact text. Saving it to your Drafts folder is a separate step you turn on, and sending stays unavailable.',
    iconName: 'CheckCircle2',
    closesItem: true,
  },
  {
    state: 'waiting',
    label: 'Waiting',
    meaning: 'Someone else owes the next step.',
    effect: 'Records your decision and shows the thread under Waiting for this session.',
    iconName: 'Hourglass',
    closesItem: true,
  },
  {
    state: 'deferred',
    label: 'Deferred',
    meaning: 'Not now. It comes back next time, with the same information.',
    effect: 'Records your decision. The thread is not hidden from All Email and nothing is changed.',
    iconName: 'Clock',
    closesItem: true,
  },
  {
    state: 'no_action',
    label: 'No action',
    meaning: 'Nothing is needed here at all.',
    effect: 'Records your decision. The message stays exactly where it is, unread state included.',
    iconName: 'MinusCircle',
    closesItem: true,
  },
  {
    state: 'manual_review',
    label: 'Manual review',
    meaning: 'The summary is not good enough to decide from. You want to read the thread yourself.',
    effect: 'Records your decision and keeps the item on the list, with the analysis marked as not relied on.',
    iconName: 'Search',
    closesItem: false,
  },
  {
    state: 'security_review',
    label: 'Security review',
    meaning: 'This looks unsafe and belongs with the other flagged items.',
    effect: 'Records your decision and shows the thread under Security Review. Nothing is reported anywhere.',
    iconName: 'ShieldAlert',
    closesItem: true,
  },
];

export function backlogState(state: BacklogProgressState): BacklogStateDefinition {
  const found = BACKLOG_STATES.find((s) => s.state === state);
  if (!found) throw new Error(`Unknown backlog state: ${state}`);
  return found;
}

/**
 * Language this module must never use, and the reason.
 *
 * The brief rules out leaderboards, comparisons, productivity scores, shame and
 * anxiety-producing backlog language. A rule nobody can check is a rule that
 * drifts, so this list is asserted against every string the module can show.
 */
export const BANNED_LANGUAGE: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /\bleaderboard/i, why: 'Ranking people against each other.' },
  { pattern: /\btop performer|\bbottom performer/i, why: 'Comparison between people.' },
  { pattern: /\bproductivity score|\befficiency score|\binbox score/i, why: 'A score on a person.' },
  { pattern: /\bcompared (?:to|with) (?:your|the) (?:team|colleagues|others)/i, why: 'Peer comparison.' },
  { pattern: /\byou(?:'re| are) (?:falling )?behind/i, why: 'Shame.' },
  { pattern: /\bdrowning|\bburied|\bout of control|\bswamped/i, why: 'Anxiety-producing framing.' },
  { pattern: /\bfailed to (?:reply|respond|action)/i, why: 'Blame for a past inbox.' },
  { pattern: /\bstreak\b|\bkeep it up\b|\bdon'?t break/i, why: 'Gamification pressure.' },
  { pattern: /\bonly \d+ left\b/i, why: 'Pressure to finish rather than to decide well.' },
  { pattern: /\burgent(?:ly)? needs? your attention now\b/i, why: 'Manufactured urgency.' },
];

export function languageProblems(text: string): { pattern: string; why: string }[] {
  return BANNED_LANGUAGE.filter((b) => b.pattern.test(text)).map((b) => ({
    pattern: String(b.pattern),
    why: b.why,
  }));
}

/* ------------------------------------------------------------- the batch */

export type BacklogExclusionReason =
  | 'duplicate'
  | 'resolved'
  | 'not_a_priority_person'
  | 'beyond_batch_size';

export const EXCLUSION_LABEL: Readonly<Record<BacklogExclusionReason, string>> = {
  duplicate: 'A duplicate of another thread in this batch',
  resolved: 'Already finished, by the conversation’s own words',
  not_a_priority_person: 'Not from one of the people you nominated',
  beyond_batch_size: 'Waiting for the next batch',
};

export interface BacklogGroup {
  key: string;
  /** Why these belong together, in a sentence. */
  reason: string;
  threadIds: readonly string[];
}

export interface BacklogItem {
  threadId: string;
  record: ThreadRecord;
  /** Position in the batch, from 1. */
  position: number;
  /** Set when this item belongs to a group of related threads. */
  groupKey: string | null;
  /** True when the item was pulled forward for consequence rather than date. */
  surfacedEarly: boolean;
  /** Why it is in this position. Shown, so the order is never a mystery. */
  orderReason: string;
}

export interface BacklogBatch {
  selection: BacklogSelection;
  builtAt: string;
  /** How many threads the selection matched before the batch size was applied. */
  totalMatched: number;
  items: readonly BacklogItem[];
  groups: readonly BacklogGroup[];
  /** What was left out, by reason, with the thread ids so nothing disappears. */
  excluded: readonly { reason: BacklogExclusionReason; threadIds: readonly string[] }[];
  /** True when the selection matched nothing. */
  isEmpty: boolean;
}

function normaliseSubject(subject: string): string {
  return subject
    .replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase();
}

function isFromPriorityPerson(
  record: ThreadRecord,
  nominated: readonly string[]
): boolean {
  if (nominated.length === 0) return true;
  const wanted = new Set(nominated.map((a) => a.trim().toLowerCase()));
  const addresses = record.messages.flatMap((m: EmailMessage) =>
    m.participants.filter((p) => !p.isSelf).map((p) => p.address.toLowerCase())
  );
  if (addresses.some((a) => wanted.has(a))) return true;
  // A nominated person can also be marked as a priority contact by preference,
  // which is how "my three biggest clients" works without typing addresses.
  return record.messages.some((m) =>
    m.participants.some((p) => !p.isSelf && p.isPriorityContact && wanted.has(p.address.toLowerCase()))
  );
}

function highConsequence(record: ThreadRecord): boolean {
  return (
    record.analysis.securityAlert !== null ||
    record.analysis.priorityBand === 'immediate' ||
    record.analysis.classification.sensitivity === 'sensitive'
  );
}

/**
 * Builds one batch, in the order the workflow prescribes.
 *
 * Steps 1 to 5 of the brief's workflow happen here: threads are already
 * reconstructed by `recordsFor`, duplicates are removed, resolved items are
 * identified, security and high-consequence items are surfaced first, and
 * related messages are grouped. Steps 6 to 10 are the session below.
 */
export function buildBacklogBatch(
  records: readonly ThreadRecord[],
  selection: BacklogSelection,
  now: string
): BacklogBatch {
  const filtered = applyFilter(records, filterForSelection(selection, now));

  const excluded: { reason: BacklogExclusionReason; threadIds: string[] }[] = [
    { reason: 'duplicate', threadIds: [] },
    { reason: 'resolved', threadIds: [] },
    { reason: 'not_a_priority_person', threadIds: [] },
    { reason: 'beyond_batch_size', threadIds: [] },
  ];
  const bucket = (reason: BacklogExclusionReason) =>
    excluded.find((e) => e.reason === reason)!.threadIds;

  const kept: ThreadRecord[] = [];
  for (const record of filtered) {
    if (record.thread.duplicateOf) {
      bucket('duplicate').push(record.thread.id);
      continue;
    }
    if (record.analysis.currentStatus === 'resolved') {
      // Reachable only when the person asked for resolved threads as well. The
      // exclusion list still names them, because "identify resolved items" is a
      // step of the workflow and not a filter nobody sees.
      if (selection.unresolvedOnly) {
        bucket('resolved').push(record.thread.id);
        continue;
      }
    }
    if (!isFromPriorityPerson(record, selection.priorityPeople)) {
      bucket('not_a_priority_person').push(record.thread.id);
      continue;
    }
    kept.push(record);
  }

  // Order: consequence first, then the ordinary priority comparison, which
  // already sorts by band before score so an escalation is not defeated.
  const ordered = kept.slice().sort((a, b) => {
    const ac = highConsequence(a) ? 0 : 1;
    const bc = highConsequence(b) ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return compareByPriority(
      {
        priorityScore: a.analysis.priorityScore,
        priorityBand: a.analysis.priorityBand,
        nextDeadline: a.nextAnyDeadline,
        lastMessageAt: a.thread.lastMessageAt,
        threadId: a.thread.id,
      },
      {
        priorityScore: b.analysis.priorityScore,
        priorityBand: b.analysis.priorityBand,
        nextDeadline: b.nextAnyDeadline,
        lastMessageAt: b.thread.lastMessageAt,
        threadId: b.thread.id,
      }
    );
  });

  const size = resolvedBatchSize(selection);
  const inBatch = ordered.slice(0, size);
  for (const record of ordered.slice(size)) bucket('beyond_batch_size').push(record.thread.id);

  // Grouping is computed over the batch, so a group is something the person can
  // actually see together rather than a reference to a thread further down a
  // queue they have not reached.
  const bySubject = new Map<string, string[]>();
  const byCounterparty = new Map<string, string[]>();
  for (const record of inBatch) {
    const subjectKey = normaliseSubject(record.thread.subject);
    const partyKey = record.counterpartyAddress.toLowerCase();
    if (subjectKey) {
      bySubject.set(subjectKey, [...(bySubject.get(subjectKey) ?? []), record.thread.id]);
    }
    if (partyKey) {
      byCounterparty.set(partyKey, [...(byCounterparty.get(partyKey) ?? []), record.thread.id]);
    }
  }

  const groups: BacklogGroup[] = [];
  const groupOf = new Map<string, string>();

  for (const [subject, ids] of bySubject) {
    if (ids.length < 2) continue;
    const key = `subject:${subject}`;
    groups.push({
      key,
      reason: 'The same conversation, split across separate threads.',
      threadIds: ids,
    });
    for (const id of ids) groupOf.set(id, key);
  }
  for (const [address, ids] of byCounterparty) {
    if (ids.length < 2) continue;
    // A subject group is the stronger claim, so it wins where both apply.
    const unassigned = ids.filter((id) => !groupOf.has(id));
    if (unassigned.length < 2) continue;
    const key = `person:${address}`;
    groups.push({
      key,
      reason: `Several separate threads with ${address}. Worth deciding together.`,
      threadIds: unassigned,
    });
    for (const id of unassigned) groupOf.set(id, key);
  }

  const items: BacklogItem[] = inBatch.map((record, index) => {
    const early = highConsequence(record);
    return {
      threadId: record.thread.id,
      record,
      position: index + 1,
      groupKey: groupOf.get(record.thread.id) ?? null,
      surfacedEarly: early,
      orderReason: early
        ? record.analysis.securityAlert !== null
          ? 'Brought forward: flagged as possibly unsafe.'
          : record.analysis.classification.sensitivity === 'sensitive'
            ? 'Brought forward: sensitive content, which is expensive to get wrong.'
            : 'Brought forward: the consequence of leaving it is immediate.'
        : `Ordered by priority band (${record.analysis.priorityBand}) and then by score.`,
    };
  });

  return {
    selection,
    builtAt: now,
    totalMatched: kept.length,
    items,
    groups,
    excluded: excluded.filter((e) => e.threadIds.length > 0),
    isEmpty: items.length === 0,
  };
}

/* ------------------------------------------------------------- the session */

export interface BacklogDecision {
  threadId: string;
  state: BacklogProgressState;
  decidedAt: string;
  /** What the person typed, where they chose to. Never required. */
  note?: string;
}

export type BacklogSessionStatus = 'active' | 'paused' | 'complete';

export interface BacklogSession {
  id: string;
  selection: BacklogSelection;
  startedAt: string;
  /** Updated on every decision, pause and resume. */
  updatedAt: string;
  status: BacklogSessionStatus;
  /** The thread ids in the batch, in order, so a resumed session keeps it. */
  order: readonly string[];
  /** Index into `order`. Equal to `order.length` when the batch is finished. */
  cursor: number;
  decisions: readonly BacklogDecision[];
  /** Set when the person paused, so the interface can say when. */
  pausedAt: string | null;
}

export function startSession(batch: BacklogBatch, now: string, id?: string): BacklogSession {
  return {
    id: id ?? `bl-${batch.selection.accountId}-${ms(now)}`,
    selection: batch.selection,
    startedAt: now,
    updatedAt: now,
    status: batch.isEmpty ? 'complete' : 'active',
    order: batch.items.map((i) => i.threadId),
    cursor: 0,
    decisions: [],
    pausedAt: null,
  };
}

/**
 * Records a decision and advances.
 *
 * Pure. The session is replaced rather than mutated, which is what makes the
 * state machine testable and what makes an undo possible later without
 * unpicking anything.
 *
 * A state whose definition does not close the item (a drafted reply, an item
 * sent to manual review) records the decision and does NOT advance, because the
 * person is not finished with it.
 */
export function recordDecision(
  session: BacklogSession,
  threadId: string,
  state: BacklogProgressState,
  now: string,
  note?: string
): BacklogSession {
  if (!session.order.includes(threadId)) {
    throw new Error(`Thread ${threadId} is not in this backlog session.`);
  }
  if (session.status === 'complete') return session;

  const definition = backlogState(state);
  const decisions = [
    ...session.decisions.filter((d) => d.threadId !== threadId),
    { threadId, state, decidedAt: now, ...(note ? { note } : {}) },
  ];

  const cursor = definition.closesItem
    ? nextOpenIndex(session.order, decisions, session.cursor)
    : session.cursor;

  return {
    ...session,
    decisions,
    cursor,
    updatedAt: now,
    status: cursor >= session.order.length ? 'complete' : session.status,
    pausedAt: null,
  };
}

/** Moves on without deciding. The item stays open and comes back. */
export function skipCurrent(session: BacklogSession, now: string): BacklogSession {
  if (session.status === 'complete') return session;
  const cursor = Math.min(session.order.length, session.cursor + 1);
  return { ...session, cursor, updatedAt: now };
}

export function goBack(session: BacklogSession, now: string): BacklogSession {
  const cursor = Math.max(0, session.cursor - 1);
  return { ...session, cursor, updatedAt: now, status: 'active' };
}

export function pauseSession(session: BacklogSession, now: string): BacklogSession {
  if (session.status === 'complete') return session;
  return { ...session, status: 'paused', pausedAt: now, updatedAt: now };
}

export function resumeSession(session: BacklogSession, now: string): BacklogSession {
  if (session.status !== 'paused') return session;
  return { ...session, status: 'active', pausedAt: null, updatedAt: now };
}

export function finishSession(session: BacklogSession, now: string): BacklogSession {
  return { ...session, status: 'complete', updatedAt: now, pausedAt: null };
}

function closedIds(order: readonly string[], decisions: readonly BacklogDecision[]): Set<string> {
  const closed = new Set<string>();
  for (const d of decisions) {
    if (backlogState(d.state).closesItem) closed.add(d.threadId);
  }
  return closed;
}

function nextOpenIndex(
  order: readonly string[],
  decisions: readonly BacklogDecision[],
  from: number
): number {
  const closed = closedIds(order, decisions);
  let i = from;
  while (i < order.length && closed.has(order[i])) i += 1;
  return i;
}

export interface BacklogProgress {
  total: number;
  decided: number;
  /** Items still open, which is a count of work and never a judgement. */
  remaining: number;
  /** Counts per state, for the summary. */
  byState: Readonly<Record<BacklogProgressState, number>>;
  /** The thread id the person is on, or null when the batch is finished. */
  currentThreadId: string | null;
  status: BacklogSessionStatus;
}

export function progressOf(session: BacklogSession): BacklogProgress {
  const byState = Object.fromEntries(
    BACKLOG_STATES.map((s) => [s.state, 0])
  ) as Record<BacklogProgressState, number>;
  for (const d of session.decisions) byState[d.state] += 1;

  const closed = closedIds(session.order, session.decisions);

  return {
    total: session.order.length,
    decided: closed.size,
    remaining: session.order.length - closed.size,
    byState,
    currentThreadId:
      session.cursor < session.order.length ? session.order[session.cursor] : null,
    status: session.status,
  };
}

export function decisionFor(
  session: BacklogSession,
  threadId: string
): BacklogDecision | null {
  return session.decisions.find((d) => d.threadId === threadId) ?? null;
}

/* ---------------------------------------------------------- persistence */

export const BACKLOG_STORAGE_KEY = 'concludo.ecc.backlog.session.v1';
/** A paused session older than this is not offered for resumption. */
export const BACKLOG_SESSION_TTL_DAYS = 7;

export interface StoredSession {
  version: 1;
  session: BacklogSession;
}

/**
 * Serialises a session for resumption.
 *
 * The thread records are deliberately NOT stored: only the ids, the selection
 * and the decisions. A stored copy of the analysis would go stale and a resumed
 * session would then show a person a summary of a conversation that has since
 * moved on. Rebuilding from the ids costs nothing and is always current.
 */
export function serialiseSession(session: BacklogSession): string {
  const payload: StoredSession = { version: 1, session };
  return JSON.stringify(payload);
}

export function parseSession(raw: string | null, now: string): BacklogSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Partial<StoredSession>;
  if (record.version !== 1 || !record.session) return null;

  const session = record.session;
  if (
    typeof session.id !== 'string' ||
    !Array.isArray(session.order) ||
    typeof session.cursor !== 'number' ||
    !Array.isArray(session.decisions)
  ) {
    return null;
  }

  const ageMs = ms(now) - ms(session.updatedAt ?? session.startedAt);
  if (!Number.isFinite(ageMs) || ageMs > BACKLOG_SESSION_TTL_DAYS * 24 * 3600_000) return null;
  if (session.status === 'complete') return null;

  return session;
}

/**
 * Reads and writes the session in this browser.
 *
 * Wrapped because storage throws in a private window and in an embedded frame,
 * and a backlog session failing to save must not take the page down with it.
 * The interface says where the session is kept and that it is this browser
 * only, rather than implying a server-side record that does not exist yet.
 */
export function loadStoredSession(now: string): BacklogSession | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return parseSession(localStorage.getItem(BACKLOG_STORAGE_KEY), now);
  } catch {
    return null;
  }
}

export function saveStoredSession(session: BacklogSession): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(BACKLOG_STORAGE_KEY, serialiseSession(session));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredSession(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(BACKLOG_STORAGE_KEY);
  } catch {
    // Nothing to do, and nothing worth telling the person about.
  }
}
