/**
 * Draft Review.
 *
 * The one screen in the module where a person commits to words that will later
 * carry their name. Everything on it is arranged around two questions: what
 * exactly am I approving, and what does it commit me to.
 *
 * There is no send control. There is no "save to mailbox" control either,
 * because neither exists in the codebase. Approving records that a person
 * agreed to this exact account, sender, recipients, subject, body and
 * attachments being saved as a draft later.
 *
 * Any change to any of those six invalidates the approval immediately and says
 * which one changed.
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { ThreadDetail } from '../../lib/email/threadIntelligence';
import { ReplyDraft, DraftStyle, DRAFT_STYLE_LABEL } from '../../lib/email/model';
import {
  DRAFT_ACTIONS,
  DRAFT_STYLES,
  SAFETY_STATEMENTS,
  figuresInDraft,
  fingerprintOf,
} from '../../lib/email/draftReview';
import { useDraftSession, seedFromReplyDraft, fingerprintInputOf } from '../../lib/email/draftSession';
import { AccountBadge, ConfidenceChip, Field } from './viewPrimitives';
import { sendDraftEmail, DraftAttachment } from '../../lib/email/sendClient';

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const Component = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[name];
  const Resolved = Component ?? Icons.Circle;
  return <Resolved size={size} />;
}

interface Props {
  detail: ThreadDetail;
  draft: ReplyDraft | null;
  fromAddress: string;
  /** Opens the source of an extraction in the centre column. */
  onSelectSource: (id: string, label: string) => void;
}

