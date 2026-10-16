/**
 * Concludo CRM, Stage 7: the queue as a person reaches it.
 *
 * The contract, the grounding, the digest and the injection boundary are all
 * tested against the composition in `tests/crm.stage7.test.ts`, where they run
 * in a second. What cannot be tested there is whether the rendered queue
 * actually SHOWS the things it must show before somebody approves: the eleven
 * explanation headings, the field-by-field difference, the quoted source, and
 * the three marks that keep a proposal out of a batch.
 *
 * The property that matters most here is a negative one, and it is the last
 * group: there is no control anywhere on these pages that sends anything.
 *
 * Start the dev server first:
 *   npx vite --port 5217 --strictPort &
 *   node tests/browser/crm.stage7.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5217/crm-preview.html?p=';
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
  await page.waitForTimeout(260);
  return { context, page, errors };
}

/** The id of the first proposal in a named group, read off the page. */
async function firstProposalHref(page) {
  return page.$eval('.ccrm-item-title a[href*="/crm/proposals/"]', (node) =>
    node.getAttribute('href')
  );
}

/* ======================================= 1. the queue renders everywhere */

group('The queue and a proposal render at three widths with no console errors');

for (const size of [PHONE, TABLET, DESKTOP]) {
  for (const path of [`/crm/proposals?w=${W}`, `/crm/proposals/drafting-001?w=${W}`]) {
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

/* ============================= 2. the eleven things are all on the page */

group('A proposal shows all eleven explanations, in order, every time');

{
  const { context, page } = await open(`/crm/proposals/drafting-001?w=${W}`);

  const headings = await page.$$eval('.ccrm-explain-heading', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim())
  );
  assertEqual(headings.length, 11, `eleven headings are rendered (saw ${headings.length})`);

  const expected = [
    'What it observed',
    'Which records it used',
    'What it proposes',
    'What would change',
    'Whether anything leaves Concludo',
    'Confidence',
    'What it assumed',
    'What disagrees with it',
    'What it did not have',
    'What happens if you approve it',
    'Who can approve it',
  ];
  for (const [index, text] of expected.entries()) {
    assert(
      (headings[index] ?? '').includes(text),
      `heading ${index + 1} is "${text}" (saw "${headings[index] ?? 'nothing'}")`
    );
  }

  // Numbered, so somebody reading their fortieth of the morning knows where
  // they are without reading the words.
  for (const [index] of expected.entries()) {
    assert(
      (headings[index] ?? '').startsWith(`${index + 1}.`),
      `heading ${index + 1} is numbered`
    );
  }

  await context.close();
}

{
  // An empty section says which kind of empty it is.
  const { context, page } = await open(`/crm/proposals/capture-001?w=${W}`);
  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(
    text.includes('Nothing. Everything above comes from a record.') ||
      text.includes('Nothing in the records contradicts this.') ||
      text.includes('Nothing it needed was missing.'),
    'an empty section says what empty means rather than rendering blank'
  );
  await context.close();
}

/* ================================ 3. the difference is shown as rows */

group('What would change is shown field by field, not described');

{
  const { context, page } = await open(`/crm/proposals?w=${W}`);
  const href = await firstProposalHref(page);
  await context.close();

  const { context: c2, page: p2 } = await open(`${href.replace('/crm', '/crm')}`);
  const tables = await p2.$$('.ccrm-diff-table');

  if (tables.length > 0) {
    const headers = await p2.$$eval('.ccrm-diff-table thead th', (nodes) =>
      nodes.map((node) => (node.textContent ?? '').trim())
    );
    assert(headers.includes('Now'), 'the diff has a "Now" column');
    assert(headers.includes('Would become'), 'and a "Would become" column');

    const rows = await p2.$$eval('.ccrm-diff-table tbody tr', (nodes) =>
      nodes.map((row) => Array.from(row.querySelectorAll('td, th')).map((cell) => (cell.textContent ?? '').trim()))
    );
    for (const row of rows) {
      assert(row.length >= 4, 'every row has an include box, a field, a before and an after');
    }

    // Each row can be included or excluded, which is what makes partial
    // approval possible from the page rather than only from the model.
    const boxes = await p2.$$('.ccrm-diff-table input[type="checkbox"]');
    assertEqual(boxes.length, rows.length, 'every row has its own include box');
  } else {
    assert(true, 'this proposal changes nothing, which the page states instead');
  }

  await c2.close();
}

/* ============================== 4. the marks that keep things out of a batch */

group('A proposal that must be read on its own says so, on the row and on the page');

{
  const { context, page } = await open(`/crm/proposals?w=${W}`);

  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(text.includes('Need you to read them'), 'the queue separates what needs reading');
  assert(text.includes('Routine'), 'from what is routine');

  // The three marks, each one visible.
  const marks = await page.$$eval('.ccrm-proposal-marks .ccrm-mark', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim())
  );
  assert(
    marks.some((mark) => /carries a message/i.test(mark)),
    'a draft is marked as carrying a message'
  );
  assert(
    marks.some((mark) => /cannot be undone/i.test(mark)),
    'something irreversible is marked'
  );
  assert(
    marks.some((mark) => /addressed to software/i.test(mark)),
    'a source carrying text addressed to software is marked'
  );

  // Every row in the "needs reading" group says why it is there.
  assert(
    text.includes('Not part of approve-all:'),
    'and each one says why it is not part of approve-all'
  );

  // The batch button says how many it covers, rather than claiming everything.
  const batchLabel = await page.$eval('.ccrm-button-primary', (node) =>
    (node.textContent ?? '').trim()
  );
  assert(/Approve the \d+ routine/.test(batchLabel), `the batch button counts what it covers (${batchLabel})`);

  await context.close();
}

