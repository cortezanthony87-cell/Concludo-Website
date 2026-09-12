export type ReportPeriod = 'Last 30 Days' | 'Last 90 Days' | 'Last 6 Months' | 'Last 12 Months' | 'All Time';

export interface ReportMeetingActivity {
  totalMeetings: number;
  meetingTypesBreakdown: Record<string, number>;
  mostActiveClient: string | null;
  mostActiveProject: string | null;
  dateRangeLabel: string;
}

export interface ReportKeyDecision {
  title: string;
  owner?: string | null;
  date?: string | null;
  summary?: string | null;
  reasoning?: string | null;
}

export interface ReportDecisionSummary {
  totalDecisions: number;
  keyDecisions: ReportKeyDecision[];
  topDecisionMakers: string[];
}

export interface ReportTopAssignee {
  name: string;
  count: number;
  completed: number;
  overdue: number;
}

export interface ReportActionSummary {
  totalActions: number;
  openActions: number;
  completedActions: number;
  overdueActions: number;
  topAssignees: ReportTopAssignee[];
}

export interface ReportCompletionPerformance {
  completionRate: number;
  openRate: number;
  overdueRate: number;
  performanceRating: 'Optimal' | 'Stable' | 'Needs Attention';
}

export interface ReportTheme {
  theme: string;
  occurrences: number;
  description: string;
}

export interface ReportRisk {
  risk: string;
  severity: 'high' | 'medium' | 'low';
  recurrence: number;
  recommendation: string;
}

export interface ReportOpportunity {
  opportunity: string;
  impact: 'high' | 'medium' | 'low';
  recurrence: number;
  valueDescription: string;
}

export interface ReportRecommendation {
  area: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium';
}

export interface ReportProjectIntelligenceSummary {
  projectsAnalyzed: number;
  avgDecisionsPerMeeting: number;
  avgActionsPerMeeting: number;
  healthScore: number;
  summaryText: string;
}

export interface EndpointReportContent {
  executiveSummary: string;
  meetingActivity: ReportMeetingActivity;
  decisionSummary: ReportDecisionSummary;
  actionSummary: ReportActionSummary;
  completionPerformance: ReportCompletionPerformance;
  recurringThemes: ReportTheme[];
  recurringRisks: ReportRisk[];
  recurringOpportunities: ReportOpportunity[];
  recommendedAreasForReview: ReportRecommendation[];
  projectIntelligenceSummary: ReportProjectIntelligenceSummary;
}

export interface EndpointReport {
  id: string;
  user_id: string;
  title: string;
  report_content: EndpointReportContent;
  report_period: ReportPeriod;
  generated_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}
