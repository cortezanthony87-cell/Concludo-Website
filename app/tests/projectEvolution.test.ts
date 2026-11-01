import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeProjectEvolution } from '../src/lib/intelligence/projectEvolution.ts';

describe('computeProjectEvolution overdue counting', () => {
  const baseOptions = {
    projectTitle: 'Vendor Security Assessment',
    sources: [],
    decisionsCount: 0,
  };

  it('correctly counts overdue actions across non-completed statuses using isActionOverdue', () => {
    const past = '2020-01-01';
    const future = '2099-01-01';

    const result = computeProjectEvolution({
      ...baseOptions,
      actions: [
        { id: '1', action_title: 'Not started past due', status: 'not_started', due_date: past },
        { id: '2', action_title: 'In progress past due', status: 'in_progress', due_date: past },
        { id: '3', action_title: 'Blocked past due', status: 'blocked', due_date: past },
        { id: '4', action_title: 'Legacy overdue status', status: 'overdue', due_date: past },
        { id: '5', action_title: 'Completed past due', status: 'completed', due_date: past },
        { id: '6', action_title: 'Not started future due', status: 'not_started', due_date: future },
        { id: '7', action_title: 'Not started no due date', status: 'not_started', due_date: null },
      ],
    });

    // 7 total actions: 1 completed, 6 open
    assert.equal(result.totalActions, 7);
    assert.equal(result.completedActions, 1);
    assert.equal(result.openActions, 6);

    // Overdue actions: 4 (not_started, in_progress, blocked, legacy overdue all with past date)
    // Completed past due (id 5) is NEVER overdue
    // Future due (id 6) is NOT overdue
    // Null due date (id 7) is NOT overdue
    assert.equal(result.overdueActions, 4);

    // When overdue actions exist, scheduleStatus must reflect behind_deadline
    assert.equal(result.scheduleStatus, 'behind_deadline');
    assert.equal(result.statusLabel, '4 Overdue · Behind Deadline');
    assert.equal(result.statusColor, '#EF4444');
  });

  it('reports on_track when no actions are overdue', () => {
    const future = '2099-01-01';

    const result = computeProjectEvolution({
      ...baseOptions,
      actions: [
        { id: '1', action_title: 'Future action', status: 'not_started', due_date: future },
        { id: '2', action_title: 'Completed action', status: 'completed', due_date: '2020-01-01' },
      ],
    });

    assert.equal(result.totalActions, 2);
    assert.equal(result.completedActions, 1);
    assert.equal(result.openActions, 1);
    assert.equal(result.overdueActions, 0);
    assert.equal(result.scheduleStatus, 'on_track');
    assert.equal(result.statusLabel, 'On Track');
  });
});
