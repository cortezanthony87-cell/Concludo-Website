export type StatsPeriodFilter = '30d' | '90d' | '6m' | '12m' | 'all';

export interface KeyTheme {
  id: string;
  name: string;
  count: number;
  description: string;
  relevance: number;
}

export interface IdentifiedRisk {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  description: string;
  mitigationRecommendation: string;
}

export interface IdentifiedOpportunity {
  id: string;
  title: string;
  impact: 'high' | 'medium' | 'low';
  count: number;
  description: string;
  nextStep: string;
}

export interface RecurringDecision {
  id: string;
  topic?: string;
  title: string;
  owner?: string | null;
  date?: string | null;
  summary?: string | null;
}

export interface FrequentlyAssignedAction {
  owner: string;
  total: number;
  open: number;
  completed: number;
  overdue: number;
}

export interface DiscussedTopic {
  topic: string;
  mentions: number;
  percentage?: number;
  category?: string;
}

export interface OpenActionTrends {
  notStarted: number;
  inProgress: number;
  blocked: number;
  totalOpen: number;
}

export interface OverdueActionItem {
  id: string;
  title: string;
  owner?: string | null;
  dueDate?: string | null;
}

export interface OverdueActionTrends {
  count: number;
  percentageOfOpen: number;
  criticalActions: OverdueActionItem[];
}

export interface ProjectIntelligenceSummary {
  totalProjects: number;
  avgDecisionsPerProject: number;
  avgActionsPerProject: number;
  meetingHealthScore: number;
  summaryText: string;
}

export interface InsightData {
  keyThemes: KeyTheme[];
  topRisks: IdentifiedRisk[];
  topOpportunities: IdentifiedOpportunity[];
  recurringDecisions: RecurringDecision[];
  frequentlyAssignedActions: FrequentlyAssignedAction[];
  mostDiscussedTopics: DiscussedTopic[];
  openActionTrends: OpenActionTrends;
  overdueActionTrends: OverdueActionTrends;
  projectIntelligenceSummary: ProjectIntelligenceSummary;
  generatedAt: string;
  workspaceScope?: 'personal' | 'team';
  teamId?: string | null;
}

export interface TrendDataPoint {
  period: string;
  count: number;
}

export interface StatsTrends {
  projectsCreated: TrendDataPoint[];
  actionsCreated: TrendDataPoint[];
  actionsCompleted: TrendDataPoint[];
  decisionsCreated: TrendDataPoint[];
  meetingVolume: TrendDataPoint[];
  outputGeneration: TrendDataPoint[];
}

export interface TeamMemberParticipation {
  memberId: string;
  name: string;
  projectsCount: number;
  decisionsCount: number;
  actionsAssigned: number;
  actionsCompleted: number;
}

export interface StatsData {
  totalProjects: number;
  totalTranscripts: number;
  totalDecisions: number;
  totalActions: number;
  completedActions: number;
  openActions: number;
  overdueActions: number;
  projectsThisMonth: number;
  projectsThisQuarter: number;
  projectsThisYear: number;
  actionCompletionRate: number;
  decisionVelocity: number;
  trends: StatsTrends;
  teamParticipation?: TeamMemberParticipation[];
  generatedAt: string;
  workspaceScope?: 'personal' | 'team';
  teamId?: string | null;
}

export interface GeneratedIntelligenceRecord {
  id: string;
  user_id: string;
  intelligence_type: 'insight' | 'stats';
  data: InsightData | StatsData;
  ownership_type?: 'personal' | 'team';
  team_id?: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}
