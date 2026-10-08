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

interface StartRequest {
  provider_id?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as StartRequest;
    const providerId = typeof body.provider_id === 'string' ? body.provider_id.trim() : '';

    if (!providerId) {
      return jsonResponse({ error: 'provider_id is required' }, 400, request);
    }

    const service = createServiceClient();

    // 1. Read provider using service role
    const { data: provider, error: providerErr } = await service
      .from('integration_providers')
      .select('id, name, availability, nango_integration_id')
      .eq('id', providerId)
      .maybeSingle();

    if (providerErr || !provider) {
      return jsonResponse({ error: 'Provider not found' }, 404, request);
    }

    if (provider.availability !== 'available' || !provider.nango_integration_id) {
      return jsonResponse({ error: 'This app is not available yet.' }, 400, request);
    }

    // 2. Derive user's organization from membership
    const { data: profile, error: profileErr } = await service
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    let organizationId = profile?.organization_id;

    if (!organizationId) {
      const { data: member } = await service
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      organizationId = member?.organization_id;
    }

    if (!organizationId) {
      return jsonResponse({ error: 'User does not belong to an organization' }, 400, request);
    }

    // 3. Rate limit check: 10 starts per user per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentStartsCount } = await service
      .from('integration_connection_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('event_type', ['connect_started', 'reconnect_started'])
      .gte('created_at', tenMinutesAgo);

    if ((recentStartsCount ?? 0) >= 10) {
      return jsonResponse({ error: 'Too many connection attempts. Please wait a few minutes.' }, 429, request);
    }

    // 4. Reset rows stuck in 'authorising' for > 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await service
      .from('integration_connections')
      .update({ status: 'not_connected', status_reason: 'Sign-in timed out' })
      .eq('user_id', user.id)
      .eq('status', 'authorising')
      .lte('updated_at', fifteenMinutesAgo);

    // 5. Find caller's live row for this provider
    const { data: existingRow } = await service
      .from('integration_connections')
      .select('id, nango_connection_id, status')
      .eq('user_id', user.id)
      .eq('provider_id', providerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let connectionRowId: string;
    let isReconnect = false;
    let nangoConnId = existingRow?.nango_connection_id;

    if (existingRow) {
      connectionRowId = existingRow.id;
      isReconnect = Boolean(nangoConnId);
      await service
        .from('integration_connections')
        .update({
          status: 'authorising',
          nango_integration_id: provider.nango_integration_id,
          status_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionRowId);
    } else {
      const { data: inserted, error: insertErr } = await service
        .from('integration_connections')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          provider_id: providerId,
          connection_name: provider.name,
          external_account_reference: 'pending',
          status: 'authorising',
          nango_integration_id: provider.nango_integration_id,
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        console.error('Failed to create connection row:', insertErr);
        return jsonResponse({ error: 'Failed to initiate connection record' }, 500, request);
      }
      connectionRowId = inserted.id;
    }

    // 6. Request Connect Session from Nango
    const nangoHost = getNangoHost();
    const nangoSecret = getNangoSecretKey();

    const tags: Record<string, string> = {
      end_user_id: user.id,
      organization_id: organizationId,
      concludo_connection_id: connectionRowId,
      provider_id: providerId,
    };

    let sessionRes: Response;
    if (isReconnect && nangoConnId) {
      sessionRes = await fetch(`${nangoHost}/connect/sessions/reconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nangoSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: nangoConnId,
          integration_id: provider.nango_integration_id,
          tags,
        }),
      });
    } else {
      sessionRes = await fetch(`${nangoHost}/connect/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nangoSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tags,
          allowed_integrations: [provider.nango_integration_id],
        }),
      });
    }

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      console.error('Nango session creation failed:', sessionRes.status, errText);
      return jsonResponse({ error: 'Failed to create connection session' }, 502, request);
    }

    const sessionData = await sessionRes.json();
    const token = sessionData.data?.token || sessionData.token;

    if (!token) {
      console.error('Nango returned no token:', sessionData);
      return jsonResponse({ error: 'Connection provider returned invalid session' }, 502, request);
    }

    // 7. Write audit event
    await writeAuditEvent(service, {
      connection_id: connectionRowId,
      user_id: user.id,
      organization_id: organizationId,
      event_type: isReconnect ? 'reconnect_started' : 'connect_started',
      metadata: {
        provider_id: providerId,
        nango_integration_id: provider.nango_integration_id,
      },
    });

    return jsonResponse(
      {
        token,
        nango_integration_id: provider.nango_integration_id,
        connection_id: connectionRowId,
      },
      200,
      request,
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('connection-start error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500, request);
  }
});
