/**
 * The CRM overview: how the business is going, in one screen.
 *
 * WHAT THIS IS, AND WHY IT IS NOT THE TODAY PAGE.
 *
 * Today answers "what do I need to do next". It is a working list, and every
 * row on it is an instruction with a reason. This answers a different
 * question: "how is this going". It is a reporting view, and nothing on it is
 * an instruction.
 *
 * Both are needed and neither replaces the other. A person opens Today in the
 * morning and this before a board meeting or at the end of a week.
 *
 * WHAT WAS TAKEN FROM THE DASHBOARDS THIS WAS MODELLED ON, AND WHAT WAS NOT.
 *
 * Taken: headline figures at the top, a stage breakdown, value by quarter,
 * where the work came from, and value by customer. Those are the right
 * questions and the established shape is established because it works.
 *
 * Not taken, deliberately:
 *
 *   NO SCORES AND NO RANKINGS. Not of accounts and above all not of people.
 *   The schema refuses the column: migrations 0008 and 0009 fail the deploy if
 *   anything named like a score, a ranking or a per-user count appears on a
 *   CRM table, or if a view groups one by a user. This module returns no
 *   figure keyed to a person and takes no user id as an argument.
 *
 *   NO COST, PROFIT OR CHURN RATE. A CRM does not hold cost or profit data.
 *   Putting those on a CRM dashboard means inventing them or importing them
 *   from somewhere this product cannot see, and a figure nobody can check is
 *   worse than a gap somebody can.
 *
 *   NO TARGET ARROWS. "Down four per cent against target" needs a target.
 *   Nobody has set one, and a target the product invented is a judgement
 *   wearing a percentage.
 *
 * WHICH PERCENTAGES ARE HONEST, AND WHICH ARE NOT.
 *
 * Every percentage on this page is a SHARE OF A RECORDED WHOLE: this stage's
 * value as a share of open pipeline, this source as a share of enquiries, the
 * promises we owe as a share of promises outstanding. The denominator is
 * always on the page beside it, and it is always a count or total this
 * workspace holds.
 *
 * Three kinds of percentage are refused, because the denominator does not
 * exist in a CRM:
 *
 *   PER CENT TO TARGET. There is no target. Covered above.
 *   WIN RATE AS A HEADLINE. Won over won-plus-lost is a real ratio, but over
 *   a quarter it moves on one deal and reads as a trend. It belongs in a
 *   report over a long window, not on a tile.
 *   PER CENT GROWTH off a base of one or two records. A quarter that went
 *   from one win to two did not grow by a hundred per cent in any sense a
 *   person should repeat, so quarter-on-quarter change is only computed where
 *   both quarters hold at least three recorded outcomes.
 *
 * One percentage here is not a share of the data but a statement about it:
 * every money tile carries the proportion of its records that have a value
 * recorded. That is how much of the list the total actually covers, and it is
 * the first thing anybody should want to know about a total.
 *
 * WHAT IS BETTER HERE THAN IN THE SHAPE IT COPIES.
 *
 * A funnel tells you what is in each stage. It does not tell you what is
 * STUCK, which is the thing a person can act on. Every stage here carries the
 * count that has been sitting longer than that stage usually takes, measured
 * against the stage's own `typicalDays` rather than one global number.
 *
 * And every figure on this page says what it was computed from, including how
 * many records had nothing recorded. A total that silently drops the eleven
 * work items with no value is a total that disagrees with the list behind it.
 */

import { CrmWorkspaceData } from '../domain';
import { onWriteInvalidate } from '../cacheBus';
import { indexFor } from '../stage8/paging';
import { workspaceAttention } from '../phase2/signals';
import { buildTimeline } from '../stage4/timeline';

const DAY = 86_400_000;

/* ===================================================== the shapes */

export interface Figure {
  key: string;
  label: string;
  /** The formatted value, as the page shows it. */
  value: string;
  /** What it was read from, in a few words. Never empty. */
  basis: string;
  /**
   * What the figure leaves out, where it leaves anything out.
   *
   * A total over records where some have no value recorded is not wrong, but
   * it is not the whole list either, and the person reading it should be the
   * one who decides whether that matters.
   */
  omits: string | null;
  /** Where to open the records behind it. Never null: a figure with no destination is a poster. */
  path: string;
  /**
   * How much of the list the figure covers, where that is knowable.
   *
   * On a money total this is the proportion of records with a value recorded.
   * It is drawn as a thin bar under the figure, so a total built on half the
   * list cannot look like a total built on all of it.
   */
  coverage: Coverage | null;
}

