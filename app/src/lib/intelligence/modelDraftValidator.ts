/**
 * Model draft validator and fallback (offline).
 *
 * A safety layer that sits between a drafting model and the Workspace. It does
 * not call any model, has no network access and imports nothing from the data
 * layer. It is not wired into analyseMeeting().
 *
 * Every model item must be backed by a quote that appears in the source, must
 * not name an owner who is not a participant, must not duplicate an earlier
 * item, must not be a fragment, and each category is capped. On any failure the
 * rule engine record is returned unchanged. The consent finding, participants,
 * participant count and signals always come from the rule record.
 */
import type { MeetingModel, NextMeetingV3 } from './meetingEngine';

/* ------------------------------------------------------------------ types */

export type DraftCategory =
  | 'decisions'
  | 'actions'
  | 'open_questions'
  | 'risks'
  | 'insights'
  | 'statements_to_verify';

export const DRAFT_CATEGORIES: readonly DraftCategory[] = [
  'decisions',
  'actions',
  'open_questions',
  'risks',
  'insights',
  'statements_to_verify',
];

export type RejectionRule =
  | 'malformed_item'
  | 'evidence_not_in_source'
  | 'owner_not_participant'
  | 'who_not_participant'
  | 'duplicate'
  | 'fragment'
  | 'category_cap';

export interface RejectedModelItem {
  category: DraftCategory;
  item: unknown;
  rule: RejectionRule;
}

export interface CategoryCapNote {
  category: DraftCategory;
  cap: number;
  ruleCount: number;
  survivors: number;
  kept: number;
  trimmed: number;
  reason: string;
}

export type SourceKind = 'transcript' | 'notes' | 'document';

export interface ValidatorSource {
  text: string;
  kind: 'transcript' | 'notes' | 'document';
  name?: string;
}

export interface ValidateInput {
  source: ValidatorSource;
  ruleRecord: MeetingModel;
  /** A parsed draft object, or a JSON string that is parsed here. */
  draft: unknown;
  /** Source kind. Defaults to transcript. */
  sourceKind?: SourceKind;
}

export interface ValidationResult {
  parsed: boolean;
  parseError?: string;
  accepted: Record<DraftCategory, any[]>;
  rejected: RejectedModelItem[];
  capNotes: CategoryCapNote[];
  /** Categories whose key the draft contained as an array, even an empty one. */
  suppliedCategories: DraftCategory[];
  /** Items the draft contained across the six categories. */
  totalItems: number;
  rejectedCount: number;
  /** Evidence entries removed from accepted items because their quote is not in the source. */
  evidenceDropped: number;
  nextMeeting: NextMeetingV3 | null;
  /** The model's participants, only when they replace the rule record's list (notes and documents). */
  replacementParticipants: { name: string; role?: string; present: boolean }[] | null;
  /** Model participant names dropped because they do not appear in the source. */
  droppedParticipants: string[];
  /** The model's consent finding, only when its quote is found in the source and every name is a participant. */
  consent: ModelConsent | null;
}

export interface ModelConsent {
  asked_by: string | null;
  answered_by: string | null;
  at: string | null;
  note: string;
  source_quote: string;
  agreed: string[];
  declined: string[];
  not_asked: string[];
}

export interface MergedRecord extends MeetingModel {
  warnings?: string[];
  rejected_model_items?: RejectedModelItem[];
}

/* --------------------------------------------------------------- constants */

const DANGLING = new Set(['and', 'or', 'a', 'the', 'to', 'of', 'but', 'so', 'as']);
const MAX_WORDS = 40;
const MIN_QUOTE_WORDS = 4;
const DUPLICATE_OVERLAP = 0.8;
const CAP_MULTIPLIER = 2;
const CAP_ALLOWANCE = 4;
/** The cap never falls below this, so a weak rule engine count (notes, documents) does not trim real items. */
const CAP_FLOOR = 15;
/** Insights are views, one per person and point, so long meetings carry more of them. */
const INSIGHT_CAP_FLOOR = 20;
const MAJORITY_LOSS = 0.5;

/** The text field that carries each category's statement. */
const TEXT_FIELD: Record<DraftCategory, string> = {
  decisions: 'statement',
  actions: 'task',
  open_questions: 'question',
  risks: 'risk',
  insights: 'insight',
  statements_to_verify: 'statement',
};

