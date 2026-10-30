/**
 * Concludo Meeting Engine v2
 * ---------------------------------------------------------------------------
 * Deterministic, evidence-linked extraction of meeting outcomes from pasted
 * transcripts, notes and imported documents.
 *
 * Replaces lib/intelligence/transcriptExtractor.ts and the hard-coded parts of
 * lib/reporting/payloadBuilder.ts. Design rules:
 *
 *  1. Nothing is invented. Every decision, action, risk, open item and figure
 *     carries the verbatim quote, source, line and timestamp it came from.
 *     Missing owners, dates and definitions of done are reported as gaps,
 *     never filled with defaults.
 *  2. Concludo proposes; a person disposes. Every item starts as "proposed"
 *     and the studio asks a person to confirm, edit or exclude it.
 *  3. Measure work, never people. Health is meeting-level and aggregate.
 *     No per-person scores, rankings or airtime figures leave this module.
 *  4. Dates are handled as calendar dates (YYYY-MM-DD) with UTC arithmetic,
 *     so no timezone drift for Australian users.
 *
 * Framework free: no React, no Supabase. Safe to run in the browser, in a
 * worker or on the server.
 */

/* ------------------------------------------------------------------ types */

export interface SourceInput {
  name: string;
  kind: 'transcript' | 'notes' | 'document';
  text: string;
}

export interface MeetingMetaInput {
  title?: string;
  meetingType?: string;
  organisation?: string;
  project?: string;
  meetingDate?: string; // YYYY-MM-DD
}

export interface Evidence {
  sourceId: string;
  sourceName: string;
  line: number;
  timestamp?: string;
  speaker?: string;
  quote: string;
}

export type Basis = 'stated' | 'speaker' | 'none';
export type Review = 'proposed' | 'confirmed' | 'excluded';

export interface Decision {
  id: string;
  statement: string;
  title: string;
  calledBy?: string;
  status: 'agreed' | 'conditional';
  condition?: string;
  evidence: Evidence[];
  confidence: 'explicit' | 'inferred';
  review: Review;
}

export interface Action {
  id: string;
  task: string;
  owner?: string;
  ownerBasis: Basis;
  due?: string;
  dueText?: string;
  dueApprox: boolean;
  horizon: 'now' | 'next' | 'later' | 'undated';
  doneDefinition?: string;
  evidence: Evidence[];
  confidence: 'explicit' | 'inferred';
  gaps: string[];
  review: Review;
}

export interface Risk {
  id: string;
  risk: string;
  raisedBy?: string;
  likelihood: number; // 1 to 5, indicative
  consequence: number; // 1 to 5, indicative
  rating: 'high' | 'medium' | 'low';
  mitigation?: string;
  statedResponse?: string;
  linkedAction?: string;
  evidence: Evidence[];
  review: Review;
}

export interface OpenItem {
  id: string;
  question: string;
  kind: 'approval' | 'deferred' | 'unresolved';
  raisedBy?: string;
  evidence: Evidence[];
  review: Review;
}

export interface Figure {
  value: string;
  context: string;
  evidence: Evidence;
}

export interface Participant {
  name: string;
  role?: string;
  present: boolean;
}

export interface HealthDimension {
  key: string;
  name: string;
  score: number | null;
  basis: string;
}

export interface GateCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface Recommendation {
  priority: 'Critical' | 'High' | 'Medium';
  title: string;
  why: string;
  ref?: string;
}

export interface SourceSummary {
  id: string;
  name: string;
  kind: SourceInput['kind'];
  words: number;
  lines: number;
  speakers: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
}

export interface MeetingModel {
  version: '2.0';
  meta: Required<Pick<MeetingMetaInput, 'title' | 'meetingType' | 'meetingDate'>> & {
    organisation?: string;
    project?: string;
    duration?: string;
    chair?: string;
  };
  sources: SourceSummary[];
  participants: Participant[];
  decisions: Decision[];
  actions: Action[];
  risks: Risk[];
  openItems: OpenItem[];
  figures: Figure[];
  recommendations: Recommendation[];
  health: { dimensions: HealthDimension[]; notScored: string[] };
  gate: { status: 'Ready to circulate' | 'Circulate after review' | 'Not ready'; checks: GateCheck[] };
  bottomLine: string;
  stats: {
    decisions: number;
    actions: number;
    owned: number;
    dated: number;
    openItems: number;
    risks: number;
    highRisks: number;
  };
  warnings: string[];
  signals: { balance: number | null; speakers: number; dateConfirmed: boolean };
  followUp?: {
    audience: 'internal' | 'client';
    correctionDeadline: string;
  };
}

/* -------------------------------------------------------------- constants */

