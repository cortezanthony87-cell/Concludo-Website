export interface BuildEvent { id: string; type: string; timestamp: string; payload: any; message?: string; }
/**
 * Concludo Natural-Language Workflow Builder Schemas
 * Version: 1.0.0
 * Conforms to Master Build Instruction & Phase 3 Extensibility Specification
 */

export type WorkflowStatus =
  | 'draft'
  | 'submitted_for_review'
  | 'approved'
  | 'published'
  | 'paused'
  | 'deprecated'
  | 'archived';

export type StepRiskClassification = 'low' | 'medium' | 'high' | 'critical';

export type StepExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'waiting_for_approval'
  | 'succeeded'
  | 'skipped'
  | 'retrying'
  | 'failed'
  | 'cancelled'
  | 'compensated';

export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'waiting_for_approval'
  | 'delayed'
  | 'retrying'
  | 'partially_completed'
  | 'completed'
  | 'completed_no_action'
  | 'rejected'
  | 'failed'
  | 'cancelled'
  | 'manually_resolved'
  | 'outcome_uncertain';

export interface WorkflowVariable {
  key: string;
  name: string;
  type:
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'currency'
    | 'user'
    | 'project'
    | 'record_id'
    | 'list'
    | 'object';
  description?: string;
  defaultValue?: any;
  required?: boolean;
}

export interface WorkflowStep {
  name?: string;
  service?: string;
  position?: { x: number; y: number };
  key: string;
  displayName: string;
  stepType:
    | 'trigger'
    | 'action'
    | 'ai_agent'
    | 'approval'
    | 'logic'
    | 'branch'
    | 'merge'
    | 'loop'
    | 'wait'
    | 'sub_workflow'
    | 'incident';
  purpose: string;
  application: string; // e.g. 'concludo_meetings', 'hubspot', 'stripe', 'google_sheets'
  inputMapping: Record<string, any>;
  outputSchema: Record<string, any>;
  configuration: Record<string, any>;
  preconditions?: string[];
  dependencies?: string[];
  timeoutSeconds?: number;
  retryPolicy?: {
    maxAttempts: number;
    initialIntervalMs: number;
    backoffFactor: number;
  };
  idempotencyPolicy?: {
    enabled: boolean;
    keyTemplate: string;
  };
  approvalRequirement?: {
    required: boolean;
    approverRole?: string;
    approverId?: string;
    timeoutHours?: number;
    escalationRole?: string;
  };
  permissionRequirement?: string[];
  dataClassification?: 'public' | 'internal' | 'confidential' | 'personal' | 'sensitive' | 'secret';
  auditClassification?: 'standard' | 'compliance' | 'security';
  successPathStepKey?: string;
  failurePathStepKey?: string;
  compensationStepKey?: string;
  userFacingExplanation: string;
}

export interface WorkflowEdge {
  sourceStep?: string;
  destinationStep?: string;
  id: string;
  sourceStepKey: string;
  destinationStepKey: string;
  edgeType: 'success' | 'failure' | 'conditional' | 'approval_approved' | 'approval_rejected';
  branchLabel?: string;
  conditionReference?: string;
  displayOrder?: number;
}

export interface WorkflowLayoutNode {
  key: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface WorkflowDefinition {
  schemaVersion: 1;
  workflowKey: string;
  name: string;
  description: string;
  version: number;
  status: WorkflowStatus;
  organisationScope: {
    type: 'current_organisation';
    organizationId?: string;
  };
  owner: {
    type: 'role' | 'user';
    value: string;
  };
  timezone: string;
  riskLevel: StepRiskClassification;
  trigger: {
    triggerKey: string;
    displayName: string;
    sourceService: string;
    configuration: Record<string, any>;
  };
  inputs: Array<{ key: string; type: string; description: string; required: boolean }>;
  variables: WorkflowVariable[];
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  errorHandling: {
    maxConsecutiveFailures: number;
    incidentEscalationStepKey?: string;
    notifyOwnerOnFailure: boolean;
  };
  audit: {
    recordExecutionHistory: boolean;
    auditClassification: string;
  };
  monitoring: {
    alertChannel?: string;
  };
  rollback: {
    previousPublishedVersionId?: string;
    canRollback: boolean;
  };
  layout: {
    nodes: Record<string, WorkflowLayoutNode>;
  };
}

export interface WorkflowBuildEvent {
  id: string;
  type:
    | 'build.started'
    | 'request.interpreted'
    | 'assumption.added'
    | 'question.required'
    | 'trigger.selected'
    | 'connection.required'
    | 'node.added'
    | 'node.updated'
    | 'node.removed'
    | 'edge.added'
    | 'edge.removed'
    | 'approval.added'
    | 'failure_path.added'
    | 'validation.started'
    | 'validation.warning'
    | 'validation.failed'
    | 'validation.completed'
    | 'tests.generated'
    | 'build.completed'
    | 'build.failed'
    | 'build.cancelled';
  timestamp: string;
  payload: Record<string, any>;
}

export interface WorkflowArchitectOutput {
  schemaVersion: 1;
  buildStatus: 'complete' | 'needs_clarification' | 'failed';
  workflowDefinition: WorkflowDefinition;
  plainLanguageExplanation: string[];
  assumptions: string[];
  questions: string[];
  connectionsRequired: string[];
  approvalsRequired: string[];
  validationWarnings: string[];
  testsProposed: string[];
  limitations: string[];
  buildEvents: WorkflowBuildEvent[];
}

// Backward-compatible aliases for Phase 4 governance and policy engines
export type WorkflowDefinitionV1 = WorkflowDefinition;
export type WorkflowStepNode = WorkflowStep;
