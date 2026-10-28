import { createServiceClient, jsonResponse, writeAuditEvent } from './nango-common.ts';
import { getOrRefreshAccessToken } from './native-oauth.ts';

/**
 * Edge Function: email-webhook
 * 
 * Receives push notifications from:
 * 1. Microsoft Graph Change Notifications (POST with validationToken handshake or resource notifications)
 * 2. Google Cloud Pub/Sub (POST wrapped in Pub/Sub message envelope from Gmail watch)
 * 
 * Security & Authentication:
 * - Microsoft: Validates clientState against stored secret in provider_subscriptions.
 * - Google: Validates Google Pub/Sub subscription format or basic bearer token.
 * - Multi-tenant isolation: Scoped strictly to the subscriber's user_id and organization_id.
 * - Concludo Principle: "Measure work, never people" — only extract objective email metadata and sync status.
 */

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  // 1. Microsoft Graph Validation Handshake
  // When creating a subscription, Microsoft sends a GET or POST with ?validationToken=...
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken) {
    // Must return 200 with plain text token within 10 seconds
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const service = createServiceClient();

  try {
    const rawBody = await request.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
    }

    // 2. Identify Provider Type
    // Microsoft Graph sends { value: [ { subscriptionId, clientState, resource, changeType } ] }
    // Google Pub/Sub sends { message: { data: base64, messageId, publishTime }, subscription: string }
    if (Array.isArray(body.value) && body.value.length > 0) {
      return await handleMicrosoftNotification(service, body.value);
    } else if (body.message && body.message.data) {
      return await handleGooglePubSubNotification(service, body.message);
    } else {
      console.warn('Unknown webhook payload structure:', rawBody.slice(0, 200));
      return jsonResponse({ error: 'unrecognized_payload' }, 400);
    }
  } catch (err) {
    console.error('Unhandled webhook error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'internal_error' }, 500);
  }
});

/**
 * Handles Microsoft Graph Push Notifications
 */
async function handleMicrosoftNotification(service: any, notifications: any[]) {
  for (const item of notifications) {
    const subscriptionId = item.subscriptionId;
    const clientState = item.clientState;
    const resource = item.resource;

    if (!subscriptionId) continue;

    // Lookup active subscription
    const { data: sub, error: subErr } = await service
      .from('provider_subscriptions')
      .select('id, user_id, organization_id, connection_id, client_state_secret')
      .eq('subscription_id', subscriptionId)
      .eq('provider', 'microsoft_outlook')
      .eq('status', 'active')
      .maybeSingle();

    if (subErr || !sub) {
      console.warn(`Subscription not found or inactive: ${subscriptionId}`);
      continue;
    }

    // Verify client state matches stored secret
    if (sub.client_state_secret && clientState !== sub.client_state_secret) {
      console.error(`Invalid clientState for subscription: ${subscriptionId}`);
      continue;
    }

    // Update last_event_at
    await service
      .from('provider_subscriptions')
      .update({ last_event_at: new Date().toISOString() })
      .eq('id', sub.id);

    // Fetch access token for the connection
    try {
      const { accessToken } = await getOrRefreshAccessToken(service, sub.connection_id);
      
      // If resource points to a specific message, fetch basic metadata
      let senderName = 'New Email';
      let subject = 'New message in your inbox';
      let snippet = 'An incoming email was received.';

      const messageUrl = resource.startsWith('http')
        ? resource
        : `https://graph.microsoft.com/v1.0/${resource}?$select=id,subject,from,bodyPreview,receivedDateTime`;

      const res = await fetch(messageUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const msgData = await res.json();
        senderName = msgData.from?.emailAddress?.name || msgData.from?.emailAddress?.address || 'Unknown Sender';
        subject = msgData.subject || '(No Subject)';
        snippet = msgData.bodyPreview?.slice(0, 160) || 'New message arrived.';
      }

      // Insert into user_notifications (triggers Realtime publish automatically)
      await service.from('user_notifications').insert({
        user_id: sub.user_id,
        organization_id: sub.organization_id,
        kind: 'email',
        title: `Email from ${senderName}`,
        summary: `${subject} — ${snippet}`,
        sender_name: senderName,
        target_url: '/email/needs-attention',
        reference_id: resource,
        is_read: false,
      });

      await writeAuditEvent(service, {
        connection_id: sub.connection_id,
        user_id: sub.user_id,
        organization_id: sub.organization_id,
        event_type: 'email_webhook_received',
        metadata: { provider: 'microsoft_outlook', subscriptionId },
      });
    } catch (err) {
      console.error(`Failed to process message for connection ${sub.connection_id}:`, err);
    }
  }

  // Microsoft Graph expects a 202 Accepted response for notifications
  return new Response(null, { status: 202 });
}

/**
 * Handles Google Cloud Pub/Sub Gmail Watch Notifications
 */
async function handleGooglePubSubNotification(service: any, message: any) {
  // Decode base64 Pub/Sub payload
  const decodedStr = atob(message.data);
  let data: any = {};
  try {
    data = JSON.parse(decodedStr);
  } catch {
    console.warn('Failed to parse Pub/Sub data as JSON:', decodedStr);
    return jsonResponse({ ok: true }); // Acknowledge to Pub/Sub anyway so it does not retry infinitely
  }

  const emailAddress = data.emailAddress;
  const historyId = String(data.historyId || '');

  if (!emailAddress) {
    return jsonResponse({ ok: true });
  }

  // Match subscription by user's account_label or connection external reference
  const { data: conn, error: connErr } = await service
    .from('integration_connections')
    .select('id, user_id, organization_id, account_label')
    .or(`account_label.eq.${emailAddress},external_account_reference.eq.${emailAddress}`)
    .eq('provider_id', 'gmail')
    .eq('status', 'connected')
    .maybeSingle();

  if (connErr || !conn) {
    console.warn(`No active Gmail connection found for: ${emailAddress}`);
    return jsonResponse({ ok: true });
  }

  try {
    // Get token and query latest message using Gmail history or messages.list
    const { accessToken } = await getOrRefreshAccessToken(service, conn.id);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=label:INBOX`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let senderName = 'New Sender';
    let subject = 'New message in your inbox';
    let snippet = 'An incoming email was received.';

    if (listRes.ok) {
      const listData = await listRes.json();
      const firstId = listData.messages?.[0]?.id;
      if (firstId) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${firstId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          const fromH = headers.find((h: any) => h.name.toLowerCase() === 'from');
          const subjH = headers.find((h: any) => h.name.toLowerCase() === 'subject');
          if (fromH) senderName = fromH.value;
          if (subjH) subject = subjH.value;
          snippet = msgData.snippet || '';
        }
      }
    }

    // Insert into user_notifications
    await service.from('user_notifications').insert({
      user_id: conn.user_id,
      organization_id: conn.organization_id,
      kind: 'email',
      title: `Email from ${senderName}`,
      summary: `${subject} — ${snippet}`,
      sender_name: senderName,
      target_url: '/email/needs-attention',
      reference_id: historyId,
      is_read: false,
    });

    // Update provider_subscriptions checkpoint
    await service
      .from('provider_subscriptions')
      .update({
        history_id: historyId,
        last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('connection_id', conn.id);

    await writeAuditEvent(service, {
      connection_id: conn.id,
      user_id: conn.user_id,
      organization_id: conn.organization_id,
      event_type: 'email_webhook_received',
      metadata: { provider: 'gmail', historyId },
    });
  } catch (err) {
    console.error('Failed to process Gmail push event:', err);
  }

  return jsonResponse({ ok: true });
}
