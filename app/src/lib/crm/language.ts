/**
 * The words the CRM is allowed to use, and the words it is not.
 *
 * This file exists because the product rule is not a preference. Concludo
 * measures work, records and relationships, never employee performance, and a
 * CRM is the single most likely place in the product for that line to be
 * crossed by accident. A sentence like "you are behind" or "87% complete,
 * below team average" arrives naturally in a dashboard and is very hard to
 * remove once a customer has seen it.
 *
 * So the rules live in code and a test scans every string the module can show.
 * A rule that is only written in a document is a rule that will be broken by
 * the next person who writes a panel heading in a hurry.
 */

/** The phrases the brief settled on. They are the module's vocabulary. */
export const APPROVED_PHRASES = [
  'Recommended today',
  'Awaiting confirmation',
  'No next step recorded',
  'Commitment approaching',
  'Relationship may need attention',
  'Proposed CRM update',
  'Source needs review',

  /* Added in Stage 4, deliberately rather than by writing a label inline.
   *
   * The list exists so that the words an interface uses to tell somebody their
   * work needs attention are decided once, in the open, rather than invented at
   * the point of use by whoever is writing a component that afternoon. Four
   * more were needed for the relationship views, and the alternative, raw
   * strings in the markup, is how a vocabulary stops being reviewable.
   *
   * "Waiting on us" and "Waiting on them" are the distinction the Stage 2 list
   * could not make: a commitment is either ours to honour or theirs, and
   * showing both as one phrase loses the only thing a person needs from the
   * row. */
  'Waiting on us',
  'Waiting on them',
  'No recorded activity',
  'Needs review',
] as const;

export type ApprovedPhrase = (typeof APPROVED_PHRASES)[number];

export interface LanguageRule {
  /** What is not allowed. */
  pattern: RegExp;
  /** Why, in one sentence, so the rule can be argued with rather than obeyed. */
  reason: string;
  /** What to write instead. */
  instead: string;
}

/**
 * The banned patterns.
 *
 * Three families, and each one exists because of a real failure mode:
 *
 * - **Ranking and scoring people.** Forbidden by the product rules, and the
 *   fastest way for a CRM to become a surveillance tool.
 * - **Anxiety.** "Urgent", "falling behind", "you have failed to" turn a
 *   working list into a source of dread, and a person who dreads a page stops
 *   opening it. The module says what is true and lets the reader decide how to
 *   feel about it.
 * - **False certainty.** "Guaranteed", "will close", "definitely" from a module
 *   that is inferring from a transcript is a claim it cannot support.
 */
export const BANNED_LANGUAGE: LanguageRule[] = [
  {
    pattern: /\bleaderboard\b/i,
    reason: 'Ranks people against each other, which the product rules forbid.',
    instead: 'Show the work, not a ranking.',
  },
  {
    pattern: /\bproductivity score\b|\bperformance score\b|\befficiency score\b/i,
    reason: 'Scores a person rather than measuring the work.',
    instead: 'Count what is open and what is due.',
  },
  {
    pattern: /\btop performer\b|\bbottom performer\b|\bunderperform\w*/i,
    reason: 'Evaluates an employee, which this module must never do.',
    instead: 'Name the record that needs attention and why.',
  },
  {
    pattern: /\bcompared to (?:the |your )?team\b|\bteam average\b|\bvs\.? peers\b/i,
    reason: 'Comparison between colleagues is employee evaluation by another name.',
    instead: 'Compare a record to its own history, not a person to a person.',
  },
  {
    pattern: /\bfalling behind\b|\byou are behind\b|\bbehind schedule\b/i,
    reason: 'Anxiety-producing, and usually inferred rather than known.',
    instead: 'No next step recorded, or Commitment approaching.',
  },
  {
    pattern: /\burgent\b|\bcritical\b|\bimmediately\b|\bact now\b/i,
    reason: 'Pressure language. Everything cannot be urgent, so nothing reads as urgent.',
    instead: 'Recommended today, with the reason.',
  },
  {
    pattern: /\bfailed to\b|\byou (?:have )?missed\b|\bneglected\b/i,
    reason: 'Blames the reader for a record state the module merely observed.',
    instead: 'State what is not recorded, without attributing fault.',
  },
  {
    pattern: /\bat risk of losing\b|\babout to lose\b|\blosing (?:this |the )?(?:client|customer)\b/i,
    reason: 'An alarming prediction the module cannot support from activity dates alone.',
    instead: 'Relationship may need attention, with the last contact date.',
  },
  {
    pattern: /\bguaranteed\b|\bwill (?:definitely |certainly )?close\b|\bcertain to\b/i,
    reason: 'False certainty from an inference.',
    instead: 'Say what is recorded and label the inference as inferred.',
  },
  {
    pattern: /\bstreak\b|\bbadge earned\b|\bpoints awarded\b/i,
    reason: 'Gamifies a working tool and measures the person, not the work.',
    instead: 'Nothing. Remove it.',
  },
  {
    pattern: /\blazy\b|\bslacking\b|\bdropped the ball\b/i,
    reason: 'A judgement about a person, in a tool that holds customer records.',
    instead: 'Describe the record state.',
  },
  {
    pattern: /\bhot lead\b|\bcold lead\b|\bdead lead\b/i,
    reason: 'Temperature language is an unevidenced score on a human being.',
    instead: 'Awaiting review, or say what is missing before a decision.',
  },
];

/**
 * Scans a string for banned language.
 *
 * Returns every rule it breaks, not just the first, so a review fixes the whole
 * sentence in one pass.
 */
export function checkLanguage(text: string): LanguageRule[] {
  return BANNED_LANGUAGE.filter((rule) => rule.pattern.test(text));
}

/** True when the text breaks no rule. */
export function languageIsClean(text: string): boolean {
  return checkLanguage(text).length === 0;
}

/**
 * The reason line every Today item must carry.
 *
 * The brief's requirement is that each item explains why it appears. That is
 * not decoration: an item on a working list with no reason is an instruction,
 * and a person who cannot see why cannot disagree. This type makes the reason
 * structurally required rather than optional, so a panel row cannot be written
 * without one.
 */
export interface WithReason {
  /** One of the approved phrases, as the item's standing. */
  standing: ApprovedPhrase;
  /** The specific reason, in plain words, naming the evidence where there is any. */
  reason: string;
}
