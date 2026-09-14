export type AgentType =
  | 'meeting_followup'
  | 'decision_followup'
  | 'action_accountability'
  | 'project_intelligence'
  | 'risk_monitoring'
  | 'report_generation'
  | 'workflow_coordinator';

export interface AgentDefinition {
  id: AgentType;
  name: string;
  description: string;
  purpose: string;
  category: 'Meeting & Decisions' | 'Operations & Tasks' | 'Intelligence & Risk' | 'Orchestration';
  requiresReview: boolean;
  scheduleSupport: boolean;
  supportedOutputs: string[];
}

export const INITIAL_AGENTS: AgentDefinition[] = [
  {
    id: 'meeting_followup',
    name: 'Meeting Follow-Up Agent',
    description: 'Reviews completed meetings to generate follow-up summaries, reviews actions and decisions, and drafts follow-up messages and next agendas.',
    purpose: 'Transform completed meeting transcripts and outputs into structured follow-up summaries and next-meeting agendas with human review.',
    category: 'Meeting & Decisions',
    requiresReview: true,
    scheduleSupport: true,
    supportedOutputs: [
      'Follow-Up Summary',
      'Action Review',
      'Decision Review',
      'Suggested Follow-Up Message',
      'Suggested Next Meeting Agenda',
    ],
  },
  {
    id: 'decision_followup',
    name: 'Decision Follow-Up Agent',
    description: 'Monitors saved decisions across memory to detect pending decisions, unresolved dependencies, inactive decisions, and at-risk decisions.',
    purpose: 'Provide governance oversight and recommendations for saved decisions without autonomous mutation.',
    category: 'Meeting & Decisions',
    requiresReview: true,
    scheduleSupport: true,
    supportedOutputs: [
      'Pending Decisions',
      'Unresolved Dependencies',
      'Inactive Decisions',
      'At-Risk Decisions',
      'Governance Recommendations',
    ],
  },
  {
    id: 'action_accountability',
    name: 'Action Accountability Agent',
    description: 'Monitors the Action Tracker to surface overdue actions, blocked items, unassigned commitments, and stalled workflows.',
    purpose: 'Keep teams accountable with progress reports and structured escalation workflows requiring human approval.',
    category: 'Operations & Tasks',
    requiresReview: true,
    scheduleSupport: true,
    supportedOutputs: [
      'Overdue Actions Report',
      'Blocked Actions Register',
      'Unassigned Actions List',
      'Stalled Action Alerts',
      'Escalation Drafts',
    ],
  },
  {
    id: 'project_intelligence',
    name: 'Project Intelligence Agent',
    description: 'Monitors meeting history across projects to extract repeated themes, emerging opportunities, delivery risks, and execution bottlenecks.',
    purpose: 'Deliver cross-project intelligence briefs and strategic patterns synthesized from conversation memory.',
    category: 'Intelligence & Risk',
    requiresReview: false,
    scheduleSupport: true,
    supportedOutputs: [
      'Repeated Themes Synthesis',
      'Emerging Opportunities Digest',
      'Delivery Risks Analysis',
      'Stakeholder Concerns Map',
      'Execution Bottlenecks Register',
    ],
  },
  {
    id: 'risk_monitoring',
    name: 'Risk Monitoring Agent',
    description: 'Detects patterns indicating missed deadlines, repeated delays, recurring risks, owner bottlenecks, and project scope drift.',
    purpose: 'Flag high-risk patterns for administrative review with zero autonomous intervention.',
    category: 'Intelligence & Risk',
    requiresReview: true,
    scheduleSupport: true,
    supportedOutputs: [
      'Deadline Breach Patterns',
      'Repeated Delays Index',
      'Recurring Risk Flags',
      'Owner Bottleneck Analysis',
      'Project Drift Warnings',
    ],
  },
  {
    id: 'report_generation',
    name: 'Report Generation Agent',
    description: 'Generates recurring or on-demand Endpoint Reports, Executive Briefings, Project Health Reports, and Performance Reports on schedule.',
    purpose: 'Produce auditable governance, executive, and health reports according to organizational schedules.',
    category: 'Intelligence & Risk',
    requiresReview: false,
    scheduleSupport: true,
    supportedOutputs: [
      'Endpoint Reports',
      'Executive Briefings',
      'Project Health Reports',
      'Decision Audit Reports',
      'Action Performance Reports',
    ],
  },
  {
    id: 'workflow_coordinator',
    name: 'Workflow Coordinator Agent',
    description: 'Coordinates multi-step end-to-end workflows (e.g. Meeting Completed → Actions Identified → Decisions Saved → Planner Tasks → Notifications).',
    purpose: 'Orchestrate multi-step pipelines while enforcing human approval before any external execution or dispatch.',
    category: 'Orchestration',
    requiresReview: true,
    scheduleSupport: true,
    supportedOutputs: [
      'Multi-Step Execution Plan',
      'Task Generation Payload',
      'Integration Dispatch Payloads',
      'Approval Request Package',
    ],
  },
];

export interface AgentMemoryRecord {
  id: string;
  agent_type: AgentType | string;
  owner_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  memory_key: string;
  memory_value: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface AgentActivityRecord {
  id: string;
  agent_type: AgentType | string;
  action_type: string;
  status: 'success' | 'failed' | 'pending' | 'requires_approval' | 'skipped';
  entity_type?: string | null;
  entity_id?: string | null;
  details: Record<string, any>;
  user_id?: string | null;
  team_id?: string | null;
  organization_id?: string | null;
  created_at: string;
}

export interface AgentRunResult {
  agentType: AgentType;
  status: 'completed' | 'requires_approval' | 'failed';
  summary: string;
  data: Record<string, any>;
  requiresApproval: boolean;
  requiresReview?: boolean;
  approvalId?: string;
  executionDurationMs: number;
  error?: string;
}
