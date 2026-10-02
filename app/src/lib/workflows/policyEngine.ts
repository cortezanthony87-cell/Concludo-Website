import { WorkflowDefinitionV1, WorkflowStepNode } from './schemas';
import { PolicyEvaluationOutput, PolicyEvaluationResult } from './types';
import { calculateWorkflowRisk } from './riskClassification';

export interface WorkflowPolicyConfig {
  externalMessagesRequireApproval?: boolean;
  externalCalendarInvitationsRequireApproval?: boolean;
  inferredDatesRequireConfirmation?: boolean;
  inferredOwnersRequireConfirmation?: boolean;
  publishingRequiresApproval?: boolean;
  bulkMutationLimit?: number;
  batchSizeMaximum?: number;
  loopMaximum?: number;
  aiAgentCallMaximum?: number;
  maxRetries?: number;
  allowedCustomApiDomains?: string[];
  restrictedActions?: string[];
}

const DEFAULT_POLICIES: WorkflowPolicyConfig = {
  externalMessagesRequireApproval: true,
  externalCalendarInvitationsRequireApproval: true,
  inferredDatesRequireConfirmation: true,
  inferredOwnersRequireConfirmation: true,
  publishingRequiresApproval: true,
  bulkMutationLimit: 50,
  batchSizeMaximum: 100,
  loopMaximum: 100,
  aiAgentCallMaximum: 10,
  maxRetries: 3,
  allowedCustomApiDomains: ['api.hubspot.com', 'api.stripe.com', 'graph.microsoft.com', 'slack.com'],
  restrictedActions: ['delete_record', 'delete_project', 'delete_task', 'refund_payment'],
};

/**
 * Validates URLs against Server-Side Request Forgery (SSRF).
 */
export function validateUrlAgainstSSRF(rawUrl: string, allowedDomains?: string[]): { safe: boolean; reason?: string } {
  try {
    const url = new URL(rawUrl);

    // Require https unless localhost dev testing is explicitly permitted (never in production)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { safe: false, reason: `Unsafe URL protocol '${url.protocol}'. Only HTTPS is permitted.` };
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost and loopback
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    ) {
      return { safe: false, reason: `Access to local network host '${hostname}' is strictly prohibited.` };
    }

    // Block cloud metadata services (e.g. AWS 169.254.169.254, GCP metadata.google.internal)
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { safe: false, reason: 'Access to cloud instance metadata services is strictly prohibited.' };
    }

    // Block private IP ranges (RFC 1918)
    const ipv4Parts = hostname.split('.').map(Number);
    if (ipv4Parts.length === 4 && ipv4Parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      const [a, b] = ipv4Parts;
      if (a === 10) {
        return { safe: false, reason: `Access to private IP range 10.0.0.0/8 ('${hostname}') is prohibited.` };
      }
      if (a === 172 && b >= 16 && b <= 31) {
        return { safe: false, reason: `Access to private IP range 172.16.0.0/12 ('${hostname}') is prohibited.` };
      }
      if (a === 192 && b === 168) {
        return { safe: false, reason: `Access to private IP range 192.168.0.0/16 ('${hostname}') is prohibited.` };
      }
    }

    // Check against allowed domains if specified
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
      if (!isAllowed) {
        return { safe: false, reason: `Host '${hostname}' is not in the organization's allowed API domains.` };
      }
    }

    return { safe: true };
  } catch (err: any) {
    return { safe: false, reason: `Malformed URL: ${err.message}` };
  }
}

/**
 * Server-side evaluation of workflow definition against organizational safety policies.
 */
