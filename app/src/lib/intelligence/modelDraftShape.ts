/**
 * Shapes a merged model draft into the full record the Workspace expects.
 *
 * The validator only accepts items whose quote is found in the source. This
 * module then gives every accepted item the same fields the rule engine
 * produces (ids, evidence with source, line, time and speaker, review state,
 * defaults the exporters and screens read), rebuilds the open items list from
 * the drafted open questions, and runs the engine's own refresh() so gaps,
 * recommendations, stats, health and the quality gate describe the drafted
 * items, not the rule engine's.
 *
 * No network, no data layer. Pure functions only.
 */
import { refresh } from './meetingEngine';
import type { MeetingModel, Evidence, Decision, Action, Risk, OpenItem, InsightItem, StatementToVerify, OpenQuestionItem } from './meetingEngine';
import { normaliseText, tableColumns } from './modelDraftValidator';

const MIN_MATCH_WORDS = 4;
const INSIGHT_KINDS = new Set(['feedback_positive', 'concern', 'advice', 'offer', 'market_intel', 'context']);
const TIME_RE = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/;

export interface ShapeSource {
  text: string;
  kind: 'transcript' | 'notes' | 'document';
  name?: string;
}

interface LocatedQuote {
  line: number;
  timestamp?: string;
  speaker?: string;
}

/** The 0-based line where a quote read down one table column starts, or -1. */
function locateInColumns(text: string, q: string): number {
  for (const segs of tableColumns(text)) {
    let joined = '';
    const starts: number[] = [];
    for (const seg of segs) {
      starts.push(joined.length + 1);
      joined += ` ${seg.norm}`;
    }
    const at = `${joined} `.indexOf(` ${q} `);
    if (at < 0) continue;
    let k = 0;
    while (k + 1 < starts.length && starts[k + 1] <= at + 1) k++;
    return segs[k].line;
  }
  return -1;
}

/** Finds the 1-based line where a quote starts, and the speaker and time for that line. */
export function locateQuote(source: ShapeSource, participants: string[], quote: string): LocatedQuote | null {
  const lines = source.text.split(/\r?\n/);
  const qWords = normaliseText(quote).split(' ').filter(Boolean);
  if (qWords.length < MIN_MATCH_WORDS) return null;
  const normLines = lines.map((l) => ` ${normaliseText(l)} `);
  // Try the longest leading run of the quote that is found on one line.
  let found = -1;
  for (let n = Math.min(qWords.length, 12); n >= MIN_MATCH_WORDS && found < 0; n--) {
    const probe = ` ${qWords.slice(0, n).join(' ')} `;
    found = normLines.findIndex((l) => l.includes(probe));
  }
  if (found < 0) found = locateInColumns(source.text, qWords.join(' '));
  if (found < 0) return null;
  const out: LocatedQuote = { line: found + 1 };
  if (source.kind !== 'transcript') return out;
  // Speaker and time: the quote's own line, or the nearest header line above it.
  for (let i = found; i >= 0 && i >= found - 3; i--) {
    const raw = lines[i];
    const lower = raw.toLowerCase();
    const who = participants.find((p) => {
      const pl = p.toLowerCase();
      const idx = lower.indexOf(pl);
      if (idx < 0) return false;
      const before = lower.slice(0, idx).replace(/\[[^\]]*\]/g, '').trim();
      return before === '' || /^\d{1,2}:\d{2}(:\d{2})?$/.test(before);
    });
    if (who) {
      out.speaker = who;
      const t = raw.match(TIME_RE);
      if (t) out.timestamp = t[1];
      break;
    }
  }
  return out;
}

function evidenceFor(item: Record<string, any>, src: { id: string; name: string }, source: ShapeSource, participants: string[]): Evidence[] {
  const quotes: string[] = [];
  if (typeof item.source_quote === 'string' && item.source_quote.trim()) quotes.push(item.source_quote);
  for (const e of Array.isArray(item.evidence) ? item.evidence : []) {
    if (e && typeof e.quote === 'string' && !quotes.includes(e.quote)) quotes.push(e.quote);
  }
  const out: Evidence[] = [];
  for (const q of quotes) {
    const at = locateQuote(source, participants, q);
    if (!at) continue;
    const ev: Evidence = { sourceId: src.id, sourceName: src.name, line: at.line, quote: q };
    if (at.timestamp) ev.timestamp = at.timestamp;
    if (at.speaker) ev.speaker = at.speaker;
    out.push(ev);
  }
  return out;
}