export interface Coverage {
  /** Whole per cent, 0 to 100. */
  percent: number;
  /** Reads as a sentence: "3 of 4 open items have a value recorded". */
  label: string;
}

/**
 * One wedge of a ring, or one band of a stacked bar.
 *
 * `share` is a whole number and the shares across one chart sum to exactly
 * 100, by largest remainder. `fraction` is the exact proportion, and the arc
 * angles are built from that rather than from the rounded share, so the
 * drawing is true even where the label is rounded.
 */
export interface Slice {
  key: string;
  label: string;
  /** The money total for this slice, where the chart is about money. */
  value: number;
  /** The record count for this slice, always. */
  count: number;
  /** Whole per cent of the chart total. Sums to 100 across the chart. */
  share: number;
  /** The exact proportion, 0 to 1. What the geometry is built from. */
  fraction: number;
  /** Degrees clockwise from twelve o'clock. */
  startAngle: number;
  endAngle: number;
  /** Ramp position 0 to 7, or -1 for the single gold wedge. */
  tone: number;
  path: string | null;
  /** True where this wedge is the grouped tail of the smaller ones. */
  grouped: boolean;
  /** How many original categories the tail holds. Zero when not grouped. */
  groupedCount: number;
}

/**
 * A ring chart, with its denominator stated.
 *
 * A ring with one wedge is not a chart, it is the number 100 drawn as a
 * circle. Where `slices` holds fewer than two, the page says the single value
 * in words instead. The module still returns the slice, because which of the
 * two the page drew is then testable.
 */
export interface Donut {
  key: string;
  label: string;
  /** The question the ring answers, shown under the heading. */
  question: string;
  unit: 'count' | 'money';
  /** The denominator. Every share on the ring is of this. */
  total: number;
  /** The denominator in words, for the title and the screen reader. */
  totalLabel: string;
  /**
   * The denominator split for the hole in the ring: a figure and a unit.
   *
   * One string does not fit. "2 outstanding" wrapped inside a 170px ring on a
   * phone and the word collided with the wedges. A short figure on one line
   * with its unit under it fits at every width this page is used at.
   */
  totalFigure: string;
  totalUnit: string;
  slices: Slice[];
  basis: string;
  omits: string | null;
}

export interface StageRow {
  stageId: string;
  name: string;
  /** Open work items in this stage. */
  count: number;
  value: number;
  /** This stage's value as a whole per cent of open pipeline value. */
  valueShare: number;
  /** This stage's count as a whole per cent of open items. */
  countShare: number;
  /** How long this stage usually takes, from the stage's own record. */
  typicalDays: number;
  /** Sitting here longer than this stage usually takes. The actionable part. */
  stuck: number;
  /** Stuck as a whole per cent of this stage's own count, not of the pipeline. */
  stuckShare: number;
  /** The longest anything here has sat, in days. */
  longestDays: number;
}

export interface QuarterRow {
  key: string;
  label: string;
  won: number;
  wonCount: number;
  /** This quarter as a whole per cent of the quarters shown. */
  share: number;
  /** Height as a proportion of the tallest column shown, 0 to 1. */
  fraction: number;
  /**
   * Change on the previous quarter, in whole per cent, or null.
   *
   * Null unless both quarters hold at least three recorded outcomes.
   * Doubling off a base of one is not a trend, and printing it as one is how
   * a dashboard starts lying politely.
   */
  changePercent: number | null;
}

export interface NamedValue {
  key: string;
  label: string;
  /** A money total where the panel is about money, otherwise zero. */
  value: number;
  count: number;
  /** Whole per cent of the panel's total. Sums to 100 down the panel. */
  share: number;
  /** Bar length as a proportion of the largest row, 0 to 1. */
  fraction: number;
  path: string | null;
}

export interface ChangeRow {
  id: string;
  title: string;
  occurredAt: string;
  kind: string;
  organisationName: string | null;
  path: string;
}

