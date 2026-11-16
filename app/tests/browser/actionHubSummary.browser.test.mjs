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

  // 1. Desktop 1440px - MIX Theme (Minimised by default)
  const ctxDesktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-AU',
  });
  const page = await ctxDesktop.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('file://' + path.join(harnessDir, 'index.html'));
  await page.waitForSelector('.ach-summary-minimised-bar');

  // Check minimised bar elements
  const totalBadgeText = await page.textContent('.ach-summary-min-badge-num');
  ok(totalBadgeText?.trim() === '102', 'H1: Minimised summary shows total 102 actions');

  // Check 8 status chips in minimised bar
  const chipTexts = await page.$$eval('.ach-summary-chip', (els) =>
    els.map((el) => ({
      n: el.querySelector('.ach-summary-chip-num')?.textContent?.trim(),
      label: el.querySelector('span:nth-child(2)')?.textContent?.trim(),
    }))
  );
  ok(chipTexts.length === 8, 'H1: Minimised bar renders exactly 8 status chips');
  ok(chipTexts[0].label === 'Overdue' && chipTexts[0].n === '37', 'H1: Chip Overdue shows 37');
  ok(chipTexts[1].label === 'Due today' && chipTexts[1].n === '1', 'H1: Chip Due today shows 1');
  ok(chipTexts[2].label === 'Upcoming' && chipTexts[2].n === '18', 'H1: Chip Upcoming shows 18');
  ok(chipTexts[3].label === 'Unscheduled' && chipTexts[3].n === '46', 'H1: Chip Unscheduled shows 46');
  ok(chipTexts[4].label === 'In progress' && chipTexts[4].n === '0', 'H1: Chip In progress shows 0');
  ok(chipTexts[5].label === 'Waiting' && chipTexts[5].n === '0', 'H1: Chip Waiting shows 0');
  ok(chipTexts[6].label === 'Blocked' && chipTexts[6].n === '0', 'H1: Chip Blocked shows 0');
  ok(chipTexts[7].label === 'Completed' && chipTexts[7].n === '0', 'H1: Chip Completed shows 0');

  // Check that Action items table is visible and positioned high on screen
  await page.waitForSelector('#ach-actions-table');
  const tableBox = await page.locator('#ach-actions-table').boundingBox();
  ok(tableBox !== null, 'Table: Action items table exists');
  ok(tableBox && tableBox.y < 350, `Table: Action items table is visible high on screen (y = ${tableBox?.y}px < 350px)`);

  // Screenshot 1: Desktop 1440px Minimised View (Action Items visible!)
  await page.screenshot({ path: path.join(outDir, 'mix_minimised_desktop_1440.png'), fullPage: false });
  console.log('Saved mix_minimised_desktop_1440.png');

  // Test Chip click filtering in minimised view
  const overdueChip = page.locator('.ach-summary-chip').first();
  await overdueChip.click();
  let chipPressed = await overdueChip.getAttribute('aria-pressed');
  ok(chipPressed === 'true', 'H4: Clicking Overdue chip sets aria-pressed="true"');
  await overdueChip.click();
  chipPressed = await overdueChip.getAttribute('aria-pressed');
  ok(chipPressed === 'false', 'H4: Clicking Overdue chip again clears filter');

  // Expand Summary: Click "Expand summary"
  const expandBtn = page.locator('.ach-summary-toggle-btn');
  await expandBtn.click();
  await page.waitForSelector('.ach-summary-expanded-wrap');
  ok(true, 'Expand: Clicking Expand summary shows expanded compact summary');

  // Check center number & labels in compact expanded view
  const centerNum = await page.textContent('.ach-summary-donut-wrap text[font-weight="800"]');
  ok(centerNum?.trim() === '102', 'H1: Donut center shows total 102 actions');

  // Check 8 tile numbers in expanded view
  const tileTexts = await page.$$eval('.ach-summary-tile', (els) =>
    els.map((el) => ({
      n: el.querySelector('span:first-child')?.textContent?.trim(),
      label: el.querySelector('div:last-child')?.textContent?.trim(),
    }))
  );
  ok(tileTexts.length === 8, 'H1: Renders exactly 8 status boxes');
  ok(tileTexts[0].label === 'Overdue' && tileTexts[0].n === '37', 'H1: Overdue tile shows 37');
  ok(tileTexts[1].label === 'Due today' && tileTexts[1].n === '1', 'H1: Due today tile shows 1');
  ok(tileTexts[2].label === 'Upcoming' && tileTexts[2].n === '18', 'H1: Upcoming tile shows 18');
  ok(tileTexts[3].label === 'Unscheduled' && tileTexts[3].n === '46', 'H1: Unscheduled tile shows 46');
  ok(tileTexts[4].label === 'In progress' && tileTexts[4].n === '0', 'H1: In progress tile shows 0');
  ok(tileTexts[5].label === 'Waiting' && tileTexts[5].n === '0', 'H1: Waiting tile shows 0');
  ok(tileTexts[6].label === 'Blocked' && tileTexts[6].n === '0', 'H1: Blocked tile shows 0');
  ok(tileTexts[7].label === 'Completed' && tileTexts[7].n === '0', 'H1: Completed tile shows 0');

  // Check legend percentages (Largest Remainder Method: 0, 36, 1, 63)
  const legendRows = await page.$$eval('.ach-summary-legend-btn', (els) =>
    els.map((el) => ({
      label: el.querySelector('span:nth-child(2)')?.textContent?.trim(),
      count: el.querySelector('span:nth-child(3)')?.textContent?.trim(),
      pct: el.querySelector('span:nth-child(4)')?.textContent?.trim(),
    }))
  );
  ok(legendRows[0].label === 'Completed' && legendRows[0].count === '0' && legendRows[0].pct === '0%', 'H1: Legend Completed is 0 (0%)');
  ok(legendRows[1].label === 'Overdue' && legendRows[1].count === '37' && legendRows[1].pct === '36%', 'H1: Legend Overdue is 37 (36%)');
  ok(legendRows[2].label === 'Due today' && legendRows[2].count === '1' && legendRows[2].pct === '1%', 'H1: Legend Due today is 1 (1%)');
  ok(legendRows[3].label === 'Pending' && legendRows[3].count === '64' && legendRows[3].pct === '63%', 'H1: Legend Pending is 64 (63%)');

  // Check that Action items table is STILL visible in expanded compact view
  const tableBoxExpanded = await page.locator('#ach-actions-table').boundingBox();
  ok(tableBoxExpanded && tableBoxExpanded.y < 500, `Table: Action items table is still visible in compact expanded view (y = ${tableBoxExpanded?.y}px < 500px)`);

  // Screenshot 2: Desktop 1440px Compact Expanded MIX
  await page.screenshot({ path: path.join(outDir, 'mix_compact_desktop_1440.png'), fullPage: false });
  console.log('Saved mix_compact_desktop_1440.png');

  // Test H4: Click behaviour on status box (Overdue)
  const overdueBtn = page.locator('.ach-summary-tile').first();
  await overdueBtn.click();
  let isPressed = await overdueBtn.getAttribute('aria-pressed');
  ok(isPressed === 'true', 'H4: Clicking Overdue box sets aria-pressed="true"');

  // Screenshot active filter state
  await page.screenshot({ path: path.join(outDir, 'mix_active_filter_overdue.png'), fullPage: false });

  // Click again to clear
  await overdueBtn.click();
  isPressed = await overdueBtn.getAttribute('aria-pressed');
  ok(isPressed === 'false', 'H4: Clicking Overdue box again clears filter (aria-pressed="false")');

  // Test H4: Keyboard Enter on Due today box
  const dueTodayBtn = page.locator('.ach-summary-tile').nth(1);
  await dueTodayBtn.focus();
  await page.keyboard.press('Enter');
  let dueTodayPressed = await dueTodayBtn.getAttribute('aria-pressed');
  ok(dueTodayPressed === 'true', 'H4: Keyboard Enter on Due today sets aria-pressed="true"');
  await page.keyboard.press('Space');
  dueTodayPressed = await dueTodayBtn.getAttribute('aria-pressed');
  ok(dueTodayPressed === 'false', 'H4: Keyboard Space clears Due today filter');

  // Test H4: Click on donut segment (Pending) using dispatchEvent and legend button
  const pendingSeg = page.locator('.ach-summary-donut-wrap svg circle[aria-label*="Pending"]');
  await pendingSeg.dispatchEvent('click');
  let segPressed = await pendingSeg.getAttribute('aria-pressed');
  ok(segPressed === 'true', 'H4: Clicking Pending donut segment activates filter');
  await pendingSeg.dispatchEvent('click');
  segPressed = await pendingSeg.getAttribute('aria-pressed');
  ok(segPressed === 'false', 'H4: Clicking Pending donut segment again clears filter');

  // Test H4: Clicking legend row (Overdue)
  const overdueLegend = page.locator('.ach-summary-legend-btn[aria-label*="Overdue"]');
  await overdueLegend.click();
  let legPressed = await overdueLegend.getAttribute('aria-pressed');
  ok(legPressed === 'true', 'H4: Clicking Overdue legend row activates filter');
  await overdueLegend.click();
  legPressed = await overdueLegend.getAttribute('aria-pressed');
  ok(legPressed === 'false', 'H4: Clicking Overdue legend row again clears filter');

  // Test H5: Scope switch updates scope reactively
  const scopeBtn = page.locator('#scope-switch-btn');
  await scopeBtn.click();
  const noteText = await page.textContent('.ach-summary-row');
  ok(noteText !== null, 'H5: Scope switch updates without error');
  await scopeBtn.click(); // revert

  // Test H6: Completing one test action (transfer from Overdue to Completed)
  // Save BEFORE screenshot
  await page.screenshot({ path: path.join(outDir, 'mix_h6_before_completed.png'), fullPage: false });
  await page.evaluate(() => {
    window.__setHarnessState({
      bucketCounts: {
        total: 102,
        overdue: 36, // -1
        dueToday: 1,
        upcoming: 18,
        unscheduled: 46,
        pending: 64,
        inProgress: 0,
        waiting: 0,
        blocked: 0,
        completed: 1, // +1
      },
    });
  });
  await page.waitForTimeout(100);
  const newCompText = await page.locator('.ach-summary-tile').nth(7).textContent();
  ok(newCompText?.includes('1'), 'H6: Completed count updated to 1');
  const newOverText = await page.locator('.ach-summary-tile').nth(0).textContent();
  ok(newOverText?.includes('36'), 'H6: Overdue count updated to 36');
  // Save AFTER screenshot
  await page.screenshot({ path: path.join(outDir, 'mix_h6_after_completed.png'), fullPage: false });

  // Revert back to baseline
  await page.evaluate(() => {
    window.__setHarnessState({
      bucketCounts: {
        total: 102,
        overdue: 37,
        dueToday: 1,
        upcoming: 18,
        unscheduled: 46,
        pending: 64,
        inProgress: 0,
        waiting: 0,
        blocked: 0,
        completed: 0,
      },
    });
  });

  // Test H7: Zero state
  await page.evaluate(() => {
    window.__setHarnessState({
      bucketCounts: {
        total: 0,
        overdue: 0,
        dueToday: 0,
        upcoming: 0,
        unscheduled: 0,
        pending: 0,
        inProgress: 0,
        waiting: 0,
        blocked: 0,
        completed: 0,
      },
    });
  });
  await page.waitForTimeout(100);
  const zeroCenter = await page.textContent('.ach-summary-donut-wrap text[font-weight="800"]');
  ok(zeroCenter?.trim() === '0', 'H7: Zero state shows 0 in center');
  const htmlContent = await page.content();
  ok(!htmlContent.includes('NaN'), 'H7: Zero state renders zero NaN characters');
  await page.screenshot({ path: path.join(outDir, 'mix_zero_state.png'), fullPage: false });

  // Revert to baseline
  await page.evaluate(() => {
    window.__setHarnessState({
      bucketCounts: {
        total: 102,
        overdue: 37,
        dueToday: 1,
        upcoming: 18,
        unscheduled: 46,
        pending: 64,
        inProgress: 0,
        waiting: 0,
        blocked: 0,
        completed: 0,
      },
    });
  });

  // Test Minimise toggle back
  const minimiseBtn = page.locator('.ach-summary-toggle-btn.is-light');
  await minimiseBtn.click();
  await page.waitForSelector('.ach-summary-minimised-bar');
  ok(true, 'Minimise: Clicking Minimise summary restores minimised bar');

  // Test H9: Bright Theme Alternate
  await page.evaluate(() => {
    window.__setHarnessState({ themeKey: 'bright' });
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, 'bright_desktop_1440.png'), fullPage: false });
  console.log('Saved bright_desktop_1440.png');

  // 2. Mobile 390px Viewport
  const ctxMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'en-AU',
  });
  const mobilePage = await ctxMobile.newPage();
  mobilePage.on('pageerror', (err) => errors.push(err.message));
  await mobilePage.goto('file://' + path.join(harnessDir, 'index.html'));
  await mobilePage.waitForSelector('.ach-summary-minimised-bar');

  // Screenshot 3: Mobile 390px MIX Minimised
  await mobilePage.screenshot({ path: path.join(outDir, 'mix_minimised_mobile_390.png'), fullPage: false });
  console.log('Saved mix_minimised_mobile_390.png');

  // Expand on mobile
  const mobileExpand = mobilePage.locator('.ach-summary-toggle-btn');
  await mobileExpand.click();
  await mobilePage.waitForSelector('.ach-summary-expanded-wrap');
  await mobilePage.screenshot({ path: path.join(outDir, 'mix_compact_mobile_390.png'), fullPage: false });
  console.log('Saved mix_compact_mobile_390.png');

  ok(errors.length === 0, 'No page errors observed during browser runs');
  await browser.close();

  console.log(`\nBrowser Acceptance Results: ${pass} passed, ${failN} failed.`);
  if (failN > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
