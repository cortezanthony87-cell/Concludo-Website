import { describe, it, expect } from 'bun:test';
import { getActionBucket, calculateActionBuckets, ActionBucketItem } from '../src/lib/actions/actionBuckets';

describe('Action Command Hub - Buckets and Counts', () => {
  // Test reference date: 2026-11-01 at noon Melbourne time (UTC 2026-11-01T01:00:00Z)
  const refDate = new Date('2026-11-01T01:00:00Z');

  it('classifies Completed regardless of due date', () => {
    const item: ActionBucketItem = { status: 'completed', due_date: '2026-10-15' };
    expect(getActionBucket(item, refDate)).toBe('Completed');
  });

  it('classifies Overdue when due before Melbourne today and incomplete', () => {
    const item: ActionBucketItem = { status: 'in_progress', due_date: '2026-10-31' };
    expect(getActionBucket(item, refDate)).toBe('Overdue');
  });

  it('classifies Due today when due on Melbourne today and incomplete', () => {
    const item: ActionBucketItem = { status: 'not_started', due_date: '2026-11-01' };
    expect(getActionBucket(item, refDate)).toBe('Due today');
  });

  it('classifies Pending when due in the future or unscheduled', () => {
    const futureItem: ActionBucketItem = { status: 'not_started', due_date: '2026-11-05' };
    const undatedItem: ActionBucketItem = { status: 'not_started', due_date: null };
    expect(getActionBucket(futureItem, refDate)).toBe('Pending');
    expect(getActionBucket(undatedItem, refDate)).toBe('Pending');
  });

  it('guarantees bucket sum equals total and buckets are mutually exclusive', () => {
    const items: ActionBucketItem[] = [
      { id: '1', status: 'completed', due_date: '2026-10-20' },
      { id: '2', status: 'in_progress', due_date: '2026-10-30' }, // overdue
      { id: '3', status: 'blocked', due_date: '2026-11-01' },     // due today
      { id: '4', status: 'not_started', due_date: '2026-11-10' }, // pending / upcoming
      { id: '5', status: 'not_started', due_date: null },         // pending / unscheduled
      { id: '6', status: 'completed', due_date: '2026-11-05' },   // completed
    ];

    const counts = calculateActionBuckets(items, refDate);
    expect(counts.total).toBe(6);
    expect(counts.completed).toBe(2);
    expect(counts.overdue).toBe(1);
    expect(counts.dueToday).toBe(1);
    expect(counts.pending).toBe(2);
    expect(counts.completed + counts.overdue + counts.dueToday + counts.pending).toBe(counts.total);

    // Filter counters check
    expect(counts.inProgress).toBe(1);
    expect(counts.blocked).toBe(1);
    expect(counts.unscheduled).toBe(1);
    expect(counts.upcoming).toBe(1);
  });

  it('excludes archived items from bucket totals', () => {
    const items: ActionBucketItem[] = [
      { id: '1', status: 'not_started', due_date: '2026-11-01', archived_at: '2026-11-01T00:00:00Z' },
      { id: '2', status: 'not_started', due_date: '2026-11-01', archived_at: null },
    ];

    const counts = calculateActionBuckets(items, refDate);
    expect(counts.total).toBe(1);
    expect(counts.dueToday).toBe(1);
  });
});