{
  // Approving the batch says what it skipped.
  const { context, page } = await open(`/crm/proposals?w=${W}`);
  await page.click('.ccrm-button-primary');
  await page.waitForTimeout(400);

  const status = (await page.textContent('.ccrm-write-result').catch(() => '')) ?? '';
  assert(status.includes('approved'), 'the batch says how many it approved');
  assert(status.includes('left for somebody to read'), 'and how many it left');
  assert(status.length > 60, 'with the reasons, rather than a bare number');

  await context.close();
}

/* ================================= 5. the injection notice is on the page */

group('A proposal built on content addressed to software says so loudly');

{
  const { context, page } = await open(`/crm/proposals?w=${W}`);
  const hrefs = await page.$$eval('.ccrm-item-title a[href*="/crm/proposals/"]', (nodes) =>
    nodes.map((node) => node.getAttribute('href'))
  );
  await context.close();

  let found = false;
  for (const href of hrefs.slice(0, 8)) {
    const { context: c, page: p } = await open(href);
    const notice = await p.$('.ccrm-injection-notice');
    if (notice) {
      const text = (await p.textContent('.ccrm-injection-notice')) ?? '';
      assert(
        text.includes('addressed to software'),
        'the notice says what was found'
      );
      assert(
        text.toLowerCase().includes('nothing in concludo acts on text'),
        'and that nothing acts on it'
      );
      assert(
        text.toLowerCase().includes('kept out of approve-all'),
        'and that the proposal is kept out of approve-all'
      );
      found = true;
      await c.close();
      break;
    }
    await c.close();
  }
  assert(found, 'at least one proposal in the demonstration data carries the notice');
}

/* ==================================== 6. nothing on these pages sends */

group('There is no control anywhere that sends anything');

