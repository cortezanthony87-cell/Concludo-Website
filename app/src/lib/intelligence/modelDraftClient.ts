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
import { mergeModelDraft, type MergedRecord } from './modelDraftValidator';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserMessage } from './modelDraftPrompt';

export type ModelTransport = (req: { system: string; user: string; maxOutputTokens: number }) => Promise<string>;

export const MODEL_ROUTE_ENABLED: boolean = false;

export const MAX_SOURCE_CHARS = 60000;
export const MAX_OUTPUT_TOKENS = 4000;
export const CALL_TIMEOUT_MS = 60000;

export type DraftedRecord = MergedRecord & { drafting_prompt_version?: string };

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

  const merged = mergeModelDraft(ruleRecord, response, { text: sourceText, kind: sourceKind }) as DraftedRecord;
  if (merged.drafting_method === 'model') merged.drafting_prompt_version = PROMPT_VERSION;
  return merged;
}