export interface Overview {
  figures: Figure[];
  stages: StageRow[];
  quarters: QuarterRow[];
  sources: NamedValue[];
  accounts: NamedValue[];
  /** The three rings: open pipeline by stage, enquiries by source, promises by owner. */
  donuts: Donut[];
  conditions: { condition: string; label: string; count: number; share: number }[];
  changes: ChangeRow[];
  /** The currency every money figure on the page is in. */
  currency: string;
  /** Said on the page, under the heading. */
  note: string;
  /** When this was computed, so a stale tab is visible as one. */
  computedAt: string;
}

export const OVERVIEW_NOTE =
  'Every figure here is a count or a total over records in this workspace, and every one of them opens the records it came from. Nothing on this page is a score, a ranking or a judgement about a person.';

/* ===================================================== money */

export function formatMoney(amount: number, currency = 'AUD'): string {
  const prefix = currency === 'AUD' ? 'AU$' : `${currency} `;
  if (Math.abs(amount) >= 1_000_000) return `${prefix}${(amount / 1_000_000).toFixed(1)}m`;
  if (Math.abs(amount) >= 1_000) return `${prefix}${Math.round(amount / 1_000)}k`;
  return `${prefix}${Math.round(amount)}`;
}

/* ===================================================== percentages

   Shares are rounded by largest remainder, not independently.

   Four categories each holding an eighth round to 13 per cent apiece and the
   legend adds up to 52. Rounding them independently is the single most common
   way a dashboard prints a column of percentages that does not sum to the
   whole, and somebody always notices. So: floor every share, then hand the
   remaining points to the largest fractional parts, ties going to the earlier
   entry so the same data always rounds the same way.                      */

/**
 * Whole per cent shares of `total` that sum to exactly 100.
 *
 * Returns zeroes where the total is zero: a share of nothing is not 100 per
 * cent of anything, and dividing by zero to get a chart is how a panel full
 * of "NaN%" reaches a buyer.
 */
