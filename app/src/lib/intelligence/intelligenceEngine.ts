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
} from './types';
import { getSupabaseClient } from '../supabase/client';

export interface ProcessIntelligenceOptions {
  supabase?: SupabaseClient;
  periodFilter?: StatsPeriodFilter;
  forceRefresh?: boolean;
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
}

interface ActionRow {
  id: string;
  project_id: string;
  action_title: string;
  action_description?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
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
 */
export async function processUserIntelligence(
  userId: string,
  options?: ProcessIntelligenceOptions
): Promise<{ insight: InsightData; stats: StatsData }> {
  const supabase = options?.supabase || getSupabaseClient();
  const periodFilter = options?.periodFilter || 'all';
  const filterDate = getFilterStartDate(periodFilter);

  // 1. Fetch active records for this user (respecting Tasklet 11 retention: deleted_at is null)
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

  const rawProjects: ProjectRow[] = (projectsData as ProjectRow[]) || [];
  const rawOutputs: OutputRow[] = (outputsData as OutputRow[]) || [];
  const rawDecisions: DecisionRow[] = (decisionsData as DecisionRow[]) || [];
  const rawActions: ActionRow[] = (actionsData as ActionRow[]) || [];

  // Filter if periodFilter is set
  const filteredProjects = filterDate
    ? rawProjects.filter((p) => new Date(p.meeting_date || p.created_at) >= filterDate)
    : rawProjects;

  const filteredDecisions = filterDate
    ? rawDecisions.filter((d) => new Date(d.decision_date || d.created_at) >= filterDate)
    : rawDecisions;

  const filteredActions = filterDate
    ? rawActions.filter((a) => new Date(a.created_at) >= filterDate)
    : rawActions;

  const filteredOutputs = filterDate
    ? rawOutputs.filter((o) => new Date(o.created_at) >= filterDate)
    : rawOutputs;

  const todayStr = new Date().toISOString().split('T')[0];

  // ==========================================
  // INSIGHT SYNTHESIS
  // ==========================================
  // A. Key Themes & Discussed Topics Extraction
  const topicFrequency: Record<string, { count: number; description: string }> = {};
  const addTopic = (name: string, desc: string, weight = 1) => {
    if (!name || name.trim().length < 3) return;
    const clean = name.trim();
    if (!topicFrequency[clean]) {
      topicFrequency[clean] = { count: 0, description: desc };
    }
    topicFrequency[clean].count += weight;
  };

  filteredProjects.forEach((p) => {
    if (p.meeting_type) {
      addTopic(`${p.meeting_type} Alignment`, `Discussions centered around ${p.meeting_type.toLowerCase()} execution and deliverables.`, 2);
    }
    if (p.project_name) {
      addTopic(p.project_name, `Strategic progress and deliverables for ${p.project_name}.`, 3);
    }
    if (p.client_name) {
      addTopic(`${p.client_name} Engagement`, `Client coordination, account roadmap and strategic reviews with ${p.client_name}.`, 2);
    }
  });

  filteredDecisions.forEach((d) => {
    if (d.decision_title) {
      const words = d.decision_title.split(' ');
      if (words.length > 2) {
        addTopic(words.slice(0, 4).join(' '), d.decision_summary || d.decision_title, 2);
      }
    }
  });

  const sortedTopics = Object.entries(topicFrequency).sort((a, b) => b[1].count - a[1].count);
  const keyThemes: KeyTheme[] = sortedTopics.slice(0, 5).map(([name, data], idx) => ({
    id: `theme-${idx + 1}`,
    name,
    count: data.count,
    description: data.description,
    relevance: Math.min(100, Math.round((data.count / Math.max(1, filteredProjects.length)) * 100)),
  }));

  const mostDiscussedTopics: DiscussedTopic[] = sortedTopics.slice(0, 6).map(([topic, data]) => ({
    topic,
    mentions: data.count,
    percentage: Math.min(100, Math.round((data.count / Math.max(1, filteredProjects.length)) * 100)),
  }));

  // B. Top Risks Extraction (from blocked/overdue actions, transcript risk patterns, notes)
  const topRisks: IdentifiedRisk[] = [];
  const overdueActions = filteredActions.filter(
    (a) => a.status !== 'completed' && a.due_date && a.due_date < todayStr
  );
  const blockedActions = filteredActions.filter((a) => a.status === 'blocked');

  if (overdueActions.length > 0) {
    topRisks.push({
      id: 'risk-overdue-actions',
      title: 'Action Item Delivery Slippage',
      severity: overdueActions.length > 2 ? 'high' : 'medium',
      count: overdueActions.length,
      description: `${overdueActions.length} tracked action items have passed their target delivery dates without completion.`,
      mitigationRecommendation: 'Re-triage open action deadlines with designated owners in the next sprint checkpoint.',
    });
  }

  if (blockedActions.length > 0) {
    topRisks.push({
      id: 'risk-blocked-dependencies',
      title: 'Critical Workflow Blockers',
      severity: 'high',
      count: blockedActions.length,
      description: `${blockedActions.length} operational actions are flagged as blocked by external dependencies or technical prerequisites.`,
      mitigationRecommendation: 'Escalate dependency bottlenecks to executive stakeholders for expedited unblocking.',
    });
  }

  // Check notes and outputs for common operational risk keywords
  const riskKeywords = ['compliance', 'security', 'delay', 'budget', 'sovereign', 'audit', 'vendor'];
  const matchedRiskKeywords: Record<string, number> = {};
  filteredProjects.forEach((p) => {
    const text = `${p.notes || ''} ${p.transcript || ''}`.toLowerCase();
    riskKeywords.forEach((kw) => {
      if (text.includes(kw)) {
        matchedRiskKeywords[kw] = (matchedRiskKeywords[kw] || 0) + 1;
      }
    });
  });

  Object.entries(matchedRiskKeywords).forEach(([kw, count], idx) => {
    if (count > 0 && topRisks.length < 5) {
      const capKw = kw.charAt(0).toUpperCase() + kw.slice(1);
      topRisks.push({
        id: `risk-kw-${idx}`,
        title: `${capKw} Constraints & Vulnerabilities`,
        severity: count > 2 ? 'high' : 'medium',
        count,
        description: `Recurring mentions of ${kw} dependencies and risk factors across ${count} meeting transcripts and briefings.`,
        mitigationRecommendation: `Establish formalized ${kw} verification protocols before project sign-off.`,
      });
    }
  });

  if (topRisks.length === 0 && filteredProjects.length > 0) {
    topRisks.push({
      id: 'risk-baseline',
      title: 'Action Accountability Baseline',
      severity: 'low',
      count: 1,
      description: 'Zero active blockers detected across recent meetings. Maintain scheduled cadence.',
      mitigationRecommendation: 'Continue tracking follow-up actions to prevent milestone slippage.',
    });
  }

  // C. Top Opportunities Extraction (growth, automation, partnerships, efficiency)
  const topOpportunities: IdentifiedOpportunity[] = [];
  const oppKeywords = [
    { kw: 'expansion', title: 'Account Expansion & Scale', desc: 'Identified opportunity to scale service scope and commercial coverage.' },
    { kw: 'automation', title: 'Workflow Automation & Speed', desc: 'Repeatable operational processes identified for automation to reduce cycle times.' },
    { kw: 'cloud', title: 'Infrastructure & Sovereign Hosting', desc: 'Consolidation opportunity into sovereign, secure cloud architectures.' },
    { kw: 'partner', title: 'Partner Ecosystem Collaboration', desc: 'Synergies identified for collaborative joint venture delivery.' },
    { kw: 'efficiency', title: 'Meeting Output Optimisation', desc: 'High transcript conversion into structured decisions and action items.' },
  ];

  oppKeywords.forEach((item, idx) => {
    let count = 0;
    filteredProjects.forEach((p) => {
      const combined = `${p.notes || ''} ${p.title} ${p.transcript || ''}`.toLowerCase();
      if (combined.includes(item.kw)) count++;
    });
    filteredDecisions.forEach((d) => {
      if (`${d.decision_title} ${d.decision_summary || ''}`.toLowerCase().includes(item.kw)) count++;
    });

    if (count > 0 && topOpportunities.length < 5) {
      topOpportunities.push({
        id: `opp-${idx}`,
        title: item.title,
        impact: count > 1 ? 'high' : 'medium',
        count,
        description: item.desc,
        nextStep: `Draft dedicated implementation roadmap with the designated account owner.`,
      });
    }
  });

  if (topOpportunities.length === 0 && filteredProjects.length > 0) {
    topOpportunities.push({
      id: 'opp-baseline',
      title: 'Meeting Memory Capitalisation',
      impact: 'medium',
      count: filteredProjects.length,
      description: 'Consolidating historical transcripts into searchable organizational memory.',
      nextStep: 'Synthesise recurring meeting action items into executive summary reports.',
    });
  }

  // D. Recurring Decisions
  const recurringDecisions: RecurringDecision[] = filteredDecisions.slice(0, 5).map((d) => ({
    id: d.id,
    topic: d.decision_title,
    title: d.decision_title,
    owner: d.decision_owner,
    date: d.decision_date,
    summary: d.decision_summary,
  }));

  // E. Frequently Assigned Actions
  const assigneeMap: Record<string, { total: number; open: number; completed: number; overdue: number }> = {};
  filteredActions.forEach((a) => {
    const owner = a.owner_name?.trim() || 'Unassigned';
    if (!assigneeMap[owner]) {
      assigneeMap[owner] = { total: 0, open: 0, completed: 0, overdue: 0 };
    }
    assigneeMap[owner].total += 1;
    if (a.status === 'completed') {
      assigneeMap[owner].completed += 1;
    } else {
      assigneeMap[owner].open += 1;
      if (a.due_date && a.due_date < todayStr) {
        assigneeMap[owner].overdue += 1;
      }
    }
  });

  const frequentlyAssignedActions: FrequentlyAssignedAction[] = Object.entries(assigneeMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([owner, stats]) => ({
      owner,
      ...stats,
    }));

  // F. Open Action Trends & Overdue Action Trends
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
      owner: a.owner_name,
      dueDate: a.due_date,
    })),
  };

  // G. Project Intelligence Summary
  const avgDecisionsPerProject =
    filteredProjects.length > 0 ? Number((filteredDecisions.length / filteredProjects.length).toFixed(1)) : 0;
  const avgActionsPerProject =
    filteredProjects.length > 0 ? Number((filteredActions.length / filteredProjects.length).toFixed(1)) : 0;

  // Health score calculation based on completion rate and overdue ratio
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
    summaryText: `Analysis across ${filteredProjects.length} projects yielded ${filteredDecisions.length} recorded decisions and ${filteredActions.length} tracked actions. Execution velocity is currently operating at ${healthScore}% organizational health.`,
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
  };

  // ==========================================
  // STATS & TRENDS SYNTHESIS
  // ==========================================
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
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
    generatedAt: new Date().toISOString(),
  };

  // Cache in generated_intelligence table
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
  } catch (err) {
    console.warn('Could not cache generated intelligence:', err);
  }

  return { insight: insightData, stats: statsData };
}
