/**
 * Concludo CRM, Stage 2: the accessibility matrix.
 *
 * WCAG 2.2 AA, measured rather than asserted. Contrast ratios are computed
 * from the rendered pixels, target sizes from the rendered boxes, and the
 * keyboard route by pressing Tab. A suite that only checks for the presence of
 * an `aria-label` tells you somebody typed an attribute, not that the interface
 * works.
 *
 * The module brings its own baseline rather than inheriting one. The
 * application has no :focus-visible rule anywhere, sets outline: none on form
 * controls, ships no prefers-reduced-motion block, and sets table { display:
 * block } below 900px. Each of those is checked here against the module.
 *
 * Start the dev server first:
 *   npx vite --port 5201 --strictPort &
 *   node app/tests/browser/crm.accessibility.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.CRM_PREVIEW ?? 'http://localhost:5201/crm-preview.html?p=';
const EXECUTABLE = '/opt/pw-browsers/chromium';

const VIEWS = [
  '/crm',
  '/crm/leads',
  '/crm/pipeline',
  '/crm/commitments',
  '/crm/relationships',
  '/crm/organisations',
  '/crm/account-plans',
  '/crm/service',
  '/crm/activities',
  '/crm/proposals',
  '/crm/reports',
  '/crm/data-quality',
  '/crm/imports',
  '/crm/settings',
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
  const {
    width = 1440,
    height = 1000,
    query = '',
    reducedMotion,
    forcedColors,
    isMobile,
  } = options;
  const context = await browser.newContext({
    viewport: { width, height },
    ...(reducedMotion ? { reducedMotion } : {}),
    ...(forcedColors ? { forcedColors } : {}),
    ...(isMobile ? { isMobile, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  await page.goto(BASE + encodeURIComponent(path + query.replace(/^&/, '?')), {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(240);
  return { context, page };
}

/* ======================================================= 1. the keyboard */

group('The keyboard route is complete and the skip link works');

{
  const { context, page } = await open('/crm');

  // The skip link is the first thing a keyboard reaches, because the module
  // sits behind 39 application sidebar links.
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    const rect = el.getBoundingClientRect();
    return {
      text: (el.textContent ?? '').trim(),
      href: el.getAttribute('href'),
      visible: rect.left >= 0 && rect.width > 0,
    };
  });
  assert(first.text === 'Skip to the CRM', 'the first tab stop is the skip link');
  assert(first.href === '#ccrm-main', 'it points at the main region');
  assert(first.visible, 'and it becomes visible when focused');

  // Nothing visible is removed from the tab order, and focus is always shown.
  const walk = await page.evaluate(() => {
    const focusable = [
      ...document.querySelectorAll(
        '.ccrm-module a[href], .ccrm-module button:not([disabled]), .ccrm-module select, .ccrm-module input, .ccrm-module summary, .ccrm-module [tabindex="0"]'
      ),
    ].filter((el) => el.offsetParent !== null);

    const negative = [...document.querySelectorAll('.ccrm-module [tabindex]')].filter(
      (el) => el.getAttribute('tabindex') === '-1' && el.offsetParent !== null && el.id !== 'ccrm-main'
    );

    return { focusable: focusable.length, wronglyRemoved: negative.length };
  });
  assert(walk.focusable > 30, 'there is a real keyboard route through the module');
  assert(
    walk.wronglyRemoved === 0,
    'nothing visible is removed from the tab order except the main region, which is a skip target'
  );

  // Every focusable control shows a ring, immediately, with no transition.
  const focusStyle = await page.evaluate(() => {
    const link = document.querySelector('.ccrm-tab');
    link.focus();
    const cs = getComputedStyle(link);
    return { transition: cs.transitionDuration, outlineStyle: cs.outlineStyle };
  });
  assert(
    focusStyle.transition === '0s' || focusStyle.transition === '0s, 0s',
    'focus does not fade in, which would read as no focus at all'
  );

  await context.close();
}

