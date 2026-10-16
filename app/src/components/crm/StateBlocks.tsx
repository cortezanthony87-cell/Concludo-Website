/**
 * The four states every view has to be able to show, plus the scaffold that
 * chooses between them.
 *
 * WHY THESE ARE A COMPONENT RATHER THAN AN `IF` IN EACH PAGE.
 *
 * Loading, empty, partial and error are the states a view spends most of its
 * life in during a real working day, and they are the states nobody looks at
 * while building, because the happy path is what you have on screen. Making
 * them a shared component means every one of the fourteen views gets all four
 * for free, and the demonstration can reach them with `?state=loading`,
 * `?state=empty`, `?state=partial` or `?state=error` so a reviewer can
 * actually see them.
 *
 * The distinction that matters most is **empty against error**. Silence and
 * zero must never look the same. An empty list says "there is nothing here, and
 * that is the answer". An error says "something went wrong and you are being
 * shown nothing without being told". A view that renders an error as an empty
 * list is quietly lying.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, SearchX } from 'lucide-react';
import { AsyncState } from '../../lib/crm/types';

export const LoadingState: React.FC<{ what: string }> = ({ what }) => (
  <div className="ccrm-state" role="status" aria-live="polite">
    <Loader2 className="ccrm-state-icon ccrm-spin" size={22} aria-hidden="true" />
    <p className="ccrm-state-title">Loading {what}</p>
    <p className="ccrm-state-body">Nothing is sent anywhere while this loads.</p>
  </div>
);

export const EmptyState: React.FC<{ title: string; body: string; hint?: string }> = ({
  title,
  body,
  hint,
}) => (
  <div className="ccrm-state">
    <CheckCircle2 className="ccrm-state-icon" size={22} aria-hidden="true" />
    <p className="ccrm-state-title">{title}</p>
    <p className="ccrm-state-body">{body}</p>
    {hint ? <p className="ccrm-state-hint">{hint}</p> : null}
  </div>
);

export const NoMatchState: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div className="ccrm-state">
    <SearchX className="ccrm-state-icon" size={22} aria-hidden="true" />
    <p className="ccrm-state-title">Nothing matches the current filters</p>
    <p className="ccrm-state-body">
      There are records in this workspace, but none of them match what is selected above.
    </p>
    <button type="button" className="btn-secondary ccrm-button" onClick={onClear}>
      Clear the filters
    </button>
  </div>
);

/**
 * Partial.
 *
 * Something loaded and something did not. The rule is that the view shows what
 * it has and says plainly what is missing, rather than showing a complete-looking
 * page built from half the data.
 */
export const PartialState: React.FC<{ missing: string; children: React.ReactNode }> = ({
  missing,
  children,
}) => (
  <>
    <div className="ccrm-partial" role="status">
      <AlertTriangle className="ccrm-partial-icon" size={16} aria-hidden="true" />
      <p>
        <strong>Some information is missing.</strong> {missing} What is shown below is complete for
        everything else.
      </p>
    </div>
    {children}
  </>
);

export const ErrorState: React.FC<{ what: string; onRetry?: () => void }> = ({ what, onRetry }) => (
  <div className="ccrm-state ccrm-state-error" role="alert">
    <AlertTriangle className="ccrm-state-icon" size={22} aria-hidden="true" />
    <p className="ccrm-state-title">{what} could not be loaded</p>
    <p className="ccrm-state-body">
      This is not an empty list. Something went wrong, and the records that exist are not being
      shown. Nothing has been changed.
    </p>
    {onRetry ? (
      <button type="button" className="btn-secondary ccrm-button" onClick={onRetry}>
        Try again
      </button>
    ) : null}
  </div>
);

/**
 * Reads a forced state out of the query string.
 *
 * This is how the four states are reviewed and tested without a network. A
 * state that cannot be reached is a state nobody has ever looked at.
 */
export function forcedState(search: string): AsyncState | null {
  const value = new URLSearchParams(search).get('state');
  if (value === 'loading' || value === 'empty' || value === 'partial' || value === 'error') {
    return value;
  }
  return null;
}
