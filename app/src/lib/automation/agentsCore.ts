/**
 * Concludo Agents v2. The nine agents from lib/agents/types.ts, rebuilt to work only on records.
 *
 * Fixes against v1 agentRunner.ts:
 *  - Reads action_tracker's real columns (action_title, owner_name), not title/assignee, so actions
 *    are no longer all "untitled" and "unassigned".
 *  - No invented reasons ("Waiting on dependency") and no invented rates ("completionRate" was the
 *    share not overdue). Every finding names the record it came from.
 *  - Document Intelligence and Inbox no longer throw "Unsupported agent type": they say what they need.
 *  - Measure work, never people: findings are about items and projects. Reminders are grouped by
 *    owner so each person gets one note, but no person is counted, scored or ranked.
 */
import type { Store, OutgoingItem, Health, Run } from './automationCore';
import { auDate, health as automationHealth, requestDraftApproval } from './automationCore';

export type AgentKey =
  | 'meeting_followup'
  | 'decision_followup'
  | 'action_accountability'
  | 'project_intelligence'
  | 'risk_monitoring'
  | 'report_generation'
  | 'workflow_coordinator'
  | 'document_intelligence'
  | 'inbox_command_centre'
  | 'meeting_prep'
  | 'consent_check'
  | 'record_hygiene'
  | 'client_commitments'
  | 'vendor_campaign_update'
  | 'board_pack';

export interface AgentDef {
  key: AgentKey;
  name: string;
  line: string;
  watches: string;
  handsYou: string[];
  group: 'Meetings and decisions' | 'Actions and delivery' | 'Clients and campaigns' | 'Trust and oversight' | 'Inputs';
  needs?: { kind: 'connection' | 'input'; text: string };
  draftsNeedApproval: boolean;
  /** Shown on the card until people know the agent. */
  isNew?: boolean;
  /** Who it is mainly for, shown on the card. */
  forWho?: string;
}

export const AGENTS: AgentDef[] = [
  { key: 'meeting_prep', name: 'Meeting prep', line: 'Hands you a one-page brief before you walk in.', watches: 'Earlier meetings, decisions, actions and risks for the same project', handsYou: ['Last decisions with their dates', 'Open actions and unanswered risks', 'A suggested agenda'], group: 'Meetings and decisions', draftsNeedApproval: true, isNew: true, forWho: 'Pro and Team' },
  { key: 'meeting_followup', name: 'Meeting follow-up', line: 'Writes the follow-up you were going to write tonight.', watches: 'Saved meeting records', handsYou: ['Follow-up email draft', 'Open items for the next agenda'], group: 'Meetings and decisions', draftsNeedApproval: true },
  { key: 'decision_followup', name: 'Decision follow-up', line: 'Tells you which decisions have gone quiet.', watches: 'Decision memory', handsYou: ['Decisions with no action after 14 days', 'Decisions waiting on approval'], group: 'Meetings and decisions', draftsNeedApproval: false },
  { key: 'action_accountability', name: 'Action accountability', line: 'Watches deadlines so you do not have to chase.', watches: 'The Action tracker', handsYou: ['Overdue and unowned actions', 'One reminder draft per owner'], group: 'Actions and delivery', draftsNeedApproval: true },
  { key: 'record_hygiene', name: 'Record hygiene', line: 'Finds the gaps that weaken every other output.', watches: 'The Action tracker, Decision memory and risks', handsYou: ['Actions missing an owner or a date', 'Likely duplicates to merge', 'Fixes you confirm in one click'], group: 'Actions and delivery', draftsNeedApproval: false, isNew: true, forWho: 'all tiers' },
  { key: 'project_intelligence', name: 'Project intelligence', line: 'Shows where each project’s open work is piling up.', watches: 'Projects, meetings and actions', handsYou: ['Open and overdue work by project', 'Projects with no meeting for 14 days'], group: 'Actions and delivery', draftsNeedApproval: false },
  { key: 'client_commitments', name: 'Client commitments', line: 'Tracks what you promised each client, separately from internal work.', watches: 'Actions marked as owed to a client', handsYou: ['Promises due this week and past due', 'A where-things-stand draft per client'], group: 'Clients and campaigns', draftsNeedApproval: true, isNew: true, forWho: 'Consultants and coaches' },
  { key: 'vendor_campaign_update', name: 'Vendor campaign update', line: 'Drafts each listing’s weekly vendor update from campaign meetings.', watches: 'Campaign meetings tagged to a listing', handsYou: ['A vendor update draft per listing', 'Anything you must confirm before sending'], group: 'Clients and campaigns', draftsNeedApproval: true, isNew: true, forWho: 'Real estate agencies' },
  { key: 'board_pack', name: 'Board pack', line: 'Builds the steering committee pack, every figure counted from records.', watches: 'Meetings, decisions, actions and risks in a period', handsYou: ['A branded deck outline', 'A one-page executive summary', 'A source list for every figure'], group: 'Clients and campaigns', draftsNeedApproval: true, isNew: true, forWho: 'Pro and Team' },
  { key: 'consent_check', name: 'Consent check', line: 'Holds workflows until a meeting has a consent basis recorded.', watches: 'New meeting records and their consent basis', handsYou: ['Meetings with no consent noted', 'Consent wording for your next invite'], group: 'Trust and oversight', draftsNeedApproval: false, isNew: true, forWho: 'all tiers' },
  { key: 'risk_monitoring', name: 'Risk monitoring', line: 'Flags high risks that nobody has answered.', watches: 'Risks raised in meetings', handsYou: ['High risks without a response', 'Risks raised more than once'], group: 'Trust and oversight', draftsNeedApproval: false },
  { key: 'report_generation', name: 'Report generation', line: 'Compiles the weekly status from your records.', watches: 'Actions, decisions and risks', handsYou: ['Weekly status summary', 'Figures with their source counts'], group: 'Trust and oversight', draftsNeedApproval: false },
  { key: 'workflow_coordinator', name: 'Workflow coordinator', line: 'Tells you what your workflows are waiting on.', watches: 'Workflow runs, approvals and incidents', handsYou: ['Approvals waiting longest', 'Paused and failing workflows'], group: 'Trust and oversight', draftsNeedApproval: false },
  { key: 'document_intelligence', name: 'Document intelligence', line: 'Turns a contract or brief into plain obligations and dates.', watches: 'A document you open from a project', handsYou: ['Obligations and dates', 'What to check with a professional'], group: 'Inputs', needs: { kind: 'input', text: 'Open a document from a project to run this agent.' }, draftsNeedApproval: false },
  { key: 'inbox_command_centre', name: 'Inbox command centre', line: 'Finds commitments in your inbox and prepares safe replies.', watches: 'A connected mailbox', handsYou: ['Commitments found in email', 'Reply drafts for approval'], group: 'Inputs', needs: { kind: 'connection', text: 'Connect a mailbox in Connect apps to run this agent.' }, draftsNeedApproval: true },
];

