/**
 * Email Command Centre, Stage 7 accessibility and state tests.
 *
 * The brief asks for eight checks: keyboard only, screen reader, 200 per cent
 * zoom, high contrast, reduced motion, mobile portrait, tablet and desktop.
 * Seven of the eight are properties of the rendered page and are checked here
 * in a real browser. The eighth, a screen reader, cannot be driven from a test
 * runner: what is checked instead is the semantic structure a screen reader
 * depends on, plus a manual pass recorded in docs/ACCESSIBILITY_REPORT.md.
 *
 * The state tests are here too, because empty, loading, partial, error,
 * disabled and permission states are also properties of a rendered page. A
 * state nobody has ever looked at is a state that is broken.
 *
 *   npx vite --port 5199 --strictPort
 *   node app/tests/browser/emailCommandCentre.accessibility.test.mjs
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

const ALL_VIEWS = [
  { path: '/email', heading: 'Overview', tab: 'Overview' },
  { path: '/email/needs-attention', heading: 'Needs Attention', tab: 'Needs Attention' },
  { path: '/email/reply-queue', heading: 'Reply Queue', tab: 'Reply Queue' },
  { path: '/email/actions-deadlines', heading: 'Actions and Deadlines', tab: 'Actions & Deadlines' },
  { path: '/email/waiting', heading: 'Waiting', tab: 'Waiting' },
  { path: '/email/quick-wins', heading: 'Quick Wins', tab: 'Quick Wins' },
  { path: '/email/clear-backlog', heading: 'Clear Backlog', tab: 'Clear Backlog' },
  { path: '/email/all', heading: 'All Email', tab: 'All Email' },
  { path: '/email/drafts', heading: 'Drafts', tab: 'Drafts' },
  { path: '/email/security-review', heading: 'Security Review', tab: 'Security Review' },
  { path: '/email/settings', heading: 'Email Settings', tab: 'Email Settings' },
];

const browser = await chromium.launch({ executablePath: EXECUTABLE });

async function open(path, options = {}) {
  const {
    width = 1440,
    height = 1000,
    query = '',
    reducedMotion,
    forcedColors,
    colorScheme,
    deviceScaleFactor,
    isMobile,
  } = options;

  const context = await browser.newContext({
    viewport: { width, height },
    ...(reducedMotion ? { reducedMotion } : {}),
    ...(forcedColors ? { forcedColors } : {}),
    ...(colorScheme ? { colorScheme } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile ? { isMobile, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}?p=${encodeURIComponent(path + query)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ecc-main', { timeout: 15_000 });
  await page.waitForTimeout(250);
  return { context, page, errors };
}

/** Every element that can take focus, in document order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ============================================= 1. keyboard only */

group('Every control can be reached and operated by keyboard alone');

for (const view of ALL_VIEWS) {
  const { context, page, errors } = await open(view.path);

  const reachable = await page.evaluate((selector) => {
    const inMain = Array.from(document.querySelectorAll(selector)).filter(
      (el) =>
        el.closest('.ecc-module') &&
        el.offsetParent !== null &&
        getComputedStyle(el).visibility !== 'hidden'
    );
    return {
      total: inMain.length,
      negativeTabIndex: inMain.filter(
        (el) => el.getAttribute('tabindex') !== null && Number(el.getAttribute('tabindex')) < 0
      ).length,
      unlabelled: inMain.filter((el) => {
        const text = (el.innerText ?? '').trim();
        const label =
          el.getAttribute('aria-label') ??
          (el.getAttribute('aria-labelledby')
            ? document.getElementById(el.getAttribute('aria-labelledby'))?.textContent
            : null) ??
          (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ??
          el.closest('label')?.textContent ??
          el.getAttribute('title') ??
          el.getAttribute('placeholder');
        return text.length === 0 && !label;
      }).length,
    };
  }, FOCUSABLE);

  assert(errors.length === 0, `${view.tab}: no page errors (${errors.join('; ')}).`);
  assert(reachable.total > 0, `${view.tab}: has focusable controls.`);
  assert(
    reachable.negativeTabIndex === 0,
    `${view.tab}: nothing visible is removed from the tab order (${reachable.negativeTabIndex}).`
  );
  assert(
    reachable.unlabelled === 0,
    `${view.tab}: every control has an accessible name (${reachable.unlabelled} without one).`
  );

  // Walk the first dozen stops and confirm focus actually moves and stays
  // inside the module. A tab stop that jumps to the browser chrome, or that
  // does not move at all, is a keyboard trap either way.
  const visited = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    // One animation frame, not 200 ms. The focus ring must be there
    // immediately: the Stage 7 run found it fading in over 200 ms because the
    // application's own button style transitions every property.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName.toLowerCase(),
        inModule: Boolean(el.closest('.ecc-module')),
        outlineWidth: getComputedStyle(el).outlineWidth,
        outlineStyle: getComputedStyle(el).outlineStyle,
        boxShadow: getComputedStyle(el).boxShadow,
      };
    });
    if (where) visited.push(where);
  }
  assert(visited.length >= 8, `${view.tab}: tabbing moves focus through the page (${visited.length} stops).`);
  const withIndicator = visited.filter(
    (v) => (v.outlineStyle !== 'none' && v.outlineWidth !== '0px') || v.boxShadow !== 'none'
  );
  assert(
    withIndicator.length === visited.length,
    `${view.tab}: every focused control shows a focus indicator (${withIndicator.length} of ${visited.length}).`
  );

  await context.close();
}

