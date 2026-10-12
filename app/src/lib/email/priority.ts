/**
 * Priority scoring.
 *
 * Scores are CALCULATED from the eleven weighted factors, never hand-written onto
 * a thread. That matters for two reasons. A hand-written score cannot be
 * explained to the person it is shown to, and a hand-written score cannot be
 * wrong in a way a test can catch.
 *
 * The weights live in model.ts and are the same ten weights recorded in the
 * Inbox Command Centre operating specification, so the product and the agent
 * cannot drift apart.
 */
import {
  PRIORITY_WEIGHTS,
  PriorityBand,
  PriorityFactor,
  PriorityFactorKey,
  Priority,
  Confidence,
} from './model';

/** The band boundaries, from the operating specification. */
const BANDS: readonly { band: PriorityBand; min: number }[] = [
  { band: 'immediate', min: 90 },
  { band: 'today', min: 75 },
  { band: 'soon', min: 50 },
  { band: 'batch', min: 25 },
  { band: 'low', min: 0 },
];

export function bandForScore(score: number): PriorityBand {
  const found = BANDS.find((b) => score >= b.min);
  return found ? found.band : 'low';
}

/** Every factor key, in the order they are weighted. */
export const PRIORITY_FACTOR_KEYS = Object.keys(PRIORITY_WEIGHTS) as PriorityFactorKey[];

/**
 * Weighted sum of the eleven factors, each 0 to 10, scaled to 0 to 100.
 *
 * A missing factor counts as zero rather than being skipped. Skipping would
 * quietly raise the score of a thread we know less about, which is exactly
 * backwards.
 */
