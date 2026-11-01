import assert from 'node:assert/strict';
import { Client as PgClient } from 'pg';

const pgClient = new PgClient({
  host: 'localhost',
  database: 'concludo_preview',
  user: 'postgres',
  password: 'postgres',
});

async function runLimitsTest() {
  await pgClient.connect();
  console.log('--- RUNNING SERVER LIMITS TEST SUITE ---');

  // Test 1: Expired trial cannot create project
  console.log('\n[TEST 1] Expired trial user cannot create project');
  try {
    await pgClient.query('BEGIN;');
    await pgClient.query('SET LOCAL ROLE authenticated;');
    await pgClient.query(`SET LOCAL "request.jwt.claims" = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';`);
    await pgClient.query(`
      INSERT INTO public.projects (id, user_id, title)
      VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Project on expired trial');
    `);
    await pgClient.query('COMMIT;');
    assert.fail('Expired trial project insert should have been refused');
  } catch (err: any) {
    await pgClient.query('ROLLBACK;');
    assert.match(err.message, /Forbidden: Your trial has ended/);
    console.log('Result: REFUSED AS EXPECTED (403)');
    console.log('Raw message:', err.message);
  }

  // Test 2: Expired trial cannot create transcript
  console.log('\n[TEST 2] Expired trial user cannot create transcript');
  // Create an existing project owned by expired trial user as admin
  await pgClient.query(`
    INSERT INTO public.projects (id, user_id, title)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'Existing Project Before Expiry')
    ON CONFLICT (id) DO NOTHING;
  `);
  try {
    await pgClient.query('BEGIN;');
    await pgClient.query('SET LOCAL ROLE authenticated;');
    await pgClient.query(`SET LOCAL "request.jwt.claims" = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';`);
    await pgClient.query(`
      INSERT INTO public.transcripts (id, project_id, user_id, raw_text, source_type)
      VALUES (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'Transcript content', 'pasted');
    `);
    await pgClient.query('COMMIT;');
    assert.fail('Expired trial transcript insert should have been refused');
  } catch (err: any) {
    await pgClient.query('ROLLBACK;');
    assert.match(err.message, /Forbidden: Your trial has ended/);
    console.log('Result: REFUSED AS EXPECTED (403)');
    console.log('Raw message:', err.message);
  }

  // Test 3: Expired trial cannot create output
  console.log('\n[TEST 3] Expired trial user cannot create output');
  try {
    await pgClient.query('BEGIN;');
    await pgClient.query('SET LOCAL ROLE authenticated;');
    await pgClient.query(`SET LOCAL "request.jwt.claims" = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';`);
    await pgClient.query(`
      INSERT INTO public.outputs (id, project_id, user_id, output_type, content)
      VALUES (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'summary', 'Summary content');
    `);
    await pgClient.query('COMMIT;');
    assert.fail('Expired trial output insert should have been refused');
  } catch (err: any) {
    await pgClient.query('ROLLBACK;');
    assert.match(err.message, /Forbidden: Your trial has ended/);
    console.log('Result: REFUSED AS EXPECTED (403)');
    console.log('Raw message:', err.message);
  }

  // Test 4: Starter at limit cannot create 21st transcript
  console.log('\n[TEST 4] Starter user at 20 transcripts cannot create 21st');
  await pgClient.query(`
    INSERT INTO public.projects (id, user_id, title)
    VALUES ('12121212-1212-1212-1212-121212121212', '11111111-1111-1111-1111-111111111111', 'Starter Project')
    ON CONFLICT (id) DO NOTHING;
  `);
  // Clear any existing transcripts for starter user
  await pgClient.query(`DELETE FROM public.transcripts WHERE user_id = '11111111-1111-1111-1111-111111111111';`);

  // Insert 20 transcripts
  for (let i = 1; i <= 20; i++) {
    await pgClient.query(`
      INSERT INTO public.transcripts (id, project_id, user_id, raw_text, source_type)
      VALUES (gen_random_uuid(), '12121212-1212-1212-1212-121212121212', '11111111-1111-1111-1111-111111111111', 'Transcript ${i}', 'pasted');
    `);
  }

  try {
    await pgClient.query('BEGIN;');
    await pgClient.query('SET LOCAL ROLE authenticated;');
    await pgClient.query(`SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';`);
    await pgClient.query(`
      INSERT INTO public.transcripts (id, project_id, user_id, raw_text, source_type)
      VALUES (gen_random_uuid(), '12121212-1212-1212-1212-121212121212', '11111111-1111-1111-1111-111111111111', 'Transcript 21 (Should fail)', 'pasted');
    `);
    await pgClient.query('COMMIT;');
    assert.fail('Starter 21st transcript insert should have been refused');
  } catch (err: any) {
    await pgClient.query('ROLLBACK;');
    assert.match(err.message, /Forbidden: Monthly transcript limit reached/);
    console.log('Result: REFUSED AS EXPECTED (403)');
    console.log('Raw message:', err.message);
  }

  // Test 5: Pro user is unaffected
  console.log('\n[TEST 5] Pro user can create project and transcripts past 20');
  await pgClient.query(`
    INSERT INTO public.projects (id, user_id, title)
    VALUES ('23232323-2323-2323-2323-232323232323', '22222222-2222-2222-2222-222222222222', 'Pro Project')
    ON CONFLICT (id) DO NOTHING;
  `);
  await pgClient.query(`DELETE FROM public.transcripts WHERE user_id = '22222222-2222-2222-2222-222222222222';`);
  for (let i = 1; i <= 25; i++) {
    await pgClient.query(`
      INSERT INTO public.transcripts (id, project_id, user_id, raw_text, source_type)
      VALUES (gen_random_uuid(), '23232323-2323-2323-2323-232323232323', '22222222-2222-2222-2222-222222222222', 'Pro Transcript ${i}', 'pasted');
    `);
  }

  await pgClient.query('BEGIN;');
  await pgClient.query('SET LOCAL ROLE authenticated;');
  await pgClient.query(`SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';`);
  const proRes = await pgClient.query(`
    INSERT INTO public.transcripts (id, project_id, user_id, raw_text, source_type)
    VALUES (gen_random_uuid(), '23232323-2323-2323-2323-232323232323', '22222222-2222-2222-2222-222222222222', 'Pro Transcript 26 (Allowed)', 'pasted')
    RETURNING id;
  `);
  await pgClient.query('COMMIT;');
  assert.ok(proRes.rows[0]?.id, 'Pro user transcript 26 was inserted');
  console.log('Result: ALLOWED AS EXPECTED (200)');
  console.log('Inserted transcript ID:', proRes.rows[0]?.id);

  // Clean up
  await pgClient.query(`DELETE FROM public.projects WHERE id IN ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '12121212-1212-1212-1212-121212121212', '23232323-2323-2323-2323-232323232323');`);
  console.log('\n--- ALL SERVER LIMIT TESTS PASSED CLEANLY ---');
  await pgClient.end();
}

runLimitsTest().catch((e) => {
  console.error('Limits test suite failed:', e);
  process.exit(1);
});