/* ---------------------------------------------------------------- helpers */

/** Lower case, drop apostrophes, turn every other non letter or digit into a space. */
export function normaliseText(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function words(s: string): string[] {
  const n = normaliseText(s);
  return n ? n.split(' ') : [];
}

function normaliseName(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\u2010-\u2015-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One cell of a | table column: its normalised text and its 0-based source line. */
export interface ColumnSegment {
  norm: string;
  line: number;
}

/**
 * Reads each column of every | table in the source top to bottom, so a cell whose text wraps over
 * several rows can be quoted as written in that cell. Only columns with text on two or more rows
 * are returned.
 */
export function tableColumns(text: string): ColumnSegment[][] {
  const cols: ColumnSegment[][] = [];
  let block: Map<number, ColumnSegment[]> | null = null;
  const flush = () => {
    if (block) for (const segs of block.values()) if (segs.length > 1) cols.push(segs);
    block = null;
  };
  String(text ?? '').split(/\r?\n/).forEach((l, i) => {
    if ((l.match(/\|/g) ?? []).length >= 2) {
      const b: Map<number, ColumnSegment[]> = block ?? new Map();
      block = b;
      l.split('|').forEach((cell, ci) => {
        const n = normaliseText(cell);
        if (!n) return;
        const arr = b.get(ci) ?? [];
        arr.push({ norm: n, line: i });
        b.set(ci, arr);
      });
    } else flush();
  });
  flush();
  return cols;
}

const COLUMN_SEPARATOR = ' zqzcolzqz ';

/** The normalised source, followed by its table columns read top to bottom, for quote checks only. */
function quoteHaystack(normSource: string, text: string): string {
  const cols = tableColumns(text).map((segs) => segs.map((s) => s.norm).join(' '));
  return cols.length ? `${normSource}${COLUMN_SEPARATOR}${cols.join(COLUMN_SEPARATOR)}` : normSource;
}

function quoteInSource(normSource: string, quote: unknown): boolean {
  if (typeof quote !== 'string') return false;
  const q = normaliseText(quote);
  if (!q || q.split(' ').length < MIN_QUOTE_WORDS) return false;
  return ` ${normSource} `.includes(` ${q} `);
}

/**
 * A quote under the minimum length that occurs exactly once in the source is widened to the
 * whole source line that holds it, copied verbatim. Anything else is returned unchanged.
 */
export function widenShortQuote(sourceText: string, normSource: string, quote: unknown): unknown {
  if (typeof quote !== 'string') return quote;
  const q = normaliseText(quote);
  if (!q || q.split(' ').length >= MIN_QUOTE_WORDS) return quote;
  const hay = ` ${normSource} `;
  const needle = ` ${q} `;
  const first = hay.indexOf(needle);
  if (first < 0 || hay.indexOf(needle, first + 1) >= 0) return quote;
  const line = String(sourceText ?? '').split(/\r?\n/).find((l) => ` ${normaliseText(l)} `.includes(needle));
  if (!line || normaliseText(line).split(' ').length < MIN_QUOTE_WORDS) return quote;
  return line.trim();
}

function widenItemQuotes(item: unknown, sourceText: string, normSource: string): unknown {
  if (!isObject(item)) return item;
  let copy: Record<string, any> | null = null;
  const w = widenShortQuote(sourceText, normSource, item.source_quote);
  if (w !== item.source_quote) copy = { ...item, source_quote: w };
  if (Array.isArray(item.evidence)) {
    const ev = item.evidence.map((e: any) => (isObject(e) ? { ...e, quote: widenShortQuote(sourceText, normSource, e.quote) } : e));
    if (ev.some((e: any, i: number) => isObject(e) && e.quote !== (item.evidence as any[])[i].quote)) copy = { ...(copy ?? item), evidence: ev };
  }
  return copy ?? item;
}

function itemQuotes(item: Record<string, any>): string[] {
  const out: string[] = [];
  if (typeof item.source_quote === 'string') out.push(item.source_quote);
  if (Array.isArray(item.evidence)) {
    for (const e of item.evidence) if (isObject(e) && typeof e.quote === 'string') out.push(e.quote);
  }
  return out;
}

/** True when a display quote (any length) appears in the normalised source. */
function displayQuoteInSource(normSource: string, quote: unknown): boolean {
  if (typeof quote !== 'string') return false;
  const q = normaliseText(quote);
  if (!q) return false;
  return ` ${normSource} `.includes(` ${q} `);
}

/**
 * Returns a copy of an accepted item whose display_quote, when present, is found
 * in the source. Otherwise it is replaced by the first validated quote. An item
 * with no display_quote is left without one.
 */
function withSafeDisplayQuote(item: Record<string, any>, normSource: string): Record<string, any> {
  if (!('display_quote' in item)) return item;
  if (displayQuoteInSource(normSource, item.display_quote)) return item;
  const validated = itemQuotes(item).find((q) => quoteInSource(normSource, q));
  const copy = { ...item };
  if (validated !== undefined) copy.display_quote = validated;
  else delete copy.display_quote;
  return copy;
}

/** Field names that normally carry quoted source text, checked at any length. */
const QUOTE_BEARING_FIELDS = new Set([
  'text', 'excerpt', 'snippet', 'passage', 'context', 'line', 'utterance', 'content', 'verbatim', 'source_text', 'display_quote',
]);

/**
 * Keeps only the evidence entries whose quote is found in the source under the
 * acceptance rule (four or more words, same normalisation, whole word match).
 * An entry that is not an object, or has no quote string, is dropped. On a kept
 * entry, any other quote-bearing text field (a known quote field name, or any
 * string of four or more words) is removed unless it is also found in the source.
 * Returns a copy and the number of entries dropped. The input is not changed.
 */
function sanitiseEvidence(item: Record<string, any>, normSource: string): { item: Record<string, any>; dropped: number } {
  if (!Array.isArray(item.evidence)) return { item, dropped: 0 };
  const kept: any[] = [];
  let dropped = 0;
  for (const entry of item.evidence) {
    if (!isObject(entry) || !quoteInSource(normSource, entry.quote)) {
      dropped++;
      continue;
    }
    const copy: Record<string, any> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key !== 'quote' && typeof value === 'string') {
        const bearing = QUOTE_BEARING_FIELDS.has(key.toLowerCase()) || words(value).length >= MIN_QUOTE_WORDS;
        if (bearing && !displayQuoteInSource(normSource, value)) continue;
      }
      copy[key] = value;
    }
    kept.push(copy);
  }
  if (dropped === 0 && kept.every((e, i) => Object.keys(e).length === Object.keys(item.evidence[i]).length)) {
    return { item, dropped: 0 };
  }
  return { item: { ...item, evidence: kept }, dropped };
}

function wordOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

function participantNames(rule: MeetingModel): string[] {
  return (Array.isArray(rule?.participants) ? rule.participants : [])
    .map((p) => (p && typeof p.name === 'string' ? p.name : ''))
    .filter(Boolean);
}

/**
 * For notes and documents, the model's participants replace the rule record's
 * list, but only names found whole in the source, deduplicated, and only when at
 * least one name survives. Transcripts always keep the rule record's list.
 */
function resolveParticipants(
  draft: Record<string, any>,
  rule: MeetingModel,
  normSource: string,
  sourceKind: SourceKind,
): { names: string[]; replacement: { name: string; role?: string; present: boolean }[] | null; dropped: string[] } {
  const ruleNames = participantNames(rule);
  // Transcripts keep the rule engine's speaker list, unless it found no real names (no speakers, or only
  // generic labels such as "Speaker 1"); then the model's names, checked against the source, are used.
  const genericOnly = ruleNames.length === 0 || ruleNames.every((n) => /^(speaker|participant|person|unknown|guest)\s*\d*$/i.test(n.trim()));
  if ((sourceKind === 'transcript' && !genericOnly) || !Array.isArray(draft.participants)) return { names: ruleNames, replacement: null, dropped: [] };
  const kept: string[] = [];
  const seen = new Set<string>();
  const dropped: string[] = [];
  for (const entry of draft.participants) {
    const name = typeof entry === 'string' ? entry : isObject(entry) && typeof entry.name === 'string' ? entry.name : '';
    const key = normaliseText(name);
    if (!key) continue;
    if (!` ${normSource} `.includes(` ${key} `)) {
      dropped.push(name.trim());
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(name.trim());
  }
  if (kept.length === 0) return { names: ruleNames, replacement: null, dropped };
  const ruleList = Array.isArray(rule?.participants) ? rule.participants : [];
  const replacement = kept.map((name) => {
    const match = ruleList.find((p) => p && typeof p.name === 'string' && normaliseText(p.name) === normaliseText(name));
    return match ? { ...match, name } : { name, present: true };
  });
  return { names: kept, replacement, dropped };
}

/**
 * When an accepted item has no valid evidence array, set it to the validated
 * source_quote so that toMarkdown and the app can read it. Existing valid
 * evidence is left as it is.
 */
function withReadableEvidence(item: Record<string, any>, normSource: string): Record<string, any> {
  if (Array.isArray(item.evidence) && item.evidence.length > 0) return item;
  const quote = itemQuotes(item).find((q) => quoteInSource(normSource, q));
  if (quote === undefined) return item;
  return { ...item, evidence: [{ quote }] };
}

function ownerIsParticipant(owner: string, participants: string[]): boolean {
  const o = normaliseName(owner);
  if (!o) return false;
  return participants.some((p) => {
    const full = normaliseName(p);
    if (!full) return false;
    const first = normaliseName(String(p).trim().split(/\s+/)[0]);
    return o === full || o === first;
  });
}

/** True when every name in a list such as "A, B and C" is a participant. */
function allNamesAreParticipants(who: string, participants: string[]): boolean {
  if (ownerIsParticipant(who, participants)) return true;
  const parts = who.split(/\s*(?:,|&|\band\b)\s*/i).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((n) => ownerIsParticipant(n, participants));
}

/** Lower is kept first when a category is over its cap. Views outrank plain context. */
const INSIGHT_KIND_PRIORITY: Record<string, number> = {
  concern: 0, disagreement: 0, feedback_negative: 0, advice: 1, feedback_positive: 1, context: 2,
};

function capOrder(category: string, items: any[]): number[] {
  const idx = items.map((_, i) => i);
  if (category !== 'insights') return idx;
  const pr = (i: number) => INSIGHT_KIND_PRIORITY[String(items[i]?.kind ?? '').toLowerCase()] ?? 1;
  return idx.sort((a, b) => pr(a) - pr(b) || a - b);
}

function isFragment(text: string): boolean {
  const w = words(text);
  if (!w.length) return true;
  if (w.length > MAX_WORDS) return true;
  return DANGLING.has(w[w.length - 1]);
}

function parseDraft(draft: unknown): { ok: true; value: Record<string, any> } | { ok: false; reason: string } {
  let v = draft;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return { ok: false, reason: 'unparseable' };
    }
  }
  if (!isObject(v)) return { ok: false, reason: 'unparseable' };
  return { ok: true, value: v };
}

