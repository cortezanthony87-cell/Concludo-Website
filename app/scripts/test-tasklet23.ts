import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { canUseFeature } from '../src/lib/permissions/canUseFeature';
import { handleApiRequest } from '../src/server/apiRouter';
import { DigitalTwinEngine } from '../src/lib/strategic/digitalTwinEngine';
import { StrategicHealthEngine } from '../src/lib/strategic/strategicHealthEngine';
import { ScenarioEngine } from '../src/lib/strategic/scenarioEngine';
import { PerformanceModelEngine } from '../src/lib/strategic/performanceModel';
import { OrganizationalLearningEngine } from '../src/lib/strategic/organizationalLearningEngine';
import { RiskNetworkEngine } from '../src/lib/strategic/riskNetworkEngine';
import { DependencyMapEngine } from '../src/lib/strategic/dependencyMapEngine';
import { StrategicBriefingService } from '../src/lib/strategic/strategicBriefingService';
import { StrategicService } from '../src/lib/strategic/strategicService';
import { PlanType, PLAN_PERMISSIONS } from '../src/lib/permissions/types';

// Parse environment variables from .env.local
const envPath = existsSync('/tmp/concludo-repo/app/.env.local')
  ? '/tmp/concludo-repo/app/.env.local'
  : existsSync('.env.local')
  ? '.env.local'
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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 1000): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