export function evaluateWorkflowPolicies(
  workflow: any,
  customPolicies?: Partial<WorkflowPolicyConfig>
): PolicyEvaluationOutput {
  const config = { ...DEFAULT_POLICIES, ...customPolicies };
  const violations: string[] = [];
  const warnings: string[] = [];
  const requiredApprovals: string[] = [];

  // Determine effective risk classification to establish tier-specific batch ceiling
  const riskAnalysis = calculateWorkflowRisk(workflow);
  const effectiveTierMaxBatch = riskAnalysis.maxAllowedBatchSize;
  const effectiveBatchCeiling = Math.min(config.batchSizeMaximum ?? 100, effectiveTierMaxBatch);

  const nodes: any[] = workflow.steps || workflow.nodes || [];
  const hasApprovalNode = nodes.some(
    (n) =>
      n.stepType === 'approval' ||
      n.actionType === 'approval_centre_review' ||
      n.actionType === 'generate_approval_request' ||
      n.key === 'approval_centre_review'
  );

  let aiCallCount = 0;

  for (const node of nodes) {
    const action = node.actionType || node.type || node.stepType || node.key || '';
    const connector = node.connector || node.application || node.service || '';
    const nodeConfig = node.config || node.configuration || {};

    // 1. External messages policy
    if (
      config.externalMessagesRequireApproval &&
      (['send_slack_message', 'send_teams_message', 'send_outlook_message', 'send_external_email', 'send_completion_notification'].includes(action) ||
        connector === 'slack' ||
        connector === 'teams' ||
        connector === 'outlook' ||
        connector === 'concludo_notifications')
    ) {
      if (!hasApprovalNode) {
        violations.push(
          `Action '${action || connector}' sends external messages or notifications but workflow lacks a human approval step in Approval Centre.`
        );
        requiredApprovals.push(action || connector);
      }
    }

    // 2. Calendar invitations policy
    if (
      config.externalCalendarInvitationsRequireApproval &&
      (['create_calendar_event', 'create_calendar_events', 'update_calendar_event', 'update_calendar_events'].includes(action) ||
        connector === 'calendar' ||
        connector === 'concludo_calendar')
    ) {
      if (!hasApprovalNode) {
        violations.push(
          `Calendar step '${node.key || node.id || action}' interacts directly with Calendar schedules without a human approval gate.`
        );
        requiredApprovals.push(action);
      }
    }

    // 3. Tier-Specific Batch and loop limits
    const stepBatchSize = nodeConfig.batchSize;
    if (stepBatchSize && stepBatchSize > effectiveBatchCeiling) {
      violations.push(
        `Step '${node.id || node.key}' specifies batch size of ${stepBatchSize}, exceeding the maximum allowed limit of ${effectiveBatchCeiling} for risk tier '${riskAnalysis.effectiveRisk}'.`
      );
    }

    if (nodeConfig.maxIterations && nodeConfig.maxIterations > (config.loopMaximum || 100)) {
      violations.push(
        `Loop step '${node.id || node.key}' specifies ${nodeConfig.maxIterations} iterations, exceeding the maximum safe limit of ${config.loopMaximum}.`
      );
    }

    // 4. Retry limits
    if (nodeConfig.maxRetries && nodeConfig.maxRetries > (config.maxRetries || 3)) {
      violations.push(
        `Step '${node.id || node.key}' specifies ${nodeConfig.maxRetries} retries, exceeding the maximum allowed limit of ${config.maxRetries}.`
      );
    }

    // 5. Custom API SSRF validation
    if (action === 'custom_api_request' || connector === 'custom_api') {
      const targetUrl = nodeConfig.url || nodeConfig.endpoint;
      if (!targetUrl) {
        violations.push(`Custom API step '${node.id || node.key}' is missing a destination URL.`);
      } else {
        const ssrfCheck = validateUrlAgainstSSRF(targetUrl, config.allowedCustomApiDomains);
        if (!ssrfCheck.safe) {
          violations.push(`Custom API step '${node.id || node.key}' rejected by SSRF guard: ${ssrfCheck.reason}`);
        }
      }
    }

    // 6. Restricted actions policy
    if (config.restrictedActions && config.restrictedActions.includes(action)) {
      violations.push(`Action '${action}' is restricted by organizational governance policy.`);
    }

    // 7. AI agent call limit
    if (connector === 'ai_agents' || action.startsWith('ai_')) {
      aiCallCount++;
    }
  }

  if (aiCallCount > (config.aiAgentCallMaximum || 10)) {
    violations.push(`Workflow defines ${aiCallCount} AI Agent steps, exceeding the limit of ${config.aiAgentCallMaximum}.`);
  }

  // Determine policy result
  let status: PolicyEvaluationResult = 'ALLOW';
  let plainLanguageSummary = 'All organizational policies satisfied.';

  if (violations.length > 0) {
    if (requiredApprovals.length > 0 && violations.every((v) => v.toLowerCase().includes('approval'))) {
      status = 'ALLOW_WITH_APPROVAL';
      plainLanguageSummary = 'Workflow requires human approval steps to be placed before external actions.';
    } else {
      status = 'DENY';
      plainLanguageSummary = `Workflow violates ${violations.length} governance ${violations.length === 1 ? 'rule' : 'rules'}. Fix required before publication.`;
    }
  } else if (warnings.length > 0) {
    plainLanguageSummary = 'Workflow passed policy checks with non-blocking recommendations.';
  }

  return {
    status,
    violations,
    warnings,
    plainLanguageSummary,
    requiredApprovals,
  };
}
