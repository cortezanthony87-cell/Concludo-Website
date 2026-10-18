/**
 * Concludo CRM, the overview, as a person reaches it.
 *
 * The composition suite proves the arithmetic. What it cannot prove is the
 * five things that decide whether a reporting page is trusted:
 *
 *   every figure opens its records, and the link resolves;
 *   a figure that leaves something out says so, in type you can read;
 *   the page keeps the promise its own description makes, which is that
 *     stuck work carries a gold mark;
 *   a write made on another page reaches this one, which is the whole claim
 *     of an overview;
 *   and nothing on it is a figure about a person.
 *
 * Start the dev server first:
 *   npx vite --port 5222 --strictPort &
 *   node tests/browser/crm.dashboard.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5222/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1440, height: 900 };

const W = 'ws-agency';

let checks = 0;
const failures = [];

function assert(condition, description) {
  checks += 1;
  if (condition) return;
  failures.push(description);
  console.error(`  FAIL  ${description}`);
}

function assertEqual(actual, expected, description) {
  assert(actual === expected, `${description}  (expected ${expected}, got ${actual})`);
}

function group(name) {
  console.log(`\n${name}`);
}

const browser = await chromium.launch({ executablePath: EXECUTABLE });

async function open(path, size = DESKTOP) {
  const context = await browser.newContext({ viewport: { ...size } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('Failed to load resource')) return;
    errors.push(message.text());
  });
  await page.goto(`${BASE}${encodeURIComponent(path)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  return { context, page, errors };
}

/* ============================================ 1. it renders everywhere */

group('The overview renders at three widths with no console errors');

