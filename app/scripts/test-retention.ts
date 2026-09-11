import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { createProject, fetchProjects, softDeleteProject } from '../src/lib/projects/projectClient';
import { saveOutput, fetchProjectOutputs, softDeleteOutput } from '../src/lib/outputs/outputClient';

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

async function runRetentionTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 11A: DATA RETENTION & LIFECYCLE TEST SUITE');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const emailA = `retention-user-a-${timestamp}@concludo-test.local`;
  const emailB = `retention-user-b-${timestamp}@concludo-test.local`;
  const password = `RetPass!987_${timestamp}`;

  let userAId: string | null = null;
  let userBId: string | null = null;
  let projectAId: string | null = null;
  let outputAId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Setup Test Users
    // -------------------------------------------------------------------------
    console.log('1. Setting up test users Alpha and Beta...');
    const { data: uA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Retention User Alpha' }
    });
    if (errA || !uA.user) throw new Error(`User Alpha creation failed: ${errA?.message}`);
    userAId = uA.user.id;

    const { data: uB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Retention User Beta' }
    });
    if (errB || !uB.user) throw new Error(`User Beta creation failed: ${errB?.message}`);
    userBId = uB.user.id;

    // Give User A and B 'pro' plan so they have full feature permissions
    await adminClient.from('profiles').update({ plan: 'pro' }).in('id', [userAId, userBId]);

    // Create client for User A
    const clientA = createClient(supabaseUrl, anonKey);
    const { error: signinAError } = await clientA.auth.signInWithPassword({
      email: emailA,
      password
    });
    if (signinAError) throw new Error(`User A signin failed: ${signinAError.message}`);

    // Create client for User B
    const clientB = createClient(supabaseUrl, anonKey);
    const { error: signinBError } = await clientB.auth.signInWithPassword({
      email: emailB,
      password
    });
    if (signinBError) throw new Error(`User B signin failed: ${signinBError.message}`);

    console.log('   ✅ Test users Alpha and Beta authenticated successfully\n');

    // -------------------------------------------------------------------------
    // 2. Active Records Default Test: Projects & Outputs
    // -------------------------------------------------------------------------
    console.log('2. Testing active record defaults (deleted_at, deleted_by, purge_after)...');
    
    // Create project as User A
    const { data: newProject, error: projErr } = await createProject(clientA, {
      title: 'Active Retention Test Project',
      meeting_type: 'Executive Review',
      client_or_project: 'Acme Holdings'
    });
    if (projErr || !newProject) throw new Error(`Project creation failed: ${projErr?.message}`);
    projectAId = newProject.id;

    // Verify active project in database via admin client
    const { data: rawProj, error: rawProjErr } = await adminClient
      .from('projects')
      .select('id, user_id, title, deleted_at, deleted_by, purge_after')
      .eq('id', projectAId)
      .single();
    if (rawProjErr || !rawProj) throw new Error(`Fetch raw project failed: ${rawProjErr?.message}`);

    if (rawProj.deleted_at !== null) throw new Error(`Expected deleted_at=null on active project, got: ${rawProj.deleted_at}`);
    if (rawProj.deleted_by !== null) throw new Error(`Expected deleted_by=null on active project, got: ${rawProj.deleted_by}`);
    if (rawProj.purge_after !== null) throw new Error(`Expected purge_after=null on active project, got: ${rawProj.purge_after}`);
    console.log('   ✅ Active project defaults verified: deleted_at=null, deleted_by=null, purge_after=null');

    // Create output as User A
    const { data: newOutput, error: outErr } = await saveOutput(clientA, {
      project_id: projectAId,
      output_type: 'summary',
      content: 'This is an executive meeting summary subject to 30-day retention upon deletion.'
    });
    if (outErr || !newOutput) throw new Error(`Output creation failed: ${outErr?.message}`);
    outputAId = newOutput.id;

    // Verify active output in database via admin client
    const { data: rawOut, error: rawOutErr } = await adminClient
      .from('outputs')
      .select('id, user_id, project_id, deleted_at, deleted_by, purge_after')
      .eq('id', outputAId)
      .single();
    if (rawOutErr || !rawOut) throw new Error(`Fetch raw output failed: ${rawOutErr?.message}`);

    if (rawOut.deleted_at !== null) throw new Error(`Expected deleted_at=null on active output, got: ${rawOut.deleted_at}`);
    if (rawOut.deleted_by !== null) throw new Error(`Expected deleted_by=null on active output, got: ${rawOut.deleted_by}`);
    if (rawOut.purge_after !== null) throw new Error(`Expected purge_after=null on active output, got: ${rawOut.purge_after}`);
    console.log('   ✅ Active output defaults verified: deleted_at=null, deleted_by=null, purge_after=null\n');

    // -------------------------------------------------------------------------
    // 3. Testing Soft Delete on Output: 30-Day Recovery Metadata
    // -------------------------------------------------------------------------
    console.log('3. Testing output soft-delete and 30-day retention calculation...');
    const preDeleteTime = Date.now();
    const { success: outDelSuccess, error: outDelErr } = await softDeleteOutput(clientA, outputAId);
    if (outDelErr || !outDelSuccess) throw new Error(`Soft delete output failed: ${outDelErr?.message}`);

    // Verify raw output metadata in database
    const { data: softDeletedOut, error: softOutErr } = await adminClient
      .from('outputs')
      .select('id, user_id, deleted_at, deleted_by, purge_after')
      .eq('id', outputAId)
      .single();
    if (softOutErr || !softDeletedOut) throw new Error(`Fetch soft-deleted output failed: ${softOutErr?.message}`);

    if (!softDeletedOut.deleted_at) throw new Error('Expected deleted_at to be set on soft-deleted output');
    if (softDeletedOut.deleted_by !== userAId) {
      throw new Error(`Expected deleted_by=${userAId}, got: ${softDeletedOut.deleted_by}`);
    }
    if (!softDeletedOut.purge_after) throw new Error('Expected purge_after to be set on soft-deleted output');

    const deletedAtMs = new Date(softDeletedOut.deleted_at).getTime();
    const purgeAfterMs = new Date(softDeletedOut.purge_after).getTime();
    const diffDays = (purgeAfterMs - deletedAtMs) / (1000 * 60 * 60 * 24);

    if (Math.abs(diffDays - 30) > 0.05) {
      throw new Error(`Expected purge_after to be ~30 days after deleted_at, got diff: ${diffDays} days`);
    }

    console.log(`   ✅ Output soft-deleted successfully:`);
    console.log(`      - deleted_at: ${softDeletedOut.deleted_at}`);
    console.log(`      - deleted_by: ${softDeletedOut.deleted_by} (matches User Alpha)`);
    console.log(`      - purge_after: ${softDeletedOut.purge_after} (exactly ~30 days retention window)`);

    // Verify normal query excludes soft-deleted output
    const { data: activeOutputs } = await fetchProjectOutputs(clientA, projectAId);
    if (activeOutputs.some((o) => o.id === outputAId)) {
      throw new Error('Soft-deleted output still appeared in normal fetchProjectOutputs query!');
    }
    console.log('   ✅ Normal fetchProjectOutputs correctly excludes soft-deleted output\n');

    // -------------------------------------------------------------------------
    // 4. Testing Soft Delete on Project: 30-Day Recovery Metadata
    // -------------------------------------------------------------------------
    console.log('4. Testing project soft-delete and 30-day retention calculation...');
    const { success: projDelSuccess, error: projDelErr } = await softDeleteProject(clientA, projectAId);
    if (projDelErr || !projDelSuccess) throw new Error(`Soft delete project failed: ${projDelErr?.message}`);

    const { data: softDeletedProj, error: softProjErr } = await adminClient
      .from('projects')
      .select('id, user_id, deleted_at, deleted_by, purge_after')
      .eq('id', projectAId)
      .single();
    if (softProjErr || !softDeletedProj) throw new Error(`Fetch soft-deleted project failed: ${softProjErr?.message}`);

    if (!softDeletedProj.deleted_at) throw new Error('Expected deleted_at to be set on soft-deleted project');
    if (softDeletedProj.deleted_by !== userAId) {
      throw new Error(`Expected deleted_by=${userAId}, got: ${softDeletedProj.deleted_by}`);
    }
    if (!softDeletedProj.purge_after) throw new Error('Expected purge_after to be set on soft-deleted project');

    const projDeletedAtMs = new Date(softDeletedProj.deleted_at).getTime();
    const projPurgeAfterMs = new Date(softDeletedProj.purge_after).getTime();
    const projDiffDays = (projPurgeAfterMs - projDeletedAtMs) / (1000 * 60 * 60 * 24);

    if (Math.abs(projDiffDays - 30) > 0.05) {
      throw new Error(`Expected purge_after to be ~30 days after deleted_at, got diff: ${projDiffDays} days`);
    }

    console.log(`   ✅ Project soft-deleted successfully:`);
    console.log(`      - deleted_at: ${softDeletedProj.deleted_at}`);
    console.log(`      - deleted_by: ${softDeletedProj.deleted_by} (matches User Alpha)`);
    console.log(`      - purge_after: ${softDeletedProj.purge_after} (exactly ~30 days retention window)`);

    // Verify normal query excludes soft-deleted project
    const { data: activeProjects } = await fetchProjects(clientA);
    if (activeProjects && activeProjects.some((p) => p.id === projectAId)) {
      throw new Error('Soft-deleted project still appeared in normal fetchProjects query!');
    }
    console.log('   ✅ Normal fetchProjects correctly excludes soft-deleted project\n');

    // -------------------------------------------------------------------------
    // 5. Database Trigger Lifecycle Verification (Direct Soft-Delete)
    // -------------------------------------------------------------------------
    console.log('5. Testing database trigger automatic retention calculations...');
    // Create another project for User A
    const { data: trigProj, error: trigProjErr } = await createProject(clientA, {
      title: 'Trigger Direct Soft-Delete Test',
      meeting_type: 'Operational Sync'
    });
    if (trigProjErr || !trigProj) throw new Error(`Creation failed: ${trigProjErr?.message}`);

    // Update deleted_at ONLY (without providing deleted_by or purge_after)
    const nowIso = new Date().toISOString();
    const { error: directDelErr } = await clientA
      .from('projects')
      .update({ deleted_at: nowIso })
      .eq('id', trigProj.id);
    if (directDelErr) throw new Error(`Direct update failed: ${directDelErr.message}`);

    const { data: trigUpdated } = await adminClient
      .from('projects')
      .select('deleted_at, deleted_by, purge_after')
      .eq('id', trigProj.id)
      .single();

    if (!trigUpdated?.deleted_by) {
      throw new Error('Database trigger failed to automatically set deleted_by!');
    }
    if (!trigUpdated?.purge_after) {
      throw new Error('Database trigger failed to automatically set purge_after!');
    }
    console.log('   ✅ Database trigger automatically populated deleted_by and purge_after\n');

    // -------------------------------------------------------------------------
    // 6. RLS Security: Cross-User Isolation on Soft-Deleted Data
    // -------------------------------------------------------------------------
    console.log('6. Testing RLS security and cross-user isolation on retention records...');
    
    // User Beta attempts to query User Alpha's soft-deleted project
    const { data: betaReadProj } = await clientB
      .from('projects')
      .select('*')
      .eq('id', projectAId);
    if (betaReadProj && betaReadProj.length > 0) {
      throw new Error('RLS VIOLATION: User Beta was able to read User Alpha’s soft-deleted project!');
    }
    console.log('   ✅ RLS prevents User Beta from reading User Alpha soft-deleted project');

    // User Beta attempts to query User Alpha's soft-deleted output
    const { data: betaReadOut } = await clientB
      .from('outputs')
      .select('*')
      .eq('id', outputAId);
    if (betaReadOut && betaReadOut.length > 0) {
      throw new Error('RLS VIOLATION: User Beta was able to read User Alpha’s soft-deleted output!');
    }
    console.log('   ✅ RLS prevents User Beta from reading User Alpha soft-deleted output');

    // User Beta attempts to update or alter User Alpha's retention records
    const { error: betaUpdateErr } = await clientB
      .from('projects')
      .update({ title: 'Hacked Title' })
      .eq('id', projectAId);
    // RLS will result in 0 rows affected (no error or rejected)
    const { data: verifyProjUnchanged } = await adminClient
      .from('projects')
      .select('title')
      .eq('id', projectAId)
      .single();
    if (verifyProjUnchanged?.title === 'Hacked Title') {
      throw new Error('RLS VIOLATION: User Beta modified User Alpha’s project title!');
    }
    console.log('   ✅ RLS prevents User Beta from modifying User Alpha retention records\n');

    // -------------------------------------------------------------------------
    // 7. Cleanup Test Records
    // -------------------------------------------------------------------------
    console.log('7. Cleaning up test fixtures...');
    if (projectAId) await adminClient.from('projects').delete().eq('id', projectAId);
    if (trigProj?.id) await adminClient.from('projects').delete().eq('id', trigProj.id);
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    console.log('   ✅ Test fixtures cleaned up\n');

    console.log('========================================================');
    console.log('🎉 ALL TASKLET 11A RETENTION TESTS PASSED SUCCESSFULLY');
    console.log('========================================================');
  } catch (err: any) {
    console.error('\n❌ Retention Test Failed:', err.message);
    if (projectAId) await adminClient.from('projects').delete().eq('id', projectAId).catch(() => {});
    if (userAId) await adminClient.auth.admin.deleteUser(userAId).catch(() => {});
    if (userBId) await adminClient.auth.admin.deleteUser(userBId).catch(() => {});
    process.exit(1);
  }
}

runRetentionTestSuite().catch(console.error);
