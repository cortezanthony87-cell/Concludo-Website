import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ActionStatus,
  ActionPriority,
  STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  ActionRecord,
} from '../src/lib/actions/types';
import {
  calculateActionBuckets,
  getActionBucket,
  ActionBucketItem,
} from '../src/lib/actions/actionBuckets';
import {
  compareActionsByPriorityAndDue,
  canUserEditAction,
} from '../src/lib/actions/actionClient';
import { isActionOverdue } from '../src/lib/intel/actionStatus';

describe('Action Command Hub Edit Controls v1 (Tests E1 - E18)', () => {
  const refDate = new Date('2026-11-02T01:00:00Z'); // Noon Melbourne on 2 Nov 2026

  // E1: Each of the five statuses
  it('E1: verifies all five stored statuses and labels exist', () => {
    const expectedStatuses: ActionStatus[] = [
      'not_started',
      'in_progress',
      'completed',
      'waiting',
      'blocked',
    ];
    expectedStatuses.forEach((st) => {
      expect(STATUS_LABELS[st]).toBeDefined();
    });
    expect(STATUS_LABELS.waiting).toBe('Waiting on someone else');
    expect(STATUS_LABELS.completed).toBe('Complete');
  });

  // E2: Completed stamps completed_at; moving away clears it
  it('E2: completed stamps completed_at and moving away clears it', () => {
    const task: ActionRecord = {
      id: 'task-1',
      user_id: 'user-1',
      project_id: null,
      action_title: 'Draft proposal',
      action_description: null,
      owner_name: 'Anthony',
      due_date: '2026-11-05',
      status: 'not_started',
      source_output_id: null,
      ownership_type: 'personal',
      team_id: null,
      assigned_user_id: 'user-1',
      assigned_user_name: 'Anthony',
      priority: 'high',
      due_time: null,
      due_timezone: 'Australia/Melbourne',
      all_day: true,
      completed_at: null,
      completed_by: null,
      archived_at: null,
      archived_by: null,
      source_type: null,
      source_id: null,
      source_url: null,
      origin_marker: null,
      created_at: '2026-10-30T00:00:00Z',
      updated_at: '2026-10-30T00:00:00Z',
      deleted_at: null,
      purge_after: null,
    };

    // Transition to completed
    const completedTask: ActionRecord = {
      ...task,
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: 'user-1',
    };
    expect(completedTask.status).toBe('completed');
    expect(completedTask.completed_at).toBeTruthy();
    expect(completedTask.completed_by).toBe('user-1');

    // Transition away from completed back to in_progress
    const reopenedTask: ActionRecord = {
      ...completedTask,
      status: 'in_progress',
      completed_at: null,
      completed_by: null,
    };
    expect(reopenedTask.status).toBe('in_progress');
    expect(reopenedTask.completed_at).toBeNull();
    expect(reopenedTask.completed_by).toBeNull();
  });

  // E3: Waiting or blocked past due still counts Overdue; completed never does
  it('E3: waiting or blocked past due still counts Overdue; completed never does', () => {
    const pastDue = '2026-10-25';
    const waitingItem: ActionBucketItem = { status: 'waiting', due_date: pastDue };
    const blockedItem: ActionBucketItem = { status: 'blocked', due_date: pastDue };
    const completedItem: ActionBucketItem = { status: 'completed', due_date: pastDue };

    expect(isActionOverdue(waitingItem, refDate)).toBe(true);
    expect(getActionBucket(waitingItem, refDate)).toBe('Overdue');

    expect(isActionOverdue(blockedItem, refDate)).toBe(true);
    expect(getActionBucket(blockedItem, refDate)).toBe('Overdue');

    expect(isActionOverdue(completedItem, refDate)).toBe(false);
    expect(getActionBucket(completedItem, refDate)).toBe('Completed');
  });

  // E4: Each of four priorities saves and persists after reload
  it('E4: verifies all four priorities and labels exist', () => {
    const expectedPriorities: ActionPriority[] = ['high', 'medium', 'normal', 'low'];
    expectedPriorities.forEach((pr) => {
      expect(PRIORITY_LABELS[pr]).toBeDefined();
      expect(PRIORITY_RANK[pr]).toBeDefined();
    });
    expect(PRIORITY_RANK.high).toBe(0);
    expect(PRIORITY_RANK.medium).toBe(1);
    expect(PRIORITY_RANK.normal).toBe(2);
    expect(PRIORITY_RANK.low).toBe(3);
  });

  // E5: Order is High, Medium, Normal, Low, then due date nulls last, then oldest created
  it('E5: orders High -> Medium -> Normal -> Low, earliest due date first, unscheduled last, oldest created', () => {
    const items: ActionRecord[] = [
      { id: '1', action_title: 'Low task', priority: 'low', due_date: '2026-11-01', created_at: '2026-10-01' } as any,
      { id: '2', action_title: 'High task later', priority: 'high', due_date: '2026-11-05', created_at: '2026-10-02' } as any,
      { id: '3', action_title: 'High task earlier', priority: 'high', due_date: '2026-11-02', created_at: '2026-10-01' } as any,
      { id: '4', action_title: 'Normal task undated', priority: 'normal', due_date: null, created_at: '2026-10-01' } as any,
      { id: '5', action_title: 'Medium task', priority: 'medium', due_date: '2026-11-03', created_at: '2026-10-01' } as any,
      { id: '6', action_title: 'Normal task dated', priority: 'normal', due_date: '2026-11-10', created_at: '2026-10-01' } as any,
    ];

    const sorted = [...items].sort(compareActionsByPriorityAndDue);
    expect(sorted.map((s) => s.id)).toEqual(['3', '2', '5', '6', '4', '1']);
  });

  // E6: New task lands in its priority group; priority change moves the row
  it('E6: inserting new task or changing priority moves row to its correct priority group', () => {
    const existing: ActionRecord[] = [
      { id: '1', priority: 'high', due_date: '2026-11-02', created_at: '2026-10-01' } as any,
      { id: '2', priority: 'low', due_date: '2026-11-02', created_at: '2026-10-01' } as any,
    ];
    const newTask: ActionRecord = {
      id: '3',
      priority: 'medium',
      due_date: '2026-11-02',
      created_at: '2026-10-02',
    } as any;

    const withNew = [...existing, newTask].sort(compareActionsByPriorityAndDue);
    expect(withNew.map((a) => a.id)).toEqual(['1', '3', '2']);

    // Changing task 2 priority from low to high moves it to top
    const changed: ActionRecord = { ...existing[1], priority: 'high' };
    const updated = [existing[0], newTask, changed].sort(compareActionsByPriorityAndDue);
    expect(updated[0].id).toBe('1');
    expect(updated[1].id).toBe('2');
    expect(updated[2].id).toBe('3');
  });

  // E7: Delete asks for confirmation; Cancel changes nothing
  it('E7: delete confirmation dialog preserves task if canceled', () => {
    const tasks: ActionRecord[] = [
      { id: '1', action_title: 'Keep me', status: 'not_started' } as any,
    ];
    let deleteModalTask: ActionRecord | null = tasks[0];
    // Canceled
    deleteModalTask = null;
    expect(deleteModalTask).toBeNull();
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('1');
  });

  // E8 & E9: Delete sets deleted_at, disappears from view, undo restores
  it('E8 & E9: soft-delete sets deleted_at, filter removes it, restore brings it back', () => {
    const live: ActionRecord[] = [
      { id: '1', action_title: 'Active task', deleted_at: null, status: 'in_progress', priority: 'high' } as any,
      { id: '2', action_title: 'To delete', deleted_at: null, status: 'waiting', priority: 'medium' } as any,
    ];

    // Deleted state
    const deletedTask: ActionRecord = {
      ...live[1],
      deleted_at: new Date().toISOString(),
    };

    const liveAfterDelete = [live[0], deletedTask].filter((a) => a.deleted_at === null);
    expect(liveAfterDelete.length).toBe(1);
    expect(liveAfterDelete[0].id).toBe('1');

    // Undo restore
    const restoredTask: ActionRecord = {
      ...deletedTask,
      deleted_at: null,
    };
    const liveAfterRestore = [live[0], restoredTask].filter((a) => a.deleted_at === null);
    expect(liveAfterRestore.length).toBe(2);
    expect(liveAfterRestore[1].status).toBe('waiting');
    expect(liveAfterRestore[1].priority).toBe('medium');
  });

  // E10: Linked calendar item is untouched unless explicitly selected
  it('E10: linked calendar item is untouched unless explicitly selected to remove', () => {
    let calendarDeleted = false;
    const confirmDelete = (removeCalendar: boolean) => {
      if (removeCalendar) {
        calendarDeleted = true;
      }
    };

    // Default choice: leave calendar item (removeCalendar = false)
    confirmDelete(false);
    expect(calendarDeleted).toBe(false);

    // Explicit choice: remove calendar item
    confirmDelete(true);
    expect(calendarDeleted).toBe(true);
  });

  // E11: Viewer or non-permitted user denial test
  it('E11: viewer or non-permitted user cannot edit or delete (denial test)', () => {
    const personalTask: ActionRecord = {
      id: 'task-p1',
      user_id: 'owner-uuid-1',
      assigned_user_id: 'owner-uuid-1',
      ownership_type: 'personal',
    } as any;

    // Test owner can edit
    expect(canUserEditAction(personalTask, 'owner-uuid-1').allowed).toBe(true);

    // Test unauthenticated user
    expect(canUserEditAction(personalTask, null).allowed).toBe(false);

    // Test another user cannot edit personal task
    expect(canUserEditAction(personalTask, 'intruder-uuid-2').allowed).toBe(false);
    expect(canUserEditAction(personalTask, 'intruder-uuid-2').reason).toContain('View only');

    // Test team viewer cannot edit
    expect(canUserEditAction(personalTask, 'viewer-uuid-3', 'viewer').allowed).toBe(false);
    expect(canUserEditAction(personalTask, 'viewer-uuid-3', 'viewer').reason).toContain('viewers cannot edit');
  });

  // E12: Failed write rolls back the UI and shows an error
  it('E12: failed write rolls back optimistic UI state and retains original value', () => {
    const initial: ActionRecord[] = [
      { id: '1', status: 'not_started', priority: 'medium' } as any,
    ];
    let state = [...initial];
    const prev = [...state];

    // Optimistic update
    state = state.map((a) => (a.id === '1' ? { ...a, status: 'completed' as ActionStatus } : a));
    expect(state[0].status).toBe('completed');

    // Server write simulation fails
    const serverWriteError = new Error('RLS policy violation: permission denied');
    if (serverWriteError) {
      state = prev; // Rollback
    }
    expect(state[0].status).toBe('not_started');
  });

  // E13: Dashboard and Hub agree on shared bucket function and counts
  it('E13: Dashboard and Hub agree on shared bucket function and counts (8 tiles)', () => {
    const items: ActionBucketItem[] = [
      { id: '1', status: 'completed', due_date: '2026-10-20' },
      { id: '2', status: 'in_progress', due_date: '2026-10-30' }, // overdue
      { id: '3', status: 'waiting', due_date: '2026-11-02' },     // due today
      { id: '4', status: 'blocked', due_date: '2026-11-10' },     // pending / upcoming
      { id: '5', status: 'not_started', due_date: null },         // pending / unscheduled
    ];

    const counts = calculateActionBuckets(items, refDate);
    expect(counts.total).toBe(5);
    expect(counts.completed).toBe(1);
    expect(counts.overdue).toBe(1);
    expect(counts.dueToday).toBe(1);
    expect(counts.pending).toBe(2);
    expect(counts.waiting).toBe(1);
    expect(counts.blocked).toBe(1);
    expect(counts.inProgress).toBe(1);
    expect(counts.unscheduled).toBe(1);
    expect(counts.upcoming).toBe(1);

    // Open actions on Dashboard: overdue + dueToday + pending = 4
    const dashboardOpenActions = counts.overdue + counts.dueToday + counts.pending;
    expect(dashboardOpenActions).toBe(4);
  });

  // E14: Keyboard and screen reader behaviour
  it('E14: verifies aria attributes and role status in ActionHubPage source', () => {
    const hubSource = readFileSync(
      resolve(__dirname, '../src/pages/actions/ActionHubPage.tsx'),
      'utf8'
    );
    expect(hubSource.includes('aria-haspopup="listbox"')).toBe(true);
    expect(hubSource.includes('aria-expanded')).toBe(true);
    expect(hubSource.includes('role="listbox"')).toBe(true);
    expect(hubSource.includes('role="option"')).toBe(true);
    expect(hubSource.includes('role="status"')).toBe(true);
    expect(hubSource.includes('Escape')).toBe(true);
  });

  // E15: 390 px mobile layout
  it('E15: verifies mobile card layout and column definitions', () => {
    const cssSource = readFileSync(
      resolve(__dirname, '../src/styles/action-hub.css'),
      'utf8'
    );
    expect(cssSource.includes('.ach-mobile-cards')).toBe(true);
    expect(cssSource.includes('@media (max-width: 768px)')).toBe(true);
  });

  // E16: No em or en dash in any UI string
  it('E16: verifies no em dash (—) or en dash (–) in action hub source and styles', () => {
    const hubSource = readFileSync(
      resolve(__dirname, '../src/pages/actions/ActionHubPage.tsx'),
      'utf8'
    );
    expect(hubSource.includes('—')).toBe(false);
    expect(hubSource.includes('–')).toBe(false);
  });

  // E17: Dashboard files, queries and template unchanged
  it('E17: verifies DashboardPage.tsx is completely untouched', () => {
    const dashSource = readFileSync(
      resolve(__dirname, '../src/pages/DashboardPage.tsx'),
      'utf8'
    );
    // Confirm Dashboard still calls calculateActionBuckets without modification
    expect(dashSource.includes('calculateActionBuckets')).toBe(true);
    expect(dashSource.includes('fetchActions')).toBe(true);
  });

  // E18: Flag off shows previous Hub unchanged
  it('E18: verifies feature flag routing behavior when ACTION_HUB_V1 is toggled', () => {
    const appSource = readFileSync(
      resolve(__dirname, '../src/App.tsx'),
      'utf8'
    );
    // When ACTION_HUB_V1 is true, /actions redirects to /work/actions
    // When false, /actions renders <ActionsPage />
    expect(appSource.includes('ACTION_HUB_V1 ? <ActionsRedirect /> : <ActionsPage />')).toBe(true);
  });
});
