/**
 * Concludo CRM, Stage 2: the rendered module.
 *
 * Runs against the Vite dev server with the Stage 2 preview harness. Start the
 * server first:
 *
 *   npx vite --port 5201 --strictPort &
 *   node app/tests/browser/crm.browser.test.mjs
 *
 * Scope: that all fourteen views render, that the four interface states are
 * reachable and distinguishable, that filters survive moving between views,
 * and that nothing scrolls horizontally at any of the three widths. The
 * accessibility matrix is the other browser suite.
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5201/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const VIEWS = [
  { path: '/crm', title: 'Today' },
  // Renamed in Stage 5: the view is a review queue, not a list of leads.
  { path: '/crm/leads', title: 'Lead inbox' },
  { path: '/crm/pipeline', title: 'Pipeline' },
  { path: '/crm/commitments', title: 'Commitments' },
  { path: '/crm/relationships', title: 'Relationships' },
  { path: '/crm/organisations', title: 'Organisations' },
  { path: '/crm/account-plans', title: 'Account plans' },
  { path: '/crm/service', title: 'Service' },
  { path: '/crm/activities', title: 'Relationship timeline' },
  // Renamed in Stage 7: the view is a queue of what the agents propose.
  { path: '/crm/proposals', title: 'What the agents propose' },
  { path: '/crm/reports', title: 'Reports' },
  { path: '/crm/data-quality', title: 'Data-quality review' },
  { path: '/crm/imports', title: 'Imports' },
  { path: '/crm/settings', title: 'CRM settings' },
];

const WIDTHS = [
  { label: 'Mobile portrait', width: 390, height: 844, isMobile: true },
  { label: 'Tablet', width: 834, height: 1112 },
  { label: 'Desktop', width: 1440, height: 1000 },
];

let failures = 0;
let checks = 0;

function assert(condition, description) {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${description}`);
}

function group(name) {
  console.log(`\n${name}`);
}

const browser = await chromium.launch({ executablePath: EXECUTABLE });

async function open(path, options = {}) {
  const { width = 1440, height = 1000, query = '', isMobile } = options;
  const context = await browser.newContext({
    viewport: { width, height },
    ...(isMobile ? { isMobile, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // Network failures are not module defects. This container blocks the
    // Google Fonts request that index.css makes, and counting that as a page
    // error would hide the real ones behind seventy copies of the same noise.
    const text = message.text();
    if (message.type() !== 'error') return;
    if (text.includes('Failed to load resource')) return;
    errors.push(text);
  });
  // The harness mounts a MemoryRouter whose initial entry is the `p` value, so
  // a query belongs inside it rather than on the browser URL.
  await page.goto(BASE + encodeURIComponent(path + query.replace(/^&/, '?')), {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(260);
  return { context, page, errors };
}

/* ======================================= 1. every view renders, everywhere */

group('All fourteen views render at three widths');