export function scoreFromFactors(factors: readonly PriorityFactor[]): number {
  let total = 0;
  for (const key of PRIORITY_FACTOR_KEYS) {
    const factor = factors.find((f) => f.key === key);
    const value = factor ? clamp(factor.value, 0, 10) : 0;
    total += value * PRIORITY_WEIGHTS[key];
  }
  return Math.round(total * 10);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Builds the priority object for a thread.
 *
 * `reasons` is taken from the highest-scoring factors, so what the person reads
 * is genuinely what drove the number rather than a separate hand-written
 * sentence that can quietly disagree with it.
 */
/**
 * The two factors that are COMPUTED rather than authored.
 *
 * Age and confidence are facts about the thread and the analysis, not
 * judgements about the conversation, so hand-writing them would be inventing a
 * number that already exists. Computing them also means they cannot be
 * forgotten on a new thread.
 */
export interface DerivedFactorInput {
  /** Whole days since the first message. */
  ageDays?: number;
  /** Whether the thread is finished. A closed thread does not age into urgency. */
  resolved?: boolean;
}

/** 0 at a day old, rising to 10 at a fortnight, flat after that. */
export function ageFactorValue(ageDays: number, resolved: boolean): number {
  if (resolved) return 0;
  if (ageDays <= 1) return 0;
  return Math.min(10, Math.round(((ageDays - 1) / 13) * 10));
}

/**
 * Confidence pushes a thread DOWN, never up.
 *
 * A thread the module understands well scores its full 10 here; one it barely
 * understands scores 0 and therefore ranks lower than an otherwise identical
 * thread it is sure about. That is the right direction: an uncertain reading
 * should be less willing to demand a person's attention, not equally willing.
 */
export function confidenceFactorValue(confidence: Confidence): number {
  return confidence === 'high' ? 10 : confidence === 'medium' ? 5 : 0;
}

export function buildPriority(
  factors: readonly PriorityFactor[],
  confidence: Confidence = 'medium',
  escalation: EscalationInput = {},
  derived: DerivedFactorInput = {}
): Priority {
  const ageDays = derived.ageDays ?? 0;
  const resolved = derived.resolved ?? false;
  const ageValue = ageFactorValue(ageDays, resolved);
  const confidenceValue = confidenceFactorValue(confidence);

  const withDerived: PriorityFactor[] = [
    ...factors.filter((f) => f.key !== 'unresolved_age' && f.key !== 'confidence_adjustment'),
    {
      key: 'unresolved_age',
      value: ageValue,
      reason:
        ageValue === 0
          ? ''
          : `Open for ${ageDays} day${ageDays === 1 ? '' : 's'} without being settled.`,
    },
    {
      key: 'confidence_adjustment',
      value: confidenceValue,
      reason:
        confidence === 'high'
          ? ''
          : `Ranked lower because the module is only ${confidence === 'medium' ? 'moderately' : 'slightly'} confident in this reading.`,
    },
  ];

  const score = scoreFromFactors(withDerived);
  const escalations = escalationsFor(escalation);

  let band = bandForScore(score);
  for (const e of escalations) band = maxBand(band, e.band);

  // A factor with a value but no written reason still counts towards the score
  // and is deliberately not shown. A blank line under a thread tells the person
  // nothing and makes the module look broken.
  const factorReasons = withDerived
    .filter((f) => f.value > 0 && f.reason.trim().length > 0)
    .slice()
    .sort((a, b) => b.value * PRIORITY_WEIGHTS[b.key] - a.value * PRIORITY_WEIGHTS[a.key])
    .slice(0, escalations.length > 0 ? 2 : 3)
    .map((f) => f.reason);

  return {
    score,
    band,
    factors: withDerived,
    // The escalation reason leads, because it is the one the person most needs
    // in order to judge whether the module got this thread right.
    reasons: [...escalations.map((e) => e.reason), ...factorReasons],
    confidence,
  };
}

/** Shorthand for building a factor list without repeating the key three times. */
export function factors(
  entries: readonly [PriorityFactorKey, number, string][]
): PriorityFactor[] {
  return entries.map(([key, value, reason]) => ({ key, value, reason }));
}

/* ------------------------------------------------------------ escalation */

/**
 * Why the band is not simply a lookup on the score.
 *
 * Building the dataset exposed a calibration problem in the weighted model.
 * With ten weights summing to 1.00 and each factor capped at 10, a score of 90
 * requires almost every factor at 9 or above at once. Real threads do not do
 * that. A payment-redirection attempt, which is the single most expensive thing
 * in an inbox, scores about 69 because it has no deadline, no relationship
 * weight and no promise behind it. Left alone, the 'immediate' band would be
 * permanently empty and the one thread that should stop the person would sit
 * third in a list.
 *
 * The fix is not to inflate the score. An inflated score cannot be explained.
 * The score stays honest and a small, named set of rules may RAISE the band,
 * carrying its own reason line so the person can see which rule fired and
 * disagree with it.
 *
 * A rule may only raise a band. Nothing here can quieten a thread.
 */
const BAND_ORDER: readonly PriorityBand[] = ['low', 'batch', 'soon', 'today', 'immediate'];

export function bandRank(band: PriorityBand): number {
  return BAND_ORDER.indexOf(band);
}

/** Returns the higher of two bands. */
export function maxBand(a: PriorityBand, b: PriorityBand): PriorityBand {
  return bandRank(a) >= bandRank(b) ? a : b;
}

export interface EscalationInput {
  /** True when a high-severity security alert is attached to the thread. */
  highSeveritySecurityAlert?: boolean;
  /** A stated deadline owned by the person, falling today or already passed. */
  statedDeadlineDueOrOverdue?: boolean;
  /** The thread matches a topic the person set to always escalate. */
  matchesAlwaysEscalate?: boolean;
}

export interface Escalation {
  band: PriorityBand;
  reason: string;
}

/** The rules, in the order they are reported. */
export function escalationsFor(input: EscalationInput): Escalation[] {
  const out: Escalation[] = [];
  if (input.highSeveritySecurityAlert) {
    out.push({
      band: 'immediate',
      reason: 'Escalated: flagged as a possible payment or credential attack.',
    });
  }
  if (input.statedDeadlineDueOrOverdue) {
    out.push({
      band: 'today',
      reason: 'Escalated: a date stated in the thread falls today or has passed.',
    });
  }
  if (input.matchesAlwaysEscalate) {
    out.push({
      band: 'today',
      reason: 'Escalated: matches a topic you asked to always surface.',
    });
  }
  return out;
}

/**
 * The module's sort order for every work queue.
 *
 * Score first, then the soonest stated deadline, then the oldest thread. Ties
 * broken by thread id so the order is stable across renders; an inbox that
 * reshuffles itself on refresh is an inbox nobody trusts.
 */
export function compareByPriority(
  a: {
    priorityScore: number;
    priorityBand: PriorityBand;
    nextDeadline: string | null;
    lastMessageAt: string;
    threadId: string;
  },
  b: {
    priorityScore: number;
    priorityBand: PriorityBand;
    nextDeadline: string | null;
    lastMessageAt: string;
    threadId: string;
  }
): number {
  // BAND BEFORE SCORE. This was wrong on the first pass and the tests caught it.
  // The escalation rules exist to raise a thread's band above what its raw score
  // would give, so ordering by score first put the suspected payment attack
  // third in a list it had just been escalated to the top of. The band is the
  // module's statement of urgency; the score only breaks ties inside it.
  if (a.priorityBand !== b.priorityBand) return bandRank(b.priorityBand) - bandRank(a.priorityBand);
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;

  if (a.nextDeadline && b.nextDeadline && a.nextDeadline !== b.nextDeadline) {
    return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime();
  }
  if (a.nextDeadline && !b.nextDeadline) return -1;
  if (!a.nextDeadline && b.nextDeadline) return 1;

  if (a.lastMessageAt !== b.lastMessageAt) {
    return new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
  }
  return a.threadId < b.threadId ? -1 : 1;
}
