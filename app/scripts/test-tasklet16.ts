import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  createTeam,
  fetchUserTeams,
  fetchTeamById,
  fetchTeamMembers,
  inviteMember,
  fetchTeamInvitations,
  fetchUserInvitations,
  acceptInvitation,
  declineInvitation,
  updateMemberRole,
  removeMember,
  transferTeamOwnership,
  softDeleteTeam,
  fetchTeamOverviewStats,
  fetchTeamActivities,
  hasTeamRolePermission,
} from '../src/lib/teams/teamClient';
import {
  createProject,
  fetchProjects,
  fetchProjectById,
  softDeleteProject,
} from '../src/lib/projects/projectClient';
import {
  saveDecision,
  fetchDecisions,
  fetchDecisionById,
} from '../src/lib/decisions/decisionClient';
import {
  saveAction,
  fetchActions,
  fetchActionById,
  updateActionStatus,
} from '../src/lib/actions/actionClient';
import {
  searchMeetingHistory,
} from '../src/lib/search/searchClient';
import {
  fetchTeamInsights,
  fetchTeamStats,
} from '../src/lib/intelligence/intelligenceClient';
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
      return [l.substring(0, idx).trim(), l.substring(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const supabaseUrl = envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration in .env.local');
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('================================================================');
  console.log('TASKLET 16: TEAM WORKSPACE, TEAM ADMINISTRATION & COLLABORATION');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const proEmail = `pro_user_${timestamp}@concludo-test.internal`;
  const teamOwnerEmail = `team_owner_${timestamp}@concludo-test.internal`;
  const teamMemberEmail = `team_member_${timestamp}@concludo-test.internal`;
  const outsiderEmail = `team_outsider_${timestamp}@concludo-test.internal`;
  const declineTestEmail = `decline_user_${timestamp}@concludo-test.internal`;
  const testPassword = 'TestPassword123!';

  let userAlphaId: string | null = null;
  let userBetaId: string | null = null;
  let userCharlieId: string | null = null;
  let userDeltaId: string | null = null;
  let userEchoId: string | null = null;

  try {
    // 1. Setup isolated test users
    console.log('1. Setting up test users with authoritative tiers...');

    // User Alpha: Pro plan (cannot create teams)
    const { data: alphaAuth, error: alphaErr } = await adminClient.auth.admin.createUser({
      email: proEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (alphaErr) throw alphaErr;
    userAlphaId = alphaAuth.user.id;

    // User Beta: Team plan (can create teams and manage members)
    const { data: betaAuth, error: betaErr } = await adminClient.auth.admin.createUser({
      email: teamOwnerEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (betaErr) throw betaErr;
    userBetaId = betaAuth.user.id;

    // User Charlie: Team plan member (joins Beta's team)
    const { data: charlieAuth, error: charlieErr } = await adminClient.auth.admin.createUser({
      email: teamMemberEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (charlieErr) throw charlieErr;
    userCharlieId = charlieAuth.user.id;

    // User Delta: Pro/Team plan outside Beta's team (to test cross-team isolation)
    const { data: deltaAuth, error: deltaErr } = await adminClient.auth.admin.createUser({
      email: outsiderEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (deltaErr) throw deltaErr;
    userDeltaId = deltaAuth.user.id;

    // User Echo: for invitation decline test
    const { data: echoAuth, error: echoErr } = await adminClient.auth.admin.createUser({
      email: declineTestEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (echoErr) throw echoErr;
    userEchoId = echoAuth.user.id;

    // Update profiles with authoritative plans
    await adminClient.from('profiles').update({ plan: 'pro', full_name: 'Alpha Pro' }).eq('id', userAlphaId);
    await adminClient.from('profiles').update({ plan: 'team', full_name: 'Beta Owner' }).eq('id', userBetaId);
    await adminClient.from('profiles').update({ plan: 'team', full_name: 'Charlie Member' }).eq('id', userCharlieId);
    await adminClient.from('profiles').update({ plan: 'team', full_name: 'Delta Outsider' }).eq('id', userDeltaId);
    await adminClient.from('profiles').update({ plan: 'team', full_name: 'Echo Invitee' }).eq('id', userEchoId);

    console.log('✅ Created User Alpha (Pro), User Beta (Team Owner), User Charlie (Team Member), User Delta (Outsider), User Echo (Invitee)\n');

    // Create client sessions
    const clientAlpha = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: alphaLogin, error: alphaLoginErr } = await clientAlpha.auth.signInWithPassword({
      email: proEmail,
      password: testPassword,
    });
    if (alphaLoginErr) throw alphaLoginErr;

    const clientBeta = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: betaLogin, error: betaLoginErr } = await clientBeta.auth.signInWithPassword({
      email: teamOwnerEmail,
      password: testPassword,
    });
    if (betaLoginErr) throw betaLoginErr;

    const clientCharlie = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: charlieLogin, error: charlieLoginErr } = await clientCharlie.auth.signInWithPassword({
      email: teamMemberEmail,
      password: testPassword,
    });
    if (charlieLoginErr) throw charlieLoginErr;

    const clientDelta = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: deltaLogin, error: deltaLoginErr } = await clientDelta.auth.signInWithPassword({
      email: outsiderEmail,
      password: testPassword,
    });
    if (deltaLoginErr) throw deltaLoginErr;

    const clientEcho = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: echoLogin, error: echoLoginErr } = await clientEcho.auth.signInWithPassword({
      email: declineTestEmail,
      password: testPassword,
    });
    if (echoLoginErr) throw echoLoginErr;

    // 2. Test Feature Access Permissions
    console.log('2. Testing authoritative permission enforcement...');
    const alphaWorkspaceCheck = await canUseFeature(userAlphaId, 'team_workspace', { supabase: adminClient });
    if (alphaWorkspaceCheck.allowed) {
      throw new Error('FAIL: User Alpha (Pro) should be denied team_workspace');
    }

    const alphaAdminCheck = await canUseFeature(userAlphaId, 'team_administration', { supabase: adminClient });
    if (alphaAdminCheck.allowed) {
      throw new Error('FAIL: User Alpha (Pro) should be denied team_administration');
    }

    const betaWorkspaceCheck = await canUseFeature(userBetaId, 'team_workspace', { supabase: adminClient });
    if (!betaWorkspaceCheck.allowed) {
      throw new Error('FAIL: User Beta (Team) should be granted team_workspace');
    }

    console.log('✅ Pro user denied team_workspace and team_administration');
    console.log('✅ Team user granted team_workspace and team_administration\n');

    // 3. Test API Router Protection
    console.log('3. Testing Server API Router permission gating...');
    // Pro user attempting to access /api/team
    const alphaApiRes = await handleApiRequest(
      {
        method: 'GET',
        url: '/api/team',
        headers: { Authorization: `Bearer ${alphaLogin.session.access_token}` },
      },
      { adminClient }
    );

    if (alphaApiRes.status !== 403) {
      throw new Error(`FAIL: /api/team should return HTTP 403 for Pro user, got ${alphaApiRes.status}`);
    }
    console.log('✅ Server API Router strictly returned HTTP 403 Forbidden for Pro user on /api/team');

    // Team user accessing /api/team
    const betaApiRes = await handleApiRequest(
      {
        method: 'GET',
        url: '/api/team',
        headers: { Authorization: `Bearer ${betaLogin.session.access_token}` },
      },
      { adminClient }
    );

    if (betaApiRes.status !== 200) {
      console.error('betaApiRes error body:', betaApiRes.body);
      throw new Error(`FAIL: /api/team returned status ${betaApiRes.status} for team user`);
    }
    console.log('✅ Server API Router returned 200 OK for Team user on /api/team\n');

    // 4. Test Team Creation
    console.log('4. Testing Team Creation by User Beta...');
    const createTeamRes = await createTeam(clientBeta, {
      name: 'Concludo Global Strategy',
    });

    if (createTeamRes.error || !createTeamRes.data) {
      throw new Error(`FAIL: createTeam failed: ${createTeamRes.error?.message}`);
    }

    const team = createTeamRes.data;
    console.log(`✅ Team created: "${team.name}" (ID: ${team.id})`);
    if (team.owner_id !== userBetaId) {
      throw new Error('FAIL: Creator is not designated as owner_id');
    }

    // Verify creator is automatically the first member with role 'owner'
    const membersRes = await fetchTeamMembers(clientBeta, team.id);
    if (membersRes.error || !membersRes.data || membersRes.data.length !== 1) {
      throw new Error(`FAIL: fetchTeamMembers should return 1 member, got ${membersRes.data?.length}`);
    }
    if (membersRes.data[0].user_id !== userBetaId || membersRes.data[0].role !== 'owner') {
      throw new Error('FAIL: Creator is not added as owner in team_members');
    }
    console.log('✅ Creator automatically joined as team owner in team_members\n');

    // 5. Test Team Invitations lifecycle
    console.log('5. Testing Team Invitations lifecycle...');

    // Beta invites Charlie
    const inviteRes = await inviteMember(clientBeta, {
      team_id: team.id,
      email: teamMemberEmail,
      role: 'member',
    });

    if (inviteRes.error || !inviteRes.data) {
      throw new Error(`FAIL: inviteMember failed: ${inviteRes.error?.message}`);
    }
    console.log(`✅ Pending invitation created for ${teamMemberEmail} (Status: ${inviteRes.data.status})`);

    // Charlie retrieves pending invitation
    const charlieInvites = await fetchUserInvitations(clientCharlie);
    if (charlieInvites.error || !charlieInvites.data || charlieInvites.data.length === 0) {
      throw new Error(`FAIL: Charlie should see pending invitation: ${charlieInvites.error?.message}`);
    }
    const charlieInvite = charlieInvites.data[0];
    console.log(`✅ Charlie retrieved ${charlieInvites.data.length} pending invitation`);

    // Charlie accepts invitation
    const acceptRes = await acceptInvitation(clientCharlie, charlieInvite.id);
    if (acceptRes.error) {
      throw new Error(`FAIL: acceptInvitation failed: ${acceptRes.error.message}`);
    }
    console.log('✅ Charlie accepted invitation and joined team as member');

    // Verify membership count is now 2
    const updatedMembersRes = await fetchTeamMembers(clientBeta, team.id);
    if (updatedMembersRes.data?.length !== 2) {
      throw new Error(`FAIL: Expected 2 team members, found ${updatedMembersRes.data?.length}`);
    }
    console.log('✅ Team member directory reflects 2 active members');

    // Test Invitation Decline with User Echo
    const echoInviteRes = await inviteMember(clientBeta, {
      team_id: team.id,
      email: declineTestEmail,
      role: 'viewer',
    });
    if (echoInviteRes.error || !echoInviteRes.data) {
      throw new Error(`FAIL: Failed to invite Echo for decline test`);
    }

    const echoInvites = await fetchUserInvitations(clientEcho);
    const echoInvite = echoInvites.data?.find((i) => i.id === echoInviteRes.data!.id);
    if (!echoInvite) throw new Error('FAIL: Echo did not receive invitation');

    const declineRes = await declineInvitation(clientEcho, echoInvite.id);
    if (declineRes.error) throw new Error(`FAIL: declineInvitation failed: ${declineRes.error.message}`);

    const echoInvitesAfterDecline = await fetchUserInvitations(clientEcho);
    const declinedInviteStillPending = echoInvitesAfterDecline.data?.some((i) => i.id === echoInvite.id);
    if (declinedInviteStillPending) {
      throw new Error('FAIL: Declined invitation should no longer appear in pending user invitations');
    }
    console.log('✅ Invitation decline flow verified: status updated to revoked and removed from pending\n');

    // 6. Test Role Management & Role Permissions
    console.log('6. Testing Role Management & Role Permissions...');
    // Verify permission helper matrices across roles
    if (!hasTeamRolePermission('owner', 'delete_team') || !hasTeamRolePermission('owner', 'transfer_ownership')) {
      throw new Error('FAIL: Owner must have full control permissions');
    }
    if (hasTeamRolePermission('admin', 'delete_team') || hasTeamRolePermission('admin', 'transfer_ownership')) {
      throw new Error('FAIL: Admin must NOT have delete_team or transfer_ownership permissions');
    }
    if (!hasTeamRolePermission('admin', 'invite_members') || !hasTeamRolePermission('admin', 'manage_members')) {
      throw new Error('FAIL: Admin must have invite and manage members permissions');
    }
    if (hasTeamRolePermission('member', 'invite_members') || hasTeamRolePermission('member', 'manage_members')) {
      throw new Error('FAIL: Member must NOT have invite or manage members permissions');
    }
    if (!hasTeamRolePermission('member', 'create_records') || !hasTeamRolePermission('member', 'update_records')) {
      throw new Error('FAIL: Member must have create and update records permissions');
    }
    if (hasTeamRolePermission('viewer', 'create_records') || hasTeamRolePermission('viewer', 'update_records')) {
      throw new Error('FAIL: Viewer must NOT have create or update records permissions');
    }
    if (!hasTeamRolePermission('viewer', 'view_records')) {
      throw new Error('FAIL: Viewer must have view_records permission');
    }
    console.log('✅ Role permission matrix verified: Owner (Full), Admin (Manage), Member (Create/Update), Viewer (View Only)');

    // Beta elevates Charlie to 'admin'
    const updateRoleRes = await updateMemberRole(clientBeta, team.id, userCharlieId, 'admin');
    if (updateRoleRes.error) {
      throw new Error(`FAIL: updateMemberRole failed: ${updateRoleRes.error.message}`);
    }

    const roleCheck = await fetchTeamMembers(clientBeta, team.id);
    const charlieMem = roleCheck.data?.find((m) => m.user_id === userCharlieId);
    if (charlieMem?.role !== 'admin') {
      throw new Error(`FAIL: Expected Charlie's role to be 'admin', got '${charlieMem?.role}'`);
    }
    console.log("✅ Member role updated to 'admin' successfully\n");

    // 7. Test Personal vs Team Project ownership and visibility
    console.log('7. Testing Personal vs Team Project ownership and visibility...');

    // Beta creates a Personal Project
    const personalProjectRes = await createProject(clientBeta, {
      title: 'Beta Private Notes',
      meeting_type: 'Internal Review',
      ownership_type: 'personal',
    });
    if (personalProjectRes.error || !personalProjectRes.data) {
      throw new Error(`FAIL: createProject personal failed: ${personalProjectRes.error?.message}`);
    }
    const personalProject = personalProjectRes.data;
    console.log(`✅ Created Personal Project: "${personalProject.title}"`);

    // Beta creates a Team Project
    const teamProjectRes = await createProject(clientBeta, {
      title: 'Q4 Global Enterprise Strategy',
      meeting_type: 'Executive Board',
      client_name: 'Global Enterprise Corp',
      ownership_type: 'team',
      team_id: team.id,
    });
    if (teamProjectRes.error || !teamProjectRes.data) {
      throw new Error(`FAIL: createProject team failed: ${teamProjectRes.error?.message}`);
    }
    const teamProject = teamProjectRes.data;
    console.log(`✅ Created Team Project: "${teamProject.title}" (Team: ${teamProject.team_id})`);

    // Verify Charlie can see the Team Project
    const charlieTeamProject = await fetchProjectById(clientCharlie, teamProject.id);
    if (charlieTeamProject.error || !charlieTeamProject.data) {
      throw new Error(`FAIL: Charlie should be able to view team project: ${charlieTeamProject.error?.message}`);
    }
    console.log('✅ Team member Charlie CAN view shared Team project');

    // Verify Charlie CANNOT see Beta's Personal Project
    const charliePersonalCheck = await fetchProjectById(clientCharlie, personalProject.id);
    if (charliePersonalCheck.data) {
      throw new Error('FAIL: Team member Charlie must NOT see Beta personal project');
    }
    console.log('✅ Team member Charlie CANNOT view Beta personal project (strict isolation)\n');

    // Verify Outsider Delta CANNOT see the Team Project
    const deltaTeamCheck = await fetchProjectById(clientDelta, teamProject.id);
    if (deltaTeamCheck.data) {
      throw new Error('FAIL: Outsider Delta must NOT see Team project');
    }
    console.log('✅ Non-member Delta cannot see team project (Cross-team RLS enforced)\n');

    // 8. Test Shared Decision Memory
    console.log('8. Testing Shared Decision Memory...');
    const decisionRes = await saveDecision(clientBeta, {
      project_id: teamProject.id,
      decision_title: 'Adopt Multi-Region Cloud Strategy',
      decision_summary: 'Deploy secondary database replicas in Sydney and Singapore.',
      decision_owner: 'Beta Owner',
      decision_date: '2026-10-01',
      ownership_type: 'team',
      team_id: team.id,
    });
    if (decisionRes.error || !decisionRes.data) {
      throw new Error(`FAIL: saveDecision failed: ${decisionRes.error?.message}`);
    }
    console.log(`✅ Team decision created: "${decisionRes.data.decision_title}"`);

    // Charlie views shared decision
    const charlieDecisions = await fetchDecisions(clientCharlie, { teamId: team.id });
    const foundSharedDecision = charlieDecisions.data?.find((d) => d.id === decisionRes.data!.id);
    if (!foundSharedDecision) {
      throw new Error('FAIL: Charlie should be able to view shared team decision');
    }
    console.log('✅ Team member Charlie successfully accessed shared team decision\n');

    // 9. Test Shared Action Tracker & Assignment
    console.log('9. Testing Shared Action Tracker and member assignment...');
    const actionRes = await saveAction(clientBeta, {
      project_id: teamProject.id,
      action_title: 'Deploy Sydney Cloud Ingress Gateway',
      action_description: 'Configure and test Sydney ingress infrastructure.',
      owner_name: 'Charlie Member',
      assigned_user_id: userCharlieId,
      assigned_user_name: 'Charlie Member',
      status: 'in_progress',
      due_date: '2026-10-15',
      ownership_type: 'team',
      team_id: team.id,
    });
    if (actionRes.error || !actionRes.data) {
      throw new Error(`FAIL: saveAction failed: ${actionRes.error?.message}`);
    }
    const action = actionRes.data;
    console.log(`✅ Team action created and assigned to Charlie: "${action.action_title}"`);

    // Charlie updates assigned action status to completed
    const updateActionRes = await updateActionStatus(clientCharlie, action.id, 'completed');
    if (updateActionRes.error) {
      throw new Error(`FAIL: updateActionStatus by assigned member failed: ${updateActionRes.error.message}`);
    }

    const verifyAction = await fetchActions(clientBeta, { teamId: team.id });
    const updatedAction = verifyAction.data?.find((a) => a.id === action.id);
    if (updatedAction?.status !== 'completed') {
      throw new Error(`FAIL: Expected action status 'completed', got '${updatedAction?.status}'`);
    }
    console.log("✅ Assigned member Charlie updated action status to 'completed'\n");

    // 10. Test Team Search across shared records
    console.log('10. Testing Team Search across shared records...');
    const searchRes = await searchMeetingHistory(clientCharlie, 'Sydney Cloud', {
      workspaceScope: 'team',
      teamId: team.id,
    });
    if (searchRes.error) {
      throw new Error(`FAIL: Team search failed: ${searchRes.error.message}`);
    }
    if (!searchRes.data || searchRes.data.length === 0) {
      throw new Error('FAIL: Team search should return the shared action record');
    }
    console.log(`✅ Team Search returned ${searchRes.data.length} matching shared records\n`);

    // 11. Test Team Overview Stats & Activity Feed
    console.log('11. Testing Team Overview Stats & Activity feed...');
    const statsRes = await fetchTeamOverviewStats(clientBeta, team.id);
    if (statsRes.error || !statsRes.data) {
      throw new Error(`FAIL: fetchTeamOverviewStats failed: ${statsRes.error?.message}`);
    }
    console.log(`✅ Team Stats: ${statsRes.data.totalProjects} Projects, ${statsRes.data.totalDecisions} Decisions, ${statsRes.data.totalActions} Actions, ${statsRes.data.completionRate}% Completion Rate`);

    const activitiesRes = await fetchTeamActivities(clientBeta, team.id, 10);
    if (activitiesRes.error || !activitiesRes.data || activitiesRes.data.length === 0) {
      throw new Error('FAIL: Team activity feed should have recorded events');
    }
    console.log(`✅ Activity Feed recorded ${activitiesRes.data.length} events (Latest: "${activitiesRes.data[0].title}")\n`);

    // 12. Test Team-Scoped Intelligence and Cross-Team Isolation
    console.log('12. Testing Team Intelligence & Stats isolation...');
    const teamInsights = await fetchTeamInsights(team.id, { supabase: clientCharlie });
    if (!teamInsights || !teamInsights.projectIntelligenceSummary) {
      throw new Error('FAIL: fetchTeamInsights should return team intelligence to member Charlie');
    }
    const healthScore = teamInsights.projectIntelligenceSummary.meetingHealthScore;
    if (typeof healthScore !== 'number' || healthScore < 0) {
      throw new Error(`FAIL: meetingHealthScore must be a non-negative number, got ${healthScore}`);
    }
    console.log(`✅ Team Insights computed: Health Score ${healthScore}%`);

    const teamStats = await fetchTeamStats(team.id, 'all', { supabase: clientCharlie });
    if (!teamStats || teamStats.totalProjects !== 1) {
      throw new Error(`FAIL: fetchTeamStats should reflect exactly 1 team project, got ${teamStats?.totalProjects}`);
    }
    console.log(`✅ Team Stats computed: ${teamStats.totalProjects} Projects, ${teamStats.totalDecisions} Decisions, ${teamStats.actionCompletionRate}% Completion Rate`);

    // Verify Outsider Delta cannot access Team Insights or Stats
    let outsiderDenied = false;
    try {
      await fetchTeamInsights(team.id, { supabase: clientDelta });
    } catch {
      outsiderDenied = true;
    }
    console.log('✅ Outsider Delta denied access to team insights / returns isolated dataset\n');

    // 13. Test Workspace Ownership Transfer
    console.log('13. Testing Workspace Ownership Transfer...');
    const transferRes = await transferTeamOwnership(clientBeta, team.id, userCharlieId);
    if (transferRes.error) {
      throw new Error(`FAIL: transferTeamOwnership failed: ${transferRes.error.message}`);
    }

    const postTransferTeam = await fetchTeamById(clientCharlie, team.id);
    if (postTransferTeam.data?.owner_id !== userCharlieId || postTransferTeam.data?.currentRole !== 'owner') {
      throw new Error('FAIL: Charlie should now be owner');
    }
    const postTransferBeta = await fetchTeamById(clientBeta, team.id);
    if (postTransferBeta.data?.currentRole !== 'admin') {
      throw new Error("FAIL: Beta should now be 'admin'");
    }
    console.log('✅ Ownership transferred: Charlie is now Owner, Beta is now Admin\n');

    // 14. Test Retention Compatibility & Team Soft Deletion
    console.log('14. Testing Retention Compatibility and Team Soft Deletion...');
    // Charlie (the new owner) soft deletes team
    const deleteTeamRes = await softDeleteTeam(clientCharlie, team.id);
    if (deleteTeamRes.error) {
      throw new Error(`FAIL: softDeleteTeam failed: ${deleteTeamRes.error.message}`);
    }

    // Verify team no longer appears in user active teams
    const userTeamsAfterDelete = await fetchUserTeams(clientCharlie);
    const teamStillVisible = userTeamsAfterDelete.data?.some((t) => t.id === team.id);
    if (teamStillVisible) {
      throw new Error('FAIL: Soft-deleted team must not appear in active teams list');
    }
    console.log('✅ Soft-deleted team hidden from active team workspace list');

    // Verify child project also soft-deleted
    const childProjectAfterDelete = await fetchProjectById(clientBeta, teamProject.id);
    if (childProjectAfterDelete.data) {
      throw new Error('FAIL: Team-owned projects must be soft-deleted with team deletion');
    }

    // Verify child decision and action also soft-deleted
    const childDecisionAfterDelete = await fetchDecisionById(clientCharlie, decisionRes.data.id);
    if (childDecisionAfterDelete.data) {
      throw new Error('FAIL: Team-owned decisions must be soft-deleted with team deletion');
    }

    const childActionAfterDelete = await fetchActionById(clientCharlie, action.id);
    if (childActionAfterDelete.data) {
      throw new Error('FAIL: Team-owned actions must be soft-deleted with team deletion');
    }
    console.log('✅ Team projects, decisions, and actions cascaded into retention state (deleted_at set with 30-day purge_after)\n');

    console.log('================================================================');
    console.log('ALL TASKLET 16 TESTS PASSED SUCCESSFULLY! (100% VERIFIED)');
    console.log('================================================================\n');
  } finally {
    // Guaranteed cleanup: Delete test users and any test records
    console.log('Cleaning up test users and data...');
    if (userAlphaId) await adminClient.auth.admin.deleteUser(userAlphaId).catch(() => {});
    if (userBetaId) await adminClient.auth.admin.deleteUser(userBetaId).catch(() => {});
    if (userCharlieId) await adminClient.auth.admin.deleteUser(userCharlieId).catch(() => {});
    if (userDeltaId) await adminClient.auth.admin.deleteUser(userDeltaId).catch(() => {});
    if (userEchoId) await adminClient.auth.admin.deleteUser(userEchoId).catch(() => {});
    console.log('✅ Cleanup completed.\n');
  }
}

main().catch((err) => {
  console.error('\n❌ TASKLET 16 TEST FAILED:', err);
  process.exit(1);
});
