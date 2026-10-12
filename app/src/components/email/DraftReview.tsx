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
} from '../../lib/email/draftReview';
import { useDraftSession, seedFromReplyDraft, fingerprintInputOf } from '../../lib/email/draftSession';
import { AccountBadge, ConfidenceChip, Field } from './viewPrimitives';

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
      </div>

      <p className="ecc-draft-footnote ecc-draft-final">
        Nothing on this screen sends an email. There is no send control in this module, and no code
        that could send one.
      </p>
    </section>
  );
};
