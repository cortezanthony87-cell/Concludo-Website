import {
  createServiceClient,
  getNangoHost,
  getNangoSecretKey,
  writeAuditEvent,
} from './nango-common.ts';

// Webhook endpoint is public (verify_jwt = false).
// It verifies the X-Nango-Hmac-Sha256 header using NANGO_WEBHOOK_SECRET.

async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.toLowerCase() === signature.toLowerCase();
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signature =
    request.headers.get('x-nango-hmac-sha256') ||
    request.headers.get('x-nango-signature');
  const webhookSecret = Deno.env.get('NANGO_WEBHOOK_SECRET') || '';

  const rawBody = await request.text();

  const isValid = await verifySignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    console.warn('Invalid Nango webhook signature');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = JSON.parse(rawBody);
    const { type, operation, success, connectionId, providerConfigKey, tags, error: nangoErr } = payload;

    const service = createServiceClient();

    if (type === 'auth') {
      const concludoConnectionId = tags?.concludo_connection_id;
      const endUserId = tags?.end_user_id;
      const orgId = tags?.organization_id;

      if (!concludoConnectionId) {
        console.warn('Webhook received without concludo_connection_id in tags');
        return new Response(JSON.stringify({ ok: true, ignored: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Find the row and verify tags match
      const { data: row, error: rowErr } = await service
        .from('integration_connections')
        .select('id, user_id, organization_id, provider_id, nango_integration_id, status')
        .eq('id', concludoConnectionId)
        .is('deleted_at', null)
        .maybeSingle();

      if (rowErr || !row) {
        console.warn('Webhook row not found for ID:', concludoConnectionId);
        return new Response(JSON.stringify({ ok: true, not_found: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check user, organization and integration matching
      if (
        (endUserId && row.user_id !== endUserId) ||
        (orgId && row.organization_id !== orgId) ||
        (providerConfigKey && row.nango_integration_id !== providerConfigKey)
      ) {
        console.warn('Webhook tags mismatch for row:', row.id);
        return new Response(JSON.stringify({ ok: true, ignored_mismatch: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const now = new Date().toISOString();

      if (operation === 'creation' || operation === 'override') {
        if (success) {
          // Set nango_connection_id, status verifying, event authorised
          await service
            .from('integration_connections')
            .update({
              nango_connection_id: connectionId,
              status: 'verifying',
              updated_at: now,
            })
            .eq('id', row.id);

          await writeAuditEvent(service, {
            connection_id: row.id,
            user_id: row.user_id,
            organization_id: row.organization_id,
            event_type: 'authorised',
            severity: 'info',
            metadata: { operation, provider_config_key: providerConfigKey },
          });

          // Trigger test call asynchronously or inline
          // Run test call to verify and mark connected
          try {
            // Read provider test_call
            const { data: provider } = await service
              .from('integration_providers')
              .select('id, test_call, account_endpoint, account_field, fallback_field')
              .eq('id', row.provider_id)
              .single();

            if (provider?.test_call) {
              const testCall = provider.test_call as { endpoint: string; method?: string; base?: string };
              const nangoHost = getNangoHost();
              const nangoSecret = getNangoSecretKey();

              const headers: Record<string, string> = {
                'Authorization': `Bearer ${nangoSecret}`,
                'Connection-Id': connectionId,
                'Provider-Config-Key': providerConfigKey,
              };
              if (testCall.base) headers['Base-Url-Override'] = testCall.base;

              const testRes = await fetch(`${nangoHost}/proxy${testCall.endpoint}`, {
                method: (testCall.method || 'GET').toUpperCase(),
                headers,
              });

              if (testRes.ok) {
                // Fetch account label if available
                let accountLabel: string | null = null;
                if (provider.account_endpoint) {
                  try {
                    const accRes = await fetch(`${nangoHost}/proxy${provider.account_endpoint}`, { headers });
                    if (accRes.ok) {
                      const accJson = await accRes.json();
                      accountLabel =
                        (provider.account_field ? accJson[provider.account_field] : null) ||
                        (provider.fallback_field ? accJson[provider.fallback_field] : null) ||
                        null;
                    }
                  } catch (e) {
                    console.warn('Account label fetch error:', e);
                  }
                }

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
                    external_account_reference: accountLabel || 'connected',
                    updated_at: now,
                  })
                  .eq('id', row.id);

                await writeAuditEvent(service, {
                  connection_id: row.id,
                  user_id: row.user_id,
                  organization_id: row.organization_id,
                  event_type: 'test_passed',
                  severity: 'info',
                  metadata: { endpoint: testCall.endpoint, http_status: testRes.status },
                });
              } else {
                await service
                  .from('integration_connections')
                  .update({
                    status: 'failed',
                    last_test_at: now,
                    last_test_result: 'failed',
                    last_error_code: `http_${testRes.status}`,
                    updated_at: now,
                  })
                  .eq('id', row.id);

                await writeAuditEvent(service, {
                  connection_id: row.id,
                  user_id: row.user_id,
                  organization_id: row.organization_id,
                  event_type: 'test_failed',
                  severity: 'warning',
                  metadata: { endpoint: testCall.endpoint, http_status: testRes.status },
                });
              }
            }
          } catch (testErr) {
            console.error('Test execution error during webhook handling:', testErr);
          }
        } else {
          // Failure on creation
          await service
            .from('integration_connections')
            .update({
              status: 'failed',
              last_error_code: nangoErr?.type || 'authorisation_failed',
              status_reason: 'Authorisation failed',
              updated_at: now,
            })
            .eq('id', row.id);

          await writeAuditEvent(service, {
            connection_id: row.id,
            user_id: row.user_id,
            organization_id: row.organization_id,
            event_type: 'authorisation_failed',
            severity: 'error',
            metadata: { error_type: nangoErr?.type },
          });
        }
      } else if (operation === 'refresh') {
        if (!success) {
          await service
            .from('integration_connections')
            .update({
              status: 'reauth_required',
              status_reason: 'Your sign-in has expired or was revoked.',
              last_error_code: nangoErr?.type || 'refresh_failed',
              updated_at: now,
            })
            .eq('id', row.id);

          await writeAuditEvent(service, {
            connection_id: row.id,
            user_id: row.user_id,
            organization_id: row.organization_id,
            event_type: 'refresh_failed',
            severity: 'warning',
            metadata: { error_type: nangoErr?.type },
          });
        } else {
          // Refresh recovery
          await writeAuditEvent(service, {
            connection_id: row.id,
            user_id: row.user_id,
            organization_id: row.organization_id,
            event_type: 'token_refreshed',
            severity: 'info',
            metadata: { provider_config_key: providerConfigKey },
          });
        }
      } else if (operation === 'deletion') {
        await service
          .from('integration_connections')
          .update({
            status: 'disconnected',
            deleted_at: now,
            status_reason: 'Deleted externally or in Nango',
            updated_at: now,
          })
          .eq('id', row.id);

        await writeAuditEvent(service, {
          connection_id: row.id,
          user_id: row.user_id,
          organization_id: row.organization_id,
          event_type: 'removed',
          severity: 'info',
          metadata: { reason: 'Nango deletion event' },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Nango webhook processing error:', err);
    return new Response(JSON.stringify({ ok: true, error: 'processing_error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
