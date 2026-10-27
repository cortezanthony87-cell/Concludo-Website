// Agents v2.1 tests: the six new agents, confirmed fixes, workflow wiring and the consent hold. Run: npx tsx agentsCore.test.ts
import assert from 'node:assert/strict';
import { MemoryStore, workflowFromTemplate, setActive, runWorkflow, retryRun, planFromDescription, validateWorkflow } from '../automationCore';
import { runAgent, applyFix, attachAgents, AGENTS, deckToText, WorkspaceData } from '../agentsCore';
import { sampleWorkspace, meetingInput, scheduleInput } from './sample';

let passed = 0;
const tests: Array<[string, () => Promise<void>]> = [];
const t = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);
const TODAY = '2026-10-27';
const now = `${TODAY}T09:00:00.000Z`;
const ws = () => sampleWorkspace(TODAY);
const EMPTY: WorkspaceData = { today: TODAY, meetings: [], actions: [], decisions: [], risks: [] };
const NEW = ['meeting_prep', 'consent_check', 'record_hygiene', 'client_commitments', 'vendor_campaign_update', 'board_pack'] as const;
const DASH = /[\u2014\u2013]/;

t('All six new agents are registered, marked new, and none is the coaching recap', async () => {
  for (const k of NEW) assert.ok(AGENTS.find((a) => a.key === k && a.isNew), k);
  assert.ok(!AGENTS.some((a) => /coach/i.test(a.key + a.name)));
});

t('Every new agent returns honest output on an empty workspace: no invented people, figures or drafts', async () => {
  for (const k of NEW) {
    const r = await runAgent(k, EMPTY, { now });
    assert.notEqual(r.status, 'done', `${k} should not claim results on empty data`);
    assert.equal(r.drafts.length, k === 'consent_check' ? 1 : 0, `${k} drafts on empty data`);
    assert.ok(!DASH.test(JSON.stringify(r)), `${k} has a dash`);
  }
});

t('Meeting prep: briefs the next meeting from earlier records only, with an agenda', async () => {
  const r = await runAgent('meeting_prep', ws(), { now });
  assert.equal(r.status, 'done');
  assert.match(r.doc!.title, /cutover readiness/);
  assert.ok(r.doc!.sections.some((s) => s.heading === 'Suggested agenda' && s.items.some((i) => /Name an owner: Shadow Priya/.test(i))));
  assert.equal(r.drafts.length, 1);
  const other = await runAgent('meeting_prep', ws(), { now, project: 'Rent roll clean-up' });
  assert.ok(other.doc!.sections.find((s) => s.heading === 'Still open')!.items.every((i) => /bond|contractor/i.test(i)), 'only that project’s actions');
});

t('Consent check: lists the meeting with no basis, offers the fix, never claims legal validity', async () => {
  const r = await runAgent('consent_check', ws(), { now });
  assert.equal(r.fixes!.length, 1);
  assert.match(r.findings[0].title, /Property management weekly/);
  assert.match(r.basis, /does not decide whether consent was legally valid/);
  const after = applyFix(ws(), r.fixes![0], { basis: 'notice_given' });
  const r2 = await runAgent('consent_check', after.data, { now });
  assert.equal(r2.status, 'nothing_found');
});

t('Consent hold: a workflow run from a meeting with no consent stops before any step, no incident, and retry works once recorded', async () => {
  const s = new MemoryStore({ connections: { outlook: 'connected' } });
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  await s.saveWorkflow(wf); await setActive(s, wf.id, true, 'Mara Ellis');
  let data = ws();
  const run = await runWorkflow(s, wf.id, { input: meetingInput(data, 'm2'), actor: 'Mara Ellis' });
  assert.equal(run.status, 'cancelled');
  assert.match(run.error!, /no consent basis/);
  assert.ok(run.steps.every((x) => x.status === 'skipped'));
  assert.equal((await s.listIncidents()).length, 0);
  assert.equal((await s.listApprovals()).length, 0);
  assert.equal((await s.getWorkflow(wf.id))!.consecutiveFailures, 0);
  const fix = (await runAgent('consent_check', data, { now })).fixes![0];
  data = applyFix(data, fix, { basis: 'all_agreed' }).data;
  const again = await retryRun(s, run.id, 'Mara Ellis', meetingInput(data, 'm2'));
  assert.equal(again.status, 'requires_approval');
});

t('Record hygiene: finds the duplicate and gaps, changes nothing until a fix is confirmed', async () => {
  const data = ws();
  const r = await runAgent('record_hygiene', data, { now });
  const merge = r.fixes!.find((f) => f.kind === 'merge_action')!;
  assert.ok(merge, 'duplicate found');
  assert.equal(data.actions.length, 14, 'running the agent changed nothing');
  const merged = applyFix(data, merge, {});
  assert.equal(merged.data.actions.length, 13);
  assert.ok(merged.data.meetings.find((m) => m.id === 'm1')!.actionIds.includes('a7'), 'meeting now points at the kept action');
  const owner = r.fixes!.find((f) => f.kind === 'set_owner')!;
  assert.throws(() => applyFix(data, owner, { owner: '  ' }), /Fill in the value/);
  const set = applyFix(data, owner, { owner: 'Priya Shah' });
  assert.equal(set.data.actions.find((a) => a.id === owner.ref)!.owner_name, 'Priya Shah');
  assert.ok(!/score|rank/i.test(JSON.stringify(r)), 'no people scoring');
});