export type ConsentBasis = 'all_agreed' | 'notice_given' | 'not_recorded';
export const CONSENT_OPTIONS: Array<{ value: ConsentBasis; label: string }> = [
  { value: 'all_agreed', label: 'Everyone agreed at the start of the meeting' },
  { value: 'notice_given', label: 'Notice was in the invite and nobody objected' },
];

export interface WorkspaceData {
  today: string;
  /** The signed-in person. */
  me?: string;
  meetings: Array<{
    id: string; title: string; date: string; project: string; attendees: string[]; summary?: string; decisionIds: string[]; actionIds: string[]; riskIds: string[];
    /** Consent basis as stated by a person. Missing means not recorded. */
    consent?: ConsentBasis;
    /** Client name (projects.client_name in the Workspace). */
    client?: string;
    /** Real estate: the listing this campaign meeting is about, and the vendor contact. */
    listing?: string;
    vendor?: string;
  }>;
  actions: Array<{ id: string; action_title: string; owner_name: string | null; due_date: string | null; status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'overdue'; project: string;
    /** Set when the action is a promise to a client. */
    owedTo?: string | null;
    /** Date the action was marked completed (action_tracker.updated_at when status is completed). */
    completed_on?: string | null; }>;
  decisions: Array<{ id: string; decision_title: string; decision_date: string; project: string; conditional?: boolean }>;
  risks: Array<{ id: string; text: string; rating: 'high' | 'medium' | 'low'; response?: string | null; project: string }>;
  /** Meetings in the calendar that have not happened yet. Optional: only with a calendar connection. */
  upcoming?: Array<{ id: string; title: string; date: string; project: string; attendees: string[] }>;
}

export interface Finding { title: string; detail: string; ref?: string; tone?: 'attention' | 'info' | 'ok' }
export interface Draft { to: string; subject: string; body: string; ref: string }
/** A change the agent suggests. It is applied only when a person confirms it, with the values they enter. */
export interface Fix {
  id: string;
  kind: 'set_owner' | 'set_due' | 'merge_action' | 'set_consent' | 'set_listing' | 'mark_owed';
  ref: string;
  /** For merge: the record kept. */
  ref2?: string;
  label: string;
  fields: Array<{ key: string; label: string; kind: 'text' | 'date' | 'select'; options?: Array<{ value: string; label: string }>; placeholder?: string; value?: string }>;
}
export interface DocSection { heading: string; items: string[]; empty?: string; ordered?: boolean }
export interface Slide { kind: 'title' | 'bullets' | 'stats'; title: string; subtitle?: string; bullets?: string[]; stats?: Array<{ label: string; value: string; source: string }>; note?: string }
export interface AgentResult {
  agent: AgentKey;
  ranAt: string;
  status: 'done' | 'nothing_found' | 'needs';
  headline: string;
  findings: Finding[];
  drafts: Draft[];
  basis: string;
  fixes?: Fix[];
  doc?: { title: string; subtitle?: string; sections: DocSection[] };
  deck?: Slide[];
}
export interface AgentOptions { store?: Store; now: string; project?: string; periodDays?: number }

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);
const open = (a: WorkspaceData['actions'][number]) => a.status !== 'completed';
const plural = (n: number, w: string, p = `${w}s`) => `${n} ${n === 1 ? w : p}`;

