/**
 * Concludo deck payload, version 1.0.
 *
 * The contract between an approved meeting record and the deck renderers.
 * The renderers draw only what is here. Anything absent is not printed and
 * is never inferred. Every item must have been confirmed by a person in
 * review; a proposed item blocks export.
 */

export type ReviewStatus = 'confirmed' | 'proposed' | 'excluded';

export interface SourceRef {
  /** Line number in the source record, if known. */
  line?: number | null;
  /** Timestamp in the source record, as written (for example 14:05). */
  time?: string | null;
  /** Short verbatim quote. Printed only when the deck option allows quotes. */
  quote?: string | null;
}

export interface DeckDecision {
  id: string; // D-01
  review: ReviewStatus;
  text: string;
  decidedBy: string | null;
  decidedByOrg?: string | null;
  conditions: string | null;
  source: SourceRef;
}

export interface DeckAction {
  id: string; // A-01
  review: ReviewStatus;
  text: string;
  owner: string | null;
  ownerOrg?: string | null;
  /** True when the owner sits on the client side. Set in review, never guessed. */
  clientSide: boolean;
  /** YYYY-MM-DD, or null when no date was stated. */
  dueISO: string | null;
  doneWhen: string | null;
  source: SourceRef;
}

export interface DeckQuestion {
  id: string; // Q-01
  review: ReviewStatus;
  text: string;
  resolver: string | null;
  neededByISO: string | null;
  source: SourceRef;
}

export interface DeckRisk {
  id: string; // R-01
  review: ReviewStatus;
  text: string;
  /** Who raised it in the meeting. Risks Concludo inferred are never passed in. */
  raisedBy: string | null;
  mitigationIds: string[];
  source: SourceRef;
}

export interface DeckPayload {
  schema: 'concludo.deck/1.0';
  audience: 'client' | 'internal';
  meeting: {
    recordId: string;
    version: number;
    title: string;
    client: string | null;
    /** Short type label for the cover kicker, for example Client meeting record. */
    kind: string;
    /** The single gold cover line. Printed only when the reviewer confirmed it. */
    outcomeLine: string | null;
    dateISO: string | null;
    durationMinutes: number | null;
    format: string | null;
  };
  preparedBy: { name: string; organisation: string | null };
  /** Who approved the record and when. Export is refused without it. */
  approval: { by: string; atISO: string } | null;
  classification: string;
  summary: {
    /** One sentence. The bottom-line slide headline. */
    headline: string | null;
    /** At most about 40 words. */
    body: string | null;
  };
  decisions: DeckDecision[];
  actions: DeckAction[];
  openQuestions: DeckQuestion[];
  risks: DeckRisk[];
  /** True only when the reviewer confirmed that nothing was left open. */
  nothingLeftOpenConfirmed: boolean;
  nextMeeting: {
    dateISO: string | null;
    timeLabel: string | null;
    mustProduce: string | null;
    bringIds: string[];
  } | null;
  correctionDeadline: { label: string; contact: string } | null;
}

export interface DeckOptions {
  /** Brand fonts (Poppins, Inter, IBM Plex Mono) or system-safe fonts (Arial, Consolas). */
  fonts?: 'brand' | 'safe';
  /** Print a short verbatim quote under each decision. Off by default for client decks. */
  quotes?: boolean;
  /** Small "Prepared with Concludo" line on the last slide. */
  preparedWith?: boolean;
  /** Navy lockup on a light background, as a data URL, with its width / height ratio. */
  logo?: { dataUrl: string; aspect: number } | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const HEADLINE_MAX = 110; // two lines at 28 pt across the content width
const BODY_MAX_WORDS = 45;

/** Items still awaiting review. Export is blocked while any remain. */
export function unreviewedCount(p: DeckPayload): number {
  const all = [...p.decisions, ...p.actions, ...p.openQuestions, ...p.risks];
  return all.filter((i) => i.review === 'proposed').length;
}

export function validateDeck(p: DeckPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (p.schema !== 'concludo.deck/1.0') errors.push('Unknown payload schema.');
  if (!p.approval) errors.push('The record has not been approved. Approve it in review before exporting a deck.');
  const pending = unreviewedCount(p);
  if (pending > 0) errors.push(`${pending} ${pending === 1 ? 'item is' : 'items are'} still to review.`);
  if (!p.meeting.title.trim()) errors.push('The meeting has no title.');
  const kept = live(p);
  const hasContent = kept.decisions.length + kept.actions.length + kept.openQuestions.length + kept.risks.length > 0;
  if (hasContent && !p.summary.headline) errors.push('The bottom line needs a one-sentence headline.');
  if (p.summary.headline && p.summary.headline.length > HEADLINE_MAX)
    errors.push(`The headline is ${p.summary.headline.length} characters. Keep it under ${HEADLINE_MAX} so it fits two lines.`);
  if (p.summary.body && p.summary.body.trim().split(/\s+/).length > BODY_MAX_WORDS)
    errors.push(`The summary is longer than ${BODY_MAX_WORDS} words. Shorten it in review.`);
  const ids = new Set<string>();
  for (const i of [...p.decisions, ...p.actions, ...p.openQuestions, ...p.risks]) {
    if (ids.has(i.id)) errors.push(`Duplicate id ${i.id}.`);
    ids.add(i.id);
    if (!i.text.trim()) errors.push(`${i.id} has no text.`);
  }
  for (const a of p.actions) if (a.dueISO && !isISODate(a.dueISO)) errors.push(`${a.id} has a malformed date.`);
  if (p.meeting.dateISO && !isISODate(p.meeting.dateISO)) errors.push('The meeting date is malformed.');
  if (p.audience === 'client' && p.risks.some((r) => r.review === 'confirmed' && !r.raisedBy))
    warnings.push('A risk with no named person who raised it will print as raised in the meeting. Confirm it was said aloud.');
  return { ok: errors.length === 0, errors, warnings };
}

/** Confirmed items only. Excluded and proposed items never reach a renderer. */
export function live(p: DeckPayload) {
  const ok = <T extends { review: ReviewStatus }>(xs: T[]) => xs.filter((x) => x.review === 'confirmed');
  return {
    decisions: ok(p.decisions),
    actions: ok(p.actions),
    openQuestions: ok(p.openQuestions),
    risks: ok(p.risks),
  };
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
