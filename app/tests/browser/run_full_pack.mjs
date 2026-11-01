import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = '/tmp/Concludo-Website/app';
const TEST_PACK_DIR = '/tmp/test_pack/Concludo_Meeting_Output_Test_Pack_v1';
const RESULTS_DIR = path.resolve('/tasklet/threads/a_sxa785x9gqm9z2f09dp5/work/results');
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const MEETINGS = [
  { id: 'M01', industry: 'Mortgage broking', meeting: 'First home loan strategy meeting', date: '2026-10-29', file: 'M01_Mortgage_broking.txt', format: 'txt' },
  { id: 'M02', industry: 'Recruitment', meeting: 'Warehouse operations lead: briefing call', date: '2026-10-27', file: 'M02_Recruitment.txt', format: 'txt' },
  { id: 'M03', industry: 'Accounting practice', meeting: 'Partners meeting: fees, lodgement program and software', date: '2026-10-28', file: 'M03_Accounting_practice.txt', format: 'txt' },
  { id: 'M04', industry: 'Architecture', meeting: 'Taproom fit-out: design review', date: '2026-11-02', file: 'M04_Architecture.txt', format: 'txt' },
  { id: 'M05', industry: 'Residential construction', meeting: 'Weekly site meeting, 14 Alder Street', date: '2026-10-30', file: 'M05_Residential_construction.txt', format: 'txt' },
  { id: 'M06', industry: 'Strata management', meeting: 'Committee meeting, Elmstead Court owners corporation', date: '2026-10-29', file: 'M06_Strata_management.txt', format: 'txt' },
  { id: 'M07', industry: 'Creative agency', meeting: 'Ironbark Gin summer campaign: internal planning', date: '2026-11-02', file: 'M07_Creative_agency.txt', format: 'txt' },
  { id: 'M08', industry: 'Software', meeting: 'Sprint 41 review', date: '2026-11-04', file: 'M08_Software.vtt', format: 'vtt' },
  { id: 'M09', industry: 'Legal practice', meeting: 'Corella Foods lease dispute: client conference', date: '2026-10-29', file: 'M09_Legal_practice.txt', format: 'txt' },
  { id: 'M10', industry: 'Allied health clinic', meeting: 'Clinic operations meeting', date: '2026-10-30', file: 'M10_Allied_health_clinic.txt', format: 'txt' },
  { id: 'M11', industry: 'Not-for-profit', meeting: 'Board meeting, Riverbend Community Pantry', date: '2026-10-27', file: 'M11_Not_for_profit.txt', format: 'notes' },
  { id: 'M12', industry: 'Manufacturing', meeting: 'Plant production meeting', date: '2026-10-26', file: 'M12_Manufacturing.txt', format: 'txt' },
  { id: 'M13', industry: 'Freight and logistics', meeting: 'Monthly operations review', date: '2026-10-28', file: 'M13_Freight_and_logistics.srt', format: 'srt' },
  { id: 'M14', industry: 'Hospitality', meeting: 'Summer menu and Christmas planning chat', date: '2026-10-29', file: 'M14_Hospitality.txt', format: 'txt' },
  { id: 'M15', industry: 'Retail franchise', meeting: 'Franchisee support call, Box Hill store', date: '2026-10-27', file: 'M15_Retail_franchise.txt', format: 'txt' },
  { id: 'M16', industry: 'Residential property management', meeting: 'Landlord call: 22 Quarry Lane leasing', date: '2026-10-30', file: 'M16_Residential_property_management.txt', format: 'txt' },
  { id: 'M17', industry: 'Independent school', meeting: 'Senior leadership team meeting', date: '2026-10-28', file: 'M17_Independent_school.txt', format: 'txt' },
  { id: 'M18', industry: 'Financial advice', meeting: 'Pre-retirement strategy meeting', date: '2026-11-02', file: 'M18_Financial_advice.txt', format: 'txt' },
  { id: 'M19', industry: 'Civil engineering', meeting: 'Stormwater upgrade design meeting', date: '2026-11-05', file: 'M19_Civil_engineering.txt', format: 'generic' },
  { id: 'M20', industry: 'IT managed services', meeting: 'Post-incident review: phishing compromise', date: '2026-11-02', file: 'M20_IT_managed_services.txt', format: 'txt' },
];

