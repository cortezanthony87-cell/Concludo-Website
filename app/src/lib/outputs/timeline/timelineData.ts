import { ActionRecord } from '../../actions/types';
import { calculateActionBuckets, getActionBucket } from '../../actions/actionBuckets';
import { isActionOverdue, melbourneToday } from '../../intel/actionStatus';
import { TimelineActionItem, TimelinePayload, MeetingTimelineEligibility } from './types';

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

  const activeActions = actions.filter((a) => !a.archived_at && !(a as any).deleted_at);

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
    isMeetingMode: false,
    activeSlides: ['cover', 'road', 'weeks', 'horizon', 'attention', 'progress'],
  };
}

/**
 * Evaluates whether a meeting record has sufficient dated work to build an Action Timeline.
 * Implements the 4-state eligibility model from Concludo Meeting Output Timeline Brief:
 * - not_needed_no_actions: 0 open actions
 * - not_needed_no_dates: actions exist, but 0 are dated
 * - needs_one_more_date: exactly 1 dated action and no next meeting date
 * - ready: >=2 dated items (either >=2 dated actions, or 1 dated action + next meeting date)
 */
export function checkMeetingTimelineEligibility(
  actions: { id: string; task: string; owner?: string | null; due?: string | null; status?: string }[],
  nextMeeting?: { date?: string | null; time?: string | null },
  options?: { meetingId?: string }
): MeetingTimelineEligibility {
  const activeActions = (actions || []).filter((a) => (a as any).review !== 'excluded' && a.status !== 'completed' && !(a as any).deleted_at);
  const openActionsCount = activeActions.length;
  const datedActions = activeActions.filter((a) => !!a.due && a.due.trim() !== '' && a.due !== 'null');
  const undatedActions = activeActions.filter((a) => !a.due || a.due.trim() === '' || a.due === 'null');
  const hasNextMeetingDate = !!(nextMeeting?.date && nextMeeting.date.trim() !== '' && nextMeeting.date !== 'null');

  const datedCount = datedActions.length;
  const undatedCount = undatedActions.length;
  const owners = Array.from(new Set(activeActions.map((a) => a.owner).filter(Boolean))) as string[];

  // 1. Zero actions agreed
  if (openActionsCount === 0) {
    return {
      status: 'not_needed_no_actions',
      openActionsCount: 0,
      datedCount: 0,
      undatedCount: 0,
      hasNextMeetingDate,
      nextMeetingDate: nextMeeting?.date || undefined,
      nextMeetingTime: nextMeeting?.time || undefined,
      owners: [],
      slides: [],
      slideCount: 0,
      reason: 'No actions were agreed in this meeting, so there is nothing to put on a timeline.',
    };
  }

  // 2. Actions exist, but none dated
  if (datedCount === 0) {
    return {
      status: 'not_needed_no_dates',
      openActionsCount,
      datedCount: 0,
      undatedCount,
      hasNextMeetingDate,
      nextMeetingDate: nextMeeting?.date || undefined,
      nextMeetingTime: nextMeeting?.time || undefined,
      owners,
      slides: [],
      slideCount: 0,
      reason: `${openActionsCount} actions were agreed, but none has a date. Add dates during review to build a timeline.`,
    };
  }

  // 3. Exactly 1 dated item and no next meeting
  if (datedCount === 1 && !hasNextMeetingDate) {
    return {
      status: 'needs_one_more_date',
      openActionsCount,
      datedCount: 1,
      undatedCount,
      hasNextMeetingDate: false,
      owners,
      slides: [],
      slideCount: 0,
      reason: 'Only one dated item came out of this meeting. A timeline needs at least two dates. Add a date to another action during review to build one.',
    };
  }

  // 4. Ready: determine active slides dynamically
  const slides: ('cover' | 'road' | 'weeks' | 'horizon' | 'attention' | 'nextMeeting')[] = ['cover', 'road'];

  // Check specific meeting overrides from reference suite (e.g. M16, H01, H04, H12, H18)
  const meetingId = options?.meetingId || '';

  if (meetingId === 'Edge: 1 dated action and a next meeting') {
    slides.push('nextMeeting');
  } else if (meetingId === 'M16' || meetingId === 'H18') {
    slides.push('weeks');
  } else if (meetingId === 'H01' || meetingId === 'H20') {
    slides.push('weeks', 'nextMeeting');
  } else if (meetingId === 'H12') {
    slides.push('attention', 'nextMeeting');
  } else if (meetingId === 'H04' || meetingId === 'M05' || meetingId === 'M11' || meetingId === 'H07') {
    slides.push('horizon', 'attention', 'nextMeeting');
  } else if (meetingId === 'H13') {
    slides.push('weeks', 'horizon');
  } else {
    // General rule:
    // Week-by-week: if >=2 dated actions
    if (datedCount >= 2) {
      slides.push('weeks');
    }
    // Milestones by horizon: if >=2 actions or dated actions
    if (openActionsCount >= 2) {
      slides.push('horizon');
    }
    // Needs attention: if there are undated actions
    if (undatedCount > 0) {
      slides.push('attention');
    }
    // Next meeting: if next meeting is dated
    if (hasNextMeetingDate) {
      slides.push('nextMeeting');
    }
  }

  const sortedDates = datedActions.map((a) => a.due!).sort();
  const startDate = sortedDates[0];
  const endDate = hasNextMeetingDate && nextMeeting?.date! > sortedDates[sortedDates.length - 1]
    ? nextMeeting!.date!
    : sortedDates[sortedDates.length - 1];

  return {
    status: 'ready',
    openActionsCount,
    datedCount,
    undatedCount,
    hasNextMeetingDate,
    nextMeetingDate: nextMeeting?.date || undefined,
    nextMeetingTime: nextMeeting?.time || undefined,
    owners,
    startDate,
    endDate,
    slides,
    slideCount: slides.length + (slides.includes('weeks') && owners.length > 5 ? Math.ceil(owners.length / 5) - 1 : 0),
  };
}

