/**
 * The frame every operational view sits in.
 *
 * It owns the page heading, the four states, the account note and the live
 * region. Having one place for those means a view cannot forget to say which
 * account it is showing, and cannot show an empty list that looks like a
 * loading list.
 */
import React from 'react';
import { LoadingBlock, EmptyBlock, ErrorBlock } from './StateBlocks';
import { AsyncState } from '../../lib/email/types';
import { useLocalActions } from '../../lib/email/localActions';

interface Props {
  /** The page title. Rendered as the one h2 on the page. */
  title: string;
  /** One sentence under the title. */
  description: string;
  state: AsyncState;
  /** How many items the view holds, used for the count line and the empty test. */
  count: number;
  /**
   * What the count is counting. Actions and Deadlines lists dated items, not
   * threads, and several of them can come from one thread. Saying "8 threads"
   * there was simply untrue.
   */
  countNoun?: [singular: string, plural: string];
  /** What to say when there is nothing. Written as an outcome, not a failure. */
  emptyMessage: string;
  emptyNote?: string;
  /** The account being shown. Named on every view; the two never merge. */
  accountLabel: string;
  accountType: 'work' | 'personal';
  /** Controls that belong above the list: filters, sorting, style pickers. */
  controls?: React.ReactNode;
  /** Shown above the controls. Used by Security Review for its disclaimer. */
  notice?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}

export const ViewScaffold: React.FC<Props> = ({
  title,
  description,
  state,
  count,
  countNoun = ['thread', 'threads'],
  emptyMessage,
  emptyNote,
  accountLabel,
  accountType,
  controls,
  notice,
  onRetry,
  children,
}) => {
  const { lastAnnouncement } = useLocalActions();
  const headingId = 'ecc-view-heading';

  return (
    <section className="ecc-page ecc-view" aria-labelledby={headingId}>
      <header className="ecc-view-head">
        <h2 id={headingId} className="ecc-page-title">
          {title}
        </h2>
        <p className="ecc-page-description">{description}</p>
        <p className="ecc-view-account">
          Showing <strong>{accountLabel}</strong>, the {accountType} account. Work and personal are
          never combined.
        </p>
      </header>

      {notice}

      {controls ? (
        <div className="ecc-view-controls" role="group" aria-label={`${title} controls`}>
          {controls}
        </div>
      ) : null}

      {/*
        One live region per view. Actions announce through it, because several
        of them change a list the person may not be looking at, and a row that
        silently disappears is indistinguishable from a bug.
      */}
      <p className="ecc-visually-hidden ecc-live-region" role="status" aria-live="polite">
        {lastAnnouncement ?? ''}
      </p>

      {state === 'ready' && count > 0 ? (
        <p className="ecc-view-count" role="status">
          {count} {count === 1 ? countNoun[0] : countNoun[1]}
        </p>
      ) : null}

      {state === 'loading' ? <LoadingBlock label={title.toLowerCase()} rows={4} /> : null}
      {state === 'error' ? (
        <ErrorBlock
          label={title.toLowerCase()}
          message={
            accountLabel === 'Unknown account'
              ? 'This account is not available, so nothing is being shown. That is different from having nothing to do. Check the account selector above.'
              : 'This view could not be built. Nothing has been missed; try refreshing.'
          }
          onRetry={onRetry}
        />
      ) : null}
      {state === 'empty' || (state === 'ready' && count === 0) ? (
        <EmptyBlock message={emptyMessage} note={emptyNote} />
      ) : null}
      {state === 'ready' && count > 0 ? children : null}
    </section>
  );
};
