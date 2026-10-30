/**
 * One set of definitions for every Intelligence page (fixes D8).
 * Counts are exact. Rates carry numerator and denominator and abstain below the evidence threshold.
 * Measures work, never people: nothing here is keyed to an individual.
 */
import { rate } from './evidence';
import { isActionOverdue, effectiveStatus } from './actionStatus';

export interface ActionRow { status?: string | null; due_date?: string | null; deleted_at?: string | null }
export interface DecisionRow { status?: string | null; deleted_at?: string | null }

export const RESOLVED_DECISION = ['approved', 'implemented', 'completed', 'rejected', 'superseded'] as const;

export function actionCounts(rows: ActionRow[], now: Date = new Date()) {
  const live = rows.filter((r) => !r.deleted_at);
  const open = live.filter((r) => effectiveStatus(r) !== 'completed');
  return {
    total: live.length,
    open: open.length,
    overdue: open.filter((r) => isActionOverdue(r, now)).length,
    blocked: open.filter((r) => effectiveStatus(r) === 'blocked').length,
    completed: live.length - open.length,
  };
}

export function decisionCounts(rows: DecisionRow[]) {
  const live = rows.filter((r) => !r.deleted_at);
  const recorded = live.filter((r) => !!r.status);
  const resolved = recorded.filter((r) => (RESOLVED_DECISION as readonly string[]).includes(r.status as string));
  return { total: live.length, statusRecorded: recorded.length, notRecorded: live.length - recorded.length, resolved: resolved.length };
}

/** Completion and resolution rates: shown only with a denominator of at least 5, and always with n/d. */
export function actionCompletionRate(rows: ActionRow[]) { const c = actionCounts(rows); return rate(c.completed, c.total); }
export function decisionResolutionRate(rows: DecisionRow[]) { const c = decisionCounts(rows); return rate(c.resolved, c.statusRecorded); }
