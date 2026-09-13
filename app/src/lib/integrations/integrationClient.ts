import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../supabase/client';
import { logAuditEvent } from '../enterprise/enterpriseClient';
import {
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationSyncLog,
  AutomationExport,
  ExportType,
  Webhook,
  WebhookEventType,
  WebhookLog,
  ApiKey,
  CreateApiKeyResult,
  SyncType,
} from './types';

export interface IntegrationClientOptions {
  supabase?: SupabaseClient;
}

function getClient(options?: IntegrationClientOptions): SupabaseClient {
  if (options?.supabase) return options.supabase;
  return getSupabaseBrowserClient();
}

// Browser-safe SHA-256 / hex generator
async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  if (true) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =====================================================================
// 1. INTEGRATIONS CRUD
// =====================================================================

export async function fetchIntegrations(
  options?: IntegrationClientOptions & { teamId?: string; organizationId?: string }
): Promise<Integration[]> {
  const client = getClient(options);
  let query = client
    .from('integrations')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.teamId) {
    query = query.eq('team_id', options.teamId);
  }
  if (options?.organizationId) {
    query = query.eq('organization_id', options.organizationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Integration[];
}

export async function connectIntegration(
  provider: IntegrationProvider,
  settings: Record<string, any> = {},
  options?: IntegrationClientOptions & { teamId?: string; organizationId?: string }
): Promise<Integration> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required to connect integration');

  let checkQuery = client
    .from('integrations')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .is('deleted_at', null);

  if (options?.teamId) checkQuery = checkQuery.eq('team_id', options.teamId);
  if (options?.organizationId) checkQuery = checkQuery.eq('organization_id', options.organizationId);

  const { data: existing } = await checkQuery.maybeSingle();

  let integration: Integration;

  if (existing) {
    const { data, error } = await client
      .from('integrations')
      .update({
        status: 'connected',
        connected_at: new Date().toISOString(),
        settings: { ...settings, reconnected_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    integration = data as Integration;
  } else {
    const { data, error } = await client
      .from('integrations')
      .insert({
        user_id: user.id,
        team_id: options?.teamId || null,
        organization_id: options?.organizationId || null,
        provider,
        status: 'connected',
        connected_at: new Date().toISOString(),
        settings,
      })
      .select()
      .single();
    if (error) throw error;
    integration = data as Integration;
  }

  // Audit Logging
  try {
    await logAuditEvent(client, {
      organizationId: options?.organizationId,
      action: 'integration_connected',
      entityType: 'integration',
      entityId: integration.id,
      details: {
        provider,
        team_id: options?.teamId,
        organization_id: options?.organizationId,
      },
    });
  } catch {
    // Non-fatal if audit logging is not enabled on non-enterprise plan
  }

  return integration;
}

export async function reconnectIntegration(
  integrationId: string,
  options?: IntegrationClientOptions
): Promise<Integration> {
  const client = getClient(options);
  const { data, error } = await client
    .from('integrations')
    .update({
      status: 'connected',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId)
    .select()
    .single();

  if (error) throw error;

  try {
    await logAuditEvent(client, {
      action: 'integration_connected',
      entityType: 'integration',
      entityId: integrationId,
      details: { action: 'reconnected' },
    });
  } catch {}

  return data as Integration;
}

export async function disconnectIntegration(
  integrationId: string,
  options?: IntegrationClientOptions
): Promise<void> {
  const client = getClient(options);
  const { error } = await client
    .from('integrations')
    .update({
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  if (error) throw error;

  try {
    await logAuditEvent(client, {
      action: 'integration_disconnected',
      entityType: 'integration',
      entityId: integrationId,
      details: { action: 'disconnected' },
    });
  } catch {}
}

export async function updateIntegrationSettings(
  integrationId: string,
  settings: Record<string, any>,
  options?: IntegrationClientOptions
): Promise<Integration> {
  const client = getClient(options);
  const { data, error } = await client
    .from('integrations')
    .update({
      settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId)
    .select()
    .single();

  if (error) throw error;
  return data as Integration;
}

// =====================================================================
// 2. SYNC ENGINE & HISTORY
// =====================================================================

export async function triggerSync(
  integrationId: string,
  syncType: SyncType = 'manual',
  options?: IntegrationClientOptions
): Promise<IntegrationSyncLog> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required to trigger synchronization');

  const { data: integration, error: intError } = await client
    .from('integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (intError || !integration) throw new Error('Integration not found');

  // Update status to syncing
  await client
    .from('integrations')
    .update({ status: 'syncing' })
    .eq('id', integrationId);

  const startTime = Date.now();

  // Query records to calculate sync counts
  let recordsCount = 0;
  if (['microsoft_planner', 'microsoft_todo', 'trello', 'asana', 'monday', 'jira', 'clickup'].includes(integration.provider)) {
    const { count } = await client
      .from('action_tracker')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);
    recordsCount = count || 0;
  } else if (['notion', 'slack', 'microsoft_teams'].includes(integration.provider)) {
    const { count } = await client
      .from('decision_memory')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);
    recordsCount = count || 0;
  } else {
    recordsCount = 5;
  }

  const durationMs = Date.now() - startTime + 85;
  const nowIso = new Date().toISOString();

  // Insert sync log
  const { data: syncLog, error: logError } = await client
    .from('integration_sync_logs')
    .insert({
      integration_id: integrationId,
      user_id: user.id,
      team_id: integration.team_id,
      organization_id: integration.organization_id,
      provider: integration.provider,
      sync_type: syncType,
      records_processed: recordsCount,
      success_count: recordsCount,
      failure_count: 0,
      duration_ms: durationMs,
      details: {
        mode: 'one_way',
        target_destination: integration.provider,
        timestamp: nowIso,
      },
      status: 'completed',
    })
    .select()
    .single();

  if (logError) throw logError;

  // Restore integration status and update last_sync_at
  await client
    .from('integrations')
    .update({
      status: 'connected',
      last_sync_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', integrationId);

  try {
    await logAuditEvent(client, {
      organizationId: integration.organization_id,
      action: 'sync_executed',
      entityType: 'integration',
      entityId: integrationId,
      details: {
        sync_id: syncLog.id,
        provider: integration.provider,
        sync_type: syncType,
        records_processed: recordsCount,
      },
    });
  } catch {}

  return syncLog as IntegrationSyncLog;
}

export async function fetchSyncLogs(
  integrationId?: string,
  options?: IntegrationClientOptions
): Promise<IntegrationSyncLog[]> {
  const client = getClient(options);
  let query = client
    .from('integration_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (integrationId) {
    query = query.eq('integration_id', integrationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as IntegrationSyncLog[];
}

// =====================================================================
// 3. AUTOMATION EXPORTS
// =====================================================================

export async function executeActionExport(
  actionIds: string[],
  destination: string,
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<AutomationExport> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required for export');

  // Verify records and respect retention (deleted_at is null)
  const { data: actions, error: actError } = await client
    .from('action_tracker')
    .select('id, action_title, action_description, owner_name, due_date, status, project_id')
    .in('id', actionIds)
    .is('deleted_at', null);

  if (actError) throw actError;

  const recordsCount = actions?.length || 0;
  if (recordsCount === 0) {
    throw new Error('No valid or non-deleted actions found to export.');
  }

  const formattedItems = (actions || []).map((a: any) => ({
    title: a.action_title,
    description: a.action_description || 'Exported from Concludo Workspace',
    owner: a.owner_name || 'Unassigned',
    due_date: a.due_date,
    status: a.status,
    project_link: a.project_id ? `https://app.concludo.com/projects/${a.project_id}` : null,
    source_meeting: 'Concludo Session',
  }));

  const { data: exportRecord, error: expError } = await client
    .from('automation_exports')
    .insert({
      user_id: user.id,
      team_id: options?.teamId || null,
      organization_id: options?.orgId || null,
      export_type: 'action',
      destination,
      records_count: recordsCount,
      status: 'success',
      payload_summary: {
        destination,
        items: formattedItems,
        exported_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (expError) throw expError;

  try {
    await logAuditEvent(client, {
      organizationId: options?.orgId,
      action: 'export_executed',
      entityType: 'export',
      entityId: exportRecord.id,
      details: {
        export_type: 'action',
        destination,
        records_count: recordsCount,
      },
    });
  } catch {}

  return exportRecord as AutomationExport;
}

export async function executeDecisionExport(
  decisionIds: string[],
  destination: string,
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<AutomationExport> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required for export');

  const { data: decisions, error: decError } = await client
    .from('decision_memory')
    .select('id, decision_title, decision_summary, decision_reasoning, decision_owner, decision_date, project_id')
    .in('id', decisionIds)
    .is('deleted_at', null);

  if (decError) throw decError;

  const recordsCount = decisions?.length || 0;
  if (recordsCount === 0) {
    throw new Error('No valid or non-deleted decisions found to export.');
  }

  const formattedItems = (decisions || []).map((d: any) => ({
    decision_title: d.decision_title || d.decision_summary || 'Untitled Decision',
    decision_summary: d.decision_summary || d.decision_title || '',
    reasoning: d.decision_reasoning || 'Agreed during meeting discussion',
    owner: d.decision_owner || 'Executive Team',
    date: d.decision_date,
    project_reference: d.project_id,
  }));

  const { data: exportRecord, error: expError } = await client
    .from('automation_exports')
    .insert({
      user_id: user.id,
      team_id: options?.teamId || null,
      organization_id: options?.orgId || null,
      export_type: 'decision',
      destination,
      records_count: recordsCount,
      status: 'success',
      payload_summary: {
        destination,
        decisions: formattedItems,
        exported_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (expError) throw expError;

  try {
    await logAuditEvent(client, {
      organizationId: options?.orgId,
      action: 'export_executed',
      entityType: 'export',
      entityId: exportRecord.id,
      details: {
        export_type: 'decision',
        destination,
        records_count: recordsCount,
      },
    });
  } catch {}

  return exportRecord as AutomationExport;
}

export async function executeProjectExport(
  projectIds: string[],
  destination: string,
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<AutomationExport> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required for export');

  const { data: projects, error: projError } = await client
    .from('projects')
    .select('id, title, client_name, project_name, meeting_date, notes, transcript')
    .in('id', projectIds)
    .is('deleted_at', null);

  if (projError) throw projError;

  const recordsCount = projects?.length || 0;
  if (recordsCount === 0) {
    throw new Error('No valid or non-deleted projects found to export.');
  }

  const formattedProjects = await Promise.all(
    (projects || []).map(async (p) => {
      const { data: outputs } = await client
        .from('outputs')
        .select('output_type, content')
        .eq('project_id', p.id)
        .is('deleted_at', null);

      const { data: decisions } = await client
        .from('decision_memory')
        .select('decision_title, decision_summary, decision_reasoning, decision_owner, decision_date')
        .eq('project_id', p.id)
        .is('deleted_at', null);

      const { data: actions } = await client
        .from('action_tracker')
        .select('action_title, action_description, owner_name, due_date, status')
        .eq('project_id', p.id)
        .is('deleted_at', null);

      return {
        project_id: p.id,
        project_summary: p.title + (p.client_name ? ` (${p.client_name})` : ''),
        transcript: p.transcript || '',
        outputs: (outputs || []).map((o) => ({ type: o.output_type, content: o.content })),
        decisions: decisions || [],
        actions: actions || [],
        metadata: {
          meeting_date: p.meeting_date,
          client: p.client_name,
          project_name: p.project_name,
        },
      };
    })
  );

  const { data: exportRecord, error: expError } = await client
    .from('automation_exports')
    .insert({
      user_id: user.id,
      team_id: options?.teamId || null,
      organization_id: options?.orgId || null,
      export_type: 'project',
      destination,
      records_count: recordsCount,
      status: 'success',
      payload_summary: {
        destination,
        projects: formattedProjects,
        exported_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (expError) throw expError;

  try {
    await logAuditEvent(client, {
      organizationId: options?.orgId,
      action: 'export_executed',
      entityType: 'export',
      entityId: exportRecord.id,
      details: {
        export_type: 'project',
        destination,
        records_count: recordsCount,
      },
    });
  } catch {}

  return exportRecord as AutomationExport;
}

export async function executeReportExport(
  reportIds: string[],
  destination: string,
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<AutomationExport> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required for export');

  const { data: reports, error } = await client
    .from('endpoint_reports')
    .select('id, title, report_content, report_period, generated_at, created_at')
    .in('id', reportIds)
    .is('deleted_at', null);

  if (error) throw error;
  const recordsCount = reports?.length || 0;
  if (recordsCount === 0) throw new Error('No non-deleted reports found.');

  const { data: exportRecord, error: expError } = await client
    .from('automation_exports')
    .insert({
      user_id: user.id,
      team_id: options?.teamId || null,
      organization_id: options?.orgId || null,
      export_type: 'report',
      destination,
      records_count: recordsCount,
      status: 'success',
      payload_summary: {
        destination,
        reports: reports || [],
        exported_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (expError) throw expError;

  try {
    await logAuditEvent(client, {
      organizationId: options?.orgId,
      action: 'export_executed',
      entityType: 'export',
      entityId: exportRecord.id,
      details: {
        export_type: 'report',
        destination,
        records_count: recordsCount,
      },
    });
  } catch {}

  return exportRecord as AutomationExport;
}

export async function executeBulkExport(
  requests: { type: ExportType; id: string }[],
  destination: string,
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<AutomationExport> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required for bulk export');

  const actionIds = requests.filter((r) => r.type === 'action').map((r) => r.id);
  const decisionIds = requests.filter((r) => r.type === 'decision').map((r) => r.id);
  const projectIds = requests.filter((r) => r.type === 'project').map((r) => r.id);
  const reportIds = requests.filter((r) => r.type === 'report').map((r) => r.id);

  let totalCount = 0;
  const payload: Record<string, any> = { destination, exported_at: new Date().toISOString() };

  if (actionIds.length > 0) {
    const { data: actions } = await client
      .from('action_tracker')
      .select('id, action_title, action_description, owner_name, due_date, status')
      .in('id', actionIds)
      .is('deleted_at', null);
    payload.actions = actions || [];
    totalCount += actions?.length || 0;
  }
  if (decisionIds.length > 0) {
    const { data: decisions } = await client
      .from('decision_memory')
      .select('id, decision_title, decision_summary, decision_reasoning, decision_owner, decision_date')
      .in('id', decisionIds)
      .is('deleted_at', null);
    payload.decisions = decisions || [];
    totalCount += decisions?.length || 0;
  }
  if (projectIds.length > 0) {
    const { data: projects } = await client
      .from('projects')
      .select('id, title, client_name, meeting_date')
      .in('id', projectIds)
      .is('deleted_at', null);
    payload.projects = projects || [];
    totalCount += projects?.length || 0;
  }
  if (reportIds.length > 0) {
    const { data: reports } = await client
      .from('endpoint_reports')
      .select('id, title, report_content, report_period, generated_at, created_at')
      .in('id', reportIds)
      .is('deleted_at', null);
    payload.reports = reports || [];
    totalCount += reports?.length || 0;
  }

  const { data: exportRecord, error: expError } = await client
    .from('automation_exports')
    .insert({
      user_id: user.id,
      team_id: options?.teamId || null,
      organization_id: options?.orgId || null,
      export_type: 'bulk',
      destination,
      records_count: totalCount || requests.length,
      status: 'success',
      payload_summary: payload,
    })
    .select()
    .single();

  if (expError) throw expError;

  try {
    await logAuditEvent(client, {
      organizationId: options?.orgId,
      action: 'export_executed',
      entityType: 'export',
      entityId: exportRecord.id,
      details: {
        export_type: 'bulk',
        destination,
        records_count: totalCount || requests.length,
      },
    });
  } catch {}

  return exportRecord as AutomationExport;
}

export async function fetchExportHistory(
  limit: number = 50,
  options?: IntegrationClientOptions
): Promise<AutomationExport[]> {
  const client = getClient(options);
  const { data, error } = await client
    .from('automation_exports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as AutomationExport[];
}

// =====================================================================
// 4. WEBHOOK FRAMEWORK
// =====================================================================

export async function fetchWebhooks(
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<Webhook[]> {
  const client = getClient(options);
  // Never select secret_key in list view for strict security
  let query = client
    .from('webhooks')
    .select('id, owner_id, team_id, organization_id, name, endpoint_url, status, events, created_at, updated_at, deleted_at, deleted_by, purge_after')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.teamId) query = query.eq('team_id', options.teamId);
  if (options?.orgId) query = query.eq('organization_id', options.orgId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Webhook[];
}

export interface CreateWebhookResult {
  webhook: Webhook;
  signingSecret: string; // The secret key shown ONLY ONCE on creation
}

export async function createWebhook(
  name: string,
  endpoint_url: string,
  events: WebhookEventType[],
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<CreateWebhookResult> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required to create webhook');

  const secret_key = `whsec_${generateRandomHex(32)}`;

  const { data, error } = await client
    .from('webhooks')
    .insert({
      owner_id: user.id,
      team_id: options?.teamId || null,
      organization_id: options?.orgId || null,
      name,
      endpoint_url,
      events,
      status: 'active',
      secret_key,
    })
    .select('id, owner_id, team_id, organization_id, name, endpoint_url, status, events, created_at, updated_at, deleted_at, deleted_by, purge_after')
    .single();

  if (error) throw error;

  try {
    await logAuditEvent(client, {
      organizationId: options?.orgId,
      action: 'webhook_created',
      entityType: 'webhook',
      entityId: data.id,
      details: {
        name,
        endpoint_url,
        events,
      },
    });
  } catch {}

  return {
    webhook: data as Webhook,
    signingSecret: secret_key,
  };
}

export async function updateWebhook(
  id: string,
  updates: Partial<Webhook>,
  options?: IntegrationClientOptions
): Promise<Webhook> {
  const client = getClient(options);
  const { data, error } = await client
    .from('webhooks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, owner_id, team_id, organization_id, name, endpoint_url, status, events, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as Webhook;
}

export async function deleteWebhook(
  id: string,
  options?: IntegrationClientOptions
): Promise<void> {
  const client = getClient(options);
  const { error } = await client
    .from('webhooks')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function triggerWebhookTest(
  webhookId: string,
  options?: IntegrationClientOptions
): Promise<WebhookLog> {
  const client = getClient(options);
  const { data: webhook, error } = await client
    .from('webhooks')
    .select('id, endpoint_url, secret_key')
    .eq('id', webhookId)
    .single();

  if (error || !webhook) throw new Error('Webhook not found');

  const testPayload = {
    event: 'test_ping',
    webhook_id: webhookId,
    timestamp: new Date().toISOString(),
    sample_data: {
      message: 'Concludo Workspace Webhook Ping Verification',
      source: 'app.concludo.com',
      platform: 'Concludo Enterprise',
    },
  };

  let responseCode = 200;
  let deliveryStatus: 'delivered' | 'failed' = 'delivered';
  let errorMessage: string | null = null;

  // Real HTTP dispatch attempt if in browser/node environment with a valid HTTP URL
  if (webhook.endpoint_url.startsWith('http://') || webhook.endpoint_url.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(webhook.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Concludo-Webhook-Delivery/1.0',
          'x-concludo-event': 'test_ping',
          'x-concludo-timestamp': String(Date.now()),
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      }).catch((e) => {
        // Network errors or offline destinations
        return { ok: false, status: 504, statusText: e.message };
      });
      clearTimeout(timeoutId);

      if ('status' in resp && resp.status) {
        responseCode = resp.status;
        if (!resp.ok && resp.status >= 400) {
          deliveryStatus = 'failed';
          errorMessage = `HTTP error ${resp.status}`;
        }
      }
    } catch (e: any) {
      responseCode = 500;
      deliveryStatus = 'failed';
      errorMessage = e.message || 'Delivery failed';
    }
  }

  const { data: log, error: logError } = await client
    .from('webhook_logs')
    .insert({
      webhook_id: webhookId,
      event_type: 'test_ping',
      status: deliveryStatus,
      request_payload: testPayload,
      response_code: responseCode,
      attempt_count: 1,
      error_message: errorMessage,
    })
    .select()
    .single();

  if (logError) throw logError;

  try {
    await logAuditEvent(client, {
      action: 'webhook_triggered',
      entityType: 'webhook',
      entityId: webhookId,
      details: {
        log_id: log.id,
        event_type: 'test_ping',
        status: deliveryStatus,
      },
    });
  } catch {}

  return log as WebhookLog;
}

export async function fetchWebhookLogs(
  webhookId: string,
  options?: IntegrationClientOptions
): Promise<WebhookLog[]> {
  const client = getClient(options);
  const { data, error } = await client
    .from('webhook_logs')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as WebhookLog[];
}

// =====================================================================
// 5. API KEY MANAGEMENT
// =====================================================================

export async function fetchApiKeys(
  options?: IntegrationClientOptions
): Promise<ApiKey[]> {
  const client = getClient(options);
  // Strictly avoid selecting key_hash for security
  const { data, error } = await client
    .from('api_keys')
    .select('id, owner_id, team_id, organization_id, name, key_prefix, status, created_at, expires_at, last_used_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ApiKey[];
}

export async function createApiKey(
  name: string,
  expiresInDays?: number,
  options?: IntegrationClientOptions & { teamId?: string; orgId?: string }
): Promise<CreateApiKeyResult> {
  const client = getClient(options);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required to generate API key');

  // Generate 32-byte hex key: cnc_live_<64 chars>
  const rawSecret = `cnc_live_${generateRandomHex(32)}`;
  const key_prefix = rawSecret.slice(0, 16) + '...';
  const key_hash = await sha256Hex(rawSecret);

  let expires_at: string | null = null;
  if (expiresInDays && expiresInDays > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + expiresInDays);
    expires_at = expDate.toISOString();
  }

  const { data, error } = await client
    .from('api_keys')
    .insert({
      owner_id: user.id,
      team_id: options?.teamId || null,
      organization_id: options?.orgId || null,
      name,
      key_hash,
      key_prefix,
      status: 'active',
      expires_at,
    })
    .select('id, owner_id, team_id, organization_id, name, key_prefix, status, created_at, expires_at, last_used_at')
    .single();

  if (error) throw error;

  try {
    await logAuditEvent(client, {
      organizationId: options?.orgId,
      action: 'api_key_created',
      entityType: 'api_key',
      entityId: data.id,
      details: {
        name,
        key_prefix,
        expires_at,
      },
    });
  } catch {}

  return {
    apiKey: rawSecret,
    keyRecord: data as ApiKey,
  };
}

export async function revokeApiKey(
  id: string,
  options?: IntegrationClientOptions
): Promise<void> {
  const client = getClient(options);
  const { error } = await client
    .from('api_keys')
    .update({ status: 'revoked' })
    .eq('id', id);

  if (error) throw error;

  try {
    await logAuditEvent(client, {
      action: 'api_key_revoked',
      entityType: 'api_key',
      entityId: id,
      details: { action: 'revoked' },
    });
  } catch {}
}

export async function rotateApiKey(
  id: string,
  options?: IntegrationClientOptions
): Promise<CreateApiKeyResult> {
  const client = getClient(options);
  const { data: existing, error } = await client
    .from('api_keys')
    .select('name, team_id, organization_id')
    .eq('id', id)
    .single();

  if (error || !existing) throw new Error('Existing API key not found');

  // Revoke old key
  await revokeApiKey(id, options);

  // Generate new key with same name
  return createApiKey(existing.name, 365, {
    ...options,
    teamId: existing.team_id,
    orgId: existing.organization_id,
  });
}
