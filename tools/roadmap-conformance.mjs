#!/usr/bin/env node
/**
 * Roadmap conformance linter.
 *
 * The registry is authoritative for identifiers. A tasklet document that names
 * OUT-09 "Recommendation Log" or D1 "Participation Analysis" will be built as
 * written, and the resulting code will not match the engine that reads the
 * registry. This is the same class of error as the T01 against T1 collision,
 * and it is cheap to catch mechanically and expensive to catch in review.
 *
 * Usage:  node tools/roadmap-conformance.mjs <file.md> [...more files]
 * Exit:   0 clean, 1 on any finding.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/registry.mjs';

const idx = JSON.parse(readFileSync(join(ROOT, 'registry', 'id_index.json'), 'utf8'));

const NORM = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Words that make a nearby phrase a claim about what the id IS, not a passing mention. */
const NAMING = /\(([^)]*?)\)|["“”']([^"“”']{3,60})["“”']/g;

const findings = [];
const quoted = [];
let quotingPermitted = false;

/**
 * Prose rules that a corrections document must be able to quote in order to
 * prohibit. Identifier rules are never downgraded: naming OUT-09 wrongly is
 * wrong in any document, including a corrections patch.
 */
const PROSE_RULES = new Set([
  'enterprise_tier', 'benchmark_language', 'bare_pro',
  'individual_measurement', 'board_minutes', 'band_mismatch', 'score_not_nullable',
  'waste_claim',
]);

const add = (file, line, code, detail) => {
  if (quotingPermitted && PROSE_RULES.has(code)) quoted.push({ file, line, code, detail });
  else findings.push({ file, line, code, detail });
};

