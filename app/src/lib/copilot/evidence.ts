import type { ConsentBasis } from '../automation/agentsCore';
import { daysBetween, inRange } from './dates';
import { normaliseName, type NamedEntity } from './understanding';

/**
 * Evidence model. Pure data shaping: raw database rows in, a typed evidence pack out.
 * Nothing here talks to the network, so every rule below is unit tested.
 */

/* ------------------------------------------------------------------ RAW ROWS */

export interface RawProject {
  id: string;
  title?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  meeting_date?: string | null;
  created_at?: string | null;
  team_id?: string | null;
}
export interface RawOutput {
  id: string;
  project_id: string;
  json_content?: any;
  content?: string | null;
  created_at?: string | null;
}
export interface RawDecision {
  id: string;
  decision_title?: string | null;
  decision_summary?: string | null;
  decision_reasoning?: string | null;
  decision_owner?: string | null;
  decision_date?: string | null;
  project_id?: string | null;
  source_output_id?: string | null;
  created_at?: string | null;
}
export interface RawAction {
  id: string;
  action_title?: string | null;
  action_description?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  status?: string | null;
  project_id?: string | null;
  source_output_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
export interface RawMemory {
  agent_type: string;
  memory_key: string;
  memory_value: any;
}
export interface RawFile {
  id: string;
  project_id: string;
  name?: string | null;
  file_type?: string | null;
  version?: number | string | null;
  created_at?: string | null;
}
export interface RawApproval {
  id: string;
  status?: string | null;
  action_type?: string | null;
  action_payload?: any;
  created_at?: string | null;
  consumed_at?: string | null;
}
export interface RawExecution {
  id: string;
  workflow_id?: string | null;
  status?: string | null;
  error_message?: string | null;
  created_at?: string | null;
}
export interface RawIncident {
  id: string;
  workflow_id?: string | null;
  severity?: string | null;
  status?: string | null;
  step_key?: string | null;
  error_message?: string | null;
  customer_safe_explanation?: string | null;
  created_at?: string | null;
}

export interface RawBundle {
  projects: RawProject[];
  outputs: RawOutput[];
  decisions: RawDecision[];
  actions: RawAction[];
  memory: RawMemory[];
  files: RawFile[];
  approvals: RawApproval[];
  executions: RawExecution[];
  incidents: RawIncident[];
  /** Names of queries that hit their row limit, so the answer can say it may be incomplete. */
  truncated: string[];
  /** Names of queries that failed. Never silently treated as "no records". */
  failed: string[];
}

/* ----------------------------------------------------------------- EVIDENCE */

export interface EvRisk {
  id: string;
  title: string;
  detail?: string;
  severity?: string | null;
  meetingId: string;
  meetingDate: string | null;
  meetingTitle: string;
  projectKey: string;
  projectName: string;
  outputId: string;
  held: boolean; // meeting has no consent basis recorded, so narrative content is withheld
  links: Array<{ kind: 'action' | 'decision'; id: string; how: 'same_source' | 'same_meeting' | 'wording' }>;
}

export interface EvMeeting {
  id: string;
  title: string;
  date: string | null;
  projectKey: string;
  projectName: string;
  client: string | null;
  clientKey: string | null;
  consent: ConsentBasis | undefined;
  held: boolean;
  summary?: string;
  listing?: string;
  vendor?: string;
  outputIds: string[];
}

export interface EvDecision {
  id: string;
  title: string;
  summary: string;
  reasoning: string;
  owner: string | null;
  date: string | null;
  projectId: string | null;
  projectKey: string | null;
  projectName: string | null;
  meetingHeld: boolean;
  sourceOutputId: string | null;
  /** Inferred, not recorded: a later decision on the same topic. */
  supersededBy: string | null;
  supersedes: string | null;
  supersessionHow?: string;
}

export interface EvAction {
  id: string;
  title: string;
  owner: string | null;
  due: string | null;
  status: string; // normalised
  rawStatus: string | null;
  projectId: string | null;
  projectKey: string | null;
  projectName: string | null;
  client: string | null;
  clientKey: string | null;
  open: boolean;
  overdue: boolean;
  daysOverdue: number;
  blocked: boolean;
  owedTo: string | null;
  sourceOutputId: string | null;
  meetingHeld: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EvFile {
  id: string;
  projectId: string;
  projectName: string | null;
  name: string;
  version: number | string | null;
  createdAt: string | null;
}

export interface EvidencePack {
  today: string;
  entities: NamedEntity[];
  meetings: EvMeeting[];
  decisions: EvDecision[];
  actions: EvAction[];
  risks: EvRisk[];
  files: EvFile[];
  approvals: RawApproval[];
  executions: RawExecution[];
  incidents: RawIncident[];
  truncated: string[];
  failed: string[];
}

const CLOSED = new Set(['completed', 'done', 'complete', 'cancelled', 'canceled', 'closed']);

export function normaliseStatus(raw: string | null | undefined): string {
  const s = (raw || 'not_started').toLowerCase().replace(/[\s-]+/g, '_');
  if (CLOSED.has(s)) return 'completed';
  if (['blocked', 'on_hold', 'stuck'].includes(s)) return 'blocked';
  if (['in_progress', 'started', 'doing', 'active'].includes(s)) return 'in_progress';
  if (s === 'overdue') return 'overdue';
  return 'not_started';
}

const projectNameOf = (p: RawProject) => (p.project_name || p.title || '').trim();

/* --------------------------------------------------------------- ENTITIES */

export function buildEntities(projects: RawProject[]): NamedEntity[] {
  const byKey = new Map<string, NamedEntity>();
  for (const p of projects) {
    const pname = projectNameOf(p);
    if (pname) {
      const key = normaliseName(pname);
      const e = byKey.get(`p:${key}`) || { key, display: pname, kind: 'project' as const, ids: [], client: p.client_name || undefined };
      e.ids.push(p.id);
      if (!e.client && p.client_name) e.client = p.client_name;
      byKey.set(`p:${key}`, e);
    }
    if (p.client_name && p.client_name.trim()) {
      const key = normaliseName(p.client_name);
      const e = byKey.get(`c:${key}`) || { key, display: p.client_name.trim(), kind: 'client' as const, ids: [] };
      e.ids.push(p.id);
      byKey.set(`c:${key}`, e);
    }
  }
  return Array.from(byKey.values());
}

/* ------------------------------------------------------------------ RISKS */

function extractRisks(output: RawOutput): Array<{ id: string; title: string; detail?: string; severity?: string | null }> {
  const raw = output.json_content?.risks;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any, i: number) => {
      if (typeof r === 'string') return { id: `${output.id}:risk:${i}`, title: r.trim() };
      const title = String(r?.title || r?.risk || r?.name || r?.description || '').trim();
      return {
        id: String(r?.id || `${output.id}:risk:${i}`),
        title,
        detail: r?.description && r?.description !== title ? String(r.description) : r?.mitigation ? String(r.mitigation) : undefined,
        severity: r?.severity || r?.level || null,
      };
    })
    .filter((r) => r.title);
}

