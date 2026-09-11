import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import {
  createProject,
  fetchProjects,
  fetchProjectById,
  softDeleteProject
} from '../src/lib/projects/projectClient';
import {
  saveOutput,
  fetchProjectOutputs,
  fetchOutputById,
  softDeleteOutput
} from '../src/lib/outputs/outputClient';
import { ALLOWED_OUTPUT_TYPES, OutputType } from '../src/lib/outputs/types';

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

async function runSoftDeleteTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 11B: SOFT DELETE SYSTEM VERIFICATION SUITE');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const emailA = `softdel-user-a-${timestamp}@concludo-test.local`;
  const emailB = `softdel-user-b-${timestamp}@concludo-test.local`;
  const password = `DelPass!987_${timestamp}`;

  let userAId: string | null = null;
  let userBId: string | null = null;
  let projectAId: string | null = null;
  let projectBId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Setup Test Users
    // -------------------------------------------------------------------------
    console.log('1. Setting up test accounts in Supabase Auth...');

    const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'SoftDelete User Alpha' }
    });
    if (errA || !userAData?.user) throw new Error(`User Alpha creation failed: ${errA?.message}`);
    userAId = userAData.user.id;

    const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'SoftDelete User Beta' }
    });
    if (errB || !userBData?.user) throw new Error(`User Beta creation failed: ${errB?.message}`);
    userBId = userBData.user.id;

    // Set user plans
    await adminClient.from('profiles').update({ plan: 'pro' }).eq('id', userAId);
    await adminClient.from('profiles').update({ plan: 'pro' }).eq('id', userBId);

    // Sign in clients
    const clientAlpha = createClient(supabaseUrl, anonKey);
    const clientBeta = createClient(supabaseUrl, anonKey);

    await clientAlpha.auth.signInWithPassword({ email: emailA, password: password });
    await clientBeta.auth.signInWithPassword({ email: emailB, password: password });

    console.log(`   ✅ User Alpha ready: ${userAId}`);
    console.log(`   ✅ User Beta ready: ${userBId}`);

    // -------------------------------------------------------------------------
    // 2. Create Active Project for User Alpha
    // -------------------------------------------------------------------------
    console.log('\n2. Creating active projects...');
    const projRes = await createProject(clientAlpha, {
      title: 'Q4 Enterprise Strategy Session',
      meeting_type: 'Board Meeting',
      client_or_project: 'Apex Global',
      meeting_date: '2026-09-15'
    });

    if (projRes.error || !projRes.data) {
      throw new Error(`Project creation failed: ${projRes.error?.message}`);
    }
    projectAId = projRes.data.id;
    console.log(`   ✅ Project created: ${projectAId} ("${projRes.data.title}")`);

    // -------------------------------------------------------------------------
    // 3. Test All Supported Output Types + Future Output Types
    // -------------------------------------------------------------------------
    console.log('\n3. Testing all supported output types + future extensible types...');

    const supportedTypes: OutputType[] = [
      'summary',
      'action_items',
      'follow_up_email',
      'decision_log',
      'action_plan',
      'business_plan_draft',
      'workflow_chart',
      'endpoint_report'
    ];

    const createdOutputIds: Record<string, string> = {};

    for (const type of supportedTypes) {
      const outRes = await saveOutput(clientAlpha, {
        project_id: projectAId,
        output_type: type,
        content: `Detailed content record for output type: ${type}`
      });

      if (outRes.error || !outRes.data) {
        throw new Error(`Failed to save output type "${type}": ${outRes.error?.message}`);
      }
      createdOutputIds[type] = outRes.data.id;
      console.log(`   ✅ Supported Output Type "${type}" saved: ${outRes.data.id}`);
    }

    // Test a future extensible output type
    const futureRes = await saveOutput(clientAlpha, {
      project_id: projectAId,
      output_type: 'quarterly_financial_brief',
      content: 'Future extensible output type content.'
    });
    if (futureRes.error || !futureRes.data) {
      throw new Error(`Failed to save future output type: ${futureRes.error?.message}`);
    }
    console.log(`   ✅ Future extensible output type "quarterly_financial_brief" saved: ${futureRes.data.id}`);

    // -------------------------------------------------------------------------
    // 4. Test Output Soft Delete Logic & 30-Day Recovery Metadata
    // -------------------------------------------------------------------------
    console.log('\n4. Testing Output Soft Deletion & 30-day recovery metadata...');
    const targetOutputId = createdOutputIds['summary'];

    const deleteOutputRes = await softDeleteOutput(clientAlpha, targetOutputId);
    if (!deleteOutputRes.success) {
      throw new Error(`Output soft-delete failed: ${deleteOutputRes.error?.message}`);
    }

    // Verify in database: row is preserved (not hard deleted), deleted_at, deleted_by, purge_after populated
    const { data: dbOutput, error: dbOutputErr } = await adminClient
      .from('outputs')
      .select('id, deleted_at, deleted_by, purge_after')
      .eq('id', targetOutputId)
      .single();

    if (dbOutputErr || !dbOutput) {
      throw new Error(`Database check failed: Output row was hard deleted!`);
    }

    if (!dbOutput.deleted_at) {
      throw new Error(`deleted_at was not populated on output!`);
    }
    if (dbOutput.deleted_by !== userAId) {
      throw new Error(`deleted_by expected ${userAId}, got ${dbOutput.deleted_by}`);
    }

    const delTime = new Date(dbOutput.deleted_at).getTime();
    const purgeTime = new Date(dbOutput.purge_after).getTime();
    const diffDays = Math.round((purgeTime - delTime) / (1000 * 60 * 60 * 24));

    if (diffDays < 29 || diffDays > 31) {
      throw new Error(`purge_after retention window expected ~30 days, got ${diffDays} days`);
    }

    console.log(`   ✅ Output soft-deleted: deleted_at=${dbOutput.deleted_at}`);
    console.log(`   ✅ deleted_by=${dbOutput.deleted_by}`);
    console.log(`   ✅ purge_after=${dbOutput.purge_after} (~${diffDays} days recovery window)`);

    // Verify it disappears from normal view queries
    const listOutputsRes = await fetchProjectOutputs(clientAlpha, projectAId);
    const foundInList = listOutputsRes.data?.some((o) => o.id === targetOutputId);
    if (foundInList) {
      throw new Error(`Soft-deleted output STILL APPEARS in fetchProjectOutputs normal view!`);
    }
    console.log('   ✅ Output disappears from fetchProjectOutputs normal view');

    const singleOutputRes = await fetchOutputById(clientAlpha, targetOutputId);
    if (singleOutputRes.data !== null) {
      throw new Error(`Soft-deleted output STILL APPEARS in fetchOutputById normal view!`);
    }
    console.log('   ✅ Output disappears from fetchOutputById normal view');

    // -------------------------------------------------------------------------
    // 5. Test Hard Delete Prevention on Outputs
    // -------------------------------------------------------------------------
    console.log('\n5. Testing client hard-delete prevention on outputs...');
    const { error: hardDelOutputErr } = await clientAlpha
      .from('outputs')
      .delete()
      .eq('id', targetOutputId);

    if (!hardDelOutputErr) {
      throw new Error('Hard delete on outputs should have been blocked by PostgreSQL permissions!');
    }
    console.log(`   ✅ Client hard-delete rejected as expected: ${hardDelOutputErr.message}`);

    // -------------------------------------------------------------------------
    // 6. Test Project Soft Delete Logic & 30-Day Recovery Metadata
    // -------------------------------------------------------------------------
    console.log('\n6. Testing Project Soft Deletion & 30-day recovery metadata...');
    const deleteProjRes = await softDeleteProject(clientAlpha, projectAId);
    if (!deleteProjRes.success) {
      throw new Error(`Project soft delete failed: ${deleteProjRes.error?.message}`);
    }

    // Verify in database: row is preserved (not hard deleted), deleted_at, deleted_by, purge_after populated
    const { data: dbProj, error: dbProjErr } = await adminClient
      .from('projects')
      .select('id, deleted_at, deleted_by, purge_after')
      .eq('id', projectAId)
      .single();

    if (dbProjErr || !dbProj) {
      throw new Error(`Database check failed: Project row was hard deleted!`);
    }

    if (!dbProj.deleted_at) {
      throw new Error(`deleted_at was not populated on project!`);
    }
    if (dbProj.deleted_by !== userAId) {
      throw new Error(`deleted_by expected ${userAId}, got ${dbProj.deleted_by}`);
    }

    const projDelTime = new Date(dbProj.deleted_at).getTime();
    const projPurgeTime = new Date(dbProj.purge_after).getTime();
    const projDiffDays = Math.round((projPurgeTime - projDelTime) / (1000 * 60 * 60 * 24));

    if (projDiffDays < 29 || projDiffDays > 31) {
      throw new Error(`Project purge_after retention window expected ~30 days, got ${projDiffDays} days`);
    }

    console.log(`   ✅ Project soft-deleted: deleted_at=${dbProj.deleted_at}`);
    console.log(`   ✅ deleted_by=${dbProj.deleted_by}`);
    console.log(`   ✅ purge_after=${dbProj.purge_after} (~${projDiffDays} days recovery window)`);

    // Verify it disappears from normal view queries
    const listProjectsRes = await fetchProjects(clientAlpha);
    const projFoundInList = listProjectsRes.data?.some((p) => p.id === projectAId);
    if (projFoundInList) {
      throw new Error(`Soft-deleted project STILL APPEARS in fetchProjects normal view!`);
    }
    console.log('   ✅ Project disappears from fetchProjects normal view');

    const singleProjRes = await fetchProjectById(clientAlpha, projectAId);
    if (singleProjRes.data !== null) {
      throw new Error(`Soft-deleted project STILL APPEARS in fetchProjectById normal view!`);
    }
    console.log('   ✅ Project disappears from fetchProjectById normal view');

    // -------------------------------------------------------------------------
    // 7. Test Hard Delete Prevention on Projects
    // -------------------------------------------------------------------------
    console.log('\n7. Testing client hard-delete prevention on projects...');
    const { error: hardDelProjErr } = await clientAlpha
      .from('projects')
      .delete()
      .eq('id', projectAId);

    if (!hardDelProjErr) {
      throw new Error('Hard delete on projects should have been blocked by PostgreSQL permissions!');
    }
    console.log(`   ✅ Client hard-delete rejected as expected: ${hardDelProjErr.message}`);

    // -------------------------------------------------------------------------
    // 8. Cross-User Isolation on Soft-Deleted Records
    // -------------------------------------------------------------------------
    console.log('\n8. Testing cross-user isolation on soft-deleted records...');
    // User Beta tries to read User Alpha's soft-deleted project
    const { data: betaReadProj } = await clientBeta
      .from('projects')
      .select('*')
      .eq('id', projectAId);

    if (betaReadProj && betaReadProj.length > 0) {
      throw new Error('RLS Breach: User Beta was able to read User Alpha soft-deleted project!');
    }
    console.log('   ✅ User Beta cannot read User Alpha soft-deleted project (RLS strictly enforced)');

    // User Beta tries to update/alter User Alpha's project
    const { data: betaUpdateProj } = await clientBeta
      .from('projects')
      .update({ title: 'Hacked Title' })
      .eq('id', projectAId)
      .select();

    if (betaUpdateProj && betaUpdateProj.length > 0) {
      throw new Error('RLS Breach: User Beta altered User Alpha soft-deleted project!');
    }
    console.log('   ✅ User Beta cannot alter User Alpha soft-deleted project (RLS strictly enforced)');

    console.log('\n========================================================');
    console.log('✅ ALL TASKLET 11B SOFT DELETE TESTS PASSED SUCCESSFULLY');
    console.log('========================================================\n');
  } finally {
    // Cleanup test users
    console.log('Cleaning up test accounts...');
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    console.log('Cleanup complete.');
  }
}

runSoftDeleteTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
