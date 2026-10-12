/**
 * Email Command Centre, Stage 4 browser tests.
 *
 * These run against a real browser because the things they check cannot be
 * checked any other way. Whether a view renders, whether every control can be
 * reached by keyboard, whether a table becomes cards at phone width, and
 * whether an empty list says something true are all properties of the rendered
 * page, not of a function.
 *
 * They use the preview harness, which mounts the module with the synthetic
 * dataset and no authentication. No mailbox, no network, no real data.
 *
 *   node_modules/.bin/vite --port 5199 --strictPort
 *   node app/tests/browser/emailCommandCentre.browser.test.mjs
 *
 * Exit code 1 on any failure, matching the house style of the other suites.
 */
import { chromium } from 'playwright';

const BASE = process.env.ECC_PREVIEW ?? 'http://localhost:5199/email-preview.html';
const EXECUTABLE = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';

let failures = 0;
let checks = 0;

function assert(condition, description) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${description}`);
  }
}

function group(name) {
  console.log(`\n${name}`);
}

/** The eight operational views, by tab label and route. */
const VIEWS = [
  { path: '/email/needs-attention', tab: 'Needs Attention', heading: 'Needs Attention' },
  { path: '/email/reply-queue', tab: 'Reply Queue', heading: 'Reply Queue' },
  { path: '/email/actions-deadlines', tab: 'Actions & Deadlines', heading: 'Actions and Deadlines' },
  { path: '/email/waiting', tab: 'Waiting', heading: 'Waiting' },
  { path: '/email/quick-wins', tab: 'Quick Wins', heading: 'Quick Wins' },
  { path: '/email/all', tab: 'All Email', heading: 'All Email' },
  { path: '/email/outputs', tab: 'Outputs', heading: 'Outputs' },
  { path: '/email/security-review', tab: 'Security Review', heading: 'Security Review' },
];

const browser = await chromium.launch({ executablePath: EXECUTABLE });

/**
 * `innerText` returns text as it is RENDERED, which means CSS text-transform
 * has already been applied. A field label styled uppercase comes back as
 * "WHY IT MATTERS". Comparisons on rendered text are therefore case-insensitive;
 * where the exact casing matters, the test reads textContent instead.
 */
function includesLoose(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function open(path, { width = 1440, height = 1000, query = '' } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}?p=${encodeURIComponent(path + query)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  return { context, page, errors };
}

/* ================================================= 1. view rendering */

group('Every view renders, with no page errors');

for (const view of VIEWS) {
  const { context, page, errors } = await open(view.path);

  const heading = await page.evaluate(
    () => document.querySelector('.ecc-page-title')?.textContent?.trim() ?? ''
  );
  assert(heading === view.heading, `${view.tab}: the page heading is "${view.heading}" (got "${heading}").`);
  assert(errors.length === 0, `${view.tab}: no page errors (${errors.join('; ')}).`);

  const h1Count = await page.evaluate(() => document.querySelectorAll('h1').length);
  assert(h1Count === 1, `${view.tab}: exactly one h1 on the page.`);

  const content = await page.evaluate(
    () => (document.querySelector('.ecc-main')?.innerText ?? '').trim().length
  );
  assert(content > 120, `${view.tab}: the view has real content, not a stub.`);

  const accountNote = await page.evaluate(
    () => document.querySelector('.ecc-view-account')?.textContent ?? ''
  );
  assert(
    /work and personal are never combined/i.test(accountNote),
    `${view.tab}: the account is named and the separation is stated.`
  );

  await context.close();
}

group('Each view shows what it is meant to show');

{
  const { context, page } = await open('/email/needs-attention');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  for (const label of ['Why it matters', 'Why it is here', 'Recommended next step']) {
    assert(includesLoose(text, label), `Needs Attention shows the "${label}" field.`);
  }
  assert(
    (await page.$$('.ecc-warning-security')).length > 0,
    'Needs Attention shows a security warning on the flagged thread.'
  );
  assert((await page.$$('.ecc-card')).length > 0, 'Needs Attention renders cards.');
  await context.close();
}

{
  const { context, page } = await open('/email/reply-queue');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(includesLoose(text, 'What the sender wants'), 'Reply Queue shows what the sender wants.');
  assert((await page.$$('.ecc-draft-body')).length > 0, 'Reply Queue shows a proposed draft.');
  assert(
    includesLoose(text, 'What this draft commits you to'),
    'Reply Queue shows what the draft commits you to.'
  );
  const chips = await page.$$eval('.ecc-chips .ecc-chip', (els) => els.map((e) => e.textContent.trim()));
  assert(chips.length >= 9, `Reply Queue has its nine filters (found ${chips.length}).`);
  const styles = await page.$$eval('.ecc-style-picker .ecc-chip', (els) =>
    els.map((e) => e.textContent.trim())
  );
  assert(
    styles.join('|').includes('Concise') &&
      styles.join('|').includes('Warm and professional') &&
      styles.join('|').includes('Detailed'),
    'Reply Queue offers the three draft styles.'
  );
  await context.close();
}

{
  const { context, page } = await open('/email/actions-deadlines');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(
    text.includes('Suggested date, confirm'),
    'A suggested date says "Suggested date, confirm" on the face of it.'
  );
  assert(text.includes('Stated in the email'), 'A stated date says where it came from.');
  const groups = await page.$$eval('.ecc-group-head', (els) =>
    // The count and its visually hidden " items" suffix sit inside the
    // heading, so they are stripped before the label is compared.
    els.map((e) => e.textContent.replace(/\d+\s*items?$/i, '').trim())
  );
  assert(groups.length > 0, 'Actions and Deadlines renders groups.');
  assert(
    groups.every((g) => ['Overdue', 'Today', 'Tomorrow', 'This week', 'Later', 'No date'].includes(g)),
    `Groups use the five time headings plus No date (got ${groups.join(', ')}).`
  );
  await context.close();
}

{
  const { context, page } = await open('/email/waiting');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(includesLoose(text, 'What is outstanding'), 'Waiting shows the outstanding item.');
  assert(includesLoose(text, 'Last meaningful message'), 'Waiting shows the last meaningful message.');
  assert(/day(s)? old/.test(text), 'Waiting shows thread age.');
  assert(/confidence/i.test(text), 'Waiting shows confidence in ownership.');
  await context.close();
}

{
  const { context, page } = await open('/email/quick-wins');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  const neutral = ['Short response', 'Simple confirmation', 'No action detected', 'Possible archive candidate'];
  assert(neutral.some((l) => text.includes(l)), 'Quick Wins uses the neutral labels.');
  assert(
    !/\bjunk\b|\bspam\b|\btrash\b/i.test(text),
    'Quick Wins never tells a person their mail is junk.'
  );
  assert(
    text.includes('Quick, but high consequence'),
    'A high-consequence thread is kept and marked rather than hidden for being quick.'
  );
  await context.close();
}

{
  const { context, page } = await open('/email/all');
  assert((await page.$$('.ecc-table')).length === 1, 'All Email renders a real table on desktop.');
  const headers = await page.$$eval('.ecc-table thead th', (els) =>
    els.map((e) => e.getAttribute('aria-sort'))
  );
  assert(headers.length === 6, 'The table has six column headers.');
  assert(
    headers.filter((h) => h && h !== 'none').length === 1,
    'Exactly one column reports itself as sorted.'
  );
  const pagination = await page.evaluate(
    () => document.querySelector('.ecc-pagination-count')?.textContent ?? ''
  );
  assert(/Showing \d+ to \d+ of \d+/.test(pagination), 'All Email shows a position in the results.');
  await context.close();
}

{
  const { context, page } = await open('/email/outputs', { query: '?mode=drafts' });
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(text.includes('Draft ready for review') || text.includes('Draft withheld'), 'Drafts shows draft states.');
  assert(
    !/\bSend\b/.test(await page.$$eval('button', (els) => els.map((e) => e.textContent).join('|'))),
    'There is no send control anywhere on the Drafts view.'
  );
  await context.close();
}

{
  const { context, page } = await open('/email/security-review');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(
    text.includes(
      'Automated detection can assist review but cannot guarantee that an email is safe or malicious.'
    ),
    'Security Review shows the required disclaimer, in full.'
  );
  const categories = [
    'Unexpected payment',
    'Bank-detail change',
    'Password or login request',
    'Look-alike domain',
    'Urgent secrecy',
    'Suspicious attachment',
    'Prompt injection',
    'Unusual recipient change',
    'Sensitive-data request',
  ];
  const shown = await page.$$eval('.ecc-category-label', (els) =>
    els.map((e) => e.textContent.trim())
  );
  for (const c of categories) {
    assert(shown.includes(c), `Security Review names the "${c}" category, worded exactly.`);
  }
  await context.close();
}

/* ===================================================== 2. filter tests */

group('Filters narrow the list and say so');

{
  const { context, page } = await open('/email/reply-queue');
  const before = (await page.$$('.ecc-card')).length;
  assert(before > 0, 'The reply queue starts with rows.');

  const chip = await page.$('button.ecc-chip[aria-pressed="false"]');
  await chip.click();
  await page.waitForTimeout(250);

  const pressed = await page.evaluate(
    () => document.querySelectorAll('button.ecc-chip[aria-pressed="true"]').length
  );
  assert(pressed >= 1, 'Pressing a filter sets aria-pressed, so the state is announced.');

  const after = (await page.$$('.ecc-card')).length;
  assert(after <= before, 'A filter narrows the list rather than widening it.');

  const clear = await page.$('.ecc-chip-clear');
  assert(clear !== null, 'A clear control appears once a filter is on.');
  await clear.click();
  await page.waitForTimeout(250);
  assert((await page.$$('.ecc-card')).length === before, 'Clearing restores the full list.');
  await context.close();
}

{
  const { context, page } = await open('/email/all');
  const before = (await page.$$('.ecc-table tbody tr')).length;
  await page.fill('#ecc-all-search', 'harrington');
  await page.waitForTimeout(300);
  const after = (await page.$$('.ecc-table tbody tr')).length;
  assert(after < before, 'Searching narrows the table.');
  assert(after === 1, 'Searching for a known subject finds one thread.');

  await page.fill('#ecc-all-search', 'zzzz-no-such-thing');
  await page.waitForTimeout(300);
  const emptyText = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(emptyText.includes('Nothing matches'), 'A search with no results says so plainly.');
  assert(
    emptyText.includes('widen'),
    'The empty state tells the person how to get back, rather than leaving a blank page.'
  );
  await context.close();
}

/* ================================================= 3. navigation tests */

group('Navigation');

{
  const { context, page, errors } = await open('/email');
  const tabs = await page.$$eval('.ecc-tab', (els) => els.map((e) => e.textContent.trim()));
  // Eleven from Stage 7, which added Clear Backlog.
  assert(tabs.length === 11, 'Eleven tabs are present.');

  for (let i = 0; i < tabs.length; i += 1) {
    const links = await page.$$('.ecc-tab');
    await links[i].click();
    await page.waitForTimeout(250);
    const active = await page.evaluate(
      () => document.querySelector('.ecc-tab-active')?.textContent?.trim() ?? ''
    );
    assert(active === tabs[i], `Clicking "${tabs[i]}" marks that tab as current.`);
    const blank = await page.evaluate(
      () => (document.querySelector('.ecc-main')?.innerText ?? '').trim().length < 40
    );
    assert(!blank, `"${tabs[i]}" renders a page rather than a blank area.`);
  }
  assert(errors.length === 0, `No page errors while navigating (${errors.join('; ')}).`);
  await context.close();
}

group('The account travels with the person');

{
  const { context, page } = await open('/email/needs-attention', { query: '?account=acct-personal-01' });
  const note = await page.evaluate(() => document.querySelector('.ecc-view-account')?.textContent ?? '');
  assert(/personal/i.test(note), 'A link carrying the personal account opens on it.');
  const body = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(
    !body.includes('Linwood') && !body.includes('Northaxis'),
    'No work thread appears while the personal account is selected.'
  );
  await context.close();
}

/* =================================================== 4. keyboard tests */

group('Keyboard');

{
  const { context, page } = await open('/email/reply-queue');

  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => document.activeElement?.className ?? '');
  assert(
    firstFocus.includes('ecc-skip-link'),
    'The first tab stop is the skip link, before the header controls.'
  );

  const focusRing = await page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow };
  });
  assert(
    focusRing.outline !== 'none' || focusRing.shadow !== 'none',
    'The focused element has a visible focus indicator.'
  );

  // Walk the page and confirm every interactive element can be reached.
  const reachable = await page.evaluate(() => {
    const selector =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const all = [...document.querySelectorAll(selector)].filter((el) => {
      if (el.closest('[hidden]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0 || el.className.includes('skip-link');
    });
    return all.length;
  });
  assert(reachable > 20, `There are interactive elements to reach (${reachable}).`);

  let tabs = 0;
  const seen = new Set();
  for (let i = 0; i < reachable + 10; i += 1) {
    await page.keyboard.press('Tab');
    tabs += 1;
    const id = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return `${el.tagName}.${el.className}.${(el.textContent ?? '').slice(0, 20)}`;
    });
    if (id) seen.add(id);
  }
  assert(seen.size > 15, `Tabbing reaches many distinct controls (${seen.size} in ${tabs} presses).`);

  await context.close();
}

group('A filter chip can be operated from the keyboard');

{
  const { context, page } = await open('/email/reply-queue');
  await page.focus('button.ecc-chip');
  const before = await page.evaluate(
    () => document.querySelector('button.ecc-chip')?.getAttribute('aria-pressed')
  );
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const afterEnter = await page.evaluate(
    () => document.querySelector('button.ecc-chip')?.getAttribute('aria-pressed')
  );
  assert(before !== afterEnter, 'Enter toggles a filter chip.');

  await page.focus('button.ecc-chip');
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  const afterSpace = await page.evaluate(
    () => document.querySelector('button.ecc-chip')?.getAttribute('aria-pressed')
  );
  assert(afterSpace === before, 'Space toggles it back, because it is a real button.');
  await context.close();
}

group('The action group opens from the keyboard and announces its state');

{
  const { context, page } = await open('/email/needs-attention');
  await page.focus('.ecc-actions-toggle');
  assert(
    (await page.evaluate(() => document.querySelector('.ecc-actions-toggle')?.getAttribute('aria-expanded'))) ===
      'false',
    'The action group starts collapsed and says so.'
  );
  // The attribute and the pixels have to agree. A `display` rule overrides the
  // `hidden` attribute, which once left the group hidden from a screen reader
  // and visible to everyone else.
  assert(
    await page.evaluate(() => {
      const g = document.querySelector('.ecc-action-group');
      return g ? getComputedStyle(g).display === 'none' : false;
    }),
    'A collapsed action group is genuinely not shown, not merely marked hidden.'
  );
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  assert(
    (await page.evaluate(() => document.querySelector('.ecc-actions-toggle')?.getAttribute('aria-expanded'))) ===
      'true',
    'Enter opens it and aria-expanded follows.'
  );
  assert(
    await page.evaluate(() => {
      const g = document.querySelector('.ecc-action-group');
      return g ? getComputedStyle(g).display !== 'none' : false;
    }),
    'Opening it shows it.'
  );

  const described = await page.evaluate(() => {
    const button = document.querySelector('.ecc-action-group .ecc-action');
    const id = button?.getAttribute('aria-describedby');
    return id ? (document.getElementById(id)?.textContent ?? '') : '';
  });
  assert(described.length > 20, 'Each action carries a description of what it will do.');
  assert(
    /nothing is saved|No task is created|copy/i.test(described),
    'That description says plainly that nothing is saved.'
  );

  const cardsBefore = (await page.$$('.ecc-card')).length;
  const deferIndex = await page.evaluate(() =>
    [...document.querySelectorAll('.ecc-action-group .ecc-action')].findIndex((b) =>
      b.textContent.trim().startsWith('Defer')
    )
  );
  assert(deferIndex > -1, 'A Defer action exists.');
  const buttons = await page.$$('.ecc-action-group .ecc-action');
  await buttons[deferIndex].click();
  await page.waitForTimeout(300);
  const cardsAfter = (await page.$$('.ecc-card')).length;
  assert(cardsAfter === cardsBefore - 1, 'Deferring removes exactly one card.');

  const announcement = await page.evaluate(
    () => document.querySelector('.ecc-live-region')?.textContent ?? ''
  );
  assert(
    /deferred/i.test(announcement),
    'The removal is announced, so a row never silently disappears.'
  );
  assert(
    /nothing is saved/i.test(announcement),
    'The announcement says it will not survive a reload.'
  );
  await context.close();
}

/* ================================================= 5. responsive tests */

group('Responsive');

for (const view of VIEWS) {
  const { context, page } = await open(view.path, { width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  assert(!overflow, `${view.tab}: no horizontal page scroll at 390px.`);
  await context.close();
}

{
  const { context, page } = await open('/email/all', { width: 390, height: 844 });
  const tableVisible = await page.evaluate(() => {
    const t = document.querySelector('.ecc-table');
    return t ? getComputedStyle(t).display !== 'none' : false;
  });
  const cardsVisible = await page.evaluate(() => {
    const c = document.querySelector('.ecc-table-cards');
    return c ? getComputedStyle(c).display !== 'none' : false;
  });
  assert(!tableVisible, 'At 390px the table is not shown.');
  assert(cardsVisible, 'At 390px the cards are shown instead.');

  const rows = await page.$$eval('.ecc-table-card', (els) => els.length);
  const deskContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const deskPage = await deskContext.newPage();
  await deskPage.goto(`${BASE}?p=${encodeURIComponent('/email/all')}`, { waitUntil: 'networkidle' });
  await deskPage.waitForTimeout(400);
  const deskRows = await deskPage.$$eval('.ecc-table tbody tr', (els) => els.length);
  assert(rows === deskRows, 'The phone cards and the desktop table hold the same rows.');
  await deskContext.close();
  await context.close();
}

group('Sorting is possible on a phone, where the column headers are gone');

{
  const { context, page } = await open('/email/all', { width: 390, height: 844 });
  const control = await page.$('#ecc-all-sort');
  assert(control !== null, 'A sort control exists that does not depend on the table.');

  const firstBefore = await page.evaluate(
    () => document.querySelector('.ecc-table-card-subject')?.textContent ?? ''
  );
  await page.selectOption('#ecc-all-sort', 'subject:asc');
  await page.waitForTimeout(300);
  const firstAfter = await page.evaluate(
    () => document.querySelector('.ecc-table-card-subject')?.textContent ?? ''
  );
  assert(firstBefore !== firstAfter, 'Changing the sort reorders the cards at phone width.');

  const label = await page.evaluate(
    () => document.querySelector('label[for="ecc-all-sort"]')?.textContent ?? ''
  );
  assert(label.trim().length > 0, 'The sort control has a label.');
  await context.close();
}

group('Touch targets are large enough on a phone');

{
  const { context, page } = await open('/email/reply-queue', { width: 390, height: 844 });
  const small = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button:not([disabled]), select, input')];
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.height < 44;
      })
      .map((el) => `${el.tagName}.${el.className.split(' ')[0]}:${Math.round(el.getBoundingClientRect().height)}`);
  });
  assert(small.length === 0, `Every control is at least 44px tall at phone width (${small.join(', ')}).`);
  await context.close();
}

/* ========================== 6, 7, 8. empty, loading and error states */

group('Empty, loading and error states');

for (const view of VIEWS) {
  const { context, page } = await open(view.path, { query: '?demo=empty' });
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(
    (await page.$$('.ecc-state-empty')).length === 1,
    `${view.tab}: the empty state renders.`
  );
  assert((await page.$$('.ecc-card')).length === 0, `${view.tab}: no rows in the empty state.`);
  assert(text.trim().length > 80, `${view.tab}: the empty state says something, rather than nothing.`);
  await context.close();
}

{
  const { context, page } = await open('/email/security-review', { query: '?demo=empty' });
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(
    text.includes('not proof'),
    'An empty Security Review does not let a person conclude their inbox is safe.'
  );
  await context.close();
}

for (const view of VIEWS) {
  const { context, page } = await open(view.path, { query: '?demo=loading' });
  const loading = await page.$$('[role="status"].ecc-state-loading');
  assert(loading.length === 1, `${view.tab}: the loading state renders as a status region.`);
  assert((await page.$$('.ecc-card')).length === 0, `${view.tab}: no rows while loading.`);
  await context.close();
}

for (const view of VIEWS) {
  const { context, page } = await open(view.path, { query: '?demo=error' });
  const alerts = await page.$$('[role="alert"]');
  assert(alerts.length >= 1, `${view.tab}: the error state renders as an alert.`);
  const text = await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent ?? '');
  assert(
    text.length > 30 && !/undefined|null|\[object/i.test(text),
    `${view.tab}: the error is written in plain words.`
  );
  assert((await page.$$('.ecc-card')).length === 0, `${view.tab}: no rows in the error state.`);
  await context.close();
}

group('An unknown account substitutes visibly, and never silently');

{
  // Corrected after the first run. The module does not error on an unknown
  // account in a link: it opens a real one and says so, which is the better
  // behaviour. What matters is that the substitution is never silent, because
  // a person acting on the wrong inbox is the failure this guards against.
  const { context, page } = await open('/email/needs-attention', { query: '?account=acct-nope' });

  const notice = await page.evaluate(
    () => document.querySelector('.ecc-substituted')?.textContent ?? ''
  );
  assert(notice.length > 0, 'A substitution notice is shown.');
  assert(
    /not available/i.test(notice) && /check the account/i.test(notice),
    'It says the requested account was unavailable and tells the person to check which one is open.'
  );
  assert(
    (await page.evaluate(() => document.querySelector('.ecc-substituted')?.getAttribute('role'))) ===
      'status',
    'The notice is a live region, so it is announced rather than only drawn.'
  );

  const accountNote = await page.evaluate(
    () => document.querySelector('.ecc-view-account')?.textContent ?? ''
  );
  assert(
    /work/i.test(accountNote),
    'The account actually being shown is named on the view, not only in the header.'
  );
  await context.close();
}

/* ============================================== accessibility sweep */

group('Accessibility sweep across all eight views');

for (const view of VIEWS) {
  const { context, page } = await open(view.path);

  const unlabelled = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button, a[href], input, select')) {
      const label =
        (el.getAttribute('aria-label') ?? '') +
        (el.textContent ?? '') +
        (el.getAttribute('title') ?? '') +
        (el.labels?.length ? [...el.labels].map((l) => l.textContent).join('') : '');
      if (label.trim().length === 0) bad.push(`${el.tagName}.${el.className}`);
    }
    return bad;
  });
  assert(unlabelled.length === 0, `${view.tab}: every control has an accessible name (${unlabelled.join(', ')}).`);

  const headingOrder = await page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]))
  );
  let jumps = 0;
  for (let i = 1; i < headingOrder.length; i += 1) {
    if (headingOrder[i] - headingOrder[i - 1] > 1) jumps += 1;
  }
  assert(jumps === 0, `${view.tab}: heading levels do not skip (${headingOrder.join(', ')}).`);

  const imagesWithoutAlt = await page.evaluate(
    () => [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length
  );
  assert(imagesWithoutAlt === 0, `${view.tab}: no image is missing alt text.`);

  // Contrast, measured rather than asserted.
  const lowContrast = await page.evaluate(() => {
    const lum = ([r, g, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const bgOf = (el) => {
      let n = el;
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)') {
          const m = (c.match(/rgba?\(([^)]+)\)/) ?? [])[1];
          if (m) {
            const v = m.split(',').map(Number);
            if (v.length < 4 || v[3] > 0.95) return [v[0], v[1], v[2]];
          }
        }
        n = n.parentElement;
      }
      return [9, 14, 26];
    };
    const ratio = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };

    const bad = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('.ecc-main *, .ecc-view *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const key = `${el.className}|${cs.fontSize}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const px = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = px >= 24 || (px >= 18.66 && weight >= 700);
      const value = ratio(parse(cs.color), bgOf(el));
      if (value < (large ? 3 : 4.5)) {
        bad.push(`${el.className || el.tagName}:${value.toFixed(2)}@${px}px`);
      }
    }
    return bad;
  });
  assert(
    lowContrast.length === 0,
    `${view.tab}: every text style meets WCAG 2.2 AA contrast (${lowContrast.join(', ')}).`
  );

  await context.close();
}