export async function runAgent(key: AgentKey, data: WorkspaceData, opts: AgentOptions): Promise<AgentResult> {
  const def = AGENTS.find((a) => a.key === key)!;
  const base = { agent: key, ranAt: opts.now, drafts: [] as Draft[] };
  if (def.needs) return { ...base, status: 'needs', headline: def.needs.text, findings: [], basis: 'Not run.' };
  const T = data.today;

  switch (key) {
    case 'meeting_followup': {
      const m = [...data.meetings].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!m) return { ...base, status: 'nothing_found', headline: 'No meeting records yet.', findings: [], basis: 'Read 0 meetings.' };
      const acts = data.actions.filter((a) => m.actionIds.includes(a.id));
      const decs = data.decisions.filter((d) => m.decisionIds.includes(d.id));
      const loose = acts.filter((a) => open(a) && (!a.owner_name || !a.due_date));
      const body = [
        `Hi all,`, ``, `Thanks for your time at ${m.title}. Here is what we agreed.`, ``,
        ...(decs.length ? ['Decisions', ...decs.map((d) => `- ${d.decision_title}${d.conditional ? ' (conditional)' : ''}`), ''] : []),
        ...(acts.length ? ['Actions', ...acts.map((a) => `- ${a.owner_name || 'Owner to be named'}: ${a.action_title}${a.due_date ? `, by ${auDate(a.due_date)}` : ', date to be set'}`), ''] : []),
        'Please reply if anything here does not match your notes.',
      ].join('\n');
      return {
        ...base, status: 'done',
        headline: `Follow-up drafted for ${m.title}.`,
        findings: [
          { title: `${plural(decs.length, 'decision')} and ${plural(acts.length, 'action')} in the draft`, detail: `From the meeting record saved ${auDate(m.date)}.`, ref: m.id, tone: 'info' },
          ...(loose.length ? [{ title: `${plural(loose.length, 'action')} for the next agenda`, detail: loose.map((a) => `${a.action_title} (${!a.owner_name ? 'no owner' : 'no date'})`).join('; '), ref: m.id, tone: 'attention' as const }] : []),
        ],
        drafts: [{ to: m.attendees.join(', '), subject: `Outcomes and actions: ${m.title}`, body, ref: m.id }],
        basis: `Read 1 meeting record, ${plural(decs.length, 'decision')}, ${plural(acts.length, 'action')}.`,
      };
    }
    case 'decision_followup': {
      const quiet = data.decisions.filter((d) => days(d.decision_date, T) >= 14 && !data.meetings.some((m) => m.decisionIds.includes(d.id) && m.actionIds.some((id) => data.actions.find((a) => a.id === id && a.project === d.project && open(a)))));
      const cond = data.decisions.filter((d) => d.conditional);
      const findings: Finding[] = [
        ...quiet.map((d) => ({ title: d.decision_title, detail: `Made ${days(d.decision_date, T)} days ago in ${d.project}. No open action follows it.`, ref: d.id, tone: 'attention' as const })),
        ...cond.map((d) => ({ title: d.decision_title, detail: 'Recorded as conditional. Still waiting on its approval.', ref: d.id, tone: 'attention' as const })),
      ];
      return { ...base, status: findings.length ? 'done' : 'nothing_found', headline: findings.length ? `${plural(findings.length, 'decision')} need${findings.length === 1 ? 's' : ''} a look.` : 'Every decision has work moving behind it.', findings, basis: `Read ${plural(data.decisions.length, 'decision')}.` };
    }
    case 'action_accountability': {
      const overdue = data.actions.filter((a) => open(a) && a.due_date && a.due_date < T);
      const unowned = data.actions.filter((a) => open(a) && !a.owner_name);
      const blocked = data.actions.filter((a) => a.status === 'blocked');
      const soon = data.actions.filter((a) => open(a) && a.due_date && a.due_date >= T && days(T, a.due_date) <= 3);
      const findings: Finding[] = [
        ...overdue.map((a) => ({ title: a.action_title, detail: `Overdue by ${plural(days(a.due_date!, T), 'day')}. Owner: ${a.owner_name || 'not named'}. ${a.project}.`, ref: a.id, tone: 'attention' as const })),
        ...unowned.filter((a) => !overdue.includes(a)).map((a) => ({ title: a.action_title, detail: `No owner named. ${a.project}.`, ref: a.id, tone: 'attention' as const })),
        ...blocked.map((a) => ({ title: a.action_title, detail: `Marked blocked. No reason is recorded, so ask ${a.owner_name || 'the team'}. ${a.project}.`, ref: a.id, tone: 'attention' as const })),
        ...soon.map((a) => ({ title: a.action_title, detail: `Due ${auDate(a.due_date)}. Owner: ${a.owner_name || 'not named'}.`, ref: a.id, tone: 'info' as const })),
      ];
      const byOwner = new Map<string, typeof overdue>();
      overdue.filter((a) => a.owner_name).forEach((a) => byOwner.set(a.owner_name!, [...(byOwner.get(a.owner_name!) || []), a]));
      const drafts: Draft[] = [...byOwner.entries()].map(([owner, list]) => ({
        to: owner, subject: list.length === 1 ? `Reminder: ${list[0].action_title}` : `Reminder: ${list.length} actions now overdue`,
        body: [`Hi ${owner.split(' ')[0]},`, '', `A quick reminder about ${list.length === 1 ? 'this action' : 'these actions'}:`, ...list.map((a) => `- ${a.action_title} (was due ${auDate(a.due_date)})`), '', 'If the date needs to move, reply with a new one and I will update the tracker.'].join('\n'),
        ref: list.map((a) => a.id).join(','),
      }));
      return { ...base, status: findings.length ? 'done' : 'nothing_found', headline: findings.length ? `${plural(overdue.length, 'overdue action')}, ${plural(unowned.length, 'action')} without an owner, ${blocked.length} blocked.` : 'Nothing overdue, unowned or blocked.', findings, drafts, basis: `Read ${plural(data.actions.length, 'action')} in the tracker.` };
    }
    case 'project_intelligence': {
      const projects = [...new Set([...data.actions.map((a) => a.project), ...data.meetings.map((m) => m.project)])];
      const findings: Finding[] = projects.map((p) => {
        const o = data.actions.filter((a) => a.project === p && open(a));
        const od = o.filter((a) => a.due_date && a.due_date < T);
        const last = data.meetings.filter((m) => m.project === p).map((m) => m.date).sort().pop();
        const gap = last ? days(last, T) : null;
        return { title: p, detail: `${plural(o.length, 'open action')}${od.length ? `, ${od.length} overdue` : ''}. ${last ? (gap === 0 ? 'Last meeting today.' : `Last meeting ${plural(gap!, 'day')} ago.`) : 'No meeting recorded.'}`, ref: p, tone: (od.length || gap === null || gap >= 14 ? 'attention' : 'ok') as Finding['tone'] };
      }).sort((a, b) => (a.tone === 'attention' ? -1 : 1) - (b.tone === 'attention' ? -1 : 1));
      return { ...base, status: projects.length ? 'done' : 'nothing_found', headline: `${plural(projects.length, 'project')} reviewed. ${findings.filter((f) => f.tone === 'attention').length} need attention.`, findings, basis: `Read ${plural(data.actions.length, 'action')} and ${plural(data.meetings.length, 'meeting')}.` };
    }
    case 'risk_monitoring': {
      const unanswered = data.risks.filter((r) => r.rating === 'high' && !r.response);
      const words = (t: string) => new Set(t.toLowerCase().match(/[a-z]{5,}/g) || []);
      const repeated = data.risks.filter((r, i) => data.risks.some((o, j) => j !== i && [...words(r.text)].filter((w) => words(o.text).has(w)).length >= 3));
      const findings: Finding[] = [
        ...unanswered.map((r) => ({ title: r.text, detail: `Rated high in ${r.project}. No response recorded.`, ref: r.id, tone: 'attention' as const })),
        ...repeated.filter((r) => !unanswered.includes(r)).map((r) => ({ title: r.text, detail: `Raised in more than one meeting (${r.project}).`, ref: r.id, tone: 'info' as const })),
      ];
      return { ...base, status: findings.length ? 'done' : 'nothing_found', headline: findings.length ? `${plural(unanswered.length, 'high risk')} without a response.` : 'Every high risk has a response on record.', findings, basis: `Read ${plural(data.risks.length, 'risk')}. Ratings come from the meeting records.` };
    }
    case 'report_generation': {
      const o = data.actions.filter(open);
      const od = o.filter((a) => a.due_date && a.due_date < T);
      const doneWeek = data.actions.filter((a) => a.status === 'completed').length;
      const decWeek = data.decisions.filter((d) => days(d.decision_date, T) <= 7).length;
      const findings: Finding[] = [
        { title: `${plural(o.length, 'open action')}, ${od.length} overdue`, detail: 'Counted from the Action tracker.', tone: od.length ? 'attention' : 'ok' },
        { title: `${plural(doneWeek, 'action')} completed`, detail: 'Status “completed” in the tracker.', tone: 'info' },
        { title: `${plural(decWeek, 'decision')} in the last 7 days`, detail: 'From Decision memory.', tone: 'info' },
        { title: `${plural(data.risks.filter((r) => r.rating === 'high').length, 'high risk')}`, detail: 'From meeting records.', tone: 'info' },
      ];
      return { ...base, status: 'done', headline: 'Weekly status compiled.', findings, basis: 'Every figure is a count of records. Nothing is estimated.' };
    }
    case 'workflow_coordinator': {
      if (!opts.store) return { ...base, status: 'needs', headline: 'Workflow records are not available.', findings: [], basis: 'Not run.' };
      const h: Health = await automationHealth(opts.store);
      const pend = (await opts.store.listApprovals()).filter((a) => a.status === 'pending');
      const wfs = await opts.store.listWorkflows();
      const findings: Finding[] = [
        ...pend.map((a) => ({ title: `Waiting for approval: ${a.title}`, detail: `Requested ${Math.max(0, Math.round((Date.parse(opts.now) - Date.parse(a.requestedAt)) / 3600_000))} hours ago by ${a.requestedBy}.`, ref: a.id, tone: 'attention' as const })),
        ...wfs.filter((w) => w.status === 'paused').map((w) => ({ title: `Paused: ${w.name}`, detail: w.pausedBy === 'quarantine' ? `Paused automatically after ${w.consecutiveFailures} failed runs.` : w.pausedBy === 'workspace_stop' ? 'Stopped from the Governance Centre.' : 'Paused by a person.', ref: w.id, tone: 'attention' as const })),
        ...(h.openIncidents ? [{ title: `${plural(h.openIncidents, 'open incident')}`, detail: 'See the Governance Centre.', tone: 'attention' as const }] : []),
      ];
      return { ...base, status: findings.length ? 'done' : 'nothing_found', headline: findings.length ? `${plural(pend.length, 'approval')} waiting, ${h.pausedWorkflows} paused.` : 'Nothing is waiting on you.', findings, basis: `Read ${plural(wfs.length, 'workflow')}, ${plural(h.runs7d, 'run')} this week and the approval queue.` };
    }
    case 'meeting_prep': return meetingPrep(data, opts, base);
    case 'consent_check': return consentCheck(data, base);
    case 'record_hygiene': return recordHygiene(data, base);
    case 'client_commitments': return clientCommitments(data, base);
    case 'vendor_campaign_update': return vendorUpdate(data, base);
    case 'board_pack': return boardPack(data, opts, base);
    default:
      return { ...base, status: 'needs', headline: 'This agent is not available here.', findings: [], basis: 'Not run.' };
  }
}