t('Client commitments: groups promises by client, cites the meeting, drafts one update per client', async () => {
  const r = await runAgent('client_commitments', ws(), { now });
  assert.match(r.headline, /2 open promises across 1 client, 1 past due/);
  assert.ok(r.findings.every((f) => /From Campaign meeting: 12 Wren Street/.test(f.detail)));
  assert.equal(r.drafts.length, 1);
  assert.match(r.drafts[0].to, /Ruth Calloway/);
  const none = await runAgent('client_commitments', { ...ws(), actions: ws().actions.map((a) => ({ ...a, owedTo: null })) }, { now });
  assert.equal(none.status, 'nothing_found');
  assert.ok(none.fixes!.length > 0, 'offers to mark promises');
});

t('Vendor update: drafts per listing, never adds figures, marks what to confirm', async () => {
  const r = await runAgent('vendor_campaign_update', ws(), { now });
  assert.equal(r.drafts.length, 1);
  const body = r.drafts[0].body;
  assert.match(body, /Order the signboard/);
  assert.match(body, /\[TO CONFIRM\] Open home and private inspection numbers/);
  assert.ok(!/\$\d|\d+ (inspections|enquiries|offers)/i.test(body), 'no invented numbers');
  const untagged = await runAgent('vendor_campaign_update', { ...ws(), meetings: ws().meetings.map((m) => ({ ...m, listing: undefined })) }, { now });
  assert.equal(untagged.status, 'needs');
  assert.equal(untagged.fixes![0].kind, 'set_listing');
});

t('Board pack: seven slides, every stat carries its source, period respected', async () => {
  const r = await runAgent('board_pack', ws(), { now });
  assert.equal(r.deck!.length, 7);
  r.deck!.filter((s) => s.stats).forEach((s) => s.stats!.forEach((x) => assert.ok(x.source.length > 5)));
  assert.match(deckToText(r.deck!), /Sources/);
  const week = await runAgent('board_pack', ws(), { now, periodDays: 7 });
  assert.equal(week.deck![1].stats!.find((x) => x.label === 'Meetings')!.value, '2');
});

t('Workflow step "Run an AI agent": drafts go to the Approval Centre, nothing is dispatched, test runs only preview', async () => {
  const s = new MemoryStore();
  const data = ws();
  attachAgents(s, () => data, () => 'Mara Ellis');
  const wf = workflowFromTemplate(s, 'weekly-vendor-update', 'Mara Ellis');
  await s.saveWorkflow(wf); await setActive(s, wf.id, true, 'Mara Ellis');
  const test = await runWorkflow(s, wf.id, { input: scheduleInput(data), actor: 'Mara Ellis', test: true });
  assert.equal(test.steps[0].status, 'previewed');
  assert.equal((await s.listApprovals()).length, 0);
  const live = await runWorkflow(s, wf.id, { input: scheduleInput(data), actor: 'Mara Ellis' });
  assert.equal(live.status, 'completed');
  const aps = await s.listApprovals();
  assert.equal(aps.length, 1);
  assert.equal(aps[0].kind, 'agent_draft');
  assert.equal(s.outbox.length, 0);
});

t('Agent step without agents wired in fails honestly', async () => {
  const s = new MemoryStore();
  const wf = workflowFromTemplate(s, 'weekly-record-hygiene', 'Mara Ellis');
  await s.saveWorkflow(wf); await setActive(s, wf.id, true, 'Mara Ellis');
  const run = await runWorkflow(s, wf.id, { input: {}, actor: 'Mara Ellis' });
  assert.equal(run.status, 'failed');
  assert.match(run.error!, /not connected to workflows/);
});

t('Plain English can ask for agents, and every new template validates clean', async () => {
  const s = new MemoryStore();
  const p = planFromDescription('Every Friday draft the vendor update and the board pack', s, 'me');
  assert.deepEqual(p.workflow.steps.map((x) => x.settings.agent), ['vendor_campaign_update', 'board_pack']);
  assert.equal(p.status, 'complete');
  const q = planFromDescription('Every weekday prepare a brief for my next meeting', s, 'me');
  assert.deepEqual(q.workflow.steps.map((x) => x.settings.agent), ['meeting_prep']);
  for (const key of ['meeting-prep-brief', 'consent-check-on-save', 'weekly-record-hygiene', 'weekly-client-commitments', 'weekly-vendor-update', 'monthly-board-pack']) {
    const wf = workflowFromTemplate(s, key, 'me');
    assert.equal((await validateWorkflow(wf, s)).filter((i) => i.level === 'block').length, 0, key);
  }
});

(async () => {
  for (const [name, fn] of tests) { await fn(); passed++; console.log('ok  ', name); }
  console.log(`\n${passed} agent tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
