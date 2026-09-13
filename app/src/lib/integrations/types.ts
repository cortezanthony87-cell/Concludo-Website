export type IntegrationProvider =
  | 'microsoft_planner'
  | 'microsoft_todo'
  | 'microsoft_teams'
  | 'microsoft_outlook'
  | 'trello'
  | 'asana'
  | 'monday'
  | 'jira'
  | 'clickup'
  | 'notion'
  | 'slack'
  | 'hubspot'
  | 'salesforce';

export type IntegrationStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'syncing'
  | 'paused';

export interface Integration {
  id: string;
  user_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connected_at?: string | null;
  last_sync_at?: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export type SyncType = 'manual' | 'scheduled' | 'export' | 'one_way';

export type SyncStatus = 'completed' | 'failed' | 'partial';

export interface IntegrationSyncLog {
  id: string;
  integration_id?: string | null;
  user_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  provider: string;
  sync_type: SyncType;
  records_processed: number;
  success_count: number;
  failure_count: number;
  duration_ms: number;
  details: Record<string, any>;
  status: SyncStatus;
  created_at: string;
}

export type ExportType =
  | 'action'
  | 'decision'
  | 'project'
  | 'report'
  | 'intelligence'
  | 'bulk';

export interface AutomationExport {
  id: string;
  user_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  export_type: ExportType;
  destination: string;
  records_count: number;
  status: 'success' | 'failed';
  payload_summary: Record<string, any>;
  error_message?: string | null;
  created_at: string;
}

export type WebhookStatus = 'active' | 'inactive' | 'failed';

export type WebhookEventType =
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'decision_created'
  | 'decision_updated'
  | 'decision_deleted'
  | 'action_created'
  | 'action_updated'
  | 'action_completed'
  | 'action_deleted'
  | 'report_generated';

export interface Webhook {
  id: string;
  owner_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  name: string;
  endpoint_url: string;
  status: WebhookStatus;
  // Signing key is never exposed on client fetches; only returned once on creation if needed
  secret_key?: string | null;
  events: WebhookEventType[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  status: 'delivered' | 'failed' | 'retrying';
  request_payload: Record<string, any>;
  response_code: number;
  attempt_count: number;
  error_message?: string | null;
  created_at: string;
}

export type ApiKeyStatus = 'active' | 'revoked';

export interface ApiKey {
  id: string;
  owner_id: string;
  team_id?: string | null;
  organization_id?: string | null;
  name: string;
  key_prefix: string; // e.g. "cnc_live_ab12..." - key_hash is NEVER returned to client
  status: ApiKeyStatus;
  created_at: string;
  expires_at?: string | null;
  last_used_at?: string | null;
}

export interface CreateApiKeyResult {
  apiKey: string; // The plaintext secret key, returned ONLY once!
  keyRecord: ApiKey;
}

export interface ProviderMeta {
  id: IntegrationProvider;
  name: string;
  category: 'Project Management' | 'Collaboration' | 'CRM' | 'Documentation';
  description: string;
  iconName: string;
  exportTypes: ExportType[];
}

export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    id: 'microsoft_planner',
    name: 'Microsoft Planner',
    category: 'Project Management',
    description: 'Export action items and assign tasks directly into Microsoft 365 Planner buckets.',
    iconName: 'CheckSquare',
    exportTypes: ['action', 'bulk'],
  },
  {
    id: 'microsoft_todo',
    name: 'Microsoft To Do',
    category: 'Project Management',
    description: 'Synchronize personal and meeting actions to personal or shared Microsoft To Do task lists.',
    iconName: 'ListTodo',
    exportTypes: ['action', 'bulk'],
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    category: 'Collaboration',
    description: 'Post executive meeting summaries, decisions, and action cards into Teams channels.',
    iconName: 'MessageSquare',
    exportTypes: ['decision', 'project', 'report', 'action', 'bulk'],
  },
  {
    id: 'microsoft_outlook',
    name: 'Microsoft Outlook',
    category: 'Collaboration',
    description: 'Draft or dispatch structured follow-up emails and meeting recaps to attendees.',
    iconName: 'Mail',
    exportTypes: ['project', 'report', 'decision'],
  },
  {
    id: 'trello',
    name: 'Trello',
    category: 'Project Management',
    description: 'Send action items as structured cards to Trello boards and backlog lists.',
    iconName: 'Trello',
    exportTypes: ['action', 'bulk'],
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'Project Management',
    description: 'Create Asana tasks with assignees, due dates, and source meeting references.',
    iconName: 'CheckCircle2',
    exportTypes: ['action', 'bulk'],
  },
  {
    id: 'monday',
    name: 'Monday.com',
    category: 'Project Management',
    description: 'Sync accountability actions directly into Monday.com operational boards.',
    iconName: 'CalendarCheck',
    exportTypes: ['action', 'bulk'],
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'Project Management',
    description: 'Create Jira issues, subtasks, and action items linked to meeting context.',
    iconName: 'Boxes',
    exportTypes: ['action', 'bulk'],
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    category: 'Project Management',
    description: 'Push action items and tasks directly to ClickUp spaces and lists.',
    iconName: 'CheckCircle',
    exportTypes: ['action', 'bulk'],
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Documentation',
    description: 'Export structured project notes, decision logs, and meeting reports into Notion workspaces.',
    iconName: 'BookOpen',
    exportTypes: ['project', 'decision', 'action', 'report', 'bulk'],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Collaboration',
    description: 'Dispatch executive summaries, decision updates, and accountability alerts to Slack channels.',
    iconName: 'Hash',
    exportTypes: ['decision', 'project', 'report', 'action', 'bulk'],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description: 'Log meeting notes, key decisions, and client action items to HubSpot contact and deal records.',
    iconName: 'Briefcase',
    exportTypes: ['decision', 'project', 'action'],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'CRM',
    description: 'Sync account notes, strategic decisions, and follow-up tasks to Salesforce CRM.',
    iconName: 'Cloud',
    exportTypes: ['decision', 'project', 'action'],
  },
];
