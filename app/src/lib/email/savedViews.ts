/**
 * The eight saved views.
 *
 * A saved view is a named filter plus a sort order, nothing more. Keeping them
 * as data rather than as eight bespoke functions means a view cannot quietly
 * develop its own rules, and a person can be shown exactly what a view does.
 */
import { SavedView, SavedViewKey, ThreadFilter } from './model';
import { ThreadRecord, applyFilter } from './filters';
import { compareByPriority } from './priority';

/**
 * Built per call because two of the eight views depend on the clock.
 * A module-level constant would freeze "this week" at import time.
 */
export function savedViews(now: string): readonly SavedView[] {
  const endOfToday = endOfDay(now);
  const inSevenDays = addDays(now, 7);

  return [
    {
      key: 'morning_review',
      label: 'Morning Review',
      description: 'Everything still open, ranked. The one list to read first.',
      filter: {},
      sort: 'priority_desc',
    },
    {
      key: 'handle_today',
      label: 'Handle Today',
      description: 'Immediate and today only, plus anything with a date that falls today.',
      filter: { priorityBands: ['immediate', 'today'] },
      sort: 'priority_desc',
    },
    {
      key: 'quick_replies',
      label: 'Quick Replies',
      description: 'A reply is owed and it should take under two minutes.',
      filter: { replyRequired: true, draftStatuses: ['available'] },
      sort: 'effort_asc',
    },
    {
      key: 'waiting_this_week',
      label: 'Waiting This Week',
      description: 'Someone else owes you something, due within seven days.',
      filter: { waitingOn: 'other', deadlineBefore: inSevenDays },
      sort: 'waiting_longest',
    },
    {
      key: 'needs_a_decision',
      label: 'Needs a Decision',
      description: 'A choice is blocked on you.',
      filter: { statuses: ['decision_required'] },
      sort: 'deadline_asc',
    },
    {
      key: 'needs_an_attachment',
      label: 'Needs an Attachment',
      description: 'A reply cannot go until a file is sent.',
      filter: { awaitingAttachment: true },
      sort: 'priority_desc',
    },
    {
      key: 'security_review',
      label: 'Security Review',
      description: 'Flagged as possibly unsafe. Advisory, never a guarantee.',
      filter: { securityFlagged: true },
      sort: 'priority_desc',
    },
    {
      key: 'unprocessed',
      label: 'Unprocessed',
      description: 'Received but not yet analysed. Nothing is claimed about these.',
      filter: { analysed: false, includeBulk: true, includeDuplicates: true },
      sort: 'priority_desc',
    },
  ];
}

export function savedView(key: SavedViewKey, now: string): SavedView {
  const found = savedViews(now).find((v) => v.key === key);
  if (!found) throw new Error(`Unknown saved view: ${key}`);
  return found;
}

/**
 * Runs a saved view over a set of records.
 *
 * `extra` is the header state, which is applied ON TOP of the view's own
 * filter. A saved view narrows; it never widens past what the person has
 * already chosen in the header.
 */
export function runSavedView(
  records: readonly ThreadRecord[],
  key: SavedViewKey,
  now: string,
  extra: ThreadFilter = {}
): ThreadRecord[] {
  const view = savedView(key, now);
  const merged: ThreadFilter = { ...view.filter, ...extra };
  // The view's own default-exclusion choices survive the merge, because an
  // explicit `false` in the header should not re-hide what the view exists to
  // show. Unprocessed is the case that matters: it deliberately includes bulk.
  if (view.filter.includeBulk !== undefined && extra.includeBulk === undefined) {
    merged.includeBulk = view.filter.includeBulk;
  }
  if (view.filter.includeDuplicates !== undefined && extra.includeDuplicates === undefined) {
    merged.includeDuplicates = view.filter.includeDuplicates;
  }
  if (view.filter.includeResolved !== undefined && extra.includeResolved === undefined) {
    merged.includeResolved = view.filter.includeResolved;
  }

  return sortRecords(applyFilter(records, merged), view.sort);
}

export function sortRecords(
  records: readonly ThreadRecord[],
  sort: SavedView['sort']
): ThreadRecord[] {
  const out = records.slice();

  switch (sort) {
    case 'priority_desc':
      return out.sort((a, b) =>
        compareByPriority(
          {
            priorityScore: a.analysis.priorityScore,
            priorityBand: a.analysis.priorityBand,
            nextDeadline: a.nextStatedDeadline,
            lastMessageAt: a.thread.lastMessageAt,
            threadId: a.thread.id,
          },
          {
            priorityScore: b.analysis.priorityScore,
            priorityBand: b.analysis.priorityBand,
            nextDeadline: b.nextStatedDeadline,
            lastMessageAt: b.thread.lastMessageAt,
            threadId: b.thread.id,
          }
        )
      );

    case 'deadline_asc':
      return out.sort((a, b) => {
        const x = a.nextAnyDeadline;
        const y = b.nextAnyDeadline;
        if (x && y && x !== y) return new Date(x).getTime() - new Date(y).getTime();
        if (x && !y) return -1;
        if (!x && y) return 1;
        return b.analysis.priorityScore - a.analysis.priorityScore;
      });

    case 'waiting_longest':
      // Oldest last message first: the thread that has been quiet longest is
      // the one most likely to have been forgotten by both sides.
      return out.sort((a, b) => {
        const x = new Date(a.thread.lastMessageAt).getTime();
        const y = new Date(b.thread.lastMessageAt).getTime();
        return x === y ? b.analysis.priorityScore - a.analysis.priorityScore : x - y;
      });

    case 'effort_asc':
      return out.sort((a, b) => {
        const x = a.analysis.estimatedEffortMinutes ?? Number.MAX_SAFE_INTEGER;
        const y = b.analysis.estimatedEffortMinutes ?? Number.MAX_SAFE_INTEGER;
        if (x !== y) return x - y;
        return b.analysis.priorityScore - a.analysis.priorityScore;
      });
  }
}

/* ------------------------------------------------------------- date helpers */

export function endOfDay(now: string): string {
  const d = new Date(now);
  const shifted = new Date(d.getTime() + 11 * 3600_000);
  const day = shifted.toISOString().slice(0, 10);
  return `${day}T23:59:59+11:00`;
}

export function startOfDay(now: string): string {
  const d = new Date(now);
  const shifted = new Date(d.getTime() + 11 * 3600_000);
  const day = shifted.toISOString().slice(0, 10);
  return `${day}T00:00:00+11:00`;
}

export function addDays(now: string, days: number): string {
  return new Date(new Date(now).getTime() + days * 24 * 3600_000).toISOString();
}
