import React, { useId, useMemo } from 'react';
import { ActionBucketCounts } from '../../lib/actions/actionBuckets';
import {
  ActionHubSummaryThemeKey,
  CURRENT_SUMMARY_THEME,
  actionHubSummaryTheme,
} from './actionHubSummaryTheme';
import '../../styles/action-hub-summary.css';

export type SummaryFilterKey =
  | 'overdue'
  | 'due_today'
  | 'upcoming'
  | 'unscheduled'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'completed'
  | 'pending'
  | null;

export interface ActionHubSummaryProps {
  bucketCounts: ActionBucketCounts;
  activeFilter: SummaryFilterKey;
  onSelectFilter: (filterKey: SummaryFilterKey) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  themeKey?: ActionHubSummaryThemeKey;
}

/**
 * Calculates percentage distribution using the Largest Remainder Method (Hare-Niemeyer)
 * ensuring the sum of all bucket percentages equals exactly 100% (or 0% if total is 0).
 */
export function calculateLargestRemainderPercentages(
  counts: number[],
  total: number
): number[] {
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((c) => (c / total) * 100);
  const floors = exact.map((p) => Math.floor(p));
  const sumFloors = floors.reduce((a, b) => a + b, 0);
  const diff = 100 - sumFloors;

  const remainders = exact.map((p, idx) => ({ idx, rem: p - floors[idx] }));
  remainders.sort((a, b) => b.rem - a.rem);

  const result = [...floors];
  for (let i = 0; i < diff && i < remainders.length; i++) {
    result[remainders[i].idx] += 1;
  }
  return result;
}

