/**
 * Concludo CRM, the overview.
 *
 * WHAT THIS SUITE IS FOR.
 *
 * A reporting page fails in ways a working list does not. A list that is
 * wrong is obvious: the thing you expected is not on it. A total that is
 * wrong looks exactly like a total that is right, and somebody repeats it in
 * a meeting. So most of these checks are arithmetic against the records
 * rather than assertions about shape:
 *
 *   EVERY TOTAL IS RECOMPUTED INDEPENDENTLY and compared. If the module and
 *   the test agree by both being wrong, they had to be wrong the same way
 *   twice, from different code.
 *
 *   EVERY FIGURE SAYS WHAT IT OMITS. A total over work where some items have
 *   no recorded value is checked for declaring exactly how many it left out.
 *
 *   NOTHING IS A SCORE AND NOTHING IS ABOUT A PERSON. Every user id in every
 *   workspace is checked against the whole serialised output, the same way
 *   the attention and memory modules are checked.
 *
 *   THE PAGE REFLECTS A WRITE. The cache is dropped by the bus, so a figure
 *   moves when something is recorded. That is the whole claim of "all updates
 *   are seen on the overview", and it is asserted rather than described.
 *
 * Run: bun tests/crm.dashboard.test.ts
 */
import { CRM_WORKSPACES, getCrmWorkspace } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { CrmRole, CrmWorkspaceData } from '../src/lib/crm/domain';
import {
  OVERVIEW_NOTE,
  formatMoney,
  forgetOverview,
  overviewFor,
  wholeShares,
} from '../src/lib/crm/dashboard/overview';
import { invalidateCaches, registeredCacheCount } from '../src/lib/crm/cacheBus';
/* Imported for their side effect: each registers its cache invalidator at
   module scope, and a module nobody imports never registers. The import list
   IS the check, the same as in the Phase 2 suites. */
import { forgetContactIndex } from '../src/lib/crm/stage4/relationships';
import { forgetQualityIndex } from '../src/lib/crm/stage4/quality';
import { forgetCoverageIndex } from '../src/lib/crm/stage4/hierarchy';
import { forgetBoardIndex } from '../src/lib/crm/stage5/pipeline';
import { forgetIndex } from '../src/lib/crm/stage8/paging';
import { forgetMemoryIndex } from '../src/lib/crm/phase2/memory';
import { captureCommitment } from '../src/lib/crm/stage5/writes';
import { CRM_MODULE_DESTINATIONS } from '../src/lib/crm/moduleNav';
import { checkLanguage } from '../src/lib/crm/language';
import { workspaceAttention } from '../src/lib/crm/phase2/signals';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual } = makeAssert(r);

const NOW = CRM_DEMO_NOW;
const DAY = 86_400_000;

function fresh(id: string): CrmWorkspaceData {
  const found = getCrmWorkspace(id);
  if (!found) throw new Error(`no workspace ${id}`);
  const copy = structuredClone(found);
  forgetOverview(copy);
  return copy;
}

function contextFor(data: CrmWorkspaceData, role: CrmRole = 'crm_contributor') {
  return { userId: data.members[0].userId, workspaceId: data.workspace.id, role, now: NOW };
}

/* =====================================================================
   1. The figures are arithmetic, recomputed here from the records
   ===================================================================== */

group('Open work is the sum of the open items that have a value', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const figure = overview.figures.find((f) => f.key === 'open_value');
    assert(figure !== undefined, `${data.workspace.name}: the figure exists`);
    if (!figure) continue;

    const open = data.workItems.filter(
      (item) => item.deletedAt === null && item.status === 'open'
    );
    const valued = open.filter((item) => item.valueAmount !== null);
    const expected = valued.reduce((sum, item) => sum + (item.valueAmount ?? 0), 0);

    assertEqual(
      figure.value,
      formatMoney(expected, overview.currency),
      `${data.workspace.name}: the total matches the records`
    );
    assert(
      figure.basis.startsWith(`${open.length} open`),
      `${data.workspace.name}: it says how many items it covers (${figure.basis})`
    );

    const unvalued = open.length - valued.length;
    if (unvalued > 0) {
      assert(
        figure.omits !== null && figure.omits.startsWith(`${unvalued} with no value`),
        `${data.workspace.name}: it declares the ${unvalued} it left out (${figure.omits})`
      );
    } else {
      assertEqual(figure.omits, null, `${data.workspace.name}: nothing omitted, nothing claimed`);
    }
  }
});

