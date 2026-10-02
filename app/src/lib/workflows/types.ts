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

export type WorkflowRiskLevel = 'low' | 'medium' | 'high' | 'restricted';

export type WorkflowStatus =
  | 'draft'
  | 'submitted_for_review'
  | 'approved'
  | 'published'
  | 'paused'
  | 'degraded'
  | 'failed'
  | 'deprecated'
  | 'archived';

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
  status?: WorkflowStatus;
  risk_level?: WorkflowRiskLevel;
  risk_reasons?: string[];
  risk_override_by?: string | null;
  test_status?: 'untested' | 'passed' | 'stale' | 'failed';
  is_emergency_stopped?: boolean;
  emergency_stopped_at?: string | null;
  emergency_stopped_by?: string | null;
  emergency_stop_reason?: string | null;
  current_version?: number;
  definition_json?: Record<string, any>;
  graph_data?: Record<string, any>;
  published_version_id?: string | null;
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
  | 'cancelled'
  | 'outcome_uncertain'
  | 'emergency_stopped';

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

// Phase 4 Governance, Risk, Policies, and Hardening Types

export type PolicyEvaluationResult =
  | 'ALLOW'
  | 'ALLOW_WITH_APPROVAL'
  | 'REQUIRE_CONFIGURATION'
  | 'DENY';

export interface WorkflowPolicyRule {
  policyKey: string;
  policyName: string;
  description: string;
  isEnabled: boolean;
  rules: Record<string, any>;
}

export interface PolicyEvaluationOutput {
  status: PolicyEvaluationResult;
  violations: string[];
  warnings: string[];
  plainLanguageSummary: string;
  requiredApprovals: string[];
}

export type WorkflowIncidentSeverity = 'SEV_1' | 'SEV_2' | 'SEV_3' | 'SEV_4';

export type WorkflowIncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'investigating'
  | 'contained'
  | 'resolved'
  | 'closed';

export interface WorkflowIncidentRecord {
  id: string;
  incidentNumber?: number;
  organizationId: string;
  workflowId: string;
  workflowName?: string;
  versionNumber?: number;
  runId?: string | null;
  connector?: string | null;
  stepKey: string;
  severity: WorkflowIncidentSeverity;
  status: WorkflowIncidentStatus;
  summary: string;
  technicalClassification: string;
  customerSafeExplanation: string;
  errorMessage: string;
  dataAffected?: string[];
  objectsAffected?: string[];
  containmentStatus?: 'none' | 'contained' | 'monitoring' | 'resolved';
  ownerId?: string | null;
  timeline?: { timestamp: string; note: string; actor: string }[];
  rootCause?: string | null;
  preventiveAction?: string | null;
  resolutionNotes?: string | null;
  firstDetected: string;
  lastDetected: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export type WorkflowAuditEventType =
  | 'workflow_created'
  | 'workflow_changed'
  | 'validation_performed'
  | 'test_performed'
  | 'dry_run_performed'
  | 'submitted_for_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'paused'
  | 'resumed'
  | 'rolled_back'
  | 'connection_added'
  | 'connection_tested'
  | 'connection_revoked'
  | 'approval_issued'
  | 'approval_completed'
  | 'run_started'
  | 'step_started'
  | 'step_retried'
  | 'step_succeeded'
  | 'step_failed'
  | 'incident_created'
  | 'incident_acknowledged'
  | 'incident_resolved'
  | 'policy_changed'
  | 'emergency_stop_invoked'
  | 'emergency_stop_released'
  | 'dead_letter_captured';

export interface WorkflowAuditEvent {
  id?: string;
  organizationId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  eventType: WorkflowAuditEventType;
  objectType: string;
  objectId: string;
  objectVersion?: number | null;
  requestId?: string | null;
  runId?: string | null;
  workflowId?: string | null;
  stepKey?: string | null;
  policyResult?: string | null;
  source?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'WARNING' | 'DENIED';
  metadata?: Record<string, any>;
  createdAt?: string;
}

export type ErrorTaxonomyCategory =
  | 'VALIDATION_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'CONNECTION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'TRANSIENT_PROVIDER_ERROR'
  | 'PERMANENT_PROVIDER_ERROR'
  | 'TIMEOUT_ERROR'
  | 'POLICY_ERROR'
  | 'APPROVAL_ERROR'
  | 'DATA_MAPPING_ERROR'
  | 'DUPLICATE_EVENT'
  | 'OUTCOME_UNCERTAIN'
  | 'INTERNAL_ERROR';

export interface NormalizedError {
  category: ErrorTaxonomyCategory;
  isRetryable: boolean;
  plainLanguage: string;
  technicalDetails: string;
  code: string;
  reconciliationRequired?: boolean;
}

export interface WorkflowProvenanceRecord {
  id?: string;
  organizationId: string;
  resourceType: string;
  resourceId: string;
  sourceType: 'meeting_transcript' | 'document' | 'crm_deal' | 'webhook_payload' | 'manual_input';
  sourceId: string;
  sourceLocation?: string | null;
  workflowId: string;
  workflowVersion: number;
  runId?: string | null;
  agentId?: string | null;
  createdAt?: string;
}

export interface WorkflowPublishChecklist {
  isValidDefinition: boolean;
  hasAssignedOwner: boolean;
  areConnectionsHealthy: boolean;
  arePermissionsValid: boolean;
  arePoliciesSatisfied: boolean;
  areRequiredApprovalsPresent: boolean;
  isTestCurrent: boolean;
  isDryRunCurrent: boolean;
  hasNoBlockingIncidents: boolean;
  hasNoUncertainOutcomes: boolean;
  isRollbackAvailable: boolean;
  readyToPublish: boolean;
  blockingReasons: string[];
}
