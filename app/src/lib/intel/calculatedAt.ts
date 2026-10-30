/** Cached Insight and Stats must say when they were last calculated. No staleness threshold is invented: the date is always shown. */
export function describeCalculatedAt(updatedAt?: string | null): string {
  if (!updatedAt) return 'Last calculated: not recorded.';
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return 'Last calculated: not recorded.';
  const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return `Last calculated ${day}.`;
}
