import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// Built from app/src/lib/intelligence/serverDraft.ts by app/scripts/build-draft-bundle.ts.
// @ts-ignore: plain JS bundle, no type declarations
import { draftMeetingServer } from './engine.bundle.js';

const allowedOrigins = [
  'https://app.concludo.com.au',
  'https://connect.concludo.au',
  'https://www.concludo.au',
  'http://localhost:5173',
  'http://localhost:3000',
];

function corsHeaders(request?: Request): HeadersInit {
  const requestOrigin = request?.headers.get('origin');
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : 'https://app.concludo.com.au';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// -----------------------------------------------------------------------------
// System Prompt & Output Schema (Section 2 Amendments)
// -----------------------------------------------------------------------------

async function checkMonthlySpendAlert(serviceClient: any): Promise<void> {
  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const alertKey = `spend_alert_50aud_${currentMonthKey}`;

    // 1. Check if alert for this month has already been dispatched
    const { data: existingAlert } = await serviceClient
      .from('system_alerts')
      .select('id')
      .eq('alert_key', alertKey)
      .maybeSingle();

    if (existingAlert) return; // Alert already dispatched this month

    // 2. Calculate current month spend
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: logs, error } = await serviceClient
      .from('draft_logs')
      .select('input_tokens, output_tokens, model')
      .eq('drafting_method', 'model')
      .gte('created_at', startOfMonth);

    if (error || !logs) return;

    // Section 2.3: Pricing constants block
    // Pricing in AUD (exchange rate ~1.55 AUD/USD) [verify against Anthropic current commercial terms]
    // claude-sonnet-5-5: USD 3.00/MTok input, USD 15.00/MTok output
    // claude-haiku-5-5: USD 1.00/MTok input, USD 5.00/MTok output
    const PRICING = {
      AUD_PER_USD: 1.55, // [verify exchange rate]
      SONNET_IN_USD_PER_MTOK: 3.00, // [verify against Anthropic current list]
      SONNET_OUT_USD_PER_MTOK: 15.00, // [verify against Anthropic current list]
      HAIKU_IN_USD_PER_MTOK: 1.00, // [verify against Anthropic current list]
      HAIKU_OUT_USD_PER_MTOK: 5.00, // [verify against Anthropic current list]
    };

    let totalSpendAud = 0;
    for (const row of logs) {
      const inRateUSD = row.model?.includes('sonnet') ? PRICING.SONNET_IN_USD_PER_MTOK : PRICING.HAIKU_IN_USD_PER_MTOK;
      const outRateUSD = row.model?.includes('sonnet') ? PRICING.SONNET_OUT_USD_PER_MTOK : PRICING.HAIKU_OUT_USD_PER_MTOK;
      const costUSD = ((row.input_tokens || 0) * inRateUSD + (row.output_tokens || 0) * outRateUSD) / 1000000;
      totalSpendAud += costUSD * PRICING.AUD_PER_USD;
    }

    if (totalSpendAud >= 50.0) {
      // Section 2.2: The spend alert recipient is read from secret ALERT_EMAIL_TO
      const alertRecipient = (typeof Deno !== 'undefined' ? Deno.env.get('ALERT_EMAIL_TO') : process.env.ALERT_EMAIL_TO) || 'AnthonyCortez@CortezMowingGardenMaintenan.onmicrosoft.com';
      const mailWebhookUrl = typeof Deno !== 'undefined' ? Deno.env.get('ALERT_EMAIL_WEBHOOK_URL') : process.env.ALERT_EMAIL_WEBHOOK_URL;

      if (!mailWebhookUrl) {
        // Log a warning with no content or transcript text
        console.warn(`[SPEND ALERT WARNING] Model drafting spend reached AU$${totalSpendAud.toFixed(2)}, but ALERT_EMAIL_WEBHOOK_URL is not configured. Alert email was not sent.`);
        return;
      }

      // Dispatch alert email via external mail webhook
      let sendSuccess = false;
      try {
        const resp = await fetch(mailWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: alertRecipient,
            subject: `[Concludo Alert] Model drafting spend threshold exceeded (AU$${totalSpendAud.toFixed(2)})`,
            body: `Hi Anthony,\n\nThis is an automated operational alert for Concludo Pty Ltd.\n\nModel drafting spend for the month of ${currentMonthKey} has reached AU$${totalSpendAud.toFixed(2)}, passing the configured AU$50.00 monthly threshold.\n\nAll model drafting requests remain logged in draft_logs with zero transcript text retained.\n\nConcludo Operational System`
          })
        });
        sendSuccess = resp.ok;
      } catch (e) {
        console.warn('[SPEND ALERT WARNING] Failed to send spend alert email via webhook.');
      }

      // Record alert in system_alerts table ONLY after a successful send
      if (sendSuccess) {
        console.warn(`[SPEND ALERT] Monthly model drafting spend has passed AU$50.00: Current estimate AU$${totalSpendAud.toFixed(2)}. Alert email successfully dispatched to recipient.`);
        await serviceClient.from('system_alerts').insert({
          alert_key: alertKey,
          alert_type: 'spend_threshold_exceeded',
          threshold_aud: 50.0,
          actual_spend_aud: totalSpendAud,
          recipient_email: alertRecipient,
          created_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

// -----------------------------------------------------------------------------
// Main Handler (Can be imported & tested in Bun/Node or served in Deno)
// -----------------------------------------------------------------------------


export async function handleDraftRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  const t0 = Date.now();
  let userId: string | null = null;
  let meetingId: string | null = null;
  let modelUsed = 'claude-sonnet-5-5';
  let inputTokens = 0;
  let outputTokens = 0;
  let outcome = 'pending';

  // 1. Declare Supabase URL & keys at function scope so finally block always accesses them
  const supabaseUrl = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : process.env.SUPABASE_URL;
  const serviceRoleKey = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') : process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_ANON_KEY') : process.env.SUPABASE_ANON_KEY;
  const anthropicKey = typeof Deno !== 'undefined' ? Deno.env.get('ANTHROPIC_API_KEY') : process.env.ANTHROPIC_API_KEY;

  try {
    // Parse body
    const reqBody = await request.json().catch(() => ({}));
    const transcript = reqBody.transcript || '';
    const meetingDate = reqBody.meetingDate || '';
    const title = reqBody.title || 'not stated';
    meetingId = reqBody.meetingId || null;

    // Section 1.6: Validate meetingDate - reject anything not YYYY-MM-DD with 400
    if (!meetingDate || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
      outcome = 'rejected_invalid_meeting_date';
      return jsonResponse({
        error: 'invalid_meeting_date',
        message: 'meetingDate is required and must be in YYYY-MM-DD format.'
      }, 400, request);
    }

    // Check transcript size limit: reject pre-flight over 60,000 characters
    if (typeof transcript !== 'string' || transcript.length > 60000) {
      outcome = 'rejected_payload_too_large';
      return jsonResponse({
        error: 'payload_too_large',
        message: 'Transcripts over 60,000 characters must be split before drafting.'
      }, 400, request);
    }

    // Authenticate user via JWT session if auth header present
    const authorization = request.headers.get('authorization');
    if (supabaseUrl && (anonKey || serviceRoleKey) && authorization?.startsWith('Bearer ')) {
      const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization } },
      });
      const { data: userData } = await authClient.auth.getUser();
      if (userData?.user) {
        userId = userData.user.id;
      }
    }

    // Check monthly limits and feature flag if serviceRole is available
    let canUseModelDrafting = false;
    let monthlyDraftLimit = 20;

    if (supabaseUrl && serviceRoleKey && userId) {
      const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Feature flag check: model_drafting
      const { data: allowed } = await serviceClient.rpc('can_use_feature', {
        p_user_id: userId,
        p_feature_key: 'model_drafting'
      });
      canUseModelDrafting = !!allowed;

      // Section 1.5: Determine plan limit using effective_plan_for_user
      const { data: effPlan } = await serviceClient.rpc('effective_plan_for_user', {
        p_user_id: userId
      });
      const plan = effPlan || 'starter';

      if (plan === 'free_preview') {
        monthlyDraftLimit = 0;
        canUseModelDrafting = false;
      } else if (plan === 'pro_subscription' || plan === 'pro') {
        monthlyDraftLimit = 100;
      } else if (plan === 'team') {
        monthlyDraftLimit = 100; // per seat baseline
      } else {
        // starter, starter_trial, pro_trial: 20
        monthlyDraftLimit = 20;
      }

      // Query usage count for current calendar month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count: draftCount, error: countError } = await serviceClient.from('draft_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('drafting_method', 'model')
        .gte('created_at', startOfMonth);

      if (countError) {
        // Fail closed: if usage cannot be counted, the monthly limit cannot be enforced, so no model call is made.
        outcome = 'fallback_usage_unreadable';
        return jsonResponse({ drafting_method: 'basic', reason: 'usage_unreadable' }, 200, request);
      }

      if ((draftCount || 0) >= monthlyDraftLimit) {
        outcome = 'fallback_limit_reached';
        return jsonResponse({
          drafting_method: 'basic',
          reason: 'limit_reached'
        }, 200, request);
      }
    }

    // Pre-flight gate: if feature flag is off or no API key, return fallback signal
    if (!canUseModelDrafting || !anthropicKey) {
      outcome = !canUseModelDrafting ? 'fallback_flag_off' : 'fallback_no_api_key';
      return jsonResponse({
        drafting_method: 'basic',
        reason: !canUseModelDrafting ? 'flag_off' : 'no_api_key'
      }, 200, request);
    }


    // Model call. Two passes (draft, then a review for missed items) through the v21 drafting client.
    // The whole request stays inside one wall-clock budget so it finishes before the platform limit.
    const BUDGET_MS = 140000;
    const PER_CALL_MS = 100000;
    const startedAt = Date.now();

    const transport = async (req: { system: string; user: string; maxOutputTokens: number }): Promise<string> => {
      const remaining = BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 15000) throw new Error('budget');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(PER_CALL_MS, remaining));
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: modelUsed,
            max_tokens: req.maxOutputTokens,
            temperature: 0,
            system: req.system,
            messages: [{ role: 'user', content: req.user }],
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('api_' + res.status);
        const j = await res.json();
        inputTokens += j?.usage?.input_tokens || 0;
        outputTokens += j?.usage?.output_tokens || 0;
        const block = Array.isArray(j?.content) ? j.content.find((c: any) => c?.type === 'text') : null;
        if (!block || typeof block.text !== 'string') throw new Error('no_text');
        return block.text;
      } finally {
        clearTimeout(timer);
      }
    };

    const result = await draftMeetingServer({
      transcript,
      meetingDate,
      title,
      sourceKind: 'transcript',
      transport,
      timeoutMs: PER_CALL_MS + 5000,
    });

    if (result.drafting_method !== 'model') {
      outcome = 'fallback_' + String(result.reason).slice(0, 40);
      return jsonResponse({ drafting_method: 'basic', reason: result.reason }, 200, request);
    }

    outcome = 'model_success';
    return jsonResponse({ model: result.model, draftingMethod: 'model', reason: null }, 200, request);

  } catch (err) {
    outcome = 'fallback_exception';
    return jsonResponse({
      drafting_method: 'basic',
      reason: 'internal_error'
    }, 200, request);
  } finally {
    const latencyMs = Date.now() - t0;

    // Zero-data log: NEVER logs transcript content or item text
    console.log(JSON.stringify({
      event: 'draft_meeting_record',
      meeting_id: meetingId,
      user_id: userId,
      model: modelUsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latencyMs,
      outcome
    }));

    if (supabaseUrl && serviceRoleKey) {
      try {
        const sc = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        // A row is written for every attempt that reached the model, so spend and limits count real calls.
        if (inputTokens > 0 || outputTokens > 0 || outcome === 'model_success') {
          await sc.from('draft_logs').insert({
            meeting_id: meetingId,
            user_id: userId,
            model: modelUsed,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            latency_ms: latencyMs,
            drafting_method: outcome === 'model_success' ? 'model' : 'basic',
            outcome,
          });
          await checkMonthlySpendAlert(sc);
        }
      } catch (logErr) {
        // Logging failure must never block the client response.
      }
    }
  }
}

// Deno entry point
if (typeof Deno !== 'undefined') {
  (Deno as any).serve(handleDraftRequest);
}
