export type WorkflowTriggerType =
  | 'project_created'
  | 'project_updated'
  | 'meeting_completed'
  | 'action_created'
  | 'action_completed'
  | 'decision_created'
  | 'decision_updated'
  | 'report_generated'
  | 'workflow_schedule'
  | 'webhook_event';

export type WorkflowConditionField =
  | 'project_type'
  | 'decision_type'
  | 'task_status'
  | 'action_owner'
  | 'team'
  | 'organization'
  | 'custom_rules';

export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'is_overdue'
  | 'is_assigned';

export interface WorkflowCondition {
  field: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  value: any;
}

export type WorkflowActionType =
  | 'generate_report'
  | 'generate_summary'
  | 'create_tasks'
  | 'send_teams_message'
  | 'send_slack_message'
  | 'create_planner_task'
  | 'create_todo_task'
  | 'create_notion_page'
  | 'create_crm_note'
  | 'generate_approval_request';

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, any>;
}

export type WorkflowExecutionType =
  | 'approval_required'
  | 'automatic'
  | 'manual_only';

export interface WorkflowRecord {
  id: string;
  owner_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  name: string;
  description?: string;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, any>;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  execution_type: WorkflowExecutionType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'requires_approval'
  | 'rejected'
  | 'cancelled';

export interface WorkflowExecutionRecord {
  id: string;
  workflow_id: string;
  triggered_by: string;
  status: WorkflowExecutionStatus;
  trigger_data: Record<string, any>;
  steps_completed: {
    actionType: WorkflowActionType;
    status: 'success' | 'failed' | 'requires_approval' | 'skipped';
    result?: any;
    executedAt: string;
  }[];
  error_message?: string | null;
  execution_duration_ms: number;
  created_at: string;
  updated_at: string;
  workflow?: Partial<WorkflowRecord>;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface WorkflowApprovalRecord {
  id: string;
  workflow_id?: string | null;
  execution_id?: string | null;
  requester_id: string;
  approver_id?: string | null;
  status: ApprovalStatus;
  action_type: string;
  action_payload: Record<string, any>;
  notes?: string | null;
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  workflow?: Partial<WorkflowRecord>;
}