function emptyAccepted(): Record<DraftCategory, any[]> {
  return {
    decisions: [],
    actions: [],
    open_questions: [],
    risks: [],
    insights: [],
    statements_to_verify: [],
  };
}

function hasNextMeeting(n: any): boolean {
  return !!(n && (n.date || n.time));
}

function validateNextMeeting(normSource: string, nm: unknown): NextMeetingV3 | null {
  if (!isObject(nm)) return null;
  if (!nm.date && !nm.time) return null;
  // raw_text is copied only when it is itself found in the source (same
  // normalisation and whole word rule, any length). Otherwise a validated
  // source_quote (four or more words) stands in for it. If neither is found,
  // no next meeting is taken from the draft.
  let rawText: string;
  if (displayQuoteInSource(normSource, nm.raw_text)) rawText = nm.raw_text as string;
  else if (quoteInSource(normSource, nm.source_quote)) rawText = nm.source_quote as string;
  else return null;
  return {
    summary: typeof nm.summary === 'string' ? nm.summary : null,
    date: typeof nm.date === 'string' ? nm.date : null,
    time: typeof nm.time === 'string' ? nm.time : null,
    raw_text: rawText,
  };
}

/* --------------------------------------------------------------- validate */

export function validateModelDraft(input: ValidateInput): ValidationResult {
  const result: ValidationResult = {
    parsed: false,
    accepted: emptyAccepted(),
    rejected: [],
    capNotes: [],
    suppliedCategories: [],
    totalItems: 0,
    rejectedCount: 0,
    evidenceDropped: 0,
    nextMeeting: null,
    replacementParticipants: null,
    droppedParticipants: [],
    consent: null,
  };
  const parsed = parseDraft(input?.draft);
  if (!parsed.ok) {
    result.parseError = parsed.reason;
    return result;
  }
  result.parsed = true;
  const draft = parsed.value;
  const normSource = normaliseText(input.source?.text ?? '');
  const normHay = quoteHaystack(normSource, input.source?.text ?? '');
  const resolved = resolveParticipants(draft, input.ruleRecord, normSource, input.sourceKind ?? 'transcript');
  const participants = resolved.names;
  result.replacementParticipants = resolved.replacement;
  result.droppedParticipants = resolved.dropped;

  for (const category of DRAFT_CATEGORIES) {
    const raw = draft[category];
    if (!Array.isArray(raw)) continue;
    result.suppliedCategories.push(category);
    const field = TEXT_FIELD[category];
    const survivors: any[] = [];
    const keptWords: string[][] = [];
    const survivorDropped: number[] = [];
    for (const rawItem of raw) {
      const item: any = widenItemQuotes(rawItem, input.source?.text ?? '', normSource);
      result.totalItems++;
      const reject = (rule: RejectionRule) => result.rejected.push({ category, item, rule });
      if (!isObject(item) || typeof item[field] !== 'string' || !item[field].trim()) {
        reject('malformed_item');
        continue;
      }
      if (!itemQuotes(item).some((q) => quoteInSource(normHay, q))) {
        reject('evidence_not_in_source');
        continue;
      }
      if (category === 'actions') {
        const owner = item.owner;
        const hasOwner = typeof owner === 'string' ? owner.trim() !== '' : owner != null;
        if (hasOwner && (typeof owner !== 'string' || !allNamesAreParticipants(owner, participants))) {
          reject('owner_not_participant');
          continue;
        }
      }
      if (category === 'insights' && item.who !== undefined && item.who !== null && item.who !== '') {
        if (typeof item.who !== 'string' || !allNamesAreParticipants(item.who, participants)) {
          reject('who_not_participant');
          continue;
        }
      }
      if (isFragment(item[field])) {
        reject('fragment');
        continue;
      }
      const w = words(item[field]);
      const dupAt = keptWords.findIndex((k) => wordOverlap(k, w) >= DUPLICATE_OVERLAP);
      if (dupAt >= 0) {
        // The same task for a different participant: one action that names both owners.
        const kept = survivors[dupAt];
        if (category === 'actions' && typeof item.owner === 'string' && item.owner.trim() && typeof kept?.owner === 'string' && kept.owner.trim() && !kept.owner.toLowerCase().includes(item.owner.trim().toLowerCase())) {
          survivors[dupAt] = { ...kept, owner: `${kept.owner} and ${item.owner.trim()}` };
          continue;
        }
        reject('duplicate');
        continue;
      }
      const cleaned = sanitiseEvidence(item, normHay);
      survivorDropped.push(cleaned.dropped);
      survivors.push(withReadableEvidence(withSafeDisplayQuote(cleaned.item, normHay), normHay));
      keptWords.push(w);
    }
    const ruleCount = Array.isArray((input.ruleRecord as any)?.[category]) ? (input.ruleRecord as any)[category].length : 0;
    const floor = category === 'insights' ? INSIGHT_CAP_FLOOR : CAP_FLOOR;
    const cap = Math.max(CAP_MULTIPLIER * ruleCount + CAP_ALLOWANCE, floor);
    if (survivors.length > cap) {
      const order = capOrder(category, survivors);
      const keepIdx = order.slice(0, cap).sort((a, b) => a - b);
      const dropIdx = order.slice(cap).sort((a, b) => a - b);
      const trimmed = dropIdx.map((i) => survivors[i]);
      for (const item of trimmed) result.rejected.push({ category, item, rule: 'category_cap' });
      result.capNotes.push({
        category,
        cap,
        ruleCount,
        survivors: survivors.length,
        kept: cap,
        trimmed: trimmed.length,
        reason: `${category} exceeded the cap of ${cap} (twice the ${ruleCount} rule engine item${ruleCount === 1 ? '' : 's'} plus ${CAP_ALLOWANCE}, at least ${floor}); ${trimmed.length} trimmed`,
      });
      result.accepted[category] = keepIdx.map((i) => survivors[i]);
      result.evidenceDropped += keepIdx.reduce((a, i) => a + survivorDropped[i], 0);
    } else {
      result.accepted[category] = survivors;
      result.evidenceDropped += survivorDropped.reduce((a, b) => a + b, 0);
    }
  }
  result.rejectedCount = result.rejected.length;
  result.nextMeeting = validateNextMeeting(normHay, draft.next_meeting);
  result.consent = validateConsent(normSource, draft.consent, participants, input.source?.text ?? '', normHay);
  return result;
}

