import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import {
  createProject,
  fetchProjects,
  fetchProjectById,
  softDeleteProject,
  fetchDeletedProjects,
  restoreProject,
  permanentDeleteProject
} from '../src/lib/projects/projectClient';
import {
  saveOutput,
  fetchProjectOutputs,
  softDeleteOutput,
  fetchDeletedOutputs,
  restoreOutput,
  permanentDeleteOutput
} from '../src/lib/outputs/outputClient';
import { calculateDaysRemaining, formatDaysRemaining } from '../src/lib/retention';

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

async function runRecentlyDeletedTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 11C: RECENTLY DELETED VERIFICATION SUITE');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const emailA = `deleted-user-a-${timestamp}@concludo-test.local`;
  const emailB = `deleted-user-b-${timestamp}@concludo-test.local`;
  const password = 'TestSecurePassword!2026';

  let userAId = '';
  let userBId = '';

  try {
    // 1. Setup Test Users
    console.log('1. Setting up Test Users (User Alpha & User Beta)...');
    const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'Alpha Retention Tester' }
    });
    if (errA || !authA.user) throw new Error(`Failed to create User Alpha: ${errA?.message}`);
    userAId = authA.user.id;

    const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'Beta Isolation Tester' }
    });
    if (errB || !authB.user) throw new Error(`Failed to create User Beta: ${errB?.message}`);
    userBId = authB.user.id;

    // Upgrade User Alpha and Beta to Pro so all features are permitted
    await adminClient.from('profiles').update({ plan: 'pro' }).in('id', [userAId, userBId]);

    // Authenticate Supabase clients
    const clientA = createClient(supabaseUrl, anonKey);
    const { error: loginErrA } = await clientA.auth.signInWithPassword({ email: emailA, password });
    if (loginErrA) throw new Error(`User Alpha login failed: ${loginErrA.message}`);

    const clientB = createClient(supabaseUrl, anonKey);
    const { error: loginErrB } = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (loginErrB) throw new Error(`User Beta login failed: ${loginErrB.message}`);

    console.log('   ✅ Both users authenticated with isolated sessions\n');

    // 2. Empty State Verification
    console.log('2. Verifying Initial Empty State in Recently Deleted...');
    const initDelProjects = await fetchDeletedProjects(clientA);
    const initDelOutputs = await fetchDeletedOutputs(clientA);
    if ((initDelProjects.data || []).length !== 0 || (initDelOutputs.data || []).length !== 0) {
      throw new Error('Expected 0 deleted records for fresh user');
    }
    console.log('   ✅ Empty state verified: 0 deleted projects, 0 deleted outputs\n');

    // 3. Create Projects and Outputs
    console.log('3. Creating Projects and Outputs for User Alpha and User Beta...');
    const p1Res = await createProject(clientA, {
      title: 'Alpha Enterprise Review 2026',
      meeting_type: 'Executive Review',
      client_or_project: 'Acme Corp',
      meeting_date: '2026-09-12'
    });
    if (!p1Res.data) throw new Error(`Failed to create Project 1: ${p1Res.error?.message}`);
    const projectA1 = p1Res.data;

    const p2Res = await createProject(clientA, {
      title: 'Alpha Budget Strategy 2027',
      meeting_type: 'Finance Planning',
      client_or_project: 'Finance Team',
      meeting_date: '2026-09-13'
    });
    if (!p2Res.data) throw new Error(`Failed to create Project 2: ${p2Res.error?.message}`);
    const projectA2 = p2Res.data;

    const out1Res = await saveOutput(clientA, {
      project_id: projectA1.id,
      output_type: 'action_items',
      content: '1. Audit quarterly operational expenditure\n2. Authorise infrastructure upgrades'
    });
    if (!out1Res.data) throw new Error(`Failed to create Output 1: ${out1Res.error?.message}`);
    const outputA1 = out1Res.data;

    const out2Res = await saveOutput(clientA, {
      project_id: projectA1.id,
      output_type: 'summary',
      content: 'Comprehensive executive summary of corporate strategy and objectives.'
    });
    if (!out2Res.data) throw new Error(`Failed to create Output 2: ${out2Res.error?.message}`);
    const outputA2 = out2Res.data;

    // User Beta Project & Output
    const pBetaRes = await createProject(clientB, {
      title: 'Beta Confidential Strategy',
      meeting_type: 'Private'
    });
    if (!pBetaRes.data) throw new Error('Failed to create Project Beta');
    const projectBeta = pBetaRes.data;

    const outBetaRes = await saveOutput(clientB, {
      project_id: projectBeta.id,
      output_type: 'decision_log',
      content: 'Beta secret decision text'
    });
    if (!outBetaRes.data) throw new Error('Failed to create Output Beta');
    const outputBeta = outBetaRes.data;

    console.log('   ✅ Active records created across both test accounts\n');

    // 4. Soft Delete Project & Output
    console.log('4. Executing Soft Delete on Project A1 and Output A1...');
    const delOutRes = await softDeleteOutput(clientA, outputA1.id);
    if (!delOutRes.success) throw new Error(`Failed to soft-delete output: ${delOutRes.error?.message}`);

    const delProjRes = await softDeleteProject(clientA, projectA1.id);
    if (!delProjRes.success) throw new Error(`Failed to soft-delete project: ${delProjRes.error?.message}`);

    console.log('   ✅ Soft delete completed\n');

    // 5. Query Recently Deleted (Verification of Display Fields, Days Remaining, RLS)
    console.log('5. Querying Recently Deleted for User Alpha...');
    const deletedProjectsA = await fetchDeletedProjects(clientA);
    if (deletedProjectsA.error) throw new Error(`Failed to fetch deleted projects: ${deletedProjectsA.error.message}`);
    const deletedList = deletedProjectsA.data || [];

    const foundProject = deletedList.find((p) => p.id === projectA1.id);
    if (!foundProject) throw new Error('Soft-deleted project not found in fetchDeletedProjects');
    console.log(`   ✅ Soft-deleted project found: "${foundProject.title}"`);

    // Verify Days Remaining calculation
    const daysRemaining = calculateDaysRemaining(foundProject.purge_after, foundProject.deleted_at);
    const formattedDays = formatDaysRemaining(daysRemaining);
    console.log(`   ✅ Days remaining calculated: ${daysRemaining} days (${formattedDays})`);
    if (daysRemaining < 28 || daysRemaining > 30) {
      throw new Error(`Unexpected days remaining: ${daysRemaining}`);
    }

    // Query Deleted Outputs
    const deletedOutputsA = await fetchDeletedOutputs(clientA);
    if (deletedOutputsA.error) throw new Error(`Failed to fetch deleted outputs: ${deletedOutputsA.error.message}`);
    const outList = deletedOutputsA.data || [];

    const foundOutput = outList.find((o) => o.id === outputA1.id);
    if (!foundOutput) throw new Error('Soft-deleted output not found in fetchDeletedOutputs');
    console.log(`   ✅ Soft-deleted output found: [${foundOutput.output_type}] in project "${foundOutput.projects?.title}"`);

    // Verify Cross-User Isolation (User Beta must see 0 deleted items)
    console.log('6. Verifying Cross-User RLS Isolation...');
    const deletedProjectsB = await fetchDeletedProjects(clientB);
    const deletedOutputsB = await fetchDeletedOutputs(clientB);
    if ((deletedProjectsB.data || []).length !== 0) {
      throw new Error('RLS VIOLATION: User Beta can see User Alpha deleted projects!');
    }
    if ((deletedOutputsB.data || []).length !== 0) {
      throw new Error('RLS VIOLATION: User Beta can see User Alpha deleted outputs!');
    }
    console.log('   ✅ Cross-user isolation confirmed: User Beta cannot see User Alpha deleted records\n');

    // 7. Verify Restore Flow
    console.log('7. Verifying Restore Flow for Project and Output...');
    // Restore output
    const restoreOutRes = await restoreOutput(clientA, outputA1.id);
    if (!restoreOutRes.success) throw new Error(`Failed to restore output: ${restoreOutRes.error?.message}`);

    // Verify output is removed from Recently Deleted and back in active
    const postRestoreOutputs = await fetchDeletedOutputs(clientA);
    if ((postRestoreOutputs.data || []).some((o) => o.id === outputA1.id)) {
      throw new Error('Restored output still appears in Recently Deleted');
    }
    const activeOutputs = await fetchProjectOutputs(clientA, projectA1.id);
    if (!(activeOutputs.data || []).some((o) => o.id === outputA1.id)) {
      throw new Error('Restored output not found in active project outputs');
    }
    console.log('   ✅ Output successfully restored to active records');

    // Restore project
    const restoreProjRes = await restoreProject(clientA, projectA1.id);
    if (!restoreProjRes.success) throw new Error(`Failed to restore project: ${restoreProjRes.error?.message}`);

    const postRestoreProjects = await fetchDeletedProjects(clientA);
    if ((postRestoreProjects.data || []).some((p) => p.id === projectA1.id)) {
      throw new Error('Restored project still appears in Recently Deleted');
    }
    const activeProjects = await fetchProjects(clientA);
    if (!(activeProjects.data || []).some((p) => p.id === projectA1.id)) {
      throw new Error('Restored project not found in active projects list');
    }
    console.log('   ✅ Project successfully restored to active records\n');

    // 8. Verify Permanent Deletion & Security Guards
    console.log('8. Verifying Permanent Deletion & Security Guards...');
    // A) Try to permanently delete an ACTIVE project (should fail guard)
    const invalidPermDel = await permanentDeleteProject(clientA, projectA2.id);
    if (invalidPermDel.success) {
      throw new Error('SECURITY VIOLATION: Active project was permanently deleted without soft delete!');
    }
    console.log(`   ✅ Active record protection guard verified: "${invalidPermDel.error?.message}"`);

    // B) Soft-delete Project A2, then permanently delete it
    await softDeleteProject(clientA, projectA2.id);
    const validPermDel = await permanentDeleteProject(clientA, projectA2.id);
    if (!validPermDel.success) {
      throw new Error(`Failed to permanently delete project: ${validPermDel.error?.message}`);
    }

    // Verify row is completely removed from database
    const { data: dbCheck } = await adminClient.from('projects').select('id').eq('id', projectA2.id).maybeSingle();
    if (dbCheck) {
      throw new Error('Project was not permanently deleted from Supabase database');
    }
    console.log('   ✅ Soft-deleted project permanently purged from database');

    // C) User Beta attempts to permanently delete User Alpha's project
    const unauthorizedDel = await permanentDeleteProject(clientB, projectA1.id);
    if (unauthorizedDel.success) {
      throw new Error('SECURITY VIOLATION: User Beta was able to permanently delete User Alpha project!');
    }
    console.log(`   ✅ Cross-user permanent delete blocked: "${unauthorizedDel.error?.message}"\n`);

    console.log('========================================================');
    console.log('🎉 ALL TASKLET 11C TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');
  } finally {
    // Cleanup test users
    console.log('Cleaning up test users...');
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    console.log('Cleanup completed.');
  }
}

runRecentlyDeletedTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
