/**
 * Turns an approved deck payload into an ordered list of slides.
 *
 * Both renderers (PPTX and the HTML print view used for PDF) draw from this
 * plan, so the editable deck and the PDF always carry the same slides, the
 * same wording and the same page breaks. Nothing here invents content: every
 * line is either a payload field, a count of confirmed items, or a fixed
 * label that states a gap ("Not stated").
 */
import {
  DeckAction,
  DeckDecision,
  DeckOptions,
  DeckPayload,
  DeckQuestion,
  DeckRisk,
  SourceRef,
  live,
  validateDeck,
} from './deckPayload';

/* ------------------------------------------------------------------ */
/* Geometry shared by both renderers (inches, 16:9, 13.333 x 7.5)      */
/* ------------------------------------------------------------------ */

export const PAGE = { w: 13.333, h: 7.5 };
export const M = { x: 0.76, contentW: 11.81 };
export const TABLE_TOP = 2.05;
export const TABLE_BOTTOM = 6.7;
export const HEADER_ROW = 0.42;

export const DECISION_COLS = [0.9, 6.0, 2.45, 2.46]; // ID, Decision, Decided by, Conditions
export const ACTION_COLS = [0.9, 4.15, 2.45, 1.7, 2.61]; // ID, Action, Owner, By, Done when
export const BODY_PT = 14;
export const SOURCE_PT = 9;

export const MAX_DECISIONS_PER_SLIDE = 5;
export const MAX_ACTIONS_PER_SLIDE = 6;

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