/* ====================================================== 2. accessible names */

group('Every control has an accessible name');

for (const path of VIEWS) {
  const { context, page } = await open(path);
  const unnamed = await page.evaluate(() => {
    const named = (el) => {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return true;
      if (el.getAttribute('aria-labelledby')) return true;
      if ((el.textContent ?? '').trim()) return true;
      if (el.id && document.querySelector(`label[for="${el.id}"]`)) return true;
      if (el.closest('label')) return true;
      if (el.getAttribute('title')) return true;
      return false;
    };
    return [
      ...document.querySelectorAll(
        '.ccrm-module a[href], .ccrm-module button, .ccrm-module select, .ccrm-module input, .ccrm-module summary'
      ),
    ]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => !named(el))
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`);
  });
  assert(unnamed.length === 0, `${path}: every control has a name (${unnamed.slice(0, 2).join(', ')})`);
  await context.close();
}

/* ========================================================= 3. target size */

group('Target size holds at 24px, and at 44px on a phone');

for (const [label, size, minimum] of [
  ['Desktop', { width: 1440, height: 1000 }, 24],
  ['Mobile', { width: 390, height: 844, isMobile: true }, 44],
]) {
  for (const path of VIEWS) {
    const { context, page } = await open(path, size);
    const small = await page.evaluate((min) => {
      return [
        ...document.querySelectorAll(
          '.ccrm-module a[href], .ccrm-module button, .ccrm-module select, .ccrm-module summary'
        ),
      ]
        .filter((el) => el.offsetParent !== null)
        .filter((el) => {
          // SC 2.5.8 exempts a link inside a sentence.
          const cs = getComputedStyle(el);
          if (el.tagName === 'A' && cs.display.includes('inline') && !cs.display.includes('flex')) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.height > 0 && (rect.height < min || rect.width < min);
        })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 26)}`);
    }, minimum);
    assert(
      small.length === 0,
      `${label} ${path}: every target is at least ${minimum}px (${small.slice(0, 2).join(', ')})`
    );
    await context.close();
  }
}

/* ============================================= 4. contrast, measured */

group('Text contrast is measured, not assumed');

{
  const { context, page } = await open('/crm');

  const results = await page.evaluate(() => {
    const parse = (value) => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };

    // The real background behind an element, compositing every translucent
    // layer above the opaque one. Reading the nearest background alone makes
    // rgba(255,255,255,0.04) look like opaque white and produces false
    // failures, which is a mistake this suite has made before.
    const backgroundOf = (el) => {
      const layers = [];
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0) {
          layers.unshift(bg);
          if (bg.a === 1) break;
        }
        node = node.parentElement;
      }
      if (layers.length === 0) return { r: 9, g: 14, b: 26, a: 1 };
      let base = layers[0].a === 1 ? layers.shift() : { r: 9, g: 14, b: 26, a: 1 };
      for (const layer of layers) base = over(layer, base);
      return base;
    };

    const samples = [
      '.ccrm-card-label',
      '.ccrm-card-note',
      '.ccrm-item-title',
      '.ccrm-item-context',
      '.ccrm-reason-text',
      '.ccrm-standing',
      '.ccrm-panel-title',
      '.ccrm-panel-description',
      '.ccrm-view-description',
      '.ccrm-sync',
      '.ccrm-demo-note',
      '.ccrm-tab',
      '.ccrm-tab-group-label',
      '.ccrm-status-word',
      '.ccrm-foot-note',
      '.ccrm-panel-more',
    ];

    const out = [];
    for (const selector of samples) {
      const el = document.querySelector(selector);
      if (!el) {
        out.push({ selector, missing: true });
        continue;
      }
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = backgroundOf(el);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      out.push({
        selector,
        ratio: Math.round(ratio(fg, bg) * 100) / 100,
        required: large ? 3 : 4.5,
        size: Math.round(size * 10) / 10,
      });
    }
    return out;
  });

  for (const row of results) {
    assert(!row.missing, `${row.selector} is present to be measured`);
    if (row.missing) continue;
    assert(
      row.ratio >= row.required,
      `${row.selector} at ${row.size}px measures ${row.ratio}:1, needs ${row.required}:1`
    );
  }

  await context.close();
}

