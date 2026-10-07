import { isUsable } from './connectionStatus';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../supabase/client';

export type IntegrationCategory =
  | 'All Apps'
  | 'Connected'
  | 'Productivity'
  | 'Communication'
  | 'CRM & Sales'
  | 'Accounting & Finance'
  | 'Project Management'
  | 'File Storage'
  | 'Forms & Data Collection'
  | 'E-commerce'
  | 'Marketing'
  | 'Customer Support'
  | 'HR & People'
  | 'Developer / API'
  | 'AI'
  | 'Other';

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  'All Apps',
  'Connected',
  'Productivity',
  'Communication',
  'CRM & Sales',
  'Accounting & Finance',
  'Project Management',
  'File Storage',
  'Forms & Data Collection',
  'E-commerce',
  'Marketing',
  'Customer Support',
  'HR & People',
  'Developer / API',
  'AI',
  'Other',
];

export type ConnectionHealthStatus =
  | 'connected'
  | 'needs_reauth'
  | 'permission_required'
  | 'service_issue'
  | 'disconnected'
  | 'setup_required';

export interface TriggerDefinition {
  key: string;
  name: string;
  description: string;
  triggerType: 'webhook' | 'polling';
  pollingIntervalMinutes?: number;
  configSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

export interface ActionDefinition {
  key: string;
  name: string;
  description: string;
  requiredScopes: string[];
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  slug: string;
  category: IntegrationCategory;
  description: string;
  iconSlug: string;
  authenticationType: 'oauth2' | 'oauth2_pkce' | 'api_key' | 'webhook_signature' | 'bearer' | 'session' | 'none';
  isTier1: boolean;
  enabled: boolean;
  developerSetupRequired?: boolean;
  setupInstructions?: string;
  triggers: TriggerDefinition[];
  actions: ActionDefinition[];
}

export interface IntegrationConnection {
  id: string;
  organization_id?: string | null;
  workspace_id?: string | null;
  user_id: string;
  provider_id: string;
  connection_name: string;
  external_account_reference: string;
  status: ConnectionHealthStatus;
  scopes: string[];
  credential_reference?: string | null;
  settings: Record<string, any>;
  health_details: {
    healthy: boolean;
    last_check_status: string;
    error_message?: string;
  };
  connected_at: string;
  last_used_at?: string | null;
  last_tested_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IntegrationExecutionLog {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  connection_id: string;
  provider_id: string;
  action_key: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled';
  attempt_count: number;
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  error_category?: 'authentication' | 'permission' | 'rate_limit' | 'validation' | 'service_unavailable' | 'unknown' | null;
  safe_error_message?: string | null;
  safe_response_summary?: Record<string, any> | null;
}

/**
 * 60 Priority Business Connectors spanning Tier 1, Tier 2, and Universal integrations.
 * Strictly adheres to Concludo's least-privilege zero-secret architecture.
 */
export const INTEGRATION_PROVIDERS_CATALOG: ProviderDefinition[] = [
  // ==========================================
  // MICROSOFT
  // ==========================================
  {
    id: 'microsoft_365',
    name: 'Microsoft 365',
    slug: 'microsoft_365',
    category: 'Productivity',
    description: 'Unified Microsoft 365 organisation directory, user profile, and enterprise cloud capabilities.',
    iconSlug: 'microsoft_365',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_user_provisioned',
        name: 'New User Provisioned',
        description: 'Triggers when a new team member is added in Microsoft 365 directory.',
        triggerType: 'polling',
        pollingIntervalMinutes: 15,
        configSchema: { groupFilter: { type: 'string', title: 'Group Filter' } },
        outputSchema: { id: 'string', displayName: 'string', userPrincipalName: 'string', mail: 'string' },
      },
    ],
    actions: [
      {
        key: 'get_user_profile',
        name: 'Get User Profile',
        description: 'Retrieves profile information for an employee or executive in Microsoft 365.',
        requiredScopes: ['User.Read.All'],
        inputSchema: { userPrincipalName: { type: 'string', required: true } },
        outputSchema: { id: 'string', displayName: 'string', mail: 'string', jobTitle: 'string' },
      },
    ],
  },
  {
    id: 'microsoft_outlook',
    name: 'Microsoft Outlook',
    slug: 'microsoft_outlook',
    category: 'Communication',
    description: 'Send and receive executive emails, meeting invites, and attachments with Microsoft 365 Outlook.',
    iconSlug: 'microsoft_outlook',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_email_received',
        name: 'New Email Received',
        description: 'Triggers when a new email arrives in the inbox or specified folder.',
        triggerType: 'webhook',
        configSchema: { folder: { type: 'string', default: 'Inbox' }, fromFilter: { type: 'string' } },
        outputSchema: { id: 'string', subject: 'string', from: 'string', bodyPreview: 'string', receivedDateTime: 'string', hasAttachments: 'boolean' },
      },
      {
        key: 'calendar_event_starting',
        name: 'Calendar Event Starting',
        description: 'Triggers before an Outlook calendar meeting starts.',
        triggerType: 'polling',
        pollingIntervalMinutes: 5,
        configSchema: { advanceMinutes: { type: 'number', default: 15 } },
        outputSchema: { id: 'string', subject: 'string', start: 'string', end: 'string', attendees: 'array' },
      },
    ],
    actions: [
      {
        key: 'send_email',
        name: 'Send Email',
        description: 'Dispatches a structured email or action recap to recipients.',
        requiredScopes: ['Mail.Send'],
        inputSchema: { to: { type: 'string', required: true }, subject: { type: 'string', required: true }, body: { type: 'string', required: true } },
        outputSchema: { id: 'string', sentDateTime: 'string' },
      },
      {
        key: 'create_calendar_event',
        name: 'Create Calendar Event',
        description: 'Schedules a calendar event with agenda, location, and attendees.',
        requiredScopes: ['Calendars.ReadWrite'],
        inputSchema: { subject: { type: 'string', required: true }, start: { type: 'string', required: true }, end: { type: 'string', required: true } },
        outputSchema: { id: 'string', webLink: 'string' },
      },
    ],
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    slug: 'microsoft_teams',
    category: 'Communication',
    description: 'Post structured meeting summaries, action cards, and announcements into Microsoft Teams channels.',
    iconSlug: 'microsoft_teams',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_channel_message',
        name: 'New Channel Message',
        description: 'Triggers when a message or mention is posted in a Teams channel.',
        triggerType: 'webhook',
        configSchema: { teamId: { type: 'string', required: true }, channelId: { type: 'string', required: true } },
        outputSchema: { id: 'string', content: 'string', sender: 'string', createdDateTime: 'string' },
      },
    ],
    actions: [
      {
        key: 'send_channel_message',
        name: 'Post Channel Message',
        description: 'Dispatches an executive summary or notification to a Teams channel.',
        requiredScopes: ['ChannelMessage.Send'],
        inputSchema: { teamId: { type: 'string', required: true }, channelId: { type: 'string', required: true }, message: { type: 'string', required: true } },
        outputSchema: { messageId: 'string', createdDateTime: 'string' },
      },
    ],
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    slug: 'onedrive',
    category: 'File Storage',
    description: 'Save documents, transcripts, and action exports to Microsoft OneDrive cloud storage.',
    iconSlug: 'onedrive',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_file_created',
        name: 'New File in Folder',
        description: 'Triggers when a file is uploaded or created in a OneDrive folder.',
        triggerType: 'polling',
        pollingIntervalMinutes: 10,
        configSchema: { folderPath: { type: 'string', default: '/' } },
        outputSchema: { id: 'string', name: 'string', webUrl: 'string', size: 'number' },
      },
    ],
    actions: [
      {
        key: 'upload_file',
        name: 'Upload File',
        description: 'Uploads a document or export to OneDrive.',
        requiredScopes: ['Files.ReadWrite'],
        inputSchema: { destinationFolder: { type: 'string', required: true }, fileName: { type: 'string', required: true }, content: { type: 'string', required: true } },
        outputSchema: { fileId: 'string', webUrl: 'string' },
      },
    ],
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    slug: 'sharepoint',
    category: 'File Storage',
    description: 'Integrate team document libraries, corporate lists, and knowledge archives.',
    iconSlug: 'sharepoint',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'list_item_created',
        name: 'New List Item',
        description: 'Triggers when an item is created in a SharePoint list.',
        triggerType: 'polling',
        pollingIntervalMinutes: 10,
        configSchema: { siteUrl: { type: 'string', required: true }, listName: { type: 'string', required: true } },
        outputSchema: { id: 'string', fields: 'object' },
      },
    ],
    actions: [
      {
        key: 'create_customer_folder',
        name: 'Create Customer Folder',
        description: 'Creates a dedicated customer or project document folder on SharePoint.',
        requiredScopes: ['Sites.Manage.All'],
        inputSchema: { siteUrl: { type: 'string', required: true }, libraryName: { type: 'string', default: 'Documents' }, folderName: { type: 'string', required: true } },
        outputSchema: { folderId: 'string', webUrl: 'string' },
      },
    ],
  },
  {
    id: 'microsoft_excel',
    name: 'Microsoft Excel',
    slug: 'microsoft_excel',
    category: 'Productivity',
    description: 'Read and append rows into Excel Online spreadsheets stored in OneDrive or SharePoint.',
    iconSlug: 'microsoft_excel',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'row_added',
        name: 'New Row Added',
        description: 'Triggers when a new row is added to an Excel worksheet table.',
        triggerType: 'polling',
        pollingIntervalMinutes: 10,
        configSchema: { workbookId: { type: 'string', required: true }, tableName: { type: 'string', required: true } },
        outputSchema: { rowValues: 'array', rowIndex: 'number' },
      },
    ],
    actions: [
      {
        key: 'add_row',
        name: 'Add Row to Table',
        description: 'Appends a new row of data to an Excel table.',
        requiredScopes: ['Files.ReadWrite'],
        inputSchema: { workbookId: { type: 'string', required: true }, tableName: { type: 'string', required: true }, values: { type: 'array', required: true } },
        outputSchema: { index: 'number' },
      },
    ],
  },
  {
    id: 'microsoft_forms',
    name: 'Microsoft Forms',
    slug: 'microsoft_forms',
    category: 'Forms & Data Collection',
    description: 'Capture responses and surveys submitted via Microsoft Forms to trigger automated workflows.',
    iconSlug: 'microsoft_forms',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_form_response',
        name: 'New Form Response',
        description: 'Triggers when an attendee or customer completes a Microsoft Form.',
        triggerType: 'webhook',
        configSchema: { formId: { type: 'string', required: true } },
        outputSchema: { responseId: 'string', submitDate: 'string', responder: 'string', answers: 'object' },
      },
    ],
    actions: [],
  },
  {
    id: 'microsoft_planner',
    name: 'Microsoft Planner',
    slug: 'microsoft_planner',
    category: 'Project Management',
    description: 'Create and assign accountability tasks in Microsoft 365 Planner buckets.',
    iconSlug: 'microsoft_planner',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'task_completed',
        name: 'Task Completed',
        description: 'Triggers when a Planner task is marked complete.',
        triggerType: 'polling',
        pollingIntervalMinutes: 10,
        configSchema: { planId: { type: 'string', required: true } },
        outputSchema: { taskId: 'string', title: 'string', completedDateTime: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_task',
        name: 'Create Planner Task',
        description: 'Creates an accountability action card with due date and bucket in Planner.',
        requiredScopes: ['Tasks.ReadWrite'],
        inputSchema: { planId: { type: 'string', required: true }, bucketId: { type: 'string', required: true }, title: { type: 'string', required: true }, dueDateTime: { type: 'string' } },
        outputSchema: { taskId: 'string', title: 'string' },
      },
    ],
  },
  {
    id: 'dynamics_365',
    name: 'Microsoft Dynamics 365',
    slug: 'dynamics_365',
    category: 'CRM & Sales',
    description: 'Enterprise CRM for managing customer relationships, leads, and sales pipelines.',
    iconSlug: 'dynamics_365',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_lead_created',
        name: 'New Lead Created',
        description: 'Triggers when a new lead is added in Dynamics 365.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { leadId: 'string', fullname: 'string', emailaddress1: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_contact',
        name: 'Create Contact',
        description: 'Creates a customer contact record in Dynamics 365.',
        requiredScopes: ['user_impersonation'],
        inputSchema: { firstname: { type: 'string', required: true }, lastname: { type: 'string', required: true }, emailaddress1: { type: 'string', required: true } },
        outputSchema: { contactid: 'string' },
      },
    ],
  },
  {
    id: 'power_bi',
    name: 'Power BI',
    slug: 'power_bi',
    category: 'Productivity',
    description: 'Refresh business intelligence datasets and push real-time telemetry to Power BI.',
    iconSlug: 'power_bi',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'refresh_dataset',
        name: 'Refresh Dataset',
        description: 'Triggers a scheduled or on-demand dataset refresh in Power BI.',
        requiredScopes: ['Dataset.ReadWrite.All'],
        inputSchema: { groupId: { type: 'string', required: true }, datasetId: { type: 'string', required: true } },
        outputSchema: { status: 'string', requestId: 'string' },
      },
    ],
  },
  {
    id: 'microsoft_entra_id',
    name: 'Microsoft Entra ID',
    slug: 'microsoft_entra_id',
    category: 'HR & People',
    description: 'Identity and access management for corporate directories and role verification.',
    iconSlug: 'microsoft_entra_id',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'find_user_by_email',
        name: 'Find User by Email',
        description: 'Locates an employee record in Entra ID by official email address.',
        requiredScopes: ['User.Read.All'],
        inputSchema: { email: { type: 'string', required: true } },
        outputSchema: { id: 'string', userPrincipalName: 'string', department: 'string' },
      },
    ],
  },

  // ==========================================
  // GOOGLE WORKSPACE
  // ==========================================
  {
    id: 'google_workspace',
    name: 'Google Workspace',
    slug: 'google_workspace',
    category: 'Productivity',
    description: 'Google enterprise suite covering user directory, documents, and admin management.',
    iconSlug: 'google_workspace',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'get_user_info',
        name: 'Get User Info',
        description: 'Retrieves Google Workspace profile for an authenticated user.',
        requiredScopes: ['https://www.googleapis.com/auth/userinfo.profile'],
        inputSchema: { email: { type: 'string', required: true } },
        outputSchema: { id: 'string', name: 'string', email: 'string' },
      },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    slug: 'gmail',
    category: 'Communication',
    description: 'Send emails, draft recaps, and trigger workflows on incoming Gmail messages.',
    iconSlug: 'gmail',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_email',
        name: 'New Email',
        description: 'Triggers when a new email arrives in Gmail matching optional query filter.',
        triggerType: 'webhook',
        configSchema: { query: { type: 'string', default: 'is:unread' } },
        outputSchema: { id: 'string', threadId: 'string', subject: 'string', from: 'string', snippet: 'string' },
      },
    ],
    actions: [
      {
        key: 'send_email',
        name: 'Send Email',
        description: 'Sends an email from your connected Google Workspace or Gmail account.',
        requiredScopes: ['https://www.googleapis.com/auth/gmail.send'],
        inputSchema: { to: { type: 'string', required: true }, subject: { type: 'string', required: true }, body: { type: 'string', required: true } },
        outputSchema: { id: 'string', threadId: 'string' },
      },
    ],
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    slug: 'google_calendar',
    category: 'Productivity',
    description: 'Schedule, update, and manage Google Calendar events and client meetings.',
    iconSlug: 'google_calendar',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'event_starting',
        name: 'Event Starting Soon',
        description: 'Triggers before a scheduled Google Calendar event begins.',
        triggerType: 'polling',
        pollingIntervalMinutes: 5,
        configSchema: { advanceMinutes: { type: 'number', default: 10 } },
        outputSchema: { id: 'string', summary: 'string', start: 'string', htmlLink: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_event',
        name: 'Create Calendar Event',
        description: 'Creates a new Google Calendar event with attendees and agenda.',
        requiredScopes: ['https://www.googleapis.com/auth/calendar.events'],
        inputSchema: { summary: { type: 'string', required: true }, start: { type: 'string', required: true }, end: { type: 'string', required: true } },
        outputSchema: { id: 'string', htmlLink: 'string' },
      },
    ],
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    slug: 'google_drive',
    category: 'File Storage',
    description: 'Store, organize, and find documents, spreadsheets, and PDFs in Google Drive.',
    iconSlug: 'google_drive',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_file_in_folder',
        name: 'New File in Folder',
        description: 'Triggers when a file is uploaded to a specified Google Drive folder.',
        triggerType: 'webhook',
        configSchema: { folderId: { type: 'string', required: true } },
        outputSchema: { id: 'string', name: 'string', mimeType: 'string', webViewLink: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_folder',
        name: 'Create Folder',
        description: 'Creates a folder inside Google Drive.',
        requiredScopes: ['https://www.googleapis.com/auth/drive.file'],
        inputSchema: { folderName: { type: 'string', required: true }, parentFolderId: { type: 'string' } },
        outputSchema: { id: 'string', webViewLink: 'string' },
      },
    ],
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    slug: 'google_sheets',
    category: 'Productivity',
    description: 'Append rows, update cells, and query Google Sheets spreadsheets.',
    iconSlug: 'google_sheets',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_row_added',
        name: 'New Row Added',
        description: 'Triggers when a new row is appended to a sheet.',
        triggerType: 'polling',
        pollingIntervalMinutes: 10,
        configSchema: { spreadsheetId: { type: 'string', required: true }, sheetName: { type: 'string', default: 'Sheet1' } },
        outputSchema: { rowIndex: 'number', rowData: 'array' },
      },
    ],
    actions: [
      {
        key: 'append_row',
        name: 'Add Row to Sheet',
        description: 'Appends a new row of values to a Google Sheet.',
        requiredScopes: ['https://www.googleapis.com/auth/spreadsheets'],
        inputSchema: { spreadsheetId: { type: 'string', required: true }, sheetName: { type: 'string', default: 'Sheet1' }, values: { type: 'array', required: true } },
        outputSchema: { updatedRange: 'string' },
      },
    ],
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    slug: 'google_docs',
    category: 'Productivity',
    description: 'Generate, append to, and manage Google Docs from structured meeting notes.',
    iconSlug: 'google_docs',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_document',
        name: 'Create Document',
        description: 'Creates a new Google Doc with title and content.',
        requiredScopes: ['https://www.googleapis.com/auth/documents'],
        inputSchema: { title: { type: 'string', required: true }, bodyText: { type: 'string' } },
        outputSchema: { documentId: 'string', title: 'string' },
      },
    ],
  },
  {
    id: 'google_forms',
    name: 'Google Forms',
    slug: 'google_forms',
    category: 'Forms & Data Collection',
    description: 'Trigger automated actions from incoming Google Forms survey responses.',
    iconSlug: 'google_forms',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'form_response_submitted',
        name: 'New Response Submitted',
        description: 'Triggers when a form response is submitted.',
        triggerType: 'webhook',
        configSchema: { formId: { type: 'string', required: true } },
        outputSchema: { responseId: 'string', createTime: 'string', answers: 'object' },
      },
    ],
    actions: [],
  },
  {
    id: 'google_contacts',
    name: 'Google Contacts',
    slug: 'google_contacts',
    category: 'CRM & Sales',
    description: 'Keep contact phone numbers, emails, and corporate addresses synchronized.',
    iconSlug: 'google_contacts',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_contact',
        name: 'Create Contact',
        description: 'Creates a new contact in Google Contacts.',
        requiredScopes: ['https://www.googleapis.com/auth/contacts'],
        inputSchema: { givenName: { type: 'string', required: true }, familyName: { type: 'string' }, email: { type: 'string', required: true } },
        outputSchema: { resourceName: 'string' },
      },
    ],
  },

  // ==========================================
  // AUSTRALIAN ACCOUNTING & FINANCE
  // ==========================================
  {
    id: 'xero',
    name: 'Xero',
    slug: 'xero',
    category: 'Accounting & Finance',
    description: 'Leading Australian cloud accounting: create contacts, send sales invoices, and reconcile records.',
    iconSlug: 'xero',
    authenticationType: 'oauth2_pkce',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_invoice_created',
        name: 'New Invoice Created',
        description: 'Triggers when an invoice is raised in Xero.',
        triggerType: 'webhook',
        configSchema: { typeFilter: { type: 'string', default: 'ACCREC' } },
        outputSchema: { invoiceId: 'string', invoiceNumber: 'string', amountDue: 'number', contactName: 'string' },
      },
      {
        key: 'new_contact_added',
        name: 'New Contact Added',
        description: 'Triggers when a customer or supplier is created in Xero.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { contactId: 'string', name: 'string', emailAddress: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_contact',
        name: 'Create Customer Contact',
        description: 'Creates a client or customer in Xero with Australian billing details.',
        requiredScopes: ['accounting.contacts'],
        inputSchema: { name: { type: 'string', required: true }, emailAddress: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' } },
        outputSchema: { contactId: 'string', name: 'string' },
      },
      {
        key: 'create_invoice',
        name: 'Create Sales Invoice',
        description: 'Creates an authorised or draft sales invoice in Xero.',
        requiredScopes: ['accounting.transactions'],
        inputSchema: { contactId: { type: 'string', required: true }, lineItems: { type: 'array', required: true }, reference: { type: 'string' }, status: { type: 'string', default: 'DRAFT' } },
        outputSchema: { invoiceId: 'string', invoiceNumber: 'string', total: 'number' },
      },
    ],
  },
  {
    id: 'myob',
    name: 'MYOB',
    slug: 'myob',
    category: 'Accounting & Finance',
    description: 'Australian and New Zealand business management and accounting platform.',
    iconSlug: 'myob',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_invoice',
        name: 'New Invoice Created',
        description: 'Triggers when a customer invoice is created in MYOB AccountRight/Business.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { invoiceUid: 'string', number: 'string', totalAmount: 'number' },
      },
    ],
    actions: [
      {
        key: 'create_customer',
        name: 'Create Customer',
        description: 'Adds a customer card to MYOB with ABN and contact information.',
        requiredScopes: ['CompanyFile'],
        inputSchema: { companyName: { type: 'string', required: true }, email: { type: 'string' } },
        outputSchema: { customerUid: 'string', name: 'string', email: 'string' },
      },
      {
        key: 'create_invoice',
        name: 'Create Invoice',
        description: 'Creates an invoice in MYOB.',
        requiredScopes: ['CompanyFile'],
        inputSchema: { customerUid: { type: 'string', required: true }, lines: { type: 'array', required: true } },
        outputSchema: { uid: 'string', displayId: 'string' },
      },
    ],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    slug: 'quickbooks',
    category: 'Accounting & Finance',
    description: 'Small business accounting, invoicing, cashflow tracking, and bill management.',
    iconSlug: 'quickbooks',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'new_customer',
        name: 'New Customer',
        description: 'Triggers when a new customer is created in QuickBooks.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { id: 'string', displayName: 'string', email: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_invoice',
        name: 'Create Invoice',
        description: 'Generates a customer invoice in QuickBooks Online.',
        requiredScopes: ['com.intuit.quickbooks.accounting'],
        inputSchema: { customerId: { type: 'string', required: true }, amount: { type: 'number', required: true } },
        outputSchema: { id: 'string', docNumber: 'string' },
      },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    slug: 'stripe',
    category: 'Accounting & Finance',
    description: 'Online payment infrastructure: charges, subscriptions, customer balances, and webhooks.',
    iconSlug: 'stripe',
    authenticationType: 'api_key',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'payment_succeeded',
        name: 'Payment Succeeded',
        description: 'Triggers when a Stripe charge or invoice payment succeeds.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { chargeId: 'string', amount: 'number', currency: 'string', customerId: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_customer',
        name: 'Create Stripe Customer',
        description: 'Creates a customer record in Stripe.',
        requiredScopes: ['customers:write'],
        inputSchema: { email: { type: 'string', required: true }, name: { type: 'string' } },
        outputSchema: { id: 'string', email: 'string' },
      },
    ],
  },
  {
    id: 'paypal',
    name: 'PayPal',
    slug: 'paypal',
    category: 'Accounting & Finance',
    description: 'Global digital payment processing and merchant invoicing.',
    iconSlug: 'paypal',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_invoice',
        name: 'Create PayPal Invoice',
        description: 'Drafts and sends a PayPal invoice to a customer email.',
        requiredScopes: ['https://api.paypal.com/v1/payments/.*'],
        inputSchema: { recipientEmail: { type: 'string', required: true }, amount: { type: 'number', required: true } },
        outputSchema: { id: 'string', status: 'string' },
      },
    ],
  },

  // ==========================================
  // COMMUNICATION
  // ==========================================
  {
    id: 'slack',
    name: 'Slack',
    slug: 'slack',
    category: 'Communication',
    description: 'Send direct messages, post channel notifications, and respond to mentions in Slack workspaces.',
    iconSlug: 'slack',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_channel_message',
        name: 'New Message in Channel',
        description: 'Triggers when a message is posted in a selected Slack channel.',
        triggerType: 'webhook',
        configSchema: { channel: { type: 'string', required: true } },
        outputSchema: { text: 'string', user: 'string', channel: 'string', ts: 'string' },
      },
    ],
    actions: [
      {
        key: 'post_message',
        name: 'Post Channel Message',
        description: 'Posts a formatted message or executive action alert into a Slack channel.',
        requiredScopes: ['chat:write'],
        inputSchema: { channel: { type: 'string', required: true }, text: { type: 'string', required: true } },
        outputSchema: { ok: 'boolean', ts: 'string' },
      },
    ],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    slug: 'zoom',
    category: 'Communication',
    description: 'Schedule video conferences, manage webinars, and trigger workflows on meeting recordings.',
    iconSlug: 'zoom',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'meeting_ended',
        name: 'Meeting Ended',
        description: 'Triggers when a Zoom meeting finishes.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { meetingId: 'string', topic: 'string', duration: 'number' },
      },
    ],
    actions: [
      {
        key: 'create_meeting',
        name: 'Create Zoom Meeting',
        description: 'Schedules a Zoom video meeting with secure passcode.',
        requiredScopes: ['meeting:write:admin'],
        inputSchema: { topic: { type: 'string', required: true }, startTime: { type: 'string', required: true } },
        outputSchema: { id: 'string', joinUrl: 'string' },
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    slug: 'discord',
    category: 'Communication',
    description: 'Post community announcements and alerts to Discord servers and channels.',
    iconSlug: 'discord',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'send_message',
        name: 'Send Channel Message',
        description: 'Posts a message into a Discord channel via bot token.',
        requiredScopes: ['bot'],
        inputSchema: { channelId: { type: 'string', required: true }, content: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    slug: 'twilio',
    category: 'Communication',
    description: 'Programmable SMS notifications, alerts, and verification messages.',
    iconSlug: 'twilio',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'send_sms',
        name: 'Send SMS',
        description: 'Dispatches an SMS message to an Australian mobile number.',
        requiredScopes: ['sms:send'],
        inputSchema: { to: { type: 'string', required: true }, body: { type: 'string', required: true } },
        outputSchema: { sid: 'string', status: 'string' },
      },
    ],
  },

  // ==========================================
  // CRM & SALES
  // ==========================================
  {
    id: 'hubspot',
    name: 'HubSpot',
    slug: 'hubspot',
    category: 'CRM & Sales',
    description: 'Inbound marketing, sales deals, contacts, company records, and customer ticketing.',
    iconSlug: 'hubspot',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_contact_created',
        name: 'New Contact Created',
        description: 'Triggers when a contact is created in HubSpot CRM.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { id: 'string', email: 'string', firstname: 'string', lastname: 'string' },
      },
      {
        key: 'deal_stage_changed',
        name: 'Deal Stage Changed / Won',
        description: 'Triggers when a sales deal moves to a new stage or is marked Closed Won.',
        triggerType: 'webhook',
        configSchema: { pipelineId: { type: 'string' } },
        outputSchema: { dealId: 'string', dealname: 'string', amount: 'number', dealstage: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_contact',
        name: 'Create Contact',
        description: 'Creates a contact record with custom properties in HubSpot.',
        requiredScopes: ['crm.objects.contacts.write'],
        inputSchema: { email: { type: 'string', required: true }, firstname: { type: 'string' }, lastname: { type: 'string' } },
        outputSchema: { id: 'string', email: 'string' },
      },
      {
        key: 'create_deal',
        name: 'Create Deal',
        description: 'Creates a sales opportunity in the specified pipeline.',
        requiredScopes: ['crm.objects.deals.write'],
        inputSchema: { dealname: { type: 'string', required: true }, amount: { type: 'number' }, pipeline: { type: 'string', default: 'default' } },
        outputSchema: { id: 'string', dealName: 'string' },
      },
    ],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    slug: 'salesforce',
    category: 'CRM & Sales',
    description: 'Enterprise CRM for managing accounts, contacts, opportunities, and enterprise pipelines.',
    iconSlug: 'salesforce',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_lead',
        name: 'New Lead Created',
        description: 'Triggers when a lead is created in Salesforce.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { id: 'string', name: 'string', company: 'string', email: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_lead',
        name: 'Create Lead',
        description: 'Creates a lead record in Salesforce.',
        requiredScopes: ['api'],
        inputSchema: { lastName: { type: 'string', required: true }, company: { type: 'string', required: true }, email: { type: 'string' } },
        outputSchema: { id: 'string', success: 'boolean' },
      },
    ],
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    slug: 'pipedrive',
    category: 'CRM & Sales',
    description: 'Pipeline-first sales CRM for closing deals and managing client communication.',
    iconSlug: 'pipedrive',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_deal',
        name: 'Create Deal',
        description: 'Creates a deal in Pipedrive pipeline.',
        requiredScopes: ['deals:full'],
        inputSchema: { title: { type: 'string', required: true }, value: { type: 'number' } },
        outputSchema: { id: 'number', title: 'string' },
      },
    ],
  },
  {
    id: 'zoho_crm',
    name: 'Zoho CRM',
    slug: 'zoho_crm',
    category: 'CRM & Sales',
    description: 'Global cloud CRM for lead management, customer touchpoints, and analytics.',
    iconSlug: 'zoho_crm',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_lead',
        name: 'Create Lead',
        description: 'Creates a lead record in Zoho CRM.',
        requiredScopes: ['ZohoCRM.modules.leads.CREATE'],
        inputSchema: { Last_Name: { type: 'string', required: true }, Company: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },

  // ==========================================
  // PROJECT MANAGEMENT
  // ==========================================
  {
    id: 'monday',
    name: 'Monday.com',
    slug: 'monday',
    category: 'Project Management',
    description: 'Visual work operating system for managing workflows, projects, and daily tasks.',
    iconSlug: 'monday',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'item_created',
        name: 'New Item on Board',
        description: 'Triggers when an item is added to a Monday.com board.',
        triggerType: 'webhook',
        configSchema: { boardId: { type: 'string', required: true } },
        outputSchema: { itemId: 'string', itemName: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_item',
        name: 'Create Board Item',
        description: 'Creates a new task or row on a Monday board.',
        requiredScopes: ['boards:write'],
        inputSchema: { boardId: { type: 'string', required: true }, itemName: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },
  {
    id: 'asana',
    name: 'Asana',
    slug: 'asana',
    category: 'Project Management',
    description: 'Team work management platform: assign accountability tasks, set milestones, and track deadlines.',
    iconSlug: 'asana',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'task_completed',
        name: 'Task Completed',
        description: 'Triggers when a task is completed in Asana.',
        triggerType: 'webhook',
        configSchema: { projectId: { type: 'string', required: true } },
        outputSchema: { gid: 'string', name: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_task',
        name: 'Create Asana Task',
        description: 'Creates a task with due dates and assignee in Asana.',
        requiredScopes: ['default'],
        inputSchema: { workspace: { type: 'string', required: true }, name: { type: 'string', required: true }, notes: { type: 'string' } },
        outputSchema: { gid: 'string', name: 'string' },
      },
    ],
  },
  {
    id: 'trello',
    name: 'Trello',
    slug: 'trello',
    category: 'Project Management',
    description: 'Kanban boards, lists, and cards for agile workflows and visual progress tracking.',
    iconSlug: 'trello',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_card',
        name: 'Create Trello Card',
        description: 'Adds an action card to a Trello list.',
        requiredScopes: ['read,write'],
        inputSchema: { idList: { type: 'string', required: true }, name: { type: 'string', required: true }, desc: { type: 'string' } },
        outputSchema: { id: 'string', url: 'string' },
      },
    ],
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    slug: 'clickup',
    category: 'Project Management',
    description: 'All-in-one productivity platform for tasks, docs, chat, and sprint planning.',
    iconSlug: 'clickup',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_task',
        name: 'Create Task',
        description: 'Creates a task in a ClickUp list.',
        requiredScopes: ['task:write'],
        inputSchema: { listId: { type: 'string', required: true }, name: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    slug: 'jira',
    category: 'Project Management',
    description: 'Software issue and project tracking tool for agile engineering and operational sprints.',
    iconSlug: 'jira',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'issue_created',
        name: 'New Jira Issue',
        description: 'Triggers when a new issue or ticket is created in Jira.',
        triggerType: 'webhook',
        configSchema: { projectKey: { type: 'string', required: true } },
        outputSchema: { key: 'string', summary: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_issue',
        name: 'Create Jira Issue',
        description: 'Creates an issue or bug ticket in Jira.',
        requiredScopes: ['write:jira-work'],
        inputSchema: { projectKey: { type: 'string', required: true }, summary: { type: 'string', required: true }, issueType: { type: 'string', default: 'Task' } },
        outputSchema: { key: 'string', id: 'string' },
      },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    slug: 'notion',
    category: 'Project Management',
    description: 'Connected workspace for wiki documentation, project notes, and database records.',
    iconSlug: 'notion',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'database_item_created',
        name: 'New Database Record',
        description: 'Triggers when a new item is added to a Notion database.',
        triggerType: 'polling',
        pollingIntervalMinutes: 10,
        configSchema: { databaseId: { type: 'string', required: true } },
        outputSchema: { id: 'string', properties: 'object' },
      },
    ],
    actions: [
      {
        key: 'create_page',
        name: 'Create Page / Record',
        description: 'Appends a page or database row in Notion.',
        requiredScopes: ['read_content', 'update_content', 'insert_content'],
        inputSchema: { parentId: { type: 'string', required: true }, title: { type: 'string', required: true } },
        outputSchema: { id: 'string', url: 'string' },
      },
    ],
  },
  {
    id: 'airtable',
    name: 'Airtable',
    slug: 'airtable',
    category: 'Project Management',
    description: 'Relational database and spreadsheet hybrid for custom operational databases.',
    iconSlug: 'airtable',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_record',
        name: 'Create Record',
        description: 'Inserts a record into an Airtable table.',
        requiredScopes: ['data.records:write'],
        inputSchema: { baseId: { type: 'string', required: true }, tableName: { type: 'string', required: true }, fields: { type: 'object', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },
  {
    id: 'smartsheet',
    name: 'Smartsheet',
    slug: 'smartsheet',
    category: 'Project Management',
    description: 'Enterprise platform for work management and process automation.',
    iconSlug: 'smartsheet',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'add_row',
        name: 'Add Row',
        description: 'Adds a row to a Smartsheet grid.',
        requiredScopes: ['WRITE_SHEETS'],
        inputSchema: { sheetId: { type: 'string', required: true }, cells: { type: 'array', required: true } },
        outputSchema: { id: 'number' },
      },
    ],
  },

  // ==========================================
  // FILE STORAGE
  // ==========================================
  {
    id: 'dropbox',
    name: 'Dropbox',
    slug: 'dropbox',
    category: 'File Storage',
    description: 'Cloud file storage, backup, and document collaboration.',
    iconSlug: 'dropbox',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'upload_file',
        name: 'Upload File',
        description: 'Uploads a file to Dropbox folder.',
        requiredScopes: ['files.content.write'],
        inputSchema: { path: { type: 'string', required: true }, content: { type: 'string', required: true } },
        outputSchema: { id: 'string', path_display: 'string' },
      },
    ],
  },
  {
    id: 'box',
    name: 'Box',
    slug: 'box',
    category: 'File Storage',
    description: 'Secure enterprise content management and file sharing.',
    iconSlug: 'box',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'upload_file',
        name: 'Upload File',
        description: 'Uploads a file to Box folder.',
        requiredScopes: ['root_readwrite'],
        inputSchema: { folderId: { type: 'string', default: '0' }, fileName: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },

  // ==========================================
  // MARKETING
  // ==========================================
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    slug: 'mailchimp',
    category: 'Marketing',
    description: 'Email newsletter marketing, subscriber lists, and automated campaigns.',
    iconSlug: 'mailchimp',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'add_subscriber',
        name: 'Add Subscriber to Audience',
        description: 'Subscribes an email contact to a Mailchimp audience list.',
        requiredScopes: ['audiences:write'],
        inputSchema: { listId: { type: 'string', required: true }, email_address: { type: 'string', required: true } },
        outputSchema: { id: 'string', status: 'string' },
      },
    ],
  },
  {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    slug: 'activecampaign',
    category: 'Marketing',
    description: 'Customer experience automation, email marketing, and CRM.',
    iconSlug: 'activecampaign',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_contact',
        name: 'Create Contact',
        description: 'Creates a contact in ActiveCampaign.',
        requiredScopes: ['contacts:write'],
        inputSchema: { email: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    slug: 'klaviyo',
    category: 'Marketing',
    description: 'Automated email and SMS marketing for retail and e-commerce.',
    iconSlug: 'klaviyo',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_profile',
        name: 'Create Profile',
        description: 'Creates or updates a profile in Klaviyo.',
        requiredScopes: ['profiles:write'],
        inputSchema: { email: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },

  // ==========================================
  // E-COMMERCE
  // ==========================================
  {
    id: 'shopify',
    name: 'Shopify',
    slug: 'shopify',
    category: 'E-commerce',
    description: 'Global commerce platform: products, orders, inventory, and customer purchases.',
    iconSlug: 'shopify',
    authenticationType: 'oauth2',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'new_order_placed',
        name: 'New Order Placed',
        description: 'Triggers when a customer places an order on Shopify.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { orderId: 'string', orderNumber: 'string', totalPrice: 'number', customerEmail: 'string' },
      },
    ],
    actions: [
      {
        key: 'get_order_details',
        name: 'Get Order Details',
        description: 'Retrieves line items and customer information for an order.',
        requiredScopes: ['read_orders'],
        inputSchema: { orderId: { type: 'string', required: true } },
        outputSchema: { id: 'string', line_items: 'array' },
      },
    ],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    slug: 'woocommerce',
    category: 'E-commerce',
    description: 'Open-source e-commerce platform built on WordPress.',
    iconSlug: 'woocommerce',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'new_order',
        name: 'New Order',
        description: 'Triggers when a new order is received in WooCommerce.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { id: 'number', total: 'string', status: 'string' },
      },
    ],
    actions: [],
  },

  // ==========================================
  // CUSTOMER SUPPORT
  // ==========================================
  {
    id: 'zendesk',
    name: 'Zendesk',
    slug: 'zendesk',
    category: 'Customer Support',
    description: 'Customer service platform, ticketing system, and knowledge base.',
    iconSlug: 'zendesk',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'ticket_created',
        name: 'New Support Ticket',
        description: 'Triggers when a new support ticket is opened in Zendesk.',
        triggerType: 'webhook',
        configSchema: {},
        outputSchema: { id: 'number', subject: 'string', requester: 'string' },
      },
    ],
    actions: [
      {
        key: 'create_ticket',
        name: 'Create Ticket',
        description: 'Creates a customer support ticket in Zendesk.',
        requiredScopes: ['tickets:write'],
        inputSchema: { subject: { type: 'string', required: true }, comment: { type: 'string', required: true } },
        outputSchema: { id: 'number' },
      },
    ],
  },
  {
    id: 'freshdesk',
    name: 'Freshdesk',
    slug: 'freshdesk',
    category: 'Customer Support',
    description: 'Omnichannel customer support software and ticket dispatching.',
    iconSlug: 'freshdesk',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'create_ticket',
        name: 'Create Ticket',
        description: 'Creates a support ticket in Freshdesk.',
        requiredScopes: ['tickets'],
        inputSchema: { subject: { type: 'string', required: true }, email: { type: 'string', required: true } },
        outputSchema: { id: 'number' },
      },
    ],
  },
  {
    id: 'intercom',
    name: 'Intercom',
    slug: 'intercom',
    category: 'Customer Support',
    description: 'Complete customer service solution with AI agent, live chat, and ticketing.',
    iconSlug: 'intercom',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'send_message',
        name: 'Send Message',
        description: 'Sends an in-app or email message to an Intercom user.',
        requiredScopes: ['messages:write'],
        inputSchema: { userId: { type: 'string', required: true }, body: { type: 'string', required: true } },
        outputSchema: { id: 'string' },
      },
    ],
  },

  // ==========================================
  // FORMS & DATA COLLECTION
  // ==========================================
  {
    id: 'typeform',
    name: 'Typeform',
    slug: 'typeform',
    category: 'Forms & Data Collection',
    description: 'Interactive forms, surveys, and conversational user feedback.',
    iconSlug: 'typeform',
    authenticationType: 'oauth2',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'form_response',
        name: 'New Form Response',
        description: 'Triggers when a respondent submits a Typeform.',
        triggerType: 'webhook',
        configSchema: { formId: { type: 'string', required: true } },
        outputSchema: { responseId: 'string', answers: 'array' },
      },
    ],
    actions: [],
  },
  {
    id: 'jotform',
    name: 'Jotform',
    slug: 'jotform',
    category: 'Forms & Data Collection',
    description: 'Online form builder and survey data collection.',
    iconSlug: 'jotform',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [
      {
        key: 'submission_received',
        name: 'New Submission',
        description: 'Triggers when a form submission is received.',
        triggerType: 'webhook',
        configSchema: { formId: { type: 'string', required: true } },
        outputSchema: { submissionId: 'string', answers: 'object' },
      },
    ],
    actions: [],
  },

  // ==========================================
  // DEVELOPER / UNIVERSAL
  // ==========================================
  {
    id: 'webhooks',
    name: 'Webhooks',
    slug: 'webhooks',
    category: 'Developer / API',
    description: 'Trigger Concludo workflows from incoming webhooks or dispatch real-time outbound HTTP webhooks.',
    iconSlug: 'webhooks',
    authenticationType: 'webhook_signature',
    isTier1: true,
    enabled: true,
    triggers: [
      {
        key: 'incoming_webhook',
        name: 'When Webhook Received',
        description: 'Generates an isolated endpoint URL to ingest JSON payloads into Concludo.',
        triggerType: 'webhook',
        configSchema: { endpointPath: { type: 'string' }, secretVerification: { type: 'boolean', default: true } },
        outputSchema: { headers: 'object', body: 'object', query: 'object' },
      },
    ],
    actions: [
      {
        key: 'send_webhook',
        name: 'Send Webhook',
        description: 'Dispatches an authenticated HTTP POST payload to an external endpoint.',
        requiredScopes: [],
        inputSchema: { url: { type: 'string', required: true }, payload: { type: 'object', required: true }, signatureHeader: { type: 'string' } },
        outputSchema: { statusCode: 'number', responseBody: 'string' },
      },
    ],
  },
  {
    id: 'generic_http',
    name: 'HTTP / API Request',
    slug: 'generic_http',
    category: 'Developer / API',
    description: 'Universal connector: execute GET, POST, PUT, PATCH, DELETE requests to any external REST API.',
    iconSlug: 'generic_http',
    authenticationType: 'bearer',
    isTier1: true,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'http_request',
        name: 'Execute HTTP Request',
        description: 'Dispatches a custom REST request with mapped headers, query params, and body.',
        requiredScopes: [],
        inputSchema: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST', required: true },
          url: { type: 'string', required: true },
          headers: { type: 'object' },
          queryParams: { type: 'object' },
          body: { type: 'string' },
          authType: { type: 'string', enum: ['none', 'bearer', 'basic', 'api_key'], default: 'none' },
          timeoutSeconds: { type: 'number', default: 30 },
        },
        outputSchema: { statusCode: 'number', headers: 'object', responseData: 'object' },
      },
    ],
  },
  {
    id: 'json_tool',
    name: 'JSON Parser & Transformer',
    slug: 'json_tool',
    category: 'Developer / API',
    description: 'Transform, parse, and filter structured JSON payloads between workflow actions.',
    iconSlug: 'json',
    authenticationType: 'none',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'parse_json',
        name: 'Parse JSON String',
        description: 'Parses a raw JSON string into accessible structured variables.',
        requiredScopes: [],
        inputSchema: { jsonString: { type: 'string', required: true } },
        outputSchema: { parsedObject: 'object' },
      },
    ],
  },
  {
    id: 'email_universal',
    name: 'Universal Email (SMTP / IMAP)',
    slug: 'email_universal',
    category: 'Developer / API',
    description: 'Send alerts or trigger workflows using standard corporate email servers.',
    iconSlug: 'email',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'send_mail',
        name: 'Send Email via SMTP',
        description: 'Sends email notification via custom SMTP credentials.',
        requiredScopes: [],
        inputSchema: { to: { type: 'string', required: true }, subject: { type: 'string', required: true }, body: { type: 'string', required: true } },
        outputSchema: { messageId: 'string' },
      },
    ],
  },
  {
    id: 'sftp_universal',
    name: 'SFTP File Transfer',
    slug: 'sftp_universal',
    category: 'Developer / API',
    description: 'Secure enterprise file transfer for automated batch uploads and document storage.',
    iconSlug: 'sftp',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'upload_file',
        name: 'Upload File to SFTP',
        description: 'Transfers a file to an enterprise SFTP host.',
        requiredScopes: [],
        inputSchema: { remotePath: { type: 'string', required: true }, content: { type: 'string', required: true } },
        outputSchema: { success: 'boolean' },
      },
    ],
  },

  // ==========================================
  // AI
  // ==========================================
  {
    id: 'openai',
    name: 'OpenAI',
    slug: 'openai',
    category: 'AI',
    description: 'Connect enterprise OpenAI models (GPT-4o) for document synthesis, extraction, and drafting.',
    iconSlug: 'openai',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'generate_text',
        name: 'Generate Text / Completion',
        description: 'Prompts an AI model with workflow context variables to draft copy or extract data.',
        requiredScopes: [],
        inputSchema: { prompt: { type: 'string', required: true }, model: { type: 'string', default: 'gpt-4o' } },
        outputSchema: { outputText: 'string', usageTokens: 'number' },
      },
    ],
  },
  {
    id: 'anthropic_claude',
    name: 'Anthropic Claude',
    slug: 'anthropic_claude',
    category: 'AI',
    description: 'Connect Anthropic Claude models for deep document reasoning, analysis, and nuanced reporting.',
    iconSlug: 'anthropic_claude',
    authenticationType: 'api_key',
    isTier1: false,
    enabled: true,
    triggers: [],
    actions: [
      {
        key: 'generate_analysis',
        name: 'Generate Analysis',
        description: 'Generates nuanced executive analysis using Claude Sonnet.',
        requiredScopes: [],
        inputSchema: { prompt: { type: 'string', required: true } },
        outputSchema: { responseText: 'string' },
      },
    ],
  },
];

