import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const harnessDir = path.resolve(__dirname, '.summary_test');
const outDir = path.resolve('/tasklet/threads/a_sxa785x9gqm9z2f09dp5/work/evidence_action_hub_summary_v2');
fs.mkdirSync(outDir, { recursive: true });

let pass = 0, failN = 0;
const ok = (c, n) => {
  if (c) {
    pass++;
    console.log('ok  ', n);
  } else {
    failN++;
    console.log('FAIL', n);
  }
};

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop 1440px - MIX Theme (Side-by-side: Donut left, 8 boxes right)
  const ctxDesktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-AU',
  });
  const page = await ctxDesktop.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('file://' + path.join(harnessDir, 'index.html'));
  await page.waitForSelector('.ach-summary-side-row');

  // Check that Donut card and 8 Status Boxes are side-by-side in .ach-summary-side-row
  const sideRowBox = await page.locator('.ach-summary-side-row').boundingBox();
  ok(sideRowBox !== null, 'Side row container exists');
  ok(sideRowBox && sideRowBox.height < 240, `Side row height is compact (${Math.round(sideRowBox?.height || 0)}px < 240px)`);

  // Check total actions in center of donut
  const totalText = await page.$eval('.ach-summary-donut-wrap text[font-weight="800"]', (el) => el.textContent?.trim());
  ok(totalText === '102', 'H1: Donut center shows total 102 actions');

  // Check 8 status boxes
  const tileTexts = await page.$$eval('.ach-summary-tile', (els) =>
    els.map((el) => ({
      n: el.querySelector('.ach-summary-tile-number')?.textContent?.trim(),
      label: el.querySelector('.ach-summary-tile-label')?.textContent?.trim(),
    }))
  );
  ok(tileTexts.length === 8, 'H1: Renders exactly 8 status boxes in right column');
  ok(tileTexts[0].label === 'Overdue' && tileTexts[0].n === '37', 'H1: Overdue box shows 37');
  ok(tileTexts[1].label === 'Due today' && tileTexts[1].n === '1', 'H1: Due today box shows 1');
  ok(tileTexts[2].label === 'Upcoming' && tileTexts[2].n === '18', 'H1: Upcoming box shows 18');
  ok(tileTexts[3].label === 'Unscheduled' && tileTexts[3].n === '46', 'H1: Unscheduled box shows 46');
  ok(tileTexts[4].label === 'In progress' && tileTexts[4].n === '0', 'H1: In progress box shows 0');
  ok(tileTexts[5].label === 'Waiting' && tileTexts[5].n === '0', 'H1: Waiting box shows 0');
  ok(tileTexts[6].label === 'Blocked' && tileTexts[6].n === '0', 'H1: Blocked box shows 0');
  ok(tileTexts[7].label === 'Completed' && tileTexts[7].n === '0', 'H1: Completed box shows 0');

  // Check that Action items table is visible on screen without scrolling
  await page.waitForSelector('#ach-actions-table');
  const tableBox = await page.locator('#ach-actions-table').boundingBox();
  ok(tableBox !== null, 'Table: Action items table exists');
  ok(tableBox && tableBox.y < 460, `Table: Action items table is immediately visible on screen (y = ${Math.round(tableBox?.y || 0)}px < 460px)`);

  // Screenshot 1: Desktop 1440px View (Summary + Action Items visible together!)
  await page.screenshot({ path: path.join(outDir, 'mix_desktop_1440.png'), fullPage: false });
  console.log('Saved mix_desktop_1440.png');

  // Test status box click filtering
  const overdueTile = page.locator('.ach-summary-tile').first();
  await overdueTile.click();
  let isPressed = await overdueTile.getAttribute('aria-pressed');
  ok(isPressed === 'true', 'H4: Clicking Overdue box sets aria-pressed="true" and filters');
  await page.screenshot({ path: path.join(outDir, 'mix_filtered_overdue.png'), fullPage: false });

  // Click again to clear
  await overdueTile.click();
  isPressed = await overdueTile.getAttribute('aria-pressed');
  ok(isPressed === 'false', 'H4: Clicking Overdue box again clears filter');

  // Keyboard Enter and Space on status box
  const dueTodayTile = page.locator('.ach-summary-tile').nth(1);
  await dueTodayTile.focus();
  await page.keyboard.press('Enter');
  let dueTodayPressed = await dueTodayTile.getAttribute('aria-pressed');
  ok(dueTodayPressed === 'true', 'H4: Keyboard Enter on box activates filter');
  await page.keyboard.press('Space');
  dueTodayPressed = await dueTodayTile.getAttribute('aria-pressed');
  ok(dueTodayPressed === 'false', 'H4: Keyboard Space on box clears filter');

  // 2. Mobile 390px Viewport
  const ctxMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'en-AU',
  });
  const pageMobile = await ctxMobile.newPage();
  await pageMobile.goto('file://' + path.join(harnessDir, 'index.html'));
  await pageMobile.waitForSelector('.ach-summary-side-row');

  await pageMobile.screenshot({ path: path.join(outDir, 'mix_mobile_390.png'), fullPage: false });
  console.log('Saved mix_mobile_390.png');

  ok(errors.length === 0, 'No console/page errors encountered');

  await browser.close();
  console.log(`\nBrowser Tests Complete: ${pass} passed, ${failN} failed.`);
  if (failN > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