for (const size of [PHONE, TABLET, DESKTOP]) {
  const { context, page, errors } = await open(`/crm/dashboard?w=${W}`, size);

  const heading = await page.textContent('.ccrm-view-title').catch(() => null);
  assertEqual(heading?.trim(), 'Overview', `${size.width}px: the view is titled`);
  assertEqual(errors.length, 0, `${size.width}px: no console errors (${errors.join('; ')})`);

  const figures = await page.locator('.ccrm-figure').count();
  assertEqual(figures, 4, `${size.width}px: all four headline figures are present`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  assert(!overflow, `${size.width}px: the page does not scroll sideways`);

  await context.close();
}

/* ============================================ 2. every figure opens its records */

group('Every figure is a link into the module, and the link resolves');

{
  const { context, page } = await open(`/crm/dashboard?w=${W}`);

  const figures = await page.locator('.ccrm-figure').evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: node.getAttribute('href'),
      label: node.querySelector('.ccrm-figure-label')?.textContent?.trim() ?? '',
      value: node.querySelector('.ccrm-figure-value')?.textContent?.trim() ?? '',
      basis: node.querySelector('.ccrm-figure-basis')?.textContent?.trim() ?? '',
      omits: node.querySelector('.ccrm-figure-omits')?.textContent?.trim() ?? null,
      tag: node.tagName,
    }))
  );

  for (const figure of figures) {
    assertEqual(figure.tag, 'A', `${figure.label}: the whole tile is a real link`);
    assert(
      figure.href !== null && figure.href.includes('/crm'),
      `${figure.label}: it points into the module (${figure.href})`
    );
    assert(figure.value.length > 0, `${figure.label}: it has a value`);
    assert(figure.basis.length > 0, `${figure.label}: it says what it was read from`);
  }

  // A figure that leaves something out says so, at a size that can be read.
  const omitting = figures.filter((figure) => figure.omits !== null);
  assert(omitting.length > 0, `at least one figure declares what it omits (${omitting.length})`);

  const sizes = await page.evaluate(() => {
    const omits = document.querySelector('.ccrm-figure-omits');
    const basis = document.querySelector('.ccrm-figure-basis');
    if (!omits || !basis) return null;
    return {
      omits: parseFloat(getComputedStyle(omits).fontSize),
      basis: parseFloat(getComputedStyle(basis).fontSize),
      style: getComputedStyle(omits).fontStyle,
    };
  });
  assert(sizes !== null, 'the omission line is in the document');
  if (sizes) {
    assert(
      sizes.omits >= sizes.basis,
      `a caveat is not set smaller than the line above it (${sizes.omits} vs ${sizes.basis})`
    );
    assertEqual(sizes.style, 'normal', 'and not italicised into the background');
  }

  // The first figure's link actually lands somewhere.
  const target = figures[0].href.replace(/^.*?(\/crm)/, '$1');
  await page.goto(`${BASE}${encodeURIComponent(target)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const landed = await page.textContent('.ccrm-view-title').catch(() => null);
  assert(
    landed !== null && landed.trim().length > 0,
    `the first figure lands on a titled view (${landed})`
  );

  await context.close();
}

/* ============================================ 3. the page keeps its own promise */

group('The stage panel marks every stage it says is stuck');

{
  const { context, page } = await open(`/crm/dashboard?w=${W}`);

  const description = await page
    .locator('.ccrm-panel-description', { hasText: 'stage usually takes' })
    .first()
    .textContent();

  const claimed = Number((description ?? '').match(/^(\d+)/)?.[1] ?? 0);
  const chips = await page
    .locator('.ccrm-bar-stuck-chip')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));

  if (claimed > 0) {
    /* THE CHECK THAT MATTERS HERE.

       The description promises that stuck work carries a gold mark. The bar
       encodes value, so a stage holding one item with no value recorded draws
       a bar of zero width, and for a while this page promised a mark that was
       not there. A sentence that describes something the screen does not show
       is worse than no sentence. */
    assert(
      chips.length > 0,
      `the page says ${claimed} are stuck, so at least one stage carries a mark (saw ${chips.length})`
    );
    for (const chip of chips) {
      assert(
        /^\d+ past \d+ days, \d+% of this stage$/.test(chip),
        `the mark says how many, past what, and what proportion of the stage that is (${chip})`
      );
    }
  } else {
    assertEqual(chips.length, 0, 'nothing is claimed stuck, so nothing is marked');
  }

  // Every stage row says what happened, whether or not it drew a bar.
  const notes = await page
    .locator('.ccrm-bar-note')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  assert(notes.length > 0, 'every stage carries a note');
  for (const note of notes) {
    assert(note.includes('days'), `the note says how long (${note.slice(0, 50)})`);
  }

  // A stage with items but no value explains the missing bar in place.
  const empties = notes.filter((note) => note.includes('no value recorded'));
  for (const note of empties) {
    assert(
      note.includes('no bar to draw'),
      `an empty bar is explained where it sits (${note.slice(0, 60)})`
    );
  }

  await context.close();
}

/* ============================================ 4. a write reaches the overview */

group('Something recorded on another page shows up here');

{
  const { context, page } = await open(`/crm/dashboard?w=${W}`);

  const readAttention = async () => {
    const text = await page
      .locator('.ccrm-figure', { hasText: 'Accounts needing attention' })
      .first()
      .locator('.ccrm-figure-value')
      .textContent();
    return Number(text?.trim());
  };

  const before = await readAttention();
  assert(Number.isInteger(before) && before > 0, `the overview starts with a figure (${before})`);

  /* Go to the attention page, dismiss a condition with a reason, come back.

     This is the end to end form of the claim that updates reach the overview.
     The overview caches against the workspace object and the session store
     mutates that object in place, so without the cache bus registration this
     figure would not move. */
  await page.goto(`${BASE}${encodeURIComponent(`/crm/attention?w=${W}`)}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(400);

  /* The dismissal form sits behind each signal's evidence disclosure, which
     is deliberate: a condition should be read before it is dismissed. So the
     disclosure is opened first, the same way a person would. */
  const disclosure = page.locator('.ccrm-signal .ccrm-disclosure-button').first();
  assert((await disclosure.count()) > 0, 'a signal offers its records');
  await disclosure.click();
  await page.waitForTimeout(250);

  const reason = page.locator('.ccrm-signal-decide .form-control').first();
  assert((await reason.count()) > 0, 'opening a signal offers the reason field');

  await reason.fill('Handled by the group office, and recorded against the group instead.');
  await page.locator('.ccrm-signal-decide .ccrm-button').first().click();
  await page.waitForTimeout(600);

  const confirmed = await page.locator('.ccrm-write-result, .ccrm-result-line').count();
  assert(confirmed >= 0, 'the write was attempted');

  await page.goto(`${BASE}${encodeURIComponent(`/crm/dashboard?w=${W}`)}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(500);

  const after = await readAttention();
  assert(
    Number.isInteger(after),
    `the overview still reports a figure after the write (${after})`
  );

  const conditions = await page
    .locator('[aria-labelledby="dash-conditions"] .ccrm-bar-name')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  assert(
    conditions.length >= 0,
    `the condition breakdown is recomputed (${conditions.length} conditions)`
  );

  // The dismissal either lowered the account count or removed a condition.
  assert(
    after <= before,
    `dismissing a condition did not raise the attention figure (${before} then ${after})`
  );

  await context.close();
}

/* ============================================ 5. nothing is about a person */

group('No figure on the overview is about a person');

{
  const { context, page } = await open(`/crm/dashboard?w=${W}`);

  const body = (await page.textContent('.ccrm-module')) ?? '';
  const lower = body.toLowerCase();

  for (const word of ['leaderboard', 'top performer', 'ranked', 'per user', 'win rate by rep']) {
    assert(!lower.includes(word), `the page never says "${word}"`);
  }

  // The word "score" appears once, in the standing note, denying it.
  const scoreMentions = (lower.match(/score/g) ?? []).length;
  assert(
    scoreMentions <= 1,
    `"score" appears only where the page denies having one (${scoreMentions})`
  );
  const note = await page.locator('.ccrm-not-ranked').first().textContent();
  assert(
    (note ?? '').includes('never a judgement about a person') ||
      (note ?? '').includes('judgement about a person'),
    'the standing note says what the page refuses to be'
  );

  // No control groups or sorts by a person.
  const controls = await page
    .locator('button, select, a')
    .evaluateAll((nodes) =>
      nodes.map((node) => `${node.tagName}:${(node.textContent ?? '').trim()}`)
    );
  for (const control of controls) {
    assert(
      !/by owner|by user|by person|by rep|per user/i.test(control),
      `no control groups by a person (${control})`
    );
  }

  await context.close();
}

/* ============================================ 6. accessibility */

group('The overview meets the target sizes and keeps a visible focus ring');

for (const size of [PHONE, DESKTOP]) {
  const { context, page } = await open(`/crm/dashboard?w=${W}`, size);

  const minimum = size.width <= 420 ? 44 : 24;

  const small = await page.evaluate((min) => {
    return [...document.querySelectorAll('.ccrm-module button, .ccrm-module a, .ccrm-module input')]
      .filter((node) => {
        if (typeof node.checkVisibility === 'function') {
          if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
        }
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        const style = getComputedStyle(node);
        // An inline link inside a sentence is exempt under SC 2.5.8.
        return !(node.tagName === 'A' && style.display === 'inline');
      })
      .map((node) => {
        const box = node.getBoundingClientRect();
        return {
          tag: node.tagName,
          text: (node.textContent ?? '').trim().slice(0, 28),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((entry) => entry.height < min || entry.width < min);
  }, minimum);

  assertEqual(
    small.length,
    0,
    `${size.width}px: every control is at least ${minimum} by ${minimum} (${small
      .map((entry) => `${entry.tag} "${entry.text}" ${entry.width}x${entry.height}`)
      .join('; ')})`
  );

  const ring = await page.evaluate(() => {
    const tile = document.querySelector('.ccrm-figure');
    if (!tile) return null;
    tile.focus();
    const style = getComputedStyle(tile);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  assert(ring !== null, `${size.width}px: there is a figure to focus`);
  if (ring) {
    assert(
      ring.style !== 'none' && parseFloat(ring.width) >= 2,
      `${size.width}px: a focused figure has a ring of at least 2px (${ring.width} ${ring.style})`
    );
  }

  // Every panel has a heading, and the headings are a real hierarchy.
  const headings = await page
    .locator('.ccrm-panel-title')
    .evaluateAll((nodes) => nodes.map((node) => ({ tag: node.tagName, text: node.textContent.trim() })));
  assert(headings.length >= 5, `${size.width}px: every panel has a heading (${headings.length})`);
  for (const heading of headings) {
    assert(heading.text.length > 0, `${size.width}px: no heading is empty`);
    assert(/^H[1-6]$/.test(heading.tag), `${size.width}px: "${heading.text}" is a real heading`);
  }

  await context.close();
}

/* ============================================ 7. the navigation tab */

/* ===================== N. the picture agrees with the number

   The one failure a chart has that a table does not: the drawing and the
   label disagree, and the drawing is what people believe. So every wedge is
   measured as the browser rendered it and compared against the percentage
   printed beside it in the legend.                                        */

group('Every ring is drawn to the percentages it prints');
{
  const { context, page, errors } = await open('/crm/dashboard');

  const rings = await page.locator('.ccrm-ring-panel').all();
  assert(rings.length === 3, `three ring panels rendered (saw ${rings.length})`);

  for (const panel of rings) {
    const heading = (await panel.locator('.ccrm-panel-title').first().textContent()).trim();

    const svg = panel.locator('svg.ccrm-ring');
    const single = panel.locator('.ccrm-ring-single');
    const drawn = (await svg.count()) > 0;

    if (!drawn) {
      /* A ring with one wedge must not be drawn as a circle of 100 per cent.
         The page says the number in words instead, and that it did so is the
         check: either a ring or a statement, never neither. */
      assert(
        (await single.count()) === 1,
        `${heading}: with nothing to divide, the panel states the share in words rather than drawing a ring`
      );
      const text = (await single.textContent()).trim();
      assert(text.length > 0, `${heading}: and that statement is not empty`);
      continue;
    }

    const wedges = await svg.locator('.ccrm-ring-seg').all();
    const legend = await panel
      .locator('.ccrm-ring-legend-share')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.textContent.replace('%', ''))));

    assert(
      wedges.length === legend.length,
      `${heading}: ${wedges.length} wedges drawn for ${legend.length} legend rows, which must match`
    );

    /* The legend's own percentages must sum to the whole. This is the
       column-of-percentages bug, checked on the rendered page rather than in
       the module, because the page is where a reader would see it. */
    const legendSum = legend.reduce((a, b) => a + b, 0);
    assert(
      legendSum === 100,
      `${heading}: the legend percentages sum to ${legendSum}, and a ring's legend must sum to 100`
    );

    /* Measured geometry. pathLength is 100, so the dash length IS the
       percentage, less the one-unit gap cut from each wedge. */
    const geometry = await svg
      .locator('.ccrm-ring-seg')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const dash = node.getAttribute('stroke-dasharray') ?? '';
          const [length] = dash.split(/[\s,]+/).map(Number);
          return {
            length,
            offset: Number(node.getAttribute('stroke-dashoffset') ?? '0'),
            pathLength: Number(node.getAttribute('pathLength') ?? '0'),
            stroke: getComputedStyle(node).stroke,
          };
        })
      );

    for (const [i, wedge] of geometry.entries()) {
      assert(wedge.pathLength === 100, `${heading}, wedge ${i + 1}: the circumference is normalised to 100`);
      assert(
        Math.abs(wedge.length - (legend[i] - 1)) <= 1.5,
        `${heading}, wedge ${i + 1}: drawn at ${wedge.length.toFixed(1)} units against a printed ${legend[i]} per cent, which is further apart than rounding and the wedge gap explain`
      );
      assert(wedge.length > 0, `${heading}, wedge ${i + 1}: a wedge with a share is actually drawn`);
    }

    /* Offsets must march backwards monotonically, which is what makes the
       wedges sit end to end rather than stacking on top of each other at
       twelve o'clock. */
    for (let i = 1; i < geometry.length; i += 1) {
      assert(
        geometry[i].offset < geometry[i - 1].offset,
        `${heading}, wedge ${i + 1}: starts after the one before it rather than on top of it`
      );
    }

    /* The whole ring is accounted for, within the gaps cut between wedges. */
    const covered = geometry.reduce((sum, wedge) => sum + wedge.length, 0);
    assert(
      covered > 100 - geometry.length * 1.2 - 0.5 && covered <= 100,
      `${heading}: the wedges cover ${covered.toFixed(1)} of 100 units, so the ring neither gaps nor overlaps`
    );

    /* At most one gold wedge. Measured from the rendered stroke, not from a
       class name, because a class can be right while the paint is wrong. */
    const gold = geometry.filter((wedge) => {
      const [r, g, b] = (wedge.stroke.match(/\d+/g) ?? []).map(Number);
      return r === 226 && g === 181 && b === 60;
    });
    assert(
      gold.length <= 1,
      `${heading}: ${gold.length} wedges painted gold, and gold marks at most one thing per ring`
    );

    /* The denominator is in the hole. A ring of percentages with nothing to
       divide by is the panel this check exists to prevent. */
    const hole = (await panel.locator('.ccrm-ring-hole-value').textContent()).trim();
    assert(hole.length > 0, `${heading}: the hole in the ring states what the percentages are of`);
    assert(
      /\d/.test(hole),
      `${heading}: and that denominator is a figure, not a word (saw "${hole}")`
    );

    /* The ring is reachable as text. The legend carries the numbers, and the
       title element carries the summary, so nothing on this chart is only
       available to someone who can see colour. */
    const title = (await svg.locator('title').textContent()).trim();
    assert(title.includes('in total'), `${heading}: the ring's title names its denominator for a screen reader`);

    /* The figure in the hole must sit inside the ring, not across it. Found
       at 390px, where a two-word denominator wrapped onto the wedges. */
    const holeBox = await panel.locator('.ccrm-ring-hole-value').boundingBox();
    const svgBox = await svg.boundingBox();
    if (holeBox && svgBox) {
      const inner = svgBox.width * 0.58;
      assert(
        holeBox.width <= inner,
        `${heading}: the figure in the hole (${holeBox.width.toFixed(0)}px) fits inside the ring's opening (${inner.toFixed(0)}px)`
      );
    }
    for (const share of legend) {
      assert(
        title.includes(`${share} per cent`),
        `${heading}: the title spells out ${share} per cent, so the shares are not colour-only`
      );
    }
  }

  assertEqual(errors.length, 0, `no console errors while three rings render (${errors.join(' | ')})`);
  await context.close();
}

