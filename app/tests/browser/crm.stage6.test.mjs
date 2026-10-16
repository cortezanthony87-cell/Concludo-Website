/**
 * Concludo CRM, Stage 6: the parts only a browser can answer.
 *
 * TWO THINGS LIVE HERE.
 *
 * Using an account plan on a phone, which is the ninth area the brief names and
 * is a question about a 390 pixel viewport: whether the two columns that carry
 * the plan's central distinction survive being stacked, whether a four by four
 * grid is usable with a thumb, and whether anything has to be slid sideways.
 *
 * And the thing this whole stage was asked to get right: that a workspace with
 * account planning off shows NO TRACE of it. Not a greyed tab, not an empty
 * panel, not a lock icon. That is only testable by rendering the shell and
 * looking at what is in the navigation, because the composition layer returns
 * the same nothing either way.
 *
 * Start the dev server first:
 *   npx vite --port 5214 --strictPort &
 *   node tests/browser/crm.stage6.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5214/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1440, height: 900 };

const PLANNED = 'ws-key-accounts';
const UNPLANNED = 'ws-sole-trader';

const VIEWS = [
  `/crm/account-plans?w=${PLANNED}`,
  `/crm/account-plans/org-ka-1?w=${PLANNED}`,
  `/crm/account-plans/org-ka-1/stakeholders?w=${PLANNED}`,
  `/crm/account-plans/org-ka-1/whitespace?w=${PLANNED}`,
  `/crm/account-plans/org-ka-1/review?w=${PLANNED}`,
  `/crm/account-plans/joint/jp-ka-1?w=${PLANNED}`,
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
    if (message.text().includes('Failed to load resource')) return;
    errors.push(message.text());
  });
  await page.goto(`${BASE}${encodeURIComponent(path)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  return { context, page, errors };
}

/* ============================== 1. every planning view renders everywhere */

group('The six planning views render at three widths with no console errors');

for (const size of [PHONE, TABLET, DESKTOP]) {
  for (const path of VIEWS) {
    const { context, page, errors } = await open(path, size);
    const heading = await page.textContent('.ccrm-view-title').catch(() => null);
    assert(
      heading !== null && heading.trim().length > 0,
      `${size.width}px ${path}: the view has a heading`
    );
    assertEqual(errors.length, 0, `${size.width}px ${path}: no console errors (${errors[0] ?? ''})`);

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

/* ============================== 2. hidden by default, in the interface */

group('A workspace with planning off shows no trace of it anywhere');

{
  const { context, page } = await open(`/crm?w=${UNPLANNED}`);

  // The tab is not in the row. Not disabled, not greyed, not there.
  const tabs = await page.$$eval('.ccrm-tab', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim())
  );
  assertEqual(
    tabs.some((tab) => /account plan/i.test(tab)),
    false,
    'the Account Plans tab is absent from the navigation'
  );
  assert(tabs.length > 0, 'and the other tabs are still there, so this is a filter and not a break');

  // Nothing anywhere on the page mentions the feature.
  const text = ((await page.textContent('.ccrm-view')) ?? '').toLowerCase();
  for (const word of ['account plan', 'stakeholder map', 'whitespace', 'swot', 'joint plan']) {
    assertEqual(text.includes(word), false, `the page never mentions "${word}"`);
  }

  await context.close();
}

{
  // And the same workspace with planning ON does have it, so the absence above
  // is a decision rather than a missing feature.
  const { context, page } = await open(`/crm?w=${PLANNED}`);
  const tabs = await page.$$eval('.ccrm-tab', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim())
  );
  assert(
    tabs.some((tab) => /account plan/i.test(tab)),
    'the tab is present where planning is on'
  );
  await context.close();
}

{
  // Reaching the page by typing the URL explains itself and does not sell
  // anything. A person who arrived by accident should leave without feeling
  // they are missing out.
  const { context, page } = await open(`/crm/account-plans?w=${UNPLANNED}`);
  const text = (await page.textContent('.ccrm-view')) ?? '';

  assert(text.includes('turned off'), 'the page says the feature is off');
  assert(
    text.toLowerCase().includes('nothing to buy'),
    'and says plainly that there is nothing to buy'
  );
  // Word boundaries: "trial" is a substring of "Industrial", which is the name
  // of a workspace in the picker at the top of every page.
  assertEqual(
    /\b(upgrade|trial|per seat|contact sales)\b|plan starts at/i.test(text),
    false,
    'with no upsell of any kind'
  );

  // No planning content is rendered behind the explanation.
  const panels = await page.$$('.ccrm-plan-columns, .ccrm-whitespace-table, .ccrm-stakeholder');
  assertEqual(panels.length, 0, 'and no planning scaffolding is rendered behind it');

  await context.close();
}

/* ============================== 3. mobile account-plan use */

group('An account plan is usable on a phone');