/** Turn agent drafts into approval items for the Approval Centre. Approving never sends them. */
export function draftsToOutgoing(r: AgentResult): OutgoingItem[] {
  return r.drafts.map((d, i) => ({ stepId: `${r.agent}_${i}`, app: 'concludo', what: `Email draft: ${d.subject}`, to: d.to, preview: d.body }));
}

/* ============================================================== new agents (v2.1) */

type Base = { agent: AgentKey; ranAt: string; drafts: Draft[] };
type Meeting = WorkspaceData['meetings'][number];
type Action = WorkspaceData['actions'][number];
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'about', 'what', 'have', 'will', 'your', 'their', 'then']);
const tokens = (t: string) => new Set((t.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !STOP.has(w)).map((w) => w.replace(/s$/, '')));
const similarity = (a: string, b: string) => { const A = tokens(a), B = tokens(b); const inter = [...A].filter((w) => B.has(w)).length; return inter / Math.max(1, new Set([...A, ...B]).size); };
const meetingOfAction = (data: WorkspaceData, id: string) => data.meetings.find((m) => m.actionIds.includes(id));
const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const first = (name?: string | null) => (name || '').split(/\s+/)[0] || 'there';
const actionLine = (a: Action) => `${a.action_title}: ${a.owner_name || 'owner not named'}${a.due_date ? `, by ${auDate(a.due_date)}` : ', no date set'}`;

/** The projects an agent can be pointed at, newest meeting first. */
export function projectsOf(data: WorkspaceData): string[] {
  return [...new Set([...data.meetings].sort(byDateDesc).map((m) => m.project))];
}

function meetingPrep(data: WorkspaceData, opts: AgentOptions, base: Base): AgentResult {
  const T = data.today;
  const next = (data.upcoming || []).filter((u) => u.date >= T).sort((a, b) => a.date.localeCompare(b.date))[0];
  const project = opts.project || next?.project || [...data.meetings].sort(byDateDesc)[0]?.project;
  if (!project) return { ...base, status: 'nothing_found', headline: 'No meeting records yet, so there is nothing to prepare from.', findings: [], basis: 'Read 0 meetings.' };
  const forMeeting = next && next.project === project ? next : undefined;
  const past = data.meetings.filter((m) => m.project === project && m.date <= T).sort(byDateDesc);
  if (!past.length) return { ...base, status: 'nothing_found', headline: `No earlier meeting for ${project}. Nothing to prepare from.`, findings: [], basis: `Read ${plural(data.meetings.length, 'meeting')}. None is in ${project}.` };
  const last = past[0];
  const decisions = data.decisions.filter((d) => last.decisionIds.includes(d.id));
  const openActs = data.actions.filter((a) => a.project === project && open(a)).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const overdue = openActs.filter((a) => a.due_date && a.due_date < T);
  const risks = data.risks.filter((r) => r.project === project && !r.response);
  const conditional = data.decisions.filter((d) => d.project === project && d.conditional);
  const agenda = [
    ...overdue.map((a) => `Overdue: ${a.action_title} (${a.owner_name || 'no owner'})`),
    ...openActs.filter((a) => !a.owner_name && !overdue.includes(a)).map((a) => `Name an owner: ${a.action_title}`),
    ...risks.map((r) => `Agree a response: ${r.text}`),
    ...conditional.map((d) => `Confirm the condition: ${d.decision_title}`),
    'New business',
  ];
  const title = forMeeting ? forMeeting.title : `Next meeting on ${project}`;
  const doc = {
    title: `Prep brief: ${title}`,
    subtitle: forMeeting ? `${auDate(forMeeting.date)}. Built from ${plural(past.length, 'earlier meeting')} on ${project}.` : `Built from ${plural(past.length, 'earlier meeting')} on ${project}.`,
    sections: [
      { heading: `Decided last time (${auDate(last.date)})`, items: decisions.map((d) => `${d.decision_title}${d.conditional ? ' (conditional)' : ''}`), empty: 'No decisions were recorded at the last meeting.' },
      { heading: 'Still open', items: openActs.map(actionLine), empty: 'No open actions on this project.' },
      { heading: 'Risks without a response', items: risks.map((r) => `${r.text} (rated ${r.rating})`), empty: 'Every risk on this project has a response.' },
      { heading: 'Suggested agenda', items: agenda, ordered: true },
    ],
  };
  const attendees = forMeeting?.attendees || last.attendees;
  const body = [`Hi all,`, '', `Ahead of ${title}${forMeeting ? ` on ${auDate(forMeeting.date)}` : ''}, here is where things stand.`, '', 'Still open', ...(openActs.length ? openActs.map((a) => `- ${actionLine(a)}`) : ['- Nothing open']), '', 'Proposed agenda', ...agenda.map((x, i) => `${i + 1}. ${x}`), '', 'Reply with anything you want added.'].join('\n');
  return {
    ...base, status: 'done',
    headline: `Prep brief ready for ${title}: ${plural(openActs.length, 'open item')}, ${plural(risks.length, 'risk')} to answer.`,
    findings: [
      { title: overdue.length ? `${plural(overdue.length, 'overdue action')} to raise first` : 'Nothing overdue on this project', detail: overdue.map((a) => a.action_title).join('; ') || 'Open items are listed in the brief.', tone: overdue.length ? 'attention' : 'ok' },
      { title: `Last met ${auDate(last.date)}`, detail: last.title, ref: last.id, tone: 'info' },
    ],
    doc,
    drafts: [{ to: attendees.join(', '), subject: `Agenda: ${title}`, body, ref: last.id }],
    basis: `Read ${plural(past.length, 'meeting')}, ${plural(openActs.length, 'open action')} and ${plural(risks.length, 'risk')} in ${project}. Only recorded items are listed.`,
  };
}

