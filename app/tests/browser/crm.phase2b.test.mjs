/**
 * Concludo CRM, Phase 2B-i: the memory page as a person reaches it.
 *
 * The composition suite proves the eight kinds and the nine answers are read
 * out of records. What it cannot prove is the five things that decide whether
 * this page is trusted:
 *
 *   "not recorded" is rendered to be READ, not styled away into grey italics;
 *   every sentence has its record one click away, and the link resolves;
 *   memory and the full history are both present, with memory first and
 *     visibly smaller, so the difference is a thing you can see;
 *   the read is written down and the page says so, at every width;
 *   and nothing on the page is a figure about a person.
 *
 * Start the dev server first:
 *   npx vite --port 5221 --strictPort &
 *   node tests/browser/crm.phase2b.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5221/crm-preview.html?p=';
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
  await page.waitForTimeout(350);
  return { context, page, errors };
}

/* ============================================ 1. it renders everywhere */

group('The memory page renders at three widths with no console errors');

for (const size of [PHONE, TABLET, DESKTOP]) {
  const { context, page, errors } = await open(`/crm/memory?w=${W}`, size);

  const heading = await page.textContent('.ccrm-view-title').catch(() => null);
  assertEqual(heading?.trim(), 'Memory', `${size.width}px: the view is titled`);
  assertEqual(errors.length, 0, `${size.width}px: no console errors (${errors.join('; ')})`);

  const questions = await page.locator('.ccrm-answer').count();
  assertEqual(questions, 9, `${size.width}px: all nine questions are on the page`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  assert(!overflow, `${size.width}px: the page does not scroll sideways`);

  await context.close();
}

/* ============================================ 2. "not recorded" is readable */

group('An answer with nothing behind it is rendered to be read, not styled away');

{
  const { context, page } = await open(`/crm/memory?w=${W}`);

  const empty = page.locator('.ccrm-answer-not-recorded').first();
  assert((await empty.count()) > 0, 'the fixture produces at least one honest empty answer');

  const style = await empty.evaluate((node) => {
    const computed = getComputedStyle(node);
    return {
      fontSize: parseFloat(computed.fontSize),
      fontStyle: computed.fontStyle,
      display: computed.display,
      visibility: computed.visibility,
      opacity: parseFloat(computed.opacity),
      text: node.textContent.trim(),
    };
  });

  const real = await page.locator('.ccrm-answer-text').first().evaluate((node) =>
    parseFloat(getComputedStyle(node).fontSize)
  );

  assertEqual(
    style.fontSize,
    real,
    'an empty answer is the same size as a real one, not shrunk'
  );
  assertEqual(style.fontStyle, 'normal', 'and not italicised into the background');
  assert(style.display !== 'none' && style.visibility !== 'hidden', 'and not hidden');
  assertEqual(style.opacity, 1, 'and not faded out');
  assert(
    style.text.startsWith('Not recorded.'),
    `and it says what it is (${style.text.slice(0, 40)})`
  );
  assert(
    style.text.includes('anything other than the records'),
    'and it says why there is no answer'
  );

  // Distinguishable without colour. The border style is what carries it.
  const borders = await page.evaluate(() => {
    const empty = document.querySelector('.ccrm-answer-empty');
    const full = [...document.querySelectorAll('.ccrm-answer')].find(
      (node) => !node.classList.contains('ccrm-answer-empty')
    );
    return {
      empty: empty ? getComputedStyle(empty).borderLeftStyle : null,
      full: full ? getComputedStyle(full).borderLeftStyle : null,
    };
  });
  assert(
    borders.empty !== null && borders.full !== null && borders.empty !== borders.full,
    `an empty answer is marked by border style, not colour alone (${borders.empty} vs ${borders.full})`
  );

  await context.close();
}

/* ============================================ 3. every sentence has its record */

group('The records behind an answer are one click away and they resolve');

{
  const { context, page } = await open(`/crm/memory?w=${W}`);

  const disclosures = page.locator('.ccrm-answer .ccrm-disclosure-button');
  const count = await disclosures.count();
  assert(count > 0, `at least one answer offers its records (${count})`);

  const first = disclosures.first();
  assertEqual(
    await first.getAttribute('aria-expanded'),
    'false',
    'the records start folded away'
  );
  assert(
    (await first.textContent()).includes('Show the'),
    'and the control says how many there are'
  );

  await first.click();
  await page.waitForTimeout(120);

  assertEqual(
    await first.getAttribute('aria-expanded'),
    'true',
    'opening it is announced to a screen reader'
  );

  const lines = page.locator('.ccrm-answer .ccrm-evidence-list li');
  assert((await lines.count()) > 0, 'and the records appear');

  const links = await page
    .locator('.ccrm-answer .ccrm-evidence-list a')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));

  assert(links.length > 0, 'at least one record is reachable by a link');
  for (const href of links) {
    assert(
      href !== null && href.includes('/crm/'),
      `the record link goes into the module (${href})`
    );
    assert(href !== '#' && href !== '', 'and is not a placeholder');
  }

  // The link actually resolves to a page, rather than the module's not-found.
  const target = links[0];
  await page.goto(`${BASE}${encodeURIComponent(target.replace(/^.*?(\/crm)/, '$1'))}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(250);
  const landed = await page.textContent('.ccrm-view-title').catch(() => null);
  assert(
    landed !== null && landed.trim().length > 0,
    `the record link lands on a titled view (${landed})`
  );

  await context.close();
}

/* ============================================ 4. memory is not the timeline */

group('Memory and the full history are both there, and memory is smaller');

{
  const { context, page } = await open(`/crm/memory?w=${W}`);

  const sections = await page
    .locator('.ccrm-plan-section-title')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));

  assert(
    sections.some((text) => text.startsWith('The nine questions')),
    `the questions are a section (${sections.join(' | ')})`
  );
  assert(
    sections.some((text) => text.startsWith('Everything worth remembering')),
    'memory is a section'
  );
  assert(
    sections.some((text) => text.startsWith('Everything that happened')),
    'and so is the full history'
  );

  // Memory comes first in the document, because the four minutes before a
  // renewal call are not enough to read the history.
  const order = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('.ccrm-plan-section-title')].map((node) =>
      node.textContent.trim()
    );
    return {
      memory: titles.findIndex((text) => text.startsWith('Everything worth remembering')),
      history: titles.findIndex((text) => text.startsWith('Everything that happened')),
    };
  });
  assert(
    order.memory >= 0 && order.history > order.memory,
    'memory is above the full history on the page'
  );

  /* The history is folded, and the page says how the two compare in words.

     Held as an element handle rather than a text locator on purpose: the
     control's label changes from "Show all 7 entries" to "Hide the full
     history" when it opens, so a locator that matched on its text would stop
     matching the moment it was clicked. That is a test defect that reads like
     a product defect, and it cost a run to find. */
  const handles = await page.$$('.ccrm-disclosure-button');
  let historyToggle = null;
  for (const handle of handles) {
    const text = (await handle.textContent()) ?? '';
    if (text.includes('Show all')) historyToggle = handle;
  }
  assert(historyToggle !== null, 'the history is folded away behind a control');
  if (!historyToggle) {
    await context.close();
  } else {
  assertEqual(
    await historyToggle.getAttribute('aria-expanded'),
    'false',
    'and starts closed'
  );

  const comparison = await page
    .locator('.ccrm-section-description', { hasText: 'Memory above is' })
    .first()
    .textContent();
  const figures = comparison.match(/(\d+) of these (\d+)/);
  assert(figures !== null, `the page states both figures (${comparison?.trim()})`);
  if (figures) {
    assert(
      Number(figures[1]) <= Number(figures[2]),
      `memory is not larger than the history (${figures[1]} of ${figures[2]})`
    );
  }

  await historyToggle.click();
  await page.waitForTimeout(150);
  assertEqual(
    await historyToggle.getAttribute('aria-expanded'),
    'true',
    'and it opens'
  );
  assert(
    ((await historyToggle.textContent()) ?? '').includes('Hide the full history'),
    'and the control now offers to close it again'
  );
  assert(
    (await page.locator('.ccrm-item-list').count()) > 0,
    'and the history is on the page'
  );

  await context.close();
  }
}

/* ============================================ 5. the search */

group('The search returns only what contains the words, and says what it did');

{
  const { context, page } = await open(`/crm/memory?w=${W}`);

  const input = page.locator('#memory-search');
  assert((await input.count()) === 1, 'there is one search field');

  const label = await page.locator('label[for="memory-search"]').textContent();
  assert(
    label !== null && label.trim().length > 0,
    `the field has a real label (${label?.trim()})`
  );

  await input.fill('renewal');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(300);

  // Not `.first()`: the scaffold's own "Showing <workspace>" line uses the
  // same class and comes first in the document.
  const summary = await page
    .locator('.ccrm-view-tenant', { hasText: 'across' })
    .first()
    .textContent();
  assert(
    /\d+ results? across \d+ customers?/.test(summary ?? ''),
    `the page says how many results over how many customers (${summary?.trim()})`
  );

  const notes = await page
    .locator('.ccrm-policy')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent));
  assert(
    notes.some((text) => text.includes('not what a model remembers')),
    'and says it searched the records rather than a model'
  );

  // A search that finds nothing says so rather than widening itself.
  await input.fill('zzzqqqnothinghere');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(300);

  const empty = await page.locator('.ccrm-panel-empty').first().textContent();
  assert(
    (empty ?? '').includes('does not widen a search'),
    `an empty search says it will not widen itself (${empty?.slice(0, 60)})`
  );

  await context.close();
}

/* ============================================ 6. the read is written down */

group('Choosing a customer records the read, and the page says so');

{
  const { context, page } = await open(`/crm/memory?w=${W}`);

  const readSection = await page
    .locator('.ccrm-plan-section-title', { hasText: 'Who has read this' })
    .count();
  assertEqual(readSection, 1, 'the page tells the reader that reads are recorded');

  const line = await page
    .locator('.ccrm-view-tenant', { hasText: 'has been read' })
    .first()
    .textContent();
  assert(
    /read \d+ time/.test(line ?? ''),
    `and says how many times (${line?.trim().slice(0, 80)})`
  );

  const policy = await page
    .locator('.ccrm-policy')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent));
  assert(
    policy.some((text) => text.includes('if an account is ever compromised')),
    'and says why the log exists'
  );
  assert(
    policy.some((text) => text.includes('not shown as a figure next to anybody')),
    'and that it is not a figure about anybody'
  );

  /* ONE READ PER CUSTOMER CHOSEN, NOT ONE PER RENDER.

     Asserted as a delta rather than an absolute, because the fixture seeds a
     few reads so the control is visible on first open. The property that
     matters is that choosing a customer adds exactly one, and that leaving
     and coming back adds exactly one more: a page that logged on render would
     add several, which is the defect the ref in the page exists to prevent. */
  const cards = page.locator('.ccrm-card-rail .ccrm-card-button');
  const total = await cards.count();
  assert(total > 1, `there is more than one customer to choose (${total})`);

  const readsFor = async () => {
    const text = await page
      .locator('.ccrm-view-tenant', { hasText: 'has been read' })
      .first()
      .textContent();
    return Number((text ?? '').match(/read (\d+) time/)?.[1] ?? -1);
  };

  const firstFigure = await readsFor();
  assert(firstFigure >= 1, `opening the page records a read (${firstFigure})`);

  // Scroll the page and re-read the figure. A render-logging page would climb.
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, -2000);
  await page.waitForTimeout(400);
  assertEqual(await readsFor(), firstFigure, 'and scrolling does not record more');

  await cards.nth(1).click();
  await page.waitForTimeout(400);
  const secondFigure = await readsFor();
  assert(secondFigure >= 1, `choosing a second customer records a read (${secondFigure})`);

  await cards.nth(0).click();
  await page.waitForTimeout(400);
  assertEqual(
    await readsFor(),
    firstFigure + 1,
    'and coming back to the first records exactly one more, not one per render'
  );

  await context.close();
}

/* ============================================ 7. nothing is about a person */

group('Nothing on the page is a figure about a person');

{
  const { context, page } = await open(`/crm/memory?w=${W}`);

  const body = (await page.textContent('.ccrm-module')) ?? '';

  for (const word of [
    'performance',
    'productivity',
    'leaderboard',
    'ranking',
    'ranked',
    'top performer',
    'reads per user',
  ]) {
    assert(
      !body.toLowerCase().includes(word),
      `the page does not use the word "${word}"`
    );
  }

  // No control groups or sorts by a person.
  const controls = await page
    .locator('button, select, a')
    .evaluateAll((nodes) =>
      nodes.map((node) => `${node.tagName}:${(node.textContent ?? '').trim()}`)
    );
  for (const control of controls) {
    assert(
      !/by owner|by user|by person|per user|by reader/i.test(control),
      `no control groups by a person (${control})`
    );
  }

  // The standing note is on the page, in the words the module uses.
  const note = await page.locator('.ccrm-not-ranked').first().textContent();
  assert(
    (note ?? '').includes('smaller than the activity history on purpose'),
    'the standing note explains what memory is'
  );
  assert(
    (note ?? '').includes('nothing on this page is generated'),
    'and that nothing on the page is generated'
  );

  await context.close();
}

/* ============================================ 8. accessibility */

group('The page meets the target sizes and keeps a visible focus ring');

for (const size of [PHONE, DESKTOP]) {
  const { context, page } = await open(`/crm/memory?w=${W}`, size);

  const minimum = size.width <= 420 ? 44 : 24;

  const small = await page.evaluate(
    (min) =>
      [...document.querySelectorAll('.ccrm-module button, .ccrm-module a, .ccrm-module input')]
        .filter((node) => {
          /* SC 2.5.8 is about targets the person is presented with. At phone
             width the module collapses its navigation and its header
             controls, and a collapsed control measures 0 by 0: it is not a
             target that is too small, it is not a target at all. So the
             filter is `checkVisibility` plus a non-zero box, which is what
             the browser itself means by presented, rather than a display and
             visibility check that a collapsed container passes. */
          if (typeof node.checkVisibility === 'function') {
            if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
              return false;
            }
          }
          const box = node.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;

          const style = getComputedStyle(node);
          // An inline link inside a sentence is exempt under SC 2.5.8.
          return !(node.tagName === 'A' && style.display === 'inline');
        })
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            text: (node.textContent ?? '').trim().slice(0, 30),
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        })
        .filter((entry) => entry.height < min || entry.width < min),
    minimum
  );

  assertEqual(
    small.length,
    0,
    `${size.width}px: every control is at least ${minimum} by ${minimum} (${small
      .map((entry) => `${entry.tag} "${entry.text}" ${entry.width}x${entry.height}`)
      .join('; ')})`
  );

  // The focus ring is the navy one. Gold on light fails 1.4.11 at 2.86:1.
  const ring = await page.evaluate(() => {
    const button = document.querySelector('.ccrm-module .ccrm-disclosure-button');
    if (!button) return null;
    button.focus();
    const style = getComputedStyle(button);
    return { width: style.outlineWidth, colour: style.outlineColor, style: style.outlineStyle };
  });
  assert(ring !== null, `${size.width}px: there is a control to focus`);
  if (ring) {
    assert(
      ring.style !== 'none' && parseFloat(ring.width) >= 2,
      `${size.width}px: a focused control has a ring of at least 2px (${ring.width} ${ring.style})`
    );
  }

  await context.close();
}

/* ============================================ 9. the navigation tab */

group('Memory is a tab in the module navigation at every width');

for (const size of [PHONE, TABLET, DESKTOP]) {
  const { context, page } = await open(`/crm/memory?w=${W}`, size);

  const tabs = await page
    .locator('.ccrm-tab')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));

  assertEqual(tabs.length, 21, `${size.width}px: twenty-one destinations (saw ${tabs.length})`);
  assert(tabs.includes('Memory'), `${size.width}px: Memory is one of them`);

  const active = await page
    .locator('.ccrm-tab-active')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  assertEqual(active.length, 1, `${size.width}px: exactly one tab is current`);
  assertEqual(active[0], 'Memory', `${size.width}px: and it is Memory`);

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
console.log('Concludo CRM Phase 2B-i browser suite: all checks passed.\n');