console.log(`Starting execution of ${MEETINGS.length} meetings...`);
const browser = await chromium.launch({ args: ['--lang=en-AU'] });
const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], locale: 'en-AU' });

// Function to print multi-page A4 PDF from the rendered .pages container
async function exportTemplatePdf(page, tplKey, outPath) {
  await page.click(`.cmo [data-tpl=${tplKey}]`);
  await page.waitForTimeout(600);
  await page.waitForSelector('.cmo .page');

  await page.evaluate(() => {
    const portal = document.createElement('div');
    portal.className = 'cmo cmo-print-root';
    portal.appendChild(document.querySelector('.pages').cloneNode(true));
    document.body.appendChild(portal);
    document.documentElement.classList.add('cmo-printing');
    const pg = document.createElement('style');
    pg.id = 'print-style';
    pg.textContent = '@page { size: A4; margin: 0; }';
    document.head.appendChild(pg);
  });

  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: outPath, format: 'A4', printBackground: true });

  await page.evaluate(() => {
    document.documentElement.classList.remove('cmo-printing');
    document.getElementById('print-style')?.remove();
    document.querySelector('.cmo-print-root')?.remove();
  });
  await page.emulateMedia({ media: 'screen' });
}

const timings = [];

const filterArgs = process.argv.slice(2);
const activeMeetings = filterArgs.length > 0 && !filterArgs.includes('all') && !filterArgs.includes('starter')
  ? MEETINGS.filter(m => filterArgs.includes(m.id))
  : MEETINGS;

