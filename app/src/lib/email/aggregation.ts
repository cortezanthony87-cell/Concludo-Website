/**
 * Dashboard aggregation: the eight counts and the five queues.
 *
 * Three rules hold across all of them.
 *
 * 1. ONE ACCOUNT AT A TIME. Every function takes a single dataset. There is no
 *    function in this module that can see two accounts, so there is no function
 *    that can add a personal thread to a work count.
 *
 * 2. THE COUNT AND THE QUEUE AGREE. Each count is the length of the set its
 *    card links to. A card that says four and a page that shows six is the
 *    fastest way to lose a person's trust in everything else on the screen.
 *    The tests hold this to account.
 *
 * 3. NOTHING RESOLVED, BULK OR DUPLICATE IS COUNTED unless the metric is
 *    explicitly about it. Unprocessed is the single exception, because an
 *    unanalysed thread has not been classified yet and excluding it on a
 *    classification it does not have would be circular.
 */
import { DashboardMetricKey, QueueKey, ThreadFilter, AccountDataset } from './model';
import { ThreadRecord, applyFilter, recordsFor } from './filters';
import { sortRecords } from './savedViews';
import { endOfDay, startOfDay } from './savedViews';

/** The definition of a count: what it means and exactly which threads it holds. */
export interface MetricDefinition {
  key: DashboardMetricKey;
  label: string;
  /** One sentence. What the number means. Never a claim about time saved. */
  explanation: string;
  /** Built per call because several depend on the clock. */
  filter: (now: string) => ThreadFilter;
  /** Extra narrowing the filter cannot express. */
  refine?: (records: ThreadRecord[], now: string) => ThreadRecord[];
}

export const METRICS: readonly MetricDefinition[] = [
  {
    key: 'needs_attention',
    label: 'Needs Attention',
    explanation: 'Highest consequence if left today.',
    filter: () => ({ priorityBands: ['immediate', 'today'] }),
  },
  {
    key: 'replies_due',
    label: 'Replies Due',
    explanation: 'Someone is waiting on an answer from you.',
    filter: () => ({ replyRequired: true }),
  },
  {
    key: 'actions_required',
    label: 'Actions Required',
    explanation: 'Something to do that is not a reply.',
    filter: () => ({}),
    // An action you own, on a thread that is not simply a reply. Counting every
    // thread with any action would double-count the reply queue.
    refine: (records) =>
      records.filter((r) => r.analysis.actions.some((a) => a.ownerIsSelf && a.status !== 'done')),
  },
  {
    key: 'deadlines',
    label: 'Deadlines',
    explanation: 'Dates stated in a thread, soonest first.',
    // Stated only. An inferred date is a working guess and does not belong in a
    // count a person plans their week around.
    filter: () => ({ hasDeadline: 'stated' }),
    refine: (records) => records.filter((r) => r.nextStatedDeadline !== null),
  },
  {
    key: 'waiting_on_others',
    label: 'Waiting on Others',
    explanation: 'You have replied. The next step is theirs.',
    filter: () => ({ waitingOn: 'other' }),
  },
  {
    key: 'quick_wins',
    label: 'Quick Wins',
    explanation: 'Probably closeable in under two minutes.',
    filter: () => ({}),
    // Security-flagged threads are excluded. Found in Stage 3 verification: the
    // suspected phishing approach takes one minute to deal with, so it met the
    // effort test and was being offered as a "quick win". Putting a possible
    // attack in a list a person works through without thinking is the opposite
    // of what the flag is for.
    refine: (records) =>
      records.filter(
        (r) =>
          r.analysis.securityAlert === null &&
          r.analysis.estimatedEffortMinutes !== null &&
          r.analysis.estimatedEffortMinutes > 0 &&
          r.analysis.estimatedEffortMinutes <= 2
      ),
  },
  {
    key: 'security_review',
    label: 'Security Review',
    explanation: 'Flagged as possibly unsafe. Advisory, not a guarantee.',
    filter: () => ({ securityFlagged: true }),
  },
  {
    key: 'unprocessed',
    label: 'Unprocessed',
    explanation: 'Received but not yet analysed.',
    // The one metric that includes bulk and duplicates, because nothing has
    // read these threads yet and they have no classification to exclude them on.
    filter: () => ({ analysed: false, includeBulk: true, includeDuplicates: true }),
  },
];

/** The threads behind one count. The card's number is this list's length. */
export function metricRecords(
  records: readonly ThreadRecord[],
  key: DashboardMetricKey,
  now: string
): ThreadRecord[] {
  const definition = METRICS.find((m) => m.key === key);
  if (!definition) throw new Error(`Unknown metric: ${key}`);
  const filtered = applyFilter(records, definition.filter(now));
  return definition.refine ? definition.refine(filtered, now) : filtered;
}

export interface MetricCount {
  key: DashboardMetricKey;
  label: string;
  explanation: string;
  count: number;
}

export function metricCounts(records: readonly ThreadRecord[], now: string): MetricCount[] {
  return METRICS.map((m) => ({
    key: m.key,
    label: m.label,
    explanation: m.explanation,
    count: metricRecords(records, m.key, now).length,
  }));
}

/* ------------------------------------------------------------------ queues */

export interface QueueDefinition {
  key: QueueKey;
  label: string;
  description: string;
  /** Written as a good outcome, because an empty queue usually is one. */
  emptyMessage: string;
  build: (records: readonly ThreadRecord[], now: string) => ThreadRecord[];
}

