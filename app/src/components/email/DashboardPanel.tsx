/**
 * A dashboard panel. Renders its own loading, empty and error states, and a
 * list of threads when it has them.
 *
 * Status is carried by a word as well as a colour, because colour alone is not
 * enough and because a status badge that only differs by hue is unreadable to a
 * fair number of people.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CircleHelp } from 'lucide-react';
import { EmailPanelData, EmailPanelItem } from '../../lib/email/types';
import { LoadingBlock, EmptyBlock, ErrorBlock } from './StateBlocks';

const STATUS_LABEL: Record<EmailPanelItem['status'], string> = {
  waiting_on_user: 'Waiting on you',
  waiting_on_other: 'Waiting on them',
  decision_required: 'Decision required',
  action_required: 'Action required',
  information_only: 'Information only',
  resolved: 'Resolved',
  security_review: 'Security review',
  unclear: 'Unclear',
};

const STATUS_TONE: Record<EmailPanelItem['status'], string> = {
  waiting_on_user: 'ecc-tone-attention',
  waiting_on_other: 'ecc-tone-quiet',
  decision_required: 'ecc-tone-attention',
  action_required: 'ecc-tone-attention',
  information_only: 'ecc-tone-quiet',
  resolved: 'ecc-tone-done',
  security_review: 'ecc-tone-alert',
  unclear: 'ecc-tone-quiet',
};

/**
 * A DEFECT FOUND IN STAGE 3 VERIFICATION, CORRECTED HERE.
 *
 * Without an explicit time zone, `toLocaleDateString` formats in whatever zone
 * the browser is running in. The dataset carries Melbourne times, so a deadline
 * of 9:12am on 12 October rendered as "11 Oct" in any environment running on
 * UTC. Every deadline in the module was showing a day early, which on a thread
 * whose whole point is a date is worse than showing no date at all.
 *
 * The zone is pinned to the account's. A deadline belongs to the person's
 * working day, not to the machine the page happens to be open on, so a person
 * travelling does not see their deadlines move.
 */
const DEADLINE_ZONE = 'Australia/Melbourne';

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    timeZone: DEADLINE_ZONE,
  });
}

const PanelRow: React.FC<{ item: EmailPanelItem }> = ({ item }) => (
  <li className="ecc-row">
    <div className="ecc-row-main">
      <p className="ecc-row-sender">{item.sender}</p>
      <p className="ecc-row-subject">{item.subject}</p>
      <p className="ecc-row-summary">{item.summary}</p>
      <ul className="ecc-row-reasons">
        {item.priorityReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
    <div className="ecc-row-meta">
      <span className={`ecc-badge ${STATUS_TONE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
      <span className="ecc-row-score" title="Priority score out of 100">
        {item.priorityScore}
        <span className="ecc-visually-hidden"> out of 100 priority</span>
      </span>
      {item.deadline ? (
        <span className="ecc-row-deadline">
          <CalendarClock size={12} aria-hidden="true" />
          {formatDeadline(item.deadline)}
          {item.deadlineIsExplicit ? (
            <span className="ecc-visually-hidden">, a date stated in the thread</span>
          ) : (
            <>
              <CircleHelp size={11} aria-hidden="true" className="ecc-inferred-mark" />
              <span className="ecc-visually-hidden">, inferred, needs confirming</span>
            </>
          )}
        </span>
      ) : null}
    </div>
  </li>
);

interface Props {
  panel: EmailPanelData;
  linkTo: (path: string) => string;
  onRetry?: () => void;
  /** Panels the mobile layout keeps above the fold. */
  priority?: boolean;
}

export const DashboardPanel: React.FC<Props> = ({ panel, linkTo, onRetry, priority }) => {
  const headingId = `ecc-panel-${panel.key}`;

  return (
    <section
      className={`ecc-panel${priority ? ' ecc-panel-priority' : ''}`}
      aria-labelledby={headingId}
    >
      <header className="ecc-panel-head">
        <div>
          <h3 id={headingId} className="ecc-panel-title">
            {panel.title}
          </h3>
          <p className="ecc-panel-description">{panel.description}</p>
        </div>
        <Link to={linkTo(panel.destination)} className="ecc-text-button ecc-panel-link">
          View all
          <ArrowRight size={13} aria-hidden="true" />
          <span className="ecc-visually-hidden"> in {panel.title}</span>
        </Link>
      </header>

      {panel.state === 'loading' ? (
        <LoadingBlock label={panel.title.toLowerCase()} />
      ) : panel.state === 'error' ? (
        <ErrorBlock
          label={panel.title.toLowerCase()}
          message={panel.errorMessage ?? 'This panel could not be built.'}
          onRetry={onRetry}
        />
      ) : panel.state === 'empty' ? (
        <EmptyBlock message={panel.emptyMessage} />
      ) : (
        <>
          <ul className="ecc-row-list">
            {panel.items.map((item) => (
              <PanelRow key={item.id} item={item} />
            ))}
          </ul>
          {panel.totalItems > panel.items.length ? (
            <p className="ecc-panel-more">
              Showing the first {panel.items.length} of {panel.totalItems}. The rest are in{' '}
              <Link className="ecc-text-button" to={linkTo(panel.destination)}>
                {panel.title}
              </Link>
              , a page at a time.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
};