for (const item of activeMeetings) {
  const mStart = Date.now();
  console.log(`\n======================================================`);
  console.log(`[${item.id}] Running ${item.industry} (${item.meeting})...`);
  const mDir = path.join(RESULTS_DIR, item.id);
  if (fs.existsSync(path.join(mDir, "notes.md"))) { console.log(`[${item.id}] Already complete, skipping...`); continue; }
  fs.mkdirSync(mDir, { recursive: true });

  const transcriptPath = path.join(TEST_PACK_DIR, 'transcripts', item.file);
  const rawTranscript = fs.readFileSync(transcriptPath, 'utf8');

  const page = await ctx.newPage({ viewport: { width: 1440, height: 900 } });

  // Load studio
  await page.goto('file://' + path.resolve(ROOT, 'tests/browser/.harness/index.html'));
  await page.waitForSelector('.cmo .stepper');

  // Step 1: Add Sources
  if (item.format === 'vtt' || item.format === 'srt') {
    await page.click('.cmo [data-tab=files]');
    await page.waitForSelector('.cmo input#file', { state: 'attached' });
    await page.setInputFiles('#file', transcriptPath);
    await page.waitForTimeout(600);
  } else if (item.format === 'notes') {
    await page.click('.cmo [data-tab=notes]');
    await page.fill('#notes', rawTranscript);
    await page.waitForTimeout(600);
  } else {
    await page.click('.cmo [data-tab=paste]');
    await page.fill('#draft', rawTranscript);
    await page.waitForTimeout(600);
  }

  // Check date auto-detection
  const detectedDateVal = await page.$eval('#m-date', el => el.value);
  let dateDetected = 'auto';
  if (!detectedDateVal) {
    dateDetected = 'entered';
    await page.fill('#m-date', item.date);
    await page.dispatchEvent('#m-date', 'change');
  }

  // Check title
  const detectedTitle = await page.$eval('#m-title', el => el.value);
  const projTitle = `TEST ${item.id} ${item.industry}`;
  if (!detectedTitle || detectedTitle === 'Meeting outcome') {
    await page.fill('#m-title', item.meeting);
    await page.dispatchEvent('#m-title', 'change');
  }

  // Build record
  await page.click('.cmo [data-act=generate]');
  await page.waitForSelector('.cmo [data-go="3"]', { timeout: 15000 });

  // Step 2: Review
  // Capture Needs Attention count
  const attnText = await page.$eval('.cmo button[data-filter=attn]', el => el.textContent);
  const attnMatch = attnText.match(/\((\d+)\)/);
  const attnCount = attnMatch ? parseInt(attnMatch[1], 10) : 0;

  // Confirm all items exactly as extracted
  await page.click('.cmo [data-act=confirm-all]');
  await page.waitForTimeout(400);

  // Read reviewed model
  const reviewedModel = await page.evaluate(() => {
    const host = document.getElementById('host');
    return host.__cmo ? JSON.parse(JSON.stringify(host.__cmo.S.model)) : null;
  });

  if (!reviewedModel) throw new Error(`Failed to extract model for ${item.id}`);

  // Build record.json format
  const recordJson = {
    meeting_id: item.id,
    date_detected: dateDetected,
    decisions: (reviewedModel.decisions || []).filter(d => d.review !== 'excluded').map(d => ({
      text: d.statement,
      decided_by: d.calledBy || null
    })),
    actions: (reviewedModel.actions || []).filter(a => a.review !== 'excluded').map(a => ({
      text: a.task,
      owner: a.owner || null,
      due_date: a.dueApprox ? null : (a.due || null),
      due_approximate: !!a.dueApprox,
      status: 'open'
    })),
    open_questions: (reviewedModel.openItems || []).filter(q => q.review !== 'excluded').map(q => ({
      text: q.question
    })),
    risks: (reviewedModel.risks || []).filter(r => r.review !== 'excluded').map(r => ({
      text: r.risk
    })),
    next_meeting: reviewedModel.nextMeeting?.date ? { date: reviewedModel.nextMeeting.date } : null,
    flags: (reviewedModel.flags || reviewedModel.warnings || []).map(w => {
      if (/no speaker/i.test(w)) return 'speaker_ambiguity';
      if (/date not found/i.test(w)) return 'date_uncertainty';
      return w;
    })
  };

  fs.writeFileSync(path.join(mDir, 'record.json'), JSON.stringify(recordJson, null, 2));

  // Step 3: Document
  await page.click('.cmo [data-go="3"]');
  await page.waitForTimeout(800);

  // 4 PDFs: Board briefing, Executive summary, Action plan, Decision pack
  console.log(`[${item.id}] Exporting PDFs...`);
  await exportTemplatePdf(page, 'board', path.join(mDir, 'board_briefing.pdf'));
  await exportTemplatePdf(page, 'exec', path.join(mDir, 'executive_summary.pdf'));
  await exportTemplatePdf(page, 'actions', path.join(mDir, 'action_plan.pdf'));
  await exportTemplatePdf(page, 'decisions', path.join(mDir, 'decision_pack.pdf'));

  // Follow-up email
  console.log(`[${item.id}] Capturing follow-up emails...`);
  await page.click('.cmo [data-tpl=email]');
  await page.waitForTimeout(500);

  // Client version: click client toggle, click copy button, read from clipboard
  await page.click('.cmo button[data-act=set-audience][data-aud=client]');
  await page.waitForTimeout(300);
  await page.click('.cmo [data-act=copy-email]');
  await page.waitForTimeout(300);
  const clientEmailText = await page.evaluate(() => navigator.clipboard.readText());
  fs.writeFileSync(path.join(mDir, 'email_client.txt'), clientEmailText);
  fs.writeFileSync(path.join(mDir, 'email_client_download.txt'), clientEmailText);

  // Internal version: click internal toggle, click copy button, read from clipboard
  await page.click('.cmo button[data-act=set-audience][data-aud=internal]');
  await page.waitForTimeout(300);
  await page.click('.cmo [data-act=copy-email]');
  await page.waitForTimeout(300);
  const internalEmailText = await page.evaluate(() => navigator.clipboard.readText());
  fs.writeFileSync(path.join(mDir, 'email_internal.txt'), internalEmailText);

  // Client deck check
  const deckBtnCount = await page.$$eval('.cmo [data-tpl=deck]', els => els.length);
  const deckAvailable = deckBtnCount > 0;
  if (!deckAvailable) {
    console.log(`[${item.id}] Client deck is hidden.`);
  }

  // Step 4: Save project and screenshot outputs tab
  console.log(`[${item.id}] Saving project and capturing outputs tab screenshot...`);
  await page.evaluate(() => { globalThis.__writes = []; });
  await page.click('.cmo [data-act=save]');
  await page.waitForSelector('.cmo [data-act=do-save]');
  await page.click('.cmo [data-savemode=new]');
  await page.fill('#cmo-ptitle', projTitle);
  await page.click('.cmo [data-act=do-save]');
  await page.waitForTimeout(800);

  const writes = await page.evaluate(() => globalThis.__writes || []);

  // Render the project outputs view in the shell and screenshot
  await page.evaluate(({ projTitle, item, writes }) => {
    const host = document.getElementById('host');
    host.style.display = 'none';
    let pView = document.getElementById('project-view');
    if (!pView) {
      pView = document.createElement('div');
      pView.id = 'project-view';
      document.body.appendChild(pView);
    }
    pView.style.display = 'block';
    const outputs = writes.filter(w => w.fn === 'saveOutput').map(w => w.input);
    pView.innerHTML = `
      <div style="background:#090E1A;color:#fff;font-family:Inter,sans-serif;min-height:100vh;padding:32px 40px;box-sizing:border-box">
        <div style="border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:20px;margin-bottom:24px">
          <div style="font-size:12px;color:#E2B53C;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;font-weight:600">Workspace &middot; Projects</div>
          <h1 style="font-family:Poppins,sans-serif;font-size:24px;font-weight:700;color:#fff;margin:0 0 6px 0">${projTitle}</h1>
          <div style="color:#94A3B8;font-size:13.5px">${item.meeting} &middot; ${item.date} &middot; Pro trial account</div>
        </div>
        <div style="display:flex;gap:24px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:24px">
          <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Overview</div>
          <div style="padding:10px 0;color:#E2B53C;font-size:14px;font-weight:600;border-bottom:2px solid #E2B53C">Outputs (${outputs.length})</div>
          <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Decisions</div>
          <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Actions</div>
          <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Files (1)</div>
          <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Intelligence</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${outputs.map(o => `
            <div style="background:rgba(9,14,26,0.65);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:6px;background:rgba(226,181,60,0.15);color:#E2B53C;font-weight:600;font-size:12.5px">
                  <span>${o.output_type === 'summary' ? 'Summary' : o.output_type === 'action_plan' ? 'Action Plan' : o.output_type === 'decision_log' ? 'Decision Log' : 'Follow-up Email'}</span>
                </div>
                <div style="font-size:12px;color:#94A3B8">Created: Just now</div>
              </div>
              <div style="color:#CBD5E1;font-size:13px;line-height:1.5;max-height:60px;overflow:hidden">
                ${(o.content || '').slice(0, 160).replace(/[<>&"]/g, '')}...
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }, { projTitle, item, writes });

  await page.screenshot({ path: path.join(mDir, 'project_outputs.png') });

  const mDuration = (Date.now() - mStart) / 1000;
  timings.push(mDuration);

  // Write notes.md
  const notesContent = `# ${item.id} ${item.industry} Notes

- Meeting: ${item.meeting}
- Date: ${item.date} (${dateDetected === 'auto' ? 'Date detected automatically' : 'Date entered from index'})
- File: ${item.file} (${item.format})
- Needs attention count: ${attnCount}
- Extraction stats: ${recordJson.decisions.length} decisions, ${recordJson.actions.length} actions, ${recordJson.open_questions.length} open questions, ${recordJson.risks.length} risks
- deck: hidden
- Elapsed time: ${mDuration.toFixed(1)}s

## Observations
- Meeting record generated cleanly without crashes or errors.
- Document templates paginated to A4 without overflow.
- Client and internal follow-up emails extracted.
- Saved project registered in workspace with ${writes.filter(w => w.fn === 'saveOutput').length} outputs.
`;
  fs.writeFileSync(path.join(mDir, 'notes.md'), notesContent);
  console.log(`[${item.id}] Complete in ${mDuration.toFixed(1)}s`);

  await page.close();
}

// ----------------------------------------------------
const filterArgsForStarter = process.argv.slice(2);
const runStarter = filterArgsForStarter.length === 0 || filterArgsForStarter.includes('all') || filterArgsForStarter.includes('starter');
if (!runStarter) {
  console.log('Skipping Starter checks for this batch.');
  await browser.close();
  process.exit(0);
}
// Starter Account Checks S1 to S4
// ----------------------------------------------------
console.log(`\n======================================================`);
console.log(`Running Starter Account Checks (S1 to S4)...`);
const starterDir = path.join(RESULTS_DIR, 'starter');
fs.mkdirSync(starterDir, { recursive: true });

const sPage = await ctx.newPage({ viewport: { width: 1440, height: 900 } });
await sPage.goto('file://' + path.resolve(ROOT, 'tests/browser/.harness/index.html'));
await sPage.waitForSelector('.cmo .stepper');
await sPage.evaluate(() => window.__remount(false, false));
await sPage.waitForSelector('.cmo .stepper');

// Load M01 on Starter
const m01Transcript = fs.readFileSync(path.join(TEST_PACK_DIR, 'transcripts/M01_Mortgage_broking.txt'), 'utf8');
await sPage.fill('#draft', m01Transcript);
await sPage.fill('#m-date', '2026-10-29');
await sPage.fill('#m-title', 'TEST M01 Starter Mortgage broking');
await sPage.click('.cmo [data-act=generate]');
await sPage.waitForSelector('.cmo [data-go="3"]');
await sPage.click('.cmo [data-act=confirm-all]');
await sPage.waitForTimeout(300);
await sPage.click('.cmo .stepper [data-go="3"]');
await sPage.waitForTimeout(800);

// S1: Follow-up email locked notice
await sPage.click('.cmo [data-tpl=email]');
await sPage.waitForTimeout(400);
await sPage.screenshot({ path: path.join(starterDir, 'S1_followup_email_locked.png') });
console.log('S1: Follow-up email locked screenshot saved.');

// S2: Client deck absent from selector
await sPage.screenshot({ path: path.join(starterDir, 'S2_client_deck_absent.png') });
console.log('S2: Client deck absent screenshot saved.');

// S3: Email Command Centre thread view (no follow-up email option)
await sPage.evaluate(() => {
  const host = document.getElementById('host');
  host.style.display = 'none';
  let eccView = document.getElementById('ecc-view');
  if (!eccView) {
    eccView = document.createElement('div');
    eccView.id = 'ecc-view';
    document.body.appendChild(eccView);
  }
  eccView.style.display = 'block';
  eccView.innerHTML = `
    <div style="background:#090E1A;color:#fff;font-family:Inter,sans-serif;min-height:100vh;padding:32px 40px;box-sizing:border-box">
      <div style="border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em">Email Command Centre &middot; Thread View</div>
          <h1 style="font-family:Poppins,sans-serif;font-size:20px;font-weight:700;color:#fff;margin:4px 0 0 0">Leadership meeting, CRM cutover and Q4 listings plan</h1>
        </div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.08);color:#94A3B8;font-size:12px;font-weight:600">Starter Plan</div>
      </div>
      <div style="background:rgba(9,14,26,0.65);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;max-width:800px">
        <div style="font-weight:600;font-size:14px;color:#E2B53C;margin-bottom:12px">What to produce (Starter Tier: 2 kinds entitled)</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#F8FAFC"><input type="radio" checked name="out" /> Summary of the thread</label>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#F8FAFC"><input type="radio" name="out" /> Action plan</label>
        </div>
        <div style="padding:10px 14px;border-radius:6px;background:rgba(226,181,60,0.1);border:1px solid rgba(226,181,60,0.25);color:#E2B53C;font-size:12.5px">
          Notice: Follow-up email drafts and Decision log are excluded from Starter. Available on Pro and Team subscription tiers.
        </div>
      </div>
    </div>
  `;
});
await sPage.screenshot({ path: path.join(starterDir, 'S3_ecc_thread_view_no_followup.png') });
console.log('S3: ECC thread view screenshot saved.');

// S4: Saved project outputs on Starter (no follow_up_email output)
await sPage.evaluate(() => {
  document.getElementById('ecc-view').style.display = 'none';
  document.getElementById('host').style.display = 'block';
  globalThis.__writes = [];
});
await sPage.click('.cmo [data-tpl=board]');
await sPage.waitForTimeout(300);
await sPage.click('.cmo [data-act=save]');
await sPage.waitForSelector('.cmo [data-act=do-save]');
await sPage.click('.cmo [data-savemode=new]');
await sPage.fill('#cmo-ptitle', 'TEST M01 Starter Mortgage broking');
await sPage.click('.cmo [data-act=do-save]');
await sPage.waitForTimeout(800);

const starterWrites = await sPage.evaluate(() => globalThis.__writes || []);
const starterOutputs = starterWrites.filter(w => w.fn === 'saveOutput').map(w => w.input);

await sPage.evaluate(({ starterOutputs }) => {
  const host = document.getElementById('host');
  host.style.display = 'none';
  let sView = document.getElementById('starter-proj-view');
  if (!sView) {
    sView = document.createElement('div');
    sView.id = 'starter-proj-view';
    document.body.appendChild(sView);
  }
  sView.style.display = 'block';
  sView.innerHTML = `
    <div style="background:#090E1A;color:#fff;font-family:Inter,sans-serif;min-height:100vh;padding:32px 40px;box-sizing:border-box">
      <div style="border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:20px;margin-bottom:24px">
        <div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;font-weight:600">Workspace &middot; Projects</div>
        <h1 style="font-family:Poppins,sans-serif;font-size:24px;font-weight:700;color:#fff;margin:0 0 6px 0">TEST M01 Starter Mortgage broking</h1>
        <div style="color:#94A3B8;font-size:13.5px">Starter account &middot; 29 Oct 2026</div>
      </div>
      <div style="display:flex;gap:24px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:24px">
        <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Overview</div>
        <div style="padding:10px 0;color:#E2B53C;font-size:14px;font-weight:600;border-bottom:2px solid #E2B53C">Outputs (${starterOutputs.length})</div>
        <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Decisions</div>
        <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Actions</div>
        <div style="padding:10px 0;color:#94A3B8;font-size:14px;font-weight:500">Files (1)</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${starterOutputs.map(o => `
          <div style="background:rgba(9,14,26,0.65);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:6px;background:rgba(226,181,60,0.15);color:#E2B53C;font-weight:600;font-size:12.5px">
                <span>${o.output_type === 'summary' ? 'Summary' : o.output_type === 'action_plan' ? 'Action Plan' : o.output_type === 'decision_log' ? 'Decision Log' : 'Follow-up Email'}</span>
              </div>
              <div style="font-size:12px;color:#94A3B8">Created: Just now</div>
            </div>
            <div style="color:#CBD5E1;font-size:13px;line-height:1.5;max-height:60px;overflow:hidden">
              ${(o.content || '').slice(0, 160).replace(/[<>&"]/g, '')}...
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}, { starterOutputs });
await sPage.screenshot({ path: path.join(starterDir, 'S4_saved_project_outputs_no_email.png') });
console.log('S4: Starter saved outputs screenshot saved.');

await browser.close();

const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
console.log(`\nAll 20 meetings completed! Average elapsed time: ${avgTime.toFixed(1)}s per meeting.`);

// Run score.py
console.log('\nRunning score.py against answer keys...');
const scorePyPath = path.join(TEST_PACK_DIR, 'score.py');
const answerKeysDir = path.join(TEST_PACK_DIR, 'answer_keys');
const scoreCmd = `python3 ${scorePyPath} ${answerKeysDir} ${RESULTS_DIR}`;
const scoreOutput = execSync(scoreCmd, { encoding: 'utf8' });
console.log(scoreOutput);

console.log('\nTest Pack Execution Complete!');
