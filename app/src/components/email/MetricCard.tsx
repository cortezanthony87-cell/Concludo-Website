/**
 * An overview metric card.
 *
 * It is a link, not a div with a click handler, so keyboard activation, focus
 * order and the browser's own affordances come for free. Enter and Space both
 * work because that is what a link does.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { EmailMetric } from '../../lib/email/types';

interface Props {
  metric: EmailMetric;
  /** Appends the person's current account, filters and search to the destination. */
  linkTo: (path: string) => string;
}

function accessibleName(metric: EmailMetric): string {
  if (metric.state === 'loading') return `${metric.label}, still counting.`;
  if (metric.state === 'error') return `${metric.label}, count unavailable. ${metric.explanation}`;
  if (metric.count === 0) return `${metric.label}, none. ${metric.explanation}`;
  const unit = metric.count === 1 ? 'thread' : 'threads';
  return `${metric.label}, ${metric.count} ${unit}. ${metric.explanation}`;
}

export const MetricCard: React.FC<Props> = ({ metric, linkTo }) => {
  const attention = metric.emphasis === 'attention' && (metric.count ?? 0) > 0;

  const className = [
    'ecc-metric-card',
    attention ? 'ecc-metric-attention' : '',
    metric.state === 'error' ? 'ecc-metric-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link to={linkTo(metric.destination)} className={className} aria-label={accessibleName(metric)}>
      <span className="ecc-metric-head">
        <span className="ecc-metric-label">{metric.label}</span>
        {attention ? <ShieldAlert size={14} aria-hidden="true" className="ecc-metric-flag" /> : null}
      </span>

      <span className="ecc-metric-value" aria-hidden="true">
        {metric.state === 'loading' ? (
          <Loader2 size={20} className="ecc-spin" />
        ) : metric.state === 'error' ? (
          <AlertTriangle size={20} className="ecc-error-icon" />
        ) : (
          <span className={metric.count === 0 ? 'ecc-metric-zero' : 'ecc-metric-number'}>
            {metric.count === 0 ? 'None' : metric.count}
          </span>
        )}
      </span>

      <span className="ecc-metric-explanation" aria-hidden="true">
        {metric.state === 'error' ? metric.errorMessage : metric.explanation}
      </span>
    </Link>
  );
};

interface GridProps {
  metrics: EmailMetric[];
  linkTo: (path: string) => string;
}

export const MetricCardGrid: React.FC<GridProps> = ({ metrics, linkTo }) => (
  <section aria-labelledby="ecc-metrics-heading" className="ecc-metrics-section">
    <h2 id="ecc-metrics-heading" className="ecc-visually-hidden">
      Inbox at a glance
    </h2>
    <div className="ecc-metric-grid">
      {metrics.map((metric) => (
        <MetricCard key={metric.key} metric={metric} linkTo={linkTo} />
      ))}
    </div>
  </section>
);
