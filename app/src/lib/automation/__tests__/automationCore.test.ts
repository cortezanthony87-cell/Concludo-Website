// Automation core v2 tests. Run: npx tsx automationCore.test.ts
import assert from 'node:assert/strict';
import {
  MemoryStore, planFromDescription, validateWorkflow, ensureApprovals, runWorkflow, decideApproval, setActive,
  stopEverything, releaseStop, retryRun, health, expireStaleApprovals, resolveIncident, workflowFromTemplate,
  newStep, GovernanceBlock, QUARANTINE_AFTER, Workflow, RunInput, TEMPLATES, explainWorkflow,
} from '../automationCore';

let passed = 0;
const tests: Array<[string, () => Promise<void>]> = [];
const t = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

let clockMs = Date.parse('2026-10-27T09:00:00Z');
const clock = () => new Date(clockMs).toISOString();
const fresh = (conn: Record<string, string> = { outlook: 'connected', slack: 'connected', google_calendar: 'connected', hubspot: 'connected' }) =>
  new MemoryStore({ connections: conn as never, clock });

const MEETING: RunInput = {
  meeting: { title: 'CRM cutover leadership meeting', date: '27 October 2026', attendees: ['Mara Ellis', 'Tom Nguyen'], summary: 'Cutover set for 16 November.' },
  decisions: [{ statement: 'We cut over on Monday 16 November' }],
  actions: [{ title: 'Run two training sessions', owner: 'Tom Nguyen', due: '2026-11-09' }, { title: 'Shadow Priya on old system admin', owner: null, due: '2026-11-16' }],
  risks: [{ text: 'Consent flags could be lost in export', rating: 'high' }],
  event: { today: '2026-10-27' },
};

async function liveWorkflow(store: MemoryStore, key = 'meeting-follow-through'): Promise<Workflow> {
  const wf = workflowFromTemplate(store, key, 'Mara Ellis');
  await store.saveWorkflow(wf);
  await setActive(store, wf.id, true, 'Mara Ellis');
  return (await store.getWorkflow(wf.id))!;
}

/* ---- builder ---- */
t('Plain English becomes a guarded workflow', async () => {
  const s = fresh();
  const p = planFromDescription('After each meeting, summarise it, add the actions to the tracker, then email the attendees', s, 'me');
  assert.equal(p.status, 'complete');
  assert.equal(p.workflow.trigger.type, 'meeting_completed');
  assert.deepEqual(p.workflow.steps.map((x) => x.action), ['summarise_meeting', 'create_actions', 'ask_approval', 'send_email']);
  assert.equal(p.workflow.steps[2].autoAdded, true, 'approval inserted by Concludo, before the email');
  assert.deepEqual(p.addedApprovals, ['Send an email']);
});

t('Unclear words are reported, not guessed', async () => {
  const p = planFromDescription('Every Monday build a report and fax the landlord', fresh(), 'me');
  assert.equal(p.status, 'needs_clarification');
  assert.ok(p.unclear.some((u) => /fax/.test(u)));
  assert.equal(p.workflow.trigger.schedule, 'Every Monday');
});

t('Validation blocks external steps without approval and unconnected apps', async () => {
  const s = fresh({ outlook: 'needs_reauth' });
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'me');
  wf.steps = wf.steps.filter((x) => x.action !== 'ask_approval');
  const issues = await validateWorkflow(wf, s);
  assert.ok(issues.some((i) => i.level === 'block' && i.fix === 'add_approval'));
  assert.ok(issues.some((i) => i.level === 'block' && /Outlook needs signing in again/.test(i.text)));
  const fixed = ensureApprovals(wf, s).workflow;
  assert.equal(fixed.steps.filter((x) => x.action === 'ask_approval').length, 1);
});

t('Workflows that score or monitor people are refused', async () => {
  const s = fresh();
  const wf = workflowFromTemplate(s, 'weekly-project-status-review', 'me');
  wf.name = 'Rank team members by productivity';
  const issues = await validateWorkflow(wf, s);
  assert.ok(issues.some((i) => /measures work, never people/.test(i.text)));
  await s.saveWorkflow(wf);
  await assert.rejects(setActive(s, wf.id, true, 'me'), GovernanceBlock);
});

