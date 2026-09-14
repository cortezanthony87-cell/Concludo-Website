/**
 * Enterprise Governance, SSO, Compliance & Org Controls Types
 * Concludo Workspace - Tasklet 17 & 19
 */

export type OrganizationRole =
  | 'organization_owner'
  | 'organization_admin'
  | 'security_admin'
  | 'compliance_admin'
  | 'member'
  | 'viewer';

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
  allow_team_agents?: boolean;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
  updated_at: string;
  profile?: {
    email: string;
    full_name: string | null;
    is_suspended?: boolean;
    plan?: string;
  };
}

export interface OrganizationDomain {
  id: string;
  organization_id: string;
  domain: string;
  verified: boolean;
  verification_token: string;
  verified_at?: string | null;
  created_at: string;
}

export type SSOProvider =
  | 'Microsoft Entra ID'
  | 'Okta'
  | 'Google Workspace'
  | 'Ping Identity'
  | 'Generic SAML Provider';

export interface OrganizationSSOConfig {
  id: string;
  organization_id: string;
  provider_name: SSOProvider | string;
  protocol: 'saml' | 'oidc';
  login_url: string;
  issuer?: string | null;
  certificate?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  domain_mapping?: string | null;
  sso_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type AuditActionType =
  | 'user_login'
  | 'user_logout'
  | 'password_reset'
  | 'sso_login'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'decision_created'
  | 'decision_deleted'
  | 'action_created'
  | 'action_completed'
  | 'role_changed'
  | 'team_created'
  | 'team_deleted'
  | 'retention_changed'
  | 'governance_changed'
  | 'admin_action'
  | 'user_suspended'
  | 'user_reactivated'
  | 'legal_hold_created'
  | 'legal_hold_released'
  | 'sso_configured'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'export_executed'
  | 'webhook_created'
  | 'webhook_triggered'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'sync_executed'
  | 'export_failed'
  // Tasklet 19 Audited Events
  | 'agent_execution'
  | 'workflow_execution'
  | 'approval_request'
  | 'approval_granted'
  | 'approval_rejected'
  | 'automation_failure'
  | 'configuration_change'
  | 'workflow_change'
  // Tasklet 20 Audited Events
  | 'prediction_generation'
  | 'forecast_generation'
  | 'recommendation_generation'
  | 'executive_briefing_generation'
  | 'health_score_update'
  | 'strategic_report_creation'
  // Tasklet 21 Audited Events
  | 'knowledge_relationship_created'
  | 'knowledge_relationship_updated'
  | 'knowledge_search'
  | 'knowledge_explorer_access'
  | 'knowledge_visualization_access'
  | 'knowledge_cluster_creation'
  | 'knowledge_analytics_access';

export interface AuditLog {
  id: string;
  organization_id?: string | null;
  user_id?: string | null;
  action: AuditActionType | string;
  entity_type: string;
  entity_id?: string | null;
  details: Record<string, any>;
  ip_address?: string;
  created_at: string;
  user_email?: string;
}

export type RetentionEntityType =
  | 'project'
  | 'transcript'
  | 'decision'
  | 'action'
  | 'output'
  | 'endpoint_report'
  | 'agent_memory'
  | 'workflow';

export type RetentionPeriodDays = 30 | 90 | 180 | 365 | -1; // -1 = Indefinite

export interface RetentionPolicy {
  id: string;
  organization_id: string;
  entity_type: RetentionEntityType;
  retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface LegalHold {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  status: 'active' | 'released';
  created_at: string;
  updated_at: string;
}

export interface AccessReview {
  id: string;
  organization_id: string;
  reviewer_id?: string | null;
  target_user_id: string;
  role: string;
  teams: string[];
  status: 'approved' | 'revoked' | 'pending';
  notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  target_user_email?: string;
  target_user_name?: string | null;
}

export interface OrganizationAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalTeams: number;
  totalProjects: number;
  totalDecisions: number;
  totalActions: number;
  completedActions: number;
  completionRate: number;
  meetingVolume: number;
  activeLegalHolds: number;
  suspendedUsers: number;
  retentionPolicyCount: number;
}

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  organization_owner: 'Organization Owner',
  organization_admin: 'Organization Admin',
  security_admin: 'Security Admin',
  compliance_admin: 'Compliance Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_CAPABILITIES: Record<OrganizationRole, string[]> = {
  organization_owner: [
    'Full platform control',
    'Manage organization',
    'Manage admins',
    'Configure governance',
    'Configure SSO',
    'View audit logs',
  ],
  organization_admin: [
    'Manage users',
    'Manage teams',
    'Configure settings',
    'View reports',
  ],
  security_admin: [
    'View audit logs',
    'Configure security',
    'Review activity',
  ],
  compliance_admin: [
    'Configure retention',
    'Review governance',
    'Manage compliance policies',
  ],
  member: [
    'Standard access',
  ],
  viewer: [
    'Read-only access',
  ],
};