/* ------------------------------------------------------ SUPERSESSION (inferred) */

const REVISE_WORDS = /\b(supersed\w*|replac\w*|instead of|revis\w*|moved|move|delay\w*|brought forward|postpon\w*|changed|reschedul\w*|updated)\b/i;

function tokenSet(s: string): Set<string> {
  return new Set(
    normaliseName(s)
      .split(' ')
      .filter((t) => t.length >= 3)
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Within one project, mark an earlier decision as possibly superseded by a later one on the same topic.
 * This is an inference from wording and dates, never a recorded fact, and the interface says so.
 * Two decisions on the same date are never ordered against each other.
 */
export function inferSupersession(decisions: EvDecision[]): void {
  const byProject = new Map<string, EvDecision[]>();
  for (const d of decisions) {
    if (!d.projectId || !d.date) continue;
    const list = byProject.get(d.projectKey || d.projectId) || [];
    list.push(d);
    byProject.set(d.projectKey || d.projectId, list);
  }
  for (const list of byProject.values()) {
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const earlier = list[i];
        const later = list[j];
        if (!earlier.date || !later.date || later.date <= earlier.date) continue;
        if (earlier.supersededBy) continue;
        const sim = jaccard(tokenSet(earlier.title), tokenSet(later.title));
        const sharesTopic = sim >= 0.34;
        const reviseSignal = REVISE_WORDS.test(`${later.title} ${later.summary}`) && jaccard(tokenSet(earlier.title), tokenSet(`${later.title} ${later.summary}`)) >= 0.2;
        if (sharesTopic || reviseSignal) {
          earlier.supersededBy = later.id;
          later.supersedes = later.supersedes || earlier.id;
          later.supersessionHow = sharesTopic ? 'similar title on a later date' : 'revision wording on a later date';
          break;
        }
      }
    }
  }
}

/* ------------------------------------------------------------------- BUILD */