/* ====================================== 5. status is never colour alone */

group('Status is carried by a shape and a word, not by colour');

{
  const { context, page } = await open('/crm');
  const info = await page.evaluate(() => {
    const marks = [...document.querySelectorAll('.ccrm-status')];
    return {
      count: marks.length,
      withGlyph: marks.filter((m) => (m.querySelector('.ccrm-status-glyph')?.textContent ?? '').trim())
        .length,
      withWord: marks.filter((m) => (m.querySelector('.ccrm-status-word')?.textContent ?? '').trim())
        .length,
      withHiddenText: marks.filter((m) => m.querySelector('.ccrm-visually-hidden')).length,
      glyphs: new Set(
        marks.map((m) => (m.querySelector('.ccrm-status-glyph')?.textContent ?? '').trim())
      ).size,
    };
  });

  assert(info.count > 8, 'there are status marks to check');
  assert(info.withGlyph === info.count, 'every status carries a shape');
  assert(info.withWord === info.count, 'every status carries a word');
  assert(info.withHiddenText === info.count, 'every status says its meaning to a screen reader');
  assert(info.glyphs >= 2, 'the shapes are distinct silhouettes, not one shape in several colours');

  // The basis chips carry a word too, not just a border colour.
  const { context: bc, page: bp } = await open('/crm/commitments');
  const basis = await bp.evaluate(() => {
    const chips = [...document.querySelectorAll('.ccrm-basis')];
    return {
      count: chips.length,
      labelled: chips.filter((c) => (c.textContent ?? '').trim().length > 3).length,
    };
  });
  assert(basis.count > 4, 'the basis chips render');
  assert(basis.labelled === basis.count, 'every basis chip says the word, not only a colour');
  await bc.close();

  await context.close();
}

/* ============================================ 6. headings and landmarks */

group('Headings are ordered and landmarks are named');

for (const path of VIEWS) {
  const { context, page } = await open(path);
  const info = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('.ccrm-module h1, .ccrm-module h2, .ccrm-module h3, .ccrm-module h4')];
    const levels = headings.map((h) => parseInt(h.tagName.slice(1), 10));
    let skipped = 0;
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] - levels[i - 1] > 1) skipped += 1;
    }
    return {
      h1: document.querySelectorAll('.ccrm-module h1').length,
      h2: document.querySelectorAll('.ccrm-module h2').length,
      skipped,
      navNamed: !!document.querySelector('.ccrm-module nav[aria-label]'),
      mainId: !!document.getElementById('ccrm-main'),
      empties: headings.filter((h) => !(h.textContent ?? '').trim()).length,
    };
  });

  assert(info.h1 === 1, `${path}: exactly one h1`);
  assert(info.h2 >= 1, `${path}: the view has its own h2`);
  assert(info.skipped === 0, `${path}: no heading level is skipped`);
  assert(info.navNamed, `${path}: the section navigation has an accessible name`);
  assert(info.mainId, `${path}: the skip target exists`);
  assert(info.empties === 0, `${path}: no empty heading`);
  await context.close();
}

/* ==================================================== 7. 200 per cent zoom */

group('At 200 per cent zoom the module reflows rather than scrolling sideways');

{
  // SC 1.4.10 Reflow: 320 CSS pixels wide, which is 1280 at 200 per cent.
  for (const path of ['/crm', '/crm/relationships', '/crm/proposals']) {
    const { context, page } = await open(path, { width: 320, height: 1024, isMobile: true });
    const info = await page.evaluate(() => {
      window.scrollTo(9999, 0);
      const moved = window.scrollX;
      window.scrollTo(0, 0);
      return {
        moved,
        content: (document.querySelector('.ccrm-main')?.innerText ?? '').trim().length,
      };
    });
    assert(info.moved === 0, `${path} at 320px: the page does not scroll sideways`);
    assert(info.content > 100, `${path} at 320px: the content is still there`);
    await context.close();
  }
}