/**
 * Today's Workload deserves a note.
 *
 * It is not "everything important". It is what can realistically be done
 * today: anything with a stated date falling today, plus the immediate band.
 * A queue called Today that holds nine hours of work is a queue a person stops
 * opening.
 */
export const QUEUES: readonly QueueDefinition[] = [
  {
    key: 'handle_first',
    label: 'Handle First',
    description: 'Highest consequence if left until tomorrow.',
    emptyMessage: 'Nothing is urgent. That is a real answer, not an empty list.',
    build: (records) =>
      sortRecords(applyFilter(records, { priorityBands: ['immediate', 'today'] }), 'priority_desc'),
  },
  {
    key: 'todays_workload',
    label: "Today's Workload",
    description: 'What is realistically on today, in order.',
    emptyMessage: 'Nothing is dated today.',
    build: (records, now) => {
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);
      const at = (iso: string) => new Date(iso).getTime();
      const dated = applyFilter(records, { hasDeadline: 'stated' }).filter(
        (r) =>
          r.nextStatedDeadline !== null &&
          at(r.nextStatedDeadline) >= at(dayStart) &&
          at(r.nextStatedDeadline) <= at(dayEnd)
      );
      const immediate = applyFilter(records, { priorityBands: ['immediate'] });
      const merged = dedupe([...dated, ...immediate]);
      return sortRecords(merged, 'deadline_asc');
    },
  },
  {
    key: 'reply_queue',
    label: 'Reply Queue',
    description: 'Threads where someone is waiting on your answer.',
    emptyMessage: 'Nobody is waiting on a reply from you.',
    build: (records) =>
      sortRecords(applyFilter(records, { replyRequired: true }), 'priority_desc'),
  },
  {
    key: 'waiting',
    label: 'Waiting on Others',
    description: 'You have done your part. The next step is theirs.',
    emptyMessage: 'Nothing is outstanding from anyone else.',
    build: (records) =>
      sortRecords(applyFilter(records, { waitingOn: 'other' }), 'waiting_longest'),
  },
  {
    key: 'quick_wins',
    label: 'Quick Wins',
    description: 'Probably closeable in under two minutes each.',
    emptyMessage: 'No two minute jobs waiting.',
    build: (records, now) => sortRecords(metricRecords(records, 'quick_wins', now), 'effort_asc'),
  },
];

export function queueRecords(
  records: readonly ThreadRecord[],
  key: QueueKey,
  now: string
): ThreadRecord[] {
  const definition = QUEUES.find((q) => q.key === key);
  if (!definition) throw new Error(`Unknown queue: ${key}`);
  return definition.build(records, now);
}

function dedupe(records: readonly ThreadRecord[]): ThreadRecord[] {
  const seen = new Set<string>();
  const out: ThreadRecord[] = [];
  for (const r of records) {
    if (seen.has(r.thread.id)) continue;
    seen.add(r.thread.id);
    out.push(r);
  }
  return out;
}

/* ------------------------------------------------------- whole-dashboard */

/**
 * How many rows a dashboard queue carries.
 *
 * A SECOND DEFECT FOUND BY THE STAGE 7 LOAD TEST.
 *
 * `buildDashboard` used to return every record in every queue, and the panel
 * component mapped all of them into rows. On the twenty-two thread dataset a
 * queue holds three or four threads and nobody notices. On ten thousand
 * threads the Reply Queue panel would have built and rendered several thousand
 * rows on the Overview page, which is exactly the "do not load the whole
 * mailbox into the browser" failure, reached by accident rather than by
 * design.
 *
 * Queues are now capped here, at the data layer, and each one reports how many
 * matched. The panel says "showing the first ten of N" and links to the view
 * that paginates properly. Capping in the component instead would have left
 * the cost of building the rows in place.
 */
export const QUEUE_PREVIEW_SIZE = 10;

export interface DashboardData {
  accountId: string;
  now: string;
  records: ThreadRecord[];
  metrics: MetricCount[];
  queues: {
    key: QueueKey;
    label: string;
    description: string;
    emptyMessage: string;
    /** At most QUEUE_PREVIEW_SIZE records. */
    records: ThreadRecord[];
    /** How many matched the queue, which is usually more than are shown. */
    totalRecords: number;
  }[];
}

/**
 * Builds the whole dashboard for one account.
 *
 * `extra` is the header state: date range, folder, search. It narrows
 * everything on the page at once, which is what a person expects when they
 * change a filter at the top of a dashboard.
 */
export function buildDashboard(
  dataset: AccountDataset,
  now: string,
  extra: ThreadFilter = {}
): DashboardData {
  const all = recordsFor(dataset);
  // The header filter is applied once, here. Every count and queue below reads
  // from the same narrowed set, so the page cannot disagree with itself.
  const scoped = Object.keys(extra).length > 0 ? applyFilter(all, { includeBulk: true, includeDuplicates: true, includeResolved: true, ...extra }) : all;

  return {
    accountId: dataset.account.id,
    now,
    records: scoped,
    metrics: metricCounts(scoped, now),
    queues: QUEUES.map((q) => {
      const built = q.build(scoped, now);
      return {
        key: q.key,
        label: q.label,
        description: q.description,
        emptyMessage: q.emptyMessage,
        records: built.slice(0, QUEUE_PREVIEW_SIZE),
        totalRecords: built.length,
      };
    }),
  };
}
