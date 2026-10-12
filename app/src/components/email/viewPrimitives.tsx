/**
 * The pieces every operational view is built from.
 *
 * They live in one file because they share one job: putting a fact on screen
 * with the label that makes it true. A status is a word before it is a colour,
 * a date says whether it was stated or guessed, and a confidence level is
 * written out rather than implied by a dot.
 */
import React from 'react';
import {
  CalendarClock,
  CircleHelp,
  Paperclip,
  ShieldAlert,
  Lock,
  Briefcase,
  House,
  UserRound,
  Info,
  TriangleAlert,
} from 'lucide-react';
import { ThreadStatus, PriorityBand, Confidence, DraftStatus } from '../../lib/email/model';
import { DateOrigin, DATE_ORIGIN_LABEL } from '../../lib/email/views';

/* ------------------------------------------------------------- status */

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  waiting_on_user: 'Waiting on you',
  waiting_on_other: 'Waiting on them',
  decision_required: 'Decision required',
  action_required: 'Action required',
  information_only: 'Information only',
  resolved: 'Resolved',
  security_review: 'Security review',
  unclear: 'Unclear',
};

export const STATUS_TONE: Record<ThreadStatus, string> = {
  waiting_on_user: 'ecc-tone-attention',
  waiting_on_other: 'ecc-tone-quiet',
  decision_required: 'ecc-tone-attention',
  action_required: 'ecc-tone-attention',
  information_only: 'ecc-tone-quiet',
  resolved: 'ecc-tone-done',
  security_review: 'ecc-tone-alert',
  unclear: 'ecc-tone-quiet',
};

