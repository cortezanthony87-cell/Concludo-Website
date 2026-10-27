/**
 * Fictional sample workspace for the studio preview and tests. Kestrel Bay Property Group does not exist.
 * Dates are relative to "today" so overdue items stay overdue whenever the preview is opened.
 * The seed builds history by calling the real engine: every run, approval and incident is engine output.
 */
import { MemoryStore, workflowFromTemplate, setActive, runWorkflow, decideApproval, RunInput, Store } from '../automationCore';
import { attachAgents } from '../agentsCore';
import type { WorkspaceData } from '../agentsCore';

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function sampleWorkspace(today: string): WorkspaceData {
  const d = (n: number) => addDays(today, n);
  return {
    today,
    me: 'Mara Ellis',
    meetings: [
      { id: 'm1', title: 'Leadership meeting: CRM cutover and Q4 listings', date: d(0), project: 'CRM cutover', attendees: ['Mara Ellis', 'Tom Nguyen', 'Priya Shah', 'Jack Moretti', 'Lena Osei'], summary: 'Cutover to the new CRM is set for 16 November. Portal advertising increase is conditional on finance sign-off.', decisionIds: ['d1', 'd2'], actionIds: ['a1', 'a2', 'a3', 'a4', 'a9'], riskIds: ['r1', 'r2'], consent: 'all_agreed' },
      { id: 'm4', title: 'Campaign meeting: 12 Wren Street', date: d(-2), project: 'Wren Street campaign', attendees: ['Lena Osei', 'Tom Nguyen'], summary: 'First open home moved to Saturday. Photography still to be confirmed with the vendors.', decisionIds: ['d5'], actionIds: ['a10', 'a11', 'a12', 'a13', 'a14'], riskIds: ['r4'], consent: 'all_agreed', client: 'Calloway family', listing: '12 Wren Street, Kestrel Bay (fictional)', vendor: 'Ruth Calloway' },
      { id: 'm3', title: 'Q4 marketing planning', date: d(-9), project: 'Q4 listings campaign', attendees: ['Lena Osei', 'Tom Nguyen'], decisionIds: ['d4'], actionIds: ['a7', 'a8'], riskIds: [], consent: 'notice_given' },
      { id: 'm2', title: 'Property management weekly', date: d(-16), project: 'Rent roll clean-up', attendees: ['Jack Moretti', 'Priya Shah'], decisionIds: ['d3'], actionIds: ['a5', 'a6'], riskIds: ['r3'] },
    ],
    upcoming: [
      { id: 'u1', title: 'Leadership meeting: cutover readiness', date: d(6), project: 'CRM cutover', attendees: ['Mara Ellis', 'Tom Nguyen', 'Priya Shah', 'Jack Moretti', 'Lena Osei'] },
    ],
    actions: [
      { id: 'a1', action_title: 'Run two sales training sessions', owner_name: 'Tom Nguyen', due_date: d(13), status: 'not_started', project: 'CRM cutover' },
      { id: 'a2', action_title: 'Reconcile consent fields on the full export', owner_name: 'Priya Shah', due_date: d(3), status: 'in_progress', project: 'CRM cutover' },
      { id: 'a3', action_title: 'Shadow Priya on old system admin', owner_name: null, due_date: d(20), status: 'not_started', project: 'CRM cutover' },
      { id: 'a4', action_title: 'Get a quote for read-only access to the old system', owner_name: 'Priya Shah', due_date: null, status: 'not_started', project: 'CRM cutover' },
      { id: 'a5', action_title: 'Audit tenancy records for missing bond numbers', owner_name: 'Jack Moretti', due_date: d(-6), status: 'in_progress', project: 'Rent roll clean-up' },
      { id: 'a6', action_title: 'Confirm maintenance contractor list', owner_name: 'Jack Moretti', due_date: d(-2), status: 'blocked', project: 'Rent roll clean-up' },
      { id: 'a7', action_title: 'Draft spring vendor newsletter', owner_name: 'Lena Osei', due_date: d(-1), status: 'not_started', project: 'Q4 listings campaign' },
      { id: 'a8', action_title: 'Book photographer for November listings', owner_name: 'Lena Osei', due_date: d(-8), status: 'completed', project: 'Q4 listings campaign', completed_on: d(-8) },
      { id: 'a9', action_title: 'Draft the spring vendor newsletter', owner_name: null, due_date: null, status: 'not_started', project: 'Q4 listings campaign' },
      { id: 'a10', action_title: 'Send the Calloways the revised campaign schedule', owner_name: 'Lena Osei', due_date: d(-1), status: 'in_progress', project: 'Wren Street campaign', owedTo: 'Calloway family' },
      { id: 'a11', action_title: 'Confirm the photography date with the Calloways', owner_name: 'Tom Nguyen', due_date: d(2), status: 'not_started', project: 'Wren Street campaign', owedTo: 'Calloway family' },
      { id: 'a12', action_title: 'Send the comparable sales summary', owner_name: 'Lena Osei', due_date: d(-3), status: 'completed', project: 'Wren Street campaign', owedTo: 'Calloway family', completed_on: d(-3) },
      { id: 'a13', action_title: 'Order the signboard', owner_name: 'Tom Nguyen', due_date: d(-1), status: 'completed', project: 'Wren Street campaign', completed_on: d(-1) },
      { id: 'a14', action_title: 'Book the copywriter for the listing description', owner_name: null, due_date: null, status: 'not_started', project: 'Wren Street campaign' },
    ],
    decisions: [
      { id: 'd1', decision_title: 'Cut over to the new CRM on Monday 16 November', decision_date: d(0), project: 'CRM cutover' },
      { id: 'd2', decision_title: 'Approve the extra $8,500 for portal advertising', decision_date: d(0), project: 'Q4 listings campaign', conditional: true },
      { id: 'd3', decision_title: 'Move maintenance requests to one shared inbox', decision_date: d(-16), project: 'Rent roll clean-up' },
      { id: 'd4', decision_title: 'Run the spring campaign across portals and email only', decision_date: d(-9), project: 'Q4 listings campaign' },
      { id: 'd5', decision_title: 'Move the first open home to Saturday at 10am', decision_date: d(-2), project: 'Wren Street campaign' },
    ],
    risks: [
      { id: 'r1', text: 'If the export drops the marketing consent field, opted-out contacts could be emailed', rating: 'high', response: 'A2: consent field reconciliation (Priya Shah)', project: 'CRM cutover' },
      { id: 'r2', text: 'Only one person knows the old system admin, so nobody could roll back in cutover week', rating: 'high', response: null, project: 'CRM cutover' },
      { id: 'r3', text: 'Missing bond numbers could delay tenancy reconciliation', rating: 'medium', response: null, project: 'Rent roll clean-up' },
      { id: 'r4', text: 'If photography slips, the listing goes live after the long weekend', rating: 'medium', response: null, project: 'Wren Street campaign' },
    ],
  };
}