group('Won in the last ninety days counts exactly the last ninety days', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const figure = overview.figures.find((f) => f.key === 'won_recent')!;

    const since = Date.parse(NOW) - 90 * DAY;
    const recent = data.workItems.filter(
      (item) =>
        item.deletedAt === null &&
        item.status === 'won' &&
        item.resolvedAt !== null &&
        Date.parse(item.resolvedAt) >= since
    );
    const expected = recent.reduce((sum, item) => sum + (item.valueAmount ?? 0), 0);

    assertEqual(
      figure.value,
      formatMoney(expected, overview.currency),
      `${data.workspace.name}: the ninety day total matches`
    );

    // The boundary is the thing worth checking: a win from before the window
    // must not be counted, and the fixture has one.
    const older = data.workItems.filter(
      (item) =>
        item.deletedAt === null &&
        item.status === 'won' &&
        item.resolvedAt !== null &&
        Date.parse(item.resolvedAt) < since
    );
    for (const item of older) {
      assert(
        !recent.includes(item),
        `${data.workspace.name}: a win from ${item.resolvedAt?.slice(0, 10)} is outside the window`
      );
    }
  }
});

group('The attention figure is the attention module, not a second opinion', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const figure = overview.figures.find((f) => f.key === 'attention')!;
    const attention = workspaceAttention(data, NOW);

    assertEqual(
      figure.value,
      String(attention.accountsNeedingAttention),
      `${data.workspace.name}: the overview and the attention page agree`
    );
    assertEqual(
      overview.conditions.reduce((sum, c) => sum + c.count, 0),
      attention.byCondition.reduce((sum, c) => sum + c.count, 0),
      `${data.workspace.name}: the per-condition counts agree too`
    );
  }
});

group('Promises outstanding splits into ours and theirs, and they add up', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const figure = overview.figures.find((f) => f.key === 'promises')!;

    const outstanding = data.commitments.filter(
      (c) => c.deletedAt === null && c.state !== 'done'
    );
    const ours = outstanding.filter((c) => c.ownedByUs).length;

    assertEqual(figure.value, String(outstanding.length), `${data.workspace.name}: the count`);
    assertEqual(
      figure.basis,
      `${ours} ours, ${outstanding.length - ours} theirs`,
      `${data.workspace.name}: the split adds to the total`
    );
  }
});

/* =====================================================================
   2. Every figure opens its records
   ===================================================================== */

group('Every figure has a destination, and it is a CRM path', () => {
  const known = new Set(CRM_MODULE_DESTINATIONS.map((d) => d.path as string));
  for (const data of CRM_WORKSPACES) {
    for (const figure of overviewFor(data, NOW).figures) {
      assert(figure.path.startsWith('/crm'), `${figure.key} points into the module`);
      assert(
        known.has(figure.path) || figure.path.split('/').length > 3,
        `${figure.key} points at a destination or a detail page (${figure.path})`
      );
      assert(figure.basis.trim().length > 0, `${figure.key} says what it was read from`);
      assert(figure.label.trim().length > 0, `${figure.key} has a label`);
    }
  }
});

/* =====================================================================
   3. The stage chart, which is the part that beats a funnel
   ===================================================================== */

group('Stuck is measured against each stage, not one global number', () => {
  let stagesWithStuck = 0;

  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);

    for (const row of overview.stages) {
      const stage = data.stages.find((s) => s.id === row.stageId)!;
      assertEqual(
        row.typicalDays,
        stage.typicalDays,
        `${row.name}: the threshold is this stage's own typicalDays`
      );
      assert(!stage.isClosed, `${row.name}: closed stages are not on the open chart`);

      const inStage = data.workItems.filter(
        (item) =>
          item.deletedAt === null && item.status === 'open' && item.stageId === row.stageId
      );
      assertEqual(row.count, inStage.length, `${row.name}: the count matches`);
      assertEqual(
        row.value,
        inStage.reduce((sum, item) => sum + (item.valueAmount ?? 0), 0),
        `${row.name}: the value matches`
      );

      const stuck = inStage.filter(
        (item) =>
          Math.floor((Date.parse(NOW) - Date.parse(item.enteredStageAt)) / DAY) >
          stage.typicalDays
      ).length;
      assertEqual(row.stuck, stuck, `${row.name}: stuck counts those past this stage's own time`);
      assert(row.stuck <= row.count, `${row.name}: stuck never exceeds the count`);
      if (row.stuck > 0) stagesWithStuck += 1;

      if (row.count === 0) {
        assertEqual(row.longestDays, 0, `${row.name}: nothing here, nothing longest`);
      }
    }

    // Stages are in pipeline order, so the chart reads as a pipeline.
    const orders = overview.stages.map(
      (row) => data.stages.find((s) => s.id === row.stageId)!.stageOrder
    );
    assert(
      orders.every((value, index) => index === 0 || orders[index - 1] <= value),
      `${data.workspace.name}: stages are in order`
    );
  }

  assert(stagesWithStuck > 0, `the fixture has stuck work to show (${stagesWithStuck} stages)`);
});

/* =====================================================================
   4. The panels report what is there, not what would look better
   ===================================================================== */

