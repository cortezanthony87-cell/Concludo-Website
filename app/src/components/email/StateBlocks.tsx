/**
 * The three states every asynchronous surface in this module can be in.
 *
 * The Workspace has no shared loading, empty or error component. It uses
 * .auth-loading-screen, .auth-alert-error and inline text. These three reuse
 * those idioms so the module looks native, while giving the module one place
 * to get the accessibility right.
 */
import React from 'react';
import { Loader2, AlertTriangle, Check } from 'lucide-react';

interface LoadingProps {
  /** What is loading, for the screen reader. "the reply queue", not "data". */
  label: string;
  /** Number of skeleton rows. */
  rows?: number;
}

export const LoadingBlock: React.FC<LoadingProps> = ({ label, rows = 3 }) => (
  <div className="ecc-state ecc-state-loading" role="status" aria-live="polite">
    <span className="ecc-visually-hidden">Loading {label}.</span>
    <Loader2 size={16} className="ecc-spin" aria-hidden="true" />
    <div className="ecc-skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="ecc-skeleton-row" />
      ))}
    </div>
  </div>
);

interface EmptyProps {
  /** Written as an outcome, not an absence. "Nobody is waiting on you." */
  message: string;
  /** Optional second line, for a caveat such as the security one. */
  note?: string;
}

export const EmptyBlock: React.FC<EmptyProps> = ({ message, note }) => (
  <div className="ecc-state ecc-state-empty">
    <Check size={16} aria-hidden="true" className="ecc-empty-icon" />
    <p className="ecc-state-message">{message}</p>
    {note ? <p className="ecc-state-note">{note}</p> : null}
  </div>
);

interface ErrorProps {
  /** Plain words. Never a stack trace and never an error code alone. */
  message: string;
  onRetry?: () => void;
  /** What failed, for the screen reader announcement. */
  label: string;
}

export const ErrorBlock: React.FC<ErrorProps> = ({ message, onRetry, label }) => (
  <div className="ecc-state ecc-state-error" role="alert">
    <AlertTriangle size={16} aria-hidden="true" className="ecc-error-icon" />
    <div>
      <p className="ecc-state-message">{message}</p>
      {onRetry ? (
        <button type="button" className="ecc-text-button" onClick={onRetry}>
          Try {label} again
        </button>
      ) : null}
    </div>
  </div>
);
