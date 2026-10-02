/**
 * Concludo Natural-Language Workflow Builder Validation Engine
 * Conforms to Master Build Instruction Section 17 & Phase 3 Governance
 * Enforces graph integrity, reachability, anti-surveillance, and security policies.
 */

import { WorkflowDefinition } from './schemas';

export interface ValidationError {
  type: 'structure' | 'data' | 'governance' | 'security' | 'reliability';
  code: string;
  stepKey?: string;
  message: string;
  severity: 'error' | 'warning';
  userFacingSuggestion: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Prohibited surveillance and evaluation keywords (Strict Anti-Surveillance Gate)
const PROHIBITED_SURVEILLANCE_TERMS = [
  'employee ranking',
  'employee scorecard',
  'productivity score',
  'leaderboard',
  'staff ranking',
  'worker sentiment',
  'performance rating',
  'individual contribution index',
  'covert surveillance',
  'keystroke',
  'screen capture',
  'attendance penalty',
  'disciplinary score',
];

export function validateWorkflowDefinition(
  workflow: WorkflowDefinition,
  options?: {
    connectedApplications?: string[];
    enforceConnections?: boolean;
    serverPolicies?: Array<{ policyKey: string; configuration: any }>;
  }
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Anti-Surveillance / Human-centric Governance Check
  const combinedText = `${workflow.name} ${workflow.description} ${workflow.steps
    .map((s) => `${s.displayName} ${s.purpose} ${s.userFacingExplanation}`)
    .join(' ')}`.toLowerCase();

  for (const term of PROHIBITED_SURVEILLANCE_TERMS) {
    if (combinedText.includes(term)) {
      errors.push({
        type: 'governance',
        code: 'PROHIBITED_EMPLOYEE_EVALUATION',
        message: `Workflow violates Concludo core governance policy: 'Measure work, never people'. Detected term: '${term}'.`,
        severity: 'error',
        userFacingSuggestion:
          'Remove employee evaluation, individual ranking, or productivity scoring mechanisms. Focus automation on project, task, and operational outcomes.',
      });
    }
  }

  // 2. Trigger existence
  if (!workflow.trigger || !workflow.trigger.triggerKey) {
    errors.push({
      type: 'structure',
      code: 'MISSING_TRIGGER',
      message: 'Workflow must have a valid starting trigger defined.',
      severity: 'error',
      userFacingSuggestion: 'Add a starting trigger such as meeting completed, deal won, or webhook received.',
    });
  }

  // 3. Step reachability & graph structure
  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push({
      type: 'structure',
      code: 'NO_STEPS',
      message: 'Workflow does not contain any executable steps.',
      severity: 'error',
      userFacingSuggestion: 'Add at least one action or AI agent step to the workflow.',
    });
    return { isValid: errors.length === 0, errors, warnings };
  }

  const stepKeys = new Set(workflow.steps.map((s) => s.key));
  const incomingEdges = new Map<string, number>();
  const outgoingEdges = new Map<string, number>();

  stepKeys.forEach((key) => {
    incomingEdges.set(key, 0);
    outgoingEdges.set(key, 0);
  });

  workflow.edges.forEach((edge) => {
    if (!stepKeys.has(edge.sourceStepKey)) {
      errors.push({
        type: 'structure',
        code: 'INVALID_EDGE_SOURCE',
        message: `Edge references non-existent source step: '${edge.sourceStepKey}'.`,
        severity: 'error',
        userFacingSuggestion: 'Ensure edges point between existing steps.',
      });
    } else {
      outgoingEdges.set(edge.sourceStepKey, (outgoingEdges.get(edge.sourceStepKey) || 0) + 1);
    }

    if (!stepKeys.has(edge.destinationStepKey)) {
      errors.push({
        type: 'structure',
        code: 'INVALID_EDGE_DESTINATION',
        message: `Edge references non-existent destination step: '${edge.destinationStepKey}'.`,
        severity: 'error',
        userFacingSuggestion: 'Ensure edges point between existing steps.',
      });
    } else {
      incomingEdges.set(edge.destinationStepKey, (incomingEdges.get(edge.destinationStepKey) || 0) + 1);
    }
  });

  // The first step should have no incoming edge (or be the root entry point)
  const rootSteps = Array.from(stepKeys).filter((key) => (incomingEdges.get(key) || 0) === 0);
  if (rootSteps.length === 0 && workflow.steps.length > 0) {
    errors.push({
      type: 'structure',
      code: 'CIRCULAR_GRAPH',
      message: 'Graph contains cycles without a clear entry step.',
      severity: 'error',
      userFacingSuggestion: 'Ensure the first step is connected as the root starting point.',
    });
  }

  // 4. Governance & Human-in-the-Loop checks ("Concludo proposes; a person disposes")
  workflow.steps.forEach((step) => {
    // High-risk external actions requiring human approval
    const isHighImpactAction =
      step.stepType === 'approval' ||
      step.application === 'concludo_calendar' ||
      step.application === 'concludo_projects' ||
      step.application === 'hubspot' ||
      step.application === 'stripe' ||
      step.displayName.toLowerCase().includes('send external') ||
      step.displayName.toLowerCase().includes('delete') ||
      step.displayName.toLowerCase().includes('publish');

    if (
      isHighImpactAction &&
      step.stepType !== 'approval' &&
      step.stepType !== 'incident' &&
      !step.approvalRequirement?.required
    ) {
      // Check if an approval step precedes it
      const hasPriorApproval = workflow.steps.some(
        (s) => s.stepType === 'approval' && workflow.edges.some((e) => e.sourceStepKey === s.key)
      );

      if (!hasPriorApproval) {
        warnings.push({
          type: 'governance',
          code: 'UNGOVERNED_EXTERNAL_MUTATION',
          stepKey: step.key,
          message: `Step '${step.displayName}' modifies production records without prior human sign-off.`,
          severity: 'warning',
          userFacingSuggestion:
            'Add an Approval step before this action so a project or account owner can verify items before creation.',
        });
      }
    }

    // Reliability: Retries & Idempotency
    if (step.stepType === 'action' || step.stepType === 'ai_agent') {
      if (!step.retryPolicy || step.retryPolicy.maxAttempts <= 0) {
        warnings.push({
          type: 'reliability',
          code: 'UNBOUNDED_RETRY_POLICY',
          stepKey: step.key,
          message: `Step '${step.displayName}' does not have a bounded retry policy. Defaulting to 3 attempts.`,
          severity: 'warning',
          userFacingSuggestion: 'Configure a retry policy with maximum 3 attempts and exponential backoff.',
        });
      }

      if (step.retryPolicy && step.retryPolicy.maxAttempts > 5) {
        errors.push({
          type: 'reliability',
          code: 'EXCESSIVE_RETRIES',
          stepKey: step.key,
          message: `Step '${step.displayName}' specifies ${step.retryPolicy.maxAttempts} retries, exceeding platform limit of 5.`,
          severity: 'error',
          userFacingSuggestion: 'Set retry attempts to 3 or fewer.',
        });
      }
    }

    // Connection checks
    if (options?.enforceConnections && options.connectedApplications) {
      const isInternalService =
        step.application.startsWith('concludo_') ||
        step.application === 'logic' ||
        step.application === 'ai_agent' ||
        step.application === 'system';

      if (!isInternalService && !options.connectedApplications.includes(step.application)) {
        errors.push({
          type: 'security',
          code: 'CONNECTION_REQUIRED',
          stepKey: step.key,
          message: `Application '${step.application}' is not connected for this organisation.`,
          severity: 'error',
          userFacingSuggestion: `Connect ${step.application} in Connector Centre before publishing.`,
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
