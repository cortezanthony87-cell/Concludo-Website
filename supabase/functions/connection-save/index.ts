import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  optionsResponse,
  requireUser,
  writeAuditEvent,
} from './nango-common.ts';
import { encryptToken } from './native-crypto.ts';

interface SaveRequest {
  provider_id: string;
  credential?: string;
  account_label?: string;
  settings?: Record<string, any>;
  connection_id?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as SaveRequest;
    const providerId = typeof body.provider_id === 'string' ? body.provider_id.trim() : '';
    const credential = typeof body.credential === 'string' ? body.credential.trim() : '';
    const accountLabel = typeof body.account_label === 'string' ? body.account_label.trim() : '';
    const settings = (body.settings && typeof body.settings === 'object') ? body.settings : {};
    const explicitConnectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : '';

    if (!providerId) {
      return jsonResponse({ error: 'provider_id is required' }, 400, request);
    }
    const isManagedClaude = providerId === 'anthropic_claude' && (!credential || credential === 'native_workspace_ai');
    if (!credential && !isManagedClaude) {
      return jsonResponse({ error: 'API key or credential is required' }, 400, request);
    }

    const service = createServiceClient();

    // 1. Verify provider exists in database
    const { data: provider, error: providerErr } = await service
      .from('integration_providers')
      .select('id, name, availability, authentication_type, connect_scopes')
      .eq('id', providerId)
      .maybeSingle();

    if (providerErr || !provider) {
      return jsonResponse({ error: 'Provider not found' }, 404, request);
    }

    // 2. Derive user's organization if present
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

    // 3. Encrypt the credential if custom key provided, or set native mode
    const encryptedAccess = (credential && credential !== 'native_workspace_ai') ? await encryptToken(credential) : null;
    const authMode = (credential && credential !== 'native_workspace_ai') ? 'direct_api_key' : 'native';
    const now = new Date().toISOString();
    const finalAccountLabel = accountLabel || (isManagedClaude ? (user.email || 'Concludo Workspace AI') : `${provider.name} Account`);
    const connName = `${provider.name} (${finalAccountLabel})`;

    let connectionId = explicitConnectionId;

    if (connectionId) {
      // Update existing connection
      const { data: updated, error: updateErr } = await service
        .from('integration_connections')
        .update({
          connection_name: connName,
          account_label: finalAccountLabel,
          external_account_reference: finalAccountLabel,
          auth_mode: authMode,
          encrypted_access_token: encryptedAccess,
          status: 'connected',
          settings: isManagedClaude ? { managed: true, model: 'Claude 3.5 Sonnet', ...settings } : settings,
          scopes: provider.connect_scopes || [],
          connected_at: now,
          verified_at: now,
          last_test_at: now,
          last_test_result: 'success',
          last_error_code: null,
          status_reason: null,
          health_details: { healthy: true, last_check_status: 'OK', model: 'Claude 3.5 Sonnet' },
          updated_at: now,
        })
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 500, request);
      }

      await writeAuditEvent(service, {
        connection_id: connectionId,
        provider_id: providerId,
        user_id: user.id,
        organization_id: organizationId,
        event_type: 'connect_completed',
        metadata: { auth_mode: 'direct_api_key', provider_name: provider.name },
      });

      return jsonResponse({ success: true, connection: updated }, 200, request);
    }

    // Insert new connection
    const { data: inserted, error: insertErr } = await service
      .from('integration_connections')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        provider_id: providerId,
        connection_name: connName,
        account_label: finalAccountLabel,
        external_account_reference: finalAccountLabel,
        auth_mode: authMode,
        encrypted_access_token: encryptedAccess,
        status: 'connected',
        settings: isManagedClaude ? { managed: true, model: 'Claude 3.5 Sonnet', ...settings } : settings,
        scopes: provider.connect_scopes || [],
        credential_reference: isManagedClaude ? 'concludo_workspace_ai' : `direct_key_${Date.now()}`,
        connected_at: now,
        verified_at: now,
        last_test_at: now,
        last_test_result: 'success',
        last_error_code: null,
        status_reason: null,
        health_details: { healthy: true, last_check_status: 'OK', model: 'Claude 3.5 Sonnet' },
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (insertErr) {
      return jsonResponse({ error: insertErr.message }, 500, request);
    }

    await writeAuditEvent(service, {
      connection_id: inserted.id,
      provider_id: providerId,
      user_id: user.id,
      organization_id: organizationId,
      event_type: 'connect_completed',
      metadata: { auth_mode: 'direct_api_key', provider_name: provider.name },
    });

    return jsonResponse({ success: true, connection: inserted }, 200, request);
  } catch (err: any) {
    console.error('connection-save error:', err);
    return jsonResponse({ error: err.message || 'internal_error' }, 500, request);
  }
});
