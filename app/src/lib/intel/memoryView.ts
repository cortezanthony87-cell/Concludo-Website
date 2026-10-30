/**
 * Pure view logic for Memory > Lessons and Memory > Timeline.
 * No network, no clock reads except where a date is passed in. Fully unit tested.
 */
import type { LessonLearned, KnowledgeClusterCategory, KnowledgeTimelineItem } from '../knowledge/types';

export interface LessonFilters {
  query: string;
  category: KnowledgeClusterCategory | 'all';
}

export function filterLessons(lessons: LessonLearned[], f: LessonFilters): LessonLearned[] {
  const q = f.query.trim().toLowerCase();
  return lessons.filter((l) => {
    if (f.category !== 'all' && l.cluster_category !== f.category) return false;
    if (!q) return true;
    const hay = [l.title, l.summary, l.outcome, ...(l.tags || [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

/** Counts per category over the full list, so the filter chips never lie about what exists. */
export function countByCategory(lessons: LessonLearned[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lessons) out[l.cluster_category] = (out[l.cluster_category] || 0) + 1;
  return out;
}

export interface LessonDraft {
  title: string;
  summary: string;
  outcome: string;
}

export type LessonErrors = Partial<Record<keyof LessonDraft, string>>;

export function validateLesson(d: LessonDraft): LessonErrors {
  const e: LessonErrors = {};
  if (!d.title.trim()) e.title = 'Add a short title.';
  else if (d.title.trim().length > 140) e.title = 'Keep the title under 140 characters.';
  if (!d.summary.trim()) e.summary = 'Say what happened.';
  if (!d.outcome.trim()) e.outcome = 'Record the outcome, even if it is "not yet known".';
  return e;
}

/** Date-only strings are shown as written, never shifted by the viewer's timezone. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return 'No date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function describeLessonScope(a: { shown: number; total: number; category: string; query: string }): string {
  if (a.total === 0) return 'no lessons recorded yet';
  const parts = [`${a.shown} of ${a.total} lessons`];
  if (a.category !== 'all') parts.push(`in ${a.category}`);
  if (a.query.trim()) parts.push(`matching "${a.query.trim()}"`);
  return parts.join(' ');
}

/** Newest first, undated last. Stable for equal dates. */
export function sortTimeline(items: KnowledgeTimelineItem[]): KnowledgeTimelineItem[] {
  return items
    .map((it, i) => ({ it, i, t: new Date(it.date).getTime() }))
    .sort((a, b) => {
      const an = Number.isNaN(a.t), bn = Number.isNaN(b.t);
      if (an !== bn) return an ? 1 : -1;
      if (a.t !== b.t) return b.t - a.t;
      return a.i - b.i;
    })
    .map((x) => x.it);
}

export function eventLabel(type: string): string {
  return (type || 'record').replace(/_/g, ' ');
}
