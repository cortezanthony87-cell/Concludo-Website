import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  connectIntegration,
  disconnectIntegration,
  fetchIntegrations,
  executeActionExport,
} from '../src/lib/integrations/integrationClient';

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

async function run() {
  console.log('--- Testing OAuth Connect Flow & Outlook Dispatch Interface ---');

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Create a temporary test user
  const testEmail = `oauth-test-${Date.now()}@concludo.au`;
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: 'Password123!Secure',
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    throw new Error(`Failed to create test user: ${authErr?.message}`);
  }
  const testUserId = authData.user.id;
  console.log(`✅ Provisioned test user: ${testUserId} (${testEmail})`);

  // Grant Pro plan so user can use integrations
  await adminClient.from('profiles').upsert({
    id: testUserId,
    subscription_tier: 'pro_subscription_trial',
    email: testEmail,
  });

  // Client as test user
  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: 'Password123!Secure',
  });
  if (signInErr) throw signInErr;

  // 2. Connect Microsoft Outlook via connectIntegration with OAuth metadata
  const oauthSettings = {
    account_email: 'anthony@concludo.au',
    account_name: 'anthony',
    account_type: 'work',
    scopes: ['User.Read', 'Mail.Send', 'offline_access'],
    auth_method: 'oauth2_delegated',
    connected_at: new Date().toISOString(),
    provider_name: 'Microsoft Outlook',
  };

  const integ = await connectIntegration('microsoft_outlook', oauthSettings, { supabase: userClient });
  console.log(`✅ Connected integration: ${integ.provider} (status: ${integ.status})`);
  if (integ.settings.account_email !== 'anthony@concludo.au') {
    throw new Error('Account email mismatch in integration settings');
  }

  // 3. Create a test project and action item
  const { data: proj, error: projErr } = await adminClient
    .from('projects')
    .insert({
      user_id: testUserId,
      title: 'Q4 Operational Strategy Session',
      client_name: 'Concludo Pty Ltd',
      project_name: 'Workspace Expansion',
    })
    .select()
    .single();
  if (projErr) throw projErr;

  const { data: action, error: actErr } = await adminClient
    .from('action_tracker')
    .insert({
      user_id: testUserId,
      project_id: proj.id,
      action_title: 'Dispatch executive briefing to board members',
      action_description: 'Send finalized action items and financial decisions.',
      owner_name: 'Anthony Cortez',
      due_date: '2026-10-15',
      status: 'in_progress',
    })
    .select()
    .single();
  if (actErr) throw actErr;

  console.log(`✅ Created test action: "${action.action_title}" (${action.id})`);

  // 4. Execute Action Export targeting Microsoft Outlook with dispatchOptions
  const dispatchOptions = {
    recipients: ['team@concludo.au', 'board@concludo.au'],
    subject: '[Concludo Action Plan] Q4 Operational Strategy Decisions',
    senderEmail: 'anthony@concludo.au',
    projectId: proj.id,
  };

  const exportResult = await executeActionExport([action.id], 'microsoft_outlook', {
    supabase: userClient,
    dispatchOptions,
  });

  console.log(`✅ Action Export executed successfully: id=${exportResult.id}, count=${exportResult.records_count}`);

  if (exportResult.destination !== 'microsoft_outlook') {
    throw new Error(`Unexpected destination: ${exportResult.destination}`);
  }
  if (!exportResult.payload_summary?.dispatch) {
    throw new Error('Missing dispatch metadata in payload_summary');
  }
  if (exportResult.payload_summary.dispatch.recipients.length !== 2) {
    throw new Error('Recipients list mismatch in dispatch metadata');
  }

  console.log('✅ Dispatch metadata verified:', JSON.stringify(exportResult.payload_summary.dispatch, null, 2));

  // 5. Cleanup
  await adminClient.from('action_tracker').delete().eq('id', action.id);
  await adminClient.from('projects').delete().eq('id', proj.id);
  await adminClient.from('automation_exports').delete().eq('id', exportResult.id);
  await adminClient.from('integrations').delete().eq('id', integ.id);
  await adminClient.auth.admin.deleteUser(testUserId);
  console.log('✅ Cleanup completed successfully.');

  console.log('🎉 ALL OAUTH CONNECT & OUTLOOK DISPATCH TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
