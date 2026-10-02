/**
 * Concludo Workflow Template Library (20 Initial Templates)
 * Conforms to Master Build Instruction Sections 19, 20, 21
 */

import { WorkflowDefinition } from './schemas';

export interface WorkflowTemplateMeta {
  templateKey: string;
  name: string;
  description: string;
  category:
    | 'Meetings'
    | 'Sales'
    | 'Customer onboarding'
    | 'Projects'
    | 'Documents'
    | 'Finance'
    | 'Compliance'
    | 'Operations'
    | 'Approvals'
    | 'Reporting'
    | 'AI'
    | 'Webhooks'
    | 'Custom';
  applicationsRequired: string[];
  concludoServicesRequired: string[];
  approvalRequired: boolean;
  setupTimeCategory: '5 mins' | '10 mins' | '15 mins';
  exampleTrigger: string;
  exampleResult: string;
  lockedGovernanceFields?: string[];
  definition: Partial<WorkflowDefinition>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateMeta[] = [
  {
    templateKey: 'meeting-follow-through',
    name: 'Meeting Follow-through',
    description: 'Summarises meeting transcripts, extracts decisions and action items, and schedules deadlines upon approval.',
    category: 'Meetings',
    applicationsRequired: [],
    concludoServicesRequired: ['Concludo Meetings', 'AI Agents', 'Approval Centre', 'Projects', 'Calendar'],
    approvalRequired: true,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'When a project meeting finishes',
    exampleResult: 'Summary and actions drafted, project tasks and calendar events created after owner sign-off.',
    lockedGovernanceFields: ['approvalRequirement', 'antiSurveillance'],
    definition: {
      workflowKey: 'meeting-follow-through',
      name: 'Meeting Follow-through',
      description: 'Creates approved meeting follow-through work with project tasks and calendar deadlines.',
    },
  },
  {
    templateKey: 'deal-won-client-onboarding',
    name: 'Deal-Won to Client Onboarding',
    description: 'When a CRM deal is marked won, automatically creates the client onboarding project and schedules kick-off dates.',
    category: 'Sales',
    applicationsRequired: ['HubSpot'],
    concludoServicesRequired: ['Projects', 'Approval Centre', 'Calendar', 'Notifications'],
    approvalRequired: true,
    setupTimeCategory: '10 mins',
    exampleTrigger: 'When a HubSpot deal reaches Closed Won',
    exampleResult: 'Client onboarding project drafted, milestones verified by project owner, and kickoff added to calendar.',
    lockedGovernanceFields: ['approvalRequirement'],
    definition: {
      workflowKey: 'deal-won-client-onboarding',
      name: 'Deal-Won to Client Onboarding',
      description: 'Creates client onboarding project and schedules kick-off dates upon CRM deal won.',
    },
  },
  {
    templateKey: 'payment-failure-follow-up',
    name: 'Payment-Failure Follow-up',
    description: 'Monitors Stripe subscription payment failures, alerts finance, waits for grace period, and coordinates customer outreach.',
    category: 'Finance',
    applicationsRequired: ['Stripe'],
    concludoServicesRequired: ['Projects', 'Approval Centre', 'Notifications'],
    approvalRequired: true,
    setupTimeCategory: '10 mins',
    exampleTrigger: 'When a Stripe subscription invoice fails',
    exampleResult: 'Internal finance task created, dunning period observed, and approved email reminder sent.',
    lockedGovernanceFields: ['approvalRequirement'],
    definition: {
      workflowKey: 'payment-failure-follow-up',
      name: 'Payment-Failure Follow-up',
      description: 'Handles failed invoice payments with grace periods and governed customer correspondence.',
    },
  },
  {
    templateKey: 'spreadsheet-row-to-task',
    name: 'Spreadsheet Row to Task',
    description: 'Monitors Google Sheet rows for approved requests and syncs them into Concludo Projects with task ID write-back.',
    category: 'Operations',
    applicationsRequired: ['Google Sheets'],
    concludoServicesRequired: ['Projects'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'Every 15 minutes checking Google Sheet rows',
    exampleResult: 'Approved rows turned into project tasks and marked with Concludo task IDs.',
    definition: {
      workflowKey: 'spreadsheet-row-to-task',
      name: 'Spreadsheet Row to Task',
      description: 'Synchronises approved spreadsheet entries into project tasks idempotently.',
    },
  },
  {
    templateKey: 'document-to-project',
    name: 'Document to Project Scope',
    description: 'Analyses uploaded statement of work or client brief PDFs, drafts project scope, and submits for leadership approval.',
    category: 'Documents',
    applicationsRequired: [],
    concludoServicesRequired: ['Document Reader', 'AI Agents', 'Approval Centre', 'Projects'],
    approvalRequired: true,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'When a project specification PDF is uploaded',
    exampleResult: 'Project deliverables, scope boundaries, and risk registers drafted for approval.',
    definition: {
      workflowKey: 'document-to-project',
      name: 'Document to Project Scope',
      description: 'Turns client briefs and contracts into structured project scopes.',
    },
  },
  {
    templateKey: 'contract-obligation-tracking',
    name: 'Contract Obligation Tracking',
    description: 'Extracts compliance deliverables and renewal deadlines from legal agreements into Concludo Calendar.',
    category: 'Compliance',
    applicationsRequired: [],
    concludoServicesRequired: ['Document Reader', 'Calendar', 'Approval Centre'],
    approvalRequired: true,
    setupTimeCategory: '10 mins',
    exampleTrigger: 'When a signed agreement is finalized',
    exampleResult: 'Key milestones and notice dates placed on calendar after legal review.',
    definition: {
      workflowKey: 'contract-obligation-tracking',
      name: 'Contract Obligation Tracking',
      description: 'Extracts contract milestones and renewal dates.',
    },
  },
  {
    templateKey: 'overdue-invoice-follow-up',
    name: 'Overdue Invoice Follow-up',
    description: 'Scans accounting ledger for invoices past 14 days overdue and prepares reminder batches.',
    category: 'Finance',
    applicationsRequired: ['Stripe'],
    concludoServicesRequired: ['Approval Centre', 'Notifications'],
    approvalRequired: true,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'Weekly schedule checking receivables',
    exampleResult: 'Overdue notices presented in Approval Centre before sending.',
    definition: {
      workflowKey: 'overdue-invoice-follow-up',
      name: 'Overdue Invoice Follow-up',
      description: 'Follows up outstanding invoices with human sign-off.',
    },
  },
  {
    templateKey: 'high-risk-issue-escalation',
    name: 'High-Risk Issue Escalation',
    description: 'Detects critical risks or bugs, notifies leadership immediately, and opens an auditable incident.',
    category: 'Operations',
    applicationsRequired: ['Slack'],
    concludoServicesRequired: ['Projects', 'Notifications'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'When a critical project risk is created',
    exampleResult: 'Incident record created and emergency alert sent to Slack leadership channel.',
    definition: {
      workflowKey: 'high-risk-issue-escalation',
      name: 'High-Risk Issue Escalation',
      description: 'Escalates critical operational incidents automatically.',
    },
  },
  {
    templateKey: 'weekly-project-status-review',
    name: 'Weekly Project Status Review',
    description: 'Gathers task completion velocity and blockers every Friday to produce a draft executive summary.',
    category: 'Reporting',
    applicationsRequired: [],
    concludoServicesRequired: ['Projects', 'AI Agents', 'Approval Centre'],
    approvalRequired: true,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'Every Friday at 16:00',
    exampleResult: 'Weekly status brief compiled and presented to project lead for sign-off.',
    definition: {
      workflowKey: 'weekly-project-status-review',
      name: 'Weekly Project Status Review',
      description: 'Compiles project progress and outstanding deliverables weekly.',
    },
  },
  {
    templateKey: 'webhook-to-task',
    name: 'Webhook Event to Task',
    description: 'Accepts authenticated inbound webhook payloads, validates schema, and creates a project action item.',
    category: 'Webhooks',
    applicationsRequired: ['Custom Webhooks'],
    concludoServicesRequired: ['Projects'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'Inbound webhook received from external tool',
    exampleResult: 'Action task logged in project with request payload reference.',
    definition: {
      workflowKey: 'webhook-to-task',
      name: 'Webhook Event to Task',
      description: 'Receives external webhooks and creates project tasks.',
    },
  },
  {
    templateKey: 'ai-external-message-approval',
    name: 'AI-Generated External Message with Approval',
    description: 'Drafts customer updates via AI agent, enforcing strict review in Approval Centre before dispatch.',
    category: 'AI',
    applicationsRequired: ['Microsoft Outlook'],
    concludoServicesRequired: ['AI Agents', 'Approval Centre'],
    approvalRequired: true,
    setupTimeCategory: '10 mins',
    exampleTrigger: 'When a project milestone is achieved',
    exampleResult: 'AI drafts client update; email sends only after human approval.',
    definition: {
      workflowKey: 'ai-external-message-approval',
      name: 'AI External Message with Approval',
      description: 'Drafts outbound messages with mandatory human sign-off.',
    },
  },
  {
    templateKey: 'calendar-deadline-creation',
    name: 'Calendar Deadline Synchronisation',
    description: 'Monitors newly created high-priority tasks and registers corresponding due-date drafts on calendar.',
    category: 'Projects',
    applicationsRequired: [],
    concludoServicesRequired: ['Projects', 'Calendar'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'When a priority task is assigned',
    exampleResult: 'Due date scheduled on project calendar.',
    definition: {
      workflowKey: 'calendar-deadline-creation',
      name: 'Calendar Deadline Creation',
      description: 'Synchronises task deadlines to calendar.',
    },
  },
  {
    templateKey: 'compliance-reminder',
    name: 'Compliance Audit Reminder',
    description: 'Schedules recurring 90-day data retention and privacy audit reviews for organisation managers.',
    category: 'Compliance',
    applicationsRequired: [],
    concludoServicesRequired: ['Calendar', 'Notifications'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'Every 90 days',
    exampleResult: 'Compliance review calendar slot booked and reminder sent.',
    definition: {
      workflowKey: 'compliance-reminder',
      name: 'Compliance Reminder',
      description: 'Quarterly compliance check trigger.',
    },
  },
  {
    templateKey: 'incident-escalation',
    name: 'Incident Escalation & Quarantine',
    description: 'When an integration encounters repeated failures, halts downstream jobs and alerts system admins.',
    category: 'Operations',
    applicationsRequired: [],
    concludoServicesRequired: ['Notifications'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'When 3 consecutive step errors occur',
    exampleResult: 'Workflow paused and incident logged for investigation.',
    definition: {
      workflowKey: 'incident-escalation',
      name: 'Incident Escalation',
      description: 'Quarantines failing jobs and alerts administrators.',
    },
  },
  {
    templateKey: 'recurring-operations-report',
    name: 'Recurring Operations Report',
    description: 'Aggregates monthly system and workflow completion metrics into an executive briefing document.',
    category: 'Reporting',
    applicationsRequired: [],
    concludoServicesRequired: ['AI Agents', 'Approval Centre'],
    approvalRequired: true,
    setupTimeCategory: '10 mins',
    exampleTrigger: 'First day of each month',
    exampleResult: 'Operations overview drafted for executive sign-off.',
    definition: {
      workflowKey: 'recurring-operations-report',
      name: 'Recurring Operations Report',
      description: 'Monthly operations briefing workflow.',
    },
  },
  {
    templateKey: 'data-reconciliation',
    name: 'Data Reconciliation Audit',
    description: 'Compares external CRM deal IDs against Concludo Project records to detect discrepancies.',
    category: 'Operations',
    applicationsRequired: ['HubSpot'],
    concludoServicesRequired: ['Projects', 'Notifications'],
    approvalRequired: false,
    setupTimeCategory: '10 mins',
    exampleTrigger: 'Weekly reconciliation check',
    exampleResult: 'Discrepancy report generated and missing projects flagged.',
    definition: {
      workflowKey: 'data-reconciliation',
      name: 'Data Reconciliation',
      description: 'Reconciles CRM deals with workspace projects.',
    },
  },
  {
    templateKey: 'approval-routing',
    name: 'Multi-Stage Approval Routing',
    description: 'Routes capital expenditures or project scope expansions through sequential team lead and finance approvals.',
    category: 'Approvals',
    applicationsRequired: [],
    concludoServicesRequired: ['Approval Centre', 'Notifications'],
    approvalRequired: true,
    setupTimeCategory: '10 mins',
    exampleTrigger: 'When a budget amendment request is filed',
    exampleResult: 'Two-stage approval required before status updates.',
    definition: {
      workflowKey: 'approval-routing',
      name: 'Multi-Stage Approval Routing',
      description: 'Sequenced approval hierarchy for high-impact decisions.',
    },
  },
  {
    templateKey: 'customer-renewal-reminder',
    name: 'Customer Renewal Advance Notice',
    description: 'Scans subscription expiry dates 30 days in advance and assigns a relationship review task to account owner.',
    category: 'Customer onboarding',
    applicationsRequired: ['Stripe'],
    concludoServicesRequired: ['Projects', 'Calendar'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: '30 days prior to subscription renewal',
    exampleResult: 'Check-in task created and calendar reminder logged.',
    definition: {
      workflowKey: 'customer-renewal-reminder',
      name: 'Customer Renewal Reminder',
      description: 'Proactive 30-day renewal engagement workflow.',
    },
  },
  {
    templateKey: 'milestone-delay-response',
    name: 'Project Milestone Delay Response',
    description: 'Detects when a milestone slips past estimated target date and alerts project stakeholders.',
    category: 'Projects',
    applicationsRequired: ['Slack'],
    concludoServicesRequired: ['Projects', 'Notifications'],
    approvalRequired: false,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'When milestone target date is exceeded',
    exampleResult: 'Stakeholder notification sent and reschedule draft prepared.',
    definition: {
      workflowKey: 'milestone-delay-response',
      name: 'Milestone Delay Response',
      description: 'Detects project delays and alerts stakeholders.',
    },
  },
  {
    templateKey: 'client-onboarding',
    name: 'Standard Client Onboarding',
    description: 'Provisions standard client onboarding checklists, kick-off notes, and welcome packet tasks.',
    category: 'Customer onboarding',
    applicationsRequired: [],
    concludoServicesRequired: ['Projects', 'Approval Centre'],
    approvalRequired: true,
    setupTimeCategory: '5 mins',
    exampleTrigger: 'When a new client organization is registered',
    exampleResult: 'Standard onboarding work package drafted and approved.',
    definition: {
      workflowKey: 'client-onboarding',
      name: 'Standard Client Onboarding',
      description: 'Standardised client onboarding workflow.',
    },
  },
];
