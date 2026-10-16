/**
 * Concludo CRM, Phase 2A-i: the attention page as a person reaches it.
 *
 * The composition suite proves the eleven conditions are right. What it cannot
 * prove is the four things that decide whether this page gets used:
 *
 *   the sentences are the content and the number is not;
 *   the records behind a condition are one click away and they resolve;
 *   a dismissal needs a reason and the page will not take one without it;
 *   and nothing on the page is about a person.
 *
 * Start the dev server first:
 *   npx vite --port 5220 --strictPort &
 *   node tests/browser/crm.phase2.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5220/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1440, height: 900 };

const W = 'ws-key-accounts';

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
  await page.waitForTimeout(300);
  return { context, page, errors };
}

/* ============================================ 1. it renders everywhere */

group('The attention page renders at three widths with no console errors');

for (const size of [PHONE, TABLET, DESKTOP]) {
  const { context, page, errors } = await open(`/crm/attention?w=${W}`, size);

  const heading = await page.textContent('.ccrm-view-title').catch(() => null);
  assertEqual(heading?.trim(), 'Attention', `${size.width}px: the view is titled`);
  assertEqual(errors.length, 0, `${size.width}px: no console errors (${errors[0] ?? ''})`);

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert(
    widths.scroll <= widths.client + 1,
    `${size.width}px: no horizontal page scroll (${widths.scroll} in ${widths.client})`
  );

  const text = await page.evaluate(() => document.body.innerText);
  assert(!text.includes('—'), `${size.width}px: no em dash`);

  await context.close();
}

/* ============================================ 2. eleven conditions */

group('All eleven conditions are on the page, each with what it is for');

{
  const { context, page } = await open(`/crm/attention?w=${W}`);

  const cards = await page.$$eval('.ccrm-card-rail .ccrm-card-button', (nodes) =>
    nodes.map((node) => ({
      label: (node.querySelector('.ccrm-card-label')?.textContent ?? '').trim(),
      note: (node.querySelector('.ccrm-card-note')?.textContent ?? '').trim(),
      count: (node.querySelector('.ccrm-card-count')?.textContent ?? '').trim(),
    }))
  );

  assertEqual(cards.length, 11, 'eleven conditions are shown');
  for (const card of cards) {
    assert(card.label.length > 0, 'each condition has a heading');
    assert(card.note.length > 20, `${card.label}: says what it is for`);
    assert(/^\d+$/.test(card.count), `${card.label}: the count is a whole number`);
  }

  await context.close();
}

/* ============================================ 3. sentences, not a number */

group('The sentences are the content, and every one says what would clear it');

{
  const { context, page } = await open(`/crm/attention?w=${W}`);

  const signals = await page.$$eval('.ccrm-signal', (nodes) =>
    nodes.map((node) => ({
      title: (node.querySelector('.ccrm-item-title')?.textContent ?? '').trim(),
      detail: (node.querySelector('.ccrm-item-context')?.textContent ?? '').trim(),
      resolution: (node.querySelector('.ccrm-flag-resolution')?.textContent ?? '').trim(),
    }))
  );

  assert(signals.length > 0, 'the fixture shows some conditions');
  for (const signal of signals) {
    assert(signal.title.length > 0, 'each condition has a heading');
    assert(signal.detail.length > 20, `${signal.title}: the detail is a sentence`);
    assert(signal.resolution.length > 20, `${signal.title}: says what would clear it`);
  }

  // The figure is on the page but it is not the page. Every account card
  // carries more characters of sentence than of number by a wide margin.
  const ratio = await page.$$eval('.ccrm-panel', (nodes) =>
    nodes
      .filter((node) => node.querySelector('.ccrm-signal'))
      .map((node) => ({
        number: (node.querySelector('.ccrm-answer-count')?.textContent ?? '').trim().length,
        words: (node.textContent ?? '').trim().length,
      }))
  );
  for (const entry of ratio) {
    assert(
      entry.words > entry.number * 50,
      'an account card is overwhelmingly sentences rather than a figure'
    );
  }

  await context.close();
}

/* ============================================ 4. evidence resolves */

group('The records behind a condition are one click away, and they resolve');

{
  const { context, page } = await open(`/crm/attention?w=${W}`);

  const first = page.locator('.ccrm-signal button.ccrm-disclosure-button').first();
  await first.click();
  await page.waitForTimeout(200);

  const links = await page.$$eval('.ccrm-evidence-list a', (nodes) =>
    nodes.map((node) => ({ text: (node.textContent ?? '').trim(), href: node.getAttribute('href') }))
  );
  assert(links.length > 0, 'opening a condition shows the records behind it');

  for (const link of links) {
    assert(link.text.length > 0, 'each record is named in words rather than by id');
    assert(
      (link.href ?? '').includes('/crm/'),
      `the record links into the module (${link.href})`
    );
  }

  // And the first one actually goes somewhere that is not an error page.
  const href = links[0].href;
  const { context: second, page: target, errors } = await open(
    href.replace(/^.*?(\/crm)/, '$1')
  );
  const heading = await target.textContent('.ccrm-view-title').catch(() => null);
  assert(heading !== null && heading.trim().length > 0, 'the record it names opens a real view');
  assertEqual(errors.length, 0, 'with no console errors');
  await second.close();

  await context.close();
}