group('Enquiries by source reads the leads, and excludes the dead ones', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);

    const live = data.leads.filter(
      (lead) => lead.deletedAt === null && lead.state !== 'not_proceeding'
    );
    assertEqual(
      overview.sources.reduce((sum, s) => sum + s.count, 0),
      live.length,
      `${data.workspace.name}: every live enquiry is counted once`
    );

    for (const source of overview.sources) {
      assert(source.count > 0, `${source.label}: no empty bar is drawn`);
      assert(source.label.trim().length > 0, 'every bar is labelled');
    }

    // Sorted, because the order is the answer.
    const counts = overview.sources.map((s) => s.count);
    assert(
      counts.every((value, index) => index === 0 || counts[index - 1] >= value),
      `${data.workspace.name}: sources are sorted`
    );
  }
});

group('Open work by customer is sorted and never names a deleted customer', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const values = overview.accounts.map((a) => a.value);
    assert(
      values.every((value, index) => index === 0 || values[index - 1] >= value),
      `${data.workspace.name}: customers are sorted by value`
    );
    assert(overview.accounts.length <= 8, `${data.workspace.name}: the list is capped`);

    for (const account of overview.accounts) {
      const organisation = data.organisations.find((o) => o.id === account.key);
      assert(organisation !== undefined, `${account.label} is a real organisation`);
      assertEqual(organisation?.deletedAt ?? null, null, `${account.label} is not deleted`);
      assertEqual(
        account.label,
        organisation?.name,
        `${account.label} is named as the record names it`
      );
    }
  }
});

group('Won by quarter covers only work that was won', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const won = data.workItems.filter(
      (item) => item.deletedAt === null && item.status === 'won' && item.resolvedAt !== null
    );
    assertEqual(
      overview.quarters.reduce((sum, q) => sum + q.wonCount, 0),
      won.length,
      `${data.workspace.name}: every win is in exactly one quarter`
    );

    const keys = overview.quarters.map((q) => q.key);
    assert(
      keys.every((value, index) => index === 0 || keys[index - 1] < value),
      `${data.workspace.name}: quarters run oldest to newest`
    );
    assert(overview.quarters.length <= 6, `${data.workspace.name}: at most six quarters`);
  }
});

/* =====================================================================
   5. Nothing is about a person
   ===================================================================== */

group('No user id reaches the overview', () => {
  for (const data of CRM_WORKSPACES) {
    const ids = new Set(data.members.map((member) => member.userId));
    for (const organisation of data.organisations) {
      if (organisation.ownerUserId) ids.add(organisation.ownerUserId);
      if (organisation.relationshipOwnerUserId) ids.add(organisation.relationshipOwnerUserId);
    }
    for (const item of data.workItems) {
      if (item.ownerUserId) ids.add(item.ownerUserId);
      if (item.actionOwnerUserId) ids.add(item.actionOwnerUserId);
    }

    const serialised = JSON.stringify(overviewFor(data, NOW));
    for (const id of ids) {
      assert(!serialised.includes(id), `${data.workspace.name}: no user id in the output (${id})`);
    }
  }
});

group('No figure on the overview is a score', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    /* The data, not the prose. OVERVIEW_NOTE legitimately uses the word
       "score" in order to deny it, and a check that cannot tell a denial from
       a feature is a check that forces the denial off the page. */
    const text = JSON.stringify({
      figures: overview.figures,
      stages: overview.stages,
      quarters: overview.quarters,
      sources: overview.sources,
      accounts: overview.accounts,
      conditions: overview.conditions,
    }).toLowerCase();
    for (const word of ['score', 'ranking', 'ranked', 'grade', 'rating', 'per user', 'leaderboard']) {
      assert(!text.includes(word), `${data.workspace.name}: no figure is a "${word}"`);
    }
    // Every count is a whole number. A weighted figure could not be.
    for (const stage of overview.stages) {
      assert(Number.isInteger(stage.count), `${stage.name}: the count is a count`);
      assert(Number.isInteger(stage.stuck), `${stage.name}: stuck is a count`);
    }
    for (const condition of overview.conditions) {
      assert(Number.isInteger(condition.count), `${condition.label}: a count of accounts`);
    }
  }
});

/* =====================================================================
   6. A write reaches the overview. This is the headline claim.
   ===================================================================== */

group('Recording something changes the overview, through the cache bus', () => {
  /* THE CLAIM BEING TESTED.

     "All updates are seen on the overview" is the requirement. It is not a
     matter of the page re-rendering: the overview is cached against the
     workspace object, and the session store mutates that object in place
     rather than replacing it. Without the bus registration the cache
     survives the write and the page shows yesterday's figure.

     So this writes, asserts the cache IS stale without the bus, then calls
     exactly what the session store calls, and asserts the figure moved. A
     test that dropped the cache itself would pass whether the registration
     existed or not. */
  const data = fresh(CRM_WORKSPACES[3].workspace.id);

  const before = overviewFor(data, NOW);
  const promisesBefore = Number(before.figures.find((f) => f.key === 'promises')!.value);

  const organisation = data.organisations.find((o) => o.deletedAt === null)!;
  captureCommitment(contextFor(data), data, {
    organisationId: organisation.id,
    description: 'Send the revised scope and the two dates that still work.',
    ownerName: 'Anthony',
    ownedByUs: true,
  });

  assertEqual(
    Number(overviewFor(data, NOW).figures.find((f) => f.key === 'promises')!.value),
    promisesBefore,
    'without the bus the cached figure is stale, which is the defect this guards'
  );

  invalidateCaches(data);

  const after = overviewFor(data, NOW);
  assertEqual(
    Number(after.figures.find((f) => f.key === 'promises')!.value),
    promisesBefore + 1,
    'after the bus runs, the new promise is on the overview'
  );

  // And the change appears in the feed, which is the other half of the claim.
  assert(
    after.changes.some((change) => change.title.includes('revised scope')),
    'and the thing just recorded is in what changed'
  );
});

