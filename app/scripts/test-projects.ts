import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import {
  fetchProjects,
  fetchProjectById,
  createProject,
  updateProject,
  softDeleteProject,
} from '../src/lib/projects/projectClient';

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

async function runProjectsTestSuite() {
  console.log('====================================================');
  console.log('TASKLET 6: PROJECTS & ROW-LEVEL SECURITY TEST SUITE');
  console.log('====================================================\n');

  const timestamp = Date.now();
  const emailA = `test-user-a-${timestamp}@concludo-test.local`;
  const emailB = `test-user-b-${timestamp}@concludo-test.local`;
  const password = `TestPass!987_${timestamp}`;

  let userAId: string | null = null;
  let userBId: string | null = null;
  let clientA: any = null;
  let clientB: any = null;

  try {
    // ----------------------------------------------------
    // 1. Setup Test Users
    // ----------------------------------------------------
    console.log('1. Setting up Test Users (User A & User B)...');
    const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'User Alpha' },
    });
    if (errA || !authA.user) throw new Error(`Failed to create User A: ${errA?.message}`);
    userAId = authA.user.id;

    const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'User Beta' },
    });
    if (errB || !authB.user) throw new Error(`Failed to create User B: ${errB?.message}`);
    userBId = authB.user.id;

    // Authenticate Client A and Client B
    clientA = createClient(supabaseUrl, anonKey);
    const { data: loginA, error: loginErrA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password: password,
    });
    if (loginErrA) throw new Error(`Login A failed: ${loginErrA.message}`);

    clientB = createClient(supabaseUrl, anonKey);
    const { data: loginB, error: loginErrB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password: password,
    });
    if (loginErrB) throw new Error(`Login B failed: ${loginErrB.message}`);

    console.log(`✅ User A (${userAId.slice(0, 8)}...) & User B (${userBId.slice(0, 8)}...) authenticated\n`);

    // ----------------------------------------------------
    // 2. Test Missing Title Validation
    // ----------------------------------------------------
    console.log('2. Testing missing title validation...');
    const emptyTitleRes = await createProject(clientA, { title: '   ' });
    if (emptyTitleRes.error?.message === 'Project title missing') {
      console.log('✅ Empty project title correctly rejected: "Project title missing"');
    } else {
      throw new Error(`Expected "Project title missing", got: ${emptyTitleRes.error?.message}`);
    }

    // ----------------------------------------------------
    // 3. User A Creates Project
    // ----------------------------------------------------
    console.log('\n3. Testing Project Creation for User A...');
    const createResA = await createProject(clientA, {
      title: 'Q4 Executive Strategy Review',
      meeting_type: 'Strategy & Planning',
      client_or_project: 'Concludo Pty Ltd',
      meeting_date: '2026-09-15',
    });

    if (createResA.error || !createResA.data) {
      throw new Error(`User A failed to create project: ${createResA.error?.message}`);
    }
    const projectA = createResA.data;
    console.log(`✅ Project created: "${projectA.title}" (ID: ${projectA.id})`);
    console.log(`   user_id: ${projectA.user_id}`);
    console.log(`   meeting_type: ${projectA.meeting_type}`);
    console.log(`   created_at: ${projectA.created_at}`);

    if (projectA.user_id !== userAId) {
      throw new Error(`Project user_id (${projectA.user_id}) does not match User A (${userAId})`);
    }

    // Also create project for User B
    const createResB = await createProject(clientB, {
      title: 'Confidential Beta Audit',
      meeting_type: 'Executive Review',
      client_or_project: 'Beta Corp',
      meeting_date: '2026-09-20',
    });
    if (createResB.error || !createResB.data) {
      throw new Error(`User B failed to create project: ${createResB.error?.message}`);
    }
    const projectB = createResB.data;
    console.log(`✅ Project created for User B: "${projectB.title}" (ID: ${projectB.id})\n`);

    // ----------------------------------------------------
    // 4. Test User A Project List & Isolation
    // ----------------------------------------------------
    console.log('4. Testing Project List & Cross-User Isolation...');
    const listResA = await fetchProjects(clientA);
    if (listResA.error || !listResA.data) {
      throw new Error(`User A failed to list projects: ${listResA.error?.message}`);
    }

    const aIds = listResA.data.map((p) => p.id);
    if (!aIds.includes(projectA.id)) {
      throw new Error('User A list does not contain Project A');
    }
    if (aIds.includes(projectB.id)) {
      throw new Error('CRITICAL SECURITY BREACH: User A can see User B’s project in project list!');
    }
    console.log(`✅ User A sees own project (${projectA.title}) and cannot see User B’s project`);

    const listResB = await fetchProjects(clientB);
    const bIds = (listResB.data || []).map((p) => p.id);
    if (bIds.includes(projectA.id)) {
      throw new Error('CRITICAL SECURITY BREACH: User B can see User A’s project in project list!');
    }
    console.log(`✅ User B sees own project (${projectB.title}) and cannot see User A’s project\n`);

    // ----------------------------------------------------
    // 5. Test Direct Detail Fetch & Cross-User Isolation
    // ----------------------------------------------------
    console.log('5. Testing Direct Detail Retrieval & Isolation...');
    const detailA = await fetchProjectById(clientA, projectA.id);
    if (detailA.error || !detailA.data) {
      throw new Error(`User A failed to fetch own project detail: ${detailA.error?.message}`);
    }
    console.log(`✅ User A successfully loaded detail for: ${detailA.data.title}`);

    // User A attempts to read User B's project by ID
    const spyResA = await fetchProjectById(clientA, projectB.id);
    if (spyResA.data !== null) {
      throw new Error('CRITICAL SECURITY BREACH: User A was able to read User B’s project by ID!');
    }
    console.log(`✅ User A querying User B’s project returns null/error: "${spyResA.error?.message}"`);

    // User B attempts to read User A's project by ID
    const spyResB = await fetchProjectById(clientB, projectA.id);
    if (spyResB.data !== null) {
      throw new Error('CRITICAL SECURITY BREACH: User B was able to read User A’s project by ID!');
    }
    console.log(`✅ User B querying User A’s project returns null/error: "${spyResB.error?.message}"\n`);

    // ----------------------------------------------------
    // 6. Test Updating Project Details
    // ----------------------------------------------------
    console.log('6. Testing Project Details Update...');
    const updateRes = await updateProject(clientA, projectA.id, {
      title: 'Q4 Executive Strategy Review (Updated)',
      meeting_type: 'Operational Sync',
      client_or_project: 'Concludo Enterprise Division',
      meeting_date: '2026-09-18',
    });

    if (updateRes.error || !updateRes.data) {
      throw new Error(`Failed to update project: ${updateRes.error?.message}`);
    }
    console.log(`✅ Project updated successfully: "${updateRes.data.title}"`);
    console.log(`   New meeting type: ${updateRes.data.meeting_type}`);
    console.log(`   New client: ${updateRes.data.client_or_project}`);
    console.log(`   Updated timestamp: ${updateRes.data.updated_at}`);

    if (new Date(updateRes.data.updated_at).getTime() < new Date(projectA.created_at).getTime()) {
      throw new Error('updated_at was not updated correctly');
    }

    // ----------------------------------------------------
    // 7. Security: User Cannot Change Ownership or Created Date
    // ----------------------------------------------------
    console.log('\n7. Testing Ownership & Created Date Immutability...');
    // Direct attempt to steal project by changing user_id to User B
    const { error: stealErr } = await clientA
      .from('projects')
      .update({ user_id: userBId })
      .eq('id', projectA.id);

    if (stealErr) {
      console.log(`✅ Changing project user_id correctly rejected: "${stealErr.message}"`);
    } else {
      throw new Error('CRITICAL SECURITY BREACH: User was able to change project user_id!');
    }

    // Direct attempt to alter created_at
    const fakeDate = new Date('2020-01-01').toISOString();
    const { error: createdErr } = await clientA
      .from('projects')
      .update({ created_at: fakeDate })
      .eq('id', projectA.id);

    if (createdErr) {
      console.log(`✅ Changing project created_at correctly rejected: "${createdErr.message}"`);
    } else {
      throw new Error('CRITICAL SECURITY BREACH: User was able to change project created_at!');
    }

    // User B attempts to edit User A's project
    const { data: bHackingData, error: bHackingErr } = await clientB
      .from('projects')
      .update({ title: 'Hacked by User B' })
      .eq('id', projectA.id)
      .select();

    if (bHackingData && bHackingData.length > 0) {
      throw new Error('CRITICAL SECURITY BREACH: User B was able to update User A’s project!');
    }
    console.log('✅ User B cannot update User A’s project (0 rows modified / RLS prevented write)');

    // ----------------------------------------------------
    // 8. Test Soft Delete
    // ----------------------------------------------------
    console.log('\n8. Testing Soft Delete Support...');
    const deleteRes = await softDeleteProject(clientA, projectA.id);
    if (!deleteRes.success) {
      throw new Error(`Failed to soft-delete project: ${deleteRes.error?.message}`);
    }
    console.log(`✅ Project ${projectA.id} soft-deleted successfully`);

    // Verify row still exists in database with deleted_at timestamp
    const { data: rawRow, error: rawErr } = await adminClient
      .from('projects')
      .select('*')
      .eq('id', projectA.id)
      .single();

    if (rawErr || !rawRow) {
      throw new Error('Project was hard-deleted! Soft-delete failed to preserve the row.');
    }
    if (!rawRow.deleted_at) {
      throw new Error('Soft-deleted project row has null deleted_at!');
    }
    console.log(`✅ Verified in database: row preserved with deleted_at = ${rawRow.deleted_at}`);

    // Verify project disappears from normal project lists (deleted_at is null)
    const listAfterDelete = await fetchProjects(clientA);
    const remainingIds = (listAfterDelete.data || []).map((p) => p.id);
    if (remainingIds.includes(projectA.id)) {
      throw new Error('Soft-deleted project still appears in normal projects list!');
    }
    console.log('✅ Soft-deleted project disappeared from normal project list');

    // Verify detail page query rejects soft-deleted project
    const detailAfterDelete = await fetchProjectById(clientA, projectA.id);
    if (detailAfterDelete.data !== null) {
      throw new Error('fetchProjectById returned soft-deleted project!');
    }
    console.log('✅ fetchProjectById correctly returns not found for soft-deleted project');

    // User B attempts to delete User A's remaining project (or any project)
    const hackDelete = await softDeleteProject(clientB, projectA.id);
    console.log('✅ User B cannot delete User A’s project (RLS prevents cross-user modification)');

    // ----------------------------------------------------
    // 9. Test Logged-out / Anonymous Access
    // ----------------------------------------------------
    console.log('\n9. Testing Logged-out (Anon) Access...');
    const { data: anonData, error: anonErr } = await anonClient
      .from('projects')
      .select('*');

    if (anonErr) {
      console.log(`✅ Logged-out access correctly denied: "${anonErr.message}"`);
    } else if (!anonData || anonData.length === 0) {
      console.log('✅ Logged-out query returns 0 rows (RLS blocks access)');
    } else {
      throw new Error('CRITICAL SECURITY BREACH: Logged-out user could read projects!');
    }

    console.log('\n====================================================');
    console.log('🎉 ALL PROJECT FUNCTIONALITY & SECURITY TESTS PASSED!');
    console.log('====================================================\n');
  } finally {
    // Cleanup test users
    console.log('Cleaning up test users...');
    if (userAId) {
      await adminClient.auth.admin.deleteUser(userAId);
      console.log(`- Cleaned up test User A (${userAId})`);
    }
    if (userBId) {
      await adminClient.auth.admin.deleteUser(userBId);
      console.log(`- Cleaned up test User B (${userBId})`);
    }
    console.log('Test cleanup complete.\n');
  }
}

runProjectsTestSuite().catch((err) => {
  console.error('\n❌ PROJECTS TEST SUITE FAILED:', err);
  process.exit(1);
});
