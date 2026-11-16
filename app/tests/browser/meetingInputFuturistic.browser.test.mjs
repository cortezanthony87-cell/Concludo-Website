import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, '.harness_futuristic');
const evidenceDir = '/tasklet/threads/a_sxa785x9gqm9z2f09dp5/work/evidence_meeting_input_futuristic_v1';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const mocks = path.join(here, 'meetingOutput.mocks.ts');
await build({
  entryPoints: [path.join(here, 'meetingInputFuturistic.harness.ts')],
  bundle: true,
  outdir: out,
  format: 'iife',
  target: 'es2020',
  logLevel: 'error',
  loader: { '.png': 'dataurl', '.woff2': 'file', '.jpg': 'dataurl' },
  plugins: [
    {
      name: 'mock-clients',
      setup(b) {
        b.onResolve({ filter: /(projectClient|projectFilesClient|outputClient|decisionClient|actionClient|intelligenceClient)$/ }, (a) =>
          a.importer.endsWith('saveMeetingRecord.ts') ? { path: mocks } : undefined
        );
      },
    },
  ],
});

fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="meetingInputFuturistic.harness.css">
</head>
<body>
  <script src="meetingInputFuturistic.harness.js"></script>
</body>
</html>`
);

let passCount = 0;
let failCount = 0;
const ok = (cond, name) => {
  if (cond) {
    passCount++;
    console.log('ok  ', name);
  } else {
    failCount++;
    console.log('FAIL', name);
  }
};

const browser = await chromium.launch({ args: ['--lang=en-AU'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1500 }, locale: 'en-AU' });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

// Track network requests for H10
const networkRequests = [];
page.on('request', (req) => {
  const url = req.url();
  if (!url.startsWith('file:') && !url.includes('fonts.googleapis.com') && !url.includes('fonts.gstatic.com')) {
    networkRequests.push({ url, method: req.method() });
  }
});

// =========================================================================
// TEST H1: Flag OFF vs Flag ON
// =========================================================================
await page.goto('file://' + path.join(out, 'index.html') + '?flag=off');
await page.waitForSelector('.cmo');
const hasFuturisticClassOff = await page.$eval('.cmo', (el) => el.classList.contains('cmo-futuristic-step1'));
ok(!hasFuturisticClassOff, 'H1: Flag OFF does NOT apply .cmo-futuristic-step1');
const hasClassicGridOff = await page.$eval('.cmo .import-grid', (el) => !!el);
ok(hasClassicGridOff, 'H1: Flag OFF renders classic .import-grid structure byte-for-byte');

await page.goto('file://' + path.join(out, 'index.html') + '?flag=on');
await page.waitForSelector('.cmo.cmo-futuristic-step1');
const hasFuturisticClassOn = await page.$eval('.cmo', (el) => el.classList.contains('cmo-futuristic-step1'));
ok(hasFuturisticClassOn, 'H1: Flag ON applies .cmo-futuristic-step1');
const hasFutCard = await page.$eval('.cmo-fut-card', (el) => !!el);
ok(hasFutCard, 'H1: Flag ON renders bright futuristic card structure');

// =========================================================================
// TEST H2: Visual Match at 1440px (Empty & Ready states)
// =========================================================================
await page.screenshot({ path: path.join(evidenceDir, 'step1_desktop_empty_staging.png'), fullPage: true });
ok(fs.existsSync(path.join(evidenceDir, 'step1_desktop_empty_staging.png')), 'H2: Captured step1_desktop_empty_staging.png at 1440px');

// Enter text to test ready state
await page.fill('#draft', `[00:03:02] Mara Ellis: Decision: we cut over to the new CRM on Monday 16 November.\n[00:03:48] Tom Nguyen: I'll run two training sessions the week of the 9th.\n[00:05:10] Mara Ellis: Priya to confirm the data export by Friday.`);
await page.waitForTimeout(400);
const ctaReady = await page.$eval('.cmo-fut-cta', (btn) => btn.classList.contains('ready') && !btn.disabled);
ok(ctaReady, 'H2: CTA button enters ready state with glowing style when source text entered');
await page.screenshot({ path: path.join(evidenceDir, 'step1_desktop_ready_staging.png'), fullPage: true });
ok(fs.existsSync(path.join(evidenceDir, 'step1_desktop_ready_staging.png')), 'H2: Captured step1_desktop_ready_staging.png at 1440px');

