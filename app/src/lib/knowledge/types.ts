export type KnowledgeNodeType =
  | 'project'
  | 'transcript'
  | 'output'
  | 'decision'
  | 'action'
  | 'insight'
  | 'risk'
  | 'opportunity'
  | 'recommendation'
  | 'report'
  | 'forecast'
  | 'team'
  | 'user'
  | 'organization';

export type KnowledgeRelationshipType =
  | 'references'
  | 'related_to'
  | 'depends_on'
  | 'caused_by'
  | 'resulted_in'
  | 'blocks'
  | 'supports'
  | 'conflicts_with'
  | 'owned_by'
  | 'assigned_to'
  | 'derived_from'
  | 'influences'
  | 'contributes_to'
  | 'escalates_to'
  | 'mitigates';

export type ConfidenceLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'very_high';

export type KnowledgeClusterCategory =
  | 'customer_delivery'
  | 'project_governance'
  | 'product_strategy'
  | 'operational_excellence'
  | 'compliance'
  | 'transformation_programs'
  | 'risk_management';

export interface KnowledgeNode {
  id: string;
  node_type: KnowledgeNodeType;
  source_entity_type: string;
  source_entity_id: string;
  title: string;
  summary: string | null;
  owner_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface KnowledgeRelationship {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: KnowledgeRelationshipType;
  confidence_score: number;
  context_notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
  // Joined populated properties
  source_node?: KnowledgeNode;
  target_node?: KnowledgeNode;
}

export interface LessonLearned {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  project_id?: string | null;
  created_by: string;
  title: string;
  summary: string;
  outcome: string;
  cluster_category: KnowledgeClusterCategory;
  tags?: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface KnowledgeCluster {
  category: KnowledgeClusterCategory;
  title: string;
  description: string;
  node_count: number;
  top_nodes: KnowledgeNode[];
  themes: string[];
}

export interface EvidenceRecord {
  id: string;
  entity_type: string;
  title: string;
  detail: string;
  relationship: KnowledgeRelationshipType;
  confidence: number;
  date: string;
}

export interface EvidenceNetwork {
  target_id: string;
  target_type: string;
  target_title: string;
  evidence_source: string;
  supporting_records: EvidenceRecord[];
  historical_context: string;
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  reasoning_path: string[];
}

export interface DecisionNetwork {
  decision: KnowledgeNode;
  related_decisions: KnowledgeNode[];
  dependent_actions: KnowledgeNode[];
  affected_projects: KnowledgeNode[];
  related_teams: KnowledgeNode[];
  supporting_evidence: EvidenceRecord[];
  historical_outcomes: string[];
}

export interface ProjectNetwork {
  project: KnowledgeNode;
  connected_projects: KnowledgeNode[];
  linked_decisions: KnowledgeNode[];
  related_risks: KnowledgeNode[];
  related_opportunities: KnowledgeNode[];
  related_teams: KnowledgeNode[];
  related_reports: KnowledgeNode[];
  related_recommendations: KnowledgeNode[];
}

export interface KnowledgeSearchResult {
  node: KnowledgeNode;
  score: number;
  match_field: string;
  connected_records: {
    node: KnowledgeNode;
    relationship_type: KnowledgeRelationshipType;
    confidence_score: number;
  }[];
  supporting_evidence: string[];
  relationship_path: string[];
  confidence_score: number;
  confidence_level: ConfidenceLevel;
}

export interface KnowledgeTimelineItem {
  id: string;
  date: string;
  node: KnowledgeNode;
  event_type: KnowledgeNodeType;
  connected_nodes_count: number;
  relationships: {
    target_node_title: string;
    relationship_type: KnowledgeRelationshipType;
    confidence: number;
  }[];
}

export interface KnowledgeJourneyStep {
  step_number: number;
  date: string;
  node: KnowledgeNode;
  role_in_journey: string;
  trigger_reason: string;
  outcome: string;
  relationship_to_next?: KnowledgeRelationshipType;
}

export interface KnowledgeJourney {
  journey_id: string;
  title: string;
  starting_point: string;
  final_outcome: string;
  steps: KnowledgeJourneyStep[];
  evidence_chain: string[];
  relationship_path: string[];
}

export interface KnowledgeAnalyticsData {
  total_nodes: number;
  total_relationships: number;
  density: number;
  nodes_by_type: Record<KnowledgeNodeType, number>;
  relationships_by_type: Record<KnowledgeRelationshipType, number>;
  most_connected_projects: { id: string; title: string; connections: number }[];
  most_connected_decisions: { id: string; title: string; connections: number }[];
  most_referenced_themes: { theme: string; references: number }[];
  most_common_risks: { risk: string; frequency: number; severity: string }[];
  fastest_growing_areas: { cluster: KnowledgeClusterCategory; growth_rate_pct: number; new_nodes_30d: number }[];
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}

export const CLUSTER_CATEGORY_LABELS: Record<KnowledgeClusterCategory, string> = {
  customer_delivery: 'Customer Delivery',
  project_governance: 'Project Governance',
  product_strategy: 'Product Strategy',
  operational_excellence: 'Operational Excellence',
  compliance: 'Compliance',
  transformation_programs: 'Transformation Programs',
  risk_management: 'Risk Management',
};