group('The module tab row is navigation, and the in-page tabs are a tablist');

{
  // These are two different things and the roles are deliberately different.
  // The eleven module tabs change the URL, so they are links in a nav with
  // aria-current on the active one. The eight panes inside a thread do not
  // change the URL, so those are a tablist with roving tabindex and arrow
  // keys. Giving the module row tab roles would promise arrow-key behaviour
  // that a router cannot sensibly provide, and would lie to a screen reader
  // about what pressing them does.
  const { context, page } = await open('/email/needs-attention');

  const nav = await page.evaluate(() => {
    const element = document.querySelector('nav.ecc-tabs');
    return {
      exists: element !== null,
      label: element?.getAttribute('aria-label') ?? '',
      links: element?.querySelectorAll('a[href]').length ?? 0,
      current: element?.querySelectorAll('[aria-current]').length ?? 0,
      inList: element?.querySelectorAll('ul > li > a').length ?? 0,
      titled: Array.from(element?.querySelectorAll('a') ?? []).filter(
        (a) => (a.getAttribute('title') ?? '').length > 10
      ).length,
    };
  });

  assert(nav.exists, 'The module tab row is a nav.');
  assert(nav.label.length > 5, `With a label (${nav.label}).`);
  assert(nav.links === 11, `Eleven links (found ${nav.links}).`);
  assert(nav.current === 1, 'Exactly one carries aria-current.');
  assert(nav.inList === 11, 'Marked up as a list, so a screen reader announces how many.');
  assert(nav.titled === 11, 'Each one carries its longer description.');

  // Every tab is reachable by Tab alone, which is the keyboard contract for
  // links. Walk the row and confirm focus lands on each in turn.
  await page.evaluate(() => document.querySelector('nav.ecc-tabs a').focus());
  const seen = [];
  for (let i = 0; i < 11; i += 1) {
    const label = await page.evaluate(() => document.activeElement.textContent.trim());
    seen.push(label);
    await page.keyboard.press('Tab');
  }
  assert(new Set(seen).size === 11, `Tab reaches all eleven in order (${new Set(seen).size}).`);
  assert(seen[0].includes('Overview'), 'Starting at Overview.');
  assert(seen[6].includes('Clear Backlog'), `And Clear Backlog is the seventh (${seen[6]}).`);

  await context.close();
}

group('The in-page thread panes are a tablist, with arrow keys');

