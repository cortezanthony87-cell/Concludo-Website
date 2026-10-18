/**
 * Concludo CRM, the KAM Copilot, as a person reaches it.
 *
 * The composition suite proves the arithmetic and the refusals. What it cannot
 * prove is the thing this page lives or dies by: that a reader can tell, at a
 * glance, which of three states a sentence is in.
 *
 * So these checks are mostly about what the SCREEN separates:
 *
 *   the three columns are three columns, with three headings, at every width
 *     it is used at;
 *   an inference carries its reasoning in the same block, visibly, not in a
 *     tooltip or a footnote;
 *   a recorded finding carries a link to the record, and the link resolves;
 *   no name appears beside a figure anywhere on the page;
 *   the coverage percentage never appears without the sentence that says it
 *     is about the records.
 *
 * Start the dev server first:
 *   npx vite --port 5223 --strictPort &
 *   node tests/browser/crm.kam.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5223/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1440, height: 900 };

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
  await page.waitForTimeout(400);
  return { context, page, errors };
}

/* ====================================== 1. it renders, at three widths */

group('The copilot renders at three widths with no console errors');
for (const size of [DESKTOP, TABLET, PHONE]) {
  const { context, page, errors } = await open('/crm/kam', size);

  const heading = await page.locator('.ccrm-view-title').first().textContent();
  assert(
    (heading ?? '').includes('KAM Copilot'),
    `${size.width}px: the page is titled KAM Copilot (saw "${heading}")`
  );

  const lenses = await page.locator('.ccrm-kam-lens').count();
  assertEqual(lenses, 6, `${size.width}px: all six lenses render`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert(overflow <= 1, `${size.width}px: no sideways scroll (overflowed by ${overflow}px)`);

  assertEqual(errors.length, 0, `${size.width}px: no console errors (${errors.join(' | ')})`);
  await context.close();
}

/* ============================ 2. the three states are three columns */

group('Every lens separates recorded, inferred and unanswered');
{
  const { context, page } = await open('/crm/kam');

  const lenses = await page.locator('.ccrm-kam-lens').all();
  for (const [i, lens] of lenses.entries()) {
    const heading = (await lens.locator('.ccrm-panel-title').textContent()).trim();

    const heads = await lens
      .locator('.ccrm-kam-column-head')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));

    assertEqual(heads.length, 3, `${heading}: three column headings`);
    assertEqual(heads[0], 'What is recorded', `${heading}: the first column is what is recorded`);
    assertEqual(
      heads[1],
      'What the copilot inferred',
      `${heading}: the second says plainly that the copilot inferred it`
    );
    assertEqual(
      heads[2],
      'What nothing answers',
      `${heading}: the third is what nothing answers`
    );

    /* Side by side at desktop width. The whole point of three columns rather
       than one labelled list is that a column cannot be skimmed past, and that
       only holds while they are actually beside each other. */
    const boxes = [];
    for (const column of await lens.locator('.ccrm-kam-column').all()) {
      boxes.push(await column.boundingBox());
    }
    assertEqual(boxes.length, 3, `${heading}: three columns`);
    if (boxes[0] && boxes[1] && boxes[2]) {
      assert(
        boxes[1].x > boxes[0].x && boxes[2].x > boxes[1].x,
        `${heading}: the three columns are beside each other at 1440px, not stacked`
      );
      assert(
        Math.abs(boxes[0].y - boxes[1].y) < 4 && Math.abs(boxes[1].y - boxes[2].y) < 4,
        `${heading}: and they start on the same line, so none reads as a footnote to another`
      );
    }
    void i;
  }

  await context.close();
}

group('An inference shows its reasoning in the same block');
{
  const { context, page } = await open('/crm/kam');

  /* Walk every account in the rail until one has an inference, because an
     account with nothing inferred proves nothing either way. */
  const cards = await page.locator('.ccrm-card-button').all();
  let found = 0;

  for (const card of cards) {
    await card.click();
    await page.waitForTimeout(250);

    /* Count across the whole page, not the first lens. Checking only the
       first lens found nothing and reported the fixture as having no
       inferences, when every account in it has one further down. */
    const inferred = await page.locator('.ccrm-kam-from').count();

    if (inferred === 0) continue;
    found += 1;

    const blocks = await page.locator('.ccrm-kam-from').all();
    assert(
      blocks.length > 0,
      'an account with an inference shows at least one "inferred from" block'
    );

    for (const block of blocks) {
      const text = (await block.textContent()).trim();
      assert(
        text.toLowerCase().startsWith('inferred from'),
        `the reasoning is labelled as an inference (saw "${text.slice(0, 40)}")`
      );
      assert(
        text.length > 40,
        'and it says what it was inferred from, in a sentence rather than a word'
      );

      /* Visible, not hidden behind a hover or a disclosure. A reason nobody
         sees is a reason nobody can disagree with. */
      const visible = await block.isVisible();
      assert(visible, 'and it is visible on the page without any interaction');

      /* It must sit with its own finding, not float at the bottom of the
         column where it would attach to the wrong statement. */
      const sameBlock = await block.evaluate((node) => {
        const finding = node.closest('.ccrm-kam-finding');
        return finding ? finding.querySelector('.ccrm-kam-statement') !== null : false;
      });
      assert(sameBlock, 'and it sits inside the finding it explains');
    }
    break;
  }

  assert(found > 0, 'at least one account in the fixture carries an inference to check');
  await context.close();
}