group('Status is never carried by colour alone');

{
  const { context, page } = await open('/email/needs-attention');
  const badges = await page.$$eval('.ecc-badge', (els) => els.map((e) => e.textContent.trim()));
  assert(badges.length > 0, 'There are badges to check.');
  assert(
    badges.every((b) => b.replace(/[^a-z]/gi, '').length > 2),
    'Every badge carries a word, not only a colour.'
  );
  await context.close();
}

{
  const { context, page } = await open('/email/all');
  const sortable = await page.$$eval('.ecc-table thead th', (els) =>
    els.map((e) => ({
      sort: e.getAttribute('aria-sort'),
      name: e.querySelector('button')?.textContent?.trim() ?? '',
    }))
  );
  assert(sortable.every((s) => s.sort !== null), 'Every column header reports its sort state.');
  assert(
    sortable.every((s) => /Activate to sort (ascending|descending)/.test(s.name)),
    'Every sort control says what the next activation will do.'
  );

  const firstHeader = await page.$('.ecc-table thead th:first-child button');
  await firstHeader.click();
  await page.waitForTimeout(250);
  const afterClick = await page.evaluate(
    () => document.querySelector('.ecc-table thead th:first-child')?.getAttribute('aria-sort')
  );
  assert(afterClick === 'ascending', 'Clicking a sorted column reverses it, and aria-sort follows.');
  await context.close();
}

