import {
  corsHeaders,
  createServiceClient,
  getNangoHost,
  getNangoSecretKey,
  jsonResponse,
  optionsResponse,
  requireUser,
  writeAuditEvent,
} from './nango-common.ts';
import { getOrRefreshAccessToken } from './native-oauth.ts';

interface SendDraftRequest {
  connection_id: string;
  thread_id?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  approval_id: string;
  approval_confirmed: boolean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as SendDraftRequest;

    const connectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : '';
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const content = typeof body.body === 'string' ? body.body.trim() : '';
    const approvalId = typeof body.approval_id === 'string' ? body.approval_id.trim() : '';
    const approvalConfirmed = Boolean(body.approval_confirmed);

    if (!connectionId) {
      return jsonResponse({ error: 'connection_id is required' }, 400, request);
    }

    if (!to) {
      return jsonResponse({ error: 'Recipient address (to) is required' }, 400, request);
    }

    if (!content) {
      return jsonResponse({ error: 'Message body is required' }, 400, request);
    }

    if (!approvalId) {
      return jsonResponse({
        error: 'Approval ID is required. Every email send requires an explicit approval record in the Concludo Approval Centre.',
      }, 403, request);
    }

    if (!approvalConfirmed) {
      return jsonResponse({
        error: 'Explicit human approval is required to send this email. Concludo proposes; a person disposes.',
      }, 403, request);
    }

    const service = createServiceClient();

    // 1. Verify authoritative approval record in workflow_approvals
    const { data: approvalRecord, error: appErr } = await service
      .from('workflow_approvals')
      .select('id, requester_id, approver_id, status, action_type, action_payload, created_at, approved_at, deleted_at')
      .eq('id', approvalId)
      .eq('requester_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (appErr || !approvalRecord) {
      return jsonResponse({
        error: 'Authoritative approval record not found or already consumed.',
      }, 403, request);
    }

    if (approvalRecord.status !== 'approved' || approvalRecord.action_type !== 'send_email') {
      return jsonResponse({
        error: 'Invalid approval record status. Concludo proposes; a person disposes.',
      }, 403, request);
    }

    const approvedTimestamp = new Date(approvalRecord.approved_at || approvalRecord.created_at).getTime();
    if (Date.now() - approvedTimestamp > 15 * 60 * 1000) {
      return jsonResponse({
        error: 'Approval expired. Approvals must be executed within 15 minutes of human confirmation.',
      }, 403, request);
    }

    const payload = (approvalRecord.action_payload || {}) as Record<string, any>;
    if (payload.connection_id !== connectionId || payload.to !== to || payload.subject !== subject) {
      return jsonResponse({
        error: 'Approval payload mismatch. The email parameters do not match what was approved.',
      }, 403, request);
    }

    // 2. Verify connection ownership, tenant isolation, and status
    const { data: connection, error: connErr } = await service
      .from('integration_connections')
      .select('id, user_id, organization_id, provider_id, nango_connection_id, nango_integration_id, auth_mode, status, account_label, external_account_reference, granted_scopes')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (connErr || !connection) {
      return jsonResponse({ error: 'Connection not found or unauthorized' }, 404, request);
    }

    if (connection.status !== 'connected') {
      return jsonResponse({
        error: 'Mailbox is not connected. Please reconnect in Settings > Integrations.',
        status: connection.status,
      }, 400, request);
    }

