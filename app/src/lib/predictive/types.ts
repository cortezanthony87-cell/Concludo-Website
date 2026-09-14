export type RiskScoreCategory = 'low' | 'moderate' | 'high' | 'critical';

export type HealthScoreCategory =
  | 'excellent'
  | 'strong'
  | 'stable'
  | 'at_risk'
  | 'critical_attention_needed';

export type ConfidenceIndicator =
  | 'low_confidence'
  | 'moderate_confidence'
  | 'high_confidence'
  | 'very_high_confidence';

export type RecommendationCategory =
  | 'improve_delivery'
  | 'reduce_risk'
  | 'increase_accountability'
  | 'enhance_collaboration'
  | 'accelerate_decisions'
  | 'improve_follow_through'
  | 'optimise_team_performance'
  | 'reduce_bottlenecks';

export type ForecastTimeframe =
  | '30_day'
  | '90_day'
  | '180_day'
  | '12_month'
  | 'custom';

export type ExecutiveReportType =
  | 'executive_summary'
  | 'strategic_health_report'
  | 'risk_report'
  | 'opportunity_report'
  | 'operational_performance_report'
  | 'custom';

export interface RiskPrediction {
  id: string;
  title: string;
  category: string;
  score: number; // 0-100 (higher means higher risk)
  riskLevel: RiskScoreCategory;
  explanation: string;
  affectedEntities: string[];
}

export interface OpportunitySignal {
  id: string;
  title: string;
  category: string;
  summary: string;
  confidence: ConfidenceIndicator;
  impact: 'moderate' | 'high' | 'exceptional';
  potentialGain: string;
}

export interface PredictiveSignal {
  id: string;
  signalType:
    | 'emerging_risks'
    | 'execution_risks'
    | 'leadership_risks'
    | 'resource_risks'
    | 'timeline_risks'
    | 'project_drift'
    | 'stakeholder_friction'
    | 'escalation_risks'
    | 'opportunity_signals'
    | 'growth_signals'
    | 'innovation_signals'
    | 'delivery_signals';
  title: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  evidence: string[];
}

export interface CategoryScores {
  execution: number;
  delivery: number;
  collaboration: number;
  decisionVelocity: number;
  actionCompletion: number;
  projectPerformance: number;
  riskExposure: number; // 0-100 (higher means lower exposure / healthier)
}

export interface OrganizationalHealthScore {
  overallScore: number; // 0-100
  category: HealthScoreCategory;
  categoryScores: CategoryScores;
  explanations: Record<keyof CategoryScores, string>;
  historicalTrend: { date: string; score: number }[];
}

export interface StrategicRecommendation {
  id: string;
  title: string;
  summary: string;
  supportingEvidence: string[];
  potentialBenefits: string[];
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  confidenceIndicator: ConfidenceIndicator;
  category: RecommendationCategory;
}

export interface ForecastDataPoint {
  label: string;
  actual?: number;
  forecast: number;
}

export interface ForecastOutput {
  timeframe: ForecastTimeframe;
  expectedTrends: string[];
  potentialRisks: string[];
  expectedCompletionRates: {
    currentPercent: number;
    projectedPercent: number;
    unit: string;
  };
  workloadChanges: {
    projectLoadTrend: string;
    actionVelocityTrend: string;
  };
  activityChanges: {
    trend: 'increasing' | 'stable' | 'decreasing';
    description: string;
  };
  projectGrowth: {
    currentCount: number;
    projectedCount: number;
    growthRatePercent: number;
  };
  organizationalSignals: string[];
  dataPoints: ForecastDataPoint[];
}

export interface DecisionOutcome {
  id: string;
  decisionTitle: string;
  decisionDate: string;
  outcomeStatus: 'successful' | 'delayed' | 'unresolved' | 'failed';
  impact: 'low' | 'moderate' | 'high' | 'critical';
  decisionVelocityDays: number;
  effectivenessNotes: string;
  projectName?: string;
}

export interface DecisionQualityMetrics {
  highImpactCount: number;
  successfulCount: number;
  delayedCount: number;
  unresolvedCount: number;
  decisionVelocityDaysAverage: number;
  decisionEffectivenessRatePercent: number;
  decisions: DecisionOutcome[];
}

export interface ExecutiveBriefingRecord {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  generated_by: string;
  title: string;
  report_type: ExecutiveReportType;
  content: {
    executiveSummary?: string;
    strategicOverview?: string;
    healthScore?: number;
    healthCategory?: string;
    keyRisks?: string[];
    keyOpportunities?: string[];
    topRecommendations?: string[];
    forecastSummary?: string;
    sections?: { heading: string; body: string }[];
  };
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface ExecutiveIntelligenceData {
  strategicOverview: string;
  businessMomentum: {
    score: number;
    trend: 'up' | 'stable' | 'down';
    commentary: string;
  };
  executionHealth: number;
  decisionHealth: number;
  collaborationHealth: number;
  operationalRisk: {
    score: number;
    level: RiskScoreCategory;
    summary: string;
  };
  growthIndicators: string[];
  keyRecommendations: StrategicRecommendation[];
}

export interface PredictiveAnalysisResult {
  scope: 'organization' | 'team' | 'individual';
  scopeId?: string;
  generatedAt: string;
  healthScore: OrganizationalHealthScore;
  riskPredictions: RiskPrediction[];
  opportunitySignals: OpportunitySignal[];
  predictiveSignals: PredictiveSignal[];
  strategicRecommendations: StrategicRecommendation[];
  decisionQuality: DecisionQualityMetrics;
  forecasts: Record<ForecastTimeframe, ForecastOutput>;
  executiveIntelligence: ExecutiveIntelligenceData;
}
