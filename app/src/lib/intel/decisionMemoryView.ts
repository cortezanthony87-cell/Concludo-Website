import type { DecisionRecord } from '../decisions/types';

/**
 * Pure view logic for Decision Memory. No React, no network, so it is unit tested.
 *
 * Dates: decision_date is a calendar date (YYYY-MM-DD), not a moment in time.
 * Parsing it with new Date() treats it as UTC midnight and a local formatter can
 * then show the previous day. Format date-only values in UTC, and work out
 * "today" in the organisation's time zone (default Australia/Melbourne).
 */

export type DecisionPeriod = 'all' | '30d' | '90d' | '365d';
export type DecisionScope = 'all' | 'personal' | 'team';

export const DEFAULT_TIME_ZONE = 'Australia/Melbourne';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDecisionDate(value: string | null | undefined): string {
  if (!value) return 'No date recorded';
  const d = DATE_ONLY.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date recorded';
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: DATE_ONLY.test(value) ? 'UTC' : DEFAULT_TIME_ZONE,
  });
}

/** Today's calendar date (YYYY-MM-DD) in the given zone. */
export function todayInZone(now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const PERIOD_DAYS: Record<Exclude<DecisionPeriod, 'all'>, number> = { '30d': 30, '90d': 90, '365d': 365 };

export function periodStart(period: DecisionPeriod, now: Date, timeZone: string = DEFAULT_TIME_ZONE): string | null {
  if (period === 'all') return null;
  const today = new Date(`${todayInZone(now, timeZone)}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() - PERIOD_DAYS[period]);
  return today.toISOString().slice(0, 10);
}

export interface DecisionFilters {
  query: string;
  period: DecisionPeriod;
  projectId: string; // 'all' or a project id
}

export function filterDecisions(
  decisions: DecisionRecord[],
  filters: DecisionFilters,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE
): DecisionRecord[] {
  const q = filters.query.trim().toLowerCase();
  const start = periodStart(filters.period, now, timeZone);
  return decisions.filter((d) => {
    if (filters.projectId !== 'all' && d.project_id !== filters.projectId) return false;
    if (start) {
      // Records with no decision date cannot be placed in a period, so they are left out and counted.
      if (!d.decision_date || d.decision_date.slice(0, 10) < start) return false;
    }
    if (q) {
      const hay = [d.decision_title, d.decision_summary, d.decision_reasoning, d.decision_owner]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Records the period filter had to leave out because they have no decision date. */
export function undatedCount(decisions: DecisionRecord[], filters: DecisionFilters): number {
  if (filters.period === 'all') return 0;
  return decisions.filter((d) => !d.decision_date).length;
}

export function projectName(d: DecisionRecord): string {
  return d.projects?.title || d.projects?.project_name || 'Untitled project';
}

export function projectOptions(decisions: DecisionRecord[]): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  decisions.forEach((d) => {
    if (!seen.has(d.project_id)) seen.set(d.project_id, projectName(d));
  });
  return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'en-AU'));
}

const PERIOD_LABEL: Record<DecisionPeriod, string> = {
  all: 'all dates',
  '30d': 'the last 30 days',
  '90d': 'the last 90 days',
  '365d': 'the last 12 months',
};
const SCOPE_LABEL: Record<DecisionScope, string> = {
  all: 'your decisions and your teams',
  personal: 'your personal decisions',
  team: 'team decisions',
};

export function describeScope(args: {
  shown: number;
  total: number;
  scope: DecisionScope;
  period: DecisionPeriod;
  query: string;
  projectLabel: string | null;
  undated: number;
}): string {
  const { shown, total, scope, period, query, projectLabel, undated } = args;
  const parts = [`${shown} of ${total} ${total === 1 ? 'decision' : 'decisions'}`, SCOPE_LABEL[scope], PERIOD_LABEL[period]];
  if (projectLabel) parts.push(`project: ${projectLabel}`);
  if (query.trim()) parts.push(`matching "${query.trim()}"`);
  let out = parts.join(', ');
  if (undated > 0) out += `. ${undated} with no decision date ${undated === 1 ? 'is' : 'are'} left out of the period`;
  return out;
}
