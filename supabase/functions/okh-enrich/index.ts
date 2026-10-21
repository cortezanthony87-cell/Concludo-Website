import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

interface EnrichRequest {
  hubId: string;
  scope?: 'full' | string;
  docIds?: string[];
  fields?: string[];
}

interface FieldProposal {
  fieldDefId: string;
  sectionKey: string;
  fieldKey: string;
  proposedValue: unknown;
  confidence: 'high' | 'moderate' | 'low';
  sourceDocument?: string;
  sourceLocation?: string;
  sourceType: 'meeting' | 'document' | 'crm_record' | 'manual_entry' | 'derived';
  sourceDocId?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500, request);
    }

    // Authenticate caller via JWT
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing Authorization header' }, 401, request);
    }

    const callerClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'unauthorized', message: 'Invalid or expired session' }, 401, request);
    }
    const callerUser = userData.user;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await request.json().catch(() => ({}))) as EnrichRequest;
    const { hubId, scope = 'full', docIds = [], fields: requestedFields } = body;
    const triggeredBy = callerUser.id;

    if (!hubId) {
      return jsonResponse({ error: 'hubId is required' }, 400, request);
    }

    // 1. Verify hub existence and tenant authorization
    const { data: hub, error: hubError } = await serviceClient
      .from('okh_hubs')
      .select('id, workspace_id, organisation_id, completeness_score, enrichment_status, last_enrichment_at')
      .eq('id', hubId)
      .maybeSingle();

    if (hubError || !hub) {
      return jsonResponse({ error: 'Hub not found' }, 404, request);
    }

    // 2. Check caller authorization: enrichment triggers require account_owner or admin role
    const { data: roleData } = await serviceClient.rpc('okh_user_workspace_role', {
      p_workspace_id: hub.workspace_id,
    });

    let callerRole: string | null = roleData ?? null;
    if (!callerRole) {
      const { data: orgMember } = await serviceClient
        .from('organization_members')
        .select('role')
        .eq('organization_id', hub.workspace_id)
        .eq('user_id', callerUser.id)
        .maybeSingle();

      if (orgMember) {
        callerRole = orgMember.role === 'organization_owner' ? 'account_owner' :
                     orgMember.role === 'organization_admin' ? 'admin' :
                     orgMember.role === 'viewer' ? 'read_only' : 'team_member';
      } else if (hub.workspace_id === callerUser.id) {
        callerRole = 'account_owner';
      }
    }

    const isAuthorized = callerRole === 'account_owner' || callerRole === 'admin';
    if (!isAuthorized) {
      return jsonResponse({ error: 'forbidden', message: 'Enrichment requires account_owner or admin role' }, 403, request);
    }

    // 3. Concurrency check: 409 if an enrichment job is already running
    if (hub.enrichment_status === 'running') {
      return jsonResponse({
        error: 'ENRICHMENT_RUNNING',
        message: 'An enrichment job is already in progress for this hub.',
      }, 409, request);
    }

    // 4. Rate limit check: 429 if a job completed within the last 1 hour
    if (hub.last_enrichment_at) {
      const lastTime = new Date(hub.last_enrichment_at).getTime();
      const elapsedMs = Date.now() - lastTime;
      const oneHourMs = 60 * 60 * 1000;
      if (elapsedMs < oneHourMs) {
        const waitMinutes = Math.ceil((oneHourMs - elapsedMs) / (60 * 1000));
        return jsonResponse({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Enrichment was recently completed. Please wait ${waitMinutes} minute(s) before running another job.`,
        }, 429, request);
      }
    }

    // 5. Create the enrichment job record
    const { data: job, error: jobError } = await serviceClient
      .from('okh_enrichment_jobs')
      .insert({
        hub_id: hubId,
        status: 'running',
        triggered_by: triggeredBy,
        scope: scope,
        doc_ids_used: docIds,
      })
      .select()
      .single();

    if (jobError) {
      return jsonResponse({ error: 'Failed to create enrichment job', details: jobError.message }, 500, request);
    }

    // 6. Mark hub enrichment_status = 'running'
    await serviceClient
      .from('okh_hubs')
      .update({ enrichment_status: 'running' })
      .eq('id', hubId);

    // 7. Load context: field definitions for the scope
    let fieldQuery = serviceClient
      .from('okh_field_definitions')
      .select('*')
      .eq('is_ai_fillable', true);

    if (requestedFields && requestedFields.length > 0) {
      fieldQuery = fieldQuery.in('field_key', requestedFields);
    } else if (scope && scope !== 'full') {
      if (scope.startsWith('section:')) {
        const sec = scope.replace('section:', '');
        fieldQuery = fieldQuery.eq('section_key', sec);
      } else {
        const isSection = [
          'overview', 'customers', 'products_services', 'marketing',
          'sales', 'customer_success', 'operations', 'strategy',
          'policies', 'ai_layer'
        ].includes(scope);
        if (isSection) {
          fieldQuery = fieldQuery.eq('section_key', scope);
        } else {
          fieldQuery = fieldQuery.eq('field_key', scope);
        }
      }
    }

    const { data: fieldDefs } = await fieldQuery.order('section_key').order('sort_order');
    const validDefs = fieldDefs ?? [];
    const validDefMap = new Map(validDefs.map((d) => [d.id, d]));
    const validKeyMap = new Map(validDefs.map((d) => [d.field_key, d]));

    // 8. Load existing field values for context
    const { data: existingValues } = await serviceClient
      .from('okh_field_values')
      .select('field_def_id, field_key, value, is_human_verified')
      .eq('hub_id', hubId);

    const existingMap = new Map(
      (existingValues ?? []).map((fv) => [fv.field_def_id, fv])
    );

    // 9. Load authentic document context from project files if provided
    let documentContext = '';
    if (docIds && docIds.length > 0) {
      const { data: files } = await serviceClient
        .from('project_files')
        .select('name, content, file_type')
        .in('id', docIds)
        .is('deleted_at', null);

      if (files && files.length > 0) {
        documentContext = files
          .map((f) => `=== Document: ${f.name} ===\n${f.content || '(no text extracted)'}`)
          .join('\n\n');
      }
    }

    // 10. Generate proposals
    const proposals: FieldProposal[] = [];

    if (anthropicKey && anthropicKey.trim() !== '') {
      try {
        const systemPrompt = `You are Concludo's Key Account Management (KAM) AI Agent.
Your role is to propose structured knowledge values for organisations based exclusively on authentic evidence from CRM context or uploaded documents.
Never invent, fabricate, or hallucinate figures, dates, or customer claims.
Every proposal must link to an existing field definition and provide authentic source attribution.
Output valid JSON array of objects with keys: fieldDefId, sectionKey, fieldKey, proposedValue, confidence ("high"|"moderate"|"low"), sourceDocument, sourceLocation, sourceType ("meeting"|"document"|"crm_record"|"manual_entry"|"derived").`;

        const userPrompt = `Available Field Definitions:\n${validDefs.map((d) => `- [${d.id}] ${d.section_key}.${d.field_key}: ${d.display_label} (${d.data_type})`).join('\n')}\n\nEvidence Context:\n${documentContext || 'Organisation CRM Knowledge Base'}\n\nGenerate structured proposals for empty or unverified fields:`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (res.ok) {
          const aiJson = await res.json();
          const rawText = aiJson.content?.[0]?.text || '[]';
          const clean = rawText.replace(/^```json\n?|```$/gm, '').trim();
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const def = validDefMap.get(item.fieldDefId) || validKeyMap.get(item.fieldKey);
              if (def) {
                proposals.push({
                  fieldDefId: def.id,
                  sectionKey: def.section_key,
                  fieldKey: def.field_key,
                  proposedValue: item.proposedValue,
                  confidence: item.confidence === 'high' || item.confidence === 'low' ? item.confidence : 'moderate',
                  sourceDocument: item.sourceDocument || 'Context Extraction',
                  sourceLocation: item.sourceLocation || 'Account Record',
                  sourceType: item.sourceType || 'crm_record',
                  sourceDocId: item.sourceDocId,
                });
              }
            }
          }
        } else {
          console.warn('[OKH-Enrich] Anthropic API returned error status:', res.status);
        }
      } catch (err) {
        console.warn('[OKH-Enrich] AI inference network or parsing error:', err);
      }
    }

    // 11. Filter proposals to omit already human-verified fields
    const filteredProposals = proposals.filter((p) => {
      const existing = existingMap.get(p.fieldDefId);
      return !existing?.is_human_verified;
    });

    if (filteredProposals.length > 0) {
      const proposalRows = filteredProposals.map((p) => ({
        job_id: job.id,
        hub_id: hubId,
        field_def_id: p.fieldDefId,
        section_key: p.sectionKey,
        field_key: p.fieldKey,
        proposed_value: { v: p.proposedValue },
        confidence: p.confidence,
        source_document: p.sourceDocument || 'Account Record',
        source_location: p.sourceLocation || 'Document Analysis',
        source_type: p.sourceType || 'crm_record',
        source_doc_id: p.sourceDocId || null,
        prior_value: existingMap.get(p.fieldDefId)?.value ?? null,
      }));

      await serviceClient.from('okh_proposals').insert(proposalRows);
    }

    // 12. Update job status to review_pending
    await serviceClient
      .from('okh_enrichment_jobs')
      .update({
        status: 'review_pending',
        completed_at: new Date().toISOString(),
        fields_proposed: filteredProposals.length,
      })
      .eq('id', job.id);

    // 13. Update hub status
    await serviceClient
      .from('okh_hubs')
      .update({
        enrichment_status: 'review_pending',
        last_enrichment_at: new Date().toISOString(),
        last_enrichment_by: triggeredBy,
        enrichment_doc_ids: docIds.length > 0 ? docIds : null,
      })
      .eq('id', hubId);

    // 14. Write agent query log
    await serviceClient.from('okh_agent_queries').insert({
      hub_id: hubId,
      agent_name: 'KAM Agent',
      agent_run_id: job.id,
      sections_requested: scope === 'full' ? null : [scope],
      output_type: 'enrichment_proposals',
    });

    // 15. Create notification for account owner
    await serviceClient.from('okh_notifications').insert({
      user_id: triggeredBy,
      hub_id: hubId,
      job_id: job.id,
      notification_type: 'enrichment_complete',
      title: 'Enrichment Analysis Ready',
      message: filteredProposals.length > 0
        ? `KAM Agent generated ${filteredProposals.length} knowledge proposals awaiting your review.`
        : 'KAM Agent completed knowledge scan. Zero unverified fields required updating.',
    });

    return jsonResponse({
      jobId: job.id,
      proposalsCreated: filteredProposals.length,
      status: 'review_pending',
    }, 200, request);
  } catch (err: any) {
    console.error('[OKH-Enrich] Unhandled error:', err);
    return jsonResponse({ error: err.message || String(err) }, 500, request);
  }
});
