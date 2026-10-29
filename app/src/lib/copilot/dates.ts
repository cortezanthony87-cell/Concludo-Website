/**
 * Calendar-date helpers for Copilot. All dates are plain YYYY-MM-DD strings in the
 * Australia/Melbourne calendar, so period boundaries are inclusive and never shift with
 * the viewer's browser timezone. Meeting and action dates in Concludo are date-only.
 */

export const COPILOT_TZ = 'Australia/Melbourne';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Today's calendar date in Melbourne, from any instant. */
export function melbourneToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COPILOT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function parseISODate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function utcMs(s: string): number {
  const { y, m, d } = parseISODate(s);
  return Date.UTC(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const dt = new Date(utcMs(s) + days * 86400000);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function daysBetween(a: string, b: string): number {
  return Math.round((utcMs(b) - utcMs(a)) / 86400000);
}

export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function startOfWeekMonday(s: string): string {
  const dt = new Date(utcMs(s));
  const dow = (dt.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(s, -dow);
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function monthIndex(word: string): number {
  const w = word.toLowerCase().replace(/\./g, '');
  let i = MONTHS.indexOf(w);
  if (i >= 0) return i + 1;
  i = MONTH_SHORT.indexOf(w.slice(0, 3));
  if (i >= 0 && (w.length === 3 || w === 'sept')) return i + 1;
  return 0;
}

/** 26 October 2026, with no ordinals and no comma (Australian style). */
export function formatAuDate(s?: string | null): string {
  if (!s) return 'no date';
  const { y, m, d } = parseISODate(s);
  if (!y || !m || !d) return 'no date';
  return `${d} ${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
}

export function inRange(date: string | null | undefined, from: string, to: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}
