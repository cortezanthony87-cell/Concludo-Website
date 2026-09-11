import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import {
  fetchProjectOutputs,
  fetchOutputById,
  saveOutput,
  updateOutput,
  softDeleteOutput
} from '../src/lib/outputs/outputClient';
import { createProject } from '../src/lib/projects/projectClient';
import { OutputType } from '../src/lib/outputs/types';

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

async function runOutputsTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 8: OUTPUT RECORDS & RLS SECURITY TEST SUITE');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const emailA = `test-user-a-${timestamp}@concludo-test.local`;
  const emailB = `test-user-b-${timestamp}@concludo-test.local`;
  const password = `TestPass!987_${timestamp}`;

  let userAId: string | null = null;
  let userBId: string | null = null;
  let projectAId: string | null = null;
  let projectBId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // Setup Test Users
    // -------------------------------------------------------------------------
    console.log('1. Setting up test users Alpha and Beta in auth...');
    const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Alpha Output User' }
    });
    if (errA || !userAData.user) throw new Error(`Failed to create User Alpha: ${errA?.message}`);
    userAId = userAData.user.id;

    const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Beta Output User' }
    });
    if (errB || !userBData.user) throw new Error(`Failed to create User Beta: ${errB?.message}`);
    userBId = userBData.user.id;

    console.log(`   ✅ User Alpha created: ${userAId}`);
    console.log(`   ✅ User Beta created: ${userBId}\n`);

    // Create authenticated client sessions
    const clientAlpha = createClient(supabaseUrl, anonKey);
    const { error: loginAErr } = await clientAlpha.auth.signInWithPassword({ email: emailA, password });
    if (loginAErr) throw new Error(`Alpha login failed: ${loginAErr.message}`);

    const clientBeta = createClient(supabaseUrl, anonKey);
    const { error: loginBErr } = await clientBeta.auth.signInWithPassword({ email: emailB, password });
    if (loginBErr) throw new Error(`Beta login failed: ${loginBErr.message}`);

    // Create projects for each user
    const { data: projA, error: projAErr } = await createProject(clientAlpha, {
      title: 'Alpha Strategic Alignment Project'
    });
    if (projAErr || !projA) throw new Error(`Alpha project creation failed: ${projAErr?.message}`);
    projectAId = projA.id;

    const { data: projB, error: projBErr } = await createProject(clientBeta, {
      title: 'Beta Operations Project'
    });
    if (projBErr || !projB) throw new Error(`Beta project creation failed: ${projBErr?.message}`);
    projectBId = projB.id;

    console.log(`   ✅ Project Alpha created: ${projectAId}`);
    console.log(`   ✅ Project Beta created: ${projectBId}\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Missing Output Type Validation
    // -------------------------------------------------------------------------
    console.log('2. Testing missing output_type validation...');
    const missingTypeRes = await saveOutput(clientAlpha, {
      project_id: projectAId,
      output_type: '' as any,
      content: 'This should fail because output_type is empty'
    });
    if (missingTypeRes.error?.message.includes('Output type missing')) {
      console.log('   ✅ Output type validation: Correctly rejected missing output type');
    } else {
      throw new Error(`Expected missing output type rejection, got: ${JSON.stringify(missingTypeRes)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Missing Content Validation
    // -------------------------------------------------------------------------
    console.log('\n3. Testing missing content validation...');
    const missingContentRes = await saveOutput(clientAlpha, {
      project_id: projectAId,
      output_type: 'summary',
      content: '   '
    });
    if (missingContentRes.error?.message.includes('Output content missing')) {
      console.log('   ✅ Output content validation: Correctly rejected whitespace/empty content');
    } else {
      throw new Error(`Expected missing content rejection, got: ${JSON.stringify(missingContentRes)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: User Alpha creates multiple outputs (Summary, Action Items, Follow-up Email)
    // -------------------------------------------------------------------------
    console.log('\n4. Testing creation of multiple outputs for a single project (Summary, Action Items, Follow-up Email)...');
    
    // Output 1: Summary
    const summaryRes = await saveOutput(clientAlpha, {
      project_id: projectAId,
      output_type: 'summary',
      content: 'Executive Summary: The team reviewed Q3 operational milestones and aligned on expanding market footprint in Melbourne.'
    });
    if (summaryRes.error || !summaryRes.data) {
      throw new Error(`Failed to create summary output: ${summaryRes.error?.message}`);
    }
    const summaryOutputId = summaryRes.data.id;
    console.log(`   ✅ Output 1 (Summary) created: ${summaryOutputId} (Type: ${summaryRes.data.output_type})`);

    // Output 2: Action Items
    const actionsRes = await saveOutput(clientAlpha, {
      project_id: projectAId,
      output_type: 'action_items',
      content: '1. Anthony: Finalise enterprise workbook pricing by Friday.\n2. Sarah: Coordinate client review session.\n3. Team: Review security policies.'
    });
    if (actionsRes.error || !actionsRes.data) {
      throw new Error(`Failed to create action items output: ${actionsRes.error?.message}`);
    }
    const actionsOutputId = actionsRes.data.id;
    console.log(`   ✅ Output 2 (Action Items) created: ${actionsOutputId} (Type: ${actionsRes.data.output_type})`);

    // Output 3: Follow-up Email
    const emailRes = await saveOutput(clientAlpha, {
      project_id: projectAId,
      output_type: 'follow_up_email',
      content: 'Subject: Summary & Next Steps - Strategic Alignment Review\n\nHi Team,\n\nThank you for the productive discussion today. Here are the core action items agreed upon...'
    });
    if (emailRes.error || !emailRes.data) {
      throw new Error(`Failed to create follow-up email output: ${emailRes.error?.message}`);
    }
    const emailOutputId = emailRes.data.id;
    console.log(`   ✅ Output 3 (Follow-up Email) created: ${emailOutputId} (Type: ${emailRes.data.output_type})`);

    // Verify Project Alpha now lists 3 outputs
    const alphaOutputsList = await fetchProjectOutputs(clientAlpha, projectAId);
    if (alphaOutputsList.error || !alphaOutputsList.data || alphaOutputsList.data.length !== 3) {
      throw new Error(`Expected 3 outputs for Project Alpha, got: ${alphaOutputsList.data?.length}`);
    }
    console.log(`   ✅ Multiple outputs verified: Project Alpha has ${alphaOutputsList.data.length} active outputs`);

    // -------------------------------------------------------------------------
    // TEST 4: Row Level Security Isolation (Read)
    // -------------------------------------------------------------------------
    console.log('\n5. Testing Row-Level Security isolation (User Beta reading User Alpha outputs)...');
    const betaQueryForAlphaOutputs = await fetchProjectOutputs(clientBeta, projectAId);
    if (betaQueryForAlphaOutputs.data && betaQueryForAlphaOutputs.data.length === 0) {
      console.log('   ✅ RLS Read Isolation: User Beta queried Project Alpha outputs and received 0 rows');
    } else {
      throw new Error(`RLS breach: User Beta saw ${betaQueryForAlphaOutputs.data?.length} of User Alpha's outputs!`);
    }

    const betaQueryById = await fetchOutputById(clientBeta, summaryOutputId);
    if (betaQueryById.error?.message.includes('not found') || betaQueryById.data === null) {
      console.log('   ✅ Direct ID Isolation: User Beta cannot fetch User Alpha output by direct ID');
    } else {
      throw new Error(`RLS breach: User Beta retrieved User Alpha output directly by ID!`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Cross-Project & Cross-User Attachment Prevention
    // -------------------------------------------------------------------------
    console.log('\n6. Testing attachment prevention to another user’s project...');
    const crossAttachAttempt = await saveOutput(clientBeta, {
      project_id: projectAId, // Belongs to Alpha
      output_type: 'summary',
      content: 'Malicious Beta output trying to attach to Alpha project'
    });
    if (crossAttachAttempt.error) {
      console.log(`   ✅ Cross-project attach prevented: ${crossAttachAttempt.error.message}`);
    } else {
      throw new Error('Security failure: User Beta was able to attach an output to User Alpha’s project!');
    }

    // Direct database level bypass test (raw insert from Beta client referencing Alpha project)
    const rawDirectInsert = await clientBeta.from('outputs').insert({
      project_id: projectAId,
      user_id: userBId,
      output_type: 'summary',
      content: 'Direct raw insert attempt'
    });
    if (rawDirectInsert.error) {
      console.log(`   ✅ Database RLS/Trigger blocked raw insert on foreign project: ${rawDirectInsert.error.message}`);
    } else {
      throw new Error('Security breach: Direct raw insert to foreign project succeeded!');
    }

    // -------------------------------------------------------------------------
    // TEST 6: User ID Spoofing Prevention
    // -------------------------------------------------------------------------
    console.log('\n7. Testing user_id spoofing prevention...');
    const rawSpoofInsert = await clientBeta.from('outputs').insert({
      project_id: projectBId,
      user_id: userAId, // Beta claims to be Alpha
      output_type: 'summary',
      content: 'Spoofed user_id insert attempt'
    });
    if (rawSpoofInsert.error) {
      console.log(`   ✅ Database RLS/Trigger blocked user_id spoofing: ${rawSpoofInsert.error.message}`);
    } else {
      throw new Error('Security breach: User Beta was able to insert output with User Alpha’s user_id!');
    }

    // -------------------------------------------------------------------------
    // TEST 7: Output Updates (Edit Support)
    // -------------------------------------------------------------------------
    console.log('\n8. Testing output editing and update immutability...');
    const originalUpdatedAt = summaryRes.data.updated_at;
    const updatedContent = 'Executive Summary (Updated): Expanded with revised revenue projections and operational KPIs.';
    
    // Allow timestamp difference
    await new Promise((res) => setTimeout(res, 200));

    const updateRes = await updateOutput(clientAlpha, summaryOutputId, {
      content: updatedContent
    });
    if (updateRes.error || !updateRes.data) {
      throw new Error(`Failed to update output: ${updateRes.error?.message}`);
    }
    if (updateRes.data.content === updatedContent && updateRes.data.updated_at > originalUpdatedAt) {
      console.log('   ✅ Output update: Successfully edited content and updated timestamp refreshed');
    } else {
      throw new Error('Output update did not correctly update content or timestamp');
    }

    // Immutability checks: Trigger prevents changing user_id, project_id, or created_at
    const spoofUpdateOwnership = await clientAlpha
      .from('outputs')
      .update({ user_id: userBId })
      .eq('id', summaryOutputId);
    if (spoofUpdateOwnership.error?.message.includes('Changing output ownership is not permitted')) {
      console.log('   ✅ Immutability: Database trigger blocked changing output user_id (ownership)');
    } else {
      throw new Error(`Failed to enforce output ownership immutability: ${spoofUpdateOwnership.error?.message}`);
    }

    const spoofUpdateProject = await clientAlpha
      .from('outputs')
      .update({ project_id: projectBId })
      .eq('id', summaryOutputId);
    if (spoofUpdateProject.error?.message.includes('Changing output project association is not permitted')) {
      console.log('   ✅ Immutability: Database trigger blocked changing output project_id');
    } else {
      throw new Error(`Failed to enforce project association immutability: ${spoofUpdateProject.error?.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Cross-User Write & Delete Prevention
    // -------------------------------------------------------------------------
    console.log('\n9. Testing cross-user update and delete prevention...');
    const betaEditAttempt = await updateOutput(clientBeta, summaryOutputId, {
      content: 'Beta modifying Alpha output'
    });
    if (betaEditAttempt.error) {
      console.log(`   ✅ Cross-user edit blocked: ${betaEditAttempt.error.message}`);
    } else {
      throw new Error('Security failure: User Beta was able to update User Alpha output!');
    }

    const betaDeleteAttempt = await softDeleteOutput(clientBeta, summaryOutputId);
    if (!betaDeleteAttempt.success) {
      console.log(`   ✅ Cross-user delete blocked: ${betaDeleteAttempt.error?.message}`);
    } else {
      throw new Error('Security failure: User Beta was able to soft-delete User Alpha output!');
    }

    // -------------------------------------------------------------------------
    // TEST 9: Soft Delete Support & Empty State Restoration
    // -------------------------------------------------------------------------
    console.log('\n10. Testing soft delete support...');
    const deleteEmailRes = await softDeleteOutput(clientAlpha, emailOutputId);
    if (!deleteEmailRes.success) {
      throw new Error(`Failed to soft-delete output: ${deleteEmailRes.error?.message}`);
    }
    console.log(`   ✅ Soft-deleted Output 3 (Follow-up Email): ${emailOutputId}`);

    // Verify row still exists in database with deleted_at timestamp
    const { data: dbRow } = await adminClient
      .from('outputs')
      .select('id, deleted_at')
      .eq('id', emailOutputId)
      .single();
    if (dbRow && dbRow.deleted_at) {
      console.log(`   ✅ Soft delete verified in database: deleted_at = ${dbRow.deleted_at}`);
    } else {
      throw new Error('Row was hard deleted instead of soft-deleted!');
    }

    // Verify normal query now returns 2 outputs instead of 3
    const activeOutputs = await fetchProjectOutputs(clientAlpha, projectAId);
    if (activeOutputs.data?.length === 2 && !activeOutputs.data.some((o) => o.id === emailOutputId)) {
      console.log('   ✅ Active output queries exclude soft-deleted records (2 remaining)');
    } else {
      throw new Error('Soft-deleted output still visible in normal query!');
    }

    // Soft delete the other two outputs to confirm empty state
    await softDeleteOutput(clientAlpha, summaryOutputId);
    await softDeleteOutput(clientAlpha, actionsOutputId);
    const emptyOutputs = await fetchProjectOutputs(clientAlpha, projectAId);
    if (emptyOutputs.data?.length === 0) {
      console.log('   ✅ Empty state restored: 0 active outputs remain after soft deleting all items');
    } else {
      throw new Error(`Expected 0 active outputs, got: ${emptyOutputs.data?.length}`);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Logged-out (Anonymous) Access Restriction
    // -------------------------------------------------------------------------
    console.log('\n11. Testing logged-out (anon) access rejection...');
    const anonQuery = await anonClient.from('outputs').select('*').limit(5);
    if (anonQuery.error?.message.includes('permission denied')) {
      console.log('   ✅ Anonymous access blocked: Logged-out users cannot query outputs table');
    } else {
      throw new Error(`Expected anonymous access denial, got: ${JSON.stringify(anonQuery)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Service Role Maintenance
    // -------------------------------------------------------------------------
    console.log('\n12. Testing service role administrative access...');
    const { data: adminRows, error: adminErr } = await adminClient
      .from('outputs')
      .select('id, project_id, output_type, deleted_at')
      .eq('project_id', projectAId);
    if (adminErr || !adminRows || adminRows.length !== 3) {
      throw new Error(`Admin service role query failed: ${adminErr?.message}`);
    }
    console.log(`   ✅ Service role admin query succeeded (saw all ${adminRows.length} rows including soft-deleted)`);

    console.log('\n========================================================');
    console.log('ALL TASKLET 8 OUTPUT TESTS PASSED CLEANLY! ✅');
    console.log('========================================================\n');
  } finally {
    // Clean up test data
    console.log('Cleaning up test data...');
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    console.log('Test users cleaned up.\n');
  }
}

runOutputsTestSuite().catch((err) => {
  console.error('\n❌ TASKLET 8 TEST SUITE FAILED:', err);
  process.exit(1);
});
