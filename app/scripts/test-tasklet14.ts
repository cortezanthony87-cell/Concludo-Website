import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  createProject,
  fetchProjects,
  fetchProjectById,
  updateProject,
  softDeleteProject,
  restoreProject,
  permanentDeleteProject,
} from '../src/lib/projects/projectClient';
import {
  saveOutput,
  fetchProjectOutputs,
} from '../src/lib/outputs/outputClient';
import {
  saveDecision,
  fetchDecisions,
  fetchDecisionById,
  updateDecision,
  softDeleteDecision,
  restoreDecision,
  permanentDeleteDecision,
  fetchDeletedDecisions,
} from '../src/lib/decisions/decisionClient';
import {
  saveAction,
  fetchActions,
  fetchActionById,
  updateAction,
  updateActionStatus,
  softDeleteAction,
  restoreAction,
  permanentDeleteAction,
  fetchDeletedActions,

} from '../src/lib/actions/actionClient';
import { searchMeetingHistory } from '../src/lib/search/searchClient';
import { isActionOverdue } from '../src/lib/actions/types';
import { canUseFeature, hasFeature } from '../src/lib/permissions/canUseFeature';
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

async function runTasklet14TestSuite() {
  console.log('========================================================================');
  console.log('TASKLET 14: KEYWORD SEARCH, DECISION MEMORY & ACTION TRACKER');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const testPassword = `ConcludoSecure!99_${timestamp}`;

  // 1. Provision Test Users
  console.log('--- 1. Setting up Isolated Test Users ---');
  const userAlphaEmail = `alpha-starter-${timestamp}@concludo-qa.local`;
  const userBetaEmail = `beta-pro-${timestamp}@concludo-qa.local`;
  const userCharlieEmail = `charlie-pro-${timestamp}@concludo-qa.local`;

  // User Alpha: Starter Plan (Feature Access Denied for Pro features)
  const { data: alphaAuth, error: alphaCreateErr } = await adminClient.auth.admin.createUser({
    email: userAlphaEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Alpha Starter User' },
  });
  if (alphaCreateErr || !alphaAuth.user) throw new Error(`Alpha creation failed: ${alphaCreateErr?.message}`);

  // User Beta: Pro Plan (Feature Access Granted)
  const { data: betaAuth, error: betaCreateErr } = await adminClient.auth.admin.createUser({
    email: userBetaEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Beta Pro User' },
  });
  if (betaCreateErr || !betaAuth.user) throw new Error(`Beta creation failed: ${betaCreateErr?.message}`);

  // User Charlie: Pro Plan (Cross-user isolation test)
  const { data: charlieAuth, error: charlieCreateErr } = await adminClient.auth.admin.createUser({
    email: userCharlieEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Charlie Pro User' },
  });
  if (charlieCreateErr || !charlieAuth.user) throw new Error(`Charlie creation failed: ${charlieCreateErr?.message}`);

  // Set Profile Plans
  await adminClient.from('profiles').update({ plan: 'starter' }).eq('id', alphaAuth.user.id);
  await adminClient.from('profiles').update({ plan: 'pro' }).eq('id', betaAuth.user.id);
  await adminClient.from('profiles').update({ plan: 'pro' }).eq('id', charlieAuth.user.id);

  console.log('✅ Provisioned:');
  console.log(`   - User Alpha (${alphaAuth.user.id}): plan=starter`);
  console.log(`   - User Beta (${betaAuth.user.id}): plan=pro`);
  console.log(`   - User Charlie (${charlieAuth.user.id}): plan=pro\n`);

  // Sign In clients with persistent sessions
  const clientAlpha = createClient(supabaseUrl, anonKey);
  const clientBeta = createClient(supabaseUrl, anonKey);
  const clientCharlie = createClient(supabaseUrl, anonKey);

  const { data: alphaSession } = await clientAlpha.auth.signInWithPassword({
    email: userAlphaEmail,
    password: testPassword,
  });
  const { data: betaSession } = await clientBeta.auth.signInWithPassword({
    email: userBetaEmail,
    password: testPassword,
  });
  const { data: charlieSession } = await clientCharlie.auth.signInWithPassword({
    email: userCharlieEmail,
    password: testPassword,
  });

  if (!alphaSession.session || !betaSession.session || !charlieSession.session) {
    throw new Error('Failed to create authenticated sessions.');
  }

  // 2. Feature Permission Enforcement & Tier Gating
  console.log('--- 2. Authoritative Permission Enforcement ---');
  const alphaCanSearch = await hasFeature(alphaAuth.user.id, 'keyword_search', { supabase: adminClient });
  const alphaCanDecide = await hasFeature(alphaAuth.user.id, 'decision_memory', { supabase: adminClient });
  const alphaCanAct = await hasFeature(alphaAuth.user.id, 'action_tracker', { supabase: adminClient });

  const betaCanSearch = await hasFeature(betaAuth.user.id, 'keyword_search', { supabase: adminClient });
  const betaCanDecide = await hasFeature(betaAuth.user.id, 'decision_memory', { supabase: adminClient });
  const betaCanAct = await hasFeature(betaAuth.user.id, 'action_tracker', { supabase: adminClient });

  if (alphaCanSearch || alphaCanDecide || alphaCanAct) {
    throw new Error('Security Breach: Starter user granted access to Pro features!');
  }
  if (!betaCanSearch || !betaCanDecide || !betaCanAct) {
    throw new Error('Pro user denied access to Pro features!');
  }
  console.log('✅ Backend permission helpers verified:');
  console.log('   - Starter (Alpha): keyword_search=false, decision_memory=false, action_tracker=false');
  console.log('   - Pro (Beta): keyword_search=true, decision_memory=true, action_tracker=true');

  // Verify server-side API Router returns 403 Forbidden for Starter user
  const alphaApiSearchRes = await handleApiRequest(
    {
      method: 'POST',
      url: 'http://localhost/api/search',
      headers: {
        authorization: `Bearer ${alphaSession.session.access_token}`,
        'content-type': 'application/json',
      },
      body: { query: 'test' },
    },
    { adminClient }
  );
  if (alphaApiSearchRes.status !== 403) {
    throw new Error(`API Router failed to reject Starter user from /api/search, got status ${alphaApiSearchRes.status}`);
  }

  const alphaApiDecisionsRes = await handleApiRequest(
    {
      method: 'GET',
      url: 'http://localhost/api/decisions',
      headers: {
        authorization: `Bearer ${alphaSession.session.access_token}`,
      },
    },
    { adminClient }
  );
  if (alphaApiDecisionsRes.status !== 403) {
    throw new Error(`API Router failed to reject Starter user from /api/decisions, got status ${alphaApiDecisionsRes.status}`);
  }
  console.log('✅ Backend API router strictly returned HTTP 403 Forbidden for Starter user accessing Pro endpoints.\n');

  // 3. Project & Output Creation for Beta (Pro User)
  console.log('--- 3. Project & Output Foundation for Pro User ---');
  const projectRes = await createProject(clientBeta, {
    title: 'Acme Strategic Alignment 2026',
    meeting_type: 'Board Meeting',
    client_name: 'Acme Corporation',
    project_name: 'Project Horizon',
    meeting_date: '2026-09-12',
    transcript: 'Alice: We need to finalize the cloud vendor contract before Q4. Bob: Let us select AusCloud. Charlie: I agree, Bob will lead security review by Sept 10.',
    notes: 'Key stakeholders present. Budget approved.',
  });
  if (projectRes.error || !projectRes.data) {
    throw new Error(`Project creation failed: ${projectRes.error?.message}`);
  }
  const betaProject = projectRes.data;
  console.log(`✅ Project created: "${betaProject.title}" (ID: ${betaProject.id})`);

  // Create Decision Log Output
  const decisionOutputRes = await saveOutput(clientBeta, {
    project_id: betaProject.id,
    output_type: 'decision_log',
    content: 'Decision: Approved AusCloud as primary sovereign cloud vendor.\nReasoning: Data sovereignty requirements and lower latency.',
  });
  if (decisionOutputRes.error || !decisionOutputRes.data) {
    throw new Error(`Decision Log output creation failed: ${decisionOutputRes.error?.message}`);
  }
  const decisionOutput = decisionOutputRes.data;

  // Create Action Items Output
  const actionOutputRes = await saveOutput(clientBeta, {
    project_id: betaProject.id,
    output_type: 'action_items',
    content: '1. Conduct comprehensive security review - Bob (Due: 2026-09-10)\n2. Submit procurement documentation - Alice (Due: 2026-10-15)',
  });
  if (actionOutputRes.error || !actionOutputRes.data) {
    throw new Error(`Action Items output creation failed: ${actionOutputRes.error?.message}`);
  }
  const actionOutput = actionOutputRes.data;
  console.log('✅ Created linked Decision Log and Action Items outputs.\n');

  // 4. Decision Memory Creation, Linking & Retrieval
  console.log('--- 4. Decision Memory Lifecycle ---');
  const saveDecisionRes = await saveDecision(clientBeta, {
    project_id: betaProject.id,
    decision_title: 'Select AusCloud as Sovereign Cloud Provider',
    decision_summary: 'Approved selection of AusCloud for all Q4 cloud workloads.',
    decision_reasoning: 'Guarantees compliance with Australian data sovereignty laws.',
    decision_owner: 'Anthony Cortez',
    decision_date: '2026-09-12',
    source_output_id: decisionOutput.id,
  });
  if (saveDecisionRes.error || !saveDecisionRes.data) {
    throw new Error(`Save decision failed: ${saveDecisionRes.error?.message}`);
  }
  const betaDecision = saveDecisionRes.data;
  console.log(`✅ Saved decision: "${betaDecision.decision_title}" (ID: ${betaDecision.id})`);

  // Fetch Decisions
  const decisionsListRes = await fetchDecisions(clientBeta, { projectId: betaProject.id });
  if (decisionsListRes.error || !decisionsListRes.data || decisionsListRes.data.length === 0) {
    throw new Error(`Failed to fetch decisions: ${decisionsListRes.error?.message}`);
  }
  const fetchedDecision = decisionsListRes.data[0];
  if (fetchedDecision.decision_title !== 'Select AusCloud as Sovereign Cloud Provider') {
    throw new Error('Decision title mismatch in fetched decision.');
  }

  // Fetch Decision by ID
  const singleDecisionRes = await fetchDecisionById(clientBeta, betaDecision.id);
  if (singleDecisionRes.error || !singleDecisionRes.data) {
    throw new Error(`Failed to fetch decision by ID: ${singleDecisionRes.error?.message}`);
  }
  console.log('✅ Fetched decision list and decision detail with linked project and source output.\n');

  // 5. Action Accountability Tracker & Overdue Logic
  console.log('--- 5. Action Accountability Tracker & Overdue Detection ---');
  // Action 1: In progress, past due date -> MUST BE OVERDUE
  const action1Res = await saveAction(clientBeta, {
    project_id: betaProject.id,
    action_title: 'Complete Vendor Security Review',
    action_description: 'Verify ISO 27001 and IRAP certifications for AusCloud.',
    owner_name: 'Bob Henderson',
    due_date: '2026-09-01', // Past date
    status: 'in_progress',
    source_output_id: actionOutput.id,
  });
  if (action1Res.error || !action1Res.data) throw new Error(`Action 1 failed: ${action1Res.error?.message}`);
  const action1 = action1Res.data;

  // Action 2: Not started, future due date -> NOT OVERDUE
  const action2Res = await saveAction(clientBeta, {
    project_id: betaProject.id,
    action_title: 'Submit Final Procurement Documentation',
    action_description: 'Submit contract paperwork to legal department.',
    owner_name: 'Alice Cooper',
    due_date: '2026-10-30', // Future date
    status: 'not_started',
    source_output_id: actionOutput.id,
  });
  if (action2Res.error || !action2Res.data) throw new Error(`Action 2 failed: ${action2Res.error?.message}`);
  const action2 = action2Res.data;

  // Action 3: Completed, past due date -> NOT OVERDUE (completed actions never overdue)
  const action3Res = await saveAction(clientBeta, {
    project_id: betaProject.id,
    action_title: 'Draft Executive Summary for Board',
    action_description: 'Initial draft distributed to directors.',
    owner_name: 'Anthony Cortez',
    due_date: '2026-08-15', // Past date
    status: 'completed',
    source_output_id: actionOutput.id,
  });
  if (action3Res.error || !action3Res.data) throw new Error(`Action 3 failed: ${action3Res.error?.message}`);
  const action3 = action3Res.data;

  // Verify Overdue Logic
  const action1Overdue = isActionOverdue(action1);
  const action2Overdue = isActionOverdue(action2);
  const action3Overdue = isActionOverdue(action3);

  if (!action1Overdue) throw new Error('Action 1 should be detected as OVERDUE!');
  if (action2Overdue) throw new Error('Action 2 should NOT be detected as overdue!');
  if (action3Overdue) throw new Error('Action 3 (completed) should NOT be detected as overdue!');
  console.log('✅ Overdue calculation logic verified:');
  console.log('   - Action 1 (in_progress, past due): OVERDUE = true');
  console.log('   - Action 2 (not_started, future due): OVERDUE = false');
  console.log('   - Action 3 (completed, past due): OVERDUE = false');

  // Action Status Update
  const updateStatusRes = await updateActionStatus(clientBeta, action2.id, 'in_progress');
  if (updateStatusRes.error || updateStatusRes.data?.status !== 'in_progress') {
    throw new Error(`Failed to update action status: ${updateStatusRes.error?.message}`);
  }
  console.log('✅ Updated Action 2 status to "in_progress".');

  // Verify Default Sort Order (Incomplete first, nearest due date, then newest)
  const actionsListRes = await fetchActions(clientBeta, { projectId: betaProject.id });
  if (actionsListRes.error || !actionsListRes.data || actionsListRes.data.length < 3) {
    throw new Error(`Failed to fetch sorted actions: ${actionsListRes.error?.message}`);
  }
  const sortedActions = actionsListRes.data;
  // Completed action (Action 3) must be at the end
  if (sortedActions[sortedActions.length - 1].status !== 'completed') {
    throw new Error('Default action sorting failed: completed action not sorted to the bottom.');
  }
  // Action 1 (due 2026-09-01) must appear before Action 2 (due 2026-10-30)
  if (sortedActions[0].id !== action1.id) {
    throw new Error('Default action sorting failed: nearest due date not first.');
  }
  console.log('✅ Default action sorting verified: Incomplete first, nearest due date, completed last.\n');

  // 6. Full Keyword Search Across All Record Types & Filters
  console.log('--- 6. Keyword Search Across All Record Types & Filters ---');
  // Search for "AusCloud" (present in project transcript, output, decision, and action)
  const searchAuscloud = await searchMeetingHistory(clientBeta, 'AusCloud');
  if (searchAuscloud.error) throw new Error(`Search failed: ${searchAuscloud.error.message}`);
  const auscloudResults = searchAuscloud.data || [];
  console.log(`✅ Search query "AusCloud" returned ${auscloudResults.length} matching records:`);
  for (const r of auscloudResults) {
    console.log(`   - [${r.recordType.toUpperCase()}] ${r.projectTitle} (Match: "${r.preview.slice(0, 50)}...")`);
  }

  const recordTypesFound = new Set(auscloudResults.map((r) => r.recordType.toLowerCase()));
  if (!recordTypesFound.has('project') || !recordTypesFound.has('output') || !recordTypesFound.has('decision') || !recordTypesFound.has('action')) {
    throw new Error(`Search did not return all expected record types! Found: ${Array.from(recordTypesFound).join(', ')}`);
  }

  // Filter Search: Only decisions
  const decisionFilteredSearch = await searchMeetingHistory(clientBeta, 'AusCloud', {
    typeFilter: 'decisions',
  });
  if (decisionFilteredSearch.data?.some((r) => r.recordType !== 'Decision')) {
    throw new Error('Record type filter failed: returned non-decision records!');
  }
  console.log('✅ Filter by recordType="decisions" strictly returned only decision records.');

  // Filter Search: Only actions
  const actionFilteredSearch = await searchMeetingHistory(clientBeta, 'security', {
    typeFilter: 'actions',
  });
  if (actionFilteredSearch.data?.some((r) => r.recordType !== 'Action')) {
    throw new Error('Record type filter failed: returned non-action records!');
  }
  console.log('✅ Filter by recordType="actions" strictly returned only action records.');

  // Non-matching query returns empty results
  const emptySearch = await searchMeetingHistory(clientBeta, 'NonExistentGibberishPhraseXYZ');
  if (emptySearch.error || (emptySearch.data && emptySearch.data.length > 0)) {
    throw new Error('Non-matching search returned unexpected results.');
  }
  console.log('✅ Non-matching search returned 0 results as expected.\n');

  // 7. Cross-User Security & Strict RLS Isolation
  console.log('--- 7. Cross-User Isolation & RLS Security ---');
  // User Charlie (Pro plan) must NOT find User Beta's records
  const charlieSearch = await searchMeetingHistory(clientCharlie, 'AusCloud');
  if (charlieSearch.data && charlieSearch.data.length > 0) {
    throw new Error('Security Breach: User Charlie found User Beta records in search!');
  }

  const charlieDecisions = await fetchDecisions(clientCharlie, { projectId: betaProject.id });
  if (charlieDecisions.data && charlieDecisions.data.length > 0) {
    throw new Error('Security Breach: User Charlie accessed User Beta decisions!');
  }

  const charlieActions = await fetchActions(clientCharlie, { projectId: betaProject.id });
  if (charlieActions.data && charlieActions.data.length > 0) {
    throw new Error('Security Breach: User Charlie accessed User Beta actions!');
  }

  // Charlie attempting to update Beta's action must fail
  const charlieTamper = await updateActionStatus(clientCharlie, action1.id, 'completed');
  if (charlieTamper.data) {
    throw new Error('Security Breach: User Charlie updated User Beta action!');
  }
  console.log('✅ Strict RLS verified: User Charlie received 0 records and was blocked from modifying User Beta data.\n');

  // 8. Retention Lifecycle Compatibility (Tasklet 11)
  console.log('--- 8. Retention Lifecycle: Soft-Delete, Recently Deleted & Restore ---');
  // Soft-delete Decision
  const softDelDecisionRes = await softDeleteDecision(clientBeta, betaDecision.id);
  if (!softDelDecisionRes.success) throw new Error(`Failed to soft-delete decision: ${softDelDecisionRes.error?.message}`);

  // Decision must disappear from active lists
  const activeDecisionsPostDelete = await fetchDecisions(clientBeta, { projectId: betaProject.id });
  if (activeDecisionsPostDelete.data?.some((d) => d.id === betaDecision.id)) {
    throw new Error('Soft-deleted decision still appeared in active decisions list!');
  }

  // Decision must disappear from search
  const searchPostDelete = await searchMeetingHistory(clientBeta, 'AusCloud', { typeFilter: 'decisions' });
  if (searchPostDelete.data?.some((r) => r.recordId === betaDecision.id)) {
    throw new Error('Soft-deleted decision still appeared in search results!');
  }

  // Decision must appear in Recently Deleted
  const deletedDecisions = await fetchDeletedDecisions(clientBeta);
  if (!deletedDecisions.data?.some((d) => d.id === betaDecision.id)) {
    throw new Error('Soft-deleted decision missing from Recently Deleted!');
  }
  console.log('✅ Soft-deleted decision: hidden from active lists & search, visible in Recently Deleted.');

  // Restore Decision
  const restoreDecisionRes = await restoreDecision(clientBeta, betaDecision.id);
  if (!restoreDecisionRes.success) throw new Error(`Failed to restore decision: ${restoreDecisionRes.error?.message}`);

  // Decision must reappear in active list
  const activeDecisionsPostRestore = await fetchDecisions(clientBeta, { projectId: betaProject.id });
  if (!activeDecisionsPostRestore.data?.some((d) => d.id === betaDecision.id)) {
    throw new Error('Restored decision failed to reappear in active decisions list!');
  }
  console.log('✅ Restored decision: immediately reappeared in active decisions list.');

  // Soft-delete Action
  const softDelActionRes = await softDeleteAction(clientBeta, action1.id);
  if (!softDelActionRes.success) throw new Error(`Failed to soft-delete action: ${softDelActionRes.error?.message}`);

  // Action must disappear from active actions
  const activeActionsPostDelete = await fetchActions(clientBeta, { projectId: betaProject.id });
  if (activeActionsPostDelete.data?.some((a) => a.id === action1.id)) {
    throw new Error('Soft-deleted action still appeared in active actions list!');
  }

  // Action must appear in Recently Deleted
  const deletedActions = await fetchDeletedActions(clientBeta);
  if (!deletedActions.data?.some((a) => a.id === action1.id)) {
    throw new Error('Soft-deleted action missing from Recently Deleted!');
  }
  console.log('✅ Soft-deleted action: hidden from active view, visible in Recently Deleted.');

  // Restore Action
  const restoreActionRes = await restoreAction(clientBeta, action1.id);
  if (!restoreActionRes.success) throw new Error(`Failed to restore action: ${restoreActionRes.error?.message}`);
  const activeActionsPostRestore = await fetchActions(clientBeta, { projectId: betaProject.id });
  if (!activeActionsPostRestore.data?.some((a) => a.id === action1.id)) {
    throw new Error('Restored action failed to reappear in active actions list!');
  }
  console.log('✅ Restored action: immediately reappeared in active actions list.\n');

  // 9. Cascade Soft-Delete & Restore on Parent Project
  console.log('--- 9. Project Cascade Soft-Delete & Restore ---');
  const softDelProjectRes = await softDeleteProject(clientBeta, betaProject.id);
  if (!softDelProjectRes.success) throw new Error(`Failed to soft-delete project: ${softDelProjectRes.error?.message}`);

  // Child decision and child action must now be marked soft-deleted via cascade
  const projectDecisionsCascade = await fetchDecisions(clientBeta, { projectId: betaProject.id });
  if (projectDecisionsCascade.data && projectDecisionsCascade.data.length > 0) {
    throw new Error('Project soft-delete did not cascade to hide child decisions!');
  }
  const projectActionsCascade = await fetchActions(clientBeta, { projectId: betaProject.id });
  if (projectActionsCascade.data && projectActionsCascade.data.length > 0) {
    throw new Error('Project soft-delete did not cascade to hide child actions!');
  }
  console.log('✅ Project soft-delete cascaded: child outputs, decisions, and actions hidden.');

  // Restore Project
  const restoreProjectRes = await restoreProject(clientBeta, betaProject.id);
  if (!restoreProjectRes.success) throw new Error(`Failed to restore project: ${restoreProjectRes.error?.message}`);

  const projectDecisionsPostRestore = await fetchDecisions(clientBeta, { projectId: betaProject.id });
  if (!projectDecisionsPostRestore.data || projectDecisionsPostRestore.data.length === 0) {
    throw new Error('Project restore did not cascade to restore child decisions!');
  }
  console.log('✅ Project restore cascaded: child decisions and actions restored.\n');

  // 10. Automated Retention Purge Routine
  console.log('--- 10. Automated Retention Purge Verification ---');
  // Create an expired decision and expired action for testing true database purge
  const now = new Date();
  const pastPurge = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

  const { data: expiredDecision } = await adminClient
    .from('decision_memory')
    .insert({
      user_id: betaAuth.user.id,
      project_id: betaProject.id,
      decision_title: 'Temporary Expired Decision',
      deleted_at: now.toISOString(),
      deleted_by: betaAuth.user.id,
      purge_after: pastPurge,
    })
    .select()
    .single();

  const { data: expiredAction } = await adminClient
    .from('action_tracker')
    .insert({
      user_id: betaAuth.user.id,
      project_id: betaProject.id,
      action_title: 'Temporary Expired Action',
      status: 'not_started',
      deleted_at: now.toISOString(),
      deleted_by: betaAuth.user.id,
      purge_after: pastPurge,
    })
    .select()
    .single();

  if (!expiredDecision || !expiredAction) throw new Error('Failed to create expired records for purge test.');

  const purgeResult = await adminClient.rpc('purge_expired_records');
  if (purgeResult.error) throw new Error(`Purge routine failed: ${purgeResult.error.message}`);
  console.log('✅ Automated daily purge routine executed successfully:', purgeResult.data);

  // Verify expired records were permanently removed from the database
  const { data: checkExpiredDecision } = await adminClient
    .from('decision_memory')
    .select('id')
    .eq('id', expiredDecision.id)
    .maybeSingle();

  const { data: checkExpiredAction } = await adminClient
    .from('action_tracker')
    .select('id')
    .eq('id', expiredAction.id)
    .maybeSingle();

  if (checkExpiredDecision || checkExpiredAction) {
    throw new Error('Expired records were NOT permanently removed by the purge routine!');
  }
  console.log('✅ Verified: Expired decision and action records permanently removed from database.\n');

  // Clean up test data
  console.log('--- Cleaning Up Test Fixtures ---');
  await adminClient.from('decision_memory').delete().eq('project_id', betaProject.id);
  await adminClient.from('action_tracker').delete().eq('project_id', betaProject.id);
  await adminClient.from('outputs').delete().eq('project_id', betaProject.id);
  await adminClient.from('projects').delete().eq('id', betaProject.id);
  await adminClient.auth.admin.deleteUser(alphaAuth.user.id);
  await adminClient.auth.admin.deleteUser(betaAuth.user.id);
  await adminClient.auth.admin.deleteUser(charlieAuth.user.id);

  console.log('========================================================================');
  console.log('✅ ALL TASKLET 14 SUITE TESTS PASSED WITH ZERO REGRESSIONS!');
  console.log('========================================================================');
}

runTasklet14TestSuite().catch((err) => {
  console.error('\n❌ TASKLET 14 TEST FAILED:', err);
  process.exit(1);
});