/* ===================================================================
   STAGE 5: the Thread Intelligence workspace and Draft Review.
   =================================================================== */

const THREAD = '/email/thread/thr-w-001';
const HARRINGTON = '/email/thread/thr-w-003';
const WITHHELD = '/email/thread/thr-w-007';

group('The workspace renders three columns on a desktop');

{
  const { context, page, errors } = await open(THREAD);
  assert(errors.length === 0, `No page errors (${errors.join('; ')}).`);

  for (const selector of ['.ecc-col-list', '.ecc-col-conversation', '.ecc-col-intelligence']) {
    const visible = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).display !== 'none' && r.width > 0;
    }, selector);
    assert(visible, `${selector} is visible at 1440px.`);
  }

  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.ecc-col')].map((el) => ({
      cls: el.className.split(' ').find((c) => c.startsWith('ecc-col-')),
      left: Math.round(el.getBoundingClientRect().left),
    }))
  );
  assert(order[0].cls === 'ecc-col-list', 'The thread list is the left column.');
  assert(order[1].cls === 'ecc-col-conversation', 'The conversation is the centre column.');
  assert(order[2].cls === 'ecc-col-intelligence', 'The analysis is the right column.');
  assert(order[0].left < order[1].left && order[1].left < order[2].left, 'They are laid out in that order.');

  const switcher = await page.evaluate(() => {
    const el = document.querySelector('.ecc-pane-switch');
    return el ? getComputedStyle(el).display : 'missing';
  });
  assert(switcher === 'none', 'The pane switcher is hidden where all three columns fit.');
  await context.close();
}