group('A recorded finding links to the record, and the link resolves');
{
  const { context, page } = await open('/crm/kam');

  const links = await page
    .locator('.ccrm-kam-sources a')
    .evaluateAll((nodes) => nodes.slice(0, 6).map((node) => node.getAttribute('href')));

  /* The suppression of redundant account links on gaps must not have removed
     the links that matter: a recorded finding is only checkable if the record
     behind it opens. */
  assert(
    links.length >= 2,
    `recorded findings carry links to their records (saw ${links.length})`
  );

  const inKnown = await page
    .locator('.ccrm-kam-known')
    .first()
    .evaluate((node) => {
      const column = node.closest('.ccrm-kam-column');
      return column ? column.querySelectorAll('.ccrm-kam-sources a').length : -1;
    });
  void inKnown;

  for (const href of links) {
    assert(href !== null && href.length > 0, 'the link has a destination');
    if (!href) continue;
    const { context: next, page: opened } = await open(
      decodeURIComponent(href.split('p=')[1] ?? href)
    );
    const missing = await opened.locator('text=/not found|no such page/i').count();
    assertEqual(missing, 0, `the record behind a finding opens: ${href}`);
    await next.close();
  }

  await context.close();
}

/* ============================ 3. nothing on the page is about a person */

group('No figure on the page sits beside a person');
{
  const { context, page } = await open('/crm/kam');

  /* The buying centre is counts of seats. A name anywhere in that panel would
     mean the page had started assessing individuals. */
  const seatText = await page.locator('.ccrm-kam-seats').innerText();
  assert(
    !/\b(?:Mr|Mrs|Ms|Dr)\b/.test(seatText),
    'no honorific appears in the buying centre, which would mark a named person'
  );

  const seatRows = await page.locator('.ccrm-kam-seat').all();
  assert(seatRows.length >= 7, `every seat in the buying centre is listed (saw ${seatRows.length})`);

  for (const row of seatRows) {
    const text = (await row.innerText()).replace(/\s+/g, ' ').trim();
    /* Each row reads as "<role> <count> people" or "<role> Nobody recorded".
       A row that read "<role> Priya Raman" is the failure. */
    assert(
      /(?:\d+\s+(?:person|people)|Nobody recorded|None recorded)/.test(text),
      `a seat row is a count or an absence, not a name (saw "${text}")`
    );
  }

  /* The accusation role must never be rendered with the accusing word. */
  assert(
    !seatText.toLowerCase().includes('blocker'),
    'the resistant seat is labelled by what was recorded, not with the word blocker'
  );

  await context.close();
}

group('The coverage figure never appears without saying what it is of');
{
  const { context, page } = await open('/crm/kam');

  const coverages = await page.locator('.ccrm-kam-coverage').all();
  assert(coverages.length >= 6, `each lens shows its coverage (saw ${coverages.length})`);

  for (const coverage of coverages) {
    const figure = (await coverage.locator('.ccrm-kam-coverage-figure').textContent()).trim();
    const label = (await coverage.locator('.ccrm-kam-coverage-label').textContent()).trim();
    assert(/^\d+%$/.test(figure), `the coverage reads as a percentage (saw "${figure}")`);
    assert(
      label.toLowerCase().includes('recorded'),
      `and says it is about what is recorded (saw "${label}")`
    );
    assert(await coverage.locator('.ccrm-kam-coverage-label').isVisible(), 'and that sentence is visible');
  }

  /* The page itself must say the figure is not a grade of the customer. */
  const body = (await page.locator('.ccrm-module').innerText()).toLowerCase();
  assert(
    body.includes('about the records'),
    'the page states that the coverage figure is about the records'
  );
  assert(
    body.includes('never a judgement') ||
      body.includes('not an assessment') ||
      body.includes('never an assessment'),
    'and that nothing here assesses a person'
  );

  await context.close();
}