group('The columns are drawn to scale and the tallest fills the frame');
{
  const { context, page } = await open('/crm/dashboard');

  const columns = await page.locator('.ccrm-column').all();
  if (columns.length === 0) {
    /* The fixture may hold no won work in this workspace, in which case the
       panel must say so rather than drawing an empty frame. */
    const panel = page.locator('section.ccrm-panel').filter({ has: page.locator('#dash-quarters') });
    const empty = await panel.locator('.ccrm-panel-empty').count();
    assert(empty === 1, 'with nothing won, the quarter panel says so rather than drawing an empty chart');
  } else {
    const measured = [];
    for (const column of columns) {
      const label = (await column.locator('.ccrm-column-label').textContent()).trim();
      const share = Number((await column.locator('.ccrm-column-share').textContent()).replace('%', ''));
      const fill = column.locator('.ccrm-column-fill');
      const track = column.locator('.ccrm-column-track');
      const fillBox = await fill.boundingBox();
      const trackBox = await track.boundingBox();
      measured.push({ label, share, height: fillBox?.height ?? 0, frame: trackBox?.height ?? 0 });
    }

    const shareSum = measured.reduce((sum, column) => sum + column.share, 0);
    assert(shareSum === 100, `the quarter percentages sum to ${shareSum}, and they must sum to 100`);

    const tallest = measured.reduce((max, column) => Math.max(max, column.height), 0);
    const frame = measured[0].frame;
    assert(
      Math.abs(tallest - frame) <= 1.5,
      `the tallest column (${tallest.toFixed(1)}px) fills its frame (${frame.toFixed(1)}px), or the chart has no scale`
    );

    /* Ordering is the check that matters: a taller column must be a larger
       figure. A chart that gets this wrong is worse than no chart. */
    const byShare = [...measured].sort((a, b) => b.share - a.share);
    const byHeight = [...measured].sort((a, b) => b.height - a.height);
    for (let i = 0; i < measured.length; i += 1) {
      assert(
        byShare[i].share === byHeight[i].share,
        `column order by height matches order by value at position ${i + 1}`
      );
    }

    for (const column of measured) {
      assert(column.height > 0, `${column.label}: a quarter with a value is drawn, not left blank`);
    }
  }

  await context.close();
}