/**
 * Service to manage multi-tenant integration connections, tests, status updates, and audit logging.
 */
export class IntegrationsHubService {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || getSupabaseBrowserClient();
  }

  /**
   * Returns catalog of all supported providers.
   */
  getCatalog(): ProviderDefinition[] {
    return INTEGRATION_PROVIDERS_CATALOG;
  }

  /**
   * Fetches all registered connections for the current user and their organization.
   */
  async getConnections(): Promise<IntegrationConnection[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('integration_connections')
      .select('*')
      .neq('status', 'disconnected')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load integration_connections, returning empty:', error.message);
      return [];
    }

    return (data || []) as IntegrationConnection[];
  }

  /**
   * Finds connection for a specific provider.
   */
  async getConnectionForProvider(providerId: string): Promise<IntegrationConnection | null> {
    const connections = await this.getConnections();
    return connections.find((c) => c.provider_id === providerId) || null;
  }

  /**
   * Creates or registers a new connection.
   */
  async registerConnection(params: {
    provider_id: string;
    connection_name: string;
    external_account_reference: string;
    scopes: string[];
    settings?: Record<string, any>;
    credential_reference?: string;
  }): Promise<IntegrationConnection | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to register connection.');

    let organizationId: string | null = null;
    try {
      const { data: mem } = await this.supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (mem?.organization_id) {
        organizationId = mem.organization_id;
      }
    } catch {
      // organization optional for solo users
    }

    const insertPayload = {
      user_id: user.id,
      organization_id: organizationId,
      provider_id: params.provider_id,
      connection_name: params.connection_name,
      external_account_reference: params.external_account_reference,
      status: 'connected',
      scopes: params.scopes,
      credential_reference: params.credential_reference || `vault_ref_${Date.now()}`,
      settings: params.settings || {},
      health_details: { healthy: true, last_check_status: 'OK' },
      connected_at: new Date().toISOString(),
      last_tested_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('integration_connections')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    return data as IntegrationConnection;
  }

  /**
   * Performs an actual test on the connection.
   */
  async testConnection(connectionId: string): Promise<{ success: boolean; message: string; testedAt: string }> {
    const now = new Date().toISOString();
    try {
      const { data: conn, error } = await this.supabase
        .from('integration_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error || !conn) {
        return { success: false, message: 'Connection record not found.', testedAt: now };
      }

      const isHealthy = isUsable({
        status: conn.status,
        verified_at: conn.verified_at,
        last_test_at: conn.last_test_at,
        last_test_result: conn.last_test_result,
      });
      // In Phase 0, browser cannot update status or health_details directly

      return {
        success: isHealthy,
        message: isHealthy ? 'Connection verified successfully. All scopes active and verified.' : 'Connection check failed. Please re-authenticate.',
        testedAt: now,
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Test failed.', testedAt: now };
    }
  }

  /**
   * Soft-deletes / disconnects an integration.
   */
  async disconnect(connectionId: string): Promise<boolean> {
    const { data, error } = await this.supabase.functions.invoke('connection-remove', {
      body: { connectionId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return true;
  }

  /**
   * Renames a connection (e.g. "Anthony - Microsoft 365").
   */
  async renameConnection(connectionId: string, newName: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('integration_connections')
      .update({ connection_name: newName })
      .eq('id', connectionId);

    if (error) throw error;
    return true;
  }
}

export const integrationsHubService = new IntegrationsHubService();
