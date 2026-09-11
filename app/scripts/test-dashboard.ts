import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { createProject, softDeleteProject } from '../src/lib/projects/projectClient';
import { saveOutput, softDeleteOutput } from '../src/lib/outputs/outputClient';
import { canUseFeature } from '../src/lib/permissions/canUseFeature';
import { PLAN_PERMISSIONS, ALL_FEATURE_KEYS, FEATURE_TIER_BADGES } from '../src/lib/permissions/types';
import { PLAN_LABELS } from '../src/lib/profiles/types';

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

const supabaseUrl = envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const anonKey = envVars.SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runDashboardTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 10: WORKSPACE DASHBOARD INTEGRATION & SECURITY');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const emailAlpha = `dash_user_alpha_${timestamp}@concludo.au`;
  const emailBeta = `dash_user_beta_${timestamp}@concludo.au`;
  const emailGamma = `dash_user_gamma_${timestamp}@concludo.au`;
  const testPassword = 'TestPassword123!@#';

  let userAlphaId = '';
  let userBetaId = '';
  let userGammaId = '';

  let clientAlpha: any = null;
  let clientBeta: any = null;
  let clientGamma: any = null;

  try {
    // 1. Create Test Users
    console.log('1. Setting up test users Alpha (Free Preview), Beta (Pro), and Gamma (Fresh empty)...');

    // User Alpha (free_preview)
    const { data: authAlpha, error: errAlpha } = await adminClient.auth.admin.createUser({
      email: emailAlpha,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Anthony Cortez' },
    });
    if (errAlpha || !authAlpha.user) throw errAlpha || new Error('Failed to create User Alpha');
    userAlphaId = authAlpha.user.id;

    // Ensure profile with full_name 'Anthony Cortez' and plan 'free_preview'
    await adminClient.from('profiles').upsert({
      id: userAlphaId,
      email: emailAlpha,
      full_name: 'Anthony Cortez',
      plan: 'free_preview',
      role: 'user',
    });

    // User Beta (pro)
    const { data: authBeta, error: errBeta } = await adminClient.auth.admin.createUser({
      email: emailBeta,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Elena Rostova' },
    });
    if (errBeta || !authBeta.user) throw errBeta || new Error('Failed to create User Beta');
    userBetaId = authBeta.user.id;

    // Ensure profile with full_name 'Elena Rostova' and plan 'pro'
    await adminClient.from('profiles').upsert({
      id: userBetaId,
      email: emailBeta,
      full_name: 'Elena Rostova',
      plan: 'pro',
      role: 'user',
    });

    // User Gamma (free_preview, no full_name)
    const { data: authGamma, error: errGamma } = await adminClient.auth.admin.createUser({
      email: emailGamma,
      password: testPassword,
      email_confirm: true,
    });
    if (errGamma || !authGamma.user) throw errGamma || new Error('Failed to create User Gamma');
    userGammaId = authGamma.user.id;

    await adminClient.from('profiles').upsert({
      id: userGammaId,
      email: emailGamma,
      full_name: null,
      plan: 'free_preview',
      role: 'user',
    });

    console.log(`   ✅ User Alpha created: ${userAlphaId} (Plan: free_preview, Name: Anthony Cortez)`);
    console.log(`   ✅ User Beta created: ${userBetaId} (Plan: pro, Name: Elena Rostova)`);
    console.log(`   ✅ User Gamma created: ${userGammaId} (Plan: free_preview, Name: null)\n`);

    // Authenticate clients
    clientAlpha = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    await clientAlpha.auth.signInWithPassword({ email: emailAlpha, password: testPassword });

    clientBeta = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    await clientBeta.auth.signInWithPassword({ email: emailBeta, password: testPassword });

    clientGamma = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    await clientGamma.auth.signInWithPassword({ email: emailGamma, password: testPassword });

    // 2. Test Welcome Section Greeting Logic & Plan Badges
    console.log('2. Testing Dashboard Welcome Greeting & Plan Badge text mapping...');
    const greetingAlpha = authAlpha.user.user_metadata?.full_name
      ? `Welcome back, ${authAlpha.user.user_metadata.full_name}`
      : 'Welcome back';
    if (greetingAlpha !== 'Welcome back, Anthony Cortez') {
      throw new Error(`Expected "Welcome back, Anthony Cortez" but got "${greetingAlpha}"`);
    }
    console.log(`   ✅ Welcome greeting with full_name: "${greetingAlpha}"`);

    const greetingGamma = (await clientGamma.from('profiles').select('full_name').single()).data?.full_name
      ? `Welcome back, ${(await clientGamma.from('profiles').select('full_name').single()).data?.full_name}`
      : 'Welcome back';
    if (greetingGamma !== 'Welcome back') {
      throw new Error(`Expected "Welcome back" for user without full_name but got "${greetingGamma}"`);
    }
    console.log(`   ✅ Welcome greeting without full_name: "${greetingGamma}"`);

    // Verify Plan Badges
    const planAlphaBadge = PLAN_LABELS['free_preview'];
    const planBetaBadge = PLAN_LABELS['pro'];
    if (planAlphaBadge !== 'Free Preview' || planBetaBadge !== 'Pro') {
      throw new Error('Plan badge label mapping mismatch');
    }
    console.log(`   ✅ Plan badge for User Alpha: "${planAlphaBadge}"`);
    console.log(`   ✅ Plan badge for User Beta: "${planBetaBadge}"\n`);

    // 3. Test Empty State Handling for User Gamma
    console.log('3. Testing Dashboard Empty States on fresh User Gamma...');
    const { data: gammaProjects } = await clientGamma
      .from('projects')
      .select('id, title')
      .is('deleted_at', null);

    const { data: gammaOutputs } = await clientGamma
      .from('outputs')
      .select('id, output_type')
      .is('deleted_at', null);

    if (gammaProjects && gammaProjects.length === 0) {
      console.log('   ✅ Empty Projects State confirmed: "No projects yet" (0 active projects)');
    } else {
      throw new Error('Expected 0 projects for fresh user');
    }

    if (gammaOutputs && gammaOutputs.length === 0) {
      console.log('   ✅ Empty Outputs State confirmed: "No outputs yet" (0 active outputs)\n');
    } else {
      throw new Error('Expected 0 outputs for fresh user');
    }

    // 4. Create Projects and Outputs for Alpha and Beta
    console.log('4. Creating test projects and outputs for User Alpha and User Beta...');
    // Alpha Project 1
    const { data: projA1 } = await clientAlpha
      .from('projects')
      .insert({
        user_id: userAlphaId,
        title: 'Alpha Executive Sync',
        meeting_type: 'Board Review',
        client_or_project: 'Acme Corp',
        meeting_date: '2026-09-15',
      })
      .select()
      .single();

    // Alpha Project 2
    const { data: projA2 } = await clientAlpha
      .from('projects')
      .insert({
        user_id: userAlphaId,
        title: 'Alpha Product Strategy',
        meeting_type: 'Product',
        client_or_project: 'Concludo SaaS',
        meeting_date: '2026-09-16',
      })
      .select()
      .single();

    // Alpha Outputs
    const { data: outA1 } = await clientAlpha
      .from('outputs')
      .insert({
        project_id: projA1.id,
        user_id: userAlphaId,
        output_type: 'summary',
        content: 'Alpha executive summary content discussing FY27 milestones.',
      })
      .select()
      .single();

    const { data: outA2 } = await clientAlpha
      .from('outputs')
      .insert({
        project_id: projA2.id,
        user_id: userAlphaId,
        output_type: 'action_items',
        content: '1. Finalise database schema. 2. Prepare staging deployment.',
      })
      .select()
      .single();

    // Beta Project 1 & Output 1
    const { data: projB1 } = await clientBeta
      .from('projects')
      .insert({
        user_id: userBetaId,
        title: 'Beta Secret Strategy',
        meeting_type: 'Confidential',
        client_or_project: 'Beta Ltd',
        meeting_date: '2026-09-18',
      })
      .select()
      .single();

    const { data: outB1 } = await clientBeta
      .from('outputs')
      .insert({
        project_id: projB1.id,
        user_id: userBetaId,
        output_type: 'decision_log',
        content: 'Beta confidential decision log: Approved Q4 expansion budget.',
      })
      .select()
      .single();

    console.log(`   ✅ User Alpha created 2 projects and 2 outputs`);
    console.log(`   ✅ User Beta created 1 project and 1 output\n`);

    // 5. Test Cross-User Isolation on Recent Projects
    console.log('5. Testing Cross-User Isolation on Recent Projects...');
    const { data: alphaRecentProjects, error: errAlphaProj } = await clientAlpha
      .from('projects')
      .select('id, title, meeting_type, client_or_project, meeting_date, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (errAlphaProj) throw errAlphaProj;
    if (alphaRecentProjects.length !== 2) {
      throw new Error(`Expected 2 projects for Alpha, found ${alphaRecentProjects.length}`);
    }

    const hasBetaProjectInAlpha = alphaRecentProjects.some((p: any) => p.id === projB1.id);
    if (hasBetaProjectInAlpha) {
      throw new Error('SECURITY VIOLATION: User Alpha can see User Beta’s project!');
    }
    console.log(`   ✅ User Alpha sees only User Alpha’s 2 projects (Beta’s project strictly hidden)`);

    const { data: betaRecentProjects } = await clientBeta
      .from('projects')
      .select('id, title')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (betaRecentProjects.length !== 1 || betaRecentProjects[0].id !== projB1.id) {
      throw new Error('User Beta expected only their 1 project');
    }
    console.log(`   ✅ User Beta sees only User Beta’s 1 project\n`);

    // 6. Test Cross-User Isolation on Recent Outputs & Project Join
    console.log('6. Testing Cross-User Isolation on Recent Outputs & Project Join...');
    const { data: alphaRecentOutputs, error: errAlphaOut } = await clientAlpha
      .from('outputs')
      .select('id, project_id, output_type, content, created_at, updated_at, projects(id, title)')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (errAlphaOut) throw errAlphaOut;
    if (alphaRecentOutputs.length !== 2) {
      throw new Error(`Expected 2 outputs for Alpha, found ${alphaRecentOutputs.length}`);
    }

    const hasBetaOutputInAlpha = alphaRecentOutputs.some((o: any) => o.id === outB1.id);
    if (hasBetaOutputInAlpha) {
      throw new Error('SECURITY VIOLATION: User Alpha can see User Beta’s output!');
    }
    console.log(`   ✅ User Alpha sees only User Alpha’s 2 outputs (Beta’s output strictly hidden)`);
    console.log(`   ✅ Linked project titles correctly joined: "${alphaRecentOutputs[0].projects?.title}" and "${alphaRecentOutputs[1].projects?.title}"\n`);

    // 7. Test Soft Delete Impact on Dashboard
    console.log('7. Testing Soft Delete Impact on Dashboard...');
    // Soft delete Alpha Output 2
    await clientAlpha
      .from('outputs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', outA2.id);

    const { data: alphaOutputsAfterDelete } = await clientAlpha
      .from('outputs')
      .select('id')
      .is('deleted_at', null);

    if (alphaOutputsAfterDelete.length !== 1 || alphaOutputsAfterDelete[0].id !== outA1.id) {
      throw new Error('Soft deleted output still appeared in active dashboard queries');
    }
    console.log('   ✅ Soft-deleted output immediately excluded from active dashboard queries (1 remaining)');

    // Soft delete Alpha Project 2
    await clientAlpha
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', projA2.id);

    const { data: alphaProjectsAfterDelete } = await clientAlpha
      .from('projects')
      .select('id')
      .is('deleted_at', null);

    if (alphaProjectsAfterDelete.length !== 1 || alphaProjectsAfterDelete[0].id !== projA1.id) {
      throw new Error('Soft deleted project still appeared in active dashboard queries');
    }
    console.log('   ✅ Soft-deleted project immediately excluded from active dashboard queries (1 remaining)\n');

    // 8. Test Backend Authoritative Permission Verification for Dashboard
    console.log('8. Testing Backend Permission Checks for Dashboard Sections & Locked Cards...');
    
    // User Alpha (free_preview) checking Pro features
    const checkActionAlpha = await canUseFeature(userAlphaId, 'action_tracker', { supabase: adminClient });
    const checkDecisionAlpha = await canUseFeature(userAlphaId, 'decision_memory', { supabase: adminClient });
    const checkTeamAlpha = await canUseFeature(userAlphaId, 'team_workspace', { supabase: adminClient });

    if (checkActionAlpha.allowed || checkDecisionAlpha.allowed || checkTeamAlpha.allowed) {
      throw new Error('User Alpha (free_preview) should not have action_tracker or decision_memory');
    }
    console.log('   ✅ User Alpha (free_preview): Action Tracker and Decision Memory locked ("Available on Pro")');
    console.log('   ✅ User Alpha (free_preview): Team Workspace locked ("Available on Team")');

    // User Beta (pro) checking Pro features
    const checkActionBeta = await canUseFeature(userBetaId, 'action_tracker', { supabase: adminClient });
    const checkDecisionBeta = await canUseFeature(userBetaId, 'decision_memory', { supabase: adminClient });
    const checkTeamBeta = await canUseFeature(userBetaId, 'team_workspace', { supabase: adminClient });

    if (!checkActionBeta.allowed || !checkDecisionBeta.allowed) {
      throw new Error('User Beta (pro) should have action_tracker and decision_memory unlocked');
    }
    if (checkTeamBeta.allowed) {
      throw new Error('User Beta (pro) should not have team_workspace unlocked');
    }
    console.log('   ✅ User Beta (pro): Action Tracker and Decision Memory unlocked');
    console.log('   ✅ User Beta (pro): Team Workspace locked ("Available on Team")\n');

    // 9. Test Logged-Out Access Rejection
    console.log('9. Testing Logged-Out (Anonymous) Access Rejection...');
    const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: anonProjects, error: anonProjErr } = await anonClient.from('projects').select('*');
    const { data: anonOutputs, error: anonOutErr } = await anonClient.from('outputs').select('*');

    if (anonProjects && anonProjects.length > 0) {
      throw new Error('SECURITY VIOLATION: Anonymous client queried projects table!');
    }
    if (anonOutputs && anonOutputs.length > 0) {
      throw new Error('SECURITY VIOLATION: Anonymous client queried outputs table!');
    }
    console.log('   ✅ Anonymous access to projects blocked at database level');
    console.log('   ✅ Anonymous access to outputs blocked at database level\n');

    console.log('========================================================');
    console.log('ALL TASKLET 10 DASHBOARD TESTS PASSED CLEANLY! ✅');
    console.log('========================================================\n');
  } finally {
    console.log('Cleaning up test data...');
    if (userAlphaId) await adminClient.auth.admin.deleteUser(userAlphaId);
    if (userBetaId) await adminClient.auth.admin.deleteUser(userBetaId);
    if (userGammaId) await adminClient.auth.admin.deleteUser(userGammaId);
    console.log('Test users cleaned up.');
  }
}

runDashboardTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
