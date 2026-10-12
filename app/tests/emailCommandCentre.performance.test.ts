/**
 * Email Command Centre, Stage 7 performance tests.
 *
 * The brief asks for realistic synthetic volumes at 100, 1,000 and 10,000
 * threads. This file measures the layers that run on every render and the ones
 * that run when a person changes a filter, at each volume, and asserts two
 * things about each: that it finishes inside a budget, and that it scales
 * roughly linearly.
 *
 * The second assertion is the one that matters. A budget catches today's slow
 * function; a scaling check catches the accidental O(n squared) that is fast at
 * 1,000 and unusable at 10,000. Comparing the per-thread cost at 10,000 with
 * the per-thread cost at 1,000 is how that shows up before a customer finds it.
 *
 * Budgets are generous on purpose. They are there to catch a change in
 * complexity, not to police a few milliseconds on a shared build machine.
 *
 * Run: bun app/tests/emailCommandCentre.performance.test.ts
 */
import { generateVolumeDataset } from './support/volume';
import { recordsFor, applyFilter } from '../src/lib/email/filters';
import { metricCounts, buildDashboard } from '../src/lib/email/aggregation';
import {
  needsAttentionItems,
  replyQueueItems,
  datedItems,
  waitingItems,
  quickWinItems,
  sortAllEmail,
  paginate,
} from '../src/lib/email/views';
import { buildBacklogBatch, DEFAULT_BACKLOG_SELECTION } from '../src/lib/email/backlog';
import { DEMO_NOW } from '../src/lib/email/data/clock';

let failures = 0;
let checks = 0;

