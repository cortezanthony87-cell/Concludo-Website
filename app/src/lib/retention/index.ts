/**
 * Data Retention & Recently Deleted Utilities
 * Concludo Workspace - Tasklet 11C, 11D, 11E
 */

export * from './types';
export * from './purgeWorker';

/**
 * Calculates remaining days before a soft-deleted record is permanently purged.
 * Retention formula: purge_after - current date
 * Default window is 30 days.
 */
export function calculateDaysRemaining(
  purgeAfter: string | null | undefined,
  deletedAt?: string | null | undefined
): number {
  if (purgeAfter) {
    const purgeMs = new Date(purgeAfter).getTime();
    const diffMs = purgeMs - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  if (deletedAt) {
    const deletedMs = new Date(deletedAt).getTime();
    const purgeMs = deletedMs + 30 * 24 * 60 * 60 * 1000;
    const diffMs = purgeMs - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  return 30;
}

/**
 * Formats days remaining into user-friendly copy.
 * Examples: "29 days remaining", "14 days remaining", "3 days remaining", "1 day remaining".
 */
export function formatDaysRemaining(days: number): string {
  if (days === 1) {
    return '1 day remaining';
  }
  return `${days} days remaining`;
}

/**
 * Formats Australian standard date for deleted records.
 */
export function formatDeletedDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateString;
  }
}
