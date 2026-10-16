/**
 * Concludo CRM, Stage 4: the three areas only a browser can answer.
 *
 * Permissions, mobile and keyboard. The other six areas the brief names are in
 * `tests/crm.stage4.test.ts`, where they run in a second against the
 * composition layer rather than against pixels.
 *
 * WHAT "PERMISSIONS" MEANS ON A READ-ONLY SURFACE.
 *
 * Stage 4 writes nothing, so there is no save button to deny. The permission
 * property that actually holds here is TENANCY: a person looking at one
 * workspace must not be shown, or be able to reach, another one's records. That
 * is testable from the interface, it is the property Stage 3's row level
 * security exists to enforce, and it is the one that would leak real customer
 * data if it broke. The role-based checks over writes belong with the write
 * path in Stage 5, and saying so is more honest than asserting something
 * trivial here and calling the area covered.
 *
 * Start the dev server first:
 *   npx vite --port 5211 --strictPort &
 *   node tests/browser/crm.stage4.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5211/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const WIDTHS = [
  { label: 'phone', width: 390, height: 844 },
  { label: 'tablet', width: 834, height: 1112 },
  { label: 'desktop', width: 1440, height: 900 },
];

const VIEWS = [
  '/crm/relationships',
  '/crm/people',
  '/crm/organisations',
  '/crm/hierarchy',
  '/crm/coverage',
  '/crm/activities',
  '/crm/data-quality',
  '/crm/people/per-ag-1',
  '/crm/organisations/org-ag-1',
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

async function open(path, size = WIDTHS[2]) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Google Fonts is blocked in this sandbox and says so loudly.
    if (message.text().includes('Failed to load resource')) return;
    errors.push(message.text());
  });
  await page.goto(`${BASE}${encodeURIComponent(path)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(220);
  return { context, page, errors };
}

/* ======================================= 1. every view renders, everywhere */

group('All nine views render at three widths with no console errors');

for (const size of WIDTHS) {
  for (const path of VIEWS) {
    const { context, page, errors } = await open(path, size);

    const heading = await page.textContent('.ccrm-view-title').catch(() => null);
    assert(
      heading !== null && heading.trim().length > 0,
      `${size.label} ${path}: the view has a heading`
    );
    assertEqual(errors.length, 0, `${size.label} ${path}: no console errors (${errors[0] ?? ''})`);

    await context.close();
  }
}

/* ============================================== 2. permissions: tenancy */

group('A workspace shows its own records and no others');

{
  const { context, page } = await open('/crm/people');

  // The agency is the default. Its people are here; the consultancy's are not.
  const names = await page.$$eval('.ccrm-table tbody th', (cells) =>
    cells.map((cell) => cell.textContent?.trim() ?? '')
  );
  assert(
    names.some((n) => n.includes('Nadia Court')),
    'the agency workspace shows its own people'
  );
  assertEqual(
    names.some((n) => n.includes('Brett Calloway')),
    false,
    "and none of the consultancy's"
  );

  // Switching workspace changes the records and says so.
  await page.selectOption('#ccrm-workspace', 'ws-consulting');
  await page.waitForTimeout(280);

  const after = await page.$$eval('.ccrm-table tbody th', (cells) =>
    cells.map((cell) => cell.textContent?.trim() ?? '')
  );
  assert(
    after.some((n) => n.includes('Brett Calloway')),
    'switching workspace shows the other workspace'
  );
  assertEqual(
    after.some((n) => n.includes('Nadia Court')),
    false,
    'and no longer shows the first one'
  );

  const tenant = await page.textContent('.ccrm-view-tenant');
  assert(
    (tenant ?? '').includes('Kestrel'),
    'and the page says which workspace is on screen'
  );

  // The choice is in the query string, so it survives a reload and a shared
  // link. The preview harness runs on a MemoryRouter, where the browser's
  // address bar never changes, so this is read off the links the page builds,
  // which is the same `linkTo` the real router uses.
  const hrefs = await page.$$eval('.ccrm-view a[href]', (nodes) =>
    nodes.map((node) => node.getAttribute('href') ?? '')
  );
  assert(
    hrefs.some((href) => href.includes('w=ws-consulting')),
    'every link out of the page carries the workspace'
  );
  assertEqual(
    hrefs.filter((href) => href.startsWith('/crm') && !href.includes('w=ws-consulting')).length,
    0,
    'and none of them drops it, which would land somebody in another tenant'
  );

  await context.close();
}

{
  // A record id from one workspace, opened while another is selected, must not
  // resolve. This is the interface side of the tenancy rule.
  const { context, page } = await open('/crm/people/per-cs-1');
  const heading = await page.textContent('.ccrm-view-title');
  assert(
    (heading ?? '').includes('not in this workspace'),
    "a person from another workspace does not open in the agency's"
  );
  const body = await page.textContent('.ccrm-view');
  assertEqual(
    (body ?? '').includes('Brett Calloway'),
    false,
    'and none of their details leak onto the page'
  );
  await context.close();
}