group('Seven caching modules register an invalidator, and the overview is the seventh', () => {
  for (const [name, fn] of Object.entries({
    forgetContactIndex,
    forgetQualityIndex,
    forgetCoverageIndex,
    forgetBoardIndex,
    forgetIndex,
    forgetMemoryIndex,
    forgetOverview,
  })) {
    assert(typeof fn === 'function', `${name} exists and can drop its cache`);
  }
  assert(
    registeredCacheCount() >= 7,
    `seven caching modules register one (saw ${registeredCacheCount()})`
  );
});

group('The overview is cached per moment, because the figures move with the clock', () => {
  const data = fresh(CRM_WORKSPACES[4].workspace.id);
  const atNow = overviewFor(data, NOW);
  const later = new Date(Date.parse(NOW) + 200 * DAY).toISOString();
  const atLater = overviewFor(data, later);

  assert(atNow !== atLater, 'a different moment is a different computation');
  assertEqual(atNow, overviewFor(data, NOW), 'and the same moment is served from the cache');

  const stuckNow = atNow.stages.reduce((sum, s) => sum + s.stuck, 0);
  const stuckLater = atLater.stages.reduce((sum, s) => sum + s.stuck, 0);
  assert(
    stuckLater >= stuckNow,
    `two hundred days later, nothing has become less stuck (${stuckNow} then ${stuckLater})`
  );
});

/* =====================================================================
   7. The destination and the language
   ===================================================================== */

group('The overview is a destination in the module navigation', () => {
  const destination = CRM_MODULE_DESTINATIONS.find((d) => d.path === '/crm/dashboard');
  assert(destination !== undefined, 'the destination exists');
  if (!destination) return;
  assertEqual(destination.label, 'Overview', 'it is called Overview, not Dashboard');
  /* Evidence, not Work. Work is where a person does something; this is a
     reporting view and belongs beside Forecast and Reports. It sat in Work
     briefly, which pushed that cluster to six tabs against a deliberate limit
     of five, and the shell suite caught it. */
  assertEqual(destination.group, 'Evidence', 'it sits in Evidence, beside Forecast and Reports');
  assert(destination.accessibleDescription.length > 40, 'it says what question it answers');
});

group('Everything the overview says is in house language', () => {
  const sentences: string[] = [OVERVIEW_NOTE];
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    for (const figure of overview.figures) {
      sentences.push(figure.label, figure.basis);
      if (figure.omits) sentences.push(figure.omits);
    }
    for (const condition of overview.conditions) sentences.push(condition.label);
  }

  for (const sentence of sentences) {
    const problems = checkLanguage(sentence);
    assertEqual(
      problems.length,
      0,
      `"${sentence.slice(0, 50)}" is in house language (${problems.map((p) => p.reason).join('; ')})`
    );
  }
});

group('Money is formatted the same way everywhere', () => {
  assertEqual(formatMoney(0), 'AU$0', 'zero');
  assertEqual(formatMoney(850), 'AU$850', 'under a thousand');
  assertEqual(formatMoney(5000), 'AU$5k', 'thousands');
  assertEqual(formatMoney(142_000), 'AU$142k', 'hundreds of thousands');
  assertEqual(formatMoney(1_500_000), 'AU$1.5m', 'millions');
  assertEqual(formatMoney(2400, 'NZD'), 'NZD 2k', 'another currency is named, not assumed');
});

/* =====================================================================
   N. The percentages, the rings and the geometry

   A chart is a number the reader cannot check by eye, so every one of them
   is checked here instead. Three failure modes are specifically hunted:

     A COLUMN OF PERCENTAGES THAT DOES NOT SUM TO THE WHOLE. Rounding each
     share on its own gives 13 + 13 + 13 + 13 = 52, and it reaches a buyer
     because every individual number looks right.

     A RING WHOSE WEDGES DO NOT CLOSE. Accumulated floating point leaves a
     hairline at twelve o'clock, or, worse, overlapping wedges that draw a
     bigger share than the label beside them.

     A PERCENTAGE OF NOTHING. Dividing by a zero denominator is how a panel
     reading "NaN%" gets shipped.
   ===================================================================== */