group('The original conversation is shown as it arrived');

{
  const { context, page } = await open(HARRINGTON);
  const messages = await page.$$('.ecc-message');
  assert(messages.length === 3, `All three messages are shown (${messages.length}).`);

  const times = await page.$$eval('.ecc-message time', (els) => els.map((e) => e.getAttribute('datetime')));
  assert(times.length === 3, 'Every message carries a timestamp.');
  const sortedTimes = [...times].sort((a, b) => new Date(a) - new Date(b));
  assert(times.join('|') === sortedTimes.join('|'), 'Messages run oldest first.');

  const senders = await page.$$eval('.ecc-message-sender', (els) => els.map((e) => e.textContent.trim()));
  assert(senders.every((s) => s.length > 2), 'Every message names its sender.');

  const badges = await page.$$('.ecc-message .ecc-account-badge');
  assert(badges.length === 3, 'Every message carries an account badge.');

  const attachments = await page.$$('.ecc-message-attachments li');
  assert(attachments.length >= 2, 'Attachments are listed on the messages that carry them.');
  const caveat = await page.evaluate(
    () => document.querySelector('.ecc-attachment-caveat')?.textContent ?? ''
  );
  assert(
    /not read by Concludo/i.test(caveat),
    'An attachment never implies it was opened and read.'
  );
  await context.close();
}