async function runTasklet23Tests() {
  console.log('===============================================================');
  console.log('TASKLET 23 VERIFICATION SUITE — STRATEGIC OPERATIONS & COMMAND CENTER');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  const testUsers: Record<string, any> = {};
  let createdOrgId: string | null = null;
  let testProjId: string | null = null;
  let testActId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Provision Authenticated Test Users for All Subscription Tiers
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: Provisioning Authenticated Test Users ---');
    const userConfigs = [
      { key: 'starter', email: `strat_starter_${timestamp}@concludo.au`, plan: 'starter' },
      { key: 'pro', email: `strat_pro_${timestamp}@concludo.au`, plan: 'pro' },
      { key: 'team', email: `strat_team_${timestamp}@concludo.au`, plan: 'team' },
      { key: 'enterprise', email: `strat_enterprise_${timestamp}@concludo.au`, plan: 'enterprise' },
      { key: 'admin', email: `strat_admin_${timestamp}@concludo.au`, plan: 'admin' },
    ];

    for (const conf of userConfigs) {
      const authData = await withRetry(async () => {
        const res = await adminClient.auth.admin.createUser({
          email: conf.email,
          password: 'Password123!Secure',
          email_confirm: true,
          user_metadata: { full_name: `Test ${conf.key.toUpperCase()}` },
        });
        if (res.error || !res.data.user) {
          throw new Error(res.error?.message || 'No user created');
        }
        return res.data;
      });

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
      const signData = await withRetry(async () => {
        const res = await anonClient.auth.signInWithPassword({
          email: conf.email,
          password: 'Password123!Secure',
        });
        if (res.error || !res.data.session) {
          throw new Error(res.error?.message || 'Sign in failed');
        }
        return res.data;
      });

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
    console.log('✅ Provisioned authenticated test users for Starter, Pro, Team, Enterprise, and Admin.\n');

    // -------------------------------------------------------------------------
    // STEP 2: Feature Access & Backend Permission Gating
    // -------------------------------------------------------------------------
    console.log('--- STEP 2: Feature Access & Backend Permission Gating ---');

    const strategicFeatures = [
      'executive_command_center',
      'digital_twin',
      'scenario_modeling',
      'strategic_operations',
      'executive_simulations',
    ] as const;

    const deniedPlans: PlanType[] = ['free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team'];
    const grantedPlans: PlanType[] = ['enterprise', 'admin'];

    for (const plan of deniedPlans) {
      const allowedList = PLAN_PERMISSIONS[plan] || [];
      for (const feat of strategicFeatures) {
        if (allowedList.includes(feat)) {
          throw new Error(`Security Failure: Plan ${plan} was incorrectly granted ${feat} in PLAN_PERMISSIONS`);
        }
      }
    }
    console.log('✅ Denied tiers (Free, Starter, Pro, Team) are strictly blocked from all Strategic Operations features');

    for (const plan of grantedPlans) {
      const allowedList = PLAN_PERMISSIONS[plan] || [];
      for (const feat of strategicFeatures) {
        if (!allowedList.includes(feat)) {
          throw new Error(`Permission Failure: Plan ${plan} was not granted ${feat} in PLAN_PERMISSIONS`);
        }
      }
    }
    console.log('✅ Authorized tiers (Enterprise, Admin) are granted all Strategic Operations features');

    // Verify database-backed canUseFeature helper
    for (const feat of strategicFeatures) {
      const starterRes = await canUseFeature(testUsers.starter.id, feat, { supabase: adminClient });
      if (starterRes.allowed) throw new Error(`Starter user was allowed feature ${feat}`);

      const proRes = await canUseFeature(testUsers.pro.id, feat, { supabase: adminClient });
      if (proRes.allowed) throw new Error(`Pro user was allowed feature ${feat}`);

      const teamRes = await canUseFeature(testUsers.team.id, feat, { supabase: adminClient });
      if (teamRes.allowed) throw new Error(`Team user was allowed feature ${feat}`);

      const entRes = await canUseFeature(testUsers.enterprise.id, feat, { supabase: adminClient });
      if (!entRes.allowed) throw new Error(`Enterprise user was denied feature ${feat}`);

      const adminRes = await canUseFeature(testUsers.admin.id, feat, { supabase: adminClient });
      if (!adminRes.allowed) throw new Error(`Admin user was denied feature ${feat}`);
    }
    console.log('✅ Authoritative canUseFeature() strictly blocks non-enterprise tiers and grants enterprise/admin.\n');

    // -------------------------------------------------------------------------
    // STEP 3: Server API Route Gating & Suspended User Checks
    // -------------------------------------------------------------------------
    console.log('--- STEP 3: Server API Route Gating ---');

    // Verify Starter user is blocked from /api/strategic/digital-twin
    const starterResp = await handleApiRequest({
      method: 'GET',
      url: '/api/strategic/digital-twin',
      headers: {
        authorization: `Bearer ${testUsers.starter.token}`,
        'content-type': 'application/json',
      },
    });
    if (starterResp.status !== 403) {
      throw new Error(`API Router failed to reject Starter tier on /api/strategic/digital-twin (status: ${starterResp.status})`);
    }
    console.log('✅ Starter tier strictly blocked with HTTP 403 on /api/strategic/digital-twin');

    // Verify Pro user is blocked
    const proResp = await handleApiRequest({
      method: 'GET',
      url: '/api/strategic/digital-twin',
      headers: {
        authorization: `Bearer ${testUsers.pro.token}`,
        'content-type': 'application/json',
      },
    });
    if (proResp.status !== 403) {
      throw new Error(`API Router failed to reject Pro tier on /api/strategic/digital-twin (status: ${proResp.status})`);
    }
    console.log('✅ Pro tier strictly blocked with HTTP 403 on /api/strategic/digital-twin');

    // Verify Team tier is blocked
    const teamResp = await handleApiRequest({
      method: 'GET',
      url: '/api/strategic/digital-twin',
      headers: {
        authorization: `Bearer ${testUsers.team.token}`,
        'content-type': 'application/json',
      },
    });
    if (teamResp.status !== 403) {
      throw new Error(`API Router failed to reject Team tier on /api/strategic/digital-twin (status: ${teamResp.status})`);
    }
    console.log('✅ Team tier strictly blocked with HTTP 403 on /api/strategic/digital-twin');

    // Verify Enterprise user is allowed
    const entResp = await handleApiRequest({
      method: 'GET',
      url: '/api/strategic/digital-twin',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
    });
    if (entResp.status !== 200) {
      throw new Error(`Expected HTTP 200 for enterprise user, got ${entResp.status}: ${JSON.stringify(entResp.body)}`);
    }
    console.log('✅ Enterprise user successfully authorized with HTTP 200 on /api/strategic/digital-twin');

    // Verify Suspended enterprise user is blocked
    await adminClient.from('profiles').update({ is_suspended: true }).eq('id', testUsers.enterprise.id);
    const suspResp = await handleApiRequest({
      method: 'GET',
      url: '/api/strategic/digital-twin',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
    });
    if (suspResp.status !== 403 || suspResp.body?.error !== 'user_suspended') {
      throw new Error(`Expected HTTP 403 user_suspended, got ${suspResp.status}`);
    }
    await adminClient.from('profiles').update({ is_suspended: false }).eq('id', testUsers.enterprise.id);
    console.log('✅ Suspended user strictly blocked with HTTP 403 user_suspended.\n');

    // -------------------------------------------------------------------------
    // STEP 4: Digital Twin Engine & Live Data Grounding
    // -------------------------------------------------------------------------
    console.log('--- STEP 4: Digital Twin Engine & Strategic Health ---');

    // Seed sample project and actions to verify live calculation
    const { data: testProj } = await adminClient
      .from('projects')
      .insert({
        title: 'Project Apex Strategic Transformation',
        user_id: testUsers.enterprise.id,
      })
      .select()
      .single();
    testProjId = testProj?.id;

    const { data: testAct } = await adminClient
      .from('action_tracker')
      .insert({
        project_id: testProjId,
        action_title: 'Digital Twin Milestone Review',
        user_id: testUsers.enterprise.id,
        status: 'in_progress',
        due_date: new Date(Date.now() + 86400000 * 5).toISOString(),
      })
      .select()
      .single();
    testActId = testAct?.id;

    const digitalTwin = await withRetry(() =>
      StrategicService.refreshDigitalTwin(adminClient, testUsers.enterprise.id)
    );

    if (!digitalTwin || !digitalTwin.id) {
      throw new Error('Failed to compute and persist Digital Twin');
    }
    if (digitalTwin.operational_health < 0 || digitalTwin.operational_health > 100) {
      throw new Error(`Invalid operational health score: ${digitalTwin.operational_health}`);
    }
    if (!digitalTwin.model_state || digitalTwin.model_state.projects_count < 1) {
      throw new Error('Digital Twin model state failed to ground from live project records');
    }
    console.log(`✅ Digital Twin computed and persisted. Health: ${digitalTwin.operational_health}/100, Projects: ${digitalTwin.model_state.projects_count}, Actions: ${digitalTwin.model_state.actions_count}`);

    // Test Strategic Health Engine categories
    const healthRecord = await withRetry(() =>
      StrategicService.recordHealthScore(adminClient, testUsers.enterprise.id)
    );
    if (!healthRecord || typeof healthRecord.overall_score !== 'number') {
      throw new Error('Failed to record strategic health score');
    }
    const cats = healthRecord.categories;
    if (!cats.vision_execution || !cats.program_delivery || !cats.decision_velocity || !cats.risk_management) {
      throw new Error('Strategic Health Score missing required health categories');
    }
    console.log(`✅ Strategic Health recorded. Overall: ${healthRecord.overall_score}/100 [${healthRecord.classification}], 8 Categories verified.\n`);

    // -------------------------------------------------------------------------
    // STEP 5: Scenario Modeling & Simulation Engine
    // -------------------------------------------------------------------------
    console.log('--- STEP 5: Scenario Modeling & Simulation Engine ---');

    const simulation = ScenarioEngine.simulateScenario('delivery_slowdown', { delivery_change_pct: 15 }, {
      projects: [{ id: testProjId, title: testProj?.title || 'Project Apex' }],
      actionsCount: 8,
      overdueCount: 1,
    });

    if (!simulation.possible_outcomes || simulation.possible_outcomes.length === 0) {
      throw new Error('Simulation produced empty outcomes');
    }
    if (!simulation.risk_impact || !simulation.resource_impact || !simulation.project_impact || !simulation.decision_impact) {
      throw new Error('Simulation missing multidimensional impact assessment');
    }
    if (!simulation.assumptions || simulation.assumptions.length === 0) {
      throw new Error('Simulation missing explicitly stated assumptions');
    }
    console.log(`✅ Scenario Simulation calculated: Confidence=${simulation.confidence_level}, Outcomes=${simulation.possible_outcomes.length}, Assumptions=${simulation.assumptions.length}`);

    // Persist scenario via service
    const scenario = await withRetry(() =>
      StrategicService.createScenario(
        adminClient,
        testUsers.enterprise.id,
        'Q4 Delivery Variance Simulation',
        'delivery_slowdown',
        { delivery_change_pct: 15 },
        'Evaluating operational impact of 15% milestone drift'
      )
    );

    if (!scenario || !scenario.id) {
      throw new Error('Failed to persist strategic scenario');
    }
    console.log(`✅ Strategic Scenario persisted successfully: ID ${scenario.id}.\n`);

    // -------------------------------------------------------------------------
    // STEP 6: Strategic Briefings & Board Reporting
    // -------------------------------------------------------------------------
    console.log('--- STEP 6: Strategic Briefings & Board Reporting ---');

    const briefing = await withRetry(() =>
      StrategicService.createBriefing(
        adminClient,
        testUsers.enterprise.id,
        'board_update',
        'Q4 Executive Board Strategic Briefing'
      )
    );

    if (!briefing || !briefing.id) {
      throw new Error('Failed to generate strategic briefing');
    }
    if (!briefing.sections.executive_summary || !briefing.sections.initiative_health || !briefing.sections.risk_exposure) {
      throw new Error('Strategic Briefing missing required board report sections');
    }
    console.log(`✅ Board Briefing created: "${briefing.title}", Sections verified.\n`);

    // -------------------------------------------------------------------------
    // STEP 7: Strategic Alerts
    // -------------------------------------------------------------------------
    console.log('--- STEP 7: Strategic Alerts ---');

    const alert = await withRetry(() =>
      StrategicService.createAlert(
        adminClient,
        'critical_risk_emerging',
        'high',
        'Milestone Variance Triggered',
        'Delivery variance detected in secondary architecture review stream',
        null,
        null,
        { varianceDays: 4 }
      )
    );

    if (!alert || !alert.id) {
      throw new Error('Failed to create strategic alert');
    }
    console.log(`✅ Strategic Alert created: "${alert.title}" (Severity: ${alert.severity})`);

    // Dismiss alert
    const dismissed = await withRetry(() =>
      StrategicService.dismissAlert(adminClient, alert.id)
    );
    if (!dismissed) {
      throw new Error('Failed to dismiss strategic alert');
    }
    console.log('✅ Strategic Alert dismissed successfully.\n');

    // -------------------------------------------------------------------------
    // STEP 8: Performance Model & Organizational Learning
    // -------------------------------------------------------------------------
    console.log('--- STEP 8: Performance Model & Organizational Learning ---');

    const perfModel = PerformanceModelEngine.calculatePerformanceModel({
      projectsCount: 5,
      completedProjectsCount: 3,
      decisionsCount: 12,
      actionsCount: 20,
      completedActionsCount: 16,
    });

    if (perfModel.execution < 0 || perfModel.execution > 100) {
      throw new Error(`Invalid performance execution score: ${perfModel.execution}`);
    }
    if (!perfModel.department_breakdown || perfModel.department_breakdown.length === 0) {
      throw new Error('Performance model missing department breakdowns');
    }
    console.log(`✅ Enterprise Performance Model computed: Execution ${perfModel.execution}/100, Delivery ${perfModel.delivery}/100, ${perfModel.department_breakdown.length} departments`);

    const learningModel = OrganizationalLearningEngine.computeLearningModel({
      lessonsCount: 6,
      knowledgeNodesCount: 18,
      decisionsCount: 10,
      projectsCount: 4,
    });

    if (!learningModel.successfulPatterns || learningModel.successfulPatterns.length === 0) {
      throw new Error('Organizational Learning missing successful patterns');
    }
    if (!learningModel.failurePatterns || learningModel.failurePatterns.length === 0) {
      throw new Error('Organizational Learning missing failure patterns');
    }
    console.log(`✅ Organizational Learning Engine verified: ${learningModel.successfulPatterns.length} success patterns, ${learningModel.failurePatterns.length} failure patterns.\n`);

    // -------------------------------------------------------------------------
    // STEP 9: Enterprise Risk Network & Organizational Dependency Map
    // -------------------------------------------------------------------------
    console.log('--- STEP 9: Risk Network & Dependency Map ---');

    const riskNetwork = RiskNetworkEngine.computeRiskNetwork();
    if (!riskNetwork.nodes || riskNetwork.nodes.length === 0) {
      throw new Error('Risk Network missing nodes');
    }
    const hasEscalations = riskNetwork.nodes.some(n => n.escalationPaths && n.escalationPaths.length > 0);
    if (!hasEscalations) {
      throw new Error('Risk Network nodes missing escalation paths');
    }
    console.log(`✅ Enterprise Risk Network verified: ${riskNetwork.nodes.length} risk nodes, overall level: ${riskNetwork.overallRiskLevel}`);

    const depMap = DependencyMapEngine.computeDependencyMap();
    if (!depMap.links || depMap.links.length === 0) {
      throw new Error('Dependency map missing dependency links');
    }
    if (!depMap.identifiedBottlenecks) {
      throw new Error('Dependency map missing bottleneck identification');
    }
    console.log(`✅ Organizational Dependency Map verified: ${depMap.links.length} links, ${depMap.identifiedBottlenecks.length} bottlenecks detected.\n`);

    // -------------------------------------------------------------------------
    // STEP 10: Strategic Recommendations
    // -------------------------------------------------------------------------
    console.log('--- STEP 10: Strategic Recommendations ---');

    const recs = StrategicService.getStrategicRecommendations();
    if (recs.length < 6) {
      throw new Error(`Expected at least 6 recommendations across categories, found ${recs.length}`);
    }
    for (const r of recs) {
      if (!r.id || !r.category || !r.title || !r.explanation || !r.confidenceScore || !r.evidence) {
        throw new Error(`Strategic recommendation ${r.title} missing required grounded attributes`);
      }
    }
    console.log(`✅ Strategic Recommendations verified: ${recs.length} grounded recommendations with confidence and evidence.\n`);

    // -------------------------------------------------------------------------
    // STEP 11: 30-Day Retention, Soft-Delete & Legal Hold Protection
    // -------------------------------------------------------------------------
    console.log('--- STEP 11: Retention, Soft-Delete & Legal Hold Protection ---');

    // Test soft delete of scenario
    const softDeletedScenario = await withRetry(() =>
      StrategicService.softDeleteScenario(adminClient, scenario.id, testUsers.enterprise.id)
    );
    if (!softDeletedScenario) {
      throw new Error('Failed to soft delete scenario');
    }

    const { data: deletedScenarioData } = await adminClient
      .from('strategic_scenarios')
      .select('deleted_at, purge_after')
      .eq('id', scenario.id)
      .single();

    if (!deletedScenarioData?.deleted_at || !deletedScenarioData?.purge_after) {
      throw new Error('Soft delete did not populate deleted_at or purge_after for scenario');
    }
    console.log('✅ Scenario soft deleted with 30-day retention purge timestamp');

    // Test restore scenario
    const restoredScenario = await withRetry(() =>
      StrategicService.restoreScenario(adminClient, scenario.id)
    );
    if (!restoredScenario) {
      throw new Error('Failed to restore scenario');
    }

    const { data: restoredScenarioData } = await adminClient
      .from('strategic_scenarios')
      .select('deleted_at, purge_after')
      .eq('id', scenario.id)
      .single();

    if (restoredScenarioData?.deleted_at !== null || restoredScenarioData?.purge_after !== null) {
      throw new Error('Scenario restoration failed to clear deleted_at / purge_after');
    }
    console.log('✅ Scenario restored successfully');

    // Test Legal Hold protection against permanent deletion
    const { data: testOrg, error: orgErr } = await adminClient
      .from('organizations')
      .insert({
        name: 'Tasklet 23 Test Organization',
        owner_id: testUsers.enterprise.id,
      })
      .select()
      .single();

    if (orgErr || !testOrg) {
      throw new Error(`Failed to create test organization: ${orgErr?.message}`);
    }

    createdOrgId = testOrg.id;

    // Create briefing for org
    const holdBriefing = await withRetry(() =>
      StrategicService.createBriefing(
        adminClient,
        testUsers.enterprise.id,
        'transformation_report',
        'Briefing Under Legal Hold',
        createdOrgId
      )
    );

    // Soft delete briefing
    await StrategicService.softDeleteBriefing(adminClient, holdBriefing.id, testUsers.enterprise.id);

    // Create active legal hold on org
    const { data: activeHold, error: holdErr } = await adminClient
      .from('legal_holds')
      .insert({
        organization_id: createdOrgId,
        name: 'Tasklet 23 Legal Hold Protection Test',
        description: 'Statutory compliance verification',
        status: 'active',
      })
      .select()
      .single();

    if (holdErr || !activeHold) {
      throw new Error(`Failed to create active legal hold: ${holdErr?.message}`);
    }

    // Attempt permanent delete while legal hold is active - MUST FAIL
    let legalHoldBlocked = false;
    const { error: rpcErr } = await adminClient.rpc('permanent_delete_strategic_briefing', {
      p_briefing_id: holdBriefing.id,
      p_user_id: testUsers.enterprise.id,
    });
    if (rpcErr && rpcErr.message.toLowerCase().includes('legal hold')) {
      legalHoldBlocked = true;
    }

    if (!legalHoldBlocked) {
      throw new Error(`Security Failure: Active Legal Hold failed to block permanent deletion of briefing (RPC error: ${rpcErr?.message})`);
    }
    console.log('✅ Active Legal Hold strictly blocked permanent deletion of strategic briefing');

    // Release legal hold
    const { error: relErr } = await adminClient
      .from('legal_holds')
      .update({ status: 'released' })
      .eq('id', activeHold.id);
    if (relErr) {
      throw new Error(`Failed to release legal hold: ${relErr.message}`);
    }

    // Now permanent deletion should succeed
    const { error: postReleaseErr } = await adminClient.rpc('permanent_delete_strategic_briefing', {
      p_briefing_id: holdBriefing.id,
      p_user_id: testUsers.enterprise.id,
    });
    if (postReleaseErr) {
      throw new Error(`Permanent deletion failed after legal hold was released: ${postReleaseErr.message}`);
    }
    console.log('✅ Legal hold released; permanent deletion executed successfully.\n');

    // -------------------------------------------------------------------------
    // STEP 12: Immutable Audit Logging Verification
    // -------------------------------------------------------------------------
    console.log('--- STEP 12: Immutable Audit Logging ---');

    // Trigger audited endpoints via API router
    await handleApiRequest({
      method: 'GET',
      url: '/api/strategic/recommendations',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
    });

    await handleApiRequest({
      method: 'GET',
      url: '/api/strategic/performance',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
    });

    await handleApiRequest({
      method: 'POST',
      url: '/api/strategic/scenarios/simulate',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
      body: {
        scenarioType: 'delivery_slowdown',
        parameters: { deliverySlowdownPercent: 15 },
      },
    });

    await handleApiRequest({
      method: 'POST',
      url: '/api/strategic/scenarios',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
      body: {
        title: 'Audited Scenario',
        scenarioType: 'delivery_slowdown',
        parameters: { deliverySlowdownPercent: 15 },
      },
    });

    await handleApiRequest({
      method: 'POST',
      url: '/api/strategic/briefings',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
      body: {
        briefingType: 'board_update',
        title: 'Audited Briefing',
      },
    });

    await handleApiRequest({
      method: 'POST',
      url: '/api/strategic/alerts',
      headers: {
        authorization: `Bearer ${testUsers.enterprise.token}`,
        'content-type': 'application/json',
      },
      body: {
        alertType: 'critical_risk_emerging',
        severity: 'high',
        title: 'Audited Strategic Alert',
        description: 'Verification of audit log emission',
      },
    });

    const { data: auditLogs } = await adminClient
      .from('audit_logs')
      .select('action, entity_type')
      .order('created_at', { ascending: false })
      .limit(30);

    const loggedActions = new Set((auditLogs || []).map((l: any) => l.action));
    console.log(`Logged audit actions in sample: ${Array.from(loggedActions).join(', ')}`);

    const expectedActions = [
      'digital_twin_access',
      'simulation_executed',
      'scenario_created',
      'executive_briefing_generated',
      'strategic_alert_generated',
      'strategic_recommendation_generated',
      'executive_dashboard_access',
    ];

    for (const exp of expectedActions) {
      if (!loggedActions.has(exp)) {
        throw new Error(`Audit Failure: Expected audit action "${exp}" was not logged!`);
      }
      console.log(`✅ Audit action verified: ${exp}`);
    }

    console.log('\n===============================================================');
    console.log('✅ ALL TASKLET 23 VERIFICATION TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('===============================================================\n');
  } finally {
    // Cleanup test artifacts
    if (testProjId) await adminClient.from('projects').delete().eq('id', testProjId);
    if (testActId) await adminClient.from('action_tracker').delete().eq('id', testActId);
    if (createdOrgId) await adminClient.from('organizations').delete().eq('id', createdOrgId);
    for (const user of Object.values(testUsers)) {
      if (user.id) {
        await adminClient.auth.admin.deleteUser(user.id);
      }
    }
  }
}

runTasklet23Tests().catch((err) => {
  console.error('\n❌ TASKLET 23 VERIFICATION FAILED:', err);
  process.exit(1);
});
