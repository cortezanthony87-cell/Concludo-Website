import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { detectSpeakerLabels } from '../src/lib/transcripts/speakerDetection';
import {
  fetchProjectTranscript,
  saveTranscript,
  updateTranscript,
  softDeleteTranscript
} from '../src/lib/transcripts/transcriptClient';
import { createProject } from '../src/lib/projects/projectClient';

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

async function runTranscriptsTestSuite() {
  console.log('========================================================');
  console.log('TASKLET 7: TRANSCRIPT ARCHIVE & RLS SECURITY TEST SUITE');
  console.log('========================================================\n');

  const timestamp = Date.now();

  // Test 1: Speaker Label Detection
  console.log('--- TEST 1: SPEAKER LABEL DETECTION LOGIC ---');
  const sample1 = `Anthony: We need to confirm the next step.\nClient: That sounds right.`;
  const sample2 = `Speaker 1: I can send that tomorrow.\nSarah Jones: Let’s move this to Friday.`;
  const nonSample1 = `This is a long paragraph without any speaker names or dialogue tags. Just continuous sentences.`;
  const nonSample2 = `A normal sentence with a colon inside it: here is the rest of the sentence.`;
  const nonSample3 = `One isolated colon only: test`;

  const detect1 = detectSpeakerLabels(sample1);
  const detect2 = detectSpeakerLabels(sample2);
  const detectNon1 = detectSpeakerLabels(nonSample1);
  const detectNon2 = detectSpeakerLabels(nonSample2);
  const detectNon3 = detectSpeakerLabels(nonSample3);

  if (detect1 && detect2 && !detectNon1 && !detectNon2 && !detectNon3) {
    console.log('✅ Speaker label detection passed all target positive and negative cases');
  } else {
    throw new Error(
      `Speaker detection failed: detect1=${detect1}, detect2=${detect2}, detectNon1=${detectNon1}, detectNon2=${detectNon2}, detectNon3=${detectNon3}`
    );
  }

  // Provision Test Users
  console.log('\n--- PROVISIONING TEST USERS ---');
  const userAEmail = `transcript_user_a_${timestamp}@test.concludo.au`;
  const userBEmail = `transcript_user_b_${timestamp}@test.concludo.au`;
  const testPassword = 'Password123!Secure';

  const { data: userACreds, error: userAErr } = await adminClient.auth.admin.createUser({
    email: userAEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Transcript User Alpha' }
  });
  if (userAErr || !userACreds.user) throw new Error(`Failed to create User A: ${userAErr?.message}`);
  const userAId = userACreds.user.id;

  const { data: userBCreds, error: userBErr } = await adminClient.auth.admin.createUser({
    email: userBEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Transcript User Beta' }
  });
  if (userBErr || !userBCreds.user) throw new Error(`Failed to create User B: ${userBErr?.message}`);
  const userBId = userBCreds.user.id;

  console.log(`✅ Provisioned User Alpha (${userAEmail}) ID: ${userAId}`);
  console.log(`✅ Provisioned User Beta (${userBEmail}) ID: ${userBId}`);

  // Create Authenticated Clients
  const clientA = createClient(supabaseUrl, anonKey);
  const { error: loginAErr } = await clientA.auth.signInWithPassword({
    email: userAEmail,
    password: testPassword
  });
  if (loginAErr) throw new Error(`User A login failed: ${loginAErr.message}`);

  const clientB = createClient(supabaseUrl, anonKey);
  const { error: loginBErr } = await clientB.auth.signInWithPassword({
    email: userBEmail,
    password: testPassword
  });
  if (loginBErr) throw new Error(`User B login failed: ${loginBErr.message}`);

  try {
    // Test 2: Project Creation for User A and User B
    console.log('\n--- TEST 2: PROJECT CREATION ---');
    const projectAResult = await createProject(clientA, {
      title: 'Alpha Executive Alignment Meeting',
      meeting_type: 'Board & Executive',
      client_or_project: 'Acme Corp',
      meeting_date: '2026-09-11'
    });
    if (projectAResult.error || !projectAResult.data) {
      throw new Error(`Failed to create Project A: ${projectAResult.error?.message}`);
    }
    const projectAId = projectAResult.data.id;
    console.log(`✅ User A created project: ${projectAId}`);

    const projectBResult = await createProject(clientB, {
      title: 'Beta Strategy Review',
      meeting_type: 'Strategy & Planning'
    });
    if (projectBResult.error || !projectBResult.data) {
      throw new Error(`Failed to create Project B: ${projectBResult.error?.message}`);
    }
    const projectBId = projectBResult.data.id;
    console.log(`✅ User B created project: ${projectBId}`);

    // Test 3: Reject Empty Transcript
    console.log('\n--- TEST 3: REJECT EMPTY TRANSCRIPT ---');
    const emptySave = await saveTranscript(clientA, {
      project_id: projectAId,
      raw_text: '   '
    });
    if (emptySave.error && emptySave.error.message.includes('cannot be empty')) {
      console.log('✅ Empty transcript correctly rejected by client validation');
    } else {
      throw new Error('Empty transcript was not rejected!');
    }

    // Test 4: Create Valid Transcript
    console.log('\n--- TEST 4: CREATE VALID TRANSCRIPT ---');
    const validTranscriptText = `Anthony: We need to confirm the next step.\nClient: That sounds right.\nSpeaker 1: I can send that tomorrow.`;
    const saveResult = await saveTranscript(clientA, {
      project_id: projectAId,
      raw_text: validTranscriptText,
      source_type: 'pasted'
    });

    if (saveResult.error || !saveResult.data) {
      throw new Error(`Failed to save transcript: ${saveResult.error?.message}`);
    }

    const transcriptA = saveResult.data;
    console.log(`✅ Transcript saved with ID: ${transcriptA.id}`);
    console.log(`✅ user_id: ${transcriptA.user_id} (matches User A: ${transcriptA.user_id === userAId})`);
    console.log(`✅ project_id: ${transcriptA.project_id}`);
    console.log(`✅ speaker_labels_detected: ${transcriptA.speaker_labels_detected}`);
    console.log(`✅ source_type: ${transcriptA.source_type}`);

    if (
      transcriptA.user_id !== userAId ||
      transcriptA.project_id !== projectAId ||
      !transcriptA.speaker_labels_detected ||
      transcriptA.source_type !== 'pasted'
    ) {
      throw new Error('Transcript fields did not match expected values');
    }

    // Test 5: Fetch Transcript for Project
    console.log('\n--- TEST 5: FETCH PROJECT TRANSCRIPT ---');
    const fetchResult = await fetchProjectTranscript(clientA, projectAId);
    if (fetchResult.error || !fetchResult.data) {
      throw new Error(`Failed to fetch project transcript: ${fetchResult.error?.message}`);
    }
    console.log(`✅ User A successfully fetched transcript: "${fetchResult.data.raw_text.slice(0, 35)}..."`);

    // Test 6: Cross-User Isolation (User B cannot read User A's transcript)
    console.log('\n--- TEST 6: CROSS-USER READ ISOLATION (RLS) ---');
    const userBFetchFromA = await fetchProjectTranscript(clientB, projectAId);
    if (userBFetchFromA.data === null) {
      console.log('✅ User B cannot read User A’s transcript (returns null via RLS)');
    } else {
      throw new Error('User B was able to read User A’s transcript!');
    }

    // Direct table query by User B for User A's transcript ID
    const { data: directQueryData } = await clientB
      .from('transcripts')
      .select('*')
      .eq('id', transcriptA.id);
    if (!directQueryData || directQueryData.length === 0) {
      console.log('✅ Direct SELECT by User B on User A’s transcript returned 0 rows (RLS enforced)');
    } else {
      throw new Error('User B direct SELECT bypassed RLS!');
    }

    // Test 7: Prevent attaching transcript to another user's project
    console.log('\n--- TEST 7: ATTACH TRANSCRIPT TO ANOTHER USER PROJECT BLOCKED ---');
    const attachToForeignProject = await saveTranscript(clientB, {
      project_id: projectAId,
      raw_text: 'Speaker 1: Hello\nSpeaker 2: Hi'
    });
    if (attachToForeignProject.error) {
      console.log(`✅ Attachment to User A’s project by User B blocked: "${attachToForeignProject.error.message}"`);
    } else {
      throw new Error('User B was able to attach a transcript to User A’s project!');
    }

    // Direct database insert attempt by User B to User A's project
    const { error: directInsertError } = await clientB.from('transcripts').insert({
      user_id: userBId,
      project_id: projectAId,
      raw_text: 'Speaker 1: Sneaky insert\nSpeaker 2: Yes'
    });
    if (directInsertError) {
      console.log(`✅ Direct DB insert to foreign project blocked by RLS/Trigger: "${directInsertError.message}"`);
    } else {
      throw new Error('Direct DB insert bypassed foreign project check!');
    }

    // Test 8: Prevent creating transcript for another user (user_id spoofing)
    console.log('\n--- TEST 8: USER ID SPOOFING BLOCKED ---');
    const { error: spoofError } = await clientB.from('transcripts').insert({
      user_id: userAId,
      project_id: projectBId,
      raw_text: 'Speaker 1: Spoofed\nSpeaker 2: Indeed'
    });
    if (spoofError) {
      console.log(`✅ User ID spoofing blocked by RLS/Trigger: "${spoofError.message}"`);
    } else {
      throw new Error('User B was able to create a transcript with User A’s user_id!');
    }

    // Test 9: Update Transcript (re-detect speaker labels and refresh updated_at)
    console.log('\n--- TEST 9: UPDATE TRANSCRIPT & RE-DETECTION ---');
    const updatedText = `This is updated text without any speaker dialogue or colons at line starts. Just standard prose.`;
    const updateResult = await updateTranscript(clientA, transcriptA.id, {
      raw_text: updatedText
    });
    if (updateResult.error || !updateResult.data) {
      throw new Error(`Failed to update transcript: ${updateResult.error?.message}`);
    }
    console.log(`✅ Transcript updated. New speaker_labels_detected: ${updateResult.data.speaker_labels_detected}`);
    if (updateResult.data.speaker_labels_detected !== false) {
      throw new Error('Speaker labels were expected to be false after updating to plain text');
    }

    // Test 10: Immutability of ownership, project_id, and created_at
    console.log('\n--- TEST 10: IMMUTABILITY ENFORCEMENT VIA TRIGGER ---');
    const { error: changeOwnerError } = await clientA
      .from('transcripts')
      .update({ user_id: userBId })
      .eq('id', transcriptA.id);
    if (changeOwnerError && changeOwnerError.message.includes('ownership is not permitted')) {
      console.log(`✅ Changing transcript user_id blocked: "${changeOwnerError.message}"`);
    } else {
      throw new Error('Changing transcript ownership was not blocked!');
    }

    const { error: changeProjectError } = await clientA
      .from('transcripts')
      .update({ project_id: projectBId })
      .eq('id', transcriptA.id);
    if (changeProjectError && changeProjectError.message.includes('project association is not permitted')) {
      console.log(`✅ Changing transcript project_id blocked: "${changeProjectError.message}"`);
    } else {
      throw new Error('Changing transcript project_id was not blocked!');
    }

    const { error: changeCreatedError } = await clientA
      .from('transcripts')
      .update({ created_at: new Date('2020-01-01').toISOString() })
      .eq('id', transcriptA.id);
    if (changeCreatedError && changeCreatedError.message.includes('creation timestamp is not permitted')) {
      console.log(`✅ Changing transcript created_at blocked: "${changeCreatedError.message}"`);
    } else {
      throw new Error('Changing transcript created_at was not blocked!');
    }

    // Test 11: Cross-User Update Prevention (User B cannot update User A's transcript)
    console.log('\n--- TEST 11: CROSS-USER UPDATE PREVENTION ---');
    const { error: userBUpdateError } = await clientB
      .from('transcripts')
      .update({ raw_text: 'Hacked by User B' })
      .eq('id', transcriptA.id);
    // Under RLS, updating 0 matching rows returns no rows / no error or policy violation
    const checkAfterB = await fetchProjectTranscript(clientA, projectAId);
    if (checkAfterB.data?.raw_text !== 'Hacked by User B') {
      console.log('✅ User B update on User A’s transcript had no effect (RLS protected)');
    } else {
      throw new Error('User B successfully updated User A’s transcript!');
    }

    // Test 12: Soft Delete
    console.log('\n--- TEST 12: SOFT DELETE TRANSCRIPT ---');
    const deleteResult = await softDeleteTranscript(clientA, transcriptA.id);
    if (!deleteResult.success) {
      throw new Error(`Failed to soft delete transcript: ${deleteResult.error?.message}`);
    }
    console.log('✅ Soft delete executed successfully');

    // Confirm that fetchProjectTranscript now returns null (empty state)
    const fetchAfterDelete = await fetchProjectTranscript(clientA, projectAId);
    if (fetchAfterDelete.data === null) {
      console.log('✅ Normal project transcript query returns null after soft delete (empty state)');
    } else {
      throw new Error('Deleted transcript was still returned by fetchProjectTranscript!');
    }

    // Confirm row still exists in database with deleted_at set (admin check)
    const { data: adminCheckRow } = await adminClient
      .from('transcripts')
      .select('id, deleted_at')
      .eq('id', transcriptA.id)
      .single();
    if (adminCheckRow && adminCheckRow.deleted_at !== null) {
      console.log(`✅ Database row preserved with deleted_at: ${adminCheckRow.deleted_at}`);
    } else {
      throw new Error('Row was hard deleted or deleted_at was not set!');
    }

    // Test 13: Logged-out / Anon Access Denied
    console.log('\n--- TEST 13: LOGGED-OUT / ANON ACCESS DENIED ---');
    const { error: anonSelectError } = await anonClient.from('transcripts').select('*');
    if (anonSelectError) {
      console.log(`✅ Anon access denied by PostgreSQL privileges: "${anonSelectError.message}"`);
    } else {
      throw new Error('Anon was able to access transcripts!');
    }

    console.log('\n========================================================');
    console.log('ALL TRANSCRIPT ARCHIVE & RLS TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('========================================================');
  } finally {
    // Cleanup test users and data
    console.log('\nCleaning up test artifacts...');
    await adminClient.auth.admin.deleteUser(userAId);
    await adminClient.auth.admin.deleteUser(userBId);
    console.log('Cleanup complete.');
  }
}

runTranscriptsTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
