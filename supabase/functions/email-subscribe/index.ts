import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  optionsResponse,
  requireUser,
  writeAuditEvent,
} from './nango-common.ts';
import { getOrRefreshAccessToken } from './native-oauth.ts';

/**
 * Edge Function: email-subscribe
 * 
 * Automatically called upon successful OAuth connection (or explicitly by client / cron)
 * to register provider push notifications for a user's mailbox:
 * 1. Gmail: POST https://gmail.googleapis.com/gmail/v1/users/me/watch
 * 2. Microsoft Outlook: POST https://graph.microsoft.com/v1.0/subscriptions
 * 
 * Stores active subscription ID and expiration in provider_subscriptions table.
 */

interface SubscribeRequest {
  connection_id: string;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as SubscribeRequest;
    const connectionId = body.connection_id;

    if (!connectionId) {
      return jsonResponse({ error: 'Missing connection_id' }, 400, request);
    }

    const service = createServiceClient();

    // 1. Fetch connection record & verify ownership
    const { data: conn, error: connErr } = await service
      .from('integration_connections')
      .select('id, user_id, organization_id, provider_id, status, account_label')
      .eq('id', connectionId)
      .is('deleted_at', null)
      .single();

    if (connErr || !conn) {
      return jsonResponse({ error: 'Connection not found' }, 404, request);
    }

    if (conn.user_id !== user.id) {
      return jsonResponse({ error: 'Unauthorized' }, 403, request);
    }

    const { accessToken } = await getOrRefreshAccessToken(service, connectionId);
    const webhookBaseUrl = Deno.env.get('SUPABASE_URL') || 'https://dikthezsghsssnwtctem.supabase.co';
    const notificationUrl = `${webhookBaseUrl}/functions/v1/email-webhook`;

    // 2. Gmail Watch Registration
    if (conn.provider_id === 'gmail') {
      const topicName = Deno.env.get('GOOGLE_PUBSUB_TOPIC') || 'projects/concludo-workspace/topics/gmail-inbox-events';

      const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicName,
          labelIds: ['INBOX'],
        }),
      });

      if (!watchRes.ok) {
        const errText = await watchRes.text().catch(() => '');
        console.error('Gmail watch failed:', watchRes.status, errText);
        return jsonResponse({ error: `Gmail watch registration failed: ${errText}` }, 400, request);
      }

      const watchData = await watchRes.json();
      // Google watch returns { historyId: string, expiration: string (epoch ms) }
      const expiresAt = new Date(Number(watchData.expiration)).toISOString();
      const historyId = String(watchData.historyId);

      const { data: sub, error: subErr } = await service
        .from('provider_subscriptions')
        .upsert(
          {
            user_id: user.id,
            organization_id: conn.organization_id,
            connection_id: conn.id,
            provider: 'gmail',
            subscription_id: historyId,
            topic_name: topicName,
            history_id: historyId,
            status: 'active',
            expires_at: expiresAt,
            last_renewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'connection_id,provider' }
        )
        .select()
        .single();

      if (subErr) {
        console.error('Failed to save subscription:', subErr);
        return jsonResponse({ error: 'Failed to record subscription' }, 500, request);
      }

      return jsonResponse({ ok: true, provider: 'gmail', subscription: sub }, 200, request);
    }

    // 3. Microsoft Outlook Graph Subscription Registration
    if (conn.provider_id === 'microsoft_outlook') {
      // Subscriptions for messages expire max 4,230 minutes (~2.9 days)
      const expirationDateTime = new Date(Date.now() + 4200 * 60 * 1000).toISOString();
      const clientState = crypto.randomUUID();

      const graphRes = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changeType: 'created',
          notificationUrl,
          resource: "/me/mailFolders('Inbox')/messages",
          expirationDateTime,
          clientState,
        }),
      });

      if (!graphRes.ok) {
        const errText = await graphRes.text().catch(() => '');
        console.error('Microsoft Graph subscription failed:', graphRes.status, errText);
        return jsonResponse({ error: `Outlook subscription registration failed: ${errText}` }, 400, request);
      }

      const graphData = await graphRes.json();
      const subscriptionId = graphData.id;
      const expiresAt = graphData.expirationDateTime;

      const { data: sub, error: subErr } = await service
        .from('provider_subscriptions')
        .upsert(
          {
            user_id: user.id,
            organization_id: conn.organization_id,
            connection_id: conn.id,
            provider: 'microsoft_outlook',
            subscription_id: subscriptionId,
            client_state_secret: clientState,
            status: 'active',
            expires_at: expiresAt,
            last_renewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'connection_id,provider' }
        )
        .select()
        .single();

      if (subErr) {
        console.error('Failed to save subscription:', subErr);
        return jsonResponse({ error: 'Failed to record subscription' }, 500, request);
      }

      return jsonResponse({ ok: true, provider: 'microsoft_outlook', subscription: sub }, 200, request);
    }

    return jsonResponse({ error: `Unsupported provider: ${conn.provider_id}` }, 400, request);
  } catch (err: any) {
    console.error('email-subscribe error:', err);
    return jsonResponse({ error: err.message || 'Internal error' }, 500, request);
  }
});