export const ActionHubSummary: React.FC<ActionHubSummaryProps> = ({
  bucketCounts,
  activeFilter,
  onSelectFilter,
  loading = false,
  error = null,
  onRetry,
  themeKey = CURRENT_SUMMARY_THEME,
}) => {
  const id = useId();
  const filterId = `ach-glow-${id.replace(/:/g, '')}`;
  const coreGradId = `ach-core-${id.replace(/:/g, '')}`;

  const theme = actionHubSummaryTheme[themeKey] || actionHubSummaryTheme.mix;

  // Slices in strict evaluation order: Completed, Overdue, Due today, Pending
  const sliceCounts = useMemo(() => {
    return [
      bucketCounts.completed,
      bucketCounts.overdue,
      bucketCounts.dueToday,
      bucketCounts.pending,
    ];
  }, [bucketCounts]);

  const percentages = useMemo(() => {
    return calculateLargestRemainderPercentages(sliceCounts, bucketCounts.total);
  }, [sliceCounts, bucketCounts.total]);

  // SVG Donut geometry
  const C = 2 * Math.PI * 108; // Circumference ~678.584px
  const minWidth = C / 360; // 1 degree minimum visible width ~1.885px

  const segments = useMemo(() => {
    const total = bucketCounts.total;
    if (total <= 0) return [];

    const raw = [
      {
        key: 'completed' as const,
        filterKey: 'completed' as SummaryFilterKey,
        label: 'Completed',
        count: bucketCounts.completed,
        color: theme.segments.completed,
      },
      {
        key: 'overdue' as const,
        filterKey: 'overdue' as SummaryFilterKey,
        label: 'Overdue',
        count: bucketCounts.overdue,
        color: theme.segments.overdue,
      },
      {
        key: 'dueToday' as const,
        filterKey: 'due_today' as SummaryFilterKey,
        label: 'Due today',
        count: bucketCounts.dueToday,
        color: theme.segments.dueToday,
      },
      {
        key: 'pending' as const,
        filterKey: 'pending' as SummaryFilterKey,
        label: 'Pending',
        count: bucketCounts.pending,
        color: theme.segments.pending,
      },
    ];

    const activeSlices = raw.filter((s) => s.count > 0);
    const gap = activeSlices.length > 1 ? 3 : 0;

    let currentOffset = 0;
    return activeSlices.map((s) => {
      const rawLen = (s.count / total) * C;
      const dashLen = Math.max(minWidth, rawLen - gap);
      const offset = currentOffset;
      currentOffset += rawLen;
      return {
        ...s,
        dashArray: `${dashLen.toFixed(2)} ${(C - dashLen).toFixed(2)}`,
        dashOffset: (-offset).toFixed(2),
      };
    });
  }, [bucketCounts, C, minWidth, theme]);

  // Status tiles definitions in exact required order
  const tiles = useMemo(() => {
    return [
      {
        n: bucketCounts.overdue,
        label: 'Overdue',
        filterKey: 'overdue' as SummaryFilterKey,
        dot: theme.tileDots.overdue,
      },
      {
        n: bucketCounts.dueToday,
        label: 'Due today',
        filterKey: 'due_today' as SummaryFilterKey,
        dot: theme.tileDots.dueToday,
      },
      {
        n: bucketCounts.upcoming,
        label: 'Upcoming',
        filterKey: 'upcoming' as SummaryFilterKey,
        dot: theme.tileDots.upcoming,
      },
      {
        n: bucketCounts.unscheduled,
        label: 'Unscheduled',
        filterKey: 'unscheduled' as SummaryFilterKey,
        dot: theme.tileDots.unscheduled,
      },
      {
        n: bucketCounts.inProgress,
        label: 'In progress',
        filterKey: 'in_progress' as SummaryFilterKey,
        dot: theme.tileDots.inProgress,
      },
      {
        n: bucketCounts.waiting,
        label: 'Waiting',
        filterKey: 'waiting' as SummaryFilterKey,
        dot: theme.tileDots.waiting,
      },
      {
        n: bucketCounts.blocked,
        label: 'Blocked',
        filterKey: 'blocked' as SummaryFilterKey,
        dot: theme.tileDots.blocked,
      },
      {
        n: bucketCounts.completed,
        label: 'Completed',
        filterKey: 'completed' as SummaryFilterKey,
        dot: theme.tileDots.completed,
      },
    ];
  }, [bucketCounts, theme]);

  const handleToggleFilter = (filterKey: SummaryFilterKey) => {
    if (activeFilter === filterKey) {
      onSelectFilter(null);
    } else {
      onSelectFilter(filterKey);
    }
  };

  if (error) {
    return (
      <div className="ach-summary-error-bar" role="alert">
        <span>{error}</span>
        {onRetry && (
          <button
            type="button"
            className="ach-summary-retry-btn"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ach-summary-row">
        <div
          className="ach-summary-donut-panel"
          style={{
            background: theme.donutPanel.bg,
            border: theme.donutPanel.border,
            boxShadow: theme.donutPanel.glow,
            minHeight: '356px',
          }}
        >
          <div className="ach-summary-skeleton-box" style={{ width: '300px', height: '300px', borderRadius: '50%', margin: '0 auto' }} />
          <div className="ach-summary-legend-wrap" style={{ gap: '16px' }}>
            <div className="ach-summary-skeleton-box" style={{ minHeight: '38px', borderRadius: '8px' }} />
            <div className="ach-summary-skeleton-box" style={{ minHeight: '38px', borderRadius: '8px' }} />
            <div className="ach-summary-skeleton-box" style={{ minHeight: '38px', borderRadius: '8px' }} />
            <div className="ach-summary-skeleton-box" style={{ minHeight: '38px', borderRadius: '8px' }} />
          </div>
        </div>
        <div className="ach-summary-tiles-col">
          <div className="ach-summary-tiles-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="ach-summary-skeleton-box" />
            ))}
          </div>
          <div className="ach-summary-footnote">
            Buckets are exclusive: Completed, then Overdue, then Due today, then Pending. In progress and Blocked are filters, not slices.
          </div>
        </div>
      </div>
    );
  }

  const accessibleSummaryLabel = `${bucketCounts.total} actions: ${bucketCounts.overdue} overdue, ${bucketCounts.dueToday} due today, ${bucketCounts.pending} pending, ${bucketCounts.completed} completed`;

  return (
    <div className="ach-summary-row">
      {/* Left: Donut Panel */}
      <div
        className="ach-summary-donut-panel"
        style={{
          background: theme.donutPanel.bg,
          border: theme.donutPanel.border,
          boxShadow: theme.donutPanel.glow,
        }}
      >
        <div
          className="ach-summary-donut-glow"
          style={{ background: theme.donutPanel.radialGlow }}
        />

        <div className="ach-summary-donut-wrap">
          <svg
            viewBox="0 0 300 300"
            width="300"
            height="300"
            role="img"
            aria-label={accessibleSummaryLabel}
          >
            <defs>
              <filter
                id={filterId}
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur
                  stdDeviation={themeKey === 'mix' ? 4 : 3}
                  result="b"
                />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient
                id={coreGradId}
                cx="50%"
                cy={themeKey === 'mix' ? '50%' : '40%'}
                r={themeKey === 'mix' ? '50%' : '70%'}
              >
                <stop offset="0%" stopColor={theme.donutPanel.core[0]} />
                <stop offset="100%" stopColor={theme.donutPanel.core[1]} />
              </radialGradient>
            </defs>

            {/* Outer rotating dotted ring */}
            <g className="ach-summary-spin" aria-hidden="true" style={{ pointerEvents: 'none' }}>
              <circle
                cx="150"
                cy="150"
                r="140"
                fill="none"
                stroke={theme.donutPanel.outerRingStroke}
                strokeOpacity={theme.donutPanel.outerRingOpacity}
                strokeWidth="2"
                strokeDasharray="2 9"
              />
            </g>

            {/* Inner rotating decorative ring */}
            <g className="ach-summary-spin2" aria-hidden="true" style={{ pointerEvents: 'none' }}>
              <circle
                cx="150"
                cy="150"
                r="130"
                fill="none"
                stroke={theme.donutPanel.innerRingStroke}
                strokeOpacity={theme.donutPanel.innerRingOpacity}
                strokeWidth="1"
                strokeDasharray="40 14 4 14"
              />
            </g>

            {/* Base donut track */}
            <circle
              cx="150"
              cy="150"
              r="108"
              fill="none"
              stroke={theme.donutPanel.track}
              strokeWidth="24"
              style={{ pointerEvents: 'none' }}
            />

            {/* Active glowing segments */}
            <g
              transform="rotate(-90 150 150)"
              filter={`url(#${filterId})`}
              fill="none"
              strokeWidth="20"
              strokeLinecap="butt"
            >
              {segments.map((seg) => {
                const isSegActive = activeFilter === seg.filterKey;
                return (
                  <circle
                    key={seg.key}
                    cx="150"
                    cy="150"
                    r="108"
                    stroke={seg.color}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    strokeWidth={isSegActive ? 24 : 20}
                    opacity={activeFilter && !isSegActive ? 0.45 : 1}
                    style={{ cursor: 'pointer', transition: 'stroke-width 0.2s, opacity 0.2s' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${seg.label}, ${seg.count}, filter the table`}
                    aria-pressed={isSegActive}
                    onClick={() => handleToggleFilter(seg.filterKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleFilter(seg.filterKey);
                      }
                    }}
                  />
                );
              })}
            </g>

            {/* Core inner background and border */}
            <circle
              cx="150"
              cy="150"
              r="88"
              fill={`url(#${coreGradId})`}
              stroke="#7DD3FC"
              strokeOpacity={theme.donutPanel.coreStrokeOpacity}
              strokeWidth="1.5"
              style={{ pointerEvents: 'none' }}
            />
            <circle
              cx="150"
              cy="150"
              r="80"
              fill="none"
              stroke={theme.donutPanel.coreDashStroke}
              strokeOpacity={theme.donutPanel.coreDashOpacity}
              strokeWidth="1"
              strokeDasharray="1 5"
              style={{ pointerEvents: 'none' }}
            />

            {/* Center numbers and text */}
            <text
              x="150"
              y="152"
              textAnchor="middle"
              fontFamily="Poppins, Arial, sans-serif"
              fontWeight="800"
              fontSize="54"
              fill={theme.donutPanel.centerNumber}
              style={{ pointerEvents: 'none' }}
            >
              {bucketCounts.total}
            </text>
            <text
              x="150"
              y="178"
              textAnchor="middle"
              fontFamily="Inter, Arial, sans-serif"
              fontWeight="500"
              fontSize="13"
              fill={theme.donutPanel.centerLabel}
              letterSpacing="2"
              style={{ pointerEvents: 'none' }}
            >
              ACTIONS
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="ach-summary-legend-wrap">
          {[
            {
              key: 'completed' as const,
              filterKey: 'completed' as SummaryFilterKey,
              label: 'Completed',
              count: bucketCounts.completed,
              pct: percentages[0],
              dot: theme.segments.completed,
              hasBorder: true,
            },
            {
              key: 'overdue' as const,
              filterKey: 'overdue' as SummaryFilterKey,
              label: 'Overdue',
              count: bucketCounts.overdue,
              pct: percentages[1],
              dot: theme.segments.overdue,
              hasBorder: true,
            },
            {
              key: 'dueToday' as const,
              filterKey: 'due_today' as SummaryFilterKey,
              label: 'Due today',
              count: bucketCounts.dueToday,
              pct: percentages[2],
              dot: theme.segments.dueToday,
              pulse: true,
              hasBorder: true,
            },
            {
              key: 'pending' as const,
              filterKey: 'pending' as SummaryFilterKey,
              label: 'Pending',
              count: bucketCounts.pending,
              pct: percentages[3],
              dot: theme.segments.pending,
              hasBorder: false,
            },
          ].map((item) => {
            const isActive = activeFilter === item.filterKey;
            return (
              <button
                key={item.key}
                type="button"
                className={`ach-summary-legend-btn ${isActive ? 'is-active' : ''}`}
                style={{
                  borderBottom: item.hasBorder ? `1px solid ${theme.donutPanel.rowBorder}` : 'none',
                }}
                aria-pressed={isActive}
                aria-label={`${item.label}, ${item.count}, ${item.pct} percent, filter the table`}
                onClick={() => handleToggleFilter(item.filterKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleFilter(item.filterKey);
                  }
                }}
              >
                <span
                  className={item.pulse ? 'ach-summary-pulse' : ''}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: item.dot,
                    boxShadow: `0 0 10px ${item.dot}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: '18px',
                    color: theme.donutPanel.text,
                    textAlign: 'left',
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: 'Poppins, Arial, sans-serif',
                    fontWeight: 700,
                    fontSize: '20px',
                    color: themeKey === 'mix' ? '#FFFFFF' : '#16263F',
                  }}
                >
                  {item.count}
                </span>
                <span
                  style={{
                    width: '48px',
                    textAlign: 'right',
                    fontSize: '15px',
                    color: theme.donutPanel.mutedText,
                  }}
                >
                  {item.pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Status Boxes Grid */}
      <div className="ach-summary-tiles-col">
        <div className="ach-summary-tiles-grid">
          {tiles.map((t) => {
            const isActive = activeFilter === t.filterKey;
            return (
              <button
                key={t.label}
                type="button"
                className={`ach-summary-tile ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                aria-label={`${t.label}, ${t.n}, filter the table`}
                onClick={() => handleToggleFilter(t.filterKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleFilter(t.filterKey);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span
                    style={{
                      fontFamily: 'Poppins, Arial, sans-serif',
                      fontWeight: 700,
                      fontSize: '38px',
                      lineHeight: 1,
                      color: theme.tiles.number,
                    }}
                  >
                    {t.n}
                  </span>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: t.dot,
                      boxShadow: `0 0 8px ${t.dot}`,
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div style={{ fontSize: '16px', color: theme.tiles.label }}>
                  {t.label}
                </div>
              </button>
            );
          })}
        </div>
        <div className="ach-summary-footnote">
          Buckets are exclusive: Completed, then Overdue, then Due today, then Pending. In progress and Blocked are filters, not slices.
        </div>
      </div>
    </div>
  );
};
