import type {
  AnswerItem,
  AnswerSection,
  AssistantType,
  CopilotClarification,
  CopilotExecutionDraft,
  CopilotNotice,
  CopilotQueryType,
  CopilotResponse,
  CopilotScopeInfo,
  EvidenceStatus,
  SourceRecord,
} from './types';
import { getConfidenceLevel } from './types';
import type { EvAction, EvDecision, EvMeeting, EvRisk, EvidencePack } from './evidence';
import type { DocumentContent } from './contextService';
import { formatAuDate, inRange, addDays } from './dates';
import { normaliseName, significantTokens } from './understanding';

/**
 * Answer composer. Pure: evidence in, response out.
 *
 * Rules enforced here, each covered by a test:
 *  - Every recorded statement carries the ids of the records behind it.
 *  - No match means "not recorded", never a fallback to unrelated records.
 *  - Inferences, calculations, recommendations and models are labelled as such.
 *  - Meetings with no consent basis have their content withheld and are listed as held.
 *  - Evidence strength is computed from named factors. It is not a probability of being right.
 */

export interface ComposeInput {
  query: string;
  intent: CopilotQueryType;
  assistantType: AssistantType;
  pack: EvidencePack; // already scoped
  scope: CopilotScopeInfo;
  clarification?: CopilotClarification;
  rankingRefused?: boolean;
  document?: DocumentContent | null;
  documentRequested?: boolean;
  lessons?: Array<{ id: string; title: string; summary?: string | null; outcome?: string | null; cluster_category?: string | null; created_at?: string | null }>;
  organizationId?: string | null;
  today: string;
}

/* ------------------------------------------------------------------ HELPERS */