export function wholeShares(amounts: number[], total: number): number[] {
  if (amounts.length === 0) return [];
  if (total <= 0) return amounts.map(() => 0);

  /* A caller can pass a total smaller than the sum of its parts. That is a
     bug in the caller, but it must not reach a reader as a column of
     percentages adding to 250, so the denominator falls back to the only
     self-consistent one available: what was actually passed. */
  const parts = amounts.reduce((sum, amount) => sum + amount, 0);
  const denominator = parts > total ? parts : total;

  const exact = amounts.map((amount) => (amount / denominator) * 100);
  const floors = exact.map((value) => Math.floor(value));
  const assigned = floors.reduce((sum, value) => sum + value, 0);

  const remaining = Math.max(0, Math.min(100 - assigned, amounts.length));

  const order = exact
    .map((value, i) => ({ i, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  const shares = [...floors];
  for (let n = 0; n < remaining && n < order.length; n += 1) {
    shares[order[n].i] += 1;
  }
  return shares;
}

/** One share, rounded on its own. For a figure that stands alone, not a column. */
function onePercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/* ===================================================== ring geometry

   Angles come from the exact fractions, never from the rounded shares, so a
   legend reading 33 / 33 / 34 still draws three equal thirds. The last wedge
   is closed on 360 explicitly rather than by accumulation, because floating
   point otherwise leaves a hairline gap at twelve o'clock that looks like a
   rendering fault and gets reported as one.                               */

interface SliceInput {
  key: string;
  label: string;
  value: number;
  count: number;
  path: string | null;
  /** Set on the one wedge that is the thing to act on. At most one per ring. */
  accent?: boolean;
}

/**
 * Turns categories into wedges, grouping the tail beyond `maxSlices`.
 *
 * A ring with fifteen wedges cannot be read, which is why the pie charts on
 * the dashboards this was modelled on are their weakest panel. Past the cap
 * the smallest categories are grouped into one wedge that says how many it
 * holds, and the full list stays in the panel below.
 *
 * WITH ONE CONDITION, FOUND BY LOOKING AT THE RENDERED RING.
 *
 * Seven enquiries from seven different sources grouped the smallest two into
 * a wedge of 29 per cent, which was then the largest wedge on a chart where
 * every real category held 14. The tidying had invented the biggest thing on
 * the picture. So the tail is only grouped where it would be SMALLER than the
 * smallest wedge kept. That is the case grouping is for, a long tail of
 * slivers, and it is the only case where grouping makes a ring easier to
 * read rather than harder.
 *
 * The grouped wedge never takes the accent tone: a bucket is not an action.
 */
function sliceUp(entries: SliceInput[], maxSlices: number, by: 'value' | 'count'): Slice[] {
  const amountOf = (entry: SliceInput) => (by === 'value' ? entry.value : entry.count);
  const sorted = [...entries]
    .filter((entry) => amountOf(entry) > 0)
    .sort((a, b) => amountOf(b) - amountOf(a) || a.label.localeCompare(b.label, 'en-AU'));

  let kept: SliceInput[] = sorted;
  let tail: SliceInput[] = [];
  if (sorted.length > maxSlices) {
    const candidateKept = sorted.slice(0, maxSlices - 1);
    const candidateTail = sorted.slice(maxSlices - 1);
    const tailAmount = candidateTail.reduce((sum, entry) => sum + amountOf(entry), 0);
    const smallestKept = amountOf(candidateKept[candidateKept.length - 1]);

    if (tailAmount < smallestKept) {
      kept = candidateKept;
      tail = candidateTail;
    }
    /* Otherwise every category stays its own wedge. The ramp carries eight
       tones, so up to eight read apart; past that the ring is drawn anyway
       and the legend is what people read, which is still better than a
       grouped wedge that outsizes the real ones. */
  }

  const rows: (SliceInput & { grouped: boolean; groupedCount: number })[] = kept.map((entry) => ({
    ...entry,
    grouped: false,
    groupedCount: 0,
  }));

  if (tail.length > 0) {
    rows.push({
      key: 'grouped_tail',
      label: `${tail.length} smaller ${tail.length === 1 ? 'category' : 'categories'}`,
      value: tail.reduce((sum, entry) => sum + entry.value, 0),
      count: tail.reduce((sum, entry) => sum + entry.count, 0),
      path: null,
      accent: false,
      grouped: true,
      groupedCount: tail.length,
    });
  }

  const total = rows.reduce((sum, row) => sum + amountOf(row), 0);
  const shares = wholeShares(
    rows.map((row) => amountOf(row)),
    total
  );

  /* Tones are spread across the ramp rather than taken in order.
     Two wedges taking ramp 0 and ramp 1 are both navy and read as one shape
     with a seam in it, which is how the two-stage ring looked on screen. Two
     wedges now take the ends of the ramp, three take the ends and the middle,
     and a full ring uses all eight.

     Where a ring carries the gold wedge, the rest keep to the darker half of
     the ramp. Gold beside the palest grey is a thin pairing on white, and the
     grey wedge ends up looking like the ring's empty track rather than a
     share of it. */
  const hasAccent = rows.some((row) => row.accent && !row.grouped);
  const top = hasAccent ? 4 : 7;
  const toneFor = (i: number): number => {
    if (rows.length <= 1) return 0;
    return Math.round((i * top) / (rows.length - 1));
  };

  let angle = 0;
  return rows.map((row, i) => {
    const fraction = total > 0 ? amountOf(row) / total : 0;
    const start = angle;
    angle += fraction * 360;
    const end = i === rows.length - 1 ? 360 : angle;
    return {
      key: row.key,
      label: row.label,
      value: row.value,
      count: row.count,
      share: shares[i],
      fraction,
      startAngle: start,
      endAngle: end,
      tone: row.accent && !row.grouped ? -1 : toneFor(i),
      path: row.path,
      grouped: row.grouped,
      groupedCount: row.groupedCount,
    };
  });
}

function quarterOf(iso: string): { key: string; label: string } {
  const date = new Date(Date.parse(iso));
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  const year = date.getUTCFullYear();
  return { key: `${year}-Q${q}`, label: `Q${q} ${year}` };
}

/* ===================================================== the build */

function build(data: CrmWorkspaceData, now: string): Overview {
  const index = indexFor(data);
  const nowMs = Date.parse(now);

  const liveWork = data.workItems.filter((item) => item.deletedAt === null);
  const open = liveWork.filter((item) => item.status === 'open');
  const won = liveWork.filter((item) => item.status === 'won');

  /* ---- the four headline figures ---- */

  const openValued = open.filter((item) => item.valueAmount !== null);
  const openValue = openValued.reduce((sum, item) => sum + (item.valueAmount ?? 0), 0);
  const openUnvalued = open.length - openValued.length;

  /* A rolling ninety days rather than the calendar quarter.
     A quarter figure spends its first fortnight near zero and reads as
     broken, and a consultant does not run on a fiscal calendar anyway. */
  const since = nowMs - 90 * DAY;
  const wonRecently = won.filter(
    (item) => item.resolvedAt !== null && Date.parse(item.resolvedAt) >= since
  );
  const wonRecentlyValue = wonRecently.reduce((sum, item) => sum + (item.valueAmount ?? 0), 0);
  const wonUnvalued = wonRecently.filter((item) => item.valueAmount === null).length;

  const attention = workspaceAttention(data, now);

  const outstanding = data.commitments.filter(
    (commitment) => commitment.deletedAt === null && commitment.state !== 'done'
  );
  const outstandingOurs = outstanding.filter((commitment) => commitment.ownedByUs);

  const currency = open.find((item) => item.valueCurrency)?.valueCurrency ?? 'AUD';

  const figures: Figure[] = [
    {
      key: 'open_value',
      label: 'Open work',
      value: formatMoney(openValue, currency),
      basis: `${open.length} open ${open.length === 1 ? 'item' : 'items'}`,
      omits:
        openUnvalued > 0
          ? `${openUnvalued} with no value recorded, so the total is lower than the list`
          : null,
      path: '/crm/pipeline',
      coverage: {
        percent: onePercent(openValued.length, open.length),
        label: `${openValued.length} of ${open.length} open ${open.length === 1 ? 'item has' : 'items have'} a value recorded`,
      },
    },
    {
      key: 'won_recent',
      label: 'Won, last 90 days',
      value: formatMoney(wonRecentlyValue, currency),
      basis: `${wonRecently.length} ${wonRecently.length === 1 ? 'piece' : 'pieces'} of work`,
      omits: wonUnvalued > 0 ? `${wonUnvalued} with no value recorded` : null,
      path: '/crm/reports',
      coverage:
        wonRecently.length === 0
          ? null
          : {
              percent: onePercent(wonRecently.length - wonUnvalued, wonRecently.length),
              label: `${wonRecently.length - wonUnvalued} of ${wonRecently.length} ${wonRecently.length === 1 ? 'has' : 'have'} a value recorded`,
            },
    },
    {
      key: 'attention',
      label: 'Accounts needing attention',
      value: String(attention.accountsNeedingAttention),
      basis: `of ${attention.accounts.length} ${attention.accounts.length === 1 ? 'account' : 'accounts'}, against eleven named conditions`,
      omits: null,
      path: '/crm/attention',
      /* The sentence never repeats the percentage: the meter already prints
         it, and "100% 100 per cent of accounts" is what that mistake looks
         like on the rendered tile. */
      coverage: {
        percent: onePercent(attention.accountsNeedingAttention, attention.accounts.length),
        label: `${attention.accountsNeedingAttention} of ${attention.accounts.length} ${attention.accounts.length === 1 ? 'account has' : 'accounts have'} at least one condition`,
      },
    },
    {
      key: 'promises',
      label: 'Promises outstanding',
      value: String(outstanding.length),
      basis: `${outstandingOurs.length} ours, ${outstanding.length - outstandingOurs.length} theirs`,
      omits: null,
      path: '/crm/commitments',
      coverage: {
        percent: onePercent(outstandingOurs.length, outstanding.length),
        label: `${outstandingOurs.length} of ${outstanding.length} ${outstanding.length === 1 ? 'is' : 'are'} ours to keep`,
      },
    },
  ];

  /* ---- the stage breakdown, with what is stuck ---- */

  const stageById = new Map(data.stages.map((stage) => [stage.id, stage]));
  const byStage = new Map<string, StageRow>();

  for (const stage of data.stages) {
    if (stage.isClosed) continue;
    byStage.set(stage.id, {
      stageId: stage.id,
      name: stage.name,
      count: 0,
      value: 0,
      valueShare: 0,
      countShare: 0,
      typicalDays: stage.typicalDays,
      stuck: 0,
      stuckShare: 0,
      longestDays: 0,
    });
  }

  for (const item of open) {
    const row = byStage.get(item.stageId);
    if (!row) continue;
    row.count += 1;
    row.value += item.valueAmount ?? 0;
    const days = Math.floor((nowMs - Date.parse(item.enteredStageAt)) / DAY);
    if (days > row.typicalDays) row.stuck += 1;
    if (days > row.longestDays) row.longestDays = days;
  }

  const stages = [...byStage.values()].sort((a, b) => {
    const sa = stageById.get(a.stageId)?.stageOrder ?? 0;
    const sb = stageById.get(b.stageId)?.stageOrder ?? 0;
    return sa - sb;
  });

  /* Shares of the pipeline, down the funnel. Value and count are divided
     separately, because they rarely agree: a stage holding half the items and
     a tenth of the money is exactly the thing worth seeing, and one combined
     percentage would hide it. */
  const stageValueShares = wholeShares(
    stages.map((stage) => stage.value),
    stages.reduce((sum, stage) => sum + stage.value, 0)
  );
  const stageCountShares = wholeShares(
    stages.map((stage) => stage.count),
    stages.reduce((sum, stage) => sum + stage.count, 0)
  );
  stages.forEach((stage, i) => {
    stage.valueShare = stageValueShares[i];
    stage.countShare = stageCountShares[i];
    stage.stuckShare = onePercent(stage.stuck, stage.count);
  });

  /* The ring is by value, and the gold wedge is the stage holding the most
     stuck work, not the most money. Gold means "look here", and the largest
     stage is not news.

     But a value ring can only mark a stage that has a value. A stage holding
     stuck work and no recorded amount draws no wedge at all, so the worst
     stage overall is sometimes not on this chart. Marking a stage that is not
     the worst, without saying so, would be the chart quietly pointing at the
     wrong thing, so the accent goes to the worst stage ON THE RING and the
     omits line below names the one that is missing. The bar panel carries
     every stage, valued or not, which is why that panel exists as well. */
  const stuckStages = stages.filter((stage) => stage.stuck > 0);
  const worstOverall = stuckStages.reduce<StageRow | null>(
    (worst, stage) => (stage.stuck > (worst?.stuck ?? 0) ? stage : worst),
    null
  );
  const worstStuck = stuckStages
    .filter((stage) => stage.value > 0)
    .reduce<StageRow | null>(
      (worst, stage) => (stage.stuck > (worst?.stuck ?? 0) ? stage : worst),
      null
    );
  const unvaluedStuck = stuckStages.filter((stage) => stage.value === 0);
  const stageDonut: Donut = {
    key: 'pipeline_by_stage',
    label: 'Open pipeline by stage',
    question: 'Where is the money sitting?',
    unit: 'money',
    total: openValue,
    totalLabel: `${formatMoney(openValue, currency)} in total`,
    totalFigure: formatMoney(openValue, currency),
    totalUnit: 'open pipeline',
    slices: sliceUp(
      stages.map((stage) => ({
        key: stage.stageId,
        label: stage.name,
        value: stage.value,
        count: stage.count,
        path: '/crm/pipeline',
        accent: worstStuck !== null && stage.stageId === worstStuck.stageId,
      })),
      8,
      'value'
    ),
    basis: `${open.length} open ${open.length === 1 ? 'item' : 'items'} across ${stages.length} open ${stages.length === 1 ? 'stage' : 'stages'}`,
    omits: [
      openUnvalued > 0
        ? `${openUnvalued} with no value recorded, so ${openUnvalued === 1 ? 'it is' : 'they are'} in the counts and not in the ring`
        : null,
      /* Named, not hidden. A stage the ring cannot draw is exactly the stage
         somebody would otherwise assume is fine. */
      unvaluedStuck.length > 0
        ? `${unvaluedStuck
            .map((stage) => stage.name)
            .join(', ')}, ${unvaluedStuck.length === 1 ? 'which holds' : 'which hold'} stuck work with no value recorded and so ${unvaluedStuck.length === 1 ? 'draws' : 'draw'} no wedge${
            worstOverall !== null && worstStuck !== null && worstOverall.stageId !== worstStuck.stageId
              ? `, including the stage holding the most stuck work of all`
              : ''
          }`
        : null,
    ]
      .filter((line): line is string => line !== null)
      .join('; ') || null,
  };

  /* ---- value closed by quarter ---- */

  const quarterMap = new Map<string, QuarterRow>();
  for (const item of won) {
    if (item.resolvedAt === null) continue;
    const q = quarterOf(item.resolvedAt);
    const row = quarterMap.get(q.key) ?? {
      key: q.key,
      label: q.label,
      won: 0,
      wonCount: 0,
      share: 0,
      fraction: 0,
      changePercent: null,
    };
    row.won += item.valueAmount ?? 0;
    row.wonCount += 1;
    quarterMap.set(q.key, row);
  }
  const quarters = [...quarterMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6);

  /* Columns are drawn against the tallest column shown, which is what makes
     a column chart readable, and the share is of the quarters shown rather
     than of all time, which is what the axis label has to say. */
  const quarterTotal = quarters.reduce((sum, row) => sum + row.won, 0);
  const tallest = quarters.reduce((max, row) => Math.max(max, row.won), 0);
  const quarterShares = wholeShares(
    quarters.map((row) => row.won),
    quarterTotal
  );
  quarters.forEach((row, i) => {
    row.share = quarterShares[i];
    row.fraction = tallest > 0 ? row.won / tallest : 0;
    const previous = i > 0 ? quarters[i - 1] : null;
    /* Three recorded outcomes each side, or no percentage. See the header. */
    row.changePercent =
      previous !== null && previous.won > 0 && previous.wonCount >= 3 && row.wonCount >= 3
        ? Math.round(((row.won - previous.won) / previous.won) * 100)
        : null;
  });

  /* ---- enquiries by source ----

     NOT attribution of won work to its source. That needs a lead joined to
     the work it became, and in this workspace no lead has been converted, so
     the honest chart has one bar reading "no source recorded". A chart whose
     only bar says there is no data is a chart that should not have been
     drawn.

     What IS recorded is where the enquiries waiting at the top came from, so
     that is what this reports. When conversion starts carrying the lead
     through, this panel is where attribution belongs. */

  const sourceMap = new Map<string, NamedValue>();
  for (const lead of data.leads) {
    if (lead.deletedAt !== null) continue;
    if (lead.state === 'not_proceeding') continue;
    const label = lead.source ?? 'No source recorded';
    const key = label.toLowerCase();
    const row = sourceMap.get(key) ?? {
      key,
      label,
      value: 0,
      count: 0,
      share: 0,
      fraction: 0,
      path: '/crm/leads',
    };
    row.count += 1;
    sourceMap.set(key, row);
  }
  const sources = [...sourceMap.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en-AU')
  );
  const sourceTotal = sources.reduce((sum, row) => sum + row.count, 0);
  const biggestSource = sources.reduce((max, row) => Math.max(max, row.count), 0);
  const sourceShares = wholeShares(
    sources.map((row) => row.count),
    sourceTotal
  );
  sources.forEach((row, i) => {
    row.share = sourceShares[i];
    row.fraction = biggestSource > 0 ? row.count / biggestSource : 0;
  });

  /* No accent wedge here. The largest source is not an action: it is where
     the work came from, and gold spent on it would mean nothing. */
  const sourceDonut: Donut = {
    key: 'enquiries_by_source',
    label: 'Enquiries by source',
    question: 'Where is the work coming from?',
    unit: 'count',
    total: sourceTotal,
    totalLabel: `${sourceTotal} ${sourceTotal === 1 ? 'enquiry' : 'enquiries'} in total`,
    totalFigure: String(sourceTotal),
    totalUnit: sourceTotal === 1 ? 'enquiry' : 'enquiries',
    slices: sliceUp(
      sources.map((row) => ({
        key: row.key,
        label: row.label,
        value: 0,
        count: row.count,
        path: '/crm/leads',
      })),
      8,
      'count'
    ),
    basis: `${sourceTotal} live ${sourceTotal === 1 ? 'enquiry' : 'enquiries'}`,
    omits: 'enquiries marked not proceeding, and work that never arrived as an enquiry',
  };

  /* Ours against theirs, which is the only split of a promise that changes
     what anybody does next. Ours takes the gold. */
  const promiseDonut: Donut = {
    key: 'promises_by_owner',
    label: 'Promises outstanding',
    question: 'Who owes what?',
    unit: 'count',
    total: outstanding.length,
    totalLabel: `${outstanding.length} outstanding in total`,
    totalFigure: String(outstanding.length),
    totalUnit: outstanding.length === 1 ? 'promise' : 'promises',
    slices: sliceUp(
      [
        {
          key: 'ours',
          label: 'Ours to keep',
          value: 0,
          count: outstandingOurs.length,
          path: '/crm/commitments',
          accent: true,
        },
        {
          key: 'theirs',
          label: 'Waiting on them',
          value: 0,
          count: outstanding.length - outstandingOurs.length,
          path: '/crm/commitments',
        },
      ],
      8,
      'count'
    ),
    basis: `${outstanding.length} ${outstanding.length === 1 ? 'promise' : 'promises'} not yet met`,
    omits: 'promises already met',
  };

  /* ---- value by customer ----
     A sorted bar, not a doughnut. Five slices of a doughnut plus "other" is a
     chart somebody has to squint at to rank, and ranking is the only thing
     anybody does with it. */

  const accountMap = new Map<string, NamedValue>();
  for (const item of open) {
    if (item.organisationId === null) continue;
    const organisation = index.organisationsById.get(item.organisationId);
    if (!organisation || organisation.deletedAt !== null) continue;
    const row = accountMap.get(item.organisationId) ?? {
      key: item.organisationId,
      label: organisation.name,
      value: 0,
      count: 0,
      share: 0,
      fraction: 0,
      path: `/crm/organisations/${item.organisationId}`,
    };
    row.value += item.valueAmount ?? 0;
    row.count += 1;
    accountMap.set(item.organisationId, row);
  }
  const accounts = [...accountMap.values()]
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'en-AU'))
    .slice(0, 8);

  /* Share of open pipeline value, per customer. This is the concentration
     figure: one customer at sixty per cent of the pipeline is a fact worth
     knowing before anybody celebrates the total. Divided against the whole
     open value rather than the eight shown, so the column is honest about
     what is off the bottom of the list. */
  const biggestAccount = accounts.reduce((max, row) => Math.max(max, row.value), 0);
  const accountShares = wholeShares(
    accounts.map((row) => row.value),
    openValue
  );
  accounts.forEach((row, i) => {
    row.share = accountShares[i];
    row.fraction = biggestAccount > 0 ? row.value / biggestAccount : 0;
  });

  /* ---- the eleven conditions, as counts and shares of accounts ---- */

  const conditions = attention.byCondition
    .map((entry) => ({
      condition: entry.condition,
      label: entry.label,
      count: entry.count,
      share: onePercent(entry.count, attention.accounts.length),
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  /* ---- what changed, newest first ----
     This is the part that makes the page an overview rather than a snapshot:
     anything written anywhere in the module appears here, because it is read
     from the same timeline every other view reads. */

  const changes: ChangeRow[] = buildTimeline(data)
    .slice(0, 12)
    .map((entry) => ({
      id: `${entry.subjectTable}-${entry.subjectId}`,
      title: entry.title,
      occurredAt: entry.occurredAt,
      kind: entry.kind,
      organisationName:
        entry.organisationId === null
          ? null
          : (index.organisationsById.get(entry.organisationId)?.name ?? null),
      path: '/crm/activities',
    }));

  return {
    figures,
    stages,
    quarters,
    sources,
    accounts,
    donuts: [stageDonut, sourceDonut, promiseDonut],
    conditions,
    changes,
    currency,
    note: OVERVIEW_NOTE,
    computedAt: now,
  };
}

/* ===================================================== caching */

/**
 * Cached against the dataset, and dropped on every write.
 *
 * The session store mutates one workspace object in place rather than
 * replacing it, so a cache keyed on that object survives a write and is wrong
 * afterwards. Phase 2A-i found this in five modules at once. The registration
 * below is what makes a figure on this page change when somebody logs a call
 * on another one.
 *
 * Keyed by `now` as well as by the dataset, because "won this quarter" and
 * "stuck longer than usual" both move with the clock.
 */
const cache = new WeakMap<CrmWorkspaceData, Map<string, Overview>>();

export function overviewFor(data: CrmWorkspaceData, now: string): Overview {
  let byNow = cache.get(data);
  if (!byNow) {
    byNow = new Map();
    cache.set(data, byNow);
  }
  const hit = byNow.get(now);
  if (hit) return hit;
  const built = build(data, now);
  byNow.set(now, built);
  return built;
}

/** Drops the cached overview. Registered below, through the import-free bus. */
export function forgetOverview(data: CrmWorkspaceData): void {
  cache.delete(data);
}

onWriteInvalidate(forgetOverview);
