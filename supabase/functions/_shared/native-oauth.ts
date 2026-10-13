import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { decryptToken, encryptToken } from './native-crypto.ts';
import { writeAuditEvent } from './nango-common.ts';

export interface ProviderOAuthConfig {
  provider_family: 'google' | 'microsoft' | string;
  authorize_url: string;
  token_url: string;
  userinfo_url: string;
  account_field?: string;
  fallback_field?: string;
  client_id_env?: string;
  client_secret_env?: string;
  additional_params?: Record<string, string>;
}

export function getProviderCredentials(provider: {
  provider_family?: string | null;
  auth_config?: any;
}): { clientId: string; clientSecret: string } {
  const family = provider.provider_family || provider.auth_config?.provider_family;
  let clientId = '';
  let clientSecret = '';

  if (family === 'google') {
    clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
    clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  } else if (family === 'microsoft') {
    clientId = Deno.env.get('MICROSOFT_CLIENT_ID') || '';
    clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET') || '';
  } else if (family === 'linkedin') {
    clientId = Deno.env.get('LINKEDIN_CLIENT_ID') || '';
    clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET') || '';
  }

  if (!clientId || !clientSecret) {
    // Fallback to custom config if specified in provider row
    const idEnv = provider.auth_config?.client_id_env;
    const secEnv = provider.auth_config?.client_secret_env;
    if (idEnv) clientId = Deno.env.get(idEnv) || '';
    if (secEnv) clientSecret = Deno.env.get(secEnv) || '';
  }

  if (!clientId || !clientSecret) {
    throw new Error(`OAuth credentials not configured for provider family: ${family}`);
  }

  return { clientId, clientSecret };
}

export async function getOrRefreshAccessToken(
  service: SupabaseClient,
  connectionId: string
): Promise<{ accessToken: string; refreshed: boolean }> {
  const { data: conn, error: connErr } = await service
    .from('integration_connections')
    .select('id, user_id, organization_id, provider_id, auth_mode, encrypted_access_token, encrypted_refresh_token, token_expires_at')
    .eq('id', connectionId)
    .is('deleted_at', null)
    .single();

  if (connErr || !conn) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  if (conn.auth_mode !== 'native' || !conn.encrypted_access_token) {
    throw new Error('Connection is not configured for native OAuth token access');
  }

  const now = Date.now();
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  // If token has at least 5 minutes before expiration, return existing token
  if (expiresAt - now > 5 * 60 * 1000) {
    const accessToken = await decryptToken(conn.encrypted_access_token);
    return { accessToken, refreshed: false };
  }

  if (!conn.encrypted_refresh_token) {
    // No refresh token available, return current if not yet passed expiry
    if (expiresAt > now) {
      const accessToken = await decryptToken(conn.encrypted_access_token);
      return { accessToken, refreshed: false };
    }
    throw new Error('Access token expired and no refresh token available. Reconnection required.');
  }

  // Refresh the token
  const refreshToken = await decryptToken(conn.encrypted_refresh_token);
  const { data: provider } = await service
    .from('integration_providers')
    .select('id, provider_family, auth_config')
    .eq('id', conn.provider_id)
    .single();

  if (!provider) throw new Error(`Provider not found: ${conn.provider_id}`);

  const { clientId, clientSecret } = getProviderCredentials(provider);
  const tokenUrl = provider.auth_config?.token_url || (
    provider.provider_family === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  );

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const refreshRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!refreshRes.ok) {
    const errBody = await refreshRes.text().catch(() => '');
    console.error(`Token refresh failed for connection ${conn.id}: ${refreshRes.status} ${errBody}`);
    await service
      .from('integration_connections')
      .update({
        status: 'reauth_required',
        last_error_code: 'refresh_failed',
        status_reason: 'OAuth token refresh failed. Please reconnect your account.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    await writeAuditEvent(service, {
      connection_id: conn.id,
      provider_id: conn.provider_id,
      user_id: conn.user_id,
      organization_id: conn.organization_id,
      event_type: 'refresh_failed',
      metadata: { status: refreshRes.status },
    });

    throw new Error('Token refresh failed. Re-authorization required.');
  }

  const tokenData = await refreshRes.json();
  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token; // Some providers return rotated refresh tokens
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const encryptedNewAccess = await encryptToken(newAccessToken);
  const updatePayload: Record<string, any> = {
    encrypted_access_token: encryptedNewAccess,
    token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  };

  if (newRefreshToken) {
    updatePayload.encrypted_refresh_token = await encryptToken(newRefreshToken);
  }

  await service
    .from('integration_connections')
    .update(updatePayload)
    .eq('id', conn.id);

  return { accessToken: newAccessToken, refreshed: true };
}
