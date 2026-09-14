export type StrategicHealthClassification =
  | 'Exceptional'
  | 'Strong'
  | 'Stable'
  | 'Watch Required'
  | 'At Risk'
  | 'Critical Attention Required';

export interface StrategicHealthCategories {
  vision_execution: number;
  program_delivery: number;
  decision_velocity: number;
  operational_alignment: number;
  team_effectiveness: number;
  knowledge_utilization: number;
  risk_management: number;
  organizational_learning: number;
}

export interface StrategicHealthRationale {
  category: keyof StrategicHealthCategories;
  label: string;
  score: number;
  classification: StrategicHealthClassification;
  summary: string;
  positiveDrivers: string[];
  riskDrivers: string[];
  evidenceCount: number;
}

export interface StrategicHealthScore {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  overall_score: number;
  classification: StrategicHealthClassification;
  categories: StrategicHealthCategories;
  supporting_rationale: StrategicHealthRationale[];
  recorded_by: string;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface DigitalTwinModelState {
  organizations_count: number;
  teams_count: number;
  projects_count: number;
  active_initiatives_count: number;
  decisions_count: number;
  actions_count: number;
  open_actions_count: number;
  overdue_actions_count: number;
  risks_detected_count: number;
  workflows_count: number;
  knowledge_nodes_count: number;
  knowledge_relationships_count: number;
  lessons_learned_count: number;
  last_updated: string;
}

export interface StrategicDigitalTwin {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  created_by: string;
  title: string;
  operational_health: number;
  strategic_health: number;
  execution_health: number;
  collaboration_health: number;
  decision_health: number;
  knowledge_health: number;
  risk_exposure: number;
  opportunity_score: number;
  model_state: DigitalTwinModelState;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export type ScenarioType =
  | 'delivery_slowdown'
  | 'velocity_improvement'
  | 'action_backlog_surge'
  | 'initiative_delay'
  | 'capacity_expansion'
  | 'custom';

export type ScenarioConfidence = 'Low' | 'Moderate' | 'High' | 'Very High';

export interface ScenarioParameters {
  delivery_change_pct?: number;
  velocity_change_pct?: number;
  overdue_action_surge_pct?: number;
  target_initiative_id?: string;
  target_initiative_name?: string;
  delay_weeks?: number;
  capacity_change_pct?: number;
  custom_hypothesis?: string;
}

export interface ScenarioSimulationResults {
  possible_outcomes: string[];
  risk_impact: {
    level: 'low' | 'moderate' | 'high' | 'critical';
    scoreDelta: number;
    summary: string;
  };
  resource_impact: {
    utilizationChangePct: number;
    bottleneckRisk: string;
    capacitySurplusOrDeficit: string;
  };
  project_impact: {
    delayedMilestonesCount: number;
    affectedProjects: string[];
    timelineVarianceDays: number;
  };
  decision_impact: {
    decisionVelocityShiftDays: number;
    pendingReviewSurge: number;
    governanceFriction: string;
  };
  operational_impact: {
    overallHealthDelta: number;
    operationalSummary: string;
  };
  confidence_level: ScenarioConfidence;
  assumptions: string[];
  supporting_evidence: {
    source: string;
    metric: string;
    observation: string;
  }[];
}

export interface StrategicScenario {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  created_by: string;
  title: string;
  description?: string | null;
  scenario_type: ScenarioType;
  parameters: ScenarioParameters;
  simulation_results: ScenarioSimulationResults;
  confidence_level: ScenarioConfidence;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface DepartmentPerformance {
  department: string;
  executionScore: number;
  deliveryRate: number;
  activeProjects: number;
  onTrackRate: number;
  velocityRating: string;
}

export interface TeamPerformanceSummary {
  teamId: string;
  teamName: string;
  memberCount: number;
  executionScore: number;
  actionCompletionRate: number;
  decisionVelocityDays: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface EnterprisePerformanceModel {
  execution: number;
  delivery: number;
  leadership: number;
  collaboration: number;
  decision_quality: number;
  knowledge_effectiveness: number;
  improvement_trends: number;
  forecast_accuracy: number;
  department_breakdown: DepartmentPerformance[];
  team_breakdown: TeamPerformanceSummary[];
  decision_effectiveness_rate: number;
  action_completion_rate: number;
  historical_trend: {
    month: string;
    execution: number;
    delivery: number;
    alignment: number;
  }[];
}

export interface OrganizationalLearningModel {
  totalLessonsLearned: number;
  lessonsReusedCount: number;
  knowledgeReuseRate: number;
  decisionReuseRate: number;
  successfulPatterns: {
    pattern: string;
    occurrences: number;
    successRate: number;
    domain: string;
  }[];
  failurePatterns: {
    pattern: string;
    occurrences: number;
    riskLevel: 'Moderate' | 'High' | 'Critical';
    remedyRecommendation: string;
  }[];
  bestPractices: {
    title: string;
    category: string;
    validatedInitiatives: string[];
    impactScore: number;
  }[];
  memoryEvolution: {
    knowledgeGrowthRatePct: number;
    knowledgeDecayRisk: 'Low' | 'Moderate' | 'High';
    knowledgeUtilizationScore: number;
    knowledgeRelevanceScore: number;
    knowledgeDependencyDepth: number;
  };
}

export interface EnterpriseRiskNode {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  originEntityType: 'project' | 'decision' | 'action' | 'external' | 'resource';
  originEntityId: string;
  originTitle: string;
  dependencies: string[];
  escalationPaths: string[];
  impactAreas: string[];
  mitigationRecommendation?: string;
}

export interface EnterpriseRiskNetwork {
  nodes: EnterpriseRiskNode[];
  overallRiskLevel: 'Low' | 'Moderate' | 'Elevated' | 'Critical';
  topRiskAreas: string[];
  activeEscalationsCount: number;
  mitigationCoverageRate: number;
}

export interface DependencyLink {
  sourceType: 'team' | 'project' | 'initiative' | 'decision' | 'action' | 'cluster';
  sourceId: string;
  sourceTitle: string;
  targetType: 'team' | 'project' | 'initiative' | 'decision' | 'action' | 'cluster';
  targetId: string;
  targetTitle: string;
  relationship: 'depends_on' | 'blocks' | 'enables' | 'impacts' | 'governs';
  isBottleneck: boolean;
  strategicRiskRating: 'Low' | 'Medium' | 'High';
}

export interface OrganizationalDependencyMap {
  links: DependencyLink[];
  identifiedBottlenecks: {
    entityId: string;
    entityTitle: string;
    entityType: string;
    dependentCount: number;
    delayRiskDays: number;
    recommendation: string;
  }[];
  criticalPathCount: number;
  interTeamDependenciesCount: number;
}

export type StrategicRecommendationCategory =
  | 'immediate_priority'
  | 'strategic_priority'
  | 'emerging_concern'
  | 'quick_win'
  | 'risk_mitigation'
  | 'long_term_opportunity';

export interface StrategicRecommendationItem {
  id: string;
  category: StrategicRecommendationCategory;
  title: string;
  summary: string;
  confidenceScore: number;
  explanation: string;
  supportingRecords: {
    recordType: string;
    recordId: string;
    title: string;
  }[];
  evidence: string[];
  impactScore: number;
  effortRating: 'Low' | 'Moderate' | 'High';
}

export type StrategicAlertType =
  | 'critical_risk_emerging'
  | 'major_initiative_delayed'
  | 'execution_health_declining'
  | 'decision_backlog_increasing'
  | 'knowledge_gap_detected'
  | 'strategic_opportunity_identified';

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface StrategicAlert {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  alert_type: StrategicAlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  details: Record<string, any>;
  is_dismissed: boolean;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export type StrategicBriefingType =
  | 'board_update'
  | 'executive_strategic_briefing'
  | 'quarterly_operating_review'
  | 'transformation_report'
  | 'enterprise_performance_report'
  | 'risk_review'
  | 'opportunity_review';

export interface BoardReportingSections {
  executive_summary: string;
  strategic_highlights: string[];
  progress_summaries: {
    initiative: string;
    status: 'On Track' | 'Watch' | 'Critical';
    deliveryRate: number;
    keyMilestone: string;
  }[];
  initiative_health: {
    overallHealthScore: number;
    onTrackCount: number;
    atRiskCount: number;
    delayedCount: number;
  };
  risk_exposure: {
    topRisks: string[];
    criticalVulnerabilities: string[];
    mitigationActions: string[];
  };
  forecast_outlook: {
    projectedCompletionQuarter: string;
    resourceCapacityStatus: string;
    strategicSignals: string[];
  };
  recommendation_summaries: string[];
}

export interface StrategicBriefing {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  generated_by: string;
  title: string;
  briefing_type: StrategicBriefingType;
  sections: BoardReportingSections;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}