/* ============================================ 5. deciding */

group('A dismissal needs a reason, and the page refuses one without');

{
  const { context, page } = await open(`/crm/attention?w=${W}`);

  await page.locator('.ccrm-signal button.ccrm-disclosure-button').first().click();
  await page.waitForTimeout(200);

  const before = await page.$$eval('.ccrm-signal', (nodes) => nodes.length);

  // Press dismiss with the reason box empty.
  await page.getByRole('button', { name: 'Dismiss for 90 days' }).first().click();
  await page.waitForTimeout(300);

  const refused = await page.evaluate(() => document.body.innerText);
  assert(
    refused.includes('A reason is needed'),
    'dismissing with no reason is refused, in words'
  );
  assertEqual(
    await page.$$eval('.ccrm-signal', (nodes) => nodes.length),
    before,
    'and nothing left the list'
  );

  // Now with a real reason.
  await page.locator('.ccrm-signal-decide input').first().fill(
    'Handled at the review on the fourth, and recorded against the group instead.'
  );
  await page.getByRole('button', { name: 'Dismiss for 90 days' }).first().click();
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => document.body.innerText);
  assert(after.includes('Recorded, with an audit entry'), 'a real reason is accepted and audited');
  assert(after.includes('Dismissed, and coming back'), 'the condition moves to the dismissed group');
  assert(
    after.includes('It comes back on'),
    'and the page says when it comes back, because a dismissal ends'
  );

  await context.close();
}

group('A viewer cannot dismiss anything');

{
  const { context, page } = await open(`/crm/attention?w=${W}`);

  await page.selectOption('#ccrm-acting-role', 'crm_viewer');
  await page.waitForTimeout(250);
  await page.locator('.ccrm-signal button.ccrm-disclosure-button').first().click();
  await page.waitForTimeout(200);

  const buttons = await page.getByRole('button', { name: 'Dismiss for 90 days' }).count();
  assertEqual(buttons, 0, 'a viewer is not offered the control at all');

  await context.close();
}

/* ============================================ 6. nothing about a person */

group('Nothing on the page is about a person');

for (const workspace of ['ws-key-accounts', 'ws-agency', 'ws-sole-trader']) {
  const { context, page } = await open(`/crm/attention?w=${workspace}`);

  const html = await page.content();
  assert(
    !/u-(anthony|priya|tom|outsider)-/.test(html),
    `${workspace}: no user id reaches the markup`
  );

  const text = await page.evaluate(() => document.body.innerText);
  assert(
    text.includes('about accounts, never about people'),
    `${workspace}: the standing note is on the page`
  );
  assert(text.includes('not a score'), `${workspace}: and says the figure is not a score`);

  for (const banned of ['leaderboard', 'productivity score', 'top performer', 'team average']) {
    const used = text.toLowerCase().includes(banned);
    const denied = new RegExp(`\\b(no|never|not|without)\\s+(a\\s+)?${banned}`, 'i').test(text);
    assert(!used || denied, `${workspace}: "${banned}" appears only where it is refused`);
  }

  // There is no control anywhere that would group this page by a person.
  const grouping = await page.$$eval('select, button', (nodes) =>
    nodes
      .map((node) => (node.getAttribute('aria-label') ?? node.textContent ?? '').toLowerCase())
      .filter((label) => /by owner|by person|by user|per person|whose/.test(label))
  );
  assertEqual(grouping.length, 0, `${workspace}: no control groups the page by a person`);

  await context.close();
}

/* ============================================ 7. what cannot be judged */

group('What could not be judged is shown, with the reason');

{
  const { context, page } = await open('/crm/attention?w=ws-sole-trader');

  const toggle = page.getByRole('button', { name: /could not be judged here/ }).first();
  assert((await toggle.count()) > 0, 'the page says some conditions could not be judged');

  await toggle.click();
  await page.waitForTimeout(200);

  const reasons = await page.$$eval('.ccrm-flag-detail', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim())
  );
  assert(reasons.length > 0, 'and opening it shows why');
  for (const reason of reasons) {
    assert(reason.length > 20, 'each reason is a sentence');
  }

  await context.close();
}

/* ============================================ 8. reach */

group('Every control on the attention page can be hit on a phone');

{
  const { context, page } = await open(`/crm/attention?w=${W}`, PHONE);

  // Open one condition so the decision controls are on the page too.
  await page.locator('.ccrm-signal button.ccrm-disclosure-button').first().click();
  await page.waitForTimeout(200);

  const small = await page.$$eval('button, select, a[href], input', (nodes) =>
    nodes
      .filter((node) => {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .map((node) => {
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
    `every control is at least 24 by 24 (${small
      .map((entry) => `${entry.tag} "${entry.text}" ${entry.width}x${entry.height}`)
      .join('; ')})`
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
console.log('Concludo CRM Phase 2A-i browser suite: all checks passed.\n');