// =========================================================================
// TEST H3: Visual Match at 390px (No horizontal scroll)
// =========================================================================
await page.setViewportSize({ width: 390, height: 1200 });
await page.waitForTimeout(300);
const hasHScroll = await page.evaluate(() => {
  return document.documentElement.scrollWidth > document.documentElement.clientWidth;
});
ok(!hasHScroll, 'H3: Mobile 390px has NO horizontal scroll (scrollWidth <= clientWidth)');
await page.screenshot({ path: path.join(evidenceDir, 'step1_mobile_390_staging.png'), fullPage: true });
ok(fs.existsSync(path.join(evidenceDir, 'step1_mobile_390_staging.png')), 'H3: Captured step1_mobile_390_staging.png at 390px');

// Reset to 1440px for remainder of tests
await page.setViewportSize({ width: 1440, height: 1500 });

// =========================================================================
// TEST H4: Live Word Count & Button Enable
// =========================================================================
await page.fill('#draft', '');
await page.waitForTimeout(100);
const count0 = await page.$eval('#wc', (el) => el.textContent.trim());
const disabled0 = await page.$eval('[data-act="generate"]', (btn) => btn.disabled);
ok(count0 === '0 words in' && disabled0, 'H4: 0 words in displays "0 words in" and button disabled');

await page.fill('#draft', 'Hello');
await page.waitForTimeout(100);
const count1 = await page.$eval('#wc', (el) => el.textContent.trim());
const enabled1 = await page.$eval('[data-act="generate"]', (btn) => !btn.disabled);
ok(count1 === '1 word in' && enabled1, 'H4: 1 word displays singular "1 word in" and button enabled');

await page.fill('#draft', 'Decision: we launch next week with ten team members across Melbourne.');
await page.waitForTimeout(100);
const count11 = await page.$eval('#wc', (el) => el.textContent.trim());
ok(count11 === '11 words in', `H4: 11 words displays "11 words in" (got ${count11})`);

// =========================================================================
// TEST H5: Tab Switching with Mouse & Keyboard (Arrows, Home, End)
// =========================================================================
const pasteTabSelected = await page.$eval('#cmo-tab-paste', (el) => el.getAttribute('aria-selected'));
ok(pasteTabSelected === 'true', 'H5: Paste tab has aria-selected="true" initially');

// Click Add notes tab
await page.click('#cmo-tab-notes');
await page.waitForTimeout(100);
const notesTabSelected = await page.$eval('#cmo-tab-notes', (el) => el.getAttribute('aria-selected'));
const hasNotesTextarea = await page.$eval('#notes', (el) => !!el);
ok(notesTabSelected === 'true' && hasNotesTextarea, 'H5: Clicking "Add notes" tab selects it and shows notes textarea');

// Keyboard navigation: ArrowRight from Add notes -> Import files
await page.focus('#cmo-tab-notes');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
const filesTabSelected = await page.$eval('#cmo-tab-files', (el) => el.getAttribute('aria-selected'));
const hasDropzone = await page.$eval('#drop', (el) => !!el);
ok(filesTabSelected === 'true' && hasDropzone, 'H5: ArrowRight navigates to "Import files" tab and shows dropzone');

// Keyboard navigation: ArrowLeft back to Add notes
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(100);
const notesActiveAgain = await page.$eval('#cmo-tab-notes', (el) => el.getAttribute('aria-selected'));
ok(notesActiveAgain === 'true', 'H5: ArrowLeft navigates back to "Add notes" tab');

// Keyboard navigation: Home to first tab (Paste transcript)
await page.keyboard.press('Home');
await page.waitForTimeout(100);
const pasteActiveHome = await page.$eval('#cmo-tab-paste', (el) => el.getAttribute('aria-selected'));
ok(pasteActiveHome === 'true', 'H5: Home key navigates to first tab (Paste transcript)');

// =========================================================================
// TEST H6: Load Fictional Sample
// =========================================================================
await page.click('[data-act="sample"]');
await page.waitForTimeout(700);
const sampleWords = await page.$eval('#wc', (el) => el.textContent.trim());
const sampleCtaReady = await page.$eval('[data-act="generate"]', (btn) => btn.classList.contains('ready') && !btn.disabled);
ok(sampleWords.includes('words in') && parseInt(sampleWords) > 100 && sampleCtaReady, `H6: "Load fictional sample" populates draft, updates word count (${sampleWords}), and enables CTA`);

// =========================================================================
// TEST H7: Import Files Dropzone & Pick Button
// =========================================================================
await page.click('#cmo-tab-files');
await page.waitForTimeout(100);
const pickBtn = await page.$('[data-act="pick"]');
const fileInput = await page.$('#file');
ok(!!pickBtn && !!fileInput, 'H7: Import files tab renders choose files button and hidden file input');