function nameList(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const n of v) {
    if (typeof n !== 'string' || !n.trim()) return null;
    out.push(n.trim());
  }
  return out;
}

/**
 * The model's account of recording consent. Used only when the rule record found none.
 * Accepted only if its quote is in the source and every name it gives is a participant.
 */
function validateConsent(normSource: string, c: unknown, participants: string[], sourceText?: string, normHay: string = normSource): ModelConsent | null {
  if (!isObject(c)) return null;
  if (sourceText !== undefined) c = { ...c, source_quote: widenShortQuote(sourceText, normSource, c.source_quote) };
  if (!isObject(c) || !quoteInSource(normHay, c.source_quote)) return null;
  const agreed = nameList(c.agreed);
  const declined = nameList(c.declined);
  const notAsked = nameList(c.not_asked);
  if (!agreed || !declined || !notAsked) return null;
  const askedBy = typeof c.asked_by === 'string' && c.asked_by.trim() ? c.asked_by.trim() : null;
  const all = [...agreed, ...declined, ...notAsked, ...(askedBy ? [askedBy] : [])];
  if (all.some((n) => !ownerIsParticipant(n, participants))) return null;
  const aboutRaw = typeof c.about === 'string' ? c.about.replace(/[^\p{L}\s']/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : '';
  const about = aboutRaw && aboutRaw.split(' ').length <= 8 && !/\bai\b|artificial intelligence/.test(aboutRaw) ? aboutRaw : 'recording';
  const parts: string[] = [];
  if (askedBy) parts.push(`${askedBy} asked about ${about}.`);
  if (agreed.length) parts.push(`Agreed: ${agreed.join(', ')}.`);
  if (declined.length) parts.push(`Declined: ${declined.join(', ')}. There is no consent from them for ${about}.`);
  if (notAsked.length) parts.push(`Not asked: ${notAsked.join(', ')}. Consent was not recorded for them.`);
  if (!askedBy) parts.push(agreed.length + declined.length > 0 ? `Consent to ${about} was given without a recorded request.` : 'Consent was not asked.');
  return {
    asked_by: askedBy,
    answered_by: agreed.length ? agreed.join(', ') : null,
    at: null,
    note: parts.join(' '),
    source_quote: String(c.source_quote),
    agreed,
    declined,
    not_asked: notAsked,
  };
}

/** True when two names refer to the same participant (full name or first name). */
function samePerson(a: unknown, b: unknown, participants: string[]): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const full = (n: string) => participants.map(normaliseName).find((p) => p === n || p.split(' ')[0] === n) ?? n;
  return full(na) === full(nb);
}

/* ------------------------------------------------------------------ merge */

function fallback(rule: MeetingModel, reason: string): MergedRecord {
  const out = structuredClone(rule) as MergedRecord;
  out.drafting_method = 'basic';
  const warnings = Array.isArray(out.warnings) ? out.warnings : [];
  warnings.push(`Model draft not used: ${reason}`);
  out.warnings = warnings;
  return out;
}

export function mergeModelDraft(ruleRecord: MeetingModel, modelDraft: unknown, source: ValidatorSource, sourceKind: SourceKind = 'transcript'): MergedRecord {
  const v = validateModelDraft({ source, ruleRecord, draft: modelDraft, sourceKind });
  if (!v.parsed) return fallback(ruleRecord, 'unparseable output');
  if (v.totalItems === 0) return fallback(ruleRecord, 'empty draft');
  if (v.rejectedCount > v.totalItems * MAJORITY_LOSS) {
    return fallback(ruleRecord, `more than half of the items were rejected (${v.rejectedCount} of ${v.totalItems})`);
  }

  // Only the named item categories and the next meeting can come from the draft.
  // Consent, participants, participant count and signals are never copied.
  const out = structuredClone(ruleRecord) as MergedRecord;
  const o = out as any;
  // A category the draft supplies (even as an empty array) is replaced by the
  // model's validated items. A category the draft omits keeps the rule items.
  const emptied: DraftCategory[] = [];
  for (const category of DRAFT_CATEGORIES) {
    if (!v.suppliedCategories.includes(category)) continue;
    const kept = v.accepted[category];
    const ruleItems = Array.isArray(o[category]) ? o[category] : [];
    if (kept.length === 0 && ruleItems.length > 0) emptied.push(category);
    o[category] = structuredClone(kept);
  }
  if (!hasNextMeeting(ruleRecord.next_meeting) && !hasNextMeeting((ruleRecord as any).nextMeeting) && v.nextMeeting) {
    out.next_meeting = v.nextMeeting;
  }
  if (v.replacementParticipants) o.participants = structuredClone(v.replacementParticipants);
  // Consent: the rule record's finding stands whenever it found who asked, with three exceptions
  // that rest only on a validated model finding (quote in the source, every name a participant):
  // 1. the rule's asker is someone the model shows answering, so the rule mistook an answer for
  //    the request: the model finding replaces it;
  // 2. both name the same asker: the model's answer lists replace the rule's, keeping the rule's time;
  // 3. otherwise the model finding can only add who declined or was never asked to the note.
  // Only when the rule found no asker does a validated model finding fill the gap outright.
  const ruleConsent = (ruleRecord as any).consent;
  // Empty name lists are left out of the record, as the rule engine does.
  const mc = v.consent ? (Object.fromEntries(Object.entries(v.consent).filter(([, val]) => !(Array.isArray(val) && val.length === 0))) as unknown as ModelConsent) : null;
  const list = (c: ModelConsent, k: 'agreed' | 'declined'): string[] => (Array.isArray(c[k]) ? c[k] : []);
  const people = (Array.isArray(o.participants) ? o.participants : []).map((p: any) => String(p?.name ?? '')).filter(Boolean);
  if (mc && !(ruleConsent && ruleConsent.asked_by)) o.consent = structuredClone(mc);
  else if (mc && ruleConsent && ruleConsent.asked_by && [...list(mc, 'agreed'), ...list(mc, 'declined')].some((n) => samePerson(n, ruleConsent.asked_by, people))) {
    o.consent = structuredClone(mc);
  } else if (mc && ruleConsent && ruleConsent.asked_by && samePerson(mc.asked_by, ruleConsent.asked_by, people)) {
    o.consent = { ...structuredClone(mc), asked_by: ruleConsent.asked_by, at: ruleConsent.at ?? null };
  } else if (mc && ruleConsent && ruleConsent.asked_by && /Declined:|Not asked:/.test(mc.note)) {
    const extra = mc.note.split(/(?<=\.)\s+/).filter((p) => /^(Declined|Not asked):/.test(p)).join(' ');
    if (extra && !String(o.consent.note ?? '').includes(extra)) o.consent = { ...o.consent, note: `${o.consent.note ? `${o.consent.note} ` : ''}Model draft adds: ${extra}`.trim() };
  }
  out.drafting_method = 'model';
  out.rejected_model_items = structuredClone(v.rejected);
  const warnings = Array.isArray(out.warnings) ? out.warnings : [];
  warnings.push(`Model draft used with ${v.rejectedCount} rejected item${v.rejectedCount === 1 ? '' : 's'} of ${v.totalItems}. See rejected_model_items.`);
  for (const n of v.capNotes) warnings.push(n.reason);
  if (v.droppedParticipants.length > 0) {
    warnings.push(`Model draft: participant${v.droppedParticipants.length === 1 ? '' : 's'} dropped because not found in the source: ${v.droppedParticipants.join(', ')}.`);
  }
  if (v.evidenceDropped > 0) {
    warnings.push(`Model draft: ${v.evidenceDropped} evidence entr${v.evidenceDropped === 1 ? 'y was' : 'ies were'} dropped because the quote was not found in the source.`);
  }
  for (const category of emptied) {
    warnings.push(`Model draft emptied ${category}: the draft supplied no validated items, so the rule engine items for this category were removed.`);
  }
  out.warnings = warnings;
  return out;
}
