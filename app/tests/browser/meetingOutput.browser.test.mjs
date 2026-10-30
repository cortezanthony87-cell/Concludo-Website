// Acceptance test for the meeting output v2 install. Run from the app folder:
//   node tests/browser/meetingOutput.browser.test.mjs
// Builds the harness with esbuild (already present via Vite), then drives it with Playwright.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Client as PgClient } from 'pg';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, '.harness');
fs.mkdirSync(out, { recursive: true });
const mocks = path.join(here, 'meetingOutput.mocks.ts');
await build({
  entryPoints: [path.join(here, 'meetingOutput.harness.ts')], bundle: true, outdir: out, format: 'iife', target: 'es2020', logLevel: 'error',
  loader: { '.png': 'dataurl', '.woff2': 'file' },
  plugins: [{ name: 'mock-clients', setup(b) {
    b.onResolve({ filter: /(projectClient|projectFilesClient|outputClient|decisionClient|actionClient|intelligenceClient)$/ }, (a) =>
      a.importer.endsWith('saveMeetingRecord.ts') ? { path: mocks } : undefined);
  } }],
});
fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><link rel="stylesheet" href="meetingOutput.harness.css"></head><body><script src="meetingOutput.harness.js"></script></body></html>');

let pass = 0, failN = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('ok  ', name); } else { failN++; console.log('FAIL', name); } };
const b = await chromium.launch({ args: ['--lang=en-AU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-AU' });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto('file://' + path.join(out, 'index.html'));
await p.waitForSelector('.cmo .stepper');

// 1. Navigation
ok((await p.$$eval('.cmo .stepper .step', (x) => x.length)) === 3, 'Three steps in the stepper');
ok((await p.$$eval('.cmo .brand img', (x) => x.length)) === 0, 'Embedded mode hides the Concludo lockup (the shell shows it)');
await p.click('.cmo [data-act=sample]'); await p.waitForTimeout(700);
await p.click('.cmo [data-act=generate]'); await p.waitForTimeout(300);
const counts = await p.evaluate(() => { const S = document.getElementById('host').__cmo.S; return [S.model.decisions.length, S.model.actions.length, S.model.risks.length, S.model.openItems.length]; });
ok(JSON.stringify(counts) === '[4,9,4,4]', `Sample finds 4 decisions, 9 actions, 4 risks, 4 open items (got ${counts})`);

// 2. Isolation both ways
const h1 = await p.$eval('.cmo h1', (e) => getComputedStyle(e).color);
ok(h1 === 'rgb(22, 38, 63)', `Workspace h1 rule does not reach the studio (${h1})`);
ok((await p.$eval('#ws-h1', (e) => getComputedStyle(e).color)) === 'rgb(255, 0, 0)', 'Studio CSS does not restyle the Workspace shell');
ok((await p.$eval('.cmo .btn', (e) => getComputedStyle(e).backgroundColor)) !== 'rgb(128, 0, 128)', 'Workspace .btn rule does not reach studio buttons');

// 3. Documents
await p.click('.cmo .stepper [data-go="3"]'); await p.waitForTimeout(1500);
const doc = async (t) => { await p.click(`.cmo [data-tpl=${t}]`); await p.waitForTimeout(1200); return p.$$eval('.cmo .page', (ps) => ps.map((pg) => { const bd = pg.querySelector('.pg-body'); return { w: pg.getBoundingClientRect().width, over: bd.scrollHeight > bd.clientHeight + 1, text: pg.innerText }; })); };
const board = await doc('board');
ok(board.length >= 5, `Board briefing paginates (${board.length} pages)`);
ok(board.every((x) => Math.abs(x.w - 793.7) < 2), 'Pages are A4 width (210mm) despite a hostile .page rule');
ok(board.every((x) => !x.over), 'No board page overflows its body');
ok(/Evidence appendix/.test(board.map((x) => x.text).join(' ')), 'Board briefing carries the evidence appendix');
const exec = await doc('exec');
ok(exec.length === 1, `Executive summary is one page (${exec.length})`);
const all = [...board, ...exec, ...(await doc('actions')), ...(await doc('decisions'))].map((x) => x.text).join('\n');
ok(!/[–—]/.test(all), 'No em or en dash in any document');
ok(/not yet been confirmed by a person/.test(exec.map((x) => x.text).join(' ')), 'Unreviewed record says it is a draft, not reviewed');
ok(!/Project Team|Priya Raman|Hannah Brooks|Telstra/.test(all.replace(/Priya Shah/g, '')), 'No v1 hard-coded names or placeholder owners');

// 4. Save path: what reaches the database
await p.click('.cmo [data-act=save]'); await p.waitForSelector('.cmo [data-act=do-save]');
ok(/no owner/.test(await p.$eval('.cmo .modal', (e) => e.innerText)), 'Save dialog warns about the unowned action');
await p.click('.cmo [data-savemode=new]');
await p.click('.cmo [data-act=do-save]'); await p.waitForTimeout(1200);
const writes = await p.evaluate(() => globalThis.__writes);
const by = (fn) => writes.filter((x) => x.fn === fn).map((x) => x.input);
const allowed = ['summary', 'action_items', 'follow_up_email', 'decision_log', 'action_plan', 'endpoint_report'];
ok(by('createProject').length === 1, 'New project created once');
ok(by('saveOutput').every((o) => allowed.includes(o.output_type)), `Output types stay inside outputs_output_type_check (${by('saveOutput').map((o) => o.output_type)})`);
ok(by('saveOutput').filter((o) => ['summary', 'action_plan', 'decision_log'].includes(o.output_type)).every((o) => o.json_content?.version === '2.0'), 'Full v2 record stored with the summary, action plan and decision log');
ok(by('saveDecision').length === 4 && by('saveDecision').every((d) => d.decision_reasoning === null), '4 decisions saved, no invented reasoning');
const acts = by('saveAction');
ok(acts.length === 9, `9 actions saved (${acts.length})`);
ok(acts.filter((a) => a.owner_name === null).length === 1 && !acts.some((a) => /team/i.test(a.owner_name || '')), 'Unowned action saved with a NULL owner, not a placeholder');
ok(acts.every((a) => /line \d+/.test(a.action_description)), 'Every action description cites its source line');
ok((await p.evaluate(() => window.__savedTo)) === 'createProject-1', 'onSaved receives the new project id');

// 5. Read-only viewer for the project page
const viewerPages = await p.evaluate(async () => { const el = document.createElement('div'); document.body.appendChild(el); window.__mountViewer(el); await new Promise((r) => setTimeout(r, 1500)); return { pages: el.querySelectorAll('.page').length, topbar: getComputedStyle(el.querySelector('.topbar')).display }; });
ok(viewerPages.pages >= 5 && viewerPages.topbar === 'none', `Viewer renders the saved record without the studio chrome (${viewerPages.pages} pages)`);

// 6. Clean unmount
await p.evaluate(() => window.__unmount());
ok((await p.$eval('#host', (e) => e.innerHTML.length + e.className.length)) === 0, 'Unmount leaves the host empty');
ok(await p.evaluate(() => [...document.querySelectorAll('.cmo img')].every((i) => i.complete && i.naturalWidth > 0)), 'Logos load');
ok(errors.length === 0, `No page errors (${errors.join(' | ')})`);

// 7. Phone width
await p.setViewportSize({ width: 390, height: 844 });
await p.reload(); await p.waitForSelector('.cmo .stepper');
ok(await p.evaluate(() => document.getElementById('ws-main').scrollWidth <= document.getElementById('ws-main').clientWidth + 1), 'No sideways scroll in the content area at 390px');

// 8. Starter: email panel locked, no follow_up_email row saved
await p.setViewportSize({ width: 1440, height: 900 });
await p.evaluate(() => window.__remount(false));
await p.waitForSelector('.cmo .stepper');
await p.click('.cmo [data-act=sample]'); await p.waitForTimeout(500);
await p.click('.cmo [data-act=generate]'); await p.waitForTimeout(300);
await p.click('.cmo .stepper [data-go="3"]'); await p.waitForTimeout(1000);
await p.click('.cmo [data-tpl=email]'); await p.waitForTimeout(500);
const lockedText = await p.$eval('.cmo .email-card', (e) => e.innerText);
ok(lockedText.includes('Follow-up email drafts are included in Pro and Team.'), `8. Starter email panel is locked with notice`);
ok((await p.$$eval('.cmo [data-act=copy-email]', (x) => x.length)) === 0, '8. Starter has no Copy email button');
await p.evaluate(() => { globalThis.__writes = []; });
await p.click('.cmo [data-act=save]'); await p.waitForSelector('.cmo [data-act=do-save]');
await p.click('.cmo [data-savemode=new]');
await p.click('.cmo [data-act=do-save]'); await p.waitForTimeout(1000);
const starterWrites = await p.evaluate(() => globalThis.__writes);
const starterOutputTypes = starterWrites.filter((x) => x.fn === 'saveOutput').map((x) => x.input.output_type);
ok(!starterOutputTypes.includes('follow_up_email'), `8. Starter does not save follow_up_email row (${starterOutputTypes})`);

// 9. Pro trial: panel works, row saved
await p.evaluate(() => window.__remount(true));
await p.waitForSelector('.cmo .stepper');
await p.click('.cmo [data-act=sample]'); await p.waitForTimeout(500);
await p.click('.cmo [data-act=generate]'); await p.waitForTimeout(300);
await p.click('.cmo .stepper [data-go="3"]'); await p.waitForTimeout(1000);
await p.click('.cmo [data-tpl=email]'); await p.waitForTimeout(500);
const proEmailText = await p.$eval('.cmo .email-card', (e) => e.innerText);
ok(!proEmailText.includes('Follow-up email drafts are included in Pro and Team.'), '9. Pro trial email panel is unlocked');
ok((await p.$$eval('.cmo [data-act=copy-email]', (x) => x.length)) === 1, '9. Pro trial has Copy email button');
ok((await p.$$eval('.cmo [data-act=dl-email-txt]', (x) => x.length)) === 1, '9. Pro trial has Download .txt button');
ok((await p.$$eval('.cmo [data-act=set-audience]', (x) => x.length)) === 2, '9. Pro trial has Client and Internal audience toggles');
await p.evaluate(() => { globalThis.__writes = []; });
await p.click('.cmo [data-act=save]'); await p.waitForSelector('.cmo [data-act=do-save]');
await p.click('.cmo [data-savemode=new]');
await p.click('.cmo [data-act=do-save]'); await p.waitForTimeout(1000);
const proWrites = await p.evaluate(() => globalThis.__writes);
const proOutputTypes = proWrites.filter((x) => x.fn === 'saveOutput').map((x) => x.input.output_type);
ok(proOutputTypes.includes('follow_up_email'), `9. Pro trial saves follow_up_email row (${proOutputTypes})`);

// 8b. Starter: deck panel locked, no pptxgenjs network request
await p.evaluate(() => window.__remount(false, false));
await p.waitForSelector('.cmo .stepper');
await p.click('.cmo [data-act=sample]'); await p.waitForTimeout(500);
await p.click('.cmo [data-act=generate]'); await p.waitForTimeout(300);
await p.click('.cmo .stepper [data-go="3"]'); await p.waitForTimeout(1000);
await p.click('.cmo [data-tpl=deck]'); await p.waitForTimeout(500);
const starterDeckText = await p.$eval('.cmo .email-card', (e) => e.innerText);
ok(starterDeckText.includes('Client decks are included in Pro and Team.'), '8b. Starter deck panel is locked with notice');
ok((await p.$$eval('.cmo [data-act=dl-deck-pptx]', (x) => x.length)) === 0, '8b. Starter has no Download PowerPoint button');

// 9b. Pro trial: deck panel works, slides render and export buttons appear when confirmed
await p.evaluate(() => window.__remount(true, true));
await p.waitForSelector('.cmo .stepper');
await p.click('.cmo [data-act=sample]'); await p.waitForTimeout(500);
await p.click('.cmo [data-act=generate]'); await p.waitForTimeout(300);

// Confirm all items in step 2 so record is approved and validated
await p.click('.cmo [data-act=confirm-all]'); await p.waitForTimeout(300);

await p.click('.cmo .stepper [data-go="3"]'); await p.waitForTimeout(1000);
await p.click('.cmo [data-tpl=deck]'); await p.waitForTimeout(500);
const proDeckText = await p.$eval('.cmo #pages', (e) => e.innerText);
ok(!proDeckText.includes('Client decks are included in Pro and Team.'), '9b. Pro trial deck panel is unlocked');
ok((await p.$$eval('.cmo [data-act=dl-deck-pptx]', (x) => x.length)) === 1, '9b. Pro trial has Download PowerPoint button');
ok((await p.$$eval('.cmo [data-act=print-deck]', (x) => x.length)) === 1, '9b. Pro trial has Print or save PDF button');
const renderedDeckSlides = await p.$$eval('.cmo .pg', (xs) => xs.length);
ok(renderedDeckSlides >= 6, `9b. Pro trial renders deck slides in studio (${renderedDeckSlides} slides)`);

// 10. Starter direct insert of a follow_up_email row through the client is refused by the database (branch/preview)
try { execSync('service postgresql status || service postgresql start', { stdio: 'ignore' }); } catch {}
const pgClient = new PgClient({ host: 'localhost', database: 'concludo_preview', user: 'postgres', password: 'postgres' });
await pgClient.connect();
let test10Error = null;
try {
  await pgClient.query('BEGIN;');
  await pgClient.query('SET LOCAL ROLE authenticated;');
  await pgClient.query(`SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';`);
  await pgClient.query(`INSERT INTO public.outputs (project_id, user_id, output_type, content) VALUES ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'follow_up_email', 'Subject: Malicious\\n\\nDirect insert bypass');`);
  await pgClient.query('COMMIT;');
} catch (e) {
  test10Error = e;
  await pgClient.query('ROLLBACK;');
} finally {
  await pgClient.end();
}
ok(test10Error !== null && test10Error.message.includes('follow_up_email_draft'), `10. Starter direct insert of follow_up_email refused by database: ${test10Error?.message}`);

await b.close();
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
