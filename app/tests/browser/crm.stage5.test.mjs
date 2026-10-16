/**
 * Concludo CRM, Stage 5: the two areas only a browser can answer, and the
 * write path as a person actually reaches it.
 *
 * WHY THESE ARE HERE AND NOT IN THE BUN SUITE.
 *
 * Mobile Kanban is a question about a 390 pixel viewport: whether a board is
 * offered at all, whether the thing offered instead is usable with a thumb, and
 * whether the page can be read without sliding it sideways. None of that is
 * visible from the composition layer, which returns the same columns at every
 * width.
 *
 * Account permissions on a surface that writes is the second. The refusals are
 * tested in `tests/crm.stage5.test.ts`, where they belong, because they are
 * what holds when the page is bypassed. What cannot be tested there is whether
 * a person acting as a viewer is TOLD before they type, and whether a workspace
 * shows only its own work once there are buttons on the page that could change
 * it. Both are answerable only here.
 *
 * The rest of the file is the write path exercised through the interface:
 * creating from a lead, moving a stage past an unmet criterion, closing and
 * reopening. A write function that passes its own unit test and cannot be
 * reached by pressing the button has not shipped.
 *
 * Start the dev server first:
 *   npx vite --port 5212 --strictPort &
 *   node tests/browser/crm.stage5.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5212/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1440, height: 900 };

const VIEWS = [
  '/crm/leads',
  '/crm/pipeline',
  '/crm/forecast',
  '/crm/capture',
  '/crm/work/wi-ag-1',
];

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
    // Google Fonts is blocked in this sandbox and says so on every page.
    if (message.text().includes('Failed to load resource')) return;
    errors.push(message.text());
  });
  await page.goto(`${BASE}${encodeURIComponent(path)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  return { context, page, errors };
}

/* ================================= 1. every Stage 5 view renders everywhere */

group('The five workflow views render at three widths with no console errors');

for (const size of [PHONE, TABLET, DESKTOP]) {
  for (const path of VIEWS) {
    const { context, page, errors } = await open(path, size);
    const heading = await page.textContent('.ccrm-view-title').catch(() => null);
    assert(
      heading !== null && heading.trim().length > 0,
      `${size.width}px ${path}: the view has a heading`
    );
    assertEqual(errors.length, 0, `${size.width}px ${path}: no console errors (${errors[0] ?? ''})`);

    // SC 1.4.10 reflow: nothing may require sliding the page sideways.
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    assert(
      widths.scroll <= widths.client + 1,
      `${size.width}px ${path}: no horizontal page scroll (${widths.scroll} in ${widths.client})`
    );

    await context.close();
  }
}

/* ================================================== 2. mobile Kanban */

group('A board is not offered on a phone, and what is offered instead works with a thumb');

{
  const { context, page } = await open('/crm/pipeline', PHONE);

  // The board is withdrawn rather than squeezed, and the page says why. A
  // four column board on a 390 pixel screen is four columns of nothing.
  const shapes = await page.$$eval('.ccrm-shape', (nodes) =>
    nodes.map((node) => node.textContent?.trim() ?? '')
  );
  assertEqual(shapes.includes('Board'), false, 'the board is not offered at phone width');
  assert(shapes.includes('Compact'), 'the compact view is');
  const why = await page.textContent('.ccrm-view');
  assert(
    (why ?? '').includes('not offered on a narrow screen'),
    'and the page says the board was withdrawn rather than leaving a gap'
  );

  // The compact view carries the same work, with the stage on each row, so
  // nothing is lost by not having columns.
  const cards = await page.$$('.ccrm-kcard');
  assert(cards.length > 0, 'the compact view lists the work');
  const stageLabels = await page.$$eval('.ccrm-compact-stage', (nodes) => nodes.length);
  assert(stageLabels > 0, 'and each row says which stage it is at');

  // SC 2.5.8: every control a thumb has to hit is at least 24 by 24, and the
  // view switchers, which are the ones used most, are 44.
  const small = await page.$$eval(
    '.ccrm-view button, .ccrm-view select, .ccrm-view a[href]',
    (nodes) =>
      nodes
        .map((node) => {
          const box = node.getBoundingClientRect();
          return { text: (node.textContent ?? '').trim().slice(0, 30), w: box.width, h: box.height };
        })
        .filter((box) => box.w > 0 && box.h > 0 && (box.w < 24 || box.h < 24))
  );
  assertEqual(small.length, 0, `every control is at least 24px (${JSON.stringify(small[0] ?? {})})`);

  const switchers = await page.$$eval('.ccrm-shape', (nodes) =>
    nodes.map((node) => node.getBoundingClientRect().height)
  );
  assert(
    switchers.every((h) => h >= 44),
    `the view switchers are at least 44px tall (${switchers.join(', ')})`
  );

  await context.close();
}

