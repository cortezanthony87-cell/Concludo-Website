import React, { useRef, useState, useMemo } from 'react';
import {
  Send,
  Edit3,
  Paperclip,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { ThreadRecord } from '../../lib/email/filters';
import { ReplyDraft, DraftStyle, DRAFT_STYLE_LABEL } from '../../lib/email/model';
import {
  AccountBadge,
  DraftChip,
  ConfidenceChip,
  Field,
  formatDayTime,
} from './viewPrimitives';
import { ItemActions } from './ItemActions';
import { sendDraftEmail, DraftAttachment } from '../../lib/email/sendClient';

interface Props {
  record: ThreadRecord;
  draft: ReplyDraft;
  bodyForStyle: string | null;
  accountLabel: string;
  accountType: 'work' | 'personal';
  linkTo: (threadId: string) => string;
  style: DraftStyle;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DraftCardItem: React.FC<Props> = ({
  record: r,
  draft,
  bodyForStyle,
  accountLabel,
  accountType,
  linkTo,
  style,
}) => {
  const headingId = `ecc-draft-${r.thread.id}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialTo = useMemo(() => {
    if (draft.recipients.length > 0) {
      return draft.recipients
        .filter((p) => p.role === 'to')
        .map((p) => (p.address ? `${p.displayName} <${p.address}>` : p.displayName))
        .join(', ');
    }
    return r.counterpartyAddress
      ? `${r.counterpartyName} <${r.counterpartyAddress}>`
      : r.counterpartyName;
  }, [draft, r]);

  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState(r.thread.subject);
  const [toAddress, setToAddress] = useState(initialTo);
  const [ccAddress, setCcAddress] = useState('');
  const [bccAddress, setBccAddress] = useState('');
  const [body, setBody] = useState(bodyForStyle || '');
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
    sentAt?: string;
  } | null>(null);

  // Keep body in sync if style changes and user has not edited yet
  const [hasManuallyEdited, setHasManuallyEdited] = useState(false);
  React.useEffect(() => {
    if (!hasManuallyEdited && bodyForStyle) {
      setBody(bodyForStyle);
    }
  }, [bodyForStyle, hasManuallyEdited]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            contentBytes: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    // Reset input so re-selecting the same file works
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendConfirm = async () => {
    setIsSending(true);
    setSendResult(null);
    try {
      // Parse clean destination email address
      let cleanTo = toAddress.trim();
      const match = cleanTo.match(/<([^>]+)>/);
      if (match) {
        cleanTo = match[1];
      }

      const res = await sendDraftEmail({
        connectionId: r.thread.accountId,
        to: cleanTo,
        cc: ccAddress.trim() || undefined,
        bcc: bccAddress.trim() || undefined,
        subject,
        body,
        approvalConfirmed: true,
        threadId: r.thread.id,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setSendResult({
        success: true,
        message: res.summary || `Dispatched to ${cleanTo} via connected mailbox (${accountLabel}).`,
        messageId: res.messageId,
        sentAt: res.sentAt,
      });
      setIsSendModalOpen(false);
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Failed to dispatch email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <li className="content-card ecc-card" aria-labelledby={headingId}>
      <div className="ecc-card-top">
        <div className="ecc-card-identity">
          <p className="ecc-card-sender">{r.counterpartyName}</p>
          <h3 id={headingId} className="ecc-card-subject">
            {subject}
          </h3>
        </div>
        <div className="ecc-card-badges">
          <AccountBadge accountType={accountType} label={accountLabel} />
          <DraftChip status={draft.status} />
        </div>
      </div>

      {sendResult ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            margin: '12px 0',
            fontSize: '13px',
            backgroundColor: sendResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${sendResult.success ? '#22c55e' : '#ef4444'}`,
            color: sendResult.success ? '#4ade80' : '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          role={sendResult.success ? 'status' : 'alert'}
        >
          {sendResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{sendResult.message}</span>
        </div>
      ) : null}

      {bodyForStyle ? (
        <>
          {isEditing ? (
            <div
              className="ecc-edit-block"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '16px',
                margin: '12px 0',
              }}
            >
              <label className="ecc-control-label" htmlFor={`ecc-subject-${r.thread.id}`}>
                Subject
              </label>
              <input
                id={`ecc-subject-${r.thread.id}`}
                className="ecc-input"
                style={{ width: '100%', marginBottom: '10px' }}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setHasManuallyEdited(true);
                }}
              />

              <label className="ecc-control-label" htmlFor={`ecc-to-${r.thread.id}`}>
                To (Recipient email)
              </label>
              <input
                id={`ecc-to-${r.thread.id}`}
                className="ecc-input"
                style={{ width: '100%', marginBottom: '10px' }}
                value={toAddress}
                onChange={(e) => {
                  setToAddress(e.target.value);
                  setHasManuallyEdited(true);
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label className="ecc-control-label" htmlFor={`ecc-cc-${r.thread.id}`}>
                    Cc (Optional)
                  </label>
                  <input
                    id={`ecc-cc-${r.thread.id}`}
                    className="ecc-input"
                    style={{ width: '100%' }}
                    value={ccAddress}
                    onChange={(e) => setCcAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="ecc-control-label" htmlFor={`ecc-bcc-${r.thread.id}`}>
                    Bcc (Optional)
                  </label>
                  <input
                    id={`ecc-bcc-${r.thread.id}`}
                    className="ecc-input"
                    style={{ width: '100%' }}
                    value={bccAddress}
                    onChange={(e) => setBccAddress(e.target.value)}
                  />
                </div>
              </div>

              <label className="ecc-control-label" htmlFor={`ecc-body-${r.thread.id}`}>
                Message Body
              </label>
              <textarea
                id={`ecc-body-${r.thread.id}`}
                className="ecc-textarea"
                rows={6}
                style={{ width: '100%', fontFamily: 'Inter, sans-serif' }}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setHasManuallyEdited(true);
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: '13px', padding: '6px 12px' }}
                  onClick={() => setIsEditing(false)}
                >
                  <Check size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Done editing
                </button>
              </div>
            </div>
          ) : (
            <>
              {toAddress ? (
                <Field label="Would go to">
                  <span>{toAddress}</span>
                  {ccAddress ? <span style={{ marginLeft: '8px', opacity: 0.8 }}>(Cc: {ccAddress})</span> : null}
                </Field>
              ) : null}

              <p className="ecc-draft-style-note">
                {hasManuallyEdited ? 'Custom edited version' : `${DRAFT_STYLE_LABEL[style]} version`}
              </p>

              <pre
                className="ecc-draft-body"
                tabIndex={0}
                aria-label={`Proposed reply to ${subject}`}
              >
                {body}
              </pre>
            </>
          )}

          {/* Attachments Section */}
          <div style={{ margin: '12px 0' }}>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {attachments.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <span className="ecc-field-label" style={{ display: 'block', marginBottom: '6px' }}>
                  Attachments ({attachments.length}):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {attachments.map((att, idx) => (
                    <span
                      key={`${att.name}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        border: '1px solid #334155',
                      }}
                    >
                      <Paperclip size={12} style={{ color: '#e2b53c' }} />
                      <span>{att.name}</span>
                      <span style={{ opacity: 0.6, fontSize: '11px' }}>({formatBytes(att.size)})</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0 2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                        title="Remove attachment"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {draft.commitmentsInDraft.length > 0 ? (
            <Field label="What this commits you to">
              <ul className="ecc-reason-list ecc-commitments">
                {draft.commitmentsInDraft.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Field>
          ) : null}
        </>
      ) : (
        <p className="ecc-draft-withheld">{draft.statusReason}</p>
      )}

      {draft.missingInformation.length > 0 ? (
        <Field label="Needed before this can be written">
          <ul className="ecc-reason-list">
            {draft.missingInformation.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Field>
      ) : null}

      {draft.factsToVerify.length > 0 ? (
        <Field label="Check before using">
          <ul className="ecc-reason-list">
            {draft.factsToVerify.map((f) => (
              <li key={f.id}>
                <strong>{f.claim}</strong> {f.howToVerify}
              </li>
            ))}
          </ul>
        </Field>
      ) : null}

      <div className="ecc-card-meta">
        <ConfidenceChip confidence={r.analysis.confidence} what="this draft" />
        <span className="ecc-attach-chip">Prepared {formatDayTime(draft.createdAt)}</span>
        <span className="ecc-attach-chip">
          {sendResult?.success ? 'Dispatched' : hasManuallyEdited ? 'Edited by you' : 'Draft ready for review'}
        </span>
      </div>

      {/* Action Buttons: Edit, Attach, Send */}
      {bodyForStyle && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: isEditing ? '#334155' : undefined,
            }}
            onClick={() => setIsEditing((v) => !v)}
          >
            <Edit3 size={14} />
            <span>{isEditing ? 'Close editor' : 'Edit draft'}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '7px 12px',
              borderRadius: '8px',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={14} />
            <span>Attach files{attachments.length > 0 ? ` (${attachments.length})` : ''}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '7px 16px',
              borderRadius: '8px',
              backgroundColor: sendResult?.success ? '#166534' : '#e2b53c',
              color: sendResult?.success ? '#ffffff' : '#090d16',
              fontWeight: 700,
              cursor: isSending || sendResult?.success ? 'default' : 'pointer',
            }}
            disabled={isSending || Boolean(sendResult?.success)}
            onClick={() => setIsSendModalOpen(true)}
          >
            {sendResult?.success ? (
              <>
                <Check size={14} /> Sent
              </>
            ) : isSending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send size={14} /> Send email
              </>
            )}
          </button>
        </div>
      )}

      <ItemActions
        threadId={r.thread.id}
        subject={r.thread.subject}
        linkTo={linkTo}
        recommendedNextStep={r.analysis.recommendedNextStep}
        draftAvailable={draft.status === 'available'}
      />

      {/* Approval Centre Gate Modal */}
      {isSendModalOpen && (
        <div
          className="ecc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            className="ecc-modal-dialog"
            style={{
              backgroundColor: '#0b1120',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} style={{ color: '#e2b53c' }} />
                Approval Centre Gate
              </h3>
              <button
                type="button"
                onClick={() => setIsSendModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                backgroundColor: '#111c30',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div><strong>Sending Mailbox:</strong> {accountLabel}</div>
              <div><strong>To:</strong> {toAddress}</div>
              {ccAddress ? <div><strong>Cc:</strong> {ccAddress}</div> : null}
              {bccAddress ? <div><strong>Bcc:</strong> {bccAddress}</div> : null}
              <div><strong>Subject:</strong> {subject}</div>
              {attachments.length > 0 ? (
                <div>
                  <strong>Attachments ({attachments.length}):</strong>{' '}
                  {attachments.map((a) => `${a.name} (${formatBytes(a.size)})`).join(', ')}
                </div>
              ) : null}
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Body preview:
              </div>
              <pre
                style={{
                  backgroundColor: '#070b14',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12.5px',
                  lineHeight: '1.5',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: '#e2e8f0',
                  margin: 0,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {body}
              </pre>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
              <strong>Concludo proposes; a person disposes.</strong> Outbound email dispatch occurs only upon your explicit human confirmation. Sending cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsSendModalOpen(false)}
                disabled={isSending}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSendConfirm}
                disabled={isSending}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  backgroundColor: '#e2b53c',
                  color: '#090d16',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isSending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Confirm and Send Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
};