group('Shares are rounded by largest remainder, so a column sums to 100', () => {
  assertEqual(
    wholeShares([1, 1, 1, 1, 1, 1, 1, 1], 8).reduce((a, b) => a + b, 0),
    100,
    'eight equal eighths still sum to 100, where naive rounding gives 96'
  );
  assertEqual(
    wholeShares([1, 1, 1], 3).reduce((a, b) => a + b, 0),
    100,
    'three equal thirds sum to 100, where naive rounding gives 99'
  );
  assertEqual(
    JSON.stringify(wholeShares([1, 1, 1], 3)),
    JSON.stringify([34, 33, 33]),
    'and the spare point goes to the first of the tied entries, deterministically'
  );
  assertEqual(
    JSON.stringify(wholeShares([50, 30, 20], 100)),
    JSON.stringify([50, 30, 20]),
    'exact percentages are left exactly alone'
  );
  assertEqual(
    JSON.stringify(wholeShares([3, 0, 1], 4)),
    JSON.stringify([75, 0, 25]),
    'an empty category takes zero, not a rounded-up one'
  );

  /* The denominator cases that produce NaN if nobody guards them. */
  assertEqual(JSON.stringify(wholeShares([0, 0], 0)), JSON.stringify([0, 0]), 'zero total gives zeroes, not NaN');
  assertEqual(JSON.stringify(wholeShares([], 10)), JSON.stringify([]), 'no entries gives no shares');
  assertEqual(
    wholeShares([5, 5], 4).reduce((a, b) => a + b, 0) <= 100,
    true,
    'a total smaller than its parts is clamped rather than printing 250'
  );
});

group('Every ring divides a stated denominator, and its wedges sum to 100', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    assertEqual(overview.donuts.length, 3, `${data.workspace.name}: three rings`);

    for (const donut of overview.donuts) {
      const where = `${data.workspace.name}, ${donut.key}`;

      assert(donut.totalLabel.length > 0, `${where}: the denominator is labelled`);
      /* The hole takes a figure and a unit on separate lines. One string
         wrapped inside the ring on a phone and collided with the wedges. */
      assert(/^[^ ]+$/.test(donut.totalFigure), `${where}: the hole's figure is one short token (saw "${donut.totalFigure}")`);
      assert(donut.totalFigure.length <= 8, `${where}: and short enough to fit the hole (saw "${donut.totalFigure}")`);
      assert(donut.totalUnit.length > 0, `${where}: the hole names the unit under the figure`);
      assert(donut.basis.length > 0, `${where}: the ring says what it was read from`);
      assert(donut.question.length > 0, `${where}: the ring says what question it answers`);

      if (donut.slices.length === 0) {
        assertEqual(donut.total, 0, `${where}: no wedges only where there is nothing to divide`);
        continue;
      }

      const shareSum = donut.slices.reduce((sum, slice) => sum + slice.share, 0);
      assertEqual(shareSum, 100, `${where}: the wedge labels sum to exactly 100`);

      const fractionSum = donut.slices.reduce((sum, slice) => sum + slice.fraction, 0);
      assert(
        Math.abs(fractionSum - 1) < 1e-9,
        `${where}: the exact fractions sum to one, within floating point`
      );

      /* The wedge amounts must sum to the denominator the ring prints, or the
         ring is dividing one number and labelling another. */
      const amounts = donut.slices.reduce(
        (sum, slice) => sum + (donut.unit === 'money' ? slice.value : slice.count),
        0
      );
      assertEqual(amounts, donut.total, `${where}: the wedges add up to the stated total`);

      /* Every share is reproducible from the records behind it. */
      for (const slice of donut.slices) {
        const amount = donut.unit === 'money' ? slice.value : slice.count;
        const exact = (amount / donut.total) * 100;
        assert(
          Math.abs(slice.share - exact) <= 1,
          `${where}, ${slice.label}: the printed share is within a point of the arithmetic`
        );
        assert(slice.share >= 0 && slice.share <= 100, `${where}, ${slice.label}: a share is a share`);
      }
    }
  }
});

group('Ring geometry closes the circle, and no wedge overlaps the next', () => {
  for (const data of CRM_WORKSPACES) {
    for (const donut of overviewFor(data, NOW).donuts) {
      if (donut.slices.length === 0) continue;
      const where = `${data.workspace.name}, ${donut.key}`;

      assertEqual(donut.slices[0].startAngle, 0, `${where}: the first wedge starts at twelve o'clock`);
      assertEqual(
        donut.slices[donut.slices.length - 1].endAngle,
        360,
        `${where}: the last wedge closes the ring on 360 exactly, not on an accumulated 359.97`
      );

      for (let i = 0; i < donut.slices.length; i += 1) {
        const slice = donut.slices[i];
        assert(slice.endAngle >= slice.startAngle, `${where}, wedge ${i}: the arc runs forwards`);
        if (i > 0) {
          assert(
            Math.abs(slice.startAngle - donut.slices[i - 1].endAngle) < 1e-9,
            `${where}, wedge ${i}: starts exactly where the one before ended, so nothing overlaps and nothing gaps`
          );
        }
        /* The angle must agree with the fraction, not with the rounded label. */
        assert(
          Math.abs(slice.endAngle - slice.startAngle - slice.fraction * 360) < 1e-6 ||
            i === donut.slices.length - 1,
          `${where}, wedge ${i}: the arc is drawn from the exact fraction`
        );
      }
    }
  }
});

