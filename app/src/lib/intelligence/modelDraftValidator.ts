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

function quoteInSource(normSource: string, quote: unknown): boolean {
  if (typeof quote !== 'string') return false;
  const q = normaliseText(quote);
  if (!q || q.split(' ').length < MIN_QUOTE_WORDS) return false;
  return ` ${normSource} `.includes(` ${q} `);
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
  };
  const parsed = parseDraft(input?.draft);
  if (!parsed.ok) {
    result.parseError = parsed.reason;
    return result;
  }
  result.parsed = true;
  const draft = parsed.value;
  const normSource = normaliseText(input.source?.text ?? '');
  const participants = participantNames(input.ruleRecord);

  for (const category of DRAFT_CATEGORIES) {
    const raw = draft[category];
    if (!Array.isArray(raw)) continue;
    result.suppliedCategories.push(category);
    const field = TEXT_FIELD[category];
    const survivors: any[] = [];
    const keptWords: string[][] = [];
    const survivorDropped: number[] = [];
    for (const item of raw) {
      result.totalItems++;
      const reject = (rule: RejectionRule) => result.rejected.push({ category, item, rule });
      if (!isObject(item) || typeof item[field] !== 'string' || !item[field].trim()) {
        reject('malformed_item');
        continue;
      }
      if (!itemQuotes(item).some((q) => quoteInSource(normSource, q))) {
        reject('evidence_not_in_source');
        continue;
      }
      if (category === 'actions') {
        const owner = item.owner;
        const hasOwner = typeof owner === 'string' ? owner.trim() !== '' : owner != null;
        if (hasOwner && (typeof owner !== 'string' || !ownerIsParticipant(owner, participants))) {
          reject('owner_not_participant');
          continue;
        }
      }
      if (isFragment(item[field])) {
        reject('fragment');
        continue;
      }
      const w = words(item[field]);
      if (keptWords.some((k) => wordOverlap(k, w) >= DUPLICATE_OVERLAP)) {
        reject('duplicate');
        continue;
      }
      const cleaned = sanitiseEvidence(item, normSource);
      survivorDropped.push(cleaned.dropped);
      survivors.push(withSafeDisplayQuote(cleaned.item, normSource));
      keptWords.push(w);
    }
    const ruleCount = Array.isArray((input.ruleRecord as any)?.[category]) ? (input.ruleRecord as any)[category].length : 0;
    const cap = CAP_MULTIPLIER * ruleCount + CAP_ALLOWANCE;
    if (survivors.length > cap) {
      const trimmed = survivors.slice(cap);
      for (const item of trimmed) result.rejected.push({ category, item, rule: 'category_cap' });
      result.capNotes.push({
        category,
        cap,
        ruleCount,
        survivors: survivors.length,
        kept: cap,
        trimmed: trimmed.length,
        reason: `${category} exceeded the cap of ${cap} (twice the ${ruleCount} rule engine item${ruleCount === 1 ? '' : 's'} plus ${CAP_ALLOWANCE}); ${trimmed.length} trimmed`,
      });
      result.accepted[category] = survivors.slice(0, cap);
      result.evidenceDropped += survivorDropped.slice(0, cap).reduce((a, b) => a + b, 0);
    } else {
      result.accepted[category] = survivors;
      result.evidenceDropped += survivorDropped.reduce((a, b) => a + b, 0);
    }
  }
  result.rejectedCount = result.rejected.length;
  result.nextMeeting = validateNextMeeting(normSource, draft.next_meeting);
  return result;
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

export function mergeModelDraft(ruleRecord: MeetingModel, modelDraft: unknown, source: ValidatorSource): MergedRecord {
  const v = validateModelDraft({ source, ruleRecord, draft: modelDraft });
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
  out.drafting_method = 'model';
  out.rejected_model_items = structuredClone(v.rejected);
  const warnings = Array.isArray(out.warnings) ? out.warnings : [];
  warnings.push(`Model draft used with ${v.rejectedCount} rejected item${v.rejectedCount === 1 ? '' : 's'} of ${v.totalItems}. See rejected_model_items.`);
  for (const n of v.capNotes) warnings.push(n.reason);
  if (v.evidenceDropped > 0) {
    warnings.push(`Model draft: ${v.evidenceDropped} evidence entr${v.evidenceDropped === 1 ? 'y was' : 'ies were'} dropped because the quote was not found in the source.`);
  }
  for (const category of emptied) {
    warnings.push(`Model draft emptied ${category}: the draft supplied no validated items, so the rule engine items for this category were removed.`);
  }
  out.warnings = warnings;
  return out;
}