const CONSENT_WORDING = 'I would like to record and transcribe this meeting so we can share accurate notes and actions afterwards. If you would prefer it is not recorded, tell me before we start or at any time during the meeting, and I will stop.';

function consentCheck(data: WorkspaceData, base: Base): AgentResult {
  const ms = [...data.meetings].sort(byDateDesc);
  const missing = ms.filter((m) => !m.consent || m.consent === 'not_recorded');
  const ok = ms.filter((m) => m.consent && m.consent !== 'not_recorded');
  const findings: Finding[] = [
    ...missing.map((m) => ({ title: m.title, detail: `${auDate(m.date)}. No consent basis recorded. Workflows that start from this meeting are held.`, ref: m.id, tone: 'attention' as const })),
    ...ok.map((m) => ({ title: m.title, detail: `${auDate(m.date)}. ${CONSENT_OPTIONS.find((o) => o.value === m.consent)!.label}.`, ref: m.id, tone: 'ok' as const })),
  ];
  const fixes: Fix[] = missing.map((m) => ({ id: `consent_${m.id}`, kind: 'set_consent', ref: m.id, label: `Record consent for “${m.title}”`, fields: [{ key: 'basis', label: 'Consent basis', kind: 'select', options: CONSENT_OPTIONS, value: 'all_agreed' }] }));
  return {
    ...base, status: missing.length ? 'done' : 'nothing_found',
    headline: missing.length ? `${plural(missing.length, 'meeting has', 'meetings have')} no consent basis recorded. Workflows that start from ${missing.length === 1 ? 'it' : 'them'} are held.` : 'Every meeting has a consent basis recorded.',
    findings, fixes,
    drafts: [{ to: 'Paste into your next meeting invite', subject: 'Recording notice', body: CONSENT_WORDING, ref: 'consent_wording' }],
    basis: `Read ${plural(ms.length, 'meeting')}. Concludo records what you state about consent. It does not decide whether consent was legally valid, and recording rules differ between states. Check the consent and privacy toolkit, or a professional, when unsure.`,
  };
}

function recordHygiene(data: WorkspaceData, base: Base): AgentResult {
  const openActs = data.actions.filter(open);
  const noOwner = openActs.filter((a) => !a.owner_name);
  const noDate = openActs.filter((a) => !a.due_date);
  const dupes: Array<[Action, Action]> = [];
  openActs.forEach((a, i) => openActs.slice(i + 1).forEach((b) => { if (similarity(a.action_title, b.action_title) >= 0.6) dupes.push([a, b]); }));
  data.actions.filter((a) => a.status === 'completed').forEach((done) => openActs.forEach((b) => { if (similarity(done.action_title, b.action_title) >= 0.6) dupes.push([done, b]); }));
  const condNoFollow = data.decisions.filter((d) => d.conditional && !data.actions.some((a) => a.project === d.project && open(a) && similarity(a.action_title, d.decision_title) >= 0.25));
  const riskNoResp = data.risks.filter((r) => r.rating !== 'low' && !r.response);
  const where = (a: Action) => { const m = meetingOfAction(data, a.id); return m ? `${m.title}, ${auDate(m.date)}` : a.project; };
  const findings: Finding[] = [
    ...dupes.map(([keep, dup]) => ({ title: `Possible duplicate: ${dup.action_title}`, detail: `Looks like “${keep.action_title}” (${keep.status === 'completed' ? 'already completed' : keep.owner_name || 'no owner'}). From ${where(dup)}.`, ref: dup.id, tone: 'attention' as const })),
    ...noOwner.map((a) => ({ title: a.action_title, detail: `No owner. ${where(a)}.`, ref: a.id, tone: 'attention' as const })),
    ...noDate.filter((a) => a.owner_name).map((a) => ({ title: a.action_title, detail: `No due date. Owner: ${a.owner_name}. ${where(a)}.`, ref: a.id, tone: 'attention' as const })),
    ...condNoFollow.map((d) => ({ title: d.decision_title, detail: 'Conditional decision with no follow-up action to meet the condition.', ref: d.id, tone: 'info' as const })),
    ...riskNoResp.map((r) => ({ title: r.text, detail: `Rated ${r.rating}. No response recorded.`, ref: r.id, tone: 'info' as const })),
  ];
  const isDup = (a: Action) => dupes.some(([, d]) => d.id === a.id);
  for (let i = findings.length - 1; i >= 0; i--) if (!findings[i].title.startsWith('Possible duplicate') && dupes.some(([, d]) => d.id === findings[i].ref)) findings.splice(i, 1);
  const attendeesFor = (a: Action) => (meetingOfAction(data, a.id)?.attendees || []).join(', ');
  const fixes: Fix[] = [
    ...dupes.map(([keep, dup]) => ({ id: `merge_${dup.id}`, kind: 'merge_action' as const, ref: dup.id, ref2: keep.id, label: `Merge “${dup.action_title}” into “${keep.action_title}”`, fields: [] })),
    ...noOwner.filter((a) => !isDup(a)).map((a) => ({ id: `owner_${a.id}`, kind: 'set_owner' as const, ref: a.id, label: `Name an owner for “${a.action_title}”`, fields: [{ key: 'owner', label: 'Owner', kind: 'text' as const, placeholder: attendeesFor(a) || 'Name' }] })),
    ...noDate.filter((a) => !isDup(a)).map((a) => ({ id: `due_${a.id}`, kind: 'set_due' as const, ref: a.id, label: `Set a due date for “${a.action_title}”`, fields: [{ key: 'due', label: 'Due date', kind: 'date' as const }] })),
  ];
  const nOwner = noOwner.filter((a) => !isDup(a)).length, nDate = noDate.filter((a) => !isDup(a)).length;
  const gaps = nOwner + nDate + dupes.length;
  return {
    ...base, status: findings.length ? 'done' : 'nothing_found',
    headline: gaps ? `${plural(gaps, 'gap')} to fix: ${nOwner} without an owner, ${nDate} without a date, ${plural(dupes.length, 'possible duplicate')}.` : 'Every open action has an owner and a date, and nothing looks duplicated.',
    findings, fixes,
    basis: `Read ${plural(data.actions.length, 'action')}, ${plural(data.decisions.length, 'decision')} and ${plural(data.risks.length, 'risk')}. It counts gaps in records, not in people, and changes nothing until you confirm.`,
  };
}