/* ============================ 4. questions, and the standing promises */

group('Every question on screen says what it closes and who to ask');
{
  const { context, page } = await open('/crm/kam');

  const questions = await page.locator('.ccrm-kam-questions li').all();
  assert(questions.length > 0, 'the page lists questions to ask');

  for (const question of questions) {
    const text = (await question.locator('.ccrm-kam-question').textContent()).trim();
    const closes = (await question.locator('.ccrm-kam-question-closes').textContent()).trim();

    assert(text.endsWith('?'), `a question is a question (saw "${text.slice(0, 40)}")`);
    assert(
      closes.startsWith('Closes:'),
      `and names the gap it closes (saw "${closes.slice(0, 40)}")`
    );
    assert(
      /Ask\s+\S/.test(closes),
      `and says who would know, by role (saw "${closes.slice(0, 60)}")`
    );
  }

  await context.close();
}

group('The page states what the copilot will not do');
{
  const { context, page } = await open('/crm/kam');
  const body = (await page.locator('.ccrm-module').innerText()).toLowerCase();

  for (const promise of [
    'writes nothing',
    'sends nothing',
    'proposes',
    'no model behind this page',
  ]) {
    assert(body.includes(promise), `the page says it ${promise}`);
  }

  await context.close();
}

/* ============================ 5. targets, focus and the module tab */

group('The copilot meets the target sizes and keeps a visible focus ring');
for (const size of [DESKTOP, PHONE]) {
  const { context, page } = await open('/crm/kam', size);

  const minimum = size.width <= 700 ? 44 : 24;
  const small = [];

  for (const handle of await page.locator('a, button').all()) {
    if (!(await handle.evaluate((node) => node.checkVisibility()))) continue;
    const box = await handle.boundingBox();
    if (!box || box.width === 0 || box.height === 0) continue;
    if (box.width >= minimum && box.height >= minimum) continue;
    const label = (await handle.innerText()).trim().slice(0, 18);
    small.push(`${label} ${Math.round(box.width)}x${Math.round(box.height)}`);
  }

  assertEqual(
    small.length,
    0,
    `${size.width}px: every control is at least ${minimum} by ${minimum} (${small.join('; ')})`
  );

  const ring = await page.evaluate(() => {
    const target = document.querySelector('.ccrm-card-button');
    if (!target) return null;
    target.focus();
    const style = getComputedStyle(target);
    return { outline: style.outlineStyle, width: style.outlineWidth };
  });
  assert(ring !== null, `${size.width}px: there is a control to focus`);
  if (ring) {
    assert(
      ring.outline !== 'none' && parseFloat(ring.width) > 0,
      `${size.width}px: a focused card shows a ring (${ring.outline} ${ring.width})`
    );
  }

  await context.close();
}

group('The copilot is a tab in the module navigation at every width');
for (const size of [DESKTOP, TABLET, PHONE]) {
  const { context, page } = await open('/crm/kam', size);

  const tabs = await page
    .locator('.ccrm-tab')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));

  assertEqual(tabs.length, 23, `${size.width}px: twenty-three destinations (saw ${tabs.length})`);
  assert(tabs.includes('KAM Copilot'), `${size.width}px: the copilot is one of them`);

  const active = await page
    .locator('.ccrm-tab-active')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  assertEqual(active.length, 1, `${size.width}px: exactly one tab is current`);
  assertEqual(active[0], 'KAM Copilot', `${size.width}px: and it is the copilot`);

  await context.close();
}

group('Choosing another account changes the review');
{
  const { context, page } = await open('/crm/kam');

  const cards = await page.locator('.ccrm-card-button').all();
  if (cards.length < 2) {
    assert(true, 'this workspace has one account, so there is nothing to switch between');
  } else {
    const firstHeading = (
      await page.locator('#kam-seats').textContent()
    ).trim();

    await cards[1].click();
    await page.waitForTimeout(300);

    const secondHeading = (await page.locator('#kam-seats').textContent()).trim();
    assert(
      firstHeading !== secondHeading,
      `choosing another customer reads that customer (was "${firstHeading}", now "${secondHeading}")`
    );

    const pressed = await page
      .locator('.ccrm-card-button[aria-pressed="true"]')
      .count();
    assertEqual(pressed, 1, 'exactly one account is marked as the one being read');
  }

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
console.log('Concludo CRM KAM Copilot browser suite: all checks passed.\n');
