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
import { getOrRefreshAccessToken } from './native-oauth.ts';

interface ScanRequest {
  connection_id: string;
  account_id?: string;
  account_email?: string;
  limit?: number;
}

interface IngestedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  bodyPreview?: string;
  date: string;
  hasAttachments: boolean;
  isImportant: boolean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as ScanRequest;
    const connectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : '';
    const maxMessages = Math.min(Math.max(Number(body.limit) || 20, 5), 50);

    if (!connectionId) {
      return jsonResponse({ error: 'connection_id is required' }, 400, request);
    }

    const service = createServiceClient();

    // 1. Verify connection ownership and status
    const { data: connection, error: connErr } = await service
      .from('integration_connections')
      .select('id, user_id, organization_id, provider_id, nango_connection_id, nango_integration_id, auth_mode, status, account_label, external_account_reference')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (connErr || !connection) {
      return jsonResponse({ error: 'Connection not found or unauthorized' }, 404, request);
    }

    if (connection.status !== 'connected') {
      return jsonResponse({
        error: 'Mailbox is not connected or verified. Please reconnect in Settings > Integrations.',
        status: connection.status,
      }, 400, request);
    }

    const isNative = connection.auth_mode === 'native';
    let nativeToken = '';
    if (isNative) {
      const tokenResult = await getOrRefreshAccessToken(service, connection.id);
      nativeToken = tokenResult.accessToken;
    } else if (!connection.nango_connection_id || !connection.nango_integration_id) {
      return jsonResponse({
        error: 'Mailbox is missing connection credentials. Please reconnect in Settings > Integrations.',
        status: connection.status,
      }, 400, request);
    }

    const nangoHost = getNangoHost();
    const nangoSecret = getNangoSecretKey();
    const proxyHeaders: Record<string, string> = {
      'Authorization': `Bearer ${nangoSecret}`,
      'Connection-Id': connection.nango_connection_id,
      'Provider-Config-Key': connection.nango_integration_id,
    };

    const emails: IngestedEmail[] = [];
    const providerId = connection.provider_id;

    // 2. Ingest via Nango Proxy based on provider
    if (providerId === 'gmail') {
      // Step 2a: List message IDs from Gmail API (native or via Nango proxy)
      const listUrl = isNative
        ? `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxMessages}`
        : `${nangoHost}/proxy/gmail/v1/users/me/messages?maxResults=${maxMessages}`;
      const listHeaders = isNative
        ? { Authorization: `Bearer ${nativeToken}` }
        : { ...proxyHeaders, 'Base-Url-Override': 'https://gmail.googleapis.com' };

      const listRes = await fetch(listUrl, { headers: listHeaders });
      
      if (!listRes.ok) {
        const errText = await listRes.text().catch(() => '');
        if (listRes.status === 403 || listRes.status === 401) {
          return jsonResponse({
            error: 'Mailbox read permission not granted. Please reconnect your account with read permissions.',
            status: 'reconnect_required',
            providerStatus: listRes.status,
          }, 403, request);
        }
        return jsonResponse({
          error: `Gmail proxy failed: ${listRes.status} ${errText}`,
        }, 502, request);
      }

      const listData = await listRes.json();
      const messageRefs = (listData.messages || []) as Array<{ id: string; threadId: string }>;

      // Step 2b: Fetch details for recent messages (bounded to 15 max)
      const batch = messageRefs.slice(0, 15);
      for (const msgRef of batch) {
        try {
          const getUrl = isNative
            ? `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`
            : `${nangoHost}/proxy/gmail/v1/users/me/messages/${msgRef.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`;
          const getRes = await fetch(getUrl, { headers: listHeaders });
          if (!getRes.ok) continue;
          const msg = await getRes.json();
          const headers = (msg.payload?.headers || []) as Array<{ name: string; value: string }>;
          const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          emails.push({
            id: msg.id,
            threadId: msg.threadId || msg.id,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject') || '(No subject)',
            snippet: msg.snippet || '',
            date: getHeader('Date') || new Date().toISOString(),
            hasAttachments: false,
            isImportant: Boolean(msg.labelIds?.includes('IMPORTANT')),
          });
        } catch (e) {
          console.warn('Failed to fetch Gmail message detail:', e);
        }
      }
    } else if (providerId === 'microsoft_outlook') {
      // Step 2c: Query Microsoft Graph API (native or via Nango proxy)
      const graphUrl = isNative
        ? `https://graph.microsoft.com/v1.0/me/messages?$top=${maxMessages}&$select=id,conversationId,subject,bodyPreview,from,toRecipients,receivedDateTime,hasAttachments,importance`
        : `${nangoHost}/proxy/v1.0/me/messages?$top=${maxMessages}&$select=id,conversationId,subject,bodyPreview,from,toRecipients,receivedDateTime,hasAttachments,importance`;
      const graphHeaders = isNative
        ? { Authorization: `Bearer ${nativeToken}` }
        : proxyHeaders;

      const graphRes = await fetch(graphUrl, { headers: graphHeaders });

      if (!graphRes.ok) {
        const errText = await graphRes.text().catch(() => '');
        if (graphRes.status === 403 || graphRes.status === 401) {
          return jsonResponse({
            error: 'Outlook mailbox read permission not granted. Please reconnect your account with read permissions.',
            status: 'reconnect_required',
            providerStatus: graphRes.status,
          }, 403, request);
        }
        return jsonResponse({
          error: `Outlook proxy failed: ${graphRes.status} ${errText}`,
        }, 502, request);
      }

      const graphData = await graphRes.json();
      const msgs = (graphData.value || []) as Array<any>;
      for (const msg of msgs) {
        emails.push({
          id: msg.id,
          threadId: msg.conversationId || msg.id,
          from: msg.from?.emailAddress ? `${msg.from.emailAddress.name || ''} <${msg.from.emailAddress.address}>`.trim() : '',
          to: Array.isArray(msg.toRecipients) ? msg.toRecipients.map((r: any) => r.emailAddress?.address).filter(Boolean).join(', ') : '',
          subject: msg.subject || '(No subject)',
          snippet: msg.bodyPreview || '',
          bodyPreview: msg.bodyPreview || '',
          date: msg.receivedDateTime || new Date().toISOString(),
          hasAttachments: Boolean(msg.hasAttachments),
          isImportant: msg.importance === 'high',
        });
      }
    } else {
      return jsonResponse({ error: `Provider ${providerId} does not support email scanning` }, 400, request);
    }

    // 3. Synthesize attention items & work outputs from ingested emails
    const attentionItems = emails.map((mail, idx) => {
      const cleanSubject = mail.subject.replace(/^(re|fwd):\s*/i, '').trim();
      const fromName = mail.from.split('<')[0].replace(/"/g, '').trim() || mail.from;
      return {
        id: mail.id,
        threadId: mail.threadId,
        subject: mail.subject,
        cleanSubject,
        from: fromName,
        fromAddress: mail.from,
        date: mail.date,
        summary: mail.snippet || 'No preview available',
        needsReply: idx < 4 || mail.isImportant,
        priorityScore: mail.isImportant ? 92 : Math.max(88 - idx * 4, 60),
      };
    });

    const repliesDue = attentionItems.filter(i => i.needsReply);
    const topActions = attentionItems.slice(0, 5);

    const scanPayload = {
      connectionId: connection.id,
      providerId,
      accountEmail: connection.account_label || connection.external_account_reference,
      scannedAt: new Date().toISOString(),
      totalScanned: emails.length,
      governance: 'Concludo proposes; a person disposes. Read-only live audit; zero external mutations.',
      metrics: {
        needsAttention: attentionItems.length,
        repliesDue: repliesDue.length,
        deadlines: attentionItems.filter(i => /due|deadline|by\s+[a-z]+/i.test(i.summary)).length,
        waitingOnOthers: Math.max(0, attentionItems.length - repliesDue.length),
      },
      topActions: topActions.map(act => ({
        id: act.id,
        subject: act.subject,
        counterparty: act.from,
        summary: act.summary,
        priorityScore: act.priorityScore,
      })),
      replyQueue: repliesDue.slice(0, 5).map(rep => ({
        id: rep.id,
        subject: rep.subject,
        sender: rep.from,
        suggestedAction: `Prepare reply to ${rep.from}: ${rep.summary.slice(0, 100)}...`,
      })),
      emails: emails.slice(0, 20),
    };

    // 4. Log audit event
    await writeAuditEvent(service, {
      connection_id: connection.id,
      provider_id: providerId,
      user_id: user.id,
      organization_id: connection.organization_id,
      event_type: 'action_succeeded',
      metadata: {
        action: 'scan_emails',
        email_count: emails.length,
        account: scanPayload.accountEmail,
      },
    });

    return jsonResponse({
      success: true,
      summary: `Inbox Command Centre Agent scanned ${scanPayload.accountEmail}: ${attentionItems.length} messages ingested, ${repliesDue.length} replies recommended, ${scanPayload.metrics.deadlines} deadlines flagged. Zero emails were sent or altered.`,
      data: scanPayload,
    }, 200, request);
  } catch (err: any) {
    console.error('Email scan error:', err);
    return jsonResponse({
      error: err.message || 'Internal server error during email scan',
    }, 500, request);
  }
});
