import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isActionOverdue, melbourneToday, effectiveStatus } from '../src/lib/intel/actionStatus.ts';

const at = (iso: string) => new Date(iso);
describe('action overdue', () => {
  it('uses the Melbourne date, not UTC', () => {
    // 2026-11-01 23:00 UTC is already 2 Nov in Melbourne (AEDT, UTC+11)
    assert.equal(melbourneToday(at('2026-11-01T23:00:00Z')), '2026-11-02');
    assert.equal(isActionOverdue({ status: 'not_started', due_date: '2026-11-01' }, at('2026-11-01T23:00:00Z')), true);
    assert.equal(isActionOverdue({ status: 'not_started', due_date: '2026-11-01' }, at('2026-11-01T12:00:00Z')), false);
  });
  it('due today is not overdue', () => { assert.equal(isActionOverdue({ status: 'not_started', due_date: '2026-11-02' }, at('2026-11-02T01:00:00Z')), false); });
  it('completed and undated are never overdue', () => {
    assert.equal(isActionOverdue({ status: 'completed', due_date: '2020-01-01' }), false);
    assert.equal(isActionOverdue({ status: 'not_started', due_date: null }), false);
  });
  it('blocked and in-progress can be overdue and keep their status', () => {
    assert.equal(isActionOverdue({ status: 'blocked', due_date: '2020-01-01' }), true);
    assert.equal(effectiveStatus({ status: 'blocked' }), 'blocked');
    assert.equal(effectiveStatus({ status: 'in_progress' }), 'in_progress');
  });
  it('legacy stored overdue folds back to not_started and is still overdue by date', () => {
    assert.equal(effectiveStatus({ status: 'overdue' }), 'not_started');
    assert.equal(isActionOverdue({ status: 'overdue', due_date: '2020-01-01' }), true);
  });
});