/** The latest meeting as a workflow run input, built from the workspace records. */
export function meetingInput(ws: WorkspaceData, meetingId = 'm1'): RunInput {
  const m = ws.meetings.find((x) => x.id === meetingId)!;
  return {
    meeting: { id: m.id, title: m.title, date: m.date, attendees: m.attendees, summary: m.summary, consent: m.consent && m.consent !== 'not_recorded' ? 'recorded' : 'not_recorded' },
    decisions: ws.decisions.filter((d) => m.decisionIds.includes(d.id)).map((d) => ({ id: d.id, statement: d.decision_title })),
    actions: ws.actions.filter((a) => m.actionIds.includes(a.id)).map((a) => ({ id: a.id, title: a.action_title, owner: a.owner_name, due: a.due_date, status: a.status })),
    risks: ws.risks.filter((r) => m.riskIds.includes(r.id)).map((r) => ({ id: r.id, text: r.text, rating: r.rating })),
    event: { today: ws.today },
  };
}

/** Open work across the workspace, for scheduled workflows. */
export function scheduleInput(ws: WorkspaceData): RunInput {
  return {
    actions: ws.actions.map((a) => ({ id: a.id, title: a.action_title, owner: a.owner_name, due: a.due_date, status: a.status })),
    decisions: ws.decisions.map((d) => ({ id: d.id, statement: d.decision_title })),
    risks: ws.risks.map((r) => ({ id: r.id, text: r.text, rating: r.rating })),
    event: { today: ws.today },
  };
}

/** A small, believable history, made by running the engine. */
export async function seedStore(store: MemoryStore, ws: WorkspaceData, owner = 'Mara Ellis'): Promise<void> {
  store.connections = { concludo: 'connected', outlook: 'connected', google_calendar: 'connected', microsoft_todo: 'connected', slack: 'connected', hubspot: 'disconnected', gmail: 'disconnected', teams: 'disconnected', google_sheets: 'disconnected' };
  const add = async (key: string, on: boolean) => { const wf = workflowFromTemplate(store, key, owner); await store.saveWorkflow(wf); if (on) await setActive(store, wf.id, true, owner); return wf; };
  attachAgents(store, () => ws, () => owner);
  const vendor = await add('weekly-vendor-update', true);
  await runWorkflow(store, vendor.id, { input: scheduleInput(ws), actor: owner });
  const status = await add('weekly-project-status-review', true);
  await runWorkflow(store, status.id, { input: scheduleInput(ws), actor: owner });
  const escalate = await add('high-risk-issue-escalation', true);
  const esc = await runWorkflow(store, escalate.id, { input: meetingInput(ws), actor: owner });
  // Slack's sign-in expires after the run was queued: approving it fails honestly and opens an incident.
  (store as Store as MemoryStore).connections.slack = 'needs_reauth';
  await decideApproval(store, esc.approvalId!, 'approve', owner);
  const deadlines = await add('calendar-deadline-creation', true);
  const dl = await runWorkflow(store, deadlines.id, { input: meetingInput(ws), actor: owner });
  await decideApproval(store, dl.approvalId!, 'approve', owner);
  const follow = await add('meeting-follow-through', true);
  await runWorkflow(store, follow.id, { input: meetingInput(ws), actor: owner });
  const chase = await add('overdue-action-chase', true);
  await runWorkflow(store, chase.id, { input: scheduleInput(ws), actor: owner });
  await add('crm-meeting-note', false);
}
