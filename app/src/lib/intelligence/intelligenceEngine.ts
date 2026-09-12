import { SupabaseClient } from '@supabase/supabase-js';
import {
  InsightData,
  StatsData,
  StatsPeriodFilter,
  KeyTheme,
  IdentifiedRisk,
  IdentifiedOpportunity,
  RecurringDecision,
  FrequentlyAssignedAction,
  DiscussedTopic,
  TrendDataPoint,
  TeamMemberParticipation,
} from './types';
import { getSupabaseClient } from '../supabase/client';

export interface ProcessIntelligenceOptions {
  supabase?: SupabaseClient;
  periodFilter?: StatsPeriodFilter;
  forceRefresh?: boolean;
  workspaceScope?: 'personal' | 'team';
  teamId?: string;
}

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  meeting_type?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  meeting_date?: string | null;
  transcript?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  team_id?: string | null;
  ownership_type?: string | null;
}

interface OutputRow {
  id: string;
  project_id: string;
  output_type: string;
  content: string;
  created_at: string;
}

interface DecisionRow {
  id: string;
  project_id: string;
  decision_title: string;
  decision_summary?: string | null;
  decision_reasoning?: string | null;
  decision_owner?: string | null;
  decision_date?: string | null;
  created_at: string;
  team_id?: string | null;
}

interface ActionRow {
  id: string;
  project_id: string;
  action_title: string;
  action_description?: string | null;
  owner_name?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  due_date?: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  team_id?: string | null;
}

/**
 * Filter date calculation helper
 */
