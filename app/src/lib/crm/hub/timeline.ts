/**
 * Unified Communication Timeline read model for Release 0.
 *
 * Acceptance Criterion 2:
 * "Timeline order is correct by event time in every test fixture."
 *
 * Ordered strictly newest first by event_at, not by import or write time.
 */

import { HUB_TIMELINE_ITEMS } from './data';
import { CommTimelineItem, CommTimelineItemType } from './types';

export function getRecordTimeline(
  recordId: string,
  filterType: CommTimelineItemType | 'all' = 'all'
): CommTimelineItem[] {
  const items = HUB_TIMELINE_ITEMS.filter(
    (item) => item.recordId === recordId && item.deletedAt === null
  );

  const filtered =
    filterType === 'all'
      ? items
      : items.filter((item) => {
          if (filterType === 'task') {
            return item.itemType === 'task';
          }
          return item.itemType === filterType;
        });

  // Strict reverse chronological order by event time (newest first)
  return filtered.slice().sort((a, b) => {
    const timeA = new Date(a.eventAt).getTime();
    const timeB = new Date(b.eventAt).getTime();
    return timeB - timeA;
  });
}

/**
 * Verifies that a list of timeline items adheres strictly to reverse chronological order.
 */
export function verifyTimelineOrder(items: CommTimelineItem[]): boolean {
  for (let i = 0; i < items.length - 1; i++) {
    const current = new Date(items[i].eventAt).getTime();
    const next = new Date(items[i + 1].eventAt).getTime();
    if (current < next) {
      return false;
    }
  }
  return true;
}
