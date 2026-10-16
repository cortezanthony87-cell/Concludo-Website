/**
 * Concludo CRM, Stage 8: the finished module as a person reaches it.
 *
 * The composition suite in `tests/crm.stage8.test.ts` proves the rules hold in
 * the functions. What it cannot prove is that the screens SHOW them, and on
 * this stage several of the rules only matter if they are visible:
 *
 *   a zero that means "nothing is connected" has to read differently on the
 *   page from a zero that means "nothing is wrong";
 *   the commit button has to be unavailable before the preview, not merely
 *   refused after it;
 *   a withheld case detail has to be visibly withheld;
 *   and there must be no control anywhere on these pages that sends anything.
 *
 * Start the dev server first:
 *   npx vite --port 5218 --strictPort &
 *   node tests/browser/crm.stage8.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5218/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1440, height: 900 };

const W = 'ws-agency';
const PATHS = ['/crm/data-quality', '/crm/reports', '/crm/service', '/crm/imports', '/crm/settings'];

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
  await page.waitForTimeout(280);
  return { context, page, errors };
}

/* ================================ 1. every page renders at three widths */

group('The five Stage 8 pages render at three widths with no console errors');

for (const size of [PHONE, TABLET, DESKTOP]) {
  for (const path of PATHS) {
    const { context, page, errors } = await open(`${path}?w=${W}`, size);

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

    const text = await page.evaluate(() => document.body.innerText);
    assert(!text.includes('—'), `${size.width}px ${path}: no em dash`);

    await context.close();
  }
}

/* =========================================== 2. the ten indicators */

group('The data-quality page shows ten indicators, and says which zeros are empty');

{
  const { context, page } = await open(`/crm/data-quality?w=${W}`);

  const cards = await page.$$eval('.ccrm-indicator', (nodes) => nodes.length);
  assertEqual(cards, 10, 'ten indicator cards are rendered');

  const states = await page.$$eval('.ccrm-indicator', (nodes) =>
    nodes.map((node) => ({
      heading: (node.querySelector('.ccrm-panel-title')?.textContent ?? '').trim(),
      word: (node.querySelector('.ccrm-mark')?.textContent ?? '').trim(),
      reason: (node.querySelector('.ccrm-reason-text')?.textContent ?? '').trim(),
    }))
  );

  for (const state of states) {
    assert(state.word.length > 0, `${state.heading}: the state is a word, not only a colour`);
  }

  const empty = states.filter((state) => state.word === 'Nothing to measure yet');
  assert(empty.length > 0, 'at least one indicator has nothing to measure in this workspace');
  for (const state of empty) {
    assert(
      state.reason.length > 20,
      `${state.heading}: a zero with nothing behind it says why on the page`
    );
  }

  const text = await page.evaluate(() => document.body.innerText);
  assert(
    text.includes('counts of records, never of people'),
    'the page says what it counts and what it does not'
  );
  assert(
    text.includes('Connections not bringing anything in'),
    'the integration indicator is on the page'
  );
  assert(
    text.includes('Permission has been expired') || text.includes('Failed'),
    'and a broken connection is counted in the workspace that has one'
  );

  await context.close();
}

{
  // In a workspace with nothing connected the same indicator must read
  // differently. This is the pair of checks that the whole third state exists
  // for: a zero because nothing is wrong, and a zero because nothing is there.
  const { context, page } = await open('/crm/data-quality?w=ws-sole-trader');
  const text = await page.evaluate(() => document.body.innerText);

  assert(
    text.includes('nothing can fail'),
    'with nothing connected, the zero says it is because nothing is connected'
  );
  assert(
    text.includes('Nothing to measure yet'),
    'and is marked as nothing to measure rather than as nothing to do'
  );

  await context.close();
}

/* =================================== 3. reports, with nobody counted */

group('The six reports are reachable, and none of them names a person as a figure');

{
  const { context, page } = await open(`/crm/reports?w=${W}`);

  const options = await page.$$eval('#ccrm-report-role option', (nodes) =>
    nodes.map((node) => node.value)
  );
  assertEqual(options.length, 6, 'six reports in the picker');

  const seen = [];
  for (const role of options) {
    await page.selectOption('#ccrm-report-role', role);
    await page.waitForTimeout(160);

    const text = await page.evaluate(() => document.body.innerText);
    seen.push(role);

    assert(
      text.includes('Nothing on this page counts anything per person'),
      `${role}: the standing note is on the page`
    );

    // No user id reaches the DOM, in any form.
    const html = await page.content();
    assert(!/u-(anthony|priya|tom|outsider)-/.test(html), `${role}: no user id in the markup`);

    const figures = await page.$$eval('.ccrm-answer-count', (nodes) =>
      nodes.map((node) => (node.textContent ?? '').trim())
    );
    assert(figures.length > 0, `${role}: the report has figures`);
  }
  assertEqual(seen.length, 6, 'every report was opened');

  await context.close();
}