export const StatusBadge: React.FC<{ status: ThreadStatus }> = ({ status }) => (
  <span className={`ecc-badge ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
);

/* ------------------------------------------------------------- priority */

export const BAND_LABEL: Record<PriorityBand, string> = {
  immediate: 'Immediate',
  today: 'Today',
  soon: 'Soon',
  batch: 'Batch',
  low: 'Low',
};

const BAND_TONE: Record<PriorityBand, string> = {
  immediate: 'ecc-tone-alert',
  today: 'ecc-tone-attention',
  soon: 'ecc-tone-quiet',
  batch: 'ecc-tone-quiet',
  low: 'ecc-tone-quiet',
};

export const BandBadge: React.FC<{ band: PriorityBand; score?: number }> = ({ band, score }) => (
  <span className={`ecc-badge ${BAND_TONE[band]}`}>
    {BAND_LABEL[band]}
    {typeof score === 'number' ? (
      <>
        <span aria-hidden="true"> · {score}</span>
        <span className="ecc-visually-hidden">, priority {score} out of 100</span>
      </>
    ) : null}
  </span>
);

/* ------------------------------------------------------------- account */

export const AccountBadge: React.FC<{ accountType: 'work' | 'personal'; label?: string }> = ({
  accountType,
  label,
}) => (
  <span
    className={`ecc-account-badge ${
      accountType === 'work' ? 'ecc-account-work' : 'ecc-account-personal'
    }`}
  >
    {accountType === 'work' ? (
      <Briefcase size={11} aria-hidden="true" />
    ) : (
      <House size={11} aria-hidden="true" />
    )}
    {label ?? (accountType === 'work' ? 'Work' : 'Personal')}
  </span>
);

/* --------------------------------------------------------------- dates */

/**
 * Dates are formatted in the account's time zone, never the browser's.
 * A deadline belongs to the person's working day, not to the machine the page
 * happens to be open on.
 */
const ZONE = 'Australia/Melbourne';

export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: ZONE });
}

export function formatDayTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ZONE,
  });
}

/**
 * A date, carrying where it came from.
 *
 * A suggested date is required by the brief to say "Suggested date, confirm" in
 * words on the face of it. It does, and it also carries a question mark icon
 * and a screen reader sentence, so the warning does not depend on either the
 * icon or the colour being noticed.
 */
export const DateChip: React.FC<{
  dueAt: string | null;
  origin: DateOrigin;
  withTime?: boolean;
}> = ({ dueAt, origin, withTime }) => {
  if (!dueAt) {
    return <span className="ecc-date-chip ecc-date-none">No date stated</span>;
  }
  const text = withTime ? formatDayTime(dueAt) : formatDay(dueAt);

  return (
    <span className={`ecc-date-chip ecc-date-${origin.replace('_', '-')}`}>
      {origin === 'suggested' ? (
        <CircleHelp size={12} aria-hidden="true" />
      ) : (
        <CalendarClock size={12} aria-hidden="true" />
      )}
      <span>{text}</span>
      <span className="ecc-date-origin">{DATE_ORIGIN_LABEL[origin]}</span>
      <span className="ecc-visually-hidden">
        {origin === 'suggested'
          ? '. This date was worked out, not stated by the sender. Confirm it before relying on it.'
          : origin === 'user_created'
            ? '. You set this date.'
            : '. This date was stated in the email.'}
      </span>
    </span>
  );
};

/* ---------------------------------------------------------- confidence */

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export const ConfidenceChip: React.FC<{ confidence: Confidence; what?: string }> = ({
  confidence,
  what = 'this reading',
}) => (
  <span className={`ecc-confidence ecc-confidence-${confidence}`}>
    {CONFIDENCE_TEXT[confidence]}
    <span className="ecc-visually-hidden"> in {what}</span>
  </span>
);

/* ---------------------------------------------------------- attachments */

export const AttachmentChip: React.FC<{ count: number; awaiting: boolean }> = ({
  count,
  awaiting,
}) => {
  if (count === 0 && !awaiting) return null;
  return (
    <span className={`ecc-attach-chip ${awaiting ? 'ecc-attach-awaiting' : ''}`}>
      <Paperclip size={12} aria-hidden="true" />
      {awaiting
        ? 'A file is needed before replying'
        : `${count} attachment${count === 1 ? '' : 's'}`}
    </span>
  );
};

/* ------------------------------------------------------------- drafts */

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  available: 'Draft ready for review',
  clarification_required: 'Not drafted, something is missing',
  withheld_for_safety: 'Draft withheld',
};

export const DraftChip: React.FC<{ status: DraftStatus }> = ({ status }) => (
  <span className={`ecc-draft-chip ecc-draft-${status.replace(/_/g, '-')}`}>
    {status === 'available' ? null : <Lock size={11} aria-hidden="true" />}
    {DRAFT_STATUS_LABEL[status]}
  </span>
);

/* ------------------------------------------------------------ warnings */

/**
 * A warning is an alert region, not a coloured panel.
 *
 * It carries a heading word, an icon and a border, so the meaning survives
 * without colour, without the icon font, and in a screen reader.
 */
export const WarningBlock: React.FC<{
  kind: 'security' | 'sensitive';
  text: string;
  check?: string;
}> = ({ kind, text, check }) => (
  <div className={`ecc-warning ecc-warning-${kind}`} role="note">
    <p className="ecc-warning-head">
      {kind === 'security' ? (
        <ShieldAlert size={14} aria-hidden="true" />
      ) : (
        <UserRound size={14} aria-hidden="true" />
      )}
      {kind === 'security' ? 'Security warning' : 'Sensitive content'}
    </p>
    <p className="ecc-warning-text">{text}</p>
    {check ? (
      <p className="ecc-warning-check">
        <strong>What to do:</strong> {check}
      </p>
    ) : null}
  </div>
);

/**
 * A general notice, for the things that are not security warnings.
 *
 * Added in Stage 7 rather than widening `WarningBlock`, whose two kinds mean
 * something specific wherever they appear. A paused session and a browser that
 * cannot keep one are not security warnings, and dressing them as warnings is
 * how a real warning stops standing out.
 */
export const NoticeBlock: React.FC<{
  tone: 'info' | 'caution';
  title: string;
  children: React.ReactNode;
}> = ({ tone, title, children }) => (
  <div className={`ecc-notice ecc-notice-${tone}`} role="note">
    <p className="ecc-notice-head">
      {tone === 'caution' ? (
        <TriangleAlert size={14} aria-hidden="true" />
      ) : (
        <Info size={14} aria-hidden="true" />
      )}
      {title}
    </p>
    <div className="ecc-notice-body">{children}</div>
  </div>
);

/* --------------------------------------------------------- field list */

/** A labelled fact. The label is a real element, so it is read out with its value. */
export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="ecc-field">
    <span className="ecc-field-label">{label}</span>
    <span className="ecc-field-value">{children}</span>
  </div>
);
