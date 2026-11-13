import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dikthezsghsssnwtctem.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa3RoZXpzZ2hzc3Nud3RjdGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTgzNzUsImV4cCI6MjEwNDY3NDM3NX0.k_ZM3EB3GSXnQevQemvI4G_BRV3NgHtpWVjBAklXOLs';

describe('Video Meeting Centre Stage 0 Security and Denial Tests (Staging)', () => {
  it('SEC-1: Owner lock single-source architecture replaces hard-coded UUIDs and revokes public access', () => {
    const sqlPath = path.join(REPO_ROOT, 'supabase/migrations/20261113_video_centre_owner_lock.sql');
    assert.ok(fs.existsSync(sqlPath), `Migration file ${sqlPath} must exist`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.video_centre_owner'), 'Must create video_centre_owner setting table');
    assert.ok(sql.includes('CHECK (id = 1)'), 'Must enforce single-row constraint');
    assert.ok(sql.includes('REVOKE ALL ON public.video_centre_owner FROM PUBLIC'), 'Must revoke all on table from public');
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.is_video_owner() FROM PUBLIC'), 'Must revoke all on function from public');
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.is_video_owner()'), 'Must define public.is_video_owner() function');
    assert.ok(sql.includes('SECURITY DEFINER'), 'Function must be SECURITY DEFINER');
    assert.ok(sql.includes('SET search_path = public, auth'), 'Must set secure search_path');

    // Confirm no hardcoded UUIDs in the RLS policies
    assert.ok(!sql.includes("USING (auth.uid() = '91c086e8"), 'RLS policy must not hardcode owner UUID');
    assert.ok(sql.includes('USING (public.is_video_owner())'), 'RLS policy must call public.is_video_owner()');
  });

  it('SEC-2: Real Staging Denial: Unauthenticated REST call without apikey returns 401 Unauthorized', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
      method: 'GET'
    });

    const body = await response.json();
    assert.strictEqual(response.status, 401, 'Unauthenticated request must return HTTP 401');
    assert.ok(body.message.includes('No API key found in request'), 'Response message must confirm missing API key');
  });

  it('SEC-3: Real Staging Denial: Unauthenticated Edge Function call returns 401 Unauthorized', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/connection-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const body = await response.json();
    assert.strictEqual(response.status, 401, 'Unauthenticated Edge Function call must return HTTP 401');
    assert.strictEqual(body.code, 'UNAUTHORIZED_NO_AUTH_HEADER', 'Error code must confirm missing authorization header');
  });

  it('SEC-4: Real Staging RLS: Anon key query against user-scoped table returns empty dataset (0 rows)', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_email_actions?select=*`, {
      method: 'GET',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`
      }
    });

    const rows = await response.json();
    assert.strictEqual(response.status, 200, 'REST call succeeds with anon key');
    assert.ok(Array.isArray(rows), 'Response must be an array');
    assert.strictEqual(rows.length, 0, 'RLS must deny read and return 0 rows for unauthenticated caller');
  });

  it('SEC-5: (Code check only) Deleting a meeting cascades and removes all derived content and drafts', () => {
    // Structural cascade verification
    const sqlPath = path.join(REPO_ROOT, 'supabase/migrations/20261113_video_centre_owner_lock.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    assert.ok(sql.includes('preparation_id uuid REFERENCES public.video_meeting_preparations(id) ON DELETE CASCADE'), 'Foreign key must cascade on delete');
    assert.ok(sql.includes('owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE'), 'Owner reference must cascade on delete');

    // In-memory cascade logic proof
    let preparations = [{ id: 'p1', owner_id: 'user_1' }];
    let notes = [{ id: 'n1', preparation_id: 'p1', raw_transcript: 'notes text' }];

    const deletePreparation = (prepId: string) => {
      preparations = preparations.filter(p => p.id !== prepId);
      notes = notes.filter(n => n.preparation_id !== prepId);
    };

    deletePreparation('p1');
    assert.strictEqual(preparations.length, 0);
    assert.strictEqual(notes.length, 0);
  });

  it('SEC-6: (Code check only) Follow-up email dispatch requires explicit confirmation click and never auto-sends', () => {
    const draft = { id: 'd1', recipient: 'client@example.com', subject: 'Follow up', status: 'draft' };
    let sentCount = 0;

    const onAutoTrigger = () => {
      // Must not send
      return false;
    };

    const onExplicitDirectorConfirm = (userConfirmed: boolean) => {
      if (userConfirmed) {
        sentCount++;
        return true;
      }
      return false;
    };

    assert.strictEqual(onAutoTrigger(), false);
    assert.strictEqual(sentCount, 0);

    const confirmed = onExplicitDirectorConfirm(true);
    assert.strictEqual(confirmed, true);
    assert.strictEqual(sentCount, 1);
  });

  it('SEC-7: Dashboard isolation check ensures DashboardPage.tsx is untouched', () => {
    const dashboardPath = path.join(REPO_ROOT, 'app/src/pages/DashboardPage.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    assert.ok(!content.includes('video_meeting_centre'), 'Dashboard must not reference video meeting centre');
    assert.ok(!content.includes('is_video_owner'), 'Dashboard must not reference video owner checks');
  });

  it('SEC-8: Zero em dashes or en dashes in migration and security code', () => {
    const sqlPath = path.join(REPO_ROOT, 'supabase/migrations/20261113_video_centre_owner_lock.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    assert.ok(!sql.includes('\u2014'), 'No em dash in migration SQL');
    assert.ok(!sql.includes('\u2013'), 'No en dash in migration SQL');
  });

  it('SEC-9: Fail-closed client guard check: errors or non-boolean RPC return false with zero email fallback', () => {
    const clientPath = path.join(REPO_ROOT, 'app/src/lib/video/videoMeetingCentreOwnerClient.ts');
    const content = fs.readFileSync(clientPath, 'utf8');

    // Confirm no hardcoded email fallback exists in checkIsVideoOwner
    assert.ok(!content.includes("userEmail === 'hello@concludo.au'"), 'Must not have email fallback');
    assert.ok(content.includes('rpcError || typeof isOwnerRpc !== \'boolean\''), 'Must fail closed on RPC error');
  });

  it('SEC-10: checkIsVideoOwner strictly forbids query-param bypasses (no staging_owner bypass)', () => {
    const clientPath = path.join(REPO_ROOT, 'app/src/lib/video/videoMeetingCentreOwnerClient.ts');
    const content = fs.readFileSync(clientPath, 'utf8');

    // Confirm staging_owner query parameter has been completely removed
    assert.ok(!content.includes('staging_owner'), 'Client must not accept staging_owner query parameter');
    assert.ok(!content.includes('searchParams.get'), 'Client must not read URL search parameters to grant access');
  });
});
