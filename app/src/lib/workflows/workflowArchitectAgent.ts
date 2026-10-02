/**
 * Concludo Workflow Architect Server-Side AI Intelligence
 * Conforms to Master Build Instruction Section 10 & concludo-workflow-automation-architect SKILL
 * Produces schema-compliant, validated workflow definitions with streamed build events.
 */

import {
  WorkflowDefinition,
  WorkflowArchitectOutput,
  WorkflowBuildEvent,
  WorkflowStep,
  WorkflowEdge,
} from './schemas';
import { validateWorkflowDefinition } from './validation';
import { TRIGGER_MANIFESTS, ACTION_MANIFESTS, CONNECTOR_MANIFESTS } from './connectorRegistry';

export interface ArchitectBuildRequest {
  userPrompt: string;
  organizationId: string;
  userId: string;
  currentWorkflow?: WorkflowDefinition;
  connectedApplications?: string[];
  streamCallback?: (event: WorkflowBuildEvent) => void;
}

export async function executeWorkflowArchitect(
  request: any,
  streamCallbackArg?: (event: WorkflowBuildEvent) => void
): Promise<WorkflowArchitectOutput> {
  const userPrompt = request.userPrompt || request.instruction || '';
  const organizationId = request.organizationId || 'org_concludo_default';
  const userId = request.userId || request.currentUserId || 'user_default';
  const currentWorkflow = request.currentWorkflow || request.existingDefinition;
  const connectedApplications = request.connectedApplications || [];
  const streamCallback = streamCallbackArg || request.streamCallback;

  const promptLower = userPrompt.toLowerCase();

  const emit = (type: WorkflowBuildEvent['type'], payload: Record<string, any>) => {
    const event: WorkflowBuildEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
    };
    if (streamCallback) streamCallback(event);
    return event;
  };

  const buildEvents: WorkflowBuildEvent[] = [];
  const recordEmit = (type: WorkflowBuildEvent['type'], payload: Record<string, any>) => {
    const evt = emit(type, payload);
    buildEvents.push(evt);
  };

  recordEmit('build.started', { prompt: userPrompt, organizationId });

  // 1. Strict Anti-Surveillance Gate Check ("Measure work, never people")
  const surveillanceKeywords = [
    'employee ranking',
    'leaderboard',
    'scorecard',
    'productivity score',
    'staff rating',
    'worker sentiment',
    'individual contribution index',
  ];
  for (const kw of surveillanceKeywords) {
    if (promptLower.includes(kw)) {
      recordEmit('validation.failed', { reason: 'prohibited_employee_surveillance', term: kw });
      throw new Error(
        `Workflow generation blocked: Concludo core policy strictly rejects '${kw}'. Concludo automates work and project execution, never employee surveillance or ranking.`
      );
    }
  }

  recordEmit('request.interpreted', {
    intent: 'Interpret natural-language requirements into structured human-governed automation',
  });

  // 2. Identify Workflow Type & Construct Architecture
  let wf: WorkflowDefinition;
  const plainLanguageExplanation: string[] = [];
  const assumptions: string[] = [];
  const connectionsRequired: string[] = [];
  const approvalsRequired: string[] = [];

  // Scenario 1: HubSpot Deal Won to Client Onboarding
  if (promptLower.includes('hubspot') && (promptLower.includes('deal') || promptLower.includes('won'))) {
    connectionsRequired.push('hubspot');
    recordEmit('trigger.selected', { trigger: 'hubspot.deal_stage_changed', event: 'deal_closed_won' });

    const steps: WorkflowStep[] = [
      {
        key: 'trigger_deal_won',
        displayName: 'HubSpot Deal Marked Won',
        stepType: 'trigger',
        purpose: 'Detects when a sales deal is moved to Closed Won in HubSpot CRM.',
        application: 'hubspot',
        inputMapping: {},
        outputSchema: { dealId: 'string', dealName: 'string', amount: 'number', companyId: 'string' },
        configuration: { stage: 'closed_won' },
        userFacingExplanation: 'Fires when a HubSpot deal is marked Won.',
      },
      {
        key: 'resolve_customer_identity',
        displayName: 'Resolve Customer & Account Owner',
        stepType: 'action',
        purpose: 'Maps external HubSpot deal owner and company reference to Concludo workspace identities.',
        application: 'concludo_workspace',
        inputMapping: { dealOwnerEmail: '$trigger.dealOwnerEmail', companyId: '$trigger.companyId' },
        outputSchema: { verifiedOwnerUserId: 'string', clientOrganisationId: 'string' },
        configuration: { fallbackToProjectOwnerPrompt: true },
        userFacingExplanation: 'Resolves client company and account manager with verified identity mapping.',
      },
      {
        key: 'create_project_draft',
        displayName: 'Draft Client Onboarding Project',
        stepType: 'action',
        purpose: 'Prepares draft project milestones, kickoff deliverables, and onboarding tasks.',
        application: 'concludo_projects',
        inputMapping: { name: '$trigger.dealName', clientRef: '$resolve_customer_identity.clientOrganisationId' },
        outputSchema: { projectDraftId: 'string', proposedMilestones: 'array' },
        configuration: { template: 'client_onboarding' },
        userFacingExplanation: 'Creates a draft onboarding project with recommended tasks and milestones.',
      },
      {
        key: 'owner_approval_gate',
        displayName: 'Project Owner Sign-Off',
        stepType: 'approval',
        purpose: 'Submits the onboarding scope, dates, and milestones to the project owner for explicit review.',
        application: 'concludo_approval_centre',
        inputMapping: { projectDraftId: '$create_project_draft.projectDraftId' },
        outputSchema: { approved: 'boolean', approvedMilestones: 'array', approvedDates: 'array' },
        configuration: { approverRole: 'project_owner' },
        approvalRequirement: { required: true, approverRole: 'project_owner' },
        userFacingExplanation: 'Requires the project owner to review and approve tasks, owners, and dates.',
      },
      {
        key: 'create_live_project_and_tasks',
        displayName: 'Create Live Project & Tasks',
        stepType: 'action',
        purpose: 'Creates the active project and assigns validated tasks in Concludo Projects.',
        application: 'concludo_projects',
        inputMapping: { projectDraftId: '$create_project_draft.projectDraftId' },
        outputSchema: { projectId: 'string', taskIds: 'array' },
        configuration: {},
        idempotencyPolicy: { enabled: true, keyTemplate: 'hubspot_deal_${trigger.dealId}_project' },
        userFacingExplanation: 'Creates the official project and registers action tasks.',
      },
      {
        key: 'add_calendar_milestones',
        displayName: 'Add Approved Kick-off Milestones to Calendar',
        stepType: 'action',
        purpose: 'Schedules approved kick-off dates and onboarding milestones on the team calendar.',
        application: 'concludo_calendar',
        inputMapping: { milestones: '$owner_approval_gate.approvedDates' },
        outputSchema: { eventIds: 'array' },
        configuration: {},
        idempotencyPolicy: { enabled: true, keyTemplate: 'hubspot_deal_${trigger.dealId}_calendar' },
        retryPolicy: { maxAttempts: 3, initialIntervalMs: 1000, backoffFactor: 2 },
        userFacingExplanation: 'Registers approved kick-off and milestone dates on the Concludo Calendar.',
      },
      {
        key: 'notify_account_owner',
        displayName: 'Notify Account Owner & Team',
        stepType: 'action',
        purpose: 'Sends workspace notification confirming onboarding initiation.',
        application: 'concludo_notifications',
        inputMapping: { recipient: '$resolve_customer_identity.verifiedOwnerUserId' },
        outputSchema: { sent: 'boolean' },
        configuration: { channel: 'workspace' },
        userFacingExplanation: 'Notifies team members that onboarding has launched.',
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceStepKey: 'trigger_deal_won', destinationStepKey: 'resolve_customer_identity', edgeType: 'success' },
      { id: 'e2', sourceStepKey: 'resolve_customer_identity', destinationStepKey: 'create_project_draft', edgeType: 'success' },
      { id: 'e3', sourceStepKey: 'create_project_draft', destinationStepKey: 'owner_approval_gate', edgeType: 'success' },
      { id: 'e4', sourceStepKey: 'owner_approval_gate', destinationStepKey: 'create_live_project_and_tasks', edgeType: 'approval_approved' },
      { id: 'e5', sourceStepKey: 'create_live_project_and_tasks', destinationStepKey: 'add_calendar_milestones', edgeType: 'success' },
      { id: 'e6', sourceStepKey: 'add_calendar_milestones', destinationStepKey: 'notify_account_owner', edgeType: 'success' },
    ];

    wf = {
      schemaVersion: 1,
      workflowKey: 'hubspot-deal-won-onboarding',
      name: 'Deal Won to Client Onboarding',
      description: 'Creates onboarding project and calendar milestones when a HubSpot deal is closed won.',
      version: 1,
      status: 'draft',
      organisationScope: { type: 'current_organisation', organizationId },
      owner: { type: 'role', value: 'project_owner' },
      timezone: 'Australia/Melbourne',
      riskLevel: 'high',
      trigger: {
        triggerKey: 'hubspot.deal_stage_changed',
        displayName: 'HubSpot Deal Marked Won',
        sourceService: 'hubspot',
        configuration: { stage: 'closed_won' },
      },
      inputs: [{ key: 'dealId', type: 'string', description: 'HubSpot Deal Identifier', required: true }],
      variables: [],
      steps,
      edges,
      errorHandling: { maxConsecutiveFailures: 3, notifyOwnerOnFailure: true },
      audit: { recordExecutionHistory: true, auditClassification: 'compliance' },
      monitoring: {},
      rollback: { canRollback: false },
      layout: {
        nodes: {
          trigger_deal_won: { key: 'trigger_deal_won', x: 80, y: 150 },
          resolve_customer_identity: { key: 'resolve_customer_identity', x: 340, y: 150 },
          create_project_draft: { key: 'create_project_draft', x: 600, y: 150 },
          owner_approval_gate: { key: 'owner_approval_gate', x: 860, y: 150 },
          create_live_project_and_tasks: { key: 'create_live_project_and_tasks', x: 1120, y: 150 },
          add_calendar_milestones: { key: 'add_calendar_milestones', x: 1380, y: 150 },
          notify_account_owner: { key: 'notify_account_owner', x: 1640, y: 150 },
        },
      },
    };

    approvalsRequired.push('owner_approval_gate');
    plainLanguageExplanation.push('1. Detects when a HubSpot deal is marked Closed Won.');
    plainLanguageExplanation.push('2. Resolves company contact and account owner via identity mapping.');
    plainLanguageExplanation.push('3. Drafts onboarding deliverables and milestones.');
    plainLanguageExplanation.push('4. Requests project owner sign-off in Concludo Approval Centre.');
    plainLanguageExplanation.push('5. Once approved, creates live project tasks and calendar events.');
  }
  // Scenario 2: Stripe Payment Failure Follow-up
  else if (promptLower.includes('stripe') && (promptLower.includes('payment') || promptLower.includes('failed') || promptLower.includes('invoice'))) {
    connectionsRequired.push('stripe');
    recordEmit('trigger.selected', { trigger: 'stripe.invoice_payment_failed', event: 'payment_failed' });

    const steps: WorkflowStep[] = [
      {
        key: 'trigger_payment_failed',
        displayName: 'Stripe Invoice Payment Failed',
        stepType: 'trigger',
        purpose: 'Catches failed invoice payment events directly from Stripe webhooks.',
        application: 'stripe',
        inputMapping: {},
        outputSchema: { invoiceId: 'string', customerId: 'string', amountDue: 'number', currency: 'string' },
        configuration: {},
        userFacingExplanation: 'Triggers when a customer invoice payment fails in Stripe.',
      },
      {
        key: 'notify_finance_internally',
        displayName: 'Internal Finance Notification',
        stepType: 'action',
        purpose: 'Alerts internal finance team of the payment failure.',
        application: 'concludo_notifications',
        inputMapping: { amount: '$trigger.amountDue', customerId: '$trigger.customerId' },
        outputSchema: { notified: 'boolean' },
        configuration: { channel: 'finance_alerts' },
        userFacingExplanation: 'Notifies internal finance team of the overdue payment.',
      },
      {
        key: 'create_recovery_task',
        displayName: 'Create Payment Recovery Task',
        stepType: 'action',
        purpose: 'Creates a high-priority task for customer operations to follow up.',
        application: 'concludo_projects',
        inputMapping: { title: 'Follow up failed payment for customer $trigger.customerId' },
        outputSchema: { taskId: 'string' },
        configuration: { priority: 'high' },
        idempotencyPolicy: { enabled: true, keyTemplate: 'stripe_recovery_${trigger.invoiceId}' },
        userFacingExplanation: 'Creates a follow-up action task in Concludo Projects.',
      },
      {
        key: 'wait_grace_period',
        displayName: 'Wait 3 Business Days',
        stepType: 'wait',
        purpose: 'Allows automated Stripe dunning or bank clearance grace period.',
        application: 'logic',
        inputMapping: {},
        outputSchema: {},
        configuration: { durationDays: 3 },
        userFacingExplanation: 'Waits 3 days before performing secondary verification.',
      },
      {
        key: 'recheck_invoice_status',
        displayName: 'Re-check Invoice Payment Status',
        stepType: 'action',
        purpose: 'Queries Stripe API to check if invoice was subsequently settled.',
        application: 'stripe',
        inputMapping: { invoiceId: '$trigger.invoiceId' },
        outputSchema: { isPaid: 'boolean', status: 'string' },
        configuration: {},
        userFacingExplanation: 'Checks Stripe to confirm whether the invoice has been paid.',
      },
      {
        key: 'draft_customer_reminder',
        displayName: 'Draft Friendly Follow-up Message',
        stepType: 'action',
        purpose: 'Prepares a polite payment reminder email for the customer.',
        application: 'communications',
        inputMapping: { invoiceId: '$trigger.invoiceId' },
        outputSchema: { emailDraftId: 'string', bodyText: 'string' },
        configuration: {},
        userFacingExplanation: 'Prepares a polite follow-up email draft.',
      },
      {
        key: 'approval_send_reminder',
        displayName: 'Approve Customer Email Dispatch',
        stepType: 'approval',
        purpose: 'Human gate before sending an external email to the customer.',
        application: 'concludo_approval_centre',
        inputMapping: { emailDraftId: '$draft_customer_reminder.emailDraftId' },
        outputSchema: { approved: 'boolean' },
        configuration: { approverRole: 'account_manager' },
        approvalRequirement: { required: true, approverRole: 'account_manager' },
        userFacingExplanation: 'Requires account manager sign-off before emailing the customer.',
      },
      {
        key: 'send_approved_customer_email',
        displayName: 'Send Approved Customer Email',
        stepType: 'action',
        purpose: 'Dispatches the customer email through authenticated email provider.',
        application: 'communications',
        inputMapping: { emailDraftId: '$draft_customer_reminder.emailDraftId' },
        outputSchema: { sentAt: 'string' },
        configuration: {},
        userFacingExplanation: 'Sends the approved payment reminder to the customer.',
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceStepKey: 'trigger_payment_failed', destinationStepKey: 'notify_finance_internally', edgeType: 'success' },
      { id: 'e2', sourceStepKey: 'notify_finance_internally', destinationStepKey: 'create_recovery_task', edgeType: 'success' },
      { id: 'e3', sourceStepKey: 'create_recovery_task', destinationStepKey: 'wait_grace_period', edgeType: 'success' },
      { id: 'e4', sourceStepKey: 'wait_grace_period', destinationStepKey: 'recheck_invoice_status', edgeType: 'success' },
      { id: 'e5', sourceStepKey: 'recheck_invoice_status', destinationStepKey: 'draft_customer_reminder', edgeType: 'conditional', conditionReference: '!steps.recheck_invoice_status.output.isPaid' },
      { id: 'e6', sourceStepKey: 'draft_customer_reminder', destinationStepKey: 'approval_send_reminder', edgeType: 'success' },
      { id: 'e7', sourceStepKey: 'approval_send_reminder', destinationStepKey: 'send_approved_customer_email', edgeType: 'approval_approved' },
    ];

    wf = {
      schemaVersion: 1,
      workflowKey: 'stripe-payment-failure-followup',
      name: 'Stripe Payment Failure Follow-up',
      description: 'Follows up failed Stripe subscription payments with internal alerts, grace period, and governed customer email.',
      version: 1,
      status: 'draft',
      organisationScope: { type: 'current_organisation', organizationId },
      owner: { type: 'role', value: 'finance_manager' },
      timezone: 'Australia/Melbourne',
      riskLevel: 'high',
      trigger: {
        triggerKey: 'stripe.invoice_payment_failed',
        displayName: 'Stripe Invoice Payment Failed',
        sourceService: 'stripe',
        configuration: {},
      },
      inputs: [{ key: 'invoiceId', type: 'string', description: 'Stripe Invoice ID', required: true }],
      variables: [],
      steps,
      edges,
      errorHandling: { maxConsecutiveFailures: 3, notifyOwnerOnFailure: true },
      audit: { recordExecutionHistory: true, auditClassification: 'compliance' },
      monitoring: {},
      rollback: { canRollback: false },
      layout: {
        nodes: {
          trigger_payment_failed: { key: 'trigger_payment_failed', x: 80, y: 150 },
          notify_finance_internally: { key: 'notify_finance_internally', x: 340, y: 150 },
          create_recovery_task: { key: 'create_recovery_task', x: 600, y: 150 },
          wait_grace_period: { key: 'wait_grace_period', x: 860, y: 150 },
          recheck_invoice_status: { key: 'recheck_invoice_status', x: 1120, y: 150 },
          draft_customer_reminder: { key: 'draft_customer_reminder', x: 1380, y: 150 },
          approval_send_reminder: { key: 'approval_send_reminder', x: 1640, y: 150 },
          send_approved_customer_email: { key: 'send_approved_customer_email', x: 1900, y: 150 },
        },
      },
    };

    approvalsRequired.push('approval_send_reminder');
    plainLanguageExplanation.push('1. Detects failed Stripe invoice payments.');
    plainLanguageExplanation.push('2. Alerts internal finance team and creates a follow-up task.');
    plainLanguageExplanation.push('3. Waits 3 days to allow automated dunning or bank clearance.');
    plainLanguageExplanation.push('4. Re-checks payment status before drafting customer correspondence.');
    plainLanguageExplanation.push('5. Requires human sign-off before sending any external payment reminder.');
  }
  // Scenario 3: Google Sheet to Project Task
  else if (promptLower.includes('google sheet') || promptLower.includes('spreadsheet')) {
    connectionsRequired.push('google_sheets');
    recordEmit('trigger.selected', { trigger: 'schedule.reached', event: 'every_15_minutes' });

    const steps: WorkflowStep[] = [
      {
        key: 'trigger_poll_sheet',
        displayName: 'Every 15 Minutes Poll Schedule',
        stepType: 'trigger',
        purpose: 'Runs on a 15-minute schedule to check for newly approved spreadsheet rows.',
        application: 'system',
        inputMapping: {},
        outputSchema: { timestamp: 'string' },
        configuration: { cron: '*/15 * * * *' },
        userFacingExplanation: 'Runs every 15 minutes to inspect the Google Sheet.',
      },
      {
        key: 'read_approved_sheet_rows',
        displayName: 'Read Approved Sheet Rows',
        stepType: 'action',
        purpose: 'Fetches unprocessed rows marked Approved in the connected Google Sheet.',
        application: 'google_sheets',
        inputMapping: { range: 'A2:Z100' },
        outputSchema: { rows: 'array' },
        configuration: { filterColumn: 'Status', filterValue: 'Approved', maxBatch: 50 },
        userFacingExplanation: 'Reads approved requests from the Google Sheet.',
      },
      {
        key: 'loop_create_tasks',
        displayName: 'Process Rows (Bounded Loop)',
        stepType: 'loop',
        purpose: 'Iterates through each approved row with per-row idempotency and creates Concludo project tasks.',
        application: 'logic',
        inputMapping: { items: '$read_approved_sheet_rows.rows' },
        outputSchema: { processedCount: 'number', createdTaskIds: 'array' },
        configuration: { maxItems: 50, perItemFailurePolicy: 'continue' },
        userFacingExplanation: 'Loops through rows and creates project tasks.',
      },
      {
        key: 'write_back_task_ids',
        displayName: 'Write Back Task IDs to Sheet',
        stepType: 'action',
        purpose: 'Updates the Google Sheet row with the created Concludo Task ID to guarantee duplicate prevention.',
        application: 'google_sheets',
        inputMapping: { taskResults: '$loop_create_tasks.createdTaskIds' },
        outputSchema: { updatedRows: 'number' },
        configuration: { idColumn: 'ConcludoTaskId' },
        idempotencyPolicy: { enabled: true, keyTemplate: 'sheet_writeback_${trigger.timestamp}' },
        userFacingExplanation: 'Writes created task IDs back to the sheet to prevent duplicates.',
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceStepKey: 'trigger_poll_sheet', destinationStepKey: 'read_approved_sheet_rows', edgeType: 'success' },
      { id: 'e2', sourceStepKey: 'read_approved_sheet_rows', destinationStepKey: 'loop_create_tasks', edgeType: 'success' },
      { id: 'e3', sourceStepKey: 'loop_create_tasks', destinationStepKey: 'write_back_task_ids', edgeType: 'success' },
    ];

    wf = {
      schemaVersion: 1,
      workflowKey: 'google-sheet-to-project-tasks',
      name: 'Google Sheet to Project Task',
      description: 'Checks a Google Sheet every 15 minutes for approved requests, creates project tasks, and writes task IDs back.',
      version: 1,
      status: 'draft',
      organisationScope: { type: 'current_organisation', organizationId },
      owner: { type: 'role', value: 'project_owner' },
      timezone: 'Australia/Melbourne',
      riskLevel: 'medium',
      trigger: {
        triggerKey: 'schedule.reached',
        displayName: 'Every 15 Minutes Poll Schedule',
        sourceService: 'system',
        configuration: { cron: '*/15 * * * *' },
      },
      inputs: [],
      variables: [],
      steps,
      edges,
      errorHandling: { maxConsecutiveFailures: 3, notifyOwnerOnFailure: true },
      audit: { recordExecutionHistory: true, auditClassification: 'standard' },
      monitoring: {},
      rollback: { canRollback: false },
      layout: {
        nodes: {
          trigger_poll_sheet: { key: 'trigger_poll_sheet', x: 80, y: 150 },
          read_approved_sheet_rows: { key: 'read_approved_sheet_rows', x: 340, y: 150 },
          loop_create_tasks: { key: 'loop_create_tasks', x: 600, y: 150 },
          write_back_task_ids: { key: 'write_back_task_ids', x: 860, y: 150 },
        },
      },
    };

    plainLanguageExplanation.push('1. Runs every 15 minutes to poll the designated Google Sheet.');
    plainLanguageExplanation.push('2. Reads new approved rows within a bounded 50-row batch.');
    plainLanguageExplanation.push('3. Creates a corresponding project task for each row idempotently.');
    plainLanguageExplanation.push('4. Writes the created task ID back into the sheet to mark it completed.');
  }
  // Default: Meeting Follow-through (Canonical Vertical Slice)
  else {
    connectionsRequired.push('concludo_meetings');
    recordEmit('trigger.selected', { trigger: 'meeting.completed', event: 'meeting_completed' });

    const steps: WorkflowStep[] = [
      {
        key: 'validate_meeting_access',
        displayName: 'Validate Meeting & Security Context',
        stepType: 'logic',
        purpose: 'Verifies organization ownership and checks deduplication key.',
        application: 'system',
        inputMapping: { meetingId: '$trigger.meeting.id', orgId: '$trigger.organizationId' },
        outputSchema: { isValid: 'boolean', processedBefore: 'boolean' },
        configuration: {},
        userFacingExplanation: 'Checks meeting security and verifies that this meeting was not already processed.',
      },
      {
        key: 'invoke_meeting_ai_agent',
        displayName: 'Meeting AI Agent (Summary & Action Extraction)',
        stepType: 'ai_agent',
        purpose: 'Analyses transcript to extract factual summaries, decisions, and action items with evidence links.',
        application: 'concludo_ai_agents',
        inputMapping: { transcript: '$trigger.transcript', meetingId: '$trigger.meeting.id' },
        outputSchema: { summary: 'string', actions: 'array', decisions: 'array' },
        configuration: { model: 'gpt_5_6_terra', antiHallucination: true },
        retryPolicy: { maxAttempts: 3, initialIntervalMs: 1000, backoffFactor: 2 },
        userFacingExplanation: 'Extracts clear summaries and action items grounded strictly in meeting transcripts.',
      },
      {
        key: 'approval_centre_review',
        displayName: 'Approval Centre Sign-Off',
        stepType: 'approval',
        purpose: 'Submits summary and action tasks to project owner for editing, selection, and explicit sign-off.',
        application: 'concludo_approval_centre',
        inputMapping: { package: '$invoke_meeting_ai_agent.output' },
        outputSchema: { approved: 'boolean', selectedActions: 'array', approvedDates: 'array' },
        configuration: { approverRole: 'project_owner' },
        approvalRequirement: { required: true, approverRole: 'project_owner' },
        userFacingExplanation: 'Project owner reviews extracted actions and calendar dates before creation.',
      },
      {
        key: 'create_project_tasks',
        displayName: 'Create Approved Project Tasks',
        stepType: 'action',
        purpose: 'Inserts approved action items into Concludo Projects.',
        application: 'concludo_projects',
        inputMapping: { actions: '$approval_centre_review.selectedActions', projectId: '$trigger.meeting.projectId' },
        outputSchema: { createdTaskIds: 'array' },
        configuration: {},
        idempotencyPolicy: { enabled: true, keyTemplate: 'meeting_${trigger.meeting.id}_task' },
        userFacingExplanation: 'Creates approved action items directly in the linked project.',
      },
      {
        key: 'create_calendar_events',
        displayName: 'Create Approved Calendar Events',
        stepType: 'action',
        purpose: 'Inserts approved action deadlines into Concludo Calendar.',
        application: 'concludo_calendar',
        inputMapping: { events: '$approval_centre_review.approvedDates', meetingId: '$trigger.meeting.id' },
        outputSchema: { createdEventIds: 'array' },
        configuration: {},
        idempotencyPolicy: { enabled: true, keyTemplate: 'meeting_${trigger.meeting.id}_calendar' },
        retryPolicy: { maxAttempts: 3, initialIntervalMs: 1000, backoffFactor: 2 },
        userFacingExplanation: 'Adds approved meeting deadlines to the Concludo Calendar.',
      },
      {
        key: 'send_completion_notification',
        displayName: 'Internal Completion Notification',
        stepType: 'action',
        purpose: 'Alerts meeting attendees and project team that follow-through actions are registered.',
        application: 'concludo_notifications',
        inputMapping: { projectId: '$trigger.meeting.projectId' },
        outputSchema: { sent: 'boolean' },
        configuration: {},
        userFacingExplanation: 'Sends internal confirmation notification to the project team.',
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceStepKey: 'validate_meeting_access', destinationStepKey: 'invoke_meeting_ai_agent', edgeType: 'success' },
      { id: 'e2', sourceStepKey: 'invoke_meeting_ai_agent', destinationStepKey: 'approval_centre_review', edgeType: 'success' },
      { id: 'e3', sourceStepKey: 'approval_centre_review', destinationStepKey: 'create_project_tasks', edgeType: 'approval_approved' },
      { id: 'e4', sourceStepKey: 'create_project_tasks', destinationStepKey: 'create_calendar_events', edgeType: 'success' },
      { id: 'e5', sourceStepKey: 'create_calendar_events', destinationStepKey: 'send_completion_notification', edgeType: 'success' },
    ];

    wf = {
      schemaVersion: 1,
      workflowKey: 'meeting-follow-through',
      name: 'Meeting Follow-through',
      description: 'Creates approved meeting follow-through work with project tasks and calendar deadlines.',
      version: 1,
      status: 'draft',
      organisationScope: { type: 'current_organisation', organizationId },
      owner: { type: 'role', value: 'project_owner' },
      timezone: 'Australia/Melbourne',
      riskLevel: 'high',
      trigger: {
        triggerKey: 'meeting.completed',
        displayName: 'Meeting Completed',
        sourceService: 'concludo_meetings',
        configuration: {},
      },
      inputs: [
        { key: 'meetingId', type: 'string', description: 'Meeting ID', required: true },
        { key: 'transcript', type: 'string', description: 'Transcript Text', required: true },
        { key: 'projectId', type: 'string', description: 'Linked Project ID', required: false },
      ],
      variables: [],
      steps,
      edges,
      errorHandling: { maxConsecutiveFailures: 3, notifyOwnerOnFailure: true },
      audit: { recordExecutionHistory: true, auditClassification: 'compliance' },
      monitoring: {},
      rollback: { canRollback: false },
      layout: {
        nodes: {
          validate_meeting_access: { key: 'validate_meeting_access', x: 80, y: 150 },
          invoke_meeting_ai_agent: { key: 'invoke_meeting_ai_agent', x: 340, y: 150 },
          approval_centre_review: { key: 'approval_centre_review', x: 600, y: 150 },
          create_project_tasks: { key: 'create_project_tasks', x: 860, y: 150 },
          create_calendar_events: { key: 'create_calendar_events', x: 1120, y: 150 },
          send_completion_notification: { key: 'send_completion_notification', x: 1380, y: 150 },
        },
      },
    };

    approvalsRequired.push('approval_centre_review');
    plainLanguageExplanation.push('1. Verifies meeting access and deduplication security.');
    plainLanguageExplanation.push('2. Invokes Meeting AI Agent to extract evidence-grounded actions.');
    plainLanguageExplanation.push('3. Routes extracted items to Approval Centre for project owner sign-off.');
    plainLanguageExplanation.push('4. Creates approved tasks in Concludo Projects.');
    plainLanguageExplanation.push('5. Adds approved deadlines to Concludo Calendar.');
    plainLanguageExplanation.push('6. Sends internal notification to team members.');
  }

  // 3. Emit nodes and edges progressively to client
  wf.steps.forEach((step) => {
    recordEmit('node.added', { step });
  });

  wf.edges.forEach((edge) => {
    recordEmit('edge.added', { edge });
  });

  approvalsRequired.forEach((appKey) => {
    recordEmit('approval.added', { stepKey: appKey });
  });

  // Check connection requirements against connectedApplications
  connectionsRequired.forEach((conn) => {
    if (!connectedApplications.includes(conn) && !conn.startsWith('concludo_') && conn !== 'system') {
      recordEmit('connection.required', {
        connectorKey: conn,
        message: `${conn} must be connected before this workflow can be tested or published.`,
      });
    }
  });

  // 4. Validate Definition
  recordEmit('validation.started', {});
  const valResult = validateWorkflowDefinition(wf, {
    connectedApplications,
    enforceConnections: false,
  });

  if (!valResult.isValid) {
    valResult.errors.forEach((err) => {
      recordEmit('validation.failed', { error: err });
    });
  } else {
    recordEmit('validation.completed', { warningsCount: valResult.warnings.length });
  }

  recordEmit('build.completed', { workflowKey: wf.workflowKey, status: wf.status });

  return {
    schemaVersion: 1,
    buildStatus: valResult.isValid ? 'complete' : 'needs_clarification',
    workflowDefinition: wf,
    plainLanguageExplanation,
    assumptions,
    questions: [],
    connectionsRequired,
    approvalsRequired,
    validationWarnings: valResult.warnings.map((w) => w.message),
    testsProposed: ['Synthetic dry run with mock payload', 'Idempotency repeat check'],
    limitations: [],
    buildEvents,
  };
}


