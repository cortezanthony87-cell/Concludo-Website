/**
 * What the Overview page shows, and in what order.
 *
 * THE PROBLEM THIS SOLVES, recorded because it was the main finding of looking
 * at the finished dashboard with fresh eyes.
 *
 * The Stage 2 dashboard rendered eight equal metric cards and seven equal
 * panels. On the synthetic account it ran to 4,265 pixels, and the single most
 * consequential thread in the inbox, an invoice redirection attempt, appeared
 * **four times**: in Handle First, in Today's Workload, in Reply Queue and in
 * Security Review. Three other threads appeared three times each. A dashboard
 * that repeats itself makes an inbox look larger than it is, buries the one
 * thing that matters among copies of itself, and asks a person to scroll past
 * the same row four times to find out there was nothing new in it.
 *
 * Nothing was wrong with the queues. Each one was correctly computed. The
 * mistake was showing all of them at once, in full, with no notion that a
 * thread already shown is a thread already seen.
 *
 * So this module composes the page instead:
 *
 * 1. **One thread is the answer to "what first".** It gets the top of the page
 *    on its own, with the reason and the next step.
 * 2. **Every thread appears once.** A thread is claimed by the highest-priority
 *    section it qualifies for, and later sections do not repeat it. The count
 *    on each section is the true count, so nothing is hidden by being
 *    deduplicated: the section says "4 more in Reply Queue".
 * 3. **Security sits apart.** It is not mixed into routine priority, which is
 *    a rule the module has held since Stage 4 and which the dashboard was
 *    quietly breaking by listing a flagged thread in three ordinary panels.
 */
import { ThreadRecord } from './filters';
import { QUEUE_PREVIEW_SIZE } from './aggregation';
import { EmailModulePath } from './types';
import { compareByPriority } from './priority';
import { queueRecords } from './aggregation';
import { applyFilter } from './filters';

export interface OverviewSection {
  key: 'needs_you' | 'dated' | 'waiting' | 'quick_wins';
  title: string;
  /** One line under the title. */
  description: string;
  /** Said when the section is empty, as an outcome rather than a failure. */
  emptyMessage: string;
  destination: EmailModulePath;
  /** The rows to draw, already deduplicated against earlier sections. */
  records: ThreadRecord[];
  /** How many the section's own queue holds, before deduplication or capping. */
  total: number;
  /** How many were left out because an earlier section already showed them. */
  alreadyShown: number;
}

export interface OverviewComposition {
  /** The single thread to handle first, or null when there is nothing to do. */
  lead: ThreadRecord | null;
  /** Why it leads, in one phrase. */
  leadReason: string;
  sections: OverviewSection[];
  /** Flagged threads, kept out of every other section. */
  security: ThreadRecord[];
  /** Threads that have not been analysed. */
  unanalysed: number;
  /** True when there is genuinely nothing waiting on the person. */
  allClear: boolean;
}

const SECTION_SIZE = 4;

function sortRecords(records: readonly ThreadRecord[]): ThreadRecord[] {
  return records.slice().sort((a, b) =>
    compareByPriority(
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
    )
  );
}

/**
 * Composes the page.
 *
 * The order of the sections is the order of consequence, and the claiming runs
 * in that order, so a thread that is both overdue and awaiting a reply is shown
 * once, under the heading that describes the more expensive of the two.
 */
export function composeOverview(
  records: readonly ThreadRecord[],
  now: string
): OverviewComposition {
  const security = sortRecords(
    applyFilter(records, { securityFlagged: true, includeBulk: true })
  );
  const flagged = new Set(security.map((r) => r.thread.id));

  const unanalysed = records.filter((r) => !r.analysis.analysed).length;

  // Security is claimed first and never released, so no flagged thread can
  // appear in a routine section further down.
  const claimed = new Set<string>(flagged);

  const lead = sortRecords(
    queueRecords(records, 'handle_first', now).filter((r) => !flagged.has(r.thread.id))
  )[0] ?? null;

  if (lead) claimed.add(lead.thread.id);

  const definitions: {
    key: OverviewSection['key'];
    title: string;
    description: string;
    emptyMessage: string;
    destination: EmailModulePath;
    queue: Parameters<typeof queueRecords>[1];
  }[] = [
    {
      key: 'needs_you',
      title: 'Then these',
      description: 'The rest of what is waiting on an answer from you.',
      emptyMessage: 'Nothing else is waiting on you.',
      destination: '/email/reply-queue',
      queue: 'reply_queue',
    },
    {
      key: 'dated',
      title: 'Has a date on it',
      description: 'Commitments with a day attached, soonest first.',
      emptyMessage: 'Nothing has a date against it.',
      destination: '/email/actions-deadlines',
      queue: 'todays_workload',
    },
    {
      key: 'quick_wins',
      title: 'Two minutes each',
      description: 'Short to answer. Short is not the same as unimportant.',
      emptyMessage: 'No short jobs waiting.',
      destination: '/email/quick-wins',
      queue: 'quick_wins',
    },
    {
      key: 'waiting',
      title: 'Waiting on someone else',
      description: 'You have done your part. Shown so it is not forgotten.',
      emptyMessage: 'You are not waiting on anybody.',
      destination: '/email/waiting',
      queue: 'waiting',
    },
  ];

  const sections: OverviewSection[] = definitions.map((definition) => {
    const queue = sortRecords(
      queueRecords(records, definition.queue, now).filter((r) => !flagged.has(r.thread.id))
    );
    const fresh = queue.filter((r) => !claimed.has(r.thread.id));
    const shown = fresh.slice(0, SECTION_SIZE);
    for (const r of shown) claimed.add(r.thread.id);

    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      emptyMessage: definition.emptyMessage,
      destination: definition.destination,
      records: shown,
      total: queue.length,
      alreadyShown: queue.length - fresh.length,
    };
  });

  const leadReason = lead ? leadReasonFor(lead) : '';

  return {
    lead,
    leadReason,
    sections,
    security: security.slice(0, QUEUE_PREVIEW_SIZE),
    unanalysed,
    allClear: lead === null && security.length === 0 && sections.every((s) => s.total === 0),
  };
}

function leadReasonFor(record: ThreadRecord): string {
  // The escalation reason, where there is one, is already the first entry in
  // `reasons`: `buildPriority` puts it there deliberately, because it is the
  // one a person most needs to see. So the first reason is the right line and
  // there is no separate escalation field to read.
  const first = record.analysis.priorityReasons[0];
  if (first) return first;
  return `Highest priority on this account, in the ${record.analysis.priorityBand} band.`;
}

/**
 * The metric rail.
 *
 * The same eight counts as before, because each one is the index to a view and
 * removing one would hide a view. What changes is the weighting: the two that
 * carry consequence are marked, and the rest are a quiet row rather than eight
 * cards competing with the thing a person should actually read first.
 */
export interface RailMetric {
  key: string;
  label: string;
  count: number;
  destination: EmailModulePath;
  /** 'alert' for security, 'attention' where the count is work, else 'quiet'. */
  tone: 'alert' | 'attention' | 'quiet';
  /** One sentence, for the accessible name. */
  explanation: string;
}