/** Does the text around an id assert a name that disagrees with the registry? */
function checkNamedId(file, lineNo, line, id, canonical, kind) {
  // Look at the 60 characters before and after the id for a name-shaped phrase.
  const at = line.indexOf(id);
  const window = line.slice(Math.max(0, at - 70), Math.min(line.length, at + 70));
  const canon = NORM(canonical);

  // Candidate names: the title-cased run immediately before " (ID" or after "ID: "
  const before = line.slice(Math.max(0, at - 70), at);
  const patterns = [
    /([A-Z][A-Za-z]*(?:\s+[A-Za-z&]+){0,5})\s*(?:deliverable|document|report|generator|schema|plot|matrix|renderer|register|pack|plan|log|brief|summary|analysis|canvas|dashboard)?\s*\(\s*$/,
    /([A-Z][A-Za-z]*(?:\s+[A-Za-z&]+){0,5})\s*[:,]\s*$/,
  ];
  let claimed = null;
  for (const p of patterns) {
    const m = before.match(p);
    if (m) { claimed = m[1].trim(); break; }
  }
  if (!claimed) return;

  const c = NORM(claimed);
  if (!c || c.length < 4) return;
  // Accept if the claimed name shares a meaningful token run with the canonical name.
  const canonTokens = new Set(canon.split(' ').filter((w) => w.length > 3));
  const claimTokens = c.split(' ').filter((w) => w.length > 3);
  const overlap = claimTokens.filter((w) => canonTokens.has(w)).length;
  if (overlap > 0) return;

  add(file, lineNo, `${kind}_name_mismatch`,
    `${id} is named "${claimed}" here. The registry says ${id} is "${canonical}". Context: ...${window.trim()}...`);
}

const QUOTING_MARKER = /conformance-mode:\s*quoting-permitted/i;

function lintFile(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  quotingPermitted = QUOTING_MARKER.test(lines.slice(0, 25).join('\n'));

  lines.forEach((line, i) => {
    const n = i + 1;
    const lower = line.toLowerCase();

    // 1. Unknown or mis-named output and visual identifiers.
    for (const m of line.matchAll(/\bOUT-(\d{2})\b/g)) {
      const id = m[0];
      if (!idx.outputs[id]) { add(file, n, 'unknown_output_id', `${id} is not in the registry catalogue.`); continue; }
      checkNamedId(file, n, line, id, idx.outputs[id], 'output');
    }
    for (const m of line.matchAll(/\bVIS-(\d{2})\b/g)) {
      const id = m[0];
      if (!idx.visuals[id]) { add(file, n, 'unknown_visual_id', `${id} is not in the registry catalogue.`); continue; }
      checkNamedId(file, n, line, id, idx.visuals[id], 'visual');
    }

    // 2. Health dimension identifiers claimed against the wrong name.
    for (const m of line.matchAll(/\bDimension (D(?:10|[1-9]))\b/g)) {
      const d = idx.dimensions[m[1]];
      if (!d) { add(file, n, 'unknown_dimension', `${m[1]} is not a registry dimension.`); continue; }
      const canonTokens = new Set(NORM(d.name).split(' ').filter((w) => w.length > 3));
      const head = NORM(line.slice(0, line.indexOf(m[0]))).split(' ').filter((w) => w.length > 3);
      if (head.length && !head.some((w) => canonTokens.has(w))) {
        add(file, n, 'dimension_name_mismatch',
          `${m[1]} is used here for something other than "${d.name}" (weight ${d.weight}).`);
      }
    }

    // 2b. Insight channel identifiers claimed against the wrong question.
    for (const m of line.matchAll(/\(Channel (INS-[A-H])\)/g)) {
      const ch = idx.channels?.[m[1]];
      if (!ch) { add(file, n, 'unknown_channel', `${m[1]} is not a registry channel.`); continue; }
      const canonTokens = new Set(NORM(ch.detector + ' ' + ch.question).split(' ').filter((w) => w.length > 4));
      const head = NORM(line.slice(0, line.indexOf(m[0]))).split(' ').filter((w) => w.length > 4);
      if (head.length && !head.some((w) => canonTokens.has(w))) {
        add(file, n, 'channel_mismatch',
          `${m[1]} is used here for something other than "${ch.question}" (${ch.detector}, ${ch.tier}, rendered as a ${ch.render}).`);
      }
    }

    /**
     * A document that carries the prohibitions has to be able to name what it
     * prohibits. NEGATED matches a line that forbids, denies or tests-against the
     * term rather than asserting it. Identifier rules never consult it.
     */
    const NEGATED = /\bno\b|\bnot\b|never|zero |without|prohibit|forbidden|closed|refus|reject|cannot|does not|denies|deleted|is no /i;
    const negated = NEGATED.test(lower);

    // 3. The Enterprise tier, which does not exist.
    if ((/\benterprise (tier|subscription|only|tiers)\b/i.test(line) || /tier requires enterprise/i.test(line)) && !negated) {
      add(file, n, 'enterprise_tier', idx.prohibited_terms.enterprise_tier);
    }

    // 4. Benchmark and savings language.
    if (/\bindustry average\b|\bbenchmark(ing|ed)?\b/i.test(line) && !negated) {
      add(file, n, 'benchmark_language', idx.prohibited_terms.benchmark);
    }

    // 5. Bare Pro. Not negation-exempt: "no bare Pro" still has to spell it correctly,
    // so the rule allows it only inside an explicit quoting construction.
    const bare = line.match(/\bPro\b(?!\s+(?:subscription|Edition))/);
    if (bare && !/bare "Pro"|bare `Pro`|bare 'Pro'/.test(line)) {
      add(file, n, 'bare_pro', idx.prohibited_terms.bare_pro);
    }

    // 6. Per individual measurement.
    if (/\b(speaker_name|talk_time|interruptions_(initiated|received)|monopoly_ratio|who spoke the most|per[- ]person score|individual score)\b/i.test(line)
        && !negated) {
      add(file, n, 'individual_measurement', idx.prohibited_terms['individual scoring']);
    }

    // 7. Minutes.
    if (/\b(board )?minutes\b/i.test(line) && !negated && !/working record/i.test(lower)) {
      add(file, n, 'board_minutes', idx.prohibited_terms.minutes);
    }

    // 7b. Waste and savings claims. The band identifier is the only permitted use.
    // "saving" as a verb ("policy saving state") is not a claim; "savings",
    // "cost saving" and "money/hours saved" are.
    if (/\b(waste|wasted|wastage|savings|(?:cost|time|money|efficiency) saving|(?:money|hours|time|cost) saved|cost avoided)\b/i.test(line)
        && !/waste of time|did not justify the time/i.test(lower) && !negated) {
      add(file, n, 'waste_claim',
        'Concludo has a duration and a user-supplied rate. It has not established what the time was worth, what would have happened otherwise, or that any of it was wasted. Cost figures are illustrative, never a measured loss or a projected saving.');
    }

    // 8. Em dash and en dash as a break.
    if (/—/.test(line)) add(file, n, 'em_dash', 'Em dash in the document.');

    // 9. Health bands that are not the registry bands.
    if (/\b(exemplary|dysfunctional|ineffective)\b/i.test(line)) {
      add(file, n, 'band_mismatch',
        `Health bands are ${idx.bands.map((b) => b.internal).join(', ')}, displayed as ${idx.bands.map((b) => b.display).join(', ')}. No other band set exists.`);
    }

    // 10. A score column that cannot be null cannot express "not scored".
    if (/composite_score\s+INTEGER\s+NOT NULL/i.test(line)) {
      add(file, n, 'score_not_nullable',
        'A NOT NULL score column cannot store "not scored". Below a 70 point scoreable weight there is no total, and forcing a number there is the failure the floor exists to prevent.');
    }
  });
}

const defaultFiles = [
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/handover/01_Implementation_Roadmap_v2_0.md',
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/handover/02_Brief_Access_Grants_Phase12.md',
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/handover/03_Brief_Legal_Defences_Phase14.md',
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/concludo-security-phase15/02_Brief_Security_Phase15.md',
].filter((f) => {
  try { return readFileSync(f, 'utf8').length > 0; } catch { return false; }
});

const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles;
if (!files.length) {
  console.log('Usage: node tools/roadmap-conformance.mjs <file.md> [...]');
  process.exit(0);
}
for (const f of files) lintFile(f);

const byCode = {};
for (const f of findings) (byCode[f.code] ??= []).push(f);

console.log(`\nConcludo roadmap conformance: ${findings.length} findings across ${files.length} file(s).\n`);
if (quoted.length) {
  console.log(`${quoted.length} prose references were quoted rather than asserted, under conformance-mode: quoting-permitted.`);
  console.log('Identifier rules were still enforced in full. Read the quoted list once by hand.\n');
}
for (const [code, list] of Object.entries(byCode).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${code}  (${list.length})`);
  for (const f of list.slice(0, 6)) console.log(`   line ${String(f.line).padStart(4)}  ${f.detail}`);
  if (list.length > 6) console.log(`   ... and ${list.length - 6} more`);
  console.log('');
}
process.exit(findings.length ? 1 : 0);
