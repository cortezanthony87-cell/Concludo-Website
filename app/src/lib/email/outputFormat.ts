/**
 * Date formatting, in one place.
 *
 * These were in `components/email/viewPrimitives.tsx`, which was fine while
 * only components needed them. The output builders need them too, and a module
 * in `lib/` importing a `.tsx` component file to get a date formatter is the
 * kind of dependency that is invisible until somebody tries to test the library
 * without a DOM. They live here now and the components import them.
 *
 * The rule they exist to enforce: **dates are formatted in the account's time
 * zone, never the browser's.** A deadline belongs to the person's working day,
 * not to the machine the page happens to be open on. Leaving `timeZone` out of
 * a `toLocaleDateString` call renders every deadline a day early for anybody
 * west of Melbourne, which happened once, in Stage 3, and has a regression test.
 */

/**
 * The account time zone.
 *
 * Pinned, pending `MailboxSettings.Read` being consumed. Correct for Australian
 * customers today and wrong for anybody else, which is recorded in
 * `docs/KNOWN_LIMITATIONS.md` rather than left to be discovered.
 */
export const ACCOUNT_TIME_ZONE = 'Australia/Melbourne';

export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    timeZone: ACCOUNT_TIME_ZONE,
  });
}

export function formatDayTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ACCOUNT_TIME_ZONE,
  });
}

/** Day, month and year. For a document cover, where the year matters. */
export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ACCOUNT_TIME_ZONE,
  });
}
