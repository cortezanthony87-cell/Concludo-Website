import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  optionsResponse,
  requireUser,
  writeAuditEvent,
} from './nango-common.ts';
import {
  encryptToken,
} from './native-crypto.ts';
import { getProviderCredentials } from './native-oauth.ts';

interface CallbackRequest {
  code: string;
  state: string;
  redirect_uri?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as CallbackRequest;
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const state = typeof body.state === 'string' ? body.state.trim() : '';

    if (!code || !state) {
      return jsonResponse({ error: 'Missing required code or state parameter' }, 400, request);
    }

    const service = createServiceClient();

    // 1. Verify oauth state in database
    const { data: oauthState, error: stateErr } = await service
      .from('oauth_states')
      .select('id, state, user_id, provider_id, code_verifier, redirect_uri, connection_id, expires_at, used_at')
      .eq('state', state)
      .eq('user_id', user.id)
      .maybeSingle();

    if (stateErr || !oauthState) {
      return jsonResponse({ error: 'Invalid or missing authorization state' }, 400, request);
    }

    if (oauthState.used_at) {
      return jsonResponse({ error: 'This authorization request has already been used' }, 400, request);
    }

    if (new Date(oauthState.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: 'Authorization session expired. Please connect again.' }, 400, request);
    }

    // 2. Fetch provider configuration
    const { data: provider, error: providerErr } = await service
      .from('integration_providers')
      .select('id, name, provider_family, auth_config, test_call')
      .eq('id', oauthState.provider_id)
      .single();

    if (providerErr || !provider) {
      return jsonResponse({ error: 'Provider configuration not found' }, 404, request);
    }

    const { clientId, clientSecret } = getProviderCredentials(provider);
    const authConfig = provider.auth_config || {};
    const tokenUrl = authConfig.token_url || (
      provider.provider_family === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : provider.provider_family === 'linkedin'
        ? 'https://www.linkedin.com/oauth/v2/accessToken'
        : 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    );

    // 3. Exchange authorization code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthState.redirect_uri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    if (oauthState.code_verifier && provider.provider_family !== 'linkedin') {
      tokenParams.set('code_verifier', oauthState.code_verifier);
    }

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.error(`Token exchange failed for ${oauthState.provider_id}: ${tokenRes.status} ${errText}`);
      
      // Update connection to failed
      if (oauthState.connection_id) {
        await service
          .from('integration_connections')
          .update({
            status: 'failed',
            last_test_result: 'failed',
            last_error_code: `token_exchange_${tokenRes.status}`,
            status_reason: 'OAuth provider rejected code exchange',
            updated_at: new Date().toISOString(),
          })
          .eq('id', oauthState.connection_id);
      }

      await writeAuditEvent(service, {
        connection_id: oauthState.connection_id,
        provider_id: oauthState.provider_id,
        user_id: user.id,
        event_type: 'authorisation_failed',
        metadata: { http_status: tokenRes.status },
      });

      return jsonResponse({ error: 'Failed to exchange authorization code with provider' }, 502, request);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const tokenType = tokenData.token_type || 'Bearer';
    const rawScope = tokenData.scope || '';
    const grantedScopes = typeof rawScope === 'string'
      ? rawScope.split(/[\s,]+/).filter(Boolean)
      : Array.isArray(rawScope) ? rawScope : [];

    if (!accessToken) {
      return jsonResponse({ error: 'Provider returned no access token' }, 502, request);
    }

    // 4. Fetch authenticated account info (Discovery & Evidence Test)
    let accountEmail: string | null = null;
    const userinfoUrl = authConfig.userinfo_url || (
      provider.provider_family === 'google'
        ? 'https://www.googleapis.com/oauth2/v3/userinfo'
        : provider.provider_family === 'linkedin'
        ? 'https://api.linkedin.com/v2/userinfo'
        : 'https://graph.microsoft.com/v1.0/me'
    );

    try {
      const userinfoRes = await fetch(userinfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (userinfoRes.ok) {
        const uinfo = await userinfoRes.json();
        const accountField = authConfig.account_field || 'email';
        const fallbackField = authConfig.fallback_field || 'mail';
        accountEmail = uinfo[accountField] || uinfo[fallbackField] || uinfo.userPrincipalName || uinfo.email || null;
      }
    } catch (e) {
      console.warn('Failed to fetch userinfo during OAuth callback:', e);
    }

    // 5. Encrypt tokens
    const encryptedAccess = await encryptToken(accessToken);
    const encryptedRefresh = refreshToken ? await encryptToken(refreshToken) : null;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const now = new Date().toISOString();

    // 6. Update connection row
    const finalConnectionId = oauthState.connection_id;
    if (finalConnectionId) {
      const updateData: Record<string, any> = {
        status: 'connected',
        auth_mode: 'native',
        verified_at: now,
        last_test_at: now,
        last_test_result: 'success',
        last_error_code: null,
        status_reason: null,
        token_type: tokenType,
        token_expires_at: tokenExpiresAt,
        encrypted_access_token: encryptedAccess,
        granted_scopes: grantedScopes.length > 0 ? grantedScopes : null,
        updated_at: now,
      };

      if (encryptedRefresh) {
        updateData.encrypted_refresh_token = encryptedRefresh;
      }

      if (accountEmail) {
        updateData.account_label = accountEmail;
        updateData.external_account_reference = accountEmail;
      }

      await service
        .from('integration_connections')
        .update(updateData)
        .eq('id', finalConnectionId);
    }

    // 7. Mark oauth state as used
    await service
      .from('oauth_states')
      .update({ used_at: now })
      .eq('id', oauthState.id);

    // 8. Log audit events
    await writeAuditEvent(service, {
      connection_id: finalConnectionId,
      provider_id: oauthState.provider_id,
      user_id: user.id,
      event_type: 'authorised',
      metadata: { auth_mode: 'native', account: accountEmail },
    });

    await writeAuditEvent(service, {
      connection_id: finalConnectionId,
      provider_id: oauthState.provider_id,
      user_id: user.id,
      event_type: 'test_passed',
      metadata: { auth_mode: 'native', endpoint: userinfoUrl },
    });

    return jsonResponse(
      {
        ok: true,
        status: 'connected',
        connection_id: finalConnectionId,
        provider_id: oauthState.provider_id,
        account_label: accountEmail,
      },
      200,
      request,
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('oauth-callback error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500, request);
  }
});