const trunc = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : many || `${one}s`}`;

function stem(w: string): string {
  let t = w.toLowerCase();
  for (const suf of ['ing', 'ed', 'es', 's', 'e']) {
    if (t.length - suf.length >= 3 && t.endsWith(suf)) {
      t = t.slice(0, -suf.length);
      break;
    }
  }
  return t;
}

export function keywordStems(query: string, exclude: string[] = []): string[] {
  const ex = new Set(exclude.flatMap((e) => normaliseName(e).split(' ')).map(stem));
  return Array.from(new Set(significantTokens(query).map(stem))).filter((t) => !ex.has(t) && t.length >= 3);
}

function textStems(text: string): Set<string> {
  return new Set(
    normaliseName(text)
      .split(' ')
      .filter((t) => t.length >= 3)
      .map(stem)
  );
}

export function matchScore(keywords: string[], text: string): number {
  if (keywords.length === 0) return 0;
  const have = textStems(text);
  return keywords.filter((k) => have.has(k)).length;
}

class Registry {
  records = new Map<string, SourceRecord>();
  add(r: SourceRecord): string {
    if (!this.records.has(r.id)) this.records.set(r.id, r);
    return r.id;
  }
  list(): SourceRecord[] {
    return Array.from(this.records.values());
  }
}

function citeMeeting(reg: Registry, m: EvMeeting): string {
  return reg.add({
    id: m.id,
    title: m.title,
    type: 'meeting',
    snippet: m.held ? 'Content withheld: no consent basis recorded for this meeting.' : trunc(m.summary || 'Meeting record.', 200),
    createdAt: undefined,
    recordDate: m.date,
    href: `/projects/${m.id}`,
    status: m.held ? 'No consent basis recorded' : consentLabel(m.consent),
    metadata: { project: m.projectName, client: m.client },
  });
}
function citeDecision(reg: Registry, d: EvDecision): string {
  return reg.add({
    id: d.id,
    title: d.title,
    type: 'decision',
    snippet: trunc(d.summary || d.reasoning || 'Decision recorded in Decision Memory.', 200),
    recordDate: d.date,
    href: '/decisions',
    status: d.supersededBy ? 'Possibly superseded (inferred)' : 'Current',
    metadata: { owner: d.owner, project: d.projectName },
  });
}
function citeAction(reg: Registry, a: EvAction): string {
  return reg.add({
    id: a.id,
    title: a.title,
    type: 'action',
    snippet: `${a.owner ? `Owner ${a.owner}` : 'No owner recorded'}. ${a.due ? `Due ${formatAuDate(a.due)}` : 'No due date recorded'}.`,
    recordDate: a.due,
    href: `/actions/${a.id}`,
    status: statusLabel(a),
    metadata: { owner: a.owner, project: a.projectName, owedTo: a.owedTo },
  });
}
function citeRisk(reg: Registry, r: EvRisk): string {
  return reg.add({
    id: r.id,
    title: r.title,
    type: 'risk',
    snippet: r.held ? 'Withheld: the meeting has no consent basis recorded.' : trunc(r.detail || `Raised in ${r.meetingTitle}.`, 200),
    recordDate: r.meetingDate,
    href: `/projects/${r.meetingId}`,
    status: r.severity ? String(r.severity) : null,
    metadata: { meeting: r.meetingTitle, project: r.projectName },
  });
}

function consentLabel(c: string | undefined): string {
  if (c === 'all_agreed') return 'Consent: all agreed';
  if (c === 'notice_given') return 'Consent: notice given';
  return 'No consent basis recorded';
}
function statusLabel(a: EvAction): string {
  if (a.overdue) return `Overdue by ${plural(a.daysOverdue, 'day')}`;
  if (a.blocked) return 'Blocked';
  if (a.status === 'completed') return 'Completed';
  if (a.status === 'in_progress') return 'In progress';
  return 'Not started';
}

const item = (text: string, basis: AnswerItem['basis'], sourceIds: string[] = [], extra: Partial<AnswerItem> = {}): AnswerItem => ({
  text,
  basis,
  sourceIds,
  ...extra,
});

/* ------------------------------------------------------------ SHARED BLOCKS */

function meetingsSection(reg: Registry, ms: EvMeeting[], title = 'Meetings'): AnswerSection | null {
  if (ms.length === 0) return null;
  return {
    kind: 'meetings',
    title,
    items: ms.map((m) => {
      const id = citeMeeting(reg, m);
      const base = `${m.title}${m.client ? ` (${m.client})` : ''}`;
      return m.held
        ? item(`${base}. Content withheld: no consent basis recorded.`, 'recorded', [id], { date: m.date, tone: 'attention' })
        : item(`${base}.${m.summary ? ` ${trunc(m.summary, 180)}` : ''}`, 'recorded', [id], { date: m.date });
    }),
  };
}

function decisionsSection(reg: Registry, ds: EvDecision[], title = 'Decisions'): { section: AnswerSection | null; used: boolean } {
  if (ds.length === 0) return { section: null, used: false };
  const sorted = [...ds].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let used = false;
  const items = sorted.map((d) => {
    const id = citeDecision(reg, d);
    if (d.supersededBy) {
      const later = ds.find((x) => x.id === d.supersededBy);
      used = true;
      return item(
        `${d.title}. Possibly replaced by a later decision${later ? `: "${later.title}" (${formatAuDate(later.date)})` : ''}. Inferred from ${later?.supersessionHow || 'wording and dates'}; confirm in Decision Memory.`,
        'inferred',
        later ? [id, citeDecision(reg, later)] : [id],
        { date: d.date, tone: 'muted' }
      );
    }
    const owner = d.owner ? ` Owner: ${d.owner}.` : ' No owner recorded.';
    return item(`${d.title}.${d.summary ? ` ${trunc(d.summary, 180)}` : ''}${owner}${d.meetingHeld ? ' Source meeting has no consent basis recorded.' : ''}`, 'recorded', [id], {
      date: d.date,
      tone: d.meetingHeld ? 'attention' : 'normal',
    });
  });
  return { section: { kind: 'decisions', title, items }, used };
}

function actionsSection(reg: Registry, as: EvAction[], title = 'Actions', max = 12): AnswerSection | null {
  if (as.length === 0) return null;
  const sorted = [...as].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
    return (a.due || '9999').localeCompare(b.due || '9999');
  });
  const shown = sorted.slice(0, max);
  const items = shown.map((a) => {
    const id = citeAction(reg, a);
    const bits = [a.owner ? `Owner ${a.owner}` : 'No owner recorded', a.due ? `due ${formatAuDate(a.due)}` : 'no due date recorded', statusLabel(a).toLowerCase()];
    if (a.owedTo) bits.push(`owed to ${a.owedTo}`);
    return item(`${a.title}. ${bits.join(', ')}.`, 'recorded', [id], { date: a.due, tone: a.overdue || a.blocked ? 'attention' : 'normal' });
  });
  if (sorted.length > max) items.push(item(`${sorted.length - max} more actions are recorded in this scope. Open the Action Tracker for the full list.`, 'calculated', [], { tone: 'muted' }));
  return { kind: 'actions', title, items };
}

function risksSection(reg: Registry, rs: EvRisk[], pack: EvidencePack, title = 'Risks raised in meetings'): AnswerSection | null {
  if (rs.length === 0) return null;
  const items = rs.map((r) => {
    const id = citeRisk(reg, r);
    const strong = r.links.filter((l) => l.how !== 'wording');
    const loose = r.links.filter((l) => l.how === 'wording');
    const names = (links: EvRisk['links']) =>
      links
        .slice(0, 3)
        .map((l) => (l.kind === 'action' ? pack.actions.find((a) => a.id === l.id)?.title : pack.decisions.find((d) => d.id === l.id)?.title))
        .filter(Boolean)
        .map((t) => `"${trunc(String(t), 60)}"`)
        .join(', ');
    const ids = [
      id,
      ...strong
        .map((l) => {
          if (l.kind === 'action') {
            const a = pack.actions.find((x) => x.id === l.id);
            return a ? citeAction(reg, a) : null;
          }
          const d = pack.decisions.find((x) => x.id === l.id);
          return d ? citeDecision(reg, d) : null;
        })
        .filter((x): x is string => !!x),
    ];
    let text = r.held ? `${r.title}. ${r.meetingTitle}.` : `${r.title}${r.severity ? ` (${r.severity})` : ''}. Raised in ${r.meetingTitle}.`;
    if (!r.held) {
      const sameSource = strong.filter((l) => l.how === 'same_source');
      if (sameSource.length) text += ` Recorded alongside: ${names(sameSource)}.`;
      else if (strong.length) text += ` Same meeting: ${plural(strong.length, 'tracked item')}.`;
      else text += ' No action or decision is linked to this risk in the records.';
      if (loose.length) text += ` Possibly related by wording (inferred): ${names(loose)}.`;
    }
    return item(text, 'recorded', ids, { date: r.meetingDate, tone: r.held ? 'attention' : 'normal' });
  });
  return { kind: 'risks', title, items };
}

/** Same-topic decisions that conflict: shown, never silently reconciled. */
function discrepancySection(reg: Registry, ds: EvDecision[]): AnswerSection | null {
  const pairs = ds.filter((d) => d.supersededBy);
  if (pairs.length === 0) return null;
  return {
    kind: 'discrepancy',
    title: 'Changed or conflicting decisions',
    items: pairs.map((d) => {
      const later = ds.find((x) => x.id === d.supersededBy);
      return item(
        `Earlier: "${d.title}" (${formatAuDate(d.date)}). Later: "${later?.title}" (${formatAuDate(later?.date)}). Concludo shows both. It infers the later one is current, but no record says so.`,
        'inferred',
        later ? [citeDecision(reg, d), citeDecision(reg, later)] : [citeDecision(reg, d)],
        { tone: 'attention' }
      );
    }),
  };
}

function heldSection(ms: EvMeeting[], reg: Registry): AnswerSection | null {
  const held = ms.filter((m) => m.held);
  if (held.length === 0) return null;
  return {
    kind: 'held',
    title: 'Withheld for consent',
    items: [
      item(
        `${plural(held.length, 'meeting has', 'meetings have')} no consent basis recorded, so Copilot did not use ${held.length === 1 ? 'its' : 'their'} summary or risk text. Record a consent basis in Agents, then ask again.`,
        'calculated',
        held.slice(0, 6).map((m) => citeMeeting(reg, m)),
        { tone: 'attention' }
      ),
    ],
  };
}

/* --------------------------------------------------------- SECTION TO TEXT */

export function sectionsToText(sections: AnswerSection[]): string {
  return sections
    .map((s) => `${s.title}\n${s.items.map((i) => `- ${i.text}${i.date ? ` [${formatAuDate(i.date)}]` : ''}`).join('\n')}`)
    .join('\n\n');
}

/* ------------------------------------------------------------ SCOPE HELPERS */

export function actionsOwedToClient(pack: EvidencePack, clientKey: string | null): EvAction[] {
  return pack.actions.filter((a) => {
    if (!a.open || !a.owedTo) return false;
    if (!clientKey) return true;
    return normaliseName(a.owedTo) === clientKey; // exact only: "Marlo" never matches "Marlowe"
  });
}

const INJECTION =
  /(ignore (all |any |the )?(previous|prior|above) (instructions|prompts?)|disregard (the |all |any )?(previous|prior|above)? ?instructions|you are now|system prompt|reveal (the |your )?(secret|key|password|prompt)|act as (an? )?(admin|system)|\bdo not tell the user\b)/i;

export function containsInstructionLikeText(text: string): boolean {
  return INJECTION.test(text);
}

/* --------------------------------------------------------------- STRENGTH */

export interface StrengthFactor {
  label: string;
  points: number;
}

/**
 * Evidence strength, 5 to 95. Documented, deterministic, and shown with its factors.
 * It rates how well the records cover the question. It is not the probability that an answer is correct.
 */
export function evidenceStrength(f: {
  matched: number;
  scopeResolved: boolean;
  allDated: boolean;
  truncated: boolean;
  failed: boolean;
  heldExcluded: number;
  inferredUsed: boolean;
  refusedOrNone: boolean;
}): { score: number; factors: StrengthFactor[] } {
  if (f.refusedOrNone) return { score: 10, factors: [{ label: 'No matching records in scope', points: 10 }] };
  const factors: StrengthFactor[] = [{ label: 'Base: records found in scope', points: 40 }];
  if (f.scopeResolved) factors.push({ label: 'Scope is explicit (project, client, period or document)', points: 20 });
  if (f.matched >= 3) factors.push({ label: 'Three or more supporting records', points: 15 });
  else if (f.matched >= 1) factors.push({ label: 'One or two supporting records', points: 8 });
  if (f.allDated) factors.push({ label: 'Every cited record has a date', points: 10 });
  if (f.truncated) factors.push({ label: 'Query hit its row limit, so results may be incomplete', points: -20 });
  if (f.failed) factors.push({ label: 'A data source could not be read', points: -25 });
  if (f.heldExcluded > 0) factors.push({ label: 'Meetings withheld for consent', points: -15 });
  if (f.inferredUsed) factors.push({ label: 'Some statements are inferred, not recorded', points: -10 });
  const raw = factors.reduce((n, x) => n + x.points, 0);
  return { score: Math.max(5, Math.min(95, raw)), factors };
}

/* ------------------------------------------------------------------ COMPOSE */

export function compose(input: ComposeInput): CopilotResponse {
  const { query, intent, assistantType, pack, scope, today } = input;
  const reg = new Registry();
  const sections: AnswerSection[] = [];
  const notices: CopilotNotice[] = [];
  const followUps: string[] = [];
  const reasoning: string[] = [];
  let evidenceStatus: EvidenceStatus = 'grounded';
  let inferredUsed = false;
  let execDraft: CopilotExecutionDraft | undefined;
  let noMatch = false;

  const scopeBits = [scope.projectName && `project ${scope.projectName}`, scope.client && `client ${scope.client}`, scope.period && scope.period.label, scope.documentName && `document ${scope.documentName}`].filter(Boolean);
  reasoning.push(`Understood the question as "${intent.replace(/_/g, ' ')}".`);
  reasoning.push(scopeBits.length ? `Scope: ${scopeBits.join('; ')}.` : 'Scope: everything you can access in this workspace. No project, client, period or document was named.');

  const openActions = pack.actions.filter((a) => a.open);
  const overdue = pack.actions.filter((a) => a.overdue);
  const blocked = pack.actions.filter((a) => a.blocked && a.open);

  const finishNone = (summary: string, followups: string[] = []) => {
    noMatch = true;
    evidenceStatus = 'none';
    sections.push({ kind: 'summary', title: 'Answer', items: [item(summary, 'calculated', [])] });
    sections.push({ kind: 'gaps', title: 'Not recorded', items: [item('Concludo has no record that answers this in the scope above. Nothing has been assumed.', 'calculated')] });
    followUps.push(...followups);
  };

  /* ---------- people ranking: refused ---------- */
  if (input.rankingRefused || intent === 'people_ranking_refused') {
    evidenceStatus = 'refused';
    noMatch = true;
    sections.push({
      kind: 'summary',
      title: 'Answer',
      items: [
        item(
          'Concludo measures work, not people, so Copilot will not rank, score or compare individuals. The same question can be answered about the work itself: which actions are overdue and for how long, which are blocked, and which projects carry the most open work.',
          'calculated'
        ),
      ],
    });
    followUps.push('Which actions are overdue, and by how many days?', 'Which projects have the most open actions?', 'Which actions have no owner or no due date recorded?');
  }

  /* ---------- clarification: ambiguous names ---------- */
  else if (input.clarification) {
    evidenceStatus = 'ambiguous';
    noMatch = true;
    sections.push({
      kind: 'summary',
      title: 'Which one do you mean?',
      items: [item(input.clarification.question, 'calculated')],
    });
    reasoning.push('More than one project or client matched the name. Copilot did not merge them or guess.');
  }

  /* ---------- document ---------- */
  else if (intent === 'document_query') {
    const doc = input.document;
    if (!doc) {
      evidenceStatus = 'none';
      noMatch = true;
      notices.push({ kind: 'permission', text: 'This document could not be opened. It may have been deleted, or you may no longer have access to it.' });
      sections.push({ kind: 'gaps', title: 'Not available', items: [item('No text was read, so nothing is claimed about this document.', 'calculated')] });
    } else if (!doc.text) {
      evidenceStatus = 'none';
      noMatch = true;
      notices.push({ kind: 'info', text: `${doc.name} has no readable text stored in Concludo (it may be an image or a file kept only in storage).` });
      sections.push({ kind: 'gaps', title: 'Not available', items: [item('Copilot can only answer from stored text. Nothing has been assumed.', 'calculated')] });
    } else {
      const kw = keywordStems(query);
      const paras = doc.text.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/).map((p) => p.trim()).filter((p) => p.length > 20);
      const scored = paras.map((p, i) => ({ p, i, s: matchScore(kw, p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 5);
      const docId = reg.add({
        id: doc.id,
        title: doc.name,
        type: 'document',
        snippet: `Version ${doc.version ?? 'not recorded'}.`,
        recordDate: doc.createdAt ? doc.createdAt.slice(0, 10) : null,
        href: `/projects/${doc.projectId}`,
        status: doc.version != null ? `Version ${doc.version}` : null,
      });
      if (containsInstructionLikeText(doc.text)) {
        notices.push({ kind: 'injection', text: 'This document contains instruction-like text. Copilot treated it as content to quote, and did not follow it.' });
      }
      if (doc.textTruncated) notices.push({ kind: 'truncated', text: 'Only the first part of this document was read. Passages later in the file are not covered.' });
      if (scored.length === 0) {
        evidenceStatus = 'none';
        noMatch = true;
        sections.push({ kind: 'gaps', title: 'Not found in this document', items: [item(`No passage in ${doc.name} (version ${doc.version ?? 'not recorded'}) matches your question.`, 'calculated', [docId])] });
      } else {
        sections.push({
          kind: 'document',
          title: `From ${doc.name}, version ${doc.version ?? 'not recorded'}`,
          items: scored.map((x) => item(`"${trunc(x.p, 320)}"`, 'recorded', [docId], { tone: 'normal' })),
        });
      }
      const linked = [...pack.decisions.slice(0, 3).map((d) => ({ d })), ...[]];
      void linked;
      const dDecisions = pack.decisions.slice(0, 4);
      const dActions = pack.actions.filter((a) => a.open).slice(0, 4);
      if (dDecisions.length || dActions.length) {
        sections.push({
          kind: 'summary',
          title: 'Linked records on the same project',
          items: [
            ...dDecisions.map((d) => item(`Decision: ${d.title}.`, 'recorded', [citeDecision(reg, d)], { date: d.date })),
            ...dActions.map((a) => item(`Open action: ${a.title}. ${statusLabel(a)}.`, 'recorded', [citeAction(reg, a)], { date: a.due })),
          ],
        });
      }
      reasoning.push(`Opened ${doc.name} (version ${doc.version ?? 'not recorded'}) under your access and matched passages by wording.`);
    }
  }

  /* ---------- execution request: preview only ---------- */
  else if (intent === 'action_execution_request') {
    const q = query.toLowerCase();
    const kind: CopilotExecutionDraft['actionType'] = /workflow/.test(q) ? 'create_workflow' : /export/.test(q) ? 'export_actions' : /report/.test(q) && !/briefing/.test(q) ? 'generate_report' : 'prepare_briefing';
    const title = kind === 'create_workflow' ? 'Follow-up workflow' : kind === 'export_actions' ? 'Action export' : kind === 'generate_report' ? 'Project report' : 'Executive briefing';
    const preview = [
      `Scope: ${scopeBits.length ? scopeBits.join('; ') : 'everything you can access'}.`,
      `Uses ${plural(pack.decisions.length, 'decision')}, ${plural(openActions.length, 'open action')}, ${plural(pack.risks.length, 'risk')} and ${plural(pack.meetings.filter((m) => !m.held).length, 'consented meeting')} as at ${formatAuDate(today)}.`,
      pack.meetings.some((m) => m.held) ? `${plural(pack.meetings.filter((m) => m.held).length, 'meeting')} without a consent basis will be left out.` : 'No meetings are being left out for consent.',
      'Nothing is sent. Approving only marks the draft ready for you to review.',
    ];
    execDraft = {
      actionType: kind,
      title,
      payload: {
        sourceQuery: trunc(query, 200),
        generatedAt: new Date().toISOString(),
        organizationId: input.organizationId || null,
        scope: { project: scope.projectName || null, client: scope.client || null, period: scope.period || null },
        recordIds: {
          decisions: pack.decisions.map((d) => d.id).slice(0, 100),
          actions: pack.actions.map((a) => a.id).slice(0, 100),
          meetings: pack.meetings.filter((m) => !m.held).map((m) => m.id).slice(0, 100),
        },
      },
      requiresApproval: true,
      status: 'draft',
      preview,
    };
    sections.push({
      kind: 'next_steps',
      title: `Prepared for your approval: ${title}`,
      items: preview.map((p) => item(p, 'calculated')),
    });
    followUps.push('Open Approvals');
    reasoning.push('Prepared a preview only. It becomes a real approval item only after the client saves it, and Copilot never approves or sends anything itself.');
  }

  /* ---------- workflow runs, approvals, incidents ---------- */
  else if (intent === 'workflow_status') {
    const failedRuns = pack.executions.filter((e) => /fail|error/i.test(e.status || ''));
    const pending = pack.approvals.filter((a) => (a.status || '').toLowerCase() === 'pending' && !a.consumed_at);
    const openInc = pack.incidents.filter((i) => !/resolved|closed/i.test(i.status || ''));
    if (failedRuns.length)
      sections.push({
        kind: 'runs',
        title: 'Failed workflow runs',
        items: failedRuns.slice(0, 8).map((e) => item(`Run ${e.id.slice(0, 8)} failed${e.error_message ? `: ${trunc(e.error_message, 140)}` : ' (no error message recorded)'}.`, 'recorded', [reg.add({ id: e.id, title: `Workflow run ${e.id.slice(0, 8)}`, type: 'workflow_run', snippet: trunc(e.error_message || 'Failed run.', 160), recordDate: (e.created_at || '').slice(0, 10) || null, href: `/workflows/runs/${e.id}`, status: 'Failed' })], { date: (e.created_at || '').slice(0, 10), tone: 'attention' })),
      });
    if (pending.length)
      sections.push({
        kind: 'approvals',
        title: 'Waiting for your approval',
        items: pending.slice(0, 8).map((a) => item(`${String(a.action_payload?.title || a.action_type || 'Approval request')} (${a.action_payload?.source || 'workflow'}).`, 'recorded', [reg.add({ id: a.id, title: String(a.action_payload?.title || a.action_type || 'Approval request'), type: 'approval', snippet: 'Pending approval.', recordDate: (a.created_at || '').slice(0, 10) || null, href: `/approvals/${a.id}`, status: 'Pending' })], { date: (a.created_at || '').slice(0, 10), tone: 'attention' })),
      });
    if (openInc.length)
      sections.push({
        kind: 'incidents',
        title: 'Open incidents',
        items: openInc.slice(0, 8).map((i) => item(`${i.severity ? `${i.severity}: ` : ''}${trunc(i.customer_safe_explanation || i.error_message || 'Incident recorded.', 160)}${i.step_key ? ` (step ${i.step_key})` : ''}.`, 'recorded', [reg.add({ id: i.id, title: `Incident ${i.id.slice(0, 8)}`, type: 'incident', snippet: trunc(i.customer_safe_explanation || i.error_message || 'Incident recorded.', 160), recordDate: (i.created_at || '').slice(0, 10) || null, href: '/workflows/governance', status: i.status || 'Open' })], { date: (i.created_at || '').slice(0, 10), tone: 'attention' })),
      });
    if (sections.length === 0) finishNone('No failed runs, pending approvals or open incidents are recorded.');
    else {
      sections.unshift({ kind: 'summary', title: 'Answer', items: [item(`${plural(failedRuns.length, 'failed run')}, ${plural(pending.length, 'pending approval')} and ${plural(openInc.length, 'open incident')} are recorded.`, 'calculated')] });
      sections.push({ kind: 'next_steps', title: 'Next step', items: [item('Review pending items in Approvals. Copilot cannot approve, retry or resolve anything for you.', 'recommended')] });
    }
    reasoning.push('Read workflow runs, approvals and incidents you can access. No run was started and nothing was approved.');
  }

  /* ---------- consent status ---------- */
  else if (intent === 'consent_status') {
    const held = pack.meetings.filter((m) => m.held);
    const ok = pack.meetings.filter((m) => !m.held);
    sections.push({ kind: 'summary', title: 'Answer', items: [item(`${plural(ok.length, 'meeting')} with a consent basis recorded and ${plural(held.length, 'meeting')} without.`, 'calculated', [])] });
    if (held.length) {
      sections.push({ kind: 'held', title: 'No consent basis recorded', items: held.slice(0, 12).map((m) => item(`${m.title}${m.client ? ` (${m.client})` : ''}.`, 'recorded', [citeMeeting(reg, m)], { date: m.date, tone: 'attention' })) });
      sections.push({ kind: 'next_steps', title: 'Next step', items: [item('Record the consent basis for each meeting in Agents, under Consent check. Concludo does not decide whether consent was valid.', 'recommended')] });
    }
    if (pack.meetings.length === 0) finishNone('No meetings are recorded in this scope.');
  }

  /* ---------- client commitments ---------- */
  else if (intent === 'client_commitments') {
    const owed = actionsOwedToClient(pack, scope.client ? normaliseName(scope.client) : null);
    if (owed.length === 0) {
      const others = scope.client ? openActions.length : 0;
      finishNone(
        scope.client ? `No open action is marked as owed to ${scope.client}.` : 'No open action is marked as owed to a client.',
        []
      );
      if (others > 0)
        sections[sections.length - 1].items.push(item(`${plural(others, 'other open action')} on ${scope.client}'s meetings ${others === 1 ? 'is' : 'are'} not marked as owed to the client, so ${others === 1 ? 'it was' : 'they were'} left out.`, 'calculated', [], { tone: 'muted' }));
    } else {
      const groups = new Map<string, EvAction[]>();
      for (const a of owed) {
        const k = normaliseName(a.owedTo || '');
        groups.set(k, [...(groups.get(k) || []), a]);
      }
      sections.push({ kind: 'summary', title: 'Answer', items: [item(`${plural(owed.length, 'open action')} ${owed.length === 1 ? 'is' : 'are'} marked as owed to ${groups.size === 1 ? owed[0].owedTo : plural(groups.size, 'client')}; ${plural(owed.filter((a) => a.overdue).length, 'is', 'are')} overdue.`, 'calculated', [])] });
      for (const [, list] of groups) {
        const sec = actionsSection(reg, list, `Owed to ${list[0].owedTo}`);
        if (sec) {
          sec.kind = 'commitments';
          sections.push(sec);
        }
      }
    }
  }

  /* ---------- campaign and listing ---------- */
  else if (intent === 'campaign_listing') {
    const withListing = pack.meetings.filter((m) => m.listing);
    const qn = ` ${normaliseName(query)} `;
    const named = withListing.filter((m) => qn.includes(` ${normaliseName(m.listing || '')} `));
    const chosen = named.length ? named : withListing;
    if (chosen.length === 0) {
      finishNone('No meeting in this scope is tagged to a listing.');
    } else {
      const byListing = new Map<string, EvMeeting[]>();
      for (const m of chosen) byListing.set(m.listing as string, [...(byListing.get(m.listing as string) || []), m]);
      sections.push({ kind: 'summary', title: 'Answer', items: [item(`${plural(chosen.length, 'campaign meeting')} across ${plural(byListing.size, 'listing')}${named.length ? ', limited to the listing you named' : ''}.`, 'calculated', [])] });
      for (const [listing, ms] of byListing) {
        const ids = new Set(ms.map((m) => m.id));
        const ds = pack.decisions.filter((d) => d.projectId && ids.has(d.projectId));
        const as = pack.actions.filter((a) => a.open && a.projectId && ids.has(a.projectId));
        const ms2 = meetingsSection(reg, ms, `Listing: ${listing}${ms[0].vendor ? ` (vendor ${ms[0].vendor})` : ''}`);
        if (ms2) sections.push(ms2);
        const dsec = decisionsSection(reg, ds, `Decisions for ${listing}`);
        if (dsec.section) sections.push(dsec.section);
        if (dsec.used) inferredUsed = true;
        const asec = actionsSection(reg, as, `Open actions for ${listing}`);
        if (asec) sections.push(asec);
      }
    }
  }

  /* ---------- risks ---------- */
  else if (intent === 'risk_analysis') {
    const rs = pack.risks;
    if (rs.length === 0) {
      finishNone('No risks are recorded in meetings in this scope.');
      if (blocked.length) sections.push({ kind: 'actions', title: 'Blocked work (the only blocker signal on record)', items: blocked.slice(0, 6).map((a) => item(`${a.title}. ${statusLabel(a)}.`, 'recorded', [citeAction(reg, a)], { date: a.due, tone: 'attention' })) });
    } else {
      sections.push({ kind: 'summary', title: 'Answer', items: [item(`${plural(rs.length, 'risk')} raised in ${plural(new Set(rs.map((r) => r.meetingId)).size, 'meeting')}${scope.period ? ' in the period' : ''}; ${plural(rs.filter((r) => r.links.some((l) => l.how !== 'wording')).length, 'has', 'have')} a tracked action or decision recorded alongside.`, 'calculated', [])] });
      const sec = risksSection(reg, rs, pack);
      if (sec) sections.push(sec);
      const laterDecisions = pack.decisions.filter((d) => rs.some((r) => d.projectKey === r.projectKey && d.date && r.meetingDate && d.date > r.meetingDate));
      if (laterDecisions.length) sections.push({ kind: 'decisions', title: 'Later decisions on the same project', items: laterDecisions.slice(0, 5).map((d) => item(`${d.title}.`, 'recorded', [citeDecision(reg, d)], { date: d.date })) });
      if (rs.some((r) => r.links.some((l) => l.how === 'wording'))) inferredUsed = true;
    }
    const h = heldSection(pack.meetings.filter((m) => m.held && rs.some((r) => r.meetingId === m.id)), reg);
    if (h) sections.push(h);
  }

  /* ---------- forecast ---------- */
  else if (intent === 'forecast_query') {
    const done = pack.actions.filter((a) => !a.open && a.updatedAt);
    const since = addDays(today, -27);
    const recent = done.filter((a) => inRange(a.updatedAt, since, today));
    const weekly = [0, 0, 0, 0];
    recent.forEach((a) => {
      const idx = Math.min(3, Math.floor(Math.abs(Math.round((Date.parse(today) - Date.parse((a.updatedAt || '').slice(0, 10))) / 86400000)) / 7));
      weekly[idx]++;
    });
    sections.push({
      kind: 'summary',
      title: 'Observed',
      items: [
        item(`${plural(openActions.length, 'open action')}, ${plural(overdue.length, 'overdue action')}, ${plural(done.length, 'completed action')} in this scope as at ${formatAuDate(today)}.`, 'calculated', []),
        item(`${plural(recent.length, 'action')} marked complete in the last 28 days (by last update date): ${weekly.slice().reverse().join(', ')} per week, oldest week first.`, 'calculated', []),
      ],
    });
    if (recent.length < 3 || openActions.length === 0) {
      sections.push({ kind: 'gaps', title: 'No forecast given', items: [item(recent.length < 3 ? 'Fewer than three completions in the last 28 days, so any date would be unsupported precision. Concludo does not give one.' : 'There are no open actions to forecast.', 'calculated', [])] });
      evidenceStatus = 'partial';
    } else {
      const avg = recent.length / 4;
      const lo = Math.max(...[Math.min(...weekly), 0.5]);
      const hi = Math.max(...weekly, avg);
      const wMid = Math.ceil(openActions.length / avg);
      const wSlow = Math.ceil(openActions.length / lo);
      const wFast = Math.ceil(openActions.length / hi);
      sections.push({
        kind: 'forecast',
        title: 'Modelled (assumptions shown)',
        items: [
          item(`If completions continue at the 28-day average of ${avg.toFixed(1)} a week, ${openActions.length} open actions clear in about ${wMid} weeks. The range across the weekly pace seen is ${wFast} to ${wSlow} weeks.`, 'modelled', []),
          item('Assumes no new actions are added, the pace holds, and blocked or ownerless actions move at the same rate. None of these is likely to be exactly true.', 'modelled', [], { tone: 'muted' }),
        ],
      });
      inferredUsed = true;
    }
  }

  /* ---------- executive and recommendation ---------- */
  else if (intent === 'executive_query' || intent === 'recommendation_query') {
    const since30 = addDays(today, -29);
    const recentDec = pack.decisions.filter((d) => inRange(d.date, since30, today));
    const recentMeet = pack.meetings.filter((m) => inRange(m.date, since30, today));
    const pending = pack.approvals.filter((a) => (a.status || '').toLowerCase() === 'pending' && !a.consumed_at);
    const failedRuns = pack.executions.filter((e) => /fail|error/i.test(e.status || ''));
    const openInc = pack.incidents.filter((i) => !/resolved|closed/i.test(i.status || ''));
    const held = pack.meetings.filter((m) => m.held);
    sections.push({
      kind: 'summary',
      title: 'Status as at ' + formatAuDate(today),
      items: [
        item(`${plural(recentMeet.length, 'meeting')} and ${plural(recentDec.length, 'decision')} in the last 30 days.`, 'calculated', recentDec.slice(0, 5).map((d) => citeDecision(reg, d))),
        item(`${plural(openActions.length, 'open action')}: ${overdue.length} overdue, ${blocked.length} blocked.`, 'calculated', overdue.slice(0, 5).map((a) => citeAction(reg, a)), { tone: overdue.length ? 'attention' : 'ok' }),
        item(`${plural(pending.length, 'approval')} waiting, ${plural(failedRuns.length, 'failed run')}, ${plural(openInc.length, 'open incident')}.`, 'calculated', [], { tone: pending.length || failedRuns.length || openInc.length ? 'attention' : 'ok' }),
        item(`${plural(pack.risks.filter((r) => !r.held).length, 'risk')} on record from meetings.`, 'calculated', pack.risks.filter((r) => !r.held).slice(0, 4).map((r) => citeRisk(reg, r))),
      ],
    });
    const dsec = decisionsSection(reg, recentDec.slice(0, 6), 'Recent decisions');
    if (dsec.section) sections.push(dsec.section);
    if (dsec.used) inferredUsed = true;
    const recs: AnswerItem[] = [];
    if (overdue.length) {
      const oldest = [...overdue].sort((a, b) => (a.due || '').localeCompare(b.due || ''))[0];
      recs.push(item(`Clear overdue actions first, starting with the oldest: "${trunc(oldest.title, 70)}"${oldest.projectName ? ` on ${oldest.projectName}` : ''}, ${statusLabel(oldest).toLowerCase()}.`, 'recommended', [citeAction(reg, oldest)]));
    }
    if (pending.length) recs.push(item(`Decide the ${plural(pending.length, 'pending approval')} so dependent work is not held.`, 'recommended'));
    const noOwner = openActions.filter((a) => !a.owner);
    if (noOwner.length) recs.push(item(`${plural(noOwner.length, 'open action')} ${noOwner.length === 1 ? 'has' : 'have'} no owner recorded. Assign owners before chasing dates.`, 'recommended', noOwner.slice(0, 4).map((a) => citeAction(reg, a))));
    if (held.length) recs.push(item(`Record a consent basis for ${plural(held.length, 'meeting')} so ${held.length === 1 ? 'it' : 'they'} can be used in briefings.`, 'recommended'));
    if (recs.length) sections.push({ kind: 'next_steps', title: 'Recommended next steps (rule based, in this order)', items: recs });
    const h = heldSection(pack.meetings, reg);
    if (h) sections.push(h);
    if (pack.meetings.length === 0 && pack.actions.length === 0 && pack.decisions.length === 0) finishNone('No meetings, decisions or actions are recorded yet.');
  }

  /* ---------- timeline ---------- */
  else if (intent === 'timeline_query') {
    const events: Array<{ date: string; text: string; id: string; basis: AnswerItem['basis'] }> = [];
    pack.meetings.forEach((m) => m.date && events.push({ date: m.date, text: `Meeting: ${m.title}${m.held ? ' (content withheld, no consent basis)' : ''}`, id: citeMeeting(reg, m), basis: 'recorded' }));
    pack.decisions.forEach((d) => d.date && events.push({ date: d.date, text: `Decision: ${d.title}${d.supersededBy ? ' (possibly replaced later)' : ''}`, id: citeDecision(reg, d), basis: d.supersededBy ? 'inferred' : 'recorded' }));
    pack.actions.forEach((a) => a.due && events.push({ date: a.due, text: `Action due: ${a.title} (${statusLabel(a).toLowerCase()})`, id: citeAction(reg, a), basis: 'recorded' }));
    events.sort((a, b) => a.date.localeCompare(b.date));
    if (events.length === 0) finishNone('No dated records are in this scope.');
    else {
      const shown = events.slice(-30);
      sections.push({ kind: 'summary', title: 'Timeline, oldest first', items: shown.map((e) => item(e.text, e.basis, [e.id], { date: e.date })) });
      if (events.length > shown.length) notices.push({ kind: 'truncated', text: `Showing the latest 30 of ${events.length} dated records.` });
      if (shown.some((e) => e.basis === 'inferred')) inferredUsed = true;
    }
  }

  /* ---------- knowledge discovery ---------- */
  else if (intent === 'knowledge_discovery') {
    const ls = input.lessons || [];
    if (ls.length === 0) finishNone('No lessons learned are recorded that you can access.');
    else
      sections.push({
        kind: 'summary',
        title: 'Lessons learned on record',
        items: ls.slice(0, 8).map((l) => item(`${l.title}${l.cluster_category ? ` [${l.cluster_category}]` : ''}.${l.outcome ? ` Outcome: ${l.outcome}.` : ''}`, 'recorded', [reg.add({ id: l.id, title: l.title, type: 'lesson_learned', snippet: trunc(l.summary || '', 200), recordDate: (l.created_at || '').slice(0, 10) || null, href: '/knowledge/memory' })], { date: (l.created_at || '').slice(0, 10) })),
      });
  }

  /* ---------- decisions ---------- */
  else if (intent === 'decision_retrieval') {
    const exclude = [scope.projectName || '', scope.client || ''];
    const kw = keywordStems(query, exclude);
    const scored = pack.decisions.map((d) => ({ d, s: matchScore(kw, `${d.title} ${d.summary} ${d.reasoning}`) }));
    let hits = kw.length ? scored.filter((x) => x.s > 0).map((x) => x.d) : pack.decisions;
    let note: string | null = null;
    if (kw.length && hits.length === 0 && scope.projectName) {
      hits = pack.decisions;
      if (hits.length) note = `No decision matched your wording, so all ${plural(hits.length, 'decision')} recorded for ${scope.projectName} ${hits.length === 1 ? 'is' : 'are'} shown.`;
    }
    // bring in the supersession chain of any hit
    const ids = new Set(hits.map((d) => d.id));
    pack.decisions.forEach((d) => {
      if ((d.supersededBy && ids.has(d.supersededBy)) || (d.supersedes && ids.has(d.supersedes))) ids.add(d.id);
    });
    hits = pack.decisions.filter((d) => ids.has(d.id));
    if (hits.length === 0) {
      finishNone(scope.projectName ? `No decision about this is recorded for ${scope.projectName}.` : 'No decision matching your question is recorded.');
    } else {
      const current = hits.filter((d) => !d.supersededBy);
      sections.push({ kind: 'summary', title: 'Answer', items: [item(`${plural(hits.length, 'decision')} found${hits.some((d) => d.supersededBy) ? `; ${plural(current.length, 'appears', 'appear')} to be current` : ''}.`, 'calculated', [])] });
      if (note) notices.push({ kind: 'scope', text: note });
      const dsec = decisionsSection(reg, hits);
      if (dsec.section) sections.push(dsec.section);
      if (dsec.used) inferredUsed = true;
      const disc = discrepancySection(reg, hits);
      if (disc) sections.push(disc);
      const linked = pack.actions.filter((a) => a.open && hits.some((d) => d.projectId && a.projectId === d.projectId));
      const asec = actionsSection(reg, linked, 'Open actions on the same meetings', 6);
      if (asec) sections.push(asec);
    }
  }

  /* ---------- actions ---------- */
  else if (intent === 'action_retrieval') {
    const q = query.toLowerCase();
    let target = openActions;
    let label = 'open actions';
    if (/overdue/.test(q)) {
      target = overdue;
      label = 'overdue actions';
    } else if (/blocked/.test(q)) {
      target = blocked;
      label = 'blocked actions';
    } else if (/no owner|unassigned|without an owner/.test(q)) {
      target = openActions.filter((a) => !a.owner);
      label = 'open actions with no owner recorded';
    }
    if (target.length === 0) finishNone(`No ${label} are recorded in this scope.`);
    else {
      const noDue = openActions.filter((a) => !a.due).length;
      const noOwner = openActions.filter((a) => !a.owner).length;
      sections.push({
        kind: 'summary',
        title: 'Answer',
        items: [
          item(`${plural(target.length, label.replace(/s$/, ''), label)} out of ${plural(pack.actions.length, 'action')} recorded.`, 'calculated', []),
          ...(noOwner || noDue ? [item(`Among open actions, ${noOwner} have no owner and ${noDue} have no due date recorded.`, 'calculated', [], { tone: 'muted' })] : []),
        ],
      });
      const asec = actionsSection(reg, target, 'Actions');
      if (asec) sections.push(asec);
      const h = heldSection(pack.meetings.filter((m) => target.some((a) => a.projectId === m.id)), reg);
      if (h) sections.push(h);
    }
  }

  /* ---------- meetings ---------- */
  else if (intent === 'meeting_retrieval') {
    if (pack.meetings.length === 0) finishNone('No meetings are recorded in this scope.');
    else {
      sections.push({ kind: 'summary', title: 'Answer', items: [item(`${plural(pack.meetings.length, 'meeting')} recorded in this scope.`, 'calculated', [])] });
      const m = meetingsSection(reg, pack.meetings.slice(-15), 'Meetings, oldest first');
      if (m) sections.push(m);
    }
  }

  /* ---------- period summary and project overview ---------- */
  else if (intent === 'period_summary' || intent === 'project_retrieval') {
    const noRecords = pack.meetings.length === 0 && pack.decisions.length === 0 && pack.actions.length === 0 && pack.risks.length === 0;
    if (noRecords) {
      finishNone(scopeBits.length ? `No meetings, decisions, actions or risks are recorded for ${scopeBits.join('; ')}.` : 'No meetings, decisions, actions or risks are recorded yet.');
    } else if (!scopeBits.length && intent === 'project_retrieval') {
      const names = Array.from(new Set(pack.meetings.map((m) => m.projectName))).slice(0, 12);
      sections.push({ kind: 'summary', title: 'Answer', items: [item(`Your workspace has ${plural(pack.meetings.length, 'meeting')}, ${plural(pack.decisions.length, 'decision')} and ${plural(openActions.length, 'open action')}. Name a project to see its history${names.length ? `: ${names.join(', ')}` : ''}.`, 'calculated', [])] });
    } else {
      const current = pack.decisions.filter((d) => !d.supersededBy);
      const dates = pack.meetings.map((m) => m.date).filter(Boolean) as string[];
      const first = dates[0];
      const last = dates[dates.length - 1];
      sections.push({
        kind: 'summary',
        title: 'Answer',
        items: [
          item(
            `${plural(pack.meetings.length, 'meeting')}${first ? ` from ${formatAuDate(first)} to ${formatAuDate(last)}` : ''}; ${plural(pack.decisions.length, 'decision')} (${current.length} current${pack.decisions.length - current.length ? `, ${pack.decisions.length - current.length} possibly replaced` : ''}); ${plural(openActions.length, 'open action')} (${overdue.length} overdue); ${plural(pack.risks.length, 'risk')} raised.`,
            'calculated',
            []
          ),
        ],
      });
      const m = meetingsSection(reg, pack.meetings.slice(-10), 'Earlier meetings, oldest first');
      if (m) sections.push(m);
      const dsec = decisionsSection(reg, pack.decisions, 'Decisions');
      if (dsec.section) sections.push(dsec.section);
      if (dsec.used) inferredUsed = true;
      const disc = discrepancySection(reg, pack.decisions);
      if (disc) sections.push(disc);
      const asec = actionsSection(reg, openActions, 'Open actions');
      if (asec) sections.push(asec);
      const rsec = risksSection(reg, pack.risks, pack);
      if (rsec) {
        sections.push(rsec);
        if (pack.risks.some((r) => r.links.some((l) => l.how === 'wording'))) inferredUsed = true;
      } else if (pack.meetings.some((m) => !m.held)) {
        sections.push({ kind: 'gaps', title: 'Risks', items: [item('No risks were recorded in meetings in this scope.', 'calculated', [])] });
      }
      const h = heldSection(pack.meetings, reg);
      if (h) sections.push(h);
    }
  }

  /* ---------- general ---------- */
  else {
    sections.push({
      kind: 'summary',
      title: 'What Copilot can see',
      items: [
        item(`${plural(pack.meetings.length, 'meeting')}, ${plural(pack.decisions.length, 'decision')}, ${plural(openActions.length, 'open action')} (${overdue.length} overdue) and ${plural(pack.risks.length, 'risk')} are available to you.`, 'calculated', []),
        item('Ask about a named project, a client, a period, a document, or the state of approvals and failed runs. Copilot answers only from these records.', 'calculated', [], { tone: 'muted' }),
      ],
    });
    evidenceStatus = pack.meetings.length + pack.decisions.length + pack.actions.length === 0 ? 'none' : 'grounded';
    noMatch = evidenceStatus === 'none';
  }

  /* ---------- notices from the pack ---------- */
  if (pack.truncated.length) notices.push({ kind: 'truncated', text: `Some results hit a row limit (${pack.truncated.join(', ')}), so this answer may be incomplete.` });
  if (pack.failed.length) {
    notices.push({ kind: 'partial', text: `Part of the data could not be read (${pack.failed.join(', ')}). The answer below only covers what was readable.` });
    if (evidenceStatus === 'grounded') evidenceStatus = 'partial';
  }
  const heldInScope = pack.meetings.filter((m) => m.held).length;
  if (heldInScope > 0 && !['consent_status', 'action_execution_request'].includes(intent)) {
    notices.push({ kind: 'consent', text: `${plural(heldInScope, 'meeting')} in scope ${heldInScope === 1 ? 'has' : 'have'} no consent basis recorded. Their summaries and risks were not used.` });
  }
  if (inferredUsed) notices.push({ kind: 'info', text: 'Some statements are labelled Inferred. They are a reading of the records, not something anyone recorded. Check the source before relying on them.' });
  if (inferredUsed && evidenceStatus === 'grounded') evidenceStatus = 'partial';
  if (heldInScope > 0 && evidenceStatus === 'grounded' && !noMatch) evidenceStatus = 'partial';
  if (pack.truncated.length && evidenceStatus === 'grounded') evidenceStatus = 'partial';

  const sources = reg.list();
  const refusedOrNone = noMatch || evidenceStatus === 'refused' || evidenceStatus === 'ambiguous';
  const strength = evidenceStrength({
    matched: sources.length,
    scopeResolved: !!(scope.projectName || scope.client || scope.period || scope.documentId),
    allDated: sources.length > 0 && sources.every((s) => !!s.recordDate),
    truncated: pack.truncated.length > 0,
    failed: pack.failed.length > 0,
    heldExcluded: heldInScope,
    inferredUsed,
    refusedOrNone,
  });

  const answer = sectionsToText(sections);
  const supportingEvidence = sections.flatMap((s) => s.items.filter((i) => i.basis === 'calculated').map((i) => i.text)).slice(0, 6);

  const strengthText = refusedOrNone
    ? evidenceStatus === 'refused'
      ? 'No evidence was gathered: this request was declined.'
      : evidenceStatus === 'ambiguous'
        ? 'No evidence was gathered until you choose which name you mean.'
        : 'No matching records were found, so no evidence supports an answer.'
    : `Evidence strength rates how well the records cover this question (${strength.factors.map((f) => `${f.label}: ${f.points > 0 ? '+' : ''}${f.points}`).join('; ')}). It is not the chance that the answer is correct.`;

  return {
    query,
    intent,
    assistantType,
    answer,
    supportingEvidence,
    sourceRecords: sources,
    confidence: getConfidenceLevel(strength.score),
    confidenceScore: strength.score,
    confidenceExplanation: strengthText,
    relatedRecords: [],
    reasoningPath: reasoning,
    knowledgeGraphConnections: [],
    suggestedFollowUps: followUps.length ? followUps : suggestFor(intent, scope),
    executionDraft: execDraft,
    sections,
    evidenceStatus,
    notices,
    scope,
    clarification: input.clarification,
    strengthFactors: strength.factors,
  };
}

function suggestFor(intent: CopilotQueryType, scope: CopilotScopeInfo): string[] {
  const p = scope.projectName;
  switch (intent) {
    case 'decision_retrieval':
      return [p ? `Which actions are still open for ${p}?` : 'Which decisions were made in the last 30 days?', p ? `What risks were raised for ${p}?` : 'Which decisions look like they changed later?'];
    case 'action_retrieval':
      return ['Which actions have no owner or no due date recorded?', 'Which open actions are blocked?'];
    case 'risk_analysis':
      return [p ? `What decisions followed the risks on ${p}?` : 'Which meetings raised risks in the last 30 days?', 'Which open actions are linked to a risk?'];
    case 'workflow_status':
      return ['Which approvals have been waiting longest?', 'Which workflow runs failed this week?'];
    case 'executive_query':
      return ['Prepare an executive briefing for the last 30 days', 'Which meetings still need a consent basis?'];
    default:
      return [p ? `Summarise ${p}` : 'Summarise the last 30 days', 'Which actions are overdue?'];
  }
}