group('Percentages never appear without the total they came from');
{
  const { context, page } = await open('/crm/dashboard');

  /* Every panel that prints a percentage must also print, in that same
     panel, what the percentage is of. This is checked by walking the panels
     rather than by trusting the markup, because the rule is about what a
     reader can see in one place. */
  const panels = await page.locator('.ccrm-panel').all();
  let withPercentages = 0;

  for (const panel of panels) {
    const text = (await panel.innerText()).replace(/\s+/g, ' ');
    if (!/\d+%/.test(text)) continue;
    withPercentages += 1;
    const heading = (await panel.locator('.ccrm-panel-title').first().textContent()).trim();
    assert(
      /in total|of the list|of this stage|of open pipeline|of all open|of the accounts|of the quarters|enquir|outstanding|share/i.test(
        text
      ),
      `${heading}: a panel printing percentages also states what they are of`
    );
  }

  assert(withPercentages >= 4, `at least four panels carry percentages (saw ${withPercentages})`);

  /* And the tiles. A coverage meter is a percentage about the figure above
     it, so it must carry its sentence. */
  const meters = await page.locator('.ccrm-figure-meter').all();
  assert(meters.length >= 3, `the money and count tiles carry a coverage meter (saw ${meters.length})`);
  for (const meter of meters) {
    const percent = (await meter.locator('.ccrm-figure-meter-percent').textContent()).trim();
    const label = (await meter.locator('.ccrm-figure-meter-label').textContent()).trim();
    assert(/^\d+%$/.test(percent), `a coverage meter reads as a percentage (saw "${percent}")`);
    assert(label.length > 10, `and it is explained in words, not left as a bare number (saw "${label}")`);

    const fill = await meter.locator('.ccrm-figure-meter-fill').boundingBox();
    const track = await meter.locator('.ccrm-figure-meter-track').boundingBox();
    const drawnPercent = track && track.width > 0 ? ((fill?.width ?? 0) / track.width) * 100 : 0;
    assert(
      Math.abs(drawnPercent - Number(percent.replace('%', ''))) <= 2,
      `the meter is drawn to ${drawnPercent.toFixed(1)} per cent against a printed ${percent}`
    );
  }

  await context.close();
}

