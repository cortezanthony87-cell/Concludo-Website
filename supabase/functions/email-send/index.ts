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

interface DraftAttachment {
  name: string;
  type: string;
  size: number;
  contentBytes: string;
}

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
  attachments?: DraftAttachment[];
}

const MAX_ATTACHMENTS_COUNT = 10;
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB provider limit

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as SendDraftRequest;

    const connectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : '';
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const cc = typeof body.cc === 'string' ? body.cc.trim() : '';
    const bcc = typeof body.bcc === 'string' ? body.bcc.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const content = typeof body.body === 'string' ? body.body.trim() : '';
    const approvalId = typeof body.approval_id === 'string' ? body.approval_id.trim() : '';
    const approvalConfirmed = Boolean(body.approval_confirmed);
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!connectionId) {
      return jsonResponse({ error: 'Explicit connection_id is required. Sender mailbox must be chosen directly.' }, 400, request);
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

    if (attachments.length > MAX_ATTACHMENTS_COUNT) {
      return jsonResponse({
        error: `Maximum ${MAX_ATTACHMENTS_COUNT} attachments permitted per email.`,
      }, 400, request);
    }

    let totalAttachmentBytes = 0;
    for (const att of attachments) {
      if (!att.name || typeof att.name !== 'string') {
        return jsonResponse({ error: 'All attachments must have a valid name.' }, 400, request);
      }
      if (typeof att.contentBytes !== 'string') {
        return jsonResponse({ error: `Attachment ${att.name} has invalid content bytes.` }, 400, request);
      }
      totalAttachmentBytes += att.size || att.contentBytes.length;
    }

    if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return jsonResponse({
        error: `Total attachment size exceeds 25 MB limit (${Math.round(totalAttachmentBytes / (1024 * 1024))} MB provided).`,
      }, 400, request);
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
    if (
      payload.connection_id !== connectionId ||
      payload.to !== to ||
      payload.subject !== subject ||
      (payload.cc || '') !== cc ||
      (payload.bcc || '') !== bcc
    ) {
      return jsonResponse({
        error: 'Approval payload mismatch. The email parameters do not match what was approved.',
      }, 403, request);
    }

    // 2. Strict mailbox resolution: Require explicit connection ownership, no fallback
    const { data: connection, error: connErr } = await service
      .from('integration_connections')
      .select('id, user_id, organization_id, provider_id, nango_connection_id, nango_integration_id, auth_mode, status, account_label, external_account_reference, granted_scopes')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (connErr || !connection) {
      return jsonResponse({
        error: 'Connected mailbox connection not found for this account. Silent mailbox fallback is strictly forbidden.',
      }, 404, request);
    }

    if (connection.status !== 'connected') {
      return jsonResponse({
        error: `Mailbox is ${connection.status}. Please reconnect in Settings > Integrations.`,
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
    } else {
      return jsonResponse({
        error: `Provider ${connection.provider_id} does not support sending emails.`,
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

    const providerId = connection.provider_id;
    let providerMessageId = '';

    // 4. Dispatch Send Request
    if (providerId === 'gmail') {
      let rawBase64 = '';
      if (attachments.length > 0) {
        const boundary = `===============_Concludo_${Date.now()}==`;
        const emailLines: string[] = [
          `To: ${to}`,
        ];
        if (cc) emailLines.push(`Cc: ${cc}`);
        if (bcc) emailLines.push(`Bcc: ${bcc}`);
        emailLines.push(`Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`);
        emailLines.push('MIME-Version: 1.0');
        emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        emailLines.push('');
        emailLines.push(`--${boundary}`);
        emailLines.push('Content-Type: text/plain; charset=UTF-8');
        emailLines.push('Content-Transfer-Encoding: 7bit');
        emailLines.push('');
        emailLines.push(content);

        for (const att of attachments) {
          emailLines.push('');
          emailLines.push(`--${boundary}`);
          emailLines.push(`Content-Type: ${att.type || 'application/octet-stream'}; name="${att.name}"`);
          emailLines.push('Content-Transfer-Encoding: base64');
          emailLines.push(`Content-Disposition: attachment; filename="${att.name}"`);
          emailLines.push('');
          emailLines.push(att.contentBytes);
        }
        emailLines.push('');
        emailLines.push(`--${boundary}--`);

        const rawEmail = emailLines.join('\r\n');
        rawBase64 = btoa(unescape(encodeURIComponent(rawEmail)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      } else {
        const emailLines: string[] = [
          `To: ${to}`,
        ];
        if (cc) emailLines.push(`Cc: ${cc}`);
        if (bcc) emailLines.push(`Bcc: ${bcc}`);
        emailLines.push(`Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`);
        emailLines.push('MIME-Version: 1.0');
        emailLines.push('Content-Type: text/plain; charset=UTF-8');
        emailLines.push('Content-Transfer-Encoding: 7bit');
        emailLines.push('');
        emailLines.push(content);

        const rawEmail = emailLines.join('\r\n');
        rawBase64 = btoa(unescape(encodeURIComponent(rawEmail)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      }

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
      const recipientList = to.split(',').map((addr) => ({
        emailAddress: { address: addr.trim() },
      })).filter(r => Boolean(r.emailAddress.address));

      const ccList = (cc ? cc.split(',') : []).map((addr) => ({
        emailAddress: { address: addr.trim() },
      })).filter(r => Boolean(r.emailAddress.address));

      const bccList = (bcc ? bcc.split(',') : []).map((addr) => ({
        emailAddress: { address: addr.trim() },
      })).filter(r => Boolean(r.emailAddress.address));

      const graphAttachments = attachments.map((att) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.type || 'application/octet-stream',
        contentBytes: att.contentBytes,
      }));

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
          ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {}),
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
    }

    // 5. Consume approval record atomically (single-use)
    const senderAddress = connection.account_label || connection.external_account_reference || user.email;

    await service
      .from('workflow_approvals')
      .update({
        status: 'completed',
        notes: `Dispatched via ${providerId} (${senderAddress}) at ${new Date().toISOString()}`,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', approvalId);

    // 6. Write secure audit log
    await writeAuditEvent({
      event_type: 'email_draft_sent',
      user_id: user.id,
      organization_id: connection.organization_id || undefined,
      actor_id: user.id,
      actor_email: user.email,
      provider_id: providerId,
      connection_id: connection.id,
      metadata: {
        approval_id: approvalId,
        provider_message_id: providerMessageId,
        sender_address: senderAddress,
        recipient_to: to,
        has_cc: Boolean(cc),
        has_bcc: Boolean(bcc),
        subject,
        attachments_count: attachments.length,
        total_attachment_bytes: totalAttachmentBytes,
      },
    });

    return jsonResponse({
      success: true,
      messageId: providerMessageId,
      sentAt: new Date().toISOString(),
      summary: `Email successfully sent to ${to} via ${senderAddress}.`,
    }, 200, request);
  } catch (err: any) {
    console.error('email-send error:', err);
    return jsonResponse({
      error: err.message || 'Internal server error processing email dispatch',
    }, 500, request);
  }
});