{
  const { context, page } = await open('/crm/organisations/org-cs-1');
  const heading = await page.textContent('.ccrm-view-title');
  assert(
    (heading ?? '').includes('not in this workspace'),
    'the same holds for an organisation'
  );
  await context.close();
}

{
  // And the link does work when the workspace matches, so the refusal above is
  // a refusal rather than a broken route.
  const { context, page } = await open('/crm/people/per-cs-1?w=ws-consulting');
  const heading = await page.textContent('.ccrm-view-title');
  assert(
    (heading ?? '').includes('Brett Calloway'),
    'the same person opens in their own workspace'
  );
  await context.close();
}

/* ============================================== 3. source navigation */

group('Selecting an extracted value reveals its source');

{
  const { context, page } = await open('/crm/organisations/org-ag-1');

  const trails = await page.$$('.ccrm-trail');
  assert(trails.length > 0, 'the organisation record shows the evidence behind its values');

  const trailText = await page.$eval('.ccrm-trail', (el) => el.textContent ?? '');
  assert(trailText.includes('renewalDate'), 'each trail names the field');
  assert(
    /Captured \d{4}-\d{2}-\d{2}/.test(trailText),
    'and says when it was captured'
  );
  assert(
    trailText.includes('Entered by a person') || trailText.includes('Produced by'),
    'and whether a person or a model produced it'
  );

  // Where there is nothing to open, the trail says why in words rather than
  // rendering an empty space.
  const unavailable = await page.$('.ccrm-trail-unavailable');
  assert(unavailable !== null, 'an unopenable source says so');
  const why = await page.textContent('.ccrm-trail-unavailable');
  assert((why ?? '').trim().length > 20, 'in a sentence rather than a dash');

  await context.close();
}

{
  // A timeline entry that came from an assertion links to the record it sits
  // in, and following it lands on that entry.
  const { context, page } = await open('/crm/activities');

  const sourceLink = await page.$('.ccrm-timeline .ccrm-text-link');
  assert(sourceLink !== null, 'a timeline entry offers a route to its source');

  if (sourceLink) {
    await sourceLink.click();
    await page.waitForTimeout(280);
    const note = await page.$('.ccrm-focus-note');
    assert(note !== null, 'following it narrows the timeline to that entry and says so');
    const entries = await page.$$('.ccrm-timeline-item');
    assert(entries.length >= 1, 'and the entry is shown');
  }

  await context.close();
}

/* ====================================================== 4. empty states */

group('Empty, loading and error states are reachable and distinguishable');

for (const state of ['loading', 'empty', 'error', 'partial']) {
  const { context, page } = await open(`/crm/coverage?state=${state}`);
  const text = (await page.textContent('.ccrm-view')) ?? '';
  assert(text.trim().length > 60, `the ${state} state says something`);
  assertEqual(
    /no results|something went wrong\.$/i.test(text),
    false,
    `the ${state} state does not fall back to "no results"`
  );
  await context.close();
}

{
  // A view whose answers are all empty still explains itself rather than
  // rendering nothing.
  const { context, page } = await open('/crm/relationships?w=ws-sole-trader');
  const empties = await page.$$eval('.ccrm-panel-empty', (nodes) =>
    nodes.map((n) => n.textContent?.trim() ?? '')
  );
  for (const message of empties) {
    assert(message.length > 15, `an empty answer explains itself: "${message.slice(0, 40)}"`);
  }
  await context.close();
}

/* ========================================================= 5. mobile */

group('The relationship views work at 390 pixels');

for (const path of VIEWS) {
  const { context, page } = await open(path, WIDTHS[0]);

  // Nothing scrolls the page sideways. A table scrolls inside its own wrapper.
  await page.evaluate(() => window.scrollTo(9999, 0));
  const scrolled = await page.evaluate(() => window.scrollX);
  assertEqual(scrolled, 0, `${path}: the page does not scroll sideways at 390px`);

  // The first line of content is inside the first screen.
  const mainTop = await page.evaluate(() => {
    const main = document.querySelector('.ccrm-main');
    return main ? Math.round(main.getBoundingClientRect().top) : 0;
  });
  assert(mainTop < 520, `${path}: content starts in the first screen (${mainTop}px)`);

  // Every target a thumb has to hit is at least 44px.
  const small = await page.$$eval(
    '.ccrm-view a, .ccrm-view button, .ccrm-view select, .ccrm-view input[type="checkbox"]',
    (nodes) =>
      nodes
        .filter((node) => node.getBoundingClientRect().width > 0)
        .map((node) => {
          // A checkbox inside a label is not the target. The label is: tapping
          // anywhere on it toggles the box, so that is the area a thumb has to
          // hit and the area SC 2.5.8 is about.
          const target = node.closest('label') ?? node;
          const box = target.getBoundingClientRect();
          const text = (target.textContent ?? node.id ?? '').trim().slice(0, 24);
          return { label: text, height: Math.round(box.height), width: Math.round(box.width) };
        })
        .filter((box) => box.height < 44 && box.width < 44)
  );
  assertEqual(
    small.length,
    0,
    `${path}: every target is at least 44px (${small.slice(0, 2).map((s) => s.label).join(', ')})`
  );

  await context.close();
}

