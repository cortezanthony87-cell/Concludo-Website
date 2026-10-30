/**
 * Reference adapter: MeetingRecord v1 (claude/Concludo_MeetingRecord_Schema_v1.json)
 * plus the reviewer's decisions in the studio, into a deck payload.
 *
 * Rules this adapter must keep, whatever record shape it reads:
 * - Review state comes from the person, never from the record's own evidence label.
 * - A value whose status is not "stated" becomes null and prints as a gap.
 * - Client side is decided by organisation match or by the reviewer, never guessed.
 * - Only risks someone raised aloud (evidence = confirmed) reach a client deck.
 *
 * If Meeting Output v2's engine record differs from v1, write a sibling adapter
 * (fromEngineRecord.ts) with the same rules. Do not loosen them.
 */
import type { DeckPayload, ReviewStatus, SourceRef } from './deckPayload';

type Status = 'stated' | 'not_stated' | 'not_applicable' | 'withheld';
interface Person { name: string | null; role?: string | null; organisation?: string | null; status: Status }

export interface MeetingRecordV1 {
  meeting: { id: string; title: string; date: string | null; date_status?: Status; duration_minutes?: number | null; client_or_project?: string | null; outcome_one_line?: string };
  executive_summary: string;
  decisions: { id: string; decision: string; approver: Person; conditions: string | null; evidence: string; source_basis: string }[];
  actions: { id: string; action: string; owner: Person; definition_of_done: string | null; definition_of_done_status?: Status; due_date: string | null; due_date_status?: Status; evidence: string; source_basis: string }[];
  open_questions: { id: string; question: string; expected_resolver: Person; needed_by: string | null; evidence: string }[];
  risks: { id: string; risk: string; mitigation: string | null; owner: Person; evidence: string }[];
}

export interface ReviewContext {
  /** Per item id, what the reviewer did. Items absent from the map count as proposed. */
  review: Record<string, ReviewStatus>;
  approval: { by: string; atISO: string } | null;
  audience: 'client' | 'internal';
  version: number;
  preparedBy: { name: string; organisation: string | null };
  /** The client's organisation name as the reviewer confirmed it. */
  clientOrganisation: string | null;
  /** Action ids the reviewer marked as owed by the client. Overrides organisation match. */
  clientSideIds?: string[];
  outcomeConfirmed: boolean;
  nothingLeftOpenConfirmed: boolean;
  kind?: string;
  format?: string | null;
  classification?: string;
  nextMeeting: DeckPayload['nextMeeting'];
  correctionDeadline: DeckPayload['correctionDeadline'];
}

const stated = (p: Person | undefined) => (p && p.status === 'stated' && p.name ? p.name : null);

/** Pulls "line 112" and "14:05" out of a source_basis string when they are there. */
export function parseSource(basis: string | null | undefined, quote?: string | null): SourceRef {
  const s = basis ?? '';
  const line = /\bline\s+(\d+)/i.exec(s);
  const time = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/.exec(s);
  return { line: line ? Number(line[1]) : null, time: time ? time[1] : null, quote: quote ?? null };
}

function splitSummary(s: string): { headline: string | null; body: string | null } {
  const t = s.trim();
  if (!t) return { headline: null, body: null };
  const m = /^(.+?[.!?])(\s+|$)([\s\S]*)$/.exec(t);
  if (!m) return { headline: t.replace(/[.]$/, ''), body: null };
  return { headline: m[1].replace(/[.]$/, ''), body: m[3].trim() || null };
}

export function fromMeetingRecordV1(r: MeetingRecordV1, ctx: ReviewContext): DeckPayload {
  const rv = (id: string): ReviewStatus => ctx.review[id] ?? 'proposed';
  const org = ctx.clientOrganisation;
  const clientIds = new Set(ctx.clientSideIds ?? []);
  const { headline, body } = splitSummary(r.executive_summary);
  return {
    schema: 'concludo.deck/1.0',
    audience: ctx.audience,
    meeting: {
      recordId: r.meeting.id,
      version: ctx.version,
      title: r.meeting.title,
      client: r.meeting.client_or_project ?? org ?? null,
      kind: ctx.kind ?? (ctx.audience === 'client' ? 'Client meeting record' : 'Internal meeting record'),
      outcomeLine: ctx.outcomeConfirmed ? r.meeting.outcome_one_line ?? null : null,
      dateISO: r.meeting.date_status === 'stated' || r.meeting.date_status === undefined ? r.meeting.date : null,
      durationMinutes: r.meeting.duration_minutes ?? null,
      format: ctx.format ?? null,
    },
    preparedBy: ctx.preparedBy,
    approval: ctx.approval,
    classification: ctx.classification ?? 'Commercial in confidence',
    summary: { headline, body },
    decisions: r.decisions.map((d) => ({
      id: d.id,
      review: rv(d.id),
      text: d.decision,
      decidedBy: stated(d.approver),
      decidedByOrg: d.approver.status === 'stated' ? d.approver.organisation ?? null : null,
      conditions: d.conditions,
      source: parseSource(d.source_basis),
    })),
    actions: r.actions.map((a) => ({
      id: a.id,
      review: rv(a.id),
      text: a.action,
      owner: stated(a.owner),
      ownerOrg: a.owner.organisation ?? null,
      clientSide: clientIds.has(a.id) || (!!org && a.owner.status === 'stated' && a.owner.organisation === org),
      dueISO: (a.due_date_status ?? 'stated') === 'stated' ? a.due_date : null,
      doneWhen: (a.definition_of_done_status ?? 'stated') === 'stated' ? a.definition_of_done : null,
      source: parseSource(a.source_basis),
    })),
    openQuestions: r.open_questions.map((q) => ({
      id: q.id,
      review: rv(q.id),
      text: q.question,
      resolver: stated(q.expected_resolver),
      neededByISO: q.needed_by && /^\d{4}-\d{2}-\d{2}$/.test(q.needed_by) ? q.needed_by : null,
      source: { line: null, time: null },
    })),
    risks: r.risks
      .filter((k) => k.evidence === 'confirmed')
      .map((k) => ({
        id: k.id,
        review: rv(k.id),
        text: k.risk,
        raisedBy: null,
        mitigationIds: [],
        source: { line: null, time: null },
      })),
    nothingLeftOpenConfirmed: ctx.nothingLeftOpenConfirmed,
    nextMeeting: ctx.nextMeeting,
    correctionDeadline: ctx.correctionDeadline,
  };
}
