import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import {
  createProject,
  fetchProjects,
  fetchProjectById,
  softDeleteProject,
  fetchDeletedProjects
} from '../src/lib/projects/projectClient';
import {
  saveOutput,
  fetchProjectOutputs,
  fetchOutputById,
  softDeleteOutput,
  fetchDeletedOutputs
} from '../src/lib/outputs/outputClient';
import { saveTranscript, fetchProjectTranscript } from '../src/lib/transcripts/transcriptClient';
import {
  executeRetentionPurge,
  executeUserRetentionPurge,
  getRetentionPolicy,
  resolveRetentionWindow
} from '../src/lib/retention';
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
      return [l.slice(0, idx), l.slice(idx + 1)];
    })
);

const supabaseUrl = envVars.SUPABASE_URL;
const anonKey = envVars.SUPABASE_ANON_KEY;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(supabaseUrl, serviceKey);

async function runAutomatedPurgeTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 11E: AUTOMATIC PURGE & SETTINGS INTEGRATION SUITE');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const testEmail = `purge-qa-${timestamp}@concludo-test.local`;
  const password = 'TestSecurePassword!2026';

  let testUserId = '';

  try {
    // 1. Setup Test User
    console.log('1. Setting up QA Account for Retention Purge...');
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'Purge Engine QA' }
    });
    if (authErr || !authData.user) throw new Error(`User creation failed: ${authErr?.message}`);
    testUserId = authData.user.id;

    // Set plan to Pro
    await adminClient.from('profiles').update({ plan: 'pro' }).eq('id', testUserId);

    // Authenticate Supabase client
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: sessionData, error: loginErr } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password
    });
    if (loginErr || !sessionData.session) throw new Error(`User login failed: ${loginErr?.message}`);
    const userToken = sessionData.session.access_token;

    console.log('   ✅ QA Account authenticated with active user session\n');

    // 2. Create Active Project & Output (Control Group: Must remain indefinitely)
    console.log('2. Creating Active Records (Retained Indefinitely)...');
    const pActiveRes = await createProject(userClient, {
      title: 'Active Governance Session 2026',
      meeting_type: 'Board Meeting',
      client_or_project: 'Concludo Pty Ltd',
      meeting_date: '2026-09-12'
    });
    if (!pActiveRes.data) throw new Error(`Active project creation failed: ${pActiveRes.error?.message}`);
    const activeProject = pActiveRes.data;

    const oActiveRes = await saveOutput(userClient, {
      project_id: activeProject.id,
      output_type: 'summary',
      content: 'Active meeting summary retained indefinitely.'
    });
    if (!oActiveRes.data) throw new Error(`Active output creation failed: ${oActiveRes.error?.message}`);
    const activeOutput = oActiveRes.data;

    console.log(`   ✅ Active Project created: "${activeProject.title}" (deleted_at: null, purge_after: null)`);
    console.log(`   ✅ Active Output created: [${activeOutput.output_type}] (deleted_at: null, purge_after: null)\n`);

    // 3. Create Unexpired Soft-Deleted Project & Output (Within 30-Day Recovery Window)
    console.log('3. Creating Unexpired Soft-Deleted Records (15 Days Remaining)...');
    const pUnexpiredRes = await createProject(userClient, {
      title: 'Unexpired Recent Session 2026',
      meeting_type: 'Client Strategy',
      client_or_project: 'Apex Financial',
      meeting_date: '2026-09-12'
    });
    if (!pUnexpiredRes.data) throw new Error(`Unexpired project creation failed: ${pUnexpiredRes.error?.message}`);
    const unexpiredProject = pUnexpiredRes.data;

    const oUnexpiredRes = await saveOutput(userClient, {
      project_id: unexpiredProject.id,
      output_type: 'action_items',
      content: 'Unexpired action items recoverable in Recently Deleted.'
    });
    if (!oUnexpiredRes.data) throw new Error(`Unexpired output creation failed: ${oUnexpiredRes.error?.message}`);
    const unexpiredOutput = oUnexpiredRes.data;

    // Soft delete via user client
    await softDeleteProject(userClient, unexpiredProject.id);

    // Adjust unexpired timestamps to 15 days ago so purge_after is 15 days in the future
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const fifteenDaysFuture = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

    await adminClient
      .from('projects')
      .update({ deleted_at: fifteenDaysAgo, purge_after: fifteenDaysFuture })
      .eq('id', unexpiredProject.id);

    await adminClient
      .from('outputs')
      .update({ deleted_at: fifteenDaysAgo, purge_after: fifteenDaysFuture })
      .eq('id', unexpiredOutput.id);

    console.log(`   ✅ Unexpired Project: "${unexpiredProject.title}" (purge_after: ${fifteenDaysFuture})`);
    console.log(`   ✅ Unexpired Output: [${unexpiredOutput.output_type}] (purge_after: ${fifteenDaysFuture})\n`);

    // 4. Create Expired Soft-Deleted Project & Outputs (purge_after < now())
    console.log('4. Creating Expired Records (Soft-deleted 35 days ago, purge_after 5 days in past)...');
    const pExpiredRes = await createProject(userClient, {
      title: 'Expired Legacy Session 2026',
      meeting_type: 'Executive Review',
      client_or_project: 'Old Corp',
      meeting_date: '2026-08-01'
    });
    if (!pExpiredRes.data) throw new Error(`Expired project creation failed: ${pExpiredRes.error?.message}`);
    const expiredProject = pExpiredRes.data;

    const tExpiredRes = await saveTranscript(userClient, {
      project_id: expiredProject.id,
      raw_text: 'Speaker 1: This transcript is part of an expired project and must be purged.'
    });
    if (!tExpiredRes.data) throw new Error(`Expired transcript creation failed: ${tExpiredRes.error?.message}`);
    const expiredTranscript = tExpiredRes.data;

    const oExpiredRes1 = await saveOutput(userClient, {
      project_id: expiredProject.id,
      output_type: 'decision_log',
      content: 'Expired decision log past 30 days.'
    });
    if (!oExpiredRes1.data) throw new Error(`Expired output 1 creation failed: ${oExpiredRes1.error?.message}`);
    const expiredOutput1 = oExpiredRes1.data;

    // Standalone expired output in active project
    const oExpiredStandaloneRes = await saveOutput(userClient, {
      project_id: activeProject.id,
      output_type: 'follow_up_email',
      content: 'Expired standalone output inside an active project.'
    });
    if (!oExpiredStandaloneRes.data) throw new Error(`Standalone expired output failed`);
    const expiredStandaloneOutput = oExpiredStandaloneRes.data;

    // Mark as soft deleted and set expired purge_after
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysPast = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // Expire project and child records
    await adminClient
      .from('projects')
      .update({ deleted_at: thirtyFiveDaysAgo, purge_after: fiveDaysPast })
      .eq('id', expiredProject.id);

    await adminClient
      .from('transcripts')
      .update({ deleted_at: thirtyFiveDaysAgo })
      .eq('id', expiredTranscript.id);

    await adminClient
      .from('outputs')
      .update({ deleted_at: thirtyFiveDaysAgo, purge_after: fiveDaysPast })
      .eq('id', expiredOutput1.id);

    // Expire standalone output
    await adminClient
      .from('outputs')
      .update({ deleted_at: thirtyFiveDaysAgo, purge_after: fiveDaysPast })
      .eq('id', expiredStandaloneOutput.id);

    console.log(`   ✅ Expired Project created: "${expiredProject.title}" (purge_after: ${fiveDaysPast})`);
    console.log(`   ✅ Expired Child Output created: [${expiredOutput1.output_type}] (purge_after: ${fiveDaysPast})`);
    console.log(`   ✅ Expired Standalone Output created: [${expiredStandaloneOutput.output_type}] (purge_after: ${fiveDaysPast})\n`);

    // 5. Execute Backend Automated Retention Purge
    console.log('5. Executing Backend Automated Retention Purge Routine...');
    console.log('   Criteria: deleted_at is not null AND purge_after < now()');

    const purgeResult = await executeRetentionPurge(adminClient);

    console.log('   Purge Execution Result:', JSON.stringify(purgeResult));
    if (!purgeResult.success) throw new Error(`Purge failed: ${purgeResult.error}`);
    if (purgeResult.purged_projects < 1) throw new Error('Expected at least 1 expired project purged');
    if (purgeResult.purged_outputs < 2) throw new Error('Expected at least 2 expired outputs purged');

    console.log(`   ✅ Purge executed successfully: ${purgeResult.purged_projects} project(s), ${purgeResult.purged_outputs} output(s) purged\n`);

    // 6. Verify Database State Post-Purge
    console.log('6. Verifying Database State Post-Purge...');

    // 6a. Expired Project should be completely gone
    const { data: checkExpiredProj } = await adminClient
      .from('projects')
      .select('id')
      .eq('id', expiredProject.id)
      .maybeSingle();

    if (checkExpiredProj) {
      throw new Error('FAILED: Expired project still exists in database after automated purge!');
    }
    console.log('   ✅ Expired project permanently purged from database');

    // 6b. Expired child transcript should be purged
    const { data: checkExpiredTrans } = await adminClient
      .from('transcripts')
      .select('id')
      .eq('id', expiredTranscript.id)
      .maybeSingle();

    if (checkExpiredTrans) {
      throw new Error('FAILED: Expired transcript still exists after project purge!');
    }
    console.log('   ✅ Expired transcript permanently purged');

    // 6c. Expired outputs should be completely gone
    const { data: checkExpiredOut1 } = await adminClient
      .from('outputs')
      .select('id')
      .eq('id', expiredOutput1.id)
      .maybeSingle();

    if (checkExpiredOut1) {
      throw new Error('FAILED: Expired child output still exists after automated purge!');
    }

    const { data: checkExpiredOut2 } = await adminClient
      .from('outputs')
      .select('id')
      .eq('id', expiredStandaloneOutput.id)
      .maybeSingle();

    if (checkExpiredOut2) {
      throw new Error('FAILED: Standalone expired output still exists after automated purge!');
    }
    console.log('   ✅ Expired outputs permanently purged from database');

    // 6d. Unexpired Soft-Deleted Project and Output MUST STILL EXIST
    const { data: checkUnexpiredProj } = await adminClient
      .from('projects')
      .select('id, title, deleted_at, purge_after')
      .eq('id', unexpiredProject.id)
      .single();

    if (!checkUnexpiredProj || !checkUnexpiredProj.deleted_at) {
      throw new Error('FAILED: Unexpired soft-deleted project was unexpectedly modified or purged!');
    }
    console.log(`   ✅ Unexpired project preserved in Recently Deleted (${checkUnexpiredProj.title})`);

    const { data: checkUnexpiredOut } = await adminClient
      .from('outputs')
      .select('id, output_type, deleted_at, purge_after')
      .eq('id', unexpiredOutput.id)
      .single();

    if (!checkUnexpiredOut || !checkUnexpiredOut.deleted_at) {
      throw new Error('FAILED: Unexpired soft-deleted output was unexpectedly modified or purged!');
    }
    console.log(`   ✅ Unexpired output preserved in Recently Deleted ([${checkUnexpiredOut.output_type}])`);

    // 6e. Active Project and Output MUST STILL EXIST INDEFINITELY
    const { data: checkActiveProj } = await adminClient
      .from('projects')
      .select('id, title, deleted_at')
      .eq('id', activeProject.id)
      .single();

    if (!checkActiveProj || checkActiveProj.deleted_at !== null) {
      throw new Error('FAILED: Active project was corrupted during purge routine!');
    }
    console.log(`   ✅ Active project preserved indefinitely (${checkActiveProj.title})`);

    const { data: checkActiveOut } = await adminClient
      .from('outputs')
      .select('id, output_type, deleted_at')
      .eq('id', activeOutput.id)
      .single();

    if (!checkActiveOut || checkActiveOut.deleted_at !== null) {
      throw new Error('FAILED: Active output was corrupted during purge routine!');
    }
    console.log(`   ✅ Active output preserved indefinitely ([${checkActiveOut.output_type}])\n`);

    // 7. Test Backend API Retention Endpoints
    console.log('7. Testing Backend API Retention Endpoints...');

    // 7a. GET /api/retention/policy
    const policyReq = {
      method: 'GET',
      url: '/api/retention/policy',
      headers: {}
    };
    const policyRes = await handleApiRequest(policyReq, { adminClient });
    if (policyRes.status !== 200) throw new Error(`Expected 200 from policy endpoint, got ${policyRes.status}`);
    if (policyRes.body.retention_policy_days !== 30) throw new Error('Expected 30 days retention policy');
    if (policyRes.body.purge_frequency !== 'daily') throw new Error('Expected daily purge frequency');
    console.log('   ✅ GET /api/retention/policy returned authoritative 30-day daily retention policy');

    // 7b. POST /api/retention/purge with Background Worker Cron Secret
    const workerReq = {
      method: 'POST',
      url: '/api/retention/purge',
      headers: {
        'x-cron-secret': 'concludo-retention-daily-purge'
      }
    };
    const workerRes = await handleApiRequest(workerReq, { adminClient });
    if (workerRes.status !== 200) throw new Error(`Expected 200 for cron worker purge, got ${workerRes.status}`);
    if (!workerRes.body.success) throw new Error('Expected successful purge execution');
    console.log('   ✅ POST /api/retention/purge authorized via cron secret header');

    // 7c. POST /api/retention/purge unauthorized without session or secret
    const unauthReq = {
      method: 'POST',
      url: '/api/retention/purge',
      headers: {}
    };
    const unauthRes = await handleApiRequest(unauthReq, { adminClient });
    if (unauthRes.status !== 401) throw new Error(`Expected 401 for unauthenticated purge, got ${unauthRes.status}`);
    console.log('   ✅ POST /api/retention/purge unauthenticated access rejected (HTTP 401)');

    // 7d. POST /api/retention/purge with User Bearer Token
    const userReq = {
      method: 'POST',
      url: '/api/retention/purge',
      headers: {
        authorization: `Bearer ${userToken}`
      }
    };
    const userRes = await handleApiRequest(userReq, { adminClient });
    if (userRes.status !== 200) throw new Error(`Expected 200 for user purge, got ${userRes.status}`);
    console.log('   ✅ POST /api/retention/purge authenticated user-scoped purge succeeded\n');

    // 8. Test Future Team Retention Architecture Helpers
    console.log('8. Testing Future Team Retention Architecture Support...');
    const defaultDays = resolveRetentionWindow();
    if (defaultDays !== 30) throw new Error(`Expected default 30 days, got ${defaultDays}`);

    const overriddenDays = resolveRetentionWindow({
      retention_policy_days: 60,
      team_retention_override: true
    });
    if (overriddenDays !== 60) throw new Error(`Expected overridden 60 days, got ${overriddenDays}`);

    const disabledOverrideDays = resolveRetentionWindow({
      retention_policy_days: 90,
      team_retention_override: false
    });
    if (disabledOverrideDays !== 30) throw new Error(`Expected 30 days when override disabled, got ${disabledOverrideDays}`);

    console.log('   ✅ Future Team Retention resolution verified: default=30d, override=60d, disabled=30d\n');

    console.log('========================================================');
    console.log('✅ ALL TASKLET 11E AUTOMATED PURGE TESTS PASSED CLEANLY');
    console.log('========================================================\n');
  } finally {
    // Cleanup QA User
    if (testUserId) {
      console.log('Cleaning up QA test accounts...');
      await adminClient.auth.admin.deleteUser(testUserId);
      console.log('Cleanup completed.');
    }
  }
}

runAutomatedPurgeTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
