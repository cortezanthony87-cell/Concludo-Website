/**
 * Brand and language suite. Specification 0.4 rule 7 and 10.9.
 * These are string level tests on generated output, not style notes.
 * Every check here fails the build, it does not warn.
 */
import { registry } from './registry.mjs';

const EM_DASH = /—/;
const EN_DASH_AS_BREAK = /\s–\s/;

/** Australian spellings Concludo uses, with the US form that must not appear. */
const US_SPELLINGS = [
  [/\borganiz(e|ed|es|ing|ation|ational)\b/gi, 'organis-'],
  [/\bprioritiz(e|ed|es|ing|ation)\b/gi, 'prioritis-'],
  [/\brecogniz(e|ed|es|ing)\b/gi, 'recognis-'],
  [/\bsummariz(e|ed|es|ing)\b/gi, 'summaris-'],
  [/\bminimiz(e|ed|es|ing)\b/gi, 'minimis-'],
  [/\bcolor(s|ed|ing)?\b/gi, 'colour'],
  [/\bbehavior(s|al)?\b/gi, 'behaviour'],
  [/\bprogram me\b/gi, 'programme'],
  [/\bcenter(s|ed|ing)?\b/gi, 'centre'],
  [/\banalyz(e|ed|es|ing)\b/gi, 'analys-'],
  [/\blicense\b(?!\s+(?:to|the))/gi, 'licence, as a noun'],
  [/\bdefense\b/gi, 'defence'],
  [/\bfulfill(ed|ing|s)?\b/gi, 'fulfil'],
];

/** Consulting firm attribution is prohibited outright. Specification 6.6. */
const FIRM_NAMES = [
  'mckinsey', 'bain', 'boston consulting', 'bcg', 'deloitte', 'pwc',
  'pricewaterhouse', 'kpmg', 'ernst & young', 'ernst and young', 'accenture',
];

/** Savings and benchmark claims are permanently closed. Specification 0.4 rule 2. */
const BENCHMARK_PATTERNS = [
  /\bindustry (?:average|benchmark|standard figure)\b/i,
  /\bbenchmark(?:ed|ing)? against\b/i,
  /\bcompared (?:to|with) (?:other|similar) (?:organisations|companies|teams|firms)\b/i,
  /\breturn on investment\b/i,
  /\bpayback period\b/i,
  /\bwill save you\b/i,
  /\bsaves? (?:you )?(?:up to )?\$?\d/i,
  /\b\d+\s*%\s*(?:time )?saving/i,
  /\bpass mark\b/i,
  /\bpercentile\b/i,
];

/** Correction 3. Bare Pro is forbidden everywhere. */
const BARE_PRO = /\bPro\b(?!\s+(?:subscription|Edition))/;

/**
 * @param {string} text
 * @param {{ namesPlatformOrDevice?: boolean }} [opts]
 * @returns {{ ok: boolean, failures: {check: string, detail: string}[] }}
 */
export function checkGeneratedText(text, opts = {}) {
  const failures = [];
  const add = (check, detail) => failures.push({ check, detail });

  if (EM_DASH.test(text)) add('em_dash', 'Generated text contains an em dash.');
  if (EN_DASH_AS_BREAK.test(text)) add('en_dash_break', 'Generated text uses an en dash as a sentence break.');

  for (const [re, correct] of US_SPELLINGS) {
    const m = text.match(re);
    if (m) add('spelling_en_AU', `Found "${m[0]}". Australian English uses ${correct}.`);
  }

  for (const firm of FIRM_NAMES) {
    if (text.toLowerCase().includes(firm)) {
      add('consulting_firm_named', `Output names "${firm}". Concludo never names a firm or claims its methodology.`);
    }
  }

  // The canonical disclaimer denies a benchmark. It is not an assertion of one,
  // and it is required to render on every scored artefact, so it is removed
  // before the assertion patterns run.
  const scanned = text.split(registry.health.not_a_benchmark_statement).join(' ');

  for (const re of BENCHMARK_PATTERNS) {
    const m = scanned.match(re);
    if (m) add('benchmark_or_savings_claim', `Found "${m[0]}". ${registry.constraints.no_benchmark_assertions ? 'Benchmark and savings claims are prohibited in any output, chart, caption or interface string.' : ''}`);
  }

  const proMatch = text.match(BARE_PRO);
  if (proMatch) {
    add('bare_pro', 'Found bare "Pro". Write "Pro subscription" (the AU$29 per month Workspace tier) or "Pro Edition" (the Workbook organisation licence). The two carry close to opposite permissions.');
  }

  if (opts.namesPlatformOrDevice && !text.includes('is not affiliated with')) {
    add('independence_line_missing', 'A recorder, device brand or meeting platform is named and the independence line does not render with it.');
  }

  return { ok: failures.length === 0, failures };
}

/** Enum and identifier level check, for database values and feature flags. */
export function checkIdentifier(value) {
  const failures = [];
  if (value === 'pro' || value === 'Pro') {
    failures.push({ check: 'bare_pro_enum', detail: `Enum value "${value}" is ambiguous. Use "pro_subscription" or "workbook_pro_edition".` });
  }
  if (value === 'enterprise' && !registry.commercial.subscription_tiers.includes('enterprise')) {
    failures.push({ check: 'unpriced_tier', detail: 'There is no Enterprise subscription tier. Governance features are capability flags, not tier entitlements.' });
  }
  return { ok: failures.length === 0, failures };
}