export function buildEvidence(raw: RawBundle, today: string): EvidencePack {
  const entities = buildEntities(raw.projects);

  // Consent, listing and "owed to client" are stored as agent_memory rows by the agents.
  const consent = new Map<string, ConsentBasis>();
  const listing = new Map<string, { listing?: string; vendor?: string }>();
  const owedTo = new Map<string, string>();
  for (const m of raw.memory) {
    const key = String(m.memory_key || '');
    if (m.agent_type === 'consent_check' && key.startsWith('meeting:')) {
      const basis = m.memory_value?.basis as ConsentBasis | undefined;
      if (basis) consent.set(key.slice(8), basis);
    } else if (m.agent_type === 'vendor_campaign_update' && key.startsWith('meeting:')) {
      listing.set(key.slice(8), m.memory_value || {});
    } else if (m.agent_type === 'client_commitments' && key.startsWith('action:')) {
      const who = String(m.memory_value?.owedTo || '').trim();
      if (who) owedTo.set(key.slice(7), who);
    }
  }

  const projectById = new Map(raw.projects.map((p) => [p.id, p]));
  const outputsByProject = new Map<string, RawOutput[]>();
  for (const o of raw.outputs) {
    const list = outputsByProject.get(o.project_id) || [];
    list.push(o);
    outputsByProject.set(o.project_id, list);
  }
  const outputById = new Map(raw.outputs.map((o) => [o.id, o]));

  const meetings: EvMeeting[] = raw.projects.map((p) => {
    const basis = consent.get(p.id);
    const held = !basis || basis === 'not_recorded';
    const outs = outputsByProject.get(p.id) || [];
    const first = outs.find((o) => o.json_content?.executiveSummary || o.json_content?.summary);
    const summary = first ? String(first.json_content.executiveSummary || first.json_content.summary) : undefined;
    const l = listing.get(p.id);
    const pname = projectNameOf(p);
    return {
      id: p.id,
      title: (p.title || 'Untitled meeting').trim(),
      date: p.meeting_date ? p.meeting_date.slice(0, 10) : p.created_at ? p.created_at.slice(0, 10) : null,
      projectKey: normaliseName(pname),
      projectName: pname || 'Unnamed project',
      client: p.client_name?.trim() || null,
      clientKey: p.client_name ? normaliseName(p.client_name) : null,
      consent: basis,
      held,
      summary: held ? undefined : summary,
      listing: l?.listing,
      vendor: l?.vendor,
      outputIds: outs.map((o) => o.id),
    };
  });
  meetings.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const meetingById = new Map(meetings.map((m) => [m.id, m]));

  const heldForOutput = (outputId: string | null | undefined): boolean => {
    if (!outputId) return false;
    const o = outputById.get(outputId);
    if (!o) return false;
    return meetingById.get(o.project_id)?.held ?? false;
  };

  const decisions: EvDecision[] = raw.decisions.map((d) => {
    const p = d.project_id ? projectById.get(d.project_id) : undefined;
    const pname = p ? projectNameOf(p) : null;
    return {
      id: d.id,
      title: (d.decision_title || 'Untitled decision').trim(),
      summary: (d.decision_summary || '').trim(),
      reasoning: (d.decision_reasoning || '').trim(),
      owner: d.decision_owner?.trim() || null,
      date: (d.decision_date || d.created_at || '').slice(0, 10) || null,
      projectId: d.project_id || null,
      projectKey: pname ? normaliseName(pname) : null,
      projectName: pname,
      meetingHeld: d.project_id ? meetingById.get(d.project_id)?.held ?? false : false,
      sourceOutputId: d.source_output_id || null,
      supersededBy: null,
      supersedes: null,
    };
  });
  inferSupersession(decisions);

  const actions: EvAction[] = raw.actions.map((a) => {
    const p = a.project_id ? projectById.get(a.project_id) : undefined;
    const pname = p ? projectNameOf(p) : null;
    const status = normaliseStatus(a.status);
    const due = a.due_date ? a.due_date.slice(0, 10) : null;
    const open = status !== 'completed';
    const overdue = open && ((status === 'overdue') || (!!due && due < today));
    return {
      id: a.id,
      title: (a.action_title || 'Untitled action').trim(),
      owner: a.owner_name?.trim() || null,
      due,
      status: overdue && status !== 'blocked' ? 'overdue' : status,
      rawStatus: a.status || null,
      projectId: a.project_id || null,
      projectKey: pname ? normaliseName(pname) : null,
      projectName: pname,
      client: p?.client_name?.trim() || null,
      clientKey: p?.client_name ? normaliseName(p.client_name) : null,
      open,
      overdue,
      daysOverdue: overdue && due ? Math.max(0, daysBetween(due, today)) : 0,
      blocked: status === 'blocked',
      owedTo: owedTo.get(a.id) || null,
      sourceOutputId: a.source_output_id || null,
      meetingHeld: a.project_id ? meetingById.get(a.project_id)?.held ?? false : heldForOutput(a.source_output_id),
      createdAt: a.created_at || null,
      updatedAt: a.updated_at || null,
    };
  });

  // Risks come from meeting outputs. Links to actions and decisions are labelled by how strong they are.
  const risks: EvRisk[] = [];
  for (const o of raw.outputs) {
    const m = meetingById.get(o.project_id);
    if (!m) continue;
    for (const r of extractRisks(o)) {
      const links: EvRisk['links'] = [];
      for (const a of actions) {
        if (a.sourceOutputId === o.id) links.push({ kind: 'action', id: a.id, how: 'same_source' });
        else if (a.projectId === m.id) links.push({ kind: 'action', id: a.id, how: 'same_meeting' });
      }
      for (const d of decisions) {
        if (d.sourceOutputId === o.id) links.push({ kind: 'decision', id: d.id, how: 'same_source' });
        else if (d.projectId === m.id) links.push({ kind: 'decision', id: d.id, how: 'same_meeting' });
      }
      const rt = tokenSet(`${r.title} ${r.detail || ''}`);
      for (const a of actions) {
        if (a.projectKey === m.projectKey && !links.some((l) => l.id === a.id) && jaccard(rt, tokenSet(a.title)) >= 0.3) {
          links.push({ kind: 'action', id: a.id, how: 'wording' });
        }
      }
      for (const d of decisions) {
        if (d.projectKey === m.projectKey && !links.some((l) => l.id === d.id) && jaccard(rt, tokenSet(`${d.title} ${d.summary}`)) >= 0.3) {
          links.push({ kind: 'decision', id: d.id, how: 'wording' });
        }
      }
      risks.push({
        id: r.id,
        title: m.held ? 'Risk withheld (meeting has no consent basis recorded)' : r.title,
        detail: m.held ? undefined : r.detail,
        severity: m.held ? null : r.severity,
        meetingId: m.id,
        meetingDate: m.date,
        meetingTitle: m.title,
        projectKey: m.projectKey,
        projectName: m.projectName,
        outputId: o.id,
        held: m.held,
        links,
      });
    }
  }

  const files: EvFile[] = raw.files.map((f) => {
    const p = projectById.get(f.project_id);
    return {
      id: f.id,
      projectId: f.project_id,
      projectName: p ? projectNameOf(p) : null,
      name: f.name || 'Untitled file',
      version: f.version ?? null,
      createdAt: f.created_at || null,
    };
  });

  return {
    today,
    entities,
    meetings,
    decisions,
    actions,
    risks,
    files,
    approvals: raw.approvals,
    executions: raw.executions,
    incidents: raw.incidents,
    truncated: raw.truncated,
    failed: raw.failed,
  };
}

