/**
 * Offline replay for the model drafting route. No network, no key.
 * Runs the rule engine, then merges and shapes a SAVED model reply exactly as
 * model-drafting-run.ts does after its API call, and writes the same exports.
 * Usage:
 *   bun run scripts/model-drafting-replay.ts <sourceFile> <transcript|notes|document> <YYYY-MM-DD> <savedReplyFile> <outDir> [savedReviewFile]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { analyseMeeting, toMarkdown } from '../src/lib/intelligence/meetingEngine';
import { exportStandaloneHtml } from '../src/features/meeting-output/studio.js';
import { combineDrafts, mergeModelDraft } from '../src/lib/intelligence/modelDraftValidator';
import { shapeModelRecord } from '../src/lib/intelligence/modelDraftShape';

const [srcPath, kindArg, meetingDate, replyPath, outDir, reviewPath] = process.argv.slice(2);
if (!srcPath || !kindArg || !meetingDate || !replyPath || !outDir) {
  console.error('usage: model-drafting-replay.ts <sourceFile> <transcript|notes|document> <YYYY-MM-DD> <savedReplyFile> <outDir>');
  process.exit(1);
}
const kind = kindArg as 'transcript' | 'notes' | 'document';
mkdirSync(outDir, { recursive: true });
const text = readFileSync(srcPath, 'utf8');
const name = basename(srcPath);
const opts = kind === 'transcript' ? { meetingDate, sourceType: 'transcript' as const } : { meetingDate };
const ruleRecord: any = analyseMeeting([{ name, kind: kind as any, text }], opts);
let draftText = readFileSync(replyPath, 'utf8').trim();
const fence = draftText.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
if (fence) draftText = fence[1].trim();
const reviewText = reviewPath ? readFileSync(reviewPath, 'utf8') : '';
const merged: any = mergeModelDraft(ruleRecord, reviewText.trim() ? combineDrafts(draftText, reviewText) : draftText, { text, kind, name }, kind);
if (merged.drafting_method === 'model') shapeModelRecord(merged, { text, kind, name });
const md = toMarkdown(merged);
const html = exportStandaloneHtml(merged);
writeFileSync(join(outDir, 'meeting_record.json'), JSON.stringify(merged, null, 2));
writeFileSync(join(outDir, 'meeting_record.md'), md);
writeFileSync(join(outDir, 'meeting_record.html'), html);
const counts: Record<string, number> = {};
for (const c of ['decisions', 'actions', 'open_questions', 'risks', 'insights', 'statements_to_verify', 'openItems', 'recommendations']) counts[c] = Array.isArray(merged[c]) ? merged[c].length : 0;
const undef = (md.match(/undefined/g) ?? []).length + (html.match(/undefined/g) ?? []).length;
console.log(JSON.stringify({ source: name, drafting_method: merged.drafting_method, counts, undefined_in_exports: undef, warnings: merged.warnings }));
