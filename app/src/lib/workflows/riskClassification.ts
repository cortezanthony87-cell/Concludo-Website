import { WorkflowDefinitionV1, WorkflowStepNode } from './schemas';
import { WorkflowRiskLevel } from './types';

export interface RiskAnalysisResult {
  calculatedRisk: WorkflowRiskLevel;
  effectiveRisk: WorkflowRiskLevel;
  riskReasons: string[];
  requiresPublicationApproval: boolean;
  requiresRuntimeApproval: boolean;
  auditDepth: 'standard' | 'enhanced' | 'strict';
  maxAllowedBatchSize: number;
}

const RESTRICTED_ACTIONS = new Set([
  'delete_record',
  'delete_project',
  'delete_task',
  'refund_payment',
  'create_charge',
  'revoke_access',
  'modify_permissions',
  'bulk_delete',
]);

const HIGH_RISK_ACTIONS = new Set([
  'send_slack_message',
  'send_teams_message',
  'send_outlook_message',
  'send_external_email',
  'send_completion_notification',
  'create_calendar_event',
  'create_calendar_events',
  'update_calendar_event',
  'update_calendar_events',
  'create_crm_deal',
  'update_crm_deal',
  'create_crm_contact',
  'update_crm_contact',
  'custom_api_mutation',
  'publish_content',
  'escalate_incident',
]);

const MEDIUM_RISK_ACTIONS = new Set([
  'create_tasks',
  'create_planner_task',
  'create_todo_task',
  'create_project_draft',
  'create_notion_page',
  'update_task_status',
  'append_sheet_row',
]);

/**
 * Calculates the automated risk classification for a workflow definition.
 */
export function calculateWorkflowRisk(
  workflow: any,
  userOverrideRisk?: WorkflowRiskLevel | null,
  isAdmin: boolean = false
): RiskAnalysisResult {
  const reasons: string[] = [];
  let calculatedRisk: WorkflowRiskLevel = 'low';

  const nodes: any[] = workflow.steps || workflow.nodes || [];

  for (const node of nodes) {
    const actionType = node.actionType || node.type || node.stepType || node.key || '';
    const connector = node.connector || node.application || node.service || '';
    const config = node.config || node.configuration || {};

    // Check for RESTRICTED actions
    if (RESTRICTED_ACTIONS.has(actionType) || config.isDestructive || config.isFinancialMovement) {
      calculatedRisk = 'restricted';
      reasons.push(`Contains restricted action '${actionType}' or financial/deletion operation.`);
    }

    // Mass operation batch limits are governed strictly by organizational policy engine ceilings

    // Check for HIGH risk actions
    if (calculatedRisk !== 'restricted') {
      if (HIGH_RISK_ACTIONS.has(actionType)) {
        calculatedRisk = 'high';
        reasons.push(`Contains high-impact external action '${actionType}' on connector '${connector}'.`);
      } else if (connector === 'slack' || connector === 'teams' || connector === 'outlook') {
        calculatedRisk = 'high';
        reasons.push(`Communicates externally via connector '${connector}'.`);
      } else if (connector === 'calendar' || connector === 'concludo_calendar') {
        calculatedRisk = 'high';
        reasons.push(`Interacts directly with Calendar schedules or attendee invitations.`);
      } else if (connector === 'hubspot' && actionType.includes('update')) {
        calculatedRisk = 'high';
        reasons.push(`Modifies live CRM customer records in HubSpot.`);
      } else if ((connector === 'slack' || connector === 'teams' || connector === 'outlook' || connector === 'hubspot') && config.batchSize && config.batchSize > 10) {
        calculatedRisk = 'high';
        reasons.push(`Performs bulk processing with batch size ${config.batchSize} (> 10).`);
      }
    }

    // Check for MEDIUM risk actions
    if (calculatedRisk === 'low') {
      if (MEDIUM_RISK_ACTIONS.has(actionType)) {
        calculatedRisk = 'medium';
        reasons.push(`Creates or updates internal records/tasks via '${actionType}'.`);
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push('Workflow comprises purely internal, read-only or drafting operations.');
  }

  // Risk floor rule: Users cannot downgrade below calculatedRisk without admin override
  const riskRank: Record<WorkflowRiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    restricted: 4,
  };

  let effectiveRisk = calculatedRisk;
  if (userOverrideRisk) {
    if (riskRank[userOverrideRisk] >= riskRank[calculatedRisk]) {
      effectiveRisk = userOverrideRisk;
      reasons.push(`Risk upgraded by administrator to '${userOverrideRisk}'.`);
    } else if (isAdmin) {
      effectiveRisk = userOverrideRisk;
      reasons.push(`Risk downgraded to '${userOverrideRisk}' under authorized administrative override.`);
    } else {
      reasons.push(`Attempted downgrade to '${userOverrideRisk}' was rejected; minimum calculated risk '${calculatedRisk}' enforced.`);
    }
  }

  const isHighOrRestricted = effectiveRisk === 'high' || effectiveRisk === 'restricted';

  return {
    calculatedRisk,
    effectiveRisk,
    riskReasons: reasons,
    requiresPublicationApproval: isHighOrRestricted,
    requiresRuntimeApproval: isHighOrRestricted,
    auditDepth: effectiveRisk === 'restricted' ? 'strict' : effectiveRisk === 'high' ? 'enhanced' : 'standard',
    maxAllowedBatchSize: effectiveRisk === 'restricted' ? 10 : effectiveRisk === 'high' ? 50 : 100,
  };
}