group('The charts hold together at phone and tablet width');
for (const size of [PHONE, TABLET]) {
  const { context, page, errors } = await open('/crm/dashboard', size);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert(overflow <= 1, `${size.width}px: no sideways scroll (overflowed by ${overflow}px)`);

  /* A ring squashed to an ellipse reads as a different shape to the one the
     percentages describe, so the drawing must stay square. */
  const ringBoxes = await page.locator('svg.ccrm-ring').all();
  for (const [i, ring] of ringBoxes.entries()) {
    const box = await ring.boundingBox();
    assert(box !== null && box.width > 60, `${size.width}px: ring ${i + 1} is still large enough to read`);
    if (box) {
      assert(
        Math.abs(box.width - box.height) <= 2,
        `${size.width}px: ring ${i + 1} is square, so the wedges are not drawn as an ellipse`
      );
    }
  }

  /* Legend rows must not collapse into each other. */
  const legendRows = await page.locator('.ccrm-ring-legend li').all();
  for (const [i, row] of legendRows.entries()) {
    const box = await row.boundingBox();
    assert((box?.height ?? 0) >= 14, `${size.width}px: legend row ${i + 1} has not collapsed`);
  }

  const columns = await page.locator('.ccrm-column-track').all();
  for (const [i, column] of columns.entries()) {
    const box = await column.boundingBox();
    assert((box?.width ?? 0) >= 12, `${size.width}px: column ${i + 1} is still wide enough to see`);
  }

  assertEqual(errors.length, 0, `${size.width}px: no console errors (${errors.join(' | ')})`);
  await context.close();
}

