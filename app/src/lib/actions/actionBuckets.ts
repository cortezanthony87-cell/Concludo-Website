import { melbourneToday, isActionOverdue, effectiveStatus, ActionLike } from '../intel/actionStatus';

export type ActionBucket = 'Completed' | 'Overdue' | 'Due today' | 'Pending';

export interface ActionBucketItem extends ActionLike {
  id?: string;
  due_date?: string | null;
  due_time?: string | null;
  all_day?: boolean | null;
  status?: string | null;
  archived_at?: string | null;
}

export interface ActionBucketCounts {
  completed: number;
  overdue: number;
  dueToday: number;
  pending: number;
  total: number;
  // Filter counters (may overlap with buckets)
  inProgress: number;
  blocked: number;
  unscheduled: number;
  upcoming: number;
}

/**
 * Classifies an action record into mutually exclusive chart buckets.
 * Evaluation order strictly as per brief Section 5:
 * 1. Completed
 * 2. Overdue: incomplete and past due moment (Melbourne date)
 * 3. Due today: incomplete and due today in Melbourne
 * 4. Pending: all remaining incomplete items (future or unscheduled)
 */
export function getActionBucket(action: ActionBucketItem, now: Date = new Date()): ActionBucket {
  const status = effectiveStatus(action);
  if (status === 'completed') {
    return 'Completed';
  }

  if (isActionOverdue(action, now)) {
    return 'Overdue';
  }

  const today = melbourneToday(now);
  if (action.due_date && action.due_date.slice(0, 10) === today) {
    return 'Due today';
  }

  return 'Pending';
}

/**
 * Computes mutually exclusive bucket totals and non-slice filter counters.
 * Excludes archived items.
 */
export function calculateActionBuckets(
  actions: ActionBucketItem[],
  now: Date = new Date()
): ActionBucketCounts {
  const today = melbourneToday(now);
  const active = actions.filter((a) => !a.archived_at);

  let completed = 0;
  let overdue = 0;
  let dueToday = 0;
  let pending = 0;

  let inProgress = 0;
  let blocked = 0;
  let unscheduled = 0;
  let upcoming = 0;

  for (const action of active) {
    const bucket = getActionBucket(action, now);
    switch (bucket) {
      case 'Completed':
        completed++;
        break;
      case 'Overdue':
        overdue++;
        break;
      case 'Due today':
        dueToday++;
        break;
      case 'Pending':
        pending++;
        break;
    }

    const st = effectiveStatus(action);
    if (st !== 'completed') {
      if (st === 'in_progress') inProgress++;
      if (st === 'blocked') blocked++;

      if (!action.due_date) {
        unscheduled++;
      } else if (action.due_date.slice(0, 10) > today) {
        upcoming++;
      }
    }
  }

  return {
    completed,
    overdue,
    dueToday,
    pending,
    total: completed + overdue + dueToday + pending,
    inProgress,
    blocked,
    unscheduled,
    upcoming,
  };
}