group('At most one wedge per ring is gold, and a grouped tail is never gold', () => {
  for (const data of CRM_WORKSPACES) {
    for (const donut of overviewFor(data, NOW).donuts) {
      const accents = donut.slices.filter((slice) => slice.tone === -1);
      assert(
        accents.length <= 1,
        `${data.workspace.name}, ${donut.key}: ${accents.length} gold wedges, which must be at most one`
      );
      for (const slice of donut.slices) {
        if (slice.grouped) {
          assert(
            slice.tone !== -1,
            `${data.workspace.name}, ${donut.key}: the grouped tail is not the thing to act on, so it is not gold`
          );
          assert(
            slice.groupedCount >= 2,
            `${data.workspace.name}, ${donut.key}: a tail of one is not grouped, it is just that category`
          );
        }
        assert(
          slice.tone === -1 || (slice.tone >= 0 && slice.tone <= 7),
          `${data.workspace.name}, ${donut.key}: every tone is on the eight-step ramp`
        );
      }

      /* Adjacent wedges must not be adjacent tones. Two navies side by side
         read as one shape with a seam in it, which is what a two-wedge ring
         looked like before the tones were spread across the ramp. */
      const plain = donut.slices.filter((slice) => slice.tone !== -1);
      for (let i = 1; i < plain.length; i += 1) {
        assert(
          Math.abs(plain[i].tone - plain[i - 1].tone) >= 1,
          `${data.workspace.name}, ${donut.key}: wedge ${i + 1} takes a different tone from the one before it`
        );
      }
      /* On a small ring every wedge is large, so neighbouring tones are the
         ones that blur together. Two steps apart on an eight-step ramp is the
         separation that reads. A ring carrying the gold accent needs less,
         because gold separates itself from every navy on the ramp. */
      if (donut.slices.length <= 4 && plain.length >= 2) {
        for (let i = 1; i < plain.length; i += 1) {
          assert(
            Math.abs(plain[i].tone - plain[i - 1].tone) >= 2,
            `${data.workspace.name}, ${donut.key}: on a ${donut.slices.length}-wedge ring, wedges ${i} and ${i + 1} are tones ${plain[i - 1].tone} and ${plain[i].tone}, which are too close to tell apart`
          );
        }
      }
      if (plain.length >= 2) {
        const tones = new Set(plain.map((slice) => slice.tone));
        assertEqual(
          tones.size,
          plain.length,
          `${data.workspace.name}, ${donut.key}: no two wedges share a tone`
        );
      }
    }
  }
});

group('Grouping the tail of a ring loses nothing', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const ring = overview.donuts.find((donut) => donut.key === 'enquiries_by_source');
    assert(ring !== undefined, `${data.workspace.name}: the source ring exists`);
    if (!ring) continue;

    /* Whatever the ring grouped, the full list panel still holds every
       category, and both report the same total. */
    const listed = overview.sources.reduce((sum, source) => sum + source.count, 0);
    assertEqual(listed, ring.total, `${data.workspace.name}: the ring and the full list agree on the total`);

    const wedged = ring.slices.reduce((sum, slice) => sum + slice.count, 0);
    assertEqual(wedged, listed, `${data.workspace.name}: grouping moved records, it did not drop them`);

    const tail = ring.slices.find((slice) => slice.grouped);
    if (tail) {
      assertEqual(
        ring.slices.length,
        8,
        `${data.workspace.name}: a tail only appears once the ring is full`
      );
      assert(
        overview.sources.length > 8,
        `${data.workspace.name}: nothing was grouped that would have fitted`
      );

      /* The defect this rule exists for: a tidying wedge that ends up the
         largest thing on the chart. Found by looking at a rendered ring. */
      const keptSmallest = ring.slices
        .filter((slice) => !slice.grouped)
        .reduce((min, slice) => Math.min(min, slice.count), Number.POSITIVE_INFINITY);
      assert(
        tail.count < keptSmallest,
        `${data.workspace.name}: the grouped wedge (${tail.count}) is smaller than the smallest wedge it sits beside (${keptSmallest}), or grouping made the ring harder to read`
      );
    } else {
      assert(
        ring.slices.length === overview.sources.filter((source) => source.count > 0).length,
        `${data.workspace.name}: with nothing grouped, every source has its own wedge`
      );
    }
  }
});

