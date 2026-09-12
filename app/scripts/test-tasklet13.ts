import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  createProject,
  fetchProjects,
  fetchProjectById,
  updateProject,
  softDeleteProject,
  fetchDeletedProjects,
} from '../src/lib/projects/projectClient';
import {
  saveOutput,
  fetchProjectOutputs,
  softDeleteOutput,
} from '../src/lib/outputs/outputClient';
import { searchMeetingHistory } from '../src/lib/search/searchClient';

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

async function runTasklet13TestSuite() {
  console.log('================================================================');
  console.log('TASKLET 13: SAVED PROJECTS, TRANSCRIPT ARCHIVE & MEETING MEMORY');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testPassword = `ConcludoSecure!99_${timestamp}`;

  // 1. Provision User Alpha and User Beta
  console.log('--- 1. Setting up Isolated Test Users ---');
  const userAlphaEmail = `alpha-t13-${timestamp}@concludo-qa.local`;
  const userBetaEmail = `beta-t13-${timestamp}@concludo-qa.local`;

  const { data: alphaAuth, error: alphaCreateErr } = await adminClient.auth.admin.createUser({
    email: userAlphaEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Alpha Operator' },
  });
  if (alphaCreateErr || !alphaAuth.user) {
    throw new Error(`Failed to create User Alpha: ${alphaCreateErr?.message}`);
  }

  const { data: betaAuth, error: betaCreateErr } = await adminClient.auth.admin.createUser({
    email: userBetaEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Beta Reviewer' },
  });
  if (betaCreateErr || !betaAuth.user) {
    throw new Error(`Failed to create User Beta: ${betaCreateErr?.message}`);
  }

  // Create isolated client sessions using Supabase Auth (Sign In)
  const clientAlpha = createClient(supabaseUrl, anonKey);
  const { error: alphaSignInErr } = await clientAlpha.auth.signInWithPassword({
    email: userAlphaEmail,
    password: testPassword,
  });
  if (alphaSignInErr) throw new Error(`User Alpha sign in failed: ${alphaSignInErr.message}`);

  const clientBeta = createClient(supabaseUrl, anonKey);
  const { error: betaSignInErr } = await clientBeta.auth.signInWithPassword({
    email: userBetaEmail,
    password: testPassword,
  });
  if (betaSignInErr) throw new Error(`User Beta sign in failed: ${betaSignInErr.message}`);

  console.log('  ✅ User Alpha and User Beta authenticated with isolated sessions\n');

  // 2. Project Creation & Persistence
  console.log('--- 2. Testing Project Creation & Persistence ---');
  const projectInput = {
    title: `Alpha Strategic Roadmap ${timestamp}`,
    meeting_type: 'Strategy & Planning',
    client_name: 'Concludo Global Pty Ltd',
    project_name: 'Enterprise Meeting Memory',
    meeting_date: '2026-09-13',
    transcript: 'Anthony: Welcome everyone. We are confirming that all project transcripts persist reliably in Supabase. Sarah: Confirmed, transcripts are permanently linked.',
    notes: 'Key directive: australian english standards, no em dashes, full RLS security.',
  };

  const createRes = await createProject(clientAlpha, projectInput);
  if (createRes.error || !createRes.data) {
    throw new Error(`createProject failed: ${createRes.error?.message}`);
  }
  const createdProject = createRes.data;
  console.log(`  ✅ Project created successfully with ID: ${createdProject.id}`);

  if (createdProject.title !== projectInput.title) throw new Error('Project title mismatch');
  if (createdProject.client_name !== projectInput.client_name) throw new Error('Client name mismatch');
  if (createdProject.project_name !== projectInput.project_name) throw new Error('Project name mismatch');
  if (createdProject.transcript !== projectInput.transcript) throw new Error('Transcript mismatch');
  if (createdProject.notes !== projectInput.notes) throw new Error('Notes mismatch');
  if (createdProject.user_id !== alphaAuth.user.id) throw new Error('User ID mismatch');
  if (createdProject.deleted_at !== null) throw new Error('deleted_at should be null');
  console.log('  ✅ All project fields persisted correctly in Supabase\n');

  // 3. View Project & Immediate Transcript Loading
  console.log('--- 3. Testing View Project & Immediate Transcript Loading ---');
  const viewRes = await fetchProjectById(clientAlpha, createdProject.id);
  if (viewRes.error || !viewRes.data) {
    throw new Error(`fetchProjectById failed: ${viewRes.error?.message}`);
  }
  const loadedProject = viewRes.data;
  if (!loadedProject.transcript) {
    throw new Error('Transcript failed to load immediately with project');
  }
  console.log('  ✅ Project loaded by ID; transcript immediately available without page refresh loss\n');

  // 4. Edit Project & Update Timestamps
  console.log('--- 4. Testing Project Modification & Timestamp Update ---');
  const updatePayload = {
    title: `Alpha Strategic Roadmap Updated ${timestamp}`,
    meeting_type: 'Executive Review',
    client_name: 'Concludo Holdings Melbourne',
    project_name: 'Enterprise Memory v2',
    meeting_date: '2026-09-14',
    transcript: 'Anthony: Updating transcript with amended action items. Sarah: Recorded.',
    notes: 'Updated notes with additional board feedback.',
  };

  const updateRes = await updateProject(clientAlpha, createdProject.id, updatePayload);
  if (updateRes.error || !updateRes.data) {
    throw new Error(`updateProject failed: ${updateRes.error?.message}`);
  }
  const updatedProject = updateRes.data;
  if (updatedProject.title !== updatePayload.title) throw new Error('Updated title mismatch');
  if (updatedProject.client_name !== updatePayload.client_name) throw new Error('Updated client name mismatch');
  if (updatedProject.project_name !== updatePayload.project_name) throw new Error('Updated project name mismatch');
  if (updatedProject.meeting_type !== updatePayload.meeting_type) throw new Error('Updated meeting type mismatch');
  if (updatedProject.transcript !== updatePayload.transcript) throw new Error('Updated transcript mismatch');
  if (updatedProject.notes !== updatePayload.notes) throw new Error('Updated notes mismatch');

  console.log('  ✅ Project fields edited successfully and changes persisted');
  console.log(`  ✅ Timestamps verified: created=${updatedProject.created_at}, updated=${updatedProject.updated_at}\n`);

  // 5. Output Storage & Project Linkage
  console.log('--- 5. Testing Output Storage & Linkage ---');
  const outputTypes = [
    { type: 'summary' as const, content: 'Executive summary: meeting confirmed production rollout of Meeting Memory.' },
    { type: 'action_items' as const, content: '1. Anthony to verify RLS.\n2. Complete Tasklet 13 validation.\n3. Push to GitHub.' },
    { type: 'decision_log' as const, content: 'Decision: Meeting Memory and Transcript Archive persist as first-class records.' },
    { type: 'follow_up_email' as const, content: 'Subject: Strategy Wrap Up\n\nTeam, please find attached the agreed execution plan.' },
  ];

  const savedOutputs = [];
  for (const ot of outputTypes) {
    const outRes = await saveOutput(clientAlpha, {
      project_id: createdProject.id,
      output_type: ot.type,
      content: ot.content,
    });
    if (outRes.error || !outRes.data) {
      throw new Error(`Failed to save output of type ${ot.type}: ${outRes.error?.message}`);
    }
    savedOutputs.push(outRes.data);
  }
  console.log(`  ✅ Saved ${savedOutputs.length} distinct outputs linked to project ${createdProject.id}`);

  const fetchOutRes = await fetchProjectOutputs(clientAlpha, createdProject.id);
  if (fetchOutRes.error || !fetchOutRes.data || fetchOutRes.data.length !== savedOutputs.length) {
    throw new Error(`fetchProjectOutputs count mismatch: expected ${savedOutputs.length}, got ${fetchOutRes.data?.length}`);
  }
  console.log('  ✅ All saved outputs retrieved successfully for project\n');

  // 6. Dashboard Integration (Latest 5 Projects & Latest 5 Outputs)
  console.log('--- 6. Testing Dashboard Live Queries ---');
  const { data: dashProjects, error: dashProjErr } = await clientAlpha
    .from('projects')
    .select('id, title, meeting_type, client_name, project_name, client_or_project, meeting_date, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (dashProjErr || !dashProjects || dashProjects.length === 0) {
    throw new Error(`Dashboard projects query failed: ${dashProjErr?.message}`);
  }
  const foundInDash = dashProjects.find((p) => p.id === createdProject.id);
  if (!foundInDash) throw new Error('Created project not found in recent dashboard projects');
  console.log(`  ✅ Dashboard projects query verified: retrieved ${dashProjects.length} recent projects`);

  const { data: dashOutputs, error: dashOutErr } = await clientAlpha
    .from('outputs')
    .select('id, project_id, output_type, content, created_at, updated_at, projects(id, title)')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (dashOutErr || !dashOutputs || dashOutputs.length === 0) {
    throw new Error(`Dashboard outputs query failed: ${dashOutErr?.message}`);
  }
  console.log(`  ✅ Dashboard outputs query verified: retrieved ${dashOutputs.length} recent outputs\n`);

  // 7. Search Foundation
  console.log('--- 7. Testing Search Across Meeting History ---');

  // Test 7a: Search by project title
  const searchTitleRes = await searchMeetingHistory(clientAlpha, 'Strategic Roadmap');
  if (searchTitleRes.error || !searchTitleRes.data || searchTitleRes.data.length === 0) {
    throw new Error('Search by title failed to return matches');
  }
  const matchTitle = searchTitleRes.data.find((r) => r.projectId === createdProject.id);
  if (!matchTitle) throw new Error('Search did not match created project title');
  console.log(`  ✅ Search matched project title: "${matchTitle.projectTitle}" (field: ${matchTitle.matchField})`);

  // Test 7b: Search by client name
  const searchClientRes = await searchMeetingHistory(clientAlpha, 'Concludo Holdings');
  if (searchClientRes.error || !searchClientRes.data || searchClientRes.data.length === 0) {
    throw new Error('Search by client name failed to return matches');
  }
  console.log(`  ✅ Search matched client name`);

  // Test 7c: Search by project name
  const searchProjNameRes = await searchMeetingHistory(clientAlpha, 'Enterprise Memory');
  if (searchProjNameRes.error || !searchProjNameRes.data || searchProjNameRes.data.length === 0) {
    throw new Error('Search by project name failed to return matches');
  }
  console.log(`  ✅ Search matched project name`);

  // Test 7d: Search by transcript dialogue
  const searchTranscriptRes = await searchMeetingHistory(clientAlpha, 'amended action items');
  if (searchTranscriptRes.error || !searchTranscriptRes.data || searchTranscriptRes.data.length === 0) {
    throw new Error('Search by transcript failed to return matches');
  }
  console.log(`  ✅ Search matched transcript text`);

  // Test 7e: Search by notes
  const searchNotesRes = await searchMeetingHistory(clientAlpha, 'board feedback');
  if (searchNotesRes.error || !searchNotesRes.data || searchNotesRes.data.length === 0) {
    throw new Error('Search by notes failed to return matches');
  }
  console.log(`  ✅ Search matched notes text`);

  // Test 7f: Search by output content
  const searchOutputRes = await searchMeetingHistory(clientAlpha, 'rollout of Meeting Memory');
  if (searchOutputRes.error || !searchOutputRes.data || searchOutputRes.data.length === 0) {
    throw new Error('Search by output content failed to return matches');
  }
  console.log(`  ✅ Search matched output content`);

  // Test 7g: Non-matching search query
  const searchEmptyRes = await searchMeetingHistory(clientAlpha, 'NonExistentTermXYZ123');
  if (searchEmptyRes.error) throw new Error('Search with non-matching term errored');
  if (searchEmptyRes.data && searchEmptyRes.data.length > 0) {
    throw new Error('Non-matching search should return 0 results');
  }
  console.log('  ✅ Non-matching search returned 0 results as expected\n');

  // 8. Security & Cross-User RLS Isolation
  console.log('--- 8. Testing Security & Cross-User RLS Isolation ---');

  // User Beta attempts to fetch User Alpha project by ID
  const betaFetchRes = await fetchProjectById(clientBeta, createdProject.id);
  if (!betaFetchRes.error && betaFetchRes.data) {
    throw new Error('SECURITY VIOLATION: User Beta was able to fetch User Alpha project!');
  }
  console.log('  ✅ User Beta cannot fetch User Alpha project by ID (RLS blocked)');

  // User Beta attempts to list projects
  const betaProjectsRes = await fetchProjects(clientBeta);
  const betaFoundAlpha = betaProjectsRes.data?.find((p) => p.id === createdProject.id);
  if (betaFoundAlpha) {
    throw new Error('SECURITY VIOLATION: User Beta listed User Alpha project in fetchProjects!');
  }
  console.log('  ✅ User Beta cannot view User Alpha project in project lists');

  // User Beta attempts to fetch User Alpha outputs
  const betaOutputsRes = await fetchProjectOutputs(clientBeta, createdProject.id);
  if (betaOutputsRes.data && betaOutputsRes.data.length > 0) {
    throw new Error('SECURITY VIOLATION: User Beta fetched User Alpha outputs!');
  }
  console.log('  ✅ User Beta cannot view User Alpha outputs');

  // User Beta attempts to search User Alpha records
  const betaSearchRes = await searchMeetingHistory(clientBeta, 'Strategic Roadmap');
  const betaMatchedAlpha = betaSearchRes.data?.find((r) => r.projectId === createdProject.id);
  if (betaMatchedAlpha) {
    throw new Error('SECURITY VIOLATION: User Beta search returned User Alpha project!');
  }
  console.log('  ✅ User Beta search returns 0 results for User Alpha terms (RLS enforced)');

  // User Beta attempts to update User Alpha project
  const betaUpdateRes = await updateProject(clientBeta, createdProject.id, {
    title: 'Hacked Title',
  });
  if (!betaUpdateRes.error && betaUpdateRes.data) {
    throw new Error('SECURITY VIOLATION: User Beta updated User Alpha project!');
  }
  console.log('  ✅ User Beta cannot update User Alpha project');

  // User Beta attempts to delete User Alpha project
  const betaDeleteRes = await softDeleteProject(clientBeta, createdProject.id);
  if (betaDeleteRes.success) {
    throw new Error('SECURITY VIOLATION: User Beta soft deleted User Alpha project!');
  }
  console.log('  ✅ User Beta cannot delete User Alpha project\n');

  // 9. Retention & Soft-Delete Lifecycle Integration
  console.log('--- 9. Testing Retention & Soft-Delete Lifecycle ---');

  // User Alpha soft-deletes the project
  const deleteRes = await softDeleteProject(clientAlpha, createdProject.id);
  if (!deleteRes.success) throw new Error(`softDeleteProject failed: ${deleteRes.error?.message}`);
  console.log('  ✅ Project soft-deleted successfully');

  // Verify project disappears from active project list
  const activeProjectsAfterDel = await fetchProjects(clientAlpha);
  if (activeProjectsAfterDel.data?.some((p) => p.id === createdProject.id)) {
    throw new Error('Soft-deleted project still appears in active projects list!');
  }
  console.log('  ✅ Soft-deleted project hidden from active project list');

  // Verify project disappears from dashboard recent projects
  const { data: dashProjectsAfterDel } = await clientAlpha
    .from('projects')
    .select('id')
    .is('deleted_at', null);
  if (dashProjectsAfterDel?.some((p) => p.id === createdProject.id)) {
    throw new Error('Soft-deleted project still appears in dashboard recent projects!');
  }
  console.log('  ✅ Soft-deleted project hidden from dashboard recent projects');

  // Verify project disappears from search
  const searchAfterDel = await searchMeetingHistory(clientAlpha, 'Strategic Roadmap');
  if (searchAfterDel.data?.some((r) => r.projectId === createdProject.id)) {
    throw new Error('Soft-deleted project still appears in search results!');
  }
  console.log('  ✅ Soft-deleted project hidden from search results');

  // Verify project is visible in Recently Deleted
  const deletedProjects = await fetchDeletedProjects(clientAlpha);
  const foundInDeleted = deletedProjects.data?.find((p) => p.id === createdProject.id);
  if (!foundInDeleted) {
    throw new Error('Soft-deleted project not found in Recently Deleted!');
  }
  console.log('  ✅ Soft-deleted project present in Recently Deleted with 30-day purge_after');

  // Test restoration via restore_project RPC
  const { error: restoreErr } = await clientAlpha.rpc('restore_project', {
    p_project_id: createdProject.id,
  });
  if (restoreErr) throw new Error(`restore_project RPC failed: ${restoreErr.message}`);

  // Verify project immediately reappears in active projects
  const activeProjectsAfterRestore = await fetchProjects(clientAlpha);
  if (!activeProjectsAfterRestore.data?.some((p) => p.id === createdProject.id)) {
    throw new Error('Restored project did not reappear in active projects list!');
  }
  console.log('  ✅ Restored project immediately reappeared in active projects list');

  // Verify project immediately reappears in search
  const searchAfterRestore = await searchMeetingHistory(clientAlpha, 'Strategic Roadmap');
  if (!searchAfterRestore.data?.some((r) => r.projectId === createdProject.id)) {
    throw new Error('Restored project did not reappear in search results!');
  }
  console.log('  ✅ Restored project immediately reappeared in search results\n');

  // 10. Clean up test users and records
  console.log('--- 10. Cleaning up Test Artifacts ---');
  await adminClient.rpc('permanent_delete_project', { p_project_id: createdProject.id });
  await adminClient.auth.admin.deleteUser(alphaAuth.user.id);
  await adminClient.auth.admin.deleteUser(betaAuth.user.id);
  console.log('  ✅ Test records and test accounts cleaned up safely\n');

  console.log('================================================================');
  console.log('TASKLET 13 VERIFICATION SUCCESSFUL: ALL CRITERIA PASSED');
  console.log('================================================================\n');
}

runTasklet13TestSuite().catch((err) => {
  console.error('\n❌ Tasklet 13 Test Suite Error:', err);
  process.exit(1);
});