for (const size of WIDTHS) {
  for (const view of VIEWS) {
    const { context, page, errors } = await open(view.path, size);

    const info = await page.evaluate(() => {
      // Whether the PAGE scrolls sideways, measured by trying to scroll it
      // rather than by reading documentElement.scrollWidth. That property
      // reports layout overflow even when an ancestor clips it, so it says a
      // page scrolls when a person cannot actually scroll it. A table inside
      // its own scroller is allowed and is the point; the page moving is not.
      window.scrollTo(9999, 0);
      const pageScrolledBy = window.scrollX;
      window.scrollTo(0, 0);

      return {
        h1: document.querySelector('h1')?.textContent?.trim() ?? '',
        h2: document.querySelector('.ccrm-view-title')?.textContent?.trim() ?? '',
        content: (document.querySelector('.ccrm-main')?.innerText ?? '').trim().length,
        pageScrolledBy,
        bodyOverflow: document.body.scrollWidth - document.documentElement.clientWidth,
        tabs: document.querySelectorAll('.ccrm-tab').length,
        activeTabs: document.querySelectorAll('.ccrm-tab-active').length,
      };
    });

    assert(errors.length === 0, `${size.label} ${view.title}: no page errors (${errors[0] ?? ''})`);
    assert(info.h1 === 'Concludo CRM', `${size.label} ${view.title}: the module heading is the h1`);
    assert(info.h2 === view.title, `${size.label} ${view.title}: the view heading is "${view.title}"`);
    assert(info.content > 120, `${size.label} ${view.title}: the view has content`);
    // Fourteen in Stage 2. Stage 4 added People, Hierarchy and Coverage, and
    // split the Relationships cluster rather than letting one grow to seven.
    // Stage 5 added Capture and Forecast, which was nineteen. Phase 2A-i added
    // Attention, which was twenty, and Phase 2B-i added Memory, which was
    // twenty-one, the Overview is twenty-two and the KAM Copilot is
    // twenty-three. The number is asserted rather than described because the
    // failure it catches is a destination quietly disappearing from one
    // breakpoint and not another.
    assert(
      info.tabs === 23,
      `${size.label} ${view.title}: all twenty-three destinations are present (saw ${info.tabs})`
    );
    assert(info.activeTabs === 1, `${size.label} ${view.title}: exactly one tab is marked current`);
    assert(
      info.pageScrolledBy === 0,
      `${size.label} ${view.title}: the page does not scroll sideways (moved ${info.pageScrolledBy}px)`
    );
    assert(
      info.bodyOverflow <= 2,
      `${size.label} ${view.title}: the body is no wider than the viewport (${info.bodyOverflow}px over)`
    );

    await context.close();
  }
}

/* ========================================= 2. the four states are reachable */

group('Loading, empty, partial and error are reachable and distinguishable');

{
  const states = [
    { value: 'loading', expect: 'Loading' },
    // Stage 5 rewrote this: an empty pipeline view usually means no pipeline is
    // configured, which is a different problem from no work being in one.
    { value: 'empty', expect: 'No pipeline is configured' },
    { value: 'partial', expect: 'Some information is missing' },
    { value: 'error', expect: 'could not be loaded' },
  ];

  for (const state of states) {
    const { context, page, errors } = await open('/crm/pipeline', { query: `&state=${state.value}` });
    const text = await page.evaluate(() => document.querySelector('.ccrm-main')?.innerText ?? '');
    assert(errors.length === 0, `state ${state.value}: no page errors`);
    assert(text.includes(state.expect), `state ${state.value}: the page says "${state.expect}"`);
    await context.close();
  }

  // The distinction that matters: an error must not look like an empty list.
  const { context: ec, page: ep } = await open('/crm/pipeline', { query: '&state=error' });
  const errorInfo = await ep.evaluate(() => ({
    role: document.querySelector('.ccrm-state-error')?.getAttribute('role'),
    text: document.querySelector('.ccrm-state-error')?.textContent ?? '',
  }));
  assert(errorInfo.role === 'alert', 'the error state is announced as an alert');
  assert(
    errorInfo.text.includes('not an empty list'),
    'the error state says plainly that it is not an empty list'
  );
  assert(
    errorInfo.text.includes('Nothing has been changed'),
    'the error state says nothing was changed'
  );
  await ec.close();

  // Loading is announced politely rather than as an alert.
  const { context: lc, page: lp } = await open('/crm/pipeline', { query: '&state=loading' });
  const loadingRole = await lp.evaluate(
    () => document.querySelector('.ccrm-state')?.getAttribute('aria-live')
  );
  assert(loadingRole === 'polite', 'the loading state is announced politely');
  await lc.close();
}

/* ============================== 3. filters survive moving between the views */

group('Filters, the organisation and the position survive navigation');

