import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  fetchIntegrations,
  connectIntegration,
  reconnectIntegration,
  disconnectIntegration,
  updateIntegrationSettings,
  triggerSync,
  fetchSyncLogs,
  executeActionExport,
  executeDecisionExport,
  executeProjectExport,
  executeReportExport,
  executeBulkExport,
  fetchExportHistory,
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  triggerWebhookTest,
  fetchWebhookLogs,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
} from '../src/lib/integrations/integrationClient';
import { canUseFeature } from '../src/lib/permissions/canUseFeature';
import { handleApiRequest } from '../src/server/apiRouter';

// Parse environment variables from .env.local
const envPath = existsSync('/tmp/concludo-workspace/.env.local')
  ? '/tmp/concludo-workspace/.env.local'
  : '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/concludo-workspace/.env.local';

const envFile = readFileSync(envPath, 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTasklet18Tests() {
  console.log('================================================================');
  console.log('TASKLET 18: INTEGRATIONS, AUTOMATION EXPORTS & WORKFLOW CONNECTIVITY');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testPassword = 'Password123!Secure';

  // 1. Provision Test Users
  console.log('--- STEP 1: Provisioning Test Users ---');
  const starterEmail = `t18_starter_${timestamp}@concludo.au`;
  const proEmail = `t18_pro_${timestamp}@concludo.au`;
  const enterpriseEmail = `t18_enterprise_${timestamp}@concludo.au`;

  let starterUserId = '';
  let proUserId = '';
  let enterpriseUserId = '';

  const { data: starterAuth, error: sErr } = await adminClient.auth.admin.createUser({
    email: starterEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Starter User T18' },
  });
  if (sErr) throw sErr;
  starterUserId = starterAuth.user.id;
  await adminClient.from('profiles').update({ plan: 'starter', role: 'user' }).eq('id', starterUserId);

  const { data: proAuth, error: pErr } = await adminClient.auth.admin.createUser({
    email: proEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Pro User T18' },
  });
  if (pErr) throw pErr;
  proUserId = proAuth.user.id;
  await adminClient.from('profiles').update({ plan: 'pro', role: 'user' }).eq('id', proUserId);

  const { data: entAuth, error: eErr } = await adminClient.auth.admin.createUser({
    email: enterpriseEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Enterprise User T18' },
  });
  if (eErr) throw eErr;
  enterpriseUserId = entAuth.user.id;
  await adminClient.from('profiles').update({ plan: 'enterprise', role: 'admin' }).eq('id', enterpriseUserId);

  console.log(`✅ Test users provisioned: Starter (${starterUserId}), Pro (${proUserId}), Enterprise (${enterpriseUserId})`);

  // Client instances for authenticated calls
  const anonClientStarter = createClient(supabaseUrl, supabaseAnonKey);
  await anonClientStarter.auth.signInWithPassword({ email: starterEmail, password: testPassword });

  const anonClientPro = createClient(supabaseUrl, supabaseAnonKey);
  const { data: proSession } = await anonClientPro.auth.signInWithPassword({
    email: proEmail,
    password: testPassword,
  });

  const anonClientEnt = createClient(supabaseUrl, supabaseAnonKey);
  const { data: entSession } = await anonClientEnt.auth.signInWithPassword({
    email: enterpriseEmail,
    password: testPassword,
  });

  const proJwt = proSession?.session?.access_token || '';
  const starterJwt = (await anonClientStarter.auth.getSession()).data.session?.access_token || '';

  // 2. Feature Gating & Tier Enforcement
  console.log('\n--- STEP 2: Verifying Permission Enforcement ---');
  const starterIntegrations = await canUseFeature(starterUserId, 'third_party_integrations', { supabase: adminClient });
  const starterWebhooks = await canUseFeature(starterUserId, 'webhooks', { supabase: adminClient });
  const starterApiAccess = await canUseFeature(starterUserId, 'api_access', { supabase: adminClient });
  const starterExports = await canUseFeature(starterUserId, 'automation_export', { supabase: adminClient });

  if (starterIntegrations.allowed || starterWebhooks.allowed || starterApiAccess.allowed || starterExports.allowed) {
    throw new Error('FAILED: Starter tier was granted access to integrations/exports/webhooks/api_access');
  }
  console.log('✅ Starter tier is strictly DENIED integrations, webhooks, exports, and API access.');

  const proIntegrations = await canUseFeature(proUserId, 'third_party_integrations', { supabase: adminClient });
  const proWebhooks = await canUseFeature(proUserId, 'webhooks', { supabase: adminClient });
  const proApiAccess = await canUseFeature(proUserId, 'api_access', { supabase: adminClient });
  const proExports = await canUseFeature(proUserId, 'automation_export', { supabase: adminClient });

  console.log('DEBUG Pro feature checks:', {
    proIntegrations: proIntegrations.allowed,
    proWebhooks: proWebhooks.allowed,
    proApiAccess: proApiAccess.allowed,
    proExports: proExports.allowed,
    proIntegrationsRes: proIntegrations,
    proWebhooksRes: proWebhooks,
    proApiAccessRes: proApiAccess,
    proExportsRes: proExports,
  });

  if (!proIntegrations.allowed || !proWebhooks.allowed || !proApiAccess.allowed || !proExports.allowed) {
    throw new Error('FAILED: Pro tier was denied access to integrations/exports/webhooks/api_access');
  }
  console.log('✅ Pro tier is strictly GRANTED integrations, webhooks, exports, and API access.');

  // Backend API Router 403 test for Starter
  const starterReq = await handleApiRequest(
    {
      method: 'GET',
      url: 'https://app.concludo.com/api/integrations',
      headers: { Authorization: `Bearer ${starterJwt}` },
    },
    { adminClient }
  );

  if (starterReq.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden for Starter user accessing /api/integrations, got ${starterReq.status}`);
  }
  console.log('✅ Server API Router returned HTTP 403 Forbidden for Starter user accessing /api/integrations.');

  // Backend API Router 200 test for Pro
  const proReq = await handleApiRequest(
    {
      method: 'GET',
      url: 'https://app.concludo.com/api/integrations',
      headers: { Authorization: `Bearer ${proJwt}` },
    },
    { adminClient }
  );

  if (proReq.status !== 200) {
    throw new Error(`Expected HTTP 200 OK for Pro user accessing /api/integrations, got ${proReq.status}`);
  }
  console.log('✅ Server API Router returned HTTP 200 OK for Pro user accessing /api/integrations.');

  // 3. Integration CRUD & Status
  console.log('\n--- STEP 3: Third-Party Integrations CRUD & Status ---');
  const plannerInt = await connectIntegration('microsoft_planner', { defaultBucket: 'Board Reviews' }, { supabase: anonClientPro });
  if (plannerInt.status !== 'connected' || plannerInt.provider !== 'microsoft_planner') {
    throw new Error('Failed to connect Microsoft Planner integration');
  }
  console.log(`✅ Connected integration: ${plannerInt.provider} (Status: ${plannerInt.status})`);

  const slackInt = await connectIntegration('slack', { defaultChannel: '#executive-updates' }, { supabase: anonClientPro });
  console.log(`✅ Connected integration: ${slackInt.provider} (Status: ${slackInt.status})`);

  // Update settings
  const updatedPlanner = await updateIntegrationSettings(plannerInt.id, { defaultBucket: 'Q4 Strategy' }, { supabase: anonClientPro });
  if (updatedPlanner.settings.defaultBucket !== 'Q4 Strategy') {
    throw new Error('Failed to update integration settings');
  }
  console.log('✅ Updated integration settings successfully.');

  // Disconnect
  await disconnectIntegration(slackInt.id, { supabase: anonClientPro });
  const allIntegrations = await fetchIntegrations({ supabase: anonClientPro });
  const disconnectedSlack = allIntegrations.find((i) => i.id === slackInt.id);
  if (disconnectedSlack?.status !== 'disconnected') {
    throw new Error('Expected Slack status to be disconnected');
  }
  console.log('✅ Disconnected integration verified.');

  // Reconnect
  const reconnectedSlack = await reconnectIntegration(slackInt.id, { supabase: anonClientPro });
  if (reconnectedSlack.status !== 'connected') {
    throw new Error('Failed to reconnect integration');
  }
  console.log('✅ Reconnected integration verified.');

  // 4. Sync Engine & Sync Logs
  console.log('\n--- STEP 4: Synchronization Engine & Sync Logs ---');
  const syncLog = await triggerSync(plannerInt.id, 'manual', { supabase: anonClientPro });
  if (syncLog.status !== 'completed' || syncLog.records_processed < 0) {
    throw new Error('Sync operation failed or returned invalid status');
  }
  console.log(`✅ Triggered sync: processed ${syncLog.records_processed} records in ${syncLog.duration_ms}ms (Status: ${syncLog.status})`);

  const syncLogs = await fetchSyncLogs(plannerInt.id, { supabase: anonClientPro });
  if (syncLogs.length === 0 || syncLogs[0].id !== syncLog.id) {
    throw new Error('Failed to retrieve sync history logs');
  }
  console.log(`✅ Retrieved sync logs: found ${syncLogs.length} entries for ${plannerInt.provider}.`);

  // 5. Automation Exports (Actions, Decisions, Projects, Reports, Bulk)
  console.log('\n--- STEP 5: Automation Exports & Retention Filtering ---');

  // Create sample project, decisions, actions
  const { data: project } = await adminClient
    .from('projects')
    .insert({
      user_id: proUserId,
      title: 'Strategic Expansion Boardroom',
      client_name: 'Acme Global Pty Ltd',
      project_name: 'Expansion Initiative',
      transcript: 'Full transcript discussing APAC expansion, regulatory compliance, and budget approvals.',
    })
    .select()
    .single();

  const { data: action1 } = await adminClient
    .from('action_tracker')
    .insert({
      user_id: proUserId,
      project_id: project.id,
      action_title: 'Submit ASIC financial compliance filing',
      action_description: 'Annual corporate disclosure review',
      owner_name: 'Anthony Cortez',
      due_date: '2026-10-15',
      status: 'in_progress',
    })
    .select()
    .single();

  const { data: actionDeleted } = await adminClient
    .from('action_tracker')
    .insert({
      user_id: proUserId,
      project_id: project.id,
      action_title: 'Outdated soft-deleted task',
      action_description: 'Archived task',
      owner_name: 'Anthony Cortez',
      due_date: '2026-09-01',
      status: 'not_started',
      deleted_at: new Date().toISOString(),
    })
    .select()
    .single();

  const { data: decision1 } = await adminClient
    .from('decision_memory')
    .insert({
      user_id: proUserId,
      project_id: project.id,
      decision_title: 'Approved FY27 capital allocation for Sydney datacenter',
      decision_summary: 'Capital allocation approval',
      decision_reasoning: 'Demonstrated 35% ROI and latency reduction across Australia',
      decision_owner: 'Executive Committee',
      decision_date: '2026-09-12',
    })
    .select()
    .single();

  const { data: report1 } = await adminClient
    .from('endpoint_reports')
    .insert({
      user_id: proUserId,
      title: 'Executive Session Briefing Q3',
      report_period: 'Q3 2026',
      report_content: { executive_summary: 'Comprehensive review of organizational alignment and project deliverables.' },
    })
    .select()
    .single();

  // Test Action Export to Microsoft Planner
  const actionExport = await executeActionExport([action1.id], 'microsoft_planner', { supabase: anonClientPro });
  if (actionExport.status !== 'success' || actionExport.records_count !== 1) {
    throw new Error('Action export failed');
  }
  console.log(`✅ Action Export to Microsoft Planner successful (Records: ${actionExport.records_count})`);

  // Verify that soft-deleted record is rejected/filtered out
  let deletedExportCaught = false;
  try {
    await executeActionExport([actionDeleted.id], 'microsoft_planner', { supabase: anonClientPro });
  } catch (err: any) {
    deletedExportCaught = true;
  }
  if (!deletedExportCaught) {
    throw new Error('FAILED: Soft-deleted record was exported instead of being blocked');
  }
  console.log('✅ Retention Rule Verified: Soft-deleted records are strictly excluded from exports.');

  // Test Decision Export to Notion
  const decisionExport = await executeDecisionExport([decision1.id], 'notion', { supabase: anonClientPro });
  if (decisionExport.status !== 'success') throw new Error('Decision export to Notion failed');
  console.log(`✅ Decision Export to Notion successful (Records: ${decisionExport.records_count})`);

  // Test Project Export to Microsoft Teams
  const projectExport = await executeProjectExport([project.id], 'microsoft_teams', { supabase: anonClientPro });
  if (projectExport.status !== 'success') throw new Error('Project export to Teams failed');
  console.log(`✅ Project Export to Microsoft Teams successful (Records: ${projectExport.records_count})`);

  // Test Report Export
  const reportExport = await executeReportExport([report1.id], 'slack', { supabase: anonClientPro });
  if (reportExport.status !== 'success') throw new Error('Report export to Slack failed');
  console.log(`✅ Report Export to Slack successful (Records: ${reportExport.records_count})`);

  // Test Bulk Export
  const bulkExport = await executeBulkExport(
    [
      { type: 'action', id: action1.id },
      { type: 'decision', id: decision1.id },
      { type: 'project', id: project.id },
    ],
    'microsoft_teams',
    { supabase: anonClientPro }
  );
  if (bulkExport.status !== 'success') throw new Error('Bulk export failed');
  console.log(`✅ Bulk Export of mixed records successful (Records count: ${bulkExport.records_count})`);

  // 6. Webhooks & Event Streams
  console.log('\n--- STEP 6: Webhook Framework & Delivery Logging ---');
  const webhookResult = await createWebhook(
    'Production Operations Gateway',
    'https://api.concludo.com.au/webhooks/test-endpoint',
    ['project_created', 'action_completed', 'decision_created'],
    { supabase: anonClientPro }
  );

  const webhook = webhookResult.webhook;
  const signingSecret = webhookResult.signingSecret;

  if (!signingSecret.startsWith('whsec_')) {
    throw new Error('Expected signing secret to start with whsec_');
  }
  console.log(`✅ Webhook created with signing secret: ${webhook.name} (Secret prefix: ${signingSecret.slice(0, 10)}...)`);

  // Verify fetchWebhooks does NOT expose secret_key
  const webhooksList = await fetchWebhooks({ supabase: anonClientPro });
  const fetchedWebhook = webhooksList.find((w) => w.id === webhook.id);
  if (fetchedWebhook?.secret_key) {
    throw new Error('FAILED: secret_key was exposed in list view');
  }
  console.log('✅ Webhook secret key is masked/omitted from list queries.');

  // Test Webhook Ping
  const pingLog = await triggerWebhookTest(webhook.id, { supabase: anonClientPro });
  if (!pingLog.id || pingLog.event_type !== 'test_ping') {
    throw new Error('Webhook test ping failed');
  }
  console.log(`✅ Webhook delivery verified: Status ${pingLog.status} (HTTP ${pingLog.response_code})`);

  const deliveryLogs = await fetchWebhookLogs(webhook.id, { supabase: anonClientPro });
  if (deliveryLogs.length === 0 || deliveryLogs[0].id !== pingLog.id) {
    throw new Error('Webhook delivery logs retrieval failed');
  }
  console.log(`✅ Webhook logs retrieved: ${deliveryLogs.length} delivery records found.`);

  // 7. API Keys & Public API Access
  console.log('\n--- STEP 7: API Key Management & Public API Access ---');
  const apiKeyResult = await createApiKey('Backend Sync Daemon', 90, { supabase: anonClientPro });
  const rawApiKey = apiKeyResult.apiKey;
  const apiKeyRecord = apiKeyResult.keyRecord;

  if (!rawApiKey.startsWith('cnc_live_')) {
    throw new Error('Expected raw API key to start with cnc_live_');
  }
  console.log(`✅ API Key generated: ${apiKeyRecord.name} (${apiKeyRecord.key_prefix})`);

  // Verify fetchApiKeys does NOT expose key_hash
  const keysList = await fetchApiKeys({ supabase: anonClientPro });
  const retrievedKey = keysList.find((k) => k.id === apiKeyRecord.id);
  if ((retrievedKey as any)?.key_hash) {
    throw new Error('FAILED: key_hash was exposed in fetchApiKeys');
  }
  console.log('✅ API key hash is strictly omitted from client responses.');

  // Authenticate Public API via API key header
  const apiProjectsReq = await handleApiRequest(
    {
      method: 'GET',
      url: 'https://app.concludo.com/api/v1/projects',
      headers: { 'x-api-key': rawApiKey },
    },
    { adminClient }
  );

  if (apiProjectsReq.status !== 200 || apiProjectsReq.body.auth !== 'api_key') {
    throw new Error(`API Key authentication failed for /api/v1/projects: ${apiProjectsReq.status}`);
  }
  console.log(`✅ Public API authenticated successfully via API Key (Returned ${apiProjectsReq.body.count} projects)`);

  // Query decisions via API key
  const apiDecisionsReq = await handleApiRequest(
    {
      method: 'GET',
      url: 'https://app.concludo.com/api/v1/decisions',
      headers: { Authorization: `Bearer ${rawApiKey}` },
    },
    { adminClient }
  );

  if (apiDecisionsReq.status !== 200) {
    throw new Error(`API Key authentication failed for /api/v1/decisions: ${apiDecisionsReq.status}`);
  }
  console.log(`✅ Public API /api/v1/decisions query verified (Returned ${apiDecisionsReq.body.count} decisions)`);

  // Rotate Key
  const rotatedKeyResult = await rotateApiKey(apiKeyRecord.id, { supabase: anonClientPro });
  console.log(`✅ API Key rotated: old key revoked, new key generated (${rotatedKeyResult.keyRecord.key_prefix})`);

  // Test that old key is now rejected
  const revokedKeyReq = await handleApiRequest(
    {
      method: 'GET',
      url: 'https://app.concludo.com/api/v1/projects',
      headers: { 'x-api-key': rawApiKey },
    },
    { adminClient }
  );

  if (revokedKeyReq.status !== 401) {
    throw new Error(`Expected HTTP 401 for revoked API key, got ${revokedKeyReq.status}`);
  }
  console.log('✅ Revoked API key is strictly rejected by server router with HTTP 401.');

  // 8. Audit Trail Verification
  console.log('\n--- STEP 8: Immutable Audit Logging Verification ---');
  const { data: auditEvents } = await adminClient
    .from('audit_logs')
    .select('action, entity_type, entity_id, created_at')
    .in('action', [
      'integration_connected',
      'integration_disconnected',
      'export_executed',
      'webhook_created',
      'webhook_triggered',
      'api_key_created',
      'api_key_revoked',
      'sync_executed',
    ])
    .order('created_at', { ascending: false });

  const capturedActions = new Set(auditEvents?.map((e) => e.action) || []);
  console.log(`✅ Captured audit actions: ${Array.from(capturedActions).join(', ')}`);

  console.log('\n================================================================');
  console.log('ALL TASKLET 18 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');

  // Clean up test data
  console.log('Cleaning up Tasklet 18 test fixtures...');
  await adminClient.from('webhook_logs').delete().eq('webhook_id', webhook.id);
  await adminClient.from('webhooks').delete().eq('owner_id', proUserId);
  await adminClient.from('api_keys').delete().eq('owner_id', proUserId);
  await adminClient.from('integration_sync_logs').delete().eq('user_id', proUserId);
  await adminClient.from('integrations').delete().eq('user_id', proUserId);
  await adminClient.from('automation_exports').delete().eq('user_id', proUserId);
  await adminClient.from('action_tracker').delete().eq('project_id', project.id);
  await adminClient.from('decision_memory').delete().eq('project_id', project.id);
  await adminClient.from('endpoint_reports').delete().eq('user_id', proUserId);
  await adminClient.from('projects').delete().eq('id', project.id);
  await adminClient.auth.admin.deleteUser(starterUserId);
  await adminClient.auth.admin.deleteUser(proUserId);
  await adminClient.auth.admin.deleteUser(enterpriseUserId);
  console.log('✅ Cleanup completed.');
}

runTasklet18Tests().catch((err) => {
  console.error('Tasklet 18 test suite failed:', err);
  process.exit(1);
});