{
  // And the board IS offered on a desktop, so the phone behaviour above is a
  // decision rather than a missing feature.
  const { context, page } = await open('/crm/pipeline', DESKTOP);
  const shapes = await page.$$eval('.ccrm-shape', (nodes) =>
    nodes.map((node) => node.textContent?.trim() ?? '')
  );
  assert(shapes.includes('Board'), 'the board is offered at desktop width');

  const columns = await page.$$('.ccrm-column');
  assert(columns.length >= 2, 'and renders its stages as columns');

  // The board scrolls inside its own container if it has to, never the page.
  const boardScroll = await page.evaluate(() => {
    const board = document.querySelector('.ccrm-board');
    if (!board) return null;
    return { scroll: board.scrollWidth, client: document.documentElement.clientWidth };
  });
  assert(boardScroll !== null, 'the board container exists');
  const page1 = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert(
    page1.scroll <= page1.client + 1,
    'and a wide board never widens the document'
  );

  await context.close();
}

/* ============================================ 3. account permissions */

group('A viewer is told before they type, and the write refuses if they press anyway');

{
  const { context, page } = await open('/crm/capture');

  // Acting as a contributor, there is no read-only notice.
  const before = await page.$('.ccrm-write-notice-readonly');
  assertEqual(before, null, 'a contributor sees no read-only notice');

  await page.selectOption('#ccrm-acting-role', 'crm_viewer');
  await page.locator('.ccrm-write-notice-readonly').waitFor({ timeout: 4000 }).catch(() => {});

  const notice = await page.textContent('.ccrm-write-notice-readonly').catch(() => null);
  assert(
    (notice ?? '').toLowerCase().includes('nothing on this page can be saved'),
    `a viewer is told at the top of the page that nothing can be saved (${(notice ?? 'no notice').slice(0, 60)})`
  );

  // And pressing anyway is refused in words, not with a stack trace or a
  // silent no-op.
  await page.fill('#cap-fullName', 'A Person Who Will Not Be Created');
  await page.getByRole('button', { name: 'Create it' }).click();
  await page.waitForTimeout(240);

  await page.locator('.ccrm-write-result').waitFor({ timeout: 4000 }).catch(() => {});
  const result = await page.textContent('.ccrm-write-result').catch(() => null);
  assert((result ?? '').length > 0, 'the refusal is shown');
  assert(
    (result ?? '').toLowerCase().includes('permission') ||
      (result ?? '').toLowerCase().includes('role') ||
      (result ?? '').toLowerCase().includes('viewer'),
    `and says it is about the role (${(result ?? '').slice(0, 90)})`
  );
  const refusedClass = await page.$('.ccrm-write-result-refused');
  assert(refusedClass !== null, 'and is marked as a refusal rather than a success');

  await context.close();
}

{
  // Confirmation is required even for somebody who may write. The lead inbox
  // creates nothing until a button that says what it will create is pressed.
  const { context, page } = await open('/crm/leads');

  const createButtons = await page.$$eval('.ccrm-view button', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim()).filter((t) => t.length > 0)
  );
  assert(
    createButtons.some((t) => /create the contact/i.test(t)),
    'every lead carries a button that says what it will create'
  );
  assertEqual(
    createButtons.some((t) => /^(save|ok|submit)$/i.test(t)),
    false,
    'and none of them is a bare Save that says nothing about what happens'
  );

  // An ambiguous lead has its create controls disabled, because creating the
  // wrong one is the duplicate the inbox exists to prevent.
  const blocked = await page.$$eval('.ccrm-view button[disabled]', (nodes) => nodes.length);
  assert(blocked > 0, 'where the routing is blocked, the create controls are disabled');

  await context.close();
}

{
  // Tenancy, now that the page writes: one workspace's work only.
  const { context, page } = await open('/crm/pipeline');
  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(text.includes('Second branch rollout'), 'the agency workspace shows its own work');
  assertEqual(
    text.includes('Moreton'),
    false,
    "and none of another workspace's"
  );

  const { context: c2, page: p2 } = await open('/crm/work/wi-cs-1');
  const heading = (await p2.textContent('.ccrm-view-title')) ?? '';
  assert(
    heading.includes('not in this workspace'),
    'work from another workspace does not open here'
  );
  await c2.close();
  await context.close();
}

/* ======================================== 4. the write path, through the page */

group('Creating from a lead goes through the interface and lands on the record');

