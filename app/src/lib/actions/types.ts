export type ActionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'overdue';

export const STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  overdue: 'Overdue',
};

export interface ActionRecord {
  id: string;
  user_id: string;
  project_id: string;
  action_title: string;
  action_description: string | null;
  owner_name: string | null;
  due_date: string | null;
  status: ActionStatus;
  source_output_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  purge_after: string | null;
  projects?: {
    id: string;
    title: string;
    client_name?: string | null;
    project_name?: string | null;
    meeting_date?: string | null;
    deleted_at?: string | null;
  } | null;
  outputs?: {
    id: string;
    output_type: string;
    content?: string | null;
  } | null;
}

export interface CreateActionInput {
  project_id: string;
  action_title: string;
  action_description?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  status?: ActionStatus;
  source_output_id?: string | null;
}

export interface UpdateActionInput {
  action_title?: string;
  action_description?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  status?: ActionStatus;
}

/**
 * Checks if an action is overdue according to business logic:
 * status != 'completed' and due_date < current_date
 */
export function isActionOverdue(action: {
  status: string;
  due_date: string | null;
}): boolean {
  if (action.status === 'completed') return false;
  if (!action.due_date) return false;

  const due = new Date(action.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If due_date is in YYYY-MM-DD format, parse as UTC/local midnight
  if (typeof action.due_date === 'string' && action.due_date.length === 10) {
    const [y, m, d] = action.due_date.split('-').map(Number);
    const dueDateObj = new Date(y, m - 1, d);
    return dueDateObj < today;
  }

  return due < today;
}
