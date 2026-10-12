import { SupabaseClient } from '@supabase/supabase-js';
import { AgentRunParams } from './agentRunner';
import { AgentRunResult } from './types';
import { setAgentMemory } from './agentMemoryService';
import { checkWeeklyQuota } from './inboxCommandCentreService';
import { getDataset, WORK_ACCOUNT, PERSONAL_ACCOUNT } from '../email/data';
import { buildDashboard } from '../email/aggregation';
import { DEMO_NOW } from '../email/data/clock';

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
  const { data: connections } = await client
    .from('integration_connections')
    .select('id, provider_id, external_account_reference, account_label, status, created_at')
    .in('provider_id', ['gmail', 'microsoft_outlook'])
    .eq('status', 'connected')
    .is('deleted_at', null);

  const connectedList = connections || [];

  // Determine target account selected by user or defaulted
  const targetAccountId = params.parameters?.accountId;
  const targetAccountEmail = params.parameters?.accountEmail;

  let selectedConnection = connectedList.find(
    (c) => c.id === targetAccountId || (targetAccountEmail && (c.account_label === targetAccountEmail || c.external_account_reference === targetAccountEmail))
  );

  if (!selectedConnection && connectedList.length > 0) {
    selectedConnection = connectedList[0];
  }

  const emailAddress = selectedConnection?.account_label || selectedConnection?.external_account_reference || 'you@your-practice.example';
  const isPersonal = emailAddress.endsWith('@gmail.com') || emailAddress.endsWith('@live.com') || emailAddress.endsWith('@outlook.com');
  const accountType = isPersonal ? 'personal' : 'work';

  // Pick dataset for analysis
  const datasetId = accountType === 'personal' ? PERSONAL_ACCOUNT.id : WORK_ACCOUNT.id;
  const dataset = getDataset(datasetId)!;
  const dashboard = buildDashboard(dataset, DEMO_NOW);

  const needsAttentionCount = dashboard.metrics.find((m) => m.key === 'needs_attention')?.count ?? 0;
  const repliesDueCount = dashboard.metrics.find((m) => m.key === 'replies_due')?.count ?? 0;
  const deadlinesCount = dashboard.metrics.find((m) => m.key === 'deadlines')?.count ?? 0;
  const waitingCount = dashboard.metrics.find((m) => m.key === 'waiting_on_others')?.count ?? 0;

  const summary = `Inbox Command Centre Agent audited ${emailAddress} (${accountType}): ${needsAttentionCount} threads need attention, ${repliesDueCount} replies recommended, ${deadlinesCount} upcoming deadlines identified, and ${waitingCount} items waiting on others. No emails were sent, filed or altered.`;

  const payload = {
    accountEmail: emailAddress,
    accountType,
    provider: selectedConnection?.provider_id || 'demonstration_dataset',
    auditedAt: new Date().toISOString(),
    governance: 'Concludo proposes; a person disposes. Read-only audit; zero external mutations.',
    metrics: {
      needsAttention: needsAttentionCount,
      repliesDue: repliesDueCount,
      deadlines: deadlinesCount,
      waitingOnOthers: waitingCount,
      securityAdvisories: dashboard.metrics.find((m) => m.key === 'security_review')?.count ?? 0,
    },
    topActions: dashboard.queues.find((q) => q.key === 'handle_first')?.records.slice(0, 3).map((r) => ({
      subject: r.thread.subject,
      counterparty: r.counterpartyName,
      summary: r.analysis.oneLineSummary,
      priorityScore: r.analysis.priorityScore,
    })) || [],
    replyQueue: dashboard.queues.find((q) => q.key === 'reply_queue')?.records.slice(0, 3).map((r) => ({
      subject: r.thread.subject,
      sender: r.counterpartyName,
      suggestedAction: r.analysis.oneLineSummary,
    })) || [],
  };

  await setAgentMemory({
    agentType: 'inbox_command_centre',
    memoryKey: `inbox_briefing_${accountType}_${emailAddress.replace(/[^a-zA-Z0-9]/g, '_')}`,
    memoryValue: payload,
    ownerId: params.userId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  return {
    agentType: 'inbox_command_centre',
    status: 'completed',
    summary,
    data: payload,
    requiresApproval: false,
    executionDurationMs: 0,
  };
}