const META_LABELS =
  /^(?:meeting|meeting title|title|subject|location|time|type|meeting type|date|meeting date|attendees?|present|apologies|absent|chair|organisation|organization|client|project|agenda|notes|summary|recording source|source|platform|decision|decisions|resolution|action|actions|action items?|risk|risks|open questions?|next meeting|minutes|duration|prepared by)$/i;

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const ACCEPT = /^(?:yes|yep|yeah|sure|will do|can do|on it|absolutely|definitely|no problem|happy to|of course|ok(?:ay)?,? (?:i'll|will)|leave it with me)\b/i;
const HEDGE_I = /\b(?:I'll|I will)\s+(?:be honest|admit|say|tell you|be quick|be brief|keep it short|hand (?:it )?(?:back|over) to|let you|pass|just say|stop there|leave it there)\b/i;

/* ------------------------------------------------------------ date utils */

function isoFromParts(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}
function monthIndex(word: string): number {
  const w = word.toLowerCase();
  if (w.length < 3) return -1;
  return MONTHS.findIndex((m) => m.startsWith(w.slice(0, 3)) && m.startsWith(w.replace(/\.$/, '')));
}
export function todayIso(): string {
  const d = new Date();
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Normalise a written date ("13 October 2026", "13/10/2026", "2026-10-13") to YYYY-MM-DD. */
export function normaliseDate(raw?: string | null, fallbackYear?: number): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return isoFromParts(+m[1], +m[2], +m[3]);
  m = t.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/); // Australian day first
  if (m) return isoFromParts(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  const year = fallbackYear ?? new Date().getFullYear();
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?(?:,?\s+(\d{4}))?\b/);
  if (m && monthIndex(m[2]) >= 0) return isoFromParts(m[3] ? +m[3] : year, monthIndex(m[2]) + 1, +m[1]);
  m = t.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/);
  if (m && monthIndex(m[1]) >= 0) return isoFromParts(m[3] ? +m[3] : year, monthIndex(m[1]) + 1, +m[2]);
  return undefined;
}

/**
 * Resolve a spoken deadline relative to the meeting date.
 * Returns the ISO date, the phrase as said, and whether the date is approximate.
 */
export function resolveDue(sentence: string, meetingDate: string): { iso?: string; text?: string; approx: boolean } | null {
  const s = sentence.toLowerCase();
  const base = parseIso(meetingDate);
  const baseDow = base.getUTCDay();
  const y = base.getUTCFullYear();
  const mo = base.getUTCMonth() + 1;

  const fridayOf = (iso: string) => {
    const dow = parseIso(iso).getUTCDay();
    return addDays(iso, ((5 - dow + 7) % 7));
  };
  const rollYear = (mi: number, day: number) => {
    let iso = isoFromParts(y, mi + 1, day);
    if (daysBetween(meetingDate, iso) < -31) iso = isoFromParts(y + 1, mi + 1, day);
    return iso;
  };

  const lead = String.raw`(?:by|before|due|until|no later than|on|for|from|in|this|next|over|at|around|ahead of|the)?\s*`;
  const rules: Array<[RegExp, (m: RegExpMatchArray) => { iso?: string; approx: boolean }]> = [
    [/\b(\d{4}-\d{2}-\d{2})\b/, (m) => ({ iso: m[1], approx: false })],
    [/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/, (m) => ({ iso: isoFromParts(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : y, +m[2], +m[1]), approx: false })],
    [/\b(?:the\s+)?week of (?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:of\s+)?([a-z]+))?/, (m) => {
      const mi = m[2] && monthIndex(m[2]) >= 0 ? monthIndex(m[2]) : (+m[1] < base.getUTCDate() ? mo % 12 : mo - 1);
      return { iso: rollYear(mi, +m[1]), approx: true };
    }],
    [/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:,?\s+(\d{4}))?/, (m) => ({ iso: m[3] ? isoFromParts(+m[3], monthIndex(m[2]) + 1, +m[1]) : rollYear(monthIndex(m[2]), +m[1]), approx: false })],
    [/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/, (m) => ({ iso: rollYear(monthIndex(m[1]), +m[2]), approx: false })],
    [/\b(early|mid|late|end of|start of|beginning of)\s+(jan(?:uary)?|feb(?:ruary)?|march|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/, (m) => {
      const mi = monthIndex(m[2]);
      const last = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate();
      const day = /early|start|beginning/.test(m[1]) ? 7 : m[1] === 'mid' ? 15 : m[1] === 'late' ? 25 : last;
      return { iso: rollYear(mi, day), approx: m[1] !== 'end of' };
    }],
    [/\b(?:end of|close of)\s+(?:the\s+)?(?:this\s+)?month\b|\beom\b/, () => ({ iso: isoFromParts(y, mo, new Date(Date.UTC(y, mo, 0)).getUTCDate()), approx: false })],
    [/\bend of next month\b/, () => ({ iso: isoFromParts(mo === 12 ? y + 1 : y, (mo % 12) + 1, new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()), approx: false })],
    [/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/, (m) => {
      const d = +m[1];
      const thisMonth = d >= base.getUTCDate();
      return { iso: thisMonth ? isoFromParts(y, mo, d) : isoFromParts(mo === 12 ? y + 1 : y, (mo % 12) + 1, d), approx: false };
    }],
    [/\b(?:today|tonight|end of (?:the )?day|eod|cob|close of business)\b/, () => ({ iso: meetingDate, approx: false })],
    [/\btomorrow\b/, () => ({ iso: addDays(meetingDate, 1), approx: false })],
    [/\b(?:end of (?:the |this )?week|this friday|eow)\b/, () => ({ iso: fridayOf(meetingDate), approx: false })],
    [/\bnext week\b/, () => ({ iso: addDays(fridayOf(meetingDate), 7), approx: true })],
    [/\bthis week\b/, () => ({ iso: fridayOf(meetingDate), approx: true })],
    [/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, (m) => {
      const target = DAY_NAMES.indexOf(m[2]);
      let diff = (target - baseDow + 7) % 7 || 7;
      if (m[1]) {
        // "next Monday": the one in the following Monday-to-Sunday week
        const isoDowBase = (baseDow + 6) % 7;
        const isoDowTarget = (target + 6) % 7;
        if (isoDowTarget > isoDowBase) diff += 7;
      }
      return { iso: addDays(meetingDate, diff), approx: false };
    }],
    [/\bin (\d+|two|three|four|six) weeks?\b/, (m) => {
      const n = ({ two: 2, three: 3, four: 4, six: 6 } as Record<string, number>)[m[1]] ?? +m[1];
      return { iso: addDays(meetingDate, n * 7), approx: true };
    }],
    [/\bnext month\b/, () => ({ iso: isoFromParts(mo === 12 ? y + 1 : y, (mo % 12) + 1, 15), approx: true })],
  ];

  for (const [re, fn] of rules) {
    const m = s.match(re);
    if (m) {
      // Only treat as a deadline when the phrase follows a deadline word or is clearly a date.
      const idx = m.index ?? 0;
      const before = s.slice(Math.max(0, idx - 22), idx);
      const deadlineCue = /(by|before|due|until|no later than|on|for|this|next|over|ahead of|end of|the week of|week of|in|from)\s*(the\s*)?$/.test(before) || /^(today|tomorrow|tonight|eod|cob|end of|close of|this|next|early|mid|late|start of|beginning of|(?:the\s+)?week of|in \w+ weeks?)/.test(m[0]);
      if (!deadlineCue && !/^\d{4}-|^\d{1,2}[/.]/.test(m[0])) continue;
      const r = fn(m);
      const text = sentence.substr(idx, m[0].length);
      return { iso: r.iso, text: text.trim(), approx: r.approx };
    }
  }
  void lead;
  return null;
}

/* ------------------------------------------------------- text utilities */

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').trim();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const stripEnd = (s: string) => s.replace(/[\s,;:.!?]+$/, '');
const words = (s: string) => s.toLowerCase().match(/[a-z0-9$%']+/g) ?? [];
const STOP = new Set('the a an to of and or for on in at by with we i you it is be this that our will can just so then also all'.split(' '));
function similarity(a: string, b: string): number {
  const A = new Set(words(a).filter((w) => !STOP.has(w)));
  const B = new Set(words(b).filter((w) => !STOP.has(w)));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / Math.min(A.size, B.size);
}
function shorten(s: string, max = 90): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}
function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+(?=["'“‘(]?[A-Z0-9$])/g, '$1\u0001')
    .split('\u0001')
    .map((s) => s.trim())
    .filter(Boolean);
}
/** Remove filler at the front of a clause: "Okay, so, look, I think ..." */
function deFill(s: string): string {
  return s.replace(/^(?:(?:okay|ok|right|so|look|well|yeah|yes|and|but|great|cool|sure|alright|fine|good|perfect)[,.]?\s+)+/i, '');
}
function firstPersonToTask(task: string, owner?: string): string {
  let t = task
    .replace(/\bmy\b/gi, owner ? `${owner.split(' ')[0]}'s` : 'the')
    .replace(/\bme\b/gi, owner ? owner.split(' ')[0] : 'the owner')
    .replace(/\bourselves\b/gi, 'the team');
  t = t.replace(/\s+(?:as well|too|then|for you|for everyone|okay|ok)$/i, '');
  return cap(stripEnd(t));
}

/* ---------------------------------------------------------------- parse */

interface Turn {
  sourceId: string;
  sourceName: string;
  sourceKind: SourceInput['kind'];
  line: number;
  timestamp?: string;
  speaker?: string;
  text: string;
}

interface HeaderInfo {
  title?: string;
  date?: string;
  type?: string;
  organisation?: string;
  project?: string;
  chair?: string;
  time?: string;
  attendees: Participant[];
}

function splitPeople(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/\band\b/i, '').trim()).filter((s) => s && !/^(?:nil|none|n\/a)$/i.test(s));
}
function parsePerson(raw: string, present: boolean): Participant | null {
  const m = raw.match(/^([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3})\s*(?:\(([^)]+)\)|[-,]\s*(.+))?$/);
  if (!m) return null;
  return { name: m[1].trim(), role: (m[2] || m[3] || '').trim() || undefined, present };
}

function parseHeader(text: string): HeaderInfo {
  const info: HeaderInfo = { attendees: [] };
  const lines = text.split(/\r?\n/).slice(0, 60);
  let inAttendeeList = false;
  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) {
      inAttendeeList = false;
      continue;
    }
    if (inAttendeeList && /^[-*•]\s+/.test(line)) {
      const p = parsePerson(line.replace(/^[-*•]\s+/, ''), true);
      if (p) info.attendees.push(p);
      continue;
    }
    const m = line.match(/^(?:#+\s*)?([A-Za-z ]{3,22}):\s*(.*)$/);
    if (!m) {
      if (!info.title && /^#\s+/.test(line)) info.title = line.replace(/^#+\s*/, '').trim();
      continue;
    }
    const label = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (/^(?:meeting|meeting title|title|subject)$/.test(label) && val) info.title = val;
    else if (/^(?:date|meeting date)$/.test(label)) info.date = normaliseDate(val);
    else if (/^(?:type|meeting type)$/.test(label)) info.type = val;
    else if (/^(?:organisation|organization|client|company)$/.test(label)) info.organisation = val;
    else if (label === 'project') info.project = val;
    else if (label === 'chair') info.chair = val.replace(/\s*\(.*$/, '');
    else if (/^(?:time|duration)$/.test(label)) info.time = val;
    else if (/^(?:attendees?|present|participants)$/.test(label)) {
      if (!val) inAttendeeList = true;
      for (const p of splitPeople(val)) {
        const person = parsePerson(p, true);
        if (person) info.attendees.push(person);
      }
    } else if (/^(?:apologies|absent)$/.test(label)) {
      for (const p of splitPeople(val)) {
        const person = parsePerson(p, false);
        if (person) info.attendees.push(person);
      }
    }
  }
  const chairFromRole = info.attendees.find((a) => a.role && /\bchair\b/i.test(a.role));
  if (!info.chair && chairFromRole) info.chair = chairFromRole.name;
  return info;
}

const TURN_RE =
  /^\s*(?:[-*•]\s*)?(?:\[?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d+)?\]?\s*[-–]?\s*)?(?:\*\*)?([A-Z][A-Za-z0-9'.-]*(?:\s+[A-Z][A-Za-z0-9'.-]*){0,3})(?:\*\*)?\s*(?:\(([^)]{1,40})\))?\s*(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.+)$/;

