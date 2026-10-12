/**
 * Thread filtering.
 *
 * Every dimension in the brief, combined with AND. Two decisions worth naming:
 *
 * 1. A filter operates on a thread together with its analysis, never on the
 *    analysis alone. Sender, folder, read state and attachments live on the
 *    messages; priority and status live on the analysis. Splitting the two
 *    would mean half the filters could not be expressed.
 *
 * 2. Bulk mail, resolved threads and duplicates are excluded by DEFAULT and
 *    have to be asked for. The alternative, including them unless excluded, is
 *    how a reply queue ends up with a newsletter in it.
 */
import {
  AccountDataset,
  EmailMessage,
  EmailThread,
  ThreadAnalysis,
  ThreadFilter,
} from './model';

/** A thread and everything needed to judge it, in one object. */
export interface ThreadRecord {
  thread: EmailThread;
  analysis: ThreadAnalysis;
  messages: readonly EmailMessage[];
  /** The sender of the most recent message not sent by the account holder. */
  counterpartyName: string;
  counterpartyAddress: string;
  /** The soonest stated deadline owned by the person, or null. */
  nextStatedDeadline: string | null;
  /** The soonest deadline of any basis, used for ordering only. */
  nextAnyDeadline: string | null;
  hasAttachment: boolean;
  awaitingAttachment: boolean;
}

/**
 * Builds the records for one account. The only entry point into a dataset.
 *
 * A DEFECT FOUND BY THE STAGE 7 LOAD TEST, CORRECTED HERE.
 *
 * This function looked up each thread's analysis with
 * `dataset.analyses.find(...)`, inside a loop over the threads. On the
 * twenty-two thread dataset that is 484 comparisons and invisible. On ten
 * thousand threads it is a hundred million, and `recordsFor` took 772 ms while
 * the whole dashboard took 784 ms: nearly the entire cost of rendering the
 * module was one accidental O(n squared) lookup. The per-thread cost at ten
 * thousand threads was sixteen times the per-thread cost at one thousand,
 * which is the shape that made it findable.
 *
 * The messages were already indexed by a Map. The analyses now are too. The
 * scaling assertion in the performance suite exists so this cannot come back
 * quietly: a budget alone would have passed at a thousand threads.
 */
export function recordsFor(dataset: AccountDataset): ThreadRecord[] {
  const byId = new Map(dataset.messages.map((m) => [m.id, m]));
  const analysisByThread = new Map(dataset.analyses.map((a) => [a.threadId, a]));

  return dataset.threads.map((thread) => {
    const analysis = analysisByThread.get(thread.id);
    if (!analysis) {
      throw new Error(
        `Thread ${thread.id} has no analysis. Every thread carries one, even when it says "not analysed yet".`
      );
    }

    const messages = thread.messageIds
      .map((id) => byId.get(id))
      .filter((m): m is EmailMessage => Boolean(m));

    const inbound = messages.filter((m) => !m.isFromSelf);
    const latestInbound = inbound[inbound.length - 1];
    const sender = latestInbound?.participants.find((p) => p.role === 'from');

    // Sorted by instant. A default `.sort()` on ISO strings is a text sort,
    // which gives the wrong "soonest" the moment two offsets differ.
    const byInstant = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();
    const stated = analysis.explicitDeadlines
      .filter((d) => d.ownerIsSelf)
      .map((d) => d.dueAt)
      .sort(byInstant);
    const all = [...analysis.explicitDeadlines, ...analysis.suggestedDates]
      .map((d) => d.dueAt)
      .sort(byInstant);

    const attachments = analysis.attachments;

    return {
      thread,
      analysis,
      messages,
      counterpartyName: sender?.displayName ?? 'Unknown sender',
      counterpartyAddress: sender?.address ?? '',
      nextStatedDeadline: stated[0] ?? null,
      nextAnyDeadline: all[0] ?? null,
      hasAttachment: attachments.some((a) => a.disposition === 'received'),
      awaitingAttachment: attachments.some(
        (a) => a.disposition === 'expected' || a.disposition === 'referenced_but_missing'
      ),
    };
  });
}

/* ------------------------------------------------------------- predicates */

/** Parses an ISO timestamp to milliseconds. See the note on dateFrom below. */
function at(iso: string): number {
  return new Date(iso).getTime();
}

function matchesSender(record: ThreadRecord, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return (
    record.counterpartyName.toLowerCase().includes(needle) ||
    record.counterpartyAddress.toLowerCase().includes(needle) ||
    record.messages.some((m) =>
      m.participants.some(
        (p) =>
          p.address.toLowerCase().includes(needle) ||
          p.displayName.toLowerCase().includes(needle)
      )
    )
  );
}