{
  const { context, page } = await open(`/crm/account-plans/org-ka-1?w=${PLANNED}`, PHONE);

  // The two columns stack. The distinction they carry is in WORDS as well as
  // position, so stacking does not destroy it.
  const labels = await page.$$eval('.ccrm-plan-column-label', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim())
  );
  assertEqual(labels.length, 2, 'both column labels are present on a phone');
  assert(
    labels[0].toLowerCase().includes('read from the records'),
    'the derived column says what it is'
  );
  assert(
    labels[1].toLowerCase().includes('written by people'),
    'and the written column says what it is'
  );

  // Stacked, not side by side: the second label is below the first.
  const boxes = await page.$$eval('.ccrm-plan-column-label', (nodes) =>
    nodes.map((node) => node.getBoundingClientRect().top)
  );
  assert(boxes[1] > boxes[0] + 40, 'and they are stacked rather than squeezed side by side');

  // Everything a thumb has to hit is at least 24px, and the back link 44.
  const small = await page.$$eval(
    '.ccrm-view button, .ccrm-view select, .ccrm-view a[href]',
    (nodes) =>
      nodes
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            text: (node.textContent ?? '').trim().slice(0, 30),
            w: box.width,
            h: box.height,
          };
        })
        .filter((box) => box.w > 0 && box.h > 0 && (box.w < 24 || box.h < 24))
  );
  assertEqual(small.length, 0, `every control is at least 24px (${JSON.stringify(small[0] ?? {})})`);

  const back = await page.$eval('.ccrm-back-link', (node) => node.getBoundingClientRect().height);
  assert(back >= 44, `the back link is at least 44px tall (${back})`);

  await context.close();
}

{
  // The whitespace grid on a phone. The table scrolls inside its own container,
  // never the page, and every cell still says its state in words.
  const { context, page } = await open(
    `/crm/account-plans/org-ka-1/whitespace?w=${PLANNED}`,
    PHONE
  );

  const pageScroll = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert(
    pageScroll.scroll <= pageScroll.client + 1,
    'a wide grid never widens the document on a phone'
  );

  const container = await page.$('.ccrm-grid-scroll');
  assert(container !== null, 'the grid has its own scroll container');

  const states = await page.$$eval('.ccrm-ws-state', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim())
  );
  assert(states.length > 0, 'the cells render');
  assert(
    states.every((state) => state.length > 0),
    'and every one of them says its state in words rather than by colour alone'
  );
  assert(
    states.some((state) => /not known yet/i.test(state)),
    'including the unknown ones, which say so'
  );

  await context.close();
}

/* ============================== 4. unknown is loud, not quiet */

group('The unknown cells are the visible ones, not the faded ones');

{
  const { context, page } = await open(`/crm/account-plans/org-ka-1/whitespace?w=${PLANNED}`);

  // An unknown cell is not rendered in a lighter colour than an answered one.
  // The whole failure mode of a whitespace grid is that grey reads as nothing
  // to do, and the unknowns are the only cells worth a conversation.
  const contrast = await page.evaluate(() => {
    const unknown = document.querySelector('.ccrm-ws-unknown .ccrm-ws-state');
    const answered = document.querySelector('.ccrm-ws-in_use .ccrm-ws-state');
    if (!unknown || !answered) return null;
    return {
      unknown: getComputedStyle(unknown).color,
      answered: getComputedStyle(answered).color,
      unknownWeight: getComputedStyle(unknown).fontWeight,
      answeredWeight: getComputedStyle(answered).fontWeight,
    };
  });
  assert(contrast !== null, 'both an unknown and an answered cell are on the page');
  if (contrast) {
    assertEqual(
      contrast.unknown,
      contrast.answered,
      'an unknown cell is not drawn in a quieter colour than an answered one'
    );
    assertEqual(
      contrast.unknownWeight,
      contrast.answeredWeight,
      'nor in a lighter weight'
    );
  }

  // The questions list exists and is not empty, because it is the useful half.
  const questions = await page.$$eval('.ccrm-plain-list li', (nodes) => nodes.length);
  assert(questions > 0, 'the questions worth asking are listed');

  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(
    text.includes('Not known yet'),
    'and the grid uses the words "Not known yet" rather than a blank'
  );

  await context.close();
}

/* ============================== 5. the joint plan goes nowhere */

group('Nothing on a joint plan offers to send it anywhere');

{
  const { context, page } = await open(`/crm/account-plans/joint/jp-ka-1?w=${PLANNED}`);

  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(
    text.includes('not shared with the customer'),
    'the page says it is not shared, before anything else'
  );

  // No control anywhere offers to share, send, export or copy a link.
  const controls = await page.$$eval('.ccrm-view button, .ccrm-view a[href]', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim().toLowerCase())
  );
  for (const banned of ['share', 'send', 'export', 'copy link', 'publish', 'email']) {
    assertEqual(
      controls.some((label) => label.includes(banned)),
      false,
      `no control says "${banned}"`
    );
  }

  // No link leaves the module.
  const external = await page.$$eval('.ccrm-view a[href]', (nodes) =>
    nodes.map((node) => node.getAttribute('href') ?? '').filter((href) => /^https?:/.test(href))
  );
  assertEqual(external.length, 0, 'and no link on the page points outside the module');

  await context.close();
}

/* ============================== 6. nobody is scored */

group('No planning view scores, ranks or rates a person');

for (const path of VIEWS) {
  const { context, page } = await open(path);

  const text = await page.evaluate(() => {
    const view = document.querySelector('.ccrm-view');
    if (!view) return '';
    const clone = view.cloneNode(true);
    clone.querySelectorAll('.ccrm-policy').forEach((node) => node.remove());
    return (clone.textContent ?? '').toLowerCase();
  });

  // Word boundaries, not substrings. "rating" lives inside "operating", and a
  // substring search on an earlier stage failed for exactly that reason.
  for (const banned of [
    'score',
    'scored',
    'rating',
    'ranked',
    'leaderboard',
    'top performer',
    'engagement level',
  ]) {
    const pattern = new RegExp(`\\b${banned}\\b`);
    assertEqual(pattern.test(text), false, `${path}: the page never says "${banned}"`);
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
console.log('Concludo CRM Stage 6 browser suite: all checks passed.\n');
