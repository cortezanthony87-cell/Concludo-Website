import { getSupabaseBrowserClient } from '../supabase/client';

export interface DraftAttachment {
  name: string;
  type: string;
  size: number;
  contentBytes: string;
}

export interface SendDraftEmailParams {
  connectionId: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  approvalConfirmed: boolean;
  threadId?: string;
  fingerprint?: string;
  attachments?: DraftAttachment[];
}

export interface SendDraftEmailResult {
  success: boolean;
  messageId: string;
  sentAt: string;
  summary: string;
}

/**
 * Sends an explicitly approved draft through the user's connected mailbox.
 * Strictly enforces human authorization before invoking the backend edge function.
 */
export async function sendDraftEmail(params: SendDraftEmailParams): Promise<SendDraftEmailResult> {
  if (!params.approvalConfirmed) {
    throw new Error('Explicit human approval is required before an email can be sent. Concludo proposes; a person disposes.');
  }

  const supabase = getSupabaseBrowserClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error('You must be signed in to send an email.');
  }

  // Create authoritative approval record in workflow_approvals
  const { data: approval, error: approvalErr } = await supabase
    .from('workflow_approvals')
    .insert({
      requester_id: user.id,
      approver_id: user.id,
      status: 'approved',
      action_type: 'send_email',
      action_payload: {
        connection_id: params.connectionId,
        to: params.to,
        cc: params.cc || null,
        bcc: params.bcc || null,
        subject: params.subject,
        thread_id: params.threadId || null,
        fingerprint: params.fingerprint || null,
        attachments_count: params.attachments?.length || 0,
      },
      notes: 'Authorised in Concludo Approval Centre',
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (approvalErr || !approval) {
    throw new Error(`Failed to create authoritative approval record: ${approvalErr?.message || 'Database error'}`);
  }

  const { data, error } = await supabase.functions.invoke('email-send', {
    body: {
      connection_id: params.connectionId,
      approval_id: approval.id,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      approval_confirmed: params.approvalConfirmed,
      thread_id: params.threadId,
      attachments: params.attachments,
    },
  });

  if (error) {
    let msg = error.message;
    if (data && data.error) msg = data.error;
    throw new Error(msg || 'Failed to dispatch email');
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Email dispatch was unsuccessful');
  }

  return data as SendDraftEmailResult;
}