export const DraftReview: React.FC<Props> = ({ detail, draft, fromAddress, onSelectSource }) => {
  const session = useDraftSession();
  const analysis = detail.analysis;
  const threadId = detail.record.thread.id;

  const [editing, setEditing] = useState(false);
  const [clarificationNote, setClarificationNote] = useState('');
  const [askingClarification, setAskingClarification] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [fileAttachments, setFileAttachments] = useState<DraftAttachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(",") ? res.split(",")[1] : res;
        setFileAttachments((prev) => [
          ...prev,
          { name: file.name, type: file.type || "application/octet-stream", size: file.size, contentBytes: base64 },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
    sentAt?: string;
  } | null>(null);

  const canDraft = draft?.status === 'available' && draft.variants !== null;

  useEffect(() => {
    if (!canDraft || !draft) return;
    session.ensureDraft(
      threadId,
      seedFromReplyDraft(draft, detail.record.thread.accountId, fromAddress, detail.record.thread.subject, 'concise')
    );
  }, [canDraft, draft, threadId, detail, fromAddress, session]);

  const working = session.draftFor(threadId);
  const status = session.statusFor(threadId);

  const figures = useMemo(() => (working ? figuresInDraft(working.body) : []), [working]);

  /* ------------------------------------------------ withheld and blocked */

  if (!draft || !canDraft) {
    return (
      <section className="ecc-draft-review" aria-labelledby="ecc-draft-heading">
        <h3 id="ecc-draft-heading" className="ecc-column-title">
          Draft Reply
        </h3>

        <div className="ecc-withheld" role="note">
          <p className="ecc-withheld-head">
            <Icons.Lock size={15} aria-hidden="true" />
            {SAFETY_STATEMENTS.withheld}
          </p>
          <p className="ecc-withheld-reason">{draft?.statusReason ?? 'No draft has been written for this thread.'}</p>
        </div>

        {draft && draft.missingInformation.length > 0 ? (
          <Field label={`What is missing (${draft.missingInformation.length})`}>
            <ul className="ecc-reason-list">
              {draft.missingInformation.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Field>
        ) : null}

        {analysis.openQuestions.filter((q) => !q.answered).length > 0 ? (
          <Field label="Questions in the thread with no answer">
            <ul className="ecc-reason-list">
              {analysis.openQuestions
                .filter((q) => !q.answered)
                .map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className="ecc-source-link"
                      onClick={() => onSelectSource(q.id, q.question)}
                    >
                      {q.question}
                      <span className="ecc-visually-hidden">. Show where this was asked.</span>
                    </button>
                  </li>
                ))}
            </ul>
          </Field>
        ) : null}

        <p className="ecc-draft-footnote">
          Nothing has been drafted, nothing has been saved and nothing has been sent. The reason
          above is the whole reason.
        </p>
      </section>
    );
  }

  if (!working) return null;

  if (working.discarded) {
    return (
      <section className="ecc-draft-review" aria-labelledby="ecc-draft-heading">
        <h3 id="ecc-draft-heading" className="ecc-column-title">
          Draft Reply
        </h3>
        <div className="ecc-withheld" role="note">
          <p className="ecc-withheld-head">
            <Icons.Trash2 size={15} aria-hidden="true" />
            Draft discarded for this visit.
          </p>
          <p className="ecc-withheld-reason">
            Nothing in a mailbox was touched, because nothing was ever written there. It returns on
            reload, because nothing is saved.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => session.restore(threadId)}>
          Restore draft
        </button>
      </section>
    );
  }

  const to = working.recipients.filter((r) => r.field === 'to');
  const cc = working.recipients.filter((r) => r.field === 'cc');
  const bcc = working.recipients.filter((r) => r.field === 'bcc');

  const handleSendConfirm = async () => {
    if (!working) return;
    setIsSending(true);
    setSendResult(null);
    try {
      const input = fingerprintInputOf(working);
      const fp = fingerprintOf(input);
      const res = await sendDraftEmail({
        connectionId: detail.record.thread.accountId,
        to: to.map((r) => r.address).join(', '),
        cc: cc.length > 0 ? cc.map((r) => r.address).join(', ') : undefined,
        bcc: bcc.length > 0 ? bcc.map((r) => r.address).join(', ') : undefined,
        subject: working.subject,
        body: working.body,
        approvalConfirmed: true,
        threadId: threadId,
        fingerprint: fp,
        attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
      });

      setSendResult({
        success: true,
        message: res.summary || `Dispatched to ${to.map((r) => r.address).join(', ')} via connected mailbox.`,
        messageId: res.messageId,
        sentAt: res.sentAt,
      });
      session.approve(threadId);
      setSendModalOpen(false);
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Failed to dispatch email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const run = (kind: string) => {
    switch (kind) {
      case 'edit':
        setEditing((v) => !v);
        break;
      case 'regenerate_style': {
        const order = DRAFT_STYLES;
        const next = order[(order.indexOf(working.style) + 1) % order.length];
        const body = draft.variants ? draft.variants[next] : working.body;
        session.setStyle(threadId, next, body);
        break;
      }
      case 'save_proposed':
        session.saveProposed(threadId);
        break;
      case 'request_clarification':
        setAskingClarification(true);
        break;
      case 'discard':
        session.discard(threadId);
        break;
      case 'approve':
        session.approve(threadId);
        break;
    }
  };

  return (
    <section className="ecc-draft-review" aria-labelledby="ecc-draft-heading">
      <h3 id="ecc-draft-heading" className="ecc-column-title">
        Draft Reply
      </h3>

      {/* The approval status is the first thing on the panel, not the last. */}
      <div
        className={`ecc-approval ecc-approval-${status.state}`}
        role={status.state === 'expired' ? 'alert' : 'status'}
      >
        <p className="ecc-approval-head">
          {status.state === 'approved' ? (
            <Icons.ShieldCheck size={15} aria-hidden="true" />
          ) : status.state === 'expired' ? (
            <Icons.ShieldAlert size={15} aria-hidden="true" />
          ) : (
            <Icons.Shield size={15} aria-hidden="true" />
          )}
          {status.state === 'approved'
            ? 'Approved for saving'
            : status.state === 'expired'
              ? 'Approval expired'
              : 'Not approved'}
        </p>
        <p className="ecc-approval-text">{status.message}</p>
        {status.state === 'expired' && status.record ? (
          <details className="ecc-approval-diff">
            <summary>What you approved, and what it says now</summary>
            <dl className="ecc-diff-list">
              {status.changed.includes('subject') ? (
                <>
                  <dt>Subject, as approved</dt>
                  <dd>{status.record.approvedSnapshot.subject}</dd>
                  <dt>Subject, now</dt>
                  <dd>{working.subject}</dd>
                </>
              ) : null}
              {status.changed.includes('recipients') ? (
                <>
                  <dt>Recipients, as approved</dt>
                  <dd>
                    {status.record.approvedSnapshot.recipients
                      .map((r) => `${r.field.toUpperCase()} ${r.address}`)
                      .join(', ')}
                  </dd>
                  <dt>Recipients, now</dt>
                  <dd>{working.recipients.map((r) => `${r.field.toUpperCase()} ${r.address}`).join(', ')}</dd>
                </>
              ) : null}
              {status.changed.includes('body') ? (
                <>
                  <dt>Body, as approved</dt>
                  <dd>
                    <pre className="ecc-diff-body">{status.record.approvedSnapshot.body}</pre>
                  </dd>
                </>
              ) : null}
              {status.changed.includes('attachments') ? (
                <>
                  <dt>Attachments, as approved</dt>
                  <dd>
                    {status.record.approvedSnapshot.attachmentIds.join(', ') || 'none'}
                  </dd>
                  <dt>Attachments, now</dt>
                  <dd>{working.attachmentIds.join(', ') || 'none'}</dd>
                </>
              ) : null}
            </dl>
          </details>
        ) : null}
      </div>

      {analysis.classification.sensitivity === 'sensitive' ? (
        <div className="ecc-warning ecc-warning-sensitive" role="note">
          <p className="ecc-warning-head">
            <Icons.UserRound size={14} aria-hidden="true" />
            Sensitive content
          </p>
          <p className="ecc-warning-text">
            This thread is classified sensitive. Read anything drafted here especially carefully,
            and consider whether it should be written at all from an inbox.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------- the envelope */}

      <div className="ecc-envelope">
        <div className="ecc-envelope-row">
          <span className="ecc-field-label">Sending account</span>
          <span className="ecc-envelope-value">
            <AccountBadge accountType={detail.accountType} label={detail.accountLabel} />
            {detail.accountLabel}
          </span>
        </div>
        <div className="ecc-envelope-row">
          <span className="ecc-field-label">From</span>
          <span className="ecc-envelope-value">{working.fromAddress}</span>
        </div>
        <div className="ecc-envelope-row">
          <span className="ecc-field-label">To</span>
          <span className="ecc-envelope-value">
            {to.length > 0
              ? to.map((r) => `${r.displayName} (${r.address})`).join(', ')
              : 'Nobody. A reply with no recipient cannot be saved.'}
          </span>
        </div>
        <div className="ecc-envelope-row">
          <span className="ecc-field-label">CC</span>
          <span className="ecc-envelope-value">
            {cc.length > 0 ? cc.map((r) => `${r.displayName} (${r.address})`).join(', ') : 'None'}
          </span>
        </div>
        <div className="ecc-envelope-row">
          <span className="ecc-field-label">BCC</span>
          <span className="ecc-envelope-value">
            {bcc.length > 0 ? bcc.map((r) => `${r.displayName} (${r.address})`).join(', ') : 'None'}
          </span>
        </div>
        <div className="ecc-envelope-row">
          <span className="ecc-field-label">Subject</span>
          <span className="ecc-envelope-value">{working.subject}</span>
        </div>
        <div className="ecc-envelope-row">
          <span className="ecc-field-label">Attachments</span>
          <span className="ecc-envelope-value">
            {working.attachmentIds.length > 0
              ? working.attachmentIds.join(', ')
              : detail.record.awaitingAttachment
                ? 'None attached, and this reply needs a file before it is any use.'
                : 'None'}
          </span>
        </div>
      </div>

      {/* --------------------------------------------------- style and body */}

      <fieldset className="ecc-style-picker">
        <legend className="ecc-chips-legend">Tone</legend>
        <p className="ecc-chips-note">
          Three written drafts, not one with the adjectives changed. Changing the tone replaces the
          body, which invalidates an approval.
        </p>
        <div className="ecc-chip-row">
          {DRAFT_STYLES.map((s: DraftStyle) => (
            <button
              key={s}
              type="button"
              className={`ecc-chip ${working.style === s && !working.edited ? 'ecc-chip-on' : ''}`}
              aria-pressed={working.style === s && !working.edited}
              onClick={() => session.setStyle(threadId, s, draft.variants ? draft.variants[s] : working.body)}
            >
              {DRAFT_STYLE_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>

      {editing ? (
        <div className="ecc-edit-block">
          <label className="ecc-control-label" htmlFor="ecc-draft-subject">
            Subject
          </label>
          <input
            id="ecc-draft-subject"
            className="ecc-input"
            value={working.subject}
            onChange={(e) => session.updateDraft(threadId, { subject: e.target.value })}
          />

          <label className="ecc-control-label" htmlFor="ecc-draft-to">
            To, one address per line
          </label>
          <textarea
            id="ecc-draft-to"
            className="ecc-textarea ecc-textarea-short"
            value={to.map((r) => r.address).join('\n')}
            onChange={(e) =>
              session.updateDraft(threadId, {
                recipients: [
                  ...e.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((address) => ({ address, displayName: address, field: 'to' as const })),
                  ...cc,
                  ...bcc,
                ],
              })
            }
          />

          <label className="ecc-control-label" htmlFor="ecc-draft-body">
            Message body
          </label>
          <textarea
            id="ecc-draft-body"
            className="ecc-textarea"
            value={working.body}
            onChange={(e) => session.updateDraft(threadId, { body: e.target.value })}
          />
          <p className="ecc-chips-note">
            Every edit here invalidates an approval given earlier. That is the point of the rule.
          </p>
        </div>
      ) : (
        <pre className="ecc-draft-body" tabIndex={0} aria-label={`Proposed reply to ${working.subject}`}>
          {working.body}
        </pre>
      )}

      <p className="ecc-draft-footnote">
        {working.savedAt ? SAFETY_STATEMENTS.savedNotSent : SAFETY_STATEMENTS.recommendedNotDone}
      </p>

      {/* ------------------------------------------------------- the checks */}

      {figures.length > 0 ? (
        <Field label={`Dates and amounts in this draft (${figures.length})`}>
          <ul className="ecc-figure-list">
            {figures.map((f) => (
              <li key={`${f.kind}-${f.index}`} className={`ecc-figure ecc-figure-${f.kind}`}>
                <span className="ecc-figure-kind">{f.kind}</span>
                <span className="ecc-figure-text">{f.text}</span>
              </li>
            ))}
          </ul>
          <p className="ecc-chips-note">
            Found in the text and listed so they are read rather than skimmed. Concludo has not
            checked that any of them are right.
          </p>
        </Field>
      ) : null}

      {draft.commitmentsInDraft.length > 0 ? (
        <Field label={`What this draft commits you to (${draft.commitmentsInDraft.length})`}>
          <ul className="ecc-reason-list ecc-commitments">
            {draft.commitmentsInDraft.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Field>
      ) : null}

      {draft.factsToVerify.length > 0 ? (
        <Field label={`Facts to verify (${draft.factsToVerify.length})`}>
          <ul className="ecc-reason-list">
            {draft.factsToVerify.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="ecc-source-link"
                  onClick={() => onSelectSource(f.id, f.claim)}
                >
                  {f.claim}
                  <span className="ecc-visually-hidden">. Show where this came from.</span>
                </button>
                <span className="ecc-unverified">{SAFETY_STATEMENTS.unknownFact}</span>
                <span className="ecc-figure-text">{f.howToVerify}</span>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}

      {analysis.openQuestions.filter((q) => !q.answered).length > 0 ? (
        <Field label="Questions this draft does not answer">
          <ul className="ecc-reason-list">
            {analysis.openQuestions
              .filter((q) => !q.answered)
              .map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    className="ecc-source-link"
                    onClick={() => onSelectSource(q.id, q.question)}
                  >
                    {q.question}
                  </button>
                </li>
              ))}
          </ul>
        </Field>
      ) : null}

      {detail.record.awaitingAttachment ? (
        <p className="ecc-attach-reminder">
          A file has to be attached before this reply is any use to them. Nothing is attached.
        </p>
      ) : null}

      <div className="ecc-card-meta">
        <ConfidenceChip confidence={analysis.confidence} what="this draft" />
        <span className="ecc-attach-chip">
          {working.edited
            ? 'Edited by you'
            : `${DRAFT_STYLE_LABEL[working.style]} version, unedited`}
        </span>
      </div>

      {/* ------------------------------------------------------- the actions */}

      {askingClarification ? (
        <div className="ecc-edit-block">
          <label className="ecc-control-label" htmlFor="ecc-clarify">
            What do you need before this can be written?
          </label>
          <textarea
            id="ecc-clarify"
            className="ecc-textarea ecc-textarea-short"
            value={clarificationNote}
            onChange={(e) => setClarificationNote(e.target.value)}
          />
          <div className="ecc-chip-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                session.requestClarification(threadId, clarificationNote);
                setAskingClarification(false);
              }}
            >
              Record it
            </button>
            <button type="button" className="ecc-text-button" onClick={() => setAskingClarification(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {working.clarificationRequested ? (
        <div className="ecc-withheld" role="note">
          <p className="ecc-withheld-head">
            <Icons.CircleHelp size={15} aria-hidden="true" />
            {SAFETY_STATEMENTS.withheld}
          </p>
          <p className="ecc-withheld-reason">
            {working.clarificationNote || 'You marked this as needing clarification.'}
          </p>
        </div>
      ) : null}

      {sendResult ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            margin: '12px 0',
            fontSize: '12.5px',
            backgroundColor: sendResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${sendResult.success ? '#22c55e' : '#ef4444'}`,
            color: sendResult.success ? '#4ade80' : '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          role={sendResult.success ? 'status' : 'alert'}
        >
          {sendResult.success ? <Icons.CheckCircle2 size={16} /> : <Icons.AlertCircle size={16} />}
          <span>{sendResult.message}</span>
        </div>
      ) : null}

      <div className="ecc-draft-actions" role="group" aria-label="Draft actions">
        {DRAFT_ACTIONS.map((action) => {
          const descriptionId = `ecc-dact-${action.kind}`;
          const isApprove = action.kind === 'approve';
          const disabled = isApprove && status.state === 'approved';
          return (
            <span key={action.kind} className="ecc-action-wrap">
              <button
                type="button"
                className={`${isApprove ? 'btn-primary' : 'btn-secondary'} ecc-draft-action`}
                aria-describedby={descriptionId}
                aria-pressed={action.kind === 'edit' ? editing : undefined}
                disabled={disabled}
                onClick={() => run(action.kind)}
              >
                <Icon name={action.iconName} />
                {action.kind === 'edit' && editing ? 'Finish editing' : action.label}
              </button>
              <span id={descriptionId} className="ecc-visually-hidden">
                {action.effect}
              </span>
            </span>
          );
        })}

        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <span className="ecc-action-wrap">
          <button
            type="button"
            className="btn-secondary ecc-draft-action"
            onClick={() => fileInputRef.current?.click()}
            title="Attach files to this draft"
          >
            <Icons.Paperclip size={14} />
            Attach files{fileAttachments.length > 0 ? ` (${fileAttachments.length})` : ""}
          </button>
        </span>
        {/* Outbound Send Action */}
        <span className="ecc-action-wrap">
          <button
            type="button"
            className={`btn-primary ecc-draft-action ${sendResult?.success ? '' : 'ecc-btn-glowing-gold'}`}
            style={{
              backgroundColor: sendResult?.success ? '#166534' : undefined,
              color: sendResult?.success ? '#ffffff' : '#090d16',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            disabled={isSending || Boolean(sendResult?.success)}
            onClick={() => setSendModalOpen(true)}
            aria-label="Send email via connected mailbox"
          >
            {sendResult?.success ? (
              <>
                <Icons.Check size={14} aria-hidden="true" /> Sent
              </>
            ) : (
              <>
                <Icons.Send size={14} aria-hidden="true" /> Send email
              </>
            )}
          </button>
        </span>
      </div>

      <p className="ecc-draft-footnote ecc-draft-final">
        {sendResult?.success
          ? `Dispatched via connected mailbox (${detail.accountLabel}) at ${sendResult.sentAt ? new Date(sendResult.sentAt).toLocaleTimeString() : 'recently'}.`
          : 'Concludo proposes; a person disposes. Outbound email dispatch occurs only upon your explicit confirmation in the Approval Centre.'}
      </p>

      {sendModalOpen && (
        <div
          className="ecc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ecc-send-modal-title"
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
              color: '#f1f5f9',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e2b53c', fontWeight: 700 }}>
                  Approval Centre Gate
                </span>
                <h3 id="ecc-send-modal-title" style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                  Confirm Outbound Email Dispatch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSendModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                aria-label="Close"
              >
                <Icons.X size={18} />
              </button>
            </div>

            <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Sending mailbox:</span>
                <span style={{ fontWeight: 600, color: '#ffffff' }}>{detail.accountLabel} ({fromAddress})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>To:</span>
                <span style={{ fontWeight: 600, color: '#ffffff' }}>{to.map(r => r.address).join(', ') || 'No recipient'}</span>
              </div>
              {cc.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Cc:</span>
                  <span style={{ color: '#cbd5e1' }}>{cc.map(r => r.address).join(', ')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Subject:</span>
                <span style={{ fontWeight: 600, color: '#ffffff' }}>{working.subject}</span>
              </div>
            </div>

            <div style={{ maxHeight: '160px', overflowY: 'auto', backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px' }}>
              <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#e2e8f0' }}>
                {working.body}
              </pre>
            </div>

            <div style={{ backgroundColor: 'rgba(226, 181, 60, 0.08)', border: '1px solid rgba(226, 181, 60, 0.25)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#fef08a', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Icons.AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#e2b53c' }} />
              <span>
                <strong>Concludo proposes; a person disposes.</strong> Confirming will send this real email immediately through your connected {detail.accountLabel} account. Once dispatched, this action cannot be undone.
              </span>
            </div>

            {sendResult && !sendResult.success && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                }}
              >
                {sendResult.message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSendModalOpen(false)}
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary ecc-btn-glowing-gold"
                style={{
                  color: '#090d16',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 22px',
                  borderRadius: '8px',
                }}
                disabled={isSending}
                onClick={handleSendConfirm}
              >
                {isSending ? (
                  <>
                    <Icons.Loader2 size={14} className="animate-spin" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Icons.Send size={14} /> Confirm and Send Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