{
  const { context, page, errors } = await open('/crm', { query: '&org=org-03&range=all&owner=You' });

  const beforeControls = await page.evaluate(() => ({
    org: document.querySelector('#ccrm-org')?.value,
    range: document.querySelector('#ccrm-range')?.value,
    owner: document.querySelector('#ccrm-owner')?.value,
  }));
  assert(beforeControls.org === 'org-03', 'the organisation selector reflects the URL');
  assert(beforeControls.range === 'all', 'the date range reflects the URL');
  assert(beforeControls.owner === 'You', 'the owner filter reflects the URL');

  // Every tab link must carry the query, which is what preserves the filters.
  const tabHrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.ccrm-tab')].map((a) => a.getAttribute('href') ?? '')
  );
  assert(
    tabHrefs.every((href) => href.includes('org=org-03')),
    'every tab link carries the organisation filter'
  );
  assert(
    tabHrefs.every((href) => href.includes('owner=You')),
    'every tab link carries the owner filter'
  );

  // And following one actually keeps them.
  await page.click('.ccrm-tab[href*="/crm/pipeline"]');
  await page.waitForTimeout(260);
  const afterControls = await page.evaluate(() => ({
    title: document.querySelector('.ccrm-view-title')?.textContent?.trim(),
    org: document.querySelector('#ccrm-org')?.value,
    owner: document.querySelector('#ccrm-owner')?.value,
    range: document.querySelector('#ccrm-range')?.value,
  }));
  assert(afterControls.title === 'Pipeline', 'following a tab changes the view');
  assert(afterControls.org === 'org-03', 'the organisation survives the move');
  assert(afterControls.owner === 'You', 'the owner survives the move');
  assert(afterControls.range === 'all', 'the date range survives the move');
  assert(errors.length === 0, 'no page errors while navigating');

  // Back to Today. The harness mounts a MemoryRouter, which does not answer
  // browser history, so this returns the way a person would.
  await page.click('.ccrm-tab[href^="/crm?"], .ccrm-tab[href="/crm"]');
  await page.waitForTimeout(260);
  const cardHrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.ccrm-card')].map((a) => a.getAttribute('href') ?? '')
  );
  assert(cardHrefs.length === 12, 'Today draws twelve cards');
  assert(
    cardHrefs.every((href) => href.startsWith('/crm')),
    'every card leads inside the module'
  );
  assert(
    cardHrefs.every((href) => href.includes('org=org-03')),
    'every card carries the current filters'
  );

  await context.close();
}

/* =========================================== 4. Today shows its reasons */

group('Every item on Today carries a visible reason');

{
  const { context, page } = await open('/crm');
  const info = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.ccrm-item')];
    return {
      itemCount: items.length,
      withReason: items.filter((item) => {
        const reason = item.querySelector('.ccrm-reason-text');
        return reason && (reason.textContent ?? '').trim().length > 15;
      }).length,
      withStanding: items.filter((item) => item.querySelector('.ccrm-standing')).length,
      panels: document.querySelectorAll('.ccrm-panel').length,
      cards: document.querySelectorAll('.ccrm-card').length,
      // The dedup message, which proves the page is composed rather than
      // rendering every queue in full.
      alreadyShown: (document.querySelector('.ccrm-main')?.innerText ?? '').includes(
        'shown in Handle first above'
      ),
    };
  });

  assert(info.cards === 12, 'twelve cards render');
  assert(info.panels === 10, 'ten panels render');
  assert(info.itemCount > 20, 'there are enough items to be worth checking');
  assert(info.withReason === info.itemCount, 'every rendered item shows a reason');
  assert(info.withStanding === info.itemCount, 'every rendered item shows its standing');
  assert(info.alreadyShown, 'a panel reports what Handle first already showed');

  // Nothing is drawn twice.
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll('.ccrm-item')].map(
      (item) =>
        `${item.querySelector('.ccrm-item-title')?.textContent}|${item.querySelector('.ccrm-item-context')?.textContent}`
    )
  );
  assert(new Set(titles).size === titles.length, 'no item is rendered twice on the page');

  await context.close();
}

/* ==================================== 5. the proposal surface is honest */

group('The proposal surface shows the change and says what it will and will not do');

