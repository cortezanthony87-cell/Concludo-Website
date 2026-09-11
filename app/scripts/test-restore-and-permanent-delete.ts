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
  fetchOutputById,
  softDeleteOutput,
  fetchDeletedOutputs,
  restoreOutput,
  permanentDeleteOutput
} from '../src/lib/outputs/outputClient';
import { saveTranscript, fetchProjectTranscript } from '../src/lib/transcripts/transcriptClient';

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

async function runRestoreAndPermanentDeleteTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 11D: RESTORE AND PERMANENT DELETE SUITE');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const emailA = `restore-user-a-${timestamp}@concludo-test.local`;
  const emailB = `restore-user-b-${timestamp}@concludo-test.local`;
  const password = 'TestSecurePassword!2026';

  let userAId = '';
  let userBId = '';

  try {
    // 1. Setup Test Users
    console.log('1. Setting up Test Accounts (User Alpha & User Beta)...');
    const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'Alpha Retention QA' }
    });
    if (errA || !authA.user) throw new Error(`Failed to create User Alpha: ${errA?.message}`);
    userAId = authA.user.id;

    const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'Beta Isolation QA' }
    });
    if (errB || !authB.user) throw new Error(`Failed to create User Beta: ${errB?.message}`);
    userBId = authB.user.id;

    // Upgrade both users to Pro so all project/output features are permitted
    await adminClient.from('profiles').update({ plan: 'pro' }).in('id', [userAId, userBId]);

    // Authenticate Supabase clients
    const clientA = createClient(supabaseUrl, anonKey);
    const { error: loginErrA } = await clientA.auth.signInWithPassword({ email: emailA, password });
    if (loginErrA) throw new Error(`User Alpha login failed: ${loginErrA.message}`);

    const clientB = createClient(supabaseUrl, anonKey);
    const { error: loginErrB } = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (loginErrB) throw new Error(`User Beta login failed: ${loginErrB.message}`);

    console.log('   ✅ Both accounts authenticated with isolated client sessions\n');

    // 2. Create Project with Transcript and Outputs
    console.log('2. Creating Project with Transcripts and Outputs for User Alpha...');
    const pRes = await createProject(clientA, {
      title: 'Boardroom Operational Review 2026',
      meeting_type: 'Board Meeting',
      client_or_project: 'Concludo Pty Ltd',
      meeting_date: '2026-09-12'
    });
    if (!pRes.data) throw new Error(`Project creation failed: ${pRes.error?.message}`);
    const projectA = pRes.data;

    // Add Transcript
    const tRes = await saveTranscript(clientA, {
      project_id: projectA.id,
      raw_text: 'Speaker 1: Welcome everyone.\nSpeaker 2: Let us discuss the retention architecture.'
    });
    if (!tRes.data) throw new Error(`Transcript creation failed: ${tRes.error?.message}`);
    const transcriptA = tRes.data;

    // Add Multiple Outputs
    const o1Res = await saveOutput(clientA, {
      project_id: projectA.id,
      output_type: 'summary',
      content: 'Executive summary of boardroom operational review.'
    });
    if (!o1Res.data) throw new Error(`Output 1 creation failed: ${o1Res.error?.message}`);
    const outputA1 = o1Res.data;

    const o2Res = await saveOutput(clientA, {
      project_id: projectA.id,
      output_type: 'action_items',
      content: '1. Complete tasklet 11D\n2. Verify RLS isolation'
    });
    if (!o2Res.data) throw new Error(`Output 2 creation failed: ${o2Res.error?.message}`);
    const outputA2 = o2Res.data;

    console.log(`   ✅ Project created (${projectA.id}) with transcript and 2 outputs\n`);

    // 3. User Beta Creates Separate Project
    console.log('3. Creating Separate Project for User Beta...');
    const pBetaRes = await createProject(clientB, {
      title: 'Beta Confidential Strategy 2026',
      meeting_type: 'Private'
    });
    if (!pBetaRes.data) throw new Error(`Beta project creation failed: ${pBetaRes.error?.message}`);
    const projectBeta = pBetaRes.data;
    console.log(`   ✅ Beta project created (${projectBeta.id})\n`);

    // 4. Soft Delete User Alpha Project
    console.log('4. Executing Soft Delete on User Alpha Project...');
    const softDelRes = await softDeleteProject(clientA, projectA.id);
    if (!softDelRes.success) throw new Error(`Soft delete failed: ${softDelRes.error?.message}`);

    // Verify soft-deleted state
    const postDelProjects = await fetchProjects(clientA);
    if ((postDelProjects.data || []).some((p) => p.id === projectA.id)) {
      throw new Error('Soft-deleted project still appears in normal fetchProjects query');
    }
    const postDelOutputs = await fetchProjectOutputs(clientA, projectA.id);
    if ((postDelOutputs.data || []).length !== 0) {
      throw new Error('Outputs of soft-deleted project still returned by fetchProjectOutputs');
    }
    console.log('   ✅ Soft-deleted project and associated records hidden from normal queries\n');

    // 5. Test Cross-User Isolation: User Beta CANNOT Restore User Alpha Records
    console.log('5. Testing Security Rule: User A cannot restore User B records...');
    const betaRestoreProject = await restoreProject(clientB, projectA.id);
    if (betaRestoreProject.success) {
      throw new Error('SECURITY VIOLATION: User Beta was able to restore User Alpha project!');
    }
    console.log(`   ✅ Cross-user project restore blocked: "${betaRestoreProject.error?.message}"`);

    const betaRestoreOutput = await restoreOutput(clientB, outputA1.id);
    if (betaRestoreOutput.success) {
      throw new Error('SECURITY VIOLATION: User Beta was able to restore User Alpha output!');
    }
    console.log(`   ✅ Cross-user output restore blocked: "${betaRestoreOutput.error?.message}"\n`);

    // 6. Test Cross-User Isolation: User Beta CANNOT Permanently Delete User Alpha Records
    console.log('6. Testing Security Rule: User A cannot permanently delete User B records...');
    const betaPermDelProject = await permanentDeleteProject(clientB, projectA.id);
    if (betaPermDelProject.success) {
      throw new Error('SECURITY VIOLATION: User Beta was able to permanently delete User Alpha project!');
    }
    console.log(`   ✅ Cross-user project permanent delete blocked: "${betaPermDelProject.error?.message}"`);

    const betaPermDelOutput = await permanentDeleteOutput(clientB, outputA1.id);
    if (betaPermDelOutput.success) {
      throw new Error('SECURITY VIOLATION: User Beta was able to permanently delete User Alpha output!');
    }
    console.log(`   ✅ Cross-user output permanent delete blocked: "${betaPermDelOutput.error?.message}"\n`);

    // 7. Test Restore Action for Project and Cascading Reappearance
    console.log('7. Testing Record Restoration (User Alpha restores own project)...');
    const restoreRes = await restoreProject(clientA, projectA.id);
    if (!restoreRes.success) throw new Error(`Project restore failed: ${restoreRes.error?.message}`);

    // Verify fields in database: deleted_at = null, purge_after = null, deleted_by = null
    const { data: dbProj, error: dbProjErr } = await adminClient
      .from('projects')
      .select('id, deleted_at, purge_after, deleted_by')
      .eq('id', projectA.id)
      .single();
    if (dbProjErr || !dbProj) throw new Error(`Failed to fetch project from database: ${dbProjErr?.message}`);

    if (dbProj.deleted_at !== null || dbProj.purge_after !== null || dbProj.deleted_by !== null) {
      throw new Error(
        `Restore failed to clear retention fields: deleted_at=${dbProj.deleted_at}, purge_after=${dbProj.purge_after}, deleted_by=${dbProj.deleted_by}`
      );
    }
    console.log('   ✅ Restored project fields verified: deleted_at=null, purge_after=null, deleted_by=null');

    // Verify Project Immediately Reappears in Normal Views
    console.log('   Verifying immediate return to normal workspace views:');
    // A) Projects List
    const activeProjects = await fetchProjects(clientA);
    const restoredInList = (activeProjects.data || []).find((p) => p.id === projectA.id);
    if (!restoredInList) throw new Error('Restored project does not appear in active projects query');
    console.log('   - Reappeared in Projects (/projects) ✅');

    // B) Project Detail
    const activeDetail = await fetchProjectById(clientA, projectA.id);
    if (!activeDetail.data) throw new Error('Restored project could not be loaded by ID');
    console.log('   - Reappeared in Project Detail (/projects/:id) ✅');

    // C) Transcript Archive
    const activeTranscript = await fetchProjectTranscript(clientA, projectA.id);
    if (!activeTranscript.data) {
      throw new Error('Transcripts did not reappear after project restore');
    }
    console.log('   - Reappeared in Transcript Archive tab ✅');

    // D) Outputs
    const activeOutputs = await fetchProjectOutputs(clientA, projectA.id);
    if ((activeOutputs.data || []).length !== 2) {
      throw new Error(`Expected 2 restored outputs, received ${(activeOutputs.data || []).length}`);
    }
    console.log('   - Reappeared in Outputs tab (2 outputs active) ✅\n');

    // 8. Test Restore of Single Output
    console.log('8. Testing Single Output Soft Delete & Restore...');
    // Soft-delete output 1
    const delSingleOut = await softDeleteOutput(clientA, outputA1.id);
    if (!delSingleOut.success) throw new Error('Failed to soft-delete single output');

    const checkOutDeleted = await fetchProjectOutputs(clientA, projectA.id);
    if ((checkOutDeleted.data || []).some((o) => o.id === outputA1.id)) {
      throw new Error('Soft-deleted output still appears in active project outputs');
    }
    console.log('   ✅ Single output soft-deleted and removed from active list');

    // Restore single output
    const restoreSingleOut = await restoreOutput(clientA, outputA1.id);
    if (!restoreSingleOut.success) throw new Error(`Failed to restore output: ${restoreSingleOut.error?.message}`);

    const { data: dbOut, error: dbOutErr } = await adminClient
      .from('outputs')
      .select('id, deleted_at, purge_after, deleted_by')
      .eq('id', outputA1.id)
      .single();
    if (dbOutErr || !dbOut) throw new Error('Failed to fetch restored output from DB');

    if (dbOut.deleted_at !== null || dbOut.purge_after !== null || dbOut.deleted_by !== null) {
      throw new Error(
        `Output restore failed to clear retention fields: deleted_at=${dbOut.deleted_at}, purge_after=${dbOut.purge_after}`
      );
    }

    const checkOutRestored = await fetchProjectOutputs(clientA, projectA.id);
    if (!(checkOutRestored.data || []).some((o) => o.id === outputA1.id)) {
      throw new Error('Restored output did not reappear in active project outputs');
    }
    console.log('   ✅ Output restored and immediately reappeared: deleted_at=null, purge_after=null\n');

    // 9. Test Permanent Delete System & Active Record Protection Guards
    console.log('9. Testing Permanent Delete System & Active Record Protection Guards...');

    // A) Guard: Cannot permanently delete ACTIVE records
    const invalidPermProj = await permanentDeleteProject(clientA, projectA.id);
    if (invalidPermProj.success) {
      throw new Error('SECURITY VIOLATION: Active project was permanently deleted without soft deletion!');
    }
    console.log(`   ✅ Active project permanent delete prevented: "${invalidPermProj.error?.message}"`);

    const invalidPermOut = await permanentDeleteOutput(clientA, outputA1.id);
    if (invalidPermOut.success) {
      throw new Error('SECURITY VIOLATION: Active output was permanently deleted without soft deletion!');
    }
    console.log(`   ✅ Active output permanent delete prevented: "${invalidPermOut.error?.message}"`);

    // B) Soft-delete output and permanently delete it
    await softDeleteOutput(clientA, outputA1.id);
    const validPermOut = await permanentDeleteOutput(clientA, outputA1.id);
    if (!validPermOut.success) throw new Error(`Permanent delete output failed: ${validPermOut.error?.message}`);

    // Verify output row is truly deleted from DB
    const { data: purgedOut } = await adminClient.from('outputs').select('id').eq('id', outputA1.id).maybeSingle();
    if (purgedOut) {
      throw new Error('Output row still exists in database after permanent delete!');
    }
    console.log('   ✅ Output record permanently purged from database');

    // C) Soft-delete project and permanently delete it
    await softDeleteProject(clientA, projectA.id);
    const validPermProj = await permanentDeleteProject(clientA, projectA.id);
    if (!validPermProj.success) throw new Error(`Permanent delete project failed: ${validPermProj.error?.message}`);

    // Verify project and cascading records are truly deleted from DB
    const { data: purgedProj } = await adminClient.from('projects').select('id').eq('id', projectA.id).maybeSingle();
    if (purgedProj) {
      throw new Error('Project row still exists in database after permanent delete!');
    }

    const { data: purgedTranscripts } = await adminClient
      .from('transcripts')
      .select('id')
      .eq('project_id', projectA.id);
    if ((purgedTranscripts || []).length > 0) {
      throw new Error('Associated transcripts were not permanently purged with project!');
    }

    const { data: purgedOutputs } = await adminClient
      .from('outputs')
      .select('id')
      .eq('project_id', projectA.id);
    if ((purgedOutputs || []).length > 0) {
      throw new Error('Associated outputs were not permanently purged with project!');
    }
    console.log('   ✅ Project and all associated transcripts and outputs permanently purged from database\n');

    console.log('========================================================');
    console.log('🎉 ALL TASKLET 11D TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');
  } finally {
    // Cleanup test users
    console.log('Cleaning up test accounts...');
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    console.log('Cleanup completed.');
  }
}

runRestoreAndPermanentDeleteTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