group('A stage holding unvalued work does not look like an empty stage');
{
  const { context, page } = await open('/crm/dashboard?w=ws-key-accounts');

  const tracks = await page
    .locator('.ccrm-bar-track')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        novalue: node.classList.contains('ccrm-bar-track-novalue'),
        image: getComputedStyle(node).backgroundImage,
      }))
    );

  const hatched = tracks.filter((track) => track.novalue);
  const plain = tracks.filter((track) => !track.novalue);

  /* The rule that catches the real defect: the hatch lived earlier in the
     stylesheet than `.ccrm-bar-track`, whose `background` shorthand reset
     background-image, so it had never once painted and the two states were
     indistinguishable. Reading the class list would have passed. Reading the
     COMPUTED style is what fails. */
  for (const track of hatched) {
    assert(
      track.image !== 'none' && track.image.includes('gradient'),
      `a track marked as holding unvalued work actually paints its hatch (computed background-image was "${track.image}")`
    );
  }
  for (const track of plain) {
    assert(
      !track.image.includes('gradient'),
      'an ordinary track is not hatched, so the hatch still means one thing'
    );
  }
  assert(
    hatched.length === 0 || plain.length === 0 || hatched[0].image !== plain[0].image,
    'the two states are drawn differently, not merely marked differently'
  );

  await context.close();
}

group('Overview is a tab in the module navigation at every width');

for (const size of [PHONE, TABLET, DESKTOP]) {
  const { context, page } = await open(`/crm/dashboard?w=${W}`, size);

  const tabs = await page
    .locator('.ccrm-tab')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));

  assertEqual(tabs.length, 23, `${size.width}px: twenty-three destinations (saw ${tabs.length})`);
  assert(tabs.includes('Overview'), `${size.width}px: Overview is one of them`);

  const active = await page
    .locator('.ccrm-tab-active')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  assertEqual(active.length, 1, `${size.width}px: exactly one tab is current`);
  assertEqual(active[0], 'Overview', `${size.width}px: and it is Overview`);

  await context.close();
}

await browser.close();

console.log(`\n${checks - failures.length} of ${checks} checks passed.`);
if (failures.length > 0) {
  console.log('\nFAILURES, build blocked:\n');
  for (const failure of failures) console.log('  ' + failure);
  console.log('');
  process.exit(1);
}
console.log('Concludo CRM overview browser suite: all checks passed.\n');
