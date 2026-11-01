export type ActionStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'overdue';

export const STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  overdue: 'Overdue',
};

export { isActionOverdue } from '../intel/actionStatus';

export type ActionPriority = 'high' | 'medium' | 'low';

export type ActionBucket = 'Completed' | 'Overdue' | 'Due today' | 'Pending';

export interface ActionRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  action_title: string;
  action_description: string | null;
  owner_name: string | null;
  due_date: string | null;
  status: ActionStatus;
  source_output_id: string | null;
  ownership_type: 'personal' | 'team';
  team_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  priority: ActionPriority | null;
  due_time: string | null;
  due_timezone: string | null;
  all_day: boolean;
  completed_at: string | null;
  completed_by: string | null;
  archived_at: string | null;
  archived_by: string | null;
  source_type: string | null;
  source_id: string | null;
  source_url: string | null;
  origin_marker: string | null;
  version?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  purge_after: string | null;
  projects?: {
    id: string;
    title: string;
    client_name: string | null;
    project_name: string | null;
    meeting_date: string | null;
    deleted_at: string | null;
    ownership_type: string | null;
    team_id: string | null;
  } | null;
  outputs?: {
    id: string;
    output_type: string;
    content: any;
  } | null;
}

export interface CreateActionInput {
  project_id?: string | null;
  action_title: string;
  action_description?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  status?: ActionStatus;
  source_output_id?: string | null;
  ownership_type?: 'personal' | 'team';
  team_id?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  priority?: ActionPriority | null;
  due_time?: string | null;
  due_timezone?: string | null;
  all_day?: boolean;
  source_type?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  origin_marker?: string | null;
  approval_state?: 'manual' | 'approved_from_candidate';
  approved_by?: string | null;
  approved_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
}

export interface UpdateActionInput {
  action_title?: string;
  action_description?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  status?: ActionStatus;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  ownership_type?: 'personal' | 'team';
  team_id?: string | null;
  priority?: ActionPriority | null;
  due_time?: string | null;
  due_timezone?: string | null;
  all_day?: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  origin_marker?: string | null;
}
