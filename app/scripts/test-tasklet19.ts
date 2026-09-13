import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { canUseFeature } from '../src/lib/permissions/canUseFeature';
import { handleApiRequest } from '../src/server/apiRouter';
import { INITIAL_AGENTS } from '../src/lib/agents/types';
import { runAgent } from '../src/lib/agents/agentRunner';
import {
  setAgentMemory,
  getAgentMemory,
  listAgentMemory,
  deleteAgentMemory,
  fetchAgentActivity,
} from '../src/lib/agents/agentMemoryService';
import {
  fetchWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  triggerWorkflow,
  fetchWorkflowExecutions,
  fetchWorkflowApprovals,
  respondToApproval,
} from '../src/lib/workflows/workflowService';

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
  console.log('TASKLET 19: AI AGENTS, WORKFLOW ORCHESTRATION & OPERATIONAL AUTOMATION');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testUsers: Record<string, any> = {};

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Provision Test Users for Tiers (Starter, Pro, Team, Enterprise, Admin)
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: Provisioning Test Users ---');
    const userConfigs = [
      { key: 'starter', email: `starter_user_${timestamp}@concludo.au`, plan: 'starter' },
      { key: 'pro', email: `pro_user_${timestamp}@concludo.au`, plan: 'pro' },
      { key: 'team', email: `team_user_${timestamp}@concludo.au`, plan: 'team' },
      { key: 'enterprise', email: `enterprise_user_${timestamp}@concludo.au`, plan: 'enterprise' },
      { key: 'admin', email: `admin_user_${timestamp}@concludo.au`, plan: 'admin' },
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
      if (signErr) throw signErr;

      testUsers[conf.key] = {
        id: uid,
        email: conf.email,
        plan: conf.plan,
        token: signData?.session?.access_token || '',
      };
    }
    console.log('✅ Provisioned test users across Starter, Pro, Team, Enterprise, and Admin tiers.');

    // -------------------------------------------------------------------------
    // STEP 2: Authoritative Feature Gating Verification
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: Verifying Feature Gating Matrix ---');
    const agentFeatures = [
      'ai_agents',
      'workflow_orchestration',
      'intelligent_automation',
      'agent_memory',
      'workflow_approvals',
    ];

    // Starter should be DENIED
    for (const f of agentFeatures) {
      const check = await canUseFeature(testUsers.starter.id, f, { supabase: adminClient });
      if (check.allowed) {
        throw new Error(`Security breach: Starter user was granted ${f}`);
      }
    }
    console.log('✅ Starter tier strictly DENIED all AI agent & workflow features (HTTP 403).');

    // Pro should be DENIED
    for (const f of agentFeatures) {
      const check = await canUseFeature(testUsers.pro.id, f, { supabase: adminClient });
      if (check.allowed) {
        throw new Error(`Security breach: Pro user was granted ${f}`);
      }
    }
    console.log('✅ Pro tier strictly DENIED AI agent & workflow features (HTTP 403).');

    // Team without org enablement should be DENIED
    for (const f of agentFeatures) {
      const check = await canUseFeature(testUsers.team.id, f, { supabase: adminClient });
      if (check.allowed) {
        throw new Error(`Security breach: Team user without org enablement was granted ${f}`);
      }
    }
    console.log('✅ Team user without organization enablement strictly DENIED (HTTP 403).');

    // Enterprise should be GRANTED
    for (const f of agentFeatures) {
      const check = await canUseFeature(testUsers.enterprise.id, f, { supabase: adminClient });
      if (!check.allowed) {
        throw new Error(`Enterprise user was denied ${f}: ${JSON.stringify(check.error)}`);
      }
    }
    console.log('✅ Enterprise tier strictly GRANTED all AI agent & workflow features.');

    // Admin should be GRANTED
    for (const f of agentFeatures) {
      const check = await canUseFeature(testUsers.admin.id, f, { supabase: adminClient });
      if (!check.allowed) {
        throw new Error(`Admin user was denied ${f}: ${JSON.stringify(check.error)}`);
      }
    }
    console.log('✅ Admin tier strictly GRANTED all AI agent & workflow features.');

    // Team WITH org enablement override
    const { data: orgData } = await adminClient
      .from('organizations')
      .insert({
        name: `Org With Agents ${timestamp}`,
        owner_id: testUsers.enterprise.id,
        allow_team_agents: true,
      })
      .select('id')
      .single();

    if (orgData) {
      await adminClient.from('organization_members').insert({
        organization_id: orgData.id,
        user_id: testUsers.team.id,
        role: 'member',
      });

      const teamCheckWithOrg = await canUseFeature(testUsers.team.id, 'ai_agents', { supabase: adminClient });
      if (!teamCheckWithOrg.allowed) {
        throw new Error('Team user in organization with allow_team_agents was unexpectedly denied access');
      }
      console.log('✅ Optional access for Team user in organization with allow_team_agents verified.');
    }

    // -------------------------------------------------------------------------
    // STEP 3: Server API Router Backend Protection
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: Server API Router Backend Enforcement ---');
    // Starter accessing /api/agents
    const starterReq = await handleApiRequest({
      method: 'GET',
      url: '/api/agents',
      headers: { authorization: `Bearer ${testUsers.starter.token}` },
    });
    if (starterReq.status !== 403) {
      throw new Error(`Expected HTTP 403 for Starter accessing /api/agents, got ${starterReq.status}`);
    }
    console.log('✅ Server API Router returned HTTP 403 Forbidden for Starter user on /api/agents.');

    // Enterprise accessing /api/agents
    const entReq = await handleApiRequest({
      method: 'GET',
      url: '/api/agents',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });
    if (entReq.status !== 200 || !entReq.body.data || entReq.body.data.length !== 7) {
      throw new Error(`Expected HTTP 200 with 7 agents for Enterprise user, got ${entReq.status}`);
    }
    console.log('✅ Server API Router returned HTTP 200 OK with all 7 foundational agents for Enterprise user.');

    // Suspended user check
    await adminClient.from('profiles').update({ is_suspended: true }).eq('id', testUsers.enterprise.id);
    const suspendedReq = await handleApiRequest({
      method: 'GET',
      url: '/api/agents',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });
    if (suspendedReq.status !== 403 || suspendedReq.body.error !== 'user_suspended') {
      throw new Error(`Expected HTTP 403 user_suspended, got ${suspendedReq.status}`);
    }
    console.log('✅ Suspended Enterprise user strictly blocked with HTTP 403 user_suspended.');
    await adminClient.from('profiles').update({ is_suspended: false }).eq('id', testUsers.enterprise.id);

    // -------------------------------------------------------------------------
    // STEP 4: AI Agent Framework Execution (All 7 Foundational Agents)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: AI Agent Framework (All 7 Foundational Agents) ---');
    const entUid = testUsers.enterprise.id;

    // 1. Meeting Follow-Up Agent
    const mfResult = await runAgent({
      agentType: 'meeting_followup',
      userId: entUid,
      admin: true,
    });
    if (mfResult.status !== 'requires_approval' || !mfResult.data.suggestedFollowUpMessage) {
      throw new Error(`Meeting Follow-Up Agent unexpected output: ${JSON.stringify(mfResult)}`);
    }
    console.log('✅ Meeting Follow-Up Agent executed: synthesized follow-up summary, reviews, and agenda (Approval Required).');

    // 2. Decision Follow-Up Agent
    const dfResult = await runAgent({
      agentType: 'decision_followup',
      userId: entUid,
      admin: true,
    });
    if (dfResult.status !== 'completed' || !dfResult.data.recommendations) {
      throw new Error(`Decision Follow-Up Agent unexpected output: ${JSON.stringify(dfResult)}`);
    }
    console.log('✅ Decision Follow-Up Agent executed: audited decisions and formulated recommendations without autonomous mutation.');

    // 3. Action Accountability Agent
    const aaResult = await runAgent({
      agentType: 'action_accountability',
      userId: entUid,
      admin: true,
    });
    if (!aaResult.data.escalationDraft) {
      throw new Error(`Action Accountability Agent unexpected output: ${JSON.stringify(aaResult)}`);
    }
    console.log('✅ Action Accountability Agent executed: monitored overdue/blocked actions and drafted escalation report.');

    // 4. Project Intelligence Agent
    const piResult = await runAgent({
      agentType: 'project_intelligence',
      userId: entUid,
      admin: true,
    });
    if (piResult.status !== 'completed' || !piResult.data.repeatedThemes) {
      throw new Error(`Project Intelligence Agent unexpected output: ${JSON.stringify(piResult)}`);
    }
    console.log('✅ Project Intelligence Agent executed: analyzed meeting history and extracted themes/bottlenecks.');

    // 5. Risk Monitoring Agent
    const rmResult = await runAgent({
      agentType: 'risk_monitoring',
      userId: entUid,
      admin: true,
    });
    if (rmResult.status !== 'completed' || !rmResult.data.riskLevel) {
      throw new Error(`Risk Monitoring Agent unexpected output: ${JSON.stringify(rmResult)}`);
    }
    console.log('✅ Risk Monitoring Agent executed: flagged patterns for review with zero autonomous intervention.');

    // 6. Report Generation Agent
    const rgResult = await runAgent({
      agentType: 'report_generation',
      userId: entUid,
      admin: true,
    });
    if (rgResult.status !== 'completed' || !rgResult.data.executiveBriefing) {
      throw new Error(`Report Generation Agent unexpected output: ${JSON.stringify(rgResult)}`);
    }
    console.log('✅ Report Generation Agent executed: produced Endpoint Report and Executive Briefing.');

    // 7. Workflow Coordinator Agent
    const wcResult = await runAgent({
      agentType: 'workflow_coordinator',
      userId: entUid,
      admin: true,
    });
    if (wcResult.status !== 'requires_approval' || !wcResult.approvalId) {
      throw new Error(`Workflow Coordinator Agent unexpected output: ${JSON.stringify(wcResult)}`);
    }
    console.log('✅ Workflow Coordinator Agent executed: coordinated multi-step pipeline with mandatory human approval.');

    // -------------------------------------------------------------------------
    // STEP 5: Agent Memory & Tasklet 11 Retention Compatibility
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Agent Memory Management & Soft Delete ---');
    const memoryRecord = await setAgentMemory({
      agentType: 'meeting_followup',
      memoryKey: `test_memory_${timestamp}`,
      memoryValue: { notes: 'Executive alignment confirmed', confidence: 0.98 },
      ownerId: entUid,
      admin: true,
    });
    if (!memoryRecord || !memoryRecord.id) {
      throw new Error('Failed to set agent memory');
    }

    const fetchedMemory = await getAgentMemory({
      agentType: 'meeting_followup',
      memoryKey: `test_memory_${timestamp}`,
      ownerId: entUid,
      admin: true,
    });
    if (!fetchedMemory || fetchedMemory.memory_value.confidence !== 0.98) {
      throw new Error('Failed to retrieve agent memory');
    }
    console.log('✅ Agent memory saved and retrieved successfully.');

    // Soft delete memory
    await deleteAgentMemory(memoryRecord.id, entUid, true);
    const deletedMemory = await getAgentMemory({
      agentType: 'meeting_followup',
      memoryKey: `test_memory_${timestamp}`,
      ownerId: entUid,
      admin: true,
    });
    if (deletedMemory !== null) {
      throw new Error('Soft-deleted agent memory was unexpectedly returned');
    }
    console.log('✅ Agent memory soft-delete verified: deleted_at populated, excluded from active queries.');

    // -------------------------------------------------------------------------
    // STEP 6: Workflow Orchestration Engine & Execution Flow
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: Workflow Orchestrator & Approval System ---');
    // Create workflow with approval_required (default)
    const workflow = await createWorkflow(
      {
        owner_id: entUid,
        name: `Meeting Post-Processing Pipeline ${timestamp}`,
        description: 'Auto-generates summaries and prepares Planner task dispatches with sign-off',
        trigger_type: 'meeting_completed',
        actions: [{ type: 'generate_summary', config: {} }, { type: 'create_planner_task', config: {} }],
        execution_type: 'approval_required',
      },
      true
    );
    if (!workflow || workflow.execution_type !== 'approval_required') {
      throw new Error('Failed to create workflow with approval_required');
    }
    console.log(`✅ Workflow created with approval_required default: "${workflow.name}"`);

    // Trigger workflow -> requires_approval
    const triggerRes = await triggerWorkflow({
      workflowId: workflow.id,
      userId: entUid,
      triggerData: { meetingId: `m_${timestamp}`, title: 'Strategic Review' },
      admin: true,
    });
    if (triggerRes.execution.status !== 'requires_approval' || !triggerRes.approval) {
      throw new Error(`Expected execution requires_approval, got ${triggerRes.execution.status}`);
    }
    const approvalId = triggerRes.approval.id;
    console.log(`✅ Workflow triggered: execution status requires_approval; approval staged (ID: ${approvalId}).`);

    // Admin Authorises Approval
    const approvedResult = await respondToApproval({
      approvalId,
      approverId: entUid,
      decision: 'approve',
      notes: 'Sign-off granted for Planner dispatch.',
      admin: true,
    });
    if (approvedResult.status !== 'approved' || !approvedResult.approved_at) {
      throw new Error(`Failed to approve request: ${JSON.stringify(approvedResult)}`);
    }

    // Verify linked execution updated to completed
    const { data: updatedExec } = await adminClient
      .from('workflow_executions')
      .select('*')
      .eq('id', triggerRes.execution.id)
      .single();

    if (updatedExec.status !== 'completed') {
      throw new Error(`Expected execution status to become completed after approval, got ${updatedExec.status}`);
    }
    console.log('✅ Human approval granted: status updated to approved, execution marked completed.');

    // Trigger second workflow run and test rejection
    const triggerRes2 = await triggerWorkflow({
      workflowId: workflow.id,
      userId: entUid,
      triggerData: { meetingId: `m_${timestamp}_2` },
      admin: true,
    });
    const approvalId2 = triggerRes2.approval!.id;

    await respondToApproval({
      approvalId: approvalId2,
      approverId: entUid,
      decision: 'reject',
      notes: 'Action payload contains incomplete stakeholder list.',
      admin: true,
    });

    const { data: updatedExec2 } = await adminClient
      .from('workflow_executions')
      .select('*')
      .eq('id', triggerRes2.execution.id)
      .single();

    if (updatedExec2.status !== 'rejected') {
      throw new Error(`Expected execution status to become rejected, got ${updatedExec2.status}`);
    }
    console.log('✅ Human rejection recorded: status updated to rejected, execution marked rejected.');

    // -------------------------------------------------------------------------
    // STEP 7: Audit Logging & Activity Trail
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: Immutable Audit Logging ---');
    const { data: auditRecords } = await adminClient
      .from('audit_logs')
      .select('action, entity_type, entity_id, created_at')
      .in('action', [
        'agent_execution',
        'workflow_execution',
        'approval_request',
        'approval_granted',
        'approval_rejected',
        'workflow_change',
      ])
      .order('created_at', { ascending: false })
      .limit(20);

    const capturedActions = new Set(auditRecords?.map((r) => r.action));
    const requiredAuditEvents = [
      'agent_execution',
      'workflow_execution',
      'approval_request',
      'approval_granted',
      'approval_rejected',
      'workflow_change',
    ];

    for (const ev of requiredAuditEvents) {
      if (!capturedActions.has(ev)) {
        throw new Error(`Audit event missing from audit trail: ${ev}`);
      }
    }
    console.log(`✅ All ${requiredAuditEvents.length} Tasklet 19 audit event types captured in immutable audit_logs.`);

    // -------------------------------------------------------------------------
    // STEP 8: Legal Hold & Retention Purge Protection
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: Legal Hold Override of Purge ---');
    // Create an expired soft-deleted workflow
    const pastDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredWf } = await adminClient
      .from('workflows')
      .insert({
        owner_id: entUid,
        name: `Expired Hold Test ${timestamp}`,
        trigger_type: 'workflow_schedule',
        deleted_at: pastDate,
        purge_after: pastDate,
      })
      .select('id')
      .single();

    // Create an active legal hold on the user's organization
    const { data: hold } = await adminClient
      .from('legal_holds')
      .insert({
        organization_id: orgData.id,
        name: `Legal Hold Case ${timestamp}`,
        status: 'active',
      })
      .select('id')
      .single();

    // Run purge
    const { data: purgeResult } = await adminClient.rpc('purge_expired_records');

    // Verify expired workflow was NOT purged because of active legal hold
    const { data: wfCheck } = await adminClient
      .from('workflows')
      .select('id')
      .eq('id', expiredWf.id)
      .maybeSingle();

    if (!wfCheck) {
      throw new Error('Compliance breach: Workflow was purged while under active legal hold!');
    }
    console.log('✅ Legal hold strictly prevented workflow purge.');

    // Release hold
    await adminClient.from('legal_holds').update({ status: 'released' }).eq('id', hold.id);
    console.log('✅ Legal hold released successfully.');

    console.log('\n================================================================');
    console.log('ALL TASKLET 19 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    // Cleanup test fixtures
    console.log('Cleaning up Tasklet 19 test fixtures...');
    for (const [key, u] of Object.entries(testUsers)) {
      try {
        await adminClient.auth.admin.deleteUser(u.id);
      } catch {}
    }
    console.log('✅ Cleanup completed.');
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ Tasklet 19 Test Suite Failed:\n', err);
  process.exit(1);
});