function parseTurns(src: SourceInput, sourceId: string): Turn[] {
  const turns: Turn[] = [];
  const lines = src.text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || /^(?:WEBVTT|NOTE)\b/.test(line) || /-->/.test(line) || /^\d+$/.test(line) || /^-{3,}$/.test(line)) return;
    const m = src.kind === 'document' ? null : line.match(TURN_RE);
    if (m && !META_LABELS.test(m[2].trim()) && m[2].split(/\s+/).length <= 4) {
      turns.push({ sourceId, sourceName: src.name, sourceKind: src.kind, line: i + 1, timestamp: m[1], speaker: m[2].trim(), text: m[4].trim() });
      return;
    }
    const tsOnly = line.match(/^\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s+(.+)$/);
    const prev = turns[turns.length - 1];
    // Continuation of a speaker turn (wrapped line) when the previous turn is the line before.
    if (prev && prev.speaker && prev.line === i && !/^(?:#|[-*•]|\d+[.)])/.test(line) && !/^[A-Za-z ]{3,22}:/.test(line)) {
      prev.text += ' ' + line;
      prev.line = prev.line; // keep start line
      (prev as Turn & { end?: number }).end = i + 1;
      return;
    }
    turns.push({ sourceId, sourceName: src.name, sourceKind: src.kind, line: i + 1, timestamp: tsOnly?.[1], text: (tsOnly?.[2] ?? line).replace(/^#+\s*/, '').trim() });
  });
  return turns;
}

/* -------------------------------------------------------------- extract */

export function analyseMeeting(inputs: SourceInput[], metaIn: MeetingMetaInput = {}): MeetingModel {
  const warnings: string[] = [];
  const usable = inputs.filter((s) => s.text && s.text.trim().length > 0);
  if (!usable.length) throw new Error('Add a transcript, notes or a document before generating.');

  const sources: SourceSummary[] = [];
  const allTurns: Turn[] = [];
  const header: HeaderInfo = { attendees: [] };

  usable.forEach((src, i) => {
    const id = `S${i + 1}`;
    const h = parseHeader(src.text);
    header.title ??= h.title;
    header.date ??= h.date;
    header.type ??= h.type;
    header.organisation ??= h.organisation;
    header.project ??= h.project;
    header.chair ??= h.chair;
    header.time ??= h.time;
    if (src.kind !== 'document') header.attendees.push(...h.attendees);
    const turns = parseTurns(src, id);
    allTurns.push(...turns);
    const stamps = turns.map((t) => t.timestamp).filter(Boolean) as string[];
    sources.push({
      id,
      name: src.name,
      kind: src.kind,
      words: src.text.split(/\s+/).filter(Boolean).length,
      lines: src.text.split(/\r?\n/).filter((l) => l.trim()).length,
      speakers: new Set(turns.map((t) => t.speaker).filter(Boolean)).size,
      firstTimestamp: stamps[0],
      lastTimestamp: stamps[stamps.length - 1],
    });
  });

  const meetingDate = metaIn.meetingDate || header.date || todayIso();
  if (!metaIn.meetingDate && !header.date) warnings.push('Meeting date not found in the source. Today’s date was used: confirm it before circulating.');

  /* participants: attendee list first, then any speaker not already listed */
  const participants: Participant[] = [];
  const addPerson = (p: Participant) => {
    const hit = participants.find((x) => x.name.toLowerCase() === p.name.toLowerCase() || x.name.split(' ')[0].toLowerCase() === p.name.toLowerCase());
    if (hit) {
      hit.role ??= p.role;
      return;
    }
    participants.push({ ...p });
  };
  header.attendees.forEach(addPerson);
  allTurns.forEach((t) => t.speaker && addPerson({ name: t.speaker, present: true }));

  KNOWN_NAMES = participants.flatMap((p) => p.name.split(' '));
  const resolveName = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    const r = raw.trim().toLowerCase();
    const exact = participants.find((p) => p.name.toLowerCase() === r);
    if (exact) return exact.name;
    const firsts = participants.filter((p) => p.name.split(' ')[0].toLowerCase() === r);
    if (firsts.length === 1) return firsts[0].name;
    return undefined;
  };
  const speakerOf = (t: Turn) => resolveName(t.speaker) ?? t.speaker;

  const evidenceOf = (t: Turn, quote: string): Evidence => ({
    sourceId: t.sourceId,
    sourceName: t.sourceName,
    line: t.line,
    timestamp: t.timestamp,
    speaker: speakerOf(t),
    quote: clean(quote).replace(/^[-*•]\s*/, ''),
  });

  const decisions: Decision[] = [];
  const actions: Action[] = [];
  const risks: Risk[] = [];
  const openItems: OpenItem[] = [];
  const figures: Figure[] = [];
  const claimed = new Set<string>(); // sentence keys used by a decision or action

  const pushAction = (a: Omit<Action, 'id' | 'horizon' | 'gaps' | 'review'>) => {
    if (a.task.length < 6 || words(a.task).length < 2) return;
    const dup = actions.find((x) => similarity(x.task, a.task) >= 0.7 && (!x.owner || !a.owner || x.owner === a.owner));
    if (dup) {
      dup.evidence.push(...a.evidence.filter((e) => !dup.evidence.some((d) => d.line === e.line && d.sourceId === e.sourceId)));
      if (!dup.owner && a.owner) {
        dup.owner = a.owner;
        dup.ownerBasis = a.ownerBasis;
      }
      if (!dup.due && a.due) {
        dup.due = a.due;
        dup.dueText = a.dueText;
        dup.dueApprox = a.dueApprox;
      }
      return;
    }
    actions.push({ ...a, id: '', horizon: 'undated', gaps: [], review: 'proposed' });
  };

  const pushDecision = (d: Omit<Decision, 'id' | 'title' | 'review'>) => {
    if (d.statement.length < 8) return;
    const dup = decisions.find((x) => similarity(x.statement, d.statement) >= 0.75);
    if (dup) {
      dup.evidence.push(...d.evidence);
      return;
    }
    decisions.push({ ...d, id: '', title: shorten(cap(stripEnd(d.statement)), 80), review: 'proposed' });
  };

  const pushOpen = (o: Omit<OpenItem, 'id' | 'review'>) => {
    if (o.question.length < 8) return;
    if (openItems.some((x) => similarity(x.question, o.question) >= 0.7)) return;
    openItems.push({ ...o, id: '', review: 'proposed' });
  };

  /* --- pass over every sentence of every turn --- */
  allTurns.forEach((turn, ti) => {
    const speaker = speakerOf(turn);
    const sentences = splitSentences(turn.text);
    sentences.forEach((rawSentence) => {
      const sentence = deFill(rawSentence);
      const key = `${turn.sourceId}:${turn.line}:${sentence.slice(0, 40)}`;
      const lower = sentence.toLowerCase();
      const isQuestion = /\?\s*$/.test(sentence);
      if (claimed.has(key)) return;
      const openRisk = risks[risks.length - 1] as (Risk & { _open?: boolean }) | undefined;
      if (openRisk?._open && openRisk.evidence[0].line === turn.line && openRisk.evidence[0].sourceId === turn.sourceId && /^(?:if|which means|that means|otherwise|and if)\b/i.test(sentence)) {
        openRisk.risk = `${stripEnd(openRisk.risk)}. ${cap(stripEnd(clean(sentence)))}`;
        openRisk.evidence[0].quote = `${openRisk.evidence[0].quote} ${clean(rawSentence)}`;
        Object.assign(openRisk, rescore(openRisk));
        openRisk._open = false;
        return;
      }

      /* figures: money, percentages and counted things */
      for (const m of sentence.matchAll(/(?:AU)?\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|million|thousand|bn)?\b|\b\d+(?:\.\d+)?\s?(?:%|per ?cent)|\b\d{1,3}(?:,\d{3})+\s+[a-z]+|\b\d{3,}\s+(?:contacts|listings|records|clients|properties|tenancies|leads|vendors|staff|users|hours|days)\b/gi)) {
        const core = m[0].replace(/[^\d.$%]/g, '');
        if (!figures.some((f) => f.value.replace(/[^\d.$%]/g, '') === core)) figures.push({ value: m[0].trim(), context: shorten(clean(sentence), 140), evidence: evidenceOf(turn, rawSentence) });
      }

      /* explicit markers in notes and documents */
      const marker = sentence.match(/^(?:[-*•]\s*)?(decision|resolution|agreed|action(?:\s+item)?|task|todo|risk|issue|open question|question|parked|tbc)\s*[:\-–]\s*(.+)$/i);
      if (marker) {
        const kind = marker[1].toLowerCase();
        const body = cap(stripEnd(clean(marker[2])));
        if (/^(decision|resolution|agreed)$/.test(kind)) {
          const cond = body.match(/\b(subject to|pending|once|provided|conditional on)\b\s*(.+)$/i);
          pushDecision({ statement: body, calledBy: speaker, status: cond ? 'conditional' : 'agreed', condition: cond ? clean(cond[0]) : undefined, evidence: [evidenceOf(turn, rawSentence)], confidence: 'explicit' });
        } else if (/^(action|action item|task|todo)$/.test(kind)) {
          const own = body.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to|will|shall|must)\s+(.+)$/) || body.match(/^(.+?)\s*\((?:owner:?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[^)]*\)\s*$/);
          let owner: string | undefined;
          let task = body;
          if (own && /\s(?:to|will|shall|must)\s/.test(own[0]) && resolveName(own[1])) {
            owner = resolveName(own[1]);
            task = own[2];
          } else if (own && resolveName(own[2] ?? '')) {
            owner = resolveName(own[2]);
            task = own[1];
          }
          const due = resolveDue(task, meetingDate);
          if (due?.text) task = task.replace(new RegExp(`\\s*(?:by|before|due|on|until)?\\s*${due.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
          pushAction({ task: firstPersonToTask(task, owner), owner, ownerBasis: owner ? 'stated' : 'none', due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, evidence: [evidenceOf(turn, rawSentence)], confidence: 'explicit', doneDefinition: undefined });
        } else if (/^(risk|issue)$/.test(kind)) {
          risks.push(scoreRisk(body, speaker, [evidenceOf(turn, rawSentence)]));
        } else {
          pushOpen({ question: cap(stripEnd(body)), kind: /approv|sign[- ]?off|budget|board/i.test(body) ? 'approval' : 'unresolved', raisedBy: speaker, evidence: [evidenceOf(turn, rawSentence)] });
        }
        claimed.add(key);
        return;
      }

      /* open items: deferred, parked or explicitly undecided */
      const notDecided = /\b(?:haven't|have not|hasn't|not yet|still haven't|didn't)\s+(?:yet\s+)?(?:decided|agreed|landed|settled|resolved|confirmed)\b|\bnot (?:decided|agreed|settled|confirmed) (?:yet|today)\b|\bundecided\b|\bstill (?:open|unclear|unresolved|undecided)\b/i.test(sentence);
      const deferred = /\b(?:park (?:that|this|it)|parking (?:that|this|it)|come back to (?:that|this|it)|revisit|take (?:that|this|it) offline|leave (?:that|this|it) for (?:the )?next|next meeting|defer(?:red)?|hold off (?:on|until)|tbc|to be confirmed)\b/i.test(sentence);
      const needsApproval = /\b(?:needs?|need|requires?|subject to|pending|waiting (?:on|for)|until)\b[^.]{0,40}\b(?:sign[- ]?off|approval|approve|signs? off|board|cfo|finance)\b/i.test(sentence);

      /* decisions */
      const decisionCue = /\b(?:decision(?: is)?\s*:|(?:so\s+)?we(?:'ve| have)? (?:now )?decided|(?:so\s+)?we(?:'re| are) (?:all )?agreed|that'?s (?:agreed|decided|settled|locked in)|let'?s lock (?:that|it) in|lock(?:ed)? in|we(?:'ll| will| are|'re) go(?:ing)? with|let'?s go with|approved?\b|i(?:'m| am) (?:comfortable|happy) (?:approving|to approve|signing off)|signed off|the call is|we(?:'re| are) (?:moving|switching|going) (?:to|ahead)|agreed:?)\b/i;
      if (decisionCue.test(sentence) && !isQuestion && !notDecided && !/\b(?:if|whether|maybe|might|could|should we|do we|not approved|isn't approved|not agreed)\b[^.]{0,12}(?:approve|agree|decide|go with)/i.test(sentence) && !/^(?:if|when|once)\b/i.test(sentence)) {
        let statement = sentence
          .replace(/^(?:so,?\s*)?(?:decision(?: is)?\s*:\s*|(?:so\s+)?we(?:'ve| have)? (?:now )?decided (?:that\s+|to\s+)?|(?:so\s+)?we(?:'re| are) (?:all )?agreed(?: that|,|:)?\s*|let'?s note (?:that|this) as a decision:?\s*)/i, '')
          .replace(/^(?:i(?:'m| am) (?:comfortable|happy) (?:approving|to approve)\s+)/i, 'Approve ')
          .replace(/^(?:agreed|yes|yep|right)[,.]?\s+/i, '')
          .replace(/^(?:let'?s|we(?:'ll| will)|we(?:'re| are)) go(?:ing)? with\s+(?:a\s+|an\s+)?/i, '')
          .replace(/[,;]?\s*(?:that'?s (?:agreed|decided|settled|locked in)|let'?s lock (?:that|it) in|agreed)\.?$/i, '');
        statement = stripEnd(clean(statement));
        if (/^(?:that|it|this)$/i.test(statement) || words(statement).length < 3) {
          if (sentences.some((o) => o !== rawSentence && /decision\s*:|decided|we(?:'re| are) agreed|go with|approv|lock (?:it|that) in/i.test(o))) return;
          // "That's agreed." on its own: the decision is the previous sentence or turn
          const prevSentence = sentences[sentences.indexOf(rawSentence) - 1] || allTurns[ti - 1]?.text.split(/(?<=[.!?])\s+/).pop();
          if (prevSentence) statement = stripEnd(clean(deFill(prevSentence)));
        }
        const cond = statement.match(/\b(subject to|pending|once|provided(?: that)?|as long as|conditional on)\b\s*(.+)$/i);
        pushDecision({
          statement: cap(statement),
          calledBy: speaker,
          status: cond || needsApproval ? 'conditional' : 'agreed',
          condition: cond ? clean(cond[0]) : needsApproval ? clean(sentence) : undefined,
          evidence: [evidenceOf(turn, rawSentence)],
          confidence: /decision\s*:|decided|agreed|approve/i.test(sentence) ? 'explicit' : 'inferred',
        });
        claimed.add(key);
        if (cond || needsApproval) {
          const what = stripEnd(clean((cond ? cond[2] : sentence).replace(/^(?:subject to|pending|once|provided(?: that)?|as long as|conditional on)\s+/i, '')));
          pushOpen({ question: `${cap(what)}, needed before this decision is final: ${lowerFirst(shorten(stripEnd(statement.replace(/[,;]?\s*(?:subject to|pending|once|provided(?: that)?|as long as|conditional on)\b.*$/i, '')), 70))}`, kind: 'approval', raisedBy: speaker, evidence: [evidenceOf(turn, rawSentence)] });
        }
        return;
      }

      if (notDecided || deferred) {
        let q = sentence
          .replace(/^(?:we\s+)?(?:still\s+)?(?:haven't|have not|didn't|not yet)\s+(?:yet\s+)?(?:decided|agreed|landed|settled|resolved|confirmed)\s+(?:on\s+)?/i, '')
          .replace(/[,;]?\s*(?:let'?s|we(?:'ll| will)|so)\s+(?:park|come back to|revisit|take|leave)\b.*$/i, '')
          .replace(/^(?:let'?s|we(?:'ll| will)|i(?:'d| would) like to)\s+(?:park|come back to|revisit|leave|take)\s+(?:that|this|it)?\s*/i, '');
        q = stripEnd(clean(q));
        if (words(q).length < 4 || /^(?:that|this|it)\b/i.test(q)) {
          const idx = sentences.indexOf(rawSentence);
          const prevSame = idx > 0 ? sentences[idx - 1] : undefined;
          const prevTurnQ = ti > 0 ? splitSentences(allTurns[ti - 1].text).reverse().find((x) => /\?$/.test(x)) : undefined;
          const ref = prevSame || prevTurnQ || (ti > 0 ? splitSentences(allTurns[ti - 1].text).pop() : undefined);
          if (ref && openItems.some((o) => o.evidence.some((e) => e.line === turn.line && e.sourceId === turn.sourceId))) return;
          if (ref) q = stripEnd(clean(deFill(ref)));
          const tail = sentence.match(/\b(?:until|once|after)\s+(.+)$/i);
          if (tail) q += ` (revisit ${stripEnd(tail[0]).replace(/^\w+/, (w) => w.toLowerCase())})`;
        }
        pushOpen({ question: cap(q), kind: needsApproval ? 'approval' : deferred ? 'deferred' : 'unresolved', raisedBy: speaker, evidence: [evidenceOf(turn, rawSentence)] });
        if (!/\bI(?:'ll| will)\b/.test(sentence)) return;
      }

      /* actions: first-person commitments */
      const commit = sentence.match(/\b(?:I'll|I will|I can|I'm going to|I am going to|I'll take|I'll own|leave (?:it|that) with me,?\s*I'll|I'll get)\s+(.+)$/i);
      if (commit && !HEDGE_I.test(sentence) && !/^(?:if|when)\b/i.test(sentence) && !isQuestion && turn.speaker) {
        const owner = speaker;
        let task = commit[1];
        const due = resolveDue(task, meetingDate);
        if (due?.text) task = task.replace(new RegExp(`[,]?\\s*(?:by|before|due|on|until|for|in|over|at|ahead of|the)?\\s*(?:the\\s+)?${due.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
        task = task.replace(/^(?:also|just|then|definitely|happily)\s+/i, '').replace(/^(?:take|own)\s+(?:the\s+)?/i, (m) => (/own/i.test(m) ? 'Own the ' : 'Take the '));
        const done = sentence.match(/\b(?:so that|done when|signed off by|ready for|in time for)\s+(.+)$/i);
        if (done) task = task.replace(/[,;]?\s*(?:so that|done when|signed off by|ready for|in time for)\s+.+$/i, '');
        if (!/^(?:do that|do it|do this|try|see|check|have a look)\.?$/i.test(stripEnd(task)) || due) {
          let finalTask = task;
          if (/^(?:do that|do it|do this|that|it)$/i.test(stripEnd(task)) && ti > 0) {
            const req = allTurns[ti - 1].text.match(/(?:can you|could you|will you|would you|please)\s+([^?]+)\?/i);
            if (req) finalTask = req[1];
          }
          pushAction({ task: firstPersonToTask(finalTask, owner), owner, ownerBasis: 'speaker', due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, doneDefinition: done ? cap(stripEnd(done[1])) : undefined, evidence: [evidenceOf(turn, rawSentence)], confidence: 'explicit' });
          claimed.add(key);
          return;
        }
      }

      /* actions: requests accepted in the next turn */
      const req = sentence.match(/^(?:and\s+)?([A-Z][a-z]+)[,:]?\s+(?:can you|could you|will you|would you|are you (?:able|okay|happy) to|please|i need you to|you'll need to)\s+([^?]+)\??$/i)
        || sentence.match(/\b(?:can|could|will|would)\s+([A-Z][a-z]+)\s+([^?]+)\?$/);
      if (req && resolveName(req[1])) {
        const target = resolveName(req[1])!;
        const next = allTurns.slice(ti + 1, ti + 3).find((t) => speakerOf(t) === target);
        const accepted = next && ACCEPT.test(deFill(next.text));
        const nextHasCommit = next && /\b(?:I'll|I will)\b/.test(next.text);
        if (accepted || !isQuestion) {
          if (!nextHasCommit || !accepted) {
            let task = req[2];
            const due = resolveDue(task, meetingDate) || (next ? resolveDue(next.text, meetingDate) : null);
            if (due?.text) task = task.replace(new RegExp(`\\s*(?:by|before|due|on|until)?\\s*${due.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
            pushAction({ task: firstPersonToTask(task.replace(/\byour\b/gi, `${target.split(' ')[0]}'s`), target), owner: target, ownerBasis: 'stated', due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, evidence: [evidenceOf(turn, rawSentence), ...(next ? [evidenceOf(next, next.text)] : [])], confidence: accepted ? 'explicit' : 'inferred' });
            claimed.add(key);
            return;
          }
        }
      }

      /* actions: third-person assignment "Tom will ..." / "Tom to ..." */
      const third = sentence.match(/^(?:and\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|is going to|to|needs to|has to|is taking|owns)\s+(.+)$/);
      if (third && resolveName(third[1]) && !isQuestion) {
        const owner = resolveName(third[1])!;
        let task = third[2];
        const due = resolveDue(task, meetingDate);
        if (due?.text) task = task.replace(new RegExp(`\\s*(?:by|before|due|on|until)?\\s*${due.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
        pushAction({ task: firstPersonToTask(task, owner), owner, ownerBasis: 'stated', due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, evidence: [evidenceOf(turn, rawSentence)], confidence: 'inferred' });
        claimed.add(key);
        return;
      }

      /* actions with no owner: "someone needs to ..." */
      const unowned = sentence.match(/\b(?:someone|somebody|we need someone to|someone's got to)\s+(?:needs? to|should|has to|must|to)?\s*(.+)$/i);
      if (unowned && !isQuestion) {
        let task = unowned[1];
        const due = resolveDue(task, meetingDate);
        if (due?.text) task = task.replace(new RegExp(`\\s*(?:by|before|due|on|until)?\\s*${due.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
        pushAction({ task: firstPersonToTask(task), owner: undefined, ownerBasis: 'none', due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, evidence: [evidenceOf(turn, rawSentence)], confidence: 'inferred' });
        claimed.add(key);
        return;
      }

      /* risks */
      const riskCue = /\b(?:risk|risky|my (?:worry|concern)|i(?:'m| am) (?:worried|concerned)|concern(?:ed)? (?:is|that)|exposed|exposure|blocker|bottleneck|single point of failure|only (?:one|person) (?:who|that)|the only one who|could slip|might slip|will slip|if (?:that|this|it|we|the \w+) (?:slips?|misses?|fails?|goes wrong|doesn't)|can't afford|we(?:'ll| will) lose|fall over|knock-on|dependency|depends on)\b/i;
      if (riskCue.test(sentence) && !claimed.has(key)) {
        const idx = sentences.indexOf(rawSentence);
        let riskText = stripEnd(clean(sentence));
        const lastRisk = risks[risks.length - 1];
        if (lastRisk && lastRisk.evidence[0].line === turn.line && lastRisk.evidence[0].sourceId === turn.sourceId && (lastRisk as Risk & { _open?: boolean })._open) {
          lastRisk.risk = `${stripEnd(lastRisk.risk)}. ${cap(riskText)}`;
          lastRisk.evidence[0].quote = `${lastRisk.evidence[0].quote} ${clean(rawSentence)}`;
          Object.assign(lastRisk, rescore(lastRisk));
          (lastRisk as Risk & { _open?: boolean })._open = false;
          return;
        }
        // short lead-ins ("One more risk.", "My worry is the consent flags.") absorb the next sentence
        const isLeadIn = words(riskText).length <= 7 && idx + 1 < sentences.length;
        riskText = riskText.replace(/^(?:one more|another|the other|a|one)\s+risk[.:,]?\s*$/i, '');
        if (isLeadIn) {
          const nxt = stripEnd(clean(deFill(sentences[idx + 1])));
          riskText = riskText ? `${riskText}. ${cap(nxt)}` : nxt;
          claimed.add(`${turn.sourceId}:${turn.line}:${deFill(sentences[idx + 1]).slice(0, 40)}`);
        }
        risks.push(scoreRisk(cap(riskText), speaker, [evidenceOf(turn, isLeadIn ? `${rawSentence} ${sentences[idx + 1]}` : rawSentence)]));
        (risks[risks.length - 1] as Risk & { _open?: boolean })._open = true;
        // mitigation in the same turn or the following turn
        const r = risks[risks.length - 1];
        const after = [...sentences.slice(sentences.indexOf(rawSentence) + 1), ...(allTurns[ti + 1]?.text ? splitSentences(allTurns[ti + 1].text) : [])];
        const mit = after.find((s) => /\b(?:so (?:we|I)(?:'ll| will)|to (?:mitigate|avoid|reduce|manage) (?:that|this|it)|mitigat|that'?s why|the fix is|we(?:'ll| will) (?:need to )?(?:check|test|run|add|keep|build|book)|I(?:'ll| will) (?:check|test|run|add|keep|build|book|make sure))\b/i.test(s));
        if (mit) r.mitigation = cap(stripEnd(clean(deFill(mit))));
      }
    });
  });

  /* ------------------------------------------------ number */
  decisions.forEach((d, i) => (d.id = `D${String(i + 1).padStart(2, '0')}`));
  actions.forEach((a, i) => (a.id = `A${String(i + 1).padStart(2, '0')}`));
  // link each risk to an action agreed within the next few turns of the same source
  risks.forEach((r) => {
    delete (r as Risk & { _open?: boolean })._open;
    r.statedResponse = r.mitigation;
    const e = r.evidence[0];
    if (sources.find((x) => x.id === e.sourceId)?.kind === 'document') return;
    const linked = actions.find((a) => a.evidence.some((x) => x.sourceId === e.sourceId && x.line > e.line && x.line - e.line <= 4));
    if (linked) r.linkedAction = linked.id;
  });
  const uniqRisks: Risk[] = [];
  for (const r of risks) if (!uniqRisks.some((u) => similarity(u.risk, r.risk) >= 0.7)) uniqRisks.push(r);
  const tier = (r: Risk) => (r.rating === 'high' ? 3 : r.rating === 'medium' ? 2 : 1);
  uniqRisks.sort((a, b) => tier(b) - tier(a) || b.consequence - a.consequence || b.likelihood - a.likelihood);
  uniqRisks.forEach((r, i) => (r.id = `R${String(i + 1).padStart(2, '0')}`));
  openItems.forEach((o, i) => (o.id = `Q${String(i + 1).padStart(2, '0')}`));

  /* ------------------------------------------------ meta */
  const allStamps = sources.flatMap((s) => [s.firstTimestamp, s.lastTimestamp]).filter(Boolean) as string[];
  const toMin = (t: string) => {
    const p = t.split(':').map(Number);
    return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60;
  };
  let duration: string | undefined;
  if (allStamps.length >= 2) {
    const mins = Math.round(toMin(allStamps[allStamps.length - 1]) - toMin(allStamps[0]));
    if (mins > 0) duration = `${mins} min (from timestamps)`;
  }
  if (!duration && header.time) duration = header.time;

  const title = metaIn.title?.trim() || header.title || header.project || 'Meeting outcome';
  if (!metaIn.title && !header.title) warnings.push('No meeting title found. Add one so the record can be filed.');
  const meta: MeetingModel['meta'] = {
    title,
    meetingType: metaIn.meetingType || header.type || inferType(usable.map((s) => s.text).join('\n').slice(0, 4000)),
    meetingDate,
    organisation: metaIn.organisation || header.organisation,
    project: metaIn.project || header.project,
    duration,
    chair: header.chair,
  };

  /* ------------------------------------------------ participation (aggregate only) */
  const speakerWords = new Map<string, number>();
  allTurns.forEach((t) => t.speaker && speakerWords.set(speakerOf(t)!, (speakerWords.get(speakerOf(t)!) ?? 0) + t.text.split(/\s+/).length));
  const shares = [...speakerWords.values()];
  let balance: number | null = null;
  if (shares.length >= 2) {
    const total = shares.reduce((a, b) => a + b, 0);
    const H = -shares.reduce((acc, w) => acc + (w / total) * Math.log(w / total), 0);
    balance = Math.round((H / Math.log(shares.length)) * 100);
  }
  if (!allTurns.some((t) => t.speaker)) warnings.push('No speaker labels found. Owners can only be taken from explicit “Action:” lines.');

  const model: MeetingModel = {
    version: '2.0',
    meta,
    sources,
    participants,
    decisions,
    actions,
    risks: uniqRisks,
    openItems,
    figures: figures.slice(0, 12),
    recommendations: [],
    health: { dimensions: [], notScored: ['Psychological safety', 'Strategic alignment', 'Agenda discipline', 'Rigour and evidence'] },
    gate: { status: 'Not ready', checks: [] },
    bottomLine: '',
    stats: { decisions: 0, actions: 0, owned: 0, dated: 0, openItems: 0, risks: 0, highRisks: 0 },
    warnings,
    signals: { balance, speakers: shares.length, dateConfirmed: !!(metaIn.meetingDate || header.date) },
  };
  return refresh(model);
}

/**
 * Recompute everything derived from the items: gaps, horizons, risk responses,
 * statistics, health, quality gate, recommendations and the bottom line.
 * Call after a person confirms, edits or excludes items. Excluded items are ignored.
 */
export function refresh(m: MeetingModel): MeetingModel {
  KNOWN_NAMES = m.participants.flatMap((p) => p.name.split(' '));
  const live = <T extends { review: Review }>(xs: T[]) => xs.filter((x) => x.review !== 'excluded');
  const decisions = live(m.decisions);
  const actions = live(m.actions);
  const risks = live(m.risks);
  const openItems = live(m.openItems);

  m.actions.forEach((a) => {
    a.gaps = [];
    a.horizon = 'undated';
    if (a.due) {
      const days = daysBetween(m.meta.meetingDate, a.due);
      a.horizon = days <= 7 ? 'now' : days <= 30 ? 'next' : 'later';
    }
    if (!a.owner) a.gaps.push('No owner named');
    if (!a.due) a.gaps.push('No date stated');
    else if (a.dueApprox) a.gaps.push('Date is approximate');
    if (!a.doneDefinition) a.gaps.push('Definition of done not stated');
  });
  m.risks.forEach((r) => {
    const linked = r.linkedAction ? actions.find((a) => a.id === r.linkedAction) : undefined;
    r.mitigation = linked ? `${linked.id}: ${stripEnd(linked.task)}${linked.owner ? ` (${linked.owner})` : ' (owner not named)'}` : r.statedResponse;
  });

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
  const owned = actions.filter((a) => a.owner).length;
  const dated = actions.filter((a) => a.due).length;
  const mitigated = risks.filter((r) => r.mitigation).length;
  const { balance, speakers, dateConfirmed } = m.signals;
  m.health.dimensions = [
    { key: 'clarity', name: 'Decision clarity', score: pct(decisions.length, decisions.length + openItems.length), basis: `${decisions.length} decided, ${openItems.length} left open` },
    { key: 'ownership', name: 'Action ownership', score: pct(owned, actions.length), basis: `${owned} of ${actions.length} actions have a named owner` },
    { key: 'dating', name: 'Action dating', score: pct(dated, actions.length), basis: `${dated} of ${actions.length} actions have a date` },
    { key: 'mitigation', name: 'Risk response', score: pct(mitigated, risks.length), basis: `${mitigated} of ${risks.length} risks have a response on record` },
    { key: 'balance', name: 'Participation balance', score: balance, basis: balance === null ? 'Needs a transcript with speaker labels' : `Spread of speaking across ${speakers} speakers. Meeting level only, no individual figures` },
  ];

  const checks: GateCheck[] = [
    { label: 'Every item traces to the source', pass: true, detail: 'Each item links to a quote, source and line.' },
    { label: 'Decisions recorded', pass: decisions.length > 0, detail: decisions.length ? `${decisions.length} decision${decisions.length === 1 ? '' : 's'} on record.` : 'No decisions found. Check the record before circulating.' },
    { label: 'Every action has an owner', pass: actions.length > 0 && owned === actions.length, detail: actions.length - owned ? `${actions.length - owned} without an owner.` : 'All owned.' },
    { label: 'Every action has a date', pass: actions.length > 0 && dated === actions.length, detail: actions.length - dated ? `${actions.length - dated} without a date.` : 'All dated.' },
    { label: 'Attendees recorded', pass: m.participants.length > 0, detail: m.participants.length ? `${m.participants.filter((p) => p.present).length} present, ${m.participants.filter((p) => !p.present).length} ${m.participants.filter((p) => !p.present).length === 1 ? 'apology' : 'apologies'}.` : 'No attendee list or speaker labels.' },
    { label: 'Meeting date confirmed', pass: dateConfirmed, detail: dateConfirmed ? fmtDate(m.meta.meetingDate) : 'Date assumed. Confirm it.' },
  ];
  const failed = checks.filter((c) => !c.pass).length;
  m.gate = { status: decisions.length + actions.length === 0 ? 'Not ready' : failed ? 'Circulate after review' : 'Ready to circulate', checks };

  const recs: Recommendation[] = [];
  openItems.filter((o) => o.kind === 'approval').forEach((o) => recs.push({ priority: 'Critical', title: `Secure ${lowerFirst(o.question.split(', needed before')[0])}`, why: `A decision stays conditional until this is given: ${o.question.split('final: ')[1] ?? o.question}.`, ref: o.id }));
  risks.filter((r) => r.rating === 'high' && !r.mitigation).forEach((r) => recs.push({ priority: 'Critical', title: `Agree a response and an owner for ${r.id}`, why: `Rated high from the wording used, and no response is on record.`, ref: r.id }));
  actions.filter((a) => !a.owner).forEach((a) => recs.push({ priority: 'High', title: `Name an owner for ${a.id}: ${lowerFirst(shorten(stripEnd(a.task), 70))}`, why: `${m.risks.some((r) => r.linkedAction === a.id && r.rating === 'high') ? 'This is the response to a high risk. ' : ''}Work without an owner is the most common reason an agreed action stalls.`, ref: a.id }));
  actions.filter((a) => a.owner && !a.due).forEach((a) => recs.push({ priority: 'High', title: `Set a date for ${a.id}: ${lowerFirst(shorten(stripEnd(a.task), 70))}`, why: `${a.owner} owns it, but no date was stated.`, ref: a.id }));
  openItems.filter((o) => o.kind !== 'approval').forEach((o) => recs.push({ priority: 'Medium', title: `Put ${o.id} on the next agenda with a decision owner`, why: `Left open: “${shorten(o.question, 90)}”`, ref: o.id }));
  risks.filter((r) => r.rating !== 'high' && !r.mitigation).forEach((r) => recs.push({ priority: 'Medium', title: `Confirm how ${r.id} will be managed`, why: shorten(riskHeadline(r.risk), 110), ref: r.id }));
  m.recommendations = recs;

  m.bottomLine = buildBottomLine(decisions, actions, openItems, risks);
  m.stats = { decisions: decisions.length, actions: actions.length, owned, dated, openItems: openItems.length, risks: risks.length, highRisks: risks.filter((r) => r.rating === 'high').length };
  return m;
}

/* ---------------------------------------------------------------- helpers */

let KNOWN_NAMES: string[] = [];
function lowerFirst(s: string) {
  if (!s || !/^[A-Z][a-z]/.test(s)) return s;
  const first = s.split(/[\s,']/)[0];
  if (KNOWN_NAMES.includes(first) || /^(?:CRM|Q\d|AU|I)\b/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function scoreRisk(text: string, raisedBy: string | undefined, evidence: Evidence[]): Risk {
  const t = text.toLowerCase();
  let consequence = 3;
  let likelihood = 3;
  if (/\b(?:privacy|legal|compliance|penalt\w*|breach|regulat\w*|safety|fines?|lawsuit|exposed|exposure|consent|opted out|tribunal)\b/.test(t)) consequence += 2;
  else if (/\b(?:critical|serious|major|significant|huge|lose|losing|revenue|reputation|busiest|peak|nobody can|no one can|roll ?back|go-live|cutover)\b/.test(t)) consequence += 1;
  if (/\b(?:minor|small|slight|cosmetic)\b/.test(t)) consequence -= 1;
  const conditional = /^(?:if|should|in case)\b/.test(t);
  if (/\b(?:already|again|always|every time|tight|likely|definitely|only one|only person|single point)\b/.test(t) || (!conditional && /\b(?:will|we'll)\b/.test(t))) likelihood += 1;
  if (/\b(?:unlikely|small chance|remote|rare)\b/.test(t)) likelihood -= 1;
  if (/\b(?:might|could|may|possibly)\b/.test(t)) likelihood -= 0; // neutral: stated as possible
  consequence = Math.max(1, Math.min(5, consequence));
  likelihood = Math.max(1, Math.min(5, likelihood));
  const score = consequence * likelihood;
  return { id: '', risk: text, raisedBy, likelihood, consequence, rating: score >= 15 ? 'high' : score >= 9 ? 'medium' : 'low', evidence, review: 'proposed' };
}

function longestSentence(text: string): string {
  const parts = splitSentences(text);
  return parts.reduce((a, b) => (b.length > a.length ? b : a), parts[0] ?? text);
}

export function riskHeadline(text: string): string {
  if (text.length <= 180) return text;
  const parts = splitSentences(text);
  return parts.reduce((a, b) => (b.length > a.length ? b : a), parts[0] ?? text);
}

function rescore(r: Risk): Pick<Risk, 'likelihood' | 'consequence' | 'rating'> {
  const x = scoreRisk(r.risk, r.raisedBy, r.evidence);
  return { likelihood: x.likelihood, consequence: x.consequence, rating: x.rating };
}

function inferType(text: string): string {
  const t = text.toLowerCase();
  if (/board meeting|board of directors|directors'? meeting/.test(t)) return 'Board meeting';
  if (/steering committee|steerco/.test(t)) return 'Steering committee';
  if (/leadership|executive|senior team/.test(t)) return 'Leadership meeting';
  if (/kick-?off/.test(t)) return 'Project kick-off';
  if (/client|vendor|appraisal|proposal/.test(t)) return 'Client meeting';
  if (/workshop/.test(t)) return 'Workshop';
  if (/stand-?up|status|weekly/.test(t)) return 'Status meeting';
  return 'Meeting';
}

function buildBottomLine(decisions: Decision[], actions: Action[], open: OpenItem[], risks: Risk[]): string {
  const parts: string[] = [];
  const agreed = decisions.filter((d) => d.status === 'agreed');
  const conditional = decisions.filter((d) => d.status === 'conditional');
  if (decisions.length) {
    const headline = decisions.find((d) => d.status === 'agreed' && d.confidence === 'explicit') || decisions[0];
    const lead = stripEnd(headline.statement).replace(/^We\s+/, 'we ');
    parts.push(
      decisions.length === 1
        ? `The meeting made one decision: ${lowerFirst(lead)}.`
        : `The meeting made ${decisions.length} decisions. The headline: ${lowerFirst(lead)}.`
    );
    if (conditional.length) parts.push(`${conditional.length === 1 ? 'One is' : `${conditional.length} are`} conditional on approval still to come${agreed.length ? '' : ', so nothing is final yet'}.`);
  } else parts.push('No decision was recorded in this meeting.');
  if (actions.length) {
    const noOwner = actions.filter((a) => !a.owner).length;
    const noDate = actions.filter((a) => !a.due).length;
    const gap = [noOwner ? `${noOwner} without an owner` : '', noDate ? `${noDate} without a date` : ''].filter(Boolean).join(' and ');
    parts.push(`${actions.length} action${actions.length === 1 ? ' was' : 's were'} agreed${gap ? `, ${gap}` : ', all owned and dated'}.`);
  }
  const high = risks.filter((r) => r.rating === 'high');
  if (high.length) parts.push(`The most serious exposure raised: ${lowerFirst(shorten(stripEnd(longestSentence(high[0].risk)), 220)).replace(/…$/, '')}.`);
  if (open.length) parts.push(`${open.length} item${open.length === 1 ? ' remains' : 's remain'} open.`);
  return parts.join(' ');
}

/* ------------------------------------------------------------- exports */

export function toMarkdown(m: MeetingModel, include: (r: { review: Review }) => boolean = (r) => r.review !== 'excluded'): string {
  const d = m.decisions.filter(include);
  const a = m.actions.filter(include);
  const r = m.risks.filter(include);
  const o = m.openItems.filter(include);
  const L: string[] = [];
  L.push(`# ${m.meta.title}`, '', `${m.meta.meetingType} | ${fmtDate(m.meta.meetingDate)}${m.meta.organisation ? ` | ${m.meta.organisation}` : ''}`, '');
  L.push('## Bottom line', '', m.bottomLine, '');
  L.push('## Decisions', '');
  d.forEach((x) => L.push(`- **${x.id}** ${x.statement}${x.status === 'conditional' ? ` _(conditional: ${x.condition})_` : ''}  `, `  Source: ${cite(x.evidence[0])}`));
  L.push('', '## Actions', '', '| ID | Action | Owner | Due | Gaps |', '| --- | --- | --- | --- | --- |');
  a.forEach((x) => L.push(`| ${x.id} | ${x.task} | ${x.owner ?? 'Not named'} | ${x.due ? fmtDate(x.due) + (x.dueApprox ? ' (approx.)' : '') : 'Not stated'} | ${x.gaps.join('; ') || 'None'} |`));
  L.push('', '## Risks', '');
  r.forEach((x) => L.push(`- **${x.id}** (${x.rating}) ${x.risk}${x.mitigation ? `  \n  Response stated: ${x.mitigation}` : '  \n  Response: not stated'}`));
  L.push('', '## Open items', '');
  o.forEach((x) => L.push(`- **${x.id}** ${x.question}`));
  L.push('', '---', 'Prepared with Concludo. Items were extracted from the source and reviewed by a person before circulation.');
  return L.join('\n');
}

export interface FollowUpEmailOptions {
  audience?: 'internal' | 'client';
  correctionDeadline?: string;
  sender?: string;
  include?: (r: { review: Review }) => boolean;
}

export function melbourneTodayIso(): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function defaultCorrectionDeadline(meetingDateIso?: string): string {
  const baseIso = meetingDateIso || melbourneTodayIso();
  let current = addDays(baseIso, 1);
  let dow = parseIso(current).getUTCDay(); // 0 = Sun, 6 = Sat
  if (dow === 6) {
    current = addDays(current, 2);
  } else if (dow === 0) {
    current = addDays(current, 1);
  }
  const d = parseIso(current);
  const formatted = d.toLocaleDateString('en-AU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });
  return `12 pm ${formatted}`;
}

export function followUpEmail(
  m: MeetingModel,
  optsOrInclude?: FollowUpEmailOptions | ((r: { review: Review }) => boolean)
): { subject: string; body: string } {
  let audience: 'internal' | 'client' = 'client';
  let correctionDeadline = defaultCorrectionDeadline(m.meta.meetingDate);
  let sender = m.meta.chair || 'Anthony';
  let include: (r: { review: Review }) => boolean = (r) => r.review !== 'excluded';

  if (typeof optsOrInclude === 'function') {
    include = optsOrInclude;
  } else if (optsOrInclude) {
    if (optsOrInclude.audience) audience = optsOrInclude.audience;
    if (optsOrInclude.correctionDeadline) correctionDeadline = optsOrInclude.correctionDeadline;
    if (optsOrInclude.sender) sender = optsOrInclude.sender;
    if (optsOrInclude.include) include = optsOrInclude.include;
  }

  // Store in record's json_content (no new column)
  m.followUp = {
    audience,
    correctionDeadline,
  };

  const a = m.actions.filter(include);
  const d = m.decisions.filter(include);
  const o = m.openItems.filter(include);
  const r = m.risks.filter(include);

  // Headline decision: first confirmed decision, shortened to 60 characters at a word boundary
  const confirmedDec = d.find((x) => x.status === 'agreed' || x.status === 'conditional');
  let headline = 'decisions and actions';
  if (confirmedDec) {
    const raw = stripEnd(confirmedDec.statement);
    if (raw.length <= 60) {
      headline = raw;
    } else {
      const sub = raw.slice(0, 60);
      const lastSp = sub.lastIndexOf(' ');
      headline = (lastSp > 15 ? sub.slice(0, lastSp) : sub).replace(/[,;:.-]+$/, '');
    }
  }

  // Subject: [Client or meeting name] [meeting type], [d Mon]: [headline decision]
  const clientOrMeeting = m.meta.organisation || m.meta.project || m.meta.title || 'Meeting';
  const mType = m.meta.meetingType || 'Meeting';
  const dMon = m.meta.meetingDate ? parseIso(m.meta.meetingDate).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short' }) : '';
  let subject = `${clientOrMeeting} ${mType}, ${dMon}: ${headline}`.replace(/\s*,\s*:\s*/, ': ');
  if (subject.length >= 120) {
    const sub = subject.slice(0, 119);
    const lastSp = sub.lastIndexOf(' ');
    subject = (lastSp > 20 ? sub.slice(0, lastSp) : sub).replace(/[,;:.-]+$/, '');
  }

  const sections: string[] = [];

  // [Names] and Cc: [informed list]
  const present = m.participants.filter((p) => p.present);
  const absent = m.participants.filter((p) => !p.present);
  const fmtParticipant = (p: Participant) => (audience === 'client' && p.role ? `${p.name} (${p.role})` : p.name);

  if (present.length > 0) sections.push(present.map(fmtParticipant).join(', '));
  if (absent.length > 0) sections.push(`Cc: ${absent.map(fmtParticipant).join(', ')}`);

  // Opening line
  const openLine = m.meta.title
    ? `Thank you for your time at ${m.meta.title} on ${fmtDate(m.meta.meetingDate)}. Summary below. If anything is wrong, please tell me by ${correctionDeadline} and I will correct it.`
    : `Summary below. If anything is wrong, please tell me by ${correctionDeadline} and I will correct it.`;
  sections.push(openLine);

  // CONTEXT: what, when, who, what it was for. Two or three lines.
  if (m.meta.title) {
    const ctx = [
      'CONTEXT',
      `${m.meta.title} (${m.meta.meetingType}), held on ${fmtDate(m.meta.meetingDate)}${m.meta.duration ? ` (${m.meta.duration})` : ''}.`,
      `Attendees: ${present.length > 0 ? present.map((p) => p.name).join(', ') : 'Not recorded'}.`,
    ];
    if (m.bottomLine) {
      ctx.push(`Focus: ${m.bottomLine}.`);
    } else if (m.meta.project) {
      ctx.push(`Focus: ${m.meta.project}.`);
    }
    sections.push(ctx.join('\n'));
  }

  // DECISIONS: D-01 [decision]. Decided by [name].
  if (d.length > 0) {
    const dLines = [
      'DECISIONS',
      ...d.map((x) => {
        const cond = x.status === 'conditional' && x.condition && !x.statement.includes(x.condition) ? ` (conditional: ${x.condition})` : '';
        const by = x.calledBy ? ` Decided by ${x.calledBy}.` : '';
        return `${x.id} ${stripEnd(x.statement)}${cond}.${by}`;
      }),
    ];
    sections.push(dLines.join('\n'));
  }

  // ACTIONS: table: # | Action | Owner | By | Confirmed by
  if (a.length > 0) {
    const aRows = a.map((x) => {
      const oVal = x.owner ? x.owner : 'Who will own this?';
      const byVal = x.due ? `${fmtDate(x.due)}${x.dueApprox ? ' (approx.)' : ''}` : 'Can you confirm a date?';
      const confVal = x.evidence[0]?.speaker ? x.evidence[0].speaker : 'Not recorded';
      return `${x.id} | ${x.task} | ${oVal} | ${byVal} | ${confVal}`;
    });
    sections.push(['ACTIONS', '# | Action | Owner | By | Confirmed by', '---|---|---|---|---', ...aRows].join('\n'));
  }

  // DEADLINES AND DATES: only dates stated in the record
  const dated = a.filter((x) => !!x.due).sort((x, y) => (x.due! > y.due! ? 1 : -1));
  if (dated.length > 0) {
    sections.push(['DEADLINES AND DATES', ...dated.map((x) => `- ${fmtDate(x.due)}: ${x.task} (${x.owner || 'Who will own this?'})`)].join('\n'));
  }

  // OPEN QUESTIONS: Q-01 [question]. [Owner], by [date].
  if (o.length > 0) {
    sections.push(['OPEN QUESTIONS', ...o.map((x) => `${x.id} ${stripEnd(x.question)}. Who will own this?, by Can you confirm a date?.`)].join('\n'));
  }

  // RISKS: Internal version (8.1) only, confirmed risks only
  const confirmedRisks = r.filter((x) => x.review === 'confirmed');
  if (audience === 'internal' && confirmedRisks.length > 0) {
    sections.push(['RISKS', ...confirmedRisks.map((x) => `${x.id} ${stripEnd(x.risk)} (${x.rating} risk). ${x.mitigation ? `Response stated: ${x.mitigation}` : 'Response: not stated'}.`)].join('\n'));
  }

  // NEXT MEETING: [date, time]. It must produce: [outcome].
  sections.push('NEXT MEETING\nNo next meeting set');

  // [Sender first name]
  const senderFirst = (sender || 'Anthony').trim().split(/\s+/)[0];
  sections.push(senderFirst);

  const cleanSubject = subject.replace(/[\u2013\u2014]/g, '-');
  const cleanBody = sections.join('\n\n').replace(/[\u2013\u2014]/g, '-');

  return { subject: cleanSubject, body: cleanBody };
}

export function fmtDate(iso?: string, opts: { weekday?: boolean } = {}): string {
  if (!iso) return '';
  const d = parseIso(iso);
  return d.toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric', ...(opts.weekday ? { weekday: 'long' } : {}) });
}

export function cite(e?: Evidence): string {
  if (!e) return '';
  return `${e.sourceId} line ${e.line}${e.timestamp ? ` at ${e.timestamp}` : ''}${e.speaker ? `, ${e.speaker}` : ''}`;
}
