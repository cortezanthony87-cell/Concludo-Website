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
  email_hint?: string;
  connection_id?: string;
  is_new?: boolean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);
  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as StartRequest;
    const providerId = typeof body.provider_id === 'string' ? body.provider_id.trim() : '';
    const emailHint = typeof body.email_hint === 'string' ? body.email_hint.trim() : '';
    const isNew = Boolean(body.is_new);
    const explicitConnectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : '';

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

    // 2. Derive user's organization from membership or ownership if available (optional for solo users)
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

    // 3. Rate limit check: 10 starts per user per 10 minutes
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

    // 4. Reset rows stuck in 'authorising' for > 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await service
      .from('integration_connections')
      .update({ status: 'not_connected', status_reason: 'Sign-in timed out' })
      .eq('user_id', user.id)
      .eq('status', 'authorising')
      .lte('updated_at', fifteenMinutesAgo);

    // 5. Determine whether to reuse an existing row or create a new one
    let targetRow: { id: string; nango_connection_id: string | null; status: string; account_label?: string | null } | null = null;

    if (explicitConnectionId) {
      // Caller explicitly requested a specific connection row (e.g. reconnect or update prefetched session)
      const { data: row } = await service
        .from('integration_connections')
        .select('id, nango_connection_id, status, provider_id, account_label')
        .eq('id', explicitConnectionId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (!row || row.provider_id !== providerId) {
        return jsonResponse({ error: 'Connection record not found for this provider' }, 404, request);
      }
      targetRow = row;
    } else if (!isNew) {
      // If not explicitly requesting a new account, check if an existing row matches email_hint or is uncompleted
      let query = service
        .from('integration_connections')
        .select('id, nango_connection_id, status, account_label')
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

      targetRow = candidate;
    }

    let connectionRowId: string;
    let isReconnect = false;
    let nangoConnId = targetRow?.nango_connection_id;

    if (targetRow) {
      connectionRowId = targetRow.id;
      isReconnect = Boolean(nangoConnId);
      const updatePayload: Record<string, any> = {
        status: 'authorising',
        nango_integration_id: provider.nango_integration_id,
        status_reason: null,
        updated_at: new Date().toISOString(),
      };
      if (emailHint) {
        updatePayload.account_label = emailHint;
        updatePayload.external_account_reference = emailHint;
      }
      await service
        .from('integration_connections')
        .update(updatePayload)
        .eq('id', connectionRowId);
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
      concludo_connection_id: connectionRowId,
      provider_id: providerId,
    };
    if (organizationId) {
      tags.organization_id = organizationId;
    }

    const endUser = {
      id: user.id,
      email: user.email || 'user@concludo.au',
      display_name: user.user_metadata?.full_name || user.email || 'User',
    };

    const authParams: Record<string, string> = {
      prompt: 'select_account',
    };
    const effectiveEmail = emailHint || targetRow?.account_label || '';
    if (effectiveEmail) {
      authParams.login_hint = effectiveEmail;
    }

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
          end_user: endUser,
          tags,
          integrations_config_defaults: {
            [provider.nango_integration_id]: {
              authorization_params: authParams,
            },
          },
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
          end_user: endUser,
          tags,
          allowed_integrations: [provider.nango_integration_id],
          integrations_config_defaults: {
            [provider.nango_integration_id]: {
              authorization_params: authParams,
            },
          },
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
      provider_id: providerId,
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
        auth_params: authParams,
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