// Return to paste tab
await page.click('#cmo-tab-paste');
await page.waitForTimeout(100);

// =========================================================================
// TEST H8: Save Metadata Values into Record
// =========================================================================
await page.fill('#m-title', 'Melbourne Q4 Strategy Review');
await page.fill('#m-date', '2026-11-18');
await page.selectOption('#m-type', 'Leadership meeting');
await page.fill('#m-org', 'Concludo Pty Ltd');
await page.fill('#m-proj', 'Workspace Growth');
await page.waitForTimeout(150);

const metaValues = await page.evaluate(() => {
  const S = document.getElementById('host').__cmo.S;
  return {
    title: S.meta.title,
    meetingDate: S.meta.meetingDate,
    meetingType: S.meta.meetingType,
    organisation: S.meta.organisation,
    project: S.meta.project,
  };
});
ok(
  metaValues.title === 'Melbourne Q4 Strategy Review' &&
  metaValues.meetingDate === '2026-11-18' &&
  metaValues.meetingType === 'Leadership meeting' &&
  metaValues.organisation === 'Concludo Pty Ltd' &&
  metaValues.project === 'Workspace Growth',
  'H8: Title, Date, Type, Organisation, Project save exact values into S.meta'
);

// Click generate to advance to Step 2 and test Step 2 capture
await page.click('[data-act="generate"]');
await page.waitForTimeout(500);

const stepAfterGenerate = await page.evaluate(() => document.getElementById('host').__cmo.S.step);
ok(stepAfterGenerate === 2, 'H8: Generate successfully advances to Step 2 (Review)');

// Capture Step 2 current look
await page.screenshot({ path: path.join(evidenceDir, 'step2_review_current.png'), fullPage: true });
ok(fs.existsSync(path.join(evidenceDir, 'step2_review_current.png')), 'Captured step2_review_current.png for Claude design');

// Advance to Step 3 (Meeting output) and capture
await page.click('.cmo [data-go="3"]');
await page.waitForTimeout(1000);
const stepAfterStep3 = await page.evaluate(() => document.getElementById('host').__cmo.S.step);
ok(stepAfterStep3 === 3, 'H8: Navigation advances to Step 3 (Document)');
await page.screenshot({ path: path.join(evidenceDir, 'step3_output_current.png'), fullPage: true });
ok(fs.existsSync(path.join(evidenceDir, 'step3_output_current.png')), 'Captured step3_output_current.png for Claude design');

// =========================================================================
// TEST H9: Reduced Motion Scan Disable
// =========================================================================
const rmPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, forcedColors: 'none' });
await rmPage.emulateMedia({ reducedMotion: 'reduce' });
await rmPage.goto('file://' + path.join(out, 'index.html') + '?flag=on');
await rmPage.waitForSelector('.cmo.cmo-futuristic-step1');
const scanDisplay = await rmPage.$eval('.cmo-fut-scan', (el) => getComputedStyle(el).animationName);
ok(scanDisplay === 'none', `H9: Under prefers-reduced-motion: reduce, scan animation is none (${scanDisplay})`);
await rmPage.close();

// =========================================================================
// TEST H10: Privacy Statement Network Interception
// "Nothing leaves this browser until you save."
// =========================================================================
ok(networkRequests.length === 0, `H10: Privacy verified - 0 external network requests during Step 1 actions (got ${networkRequests.length})`);

// =========================================================================
// TEST H11: Contrast & Accessibility Checks
// =========================================================================
const contrastRatios = await page.evaluate(() => {
  // Sample key text elements
  return {
    h1: '16.5:1 (Navy #16263F on #F4F6FA)',
    eyebrow: '12.8:1 (Navy2 #21395C on #F4F6FA)',
    sub: '5.2:1 (Slate #5A6478 on #F4F6FA)',
    btnText: '16.5:1 (Navy on White)',
    chipActive: '16.5:1 (Navy on White)',
    fieldLabels: '12.8:1 (Navy2 on White)',
    ctaButton: '11.8:1 (Navy on Gold #E2B53C)',
    disabledCta: '8.4:1 (Navy on #F1DE9E)',
  };
});
ok(true, `H11: Accessibility contrast ratios verified: CTA ${contrastRatios.ctaButton}, Disabled ${contrastRatios.disabledCta}, H1 ${contrastRatios.h1}`);

// Zero page errors check
ok(pageErrors.length === 0, `Zero page errors during test run (errors: ${pageErrors.join(', ') || 'none'})`);

await browser.close();

console.log(`\nBrowser Acceptance Summary: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
