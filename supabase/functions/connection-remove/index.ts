import { jsonResponse, optionsResponse } from './_shared/cors.ts';
import { createCallerClient, createServiceClient, requireUser } from './_shared/supabase.ts';

type RemoveRequest = { connectionId?: unknown };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const body = (await request.json()) as RemoveRequest;
    const connectionId = typeof body.connectionId === 'string' ? body.connectionId.trim() : '';
    if (!isUuid(connectionId)) {
      return jsonResponse({ error: 'invalid_connection_id' }, 400, request);
    }

    const { client: callerClient, user } = await requireUser(request);

    // Section 6 permission check: Using the caller's client, select the row.
    // If RLS does not return it, answer "not found".
    const { data: callerRow, error: callerErr } = await callerClient
      .from('integration_connections')
      .select('id, organization_id, credential_reference')
      .eq('id', connectionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (callerErr) {
      console.error('Caller RLS select error:', callerErr);
      return jsonResponse({ error: 'not_found' }, 404, request);
    }

    if (!callerRow) {
      return jsonResponse({ error: 'not_found' }, 404, request);
    }

    // Using the service role: soft-delete row and clean up secret
    const service = createServiceClient();
    const now = new Date().toISOString();

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

    if (callerRow.credential_reference) {
      try {
        await service
          .schema('vault')
          .from('secrets')
          .delete()
          .eq('name', callerRow.credential_reference);
      } catch {
        // Vault cleanup best-effort in Phase 0
      }
    }

    try {
      await service.from('audit_logs').insert({
        user_id: user.id,
        organization_id: callerRow.organization_id,
        action: 'integration.connection.removed',
        entity_type: 'integration_connection',
        entity_id: connectionId,
        details: { reason: 'Removed by the user' },
      });
    } catch (auditErr) {
      console.warn('Audit log write skipped or failed:', auditErr);
    }

    return jsonResponse({ ok: true }, 200, request);
  } catch (error) {
    if (error instanceof Response) return jsonResponse({ error: 'unauthorized' }, error.status, request);
    console.error('connection-remove failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'connection_remove_failed' }, 500, request);
  }
});