{
  const { context, page } = await open('/email/thread/thr-w-001');

  // Scoped to the analysis panes. The thread page carries more than one
  // tablist, and counting every role="tab" on the page counts the others too.
  const roles = await page.evaluate(() => ({
    tablist: document.querySelector('[role="tablist"]') !== null,
    tabs: document.querySelectorAll('[role="tab"].ecc-itab').length,
    selected: document.querySelectorAll('[role="tab"].ecc-itab[aria-selected="true"]').length,
    roving: Array.from(document.querySelectorAll('[role="tab"].ecc-itab')).filter(
      (t) => t.getAttribute('tabindex') === '0'
    ).length,
  }));

  assert(roles.tablist, 'The analysis panes are a tablist.');
  assert(roles.tabs === 8, `Eight panes (found ${roles.tabs}).`);
  assert(roles.selected === 1, 'Exactly one is selected.');
  assert(roles.roving === 1, 'Roving tabindex: one is in the tab order.');

  await page.evaluate(() =>
    document.querySelector('[role="tab"].ecc-itab[aria-selected="true"]').focus()
  );
  const before = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press('ArrowRight');
  const afterRight = await page.evaluate(() => document.activeElement.textContent.trim());
  assert(afterRight !== before, 'Right arrow moves to the next pane.');
  await page.keyboard.press('Home');
  const atHome = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press('End');
  const atEnd = await page.evaluate(() => document.activeElement.textContent.trim());
  assert(atEnd !== atHome, 'Home and End reach opposite ends.');

  await context.close();
}

group('Backlog mode can be driven from the keyboard, start to finish');

{
  const { context, page, errors } = await open('/email/clear-backlog');

  // Start the session with the keyboard.
  await page.evaluate(() => {
    const start = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.trim().startsWith('Start')
    );
    start.focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);

  const decisionButtons = await page.$$eval('.ecc-decision-button', (els) =>
    els.map((e) => e.querySelector('.ecc-decision-label')?.textContent?.trim() ?? '')
  );
  assert(decisionButtons.length === 8, `All eight decisions are offered (found ${decisionButtons.length}).`);

  // Decide with the keyboard and confirm the position moves.
  const positionBefore = await page.evaluate(
    () => document.querySelector('.ecc-backlog-bar .ecc-legend-note')?.textContent ?? ''
  );
  await page.evaluate(() => document.querySelector('.ecc-decision-button').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  const positionAfter = await page.evaluate(
    () => document.querySelector('.ecc-backlog-bar .ecc-legend-note')?.textContent ?? ''
  );
  assert(positionBefore !== positionAfter, 'Deciding with the keyboard advances to the next item.');
  assert(/decided/i.test(positionAfter), 'And the progress line says how many are decided.');

  // Pause and resume, with the keyboard.
  await page.evaluate(() => {
    const pause = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.trim().startsWith('Pause')
    );
    pause.focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const pausedText = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(/paused/i.test(pausedText), 'Pausing says so on the page.');
  assert(/nothing is lost/i.test(pausedText), 'And reassures rather than warns.');

  await page.evaluate(() => {
    const carry = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.trim().startsWith('Carry on')
    );
    carry.focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const resumedText = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(!/^Paused/m.test(resumedText), 'Carrying on clears the paused notice.');

  assert(errors.length === 0, `No page errors through the whole flow (${errors.join('; ')}).`);
  await context.close();
}

group('A paused session survives a reload, which is what resume means');

{
  const { context, page } = await open('/email/clear-backlog');

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find((b) => b.textContent.trim().startsWith('Start'))
      .click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.ecc-decision-button').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find((b) => b.textContent.trim().startsWith('Pause'))
      .click();
  });
  await page.waitForTimeout(300);

  const stored = await page.evaluate(() =>
    window.localStorage.getItem('concludo.ecc.backlog.session.v1')
  );
  assert(typeof stored === 'string' && stored.length > 0, 'The session is written to this browser.');
  assert(!/oneLineSummary/.test(stored ?? ''), 'And it stores no copy of the analysis.');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ecc-main');
  await page.waitForTimeout(400);

  const afterReload = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(/paused session/i.test(afterReload), 'After a reload, the paused session is offered.');
  assert(/carry on/i.test(afterReload), 'With a way to carry on.');
  assert(/clear it and start again/i.test(afterReload), 'And a way to discard it.');
  assert(
    !/^Item \d+ of/m.test(afterReload),
    'It is offered rather than resumed, so nobody is dropped into the middle of a queue.'
  );

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find((b) => b.textContent.trim().startsWith('Carry on'))
      .click();
  });
  await page.waitForTimeout(400);
  const resumed = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(/\d+ decided/.test(resumed), 'Carrying on restores the decisions already made.');

  await context.close();
}

