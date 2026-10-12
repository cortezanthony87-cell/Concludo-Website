/**
 * The centre column: the original conversation, in order.
 *
 * Two things here carry weight beyond their size.
 *
 * **Quoted history is collapsed by default and is visually separate.** It is
 * held in its own field on the message rather than concatenated into the body,
 * so a long thread stays readable and so no extraction can cite quoted text as
 * though the sender had written it fresh.
 *
 * **Source highlighting marks the body, never the quoted history.** When a
 * person selects an extracted action or deadline on the right, the message it
 * came from is marked and the exact words are highlighted inside it. Where a
 * quote was recorded but cannot be located, the message is still marked and the
 * pane says the words could not be pinpointed, rather than highlighting nothing
 * and looking broken.
 */
import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Paperclip, ShieldAlert, Reply } from 'lucide-react';
import { EmailMessage, Attachment } from '../../lib/email/model';
import { SourceLocation } from '../../lib/email/threadIntelligence';
import { AccountBadge, formatDayTime } from './viewPrimitives';
import { SAFETY_STATEMENTS } from '../../lib/email/draftReview';

interface Props {
  messages: readonly EmailMessage[];
  attachments: readonly Attachment[];
  accountType: 'work' | 'personal';
  accountLabel: string;
  /** The locations currently selected on the right, or an empty list. */
  highlights: readonly SourceLocation[];
  /** What was selected, for the heading above the conversation. */
  selectionLabel: string | null;
  onClearSelection: () => void;
}