function clientCommitments(data: WorkspaceData, base: Base): AgentResult {
  const T = data.today;
  const owed = data.actions.filter((a) => a.owedTo);
  const clients = [...new Set(data.meetings.map((m) => m.client).filter(Boolean) as string[])];
  const clientMeetingActs = new Set(data.meetings.filter((m) => m.client).flatMap((m) => m.actionIds));
  const unmarked = data.actions.filter((a) => open(a) && !a.owedTo);
  const markable = (unmarked.some((a) => clientMeetingActs.has(a.id)) ? unmarked.filter((a) => clientMeetingActs.has(a.id)) : unmarked).slice(0, 4);
  const markFix = (a: Action): Fix => {
    const m = meetingOfAction(data, a.id);
    return { id: `owed_${a.id}`, kind: 'mark_owed', ref: a.id, label: `Mark “${a.action_title}” as owed to a client`, fields: [{ key: 'client', label: 'Client', kind: clients.length ? 'select' : 'text', options: clients.map((c) => ({ value: c, label: c })), value: m?.client || clients[0], placeholder: 'Client name' }] };
  };
  if (!owed.length) return { ...base, status: 'nothing_found', headline: 'No actions are marked as owed to a client yet. Mark the promises below to start tracking them.', findings: [], fixes: markable.map(markFix), basis: `Read ${plural(data.actions.length, 'action')}.` };
  const groups = new Map<string, Action[]>();
  owed.forEach((a) => groups.set(a.owedTo!, [...(groups.get(a.owedTo!) || []), a]));
  const findings: Finding[] = [];
  const drafts: Draft[] = [];
  const src = (a: Action) => { const m = meetingOfAction(data, a.id); return m ? `From ${m.title}, ${auDate(m.date)}.` : ''; };
  for (const [client, list] of groups) {
    const late = list.filter((a) => open(a) && a.due_date && a.due_date < T);
    const week = list.filter((a) => open(a) && a.due_date && a.due_date >= T && a.due_date <= addDays(T, 7));
    const undated = list.filter((a) => open(a) && !a.due_date);
    const done = list.filter((a) => a.status === 'completed');
    late.forEach((a) => findings.push({ title: `${client}: ${a.action_title}`, detail: `Promised for ${auDate(a.due_date)}, now past due. ${a.owner_name || 'No owner'}. ${src(a)}`, ref: a.id, tone: 'attention' }));
    week.forEach((a) => findings.push({ title: `${client}: ${a.action_title}`, detail: `Due ${auDate(a.due_date)}. ${a.owner_name || 'No owner'}. ${src(a)}`, ref: a.id, tone: 'info' }));
    undated.forEach((a) => findings.push({ title: `${client}: ${a.action_title}`, detail: `No date promised. ${src(a)}`, ref: a.id, tone: 'attention' }));
    done.forEach((a) => findings.push({ title: `${client}: ${a.action_title}`, detail: `Done${a.completed_on ? ` ${auDate(a.completed_on)}` : ''}. ${src(a)}`, ref: a.id, tone: 'ok' }));
    if (list.some(open)) {
      const contact = data.meetings.find((m) => m.client === client)?.vendor;
      drafts.push({
        to: contact ? `${contact} (${client})` : client, subject: 'Where things stand',
        body: [`Hi ${contact ? first(contact) : 'there'},`, '', 'A quick update on what we said we would do for you.', '',
          ...(done.length ? ['Done', ...done.map((a) => `- ${a.action_title}`), ''] : []),
          'In progress', ...list.filter(open).map((a) => `- ${a.action_title}${a.due_date ? `, by ${auDate(a.due_date)}` : ', date to confirm'}`), '',
          'If anything here does not match what you expected, let me know.'].join('\n'),
        ref: list.map((a) => a.id).join(','),
      });
    }
  }
  const lateN = findings.filter((f) => f.detail.includes('past due')).length;
  return {
    ...base, status: 'done',
    headline: `${plural(owed.filter(open).length, 'open promise')} across ${plural(groups.size, 'client')}${lateN ? `, ${lateN} past due` : ''}.`,
    findings, drafts, fixes: markable.map(markFix),
    basis: `Read ${plural(owed.length, 'action')} marked as owed to a client. A promise is only what the record states; each one names the meeting it came from.`,
  };
}

