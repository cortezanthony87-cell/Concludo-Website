export type PlanType =
  | 'free_preview'
  | 'starter_trial'
  | 'starter'
  | 'pro_trial'
  | 'pro'
  | 'team'
  | 'enterprise'
  | 'admin';

export type FeatureKey =
  | 'workspace_basic'
  | 'meeting_memory'
  | 'decision_memory'
  | 'action_tracker'
  | 'keyword_search'
  | 'insight'
  | 'stats'
  | 'endpoint_report'
  | 'automation_export'
  | 'third_party_integrations'
  | 'webhooks'
  | 'api_access'
  | 'team_workspace'
  | 'team_administration'
  | 'shared_projects'
  | 'shared_decisions'
  | 'shared_actions'
  | 'shared_insights'
  | 'enterprise_sso'
  | 'audit_logging'
  | 'advanced_governance'
  | 'compliance_controls'
  | 'organization_admin'
  | 'retention_policies'
  | 'legal_hold'
  | 'security_controls'
  | 'organization_analytics'
  | 'admin_dashboard'
  | 'core_outputs'
  | 'copy_output'
  | 'json_export'
  | 'saved_projects'
  | 'transcript_archive'
  | 'manual_outputs'
  | 'next_best_action'
  | 'meeting_health_dashboard'
  | 'admin_tools'
  // Tasklet 19 Features
  | 'ai_agents'
  | 'workflow_orchestration'
  | 'intelligent_automation'
  | 'agent_memory'
  | 'workflow_approvals'
  // Tasklet 20 Features
  | 'predictive_intelligence'
  | 'executive_intelligence'
  | 'strategic_recommendations'
  | 'forecasting'
  | 'organizational_health_scoring'
  // Tasklet 21 Features
  | 'knowledge_graph'
  | 'knowledge_explorer'
  | 'organizational_memory'
  | 'relationship_discovery'
  | 'evidence_networks'
  | 'executive_knowledge_explorer'
  | 'knowledge_analytics';

export const ALL_FEATURE_KEYS: readonly FeatureKey[] = [
  'workspace_basic',
  'meeting_memory',
  'decision_memory',
  'action_tracker',
  'keyword_search',
  'insight',
  'stats',
  'endpoint_report',
  'automation_export',
  'third_party_integrations',
  'webhooks',
  'api_access',
  'team_workspace',
  'team_administration',
  'shared_projects',
  'shared_decisions',
  'shared_actions',
  'shared_insights',
  'enterprise_sso',
  'audit_logging',
  'advanced_governance',
  'compliance_controls',
  'organization_admin',
  'retention_policies',
  'legal_hold',
  'security_controls',
  'organization_analytics',
  'admin_dashboard',
  'core_outputs',
  'copy_output',
  'json_export',
  'saved_projects',
  'transcript_archive',
  'manual_outputs',
  'next_best_action',
  'meeting_health_dashboard',
  'admin_tools',
  'ai_agents',
  'workflow_orchestration',
  'intelligent_automation',
  'agent_memory',
  'workflow_approvals',
  // Tasklet 20
  'predictive_intelligence',
  'executive_intelligence',
  'strategic_recommendations',
  'forecasting',
  'organizational_health_scoring',
  // Tasklet 21
  'knowledge_graph',
  'knowledge_explorer',
  'organizational_memory',
  'relationship_discovery',
  'evidence_networks',
  'executive_knowledge_explorer',
  'knowledge_analytics',
] as const;

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  workspace_basic: 'Workspace Basic',
  meeting_memory: 'Meeting Memory',
  decision_memory: 'Decision Memory',
  action_tracker: 'Action Tracker',
  keyword_search: 'Keyword Search',
  insight: 'Insight',
  stats: 'Stats',
  endpoint_report: 'Endpoint Report',
  automation_export: 'Automation Export',
  third_party_integrations: 'Third-Party Integrations',
  webhooks: 'Webhooks',
  api_access: 'API Access',
  team_workspace: 'Team Workspace',
  team_administration: 'Team Administration',
  shared_projects: 'Shared Projects',
  shared_decisions: 'Shared Decision Memory',
  shared_actions: 'Shared Action Tracker',
  shared_insights: 'Shared Insights',
  enterprise_sso: 'Enterprise SSO',
  audit_logging: 'Audit Logging',
  advanced_governance: 'Advanced Governance',
  compliance_controls: 'Compliance Controls',
  organization_admin: 'Organization Administration',
  retention_policies: 'Retention Policies',
  legal_hold: 'Legal Hold',
  security_controls: 'Security Controls',
  organization_analytics: 'Organization Analytics',
  admin_dashboard: 'Admin Dashboard',
  core_outputs: 'Core Outputs',
  copy_output: 'Copy Output',
  json_export: 'JSON Export',
  saved_projects: 'Saved Projects',
  transcript_archive: 'Transcript Archive',
  manual_outputs: 'Manual Outputs',
  next_best_action: 'Next Best Action',
  meeting_health_dashboard: 'Meeting Health Dashboard',
  admin_tools: 'Admin Tools',
  ai_agents: 'AI Agents',
  workflow_orchestration: 'Workflow Orchestration',
  intelligent_automation: 'Intelligent Automation',
  agent_memory: 'Agent Memory',
  workflow_approvals: 'Workflow Approvals',
  // Tasklet 20 Labels
  predictive_intelligence: 'Predictive Intelligence',
  executive_intelligence: 'Executive Intelligence',
  strategic_recommendations: 'Strategic Recommendations',
  forecasting: 'Forecasting',
  organizational_health_scoring: 'Organisational Health Scoring',
  // Tasklet 21 Labels
  knowledge_graph: 'Knowledge Graph',
  knowledge_explorer: 'Knowledge Explorer',
  organizational_memory: 'Organizational Memory',
  relationship_discovery: 'Relationship Discovery',
  evidence_networks: 'Evidence Networks',
  executive_knowledge_explorer: 'Executive Knowledge Explorer',
  knowledge_analytics: 'Knowledge Analytics',
};