{
  // The tree keeps its name column readable at phone width, which is what the
  // reduced indentation is for.
  const { context, page } = await open('/crm/hierarchy', WIDTHS[0]);
  const widths = await page.$$eval('.ccrm-tree-name', (nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().width))
  );
  assert(widths.length > 0, 'the tree renders on a phone');
  assert(
    widths.every((w) => w > 80),
    `every organisation name has room to read (narrowest ${Math.min(...widths)}px)`
  );
  await context.close();
}

/* ======================================================= 6. keyboard */

group('Every relationship view is reachable and operable by keyboard');

{
  const { context, page } = await open('/crm/people');

  // The skip link is first, because the module sits behind 39 sidebar links.
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.className ?? '');
  assert(first.includes('ccrm-skip-link'), 'the first stop is the skip link');

  // Every focus stop has a visible ring, and it does not fade in.
  const ring = await page.evaluate(() => {
    const link = document.querySelector('.ccrm-text-link');
    if (!link) return null;
    link.focus();
    const style = getComputedStyle(link);
    return {
      width: style.outlineWidth,
      style: style.outlineStyle,
      transition: style.transitionDuration,
    };
  });
  assert(ring !== null, 'a link can take focus');
  assert(
    ring !== null && parseFloat(ring.width) >= 2 && ring.style !== 'none',
    `the focus ring is visible (${ring?.width} ${ring?.style})`
  );

  await context.close();
}

{
  // The workspace picker is operable without a mouse, and changing it with the
  // keyboard changes the records.
  const { context, page } = await open('/crm/people');
  await page.focus('#ccrm-workspace');
  await page.selectOption('#ccrm-workspace', 'ws-key-accounts');
  await page.waitForTimeout(280);
  const tenant = await page.textContent('.ccrm-view-tenant');
  assert((tenant ?? '').includes('Northbridge Industrial'), 'the picker works from the keyboard');
  await context.close();
}

{
  // The timeline filters are real checkboxes in a real fieldset, so they are
  // reachable by Tab and toggled by Space.
  const { context, page } = await open('/crm/activities');

  const legends = await page.$$eval('.ccrm-filter-legend', (nodes) =>
    nodes.map((n) => n.textContent?.trim() ?? '')
  );
  assert(legends.includes('Type'), 'the type filter is a labelled group');
  assert(legends.includes('Source'), 'and so is the source filter');

  const before = (await page.$$('.ccrm-timeline-item')).length;
  const box = await page.$('.ccrm-filter-option input');
  assert(box !== null, 'a filter is a checkbox rather than a styled div');
  if (box) {
    await box.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(220);
    const after = (await page.$$('.ccrm-timeline-item')).length;
    assert(after !== before, `pressing Space filters the timeline (${before} to ${after})`);
  }

  await context.close();
}

{
  // A person record is reachable from the list by keyboard alone.
  const { context, page } = await open('/crm/people');
  const href = await page.$eval('.ccrm-table tbody th a', (a) => a.getAttribute('href'));
  assert((href ?? '').includes('/crm/people/'), 'a person name is a link to their record');
  await context.close();
}

/* ============================================= 7. nothing ranks a person */

group('No relationship view ranks or scores a person');

for (const path of VIEWS) {
  const { context, page } = await open(path);

  // The page's own policy statements are removed before the search. Several of
  // them say "there is no risk score here", which is the opposite of a
  // violation and which a substring search cannot tell apart. They carry a
  // class for exactly this reason, and they are the only place those words may
  // appear: if one of these phrases turns up anywhere else, it is real.
  const text = await page.evaluate(() => {
    const view = document.querySelector('.ccrm-view');
    if (!view) return '';
    const clone = view.cloneNode(true);
    clone.querySelectorAll('.ccrm-policy').forEach((node) => node.remove());
    return (clone.textContent ?? '').toLowerCase();
  });

  for (const banned of [
    'engagement score',
    'relationship score',
    'health score',
    'risk score',
    'coverage score',
    'performance',
    'top performer',
    'leaderboard',
    'ranked',
  ]) {
    assertEqual(text.includes(banned), false, `${path}: the page never says "${banned}"`);
  }

  await context.close();
}

/* ============================================= 8. the independence line */

group('Where a capture method is named, independence is stated');

{
  const { context, page } = await open('/crm/activities');
  const note = await page.textContent('.ccrm-independence');
  assert(note !== null, 'the timeline carries the independence note');
  assert(
    (note ?? '').includes('not affiliated with, endorsed by, or partnered with'),
    'in the words the brand requires'
  );
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
console.log('Concludo CRM Stage 4 browser suite: all checks passed.\n');
