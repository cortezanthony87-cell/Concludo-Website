import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  optionsResponse,
  requireUser,
  writeAuditEvent,
} from './nango-common.ts';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from './native-crypto.ts';
import { getProviderCredentials } from './native-oauth.ts';

interface StartRequest {
  provider_id?: string;
  email_hint?: string;
  connection_id?: string;
  is_new?: boolean;
  redirect_uri?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as StartRequest;
    const providerId = typeof body.provider_id === 'string' ? body.provider_id.trim() : '';
    const emailHint = typeof body.email_hint === 'string' ? body.email_hint.trim() : '';
    const explicitConnectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : '';
    const isNew = Boolean(body.is_new);

    if (!providerId) {
      return jsonResponse({ error: 'provider_id is required' }, 400, request);
    }

    const service = createServiceClient();

    // 1. Validate provider in database
    const { data: provider, error: providerErr } = await service
      .from('integration_providers')
      .select('id, name, availability, provider_family, connect_scopes, auth_config')
      .eq('id', providerId)
      .maybeSingle();

    if (providerErr || !provider) {
      return jsonResponse({ error: 'Provider not found' }, 404, request);
    }

    if (provider.availability !== 'available') {
      return jsonResponse({ error: 'This app is not available yet.' }, 400, request);
    }

    // 2. Derive user's organization from membership or ownership if available
    let organizationId: string | null = null;
    const { data: member } = await service
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (member?.organization_id) {
      organizationId = member.organization_id;
    } else {
      const { data: ownedOrg } = await service
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (ownedOrg?.id) {
        organizationId = ownedOrg.id;
      }
    }

    // 3. Resolve Redirect URI
    const allowedRedirects = [
      'https://app.concludo.com.au/integrations/callback',
      'https://connect.concludo.au/oauth/callback/',
      'https://connect.concludo.au/oauth/callback',
      'http://localhost:5173/integrations/callback',
      'http://localhost:3000/integrations/callback',
    ];

    let targetRedirectUri = 'https://app.concludo.com.au/integrations/callback';
    if (body.redirect_uri && allowedRedirects.includes(body.redirect_uri)) {
      targetRedirectUri = body.redirect_uri;
    }

    // 4. Rate limit check: 10 starts per user per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentStartsCount } = await service
      .from('integration_connection_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('event', ['connect_started', 'reconnect_started'])
      .gte('created_at', tenMinutesAgo);

    if ((recentStartsCount ?? 0) >= 10) {
      return jsonResponse({ error: 'Too many connection attempts. Please wait a few minutes.' }, 429, request);
    }

    // 5. Clean up stale authorising rows (> 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await service
      .from('integration_connections')
      .update({ status: 'not_connected', status_reason: 'Sign-in timed out' })
      .eq('user_id', user.id)
      .eq('status', 'authorising')
      .lte('updated_at', fifteenMinutesAgo);

    // 6. Manage target connection row
    let targetRowId: string;
    let isReconnect = false;

    if (explicitConnectionId) {
      const { data: row } = await service
        .from('integration_connections')
        .select('id, provider_id, status, account_label')
        .eq('id', explicitConnectionId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!row || row.provider_id !== providerId) {
        return jsonResponse({ error: 'Connection record not found' }, 404, request);
      }
      targetRowId = row.id;
      isReconnect = true;

      await service
        .from('integration_connections')
        .update({
          status: 'authorising',
          auth_mode: 'native',
          status_reason: null,
          account_label: emailHint || row.account_label,
          external_account_reference: emailHint || row.account_label || 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetRowId);
    } else if (!isNew) {
      let query = service
        .from('integration_connections')
        .select('id, status, account_label')
        .eq('user_id', user.id)
        .eq('provider_id', providerId)
        .is('deleted_at', null);

      if (emailHint) {
        query = query.ilike('account_label', emailHint);
      } else {
        query = query.neq('status', 'connected');
      }

      const { data: candidate } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (candidate) {
        targetRowId = candidate.id;
        isReconnect = candidate.status === 'connected' || candidate.status === 'reauth_required';
        await service
          .from('integration_connections')
          .update({
            status: 'authorising',
            auth_mode: 'native',
            status_reason: null,
            account_label: emailHint || candidate.account_label,
            external_account_reference: emailHint || candidate.account_label || 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetRowId);
      } else {
        const connName = emailHint ? `${provider.name} (${emailHint})` : provider.name;
        const { data: inserted, error: insertErr } = await service
          .from('integration_connections')
          .insert({
            user_id: user.id,
            organization_id: organizationId,
            provider_id: providerId,
            connection_name: connName,
            account_label: emailHint || null,
            external_account_reference: emailHint || 'pending',
            status: 'authorising',
            auth_mode: 'native',
          })
          .select('id')
          .single();

        if (insertErr || !inserted) {
          console.error('Failed to create connection record:', insertErr);
          return jsonResponse({ error: 'Failed to initiate connection record' }, 500, request);
        }
        targetRowId = inserted.id;
      }
    } else {
      const connName = emailHint ? `${provider.name} (${emailHint})` : provider.name;
      const { data: inserted, error: insertErr } = await service
        .from('integration_connections')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          provider_id: providerId,
          connection_name: connName,
          account_label: emailHint || null,
          external_account_reference: emailHint || 'pending',
          status: 'authorising',
          auth_mode: 'native',
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        console.error('Failed to create connection record:', insertErr);
        return jsonResponse({ error: 'Failed to initiate connection record' }, 500, request);
      }
      targetRowId = inserted.id;
    }

    // 7. Generate State and PKCE verifier/challenge
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // 8. Save to oauth_states
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: stateErr } = await service.from('oauth_states').insert({
      state,
      user_id: user.id,
      provider_id: providerId,
      code_verifier: codeVerifier,
      redirect_uri: targetRedirectUri,
      login_hint: emailHint || null,
      connection_id: targetRowId,
      expires_at: expiresAt,
    });

    if (stateErr) {
      console.error('Failed to save oauth state:', stateErr);
      return jsonResponse({ error: 'Failed to record authorization state' }, 500, request);
    }

    // 9. Build Authorization URL
    const { clientId } = getProviderCredentials(provider);
    const authConfig = provider.auth_config || {};
    const authorizeBase = authConfig.authorize_url || (
      provider.provider_family === 'google'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    );

    const authUrl = new URL(authorizeBase);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', targetRedirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Scopes
    const scopes = Array.isArray(provider.connect_scopes) ? provider.connect_scopes : [];
    authUrl.searchParams.set('scope', scopes.join(' '));

    // Additional provider params
    const additionalParams = authConfig.additional_params || {};
    for (const [k, v] of Object.entries(additionalParams)) {
      authUrl.searchParams.set(k, String(v));
    }

    if (emailHint && provider.provider_family !== 'linkedin') {
      authUrl.searchParams.set('login_hint', emailHint);
    }

    // 10. Audit event
    await writeAuditEvent(service, {
      connection_id: targetRowId,
      provider_id: providerId,
      user_id: user.id,
      organization_id: organizationId,
      event_type: isReconnect ? 'reconnect_started' : 'connect_started',
      metadata: {
        auth_mode: 'native',
        provider_family: provider.provider_family,
        redirect_uri: targetRedirectUri,
      },
    });

    return jsonResponse(
      {
        auth_url: authUrl.toString(),
        state,
        connection_id: targetRowId,
        auth_mode: 'native',
      },
      200,
      request,
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('oauth-start error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500, request);
  }
});