/**
 * Server-authoritative mapping of plans to allowed features.
 */
export const PLAN_PERMISSIONS: Record<PlanType, readonly FeatureKey[]> = {
  free_preview: [
    'workspace_basic',
    'core_outputs',
    'copy_output',
  ],
  starter_trial: [
    'workspace_basic',
    'core_outputs',
    'copy_output',
    'json_export',
  ],
  starter: [
    'workspace_basic',
    'core_outputs',
    'copy_output',
    'json_export',
  ],
  pro_trial: [
    'workspace_basic',
    'meeting_memory',
    'decision_memory',
    'action_tracker',
    'keyword_search',
    'insight',
    'stats',
    'endpoint_report',
    'automation_export',
    'third_party_integrations',
    'webhooks',
    'api_access',
    'core_outputs',
    'copy_output',
    'json_export',
    'saved_projects',
    'transcript_archive',
    'manual_outputs',
    'next_best_action',
    'meeting_health_dashboard',
  ],
  pro: [
    'workspace_basic',
    'meeting_memory',
    'decision_memory',
    'action_tracker',
    'keyword_search',
    'insight',
    'stats',
    'endpoint_report',
    'automation_export',
    'third_party_integrations',
    'webhooks',
    'api_access',
    'core_outputs',
    'copy_output',
    'json_export',
    'saved_projects',
    'transcript_archive',
    'manual_outputs',
    'next_best_action',
    'meeting_health_dashboard',
  ],
  team: [
    'workspace_basic',
    'meeting_memory',
    'decision_memory',
    'action_tracker',
    'keyword_search',
    'insight',
    'stats',
    'endpoint_report',
    'automation_export',
    'third_party_integrations',
    'webhooks',
    'api_access',
    'team_workspace',
    'team_administration',
    'shared_projects',
    'shared_decisions',
    'shared_actions',
    'shared_insights',
    'core_outputs',
    'copy_output',
    'json_export',
    'saved_projects',
    'transcript_archive',
    'manual_outputs',
    'next_best_action',
    'meeting_health_dashboard',
  ],
  enterprise: [
    'workspace_basic',
    'meeting_memory',
    'decision_memory',
    'action_tracker',
    'keyword_search',
    'insight',
    'stats',
    'endpoint_report',
    'automation_export',
    'third_party_integrations',
    'webhooks',
    'api_access',
    'team_workspace',
    'team_administration',
    'shared_projects',
    'shared_decisions',
    'shared_actions',
    'shared_insights',
    'enterprise_sso',
    'audit_logging',
    'advanced_governance',
    'compliance_controls',
    'organization_admin',
    'retention_policies',
    'legal_hold',
    'security_controls',
    'organization_analytics',
    'core_outputs',
    'copy_output',
    'json_export',
    'saved_projects',
    'transcript_archive',
    'manual_outputs',
    'next_best_action',
    'meeting_health_dashboard',
    // Tasklet 19 features unlocked on enterprise
    'ai_agents',
    'workflow_orchestration',
    'intelligent_automation',
    'agent_memory',
    'workflow_approvals',
    // Tasklet 20 features unlocked on enterprise
    'predictive_intelligence',
    'executive_intelligence',
    'strategic_recommendations',
    'forecasting',
    'organizational_health_scoring',
    // Tasklet 21 features unlocked on enterprise
    'knowledge_graph',
    'knowledge_explorer',
    'organizational_memory',
    'relationship_discovery',
    'evidence_networks',
    'executive_knowledge_explorer',
    'knowledge_analytics',
  ],
  admin: [
    'workspace_basic',
    'meeting_memory',
    'decision_memory',
    'action_tracker',
    'keyword_search',
    'insight',
    'stats',
    'endpoint_report',
    'automation_export',
    'third_party_integrations',
    'webhooks',
    'api_access',
    'team_workspace',
    'team_administration',
    'shared_projects',
    'shared_decisions',
    'shared_actions',
    'shared_insights',
    'enterprise_sso',
    'audit_logging',
    'advanced_governance',
    'compliance_controls',
    'organization_admin',
    'retention_policies',
    'legal_hold',
    'security_controls',
    'organization_analytics',
    'admin_dashboard',
    'core_outputs',
    'copy_output',
    'json_export',
    'saved_projects',
    'transcript_archive',
    'manual_outputs',
    'next_best_action',
    'meeting_health_dashboard',
    'admin_tools',
    'ai_agents',
    'workflow_orchestration',
    'intelligent_automation',
    'agent_memory',
    'workflow_approvals',
    // Tasklet 20 features unlocked on admin
    'predictive_intelligence',
    'executive_intelligence',
    'strategic_recommendations',
    'forecasting',
    'organizational_health_scoring',
    // Tasklet 21 features unlocked on admin
    'knowledge_graph',
    'knowledge_explorer',
    'organizational_memory',
    'relationship_discovery',
    'evidence_networks',
    'executive_knowledge_explorer',
    'knowledge_analytics',
  ],
};