const pad = (p: string, i: number) => `${p}${String(i + 1).padStart(2, '0')}`;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function isoDate(v: unknown): string | undefined {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

/**
 * Turns a merged record (rule record with model items swapped in) into a full,
 * consistent MeetingModel. Items that cannot be located in the source by line
 * are dropped and counted in a warning, so every exported item carries a real
 * line reference.
 */
export function shapeModelRecord<T extends MeetingModel>(merged: T, source: ShapeSource): T {
  const m: any = merged;
  const src = Array.isArray(m.sources) && m.sources[0] ? { id: m.sources[0].id, name: m.sources[0].name } : { id: 'S1', name: source.name ?? 'source' };
  const participants: string[] = (m.participants ?? []).map((p: any) => p?.name).filter((n: unknown): n is string => typeof n === 'string' && n.trim() !== '');
  let unlocated = 0;
  const ev = (item: Record<string, any>) => {
    const e = evidenceFor(item, src, source, participants);
    if (e.length === 0) unlocated++;
    return e;
  };
  const fullName = (name: unknown): string | undefined => {
    const s = str(name);
    if (!s) return undefined;
    const lower = s.toLowerCase();
    return participants.find((p) => p.toLowerCase() === lower) ?? participants.find((p) => p.toLowerCase().split(' ')[0] === lower) ?? s;
  };

  const decisions: Decision[] = [];
  for (const d of m.decisions ?? []) {
    const e = ev(d);
    if (!e.length) continue;
    const statement = str(d.statement) ?? e[0].quote;
    decisions.push({
      ...d,
      id: pad('D', decisions.length),
      statement,
      title: str(d.title) ?? statement,
      calledBy: fullName(d.calledBy ?? d.decided_by) ?? e[0].speaker,
      decided_by: fullName(d.decided_by ?? d.calledBy) ?? e[0].speaker ?? null,
      conditions: str(d.conditions) ?? null,
      at: str(d.at) ?? e[0].timestamp ?? null,
      source_quote: str(d.source_quote) ?? e[0].quote,
      display_quote: str(d.display_quote) ?? str(d.source_quote) ?? e[0].quote,
      status: d.status === 'conditional' ? 'conditional' : 'agreed',
      evidence: e,
      confidence: d.confidence === 'inferred' ? 'inferred' : 'explicit',
      review: d.review === 'confirmed' || d.review === 'excluded' ? d.review : 'proposed',
    });
  }

  const actions: Action[] = [];
  for (const a of m.actions ?? []) {
    const e = ev(a);
    if (!e.length) continue;
    const owner = fullName(a.owner);
    const due = isoDate(a.due) ?? isoDate(a.due_date);
    actions.push({
      ...a,
      id: pad('A', actions.length),
      task: str(a.task) ?? e[0].quote,
      owner,
      ownerBasis: owner ? 'stated' : 'none',
      owner_basis: owner ? 'Named in the source' : null,
      due,
      due_date: due ?? null,
      dueText: str(a.dueText) ?? str(a.due_raw),
      due_raw: str(a.due_raw) ?? str(a.dueText) ?? null,
      dueApprox: a.dueApprox === true || a.due_approximate === true,
      due_approximate: a.dueApprox === true || a.due_approximate === true,
      dueBasis: due ? 'stated' : 'none',
      horizon: 'undated',
      at: str(a.at) ?? e[0].timestamp ?? null,
      source_quote: str(a.source_quote) ?? e[0].quote,
      display_quote: str(a.display_quote) ?? str(a.source_quote) ?? e[0].quote,
      sourceQuote: str(a.source_quote) ?? e[0].quote,
      sourceLine: e[0].line,
      evidence: e,
      confidence: a.confidence === 'inferred' ? 'inferred' : 'explicit',
      gaps: [],
      review: a.review === 'confirmed' || a.review === 'excluded' ? a.review : 'proposed',
    });
  }

  const risks: Risk[] = [];
  for (const r of m.risks ?? []) {
    const e = ev(r);
    if (!e.length) continue;
    const raisedBy = fullName(r.raisedBy ?? r.raised_by) ?? e[0].speaker;
    risks.push({
      ...r,
      id: pad('R', risks.length),
      risk: str(r.risk) ?? e[0].quote,
      raisedBy,
      raised_by: raisedBy ?? null,
      at: str(r.at) ?? e[0].timestamp ?? null,
      source_quote: str(r.source_quote) ?? e[0].quote,
      display_quote: str(r.display_quote) ?? str(r.source_quote) ?? e[0].quote,
      likelihood: Number.isInteger(r.likelihood) && r.likelihood >= 1 && r.likelihood <= 5 ? r.likelihood : 3,
      consequence: Number.isInteger(r.consequence) && r.consequence >= 1 && r.consequence <= 5 ? r.consequence : 3,
      rating: ['high', 'medium', 'low'].includes(r.rating) ? r.rating : 'not_rated',
      evidence: e,
      review: r.review === 'confirmed' || r.review === 'excluded' ? r.review : 'proposed',
    });
  }

  const openQuestions: OpenQuestionItem[] = [];
  const openItems: OpenItem[] = [];
  for (const q of m.open_questions ?? []) {
    const e = ev(q);
    if (!e.length) continue;
    const question = str(q.question) ?? e[0].quote;
    const raisedBy = fullName(q.raised_by ?? q.raisedBy) ?? e[0].speaker;
    openQuestions.push({
      ...q,
      question,
      raised_by: raisedBy ?? '',
      who_can_answer: str(q.who_can_answer) ?? null,
      status: str(q.status) ?? 'Not answered',
      at: str(q.at) ?? e[0].timestamp ?? null,
      source_quote: str(q.source_quote) ?? e[0].quote,
    });
    openItems.push({
      id: pad('Q', openItems.length),
      question,
      kind: 'unresolved',
      raisedBy,
      raised_by: raisedBy ?? null,
      at: str(q.at) ?? e[0].timestamp ?? null,
      source_quote: str(q.source_quote) ?? e[0].quote,
      display_quote: str(q.source_quote) ?? e[0].quote,
      evidence: e,
      review: 'proposed',
    });
  }

  const insights: InsightItem[] = [];
  for (const i of m.insights ?? []) {
    const e = ev(i);
    if (!e.length) continue;
    const kind = INSIGHT_KINDS.has(i.kind) ? i.kind : i.kind === 'feedback_negative' || i.kind === 'disagreement' ? 'concern' : 'context';
    insights.push({
      ...i,
      kind,
      who: fullName(i.who) ?? e[0].speaker ?? '',
      insight: str(i.insight) ?? e[0].quote,
      at: str(i.at) ?? e[0].timestamp ?? null,
      source_quote: str(i.source_quote) ?? e[0].quote,
      audience: i.audience === 'shareable' ? 'shareable' : 'internal',
      evidence: e,
    } as InsightItem);
  }

  const statements: StatementToVerify[] = [];
  for (const s of m.statements_to_verify ?? []) {
    const e = ev(s);
    if (!e.length) continue;
    statements.push({
      ...s,
      said_by: fullName(s.said_by ?? s.who) ?? e[0].speaker ?? '',
      statement: str(s.statement) ?? e[0].quote,
      why_check: str(s.why_check) ?? 'Hedged or absolute claim. Check it before relying on it.',
      at: str(s.at) ?? e[0].timestamp ?? null,
      source_quote: str(s.source_quote) ?? e[0].quote,
      evidence: e,
    } as StatementToVerify);
  }

  m.decisions = decisions;
  m.actions = actions;
  m.risks = risks;
  m.open_questions = openQuestions;
  m.openItems = openItems;
  m.insights = insights;
  m.statements_to_verify = statements;
  // Figures and recommendations described the rule engine's items. Figures are kept
  // (they are quotes with their own evidence); recommendations are rebuilt by refresh().
  // refresh() needs the engine's own record parts. Every record from analyseMeeting() has them;
  // a hand-built record without them is shaped but not refreshed.
  if (m.health && m.signals && m.meta && Array.isArray(m.participants)) refresh(m as MeetingModel);
  // The rule engine can leave a stale 'consent_not_recorded' warning after consent was found.
  if (m.consent && m.consent.asked_by && Array.isArray(m.warnings)) m.warnings = m.warnings.filter((w: unknown) => w !== 'consent_not_recorded');
  // Likewise the rule engine's note about missing speaker labels no longer applies once drafted actions carry owners.
  if (Array.isArray(m.warnings) && actions.some((a) => a.owner)) m.warnings = m.warnings.filter((w: unknown) => !(typeof w === 'string' && w.startsWith('No speaker labels found.')));
  if (unlocated > 0) {
    const w: string[] = Array.isArray(m.warnings) ? m.warnings : [];
    w.push(`Model draft: ${unlocated} item${unlocated === 1 ? ' was' : 's were'} removed because the quote could not be placed on a source line.`);
    m.warnings = w;
  }
  return merged;
}