group('Quoted history is collapsed by default and can be opened');

{
  const { context, page } = await open(HARRINGTON);
  const toggle = await page.$('.ecc-quoted-toggle');
  assert(toggle !== null, 'A quoted history toggle exists.');
  assert(
    (await page.evaluate(() => document.querySelector('.ecc-quoted-toggle').getAttribute('aria-expanded'))) ===
      'false',
    'It starts collapsed.'
  );
  assert((await page.$$('.ecc-quoted-body')).length === 0, 'The quoted text is not rendered while collapsed.');

  await toggle.click();
  await page.waitForTimeout(200);
  assert(
    (await page.evaluate(() => document.querySelector('.ecc-quoted-toggle').getAttribute('aria-expanded'))) ===
      'true',
    'Activating it expands, and aria-expanded follows.'
  );
  const quoted = await page.evaluate(() => document.querySelector('.ecc-quoted-body')?.textContent ?? '');
  assert(quoted.includes('>'), 'The quoted history is shown as it was written.');
  await context.close();
}

group('Source navigation highlights the message and the words');

{
  const { context, page } = await open(HARRINGTON);

  await page.click('#ecc-tab-deadlines');
  await page.waitForTimeout(250);

  const extraction = await page.$('.ecc-itab-panel .ecc-extraction');
  assert(extraction !== null, 'The deadlines tab lists a selectable extraction.');
  const label = await extraction.evaluate((el) => el.textContent.trim());

  assert((await page.$$('.ecc-message-source')).length === 0, 'Nothing is marked before anything is selected.');

  await extraction.click();
  await page.waitForTimeout(400);

  const marked = await page.$$('.ecc-message-source');
  assert(marked.length === 1, `Exactly one message is marked as the source (${marked.length}).`);

  const flag = await page.evaluate(() => document.querySelector('.ecc-source-flag')?.textContent ?? '');
  assert(
    /source of the selected item/i.test(flag),
    'The source message says so in words, not only by colour.'
  );

  const marks = await page.$$('.ecc-source-mark');
  assert(marks.length >= 1, 'The exact words are highlighted inside the message.');
  const markText = await page.evaluate(() => document.querySelector('.ecc-source-mark')?.textContent ?? '');
  assert(markText.length > 10, 'The highlight covers real text.');

  const inBody = await page.evaluate(
    () => document.querySelector('.ecc-source-mark')?.closest('.ecc-message-body') !== null
  );
  assert(inBody, 'The highlight is in the message body, never in the quoted history.');

  const banner = await page.evaluate(() => document.querySelector('.ecc-selection-banner')?.textContent ?? '');
  assert(banner.includes(label.slice(0, 20)), 'The conversation says what is being traced.');

  assert(
    (await page.evaluate(() => document.querySelector('.ecc-extraction-selected') !== null)),
    'The selected extraction is marked as pressed.'
  );

  await page.click('.ecc-selection-banner .ecc-text-button');
  await page.waitForTimeout(250);
  assert((await page.$$('.ecc-message-source')).length === 0, 'Clearing the selection removes the highlight.');
  await context.close();
}

group('Every extraction on every tab can be traced');

