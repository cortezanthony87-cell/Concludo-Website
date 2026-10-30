import React, { useEffect, useRef } from 'react';
import { AlertCircle, Inbox, Lock, Clock, Info } from 'lucide-react';

/**
 * Shared building blocks for every Intelligence page.
 * Rules baked in:
 *  - One main job per page: title and purpose, then filters, then summary, evidence, next actions.
 *  - Every statement carries a provenance chip (Recorded, Inferred, Suggested, Scenario).
 *  - Loading, empty, error, denied, stale and insufficient-evidence states are first class.
 *  - No glow, no glass, no gradients, no invented numbers.
 */

export type Provenance = 'recorded' | 'inferred' | 'suggested' | 'scenario';

const PROVENANCE_TEXT: Record<Provenance, string> = {
  recorded: 'Recorded',
  inferred: 'Inferred',
  suggested: 'Suggested',
  scenario: 'Scenario',
};

const PROVENANCE_HELP: Record<Provenance, string> = {
  recorded: 'Taken directly from a saved record.',
  inferred: 'Worked out from saved records. Check the evidence.',
  suggested: 'A drafting suggestion. A person decides.',
  scenario: 'A what-if. Not a forecast and not a record.',
};

export const ProvenanceChip: React.FC<{ kind: Provenance }> = ({ kind }) => (
  <span className={`ib-chip ib-chip--${kind}`} title={PROVENANCE_HELP[kind]}>
    {PROVENANCE_TEXT[kind]}
  </span>
);

export const PageHeader: React.FC<{
  title: string;
  purpose: string;
  crumbs?: Array<{ label: string; to?: string }>;
  actions?: React.ReactNode;
  renderLink?: (to: string, label: string) => React.ReactNode;
}> = ({ title, purpose, crumbs, actions, renderLink }) => (
  <header className="ib-head">
    <div className="ib-head__text">
      {crumbs && crumbs.length > 0 && (
        <nav className="ib-crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.label}>
              {i > 0 && ' / '}
              {c.to && renderLink ? renderLink(c.to, c.label) : c.label}
            </span>
          ))}
        </nav>
      )}
      <h1 className="ib-title">{title}</h1>
      <p className="ib-purpose">{purpose}</p>
    </div>
    {actions && <div className="ib-actions">{actions}</div>}
  </header>
);

/** Filters plus a plain-language statement of exactly what is on screen. */
export const ScopeBar: React.FC<{
  summary: React.ReactNode;
  children: React.ReactNode;
}> = ({ summary, children }) => (
  <section className="ib-scope" aria-label="Filters and current scope">
    <div className="ib-scope__row">{children}</div>
    <p className="ib-scope__now" role="status" aria-live="polite">
      <strong>Showing:</strong> {summary}
    </p>
  </section>
);

export const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  note?: string;
}> = ({ label, value, note }) => (
  <div className="ib-metric">
    <p className="ib-metric__label">{label}</p>
    <p className="ib-metric__value">{value}</p>
    {note && <p className="ib-metric__note">{note}</p>}
  </div>
);

export type StateKind = 'loading' | 'empty' | 'error' | 'denied' | 'stale' | 'insufficient';

const STATE_ICON: Record<Exclude<StateKind, 'loading'>, React.ReactNode> = {
  empty: <Inbox size={24} aria-hidden="true" />,
  error: <AlertCircle size={24} aria-hidden="true" />,
  denied: <Lock size={24} aria-hidden="true" />,
  stale: <Clock size={24} aria-hidden="true" />,
  insufficient: <Info size={24} aria-hidden="true" />,
};

export const StatePanel: React.FC<{
  kind: StateKind;
  title: string;
  body?: string;
  action?: React.ReactNode;
}> = ({ kind, title, body, action }) => {
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="ib-sr">{title}</span>
        <div className="ib-skeleton" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      </div>
    );
  }
  return (
    <div className={`ib-state ib-state--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="ib-state__icon">{STATE_ICON[kind]}</span>
      <h2 className="ib-state__title">{title}</h2>
      {body && <p className="ib-state__body">{body}</p>}
      {action}
    </div>
  );
};

/**
 * Accessible confirm dialog. Replaces window.confirm() and alert().
 * Focus moves to the cancel button on open, Escape cancels, focus returns to the opener on close.
 */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, body, confirmLabel, busy, onConfirm, onCancel }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="ib-modal" role="presentation">
      <div className="ib-modal__panel" role="alertdialog" aria-modal="true" aria-labelledby="ib-dlg-title" aria-describedby="ib-dlg-body">
        <h2 id="ib-dlg-title" className="ib-modal__title">{title}</h2>
        <p id="ib-dlg-body" className="ib-modal__body">{body}</p>
        <div className="ib-modal__actions">
          <button ref={cancelRef} type="button" className="ib-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="ib-btn ib-btn--primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
