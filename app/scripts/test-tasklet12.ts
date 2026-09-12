import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { canUseFeature, hasFeature } from '../src/lib/permissions/canUseFeature';
import {
  ALL_FEATURE_KEYS,
  PLAN_PERMISSIONS,
  PlanType,
  FeatureKey,
} from '../src/lib/permissions/types';
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

process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function runTasklet12TestSuite() {
  console.log('================================================================');
  console.log('TASKLET 12: AUTHENTICATION, ACCOUNTS, TIERS & TRIALS SUITE');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testPassword = `ConcludoSecure!Pass8_${timestamp}`;

  // 1. Account Creation & Automatic Profile Provisioning
  console.log('--- 1. Testing Account Creation & Automatic Profile Provisioning ---');
  const userEmail = `auth-test-${timestamp}@concludo-qa.local`;
  const { data: createdAuth, error: createError } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Arthur Pendelton' },
  });

  if (createError || !createdAuth.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`);
  }

  const userId = createdAuth.user.id;
  console.log(`✅ Test user created: ${userEmail} (${userId})`);

  // Verify profile auto-created via DB trigger
  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileErr || !profile) {
    throw new Error(`Profile was not automatically created for user: ${profileErr?.message}`);
  }

  if (profile.plan !== 'free_preview') {
    throw new Error(`Expected default plan free_preview, got ${profile.plan}`);
  }
  if (profile.full_name !== 'Arthur Pendelton') {
    throw new Error(`Expected full_name 'Arthur Pendelton', got ${profile.full_name}`);
  }
  console.log('✅ Profile record automatically created by database trigger with plan=free_preview');

  // Verify user with null full_name defaults to null
  const nullNameEmail = `null-name-${timestamp}@concludo-qa.local`;
  const { data: nullUser } = await adminClient.auth.admin.createUser({
    email: nullNameEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (nullUser.user) {
    const { data: nullProf } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', nullUser.user.id)
      .single();
    if (nullProf?.full_name !== null) {
      throw new Error(`Expected full_name to be null, got: ${nullProf?.full_name}`);
    }
    console.log('✅ User created without full_name defaults to null in profiles');
  }

  // 2. Sign In, Session Persistence & Sign Out
  console.log('\n--- 2. Testing Sign In, Session Persistence & Sign Out ---');
  const userClient = createClient(supabaseUrl, anonKey);
  const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
    email: userEmail,
    password: testPassword,
  });

  if (signInError || !signInData.session) {
    throw new Error(`Failed to sign in: ${signInError?.message}`);
  }
  const sessionToken = signInData.session.access_token;
  console.log('✅ User successfully signed in with email/password');

  // Session persistence check
  const { data: sessionUser, error: tokenErr } = await userClient.auth.getUser(sessionToken);
  if (tokenErr || sessionUser.user?.id !== userId) {
    throw new Error(`Session persistence failed: ${tokenErr?.message}`);
  }
  console.log('✅ Session persistent and verifiable via Bearer token');

  // Sign out check
  const { error: signOutErr } = await userClient.auth.signOut();
  if (signOutErr) {
    throw new Error(`Sign out failed: ${signOutErr.message}`);
  }
  console.log('✅ User signed out cleanly');

  // 3. Password Reset Flow
  console.log('\n--- 3. Testing Password Reset Flow ---');
  const { error: resetErr } = await anonClient.auth.resetPasswordForEmail(userEmail);
  if (resetErr && !resetErr.message.toLowerCase().includes('rate limit')) {
    throw new Error(`Password reset email request failed: ${resetErr.message}`);
  }
  console.log('✅ Password reset email request dispatched (or rate limit caught)');

  // Update password via admin
  const newPassword = `NewSecuredPass!9_${timestamp}`;
  const { error: updatePassErr } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (updatePassErr) {
    throw new Error(`Failed to update password: ${updatePassErr.message}`);
  }

  // Confirm sign in with new password
  const { data: reauthData, error: reauthErr } = await userClient.auth.signInWithPassword({
    email: userEmail,
    password: newPassword,
  });
  if (reauthErr || !reauthData.session) {
    throw new Error(`Failed to sign in with new password: ${reauthErr?.message}`);
  }
  const activeToken = reauthData.session.access_token;
  console.log('✅ User successfully authenticated with updated password');

  // 4. Trial Support (starter_trial & pro_trial storage)
  console.log('\n--- 4. Testing Trial Storage on Profiles ---');
  const trialStart = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: trialUpdateErr } = await adminClient
    .from('profiles')
    .update({
      plan: 'pro_trial',
      trial_start_date: trialStart,
      trial_end_date: trialEnd,
    })
    .eq('id', userId);

  if (trialUpdateErr) {
    throw new Error(`Failed to set trial fields on profile: ${trialUpdateErr.message}`);
  }

  const { data: trialProfile } = await adminClient
    .from('profiles')
    .select('plan, trial_start_date, trial_end_date')
    .eq('id', userId)
    .single();

  if (
    trialProfile?.plan !== 'pro_trial' ||
    !trialProfile?.trial_start_date ||
    !trialProfile?.trial_end_date
  ) {
    throw new Error('Trial dates not properly stored on profile');
  }
  console.log(`✅ Trial dates successfully stored: plan=pro_trial, end=${trialProfile.trial_end_date}`);

  // Test that regular user cannot alter trial dates directly
  const { error: userTrialHackingErr } = await userClient
    .from('profiles')
    .update({ trial_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', userId);

  if (!userTrialHackingErr) {
    throw new Error('Security violation: User was able to alter trial_end_date directly!');
  }
  console.log('✅ Security guard verified: Client update on trial_end_date rejected by PostgreSQL');

  // 5. Authoritative Backend Permission System (hasFeature & canUseFeature)
  console.log('\n--- 5. Testing Authoritative Backend Permission System ---');

  const testPlans: PlanType[] = ['free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'admin'];

  for (const plan of testPlans) {
    await adminClient.from('profiles').update({ plan }).eq('id', userId);

    const hasBasic = await hasFeature(userId, 'workspace_basic', { supabase: adminClient });
    const hasMemory = await hasFeature(userId, 'decision_memory', { supabase: adminClient });
    const hasMeetingMemory = await hasFeature(userId, 'meeting_memory', { supabase: adminClient });
    const hasTeam = await hasFeature(userId, 'team_workspace', { supabase: adminClient });
    const hasAdmin = await hasFeature(userId, 'admin_dashboard', { supabase: adminClient });

    // Database RPC parity check
    const { data: rpcBasic } = await adminClient.rpc('has_feature', {
      p_user_id: userId,
      p_feature_key: 'workspace_basic',
    });
    const { data: rpcAdmin } = await adminClient.rpc('has_feature', {
      p_user_id: userId,
      p_feature_key: 'admin_dashboard',
    });

    if (hasBasic !== rpcBasic || hasAdmin !== rpcAdmin) {
      throw new Error(`RPC and TypeScript permission mismatch for plan ${plan}`);
    }

    if (plan === 'free_preview') {
      if (!hasBasic || hasMemory || hasTeam || hasAdmin) {
        throw new Error(`free_preview permissions failed: basic=${hasBasic}, memory=${hasMemory}`);
      }
      console.log('✅ Plan free_preview: Allowed workspace_basic only; intelligence/team locked');
    } else if (plan === 'starter' || plan === 'starter_trial') {
      if (!hasBasic || hasMemory || hasTeam || hasAdmin) {
        throw new Error(`${plan} permissions failed: basic=${hasBasic}, memory=${hasMemory}`);
      }
      console.log(`✅ Plan ${plan}: Allowed workspace_basic; memory & team locked`);
    } else if (plan === 'pro' || plan === 'pro_trial') {
      if (!hasBasic || !hasMemory || !hasMeetingMemory || hasTeam || hasAdmin) {
        throw new Error(`${plan} permissions failed: memory=${hasMemory}, team=${hasTeam}`);
      }
      console.log(`✅ Plan ${plan}: Allowed workspace_basic & meeting_memory; team/admin locked`);
    } else if (plan === 'team') {
      if (!hasBasic || !hasMemory || !hasTeam || hasAdmin) {
        throw new Error(`team permissions failed: team=${hasTeam}, admin=${hasAdmin}`);
      }
      console.log('✅ Plan team: Allowed team_workspace; admin locked');
    } else if (plan === 'admin') {
      if (!hasBasic || !hasMemory || !hasTeam || !hasAdmin) {
        throw new Error(`admin permissions failed: admin=${hasAdmin}`);
      }
      console.log('✅ Plan admin: Allowed all features including admin_dashboard');
    }
  }

  // 6. Cross-User Data Isolation & RLS Review
  console.log('\n--- 6. Testing Cross-User Data Isolation & RLS Review ---');
  // Create User Beta
  const betaEmail = `user-beta-${timestamp}@concludo-qa.local`;
  const { data: betaAuth } = await adminClient.auth.admin.createUser({
    email: betaEmail,
    password: testPassword,
    email_confirm: true,
  });
  const betaId = betaAuth.user!.id;
  const betaClient = createClient(supabaseUrl, anonKey);
  const { data: betaSignIn } = await betaClient.auth.signInWithPassword({
    email: betaEmail,
    password: testPassword,
  });
  const betaToken = betaSignIn.session!.access_token;

  // Set User Alpha to Pro to create project
  await adminClient.from('profiles').update({ plan: 'pro' }).eq('id', userId);

  // User Alpha creates Project
  const { data: alphaProject, error: projErr } = await userClient
    .from('projects')
    .insert({
      user_id: userId,
      title: 'Strategic Acquisition Q4',
      meeting_type: 'Board Meeting',
    })
    .select()
    .single();

  if (projErr || !alphaProject) {
    throw new Error(`Failed to create alpha project: ${projErr?.message}`);
  }

  // User Alpha creates Output
  const { data: alphaOutput, error: outErr } = await userClient
    .from('outputs')
    .insert({
      user_id: userId,
      project_id: alphaProject.id,
      output_type: 'decision_log',
      content: 'Unanimously approved M&A due diligence roadmap.',
    })
    .select()
    .single();

  if (outErr || !alphaOutput) {
    throw new Error(`Failed to create alpha output: ${outErr?.message}`);
  }
  console.log('✅ User Alpha created Project & Output records');

  // User Beta tries to read User Alpha project
  const { data: betaReadProj } = await betaClient
    .from('projects')
    .select('*')
    .eq('id', alphaProject.id);

  if (betaReadProj && betaReadProj.length > 0) {
    throw new Error('RLS VIOLATION: User Beta read User Alpha project!');
  }

  // User Beta tries to read User Alpha output
  const { data: betaReadOut } = await betaClient
    .from('outputs')
    .select('*')
    .eq('id', alphaOutput.id);

  if (betaReadOut && betaReadOut.length > 0) {
    throw new Error('RLS VIOLATION: User Beta read User Alpha output!');
  }
  console.log('✅ RLS Confirmed: User Beta queries for User Alpha data return 0 rows');

  // Unauthenticated client queries
  const { data: anonRead } = await anonClient.from('projects').select('*');
  if (anonRead && anonRead.length > 0) {
    throw new Error('RLS VIOLATION: Anon client read projects!');
  }
  console.log('✅ RLS Confirmed: Unauthenticated requests completely blocked from table data');

  // 7. Retention System from Tasklet 11
  console.log('\n--- 7. Verifying Retention System from Tasklet 11 ---');
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Soft delete Alpha output
  const { error: softDelErr } = await userClient
    .from('outputs')
    .update({
      deleted_at: now.toISOString(),
      deleted_by: userId,
      purge_after: purgeAfter.toISOString(),
    })
    .eq('id', alphaOutput.id);

  if (softDelErr) {
    throw new Error(`Failed to soft-delete output: ${softDelErr.message}`);
  }

  // Active query excludes deleted output
  const { data: activeOutputs } = await userClient
    .from('outputs')
    .select('*')
    .eq('project_id', alphaProject.id)
    .is('deleted_at', null);

  if (activeOutputs && activeOutputs.length > 0) {
    throw new Error('Soft-deleted output appeared in active query!');
  }

  // Recently deleted query includes it
  const { data: deletedOutputs } = await userClient
    .from('outputs')
    .select('*')
    .eq('id', alphaOutput.id)
    .not('deleted_at', 'is', null);

  if (!deletedOutputs || deletedOutputs.length === 0) {
    throw new Error('Soft-deleted output not found in Recently Deleted query!');
  }
  console.log('✅ Soft-deleted output excluded from active views and present in Recently Deleted');

  // Restore output via restore_output RPC
  const { error: restoreErr } = await userClient.rpc('restore_output', {
    p_output_id: alphaOutput.id,
  });
  if (restoreErr) {
    throw new Error(`Failed to restore output: ${restoreErr.message}`);
  }

  // Active query includes restored output
  const { data: restoredOutputs } = await userClient
    .from('outputs')
    .select('*')
    .eq('id', alphaOutput.id)
    .is('deleted_at', null);

  if (!restoredOutputs || restoredOutputs.length === 0) {
    throw new Error('Restored output did not return to active views!');
  }
  console.log('✅ Restored output immediately returned to active views (deleted_at=null)');

  // 8. Server-Side API Router Endpoints
  console.log('\n--- 8. Testing Server-Side API Router Endpoints ---');

  // Test POST /api/features/has with valid session
  const apiHasRes = await handleApiRequest(
    {
      method: 'POST',
      url: '/api/features/has',
      headers: { authorization: `Bearer ${activeToken}` },
      body: { feature: 'workspace_basic' },
    },
    { adminClient }
  );

  if (apiHasRes.status !== 200 || !apiHasRes.body.hasFeature) {
    throw new Error(`POST /api/features/has failed: ${JSON.stringify(apiHasRes)}`);
  }
  console.log('✅ POST /api/features/has returned 200 with hasFeature=true');

  // Test POST /api/features/has with invalid feature key
  const invalidHasRes = await handleApiRequest(
    {
      method: 'POST',
      url: '/api/features/has',
      headers: { authorization: `Bearer ${activeToken}` },
      body: { feature: 'non_existent_feature_123' },
    },
    { adminClient }
  );

  if (invalidHasRes.status !== 400 || invalidHasRes.body.error !== 'invalid_feature_key') {
    throw new Error(`Expected 400 for invalid feature key, got: ${JSON.stringify(invalidHasRes)}`);
  }
  console.log('✅ POST /api/features/has returned 400 with invalid_feature_key error');

  // Test POST /api/features/check with locked feature
  // Set user to free_preview
  await adminClient.from('profiles').update({ plan: 'free_preview' }).eq('id', userId);

  const apiCheckRes = await handleApiRequest(
    {
      method: 'POST',
      url: '/api/features/check',
      headers: { authorization: `Bearer ${activeToken}` },
      body: { feature: 'decision_memory' },
    },
    { adminClient }
  );

  if (apiCheckRes.status !== 403 || apiCheckRes.body.error !== 'feature_not_available') {
    throw new Error(`POST /api/features/check did not return 403 Forbidden: ${JSON.stringify(apiCheckRes)}`);
  }
  console.log('✅ POST /api/features/check returned 403 Forbidden with exact required payload');

  // Test Unauthenticated API Request
  const unauthRes = await handleApiRequest(
    {
      method: 'POST',
      url: '/api/features/check',
      headers: {},
      body: { feature: 'workspace_basic' },
    },
    { adminClient }
  );

  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
  }
  console.log('✅ Unauthenticated API request rejected with 401 Unauthorized');

  // Clean up test users
  await adminClient.auth.admin.deleteUser(userId);
  await adminClient.auth.admin.deleteUser(betaId);
  if (nullUser?.user?.id) {
    await adminClient.auth.admin.deleteUser(nullUser.user.id);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL TASKLET 12 TEST SUITE ASSERTIONS PASSED WITH 100% SUCCESS');
  console.log('================================================================\n');
}

runTasklet12TestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
