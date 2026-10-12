/**
 * The demonstration clock.
 *
 * Every aggregation function takes `now` as an argument rather than calling
 * `new Date()` internally. Two reasons: a test that depends on the wall clock
 * fails at midnight for reasons nobody can reproduce, and a demonstration
 * dataset that drifts out of date looks broken a week after it was written.
 *
 * Monday 12 October 2026, 8:30am Melbourne. A morning inbox, at the hour a
 * person actually sits down to it.
 */
export const DEMO_NOW = '2026-10-12T08:30:00+11:00';

/** Melbourne is UTC+11 in October. Written out so the offsets below are legible. */
export const DEMO_TIME_ZONE = 'Australia/Melbourne';

/** Helper for the dataset: an offset in hours from the demonstration clock. */
export function hoursBefore(hours: number, from: string = DEMO_NOW): string {
  const t = new Date(from).getTime() - hours * 3600_000;
  return toMelbourneIso(new Date(t));
}

export function daysBefore(days: number, from: string = DEMO_NOW): string {
  return hoursBefore(days * 24, from);
}

export function daysAfter(days: number, from: string = DEMO_NOW): string {
  return hoursBefore(-days * 24, from);
}

/** Formats as +11:00 so the dataset reads consistently. */
function toMelbourneIso(d: Date): string {
  const shifted = new Date(d.getTime() + 11 * 3600_000);
  return `${shifted.toISOString().slice(0, 19)}+11:00`;
}

/** Start of the demonstration day, Melbourne time. */
export const DEMO_DAY_START = '2026-10-12T00:00:00+11:00';
export const DEMO_DAY_END = '2026-10-12T23:59:59+11:00';
