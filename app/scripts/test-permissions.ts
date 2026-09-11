import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { canUseFeature } from '../src/lib/permissions/canUseFeature';
import {
  ALL_FEATURE_KEYS,
  PLAN_PERMISSIONS,
  PlanType,
  FeatureKey,
} from '../src/lib/permissions/types';
import { handleApiRequest } from '../src/server/apiRouter';

// Parse environment variables from .env.local
const envFile = readFileSync('/tmp/concludo-workspace/.env.local', 'utf8');
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

process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function runPermissionsTestSuite() {
  console.log('====================================================');
  console.log('TASKLET 9: BACKEND PERMISSION CHECKING TEST SUITE');
  console.log('====================================================\n');

  // 1. Provision Test Accounts for each plan tier
  const timestamp = Date.now();
  const testPassword = `PermTest!987_${timestamp}`;

  const planTiers: PlanType[] = ['free_preview', 'starter', 'pro', 'team', 'admin'];
  const testUsers: Record<PlanType, { id: string; email: string; token: string }> = {} as any;

  console.log('1. Provisioning Test Accounts across all plan tiers:');
  for (const plan of planTiers) {
    const email = `perm-${plan}-${timestamp}@concludo-test.local`;
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `User ${plan}` },
    });

    if (authErr || !authData.user) {
      throw new Error(`Failed to create test user for ${plan}: ${authErr?.message}`);
    }

    const userId = authData.user.id;

    // Update profile plan directly using service_role admin capabilities
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({ plan, role: plan === 'admin' ? 'admin' : 'user' })
      .eq('id', userId);

    if (profileErr) {
      throw new Error(`Failed to set profile plan to ${plan}: ${profileErr.message}`);
    }

    // Sign in to obtain access token
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInErr } = await userClient.auth.signInWithPassword({
      email,
      password: testPassword,
    });

    if (signInErr || !signInData.session) {
      throw new Error(`Failed to sign in as ${plan}: ${signInErr?.message}`);
    }

    testUsers[plan] = {
      id: userId,
      email,
      token: signInData.session.access_token,
    };

    console.log(`   ✅ Plan tier "${plan}": User ${email} (ID: ${userId}) configured.`);
  }

  try {
    // 2. Validate canUseFeature for each plan tier against the specification
    console.log('\n2. Verifying Plan Permission Rules with canUseFeature():');

    // Rule A: free_preview can use core_outputs and copy_output only
    console.log('   Testing "free_preview" plan:');
    const freeUser = testUsers['free_preview'];
    const freeCore = await canUseFeature(freeUser.id, 'core_outputs', { supabase: adminClient });
    const freeCopy = await canUseFeature(freeUser.id, 'copy_output', { supabase: adminClient });
    const freeJson = await canUseFeature(freeUser.id, 'json_export', { supabase: adminClient });
    const freeProjects = await canUseFeature(freeUser.id, 'saved_projects', { supabase: adminClient });
    const freeDecision = await canUseFeature(freeUser.id, 'decision_memory', { supabase: adminClient });

    if (!freeCore.allowed || !freeCopy.allowed) {
      throw new Error('free_preview must allow core_outputs and copy_output');
    }
    if (freeJson.allowed || freeProjects.allowed || freeDecision.allowed) {
      throw new Error('free_preview must NOT allow json_export, saved_projects, or decision_memory');
    }
    console.log('   ✅ free_preview allowed core_outputs and copy_output ONLY.');

    // Rule B: starter can use core_outputs, copy_output, and json_export
    console.log('   Testing "starter" plan:');
    const starterUser = testUsers['starter'];
    const starterCore = await canUseFeature(starterUser.id, 'core_outputs', { supabase: adminClient });
    const starterCopy = await canUseFeature(starterUser.id, 'copy_output', { supabase: adminClient });
    const starterJson = await canUseFeature(starterUser.id, 'json_export', { supabase: adminClient });
    const starterProjects = await canUseFeature(starterUser.id, 'saved_projects', { supabase: adminClient });
    const starterDecision = await canUseFeature(starterUser.id, 'decision_memory', { supabase: adminClient });

    if (!starterCore.allowed || !starterCopy.allowed || !starterJson.allowed) {
      throw new Error('starter must allow core_outputs, copy_output, and json_export');
    }
    if (starterProjects.allowed || starterDecision.allowed) {
      throw new Error('starter must NOT allow saved_projects or decision_memory');
    }
    console.log('   ✅ starter allowed core_outputs, copy_output, and json_export.');

    // Rule C: pro can use memory and intelligence features
    console.log('   Testing "pro" plan:');
    const proUser = testUsers['pro'];
    const proFeaturesToTest: FeatureKey[] = [
      'core_outputs',
      'copy_output',
      'json_export',
      'saved_projects',
      'transcript_archive',
      'manual_outputs',
      'decision_memory',
      'action_tracker',
      'keyword_search',
      'insight',
      'stats',
      'endpoint_report',
      'next_best_action',
      'meeting_health_dashboard',
      'automation_export',
    ];

    for (const f of proFeaturesToTest) {
      const res = await canUseFeature(proUser.id, f, { supabase: adminClient });
      if (!res.allowed) {
        throw new Error(`pro must allow ${f}`);
      }
    }

    const proTeamWorkspace = await canUseFeature(proUser.id, 'team_workspace', { supabase: adminClient });
    const proAdminTools = await canUseFeature(proUser.id, 'admin_tools', { supabase: adminClient });
    if (proTeamWorkspace.allowed || proAdminTools.allowed) {
      throw new Error('pro must NOT allow team_workspace or admin_tools');
    }
    console.log('   ✅ pro allowed all memory, intelligence, and project features; blocked team_workspace/admin_tools.');

    // Rule D: team can use team_workspace
    console.log('   Testing "team" plan:');
    const teamUser = testUsers['team'];
    const teamWs = await canUseFeature(teamUser.id, 'team_workspace', { supabase: adminClient });
    const teamAdminTools = await canUseFeature(teamUser.id, 'admin_tools', { supabase: adminClient });
    if (!teamWs.allowed) {
      throw new Error('team must allow team_workspace');
    }
    if (teamAdminTools.allowed) {
      throw new Error('team must NOT allow admin_tools');
    }
    console.log('   ✅ team allowed team_workspace; blocked admin_tools.');

    // Rule E: admin can use admin_tools
    console.log('   Testing "admin" plan:');
    const adminUser = testUsers['admin'];
    const adminTools = await canUseFeature(adminUser.id, 'admin_tools', { supabase: adminClient });
    const adminWs = await canUseFeature(adminUser.id, 'team_workspace', { supabase: adminClient });
    if (!adminTools.allowed || !adminWs.allowed) {
      throw new Error('admin must allow admin_tools and team_workspace');
    }
    console.log('   ✅ admin allowed admin_tools and all workspace features.');

    // 3. Security Tests: Direct API and Forbidden Features
    console.log('\n3. Security Testing: API Direct Access & Forbidden Features:');

    // Test 3.1: free_preview accessing saved_projects via API
    const freeProjectsApiRes = await handleApiRequest(
      {
        method: 'POST',
        url: '/api/projects',
        headers: {
          authorization: `Bearer ${freeUser.token}`,
          'content-type': 'application/json',
        },
        body: { title: 'Unauthorized Project' },
      },
      { adminClient }
    );

    if (freeProjectsApiRes.status !== 403) {
      throw new Error(`Expected status 403 for free_preview calling /api/projects, got ${freeProjectsApiRes.status}`);
    }

    const errBody = freeProjectsApiRes.body;
    if (
      errBody.error !== 'feature_not_available' ||
      errBody.message !== 'Your current plan does not include this feature.' ||
      errBody.feature !== 'saved_projects' ||
      errBody.requiredUpgrade !== true
    ) {
      throw new Error(`Error response did not match required format: ${JSON.stringify(errBody)}`);
    }
    console.log('   ✅ API returned 403 Forbidden with exact required error JSON for unauthorized feature.');

    // Test 3.2: Browser cannot fake a Pro plan in request body
    console.log('\n4. Security Testing: Client cannot spoof plan in request body:');
    const spoofAttemptRes = await handleApiRequest(
      {
        method: 'POST',
        url: '/api/features/check',
        headers: {
          authorization: `Bearer ${freeUser.token}`,
          'content-type': 'application/json',
        },
        body: {
          feature: 'decision_memory',
          plan: 'pro', // Attacker trying to spoof Pro plan in payload
          role: 'admin',
        },
      },
      { adminClient }
    );

    if (spoofAttemptRes.status !== 403) {
      throw new Error(`Plan spoofing succeeded! Expected 403, got ${spoofAttemptRes.status}`);
    }
    console.log('   ✅ Attacker payload { plan: "pro" } ignored; backend authoritatively read database plan (free_preview) and returned 403.');

    // Test 3.3: Logged-out user cannot access protected endpoints
    console.log('\n5. Security Testing: Logged-out access rejection:');
    const loggedOutRes = await handleApiRequest(
      {
        method: 'POST',
        url: '/api/features/check',
        headers: {
          'content-type': 'application/json',
        },
        body: { feature: 'core_outputs' },
      },
      { adminClient }
    );

    if (loggedOutRes.status !== 401) {
      throw new Error(`Expected status 401 for logged-out call, got ${loggedOutRes.status}`);
    }
    console.log('   ✅ Logged-out request rejected with 401 Unauthorized.');

    // Test 3.4: Missing user profile returns clear error
    console.log('\n6. Security Testing: Missing profile handling:');
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
    const missingProfileRes = await canUseFeature(nonExistentUserId, 'core_outputs', {
      supabase: adminClient,
    });

    if (missingProfileRes.allowed || missingProfileRes.statusCode !== 404) {
      throw new Error('Expected 404 profile_not_found for non-existent user');
    }
    console.log(`   ✅ Non-existent user profile returned clear error: "${missingProfileRes.error?.message}"`);

    // Test 3.5: Invalid feature key returns clear error
    console.log('\n7. Security Testing: Invalid feature key handling:');
    const invalidKeyRes = await canUseFeature(freeUser.id, 'non_existent_exploit_feature', {
      supabase: adminClient,
    });

    if (invalidKeyRes.allowed || invalidKeyRes.statusCode !== 400) {
      throw new Error('Expected 400 invalid_feature_key for non-existent feature key');
    }
    console.log(`   ✅ Invalid feature key returned clear error: "${invalidKeyRes.error?.message}"`);

    // Test 3.6: Verify authorized Pro call succeeds
    console.log('\n8. Authorized Pro Feature Access:');
    const proDecisionApiRes = await handleApiRequest(
      {
        method: 'GET',
        url: '/api/decision-memory',
        headers: {
          authorization: `Bearer ${proUser.token}`,
        },
      },
      { adminClient }
    );

    if (proDecisionApiRes.status !== 200 || !proDecisionApiRes.body.success) {
      throw new Error(`Authorized Pro call to /api/decision-memory failed: ${JSON.stringify(proDecisionApiRes)}`);
    }
    console.log('   ✅ Pro user successfully authorized on /api/decision-memory (status 200).');

  } finally {
    // 4. Cleanup provisioned test users
    console.log('\n9. Cleaning up test accounts:');
    for (const plan of planTiers) {
      if (testUsers[plan]?.id) {
        await adminClient.auth.admin.deleteUser(testUsers[plan].id);
      }
    }
    console.log('   ✅ All test accounts cleaned up.');
  }

  console.log('\n====================================================');
  console.log(' 🎉 ALL TASKLET 9 PERMISSION & SECURITY CHECKS PASSED!');
  console.log('====================================================\n');
}

runPermissionsTestSuite().catch((err) => {
  console.error('\n❌ Permission Test Suite Failed:', err);
  process.exit(1);
});
