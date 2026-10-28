// Automation core v2 tests. Run: npx tsx automationCore.test.ts
import assert from 'node:assert/strict';
import {
  MemoryStore, planFromDescription, validateWorkflow, ensureApprovals, runWorkflow, decideApproval, setActive,
  stopEverything, releaseStop, retryRun, health, expireStaleApprovals, resolveIncident, workflowFromTemplate,
  newStep, GovernanceBlock, QUARANTINE_AFTER, Workflow, RunInput, TEMPLATES, explainWorkflow,
  stepFromStored, stepsFromStored, triggerFromStored, pickStoredSteps, ACTIONS,
  checkConnection, checkAllConnections, repairConnection, applyAlternative, blankWorkflow,
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

t('Older workflow steps are drawn and never crash the builder', async () => {
  const summary = stepFromStored({ type: 'generate_summary', config: {} }, 0, 's1');
  assert.equal(summary.action, 'summarise_meeting');
  assert.equal(summary.app, 'concludo');
  const planner = stepFromStored({ type: 'create_planner_task', config: {} }, 1, 's2');
  assert.equal(planner.action, 'unsupported');
  assert.equal(planner.settings.legacyType, 'create_planner_task');
  const unknownApp = stepFromStored({ action: 'send_email', app: 'youtube', settings: { to: 'me', subject: 'Hi' } }, 2, 's3');
  assert.equal(unknownApp.action, 'unsupported');
  const missingApp = stepFromStored({ action: 'send_email', settings: { to: 'attendees', subject: 'Hi' } }, 3, 's4');
  assert.equal(missingApp.action, 'send_email');
  assert.equal(missingApp.app, 'outlook');
  const steps = stepsFromStored([
    { type: 'generate_summary', config: {} },
    { type: 'create_planner_task', config: {} },
    { action: 'post_message', app: 'not_an_app', settings: {} },
  ], (i) => `legacy-${i}`);
  const s = fresh();
  const wf: Workflow = {
    id: 'legacy', name: 'Saved follow-up', description: 'Older record', ownerId: 'me', status: 'paused',
    trigger: triggerFromStored('project_updated', {}),
    steps, consecutiveFailures: 0, createdAt: s.now(), updatedAt: s.now(),
  };
  const issues = await validateWorkflow(wf, s);
  assert.ok(issues.some((i) => /older step/i.test(i.text)));
  assert.ok(issues.some((i) => /older trigger/i.test(i.text)));
  const lines = explainWorkflow(wf);
  assert.ok(lines[0].toLowerCase().includes('older trigger'));
  assert.ok(lines.some((l) => /create planner task/i.test(l)));
  await s.saveWorkflow(wf);
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'me', test: true });
  assert.equal(run.status, 'failed');
  assert.match(run.error || '', /older step/i);
  assert.equal(s.outbox.length, 0);
  const picked = pickStoredSteps({
    actions: [{ id: 'a', action: 'notify_me', app: 'concludo', label: 'Notify me in Concludo', settings: {} }],
    definition_json: { steps: [{ type: 'create_notion_page', config: {} }] },
  });
  assert.equal((picked[0] as { action: string }).action, 'notify_me');
  assert.equal(ACTIONS.unsupported.hidden, true);
});


/* ---------- honest connections and the repair agent ---------- */
const dashes = /[\u2013\u2014]/;

t('a live check never calls an app connected unless it confirmed it', async () => {
  const s = fresh({ outlook: 'connected' });
  s.probe = async () => ({ state: 'connected', verified: false, detail: 'Could not reach the app.' });
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  const issues = await validateWorkflow(wf, s);
  assert.ok(issues.some((i) => i.fix === 'connect' && /Outlook/.test(i.text)), 'unverified connected blocks');
  s.probe = async () => { throw new Error('timeout'); };
  const c = await checkConnection(s, 'outlook');
  assert.equal(c.verified, false);
  assert.equal(c.state, 'service_issue');
});

t('a saved record is reported as unverified, not as a live check', async () => {
  const s = fresh();
  const recordOnly = { now: () => s.now(), connection: (a: never) => s.connection(a) };
  const c = await checkConnection(recordOnly as never, 'outlook');
  assert.equal(c.state, 'connected');
  assert.equal(c.verified, false);
  assert.match(c.detail, /not been checked/);
});

t('checking all apps lists every outside app and nothing else', async () => {
  const s = fresh({ outlook: 'connected', slack: 'needs_reauth' });
  const all = await checkAllConnections(s);
  assert.equal(all.length, 8);
  assert.ok(!all.some((c) => c.app === 'concludo'));
  assert.equal(all.find((c) => c.app === 'slack')!.state, 'needs_reauth');
  assert.equal(all.find((c) => c.app === 'gmail')!.state, 'disconnected');
  assert.ok(all.every((c) => c.simulated && c.verified));
});

