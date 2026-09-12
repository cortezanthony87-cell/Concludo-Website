import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  createProject,
  fetchProjects,
  softDeleteProject,
  restoreProject,
} from '../src/lib/projects/projectClient';
import {
  saveOutput,
} from '../src/lib/outputs/outputClient';
import {
  saveDecision,
} from '../src/lib/decisions/decisionClient';
import {
  saveAction,
  updateActionStatus,
} from '../src/lib/actions/actionClient';
import {
  processUserIntelligence,
} from '../src/lib/intelligence/intelligenceEngine';
import {
  fetchUserInsights,
  fetchUserStats,
  refreshAllIntelligence,
} from '../src/lib/intelligence/intelligenceClient';
import {
  generateEndpointReport,
  fetchEndpointReports,
  fetchEndpointReportById,
  softDeleteEndpointReport,
  restoreEndpointReport,
  permanentDeleteEndpointReport,
  fetchDeletedEndpointReports,
} from '../src/lib/reports/reportClient';
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
const supabaseAnonKey = envVars.SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('====================================================');
  console.log('TASKLET 15: CONVERSATION INTELLIGENCE, STATS & REPORTS');
  console.log('====================================================\n');

  const timestamp = Date.now();
  const starterEmail = `starter_t15_${timestamp}@concludo-test.internal`;
  const proEmail = `pro_t15_${timestamp}@concludo-test.internal`;
  const otherProEmail = `pro_charlie_t15_${timestamp}@concludo-test.internal`;
  const testPassword = `Pass#${timestamp}!2026`;

  // 1. Setup Test Users
  console.log('1. Setting up isolated test users...');
  const { data: alphaAuth, error: alphaErr } = await adminClient.auth.admin.createUser({
    email: starterEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (alphaErr) throw alphaErr;
  const userAlphaId = alphaAuth.user.id;

  const { data: betaAuth, error: betaErr } = await adminClient.auth.admin.createUser({
    email: proEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (betaErr) throw betaErr;
  const userBetaId = betaAuth.user.id;

  const { data: charlieAuth, error: charlieErr } = await adminClient.auth.admin.createUser({
    email: otherProEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (charlieErr) throw charlieErr;
  const userCharlieId = charlieAuth.user.id;

  // Set plans: Alpha -> starter, Beta -> pro, Charlie -> pro
  await adminClient.from('profiles').update({ plan: 'starter', full_name: 'Alpha Starter' }).eq('id', userAlphaId);
  await adminClient.from('profiles').update({ plan: 'pro', full_name: 'Beta Pro' }).eq('id', userBetaId);
  await adminClient.from('profiles').update({ plan: 'pro', full_name: 'Charlie Pro' }).eq('id', userCharlieId);

  // Authenticate clients
  const clientBeta = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: betaSession } = await clientBeta.auth.signInWithPassword({ email: proEmail, password: testPassword });

  const clientAlpha = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: alphaSession } = await clientAlpha.auth.signInWithPassword({ email: starterEmail, password: testPassword });

  const clientCharlie = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: charlieSession } = await clientCharlie.auth.signInWithPassword({ email: otherProEmail, password: testPassword });

  console.log('✅ Users provisioned: User Alpha (Starter), User Beta (Pro), User Charlie (Pro)');

  // 2. Feature Permission Tests
  console.log('\n2. Testing Feature Access & Tier Enforcement...');
  const alphaInsight = await canUseFeature(userAlphaId, 'insight', { supabase: adminClient });
  const alphaStats = await canUseFeature(userAlphaId, 'stats', { supabase: adminClient });
  const alphaReport = await canUseFeature(userAlphaId, 'endpoint_report', { supabase: adminClient });

  if (alphaInsight.allowed || alphaStats.allowed || alphaReport.allowed) {
    throw new Error('FAILED: Starter user was granted access to Pro intelligence features!');
  }
  console.log('✅ User Alpha (Starter) strictly DENIED access to insight, stats, and endpoint_report');

  const betaInsight = await canUseFeature(userBetaId, 'insight', { supabase: adminClient });
  const betaStats = await canUseFeature(userBetaId, 'stats', { supabase: adminClient });
  const betaReport = await canUseFeature(userBetaId, 'endpoint_report', { supabase: adminClient });

  if (!betaInsight.allowed || !betaStats.allowed || !betaReport.allowed) {
    throw new Error('FAILED: Pro user was denied access to Pro intelligence features!');
  }
  console.log('✅ User Beta (Pro) strictly GRANTED access to insight, stats, and endpoint_report');

  // Test Server API Router permission enforcement
  const apiResStarter = await handleApiRequest({
    method: 'GET',
    url: '/api/insight',
    headers: { Authorization: `Bearer ${alphaSession.session!.access_token}` },
  }, { adminClient });

  if (apiResStarter.status !== 403) {
    throw new Error(`FAILED: Server API returned ${apiResStarter.status} instead of 403 for Starter`);
  }
  console.log('✅ Server API Router returned 403 Forbidden for Starter user on /api/insight');

  const apiResPro = await handleApiRequest({
    method: 'GET',
    url: '/api/insight',
    headers: { Authorization: `Bearer ${betaSession.session!.access_token}` },
  }, { adminClient });

  if (apiResPro.status !== 200) {
    throw new Error(`FAILED: Server API returned ${apiResPro.status} instead of 200 for Pro`);
  }
  console.log('✅ Server API Router returned 200 OK for Pro user on /api/insight');

  // 3. Create Foundation Data for User Beta
  console.log('\n3. Creating Projects, Decisions, and Actions for User Beta...');
  const proj1 = await createProject(clientBeta, {
    title: 'Sovereign Compliance & Architecture Sync',
    meeting_type: 'Executive Review',
    client_name: 'Commonwealth Partner',
    project_name: 'Project Sovereign',
    meeting_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    transcript: 'We discussed compliance protocols, security architecture, and automation expansion for sovereign cloud delivery.',
    notes: 'Key focus on ISO compliance and automation pipelines.',
  });
  if (proj1.error) throw new Error(proj1.error.message);

  const proj2 = await createProject(clientBeta, {
    title: 'Q3 Account Governance & Roadmap',
    meeting_type: 'Sprint Planning',
    client_name: 'Victorian Enterprise',
    project_name: 'Workspace Expansion',
    meeting_date: new Date().toISOString().split('T')[0],
    transcript: 'Reviewing milestone velocity, partner integrations, and action item accountability for the upcoming launch.',
    notes: 'Urgent action items need deadline tracking.',
  });
  if (proj2.error) throw new Error(proj2.error.message);

  // Save Outputs
  await saveOutput(clientBeta, {
    project_id: proj1.data!.id,
    output_type: 'summary',
    content: 'Executive briefing confirming compliance benchmarks and hosting partner sign-off.',
  });

  await saveOutput(clientBeta, {
    project_id: proj2.data!.id,
    output_type: 'decision_log',
    content: 'Key decision to standardise workspace automation and consolidate cloud instances.',
  });

  // Save Decisions
  await saveDecision(clientBeta, {
    project_id: proj1.data!.id,
    decision_title: 'Adopt Australian Sovereign Cloud Hosting',
    decision_summary: 'Consolidate all primary and backup databases into Sydney ap-southeast-2 region.',
    decision_reasoning: 'Compliance with IRAP guidelines and client data sovereignty mandates.',
    decision_owner: 'Anthony Cortez',
    decision_date: new Date().toISOString().split('T')[0],
  });

  await saveDecision(clientBeta, {
    project_id: proj2.data!.id,
    decision_title: 'Standardise Workspace Automation Workflows',
    decision_summary: 'Automate post-meeting action distribution and transcript indexing.',
    decision_reasoning: 'Reduce manual follow-up latency across client engagements.',
    decision_owner: 'Executive Committee',
    decision_date: new Date().toISOString().split('T')[0],
  });

  // Save Actions (1 completed, 1 overdue, 1 blocked, 1 not started)
  const act1 = await saveAction(clientBeta, {
    project_id: proj1.data!.id,
    action_title: 'Publish Sovereign Security Policy Document',
    action_description: 'Finalise draft and circulate to executive sponsors.',
    owner_name: 'Anthony Cortez',
    due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'completed',
  });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const act2 = await saveAction(clientBeta, {
    project_id: proj1.data!.id,
    action_title: 'Complete Infrastructure Penetration Test',
    action_description: 'Engage external security auditor for annual verification.',
    owner_name: 'DevOps Lead',
    due_date: yesterday, // Past due!
    status: 'in_progress',
  });

  const act3 = await saveAction(clientBeta, {
    project_id: proj2.data!.id,
    action_title: 'API Gateway SSL Certificate Renewal',
    action_description: 'Blocked waiting on DNS provider nameserver delegation.',
    owner_name: 'DevOps Lead',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'blocked',
  });

  const act4 = await saveAction(clientBeta, {
    project_id: proj2.data!.id,
    action_title: 'Draft Q4 Account Roadmap Deck',
    action_description: 'Prepare slide deck for quarterly business review.',
    owner_name: 'Anthony Cortez',
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'not_started',
  });

  console.log('✅ Foundation data created: 2 projects, 2 outputs, 2 decisions, 4 actions (1 completed, 1 overdue, 1 blocked, 1 not started)');

  // 4. Intelligence Engine & Insight Generation
  console.log('\n4. Testing Intelligence Engine & Insight Synthesis...');
  const { insight, stats } = await processUserIntelligence(userBetaId, {
    supabase: clientBeta,
    forceRefresh: true,
  });

  if (!insight.keyThemes || insight.keyThemes.length === 0) {
    throw new Error('FAILED: Key themes not synthesized');
  }
  console.log(`✅ Synthesized ${insight.keyThemes.length} Key Themes (Top: "${insight.keyThemes[0].name}")`);

  if (!insight.topRisks || insight.topRisks.length === 0) {
    throw new Error('FAILED: Risks not synthesized');
  }
  const hasOverdueRisk = insight.topRisks.some((r) => r.title.includes('Slippage') || r.title.includes('Overdue') || r.title.includes('Blocker'));
  if (!hasOverdueRisk) {
    throw new Error('FAILED: Overdue action or blocked risk not identified in topRisks');
  }
  console.log(`✅ Synthesized ${insight.topRisks.length} Top Risks (Detected Action Delivery / Blocker Risks)`);

  if (!insight.topOpportunities || insight.topOpportunities.length === 0) {
    throw new Error('FAILED: Opportunities not synthesized');
  }
  console.log(`✅ Synthesized ${insight.topOpportunities.length} Top Opportunities (Top: "${insight.topOpportunities[0].title}")`);

  if (insight.openActionTrends.totalOpen !== 3) {
    throw new Error(`FAILED: Expected 3 open actions, found ${insight.openActionTrends.totalOpen}`);
  }
  if (insight.overdueActionTrends.count !== 1) {
    throw new Error(`FAILED: Expected 1 overdue action, found ${insight.overdueActionTrends.count}`);
  }
  console.log(`✅ Action Trends verified: ${insight.openActionTrends.totalOpen} Open, ${insight.overdueActionTrends.count} Overdue`);

  if (!insight.projectIntelligenceSummary || insight.projectIntelligenceSummary.totalProjects !== 2) {
    throw new Error('FAILED: Project intelligence summary project count mismatch');
  }
  console.log(`✅ Project Intelligence Summary: Health Score ${insight.projectIntelligenceSummary.meetingHealthScore}%, Avg Decisions ${insight.projectIntelligenceSummary.avgDecisionsPerProject}`);

  // Test cached retrieval via fetchUserInsights
  const cachedInsights = await fetchUserInsights({ supabase: clientBeta });
  if (!cachedInsights || cachedInsights.keyThemes.length === 0) {
    throw new Error('FAILED: Cached insights fetch failed');
  }
  console.log('✅ Cached intelligence successfully retrieved from generated_intelligence table');

  // 5. Stats Analytics & Trends
  console.log('\n5. Testing Workspace Analytics & Trends...');
  const userStats = await fetchUserStats('all', { supabase: clientBeta });
  if (userStats.totalProjects !== 2) throw new Error(`Expected 2 projects, got ${userStats.totalProjects}`);
  if (userStats.totalDecisions !== 2) throw new Error(`Expected 2 decisions, got ${userStats.totalDecisions}`);
  if (userStats.totalActions !== 4) throw new Error(`Expected 4 actions, got ${userStats.totalActions}`);
  if (userStats.completedActions !== 1) throw new Error(`Expected 1 completed action, got ${userStats.completedActions}`);
  if (userStats.overdueActions !== 1) throw new Error(`Expected 1 overdue action, got ${userStats.overdueActions}`);
  if (userStats.actionCompletionRate !== 25) throw new Error(`Expected 25% completion rate, got ${userStats.actionCompletionRate}%`);

  // Verify monthly trends
  if (!userStats.trends.projectsCreated || userStats.trends.projectsCreated.length === 0) {
    throw new Error('FAILED: Missing monthly project trends');
  }
  if (!userStats.trends.actionsCreated || userStats.trends.actionsCreated.length === 0) {
    throw new Error('FAILED: Missing monthly action trends');
  }
  console.log(`✅ Stats verified: 2 Projects, 2 Decisions, 4 Actions (25% completion rate, 1 overdue)`);
  console.log(`✅ Trend data verified across ${userStats.trends.projectsCreated.length} monthly intervals`);

  // 6. Endpoint Report Generation & Verification
  console.log('\n6. Testing Executive Endpoint Report Generation & Lifecycle...');
  const newReport = await generateEndpointReport('Last 30 Days', 'Q3 Executive Endpoint Briefing', {
    supabase: clientBeta,
  });

  if (!newReport.id) throw new Error('FAILED: Report ID missing');
  if (newReport.title !== 'Q3 Executive Endpoint Briefing') throw new Error('FAILED: Report title mismatch');

  const content = newReport.report_content;
  if (!content.executiveSummary || content.executiveSummary.length < 20) {
    throw new Error('FAILED: Executive summary missing or too short');
  }
  if (!content.meetingActivity || content.meetingActivity.totalMeetings !== 2) {
    throw new Error('FAILED: Meeting activity section mismatch');
  }
  if (!content.decisionSummary || content.decisionSummary.totalDecisions !== 2) {
    throw new Error('FAILED: Decision summary section mismatch');
  }
  if (!content.actionSummary || content.actionSummary.totalActions !== 4) {
    throw new Error('FAILED: Action summary section mismatch');
  }
  if (content.completionPerformance.completionRate !== 25) {
    throw new Error('FAILED: Completion performance rate mismatch');
  }
  if (!content.recurringThemes || content.recurringThemes.length === 0) {
    throw new Error('FAILED: Recurring themes missing in report');
  }
  if (!content.recurringRisks || content.recurringRisks.length === 0) {
    throw new Error('FAILED: Recurring risks missing in report');
  }
  if (!content.recurringOpportunities || content.recurringOpportunities.length === 0) {
    throw new Error('FAILED: Recurring opportunities missing in report');
  }
  if (!content.recommendedAreasForReview || content.recommendedAreasForReview.length === 0) {
    throw new Error('FAILED: Recommended areas for review missing in report');
  }
  if (!content.projectIntelligenceSummary || content.projectIntelligenceSummary.projectsAnalyzed !== 2) {
    throw new Error('FAILED: Project intelligence summary missing in report');
  }
  console.log('✅ Generated Executive Endpoint Report contains all 10 required sections');

  // Reopen report by ID
  const fetchedReport = await fetchEndpointReportById(newReport.id, { supabase: clientBeta });
  if (!fetchedReport || fetchedReport.id !== newReport.id) {
    throw new Error('FAILED: Could not reopen generated report by ID');
  }
  console.log('✅ Report reopened by ID and verified intact');

  // 7. Retention Framework Compatibility (Tasklet 11)
  console.log('\n7. Testing Retention Framework (Tasklet 11 Integration)...');
  // Soft-delete report
  await softDeleteEndpointReport(newReport.id, { supabase: clientBeta });

  // Verify hidden from active reports
  const activeReports = await fetchEndpointReports({ supabase: clientBeta });
  if (activeReports.some((r) => r.id === newReport.id)) {
    throw new Error('FAILED: Soft-deleted report still returned in active list');
  }
  console.log('✅ Soft-deleted report immediately hidden from active endpoint reports list');

  // Verify visible in Recently Deleted
  const deletedReports = await fetchDeletedEndpointReports({ supabase: clientBeta });
  const foundInDeleted = deletedReports.find((r) => r.id === newReport.id);
  if (!foundInDeleted) {
    throw new Error('FAILED: Soft-deleted report not found in Recently Deleted');
  }
  if (foundInDeleted.days_remaining <= 0 || foundInDeleted.days_remaining > 30) {
    throw new Error(`FAILED: Invalid days_remaining: ${foundInDeleted.days_remaining}`);
  }
  console.log(`✅ Soft-deleted report visible in Recently Deleted with ${foundInDeleted.days_remaining} days remaining`);

  // Restore report
  await restoreEndpointReport(newReport.id, { supabase: clientBeta });
  const restoredReports = await fetchEndpointReports({ supabase: clientBeta });
  if (!restoredReports.some((r) => r.id === newReport.id)) {
    throw new Error('FAILED: Restored report did not return to active list');
  }
  console.log('✅ Restored report immediately returned to active endpoint reports list');

  // Soft-delete a project and verify deleted records DO NOT contribute to intelligence
  await softDeleteProject(clientBeta, proj1.data!.id);
  const refreshedIntelligence = await processUserIntelligence(userBetaId, {
    supabase: clientBeta,
    forceRefresh: true,
  });

  if (refreshedIntelligence.stats.totalProjects !== 1) {
    throw new Error(`FAILED: Expected 1 active project after soft-delete, got ${refreshedIntelligence.stats.totalProjects}`);
  }
  console.log('✅ Deleted project strictly excluded from intelligence and statistics');

  // Restore project
  await restoreProject(clientBeta, proj1.data!.id);

  // Permanent Delete report
  await softDeleteEndpointReport(newReport.id, { supabase: clientBeta });
  await permanentDeleteEndpointReport(newReport.id, { supabase: clientBeta });

  const postPermanentDeleted = await fetchDeletedEndpointReports({ supabase: clientBeta });
  if (postPermanentDeleted.some((r) => r.id === newReport.id)) {
    throw new Error('FAILED: Permanently deleted report still in database');
  }
  console.log('✅ Report permanently deleted and purged from database');

  // 8. Cross-User Security & RLS Tests
  console.log('\n8. Testing Strict Cross-User Security & RLS Isolation...');
  // User Charlie queries generated_intelligence
  const { data: charlieIntel } = await clientCharlie
    .from('generated_intelligence')
    .select('*')
    .eq('user_id', userBetaId);

  if (charlieIntel && charlieIntel.length > 0) {
    throw new Error('FAILED: User Charlie was able to view User Beta intelligence records!');
  }

  // User Charlie queries endpoint_reports
  const { data: charlieReports } = await clientCharlie
    .from('endpoint_reports')
    .select('*')
    .eq('user_id', userBetaId);

  if (charlieReports && charlieReports.length > 0) {
    throw new Error('FAILED: User Charlie was able to view User Beta endpoint reports!');
  }
  console.log('✅ RLS verified: User Charlie cannot read User Beta intelligence or reports');

  // Starter user direct database insert protection
  const { error: starterDirectInsertError } = await clientAlpha
    .from('endpoint_reports')
    .insert({
      user_id: userAlphaId,
      title: 'Illicit Starter Report',
      report_content: { dummy: true },
      report_period: 'All Time',
    });

  if (!starterDirectInsertError) {
    throw new Error('FAILED: Starter user bypassed tier gate to insert report into database!');
  }
  console.log('✅ Database Trigger verified: Starter user blocked from inserting into endpoint_reports');

  // 9. Automated Daily Purge Routine Test
  console.log('\n9. Testing Automated Daily Purge for Expired Reports...');
  const expReportRes = await adminClient
    .from('endpoint_reports')
    .insert({
      user_id: userBetaId,
      title: 'Expired Test Report',
      report_content: { dummy: true },
      report_period: 'All Time',
      deleted_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      purge_after: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Past purge date!
    })
    .select()
    .single();

  if (expReportRes.error) throw new Error(expReportRes.error.message);
  const expiredReportId = expReportRes.data.id;

  const purgeRes = await adminClient.rpc('purge_expired_records');
  if (purgeRes.error) throw new Error(purgeRes.error.message);

  const { data: checkPurged } = await adminClient
    .from('endpoint_reports')
    .select('id')
    .eq('id', expiredReportId)
    .maybeSingle();

  if (checkPurged) {
    throw new Error('FAILED: Expired report was not purged by automated purge routine');
  }
  console.log(`✅ Automated daily purge routine permanently purged expired endpoint report (purged_reports count: ${purgeRes.data?.purged_reports ?? 1})`);

  // Clean up test users
  console.log('\n10. Cleaning up test data...');
  await adminClient.auth.admin.deleteUser(userAlphaId);
  await adminClient.auth.admin.deleteUser(userBetaId);
  await adminClient.auth.admin.deleteUser(userCharlieId);
  console.log('✅ Cleaned up temporary test users');

  console.log('\n====================================================');
  console.log('ALL TASKLET 15 VERIFICATION CHECKS PASSED CLEANLY! 🎉');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('\n❌ TASKLET 15 TEST FAILED:', err);
  process.exit(1);
});