{
  const { context, page } = await open(HARRINGTON);
  for (const tab of ['actions', 'decisions', 'deadlines', 'questions', 'attachments']) {
    await page.click(`#ecc-tab-${tab}`);
    await page.waitForTimeout(200);
    const buttons = await page.$$('.ecc-itab-panel .ecc-extraction');
    if (buttons.length === 0) continue;
    await buttons[0].click();
    await page.waitForTimeout(300);
    const marked = (await page.$$('.ecc-message-source')).length;
    assert(marked >= 1, `Selecting an item on the ${tab} tab marks its source.`);
  }
  await context.close();
}

group('The intelligence tabs are real tabs');

{
  const { context, page } = await open(THREAD);
  const tabs = await page.$$eval('[role="tab"].ecc-itab', (els) => els.length);
  assert(tabs === 8, `Eight tabs in a tablist (${tabs}).`);

  const roving = await page.$$eval('[role="tab"].ecc-itab', (els) =>
    els.map((e) => e.getAttribute('tabindex'))
  );
  assert(
    roving.filter((t) => t === '0').length === 1,
    'Exactly one tab is in the tab order at a time.'
  );

  await page.focus('#ecc-tab-overview');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const afterRight = await page.evaluate(() => document.activeElement?.id);
  assert(afterRight === 'ecc-tab-actions', 'Arrow right moves to the next tab and focus follows.');
  assert(
    (await page.evaluate(() => document.querySelector('#ecc-tab-actions').getAttribute('aria-selected'))) ===
      'true',
    'The newly focused tab is selected.'
  );

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  assert(
    (await page.evaluate(() => document.activeElement?.id)) === 'ecc-tab-overview',
    'Arrow left moves back.'
  );

  await page.keyboard.press('End');
  await page.waitForTimeout(200);
  assert((await page.evaluate(() => document.activeElement?.id)) === 'ecc-tab-risks', 'End jumps to the last tab.');

  await page.keyboard.press('Home');
  await page.waitForTimeout(200);
  assert(
    (await page.evaluate(() => document.activeElement?.id)) === 'ecc-tab-overview',
    'Home jumps to the first tab.'
  );

  const panel = await page.evaluate(() => {
    const p = document.querySelector('[role="tabpanel"].ecc-itab-panel');
    return { labelled: p?.getAttribute('aria-labelledby'), tabindex: p?.getAttribute('tabindex') };
  });
  assert(panel.labelled === 'ecc-tab-overview', 'The panel is labelled by its tab.');
  assert(panel.tabindex === '0', 'The panel is reachable by keyboard.');
  await context.close();
}

group('The Overview tab keeps facts, inferences and unknowns apart');

{
  const { context, page } = await open('/email/thread/thr-w-014');
  const text = await page.evaluate(() => document.querySelector('.ecc-itab-panel').innerText);
  assert(includesLoose(text, 'Facts, stated in the thread'), 'Facts are headed as stated.');
  assert(includesLoose(text, 'Inferences, worked out rather than stated'), 'Inferences are headed as worked out.');
  assert(includesLoose(text, 'Unknowns'), 'Unknowns have their own heading.');
  assert(
    includesLoose(text, 'Inferred, confirm before relying on it'),
    'Every inference is labelled where it is shown.'
  );
  assert(includesLoose(text, 'Why it matters'), 'Why it matters is shown.');
  assert(includesLoose(text, 'Recommended next step'), 'The recommended next step is shown.');
  assert(
    includesLoose(text, 'Nothing has been done for you'),
    'A recommendation never implies it was carried out.'
  );
  assert(includesLoose(text, 'What the sender is asking for'), 'The requested action is shown.');
  await context.close();
}

/* ------------------------------------------------- the approval lifecycle */

group('Draft Review: approval is created for exactly what was reviewed');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);

  const envelope = await page.evaluate(() => document.querySelector('.ecc-envelope').innerText);
  for (const label of ['Sending account', 'From', 'To', 'CC', 'BCC', 'Subject', 'Attachments']) {
    assert(includesLoose(envelope, label), `The envelope shows ${label}.`);
  }

  assert(
    (await page.evaluate(() => document.querySelector('.ecc-approval-none') !== null)),
    'It starts unapproved.'
  );

  const approve = (await page.$$('.ecc-draft-action')).at(-1);
  await approve.click();
  await page.waitForTimeout(300);

  assert(
    (await page.evaluate(() => document.querySelector('.ecc-approval-approved') !== null)),
    'Approving records the approval.'
  );
  const approvedText = await page.evaluate(() => document.querySelector('.ecc-approval').innerText);
  assert(
    /nothing has been sent/i.test(approvedText),
    'The approved state still says nothing has been sent.'
  );
  assert(
    /nothing has been written to a mailbox/i.test(approvedText),
    'And that nothing was written to a mailbox.'
  );
  await context.close();
}

group('Draft Review: editing the body invalidates the approval');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);
  const buttons = await page.$$('.ecc-draft-action');
  await buttons.at(-1).click();
  await page.waitForTimeout(250);
  assert(
    (await page.evaluate(() => document.querySelector('.ecc-approval-approved') !== null)),
    'Approved first.'
  );

  await (await page.$$('.ecc-draft-action'))[0].click();
  await page.waitForTimeout(250);
  await page.fill('#ecc-draft-body', 'A completely different reply that was never reviewed.');
  await page.waitForTimeout(300);

  const expired = await page.evaluate(() => document.querySelector('.ecc-approval-expired'));
  assert(expired !== null, 'Editing the body expires the approval.');

  const text = await page.evaluate(() => document.querySelector('.ecc-approval').innerText);
  assert(/Approval expired/i.test(text), 'The status says the approval expired.');
  assert(/message body/i.test(text), 'It names the body as what changed.');
  assert(!text.includes('—'), 'The wording contains no em dash.');

  const role = await page.evaluate(() => document.querySelector('.ecc-approval').getAttribute('role'));
  assert(role === 'alert', 'The expiry is announced as an alert, not drawn quietly.');

  const diff = await page.$('.ecc-approval-diff');
  assert(diff !== null, 'The person can see what they approved against what it says now.');
  await context.close();
}

group('Draft Review: changing a recipient invalidates the approval');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);
  await (await page.$$('.ecc-draft-action')).at(-1).click();
  await page.waitForTimeout(250);

  await (await page.$$('.ecc-draft-action'))[0].click();
  await page.waitForTimeout(250);
  await page.fill('#ecc-draft-to', 'someone.entirely.different@elsewhere.example');
  await page.waitForTimeout(300);

  const text = await page.evaluate(() => document.querySelector('.ecc-approval').innerText);
  assert(/Approval expired/i.test(text), 'Changing the recipient expires the approval.');
  assert(/recipients/i.test(text), 'It names the recipients as what changed.');
  await context.close();
}