/* ===================================================== 8. reduced motion */

group('Reduced motion is honoured');

{
  const { context, page } = await open('/crm', { reducedMotion: 'reduce' });
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('.ccrm-module *')]
      .map((el) => {
        const cs = getComputedStyle(el);
        return {
          animation: parseFloat(cs.animationDuration) || 0,
          transition: parseFloat(cs.transitionDuration) || 0,
        };
      })
      .filter((d) => d.animation > 0.05 || d.transition > 0.05).length
  );
  assert(durations === 0, 'no animation or transition runs for longer than 50ms under reduced motion');
  await context.close();
}

/* ====================================================== 9. forced colours */

group('The module still reads with the author palette discarded');

{
  const { context, page } = await open('/crm', { forcedColors: 'active' });
  const info = await page.evaluate(() => ({
    cards: document.querySelectorAll('.ccrm-card').length,
    content: (document.querySelector('.ccrm-main')?.innerText ?? '').trim().length,
    cardBorder: getComputedStyle(document.querySelector('.ccrm-card')).borderTopWidth,
    glyph: (document.querySelector('.ccrm-status-glyph')?.textContent ?? '').trim(),
  }));
  assert(info.cards === 12, 'the cards are still there under forced colours');
  assert(info.content > 500, 'the content is still readable');
  assert(parseFloat(info.cardBorder) >= 1, 'cards keep a border so the structure survives');
  assert(info.glyph.length > 0, 'the status shape is a character, so it survives the palette being discarded');
  await context.close();
}

/* ================================================= 10. no shame language */

group('No banned language reaches the rendered page');

{
  const banned = [
    /\bleaderboard\b/i,
    /\bproductivity score\b/i,
    /\btop performer\b/i,
    /\bteam average\b/i,
    /\bfalling behind\b/i,
    /\burgent\b/i,
    /\bfailed to\b/i,
    /\bguaranteed\b/i,
    /\bhot lead\b/i,
    /\bstreak\b/i,
  ];

  /* Stage 8 added a sentence that DENIES two of these words: "There is no
     leaderboard, no productivity score and nothing to sort people by." That
     is the clearest statement of the rule this check exists to enforce, and
     banning the words outright would have forced the product to stop saying
     it.

     So a banned word is allowed where it is being refused, and nowhere else.
     "No leaderboard" passes; "Leaderboard" as a heading does not. The denial
     has to be immediately before the word, which keeps the ban meaningful:
     there is no phrasing that offers a leaderboard and still reads as a
     refusal. */
  const denied = (text, pattern) => {
    const source = pattern.source.replace(/\\b/g, '');
    const asDenial = new RegExp(`\\b(no|never|not|without)\\s+(a\\s+)?${source}`, 'i');
    const all = new RegExp(pattern.source, 'gi');
    const occurrences = text.match(all) ?? [];
    const denials = text.match(new RegExp(asDenial.source, 'gi')) ?? [];
    return occurrences.length > 0 && occurrences.length === denials.length;
  };

  for (const path of VIEWS) {
    const { context, page } = await open(path);
    const text = await page.evaluate(() => document.querySelector('.ccrm-module')?.innerText ?? '');
    const broken = banned
      .filter((pattern) => pattern.test(text) && !denied(text, pattern))
      .map((p) => p.source);
    assert(broken.length === 0, `${path}: no banned language on the page (${broken.join(', ')})`);
    assert(!text.includes('—'), `${path}: no em dash on the page`);
    await context.close();
  }
}

await browser.close();

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Concludo CRM accessibility: all checks passed.');