t('Every template validates clean when its apps are connected', async () => {
  const s = fresh();
  for (const tpl of TEMPLATES) {
    const wf = workflowFromTemplate(s, tpl.key, 'me');
    const blocks = (await validateWorkflow(wf, s)).filter((i) => i.level === 'block');
    assert.deepEqual(blocks, [], `${tpl.key}: ${blocks.map((b) => b.text).join('; ')}`);
    assert.ok(explainWorkflow(wf).length === wf.steps.length + 1);
  }
});

/* ---- runs and approvals, wired together ---- */
t('A live run stops at approval and lists exactly what will be sent, from the input', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'Mara Ellis' });
  assert.equal(run.status, 'requires_approval');
  const ap = (await s.getApproval(run.approvalId!))!;
  assert.equal(ap.status, 'pending');
  assert.equal(ap.outgoing.length, 1);
  assert.match(ap.outgoing[0].preview, /Run two training sessions: Tom Nguyen, by 9 November 2026/);
  assert.match(ap.outgoing[0].preview, /Shadow Priya on old system admin: owner not named/);
  assert.equal(s.outbox.length, 0, 'nothing sent before approval');
});

t('Empty input never produces invented people or messages', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s, 'calendar-deadline-creation');
  const run = await runWorkflow(s, wf.id, { input: {}, actor: 'me' });
  assert.equal(run.status, 'completed');
  assert.match(run.steps.find((x) => x.label === 'Only continue if…')!.note, /Condition not met/);
  assert.equal((await s.listApprovals()).length, 0);
  const all = JSON.stringify([await s.listRuns(), await s.listApprovals()]);
  assert.ok(!/Alex Mercer|Sarah Jenkins|LinkedIn|INV-\d/.test(all));
});

t('Approve resumes the same run and dispatches; a second approve changes nothing', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'Mara Ellis' });
  const res = await decideApproval(s, run.approvalId!, 'approve', 'Mara Ellis');
  assert.equal(res.run!.status, 'completed');
  assert.equal(res.run!.id, run.id);
  assert.equal(s.outbox.length, 1);
  await assert.rejects(decideApproval(s, run.approvalId!, 'approve', 'Tom Nguyen'), /Already approved by Mara Ellis/);
  assert.equal(s.outbox.length, 1, 'no double send');
});

t('Reject needs a reason, stops the run and skips the rest', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me' });
  await assert.rejects(decideApproval(s, run.approvalId!, 'reject', 'me', ' '), /Say why/);
  const res = await decideApproval(s, run.approvalId!, 'reject', 'me', 'Wrong attendee list');
  assert.equal(res.run!.status, 'rejected');
  assert.equal(res.run!.steps.at(-1)!.status, 'skipped');
  assert.equal(s.outbox.length, 0);
});

t('A failed dispatch fails the run instead of claiming completion', async () => {
  const s = fresh();
  s.dispatchImpl = async () => ({ ok: false, note: 'Outlook returned 503. Nothing was sent.' });
  const wf = await liveWorkflow(s);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me' });
  const res = await decideApproval(s, run.approvalId!, 'approve', 'me');
  assert.equal(res.run!.status, 'failed');
  assert.match(res.run!.error!, /503/);
  assert.equal((await s.listIncidents()).length, 1);
});

t('Test runs preview everything and never send or queue approvals', async () => {
  const s = fresh();
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'me');
  await s.saveWorkflow(wf);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me', test: true });
  assert.equal(run.status, 'completed');
  assert.ok(run.steps.some((x) => x.status === 'previewed' && /Test runs never send/.test(x.note)));
  assert.equal((await s.listApprovals()).length, 0);
  assert.equal(s.outbox.length, 0);
});

/* ---- governance, wired into runs and approvals ---- */
t('Pausing blocks new runs and blocks approving, and the approval keeps waiting', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me' });
  await setActive(s, wf.id, false, 'me');
  await assert.rejects(runWorkflow(s, wf.id, { input: MEETING, actor: 'me' }), /paused/);
  await assert.rejects(decideApproval(s, run.approvalId!, 'approve', 'me'), /Resume it before approving/);
  assert.equal((await s.getApproval(run.approvalId!))!.status, 'pending');
  await setActive(s, wf.id, true, 'me');
  assert.equal((await decideApproval(s, run.approvalId!, 'approve', 'me')).run!.status, 'completed');
});

