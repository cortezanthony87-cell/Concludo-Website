/**
 * Command-line test script for one model drafting run. Never imported by app
 * code, never bundled. Usage:
 *   bun run scripts/model-drafting-run.ts <sourceFile> <transcript|notes|document> <YYYY-MM-DD> <outDir>
 * The key is read only from the environment variable ANTHROPIC_DRAFTING_TEST_KEY.
 * It is never printed, logged or written.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { analyseMeeting, toMarkdown } from '../src/lib/intelligence/meetingEngine';
import { exportStandaloneHtml } from '../src/features/meeting-output/studio.js';
import { SYSTEM_PROMPT, PROMPT_VERSION, buildReviewMessage, buildUserMessage } from '../src/lib/intelligence/modelDraftPrompt';
import { combineDrafts, mergeModelDraft } from '../src/lib/intelligence/modelDraftValidator';
import { shapeModelRecord } from '../src/lib/intelligence/modelDraftShape';

const MODEL = 'claude-sonnet-5-5';
const URL = 'https://api.anthropic.com/v1/messages';

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const key = process.env.ANTHROPIC_DRAFTING_TEST_KEY;
if (!key) fail('the required environment variable ANTHROPIC_DRAFTING_TEST_KEY is not set');

const [srcPath, kindArg, meetingDate, outDir] = process.argv.slice(2);
if (!srcPath || !kindArg || !meetingDate || !outDir) fail('usage: model-drafting-run.ts <sourceFile> <transcript|notes|document> <YYYY-MM-DD> <outDir>');
if (kindArg !== 'transcript' && kindArg !== 'notes' && kindArg !== 'document') fail('source kind must be transcript, notes or document');
const kind = kindArg as 'transcript' | 'notes' | 'document';
if (existsSync(join(outDir, 'usage.json')) || existsSync(join(outDir, 'model_raw_response.txt'))) fail('an attempt is already recorded in this folder; no retry');
mkdirSync(outDir, { recursive: true });

const text = readFileSync(srcPath, 'utf8');
const name = basename(srcPath);
const opts = kind === 'transcript' ? { meetingDate, sourceType: 'transcript' as const } : { meetingDate };
const ruleRecord: any = analyseMeeting([{ name, kind, text }], opts);
writeFileSync(join(outDir, 'rule_record.json'), JSON.stringify(ruleRecord, null, 2));

const participants: string[] = (ruleRecord.participants ?? []).map((p: any) => p?.name).filter((n: unknown) => typeof n === 'string' && n.trim() !== '');
const user = buildUserMessage({ sourceText: text, sourceKind: kind, meetingDate, participants });

async function callModel(userText: string, label: string): Promise<{ raw: string; body: any } | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 240000);
  let status = 0;
  let body: any;
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'x-api-key': key as string, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userText }] }),
      signal: ctl.signal,
    });
    status = res.status;
    body = await res.json().catch(() => ({ error: { message: 'response was not JSON' } }));
  } catch (e) {
    clearTimeout(timer);
    const m = e instanceof Error ? e.name : 'unknown';
    if (label === 'first') {
      writeFileSync(join(outDir, 'usage.json'), JSON.stringify({ failed: true, reason: `request error: ${m}` }, null, 2));
      fail(`request failed (${m}); no retry`);
    }
    return null;
  }
  clearTimeout(timer);
  if (status < 200 || status >= 300) {
    const msg = String(body?.error?.message ?? 'no message').slice(0, 500);
    if (label === 'first') {
      writeFileSync(join(outDir, 'usage.json'), JSON.stringify({ failed: true, httpStatus: status, errorType: body?.error?.type ?? null, errorMessage: msg }, null, 2));
      fail(`API returned HTTP ${status}: ${msg}`);
    }
    return null;
  }
  const blocks: any[] = Array.isArray(body?.content) ? body.content : [];
  if (label === 'first') writeFileSync(join(outDir, 'content_block_types.json'), JSON.stringify(blocks.map((b: any) => b?.type ?? null), null, 2));
  const raw: string = blocks.filter((b: any) => b?.type === 'text').map((b: any) => String(b?.text ?? '')).join('');
  return { raw, body };
}

const first = (await callModel(user, 'first'))!;
const raw = first.raw;
const body = first.body;
writeFileSync(join(outDir, 'model_raw_response.txt'), raw);
// Second pass for missed items, as the app does. A failed review leaves the first draft standing.
const review = await callModel(buildReviewMessage({ sourceText: text, sourceKind: kind, meetingDate, participants }, raw), 'review');
writeFileSync(join(outDir, 'model_review_response.txt'), review ? review.raw : '');
writeFileSync(join(outDir, 'usage.json'), JSON.stringify({
  model_requested: MODEL,
  model_returned: body?.model ?? null,
  input_tokens: body?.usage?.input_tokens ?? null,
  output_tokens: body?.usage?.output_tokens ?? null,
  stop_reason: body?.stop_reason ?? null,
  review_ok: Boolean(review),
  review_input_tokens: review?.body?.usage?.input_tokens ?? null,
  review_output_tokens: review?.body?.usage?.output_tokens ?? null,
  review_stop_reason: review?.body?.stop_reason ?? null,
  prompt_version: PROMPT_VERSION,
}, null, 2));

let draftText = raw.trim();
const fence = draftText.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
if (fence) draftText = fence[1].trim();

const combined = review ? combineDrafts(draftText, review.raw) : draftText;
const merged: any = mergeModelDraft(ruleRecord, combined, { text, kind, name }, kind);
if (merged.drafting_method === 'model') shapeModelRecord(merged, { text, kind, name });
writeFileSync(join(outDir, 'meeting_record.json'), JSON.stringify(merged, null, 2));
const counts: Record<string, number> = {};
for (const c of ['decisions', 'actions', 'open_questions', 'risks', 'insights', 'statements_to_verify']) counts[c] = Array.isArray(merged[c]) ? merged[c].length : 0;
writeFileSync(join(outDir, 'validation.json'), JSON.stringify({
  drafting_method: merged.drafting_method ?? null,
  accepted_counts: counts,
  rejected_model_items: merged.rejected_model_items ?? [],
  warnings: merged.warnings ?? [],
}, null, 2));
writeFileSync(join(outDir, 'meeting_record.md'), toMarkdown(merged));
writeFileSync(join(outDir, 'meeting_record.html'), exportStandaloneHtml(merged));
console.log(JSON.stringify({ source: name, drafting_method: merged.drafting_method ?? null, accepted_counts: counts, rejected: (merged.rejected_model_items ?? []).length }));
