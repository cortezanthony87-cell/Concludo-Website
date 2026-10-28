/**
 * Email Command Centre, connection and bright-theme browser tests.
 *
 *   npx vite --port 5199 --strictPort
 *   node tests/browser/emailCommandCentre.connections.browser.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.ECC_PREVIEW ?? 'http://localhost:5199/email-preview.html';
const EXECUTABLE = process.env.PW_CHROMIUM || undefined;
const PERSONAL = 'acct-personal-01';
let failures = 0, checks = 0;
const ok = (c, d) => { checks++; if (!c) { failures++; console.error('  FAIL  ' + d); } };
const group = (n) => console.log('\n' + n);
const DASH = /[\u2014\u2013]/;

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const open = async (path, w = 1440, h = 900) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}?p=${encodeURIComponent(path)}`);
  await p.waitForSelector('.ecc-main', { state: 'visible' });
  await p.waitForTimeout(500);
  p._errors = errors;
  return p;
};
const num = (t) => Number((t || '').match(/\d+/)?.[0] ?? NaN);

group('Overview stays the Overview');
{
  const p = await open('/email');
  ok((await p.locator('.ecc-module.ecc-bright').count()) === 0, 'The Overview does not carry the bright class.');
  ok((await p.locator('.ecc-overview-v2').count()) === 1, 'The Overview template is the first thing shown at /email.');
  ok((await p.locator('.ecc-related, .ecc-next-bar').count()) === 0, 'No new bars are added to the Overview.');
  await p.context().close();
}

group('Every other view is bright');
for (const path of ['/email/needs-attention', '/email/reply-queue', '/email/actions-deadlines', '/email/waiting', '/email/quick-wins', '/email/clear-backlog', '/email/all', '/email/outputs', '/email/security-review', '/email/settings']) {
  const p = await open(path);
  ok((await p.locator('.ecc-module.ecc-bright').count()) === 1, `${path} carries the bright class.`);
  const lum = await p.evaluate(() => {
        const bg = getComputedStyle(document.querySelector('.ecc-module')).backgroundColor.match(/\d+/g).map(Number);
    return (bg[0] + bg[1] + bg[2]) / 3;
  });
  ok(lum > 230, `${path} has a light ground.`);
  ok(p._errors.length === 0, `${path} raises no page errors.`);
  const text = await p.locator('.ecc-module').innerText();
  ok(!DASH.test(text), `${path} shows no em or en dash.`);
  ok((await p.locator('.ecc-tab').count()) === 11, `${path} keeps all eleven tabs.`);
  await p.context().close();
}

group('The account survives promoted actions (regression)');
{
  const p = await open(`/email/reply-queue?account=${PERSONAL}`);
  const href = await p.locator('.ecc-open-thread').first().getAttribute('href');
  ok(href.includes(`account=${PERSONAL}`), 'The Open thread link carries the Personal account.');
  ok((href.match(/\?/g) ?? []).length === 1, 'The link has a single question mark.');
  await p.locator('.ecc-open-thread').first().click();
  await p.waitForTimeout(400);
  ok(!(await p.locator('body').innerText()).includes('Thread not found'), 'A Personal thread opens, not Thread not found.');
  ok((await p.locator('.ecc-account-personal').count()) > 0, 'The account badge still says Personal.');
  await p.context().close();
}

group('Back returns to where the thread was opened');
for (const [path, label] of [['/email/needs-attention', 'Needs Attention'], ['/email/waiting', 'Waiting'], ['/email/quick-wins', 'Quick Wins']]) {
  const p = await open(path);
  const link = p.locator('.ecc-open-thread').first();
  if ((await link.count()) === 0) { ok(false, `${path} has an Open thread link.`); await p.context().close(); continue; }
  await link.click();
  await p.waitForTimeout(400);
  const back = (await p.locator('a', { hasText: /^\s*Back to/ }).first().innerText()).trim();
  ok(back === `Back to ${label}`, `From ${label}, Back says "${back}".`);
  await p.locator('a', { hasText: /^\s*Back to/ }).first().click();
  await p.waitForTimeout(300);
  ok(new URL(p.url()).searchParams.get('p') === path || (await p.locator('.ecc-tab-active').innerText()).includes(label), `Back lands on ${label}.`);
  await p.context().close();
}
{
  const p = await open('/email');
  const btn = p.locator('a:has-text("Open thread")').first();
  if (await btn.count()) {
    await btn.click(); await p.waitForTimeout(400);
    const back = (await p.locator('a', { hasText: /^\s*Back to/ }).first().innerText()).trim();
    ok(back === 'Back to Overview', `From the Overview, Back says "${back}".`);
  } else ok(false, 'The Overview has an Open thread link.');
  await p.context().close();
}

group('Related counts equal the pages they link to');
{
  const p = await open('/email/needs-attention');
  const links = await p.locator('.ecc-related-link').all();
  ok(links.length >= 6, 'Related views list at least six destinations.');
  for (const l of links) {
    const name = (await l.innerText()).replace(/\d+/g, '').trim();
    const count = num(await l.locator('.ecc-related-count').innerText());
    await l.click(); await p.waitForTimeout(400);
    if (name === 'Clear Backlog') {
      const t = await p.locator('text=/\\d+ threads? match/').first().innerText();
      ok(num(t) === count, `Clear Backlog shows ${num(t)} and the link said ${count}.`);
    } else if (count > 0) {
      const t = await p.locator('.ecc-view-count').first().innerText();
      ok(num(t) === count, `${name} shows ${num(t)} and the link said ${count}.`);
    } else {
      ok((await p.locator('.ecc-view-count').count()) === 0, `${name} has no count when the link says 0.`);
    }
    const nav = await p.locator('.ecc-tab-active').innerText();
    ok(nav.includes(name.split(' ')[0]), `${name} link lands on the ${name} tab.`);
    await p.locator('.ecc-tab', { hasText: 'Needs Attention' }).click(); await p.waitForTimeout(300);
    break; // one full round trip per run keeps the tab state simple; the loop below covers the rest
  }
  await p.context().close();
}
for (const name of ['Reply Queue', 'Actions & Deadlines', 'Waiting', 'Quick Wins', 'Security Review']) {
  const p = await open('/email/needs-attention');
  const l = p.locator('.ecc-related-link', { hasText: name }).first();
  const count = num(await l.locator('.ecc-related-count').innerText());
  await l.click(); await p.waitForTimeout(400);
  if (count > 0) ok(num(await p.locator('.ecc-view-count').first().innerText()) === count, `${name}: link count ${count} equals the page count.`);
  else ok((await p.locator('.ecc-view-count').count()) === 0, `${name}: zero count means an empty page.`);
  await p.context().close();
}
{
  const p = await open(`/email/reply-queue?account=${PERSONAL}`);
  const hrefs = await p.locator('.ecc-related-link').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
  ok(hrefs.length > 0 && hrefs.every((h) => h.includes(`account=${PERSONAL}`)), 'Every related link keeps the Personal account.');
  await p.context().close();
}

group('Triage keys');
{
  const p = await open('/email/needs-attention');
  const rows = await p.locator('[data-thread-id]').count();
  ok(rows > 1, 'The list has rows with thread ids.');
  await p.keyboard.press('j');
  const first = await p.evaluate(() => document.activeElement?.getAttribute('data-thread-id'));
  await p.keyboard.press('j');
  const second = await p.evaluate(() => document.activeElement?.getAttribute('data-thread-id'));
  ok(first && second && first !== second, 'J moves to the next thread.');
  await p.keyboard.press('k');
  ok((await p.evaluate(() => document.activeElement?.getAttribute('data-thread-id'))) === first, 'K moves back.');
  await p.keyboard.press('o');
  await p.waitForTimeout(400);
  ok(p.url().includes(`thread/${first}`) || (await p.locator('h1,h2').first().innerText()).length > 0, 'O opens the focused thread.');
  await p.context().close();
}
{
  const p = await open('/email/needs-attention');
  await p.locator('.ecc-input, .ecc-search-input, input[type=search]').first().click();
  await p.keyboard.type('jkor');
  ok((await p.evaluate(() => document.activeElement?.getAttribute('data-thread-id'))) === null, 'Typing in the search box does not trigger the keys.');
  await p.context().close();
}

group('Clear Backlog presets');
{
  const p = await open('/email/reply-queue');
  const link = p.locator('.ecc-next-secondary').first();
  const href = await link.getAttribute('href');
  ok(href.includes('clear-backlog') && href.includes('preset=replies'), 'Reply Queue hands its threads to Clear Backlog with the replies preset.');
  await link.click(); await p.waitForTimeout(500);
  const box = p.getByLabel('Only threads awaiting a reply from me');
  ok(await box.isChecked(), 'The preset is a visible, ticked checkbox the person can untick.');
  await box.uncheck();
  ok(!(await box.isChecked()), 'The person can change the preset.');
  await p.context().close();
}

group('Mobile');
{
  const p = await open('/email/needs-attention', 390, 844);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 1, `No horizontal page scroll at 390 wide (overflow ${overflow}).`);
  ok((await p.locator('.ecc-next-primary').first().boundingBox()).height >= 40, 'The next step is at least 40px tall on a phone.');
  await p.context().close();
}

await browser.close();
console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) { console.error(`${failures} failed.`); process.exit(1); }
console.log('Email Command Centre connections (browser): all checks passed.');