t('repair: a service problem that recovers is fixed only after a check confirms it', async () => {
  const s = fresh({ outlook: 'service_issue' });
  s.recoversAfter.outlook = 3;
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  const r = await repairConnection(s, wf, 'outlook', 'Mara Ellis');
  assert.equal(r.outcome, 'fixed');
  assert.ok(r.steps.length >= 3);
  assert.equal(await s.connection('outlook'), 'connected');
  assert.ok((await s.listAudit()).some((e) => e.event === 'connection_repair' && e.actor === 'Mara Ellis'));
});

t('repair: a service problem that does not recover is reported as unfixed', async () => {
  const s = fresh({ outlook: 'service_issue' });
  s.recoversAfter.outlook = 99;
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  const r = await repairConnection(s, wf, 'outlook', 'Mara Ellis', { retries: 2 });
  assert.equal(r.outcome, 'unfixable');
  assert.match(r.summary, /Nothing was changed/);
});

t('repair: a lapsed sign-in needs a person, and the agent says so', async () => {
  const s = fresh({ outlook: 'needs_reauth', gmail: 'connected' });
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  const r = await repairConnection(s, wf, 'outlook', 'Mara Ellis');
  assert.equal(r.outcome, 'needs_person');
  assert.match(r.summary, /person to sign in/);
  assert.ok(r.alternatives.some((a) => a.app === 'gmail'), 'offers the connected alternative');
  assert.equal(await s.connection('outlook'), 'needs_reauth', 'nothing was changed on its own');
  s.completeSignIn('outlook');
  const again = await repairConnection(s, wf, 'outlook', 'Mara Ellis');
  assert.equal(again.outcome, 'fixed');
});

t('repair: a saved record that cannot be checked is not called fixed', async () => {
  const s = fresh({ outlook: 'connected' });
  s.probe = async () => ({ state: 'connected', verified: false, detail: 'No answer.' });
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  const r = await repairConnection(s, wf, 'outlook', 'Mara Ellis', { retries: 0 });
  assert.equal(r.outcome, 'unverified');
});

t('alternative: swapping the app changes only that step, then the workflow can be turned on', async () => {
  const s = fresh({ outlook: 'needs_reauth', gmail: 'connected' });
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  await s.saveWorkflow(wf);
  const email = wf.steps.find((x) => x.action === 'send_email')!;
  assert.ok((await validateWorkflow(wf, s)).some((i) => i.fix === 'connect'));
  await applyAlternative(s, wf, email.id, 'gmail', 'Mara Ellis');
  const saved = (await s.getWorkflow(wf.id))!;
  assert.equal(saved.steps.find((x) => x.id === email.id)!.app, 'gmail');
  assert.equal(saved.steps.length, wf.steps.length);
  assert.equal((await validateWorkflow(saved, s)).filter((i) => i.level === 'block').length, 0);
  await assert.rejects(applyAlternative(s, saved, email.id, 'hubspot', 'Mara Ellis'), /cannot do/);
});

t('a live run fails honestly when the live check finds the app down', async () => {
  const s = fresh();
  const wf = await liveWorkflow(s, 'high-risk-issue-escalation');
  const run = await runWorkflow(s, wf.id, { input: MEETING, actor: 'Mara Ellis' });
  s.connections.slack = 'service_issue';
  s.recoversAfter.slack = 50;
  const a = (await s.listApprovals()).find((x) => x.runId === run.id)!;
  await decideApproval(s, a.id, 'approve', 'Mara Ellis');
  const after = (await s.getRun(run.id))!;
  assert.equal(after.status, 'failed');
  assert.equal(s.outbox.length, 0);
});

t('manual building starts blank, cannot be turned on empty, and keeps the approval rule', async () => {
  const s = fresh();
  const wf = blankWorkflow(s, 'Mara Ellis', { type: 'workflow_schedule', schedule: 'Every Friday' }, 'My own workflow');
  assert.equal(wf.steps.length, 0);
  assert.ok((await validateWorkflow(wf, s)).some((i) => /at least one step/.test(i.text)));
  wf.steps.push(newStep(s, 'send_email', 'outlook', { to: 'me', subject: 'Hello' }));
  const g = ensureApprovals(wf, s);
  assert.equal(g.added.length, 1);
  assert.equal(g.workflow.steps[0].action, 'ask_approval');
});

t('repair text has no dashes', async () => {
  const s = fresh({ outlook: 'needs_reauth' });
  const wf = workflowFromTemplate(s, 'meeting-follow-through', 'Mara Ellis');
  const r = await repairConnection(s, wf, 'outlook', 'Mara Ellis');
  assert.ok(!dashes.test(JSON.stringify(r)));
});

(async () => {
  for (const [name, fn] of tests) {
    await fn();
    passed++;
    console.log('ok  ', name);
  }
  console.log(`\n${passed} automation core tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