group('The promises ring splits ours from theirs, and ours takes the gold', () => {
  for (const data of CRM_WORKSPACES) {
    const ring = overviewFor(data, NOW).donuts.find((donut) => donut.key === 'promises_by_owner');
    if (!ring || ring.slices.length === 0) continue;

    const outstanding = data.commitments.filter(
      (commitment) => commitment.deletedAt === null && commitment.state !== 'done'
    );
    assertEqual(ring.total, outstanding.length, `${data.workspace.name}: the denominator is the promises outstanding`);

    const ours = ring.slices.find((slice) => slice.key === 'ours');
    if (ours) {
      assertEqual(
        ours.count,
        outstanding.filter((commitment) => commitment.ownedByUs).length,
        `${data.workspace.name}: ours is recomputed and matches`
      );
      assertEqual(ours.tone, -1, `${data.workspace.name}: what we owe is the actionable wedge, so it is gold`);
    }
  }
});

group('The stage ring marks the stage holding the most stuck work, not the most money', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const ring = overview.donuts.find((donut) => donut.key === 'pipeline_by_stage');
    if (!ring) continue;

    const accent = ring.slices.find((slice) => slice.tone === -1);

    /* The ring is by value, so it can only mark a stage that HAS a value.
       The rule is therefore: the worst stuck stage among those the ring can
       draw, and the omits line must name any stuck stage it cannot. A ring
       that marked a stage that is not the worst, silently, would be pointing
       at the wrong thing in gold. */
    const drawable = overview.stages.filter((stage) => stage.value > 0);
    const worstDrawable = drawable.reduce((max, stage) => Math.max(max, stage.stuck), 0);
    const worstAnywhere = overview.stages.reduce((max, stage) => Math.max(max, stage.stuck), 0);

    if (worstDrawable === 0) {
      assert(
        accent === undefined,
        `${data.workspace.name}: nothing stuck can be drawn, so no wedge claims to be the thing to act on`
      );
    } else {
      assert(accent !== undefined, `${data.workspace.name}: the worst drawable stage is marked`);
      if (accent) {
        const stage = overview.stages.find((row) => row.stageId === accent.key);
        assert(stage !== undefined, `${data.workspace.name}: the gold wedge is a real stage`);
        assertEqual(
          stage?.stuck,
          worstDrawable,
          `${data.workspace.name}: and it is the worst of the stages the ring can draw`
        );
      }
    }

    /* Whenever a stuck stage is missing from the ring, the ring says so. */
    const hiddenStuck = overview.stages.filter((stage) => stage.stuck > 0 && stage.value === 0);
    if (hiddenStuck.length > 0) {
      assert(
        ring.omits !== null,
        `${data.workspace.name}: a stuck stage the ring cannot draw means the ring must declare an omission`
      );
      for (const stage of hiddenStuck) {
        assert(
          (ring.omits ?? '').includes(stage.name),
          `${data.workspace.name}: ${stage.name} holds stuck work and no value, so the ring names it rather than hiding it`
        );
      }
      if (worstAnywhere > worstDrawable) {
        assert(
          (ring.omits ?? '').includes('most stuck work of all'),
          `${data.workspace.name}: where the very worst stage is off the ring, the ring says that plainly`
        );
      }
    }
  }
});

group('Stage shares divide value and count separately, and each sums to 100', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    if (overview.stages.length === 0) continue;
    const where = data.workspace.name;

    const anyValue = overview.stages.some((stage) => stage.value > 0);
    const anyCount = overview.stages.some((stage) => stage.count > 0);

    const valueSum = overview.stages.reduce((sum, stage) => sum + stage.valueShare, 0);
    const countSum = overview.stages.reduce((sum, stage) => sum + stage.countShare, 0);

    assertEqual(valueSum, anyValue ? 100 : 0, `${where}: value shares sum to 100 down the funnel`);
    assertEqual(countSum, anyCount ? 100 : 0, `${where}: count shares sum to 100 down the funnel`);

    for (const stage of overview.stages) {
      /* Stuck is a share of this stage, not of the pipeline. Getting this
         wrong makes a stage with one stuck item of one look fine. */
      const expected = stage.count > 0 ? Math.round((stage.stuck / stage.count) * 100) : 0;
      assertEqual(
        stage.stuckShare,
        expected,
        `${where}, ${stage.name}: stuck is a share of this stage's own count`
      );
      assert(
        stage.stuckShare <= 100,
        `${where}, ${stage.name}: a stage cannot be more than entirely stuck`
      );
    }
  }
});

group('Customer shares are of all open value, so concentration is not flattered', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const open = data.workItems.filter((item) => item.deletedAt === null && item.status === 'open');
    const openValue = open.reduce((sum, item) => sum + (item.valueAmount ?? 0), 0);

    const sum = overview.accounts.reduce((total, account) => total + account.share, 0);
    assert(
      sum <= 100,
      `${data.workspace.name}: customer shares sum to ${sum}, which must not exceed 100`
    );

    for (const account of overview.accounts) {
      const exact = openValue > 0 ? (account.value / openValue) * 100 : 0;
      assert(
        Math.abs(account.share - exact) <= 1,
        `${data.workspace.name}, ${account.label}: the share is of all open value, not of the eight shown`
      );
      assert(
        account.fraction >= 0 && account.fraction <= 1,
        `${data.workspace.name}, ${account.label}: the bar length is a proportion`
      );
    }
  }
});