/* ========================================= 2. screen reader semantics */

group('The structure a screen reader depends on');

for (const view of ALL_VIEWS) {
  const { context, page } = await open(view.path);

  const semantics = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) =>
      Number(h.tagName.slice(1))
    );
    let skipped = 0;
    for (let i = 1; i < headings.length; i += 1) {
      if (headings[i] - headings[i - 1] > 1) skipped += 1;
    }
    const images = Array.from(document.querySelectorAll('svg'));
    return {
      h1: document.querySelectorAll('h1').length,
      headings: headings.length,
      skipped,
      liveRegions: document.querySelectorAll('[aria-live]').length,
      landmarks: document.querySelectorAll('main, [role="main"], nav, [role="navigation"]').length,
      decorativeSvgsUnhidden: images.filter(
        (s) => s.getAttribute('aria-hidden') !== 'true' && !s.querySelector('title')
      ).length,
      emptyLabels: Array.from(document.querySelectorAll('[aria-label]')).filter(
        (el) => (el.getAttribute('aria-label') ?? '').trim().length === 0
      ).length,
      tablesWithoutHeaders: Array.from(document.querySelectorAll('table')).filter(
        (t) => t.querySelectorAll('th').length === 0
      ).length,
      ariaPressedNotBoolean: Array.from(document.querySelectorAll('[aria-pressed]')).filter(
        (el) => !['true', 'false'].includes(el.getAttribute('aria-pressed'))
      ).length,
    };
  });

  assert(semantics.h1 === 1, `${view.tab}: one h1.`);
  assert(semantics.headings >= 2, `${view.tab}: a heading structure, not one heading.`);
  assert(semantics.skipped === 0, `${view.tab}: no skipped heading level (${semantics.skipped}).`);
  assert(semantics.liveRegions >= 1, `${view.tab}: at least one live region for announcements.`);
  assert(semantics.landmarks >= 1, `${view.tab}: at least one landmark.`);
  assert(
    semantics.decorativeSvgsUnhidden === 0,
    `${view.tab}: decorative icons are hidden from screen readers (${semantics.decorativeSvgsUnhidden} exposed).`
  );
  assert(semantics.emptyLabels === 0, `${view.tab}: no empty aria-label.`);
  assert(
    semantics.tablesWithoutHeaders === 0,
    `${view.tab}: every table has header cells (${semantics.tablesWithoutHeaders} without).`
  );
  assert(
    semantics.ariaPressedNotBoolean === 0,
    `${view.tab}: aria-pressed is always true or false.`
  );

  await context.close();
}

group('Nothing depends on colour alone');

{
  const { context, page } = await open('/email/needs-attention');
  const badges = await page.$$eval('.ecc-badge', (els) => els.map((e) => e.textContent.trim()));
  assert(badges.length > 0, 'There are status badges.');
  assert(
    badges.every((b) => b.length > 0),
    'Every badge carries a word, not only a colour.'
  );

  const warnings = await page.$$eval('.ecc-warning', (els) =>
    els.map((e) => e.querySelector('.ecc-warning-head')?.textContent?.trim() ?? '')
  );
  assert(
    warnings.every((w) => w.length > 0),
    'Every warning carries a heading word as well as its colour.'
  );
  await context.close();
}

/* ================================================ 3. zoom and contrast */

group('200 per cent zoom: no horizontal scrolling, nothing clipped');