/**
 * UI Locked badge labels based on minimum tier requirements.
 */
export const FEATURE_TIER_BADGES: Partial<Record<FeatureKey, string>> = {
  meeting_memory: 'Available on Pro',
  decision_memory: 'Available on Pro',
  action_tracker: 'Available on Pro',
  keyword_search: 'Available on Pro',
  insight: 'Available on Pro',
  stats: 'Available on Pro',
  endpoint_report: 'Available on Pro',
  next_best_action: 'Available on Pro',
  meeting_health_dashboard: 'Available on Pro',
  automation_export: 'Available on Pro',
  third_party_integrations: 'Available on Pro',
  webhooks: 'Available on Pro',
  api_access: 'Available on Pro',
  team_workspace: 'Available on Team',
  team_administration: 'Available on Team',
  shared_projects: 'Available on Team',
  shared_decisions: 'Available on Team',
  shared_actions: 'Available on Team',
  shared_insights: 'Available on Team',
  enterprise_sso: 'Available on Enterprise',
  audit_logging: 'Available on Enterprise',
  advanced_governance: 'Available on Enterprise',
  compliance_controls: 'Available on Enterprise',
  organization_admin: 'Available on Enterprise',
  retention_policies: 'Available on Enterprise',
  legal_hold: 'Available on Enterprise',
  security_controls: 'Available on Enterprise',
  organization_analytics: 'Available on Enterprise',
  admin_dashboard: 'Available on Admin',
  admin_tools: 'Available on Admin',
  saved_projects: 'Available on Pro',
  transcript_archive: 'Available on Pro',
  manual_outputs: 'Available on Pro',
  json_export: 'Available on Starter',
  ai_agents: 'Available on Enterprise',
  workflow_orchestration: 'Available on Enterprise',
  intelligent_automation: 'Available on Enterprise',
  agent_memory: 'Available on Enterprise',
  workflow_approvals: 'Available on Enterprise',
  // Tasklet 20 Tier Badges
  predictive_intelligence: 'Available on Enterprise',
  executive_intelligence: 'Available on Enterprise',
  strategic_recommendations: 'Available on Enterprise',
  forecasting: 'Available on Enterprise',
  organizational_health_scoring: 'Available on Enterprise',
  // Tasklet 21 Tier Badges
  knowledge_graph: 'Available on Enterprise',
  knowledge_explorer: 'Available on Enterprise',
  organizational_memory: 'Available on Enterprise',
  relationship_discovery: 'Available on Enterprise',
  evidence_networks: 'Available on Enterprise',
  executive_knowledge_explorer: 'Available on Enterprise',
  knowledge_analytics: 'Available on Enterprise',
};

export interface PermissionErrorResponse {
  error: 'feature_not_available';
  message: 'Your current plan does not include this feature.';
  feature: string;
  requiredUpgrade: boolean;
}

export interface PermissionCheckSuccess {
  allowed: true;
  statusCode: 200;
  plan: PlanType;
  feature: FeatureKey;
}

export interface PermissionCheckDenied {
  allowed: false;
  statusCode: 403;
  plan: PlanType;
  feature: string;
  error: PermissionErrorResponse;
}

export interface PermissionCheckError {
  allowed: false;
  statusCode: number;
  plan?: PlanType;
  feature: string;
  error: {
    error: string;
    message: string;
    feature?: string;
  };
}

export type PermissionResult =
  | PermissionCheckSuccess
  | PermissionCheckDenied
  | PermissionCheckError;
