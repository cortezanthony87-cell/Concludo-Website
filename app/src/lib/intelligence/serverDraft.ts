/**
 * Server entry for model drafting. Bundled by scripts/build-draft-bundle.ts into
 * supabase/functions/draft-meeting-record/engine.bundle.js. Not imported by the browser app.
 *
 * It runs the frozen rule engine (for the structure the merge needs), then the v21 model
 * drafting client, and returns the same record shape the Workspace studio already accepts.
 * It never logs or stores the source text, the prompt or the response.
 */
import { analyseMeeting, type MeetingModel } from './meetingEngine';
import { draftWithModel, type ModelTransport } from './modelDraftClient';

/**
 * Transcripts exported as "Speaker 1 00:07" on one line and the words on the next are read by
 * the rule engine as one speaker per timestamp, or as no speakers at all. Rewrite those headers
 * to "Speaker B: words" (letters, because the parsers only accept letter names). Text, order and
 * wording are unchanged, so every quote still matches the source.
 */
export function normaliseSpeakerHeaders(text: string): string {
  if (typeof text !== 'string') return '';
  const header = /^[ \t]*Speaker[ \t]+(\d{1,3})[ \t]+\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?[ \t]*:?[ \t]*\r?\n+/gim;
  const count = (text.match(header) ?? []).length;
  if (count < 4) return text;
  const label = (n: number): string => {
    let s = '';
    let k = n;
    do {
      s = String.fromCharCode(65 + (k % 26)) + s;
      k = Math.floor(k / 26) - 1;
    } while (k >= 0);
    return `Speaker ${s}`;
  };
  return text.replace(header, (_m, n: string) => `${label(Number(n))}: `);
}

export interface ServerDraftArgs {
  transcript: string;
  meetingDate: string;
  title?: string;
  sourceKind?: 'transcript' | 'notes' | 'document';
  transport: ModelTransport;
  /** Per call timeout. */
  timeoutMs?: number;
}

export type ServerDraftResult =
  | { drafting_method: 'model'; model: MeetingModel; reason: null }
  | { drafting_method: 'basic'; reason: string };

export async function draftMeetingServer(args: ServerDraftArgs): Promise<ServerDraftResult> {
  const kind = args.sourceKind ?? 'transcript';
  const text = kind === 'transcript' ? normaliseSpeakerHeaders(args.transcript) : args.transcript;
  const meta: Record<string, string> = { meetingDate: args.meetingDate };
  if (args.title && args.title !== 'not stated') meta.title = args.title;
  let rule: MeetingModel;
  try {
    rule = analyseMeeting([{ name: 'source.txt', kind, text }] as never, meta as never);
  } catch {
    return { drafting_method: 'basic', reason: 'rule_engine_failed' };
  }
  const out = await draftWithModel({
    sourceText: text,
    sourceKind: kind,
    meetingDate: args.meetingDate,
    ruleRecord: rule,
    transport: args.transport,
    enabled: true,
    timeoutMs: args.timeoutMs,
  });
  if (out.drafting_method === 'model') return { drafting_method: 'model', model: out as MeetingModel, reason: null };
  const w = Array.isArray(out.warnings) ? out.warnings.filter((x: unknown) => typeof x === 'string' && x.startsWith('Model draft not used')) : [];
  const reason = w.length ? String(w[w.length - 1]).replace('Model draft not used: ', '').replace(/\s+/g, '_') : 'model_output_rejected';
  return { drafting_method: 'basic', reason };
}
