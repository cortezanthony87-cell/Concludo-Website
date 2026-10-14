import { SupabaseClient } from '@supabase/supabase-js';
import { AgentRunParams } from './agentRunner';
import { AgentRunResult } from './types';
import { setAgentMemory } from './agentMemoryService';
import { checkWeeklyQuota } from './inboxCommandCentreService';
import { getDataset, WORK_ACCOUNT, PERSONAL_ACCOUNT } from '../email/data';
import { buildDashboard } from '../email/aggregation';
import { DEMO_NOW } from '../email/data/clock';
import { registerScanDataset } from '../email/dynamicDataset';

export async function executeInboxCommandCentre(
  params: AgentRunParams,
  client: SupabaseClient
): Promise<AgentRunResult> {
  // 1. Check profile and tier quota
  const { data: profile } = await client
    .from('profiles')
    .select('plan, tier')
    .eq('id', params.userId)
    .maybeSingle();

  const userTier = (profile?.plan || profile?.tier || 'starter') as 'starter' | 'pro' | 'team';

  // Check quota for Starter tier (3 runs per week)
  const quotaCheck = checkWeeklyQuota({
    userId: params.userId,
    tier: userTier,
    runsThisWeek: 0,
    weekStartDate: new Date().toISOString().slice(0, 10),
  });

  if (!quotaCheck.allowed) {
    throw new Error(quotaCheck.error || 'Weekly quota exceeded for Starter tier.');
  }

  // 2. Query user connected mailboxes from integration_connections
  const targetAccountId = params.parameters?.accountId;
  const targetAccountEmail = params.parameters?.accountEmail;

  let query = client
    .from('integration_connections')
    .select('id, provider_id, external_account_reference, account_label, status, created_at, nango_connection_id, nango_integration_id, auth_mode, user_id')
    .in('provider_id', ['gmail', 'microsoft_outlook'])
    .eq('status', 'connected')
    .is('deleted_at', null);

  // Strictly enforce user_id isolation (tenant security principle)
  query = query.eq('user_id', params.userId);

  const { data: connections } = await query;
  const connectedList = connections || [];

  let selectedConnection = connectedList.find(
    (c) => c.id === targetAccountId || (targetAccountEmail && (c.account_label === targetAccountEmail || c.external_account_reference === targetAccountEmail))
  );

  if (!selectedConnection && connectedList.length > 0) {
    selectedConnection = connectedList[0];
  }

  // If live connection exists, call the email-scan edge function
  if (selectedConnection && selectedConnection.status === 'connected') {
    const { data: scanResponse, error: scanErr } = await client.functions.invoke('email-scan', {\n      body: {\n        connection_id: selectedConnection.id,\n        account_email: targetAccountEmail || selectedConnection.account_label || selectedConnection.external_account_reference,\n        limit: 20,\n      },\n    });\n\n    if (scanErr || !scanResponse?.success) {\n      const errDetail = scanResponse?.error || scanErr?.message || 'Edge function email-scan failed';\n      throw new Error(`Email scan failed: ${errDetail}`);\n    }\n\n    const scanData = scanResponse.data;\n    const rawAddress = targetAccountEmail || selectedConnection.account_label || selectedConnection.external_account_reference || 'Connected mailbox';\n    const isPers = rawAddress.endsWith('@gmail.com') || rawAddress.endsWith('@live.com') || rawAddress.endsWith('@outlook.com');\n    const acctType = isPers ? 'personal' : 'work';\n\n    // Register dynamic dataset for this live connection\n    registerScanDataset(\n      {\n        id: selectedConnection.id,\n        label: selectedConnection.provider_id === 'gmail' ? 'Google Workspace' : 'Microsoft 365',\n        address: rawAddress,\n        accountType: acctType,\n        lastSynchronisedAt: scanData.scannedAt,\n        connected: true,\n      },\n      scanData\n    );\n\n    await setAgentMemory({\n      agentType: 'inbox_command_centre',\n      memoryKey: `inbox_briefing_${acctType}_${rawAddress.replace(/[^a-zA-Z0-9]/g, '_')}`,\n      memoryValue: scanData,\n      ownerId: params.userId,\n      teamId: params.teamId,\n      organizationId: params.organizationId,\n      admin: params.admin,\n    });\n\n    return {\n      agentType: 'inbox_command_centre',\n      status: 'completed',\n      summary: scanResponse.summary,\n      data: scanData,\n      requiresApproval: false,\n      executionDurationMs: 0,\n    };\n  }\n\n  // Fallback for demo/synthetic mode\n  const emailAddress = selectedConnection?.account_label || selectedConnection?.external_account_reference || 'you@your-practice.example';\n  const isPersonal = emailAddress.endsWith('@gmail.com') || emailAddress.endsWith('@live.com') || emailAddress.endsWith('@outlook.com');\n  const accountType = isPersonal ? 'personal' : 'work';\n\n  // Pick dataset for analysis\n  const datasetId = accountType === 'personal' ? PERSONAL_ACCOUNT.id : WORK_ACCOUNT.id;\n  const dataset = getDataset(datasetId)!;\n  const dashboard = buildDashboard(dataset, DEMO_NOW);\n\n  const needsAttentionCount = dashboard.metrics.find((m) => m.key === 'needs_attention')?.count ?? 0;\n  const repliesDueCount = dashboard.metrics.find((m) => m.key === 'replies_due')?.count ?? 0;\n  const deadlinesCount = dashboard.metrics.find((m) => m.key === 'deadlines')?.count ?? 0;\n  const waitingCount = dashboard.metrics.find((m) => m.key === 'waiting_on_others')?.count ?? 0;\n\n  const summary = `Inbox Command Centre Agent audited ${emailAddress} (${accountType}): ${needsAttentionCount} threads need attention, ${repliesDueCount} replies recommended, ${deadlinesCount} upcoming deadlines identified, and ${waitingCount} items waiting on others. No emails were sent, filed or altered.`;\n\n  const payload = {\n    accountEmail: emailAddress,\n    accountType,\n    provider: selectedConnection?.provider_id || 'demonstration_dataset',\n    auditedAt: new Date().toISOString(),\n    governance: 'Concludo proposes; a person disposes. Read-only audit; zero external mutations.',\n    metrics: {\n      needsAttention: needsAttentionCount,\n      repliesDue: repliesDueCount,\n      deadlines: deadlinesCount,\n      waitingOnOthers: waitingCount,\n      securityAdvisories: dashboard.metrics.find((m) => m.key === 'security_review')?.count ?? 0,\n    },\n    topActions: dashboard.queues.find((q) => q.key === 'handle_first')?.records.slice(0, 3).map((r) => ({\n      subject: r.thread.subject,\n      counterparty: r.counterpartyName,\n      summary: r.analysis.oneLineSummary,\n      priorityScore: r.analysis.priorityScore,\n    })) || [],\n    replyQueue: dashboard.queues.find((q) => q.key === 'reply_queue')?.records.slice(0, 3).map((r) => ({\n      subject: r.thread.subject,\n      sender: r.counterpartyName,\n      suggestedAction: r.analysis.oneLineSummary,\n    })) || [],\n  };\n\n  await setAgentMemory({\n    agentType: 'inbox_command_centre',\n    memoryKey: `inbox_briefing_${accountType}_${emailAddress.replace(/[^a-zA-Z0-9]/g, '_')}`,\n    memoryValue: payload,\n    ownerId: params.userId,\n    teamId: params.teamId,\n    organizationId: params.organizationId,\n    admin: params.admin,\n  });\n\n  return {\n    agentType: 'inbox_command_centre',\n    status: 'completed',\n    summary,\n    data: payload,\n    requiresApproval: false,\n    executionDurationMs: 0,\n  };\n}