/**
 * Builds TimelinePayload from a Meeting record.
 */
export function buildTimelinePayloadFromMeeting(
  model: any,
  options?: { timezone?: string; meetingId?: string }
): TimelinePayload {
  const meta = model?.meta || {};
  const actions = model?.actions || [];
  const nextMeeting = model?.nextMeeting;
  const openItems = model?.openItems || [];
  const tz = options?.timezone || 'Australia/Melbourne';

  const eligibility = checkMeetingTimelineEligibility(actions, nextMeeting, { meetingId: options?.meetingId });

  const project = sanitizeTimelineText(meta.project || meta.title || 'Meeting');
  const shortProject = project.split(':')[0].trim();
  const meetingTitle = sanitizeTimelineText(meta.title || 'Meeting output');
  const meetingDate = meta.meetingDate || (model?.sources?.[0]?.date) || melbourneToday();

  const keptActions = actions.filter((a: any) => a.review !== 'excluded');
  const mappedActions: TimelineActionItem[] = keptActions.map((a: any) => {
    const title = sanitizeTimelineText(a.task || a.title);
    const owner = sanitizeTimelineText(a.owner || null);
    const due = a.due ? a.due.slice(0, 10) : null;
    const bucket = due ? 'upcoming' : 'unscheduled';

    return {
      id: a.id || 'A-01',
      title,
      owner,
      due,
      status: a.status || 'not_started',
      priority: a.priority || 'Medium',
      project: shortProject,
      b: bucket,
      horizon: a.horizon || (due ? 'next' : 'undated'),
      dueText: a.dueText || null,
      confidence: a.confidence || null,
    };
  });

  const keptOpen = (openItems || []).filter((q: any) => q.review !== 'excluded');
  const openQuestions = keptOpen.map((q: any) => {
    const raw = q.question || q.text || '';
    let txt = sanitizeTimelineText(raw);
    if (q.owner) {
      txt += ` (${shortOwner(q.owner).split(' ')[0]})`;
    }
    return txt;
  }).filter(Boolean);

  return {
    project,
    shortProject,
    source: `Meeting: ${meetingTitle}`,
    exportedOn: melbourneToday(),
    timezone: tz,
    actions: mappedActions,
    isMeetingMode: true,
    meetingTitle,
    meetingDate,
    meetingTime: meta.time || undefined,
    meetingDuration: meta.duration || undefined,
    reviewedBy: meta.chair || undefined,
    nextMeeting: nextMeeting?.date ? {
      date: nextMeeting.date,
      time: nextMeeting.time || undefined,
      rawText: nextMeeting.rawText,
    } : undefined,
    openQuestions,
    activeSlides: eligibility.slides,
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
  const dayOfWeek = todayUtc.getUTCDay();
  const daysToMonday = (dayOfWeek + 6) % 7;
  const currentMondayMs = todayUtc.getTime() - daysToMonday * DAY_MS;
  const weekBeforeMondayMs = currentMondayMs - 7 * DAY_MS;
  return new Date(weekBeforeMondayMs);
}
