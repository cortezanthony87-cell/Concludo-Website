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
import { getOrRefreshAccessToken } from './native-oauth.ts';
import { decryptToken } from './native-crypto.ts';

interface TestRequest {
  connection_id?: string;
}

export async function runConnectionTest(
  service: ReturnType<typeof createServiceClient>,
  connectionRow: {
    id: string;
    user_id: string;
    organization_id: string | null;
    provider_id: string;
    nango_connection_id: string | null;
    nango_integration_id: string | null;
    auth_mode?: string | null;
  }
): Promise<{ success: boolean; status: string; error?: string }> {
  // 1. Fetch provider test_call spec
  const { data: provider, error: providerErr } = await service
    .from('integration_providers')
    .select('id, test_call, connect_scopes, provider_family, auth_config')
    .eq('id', connectionRow.provider_id)
    .single();

  if (providerErr || !provider || !provider.test_call) {
    return { success: false, status: 'failed', error: 'Provider test call configuration missing' };
  }

  // Handle Native OAuth and Direct API Key Test
  if (connectionRow.auth_mode === 'native' || connectionRow.auth_mode === 'direct_api_key') {
    try {
      let accessToken = '';
      if (connectionRow.auth_mode === 'direct_api_key') {
        const { data: conn } = await service
          .from('integration_connections')
          .select('encrypted_access_token')
          .eq('id', connectionRow.id)
          .single();
        if (!conn?.encrypted_access_token) {
          throw new Error('No encrypted credential found for connection');
        }
        accessToken = await decryptToken(conn.encrypted_access_token);
      } else {
        const res = await getOrRefreshAccessToken(service, connectionRow.id);
        accessToken = res.accessToken;
      }
      const testCall = provider.test_call as {
        endpoint: string;
        method?: string;
        base?: string;
        account_endpoint?: string;
        account_field?: string;
        fallback_field?: string;
      };

      const baseUrl = testCall.base || (
        provider.provider_family === 'google' ? 'https://www.googleapis.com' : 'https://graph.microsoft.com'
      );
      const testUrl = `${baseUrl}${testCall.endpoint}`;
      const method = (testCall.method || 'GET').toUpperCase();

      const testRes = await fetch(testUrl, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const now = new Date().toISOString();
      if (testRes.ok) {
        let accountLabel: string | null = null;
        const json = await testRes.json().catch(() => ({}));
        const accField = testCall.account_field || 'email';
        const fallbackField = testCall.fallback_field || 'mail';
        accountLabel = json[accField] || json[fallbackField] || json.userPrincipalName || json.email || null;

        await service
          .from('integration_connections')
          .update({
            status: 'connected',
            verified_at: now,
            last_test_at: now,
            last_test_result: 'success',
            last_error_code: null,
            status_reason: null,
            ...(accountLabel ? { account_label: accountLabel, external_account_reference: accountLabel } : {}),
            updated_at: now,
          })
          .eq('id', connectionRow.id);

        await writeAuditEvent(service, {
          connection_id: connectionRow.id,
          user_id: connectionRow.user_id,
          organization_id: connectionRow.organization_id,
          provider_id: connectionRow.provider_id,
          event_type: 'test_passed',
          metadata: { auth_mode: 'native', endpoint: testUrl, status: testRes.status },
        });

        return { success: true, status: 'connected' };
      } else {
        const lastErrorCode = `http_${testRes.status}`;
        const newStatus = testRes.status === 401 ? 'reauth_required' : (testRes.status === 403 ? 'permission_required' : 'failed');
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
          provider_id: connectionRow.provider_id,
          event_type: 'test_failed',
          metadata: { auth_mode: 'native', endpoint: testUrl, status: testRes.status },
        });

        return { success: false, status: newStatus, error: lastErrorCode };
      }
    } catch (err: any) {
      console.error('Native test failed:', err);
      return { success: false, status: 'failed', error: err.message || 'native_test_failed' };
    }
  }

  const nangoHost = getNangoHost();
  const nangoSecret = getNangoSecretKey();

  if (!connectionRow.nango_connection_id || !connectionRow.nango_integration_id) {
    return { success: false, status: 'failed', error: 'Missing Nango connection details' };
  }

  const testCall = provider.test_call as {
    endpoint: string;
    method?: string;
    base?: string;
    account_endpoint?: string;
    account_field?: string;
    fallback_field?: string;
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
  const accEndpoint = testCall.account_endpoint || (testCall.endpoint.includes('/me') ? '/v1.0/me' : null);
  if (testPassed && accEndpoint) {
    try {
      const accHeaders: Record<string, string> = {
        'Authorization': `Bearer ${nangoSecret}`,
        'Connection-Id': connectionRow.nango_connection_id,
        'Provider-Config-Key': connectionRow.nango_integration_id,
      };
      if (testCall.base) {
        accHeaders['Base-Url-Override'] = testCall.base;
      }
      const accRes = await fetch(`${nangoHost}/proxy${accEndpoint}`, {
        headers: accHeaders,
      });
      if (accRes.ok) {
        const accJson = await accRes.json();
        const accField = testCall.account_field || 'mail';
        const fallbackField = testCall.fallback_field || 'userPrincipalName';
        accountLabel = accJson[accField] || accJson[fallbackField] || accJson.email || null;
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
          grantedScopes = rawScopes.filter((s: any) => typeof s === 'string');
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
      provider_id: connectionRow.provider_id,
      event_type: 'test_passed',
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
      provider_id: connectionRow.provider_id,
      event_type: 'test_failed',
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
      .select('id, user_id, organization_id, provider_id, nango_connection_id, nango_integration_id, auth_mode')
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