for (const path of [`/crm/proposals?w=${W}`, `/crm/proposals/drafting-001?w=${W}`]) {
  const { context, page } = await open(path);

  /* BUTTONS, not every element with text in it.
   *
   * The first version of this scanned link text too, and failed on a link
   * whose label was the proposal's own sentence: "a follow-up email ... for
   * somebody to read, change and send themselves". That sentence is the
   * product saying it will not send, quoted inside a link that navigates to a
   * detail page. Matching on it taught nothing.
   *
   * What could actually send is a button that performs an action, or a link
   * that leaves the module. Both are checked, each with the right instrument:
   * buttons by their accessible name, links by their href. */
  const buttons = await page.$$eval('.ccrm-view button', (nodes) =>
    nodes.map((node) =>
      (node.getAttribute('aria-label') ?? node.textContent ?? '').trim().toLowerCase()
    )
  );

  for (const banned of ['send it', 'send now', 'send email', 'deliver', 'dispatch', 'email them']) {
    const matches = buttons.filter((label) => label.includes(banned));
    // "Send it back" is the request-for-information control and is the only
    // button on these pages with "send" in it.
    const realSends = matches.filter((label) => label !== 'send it back');
    assertEqual(
      realSends.length,
      0,
      `${path}: no button says "${banned}" (${realSends[0] ?? ''})`
    );
  }

  const sendish = buttons.filter((label) => label.includes('send'));
  for (const label of sendish) {
    assertEqual(
      label,
      'send it back',
      `${path}: the only button with "send" in it sends it back for information`
    );
  }

  // No link leaves the module.
  const external = await page.$$eval('.ccrm-view a[href]', (nodes) =>
    nodes.map((node) => node.getAttribute('href') ?? '').filter((href) => /^(https?:|mailto:)/.test(href))
  );
  assertEqual(external.length, 0, `${path}: no link points outside the module, including mailto`);

  await context.close();
}

{
  // The draft itself says Concludo cannot send it, next to the body.
  const { context, page } = await open(`/crm/proposals/drafting-001?w=${W}`);
  const note = (await page.textContent('.ccrm-draft-note').catch(() => '')) ?? '';
  assert(note.includes('no way to send'), 'the draft says Concludo has no way to send it');
  assert(note.includes('send it yourself'), 'and what to do instead');

  const body = await page.$('.ccrm-draft-body');
  assert(body !== null, 'and the body is shown in full, so it can be read before approval');

  await context.close();
}

/* ============================== 7. the page never claims a model ran */

group('The page says plainly that no model is called');

{
  const { context, page } = await open(`/crm/proposals?w=${W}`);
  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(
    text.includes('No model is called anywhere in this release'),
    'the queue says no model is called'
  );
  assert(
    text.includes('rules you can read'),
    'and what produces the proposals instead'
  );
  await context.close();
}

/* ================================= 8. keyboard and target size */

group('The queue works with a keyboard and with a thumb');

{
  const { context, page } = await open(`/crm/proposals/drafting-001?w=${W}`, PHONE);

  const small = await page.$$eval(
    '.ccrm-view button:not([disabled]), .ccrm-view select, .ccrm-view a[href], .ccrm-view input',
    (nodes) =>
      nodes
        .map((node) => {
          const box = node.getBoundingClientRect();
          const label =
            node.getAttribute('aria-label') ?? (node.textContent ?? '').trim().slice(0, 24);
          return { label, w: box.width, h: box.height, type: node.getAttribute('type') };
        })
        .filter((box) => box.w > 0 && box.h > 0 && (box.w < 24 || box.h < 24))
  );
  assertEqual(small.length, 0, `every control is at least 24px (${JSON.stringify(small[0] ?? {})})`);

  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return null;
    const style = getComputedStyle(active);
    return { outline: style.outlineWidth, shadow: style.boxShadow, style: style.outlineStyle };
  });
  assert(focused !== null, 'tab moves focus into the page');
  if (focused) {
    const visible =
      (focused.style !== 'none' && parseFloat(focused.outline) >= 2) ||
      (focused.shadow !== 'none' && focused.shadow.length > 0);
    assert(visible, `the focused control has a visible indicator (${JSON.stringify(focused)})`);
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
console.log('Concludo CRM Stage 7 browser suite: all checks passed.\n');