{
  /* WHAT THIS GROUP USED TO ASSERT, AND WHY IT CHANGED.
   *
   * In Stage 2 this page was read-only, and the test asserted that confirm and
   * decline were present and DISABLED, with the reason attached. That was the
   * honest shape for a shell with no applier behind it.
   *
   * Stage 7 built the applier and the queue, so the controls are now live and
   * asserting that they are disabled would be asserting the absence of the
   * feature. What survives from the original is the property underneath it:
   * the page shows what would change rather than describing it, marks what
   * cannot be undone, and does not pretend about what it can do. Those are
   * checked here; the eleven explanation fields, the digest and the batching
   * rules are in tests/browser/crm.stage7.test.mjs. */
  const { context, page } = await open('/crm/proposals');
  const info = await page.evaluate(() => ({
    rows: document.querySelectorAll('.ccrm-proposal-row').length,
    marks: [...document.querySelectorAll('.ccrm-mark')].map((node) => node.textContent ?? ''),
    text: document.querySelector('.ccrm-main')?.innerText ?? '',
  }));

  assert(info.rows >= 6, 'the queue draws the proposals');
  assert(
    info.marks.some((mark) => /cannot be undone/i.test(mark)),
    'a merge proposal is marked as something that cannot be undone'
  );
  assert(
    info.marks.some((mark) => /fields would change|changes nothing/i.test(mark)),
    'every proposal says whether it would change anything'
  );
  assert(
    info.text.includes('No model is called anywhere in this release'),
    'the page says plainly what produces these'
  );
  assert(
    info.text.includes('Nothing has been applied'),
    'and that nothing has happened yet'
  );

  await context.close();
}

/* =========================================== 6. tables stay tables on a phone */

group('A table is still a table at 390 pixels');

{
  // Stage 4 rebuilt Relationships as eight question panels, so the table that
  // was here moved to People. The rule being tested is about tables, not about
  // that view, so the test follows the table.
  const { context, page } = await open('/crm/people', WIDTHS[0]);
  const info = await page.evaluate(() => {
    const table = document.querySelector('.ccrm-table');
    const wrap = document.querySelector('.ccrm-table-wrap');
    const doc = document.documentElement;
    return {
      display: table ? getComputedStyle(table).display : null,
      headers: document.querySelectorAll('.ccrm-table thead th[scope="col"]').length,
      rowHeaders: document.querySelectorAll('.ccrm-table tbody th[scope="row"]').length,
      caption: document.querySelector('.ccrm-table caption')?.textContent ?? '',
      wrapFocusable: wrap ? wrap.getAttribute('tabindex') : null,
      wrapLabel: wrap ? wrap.getAttribute('aria-label') : null,
      wrapScrolls: wrap ? wrap.scrollWidth > wrap.clientWidth : false,
      bodyOverflow: document.body.scrollWidth - doc.clientWidth,
    };
  });

  // index.css sets `table { display: block }` below 900px, which destroys the
  // row and column structure. The module restores it for its own tables.
  assert(info.display === 'table', 'the table is still display: table on a phone');
  assert(info.headers > 3, 'the column headers are real th elements with a scope');
  assert(info.rowHeaders > 3, 'each row has a row header');
  assert(info.caption.length > 5, 'the table has a caption for a screen reader');
  assert(info.wrapFocusable === '0', 'the scroll region is reachable by keyboard');
  assert((info.wrapLabel ?? '').length > 5, 'the scroll region has an accessible name');
  assert(info.wrapScrolls, 'the wrapper is the thing that scrolls');
  assert(info.bodyOverflow <= 2, 'and the page is not made wider by it');

  await context.close();
}

/* ============================== 7. the compact top bar on a phone */

group('The top bar is compact on a phone and plain on a desktop');

