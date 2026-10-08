import {
  corsHeaders,
  createCallerClient,
  createServiceClient,
  getNangoHost,
  getNangoSecretKey,
  jsonResponse,
  optionsResponse,
  requireUser,
  writeAuditEvent,
} from './nango-common.ts';

interface TestRequest {
  connection_id?: string;
}

export async function runConnectionTest(
  service: ReturnType<typeof createServiceClient>,
  connectionRow: {
    id: string;
    user_id: string;
    organization_id: string;
    provider_id: string;
    nango_connection_id: string | null;
    nango_integration_id: string | null;
  }
): Promise<{ success: boolean; status: string; error?: string }> {
  const nangoHost = getNangoHost();
  const nangoSecret = getNangoSecretKey();

  if (!connectionRow.nango_connection_id || !connectionRow.nango_integration_id) {
    return { success: false, status: 'failed', error: 'Missing Nango connection details' };
  }

  // 1. Fetch provider test_call spec
  const { data: provider, error: providerErr } = await service
    .from('integration_providers')
    .select('id, test_call, account_endpoint, account_field, fallback_field, connect_scopes')
    .eq('id', connectionRow.provider_id)
    .single();

  if (providerErr || !provider || !provider.test_call) {
    return { success: false, status: 'failed', error: 'Provider test call configuration missing' };
  }

  const testCall = provider.test_call as {
    endpoint: string;
    method?: string;
    base?: string;
  };

  const endpoint = testCall.endpoint;
  const method = (testCall.method || 'GET').toUpperCase();

  // 2. Prepare headers for Nango proxy
  const proxyHeaders: Record<string, string> = {
    'Authorization': `Bearer ${nangoSecret}`,
    'Connection-Id': connectionRow.nango_connection_id,
    'Provider-Config-Key': connectionRow.nango_integration_id,
  };

  if (testCall.base) {
    proxyHeaders['Base-Url-Override'] = testCall.base;
  }

  // 3. Execute test call through Nango proxy
  let proxyStatus = 0;
  let testPassed = false;
  let lastErrorCode: string | null = null;
  let newStatus = 'failed';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const proxyRes = await fetch(`${nangoHost}/proxy${endpoint}`, {
      method,
      headers: proxyHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    proxyStatus = proxyRes.status;

    if (proxyRes.ok) {
      testPassed = true;
    } else if (proxyStatus === 401) {
      newStatus = 'reauth_required';
      lastErrorCode = 'http_401';
    } else if (proxyStatus === 403) {
      newStatus = 'permission_required';
      lastErrorCode = 'http_403';
    } else if (proxyStatus === 429 || proxyStatus >= 500) {
      newStatus = 'provider_unavailable';
      lastErrorCode = `http_${proxyStatus}`;
    } else {
      newStatus = 'failed';
      lastErrorCode = `http_${proxyStatus}`;
    }
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    newStatus = 'provider_unavailable';
    lastErrorCode = isTimeout ? 'timeout' : 'network_error';
  }

  // 4. If test passed, fetch account label if configured
  let accountLabel: string | null = null;
  if (testPassed && provider.account_endpoint) {
    try {
      const accHeaders: Record<string, string> = {
        'Authorization': `Bearer ${nangoSecret}`,
        'Connection-Id': connectionRow.nango_connection_id,
        'Provider-Config-Key': connectionRow.nango_integration_id,
      };
      if (testCall.base) {
        accHeaders['Base-Url-Override'] = testCall.base;
      }
      const accRes = await fetch(`${nangoHost}/proxy${provider.account_endpoint}`, {
        headers: accHeaders,
      });
      if (accRes.ok) {
        const accJson = await accRes.json();
        accountLabel =
          (provider.account_field ? accJson[provider.account_field] : null) ||
          (provider.fallback_field ? accJson[provider.fallback_field] : null) ||
          null;
      }
    } catch (e) {
      console.warn('Failed to fetch account label:', e);
    }
  }

  // 5. Check granted scopes from Nango connection record
  let grantedScopes: string[] = [];
  if (testPassed) {
    try {
      const connRes = await fetch(
        `${nangoHost}/connections/${connectionRow.nango_connection_id}?provider_config_key=${connectionRow.nango_integration_id}`,
        {
          headers: { Authorization: `Bearer ${nangoSecret}` },
        }
      );
      if (connRes.ok) {
        const connData = await connRes.json();
        const rawScopes =
          connData.credentials?.raw?.scope ||
          connData.credentials?.raw?.scopes ||
          connData.credentials?.scopes ||
          [];
        if (typeof rawScopes === 'string') {
          grantedScopes = rawScopes.split(/[,\s]+/).filter(Boolean);
        } else if (Array.isArray(rawScopes)) {
          grantedScopes = rawScopes.filter((s) => typeof s === 'string');
        }
      }
    } catch (e) {
      console.warn('Failed to read connection scopes:', e);
    }
  }

  // 6. Update database row
  const now = new Date().toISOString();
  if (testPassed) {
    newStatus = 'connected';
    await service
      .from('integration_connections')
      .update({
        status: 'connected',
        verified_at: now,
        last_test_at: now,
        last_test_result: 'success',
        last_error_code: null,
        status_reason: null,
        account_label: accountLabel,
        granted_scopes: grantedScopes.length > 0 ? grantedScopes : null,
        external_account_reference: accountLabel || 'connected',
        updated_at: now,
      })
      .eq('id', connectionRow.id);

    await writeAuditEvent(service, {
      connection_id: connectionRow.id,
      user_id: connectionRow.user_id,
      organization_id: connectionRow.organization_id,
      event_type: 'test_passed',
      severity: 'info',
      metadata: { endpoint, http_status: proxyStatus },
    });

    return { success: true, status: 'connected' };
  } else {
    await service
      .from('integration_connections')
      .update({
        status: newStatus,
        last_test_at: now,
        last_test_result: 'failed',
        last_error_code: lastErrorCode,
        updated_at: now,
      })
      .eq('id', connectionRow.id);

    await writeAuditEvent(service, {
      connection_id: connectionRow.id,
      user_id: connectionRow.user_id,
      organization_id: connectionRow.organization_id,
      event_type: 'test_failed',
      severity: 'warning',
      metadata: { endpoint, http_status: proxyStatus, error_code: lastErrorCode },
    });

    return { success: false, status: newStatus, error: lastErrorCode ?? 'test_failed' };
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { client: callerClient } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as TestRequest;
    const connectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : '';

    if (!connectionId) {
      return jsonResponse({ error: 'connection_id is required' }, 400, request);
    }

    // Permission check: caller must be able to select the row with caller RLS
    const { data: callerRow, error: callerErr } = await callerClient
      .from('integration_connections')
      .select('id, user_id, organization_id, provider_id, nango_connection_id, nango_integration_id')
      .eq('id', connectionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (callerErr || !callerRow) {
      return jsonResponse({ error: 'Connection not found or permission denied' }, 404, request);
    }

    const service = createServiceClient();
    const result = await runConnectionTest(service, callerRow);

    return jsonResponse({ status: result.status, ok: result.success }, 200, request);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('connection-test error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500, request);
  }
});