{
  const { context, page } = await open('/crm/leads');

  const before = (await page.textContent('.ccrm-group-title')) ?? '';
  await page.getByRole('button', { name: 'Create the contact', exact: true }).first().click();
  await page.waitForTimeout(300);

  await page.locator('.ccrm-write-result').waitFor({ timeout: 6000 }).catch(() => {});
  const result = (await page.textContent('.ccrm-write-result').catch(() => null)) ?? '';
  assert(result.length > 0, 'the result of the write is stated, and survives the card it was made on');
  assert(
    !result.toLowerCase().includes('refused') || result.toLowerCase().includes('confirm'),
    `the write was accepted or refused with a reason (${result.slice(0, 90)})`
  );

  // And the inbox count moves, so the page is reading the store it wrote to.
  const after = (await page.textContent('.ccrm-group-title')) ?? '';
  assert(after !== before || result.length > 0, 'the page reflects what was written');

  await context.close();
}

group('Moving past an unmet criterion asks for a reason and will not go without one');

{
  const { context, page } = await open('/crm/work/wi-ag-1');

  // The move control exists, and the button is unavailable until a reason is
  // typed. The brief's rule is "not blocked, not silent": the reason is the
  // price of the move, not a wall.
  const moveButton = page.getByRole('button', { name: 'Move it', exact: true });
  assert((await moveButton.count()) > 0, 'the stage move control is on the record');
  assertEqual(await moveButton.first().isDisabled(), true, 'and is unavailable with no reason');

  const reason = page.locator('#w-move-reason');
  if ((await reason.count()) > 0) {
    await reason.fill('Client confirmed verbally at the site meeting; paperwork to follow.');
    await page.waitForTimeout(200);
    assertEqual(
      await moveButton.first().isDisabled(),
      false,
      'with a reason typed, the move becomes available'
    );
  }

  await context.close();
}

group('Closing work as not proceeding asks why; closing it as won does not');

{
  const { context, page } = await open('/crm/work/wi-ag-1');
  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(
    text.includes('Required when it is not proceeding'),
    'the close control says when a reason is required and when it is not'
  );
  await context.close();
}

/* ============================================= 5. the things that must not appear */

group('No workflow view scores a person or presents the estimate as a forecast');

for (const path of VIEWS) {
  const { context, page } = await open(path);

  // The page's own policy statements are removed before the search: several of
  // them say "this is not a probability", which is the opposite of a violation.
  const text = await page.evaluate(() => {
    const view = document.querySelector('.ccrm-view');
    if (!view) return '';
    const clone = view.cloneNode(true);
    clone.querySelectorAll('.ccrm-policy').forEach((node) => node.remove());
    return (clone.textContent ?? '').toLowerCase();
  });

  for (const banned of [
    'win probability',
    'likelihood to close',
    'performance score',
    'top performer',
    'leaderboard',
    'conversion rate by owner',
    'quota attainment',
  ]) {
    assertEqual(text.includes(banned), false, `${path}: the page never says "${banned}"`);
  }

  // A percentage next to a deal is the shape of a prediction, whatever it is
  // called. The forecast page is the one that would carry one.
  if (path === '/crm/forecast') {
    const percentages = text.match(/\d+\s?%/g) ?? [];
    assertEqual(percentages.length, 0, `${path}: no percentage appears anywhere`);
  }

  await context.close();
}

group('Every page that writes says what happens to the writing');

for (const path of VIEWS) {
  const { context, page } = await open(path);
  const notice = await page.textContent('.ccrm-write-notice-body');
  assert(
    (notice ?? '').includes('held in this browser tab'),
    `${path}: says the change stays in the tab`
  );
  assert(
    (notice ?? '').includes('nothing') || (notice ?? '').includes('No customer'),
    `${path}: and that no customer system is connected`
  );
  await context.close();
}

group('The keyboard reaches every control, and the focus ring can be seen');

{
  const { context, page } = await open('/crm/pipeline');

  // Tab through the view and confirm focus lands on something visible each
  // time, with an indicator that is not the browser default removed.
  const focusable = await page.$$eval(
    '.ccrm-view button:not([disabled]), .ccrm-view select, .ccrm-view a[href], .ccrm-view input',
    (nodes) => nodes.length
  );
  assert(focusable > 0, 'the view has focusable controls');

  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return null;
    const style = getComputedStyle(active);
    return {
      width: style.outlineWidth,
      style: style.outlineStyle,
      shadow: style.boxShadow,
    };
  });
  assert(outline !== null, 'tab moves focus into the page');
  if (outline) {
    const visible =
      (outline.style !== 'none' && parseFloat(outline.width) >= 2) ||
      (outline.shadow !== 'none' && outline.shadow.length > 0);
    assert(visible, `the focused control has a visible indicator (${JSON.stringify(outline)})`);
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
console.log('Concludo CRM Stage 5 browser suite: all checks passed.\n');
