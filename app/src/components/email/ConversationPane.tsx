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
import { ChevronDown, ChevronRight, Paperclip, ShieldAlert, Reply, Maximize2, Minimize2, Eye } from 'lucide-react';
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
  isFullView?: boolean;
  onToggleFullView?: () => void;
}

export const ConversationPane: React.FC<Props> = ({
  messages,
  attachments,
  accountType,
  accountLabel,
  highlights,
  selectionLabel,
  onClearSelection,
  isFullView,
  onToggleFullView,
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
        <h3 className="ecc-column-title" id="ecc-conversation-heading" style={{ margin: 0, marginBottom: '4px' }}>
          Original conversation
        </h3>
        <p className="ecc-column-note">
          {messages.length} message{messages.length === 1 ? '' : 's'}, oldest first. This is the
          email as it arrived, not a summary of it.
        </p>
        {messages[0]?.subject && (
          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
              {decodeHtmlEntities(messages[0].subject)}
            </h2>
          </div>
        )}
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
              isFullView={isFullView}
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
  isFullView?: boolean;
}> = ({ message, attachments, accountType, accountLabel, marks, isSource, isFullView }) => {
  const [showQuoted, setShowQuoted] = React.useState(false);
  const sender = message.participants.find((p) => p.role === 'from');
  const to = message.participants.filter((p) => p.role === 'to');
  const cc = message.participants.filter((p) => p.role === 'cc');
  const own = attachments.filter((a) => message.attachmentIds.includes(a.id) || a.source?.some((s) => s.threadId === message.threadId || s.messageId === message.id));
  const quoteNotFound = marks.some((m) => m.quoteNotFound);
  const isHtmlBody = /<(?:p|div|br|span|table|tr|td|ul|ol|li|b|strong|i|em|h[1-6]|a|html|body)\b/i.test(message.body);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #21395C, #16263F)',
              border: '1.5px solid #E2B53C',
              color: '#E2B53C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {message.isFromSelf ? 'ME' : (sender?.displayName || sender?.address || 'U').slice(0, 2)}
          </div>
          <div>
            <p className="ecc-message-sender" style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
              {message.isFromSelf ? 'You' : (sender?.displayName ?? 'Unknown sender')}
              <span className="ecc-message-address" style={{ color: '#94A3B8', fontSize: '12.5px', marginLeft: '6px' }}>
                {message.isFromSelf ? '' : `<${sender?.address ?? ''}>`}
              </span>
            </p>
            <p className="ecc-message-to" style={{ margin: '3px 0 0', color: '#94A3B8', fontSize: '12px' }}>
              To: {to.map((p) => (p.isSelf ? 'you' : p.displayName)).join(', ') || 'you'}
              {cc.length > 0
                ? `, copy to: ${cc.map((p) => (p.isSelf ? 'you' : p.displayName)).join(', ')}`
                : ''}
            </p>
          </div>
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

      <div
        className="ecc-message-body"
        style={{
          fontSize: isFullView ? '15.5px' : '14px',
          lineHeight: '1.75',
          color: '#F1F5F9',
          wordBreak: 'break-word',
          fontFamily: 'Inter, system-ui, sans-serif',
          marginTop: '14px',
          whiteSpace: isHtmlBody ? 'normal' : 'pre-wrap',
        }}
      >
        {isHtmlBody ? (
          <div
            className="ecc-inbox-html-content"
            style={{ color: '#F1F5F9', lineHeight: '1.75' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(decodeHtmlEntities(message.body), own) }}
          />
        ) : (
          renderWithMarks(message.body, marks)
        )}
      </div>

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
        <div className="ecc-attachments-section" style={{ marginTop: '16px' }}>
          {/* Images in Clear View */}
          {(() => {
            const imageAttachments = own.filter(
              (a) => a.mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.fileName)
            );
            if (imageAttachments.length === 0) return null;
            return (
              <div className="ecc-image-clear-view-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Eye size={13} color="#E2B53C" />
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#E2B53C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Attached Images ({imageAttachments.length}) · Clear View
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: imageAttachments.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {imageAttachments.map((img) => (
                    <div
                      key={img.id}
                      className="ecc-image-clear-view-card"
                      style={{
                        borderRadius: '8px',
                        border: '1px solid rgba(226, 181, 60, 0.4)',
                        background: '#0B1320',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', background: '#0E1726', borderRadius: '6px', overflow: 'hidden', minHeight: '120px', alignItems: 'center' }}>
                        {(img as any).url || (img as any).dataUrl ? (
                          <img
                            src={(img as any).url || (img as any).dataUrl}
                            alt={img.fileName}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '420px',
                              objectFit: 'contain',
                              borderRadius: '4px',
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '24px 12px', color: '#94A3B8' }}>
                            <Paperclip size={20} color="#E2B53C" />
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-m)' }}>{img.fileName} (preview pending provider retrieval)</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#CBD5E1' }}>
                        <span style={{ fontWeight: 600 }}>{img.fileName}</span>
                        <span style={{ color: '#94A3B8' }}>{img.sizeBytes ? `${Math.round(img.sizeBytes / 1024)} KB` : 'Image'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Standard file attachments list */}
          <ul className="ecc-message-attachments" aria-label="Attachments on this message">
            {own.map((a) => (
              <li key={a.id}>
                <Paperclip size={12} aria-hidden="true" />
                <span className="ecc-attachment-name">{a.fileName}</span>
                <span className="ecc-attachment-size">
                  {a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)} KB` : 'size unknown'}
                </span>
                <span className="ecc-attachment-caveat">{SAFETY_STATEMENTS.attachmentNotReviewed}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
};

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  let prev = text;
  for (let i = 0; i < 3; i++) {
    const next = prev
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#(\d+);/g, (_, code) => {
        try {
          return String.fromCodePoint(Number(code));
        } catch {
          return String.fromCharCode(Number(code));
        }
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
        try {
          return String.fromCodePoint(parseInt(code, 16));
        } catch {
          return String.fromCharCode(parseInt(code, 16));
        }
      });
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

/**
 * Robust DOMParser-based HTML sanitiser for inbox email rendering.
 * Strips active scripts, frames, objects, forms, and on* handlers while
 * preserving formatting, images, tables, lists, and links safely.
 */
function sanitizeHtml(html: string, attachments?: readonly Attachment[]): string {
  if (!html) return '';
  const decoded = decodeHtmlEntities(html);
  if (typeof window === 'undefined') {
    return decoded
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, 'blocked:');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(decoded, 'text/html');

    const forbidden = [
      'script', 'style', 'iframe', 'frame', 'object', 'embed', 'applet',
      'base', 'meta', 'link', 'form', 'input', 'button', 'select', 'textarea',
      'svg', 'math'
    ];
    for (const tag of forbidden) {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    }

    const all = doc.querySelectorAll('*');
    for (const el of all) {
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (
          name.startsWith('on') ||
          val.startsWith('javascript:') ||
          val.startsWith('vbscript:') ||
          val.startsWith('data:text/html') ||
          name === 'formaction' ||
          name === 'action'
        ) {
          el.removeAttribute(attr.name);
        }
      }

      if (el.tagName.toLowerCase() === 'a') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
        const href = (el.getAttribute('href') || '').trim().toLowerCase();
        if (href.startsWith('javascript:') || href.startsWith('vbscript:')) {
          el.removeAttribute('href');
        }
      }

      if (el.tagName.toLowerCase() === 'img') {
        el.setAttribute('loading', 'lazy');
        const src = (el.getAttribute('src') || '').trim();
        if (src.toLowerCase().startsWith('cid:')) {
          const cid = src.slice(4).replace(/[<>]/g, '').trim();
          const match = attachments?.find(
            (a) =>
              (a as any).dataUrl &&
              (a.id === cid ||
                a.fileName === cid ||
                (a as any).contentId === cid ||
                a.id.includes(cid) ||
                cid.includes(a.id))
          );
          if (match && (match as any).dataUrl) {
            el.setAttribute('src', (match as any).dataUrl);
          }
        }
        const existing = el.getAttribute('style') || '';
        el.setAttribute(
          'style',
          existing + '; max-width: 100% !important; height: auto !important; border-radius: 6px; display: inline-block; margin: 8px 0;'
        );
      }
    }

    return doc.body.innerHTML;
  } catch (err) {
    console.warn('DOMParser sanitize error, falling back to regex:', err);
    return decoded
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  }
}

function renderWithMarks(body: string, marks: readonly SourceLocation[]): React.ReactNode {
  const decodedBody = decodeHtmlEntities(body);
  const ranges = marks
    .filter((m): m is SourceLocation & { index: number; quote: string } => m.index !== null && m.quote !== null)
    .map((m) => {
      const decodedQuote = decodeHtmlEntities(m.quote);
      const foundIdx = decodedBody.indexOf(decodedQuote);
      const start = foundIdx !== -1 ? foundIdx : m.index;
      return { start, end: start + decodedQuote.length };
    })
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return decodedBody;

  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((range, i) => {
    if (range.start > cursor) parts.push(decodedBody.slice(cursor, range.start));
    parts.push(
      <mark key={`m-${i}`} className="ecc-source-mark">
        {decodedBody.slice(range.start, range.end)}
      </mark>
    );
    cursor = range.end;
  });
  if (cursor < decodedBody.length) parts.push(decodedBody.slice(cursor));

  return parts;
}
