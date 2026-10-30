/**
 * Honest view of the cached Insight and Stats data (defects D8, D10, D12, D14).
 * Works on data already saved by the earlier engine, so it also cleans old cache rows.
 * Removed: canned opportunities, the always-present "alignment" risk, the 0 to 100 health figure,
 * per-person action rankings and the per-member participation table. Measures work, never people.
 */
import { rate } from './evidence';
import { describeCalculatedAt } from './calculatedAt';

const CANNED_OPPORTUNITY_IDS = ['opp-workspace-scale', 'opp-automation-velocity'];
const CANNED_RISK_IDS = ['risk-scope-governance'];

export interface InsightLike {
  topRisks?: Array<{ id: string; title: string; severity?: string; count: number; description: string; mitigationRecommendation?: string }>;
  topOpportunities?: Array<{ id: string }>;
  keyThemes?: Array<{ id: string; name: string; count: number; description?: string }>;
  recurringDecisions?: Array<{ id: string; title: string; owner?: string | null; date?: string | null; summary?: string | null }>;
  mostDiscussedTopics?: Array<{ topic: string; mentions: number }>;
  openActionTrends?: { notStarted: number; inProgress: number; blocked: number; totalOpen: number };
  overdueActionTrends?: { count: number; criticalActions?: Array<{ id: string; title: string; dueDate?: string | null }> };
  projectIntelligenceSummary?: { totalProjects: number; avgDecisionsPerProject: number; avgActionsPerProject: number };
  generatedAt?: string;
}

export function cleanInsight(d: InsightLike) {
  const risks = (d.topRisks || []).filter((r) => !CANNED_RISK_IDS.includes(r.id) && r.count > 0);
  const projects = d.projectIntelligenceSummary?.totalProjects ?? 0;
  const open = d.openActionTrends?.totalOpen ?? 0;
  const overdue = d.overdueActionTrends?.count ?? 0;
  return {
    calculated: describeCalculatedAt(d.generatedAt),
    projects,
    risks,
    themes: d.keyThemes || [],
    decisions: d.recurringDecisions || [],
    topics: (d.mostDiscussedTopics || []).map((t) => ({ topic: t.topic, mentions: t.mentions })),
    open: d.openActionTrends || { notStarted: 0, inProgress: 0, blocked: 0, totalOpen: 0 },
    overdueCount: overdue,
    overdueOfOpen: rate(overdue, open),
    overdueActions: d.overdueActionTrends?.criticalActions || [],
    hasEnoughHistory: projects >= 1,
  };
}

export function removedItemCount(d: InsightLike): number {
  const o = (d.topOpportunities || []).filter((x) => CANNED_OPPORTUNITY_IDS.includes(x.id)).length;
  const r = (d.topRisks || []).filter((x) => CANNED_RISK_IDS.includes(x.id)).length;
  return o + r;
}

export interface StatsLike {
  totalProjects: number; totalDecisions: number; totalActions: number; completedActions: number;
  openActions: number; overdueActions: number; generatedAt?: string; teamParticipation?: unknown;
}

export function cleanStats(s: StatsLike) {
  return {
    calculated: describeCalculatedAt(s.generatedAt),
    totals: { projects: s.totalProjects, decisions: s.totalDecisions, actions: s.totalActions, open: s.openActions, completed: s.completedActions, overdue: s.overdueActions },
    completion: rate(s.completedActions, s.totalActions),
    overdueOfOpen: rate(s.overdueActions, s.openActions),
    hasParticipationTable: false as const,
  };
}
