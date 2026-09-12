export type PlanType =
  | 'free_preview'
  | 'starter_trial'
  | 'starter'
  | 'pro_trial'
  | 'pro'
  | 'team'
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
  | 'team_workspace'
  | 'admin_dashboard'
  | 'core_outputs'
  | 'copy_output'
  | 'json_export'
  | 'saved_projects'
  | 'transcript_archive'
  | 'manual_outputs'
  | 'next_best_action'
  | 'meeting_health_dashboard'
  | 'admin_tools';

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
  'team_workspace',
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
  team_workspace: 'Team Workspace',
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
    'team_workspace',
    'core_outputs',
    'copy_output',
    'json_export',
    'saved_projects',
    'transcript_archive',
    'manual_outputs',
    'next_best_action',
    'meeting_health_dashboard',
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
    'team_workspace',
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
  team_workspace: 'Available on Team',
  admin_dashboard: 'Available on Admin',
  admin_tools: 'Available on Admin',
  saved_projects: 'Available on Pro',
  transcript_archive: 'Available on Pro',
  manual_outputs: 'Available on Pro',
  json_export: 'Available on Starter',
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