group('Draft Review: changing the subject invalidates the approval');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);
  await (await page.$$('.ecc-draft-action')).at(-1).click();
  await page.waitForTimeout(250);
  await (await page.$$('.ecc-draft-action'))[0].click();
  await page.waitForTimeout(250);
  await page.fill('#ecc-draft-subject', 'An entirely different subject line');
  await page.waitForTimeout(300);
  const text = await page.evaluate(() => document.querySelector('.ecc-approval').innerText);
  assert(/Approval expired/i.test(text), 'Changing the subject expires the approval.');
  assert(/subject/i.test(text), 'It names the subject.');
  await context.close();
}

group('Draft Review: changing the tone invalidates the approval');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);
  await (await page.$$('.ecc-draft-action')).at(-1).click();
  await page.waitForTimeout(250);

  const toneButtons = await page.$$('.ecc-style-picker .ecc-chip');
  await toneButtons[2].click();
  await page.waitForTimeout(300);

  const text = await page.evaluate(() => document.querySelector('.ecc-approval').innerText);
  assert(
    /Approval expired/i.test(text),
    'Swapping to another written style replaces the body, which expires the approval.'
  );
  await context.close();
}

group('Draft Review: nothing on the page sends anything');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);
  const labels = await page.$$eval('button', (els) => els.map((e) => e.textContent.trim()));
  assert(
    !labels.some((l) => /^send\b/i.test(l) || /\bsend now\b/i.test(l)),
    `No button sends (${labels.filter((l) => /send/i.test(l)).join(', ')}).`
  );

  const actions = await page.$$eval('.ecc-draft-action', (els) => els.map((e) => e.textContent.trim()));
  assert(actions.length === 6, `Six draft actions (${actions.length}).`);
  for (const expected of [
    'Edit draft',
    'Regenerate style',
    'Save as proposed draft',
    'Request clarification',
    'Discard draft',
    'Approve for saving',
  ]) {
    assert(
      actions.some((a) => a.includes(expected)),
      `The "${expected}" action is present.`
    );
  }

  const described = await page.evaluate(() => {
    const button = [...document.querySelectorAll('.ecc-draft-action')].at(-1);
    const id = button?.getAttribute('aria-describedby');
    return id ? (document.getElementById(id)?.textContent ?? '') : '';
  });
  assert(
    /does not send/i.test(described),
    'The approve button says in its own description that it does not send.'
  );

  const footnote = await page.evaluate(
    () => document.querySelector('.ecc-draft-final')?.textContent ?? ''
  );
  assert(/no send control/i.test(footnote), 'The page states plainly that there is no send control.');
  await context.close();
}

group('Draft Review: dates and amounts are surfaced');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);
  const text = await page.evaluate(() => document.querySelector('.ecc-draft-review').innerText);
  assert(includesLoose(text, 'Dates and amounts in this draft'), 'The figures are listed.');
  const figures = await page.$$('.ecc-figure');
  assert(figures.length > 0, 'At least one date or amount is found in the draft.');
  assert(
    includesLoose(text, 'Concludo has not checked that any of them are right'),
    'The figures never imply they were verified.'
  );
  assert(includesLoose(text, 'What this draft commits you to'), 'Commitments are listed.');
  await context.close();
}

group('A withheld draft says so, and says why');

{
  const { context, page } = await open(`${WITHHELD}?tab=draft`);
  const text = await page.evaluate(() => document.querySelector('.ecc-draft-review').innerText);
  assert(
    text.includes('Draft withheld pending clarification.'),
    'The required wording is shown, verbatim.'
  );
  assert(text.length > 200, 'The reason is given at length, not as a bare status.');
  assert((await page.$$('.ecc-draft-body')).length === 0, 'No draft text is shown for a withheld draft.');
  assert((await page.$$('#ecc-draft-body')).length === 0, 'And there is nothing to edit.');
  assert(
    (await page.evaluate(() => document.querySelector('.ecc-approval') !== null)) === false,
    'There is no approval control on a withheld draft.'
  );
  await context.close();
}

group('A blocked draft lists the specific missing information');

{
  const { context, page } = await open('/email/thread/thr-w-014?tab=draft');
  const text = await page.evaluate(() => document.querySelector('.ecc-draft-review').innerText);
  assert(text.includes('Draft withheld pending clarification.'), 'It says the draft is withheld.');
  assert(includesLoose(text, 'What is missing'), 'It heads the missing information.');
  const missing = await page.$$eval('.ecc-reason-list li', (els) => els.map((e) => e.textContent));
  assert(missing.length >= 3, `It lists each missing item (${missing.length}).`);
  assert(
    missing.some((m) => /month/i.test(m)),
    'Including that the month was never stated.'
  );
  await context.close();
}

group('A thread from the other account is not found');

{
  const { context, page } = await open('/email/thread/thr-p-001');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(includesLoose(text, 'Thread not found'), 'A personal thread is not found on the work account.');
  assert(
    includesLoose(text, 'never looked up across accounts'),
    'It explains that threads are never looked up across accounts.'
  );
  assert((await page.$$('.ecc-col-conversation')).length === 0, 'No conversation is rendered.');
  await context.close();
}

group('Switching account changes the thread list and finds its own threads');

{
  const { context, page } = await open('/email/thread/thr-p-001', { query: '?account=acct-personal-01' });
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(!includesLoose(text, 'Thread not found'), 'The personal thread loads on the personal account.');
  assert(
    !text.includes('Linwood') && !text.includes('Northaxis'),
    'No work thread appears anywhere on the page.'
  );
  await context.close();
}

/* ---------------------------------------------------- mobile and tablet */

group('No column clips its content');

{
  const { context, page } = await open(`${THREAD}?tab=draft`);
  const columns = await page.evaluate(() =>
    [...document.querySelectorAll('.ecc-col')].map((el) => ({
      cls: el.className.split(' ').find((c) => c.startsWith('ecc-col-')),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflow: getComputedStyle(el).overflowY,
    }))
  );
  for (const column of columns) {
    const fits = column.scrollHeight <= column.clientHeight + 1;
    const scrolls = column.overflow === 'auto' || column.overflow === 'scroll';
    assert(
      fits || scrolls,
      `${column.cls}: content is either fully visible or scrollable, never cut off (${column.scrollHeight} in ${column.clientHeight}, overflow ${column.overflow}).`
    );
  }
  await context.close();
}

