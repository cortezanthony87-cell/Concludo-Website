/**
 * Evidence thresholds for every Intelligence page. Approved by Anthony on 30 October 2026.
 * One place, one rule: a figure is shown only when the records behind it are enough.
 * Below the threshold the page says "Not enough evidence yet" and shows the counts instead.
 */
export const MIN_RATE_DENOMINATOR = 5; // percentages and ratios
export const MIN_TREND_SNAPSHOTS = 3; // real snapshots, never back-filled
export const MIN_FORECAST_WEEKS = 8; // weeks of real history

export type Shown<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export interface RateResult {
  numerator: number;
  denominator: number;
  percent: number;
}

/** A rate with its numerator and denominator, or an honest abstention. */
export function rate(numerator: number, denominator: number): Shown<RateResult> {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator < 0 || denominator < 0 || numerator > denominator) {
    return { ok: false, reason: 'The counts behind this figure are not consistent.' };
  }
  if (denominator < MIN_RATE_DENOMINATOR) {
    return {
      ok: false,
      reason: `Not enough evidence yet: ${denominator} ${denominator === 1 ? 'record' : 'records'}, and at least ${MIN_RATE_DENOMINATOR} are needed to show a percentage.`,
    };
  }
  return { ok: true, value: { numerator, denominator, percent: Math.round((numerator / denominator) * 100) } };
}

export function trendAllowed(realSnapshots: number): Shown<true> {
  return realSnapshots >= MIN_TREND_SNAPSHOTS
    ? { ok: true, value: true }
    : { ok: false, reason: `Not enough evidence yet: ${realSnapshots} saved ${realSnapshots === 1 ? 'snapshot' : 'snapshots'}, and at least ${MIN_TREND_SNAPSHOTS} are needed to show a trend.` };
}

/** Whole weeks between the earliest and latest real record dates (YYYY-MM-DD). */
export function weeksOfHistory(dates: string[]): number {
  const t = dates.filter(Boolean).map((d) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`)).filter((n) => !Number.isNaN(n));
  if (t.length < 2) return 0;
  return Math.floor((Math.max(...t) - Math.min(...t)) / (7 * 86400000));
}

export function forecastAllowed(dates: string[]): Shown<number> {
  const weeks = weeksOfHistory(dates);
  return weeks >= MIN_FORECAST_WEEKS
    ? { ok: true, value: weeks }
    : { ok: false, reason: `Not enough evidence yet: ${weeks} ${weeks === 1 ? 'week' : 'weeks'} of history, and at least ${MIN_FORECAST_WEEKS} are needed for a trend projection.` };
}

/** Label every projection the same way, and never "forecast" or "prediction". */
export const PROJECTION_LABEL = 'Trend projection';