/* ------------------------------------------------------------------- SCOPE */

export interface EvidenceScope {
  projectKey?: string | null;
  clientKey?: string | null;
  period?: { from: string; to: string } | null;
}

/** Narrow an evidence pack to an explicit scope. Never loosens it. */
export function applyScope(pack: EvidencePack, scope: EvidenceScope): EvidencePack {
  const pk = scope.projectKey || null;
  const ck = scope.clientKey || null;
  const per = scope.period || null;

  const meetingOk = (m: EvMeeting) =>
    (!pk || m.projectKey === pk) && (!ck || m.clientKey === ck) && (!per || inRange(m.date, per.from, per.to));

  const meetings = pack.meetings.filter(meetingOk);
  const meetingIds = new Set(pack.meetings.filter((m) => (!pk || m.projectKey === pk) && (!ck || m.clientKey === ck)).map((m) => m.id));

  const decisions = pack.decisions.filter(
    (d) => (!pk && !ck ? true : d.projectId ? meetingIds.has(d.projectId) : false) && (!per || inRange(d.date, per.from, per.to))
  );
  const actions = pack.actions.filter((a) => {
    if ((pk || ck) && !(a.projectId && meetingIds.has(a.projectId))) return false;
    if (per) {
      const when = a.due || (a.createdAt ? a.createdAt.slice(0, 10) : null);
      return inRange(when, per.from, per.to);
    }
    return true;
  });
  const risks = pack.risks.filter(
    (r) => (!pk || r.projectKey === pk) && (!ck || meetingIds.has(r.meetingId)) && (!per || inRange(r.meetingDate, per.from, per.to))
  );
  const files = pack.files.filter((f) => (!pk && !ck ? true : meetingIds.has(f.projectId)));

  return { ...pack, meetings, decisions, actions, risks, files };
}