function vendorUpdate(data: WorkspaceData, base: Base): AgentResult {
  const T = data.today;
  const since = addDays(T, -7);
  const listingMeetings = data.meetings.filter((m) => m.listing);
  if (!listingMeetings.length) {
    const fixes: Fix[] = [...data.meetings].sort(byDateDesc).slice(0, 4).map((m) => ({ id: `listing_${m.id}`, kind: 'set_listing', ref: m.id, label: `Tag “${m.title}” with its listing`, fields: [{ key: 'listing', label: 'Listing address', kind: 'text', placeholder: 'Street address' }, { key: 'vendor', label: 'Vendor contact', kind: 'text', placeholder: 'Name' }] }));
    return { ...base, status: 'needs', headline: 'Tag a campaign meeting with its listing to run this agent.', findings: [], fixes, basis: `Read ${plural(data.meetings.length, 'meeting')}. None is tagged to a listing.` };
  }
  const listings = [...new Set(listingMeetings.map((m) => m.listing!))];
  const findings: Finding[] = [];
  const drafts: Draft[] = [];
  for (const listing of listings) {
    const ms = listingMeetings.filter((m) => m.listing === listing).sort(byDateDesc);
    const vendor = ms.find((m) => m.vendor)?.vendor;
    const acts = data.actions.filter((a) => ms.some((m) => m.actionIds.includes(a.id)));
    const done = acts.filter((a) => a.status === 'completed' && a.completed_on && a.completed_on >= since);
    const decided = data.decisions.filter((d) => ms.some((m) => m.decisionIds.includes(d.id)) && d.decision_date >= since);
    const next = acts.filter(open).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    const toConfirm = [...next.filter((a) => !a.due_date).map((a) => `${a.action_title}: date`), 'Open home and private inspection numbers', 'Enquiries and any offers'];
    findings.push({ title: listing, detail: `${plural(done.length, 'item')} done this week, ${plural(decided.length, 'decision')}, ${plural(next.length, 'next step')}. ${plural(toConfirm.length, 'item')} to confirm before sending.${vendor ? '' : ' No vendor contact recorded.'}`, ref: ms[0].id, tone: vendor ? 'info' : 'attention' });
    drafts.push({
      to: vendor || `Vendor for ${listing} (add the contact)`, subject: `Weekly campaign update: ${listing}`,
      body: [`Hi ${vendor ? first(vendor) : 'there'},`, '', `Here is this week’s update on ${listing}.`, '',
        'Done this week', ...(done.length ? done.map((a) => `- ${a.action_title}`) : ['- Nothing recorded as completed this week']), '',
        ...(decided.length ? ['Agreed', ...decided.map((d) => `- ${d.decision_title}`), ''] : []),
        'Coming up', ...(next.length ? next.map((a) => `- ${a.action_title}${a.due_date ? `, ${auDate(a.due_date)}` : ', date to confirm'}`) : ['- Nothing scheduled yet']), '',
        'To confirm before sending', ...toConfirm.map((x) => `- [TO CONFIRM] ${x}`), '',
        'Call me any time if you have questions.', '', 'Kind regards'].join('\n'),
      ref: ms[0].id,
    });
  }
  return {
    ...base, status: 'done',
    headline: `${plural(drafts.length, 'vendor update')} drafted. Each lists what to confirm before it goes to the Approval Centre.`,
    findings, drafts,
    basis: `Read ${plural(listingMeetings.length, 'campaign meeting')}. No inspection numbers, offers, prices or predictions are added unless they are in the records; anything missing is marked TO CONFIRM.`,
  };
}

function boardPack(data: WorkspaceData, opts: AgentOptions, base: Base): AgentResult {
  const T = data.today;
  const days = opts.periodDays || 30;
  const from = addDays(T, -days);
  const ms = data.meetings.filter((m) => m.date >= from && m.date <= T).sort(byDateDesc);
  if (!ms.length) return { ...base, status: 'nothing_found', headline: `No meetings recorded in the last ${days} days. Nothing to report.`, findings: [], basis: `Read ${plural(data.meetings.length, 'meeting')}.` };
  const decs = data.decisions.filter((d) => d.decision_date >= from && d.decision_date <= T);
  const doneP = data.actions.filter((a) => a.status === 'completed' && a.completed_on && a.completed_on >= from);
  const openA = data.actions.filter(open);
  const overdue = openA.filter((a) => a.due_date && a.due_date < T);
  const nextA = openA.filter((a) => a.due_date && a.due_date >= T && a.due_date <= addDays(T, 30)).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const highs = data.risks.filter((r) => r.rating === 'high');
  const more = (xs: string[], n = 7) => (xs.length > n ? [...xs.slice(0, n), `And ${xs.length - n} more in the source list`] : xs);
  const period = `${auDate(from)} to ${auDate(T)}`;
  const deck: Slide[] = [
    { kind: 'title', title: 'Steering committee pack', subtitle: period, note: 'Prepared from Concludo records. Every figure is a count of records.' },
    { kind: 'stats', title: 'Executive summary', stats: [
      { label: 'Meetings', value: String(ms.length), source: 'Meeting records in the period' },
      { label: 'Decisions', value: String(decs.length), source: 'Decision memory, dated in the period' },
      { label: 'Actions completed', value: String(doneP.length), source: 'Action tracker, completed in the period' },
      { label: 'Actions overdue', value: String(overdue.length), source: `Open actions past due on ${auDate(T)}` },
      { label: 'High risks', value: String(highs.length), source: 'Risks rated high in meeting records' },
    ] },
    { kind: 'bullets', title: 'Decisions made', bullets: more(decs.map((d) => `${d.decision_title} (${auDate(d.decision_date)})${d.conditional ? ', conditional' : ''}`)), note: decs.length ? undefined : 'No decisions recorded in the period.' },
    { kind: 'bullets', title: 'Delivery', subtitle: `${openA.length} open, ${overdue.length} overdue, ${doneP.length} completed in the period`, bullets: more(overdue.map((a) => `Overdue: ${actionLine(a)}`)), note: overdue.length ? undefined : 'Nothing is overdue.' },
    { kind: 'bullets', title: 'Risks', bullets: more(highs.map((r) => `${r.text}. ${r.response ? `Response: ${r.response}` : 'No response recorded'}`)), note: highs.length ? undefined : 'No high risks recorded.' },
    { kind: 'bullets', title: 'Next 30 days', bullets: more(nextA.map(actionLine)), note: nextA.length ? undefined : 'No dated actions in the next 30 days.' },
    { kind: 'bullets', title: 'Sources', bullets: ms.map((m) => `${m.title}, ${auDate(m.date)}`), note: `${plural(ms.length, 'meeting')}, ${plural(decs.length, 'decision')}, ${plural(data.actions.length, 'action')} and ${plural(data.risks.length, 'risk')} read.` },
  ];
  const doc = { title: 'Executive summary', subtitle: period, sections: [
    { heading: 'In the period', items: [`${plural(ms.length, 'meeting')} and ${plural(decs.length, 'decision')}`, `${plural(doneP.length, 'action')} completed`, `${plural(openA.length, 'action')} open, ${overdue.length} overdue`, `${plural(highs.length, 'high risk')}, ${highs.filter((r) => !r.response).length} without a response`] },
    { heading: 'Needs the committee', items: [...overdue.map((a) => `Overdue: ${a.action_title}`), ...highs.filter((r) => !r.response).map((r) => `No response: ${r.text}`), ...decs.filter((d) => d.conditional).map((d) => `Condition to confirm: ${d.decision_title}`)], empty: 'Nothing needs a committee decision.' },
  ] };
  return {
    ...base, status: 'done',
    headline: `Board pack built for ${period}: ${plural(deck.length, 'slide')}, every figure counted from records.`,
    findings: [{ title: `${plural(overdue.length, 'overdue action')} and ${plural(highs.filter((r) => !r.response).length, 'unanswered high risk')} for the committee`, detail: 'Listed on the Delivery and Risks slides.', tone: overdue.length ? 'attention' : 'ok' }],
    deck, doc,
    basis: `Read ${plural(ms.length, 'meeting')} in the period. No forecasts, no commentary on individuals. Export uses the Workspace’s branded PowerPoint output.`,
  };
}