export const ConversationPane: React.FC<Props> = ({
  messages,
  attachments,
  accountType,
  accountLabel,
  highlights,
  selectionLabel,
  onClearSelection,
}) => {
  const paneRef = useRef<HTMLDivElement>(null);
  const firstHighlighted = highlights[0]?.messageId ?? null;

  // Scrolling the first marked message into view is the thing that makes source
  // navigation feel like navigation rather than a colour change somewhere below
  // the fold.
  useEffect(() => {
    if (!firstHighlighted || !paneRef.current) return;
    const target = paneRef.current.querySelector(`#ecc-msg-${CSS.escape(firstHighlighted)}`);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [firstHighlighted, highlights]);

  return (
    <div className="ecc-conversation" ref={paneRef}>
      <div className="ecc-conversation-head">
        <h3 className="ecc-column-title" id="ecc-conversation-heading">
          Original conversation
        </h3>
        <p className="ecc-column-note">
          {messages.length} message{messages.length === 1 ? '' : 's'}, oldest first. This is the
          email as it arrived, not a summary of it.
        </p>
        {selectionLabel ? (
          <div className="ecc-selection-banner" role="status">
            <p className="ecc-selection-text">
              Showing the source of: <strong>{selectionLabel}</strong>
            </p>
            <button type="button" className="ecc-text-button" onClick={onClearSelection}>
              Clear highlight
            </button>
          </div>
        ) : null}
      </div>

      <ol className="ecc-message-list" aria-labelledby="ecc-conversation-heading">
        {messages.map((message) => {
          const marks = highlights.filter((h) => h.messageId === message.id);
          const isSource = marks.length > 0;
          return (
            <MessageBlock
              key={message.id}
              message={message}
              attachments={attachments}
              accountType={accountType}
              accountLabel={accountLabel}
              marks={marks}
              isSource={isSource}
            />
          );
        })}
      </ol>
    </div>
  );
};

const MessageBlock: React.FC<{
  message: EmailMessage;
  attachments: readonly Attachment[];
  accountType: 'work' | 'personal';
  accountLabel: string;
  marks: readonly SourceLocation[];
  isSource: boolean;
}> = ({ message, attachments, accountType, accountLabel, marks, isSource }) => {
  const [showQuoted, setShowQuoted] = React.useState(false);
  const sender = message.participants.find((p) => p.role === 'from');
  const to = message.participants.filter((p) => p.role === 'to');
  const cc = message.participants.filter((p) => p.role === 'cc');
  const own = attachments.filter((a) => message.attachmentIds.includes(a.id));
  const quoteNotFound = marks.some((m) => m.quoteNotFound);

  return (
    <li
      id={`ecc-msg-${message.id}`}
      className={`ecc-message ${isSource ? 'ecc-message-source' : ''} ${
        message.isFromSelf ? 'ecc-message-own' : ''
      }`}
      aria-current={isSource ? 'true' : undefined}
    >
      {isSource ? (
        <p className="ecc-source-flag">
          Source of the selected item
          {quoteNotFound ? '. The exact words could not be pinpointed in this message.' : ''}
        </p>
      ) : null}

      <div className="ecc-message-head">
        <div>
          <p className="ecc-message-sender">
            {message.isFromSelf ? 'You' : (sender?.displayName ?? 'Unknown sender')}
            <span className="ecc-message-address">
              {message.isFromSelf ? '' : ` ${sender?.address ?? ''}`}
            </span>
          </p>
          <p className="ecc-message-to">
            To {to.map((p) => (p.isSelf ? 'you' : p.displayName)).join(', ') || 'nobody listed'}
            {cc.length > 0
              ? `, copy to ${cc.map((p) => (p.isSelf ? 'you' : p.displayName)).join(', ')}`
              : ''}
          </p>
        </div>
        <div className="ecc-message-meta">
          <AccountBadge accountType={accountType} label={accountLabel} />
          <time className="ecc-message-time" dateTime={message.sentAt}>
            {formatDayTime(message.sentAt)}
          </time>
          {!message.isRead ? <span className="ecc-badge ecc-tone-attention">Unread</span> : null}
        </div>
      </div>

      {message.replyToAddress ? (
        <p className="ecc-message-replyto">
          <Reply size={12} aria-hidden="true" />A reply would go to {message.replyToAddress}, which
          is not the address this came from.
        </p>
      ) : null}

      {message.injection ? (
        <div className="ecc-warning ecc-warning-security" role="note">
          <p className="ecc-warning-head">
            <ShieldAlert size={14} aria-hidden="true" />
            Instructions aimed at an automated reader
          </p>
          <p className="ecc-warning-text">
            This message contains text written to instruct an email assistant rather than to address
            you. It tried to: {message.injection.attemptedInstruction} The text was read as content
            and not followed. It is shown below in full, unchanged.
          </p>
        </div>
      ) : null}

      <div className="ecc-message-body">{renderWithMarks(message.body, marks)}</div>

      {message.quotedHistory ? (
        <div className="ecc-quoted">
          <button
            type="button"
            className="ecc-quoted-toggle"
            aria-expanded={showQuoted}
            onClick={() => setShowQuoted((v) => !v)}
          >
            {showQuoted ? (
              <ChevronDown size={13} aria-hidden="true" />
            ) : (
              <ChevronRight size={13} aria-hidden="true" />
            )}
            {showQuoted ? 'Hide quoted history' : 'Show quoted history'}
            <span className="ecc-visually-hidden"> beneath this message</span>
          </button>
          {showQuoted ? (
            <>
              <p className="ecc-quoted-note">
                Earlier messages, quoted by the sender. Nothing is extracted from quoted text.
              </p>
              <pre className="ecc-quoted-body">{message.quotedHistory}</pre>
            </>
          ) : null}
        </div>
      ) : null}

      {own.length > 0 ? (
        <ul className="ecc-message-attachments" aria-label="Attachments on this message">
          {own.map((a) => (
            <li key={a.id}>
              <Paperclip size={12} aria-hidden="true" />
              <span className="ecc-attachment-name">{a.fileName}</span>
              <span className="ecc-attachment-size">
                {a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)} KB` : 'size unknown'}
              </span>
              {/* Never imply a file was read. Concludo sees that it exists. */}
              <span className="ecc-attachment-caveat">{SAFETY_STATEMENTS.attachmentNotReviewed}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
};

/**
 * Splits a body around the highlighted ranges.
 *
 * Ranges are sorted and merged first, because two extractions can cite
 * overlapping words and nested `<mark>` elements are announced oddly.
 */
function renderWithMarks(body: string, marks: readonly SourceLocation[]): React.ReactNode {
  const ranges = marks
    .filter((m): m is SourceLocation & { index: number; quote: string } => m.index !== null && m.quote !== null)
    .map((m) => ({ start: m.index, end: m.index + m.quote.length }))
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return body;

  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((range, i) => {
    if (range.start > cursor) parts.push(body.slice(cursor, range.start));
    parts.push(
      <mark key={`m-${i}`} className="ecc-source-mark">
        {body.slice(range.start, range.end)}
      </mark>
    );
    cursor = range.end;
  });
  if (cursor < body.length) parts.push(body.slice(cursor));

  return parts;
}
