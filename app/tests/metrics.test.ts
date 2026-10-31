import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { actionCounts, decisionCounts, actionCompletionRate, decisionResolutionRate } from '../src/lib/intel/metrics.ts';

const now = new Date('2026-11-10T01:00:00Z');
const past = '2026-11-01', future = '2026-12-01';
describe('metrics', () => {
  it('counts open, overdue, blocked once, the same everywhere', () => {
    const c = actionCounts([
      { status: 'not_started', due_date: past }, { status: 'overdue', due_date: past }, { status: 'blocked', due_date: past },
      { status: 'in_progress', due_date: future }, { status: 'completed', due_date: past }, { status: 'not_started', due_date: past, deleted_at: 'x' },
    ], now);
    assert.deepEqual(c, { total: 5, open: 4, overdue: 3, blocked: 1, completed: 1 });
  });
  it('abstains on rates under 5', () => {
    const r = actionCompletionRate([{ status: 'completed' }, { status: 'not_started' }]);
    assert.equal(r.ok, false);
  });
  it('shows a rate with numerator and denominator at 5 or more', () => {
    const rows = [...Array(3).fill({ status: 'completed' }), ...Array(2).fill({ status: 'not_started' })];
    const r = actionCompletionRate(rows) as any;
    assert.equal(r.ok, true); assert.equal(r.value.numerator, 3); assert.equal(r.value.denominator, 5); assert.equal(r.value.percent, 60);
  });
  it('decisions with no status are not recorded, not unresolved', () => {
    const d = decisionCounts([{ status: null }, { status: 'approved' }, { status: 'not_started' }, { status: 'rejected', deleted_at: 'x' }]);
    assert.deepEqual(d, { total: 3, statusRecorded: 2, notRecorded: 1, resolved: 1 });
    assert.equal(decisionResolutionRate([{ status: null }]).ok, false);
  });
});