function matchesSearch(record: ThreadRecord, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return (
    record.thread.subject.toLowerCase().includes(needle) ||
    record.analysis.oneLineSummary.toLowerCase().includes(needle) ||
    record.counterpartyName.toLowerCase().includes(needle) ||
    record.counterpartyAddress.toLowerCase().includes(needle)
  );
}

function matchesDeadline(record: ThreadRecord, want: NonNullable<ThreadFilter['hasDeadline']>): boolean {
  const stated = record.analysis.explicitDeadlines.length > 0;
  const inferred = record.analysis.suggestedDates.length > 0;
  switch (want) {
    case 'stated':
      return stated;
    case 'inferred':
      return inferred;
    case 'any':
      return stated || inferred;
    case 'none':
      return !stated && !inferred;
  }
}

/**
 * Applies a filter to a set of records.
 *
 * The three default exclusions run first, so every later rule operates on the
 * threads that could plausibly be work.
 */
export function applyFilter(
  records: readonly ThreadRecord[],
  filter: ThreadFilter
): ThreadRecord[] {
  return records.filter((r) => {
    const { thread, analysis } = r;

    if (!filter.includeBulk && analysis.classification.isBulk) return false;
    if (!filter.includeResolved && analysis.currentStatus === 'resolved') return false;
    if (!filter.includeDuplicates && thread.duplicateOf) return false;

    if (filter.accountId && thread.accountId !== filter.accountId) return false;
    if (filter.accountType && thread.accountType !== filter.accountType) return false;

    if (filter.sender && !matchesSender(r, filter.sender)) return false;
    if (filter.search && !matchesSearch(r, filter.search)) return false;

    // Compared as instants, not as text. The dataset carries +11:00 literals
    // and `windowForRange` produces Z values; comparing those as strings sorts
    // "17" against "13" and silently drops the wrong threads.
    if (filter.dateFrom && at(thread.lastMessageAt) < at(filter.dateFrom)) return false;
    if (filter.dateTo && at(thread.lastMessageAt) > at(filter.dateTo)) return false;

    if (filter.priorityBands && !filter.priorityBands.includes(analysis.priorityBand)) return false;
    if (
      typeof filter.minPriorityScore === 'number' &&
      analysis.priorityScore < filter.minPriorityScore
    ) {
      return false;
    }

    if (filter.statuses && !filter.statuses.includes(analysis.currentStatus)) return false;
    if (typeof filter.replyRequired === 'boolean' && analysis.replyRequired !== filter.replyRequired) {
      return false;
    }
    if (filter.draftStatuses && !filter.draftStatuses.includes(analysis.draftStatus)) return false;

    if (filter.hasDeadline && !matchesDeadline(r, filter.hasDeadline)) return false;
    if (filter.deadlineBefore) {
      if (!r.nextAnyDeadline || at(r.nextAnyDeadline) > at(filter.deadlineBefore)) return false;
    }

    if (typeof filter.hasAttachment === 'boolean' && r.hasAttachment !== filter.hasAttachment) {
      return false;
    }
    if (
      typeof filter.awaitingAttachment === 'boolean' &&
      r.awaitingAttachment !== filter.awaitingAttachment
    ) {
      return false;
    }

    if (filter.waitingOn === 'user' && analysis.currentStatus !== 'waiting_on_user') return false;
    if (filter.waitingOn === 'other' && analysis.currentStatus !== 'waiting_on_other') return false;
    if (
      filter.waitingOn === 'either' &&
      analysis.currentStatus !== 'waiting_on_user' &&
      analysis.currentStatus !== 'waiting_on_other'
    ) {
      return false;
    }

    if (typeof filter.securityFlagged === 'boolean') {
      const flagged = analysis.securityAlert !== null;
      if (flagged !== filter.securityFlagged) return false;
    }

    if (typeof filter.isRead === 'boolean' && thread.isRead !== filter.isRead) return false;
    if (typeof filter.analysed === 'boolean' && analysis.analysed !== filter.analysed) return false;

    return true;
  });
}

/**
 * Translates the header's date range into a filter window.
 *
 * 'all' deliberately returns no window rather than a very wide one, because a
 * wide window still excludes an old thread that is still live, and an old
 * thread that is still live is exactly the kind a person forgets.
 */
export function windowForRange(
  range: 'today' | '7d' | '14d' | '30d' | 'all',
  now: string
): { dateFrom?: string } {
  if (range === 'all') return {};
  const days = range === 'today' ? 1 : Number(range.replace('d', ''));
  const from = new Date(new Date(now).getTime() - days * 24 * 3600_000);
  return { dateFrom: from.toISOString() };
}
