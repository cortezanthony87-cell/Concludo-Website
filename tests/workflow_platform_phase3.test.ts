import { describe, test, expect } from 'bun:test';
import { executeWorkflowArchitect } from '../app/src/lib/workflows/workflowArchitectAgent';
import { validateWorkflowDefinition } from '../app/src/lib/workflows/validation';
import { WorkflowExecutionEngine } from '../app/src/lib/workflows/executionEngine';
import { resolveTokenPath, evaluateRule } from '../app/src/lib/workflows/expressions';
import { WORKFLOW_TEMPLATES } from '../app/src/lib/workflows/templates';
import {
  TRIGGER_MANIFESTS,
  ACTION_MANIFESTS,
  CONNECTOR_MANIFESTS,
} from '../app/src/lib/workflows/connectorRegistry';

describe('Concludo Natural-Language Workflow Platform (Phase 2 & Phase 3)', () => {
  const engine = new WorkflowExecutionEngine();

  // Test 1: Registry Integrity & Extensibility
  test('Registry Integrity: Triggers, Actions, and Connectors are properly loaded', () => {
    expect(Object.keys(TRIGGER_MANIFESTS).length >= 18).toBe(true);
    expect(Object.keys(ACTION_MANIFESTS).length >= 25).toBe(true);
    expect(Object.keys(CONNECTOR_MANIFESTS).length >= 10).toBe(true);

    const hubspot = CONNECTOR_MANIFESTS['hubspot'];
    expect(hubspot).toBeDefined();
    expect((hubspot?.actions.length || 0) >= 5).toBe(true);

    const stripe = CONNECTOR_MANIFESTS['stripe'];
    expect(stripe).toBeDefined();

    const sheets = CONNECTOR_MANIFESTS['google_sheets'];
    expect(sheets).toBeDefined();
  });

  // Test 2: Safe Expression Engine (Deterministic, No Eval)
  test('Expression Engine: Deterministically evaluates paths, math, strings, and conditions', () => {
    const ctx = {
      trigger: { deal_amount: 50000, customer_name: 'Acme Corp', is_vip: true },
      steps: {
        step1: { output: { verified: true, score: 95 } },
      },
    };

    expect(resolveTokenPath('$trigger.deal_amount', ctx)).toBe(50000);
    expect(resolveTokenPath('$trigger.customer_name', ctx)).toBe('Acme Corp');

    expect(evaluateRule({ operator: 'greater_than', left: '$trigger.deal_amount', right: 10000 }, ctx)).toBe(true);
    expect(evaluateRule({ operator: 'equals', left: '$trigger.is_vip', right: true }, ctx)).toBe(true);
    expect(evaluateRule({ operator: 'contains', left: '$trigger.customer_name', right: 'Acme' }, ctx)).toBe(true);
    expect(evaluateRule({ operator: 'add', left: '$steps.step1.output.score', right: 5 }, ctx)).toBe(100);
  });

  // Test 3: Anti-Surveillance Gate ("Measure work, never people")
  test('Governance Gate: Strictly rejects employee ranking and surveillance prompts', async () => {
    const prohibitedPrompt = 'Create a workflow that ranks employees by closed ticket speed and gives a productivity score';
    let rejected = false;
    try {
      await executeWorkflowArchitect({
        userPrompt: prohibitedPrompt,
        organizationId: 'org_test_1',
        userId: 'user_1',
      });
    } catch (err: any) {
      rejected = true;
      expect(err.message).toContain('Concludo core policy strictly rejects');
    }
    expect(rejected).toBe(true);
  });

  // Test 4: Phase 2 Meeting Follow-through Canonical Slice
  test('Demonstration Slice 0: Meeting Follow-through executes, pauses for approval, and finishes upon sign-off', async () => {
    const architectResult = await executeWorkflowArchitect({
      userPrompt: 'When a meeting finishes, create a summary, extract actions, ask project owner for approval, and add to calendar',
      organizationId: 'org_test_1',
      userId: 'user_1',
    });

    expect(architectResult.buildStatus).toBe('complete');
    expect(architectResult.approvalsRequired.length).toBeGreaterThan(0);

    // 1. Live Run without immediate approval must PAUSE at approval gate
    const pausedRun = await engine.execute(architectResult.workflowDefinition, {
      meeting: { id: 'mtg_001', title: 'Q4 Strategy Review', projectId: 'proj_99' },
      transcript: 'Anthony: Deploy the Phase 3 platform by Friday.',
    });
    expect(pausedRun.status).toBe('waiting_for_approval');
    expect(pausedRun.waitingApprovalStepKey).toBe('approval_centre_review');

    // 2. Upon human approval in Approval Centre, execution completes
    const completedRun = await engine.execute(
      architectResult.workflowDefinition,
      {
        meeting: { id: 'mtg_002', title: 'Q4 Strategy Review', projectId: 'proj_99' },
        transcript: 'Anthony: Deploy the Phase 3 platform by Friday.',
      },
      { simulateImmediateApproval: true }
    );
    expect(completedRun.status).toBe('completed');
    expect(completedRun.stepResults['create_project_tasks']?.status).toBe('succeeded');
    expect(completedRun.stepResults['create_calendar_events']?.status).toBe('succeeded');
  });

  // Test 5: Phase 3 Demonstration Workflow 1 (HubSpot Deal Won to Client Onboarding)
  test('Demonstration Workflow 1: HubSpot Deal Won to Client Onboarding builds and runs', async () => {
    const architectResult = await executeWorkflowArchitect({
      userPrompt: 'When a HubSpot deal is marked won, create a draft onboarding project, ask owner to approve, and add milestones to Calendar',
      organizationId: 'org_test_1',
      userId: 'user_1',
      connectedApplications: ['hubspot'],
    });

    expect(architectResult.buildStatus).toBe('complete');
    expect(architectResult.workflowDefinition.workflowKey).toBe('hubspot-deal-won-onboarding');

    // Non-destructive Dry Run
    const dryRun = await engine.execute(
      architectResult.workflowDefinition,
      { dealId: 'deal_123', dealName: 'Enterprise Rollout', amount: 45000 },
      { isDryRun: true, simulateImmediateApproval: true }
    );

    expect(dryRun.status).toBe('completed');
    expect(dryRun.isDryRun).toBe(true);
    expect(dryRun.stepResults['create_live_project_and_tasks']?.output.projectId).toContain('dry_run_proj');
  });

  // Test 6: Phase 3 Demonstration Workflow 2 (Stripe Payment Failure Follow-up)
  test('Demonstration Workflow 2: Stripe Payment Failure Follow-up enforces grace period and approval', async () => {
    const architectResult = await executeWorkflowArchitect({
      userPrompt: 'When a Stripe invoice payment fails, notify finance, create follow-up task, wait 3 days, recheck, and draft customer email with approval',
      organizationId: 'org_test_1',
      userId: 'user_1',
      connectedApplications: ['stripe'],
    });

    expect(architectResult.buildStatus).toBe('complete');
    expect(architectResult.workflowDefinition.workflowKey).toBe('stripe-payment-failure-followup');

    const dryRun = await engine.execute(
      architectResult.workflowDefinition,
      { invoiceId: 'in_9988', customerId: 'cus_555', amountDue: 199 },
      { isDryRun: true, simulateImmediateApproval: true }
    );

    expect(dryRun.status).toBe('completed');
    expect(dryRun.stepResults['notify_finance_internally']?.status).toBe('succeeded');
    expect(dryRun.stepResults['approval_send_reminder']?.status).toBe('succeeded');
  });

  // Test 7: Phase 3 Demonstration Workflow 3 (Google Sheet to Project Task)
  test('Demonstration Workflow 3: Google Sheet to Project Task handles batch and write-back', async () => {
    const architectResult = await executeWorkflowArchitect({
      userPrompt: 'Every 15 minutes, check this Google Sheet for approved requests, create a project task for each row, and write task IDs back',
      organizationId: 'org_test_1',
      userId: 'user_1',
      connectedApplications: ['google_sheets'],
    });

    expect(architectResult.buildStatus).toBe('complete');
    expect(architectResult.workflowDefinition.workflowKey).toBe('google-sheet-to-project-tasks');

    const dryRun = await engine.execute(
      architectResult.workflowDefinition,
      { timestamp: '2026-10-02T00:00:00Z' },
      { isDryRun: true }
    );

    expect(dryRun.status).toBe('completed');
    expect(dryRun.stepResults['write_back_task_ids']?.status).toBe('succeeded');
  });

  // Test 8: Template Library Verification
  test('Template Library: Contains at least 20 initial enterprise templates', () => {
    expect(WORKFLOW_TEMPLATES.length >= 20).toBe(true);
    const onboarding = WORKFLOW_TEMPLATES.find((t) => t.templateKey === 'deal-won-client-onboarding');
    expect(onboarding).toBeDefined();
    expect(onboarding?.lockedGovernanceFields).toContain('approvalRequirement');
  });

  // Test 9: Resilience & Circuit Breaker on Repeated Failures
  test('Resilience Engine: Bounded retries and incident escalation upon persistent failure', async () => {
    const architectResult = await executeWorkflowArchitect({
      userPrompt: 'When a meeting finishes, create summary and add calendar events',
      organizationId: 'org_test_1',
      userId: 'user_1',
    });

    // Injected failure of 3 attempts on calendar step
    const failureRun = await engine.execute(
      architectResult.workflowDefinition,
      { meeting: { id: 'mtg_err_1', title: 'Error Test' }, transcript: 'Test error' },
      {
        simulateImmediateApproval: true,
        injectedTransientFailures: { create_calendar_events: 5 }, // exceeds maxAttempts=3
      }
    );

    expect(failureRun.status).toBe('failed');
    expect(failureRun.incidentCreated).toBe(true);
    expect(failureRun.stepResults['create_calendar_events']?.error).toContain('Exhausted');
  });
});