t('The workspace stop pauses everything; release restores only what it paused', async () => {
  const s = fresh();
  const a = await liveWorkflow(s);
  const b = await liveWorkflow(s, 'weekly-project-status-review');
  await setActive(s, b.id, false, 'me');
  assert.equal(await stopEverything(s, 'me', 'Checking a data issue'), 1);
  await assert.rejects(runWorkflow(s, a.id, { input: MEETING, actor: 'me' }), /stopped from the Governance Centre/);
  await assert.rejects(setActive(s, a.id, true, 'me'), /Release the stop/);
  assert.equal((await health(s)).stopped, true);
  assert.equal(await releaseStop(s, 'me'), 1);
  assert.equal((await s.getWorkflow(a.id))!.status, 'active');
  assert.equal((await s.getWorkflow(b.id))!.status, 'paused', 'a workflow you paused stays paused');
});

t(`${QUARANTINE_AFTER} failures in a row quarantine a workflow; success resets the count`, async () => {
  const s = fresh();
  const wf = await liveWorkflow(s, 'weekly-project-status-review');
  wf.steps.unshift(newStep(s, 'summarise_meeting'));
  await s.saveWorkflow(wf);
  for (let i = 0; i < QUARANTINE_AFTER; i++) await runWorkflow(s, wf.id, { input: {}, actor: 'me' }).catch(() => undefined);
  const q = (await s.getWorkflow(wf.id))!;
  assert.equal(q.status, 'paused');
  assert.equal(q.pausedBy, 'quarantine');
  assert.equal((await s.listIncidents()).length, QUARANTINE_AFTER);
  await assert.rejects(runWorkflow(s, wf.id, { input: MEETING, actor: 'me' }), /failed runs in a row/);
  await setActive(s, wf.id, true, 'me');
  const ok = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me' });
  assert.equal(ok.status, 'completed');
  assert.equal((await s.getWorkflow(wf.id))!.consecutiveFailures, 0);
});

t('An app that drops its connection mid-way fails the run with a plain reason', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s, 'high-risk-issue-escalation');
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me' });
  s.connections.slack = 'needs_reauth';
  const res = await decideApproval(s, run.approvalId!, 'approve', 'me');
  assert.equal(res.run!.status, 'failed');
  assert.match(res.run!.error!, /Slack needs signing in again\. Nothing was sent\./);
});

t('Retry starts a new linked run and keeps the failed one', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s, 'weekly-project-status-review');
  wf.steps.unshift(newStep(s, 'summarise_meeting'));
  await s.saveWorkflow(wf);
  const failed = await runWorkflow(s, wf.id, { input: {}, actor: 'me' });
  assert.equal(failed.status, 'failed');
  const again = await retryRun(s, failed.id, 'me');
  assert.equal(again.retryOf, failed.id);
  assert.equal((await s.listRuns()).length, 2);
});

t('Stale approvals expire and cancel their runs', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me' });
  clockMs += 73 * 3600_000;
  assert.equal(await expireStaleApprovals(s, 72), 1);
  assert.equal((await s.getRun(run.id))!.status, 'cancelled');
  clockMs -= 73 * 3600_000;
});

t('Health is counted from records, not fixed', async () => {
  const s = fresh();
  const h0 = await health(s);
  assert.equal(h0.successRate, null, 'no runs means no rate, not 100%');
  const wf = await liveWorkflow(s, 'weekly-project-status-review');
  await runWorkflow(s, wf.id, { input: MEETING, actor: 'me' });
  const m = await liveWorkflow(s);
  await runWorkflow(s, m.id, { input: MEETING, actor: 'me' });
  const h = await health(s);
  assert.deepEqual([h.runs7d, h.completed7d, h.waitingApprovals, h.successRate], [2, 1, 1, 100]);
});

t('Incidents need a resolution note; the audit log names the real actor', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s, 'weekly-project-status-review');
  wf.steps.unshift(newStep(s, 'summarise_meeting'));
  await s.saveWorkflow(wf);
  await runWorkflow(s, wf.id, { input: {}, actor: 'Tom Nguyen' });
  const inc = (await s.listIncidents())[0];
  await assert.rejects(resolveIncident(s, inc.id, 'Tom Nguyen', ''), /Say what fixed it/);
  await resolveIncident(s, inc.id, 'Tom Nguyen', 'Added the meeting to the trigger');
  const log = await s.listAudit();
  assert.ok(log.some((e) => e.event === 'run_failed' && e.actor === 'Tom Nguyen'));
  assert.ok(!log.some((e) => /Anthony Cortez|auth_user_anthony/.test(e.actor)));
});

(async () => {
  for (const [name, fn] of tests) {
    await fn();
    passed++;
    console.log('ok  ', name);
  }
  console.log(`\n${passed} automation core tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
