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

type RemoveRequest = { connectionId?: unknown };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const body = (await request.json().catch(() => ({}))) as RemoveRequest;
    const connectionId = typeof body.connectionId === 'string' ? body.connectionId.trim() : '';
    if (!isUuid(connectionId)) {
      return jsonResponse({ error: 'invalid_connection_id' }, 400, request);
    }

    const { client: callerClient, user } = await requireUser(request);

    // Permission check: Using the caller's client, select the row with RLS.
    const { data: callerRow, error: callerErr } = await callerClient
      .from('integration_connections')
      .select('id, organization_id, provider_id, nango_connection_id, nango_integration_id, credential_reference')
      .eq('id', connectionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (callerErr || !callerRow) {
      return jsonResponse({ error: 'not_found' }, 404, request);
    }

    const service = createServiceClient();
    const now = new Date().toISOString();

    // 1. Delete connection in Nango if nango_connection_id exists
    if (callerRow.nango_connection_id && callerRow.nango_integration_id) {
      const nangoHost = getNangoHost();
      const nangoSecret = getNangoSecretKey();

      // For Google apps, attempt token revoke first if possible
      if (callerRow.provider_id.startsWith('google') || callerRow.provider_id === 'gmail') {
        try {
          const connRes = await fetch(
            `${nangoHost}/connections/${callerRow.nango_connection_id}?provider_config_key=${callerRow.nango_integration_id}`,
            {
              headers: { Authorization: `Bearer ${nangoSecret}` },
            }
          );
          if (connRes.ok) {
            const connData = await connRes.json();
            const tokenToRevoke =
              connData.credentials?.access_token ||
              connData.credentials?.raw?.access_token;
            if (tokenToRevoke) {
              await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              });
            }
          }
        } catch (revokeErr) {
          console.warn('Google token revoke warning:', revokeErr);
        }
      }

      // Delete connection in Nango
      try {
        await fetch(
          `${nangoHost}/connections/${callerRow.nango_connection_id}?provider_config_key=${callerRow.nango_integration_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${nangoSecret}` },
          }
        );
      } catch (delErr) {
        console.warn('Nango connection delete warning:', delErr);
      }
    }

    // 2. Soft-delete row in database
    const { error: updateErr } = await service
      .from('integration_connections')
      .update({
        status: 'disconnected',
        deleted_at: now,
        deleted_by: user.id,
        status_reason: 'Removed by the user',
      })
      .eq('id', connectionId);

    if (updateErr) {
      console.error('Update connection error:', updateErr);
      throw new Error('Failed to update connection status');
    }

    // Legacy vault secret cleanup if exists
    if (callerRow.credential_reference) {
      try {
        await service
          .schema('vault')
          .from('secrets')
          .delete()
          .eq('name', callerRow.credential_reference);
      } catch {
        // Vault cleanup best-effort
      }
    }

    // 3. Write audit events
    await writeAuditEvent(service, {
      connection_id: connectionId,
      user_id: user.id,
      organization_id: callerRow.organization_id,
      event_type: 'removed',
      severity: 'info',
      metadata: { reason: 'Removed by the user' },
    });

    try {
      await service.from('audit_logs').insert({
        user_id: user.id,
        organization_id: callerRow.organization_id,
        action: 'integration.connection.removed',
        entity_type: 'integration_connection',
        entity_id: connectionId,
        details: { reason: 'Removed by the user' },
      });
    } catch {
      // Audit log best-effort
    }

    return jsonResponse({ ok: true }, 200, request);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('connection-remove failed:', error);
    return jsonResponse({ error: 'connection_remove_failed' }, 500, request);
  }
});