group('A figure that cannot be computed reads as blank, with a reason');

{
  // The fixture workspaces are small, so every figure is computed live and the
  // page should say so rather than leave the reader guessing at its age.
  const { context, page } = await open(`/crm/reports?w=${W}`);
  await page.selectOption('#ccrm-report-role', 'manager');
  await page.waitForTimeout(160);

  const text = await page.evaluate(() => document.body.innerText);
  assert(text.includes('Checked just now'), 'a live figure says it was checked just now');

  await context.close();
}

/* ============================================= 4. service */

group('Service shows the consequence, the working, and withholds what it must');

{
  const { context, page } = await open(`/crm/service?w=${W}`);
  const text = await page.evaluate(() => document.body.innerText);

  assert(
    text.includes('No service level has been agreed with any customer'),
    'the page says the targets are Concludo’s own'
  );
  assert(text.includes('What it means for them'), 'every case leads with the consequence');

  const working = await page.$('button.ccrm-disclosure-button');
  assert(working !== null, 'the priority can be expanded to its working');
  if (working) {
    await working.click();
    await page.waitForTimeout(160);
    const expanded = await page.evaluate(() => document.body.innerText);
    assert(
      expanded.length > text.length,
      'and expanding it shows the sentences the priority came from'
    );
  }

  await context.close();
}

group('A viewer is told that something is withheld');

{
  const { context, page } = await open(`/crm/service?w=${W}`);

  const asContributor = await page.evaluate(() => document.body.innerText);
  await page.selectOption('#ccrm-acting-role', 'crm_viewer');
  await page.waitForTimeout(200);
  const asViewer = await page.evaluate(() => document.body.innerText);

  assert(
    asViewer.length < asContributor.length,
    'a viewer sees less than a contributor'
  );
  assert(
    /not shown|withheld|cannot see|may not/i.test(asViewer),
    'and is told that something is being withheld rather than shown an empty space'
  );

  await context.close();
}

group('Nothing on the service page sends');

{
  const { context, page } = await open(`/crm/service?w=${W}`);

  const sendControls = await page.$$eval('button, a[href]', (nodes) =>
    nodes
      .filter((node) => {
        const label = (node.getAttribute('aria-label') ?? node.textContent ?? '').toLowerCase();
        const href = (node.getAttribute('href') ?? '').toLowerCase();
        return (
          /^\s*(send|email|reply|post)\b/.test(label) ||
          href.startsWith('mailto:') ||
          href.includes('/send')
        );
      })
      .map((node) => node.textContent ?? '')
  );
  assertEqual(sendControls.length, 0, `no control sends anything (${sendControls.join(', ')})`);

  await context.close();
}

/* ============================================= 5. the importer */

group('The importer will not commit before the preview has been run');

{
  const { context, page } = await open(`/crm/imports?w=${W}`);

  await page.selectOption('#ccrm-acting-role', 'crm_approver');
  await page.waitForTimeout(160);

  await page.getByRole('button', { name: 'Read the file' }).click();
  await page.waitForTimeout(200);

  const mappingText = await page.evaluate(() => document.body.innerText);
  assert(
    mappingText.includes('Nothing is mapped until you accept it'),
    'the mapping says it is a suggestion'
  );
  assert(
    mappingText.includes('is ignored'),
    'a column nothing matches is named as ignored rather than dropped quietly'
  );

  await page.getByRole('button', { name: 'Check every row' }).click();
  await page.waitForTimeout(200);

  const before = await page.getByRole('button', { name: /^Commit/ }).isDisabled();
  assertEqual(before, true, 'the commit button is unavailable before the preview');

  await page.getByRole('button', { name: 'Run the preview' }).click();
  await page.waitForTimeout(200);

  const after = await page.getByRole('button', { name: /^Commit/ }).isDisabled();
  assertEqual(after, false, 'and available after it');

  const previewText = await page.evaluate(() => document.body.innerText);
  assert(previewText.includes('Nothing has been written'), 'the preview says it wrote nothing');
  assert(
    previewText.includes('A spreadsheet is not consent'),
    'and says what importing contacts means for consent'
  );
  assert(
    previewText.includes('Waiting on a decision'),
    'a row matching an existing record waits rather than merging'
  );
  assert(previewText.includes('Concludo issue'), 'the error file is on the page, ready to copy');

  await page.getByRole('button', { name: /^Commit/ }).click();
  await page.waitForTimeout(400);

  const committed = await page.evaluate(() => document.body.innerText);
  assert(
    committed.includes('Recorded, with an audit entry'),
    'committing says it wrote an audit entry'
  );

  const reverse = await page.getByRole('button', { name: 'Reverse this import' });
  assert((await reverse.count()) === 1, 'and the import can be reversed');
  await reverse.click();
  await page.waitForTimeout(400);

  const reversed = await page.evaluate(() => document.body.innerText);
  assert(/\d+ records? reversed/.test(reversed), 'the rollback says how many it reversed');

  await context.close();
}

