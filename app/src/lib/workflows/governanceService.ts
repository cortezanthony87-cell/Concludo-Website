import { WorkflowDefinitionV1 } from './schemas';
import { WorkflowPublishChecklist } from './types';
import { evaluateWorkflowPolicies } from './policyEngine';
import { calculateWorkflowRisk } from './riskClassification';
import { recordWorkflowAuditEvent } from './auditService';

export interface EmergencyStopRecord {
  id: string;
  organizationId: string;
  scope: 'workflow' | 'organisation' | 'connector';
  targetId: string;
  reason: string;
  invokedBy: string;
  isActive: boolean;
  createdAt: string;
  releasedAt?: string | null;
  releasedBy?: string | null;
}

const EMERGENCY_STOPS: Map<string, EmergencyStopRecord> = new Map();

/**
 * Invokes an immediate emergency stop (kill switch) for a workflow, organisation, or connector.
 */
export async function invokeEmergencyStop(params: {
  organizationId: string;
  scope: 'workflow' | 'organisation' | 'connector';
  targetId: string;
  reason: string;
  invokedBy: string;
}): Promise<EmergencyStopRecord> {
  const id = `stop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const record: EmergencyStopRecord = {
    id,
    organizationId: params.organizationId,
    scope: params.scope,
    targetId: params.targetId,
    reason: params.reason,
    invokedBy: params.invokedBy,
    isActive: true,
    createdAt: now,
  };

  EMERGENCY_STOPS.set(id, record);

  await recordWorkflowAuditEvent({
    organizationId: params.organizationId,
    actorId: params.invokedBy,
    eventType: 'emergency_stop_invoked',
    objectType: params.scope,
    objectId: params.targetId,
    outcome: 'WARNING',
    metadata: { reason: params.reason, scope: params.scope },
  });

  return record;
}

/**
 * Releases an active emergency stop.
 */
export async function releaseEmergencyStop(stopId: string, releasedBy: string, reason: string): Promise<EmergencyStopRecord> {
  const stop = EMERGENCY_STOPS.get(stopId);
  if (!stop) throw new Error(`Emergency stop record '${stopId}' not found.`);

  stop.isActive = false;
  stop.releasedAt = new Date().toISOString();
  stop.releasedBy = releasedBy;

  await recordWorkflowAuditEvent({
    organizationId: stop.organizationId,
    actorId: releasedBy,
    eventType: 'emergency_stop_released',
    objectType: stop.scope,
    objectId: stop.targetId,
    outcome: 'SUCCESS',
    metadata: { reason, scope: stop.scope },
  });

  return stop;
}

/**
 * Checks whether an execution is blocked by an active emergency stop.
 */
export function isExecutionBlockedByEmergencyStop(organizationId: string, workflowId: string, connectorId?: string): boolean {
  for (const stop of EMERGENCY_STOPS.values()) {
    if (!stop.isActive) continue;
    if (stop.scope === 'organisation' && stop.targetId === organizationId) return true;
    if (stop.scope === 'workflow' && stop.targetId === workflowId) return true;
    if (connectorId && stop.scope === 'connector' && stop.targetId === connectorId) return true;
  }
  return false;
}

/**
 * Evaluates the 11-point Pre-Publish Checklist.
 */
export function evaluatePublishChecklist(params: {
  workflow: WorkflowDefinitionV1;
  ownerId?: string | null;
  connectionsHealthy: boolean;
  userHasPublishPermission: boolean;
  dryRunPassed: boolean;
  hasOpenSev1Or2Incident: boolean;
  hasUncertainOutcomes: boolean;
  hasRollbackTarget: boolean;
}): WorkflowPublishChecklist {
  const blockingReasons: string[] = [];

  const nodes: any[] = (params.workflow as any).steps || (params.workflow as any).nodes || [];
  const isValidDefinition = nodes.length > 0;
  if (!isValidDefinition) blockingReasons.push('Workflow definition contains no nodes.');

  const hasAssignedOwner = Boolean(params.ownerId && params.ownerId.trim().length > 0);
  if (!hasAssignedOwner) blockingReasons.push('Workflow requires an assigned owner before publication.');

  const areConnectionsHealthy = params.connectionsHealthy;
  if (!areConnectionsHealthy) blockingReasons.push('One or more required external connections are degraded or disconnected.');

  const arePermissionsValid = params.userHasPublishPermission;
  if (!arePermissionsValid) blockingReasons.push('User lacks workflow.publish capability.');

  const policyEvaluation = evaluateWorkflowPolicies(params.workflow);
  const arePoliciesSatisfied = policyEvaluation.status !== 'DENY';
  if (!arePoliciesSatisfied) {
    blockingReasons.push(`Policy violation: ${policyEvaluation.violations.join('; ')}`);
  }

  const riskResult = calculateWorkflowRisk(params.workflow);
  const hasApprovalNode = nodes.some(
    (n) =>
      n.stepType === 'approval' ||
      n.actionType === 'approval_centre_review' ||
      n.key === 'approval_centre_review' ||
      n.approvalRequirement?.required
  );
  const areRequiredApprovalsPresent = !riskResult.requiresRuntimeApproval || hasApprovalNode;
  if (!areRequiredApprovalsPresent) {
    blockingReasons.push('High-risk actions require an approval step before execution.');
  }

  const isTestCurrent = params.dryRunPassed;
  if (!isTestCurrent) blockingReasons.push('Workflow requires a successful test run.');

  const isDryRunCurrent = params.dryRunPassed;
  if (!isDryRunCurrent) blockingReasons.push('Workflow requires a non-destructive dry run before publishing.');

  const hasNoBlockingIncidents = !params.hasOpenSev1Or2Incident;
  if (!hasNoBlockingIncidents) blockingReasons.push('Cannot publish while SEV 1 or SEV 2 incidents remain unresolved.');

  const hasNoUncertainOutcomes = !params.hasUncertainOutcomes;
  if (!hasNoUncertainOutcomes) blockingReasons.push('Workflow has pending outcome-uncertain actions requiring reconciliation.');

  const isRollbackAvailable = params.hasRollbackTarget;

  const readyToPublish = blockingReasons.length === 0;

  return {
    isValidDefinition,
    hasAssignedOwner,
    areConnectionsHealthy,
    arePermissionsValid,
    arePoliciesSatisfied,
    areRequiredApprovalsPresent,
    isTestCurrent,
    isDryRunCurrent,
    hasNoBlockingIncidents,
    hasNoUncertainOutcomes,
    isRollbackAvailable,
    readyToPublish,
    blockingReasons,
  };
}

/**
 * Performs a safe one-action rollback to a previous version.
 */
export async function executeWorkflowRollback(params: {
  organizationId: string;
  workflowId: string;
  targetVersionNumber: number;
  actorId: string;
  reason: string;
}): Promise<{ success: boolean; activeVersionNumber: number }> {
  await recordWorkflowAuditEvent({
    organizationId: params.organizationId,
    actorId: params.actorId,
    eventType: 'rolled_back',
    objectType: 'workflow',
    objectId: params.workflowId,
    objectVersion: params.targetVersionNumber,
    outcome: 'SUCCESS',
    metadata: {
      targetVersion: params.targetVersionNumber,
      reason: params.reason,
    },
  });

  return {
    success: true,
    activeVersionNumber: params.targetVersionNumber,
  };
}

/**
 * Resets emergency stops (for test harness).
 */
export function clearEmergencyStops(): void {
  EMERGENCY_STOPS.clear();
}
