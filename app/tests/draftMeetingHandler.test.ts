import { test, expect, describe } from 'bun:test';
import { handleDraftRequest } from '../../supabase/functions/draft-meeting-record/index.ts';

describe('draft-meeting-record Edge Function Handler Tests', () => {

  test('Section 1.6: Validate meetingDate - rejects missing or non-YYYY-MM-DD date with 400', async () => {
    // Missing meetingDate
    const req1 = new Request('http://localhost:54321/functions/v1/draft-meeting-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'Hello meeting' })
    });
    const res1 = await handleDraftRequest(req1);
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.error).toBe('invalid_meeting_date');

    // Malformed meetingDate
    const req2 = new Request('http://localhost:54321/functions/v1/draft-meeting-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'Hello meeting', meetingDate: '20-11-2026' })
    });
    const res2 = await handleDraftRequest(req2);
    expect(res2.status).toBe(400);
  });

  test('Section 1.1: Genuine end-to-end test with authenticated user, Anthropic tool-use response, and draft_logs insert', async () => {
    // Setup environment for function
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_key';
    process.env.SUPABASE_ANON_KEY = 'mock_anon_key';
    process.env.ANTHROPIC_API_KEY = 'mock_anthropic_key';

    const originalFetch = globalThis.fetch;
    let anthropicCalled = false;
    let anthropicBody: any = null;
    let insertedLogsRow: any = null;
    let draftLogsInserted = false;

    globalThis.fetch = (async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Auth user lookup
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({
          user: { id: '22222222-2222-2222-2222-222222222222' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Feature flag check: can_use_feature
      if (urlStr.includes('/rest/v1/rpc/can_use_feature')) {
        return new Response(JSON.stringify(true), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Effective plan check: effective_plan_for_user
      if (urlStr.includes('/rest/v1/rpc/effective_plan_for_user')) {
        return new Response(JSON.stringify('pro_subscription'), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Count existing drafts this month
      if (urlStr.includes('/rest/v1/draft_logs') && init?.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-range': '0-0/5' } });
      }

      // Anthropic API call
      if (urlStr.includes('api.anthropic.com/v1/messages')) {
        anthropicCalled = true;
        anthropicBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          usage: { input_tokens: 1420, output_tokens: 380 },
          content: [
            {
              type: 'tool_use',
              name: 'record_meeting',
              input: {
                participants: [{ name: 'Alice Smith' }, { name: 'Bob Jones' }],
                decisions: [
                  {
                    text: 'Agreed on summer schedule for everyone.',
                    decided_by: 'Alice Smith',
                    conditions: null,
                    source_quote: 'agreed on summer schedule for everyone'
                  }
                ],
                actions: [
                  {
                    text: 'Publish the roster by 25 November.',
                    owner: 'Bob Jones',
                    due_date: '2026-11-25',
                    due_raw: 'by 25 November',
                    due_approximate: false,
                    done_when: null,
                    source_quote: 'publish the roster by 25 November'
                  }
                ],
                open_questions: [],
                risks: [],
                next_meeting: { date: '2026-11-30', time: '10:00', raw_text: 'next Monday' },
                flags: []
              }
            }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // draft_logs insert
      if (urlStr.includes('/rest/v1/draft_logs') && init?.method === 'POST') {
        draftLogsInserted = true;
        insertedLogsRow = JSON.parse(init.body);
        return new Response(init.body, { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      // Spend alert check queries
      if (urlStr.includes('/rest/v1/system_alerts')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/rest/v1/draft_logs') && init?.method === 'GET') {
        return new Response(JSON.stringify([
          { input_tokens: 1420, output_tokens: 380, model: 'claude-sonnet-5-5' }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      const req = new Request('http://localhost:54321/functions/v1/draft-meeting-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_user_jwt_token'
        },
        body: JSON.stringify({
          transcript: 'Alice Smith: We agreed on summer schedule for everyone. Bob Jones: I will publish the roster by 25 November. Let us meet next Monday at 10am.',
          meetingDate: '2026-11-20',
          title: 'Staff Planning',
          meetingId: 'mtg_e2e_verified_001'
        })
      });

      const res = await handleDraftRequest(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.drafting_method).toBe('model');
      expect(data.record).toBeDefined();
      expect(data.record.decisions.length).toBe(1);
      expect(data.record.actions.length).toBe(1);

      // Verify Anthropic tool choice was forced
      expect(anthropicCalled).toBe(true);
      expect(anthropicBody.tool_choice).toEqual({ type: 'auto' });

      // Verify genuine draft_logs insert was executed
      expect(draftLogsInserted).toBe(true);
      expect(insertedLogsRow).toBeDefined();
      expect(insertedLogsRow.meeting_id).toBe('mtg_e2e_verified_001');
      expect(insertedLogsRow.user_id).toBe('22222222-2222-2222-2222-222222222222');
      expect(insertedLogsRow.model).toBe('claude-sonnet-5-5');
      expect(insertedLogsRow.input_tokens).toBe(1420);
      expect(insertedLogsRow.output_tokens).toBe(380);
      expect(insertedLogsRow.drafting_method).toBe('model');
      expect(insertedLogsRow.outcome).toBe('model_success');

      // CRITICAL PRIVACY INVARIANT: Verify inserted log row contains ZERO transcript words or items
      const loggedJson = JSON.stringify(insertedLogsRow);
      expect(loggedJson).not.toContain('summer schedule');
      expect(loggedJson).not.toContain('publish the roster');
      expect(loggedJson).not.toContain('Alice Smith');
      expect(loggedJson).not.toContain('Bob Jones');

    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});

  test('Section 3.4: Simulated timeout triggers fallback to basic drafting with model_api_unavailable reason', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ user: { id: '22222222-2222-2222-2222-222222222222' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/rpc/can_use_feature')) {
        return new Response(JSON.stringify(true), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/rpc/effective_plan_for_user')) {
        return new Response(JSON.stringify('pro_subscription'), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/draft_logs') && init?.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-range': '0-0/5' } });
      }
      if (urlStr.includes('api.anthropic.com/v1/messages')) {
        return null; // Simulated network timeout / abort
      }
      if (urlStr.includes('/rest/v1/draft_logs') && init?.method === 'POST') {
        return new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      const req = new Request('http://localhost:54321/functions/v1/draft-meeting-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_user_jwt_token' },
        body: JSON.stringify({
          transcript: 'Alice: We launch next Friday. Bob: Agreed.',
          meetingDate: '2026-11-13'
        })
      });
      const res = await handleDraftRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.drafting_method).toBe('basic');
      expect(data.reason).toBe('model_api_unavailable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Section 3.4: Simulated malformed response triggers fallback to basic drafting with malformed_model_output reason', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ user: { id: '22222222-2222-2222-2222-222222222222' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/rpc/can_use_feature')) {
        return new Response(JSON.stringify(true), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/rpc/effective_plan_for_user')) {
        return new Response(JSON.stringify('pro_subscription'), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/draft_logs') && init?.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-range': '0-0/5' } });
      }
      if (urlStr.includes('api.anthropic.com/v1/messages')) {
        // Return 200 with text content rather than tool_use (malformed)
        return new Response(JSON.stringify({
          usage: { input_tokens: 100, output_tokens: 50 },
          content: [{ type: 'text', text: 'I cannot draft this meeting output.' }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/draft_logs') && init?.method === 'POST') {
        return new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      const req = new Request('http://localhost:54321/functions/v1/draft-meeting-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_user_jwt_token' },
        body: JSON.stringify({
          transcript: 'Alice: We launch next Friday. Bob: Agreed.',
          meetingDate: '2026-11-13'
        })
      });
      const res = await handleDraftRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.drafting_method).toBe('basic');
      expect(data.reason).toBe('malformed_model_output');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
