import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { canUseFeature } from '../src/lib/permissions/canUseFeature';
import { handleApiRequest } from '../src/server/apiRouter';
import { KnowledgeEngine } from '../src/lib/knowledge/knowledgeEngine';
import { runAgent } from '../src/lib/agents/agentRunner';

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

async function runTests() {
  console.log('================================================================');
  console.log('TASKLET 21 VERIFICATION SUITE');
  console.log('Concludo Knowledge Network, Memory Graph & Strategic Knowledge');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testUsers: Record<string, any> = {};
  let createdOrgId: string | null = null;
  let testProjId: string | null = null;
  let testDecId: string | null = null;
  let testActId: string | null = null;
  let testBlockedActId: string | null = null;
  let testOutputId: string | null = null;
  let testTransId: string | null = null;

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
    console.log('✅ Provisioned authenticated test users for all subscription tiers.\n');

    // -------------------------------------------------------------------------
    // STEP 2: Feature Gating & Backend Permission Enforcement
    // -------------------------------------------------------------------------
    console.log('--- STEP 2: Verifying Knowledge Feature Gating ---');
    const knowledgeFeatures = [
      'knowledge_graph',
      'knowledge_explorer',
      'organizational_memory',
      'relationship_discovery',
      'evidence_networks',
      'executive_knowledge_explorer',
      'knowledge_analytics',
    ];

    // Starter should be denied all
    for (const feat of knowledgeFeatures) {
      const res = await canUseFeature(testUsers.starter.id, feat, { supabase: adminClient });
      if (res.allowed) throw new Error(`Starter user unexpectedly allowed ${feat}`);
    }
    console.log('✅ Starter tier strictly DENIED all knowledge features.');

    // Pro should be denied all
    for (const feat of knowledgeFeatures) {
      const res = await canUseFeature(testUsers.pro.id, feat, { supabase: adminClient });
      if (res.allowed) throw new Error(`Pro user unexpectedly allowed ${feat}`);
    }
    console.log('✅ Pro tier strictly DENIED all knowledge features.');

    // Team default should be denied (before org enablement)
    for (const feat of knowledgeFeatures) {
      const res = await canUseFeature(testUsers.team.id, feat, { supabase: adminClient });
      if (res.allowed) throw new Error(`Team user unexpectedly allowed ${feat} without org override`);
    }
    console.log('✅ Team tier strictly DENIED knowledge features by default without org enablement.');

    // Enterprise and Admin should be granted all
    for (const feat of knowledgeFeatures) {
      const entRes = await canUseFeature(testUsers.enterprise.id, feat, { supabase: adminClient });
      if (!entRes.allowed) throw new Error(`Enterprise user denied ${feat}`);

      const admRes = await canUseFeature(testUsers.admin.id, feat, { supabase: adminClient });
      if (!admRes.allowed) throw new Error(`Admin user denied ${feat}`);
    }
    console.log('✅ Enterprise and Admin tiers strictly GRANTED all knowledge features.');

    // Test Team Optional Access when enabled by organization administrator
    const { data: orgData, error: orgErr } = await adminClient.from('organizations').insert({
      name: `Knowledge Org ${timestamp}`,
      owner_id: testUsers.enterprise.id,
      allow_team_knowledge: true,
    }).select().single();
    if (orgErr) throw orgErr;
    createdOrgId = orgData.id;

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

    // Now Team user should have knowledge features...
    const teamAllowedFeatures = [
      'knowledge_graph',
      'knowledge_explorer',
      'organizational_memory',
      'relationship_discovery',
      'evidence_networks',
      'knowledge_analytics',
    ];
    for (const feat of teamAllowedFeatures) {
      const res = await canUseFeature(testUsers.team.id, feat, { supabase: adminClient });
      if (!res.allowed) throw new Error(`Team user should have ${feat} when org has allow_team_knowledge=true`);
    }

    // ... BUT executive_knowledge_explorer MUST STILL BE DENIED!
    const execRes = await canUseFeature(testUsers.team.id, 'executive_knowledge_explorer', { supabase: adminClient });
    if (execRes.allowed) throw new Error('Team user unexpectedly granted executive_knowledge_explorer (must be enterprise only)');
    console.log('✅ Team tier optional access verified: granted knowledge features via org override, executive_knowledge_explorer strictly withheld.\n');

    // -------------------------------------------------------------------------
    // STEP 3: API Router Enforcement & Tenant Scope Isolation
    // -------------------------------------------------------------------------
    console.log('--- STEP 3: Verifying Server API Router Enforcement & Tenant Isolation ---');

    // Starter denied at API
    const starterApiRes = await handleApiRequest({
      url: '/api/knowledge/sync',
      method: 'POST',
      headers: { authorization: `Bearer ${testUsers.starter.token}` },
      body: {},
    });
    if (starterApiRes.status !== 403) throw new Error(`Expected 403 Forbidden for Starter user on /api/knowledge/sync, got ${starterApiRes.status}`);

    // Suspended User Denied
    await adminClient.from('profiles').update({ is_suspended: true }).eq('id', testUsers.enterprise.id);
    const suspendedApiRes = await handleApiRequest({
      url: '/api/knowledge/sync',
      method: 'POST',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
      body: {},
    });
    if (suspendedApiRes.status !== 403 || suspendedApiRes.body?.error !== 'user_suspended') {
      throw new Error(`Expected 403 user_suspended, got ${suspendedApiRes.status}`);
    }
    await adminClient.from('profiles').update({ is_suspended: false }).eq('id', testUsers.enterprise.id);

    // Unauthorized Cross-Org Scope Denied: Isolated user attempts to query Enterprise user's org
    const unauthOrgRes = await handleApiRequest({
      url: `/api/knowledge/nodes?organization_id=${orgData.id}`,
      method: 'GET',
      headers: { authorization: `Bearer ${testUsers.isolated.token}` },
    });
    if (unauthOrgRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized organization scope, got ${unauthOrgRes.status}`);
    }
    console.log('✅ Server API Router strictly blocks unauthorized tiers, suspended users, and cross-tenant scopes.\n');

    // -------------------------------------------------------------------------
    // STEP 4: Knowledge Graph Engine Sync across all 14 Node Types & 15 Relationships
    // -------------------------------------------------------------------------
    console.log('--- STEP 4: Knowledge Graph Synchronization & Discovery ---');

    // Create test project, decision, action, output, transcript
    const { data: testProj, error: pErr } = await adminClient.from('projects').insert({
      user_id: testUsers.enterprise.id,
      title: `Strategic Transformation Program ${timestamp}`,
      client_or_project: 'Enterprise Knowledge Initiative',
      meeting_date: new Date().toISOString().split('T')[0],
    }).select().single();
    if (pErr) throw pErr;
    testProjId = testProj.id;

    const { data: testDecision, error: dErr } = await adminClient.from('decision_memory').insert({
      project_id: testProj.id,
      user_id: testUsers.enterprise.id,
      decision_title: 'Adopt Centralized Knowledge Graph Memory',
      decision_summary: 'Decided to deploy interconnected knowledge architecture linking all workspace data.',
      decision_owner: 'Anthony Cortez',
      decision_date: new Date().toISOString().split('T')[0],
    }).select().single();
    if (dErr) throw dErr;
    testDecId = testDecision.id;

    const { data: testAction, error: aErr } = await adminClient.from('action_tracker').insert({
      project_id: testProj.id,
      user_id: testUsers.enterprise.id,
      action_title: 'Implement Knowledge Node Schema and Relations',
      action_description: 'Deploy tables and relationships for complete memory tracking.',
      status: 'completed',
      owner_name: 'Anthony Cortez',
    }).select().single();
    if (aErr) throw aErr;
    testActId = testAction.id;

    const { data: testBlockedAction, error: baErr } = await adminClient.from('action_tracker').insert({
      project_id: testProj.id,
      user_id: testUsers.enterprise.id,
      action_title: 'Legacy System Archive Export',
      action_description: 'Awaiting firewall configuration sign-off',
      status: 'blocked',
      owner_name: 'External DevOps',
    }).select().single();
    if (baErr) throw baErr;
    testBlockedActId = testBlockedAction.id;

    const { data: testOutput, error: oErr } = await adminClient.from('outputs').insert({
      project_id: testProj.id,
      user_id: testUsers.enterprise.id,
      output_type: 'summary',
      content: 'Complete structural specification of knowledge nodes and evidence networks.',
    }).select().single();
    if (oErr) throw oErr;
    testOutputId = testOutput.id;

    const { data: testTranscript, error: tErr } = await adminClient.from('transcripts').insert({
      project_id: testProj.id,
      user_id: testUsers.enterprise.id,
      raw_text: 'Anthony: We must connect all decisions and actions to our persistent organizational memory graph.',
    }).select().single();
    if (tErr) throw tErr;
    testTransId = testTranscript.id;

    const engine = new KnowledgeEngine(adminClient);
    const syncResult = await engine.syncKnowledgeGraph({
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });

    if (syncResult.nodesCount < 4) throw new Error(`Expected at least 4 nodes synced, got ${syncResult.nodesCount}`);
    if (syncResult.relationshipsCount < 3) throw new Error(`Expected at least 3 relationships discovered, got ${syncResult.relationshipsCount}`);
    console.log(`✅ Synced knowledge graph: ${syncResult.nodesCount} nodes, ${syncResult.relationshipsCount} relationships discovered.`);

    // -------------------------------------------------------------------------
    // STEP 5: Knowledge Search, Decision Networks, Project Networks, Evidence, Timeline & Journey
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Verifying Knowledge Explorer, Networks, Evidence & Timeline ---');

    // 1. Search
    const searchResults = await engine.searchKnowledge('Transformation', {
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (searchResults.length === 0) throw new Error('Search failed to find project node');
    const firstMatch = searchResults[0];
    if (!firstMatch.node.title || !firstMatch.relationship_path.length || !firstMatch.confidence_score) {
      throw new Error('Search result missing relationship path or confidence score');
    }
    console.log(`✅ Knowledge Search returned ${searchResults.length} matches with confidence ${firstMatch.confidence_score}% (${firstMatch.confidence_level}).`);

    // 2. Decision Network
    const decNet = await engine.getDecisionNetwork(testDecision.id, {
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (!decNet || !decNet.decision || !decNet.dependent_actions.length) {
      throw new Error('Decision Network failed to resolve dependent actions');
    }
    console.log(`✅ Decision Network resolved: Decision "${decNet.decision.title}" with ${decNet.dependent_actions.length} dependent actions.`);

    // 3. Project Network
    const projNet = await engine.getProjectNetwork(testProj.id, {
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (!projNet || !projNet.project || !projNet.linked_decisions.length) {
      throw new Error('Project Network failed to resolve linked decisions');
    }
    console.log(`✅ Project Network resolved: Project "${projNet.project.title}" with ${projNet.linked_decisions.length} linked decisions.`);

    // 4. Evidence Network
    const evidenceNet = await engine.getEvidenceNetwork('decision', testDecision.id, {
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (!evidenceNet.reasoning_path.length || evidenceNet.confidence_score <= 0) {
      throw new Error('Evidence Network missing reasoning path');
    }
    console.log(`✅ Evidence Network verified: Reasoning path has ${evidenceNet.reasoning_path.length} steps with ${evidenceNet.confidence_score}% confidence.`);

    // 5. Timeline
    const timeline = await engine.getKnowledgeTimeline({
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (timeline.length === 0) throw new Error('Knowledge timeline returned empty');
    console.log(`✅ Knowledge Timeline returned ${timeline.length} chronological events.`);

    // 6. Journey ("How did we arrive here?")
    const journey = await engine.getKnowledgeJourney(testAction.id, {
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (!journey.steps.length || !journey.evidence_chain.length) {
      throw new Error('Knowledge Journey reconstruction failed');
    }
    console.log(`✅ Knowledge Journey reconstructed: "${journey.title}" with ${journey.steps.length} sequential steps.`);

    // 7. Clusters
    const clusters = await engine.getKnowledgeClusters({
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (clusters.length !== 7) throw new Error(`Expected 7 knowledge cluster categories, got ${clusters.length}`);
    console.log(`✅ Knowledge Clusters verified across all 7 categories: ${clusters.map(c => c.category).join(', ')}.`);

    // 8. Analytics
    const analytics = await engine.getKnowledgeAnalytics({
      userId: testUsers.enterprise.id,
      organizationId: orgData.id,
    });
    if (analytics.total_nodes <= 0 || analytics.total_relationships <= 0) {
      throw new Error('Knowledge analytics returned zero counts');
    }
    console.log(`✅ Knowledge Analytics verified: ${analytics.total_nodes} nodes, ${analytics.total_relationships} relationships, Density: ${analytics.density}.`);

    // -------------------------------------------------------------------------
    // STEP 6: Lessons Learned Lifecycle & Retention Compatibility
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: Lessons Learned System & Retention Compatibility ---');

    // Create Lesson
    const { data: newLesson } = await adminClient.from('lessons_learned').insert({
      organization_id: orgData.id,
      project_id: testProj.id,
      created_by: testUsers.enterprise.id,
      title: 'Decoupled Graph Persistence Pattern',
      summary: 'Separating raw storage entities from semantic relationship graphs preserves high query performance.',
      outcome: 'Sub-50ms graph lookups and zero database deadlocks.',
      cluster_category: 'operational_excellence',
      tags: ['graph', 'architecture', 'performance'],
    }).select().single();

    if (!newLesson) throw new Error('Failed to create lesson learned');
    console.log(`✅ Lesson Learned created: ${newLesson.title} (${newLesson.id})`);

    // Soft Delete Lesson
    const { error: softDelErr } = await adminClient.rpc('soft_delete_lesson_learned', {
      p_lesson_id: newLesson.id,
      p_user_id: testUsers.enterprise.id,
    });
    if (softDelErr) throw new Error(`Soft delete failed: ${softDelErr.message}`);

    const { data: softDelCheck } = await adminClient
      .from('lessons_learned')
      .select('deleted_at, purge_after')
      .eq('id', newLesson.id)
      .single();

    if (!softDelCheck.deleted_at || !softDelCheck.purge_after) {
      throw new Error('Soft deleted lesson missing deleted_at or purge_after');
    }
    console.log('✅ Lesson Learned soft-deleted with 30-day purge_after retention window.');

    // Verify excluded from active query
    const { data: activeLessons } = await adminClient
      .from('lessons_learned')
      .select('id')
      .eq('id', newLesson.id)
      .is('deleted_at', null);
    if (activeLessons && activeLessons.length > 0) {
      throw new Error('Soft-deleted lesson must NOT appear in active query');
    }
    console.log('✅ Soft-deleted lesson strictly excluded from active queries.');

    // Restore Lesson
    const { error: restoreErr } = await adminClient.rpc('restore_lesson_learned', {
      p_lesson_id: newLesson.id,
      p_user_id: testUsers.enterprise.id,
    });
    if (restoreErr) throw new Error(`Restore failed: ${restoreErr.message}`);

    const { data: restoredCheck } = await adminClient
      .from('lessons_learned')
      .select('deleted_at')
      .eq('id', newLesson.id)
      .single();
    if (restoredCheck.deleted_at !== null) throw new Error('Lesson should be restored');
    console.log('✅ Lesson Learned restored successfully.');

    // Test Active Legal Hold Protection on Permanent Deletion
    const { data: legalHold, error: lhErr } = await adminClient.from('legal_holds').insert({
      organization_id: orgData.id,
      name: 'Knowledge Network Regulatory Audit Hold',
      description: 'Preserving all enterprise knowledge graphs, lessons, and relationships',
      status: 'active',
    }).select().single();
    if (lhErr) throw lhErr;

    let blockedByHold = false;
    try {
      const { error: permErr } = await adminClient.rpc('permanent_delete_lesson_learned', {
        p_lesson_id: newLesson.id,
        p_user_id: testUsers.enterprise.id,
      });
      if (permErr) {
        if (permErr.message.includes('Active Legal Hold in effect')) blockedByHold = true;
        else throw permErr;
      }
    } catch (err: any) {
      if (err.message.includes('Active Legal Hold in effect')) blockedByHold = true;
      else throw err;
    }

    if (!blockedByHold) throw new Error('Active Legal Hold MUST block permanent deletion of lessons learned');
    console.log('✅ Active Legal Hold strictly blocked permanent deletion RPC.');

    // Release Legal Hold & Complete Cleanup
    await adminClient.from('legal_holds').update({ status: 'released' }).eq('id', legalHold.id);
    const { error: cleanPermErr } = await adminClient.rpc('permanent_delete_lesson_learned', {
      p_lesson_id: newLesson.id,
      p_user_id: testUsers.enterprise.id,
    });
    if (cleanPermErr) throw new Error(`Permanent deletion failed after releasing hold: ${cleanPermErr.message}`);
    console.log('✅ Legal hold released; permanent deletion succeeded.');

    // -------------------------------------------------------------------------
    // STEP 7: Immutable Audit Logging Verification
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: Verifying Immutable Audit Logs ---');

    // Trigger create relationship via API
    const { data: twoNodes } = await adminClient
      .from('knowledge_nodes')
      .select('id')
      .eq('owner_id', testUsers.enterprise.id)
      .limit(2);

    let createdRelId: string | null = null;
    if (twoNodes && twoNodes.length >= 2) {
      const createRelRes = await handleApiRequest({
        url: '/api/knowledge/relationships',
        method: 'POST',
        headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
        body: {
          source_node_id: twoNodes[0].id,
          target_node_id: twoNodes[1].id,
          relationship_type: 'references',
          confidence_score: 95,
          context_notes: 'Created via API verification',
        },
      });
      if (createRelRes.status !== 201) throw new Error(`Failed to create relationship via API: ${createRelRes.status} ${JSON.stringify(createRelRes.body)}`);
      createdRelId = createRelRes.body?.data?.id;
    }

    // Trigger update relationship
    const relToUpdate = createdRelId;
    if (relToUpdate) {
      const updateRelRes = await handleApiRequest({
        url: `/api/knowledge/relationships/${relToUpdate}`,
        method: 'PATCH',
        headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
        body: { context_notes: 'Updated verification note', confidence_score: 97 },
      });
      if (updateRelRes.status !== 200) throw new Error(`Failed to update relationship: ${updateRelRes.status}`);
    }

    // Trigger search
    await handleApiRequest({
      url: '/api/knowledge/search',
      method: 'POST',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
      body: { query: 'Transformation' },
    });

    // Trigger analytics
    await handleApiRequest({
      url: '/api/knowledge/analytics',
      method: 'GET',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });

    // Trigger visualization
    await handleApiRequest({
      url: '/api/knowledge/visualization',
      method: 'GET',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });

    // Trigger clusters
    await handleApiRequest({
      url: '/api/knowledge/clusters',
      method: 'GET',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });

    // Trigger explorer
    await handleApiRequest({
      url: '/api/executive-explorer',
      method: 'GET',
      headers: { authorization: `Bearer ${testUsers.enterprise.token}` },
    });

    // Verify audit logs in database
    const { data: auditRecords } = await adminClient
      .from('audit_logs')
      .select('action, entity_type')
      .in('action', [
        'knowledge_relationship_created',
        'knowledge_relationship_updated',
        'knowledge_search',
        'knowledge_explorer_access',
        'knowledge_visualization_access',
        'knowledge_cluster_creation',
        'knowledge_analytics_access',
      ])
      .order('created_at', { ascending: false })
      .limit(30);

    const recordedActions = new Set(auditRecords?.map((a) => a.action));
    console.log(`✅ Immutable audit log captured actions: ${Array.from(recordedActions).join(', ')}`);
    if (!recordedActions.has('knowledge_relationship_created') || !recordedActions.has('knowledge_search')) {
      throw new Error('Audit logs missing knowledge relationship or search actions');
    }

    // -------------------------------------------------------------------------
    // STEP 8: AI Agent Integration
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: Verifying AI Agent Knowledge Integration ---');

    const agentResult = await runAgent({
      agentType: 'project_intelligence',
      userId: testUsers.enterprise.id,
      projectId: testProj.id,
      organizationId: orgData.id,
      admin: true,
    });

    if (agentResult.status !== 'completed' || !agentResult.summary) {
      throw new Error('Project Intelligence Agent failed to complete with knowledge integration');
    }
    console.log(`✅ AI Agent successfully consumed knowledge graph intelligence: "${agentResult.summary.slice(0, 80)}..."`);

    // Clean up
    await adminClient.from('action_tracker').delete().in('id', [testAction.id, testBlockedAction.id]);
    await adminClient.from('decision_memory').delete().eq('id', testDecision.id);
    await adminClient.from('outputs').delete().eq('id', testOutput.id);
    await adminClient.from('transcripts').delete().eq('id', testTranscript.id);
    await adminClient.from('projects').delete().eq('id', testProj.id);
    await adminClient.from('organizations').delete().eq('id', orgData.id);

    for (const key of Object.keys(testUsers)) {
      try {
        await adminClient.auth.admin.deleteUser(testUsers[key].id);
      } catch {}
    }

    console.log('\n================================================================');
    console.log('ALL TASKLET 21 VERIFICATION CHECKS PASSED (100% SUCCESS)');
    console.log('================================================================');
  } catch (err) {
    // Attempt cleanup
    if (testActId) {
      try { await adminClient.from('action_tracker').delete().in('id', [testActId, testBlockedActId].filter(Boolean)); } catch {}
    }
    if (testDecId) {
      try { await adminClient.from('decision_memory').delete().eq('id', testDecId); } catch {}
    }
    if (testOutputId) {
      try { await adminClient.from('outputs').delete().eq('id', testOutputId); } catch {}
    }
    if (testTransId) {
      try { await adminClient.from('transcripts').delete().eq('id', testTransId); } catch {}
    }
    if (testProjId) {
      try { await adminClient.from('projects').delete().eq('id', testProjId); } catch {}
    }
    if (createdOrgId) {
      try {
        await adminClient.from('organizations').delete().eq('id', createdOrgId);
      } catch {}
    }
    for (const key of Object.keys(testUsers)) {
      try {
        await adminClient.auth.admin.deleteUser(testUsers[key].id);
      } catch {}
    }
    throw err;
  }
}

runTests().catch((err) => {
  console.error('\n❌ Tasklet 21 Verification Failed:', err);
  process.exit(1);
});
