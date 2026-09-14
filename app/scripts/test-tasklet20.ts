import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { canUseFeature } from '../src/lib/permissions/canUseFeature';
import { handleApiRequest } from '../src/server/apiRouter';
import { runPredictiveEngine } from '../src/lib/predictive/predictiveEngine';
import { getPredictiveAnalysis } from '../src/lib/predictive/predictiveService';
import { runAgent } from '../src/lib/agents/agentRunner';
import {
  createExecutiveBriefing,
  fetchExecutiveBriefings,
  fetchExecutiveBriefingById,
  softDeleteExecutiveBriefing,
  restoreExecutiveBriefing,
  permanentDeleteExecutiveBriefing,
} from '../src/lib/predictive/executiveBriefingService';

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
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTestSuite() {
  console.log('================================================================');
  console.log('TASKLET 20: PREDICTIVE INTELLIGENCE & STRATEGIC RECOMMENDATIONS');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testUsers: Record<string, any> = {};

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Provision Test Users (Starter, Pro, Team, Enterprise, Admin, Isolated)
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: Provisioning Test Users ---');
    const userConfigs = [
      { key: 'starter', email: `starter_user_${timestamp}@concludo.au`, plan: 'starter' },
      { key: 'pro', email: `pro_user_${timestamp}@concludo.au`, plan: 'pro' },
      { key: 'team', email: `team_user_${timestamp}@concludo.au`, plan: 'team' },
      { key: 'enterprise', email: `enterprise_user_${timestamp}@concludo.au`, plan: 'enterprise' },
      { key: 'admin', email: `admin_user_${timestamp}@concludo.au`, plan: 'admin' },
      { key: 'isolated', email: `isolated_user_${timestamp}@concludo.au`, plan: 'enterprise' },
    ];

    for (const conf of userConfigs) {
      const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email: conf.email,
        password: 'Password123!Secure',
        email_confirm: true,
        user_metadata: { full_name: `Test ${conf.key.toUpperCase()}` },
      });

      if (authErr || !authData.user) {
        throw new Error(`Failed to create ${conf.key} user: ${authErr?.message}`);
      }

      const uid = authData.user.id;
      const { error: upErr } = await adminClient.from('profiles').update({
        plan: conf.plan,
        role: conf.key === 'admin' ? 'admin' : 'user',
        is_suspended: false,
      }).eq('id', uid);
      if (upErr) throw upErr;

      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signData, error: signErr } = await anonClient.auth.signInWithPassword({
        email: conf.email,
        password: 'Password123!Secure',
      });

      if (signErr || !signData.session) {
        throw new Error(`Sign in failed for ${conf.key}: ${signErr?.message}`);
      }

      testUsers[conf.key] = {
        id: uid,
        email: conf.email,
        plan: conf.plan,
        token: signData.session.access_token,
        client: createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${signData.session.access_token}` } },
        }),
      };
    }
    console.log('✅ Provisioned test users for all subscription tiers.\n');

    // -------------------------------------------------------------------------
    // STEP 2: Feature Gating & Backend Permission Enforcement
    // -------------------------------------------------------------------------
    console.log('--- STEP 2: Verifying Predictive Feature Gating ---');
    const predFeatures = [
      'predictive_intelligence',
      'strategic_recommendations',
      'forecasting',
      'organizational_health_scoring',
      'executive_intelligence',
    ];

    // Starter should be denied all
    for (const feat of predFeatures) {
      const res = await canUseFeature(testUsers.starter.id, feat, { supabase: adminClient });
      if (res.allowed) throw new Error(`Starter user unexpectedly allowed ${feat}`);
    }
    console.log('✅ Starter tier strictly DENIED all predictive and executive features.');

    // Pro should be denied all
    for (const feat of predFeatures) {
      const res = await canUseFeature(testUsers.pro.id, feat, { supabase: adminClient });
      if (res.allowed) throw new Error(`Pro user unexpectedly allowed ${feat}`);
    }
    console.log('✅ Pro tier strictly DENIED all predictive and executive features.');

    // Team default should be denied (before org enablement)
    for (const feat of predFeatures) {
      const res = await canUseFeature(testUsers.team.id, feat, { supabase: adminClient });
      if (res.allowed) throw new Error(`Team user unexpectedly allowed ${feat} without org override`);
    }
    console.log('✅ Team tier strictly DENIED predictive features by default without org enablement.');

    // Enterprise and Admin should be granted all
    for (const feat of predFeatures) {
      const entRes = await canUseFeature(testUsers.enterprise.id, feat, { supabase: adminClient });
      if (!entRes.allowed) throw new Error(`Enterprise user denied ${feat}`);

      const admRes = await canUseFeature(testUsers.admin.id, feat, { supabase: adminClient });
      if (!admRes.allowed) throw new Error(`Admin user denied ${feat}`);
    }
    console.log('✅ Enterprise and Admin tiers strictly GRANTED all predictive and executive features.');

    // Test Team Optional Access when enabled by organization administrator
    const { data: orgData, error: orgErr } = await adminClient.from('organizations').insert({
      name: `Predictive Org ${timestamp}`,
      owner_id: testUsers.enterprise.id,
      allow_team_predictive: true,
    }).select().single();
    if (orgErr) throw orgErr;

    await adminClient.from('organization_members').insert([
      {
        organization_id: orgData.id,
        user_id: testUsers.enterprise.id,
        role: 'organization_owner',
      },
      {
        organization_id: orgData.id,
        user_id: testUsers.team.id,
        role: 'member',
      },
    ]);

    // Now Team user should have predictive features...
    for (const feat of ['predictive_intelligence', 'strategic_recommendations', 'forecasting', 'organizational_health_scoring']) {
      const res = await canUseFeature(testUsers.team.id, feat, { supabase: adminClient });
      if (!res.allowed) throw new Error(`Team user should have ${feat} when org has allow_team_predictive=true`);
    }
    // ... BUT executive_intelligence MUST STILL BE DENIED!
    const execRes = await canUseFeature(testUsers.team.id, 'executive_intelligence', { supabase: adminClient });
    if (execRes.allowed) throw new Error('Team user unexpectedly granted executive_intelligence (must be enterprise only)');
    console.log('✅ Team tier optional access verified: granted predictive features via org override, executive_intelligence strictly withheld.');

    // -------------------------------------------------------------------------
    // STEP 3: Server API Router Enforcement & Scope Security
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: Server API Router & Scope Authorization ---');

    // Starter user accessing /api/predictive/intelligence -> HTTP 403
    const starterReq = await handleApiRequest({
      method: 'GET',
      url: '/api/predictive/intelligence',
      headers: { authorization: `Bearer ${testUsers.starter.token}` },
    });
    if (starterReq.status !== 403) {
      throw new Error(`Expected HTTP 403 for Starter accessing /api/predictive/intelligence, got ${starterReq.status}`);
    }
    console.log('✅ Server API Router returned HTTP 403 Forbidden for Starter user.');

    // Enterprise user accessing /api/predictive/intelligence -> HTTP 200
    const entReq = await handleApiRequest({
      method: 'GET',
      url: '/api/predictive/intelligence',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });
    if (entReq.status !== 200) {
      throw new Error(`Expected HTTP 200 for Enterprise user, got ${entReq.status}: ${JSON.stringify(entReq.body)}`);
    }
    console.log('✅ Server API Router returned HTTP 200 OK for Enterprise user.');

    // Test Unauthorized Scope via API: Isolated user attempts to query Enterprise user's org
    const badScopeReq = await handleApiRequest({
      method: 'POST',
      url: '/api/predictive/intelligence',
      headers: { authorization: `Bearer ${testUsers.isolated.token}` },
      body: {
        scope: 'organization',
        scopeId: orgData.id, // Org owned by Enterprise user, Isolated user is not a member
      },
    });
    if (badScopeReq.status !== 403) {
      throw new Error(`Expected HTTP 403 for unauthorized org scope, got ${badScopeReq.status}`);
    }
    console.log('✅ Server API Router returned HTTP 403 Forbidden for unauthorized organization scope.');

    // Suspended User Check
    await adminClient.from('profiles').update({ is_suspended: true }).eq('id', testUsers.enterprise.id);
    const suspendedReq = await handleApiRequest({
      method: 'GET',
      url: '/api/predictive/intelligence',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });
    if (suspendedReq.status !== 403 || (suspendedReq.body as any)?.error !== 'user_suspended') {
      throw new Error(`Expected 403 user_suspended, got ${suspendedReq.status}`);
    }
    await adminClient.from('profiles').update({ is_suspended: false }).eq('id', testUsers.enterprise.id);
    console.log('✅ Suspended user access strictly blocked with HTTP 403 user_suspended.');

    // -------------------------------------------------------------------------
    // STEP 4: Predictive Engine Metrics & Retention Filtering
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: Predictive Analysis Calculation & Retention Filtering ---');

    // Create a live project, decisions, actions
    const { data: projData, error: pErr } = await adminClient.from('projects').insert({
      title: 'Strategic Market Expansion',
      project_name: 'Market Expansion',
      user_id: testUsers.enterprise.id,
      meeting_date: new Date().toISOString(),
    }).select().single();
    if (pErr) throw pErr;

    // Active action & overdue action
    const { data: act1, error: a1Err } = await adminClient.from('action_tracker').insert({
      project_id: projData.id,
      user_id: testUsers.enterprise.id,
      action_title: 'Finalize Regulatory Submission',
      action_description: 'Compliance documentation for Australian market',
      status: 'in_progress',
      due_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], // Overdue by 3 days
    }).select().single();
    if (a1Err) throw a1Err;

    const { data: act2, error: a2Err } = await adminClient.from('action_tracker').insert({
      project_id: projData.id,
      user_id: testUsers.enterprise.id,
      action_title: 'Review Security Architecture',
      action_description: 'Zero-trust audit review',
      status: 'completed',
      due_date: new Date().toISOString().split('T')[0],
    }).select().single();
    if (a2Err) throw a2Err;

    // Soft-deleted action (must NOT contribute to analysis)
    const { data: deletedAct, error: aDelErr } = await adminClient.from('action_tracker').insert({
      project_id: projData.id,
      user_id: testUsers.enterprise.id,
      action_title: 'Obsolete Marketing Draft',
      action_description: 'Scrapped initiative',
      status: 'in_progress',
      deleted_at: new Date().toISOString(),
      purge_after: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select().single();
    if (aDelErr) throw aDelErr;

    // Decision with timestamps to verify decision velocity
    const createdDate = new Date(Date.now() - 4 * 86400000).toISOString();
    const updatedDate = new Date(Date.now() - 1 * 86400000).toISOString();
    const { data: dec1, error: d1Err } = await adminClient.from('decision_memory').insert({
      project_id: projData.id,
      user_id: testUsers.enterprise.id,
      decision_title: 'Adopt Australian Hosted Infrastructure',
      decision_summary: 'Keep customer data in Sydney region',
      decision_reasoning: 'Data sovereignty and compliance',
      decision_owner: 'Anthony Cortez',
      decision_date: new Date().toISOString().split('T')[0],
      created_at: createdDate,
      updated_at: updatedDate,
    }).select().single();
    if (d1Err) throw d1Err;

    // Run predictive analysis with snapshot saving
    const analysis = await getPredictiveAnalysis({
      scope: 'organization',
      scopeId: orgData.id,
      userId: testUsers.enterprise.id,
      saveSnapshot: true,
    }, adminClient);

    if (!analysis.healthScore || typeof analysis.healthScore.overallScore !== 'number') {
      throw new Error('Analysis healthScore is missing or invalid');
    }
    if (analysis.riskPredictions.length === 0) throw new Error('Risk predictions missing');
    if (analysis.opportunitySignals.length === 0) throw new Error('Opportunity signals missing');
    if (analysis.strategicRecommendations.length === 0) throw new Error('Recommendations missing');
    if (!analysis.forecasts['30_day'] || !analysis.forecasts['90_day']) throw new Error('Forecasts missing');

    // Verify decision velocity is calculated from timestamps
    const decOutcome = analysis.decisionQuality.decisions.find((d) => d.id === dec1.id);
    if (!decOutcome || decOutcome.decisionVelocityDays < 1) {
      throw new Error(`Decision velocity not computed properly: ${JSON.stringify(decOutcome)}`);
    }

    // Verify deleted action was excluded
    const hasDeleted = analysis.riskPredictions.some((r) => r.affectedEntities.includes('Obsolete Marketing Draft'));
    if (hasDeleted) throw new Error('Soft-deleted action was unexpectedly included in risk predictions');

    console.log(`✅ Predictive Analysis generated successfully: Health Score=${analysis.healthScore.overallScore}/100 (${analysis.healthScore.category.toUpperCase()}).`);
    console.log(`✅ Decision velocity measured from timestamps: ${decOutcome.decisionVelocityDays} days for "${decOutcome.decisionTitle}".`);
    console.log('✅ Soft-deleted records strictly excluded from predictive calculations.');

    // -------------------------------------------------------------------------
    // STEP 5: Predictive Snapshot Persistence
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Predictive Snapshot Persistence ---');
    const { data: snapshots, error: snapErr } = await adminClient
      .from('predictive_snapshots')
      .select('*')
      .eq('organization_id', orgData.id);

    if (snapErr || !snapshots || snapshots.length === 0) {
      throw new Error(`Failed to retrieve persisted predictive snapshot: ${snapErr?.message}`);
    }
    console.log(`✅ Predictive snapshot verified in database (ID: ${snapshots[0].id}, Health Score: ${snapshots[0].health_score}).`);

    // -------------------------------------------------------------------------
    // STEP 6: Executive Briefing Lifecycle & Legal Hold Protection
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: Executive Briefings Lifecycle & Legal Hold Protection ---');

    // 1. Create Executive Briefing
    const briefingResult = await createExecutiveBriefing({
      title: 'Q3 Executive Strategic Review',
      reportType: 'executive_summary',
      organizationId: orgData.id,
      userId: testUsers.enterprise.id,
      analysis,
    }, adminClient);

    if (!briefingResult.success || !briefingResult.data) {
      throw new Error(`Executive briefing creation failed: ${briefingResult.error}`);
    }
    const briefingId = briefingResult.data.id;
    console.log(`✅ Executive briefing created successfully (ID: ${briefingId}, Title: "${briefingResult.data.title}").`);

    // 2. Fetch briefings
    const briefingsList = await fetchExecutiveBriefings({ organizationId: orgData.id }, adminClient);
    if (!briefingsList.some((b) => b.id === briefingId)) {
      throw new Error('Created briefing not found in fetch list');
    }

    // 3. Soft-delete briefing
    const softDeleted = await softDeleteExecutiveBriefing(briefingId, testUsers.enterprise.id, adminClient);
    if (!softDeleted) throw new Error('Failed to soft delete executive briefing');

    // Verify it is excluded from normal list
    const activeList = await fetchExecutiveBriefings({ organizationId: orgData.id }, adminClient);
    if (activeList.some((b) => b.id === briefingId)) {
      throw new Error('Soft-deleted briefing still visible in active list');
    }
    console.log('✅ Executive briefing soft-deleted successfully and excluded from active list.');

    // 4. Restore briefing
    const restored = await restoreExecutiveBriefing(briefingId, testUsers.enterprise.id, adminClient);
    if (!restored) throw new Error('Failed to restore executive briefing');
    console.log('✅ Executive briefing restored successfully.');

    // 5. Activate Legal Hold on the organization
    const { data: legalHoldData, error: lhErr } = await adminClient.from('legal_holds').insert({
      organization_id: orgData.id,
      name: `ASIC Compliance Review ${timestamp}`,
      status: 'active',
      description: 'Preserve all strategic intelligence and briefings.',
    }).select().single();
    if (lhErr) throw lhErr;
    console.log(`✅ Active Legal Hold created: "${legalHoldData.name}".`);

    // 6. Test Permanent Deletion under Legal Hold -> MUST BE REJECTED
    let permDeleteBlocked = false;
    try {
      await permanentDeleteExecutiveBriefing(briefingId, testUsers.enterprise.id, adminClient);
    } catch (err: any) {
      if (err.message && err.message.includes('Legal Hold')) {
        permDeleteBlocked = true;
      }
    }
    if (!permDeleteBlocked) {
      throw new Error('Database RPC failed to block permanent deletion of executive briefing under active Legal Hold');
    }
    console.log('✅ Database RPC strictly BLOCKED permanent deletion of executive briefing due to active Legal Hold.');

    // 7. Test Automated Purge under Legal Hold -> MUST BE SKIPPED
    // Set purge_after in the past
    await adminClient.from('executive_briefings').update({
      deleted_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      purge_after: new Date(Date.now() - 5 * 86400000).toISOString(),
    }).eq('id', briefingId);

    const { data: purgeResult, error: purgeErr } = await adminClient.rpc('purge_expired_records');
    if (purgeErr) throw purgeErr;

    // Check that briefing still exists in DB
    const { data: holdCheck } = await adminClient.from('executive_briefings').select('id').eq('id', briefingId).maybeSingle();
    if (!holdCheck) {
      throw new Error('Briefing was purged despite active Legal Hold!');
    }
    console.log('✅ System automated purge purge_expired_records skipped executive briefing under active Legal Hold.');

    // 8. Release Legal Hold and verify permanent delete
    await adminClient.from('legal_holds').update({ status: 'released' }).eq('id', legalHoldData.id);
    const permDeleted = await permanentDeleteExecutiveBriefing(briefingId, testUsers.enterprise.id, adminClient);
    if (!permDeleted) throw new Error('Permanent deletion failed after releasing Legal Hold');
    console.log('✅ Legal Hold released and executive briefing permanently deleted successfully.');

    // -------------------------------------------------------------------------
    // STEP 7: Audit Logging Verification
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: Immutable Audit Logging ---');
    const { data: auditEvents, error: aErr } = await adminClient
      .from('audit_logs')
      .select('action, entity_type')
      .eq('organization_id', orgData.id);

    if (aErr) throw aErr;
    const actionsLogged = (auditEvents || []).map((a) => a.action);

    if (!actionsLogged.includes('health_score_update')) {
      throw new Error('Audit log missing health_score_update');
    }
    if (!actionsLogged.includes('prediction_generation')) {
      throw new Error('Audit log missing prediction_generation');
    }
    if (!actionsLogged.includes('executive_briefing_generation')) {
      throw new Error('Audit log missing executive_briefing_generation');
    }
    console.log(`✅ All required Tasklet 20 audit events captured: ${[...new Set(actionsLogged)].join(', ')}.`);

    // -------------------------------------------------------------------------
    // STEP 8: Cross-Organization Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: Cross-Organization Isolation ---');
    // Isolated user should not see briefings from Org A
    const isolatedBriefings = await fetchExecutiveBriefings({ organizationId: orgData.id }, testUsers.isolated.client);
    if (isolatedBriefings.length > 0) {
      throw new Error('Cross-organization leakage: Isolated user retrieved Org A briefings');
    }
    console.log('✅ Cross-organization isolation verified: RLS strictly prevents access to external tenant intelligence.');

    // -------------------------------------------------------------------------
    // STEP 9: AI Agent Integration (Consuming Predictive Outputs)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 9: AI Agent Consumption of Predictive Intelligence ---');
    const agentResult = await runAgent({
      agentType: 'project_intelligence',
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
      admin: true,
    });

    if (agentResult.status !== 'completed') {
      throw new Error(`Project Intelligence agent failed: ${agentResult.summary}`);
    }
    if (typeof agentResult.data?.healthScore !== 'number') {
      throw new Error('Agent failed to consume predictive health score');
    }
    console.log(`✅ AI Agent successfully consumed predictive outputs: Health Score=${agentResult.data.healthScore}, Status=${agentResult.status}.`);

    console.log('\n================================================================');
    console.log('ALL TASKLET 20 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } finally {
    console.log('Cleaning up Tasklet 20 test fixtures...');
    try {
      for (const key of Object.keys(testUsers)) {
        await adminClient.auth.admin.deleteUser(testUsers[key].id);
      }
      console.log('✅ Cleanup completed.');
    } catch (cleanupErr: any) {
      console.warn('⚠️ Cleanup warning:', cleanupErr.message);
    }
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TASKLET 20 TEST FAILED:', err);
  process.exit(1);
});