export function getFilterStartDate(filter: StatsPeriodFilter): Date | null {
  const now = new Date();
  if (filter === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (filter === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (filter === '6m') return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  if (filter === '12m') return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  return null;
}

/**
 * Core Intelligence Engine
 * Processes active projects, transcripts, outputs, decisions, and actions into structured intelligence.
 * Supports Personal and Team workspaces.
 */
export async function processUserIntelligence(
  userId: string,
  options?: ProcessIntelligenceOptions
): Promise<{ insight: InsightData; stats: StatsData }> {
  const supabase = options?.supabase || getSupabaseClient();
  const periodFilter = options?.periodFilter || 'all';
  const filterDate = getFilterStartDate(periodFilter);
  const isTeam = options?.workspaceScope === 'team' && !!options.teamId;
  const teamId = options?.teamId;

  // 1. Fetch active records (respecting Tasklet 11 retention: deleted_at is null)
  let rawProjects: ProjectRow[] = [];
  let rawOutputs: OutputRow[] = [];
  let rawDecisions: DecisionRow[] = [];
  let rawActions: ActionRow[] = [];
  let teamMembersData: any[] = [];

  if (isTeam && teamId) {
    // Team records
    const [projRes, decRes, actRes, memRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('team_id', teamId)
        .is('deleted_at', null)
        .order('meeting_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('decision_memory')
        .select('*')
        .eq('team_id', teamId)
        .is('deleted_at', null)
        .order('decision_date', { ascending: false }),
      supabase
        .from('action_tracker')
        .select('*')
        .eq('team_id', teamId)
        .is('deleted_at', null)
        .order('due_date', { ascending: true }),
      supabase
        .from('team_members')
        .select('user_id, role, profiles:user_id(id, full_name, email)')
        .eq('team_id', teamId),
    ]);

    if (projRes.error) throw new Error(projRes.error.message);
    if (decRes.error) throw new Error(decRes.error.message);
    if (actRes.error) throw new Error(actRes.error.message);

    rawProjects = (projRes.data as ProjectRow[]) || [];
    rawDecisions = (decRes.data as DecisionRow[]) || [];
    rawActions = (actRes.data as ActionRow[]) || [];
    teamMembersData = memRes.data || [];

    const projectIds = rawProjects.map((p) => p.id);
    if (projectIds.length > 0) {
      const { data: outs, error: outErr } = await supabase
        .from('outputs')
        .select('id, project_id, output_type, content, created_at')
        .in('project_id', projectIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (!outErr && outs) {
        rawOutputs = outs as OutputRow[];
      }
    }
  } else {
    // Personal records
    let projectsQuery = supabase
      .from('projects')
      .select('id, user_id, title, meeting_type, client_name, project_name, meeting_date, transcript, notes, created_at, updated_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('meeting_date', { ascending: false, nullsFirst: false });

    let outputsQuery = supabase
      .from('outputs')
      .select('id, project_id, output_type, content, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    let decisionsQuery = supabase
      .from('decision_memory')
      .select('id, project_id, decision_title, decision_summary, decision_reasoning, decision_owner, decision_date, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('decision_date', { ascending: false });

    let actionsQuery = supabase
      .from('action_tracker')
      .select('id, project_id, action_title, action_description, owner_name, due_date, status, created_at, updated_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    const [
      { data: projectsData, error: projErr },
      { data: outputsData, error: outErr },
      { data: decisionsData, error: decErr },
      { data: actionsData, error: actErr },
    ] = await Promise.all([
      projectsQuery,
      outputsQuery,
      decisionsQuery,
      actionsQuery,
    ]);

    if (projErr) throw new Error(`Failed to load projects for intelligence: ${projErr.message}`);
    if (outErr) throw new Error(`Failed to load outputs for intelligence: ${outErr.message}`);
    if (decErr) throw new Error(`Failed to load decisions for intelligence: ${decErr.message}`);
    if (actErr) throw new Error(`Failed to load actions for intelligence: ${actErr.message}`);

    rawProjects = (projectsData as ProjectRow[]) || [];
    rawOutputs = (outputsData as OutputRow[]) || [];
    rawDecisions = (decisionsData as DecisionRow[]) || [];
    rawActions = (actionsData as ActionRow[]) || [];
  }

  // Filter by period if needed
  const filteredProjects = filterDate
    ? rawProjects.filter((p) => new Date(p.meeting_date || p.created_at) >= filterDate)
    : rawProjects;

  const validProjectIds = new Set(filteredProjects.map((p) => p.id));

  const filteredOutputs = rawOutputs.filter((o) => validProjectIds.has(o.project_id));
  const filteredDecisions = rawDecisions.filter((d) => validProjectIds.has(d.project_id));
  const filteredActions = rawActions.filter((a) => validProjectIds.has(a.project_id));

  // ==========================================
  // INSIGHT SYNTHESIS
  // ==========================================

  // A. Key Themes
  const themeFrequencies: Record<string, { count: number; desc: string }> = {};

  filteredProjects.forEach((p) => {
    if (p.meeting_type) {
      themeFrequencies[p.meeting_type] = {
        count: (themeFrequencies[p.meeting_type]?.count || 0) + 1,
        desc: `Recurring discussions focused on ${p.meeting_type.toLowerCase()} initiatives.`,
      };
    }
    if (p.project_name) {
      themeFrequencies[p.project_name] = {
        count: (themeFrequencies[p.project_name]?.count || 0) + 1,
        desc: `Project focus stream for ${p.project_name}.`,
      };
    }
  });

  if (Object.keys(themeFrequencies).length === 0) {
    themeFrequencies['Strategic Planning'] = {
      count: 1,
      desc: 'High-level business planning and executive governance discussions.',
    };
  }

  const keyThemes: KeyTheme[] = Object.entries(themeFrequencies)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data], idx) => ({
      id: `theme-${idx + 1}`,
      name,
      count: data.count,
      description: data.desc,
      relevance: Math.min(100, 70 + data.count * 10),
    }));

  // B. Top Risks
  const overdueActions = filteredActions.filter((a) => {
    if (a.status === 'completed') return false;
    if (a.status === 'overdue') return true;
    if (!a.due_date) return false;
    const due = new Date(a.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  });

  const topRisks: IdentifiedRisk[] = [];
  if (overdueActions.length > 0) {
    topRisks.push({
      id: 'risk-overdue-actions',
      title: 'Action Item Delivery Risk',
      severity: overdueActions.length > 3 ? 'high' : 'medium',
      count: overdueActions.length,
      description: `${overdueActions.length} action item(s) have passed their due date without completion.`,
      mitigationRecommendation:
        'Review blocked and overdue actions on the Actions Tracker and reassign immediate owners.',
    });
  }

  const blockedActions = filteredActions.filter((a) => a.status === 'blocked');
  if (blockedActions.length > 0) {
    topRisks.push({
      id: 'risk-blocked-items',
      title: 'Workflow Blockers Identified',
      severity: 'high',
      count: blockedActions.length,
      description: `${blockedActions.length} tracked item(s) are actively marked as blocked.`,
      mitigationRecommendation:
        'Convene an unblocking sync with relevant project leads to resolve dependencies.',
    });
  }

  topRisks.push({
    id: 'risk-scope-governance',
    title: 'Cross-Meeting Alignment & Follow-Up Risk',
    severity: 'low',
    count: Math.max(1, filteredProjects.length),
    description: 'Multiple deliverables spanning various client accounts require recurring verification.',
    mitigationRecommendation:
      'Publish unified endpoint briefings after milestone reviews to ensure stakeholder lock-step.',
  });

  // C. Top Opportunities
  const topOpportunities: IdentifiedOpportunity[] = [
    {
      id: 'opp-workspace-scale',
      title: 'Account Expansion & Scale',
      impact: 'high',
      count: filteredProjects.length,
      description: 'Centralised decision capture provides strong auditability for enterprise account expansion.',
      nextStep: 'Leverage Decision Memory to demonstrate clear governance in quarterly reviews.',
    },
    {
      id: 'opp-automation-velocity',
      title: 'Operational Workflow Acceleration',
      impact: 'medium',
      count: filteredActions.length,
      description: 'Streamlined action accountability enables faster turnaround on client commitments.',
      nextStep: 'Enforce target due dates during initial meeting synthesis.',
    },
  ];

  // D. Recurring Decisions
  const recurringDecisions: RecurringDecision[] = filteredDecisions.slice(0, 5).map((d) => ({
    id: d.id,
    title: d.decision_title,
    owner: d.decision_owner,
    date: d.decision_date,
    summary: d.decision_summary,
  }));

  // E. Most Discussed Topics
  const topicMap: Record<string, number> = {};
  filteredProjects.forEach((p) => {
    if (p.meeting_type) topicMap[p.meeting_type] = (topicMap[p.meeting_type] || 0) + 1;
    if (p.client_name) topicMap[p.client_name] = (topicMap[p.client_name] || 0) + 1;
    if (p.project_name) topicMap[p.project_name] = (topicMap[p.project_name] || 0) + 1;
  });

  const totalTopicMentions = Object.values(topicMap).reduce((a, b) => a + b, 0) || 1;
  const mostDiscussedTopics: DiscussedTopic[] = Object.entries(topicMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, mentions]) => ({
      topic,
      mentions,
      percentage: Math.round((mentions / totalTopicMentions) * 100),
      category: 'Discussion Driver',
    }));

  // F. Frequently Assigned Actions
  const ownerStats: Record<string, { total: number; open: number; completed: number; overdue: number }> = {};
  filteredActions.forEach((a) => {
    const owner = a.assigned_user_name || a.owner_name || 'Unassigned';
    if (!ownerStats[owner]) {
      ownerStats[owner] = { total: 0, open: 0, completed: 0, overdue: 0 };
    }
    ownerStats[owner].total++;
    if (a.status === 'completed') {
      ownerStats[owner].completed++;
    } else {
      ownerStats[owner].open++;
      if (a.status === 'overdue' || (a.due_date && new Date(a.due_date) < new Date())) {
        ownerStats[owner].overdue++;
      }
    }
  });

  const frequentlyAssignedActions: FrequentlyAssignedAction[] = Object.entries(ownerStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([owner, stats]) => ({
      owner,
      ...stats,
    }));

  // G. Open Action Trends & Overdue Action Trends
  const notStartedCount = filteredActions.filter((a) => a.status === 'not_started').length;
  const inProgressCount = filteredActions.filter(
    (a) => a.status === 'in_progress' || a.status === 'overdue'
  ).length;
  const blockedCount = filteredActions.filter((a) => a.status === 'blocked').length;
  const totalOpen = filteredActions.filter((a) => a.status !== 'completed').length;

  const openActionTrends = {
    notStarted: notStartedCount,
    inProgress: inProgressCount,
    blocked: blockedCount,
    totalOpen,
  };

  const overdueActionTrends = {
    count: overdueActions.length,
    percentageOfOpen: totalOpen > 0 ? Math.round((overdueActions.length / totalOpen) * 100) : 0,
    criticalActions: overdueActions.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.action_title,
      owner: a.assigned_user_name || a.owner_name,
      dueDate: a.due_date,
    })),
  };

  // H. Project Intelligence Summary
  const avgDecisionsPerProject =
    filteredProjects.length > 0 ? Number((filteredDecisions.length / filteredProjects.length).toFixed(1)) : 0;
  const avgActionsPerProject =
    filteredProjects.length > 0 ? Number((filteredActions.length / filteredProjects.length).toFixed(1)) : 0;

  let healthScore = 85;
  if (totalOpen > 0) {
    const overdueRatio = overdueActions.length / totalOpen;
    healthScore = Math.max(30, Math.min(100, Math.round(90 - overdueRatio * 50)));
  }

  const projectIntelligenceSummary = {
    totalProjects: filteredProjects.length,
    avgDecisionsPerProject,
    avgActionsPerProject,
    meetingHealthScore: healthScore,
    summaryText: isTeam
      ? `Team analysis across ${filteredProjects.length} shared projects yielded ${filteredDecisions.length} recorded decisions and ${filteredActions.length} tracked actions. Team execution health is currently ${healthScore}%.`
      : `Analysis across ${filteredProjects.length} projects yielded ${filteredDecisions.length} recorded decisions and ${filteredActions.length} tracked actions. Execution velocity is operating at ${healthScore}% organizational health.`,
  };

  const insightData: InsightData = {
    keyThemes,
    topRisks,
    topOpportunities,
    recurringDecisions,
    frequentlyAssignedActions,
    mostDiscussedTopics,
    openActionTrends,
    overdueActionTrends,
    projectIntelligenceSummary,
    generatedAt: new Date().toISOString(),
    workspaceScope: isTeam ? 'team' : 'personal',
    teamId: isTeam ? teamId : null,
  };

  // ==========================================
  // STATS & TRENDS SYNTHESIS
  // ==========================================
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  let projectsThisMonth = 0;
  let projectsThisQuarter = 0;
  let projectsThisYear = 0;

  filteredProjects.forEach((p) => {
    const d = new Date(p.meeting_date || p.created_at);
    if (d.getFullYear() === currentYear) {
      projectsThisYear++;
      if (Math.floor(d.getMonth() / 3) === currentQuarter) {
        projectsThisQuarter++;
      }
      if (d.getMonth() === currentMonth) {
        projectsThisMonth++;
      }
    }
  });

  const completedActions = filteredActions.filter((a) => a.status === 'completed').length;
  const actionCompletionRate =
    filteredActions.length > 0 ? Math.round((completedActions / filteredActions.length) * 100) : 0;

  // Monthly trends generation (last 6 months)
  const monthLabels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
    monthLabels.push(label);
  }

  const countByMonth = (items: Array<{ created_at: string }>): TrendDataPoint[] => {
    const map: Record<string, number> = {};
    monthLabels.forEach((lbl) => (map[lbl] = 0));

    items.forEach((item) => {
      const d = new Date(item.created_at);
      const lbl = d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
      if (map[lbl] !== undefined) {
        map[lbl]++;
      }
    });

    return monthLabels.map((period) => ({ period, count: map[period] || 0 }));
  };

  const projectsCreatedTrend = countByMonth(filteredProjects);
  const actionsCreatedTrend = countByMonth(filteredActions);
  const actionsCompletedTrend = countByMonth(
    filteredActions.filter((a) => a.status === 'completed').map((a) => ({ created_at: a.updated_at || a.created_at }))
  );
  const decisionsCreatedTrend = countByMonth(filteredDecisions);
  const meetingVolumeTrend = projectsCreatedTrend;
  const outputGenerationTrend = countByMonth(filteredOutputs);

  // Team Participation calculation if in Team scope
  let teamParticipation: TeamMemberParticipation[] | undefined = undefined;
  if (isTeam && teamMembersData.length > 0) {
    teamParticipation = teamMembersData.map((mem) => {
      const profile = mem.profiles;
      const memId = mem.user_id;
      const memName = profile?.full_name || profile?.email || 'Team Member';

      const memProjects = filteredProjects.filter((p) => p.user_id === memId).length;
      const memDecisions = filteredDecisions.filter(
        (d) => (d as any).decision_owner?.toLowerCase().includes(memName.toLowerCase()) || (d as any).user_id === memId
      ).length;
      const memActions = filteredActions.filter(
        (a) => a.assigned_user_id === memId || a.owner_name?.toLowerCase().includes(memName.toLowerCase())
      );
      const memActionsAssigned = memActions.length;
      const memActionsCompleted = memActions.filter((a) => a.status === 'completed').length;

      return {
        memberId: memId,
        name: memName,
        projectsCount: memProjects,
        decisionsCount: memDecisions,
        actionsAssigned: memActionsAssigned,
        actionsCompleted: memActionsCompleted,
      };
    });
  }

  const statsData: StatsData = {
    totalProjects: filteredProjects.length,
    totalTranscripts: filteredProjects.filter((p) => p.transcript && p.transcript.length > 0).length,
    totalDecisions: filteredDecisions.length,
    totalActions: filteredActions.length,
    completedActions,
    openActions: totalOpen,
    overdueActions: overdueActions.length,
    projectsThisMonth,
    projectsThisQuarter,
    projectsThisYear,
    actionCompletionRate,
    decisionVelocity: avgDecisionsPerProject,
    trends: {
      projectsCreated: projectsCreatedTrend,
      actionsCreated: actionsCreatedTrend,
      actionsCompleted: actionsCompletedTrend,
      decisionsCreated: decisionsCreatedTrend,
      meetingVolume: meetingVolumeTrend,
      outputGeneration: outputGenerationTrend,
    },
    teamParticipation,
    generatedAt: new Date().toISOString(),
    workspaceScope: isTeam ? 'team' : 'personal',
    teamId: isTeam ? teamId : null,
  };

  // Cache in generated_intelligence table for personal views
  if (!isTeam) {
    try {
      await Promise.all([
        supabase.from('generated_intelligence').upsert(
          {
            user_id: userId,
            intelligence_type: 'insight',
            data: insightData as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,intelligence_type' }
        ),
        supabase.from('generated_intelligence').upsert(
          {
            user_id: userId,
            intelligence_type: 'stats',
            data: statsData as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,intelligence_type' }
        ),
      ]);
    } catch {
      // Continue if caching encounters issue
    }
  }

  return { insight: insightData, stats: statsData };
}