group('Quarter-on-quarter change is withheld on thin evidence', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const shareSum = overview.quarters.reduce((sum, quarter) => sum + quarter.share, 0);
    assertEqual(
      shareSum,
      overview.quarters.some((quarter) => quarter.won > 0) ? 100 : 0,
      `${data.workspace.name}: quarter shares sum to 100 across the quarters shown`
    );

    overview.quarters.forEach((quarter, i) => {
      const previous = i > 0 ? overview.quarters[i - 1] : null;
      if (quarter.changePercent !== null) {
        assert(previous !== null, `${data.workspace.name}: a change needs something to change from`);
        assert(
          (previous?.wonCount ?? 0) >= 3 && quarter.wonCount >= 3,
          `${data.workspace.name}, ${quarter.label}: a percentage change is only printed where both quarters hold three or more outcomes`
        );
      }
      if (i === 0) {
        assertEqual(quarter.changePercent, null, `${data.workspace.name}: the first quarter shown has nothing before it`);
      }
      assert(
        quarter.fraction >= 0 && quarter.fraction <= 1,
        `${data.workspace.name}, ${quarter.label}: the column height is a proportion of the tallest`
      );
    });

    /* The tallest column shown is drawn full height, or the chart has no
       scale and every column is short. */
    if (overview.quarters.some((quarter) => quarter.won > 0)) {
      assert(
        overview.quarters.some((quarter) => quarter.fraction === 1),
        `${data.workspace.name}: the tallest quarter is drawn at full height`
      );
    }
  }
});

group('Every tile says how much of its list the figure covers', () => {
  for (const data of CRM_WORKSPACES) {
    const overview = overviewFor(data, NOW);
    const open = data.workItems.filter((item) => item.deletedAt === null && item.status === 'open');
    const valued = open.filter((item) => item.valueAmount !== null);

    const figure = overview.figures.find((f) => f.key === 'open_value');
    assert(figure?.coverage !== null && figure?.coverage !== undefined, `${data.workspace.name}: the money tile carries a coverage meter`);
    if (figure?.coverage) {
      assertEqual(
        figure.coverage.percent,
        open.length > 0 ? Math.round((valued.length / open.length) * 100) : 0,
        `${data.workspace.name}: coverage is the proportion of records with a value recorded`
      );
      assert(
        figure.coverage.label.includes(String(open.length)),
        `${data.workspace.name}: the meter states its denominator in words`
      );
    }

    for (const other of overview.figures) {
      if (other.coverage === null) continue;
      assert(
        other.coverage.percent >= 0 && other.coverage.percent <= 100,
        `${data.workspace.name}, ${other.key}: a percentage is between nought and a hundred`
      );
      assert(
        other.coverage.label.length > 0,
        `${data.workspace.name}, ${other.key}: no bare percentage without a sentence`
      );
      /* The meter prints the percentage already. A sentence that repeats it
         renders as "100% 100 per cent of accounts", which is what this
         catches. */
      assert(
        !other.coverage.label.includes('per cent'),
        `${data.workspace.name}, ${other.key}: the sentence does not repeat the percentage the meter prints (saw "${other.coverage.label}")`
      );
      assert(
        / of \d/.test(other.coverage.label),
        `${data.workspace.name}, ${other.key}: the sentence gives the count and its denominator (saw "${other.coverage.label}")`
      );
    }
  }
});

group('No percentage anywhere on the page is against a target', () => {
  for (const data of CRM_WORKSPACES) {
    const serialised = JSON.stringify(overviewFor(data, NOW)).toLowerCase();
    for (const word of ['target', 'quota', 'goal', 'forecast', 'projected', 'benchmark', 'score']) {
      /* `score` is checked elsewhere against the data fields; here the whole
         payload is scanned for the language of a comparison nobody set. */
      if (word === 'score') continue;
      assert(
        !serialised.includes(word),
        `${data.workspace.name}: the overview payload does not contain the word "${word}"`
      );
    }
  }
});

group('Reading the overview changes nothing', () => {
  for (const data of CRM_WORKSPACES) {
    const before = JSON.stringify({
      work: data.workItems.length,
      commitments: data.commitments.length,
      leads: data.leads.length,
      audit: data.auditEvents.length,
    });
    overviewFor(data, NOW);
    const after = JSON.stringify({
      work: data.workItems.length,
      commitments: data.commitments.length,
      leads: data.leads.length,
      audit: data.auditEvents.length,
    });
    assertEqual(after, before, `${data.workspace.name}: reading wrote nothing`);
  }
});

report('Concludo CRM, the overview', r);