/** Plain-text outline of a deck, for the Approval Centre preview and for copying. */
export function deckToText(deck: Slide[]): string {
  return deck.map((s, i) => [`${i + 1}. ${s.title}${s.subtitle ? `: ${s.subtitle}` : ''}`, ...(s.stats || []).map((x) => `   ${x.label}: ${x.value} (${x.source})`), ...(s.bullets || []).map((b) => `   - ${b}`), ...(s.note ? [`   ${s.note}`] : [])].join('\n')).join('\n');
}

/** Apply a confirmed fix. Pure: returns a new copy of the data and a sentence for the audit log. Never called without a person's confirmation. */
export function applyFix(data: WorkspaceData, fix: Fix, values: Record<string, string>): { data: WorkspaceData; detail: string } {
  const d: WorkspaceData = JSON.parse(JSON.stringify(data));
  const act = d.actions.find((a) => a.id === fix.ref);
  const mtg = d.meetings.find((m) => m.id === fix.ref);
  const need = (k: string) => { const v = (values[k] || '').trim(); if (!v) throw new Error('Fill in the value first. Nothing was changed.'); return v; };
  switch (fix.kind) {
    case 'set_owner': { if (!act) throw new Error('Action not found.'); act.owner_name = need('owner'); return { data: d, detail: `Owner of “${act.action_title}” set to ${act.owner_name}.` }; }
    case 'set_due': { if (!act) throw new Error('Action not found.'); const v = need('due'); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Use a full date.'); act.due_date = v; return { data: d, detail: `Due date of “${act.action_title}” set to ${auDate(v)}.` }; }
    case 'merge_action': {
      if (!act || !fix.ref2) throw new Error('Action not found.');
      d.actions = d.actions.filter((a) => a.id !== act.id);
      d.meetings.forEach((m) => { if (m.actionIds.includes(act.id)) m.actionIds = [...new Set(m.actionIds.map((id) => (id === act.id ? fix.ref2! : id)))]; });
      const kept = d.actions.find((a) => a.id === fix.ref2)!;
      return { data: d, detail: `“${act.action_title}” merged into “${kept.action_title}”. The duplicate was removed.` };
    }
    case 'set_consent': { if (!mtg) throw new Error('Meeting not found.'); const v = need('basis') as ConsentBasis; if (!CONSENT_OPTIONS.some((o) => o.value === v)) throw new Error('Choose a consent basis.'); mtg.consent = v; return { data: d, detail: `Consent recorded for “${mtg.title}”: ${CONSENT_OPTIONS.find((o) => o.value === v)!.label.toLowerCase()}.` }; }
    case 'set_listing': { if (!mtg) throw new Error('Meeting not found.'); mtg.listing = need('listing'); mtg.vendor = (values.vendor || '').trim() || mtg.vendor; return { data: d, detail: `“${mtg.title}” tagged to ${mtg.listing}${mtg.vendor ? `, vendor ${mtg.vendor}` : ''}.` }; }
    case 'mark_owed': { if (!act) throw new Error('Action not found.'); act.owedTo = need('client'); return { data: d, detail: `“${act.action_title}” marked as owed to ${act.owedTo}.` }; }
    default: throw new Error('Unknown fix.');
  }
}

/**
 * Wire agents into workflows: a "Run an AI agent" step calls this. Drafts go to the Approval Centre
 * as agent drafts, which are never sent by Concludo.
 */
export function attachAgents(store: Store & { runAgent?: Store['runAgent'] }, getData: () => WorkspaceData, actor: () => string, onRun?: (r: AgentResult) => void): void {
  store.runAgent = async (agent: string, run: Run) => {
    const def = AGENTS.find((a) => a.key === agent);
    if (!def) return { ok: false, note: `Unknown agent “${agent}”.` };
    const res = await runAgent(def.key, getData(), { store, now: store.now() });
    onRun?.(res);
    if (res.status === 'needs') return { ok: false, note: `${def.name}: ${res.headline}` };
    for (const [i, dr] of res.drafts.entries()) {
      await requestDraftApproval(store, { title: dr.subject, actor: actor(), source: `${def.name} agent, run from “${run.workflowName}”`, items: [{ stepId: `${def.key}_${i}`, app: 'concludo', what: 'Draft', to: dr.to, preview: `Subject: ${dr.subject}\n\n${dr.body}` }] });
    }
    if (res.deck) await requestDraftApproval(store, { title: `${def.name}: share the pack`, actor: actor(), source: `${def.name} agent, run from “${run.workflowName}”`, items: [{ stepId: `${def.key}_deck`, app: 'concludo', what: 'Board pack outline', to: 'The people you choose when sharing', preview: deckToText(res.deck) }] });
    const n = res.drafts.length + (res.deck ? 1 : 0);
    return { ok: true, note: `${res.headline}${n ? ` ${plural(n, 'draft')} sent to the Approval Centre.` : ''}` };
  };
}
