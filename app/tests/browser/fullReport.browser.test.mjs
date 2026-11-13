// Acceptance test: full meeting report and separate follow-up email.
//   node tests/browser/fullReport.browser.test.mjs <harness dir> <out dir>
// The harness dir is built from tests/browser/fullReport.harness.ts (see TASKLET brief for the build command).
import { createRequire } from 'module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
const dir = path.resolve(process.argv[2] || '.'), out = path.resolve(process.argv[3] || '.');
fs.mkdirSync(out, { recursive: true });
let pass = 0, failN = 0;
const ok = (c, n) => { if (c) { pass++; console.log('ok  ', n); } else { failN++; console.log('FAIL', n); } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-AU', permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
await p.goto('file://' + path.join(dir, 'index.html')); await p.waitForSelector('.cmo .stepper');

async function toDocs(flags) {
  if (flags) { await p.evaluate((f) => window.__mount(f), flags); await p.waitForSelector('.cmo .stepper'); }
  await p.click('.cmo [data-act=sample]'); await p.waitForTimeout(600);
  await p.click('.cmo [data-act=generate]'); await p.waitForTimeout(400);
  await p.click('.cmo [data-act=confirm-all]').catch(() => {});
  await p.click('.cmo .stepper [data-go="3"]'); await p.waitForTimeout(2200);
}
const pages = () => p.$$eval('.cmo #pages .page', (ps) => ps.map((pg) => { const bd = pg.querySelector('.pg-body'); return { part: pg.dataset.part, over: bd.scrollHeight > bd.clientHeight + 1, text: pg.innerText }; }));
async function savePdf(name) {
  await p.click('.cmo [data-act=print]'); await p.waitForTimeout(400);
  const title = await p.evaluate(() => document.title);
  await p.emulateMedia({ media: 'print' });
  const f = path.join(out, name);
  await p.pdf({ path: f, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const n = +/Pages:\s+(\d+)/.exec(execSync(`pdfinfo "${f}"`).toString())[1];
  const text = execSync(`pdftotext -layout "${f}" -`).toString();
  return { n, text, title };
}

// 1. Pro with both releases: every part in one document
await toDocs();
ok(await p.$eval('.cmo .tpl.on', (e) => e.dataset.tpl) === 'full', 'Full report is the default document');
const full = await pages();
const parts = [...new Set(full.map((x) => x.part))];
ok(JSON.stringify(parts) === JSON.stringify(['contents', 'board', 'exec', 'actions', 'decisions', 'timeline', 'deck']), `Parts in order: ${parts.join(' > ')}`);
ok(full.every((x) => !x.over), 'No page overflows');
ok(full.length >= 15, `Full report is ${full.length} pages`);
const toc = full[0].text;
ok(['Board briefing', 'Executive summary', 'Action plan', 'Decision pack', 'Action timeline', 'Client presentation'].every((t) => toc.includes(t)), 'Contents lists all six documents');
ok(/Follow-up email: kept separate/.test(toc), 'Contents says the email is kept separate');
ok(/Page \d+ of \d+/.test(full[full.length - 1].text), 'Continuous page numbers');
const outline = await p.$$eval('.cmo #outline a', (a) => a.map((x) => x.textContent));
ok(outline.length === 7, `Outline lists contents and six parts (${outline.length})`);
await p.screenshot({ path: path.join(out, 'screen_full_report_pro.png') });
const pdf1 = await savePdf('full_report_pro.pdf');
ok(pdf1.n === full.length, `PDF has every page (${pdf1.n} of ${full.length})`);
ok(/Full report/.test(pdf1.title), `PDF file name says Full report ("${pdf1.title}")`);
ok(['Board briefing', 'Executive summary', 'Action plan', 'Decision pack', 'Action timeline', 'Client presentation'].every((t) => pdf1.text.includes(t)), 'PDF text contains all six documents');
ok(/The road ahead/.test(pdf1.text) && /Week by week/.test(pdf1.text), 'PDF timeline section has the road and week grid');
const shadowSlides = await p.$$eval('.cmo [data-deck-slot]', (s) => s.filter((x) => x.shadowRoot && x.shadowRoot.querySelector('.pg')).length);
ok(shadowSlides >= 4, `Client deck slides render in the report (${shadowSlides})`);
const email = await p.evaluate(() => { const S = document.getElementById('host').__cmo.S; return S.model; });
ok(!/CONTEXT|Thank you for your time at/.test(pdf1.text), 'No follow-up email text in the PDF');
ok(!/[–—]/.test(pdf1.text), 'No em or en dash in the PDF');
void email;

// 2. Single documents still export on their own
for (const t of ['board', 'exec', 'actions', 'decisions']) {
  await p.click(`.cmo [data-tpl=${t}]`); await p.waitForTimeout(1300);
  const pg = await pages();
  const r = await savePdf(`single_${t}.pdf`);
  ok(r.n === pg.length && pg.length > 0, `${t} alone: PDF ${r.n} pages, preview ${pg.length}`);
}

// 3. Follow-up email: separate, ready to paste, bold titles
await p.click('.cmo [data-tpl=email]'); await p.waitForTimeout(800);
ok(await p.$('.cmo [data-act=print]') === null, 'Email view has no PDF export');
const strong = await p.$$eval('.cmo [data-email-body] strong', (s) => s.map((x) => x.textContent));
ok(strong.includes('Decisions') && strong.includes('Actions') && strong.includes('Next meeting'), `Section titles shown bold: ${strong.join(', ')}`);
await p.click('.cmo [data-act=copy-email-body]'); await p.waitForTimeout(500);
const clip = await p.evaluate(async () => { const items = await navigator.clipboard.read(); const it = items[0]; const html = it.types.includes('text/html') ? await (await it.getType('text/html')).text() : ''; const txt = await (await it.getType('text/plain')).text(); return { html, txt }; });
ok(/<strong>Decisions<\/strong>/.test(clip.html), 'Clipboard HTML has bold section titles');
ok(!/^Subject:/m.test(clip.txt) && /Decisions/.test(clip.txt), 'Clipboard holds the body only, ready to paste');
ok(!/\| ---/.test(clip.txt), 'Plain text has no table pipes');
fs.writeFileSync(path.join(out, 'clipboard_body.html'), `<!doctype html><meta charset="utf-8"><body style="margin:24px">${clip.html}</body>`);
fs.writeFileSync(path.join(out, 'clipboard_body.txt'), clip.txt);
await p.screenshot({ path: path.join(out, 'screen_email.png') });

// 4. Starter: four documents, no timeline, no deck, no email
await toDocs({ canDraftEmail: false, canExportDeck: false, canExportTimeline: false });
const st = [...new Set((await pages()).map((x) => x.part))];
ok(JSON.stringify(st) === JSON.stringify(['contents', 'board', 'exec', 'actions', 'decisions']), `Starter parts: ${st.join(' > ')}`);
ok(/included in Pro and above/.test((await pages())[0].text), 'Starter contents says timeline and deck are in Pro');
await p.screenshot({ path: path.join(out, 'screen_full_report_starter.png') });
const pdf4 = await savePdf('full_report_starter.pdf');
ok(!/Action timeline\n|Client presentation ·/.test(pdf4.text.replace(/Action timeline: included in Pro and above\./, '').replace(/Client presentation: included in Pro and above\./, '')), 'Starter PDF has no timeline or deck section');

// 5. Pro before the written releases: same four documents, no mention
await toDocs({ timelineReleased: false, deckReleased: false });
const pr = await pages();
ok(JSON.stringify([...new Set(pr.map((x) => x.part))]) === JSON.stringify(['contents', 'board', 'exec', 'actions', 'decisions']), 'Before release: timeline and deck stay out');
ok(!/Action timeline|Client presentation/.test(pr[0].text), 'Before release: contents does not mention them');
await p.click('.cmo [data-tpl=full]').catch(() => {}); await p.waitForTimeout(600);
await p.screenshot({ path: path.join(out, 'screen_full_before_release.png') });

ok(errors.length === 0, `No page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await b.close();
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
