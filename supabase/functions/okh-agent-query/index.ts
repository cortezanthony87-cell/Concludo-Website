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

interface PreflightRequest {
  organisationId: string;
  workspaceId: string;
  agentName: string;
  agentRunId?: string;
  sectionsRequired?: string[];
  fieldsRequired?: string[];
  outputType: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500, request);
    }

    // Authenticate caller
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

    const body = (await request.json().catch(() => ({}))) as PreflightRequest;
    const {
      organisationId,
      workspaceId,
      agentName,
      agentRunId,
      sectionsRequired,
      fieldsRequired,
      outputType,
    } = body;

    if (!organisationId || !workspaceId) {
      return jsonResponse({ error: 'organisationId and workspaceId are required' }, 400, request);
    }

    // Verify tenant authorization: caller must have a valid role in workspaceId
    const { data: roleData } = await serviceClient.rpc('okh_user_workspace_role', {
      p_workspace_id: workspaceId,
    });

    let callerRole: string | null = roleData ?? null;
    if (!callerRole) {
      const { data: orgMember } = await serviceClient
        .from('organization_members')
        .select('role')
        .eq('organization_id', workspaceId)
        .eq('user_id', callerUser.id)
        .maybeSingle();

      if (orgMember) {
        callerRole = orgMember.role === 'organization_owner' ? 'account_owner' :
                     orgMember.role === 'organization_admin' ? 'admin' :
                     orgMember.role === 'viewer' ? 'read_only' : 'team_member';
      } else if (workspaceId === callerUser.id) {
        callerRole = 'account_owner';
      }
    }

    if (!callerRole) {
      return jsonResponse({ error: 'forbidden', message: 'Insufficient workspace permissions' }, 403, request);
    }

    // 1. Look up the hub for this org + workspace
    const { data: hub, error: hubError } = await serviceClient
      .from('okh_hubs')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    // Hub does not exist yet: return graceful preflight degradation
    if (hubError || !hub) {
      return jsonResponse({
        hubMissing: true,
        fields: {},
        policies: {
          confidentialityLevel: 'standard',
          dataSharingConsent: false,
          recordingConsent: false,
        },
        gaps: [],
        completenessScore: 0,
        knowledgeFreshness: 'stale',
      }, 200, request);
    }

    // 2. Load field values
    let fieldQuery = serviceClient
      .from('okh_field_values')
      .select('*, definition:okh_field_definitions(*)')
      .eq('hub_id', hub.id)
      .not('value', 'is', null);

    if (sectionsRequired && sectionsRequired.length > 0) {
      fieldQuery = fieldQuery.in('section_key', sectionsRequired);
    }
    if (fieldsRequired && fieldsRequired.length > 0) {
      fieldQuery = fieldQuery.in('field_key', fieldsRequired);
    }

    const { data: fieldValues } = await fieldQuery;

    // Filter sensitive fields for non-privileged roles (team_member / read_only cannot see is_sensitive=true)
    const isPrivileged = callerRole === 'account_owner' || callerRole === 'admin';

    // 3. Build field map keyed by field_key
    const fields: Record<string, unknown> = {};
    for (const fv of fieldValues ?? []) {
      const isSensitive = fv.definition?.is_sensitive ?? false;
      if (isSensitive && !isPrivileged) {
        continue;
      }

      fields[fv.field_key] = {
        value: fv.value?.v ?? fv.value,
        confidence: fv.confidence,
        isHumanVerified: fv.is_human_verified,
        isAiGenerated: fv.is_ai_generated,
        sourceDocument: fv.source_document,
        sourceLocation: fv.source_location,
        sourceType: fv.source_type,
        updatedAt: fv.updated_at,
      };
    }

    // 4. Compute gaps: required fields that are empty
    const { data: requiredDefs } = await serviceClient
      .from('okh_field_definitions')
      .select('field_key, display_label, section_key')
      .eq('is_required', true);

    const gaps = (requiredDefs ?? [])
      .filter((fd) => !fields[fd.field_key])
      .map((fd) => ({
        fieldKey: fd.field_key,
        sectionKey: fd.section_key,
        displayLabel: fd.display_label,
      }));

    // 5. Log the agent query
    await serviceClient.from('okh_agent_queries').insert({
      hub_id: hub.id,
      agent_name: agentName || 'Anonymous Agent',
      agent_run_id: agentRunId || null,
      sections_requested: sectionsRequired || null,
      fields_requested: fieldsRequired || null,
      output_type: outputType || 'general_query',
    });

    // 6. Increment query counter on hub
    await serviceClient
      .from('okh_hubs')
      .update({
        agent_query_count: (hub.agent_query_count || 0) + 1,
        last_agent_query_at: new Date().toISOString(),
      })
      .eq('id', hub.id);

    return jsonResponse({
      hubMissing: false,
      hubId: hub.id,
      completenessScore: hub.completeness_score,
      knowledgeFreshness: hub.knowledge_freshness,
      enrichmentStatus: hub.enrichment_status,
      policies: {
        confidentialityLevel: hub.confidentiality_level,
        dataSharingConsent: hub.data_sharing_consent,
        recordingConsent: hub.recording_consent,
      },
      fields,
      gaps,
    }, 200, request);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500, request);
  }
});