for (const view of ALL_VIEWS) {
  // 200% zoom at a 1280 logical width is the same as a 640 CSS-pixel viewport,
  // which is what WCAG 1.4.10 Reflow actually asks about.
  const { context, page } = await open(view.path, { width: 640, height: 1024, deviceScaleFactor: 2 });

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    // Content inside a container that scrolls horizontally on purpose is not a
    // reflow failure: SC 1.4.10 is about the PAGE scrolling in two directions.
    // The tab strip and the wide data table both scroll inside themselves, and
    // measuring their children against the viewport would report every page as
    // broken. What matters is that the document itself does not scroll
    // sideways, and that nothing outside a scroller sticks out.
    const inScroller = (el) => {
      let node = el.parentElement;
      while (node && node !== doc) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
        node = node.parentElement;
      }
      return false;
    };
    const widest = Array.from(document.querySelectorAll('.ecc-module *'))
      .filter((el) => el.offsetParent !== null && !inScroller(el))
      .reduce((max, el) => Math.max(max, el.getBoundingClientRect().right), 0);
    const scrollers = Array.from(document.querySelectorAll('.ecc-module *')).filter((el) => {
      const overflowX = getComputedStyle(el).overflowX;
      return overflowX === 'auto' || overflowX === 'scroll';
    }).length;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: Math.round(widest),
      scrollers,
    };
  });

  assert(
    overflow.scrollWidth <= overflow.clientWidth + 2,
    `${view.tab} at 200%: no horizontal page scroll (${overflow.scrollWidth} vs ${overflow.clientWidth}).`
  );
  assert(
    overflow.widest <= overflow.clientWidth + 8,
    `${view.tab} at 200%: nothing extends past the viewport (${overflow.widest}).`
  );

  await context.close();
}

group('Text contrast holds at every size, measured rather than asserted');

