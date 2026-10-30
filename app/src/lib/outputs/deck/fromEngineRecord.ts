/**
 * Adapter from Meeting Output v2 MeetingModel plus the reviewer's decisions in the studio,
 * into a Concludo deck payload (version 1.0).
 *
 * Rules this adapter must keep:
 * - Review state comes from the person (ReviewContext), never from the record's evidence.
 *   Not reviewed means 'proposed'.
 * - A value not stated becomes null and prints as a gap.
 * - Client side is decided by organisation match or by the reviewer, never guessed.
 * - Only risks someone raised aloud (raisedBy stated, or non-inferred evidence) reach a client deck.
 *   Concludo's own inferences never reach a deck.
 * - If not approved, approval is null, which blocks export.
 * - Headline one sentence under 110 chars; body under 45 words.
 */
import type { MeetingModel } from '../../intelligence/meetingEngine';
import type { DeckPayload, ReviewStatus, SourceRef } from './deckPayload';
import type { ReviewContext } from './fromMeetingRecord';

export interface EngineReviewContext extends ReviewContext {
  summary?: {
    headline?: string | null;
    body?: string | null;
  };
}

function splitSummary(s: string): { headline: string | null; body: string | null } {
  const t = (s || '').trim();
  if (!t) return { headline: null, body: null };
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  let headline = '';
  let body = '';
  if (sentences.length > 0) {
    headline = sentences[0].trim().replace(/[.]$/, '');
    // If the first sentence is generic meta and the second provides the actual headline:
    if (/^the meeting made \d+ decision/i.test(headline) && sentences.length > 1) {
      const second = sentences[1].trim();
      const m = /the headline:\s*(.+)$/i.exec(second);
      if (m) {
        headline = m[1].trim().replace(/[.]$/, '');
        body = sentences.slice(2).join(' ').trim();
      } else {
        body = sentences.slice(1).join(' ').trim();
      }
    } else {
      body = sentences.slice(1).join(' ').trim();
    }
  }
  // Enforce headline < 110 characters
  if (headline.length > 105) {
    headline = headline.slice(0, 102).trim() + '...';
  }
  // Enforce body < 45 words
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length > 40) {
    body = words.slice(0, 40).join(' ') + '...';
  }
  return { headline: headline || null, body: body || null };
}

function parseEngineSource(ev?: { line?: number; timestamp?: string; quote?: string } | null, quoteAllowed?: boolean): SourceRef {
  if (!ev) return { line: null, time: null, quote: null };
  return {
    line: typeof ev.line === 'number' ? ev.line : null,
    time: ev.timestamp ?? null,
    quote: quoteAllowed ? ev.quote ?? null : null,
  };
}

export function fromEngineRecord(m: MeetingModel, ctx: EngineReviewContext): DeckPayload {
  const rv = (id: string): ReviewStatus => ctx.review[id] ?? 'proposed';
  const org = ctx.clientOrganisation || m.meta.organisation || null;
  const clientIds = new Set(ctx.clientSideIds ?? []);
  
  const parsed = splitSummary(m.bottomLine);
  const headline = ctx.summary?.headline !== undefined ? ctx.summary.headline : parsed.headline;
  const body = ctx.summary?.body !== undefined ? ctx.summary.body : parsed.body;

  return {
    schema: 'concludo.deck/1.0',
    audience: ctx.audience,
    meeting: {
      recordId: m.meta.project || m.meta.title,
      version: ctx.version,
      title: m.meta.title,
      client: org,
      kind: ctx.kind ?? (ctx.audience === 'client' ? 'Client meeting record' : 'Internal meeting record'),
      outcomeLine: ctx.outcomeConfirmed ? (m.bottomLine || null) : null,
      dateISO: m.meta.meetingDate && /^\d{4}-\d{2}-\d{2}$/.test(m.meta.meetingDate) ? m.meta.meetingDate : null,
      durationMinutes: m.meta.duration ? (parseInt(m.meta.duration, 10) || null) : null,
      format: ctx.format ?? null,
    },
    preparedBy: ctx.preparedBy,
    approval: ctx.approval,
    classification: ctx.classification ?? 'Commercial in confidence',
    summary: { headline, body },
    decisions: m.decisions.map((d) => {
      const ev = d.evidence && d.evidence.length > 0 ? d.evidence[0] : null;
      return {
        id: d.id,
        review: rv(d.id),
        text: d.statement || d.title,
        decidedBy: d.calledBy || null,
        decidedByOrg: null,
        conditions: d.condition || null,
        source: parseEngineSource(ev),
      };
    }),
    actions: m.actions.map((a) => {
      const ev = a.evidence && a.evidence.length > 0 ? a.evidence[0] : null;
      const ownerStated = a.owner && a.ownerBasis !== 'none' ? a.owner : null;
      return {
        id: a.id,
        review: rv(a.id),
        text: a.task,
        owner: ownerStated,
        ownerOrg: null,
        clientSide: clientIds.has(a.id),
        dueISO: a.due && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : null,
        doneWhen: a.doneDefinition || null,
        source: parseEngineSource(ev),
      };
    }),
    openQuestions: m.openItems.map((q) => {
      const ev = q.evidence && q.evidence.length > 0 ? q.evidence[0] : null;
      return {
        id: q.id,
        review: rv(q.id),
        text: q.question,
        resolver: q.raisedBy || null,
        neededByISO: null,
        source: parseEngineSource(ev),
      };
    }),
    risks: m.risks
      // Only risks that someone said aloud reach a client deck (raisedBy exists, not an inferred risk)
      .filter((k) => !!k.raisedBy)
      .map((k) => {
        const ev = k.evidence && k.evidence.length > 0 ? k.evidence[0] : null;
        return {
          id: k.id,
          review: rv(k.id),
          text: k.risk,
          raisedBy: k.raisedBy || null,
          mitigationIds: k.linkedAction ? [k.linkedAction] : [],
          source: parseEngineSource(ev),
        };
      }),
    nothingLeftOpenConfirmed: ctx.nothingLeftOpenConfirmed,
    nextMeeting: ctx.nextMeeting,
    correctionDeadline: ctx.correctionDeadline,
  };
}