/** Brand rule: no en or em dashes reach a slide, whatever the source said. */
export function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/(\d)\s*\u2013\s*(\d)/g, '$1 to $2')
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numberWord = (n: number) => (n <= 10 ? NUMBER_WORDS[n] : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function partsUTC(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, dow: t.getUTCDay() };
}
/** Wednesday 28 October 2026 */
export function longDate(iso: string): string {
  const p = partsUTC(iso);
  return `${DAYS[p.dow]} ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}
/** Wed 4 Nov */
export function shortDay(iso: string): string {
  const p = partsUTC(iso);
  return `${DAYS[p.dow].slice(0, 3)} ${p.d} ${MONTHS[p.m - 1].slice(0, 3)}`;
}
/** 28 Oct 2026 */
export function shortDate(iso: string): string {
  const p = partsUTC(iso);
  return `${p.d} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y}`;
}
/** Thursday 5 November */
export function dayMonth(iso: string): string {
  const p = partsUTC(iso);
  return `${DAYS[p.dow]} ${p.d} ${MONTHS[p.m - 1]}`;
}
/** 28 Oct 2026, 4:12 pm, Melbourne time */
export function approvalStamp(atISO: string): string {
  const d = new Date(atISO);
  const f = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d);
  const g = (t: string) => f.find((x) => x.type === t)?.value ?? '';
  return `${g('day')} ${g('month')} ${g('year')}, ${g('hour')}:${g('minute')} ${g('dayPeriod').toLowerCase().replace(/\./g, '')}`;
}

export function sourceLabel(id: string, s: SourceRef): string {
  const bits = [id];
  if (s.line != null) bits.push(`line ${s.line}`);
  if (s.time) bits.push(s.time);
  return bits.join(' · ');
}

/** Lines a string wraps to in a column of the given width. Deliberately pessimistic. */
export function estimateLines(text: string, widthIn: number, pt: number): number {
  if (!text) return 1;
  const usable = Math.max(widthIn - 0.2, 0.4);
  const perLine = Math.max(Math.floor((usable * 72) / (pt * 0.56)), 4);
  let lines = 0;
  for (const para of text.split('\n')) {
    let line = 0;
    lines += 1;
    for (const word of para.split(' ')) {
      const add = (line ? 1 : 0) + word.length;
      if (line + add > perLine && line > 0) { lines += 1; line = word.length; } else line += add;
    }
  }
  return lines;
}

const LINE_IN = (pt: number) => (pt * 1.25) / 72;
const ROW_PAD = 0.2;

/* ------------------------------------------------------------------ */
/* Slide specs                                                         */
/* ------------------------------------------------------------------ */

export interface Footer { left: string; page: number; logo: boolean; preparedWith: boolean }

export interface CoverSlide {
  kind: 'cover'; footer: Footer;
  kicker: string; title: string; outcome: string | null; metaLine: string;
  counts: { label: string; value: number }[];
  preparedBy: string; approved: string; recordLine: string; classification: string;
}
export interface BottomCard { label: string; text: string; source: string; accent: boolean }
export interface BottomSlide { kind: 'bottom'; footer: Footer; headline: string; cards: BottomCard[]; body: string | null }
export interface DecisionRow { id: string; text: string; source: string; quote: string | null; decidedBy: string | null; decidedByOrg: string | null; conditions: string | null }
export interface DecisionsSlide { kind: 'decisions'; footer: Footer; headline: string; continued: boolean; rows: DecisionRow[] }
export interface ActionRow { id: string; text: string; owner: string | null; clientSide: boolean; due: string | null; doneWhen: string | null; first: boolean }
export interface ActionsSlide { kind: 'actions'; footer: Footer; headline: string; continued: boolean; rows: ActionRow[] }
export interface OpenItem { id: string; text: string; detail: string }
export interface OpenSlide { kind: 'open'; footer: Footer; headline: string; continued: boolean; questions: OpenItem[]; risks: OpenItem[] }
export interface NextSlide {
  kind: 'next'; footer: Footer; kicker: string; headline: string;
  mustProduce: string | null; bring: string[]; fallback: string | null;
  correction: { deadline: string; contact: string } | null;
}
export type SlideSpec = CoverSlide | BottomSlide | DecisionsSlide | ActionsSlide | OpenSlide | NextSlide;

export interface DeckPlan { slides: SlideSpec[]; fileName: string; title: string }

export class DeckExportBlocked extends Error {
  constructor(public readonly reasons: string[]) {
    super(`Deck export blocked: ${reasons.join(' ')}`);
  }
}

/* ------------------------------------------------------------------ */
/* Planner                                                             */
/* ------------------------------------------------------------------ */

export function planDeck(p: DeckPayload, opts: DeckOptions = {}): DeckPlan {
  const v = validateDeck(p);
  if (!v.ok) throw new DeckExportBlocked(v.errors);
  const items = live(p);
  const client = clean(p.meeting.client) || null;
  const quotes = opts.quotes ?? false;
  const footerLeft = [client ?? clean(p.meeting.title), p.meeting.dateISO ? shortDate(p.meeting.dateISO) : null, `record v${p.meeting.version}`]
    .filter(Boolean).join(' · ');

  const slides: any[] = [];
  const push = (s: any) => slides.push(s);

  /* 01 Cover */
  const meta = [
    p.meeting.dateISO ? longDate(p.meeting.dateISO) : null,
    p.meeting.durationMinutes ? `${p.meeting.durationMinutes} minutes` : null,
    clean(p.meeting.format) || null,
  ].filter(Boolean).join('  ·  ');
  push({
    kind: 'cover',
    kicker: [clean(p.meeting.kind), client].filter(Boolean).join('  ·  '),
    title: clean(p.meeting.title),
    outcome: clean(p.meeting.outcomeLine) || null,
    metaLine: meta,
    counts: [
      { label: 'Decisions', value: items.decisions.length },
      { label: 'Actions', value: items.actions.length },
      { label: 'Not settled', value: items.openQuestions.length + items.risks.length },
    ],
    preparedBy: `Prepared by ${clean(p.preparedBy.name)}${p.preparedBy.organisation ? `, ${clean(p.preparedBy.organisation)}` : ''}`,
    approved: `Reviewed and approved ${approvalStamp(p.approval!.atISO)}`,
    recordLine: `Record ${clean(p.meeting.recordId)} · version ${p.meeting.version}`,
    classification: clean(p.classification) || 'Commercial in confidence',
  });

  /* Sort actions: dated first, earliest first; undated last in record order. */
  const actions = [...items.actions].sort((a, b) => {
    if (a.dueISO && b.dueISO) return a.dueISO < b.dueISO ? -1 : a.dueISO > b.dueISO ? 1 : 0;
    if (a.dueISO) return -1;
    if (b.dueISO) return 1;
    return 0;
  });
  const firstAction = actions[0] ?? null;

  /* 02 Bottom line */
  const cards: BottomCard[] = [];
  const d0 = items.decisions[0];
  if (d0) cards.push({ label: 'What was decided', text: clean(d0.text), source: sourceLabel(d0.id, d0.source), accent: true });
  if (firstAction) {
    const who = firstAction.owner ? clean(firstAction.owner) : 'Owner not stated';
    const when = firstAction.dueISO ? shortDay(firstAction.dueISO) : 'date not stated';
    cards.push({ label: 'What happens first', text: clean(firstAction.text), source: `${firstAction.id} · ${who} · ${when}`, accent: false });
  }
  const q0 = items.openQuestions[0];
  if (q0) cards.push({ label: 'What is still open', text: clean(q0.text), source: sourceLabel(q0.id, q0.source), accent: false });
  else if (items.risks.length === 0 && p.nothingLeftOpenConfirmed)
    cards.push({ label: 'What is still open', text: 'Nothing left open', source: 'Confirmed in review', accent: false });
  if (!cards.some((c) => c.accent) && cards.length) cards[0].accent = true;

  const empty = items.decisions.length + items.actions.length + items.openQuestions.length + items.risks.length === 0;
  push({
    kind: 'bottom',
    headline: clean(p.summary.headline) || (empty ? 'No decisions, actions or open questions were recorded' : ''),
    cards,
    body: clean(p.summary.body) || null,
  });

  /* 03 Decisions */
  if (items.decisions.length) {
    const n = items.decisions.length;
    const org = client;
    const allByClient = !!org && items.decisions.every((d) => d.decidedByOrg && clean(d.decidedByOrg) === org);
    const headline = `${cap(numberWord(n))} decision${n === 1 ? ' was' : 's were'} made${allByClient ? `, ${n === 1 ? 'by' : 'all by'} ${org}` : ''}`;
    const rows: DecisionRow[] = items.decisions.map((d) => ({
      id: d.id,
      text: clean(d.text),
      source: sourceLabel(d.id, d.source).split(' · ').slice(1).join(' · ') || 'Source line not recorded',
      quote: quotes && d.source.quote ? clean(d.source.quote) : null,
      decidedBy: clean(d.decidedBy) || null,
      decidedByOrg: d.decidedByOrg && clean(d.decidedByOrg) !== '' ? clean(d.decidedByOrg) : null,
      conditions: clean(d.conditions) || null,
    }));
    paginate(rows, decisionRowHeight, MAX_DECISIONS_PER_SLIDE).forEach((chunk, i) =>
      push({ kind: 'decisions', headline: i === 0 ? headline : 'Decisions, continued', continued: i > 0, rows: chunk }),
    );
  }

  /* 04 Actions */
  if (actions.length) {
    const n = actions.length;
    const owedByClient = actions.filter((a) => a.clientSide).length;
    const headline = `${cap(numberWord(n))} action${n === 1 ? '' : 's'}${owedByClient && client ? `, ${numberWord(owedByClient)} owed by ${client}` : ' agreed'}`;
    const rows: ActionRow[] = actions.map((a) => ({
      id: a.id,
      text: clean(a.text),
      owner: clean(a.owner) || null,
      clientSide: a.clientSide,
      due: a.dueISO ? shortDay(a.dueISO) : null,
      doneWhen: clean(a.doneWhen) || null,
      first: firstAction?.id === a.id && !!a.dueISO,
    }));
    paginate(rows, actionRowHeight, MAX_ACTIONS_PER_SLIDE).forEach((chunk, i) =>
      push({ kind: 'actions', headline: i === 0 ? headline : 'Actions, continued', continued: i > 0, rows: chunk }),
    );
  }

  /* 05 What was not settled */
  const qs: OpenItem[] = items.openQuestions.map((q) => ({
    id: q.id,
    text: clean(q.text),
    detail: [
      q.resolver ? `${clean(q.resolver)} to answer` : 'Owner not stated',
      q.neededByISO ? `by ${shortDay(q.neededByISO)}` : null,
      q.source.line != null ? `line ${q.source.line}` : null,
    ].filter(Boolean).join(' · '),
  }));
  const rs: OpenItem[] = items.risks.map((r) => ({
    id: r.id,
    text: clean(r.text),
    detail: [
      r.raisedBy ? `Raised by ${clean(r.raisedBy)}` : 'Raised in the meeting',
      r.mitigationIds.length ? `mitigation: ${r.mitigationIds.join(', ')}` : 'no mitigation recorded',
      r.source.line != null ? `line ${r.source.line}` : null,
    ].filter(Boolean).join(' · '),
  }));
  if (qs.length || rs.length) {
    const parts: string[] = [];
    if (qs.length) parts.push(`${numberWord(qs.length)} question${qs.length === 1 ? '' : 's'}`);
    if (rs.length) parts.push(`${numberWord(rs.length)} risk${rs.length === 1 ? '' : 's'}`);
    const total = qs.length + rs.length;
    const headline = `${cap(parts.join(' and '))} ${total === 1 ? 'is' : 'are'} still open`;
    const qPages = paginate(qs, openItemHeight, 99);
    const rPages = paginate(rs, openItemHeight, 99);
    const pages = Math.max(qPages.length, rPages.length);
    for (let i = 0; i < pages; i++)
      push({ kind: 'open', headline: i === 0 ? headline : 'Still open, continued', continued: i > 0, questions: qPages[i] ?? [], risks: rPages[i] ?? [] });
  }

  /* 06 Next meeting and close */
  const nm = p.nextMeeting;
  const correction = p.correctionDeadline ? { deadline: clean(p.correctionDeadline.label), contact: clean(p.correctionDeadline.contact) } : null;
  if (nm && nm.dateISO) {
    const when = `${dayMonth(nm.dateISO)}${nm.timeLabel ? `, ${clean(nm.timeLabel)}` : ''}`;
    push({
      kind: 'next', kicker: 'Next meeting', headline: when,
      mustProduce: clean(nm.mustProduce) || null,
      bring: nm.bringIds.filter((id) => items.actions.some((a) => a.id === id)).map((id) => {
        const a = items.actions.find((x) => x.id === id)!;
        return `${clean(a.text)}  ${a.id}`;
      }),
      fallback: null, correction,
    });
  } else {
    const firstDated = actions.find((a) => a.dueISO);
    push({
      kind: 'next', kicker: 'Next step', headline: 'No next meeting set',
      mustProduce: null, bring: [],
      fallback: firstDated
        ? `First dated action: ${firstDated.id} ${clean(firstDated.text)}, ${firstDated.owner ? clean(firstDated.owner) : 'owner not stated'}, ${shortDay(firstDated.dueISO!)}`
        : null,
      correction,
    });
  }

  /* Footers */
  const total = slides.length;
  const finished = slides.map((s, i) => ({
    ...s,
    footer: {
      left: footerLeft,
      page: i + 1,
      logo: s.kind !== 'cover' && s.kind !== 'open',
      preparedWith: (opts.preparedWith ?? true) && i === total - 1,
    },
  })) as SlideSpec[];

  const slug = (client ?? p.meeting.title).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return {
    slides: finished,
    title: clean(p.meeting.title),
    fileName: `${slug}_${p.meeting.dateISO ?? 'undated'}_v${p.meeting.version}`,
  };
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

function decisionRowHeight(r: DecisionRow): number {
  const [, wText, wBy, wCond] = DECISION_COLS;
  const main = estimateLines(r.text, wText, BODY_PT) + 1 + (r.quote ? estimateLines(`"${r.quote}"`, wText, SOURCE_PT) * 0.7 : 0);
  const by = estimateLines(r.decidedBy ?? 'Not stated', wBy, BODY_PT) + (r.decidedByOrg ? 0.8 : 0);
  const cond = estimateLines(r.conditions ?? 'None stated', wCond, BODY_PT);
  return Math.max(main, by, cond) * LINE_IN(BODY_PT) + ROW_PAD;
}

function actionRowHeight(r: ActionRow): number {
  const [, wText, wOwner, , wDone] = ACTION_COLS;
  const lines = Math.max(
    estimateLines(r.text, wText, BODY_PT),
    estimateLines((r.owner ?? 'Not stated') + (r.clientSide ? ' CLIENT' : ''), wOwner, BODY_PT),
    estimateLines(r.doneWhen ?? 'Not stated', wDone, BODY_PT),
  );
  return lines * LINE_IN(BODY_PT) + ROW_PAD;
}

export const OPEN_COL_W = (M.contentW - 0.5) / 2;
export const OPEN_TOP = 2.15;
function openItemHeight(i: OpenItem): number {
  return 0.3 + estimateLines(i.text, OPEN_COL_W, 16) * LINE_IN(16) + 0.32 + 0.18;
}

function paginate<T>(rows: T[], height: (r: T) => number, maxRows: number): T[][] {
  const pages: T[][] = [];
  const avail = TABLE_BOTTOM - TABLE_TOP - HEADER_ROW;
  let cur: T[] = [];
  let used = 0;
  for (const r of rows) {
    const h = height(r);
    if (cur.length && (used + h > avail || cur.length >= maxRows)) { pages.push(cur); cur = []; used = 0; }
    cur.push(r);
    used += h;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export type { DeckAction, DeckDecision, DeckQuestion, DeckRisk };
