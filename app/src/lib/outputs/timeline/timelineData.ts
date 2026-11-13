import { ActionRecord } from '../../actions/types';
import { calculateActionBuckets, getActionBucket } from '../../actions/actionBuckets';
import { isActionOverdue, melbourneToday } from '../../intel/actionStatus';
import { TimelineActionItem, TimelinePayload } from './types';

export const TIMELINE_STATUS = {
  completed: { label: 'Completed', color: '1F9D6B' },
  overdue: { label: 'Overdue', color: 'E04F5F' },
  today: { label: 'Due today', color: 'E2B53C' },
  upcoming: { label: 'Upcoming', color: '3D7BE0' },
  unscheduled: { label: 'Date to be agreed', color: '8A94A6' },
} as const;

export const TIMELINE_COLORS = {
  navy: '16263F',
  navy2: '21395C',
  gold: 'E2B53C',
  goldDeep: 'BC8A1C',
  light: 'F4F6FA',
  white: 'FFFFFF',
  ink: '16263F',
  body: '3C4A63',
  mute: '6B778C',
  hair: 'DCE2EC',
} as const;

export const DAY_MS = 86400000;

/**
 * Strictly sanitises any text to avoid em and en dashes (replaces with comma)
 * and eliminates any "AI" wording.
 */
export function sanitizeTimelineText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[\u2013\u2014]/g, ',')
    .replace(/\s*,\s*,/g, ',')
    .replace(/artificial intelligence/gi, 'drafting')
    .replace(/\bAI\b/g, 'drafting');
}

export function parseUtcDate(isoDateStr: string): Date {
  return new Date(isoDateStr.slice(0, 10) + 'T00:00:00Z');
}

export function formatTimelineDate(isoDateStr: string | null | undefined, withDay = true): string {
  if (!isoDateStr) return '';
  const d = parseUtcDate(isoDateStr);
  const wd = d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' });
  const dm = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return withDay ? `${wd} ${dm}` : dm;
}

export function clipText(t: string, maxLen: number): string {
  const sanitized = sanitizeTimelineText(t);
  if (sanitized.length <= maxLen) return sanitized;
  const lastSpace = sanitized.lastIndexOf(' ', maxLen - 1);
  return (lastSpace > 0 ? sanitized.slice(0, lastSpace) : sanitized.slice(0, maxLen - 1)) + '\u2026';
}

export function shortOwner(name: string | null | undefined): string {
  const sanitized = sanitizeTimelineText(name);
  return sanitized ? sanitized : 'Owner to be agreed';
}

export function firstWordOwner(name: string | null | undefined): string {
  const sanitized = sanitizeTimelineText(name);
  return sanitized ? sanitized.split(' ')[0] : 'Unassigned';
}

export function tintColor(hex: string, a: number): string {
  const n = parseInt(hex, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * (1 - a)).toString(16).padStart(2, '0');
  return (m(r) + m(g) + m(b)).toUpperCase();
}

/**
 * Maps an action record to a timeline status bucket according to actionBuckets.ts and Melbourne date.
 */
export function mapActionToTimelineBucket(
  action: { status?: string | null; due_date?: string | null; all_day?: boolean | null; due_time?: string | null; archived_at?: string | null },
  now: Date = new Date()
): 'completed' | 'overdue' | 'today' | 'upcoming' | 'unscheduled' {
  const bucket = getActionBucket(action as any, now);
  if (bucket === 'Completed') return 'completed';
  if (bucket === 'Overdue') return 'overdue';
  if (bucket === 'Due today') return 'today';
  // 'Pending': split into unscheduled vs upcoming based strictly on due_date presence
  if (!action.due_date) return 'unscheduled';
  return 'upcoming';
}

/**
 * Builds the TimelinePayload from the currently displayed Action Command Hub records.
 */
export function buildTimelinePayloadFromActions(
  actions: ActionRecord[],
  options: {
    viewName: string;
    filterDescription?: string;
    projectName?: string;
    timezone?: string;
    now?: Date;
  }
): TimelinePayload {
  const now = options.now || new Date();
  const today = melbourneToday(now);
  const tz = options.timezone || 'Australia/Melbourne';

  // Filter out archived or soft-deleted records
  const activeActions = actions.filter((a) => !a.archived_at && !(a as any).deleted_at);

  // Resolve project name
  const distinctProjects = Array.from(
    new Set(activeActions.map((a) => a.projects?.title || a.projects?.project_name).filter(Boolean))
  );
  const primaryProject: string =
    options.projectName ||
    (distinctProjects.length === 1 && distinctProjects[0] ? distinctProjects[0] : options.viewName || 'Action Command Hub');

  const shortProject = primaryProject.split(':')[0].trim();

  const mappedItems: TimelineActionItem[] = activeActions.map((a) => {
    const bucket = mapActionToTimelineBucket(a, now);
    const title = sanitizeTimelineText(a.action_title);
    const owner = sanitizeTimelineText(a.assigned_user_name || a.owner_name || null);
    const due = a.due_date ? a.due_date.slice(0, 10) : null;
    const pr = a.priority ? a.priority.charAt(0).toUpperCase() + a.priority.slice(1).toLowerCase() : 'Medium';

    return {
      id: a.id,
      title,
      owner,
      due,
      status: a.status || 'not_started',
      priority: pr,
      project: a.projects?.title || a.projects?.project_name || primaryProject,
      project_id: a.project_id || null,
      user_id: a.user_id,
      b: bucket,
    };
  });

  const sourceDesc = options.filterDescription
    ? `${options.viewName} (${options.filterDescription})`
    : options.viewName || 'Action Hub, all permitted actions';

  return {
    project: primaryProject,
    shortProject,
    source: sourceDesc,
    exportedOn: today,
    timezone: tz || 'Australia/Melbourne',
    actions: mappedItems,
  };
}

/**
 * Builds clean, dash-free PowerPoint file name as per brief Section 1:
 * Concludo_Timeline_<Project or View>_<YYYY_MM_DD>.pptx
 */
export function buildTimelineFileName(projectOrView: string, exportDateIso: string): string {
  const cleanProj = (projectOrView || 'Actions')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const cleanDate = exportDateIso.replace(/-/g, '_');
  return `Concludo_Timeline_${cleanProj}_${cleanDate}.pptx`;
}

/**
 * Computes the Monday of the week before today for the 7-week grid.
 */
export function calculateStartMondayOfWeekBefore(todayIso: string): Date {
  const todayUtc = parseUtcDate(todayIso);
  const dayOfWeek = todayUtc.getUTCDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
  const daysToMonday = (dayOfWeek + 6) % 7;
  const currentMondayMs = todayUtc.getTime() - daysToMonday * DAY_MS;
  const weekBeforeMondayMs = currentMondayMs - 7 * DAY_MS;
  return new Date(weekBeforeMondayMs);
}