function assert(condition: boolean, description: string): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${description}`);
  }
}

function group(name: string): void {
  console.log(`\n${name}`);
}

/** Median of several runs, so one unlucky garbage collection is not the result. */
function timeMs(label: string, fn: () => unknown, runs = 5): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  void label;
  return median;
}

const VOLUMES = [100, 1_000, 10_000] as const;

interface Measurement {
  threads: number;
  recordsFor: number;
  applyFilter: number;
  metricCounts: number;
  dashboard: number;
  needsAttention: number;
  replyQueue: number;
  dated: number;
  waiting: number;
  quickWins: number;
  sortAndPage: number;
  backlogBatch: number;
  /** Bytes of JSON, as a rough proxy for what a page would have to hold. */
  datasetBytes: number;
}

const results: Measurement[] = [];

for (const threadCount of VOLUMES) {
  group(`${threadCount.toLocaleString('en-AU')} threads`);

  const accountId = `acct-vol-${threadCount}`;
  const dataset = generateVolumeDataset({ accountId, threadCount });

  assert(dataset.threads.length === threadCount, `The dataset really holds ${threadCount} threads.`);
  assert(dataset.messages.length > threadCount, 'With more messages than threads.');

  const records = recordsFor(dataset);
  assert(records.length === threadCount, 'Every thread produced a record.');

  const measurement: Measurement = {
    threads: threadCount,
    recordsFor: timeMs('recordsFor', () => recordsFor(dataset)),
    applyFilter: timeMs('applyFilter', () =>
      applyFilter(records, { accountId, priorityBands: ['immediate', 'today', 'soon'] })
    ),
    metricCounts: timeMs('metricCounts', () => metricCounts(records, DEMO_NOW)),
    dashboard: timeMs('buildDashboard', () => buildDashboard(dataset, DEMO_NOW)),
    needsAttention: timeMs('needsAttention', () =>
      needsAttentionItems(records, dataset.account.label, DEMO_NOW)
    ),
    replyQueue: timeMs('replyQueue', () => replyQueueItems(records, dataset.drafts, DEMO_NOW)),
    dated: timeMs('datedItems', () => datedItems(records, DEMO_NOW, [])),
    waiting: timeMs('waitingItems', () => waitingItems(records, DEMO_NOW)),
    quickWins: timeMs('quickWinItems', () => quickWinItems(records, DEMO_NOW)),
    sortAndPage: timeMs('sortAndPage', () =>
      paginate(sortAllEmail(records, { key: 'priority', direction: 'desc' }, DEMO_NOW), 0, 25)
    ),
    backlogBatch: timeMs('backlogBatch', () =>
      buildBacklogBatch(
        records,
        { ...DEFAULT_BACKLOG_SELECTION, accountId, accountType: 'work', unresolvedOnly: false, batchSize: 25 },
        DEMO_NOW
      )
    ),
    datasetBytes: JSON.stringify(dataset).length,
  };

  results.push(measurement);

  const report = (label: string, value: number, budgetMs: number) => {
    console.log(`  ${label.padEnd(16)} ${value.toFixed(1).padStart(8)} ms   budget ${budgetMs} ms`);
    assert(value < budgetMs, `${label} at ${threadCount} threads is within ${budgetMs} ms (${value.toFixed(1)}).`);
  };

  // Budgets scale with the volume, because the work genuinely does.
  const scale = threadCount / 1_000;
  report('recordsFor', measurement.recordsFor, Math.max(60, 400 * scale));
  report('applyFilter', measurement.applyFilter, Math.max(25, 120 * scale));
  report('metricCounts', measurement.metricCounts, Math.max(40, 250 * scale));
  report('buildDashboard', measurement.dashboard, Math.max(80, 600 * scale));
  report('needsAttention', measurement.needsAttention, Math.max(40, 250 * scale));
  report('replyQueue', measurement.replyQueue, Math.max(40, 250 * scale));
  report('datedItems', measurement.dated, Math.max(40, 250 * scale));
  report('waitingItems', measurement.waiting, Math.max(40, 250 * scale));
  report('quickWins', measurement.quickWins, Math.max(40, 250 * scale));
  report('sortAndPage', measurement.sortAndPage, Math.max(40, 300 * scale));
  report('backlogBatch', measurement.backlogBatch, Math.max(40, 300 * scale));
}

/* ------------------------------------------------------------- scaling */

group('Cost per thread does not grow with the number of threads');

{
  const mid = results.find((r) => r.threads === 1_000)!;
  const big = results.find((r) => r.threads === 10_000)!;

  const perThread = (value: number, threads: number) => value / threads;

  const layers: [keyof Measurement, string, number][] = [
    ['recordsFor', 'recordsFor', 4],
    ['applyFilter', 'applyFilter', 4],
    ['metricCounts', 'metricCounts', 4],
    ['needsAttention', 'needsAttention', 4],
    ['replyQueue', 'replyQueue', 4],
    ['dated', 'datedItems', 4],
    ['waiting', 'waitingItems', 4],
    ['quickWins', 'quickWinItems', 4],
    // Sorting is n log n, so a slightly higher ratio is correct rather than a
    // defect. The budget allows for it without allowing for n squared.
    ['sortAndPage', 'sortAndPage', 6],
    ['backlogBatch', 'backlogBatch', 6],
  ];

  for (const [key, label, allowedRatio] of layers) {
    const midCost = perThread(mid[key] as number, mid.threads);
    const bigCost = perThread(big[key] as number, big.threads);
    // A floor, because a sub-millisecond measurement at 1,000 threads makes any
    // ratio meaningless. Below it, the layer is fast enough that the ratio is
    // noise rather than a signal.
    const ratio = midCost < 0.0005 ? 1 : bigCost / midCost;
    console.log(`  ${label.padEnd(16)} ${ratio.toFixed(2)}x per-thread cost at 10k vs 1k`);
    assert(
      ratio < allowedRatio,
      `${label} scales roughly linearly (${ratio.toFixed(2)}x, allowed under ${allowedRatio}x).`
    );
  }
}

/* --------------------------------------------------- what reaches a page */

group('A page never holds the whole mailbox');

{
  const big = results.find((r) => r.threads === 10_000)!;
  const dataset = generateVolumeDataset({ accountId: 'acct-vol-page', threadCount: 10_000 });
  const records = recordsFor(dataset);

  console.log(`  A 10,000 thread dataset is ${(big.datasetBytes / 1_000_000).toFixed(1)} MB of JSON.`);
  assert(
    big.datasetBytes > 5_000_000,
    'The 10,000 thread dataset is large enough that shipping it to a browser would be a real problem.'
  );

  const page = paginate(sortAllEmail(records, { key: 'priority', direction: 'desc' }, DEMO_NOW), 0, 25);
  assert(page.items.length === 25, 'All Email renders 25 rows at a time.');
  assert(page.totalItems === 10_000, 'While reporting the true total.');
  assert(page.totalPages === 400, 'Across 400 pages.');

  const pageBytes = JSON.stringify(page.items.map((r) => r.thread)).length;
  console.log(`  One page of threads is ${(pageBytes / 1_000).toFixed(1)} kB.`);
  assert(pageBytes < 100_000, 'One page is small enough to render without thought.');

  const batch = buildBacklogBatch(
    records,
    {
      ...DEFAULT_BACKLOG_SELECTION,
      accountId: 'acct-vol-page',
      accountType: 'work',
      unresolvedOnly: false,
      batchSize: 50,
    },
    DEMO_NOW
  );
  assert(batch.items.length === 50, 'A backlog batch is 50 items, not 10,000.');
  assert(batch.totalMatched > 50, 'And it says how many matched without rendering them.');

  // The dashboard queues are capped, which is the other way a page could end up
  // holding everything.
  const dashboard = buildDashboard(dataset, DEMO_NOW);
  for (const queue of dashboard.queues) {
    assert(
      queue.records.length <= 10,
      `The ${queue.key} queue shows at most ten rows (${queue.records.length}).`
    );
    assert(
      queue.totalRecords >= queue.records.length,
      `The ${queue.key} queue reports the true match count as well.`
    );
  }
  const busiest = dashboard.queues.reduce((a, b) => (b.totalRecords > a.totalRecords ? b : a));
  assert(
    busiest.totalRecords > 10,
    'At least one queue genuinely matched more than ten threads, so the cap is doing something.'
  );
}

/* ------------------------------------------------------------- summary */

group('Measurements');

console.log('\n  threads   recordsFor  dashboard   allEmail   backlog   dataset');
for (const r of results) {
  console.log(
    `  ${String(r.threads).padStart(7)}   ${r.recordsFor.toFixed(1).padStart(8)}ms  ${r.dashboard
      .toFixed(1)
      .padStart(8)}ms  ${r.sortAndPage.toFixed(1).padStart(7)}ms  ${r.backlogBatch
      .toFixed(1)
      .padStart(6)}ms  ${(r.datasetBytes / 1_000_000).toFixed(1).padStart(5)}MB`
  );
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre Stage 7 performance: all checks passed.');