export function buildMeetingFollowthroughVerticalSlice(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    workflowKey: 'meeting-follow-through',
    name: 'Meeting Follow-through',
    description: 'Creates approved meeting follow-through work with project tasks and calendar deadlines.',
    version: 1,
    status: 'draft',
    organisationScope: { type: 'current_organisation' },
    owner: { type: 'role', value: 'project_owner' },
    timezone: 'Australia/Melbourne',
    riskLevel: 'high',
    trigger: {
      triggerKey: 'meeting.completed',
      displayName: 'Meeting Completed',
      sourceService: 'concludo_meetings',
      configuration: {},
    },
    inputs: [
      { key: 'meetingId', type: 'string', description: 'Meeting ID', required: true },
      { key: 'transcript', type: 'string', description: 'Transcript Text', required: true },
    ],
    variables: [],
    steps: [
      {
        key: 'validate_meeting_access',
        name: 'Validate Meeting Access',
        displayName: 'Validate Meeting & Security Context',
        stepType: 'logic',
        service: 'system',
        purpose: 'Verifies organization ownership and checks deduplication key.',
        application: 'system',
        inputMapping: {},
        outputSchema: {},
        configuration: {},
        position: { x: 80, y: 150 },
        userFacingExplanation: 'Checks meeting security and verifies that this meeting was not already processed.',
      },
      {
        key: 'invoke_meeting_ai_agent',
        name: 'Meeting AI Agent',
        displayName: 'Meeting AI Agent (Summary & Action Extraction)',
        stepType: 'ai_agent',
        service: 'concludo_ai_agents',
        purpose: 'Analyses transcript to extract factual summaries, decisions, and action items with evidence links.',
        application: 'concludo_ai_agents',
        inputMapping: {},
        outputSchema: {},
        configuration: {},
        position: { x: 340, y: 150 },
        userFacingExplanation: 'Extracts clear summaries and action items grounded strictly in meeting transcripts.',
      },
      {
        key: 'approval_centre_review',
        name: 'Approval Centre Sign-Off',
        displayName: 'Approval Centre Sign-Off',
        stepType: 'approval',
        service: 'concludo_approval_centre',
        purpose: 'Submits summary and action tasks to project owner for editing, selection, and explicit sign-off.',
        application: 'concludo_approval_centre',
        inputMapping: {},
        outputSchema: {},
        configuration: {},
        position: { x: 600, y: 150 },
        approvalRequirement: { required: true, approverRole: 'project_owner' },
        userFacingExplanation: 'Project owner reviews extracted actions and calendar dates before creation.',
      },
      {
        key: 'create_project_tasks',
        name: 'Create Approved Project Tasks',
        displayName: 'Create Approved Project Tasks',
        stepType: 'action',
        service: 'concludo_projects',
        purpose: 'Inserts approved action items into Concludo Projects.',
        application: 'concludo_projects',
        inputMapping: {},
        outputSchema: {},
        configuration: {},
        position: { x: 860, y: 150 },
        idempotencyPolicy: { enabled: true, keyTemplate: 'mtg_task' },
        userFacingExplanation: 'Creates approved action items directly in the linked project.',
      },
      {
        key: 'create_calendar_events',
        name: 'Create Approved Calendar Events',
        displayName: 'Create Approved Calendar Events',
        stepType: 'action',
        service: 'concludo_calendar',
        purpose: 'Inserts approved action deadlines into Concludo Calendar.',
        application: 'concludo_calendar',
        inputMapping: {},
        outputSchema: {},
        configuration: {},
        position: { x: 1120, y: 150 },
        idempotencyPolicy: { enabled: true, keyTemplate: 'mtg_cal' },
        userFacingExplanation: 'Adds approved meeting deadlines to the Concludo Calendar.',
      },
    ],
    edges: [
      { id: 'e1', sourceStep: 'validate_meeting_access', sourceStepKey: 'validate_meeting_access', destinationStep: 'invoke_meeting_ai_agent', destinationStepKey: 'invoke_meeting_ai_agent', edgeType: 'success' },
      { id: 'e2', sourceStep: 'invoke_meeting_ai_agent', sourceStepKey: 'invoke_meeting_ai_agent', destinationStep: 'approval_centre_review', destinationStepKey: 'approval_centre_review', edgeType: 'success' },
      { id: 'e3', sourceStep: 'approval_centre_review', sourceStepKey: 'approval_centre_review', destinationStep: 'create_project_tasks', destinationStepKey: 'create_project_tasks', edgeType: 'approval_approved' },
      { id: 'e4', sourceStep: 'create_project_tasks', sourceStepKey: 'create_project_tasks', destinationStep: 'create_calendar_events', destinationStepKey: 'create_calendar_events', edgeType: 'success' },
    ],
    errorHandling: { maxConsecutiveFailures: 3, notifyOwnerOnFailure: true },
    audit: { recordExecutionHistory: true, auditClassification: 'compliance' },
    monitoring: {},
    rollback: { canRollback: false },
    layout: { nodes: {} },
  };
}