group('The safety line appears once, not twice');

{
  const { context, page } = await open(THREAD);
  const count = await page.evaluate(
    () =>
      (document.querySelector('.ecc-module')?.innerText.match(/Concludo proposes; a person disposes/g) ?? [])
        .length
  );
  assert(count === 1, `The module's standing line is stated once (found ${count}).`);
  await context.close();
}

group('Mobile layout: three columns become three reachable sections');

{
  const { context, page } = await open(THREAD, { width: 390, height: 844 });

  const switcher = await page.evaluate(() => {
    const el = document.querySelector('.ecc-pane-switch');
    return el ? getComputedStyle(el).display : 'missing';
  });
  assert(switcher === 'flex', 'The pane switcher appears.');

  const tabs = await page.$$eval('.ecc-pane-tab', (els) => els.map((e) => e.textContent.trim()));
  assert(tabs.length === 3, 'Three sections are offered.');
  assert(
    tabs.some((t) => /original email/i.test(t)),
    'The original email is one of them, named so it is obvious.'
  );

  const visibleCols = await page.evaluate(
    () =>
      [...document.querySelectorAll('.ecc-col')].filter(
        (el) => getComputedStyle(el).display !== 'none'
      ).length
  );
  assert(visibleCols === 1, 'Only one section is shown at a time.');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  assert(!overflow, 'No horizontal page scroll at 390px.');

  const emailTab = (await page.$$('.ecc-pane-tab')).find(async () => true);
  void emailTab;
  const index = await page.evaluate(() =>
    [...document.querySelectorAll('.ecc-pane-tab')].findIndex((b) => /original email/i.test(b.textContent))
  );
  await (await page.$$('.ecc-pane-tab'))[index].click();
  await page.waitForTimeout(250);
  assert(
    await page.evaluate(() => {
      const el = document.querySelector('.ecc-col-conversation');
      return el ? getComputedStyle(el).display !== 'none' : false;
    }),
    'The original email is one tap away at any width.'
  );
  await context.close();
}

group('Mobile: selecting a source takes you to the conversation');

{
  const { context, page } = await open(HARRINGTON, { width: 390, height: 844 });
  await page.click('#ecc-tab-deadlines');
  await page.waitForTimeout(250);
  const extraction = await page.$('.ecc-itab-panel .ecc-extraction');
  assert(extraction !== null, 'There is something to select.');
  await extraction.click();
  await page.waitForTimeout(400);

  const conversationShown = await page.evaluate(() => {
    const el = document.querySelector('.ecc-col-conversation');
    return el ? getComputedStyle(el).display !== 'none' : false;
  });
  assert(
    conversationShown,
    'Revealing a source moves to the conversation, because highlighting something off screen is not revealing it.'
  );
  assert((await page.$$('.ecc-message-source')).length === 1, 'And the source message is marked.');
  await context.close();
}

group('Workspace touch targets and contrast');

{
  /*
    Two thresholds, because the standard has two.
    Standalone controls are held to 44px, which is WCAG 2.2 SC 2.5.5 Target Size
    (Enhanced), Level AAA. Controls that sit inline inside a sentence, such as a
    traceable extraction in a list of prose, fall under the inline exception to
    SC 2.5.8 Target Size (Minimum), Level AA; they are still held to the 24px
    minimum rather than being exempted outright.
  */
  const { context, page } = await open(`${THREAD}?tab=draft`, { width: 390, height: 844 });

  const measured = await page.evaluate(() =>
    [...document.querySelectorAll('button:not([disabled]), select, input, textarea')]
      .map((el) => ({
        tag: el.tagName,
        cls: el.className.split(' ')[0] ?? '',
        height: Math.round(el.getBoundingClientRect().height),
        inline: el.classList.contains('ecc-source-link') || el.classList.contains('ecc-extraction'),
      }))
      .filter((m) => m.height > 0)
  );
  assert(measured.length > 5, `There are controls to measure (${measured.length}).`);

  const standalone = measured.filter((m) => !m.inline && m.height < 44);
  assert(
    standalone.length === 0,
    `Standalone controls are at least 44px tall (${standalone.map((m) => `${m.tag}.${m.cls}:${m.height}`).join(', ')}).`
  );

  const inline = measured.filter((m) => m.inline && m.height < 24);
  assert(
    inline.length === 0,
    `Inline controls meet the 24px minimum (${inline.map((m) => `${m.tag}.${m.cls}:${m.height}`).join(', ')}).`
  );
  await context.close();
}

for (const path of [THREAD, `${THREAD}?tab=draft`, `${WITHHELD}?tab=risks`]) {
  const { context, page } = await open(path);

  const unlabelled = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea')) {
      const label =
        (el.getAttribute('aria-label') ?? '') +
        (el.textContent ?? '') +
        (el.labels?.length ? [...el.labels].map((l) => l.textContent).join('') : '');
      if (label.trim().length === 0) bad.push(`${el.tagName}.${el.className}`);
    }
    return bad;
  });
  assert(unlabelled.length === 0, `${path}: every control has an accessible name (${unlabelled.join(', ')}).`);

  const lowContrast = await page.evaluate(() => {
    const lum = ([r, g, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const bgOf = (el) => {
      let n = el;
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)') {
          const m = (c.match(/rgba?\(([^)]+)\)/) ?? [])[1];
          if (m) {
            const v = m.split(',').map(Number);
            if (v.length < 4 || v[3] > 0.95) return [v[0], v[1], v[2]];
          }
        }
        n = n.parentElement;
      }
      return [9, 14, 26];
    };
    const ratio = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const bad = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('.ecc-main *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const key = `${el.className}|${cs.fontSize}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const px = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = px >= 24 || (px >= 18.66 && weight >= 700);
      const value = ratio(parse(cs.color), bgOf(el));
      if (value < (large ? 3 : 4.5)) bad.push(`${el.className || el.tagName}:${value.toFixed(2)}@${px}px`);
    }
    return bad;
  });
  assert(lowContrast.length === 0, `${path}: WCAG 2.2 AA contrast holds (${lowContrast.join(', ')}).`);

  await context.close();
}

/* ------------------------------------------------------------- summary */

await browser.close();

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre browser suite, Stages 4 and 5: all checks passed.');