    // 3. Verify granted send permissions on connection
    const scopes = Array.isArray(connection.granted_scopes) ? connection.granted_scopes : [];
    if (connection.provider_id === 'gmail') {
      const hasScope = scopes.some((s: string) => s.includes('gmail.send') || s.includes('https://www.googleapis.com/auth/gmail.send'));
      if (!hasScope) {
        return jsonResponse({
          error: 'Connected Gmail mailbox lacks "gmail.send" permission. Please re-authenticate your mailbox in Settings > Integrations to grant send permissions.',
        }, 403, request);
      }
    } else if (connection.provider_id === 'microsoft_outlook') {
      const hasScope = scopes.some((s: string) => s === 'Mail.Send' || s.toLowerCase() === 'mail.send');
      if (!hasScope) {
        return jsonResponse({
          error: 'Connected Outlook mailbox lacks "Mail.Send" permission. Please re-authenticate your mailbox in Settings > Integrations to grant send permissions.',
        }, 403, request);
      }
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

    const providerId = connection.provider_id;
    let providerMessageId = '';

    // 2. Dispatch Send Request
    if (providerId === 'gmail') {
      // Build RFC 2822 email message
      const emailLines: string[] = [
        `To: ${to}`,
      ];
      if (body.cc) emailLines.push(`Cc: ${body.cc}`);
      if (body.bcc) emailLines.push(`Bcc: ${body.bcc}`);
      emailLines.push(`Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`);
      emailLines.push('MIME-Version: 1.0');
      emailLines.push('Content-Type: text/plain; charset=UTF-8');
      emailLines.push('Content-Transfer-Encoding: 7bit');
      emailLines.push('');
      emailLines.push(content);

      const rawEmail = emailLines.join('\r\n');
      // URL-safe base64 encoding without padding
      const rawBase64 = btoa(unescape(encodeURIComponent(rawEmail)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sendUrl = isNative
        ? 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
        : `${nangoHost}/proxy/gmail/v1/users/me/messages/send`;

      const sendHeaders: Record<string, string> = isNative
        ? {
            'Authorization': `Bearer ${nativeToken}`,
            'Content-Type': 'application/json',
          }
        : {
            ...proxyHeaders,
            'Content-Type': 'application/json',
            'Base-Url-Override': 'https://gmail.googleapis.com',
          };

      const sendRes = await fetch(sendUrl, {
        method: 'POST',
        headers: sendHeaders,
        body: JSON.stringify({ raw: rawBase64 }),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text().catch(() => '');
        console.error('Gmail send failed:', sendRes.status, errText);
        return jsonResponse({
          error: `Gmail sending failed (${sendRes.status}): ${errText || 'Provider rejected request'}`,
        }, 502, request);
      }

      const sendData = await sendRes.json();
      providerMessageId = sendData.id || '';
    } else if (providerId === 'microsoft_outlook') {
      // Build Microsoft Graph sendMail payload
      const recipientList = to.split(',').map((addr) => ({
        emailAddress: { address: addr.trim() },
      })).filter(r => Boolean(r.emailAddress.address));

      const ccList = (body.cc ? body.cc.split(',') : []).map((addr) => ({
        emailAddress: { address: addr.trim() },
      })).filter(r => Boolean(r.emailAddress.address));

      const bccList = (body.bcc ? body.bcc.split(',') : []).map((addr) => ({
        emailAddress: { address: addr.trim() },
      })).filter(r => Boolean(r.emailAddress.address));

      const graphPayload = {
        message: {
          subject,
          body: {
            contentType: 'Text',
            content,
          },
          toRecipients: recipientList,
          ccRecipients: ccList,
          bccRecipients: bccList,
        },
        saveToSentItems: true,
      };

      const sendUrl = isNative
        ? 'https://graph.microsoft.com/v1.0/me/sendMail'
        : `${nangoHost}/proxy/v1.0/me/sendMail`;

      const sendHeaders: Record<string, string> = isNative
        ? {
            'Authorization': `Bearer ${nativeToken}`,
            'Content-Type': 'application/json',
          }
        : {
            ...proxyHeaders,
            'Content-Type': 'application/json',
          };

      const sendRes = await fetch(sendUrl, {
        method: 'POST',
        headers: sendHeaders,
        body: JSON.stringify(graphPayload),
      });

      if (!sendRes.ok && sendRes.status !== 202) {
        const errText = await sendRes.text().catch(() => '');
        console.error('Outlook sendMail failed:', sendRes.status, errText);
        return jsonResponse({
          error: `Microsoft Outlook sending failed (${sendRes.status}): ${errText || 'Provider rejected request'}`,
        }, 502, request);
      }

      providerMessageId = `graph-${Date.now()}`;
    } else {
      return jsonResponse({
        error: `Provider ${providerId} does not support sending emails.`,
      }, 400, request);
    }

    // 3. Write Audit Event
    const senderAddress = connection.account_label || connection.external_account_reference || user.email;

    // Mark approval record as consumed (single-use)
    await service
      .from('workflow_approvals')
      .update({
        status: 'completed',
        notes: `Dispatched via ${providerId} (${senderAddress}) at ${new Date().toISOString()}`,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', approvalId);

    await writeAuditEvent(service, {
      connection_id: connection.id,
      provider_id: providerId,
      user_id: user.id,
      organization_id: connection.organization_id,
      event_type: 'action_succeeded',
      metadata: {
        action: 'send_email',
        recipient: to,
        sender: senderAddress,
        subject,
        messageId: providerMessageId,
      },
    });

    return jsonResponse({
      success: true,
      messageId: providerMessageId,
      sentAt: new Date().toISOString(),
      summary: `Email sent to ${to} via connected mailbox (${senderAddress}).`,
    }, 200, request);
  } catch (err: any) {
    console.error('Email send error:', err);
    return jsonResponse({
      error: err.message || 'Internal server error during email dispatch',
    }, 500, request);
  }
});
