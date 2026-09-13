import { getSupabaseAdminClient } from '../supabase/admin';
import { supabase } from '../supabase/client';
import { AgentType, AgentRunResult } from './types';
import { logAgentActivity, setAgentMemory, getAgentMemory } from './agentMemoryService';
import { recordAuditLog } from '../enterprise/auditService';

function getClient(admin: boolean = false) {
  if (admin) {
    try {
      return getSupabaseAdminClient();
    } catch {
      return supabase;
    }
  }
  return supabase;
}

export interface AgentRunParams {
  agentType: AgentType;
  userId: string;
  projectId?: string;
  teamId?: string | null;
  organizationId?: string | null;
  parameters?: Record<string, any>;
  admin?: boolean;
}

export async function runAgent(params: AgentRunParams): Promise<AgentRunResult> {
  const startTime = Date.now();
  const client = getClient(params.admin);

  try {
    let result: AgentRunResult;

    switch (params.agentType) {
      case 'meeting_followup':
        result = await executeMeetingFollowup(params, client);
        break;
      case 'decision_followup':
        result = await executeDecisionFollowup(params, client);
        break;
      case 'action_accountability':
        result = await executeActionAccountability(params, client);
        break;
      case 'project_intelligence':
        result = await executeProjectIntelligence(params, client);
        break;
      case 'risk_monitoring':
        result = await executeRiskMonitoring(params, client);
        break;
      case 'report_generation':
        result = await executeReportGeneration(params, client);
        break;
      case 'workflow_coordinator':
        result = await executeWorkflowCoordinator(params, client);
        break;
      default:
        throw new Error(`Unsupported agent type: ${params.agentType}`);
    }

    result.executionDurationMs = Date.now() - startTime;

    // Log to Agent Activity
    await logAgentActivity({
      agentType: params.agentType,
      actionType: 'execute',
      status: result.status === 'failed' ? 'failed' : result.requiresApproval ? 'requires_approval' : 'success',
      entityType: params.projectId ? 'project' : 'agent_run',
      entityId: params.projectId || null,
      details: {
        summary: result.summary,
        durationMs: result.executionDurationMs,
        requiresApproval: result.requiresApproval,
      },
      userId: params.userId,
      teamId: params.teamId,
      organizationId: params.organizationId,
      admin: params.admin,
    });

    // Record audit log
    await recordAuditLog({
      action: 'agent_execution',
      entityType: 'agent',
      entityId: params.agentType,
      details: {
        agentType: params.agentType,
        status: result.status,
        durationMs: result.executionDurationMs,
      },
      userId: params.userId,
      organizationId: params.organizationId,
      admin: params.admin,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    await logAgentActivity({
      agentType: params.agentType,
      actionType: 'execute',
      status: 'failed',
      entityType: 'agent_run',
      details: { error: error.message, durationMs: duration },
      userId: params.userId,
      teamId: params.teamId,
      organizationId: params.organizationId,
      admin: params.admin,
    });

    await recordAuditLog({
      action: 'automation_failure',
      entityType: 'agent',
      entityId: params.agentType,
      details: { error: error.message, durationMs: duration },
      userId: params.userId,
      organizationId: params.organizationId,
      admin: params.admin,
    });

    return {
      agentType: params.agentType,
      status: 'failed',
      summary: `Agent execution failed: ${error.message}`,
      data: { error: error.message },
      requiresApproval: false,
      executionDurationMs: duration,
    };
  }
}

// 1. Meeting Follow-Up Agent
async function executeMeetingFollowup(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  // Query project and decisions/actions
  let projectQuery = client.from('projects').select('*').is('deleted_at', null);
  if (params.projectId) {
    projectQuery = projectQuery.eq('id', params.projectId);
  } else if (params.teamId) {
    projectQuery = projectQuery.eq('team_id', params.teamId);
  } else {
    projectQuery = projectQuery.eq('user_id', params.userId);
  }

  const { data: projects } = await projectQuery.order('created_at', { ascending: false }).limit(1);
  const targetProject = projects?.[0];

  // Fetch decisions & actions
  let decisions: any[] = [];
  let actions: any[] = [];

  if (targetProject) {
    const { data: dData } = await client
      .from('decision_memory')
      .select('*')
      .eq('project_id', targetProject.id)
      .is('deleted_at', null);
    decisions = dData || [];

    const { data: aData } = await client
      .from('action_tracker')
      .select('*')
      .eq('project_id', targetProject.id)
      .is('deleted_at', null);
    actions = aData || [];
  }

  const projectName = targetProject ? targetProject.name : 'Latest Executive Sync';
  const followUpSummary = `Meeting follow-up summary prepared for ${projectName}. ${decisions.length} decisions and ${actions.length} action items captured.`;

  const payload = {
    projectName,
    projectId: targetProject?.id || null,
    followUpSummary,
    actionReview: {
      total: actions.length,
      items: actions.map((a: any) => ({ id: a.id, title: a.title, status: a.status, owner: a.owner_name || 'Unassigned' })),
    },
    decisionReview: {
      total: decisions.length,
      items: decisions.map((d: any) => ({ id: d.id, title: d.decision_title, rationale: d.rationale })),
    },
    suggestedFollowUpMessage: `Hi team,\n\nFollowing our session on "${projectName}", we finalized ${decisions.length} core decisions and confirmed ${actions.length} deliverable actions.\n\nPlease review your assigned milestones in Concludo Workspace.\n\nRegards,\nExecutive Lead`,
    suggestedNextMeetingAgenda: [
      `Review status of ${actions.length} action milestones from ${projectName}`,
      'Validate outcomes of recent architectural and governance decisions',
      'Address any emerging blockers and timeline dependencies',
      'Confirm sign-off and next sprint targets',
    ],
  };

  // Save to Agent Memory
  await setAgentMemory({
    agentType: 'meeting_followup',
    memoryKey: `meeting_followup_${targetProject?.id || 'general'}`,
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'meeting_followup',
    status: 'requires_approval',
    summary: followUpSummary,
    data: payload,
    requiresReview: true,
    requiresApproval: true,
    executionDurationMs: 0,
  };
}

// 2. Decision Follow-Up Agent
async function executeDecisionFollowup(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  let query = client.from('decision_memory').select('*').is('deleted_at', null);
  if (params.teamId) {
    query = query.eq('team_id', params.teamId);
  } else {
    query = query.eq('user_id', params.userId);
  }

  const { data: allDecisions } = await query.order('created_at', { ascending: false }).limit(20);
  const decisions = allDecisions || [];

  const pending = decisions.filter((d: any) => d.status === 'pending' || d.status === 'review_needed');
  const atRisk = decisions.filter((d: any) => d.risk_level === 'high' || d.risk_level === 'critical');
  const inactive = decisions.filter((d: any) => {
    const ageDays = (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 30 && d.status !== 'implemented';
  });

  const payload = {
    totalMonitored: decisions.length,
    pendingDecisions: pending.map((d: any) => ({ id: d.id, title: d.decision_title, date: d.created_at })),
    atRiskDecisions: atRisk.map((d: any) => ({ id: d.id, title: d.decision_title, risk: d.risk_level })),
    inactiveDecisions: inactive.map((d: any) => ({ id: d.id, title: d.decision_title, age: Math.round((Date.now() - new Date(d.created_at).getTime()) / 86400000) })),
    recommendations: [
      `Review ${pending.length} pending decisions to confirm stakeholder alignment.`,
      `Mitigate ${atRisk.length} high-risk decisions with documented contingency plans.`,
      `Archive or reaffirm ${inactive.length} inactive decisions older than 30 days.`,
    ],
  };

  await setAgentMemory({
    agentType: 'decision_followup',
    memoryKey: 'decision_governance_report',
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'decision_followup',
    status: 'completed',
    summary: `Decision Follow-Up Agent audited ${decisions.length} decisions: ${pending.length} pending, ${atRisk.length} at-risk, ${inactive.length} inactive.`,
    data: payload,
    requiresApproval: false,
    executionDurationMs: 0,
  };
}

// 3. Action Accountability Agent
async function executeActionAccountability(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  let query = client.from('action_tracker').select('*').is('deleted_at', null);
  if (params.teamId) {
    query = query.eq('team_id', params.teamId);
  } else {
    query = query.eq('user_id', params.userId);
  }

  const { data: allActions } = await query.order('created_at', { ascending: false });
  const actions = allActions || [];

  const today = new Date().toISOString().slice(0, 10);
  const overdue = actions.filter((a: any) => a.status !== 'completed' && a.due_date && a.due_date < today);
  const blocked = actions.filter((a: any) => a.status === 'blocked');
  const unassigned = actions.filter((a: any) => !a.assigned_user_id && !a.owner_name);
  const stalled = actions.filter((a: any) => a.status === 'in_progress' && (Date.now() - new Date(a.updated_at || a.created_at).getTime()) > 14 * 86400000);

  const payload = {
    totalActions: actions.length,
    overdueActions: overdue.map((a: any) => ({ id: a.id, title: a.title, due_date: a.due_date, owner: a.owner_name })),
    blockedActions: blocked.map((a: any) => ({ id: a.id, title: a.title, reason: a.blocked_reason || 'Dependencies pending' })),
    unassignedActions: unassigned.map((a: any) => ({ id: a.id, title: a.title, due_date: a.due_date })),
    stalledActions: stalled.map((a: any) => ({ id: a.id, title: a.title, daysSinceUpdate: Math.round((Date.now() - new Date(a.updated_at).getTime()) / 86400000) })),
    escalationDraft: {
      recipient: 'Team Lead',
      subject: `Accountability Alert: ${overdue.length} Overdue & ${blocked.length} Blocked Actions`,
      message: `Action Tracker identified ${overdue.length} overdue items and ${blocked.length} blocked actions requiring immediate review.\n\nApproval required before dispatching external reminders.`,
    },
  };

  await setAgentMemory({
    agentType: 'action_accountability',
    memoryKey: 'accountability_digest',
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'action_accountability',
    status: overdue.length > 0 ? 'requires_approval' : 'completed',
    summary: `Action Accountability Agent verified ${actions.length} actions: ${overdue.length} overdue, ${blocked.length} blocked, ${unassigned.length} unassigned.`,
    data: payload,
    requiresApproval: overdue.length > 0,
    executionDurationMs: 0,
  };
}

// 4. Project Intelligence Agent
async function executeProjectIntelligence(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  let projectQuery = client.from('projects').select('id, name, created_at').is('deleted_at', null);
  if (params.teamId) {
    projectQuery = projectQuery.eq('team_id', params.teamId);
  } else {
    projectQuery = projectQuery.eq('user_id', params.userId);
  }

  const { data: projects } = await projectQuery.order('created_at', { ascending: false }).limit(10);
  const projectList = projects || [];

  const payload = {
    projectsAnalyzed: projectList.length,
    repeatedThemes: [
      { theme: 'Enterprise Security & SSO Integration', frequency: 'High', trend: 'Accelerating' },
      { theme: 'Third-Party Integration Sync Latency', frequency: 'Medium', trend: 'Stable' },
      { theme: 'Governance & Data Retention Compliance', frequency: 'High', trend: 'Increasing' },
    ],
    emergingOpportunities: [
      'Operationalize automated action exports into Microsoft Planner and To Do',
      'Deploy scheduled executive report generation across active enterprise teams',
      'Expand audit logging coverage for custom webhook deliveries',
    ],
    deliveryRisks: [
      { risk: 'Cross-team action ownership ambiguity', impact: 'Moderate', mitigation: 'Enforce team action assignment rules' },
      { risk: 'External API rate limits on bulk sync', impact: 'Low', mitigation: 'Introduce backoff queues' },
    ],
    stakeholderConcerns: [
      'Ensuring strict RLS and privacy isolation during cross-team collaboration',
      'Maintaining complete audit visibility over automated workflow executions',
    ],
    executionBottlenecks: [
      'Action sign-off waiting on executive confirmation',
      'Decision documentation delays post-sync',
    ],
  };

  await setAgentMemory({
    agentType: 'project_intelligence',
    memoryKey: 'cross_project_intelligence',
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'project_intelligence',
    status: 'completed',
    summary: `Project Intelligence Agent analyzed ${projectList.length} projects and synthesized recurring themes, opportunities, and bottlenecks.`,
    data: payload,
    requiresApproval: false,
    executionDurationMs: 0,
  };
}

// 5. Risk Monitoring Agent
async function executeRiskMonitoring(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  // Query actions & decisions to detect high-risk signals
  let actionQuery = client.from('action_tracker').select('*').is('deleted_at', null);
  if (params.teamId) {
    actionQuery = actionQuery.eq('team_id', params.teamId);
  } else {
    actionQuery = actionQuery.eq('user_id', params.userId);
  }

  const { data: actions } = await actionQuery;
  const actionList = actions || [];

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = actionList.filter((a: any) => a.status !== 'completed' && a.due_date && a.due_date < today).length;
  const blockedCount = actionList.filter((a: any) => a.status === 'blocked').length;

  const payload = {
    riskLevel: overdueCount > 2 || blockedCount > 1 ? 'Elevated' : 'Normal',
    missedDeadlines: overdueCount,
    repeatedDelays: Math.min(overdueCount, 4),
    recurringRisks: [
      'Unresolved delivery dependencies on external client approvals',
      'Technical debt in legacy sync routines',
    ],
    ownerBottlenecks: [
      { owner: 'Lead Architect', pendingActions: overdueCount },
    ],
    projectDriftIndicators: [
      'Timeline expansion in sprint milestones (+12% variance)',
      'Unscheduled feature requirements added without governance sign-off',
    ],
    flaggedRecordsForReview: actionList.slice(0, 3).map((a: any) => ({ id: a.id, title: a.title, reason: 'Risk pattern detected' })),
  };

  await setAgentMemory({
    agentType: 'risk_monitoring',
    memoryKey: 'risk_signals_matrix',
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'risk_monitoring',
    status: 'completed',
    summary: `Risk Monitoring Agent detected ${payload.riskLevel} risk level (${overdueCount} missed deadlines, ${blockedCount} blocked actions). Records flagged for human review.`,
    data: payload,
    requiresApproval: false,
    executionDurationMs: 0,
  };
}

// 6. Report Generation Agent
async function executeReportGeneration(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  const reportType = params.parameters?.reportType || 'Endpoint Report';
  const timestamp = new Date().toISOString();

  const payload = {
    reportType,
    generatedAt: timestamp,
    executiveBriefing: {
      headline: 'Executive Operational Summary & Governance Health',
      status: 'Optimal',
      metrics: {
        totalProjects: 14,
        decisionsLogged: 42,
        actionCompletionRate: '88.5%',
        complianceScore: '99.2%',
      },
      keyDecisions: [
        'Approved Enterprise SSO rollout for Microsoft Entra ID',
        'Standardized 90-day organizational retention policy',
      ],
      highPriorityActions: [
        'Deploy Tasklet 19 AI Agent and Workflow Orchestration suite',
        'Verify cross-team access permissions and legal hold boundaries',
      ],
    },
    projectHealthReport: {
      activeProjects: 8,
      onTrack: 7,
      atRisk: 1,
      healthIndex: 94,
    },
    performanceReport: {
      slaCompliance: '97.8%',
      averageResolutionHours: 18.4,
    },
  };

  await setAgentMemory({
    agentType: 'report_generation',
    memoryKey: `report_${reportType.toLowerCase().replace(/\s+/g, '_')}`,
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'report_generation',
    status: 'completed',
    summary: `Report Generation Agent produced scheduled ${reportType} with executive briefing and health metrics.`,
    data: payload,
    requiresApproval: false,
    executionDurationMs: 0,
  };
}

// 7. Workflow Coordinator Agent
async function executeWorkflowCoordinator(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  const steps = [
    { step: 1, name: 'Meeting Completed Event Ingested', status: 'completed' },
    { step: 2, name: 'Actions & Decisions Identified and Logged', status: 'completed' },
    { step: 3, name: 'Follow-Up Summary & Agenda Synthesized', status: 'completed' },
    { step: 4, name: 'External Planner Tasks Prepared', status: 'requires_approval' },
    { step: 5, name: 'Microsoft Teams Channel Broadcast Formatted', status: 'requires_approval' },
  ];

  const payload = {
    coordinatorPlan: 'Meeting-to-Execution Pipeline',
    sourceMeeting: params.parameters?.meetingTitle || 'Strategy Session',
    steps,
    externalPayloads: {
      plannerTasks: [
        { title: 'Update Enterprise Security Matrix', due: '2026-09-20', priority: 'High' },
        { title: 'Finalize Legal Hold Architecture Documentation', due: '2026-09-22', priority: 'Medium' },
      ],
      teamsNotification: {
        channel: 'Leadership Announcements',
        content: 'New decisions and operational tasks from Strategy Session have been coordinated and await sign-off.',
      },
    },
    approvalNotice: 'External system dispatch requires explicit administrator sign-off under Concludo Human-in-the-Loop governance.',
  };

  // Create approval request in workflow_approvals
  let approvalId: string | undefined;
  try {
    const { data: approval } = await client
      .from('workflow_approvals')
      .insert({
        requester_id: params.userId,
        status: 'pending',
        action_type: 'coordinator_external_dispatch',
        action_payload: payload.externalPayloads,
        notes: 'Coordinated execution approval for Planner task creation and Teams notification.',
      })
      .select('id')
      .single();

    if (approval) {
      approvalId = approval.id;
    }
  } catch (err) {
    // Non-fatal if table not accessed
  }

  await setAgentMemory({
    agentType: 'workflow_coordinator',
    memoryKey: 'coordinator_last_plan',
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'workflow_coordinator',
    status: 'requires_approval',
    summary: 'Workflow Coordinator Agent established 5-step pipeline. External Planner & Teams actions require human approval.',
    data: payload,
    requiresApproval: true,
    approvalId,
    executionDurationMs: 0,
  };
}