{
  const { context, page } = await open('/crm', WIDTHS[0]);
  const compact = await page.evaluate(() => {
    const shell = document.querySelector('.ccrm-controls-shell');
    const summary = document.querySelector('.ccrm-controls-summary');
    const controls = document.querySelector('.ccrm-controls');
    const main = document.querySelector('.ccrm-main');
    return {
      open: shell?.hasAttribute('open') ?? null,
      summaryShown: summary ? getComputedStyle(summary).display !== 'none' : false,
      summaryHeight: summary ? Math.round(summary.getBoundingClientRect().height) : 0,
      summaryText: (summary?.textContent ?? '').trim(),
      controlsShown: controls ? getComputedStyle(controls).display !== 'none' : false,
      mainTop: main ? Math.round(main.getBoundingClientRect().top) : 0,
    };
  });

  assert(compact.open === false, 'the disclosure starts closed on a phone');
  assert(compact.summaryShown && compact.summaryHeight >= 44, 'its summary is a 44px control');
  assert(!compact.controlsShown, 'the twelve controls are behind it');
  assert(compact.summaryText.length > 20, 'the closed summary still says what is narrowing the view');
  assert(compact.mainTop < 500, `the page content starts in the first screen (${compact.mainTop}px)`);

  await page.click('.ccrm-controls-summary');
  await page.waitForTimeout(240);
  const opened = await page.evaluate(() => ({
    open: document.querySelector('.ccrm-controls-shell')?.hasAttribute('open') ?? null,
    selects: document.querySelectorAll('.ccrm-controls select').length,
  }));
  assert(opened.open === true, 'opening it reveals the controls');
  assert(opened.selects >= 5, 'and they are the same controls, not a reduced set');
  await context.close();

  const { context: dc, page: dp } = await open('/crm', WIDTHS[2]);
  const desktop = await dp.evaluate(() => {
    const summary = document.querySelector('.ccrm-controls-summary');
    const controls = document.querySelector('.ccrm-controls');
    return {
      summaryHeight: summary ? Math.round(summary.getBoundingClientRect().height) : 0,
      controlsShown: controls ? getComputedStyle(controls).display !== 'none' : false,
    };
  });
  assert(desktop.summaryHeight === 0, 'there is no disclosure on a desktop');
  assert(desktop.controlsShown, 'the controls are simply the controls');
  await dc.close();
}

/* ============================================ 8. the module says what it is */

group('The module does not pretend to be more than a shell');

{
  const { context, page } = await open('/crm/settings');
  const text = await page.evaluate(() => document.body.innerText);

  assert(
    text.includes('Demonstration data'),
    'the header says the data is a demonstration'
  );
  /* These three assertions were written in Stage 2, when the settings page
     said what the module could not do. All three sentences became FALSE as the
     module was built, and a test that still demanded them would have forced
     the page to keep claiming limits it no longer has:

       "Nothing in this module writes" stopped being true in Stage 5, which
       added quick capture, lead conversion and the stage moves, each with an
       audit row.

       "No email provider, accounting system or customer data is connected"
       became a half-truth in Stage 8: no OUTSIDE system is connected, and the
       file importer is, which is a distinction the page now draws.

       "No AI analysis runs" is still true, and is still asserted, in the
       words the page now uses.

     What has to stay true is the shape of the claim rather than its wording:
     the page says what is NOT connected, and it does not imply capability
     that does not exist. That is what these replacements check. */
  assert(
    text.includes('No connector to an outside system is connected'),
    'settings says no outside system is connected'
  );
  assert(
    text.includes('Concludo holds no credential'),
    'and that Concludo holds no credential for any of them'
  );
  assert(
    text.includes('no model is called anywhere in Concludo today'),
    'settings says no model runs'
  );
  assert(
    text.includes('is not affiliated with, endorsed by or certified by'),
    'the independence disclaimer is present where providers are named'
  );
  assert(
    text.includes('Concludo proposes; a person disposes'),
    'the standing product rule is on the page'
  );
  assert(
    text.includes('indicative until validated with real buyers'),
    'pricing is described as indicative'
  );
  assert(!text.includes('—'), 'no em dash in the rendered module');

  await context.close();
}

await browser.close();

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Concludo CRM browser suite: all checks passed.');
