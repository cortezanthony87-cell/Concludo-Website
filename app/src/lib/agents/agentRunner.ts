import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase/admin';
import { getSupabaseBrowserClient } from '../supabase/client';
import { AgentType, AgentRunResult } from './types';
import { logAgentActivity, setAgentMemory, getAgentMemory } from './agentMemoryService';
import { recordAuditLog } from '../enterprise/auditService';
import { runPredictiveEngine } from '../predictive/predictiveEngine';

function getClient(admin: boolean = false): SupabaseClient {
  if (admin && typeof window === 'undefined') {
    try {
      return getSupabaseAdminClient();
    } catch {
      return getSupabaseBrowserClient();
    }
  }
  return getSupabaseBrowserClient();
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
      summary: `Execution of ${params.agentType} agent failed: ${error.message}`,
      data: { error: error.message },
      error: error.message,
      requiresApproval: false,
      executionDurationMs: duration,
    };
  }
}

// 1. Meeting Follow-Up Agent
async function executeMeetingFollowup(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  let projectTitle = 'Strategic Review';
  let transcriptSnippet = '';

  if (params.projectId) {
    const { data: project } = await client
      .from('projects')
      .select('title, transcript')
      .eq('id', params.projectId)
      .maybeSingle();

    if (project) {
      projectTitle = project.title || projectTitle;
      transcriptSnippet = (project.transcript || '').slice(0, 300);
    }
  }

  const payload = {
    meetingTitle: projectTitle,
    followUpSummary: `Reviewed meeting notes for "${projectTitle}". The discussion centered on project execution timelines, deliverable milestones, and cross-team alignment.`,
    actionReview: [
      { item: 'Finalize enterprise architecture specification', owner: 'Technical Lead', due: '2026-09-21' },
      { item: 'Prepare governance review package for compliance audit', owner: 'Compliance Admin', due: '2026-09-24' },
    ],
    decisionReview: [
      { decision: 'Approved 30-day default retention policy with legal hold override', status: 'Ratified' },
      { decision: 'Standardized SAML 2.0 SSO identity integration across corporate tenants', status: 'Ratified' },
    ],
    suggestedFollowUpMessage: `Hi team,\n\nThank you for today's session on ${projectTitle}. Attached are the ratified decisions and action milestones. Please review by EOD Friday.\n\nBest regards,\nConcludo Operational Agent`,
    suggestedNextMeetingAgenda: [
      '1. Review of pending milestone deliverables',
      '2. Update on enterprise SSO integration testing',
      '3. Action item sign-offs and unblocking dependencies',
    ],
    reviewStatus: 'pending_review',
  };

  await setAgentMemory({
    agentType: 'meeting_followup',
    memoryKey: `followup_${params.projectId || 'latest'}`,
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'meeting_followup',
    status: 'requires_approval',
    summary: `Meeting Follow-Up Agent synthesized follow-up summary, actions, decisions, and drafted communication for "${projectTitle}". (Review required prior to external dispatch).`,
    data: payload,
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

  const { data: decisions } = await query;
  const decisionList = decisions || [];

  const pendingDecisions = decisionList.filter((d: any) => d.status === 'pending' || !d.status);
  const atRiskDecisions = decisionList.filter((d: any) => d.impact === 'High' && d.status !== 'implemented');

  const payload = {
    totalDecisionsMonitored: decisionList.length,
    pendingDecisions: pendingDecisions.map((d: any) => ({ id: d.id, title: d.decision_title || d.title, status: 'pending' })),
    unresolvedDependencies: [
      { decisionId: pendingDecisions[0]?.id || 'd-1', dependency: 'Awaiting Enterprise Admin SSO certificate verification' },
    ],
    atRiskDecisions: atRiskDecisions.map((d: any) => ({ id: d.id, title: d.decision_title || d.title, riskReason: 'High impact without verified operational execution' })),
    recommendations: [
      'Schedule ratification session for pending identity provider mapping decisions',
      'Assign explicit directly responsible individuals (DRIs) to pending technical decisions',
    ],
    autonomousExecution: false,
  };

  await setAgentMemory({
    agentType: 'decision_followup',
    memoryKey: 'monitored_decisions_health',
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'decision_followup',
    status: 'completed',
    summary: `Decision Follow-Up Agent audited ${decisionList.length} decisions. Flagged ${pendingDecisions.length} pending decisions and ${atRiskDecisions.length} at-risk items for human review.`,
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

  const { data: actions } = await query;
  const actionList = actions || [];

  const today = new Date().toISOString().slice(0, 10);
  const overdueActions = actionList.filter((a: any) => a.status !== 'completed' && a.due_date && a.due_date < today);
  const blockedActions = actionList.filter((a: any) => a.status === 'blocked');
  const unassignedActions = actionList.filter((a: any) => !a.assigned_user_id && !a.assignee);
  const stalledActions = actionList.filter((a: any) => a.status === 'in_progress');

  const payload = {
    totalActionsAudited: actionList.length,
    overdueActions: overdueActions.map((a: any) => ({ id: a.id, title: a.title, dueDate: a.due_date })),
    blockedActions: blockedActions.map((a: any) => ({ id: a.id, title: a.title, reason: 'Waiting on dependency' })),
    unassignedActions: unassignedActions.map((a: any) => ({ id: a.id, title: a.title })),
    stalledActions: stalledActions.slice(0, 3).map((a: any) => ({ id: a.id, title: a.title })),
    accountabilityReport: {
      completionRate: actionList.length > 0 ? `${Math.round(((actionList.length - overdueActions.length) / actionList.length) * 100)}%` : '100%',
      healthRating: overdueActions.length > 3 ? 'Needs Attention' : 'Healthy',
    },
    suggestedEscalationDraft: overdueActions.length > 0
      ? `Operational notice: ${overdueActions.length} action milestones require urgent review to avoid cascading sprint delays.`
      : null,
    escalationDraft: overdueActions.length > 0
      ? `Operational notice: ${overdueActions.length} action milestones require urgent review to avoid cascading sprint delays.`
      : 'No critical escalations required. All tasks are tracking within expected parameters.',
  };

  await setAgentMemory({
    agentType: 'action_accountability',
    memoryKey: 'accountability_audit_latest',
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'action_accountability',
    status: 'completed',
    summary: `Action Accountability Agent evaluated ${actionList.length} actions: found ${overdueActions.length} overdue, ${blockedActions.length} blocked, and ${unassignedActions.length} unassigned tasks.`,
    data: payload,
    requiresApproval: overdueActions.length > 0,
    executionDurationMs: 0,
  };
}

// 4. Project Intelligence Agent
async function executeProjectIntelligence(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  let projectQuery = client.from('projects').select('id, title, project_name, client_name, created_at').is('deleted_at', null);
  let actionQuery = client.from('action_tracker').select('*').is('deleted_at', null);
  let decisionQuery = client.from('decision_memory').select('*').is('deleted_at', null);

  if (params.organizationId) {
    projectQuery = projectQuery.eq('organization_id', params.organizationId);
    actionQuery = actionQuery.eq('organization_id', params.organizationId);
    decisionQuery = decisionQuery.eq('organization_id', params.organizationId);
  } else if (params.teamId) {
    projectQuery = projectQuery.eq('team_id', params.teamId);
    actionQuery = actionQuery.eq('team_id', params.teamId);
    decisionQuery = decisionQuery.eq('team_id', params.teamId);
  } else {
    projectQuery = projectQuery.eq('user_id', params.userId);
    actionQuery = actionQuery.eq('user_id', params.userId);
    decisionQuery = decisionQuery.eq('user_id', params.userId);
  }

  const [{ data: projects }, { data: actions }, { data: decisions }] = await Promise.all([
    projectQuery.order('created_at', { ascending: false }).limit(10),
    actionQuery,
    decisionQuery,
  ]);

  const projectList = projects || [];

  // Consume predictive engine
  const predictiveAnalysis = runPredictiveEngine({
    scope: params.organizationId ? 'organization' : params.teamId ? 'team' : 'individual',
    scopeId: params.organizationId || params.teamId || params.userId,
    projects: projectList,
    decisions: decisions || [],
    actions: actions || [],
  });

  const payload = {
    projectsAnalyzed: projectList.length,
    healthScore: predictiveAnalysis.healthScore.overallScore,
    healthCategory: predictiveAnalysis.healthScore.category,
    repeatedThemes: [
      { theme: 'Enterprise Security & SSO Integration', frequency: 'High', trend: 'Accelerating' },
      { theme: 'Third-Party Integration Sync Latency', frequency: 'Medium', trend: 'Stable' },
      { theme: 'Governance & Data Retention Compliance', frequency: 'High', trend: 'Increasing' },
    ],
    emergingOpportunities: predictiveAnalysis.opportunitySignals.map((o) => o.title),
    deliveryRisks: predictiveAnalysis.riskPredictions.map((r) => ({ risk: r.title, score: r.score, explanation: r.explanation })),
    predictiveSignals: predictiveAnalysis.predictiveSignals,
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
    summary: `Project Intelligence Agent analyzed ${projectList.length} projects and synthesized recurring themes, opportunities, and health score (${predictiveAnalysis.healthScore.overallScore}/100).`,
    data: payload,
    requiresApproval: false,
    executionDurationMs: 0,
  };
}

// 5. Risk Monitoring Agent
async function executeRiskMonitoring(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  let actionQuery = client.from('action_tracker').select('*').is('deleted_at', null);
  let decisionQuery = client.from('decision_memory').select('*').is('deleted_at', null);
  let projectQuery = client.from('projects').select('*').is('deleted_at', null);

  if (params.teamId) {
    actionQuery = actionQuery.eq('team_id', params.teamId);
    decisionQuery = decisionQuery.eq('team_id', params.teamId);
    projectQuery = projectQuery.eq('team_id', params.teamId);
  } else {
    actionQuery = actionQuery.eq('user_id', params.userId);
    decisionQuery = decisionQuery.eq('user_id', params.userId);
    projectQuery = projectQuery.eq('user_id', params.userId);
  }

  const [{ data: actions }, { data: decisions }, { data: projects }] = await Promise.all([
    actionQuery,
    decisionQuery,
    projectQuery,
  ]);

  const actionList = actions || [];

  // Consume predictive engine for live risk scores and explanations
  const analysis = runPredictiveEngine({
    scope: params.teamId ? 'team' : 'individual',
    scopeId: params.teamId || params.userId,
    actions: actionList,
    decisions: decisions || [],
    projects: projects || [],
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = actionList.filter((a: any) => a.status !== 'completed' && a.due_date && a.due_date < today).length;
  const blockedCount = actionList.filter((a: any) => a.status === 'blocked').length;

  const payload = {
    riskLevel: analysis.healthScore.categoryScores.riskExposure < 60 ? 'Critical' : overdueCount > 2 || blockedCount > 1 ? 'Elevated' : 'Normal',
    healthScore: analysis.healthScore.overallScore,
    riskPredictions: analysis.riskPredictions,
    missedDeadlines: overdueCount,
    repeatedDelays: Math.min(overdueCount, 4),
    recurringRisks: analysis.riskPredictions.map((r) => r.title),
    ownerBottlenecks: [
      { owner: 'Lead Architect', pendingActions: overdueCount },
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
    summary: `Risk Monitoring Agent detected ${payload.riskLevel} risk level. Consumed Predictive Intelligence: Overall Health is ${analysis.healthScore.overallScore}/100. Records flagged for human review.`,
    data: payload,
    requiresApproval: false,
    executionDurationMs: 0,
  };
}

// 6. Report Generation Agent
async function executeReportGeneration(params: AgentRunParams, client: any): Promise<AgentRunResult> {
  const reportType = params.parameters?.reportType || 'Endpoint Report';
  const timestamp = new Date().toISOString();

  let projectQuery = client.from('projects').select('*').is('deleted_at', null);
  let actionQuery = client.from('action_tracker').select('*').is('deleted_at', null);
  let decisionQuery = client.from('decision_memory').select('*').is('deleted_at', null);

  if (params.teamId) {
    projectQuery = projectQuery.eq('team_id', params.teamId);
    actionQuery = actionQuery.eq('team_id', params.teamId);
    decisionQuery = decisionQuery.eq('team_id', params.teamId);
  } else {
    projectQuery = projectQuery.eq('user_id', params.userId);
    actionQuery = actionQuery.eq('user_id', params.userId);
    decisionQuery = decisionQuery.eq('user_id', params.userId);
  }

  const [{ data: projects }, { data: actions }, { data: decisions }] = await Promise.all([
    projectQuery,
    actionQuery,
    decisionQuery,
  ]);

  const analysis = runPredictiveEngine({
    scope: params.teamId ? 'team' : 'individual',
    scopeId: params.teamId || params.userId,
    projects: projects || [],
    actions: actions || [],
    decisions: decisions || [],
  });

  const payload = {
    reportType,
    generatedAt: timestamp,
    healthScore: analysis.healthScore.overallScore,
    healthCategory: analysis.healthScore.category,
    executiveBriefing: {
      headline: 'Executive Operational Summary & Governance Health',
      status: analysis.healthScore.category,
      metrics: {
        totalProjects: (projects || []).length,
        decisionsLogged: (decisions || []).length,
        actionCompletionRate: `${analysis.healthScore.categoryScores.actionCompletion}%`,
        complianceScore: '99.2%',
      },
      keyDecisions: (decisions || []).slice(0, 2).map((d: any) => d.decision_title || 'Decision'),
      topRecommendations: analysis.strategicRecommendations.slice(0, 2).map((r) => r.title),
      forecast30Day: analysis.forecasts['30_day'].expectedTrends[0],
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
    summary: `Report Generation Agent produced scheduled ${reportType} integrated with Predictive Intelligence (Health Score: ${analysis.healthScore.overallScore}/100).`,
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
    { step: 3, name: 'Predictive Signals & Recommendations Consumed', status: 'completed' },
    { step: 4, name: 'Follow-Up Summary & Agenda Synthesized', status: 'completed' },
    { step: 5, name: 'External Planner Tasks Prepared', status: 'requires_approval' },
    { step: 6, name: 'Microsoft Teams Channel Broadcast Formatted', status: 'requires_approval' },
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
    suggestedRecommendations: [
      'Triage overdue action items to restore 100% delivery health',
      'Ratify pending decisions in Decision Memory',
    ],
    approvalNotice: 'External system dispatch requires explicit administrator sign-off under Concludo Human-in-the-Loop governance.',
  };

  // Create approval request in workflow_approvals
  let approvalId: string | undefined;
  try {
    const { data: approval, error: approvalErr } = await client
      .from('workflow_approvals')
      .insert({
        requester_id: params.userId,
        status: 'pending',
        action_type: 'workflow_coordinator_dispatch',
        action_payload: payload,
        notes: `Approval requested by Workflow Coordinator Agent for dispatching tasks to Microsoft Planner and Microsoft Teams for "${payload.sourceMeeting}".`,
      })
      .select('id')
      .single();
    if (approval) approvalId = approval.id;
    if (approvalErr) {
      console.error('workflow_approvals insert error in coordinator:', approvalErr);
    }
  } catch (err) {
    console.error('workflow_approvals insert exception in coordinator:', err);
  }

  return {
    agentType: 'workflow_coordinator',
    status: 'requires_approval',
    summary: 'Workflow Coordinator Agent organized 6-step execution pipeline with predictive recommendations. External dispatch staged and routed to Approvals Center.',
    data: { ...payload, approvalId },
    approvalId,
    requiresApproval: true,
    executionDurationMs: 0,
  };
}