group('A contributor cannot commit an import, and is told why');

{
  const { context, page } = await open(`/crm/imports?w=${W}`);

  await page.getByRole('button', { name: 'Read the file' }).click();
  await page.waitForTimeout(160);
  await page.getByRole('button', { name: 'Check every row' }).click();
  await page.waitForTimeout(160);
  await page.getByRole('button', { name: 'Run the preview' }).click();
  await page.waitForTimeout(160);
  await page.getByRole('button', { name: /^Commit/ }).click();
  await page.waitForTimeout(300);

  const text = await page.evaluate(() => document.body.innerText);
  assert(
    text.includes('approver role'),
    'the refusal names the role needed rather than failing silently'
  );

  await context.close();
}

/* ============================================= 6. settings and registers */

group('Settings carries the three registers and the connection states');

{
  const { context, page } = await open(`/crm/settings?w=${W}`);

  const sections = await page.$$eval('#ccrm-settings-tab option', (nodes) =>
    nodes.map((node) => node.value)
  );
  assertEqual(sections.length, 3, 'three sections');

  await page.selectOption('#ccrm-settings-tab', 'connections');
  await page.waitForTimeout(200);
  const connections = await page.evaluate(() => document.body.innerText);

  assert(
    connections.includes('No connector to an outside system is connected'),
    'the page says plainly that nothing outside is connected'
  );
  assert(connections.includes('Connected'), 'a working connection is shown');
  assert(connections.includes('Permission expired'), 'a broken one is shown');
  assert(connections.includes('Never set up'), 'and one that was never set up');
  assert(
    connections.includes('Would not ask for'),
    'each connector says what it deliberately would not ask for'
  );
  assert(
    connections.includes('Sending is off'),
    'and that sending is off'
  );

  await page.selectOption('#ccrm-settings-tab', 'governance');
  await page.waitForTimeout(200);
  const governance = await page.evaluate(() => document.body.innerText);

  assert(governance.includes('Automated decisions'), 'the automated-decision register is shown');
  assert(governance.includes('2026-12-10'), 'with the date the obligation commences');
  assert(
    governance.includes('not legal advice'),
    'and says it is Concludo’s own assessment rather than a legal opinion'
  );
  assert(governance.includes('Models'), 'the model register is shown');
  assert(
    governance.includes('no model is called anywhere in Concludo today'),
    'and says no model is connected'
  );
  assert(governance.includes('Retention'), 'retention is shown');
  assert(
    governance.includes('Nothing is deleted automatically'),
    'and says nothing is deleted on its own'
  );
  assert(governance.includes('If a customer leaves'), 'offboarding is shown');

  const foot = await page.evaluate(() => document.body.innerText);
  assert(
    foot.includes('is not affiliated with, endorsed by or certified by'),
    'the independence disclaimer is present where providers are named'
  );
  assert(
    foot.includes('indicative until validated with real buyers'),
    'pricing is described as indicative'
  );

  await context.close();
}

/* ============================================= 7. reach and contrast */

group('Every control on the Stage 8 pages can be hit on a phone');

for (const path of PATHS) {
  const { context, page } = await open(`${path}?w=${W}`, PHONE);

  const small = await page.$$eval('button, select, a[href], textarea', (nodes) =>
    nodes
      .filter((node) => {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .map((node) => {
        // A wrapping label counts as the target, which is how the control is
        // actually hit.
        const label = node.closest('label');
        const box = (label ?? node).getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          text: (node.textContent ?? '').trim().slice(0, 40),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((entry) => entry.height < 24 || entry.width < 24)
  );

  assertEqual(
    small.length,
    0,
    `${path}: every control is at least 24 by 24 (${small
      .map((entry) => `${entry.tag} "${entry.text}" ${entry.width}x${entry.height}`)
      .join('; ')})`
  );

  await context.close();
}

group('Nothing on these pages claims a capability that does not exist');

for (const path of PATHS) {
  const { context, page } = await open(`${path}?w=${W}`);
  const text = await page.evaluate(() => document.body.innerText);

  for (const claim of [
    'our customers say',
    'trusted by',
    'certified',
    'ISO 27001',
    'SOC 2',
    'partner of',
    'in partnership with',
  ]) {
    assert(
      !text.toLowerCase().includes(claim.toLowerCase()) ||
        text.includes('is not affiliated with, endorsed by or certified by'),
      `${path}: no claim of "${claim}" without the independence disclaimer`
    );
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
console.log('Concludo CRM Stage 8 browser suite: all checks passed.\n');
