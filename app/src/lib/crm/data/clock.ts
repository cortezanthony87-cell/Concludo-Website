/**
 * One fixed moment for the whole synthetic workspace.
 *
 * Every "due in three days" and "no contact for six weeks" in the demonstration
 * data is computed against this, not against the wall clock, so the module
 * looks the same today as it will next March and a screenshot taken for a
 * review does not quietly go stale. It also means a test can assert an exact
 * reason string instead of a range.
 *
 * Dates render in the workspace time zone, pinned, because formatting an
 * Australian date without a time zone renders a Melbourne deadline a day early
 * for anyone west of it.
 */
export const CRM_DEMO_NOW = '2026-10-12T09:00:00+11:00';

export const CRM_TIME_ZONE = 'Australia/Melbourne';

/** Milliseconds of an ISO timestamp, compared as an instant rather than a string. */
export function ms(iso: string): number {
  return new Date(iso).getTime();
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Days since an ISO timestamp, relative to the fixed moment. */
export function daysSince(iso: string, now: string = CRM_DEMO_NOW): number {
  return daysBetween(iso, now);
}

/** Days until an ISO date, relative to the fixed moment. Negative when past. */
export function daysUntil(iso: string, now: string = CRM_DEMO_NOW): number {
  return daysBetween(now, iso);
}
