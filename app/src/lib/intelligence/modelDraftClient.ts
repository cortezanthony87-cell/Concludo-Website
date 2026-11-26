/**
 * Model drafting client wrapper (offline, injected transport).
 *
 * There is no real transport here. This module has no network access, no vendor library,
 * no key and reads no environment. Only a function passed in by the caller can
 * reach a model, and the route is off unless it is explicitly switched on. It
 * never logs or stores the source text, the prompt or the response. It is not
 * wired into analyseMeeting().
 */
import type { MeetingModel } from './meetingEngine';
import { combineDrafts, mergeModelDraft, type MergedRecord } from './modelDraftValidator';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildReviewMessage, buildUserMessage } from './modelDraftPrompt';
import { shapeModelRecord } from './modelDraftShape';

export type ModelTransport = (req: { system: string; user: string; maxOutputTokens: number }) => Promise<string>;

export const MODEL_ROUTE_ENABLED: boolean = false;

export const MAX_SOURCE_CHARS = 60000;
export const MAX_OUTPUT_TOKENS = 16000;
export const CALL_TIMEOUT_MS = 240000;

export type DraftedRecord = MergedRecord & { drafting_prompt_version?: string };

function parsesAsDraft(t: string): boolean {
  try {
    const x = t.trim().replace(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/, '$1');
    const v = JSON.parse(x);
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  } catch {
    return false;
  }
}

function fallback(rule: MeetingModel, reason: string): DraftedRecord {
  const out = structuredClone(rule) as DraftedRecord;
  out.drafting_method = 'basic';
  const warnings = Array.isArray(out.warnings) ? out.warnings : [];
  warnings.push(`Model draft not used: ${reason}`);
  out.warnings = warnings;
  return out;
}

/** Resolves with the transport result, or rejects on a throw or after the timeout. The timer is always cleared. */
function callWithTimeout(transport: ModelTransport, req: Parameters<ModelTransport>[0], timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, timeoutMs);
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    try {
      Promise.resolve(transport(req)).then(
        (v) => done(() => resolve(v)),
        (e) => done(() => reject(e)),
      );
    } catch (e) {
      done(() => reject(e));
    }
  });
}

export async function draftWithModel(args: {
  sourceText: string;
  sourceKind: 'transcript' | 'notes' | 'document';
  meetingDate: string;
  ruleRecord: MeetingModel;
  transport?: ModelTransport;
  enabled?: boolean;
  /** Test hook only. Defaults to 60 seconds. */
  timeoutMs?: number;
  /** Second pass for missed items. On unless false is passed. */
  reviewPass?: boolean;
}): Promise<DraftedRecord> {
  const { sourceText, sourceKind, meetingDate, ruleRecord, transport } = args;
  // On only when the caller passes enabled === true AND the constant is true AND a transport is given.
  // Omitting enabled always means off, whatever the constant says.
  const on = args.enabled === true && MODEL_ROUTE_ENABLED === true;
  if (!on || typeof transport !== 'function') {
    return fallback(ruleRecord, 'model route is off');
  }
  if (typeof sourceText !== 'string' || sourceText.length > MAX_SOURCE_CHARS) {
    return fallback(ruleRecord, 'source too long');
  }

  const participants = (Array.isArray(ruleRecord?.participants) ? ruleRecord.participants : [])
    .map((p) => (p && typeof p.name === 'string' ? p.name : ''))
    .filter(Boolean);
  const req = {
    system: SYSTEM_PROMPT,
    user: buildUserMessage({ sourceText, sourceKind, meetingDate, participants }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };

  let response: unknown;
  try {
    response = await callWithTimeout(transport, req, typeof args.timeoutMs === 'number' ? args.timeoutMs : CALL_TIMEOUT_MS);
  } catch {
    return fallback(ruleRecord, 'model call failed');
  }
  if (typeof response !== 'string') return fallback(ruleRecord, 'model call failed');

  let draftText: string = response;
  if (args.reviewPass !== false && parsesAsDraft(response)) {
    // A failed or unusable second pass is ignored; the first draft stands.
    try {
      const review = await callWithTimeout(
        transport,
        { system: SYSTEM_PROMPT, user: buildReviewMessage({ sourceText, sourceKind, meetingDate, participants }, response), maxOutputTokens: MAX_OUTPUT_TOKENS },
        typeof args.timeoutMs === 'number' ? args.timeoutMs : CALL_TIMEOUT_MS,
      );
      if (typeof review === 'string') draftText = combineDrafts(response, review);
    } catch {
      draftText = response;
    }
  }

  const merged = mergeModelDraft(ruleRecord, draftText, { text: sourceText, kind: sourceKind }, sourceKind) as DraftedRecord;
  if (merged.drafting_method === 'model') {
    shapeModelRecord(merged, { text: sourceText, kind: sourceKind });
    merged.drafting_prompt_version = PROMPT_VERSION;
  }
  return merged;
}