{
  function luminance([r, g, b]) {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  for (const view of ALL_VIEWS) {
    const { context, page } = await open(view.path);

    const samples = await page.evaluate(() => {
      // Backgrounds have to be COMPOSITED, not taken from the first element
      // that happens to declare one. The application's own button style is
      // `rgba(255, 255, 255, 0.04)` over a near-black page: reading that as an
      // opaque white background makes white text on it look like a 1.05:1
      // failure when it actually renders at better than 12:1. Measuring the
      // wrong thing is how a contrast suite produces a page of false alarms
      // and then gets ignored.
      function parse(value) {
        const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
        if (parts.length < 3) return null;
        return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
      }
      function over(top, bottom) {
        const a = top.a;
        return {
          r: top.r * a + bottom.r * (1 - a),
          g: top.g * a + bottom.g * (1 - a),
          b: top.b * a + bottom.b * (1 - a),
          a: 1,
        };
      }
      function resolve(el) {
        const stack = [];
        let node = el;
        while (node) {
          const colour = parse(getComputedStyle(node).backgroundColor);
          if (colour && colour.a > 0) stack.push(colour);
          node = node.parentElement;
        }
        // The page ground, under everything.
        let result = { r: 6, g: 10, b: 18, a: 1 };
        for (let i = stack.length - 1; i >= 0; i -= 1) result = over(stack[i], result);
        return `rgb(${Math.round(result.r)}, ${Math.round(result.g)}, ${Math.round(result.b)})`;
      }
      return Array.from(document.querySelectorAll('.ecc-module p, .ecc-module span, .ecc-module li, .ecc-module td, .ecc-module th, .ecc-module h1, .ecc-module h2, .ecc-module h3, .ecc-module button, .ecc-module a'))
        .filter((el) => {
          if (el.offsetParent === null) return false;
          const text = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join('');
          return text.length > 2;
        })
        .slice(0, 160)
        .map((el) => {
          const style = getComputedStyle(el);
          return {
            colour: style.color,
            background: resolve(el),
            fontSize: parseFloat(style.fontSize),
            fontWeight: Number(style.fontWeight) || 400,
            sample: el.textContent.trim().slice(0, 40),
          };
        });
    });

    const parse = (value) => (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    let worst = { ratio: 99, sample: '' };
    let failed = 0;

    for (const s of samples) {
      const fg = parse(s.colour);
      const bg = parse(s.background);
      if (fg.length < 3 || bg.length < 3) continue;
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      // WCAG 2.2: 3:1 for large text (18.66px bold, or 24px), 4.5:1 otherwise.
      const large = s.fontSize >= 24 || (s.fontSize >= 18.66 && s.fontWeight >= 700);
      const required = large ? 3 : 4.5;
      if (ratio < required - 0.01) {
        failed += 1;
        if (ratio < worst.ratio) worst = { ratio, sample: s.sample };
      }
    }

    assert(
      failed === 0,
      `${view.tab}: every text sample meets WCAG 2.2 AA (${failed} failed, worst ${worst.ratio.toFixed(2)}:1 on "${worst.sample}").`
    );

    await context.close();
  }
}

group('Forced colours and dark mode: the module still reads');

{
  const { context, page, errors } = await open('/email/clear-backlog', { forcedColors: 'active' });
  assert(errors.length === 0, 'Forced colours: no page errors.');
  const visible = await page.evaluate(() => {
    const main = document.querySelector('.ecc-main');
    return {
      text: (main?.innerText ?? '').trim().length,
      borderedBadges: Array.from(document.querySelectorAll('.ecc-badge')).filter(
        (el) => getComputedStyle(el).borderStyle !== 'none'
      ).length,
      badges: document.querySelectorAll('.ecc-badge').length,
    };
  });
  assert(visible.text > 200, 'Forced colours: the content is still there.');
  assert(
    visible.badges === 0 || visible.borderedBadges === visible.badges,
    'Forced colours: badges keep a border, so they are still distinguishable.'
  );
  await context.close();
}

group('Reduced motion is honoured');

{
  const { context, page } = await open('/email', { reducedMotion: 'reduce', query: '?demo=loading' });
  const motion = await page.evaluate(() => {
    const animated = Array.from(document.querySelectorAll('.ecc-module *')).filter((el) => {
      const style = getComputedStyle(el);
      const duration = parseFloat(style.animationDuration) || 0;
      return duration > 0.01 && style.animationIterationCount !== '1';
    });
    return {
      animated: animated.length,
      loadingVisible: document.querySelectorAll('.ecc-skeleton, [class*="loading"]').length,
      loadingText: (document.querySelector('.ecc-main')?.innerText ?? '').toLowerCase(),
    };
  });
  assert(motion.animated === 0, `Nothing loops an animation under reduced motion (${motion.animated}).`);
  assert(
    /loading/.test(motion.loadingText),
    'And the loading state still says it is loading, in words rather than movement.'
  );
  await context.close();
}

/* ================================================ 4. the three widths */

group('Mobile portrait, tablet and desktop');

const WIDTHS = [
  { label: 'Mobile portrait', width: 390, height: 844, isMobile: true },
  { label: 'Tablet', width: 834, height: 1112 },
  { label: 'Desktop', width: 1440, height: 1000 },
];

for (const size of WIDTHS) {
  for (const view of ALL_VIEWS) {
    const { context, page, errors } = await open(view.path, size);

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const smallTargets = Array.from(
        document.querySelectorAll('.ecc-module button, .ecc-module a[href], .ecc-module select, .ecc-module input')
      )
        .filter((el) => el.offsetParent !== null)
        .filter((el) => {
          // An inline link inside a sentence is exempt under SC 2.5.8.
          const inline = el.tagName === 'A' && getComputedStyle(el).display.includes('inline');
          if (inline) return false;
          const rect = el.getBoundingClientRect();
          return rect.height > 0 && (rect.height < 24 || rect.width < 24);
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60));
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        content: (document.querySelector('.ecc-main')?.innerText ?? '').trim().length,
        smallTargets,
      };
    });

    assert(errors.length === 0, `${size.label} ${view.tab}: no page errors.`);
    assert(
      layout.scrollWidth <= layout.clientWidth + 2,
      `${size.label} ${view.tab}: no horizontal scroll (${layout.scrollWidth} vs ${layout.clientWidth}).`
    );
    assert(layout.content > 100, `${size.label} ${view.tab}: the page has content.`);
    assert(
      layout.smallTargets.length === 0,
      `${size.label} ${view.tab}: every target is at least 24px (${layout.smallTargets.slice(0, 3).join(', ')}).`
    );

    await context.close();
  }
}

/* ===================================================== 5. the states */

group('Empty, loading, error and partial states');

const STATE_VIEWS = [
  '/email/needs-attention',
  '/email/reply-queue',
  '/email/actions-deadlines',
  '/email/waiting',
  '/email/quick-wins',
  '/email/all',
  '/email/drafts',
  '/email/security-review',
];

