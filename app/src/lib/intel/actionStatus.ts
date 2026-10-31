/**
 * Overdue is computed from the due date, never stored in status.
 * Mirrors public.is_action_overdue (migration 0200): not completed, has a due date,
 * and the due date is before today in Melbourne.
 * A stored status of 'overdue' (written by the old trigger) is treated as 'open' here,
 * so screens give the same answer before and after 0200 is released.
 */
export interface ActionLike { status?: string | null; due_date?: string | null }

export function melbourneToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isActionOverdue(a: ActionLike, now: Date = new Date()): boolean {
  if (a.status === 'completed') return false;
  if (!a.due_date) return false;
  return a.due_date.slice(0, 10) < melbourneToday(now);
}

/** The stored status with the legacy 'overdue' value folded back to 'not_started'. Blocked and in-progress are kept. */
export function effectiveStatus(a: ActionLike): string {
  const s = a.status || 'not_started';
  return s === 'overdue' ? 'not_started' : s;
}