for (const path of STATE_VIEWS) {
  for (const state of ['loading', 'empty', 'error']) {
    const { context, page, errors } = await open(path, { query: `?demo=${state}` });
    const text = await page.evaluate(() => (document.querySelector('.ecc-main')?.innerText ?? '').trim());

    assert(errors.length === 0, `${path} ${state}: no page errors.`);
    assert(text.length > 60, `${path} ${state}: the state says something.`);

    if (state === 'empty') {
      assert(
        !/error|failed|problem/i.test(text.split('\n').slice(0, 6).join(' ')),
        `${path} empty: an empty list does not read as a failure.`
      );
    }
    if (state === 'error') {
      assert(
        /could not|try again|something went/i.test(text),
        `${path} error: the error says what happened and offers a way forward.`
      );
      const retry = await page.$$eval('button', (els) =>
        els.some((e) => /try again|retry|refresh/i.test(e.textContent))
      );
      assert(retry, `${path} error: there is a way to try again.`);
    }
    if (state === 'loading') {
      // Checked structurally rather than by scanning the prose. Several views
      // carry the sentence "nothing is sent from here" in their description,
      // which a keyword scan reads as an empty state. What actually matters is
      // that the loading block is present and the empty block is not, so the
      // two cannot be mistaken for each other.
      const blocks = await page.evaluate(() => ({
        loading: document.querySelectorAll('.ecc-state-loading').length,
        empty: document.querySelectorAll('.ecc-state-empty').length,
        error: document.querySelectorAll('.ecc-state-error').length,
        announced: Array.from(document.querySelectorAll('[role="status"]')).some((el) =>
          /loading/i.test(el.textContent ?? '')
        ),
      }));
      assert(blocks.loading > 0, `${path} loading: the loading block is shown.`);
      assert(blocks.empty === 0, `${path} loading: loading is not also showing an empty state.`);
      assert(blocks.error === 0, `${path} loading: and not an error.`);
      assert(blocks.announced, `${path} loading: a screen reader is told it is loading.`);
    }

    await context.close();
  }
}

group('An unanalysed thread says so rather than looking analysed and empty');

{
  const { context, page } = await open('/email/all');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(/not analysed|unprocessed|not yet/i.test(text), 'A partial state is named on the page.');
  await context.close();
}

group('Disabled and permission states are visible and explained');

{
  const { context, page } = await open('/email/settings');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);

  assert(
    /not available in this release/i.test(text),
    'Settings names the actions that are unavailable.'
  );
  assert(/needs your approval, every time/i.test(text), 'And the one that needs approval.');
  assert(/not connected/i.test(text), 'The permission state of each account is shown.');

  const rows = await page.$$eval('.ecc-approval-table tbody tr', (els) => els.length);
  assert(rows === 5, `All five external actions are listed (found ${rows}).`);

  const states = await page.$$eval('.ecc-approval-state', (els) =>
    els.map((e) => e.textContent.trim())
  );
  assert(
    states.filter((s) => /not available/i.test(s)).length === 4,
    'Four are off.'
  );
  assert(
    states.filter((s) => /approval/i.test(s)).length === 1,
    'One needs approval.'
  );

  await context.close();
}

{
  const { context, page } = await open('/email/drafts');
  const text = await page.evaluate(() => document.querySelector('.ecc-main').innerText);
  assert(
    /nothing is sent|not sent|never sent/i.test(text),
    'Drafts states plainly that nothing is sent.'
  );
  const sendButton = await page.$$eval('button, a', (els) =>
    els.some((e) => /^send\b/i.test(e.textContent.trim()))
  );
  assert(!sendButton, 'And there is no send control anywhere on the page.');
  await context.close();
}

group('No shame language reaches the rendered page');

{
  const banned = [
    /\byou(?:'re| are) (?:falling )?behind\b/i,
    /\bdrowning\b/i,
    /\bleaderboard\b/i,
    /\bproductivity score\b/i,
    /\bstreak\b/i,
    /\bonly \d+ left\b/i,
  ];

  for (const view of ALL_VIEWS) {
    const { context, page } = await open(view.path);
    const text = await page.evaluate(() => document.querySelector('.ecc-module').innerText);
    for (const pattern of banned) {
      assert(!pattern.test(text), `${view.tab}: nothing matching ${pattern}.`);
    }
    await context.close();
  }
}

/* ------------------------------------------------------------- summary */

await browser.close();

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre accessibility and states: all checks passed.');
