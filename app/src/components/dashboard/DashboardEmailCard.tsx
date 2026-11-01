import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, RefreshCw, ChevronRight } from 'lucide-react';
import { useSharedEmailStatus, SharedEmailStatusResult } from '../../lib/email/sharedEmailStatus';

export interface DashboardEmailCardProps {
  cardStyle?: React.CSSProperties;
  sectionHeadStyle?: React.CSSProperties;
  /** Inject status data directly for deterministic testing / isolation */
  statusOverride?: {
    data: SharedEmailStatusResult | null;
    loading: boolean;
    error: Error | null;
    refresh?: () => void;
  };
}

export const DashboardEmailCard: React.FC<DashboardEmailCardProps> = ({
  cardStyle,
  sectionHeadStyle,
  statusOverride,
}) => {
  const hookResult = useSharedEmailStatus({ pollIntervalMs: 60000, pauseWhenHidden: true });
  const { data: emailStatusData, loading: loadingEmail, error: emailStatusError, refresh: refreshEmailStatus } =
    statusOverride || hookResult;

  const defaultCardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(22,38,63,0.07)',
    marginBottom: '24px',
    ...cardStyle,
  };

  const defaultSectionHeadStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#21395c',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    ...sectionHeadStyle,
  };

  return (
    <div style={defaultCardStyle} data-testid="dashboard-email-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={defaultSectionHeadStyle}>
          <Activity size={14} color="#e2b53c" />
          Email Command Centre
        </div>
        {emailStatusData && (
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {emailStatusData.accountLabel}
          </span>
        )}
      </div>

      {/* Error state with retry */}
      {emailStatusError ? (
        <div
          data-testid="email-card-error-state"
          style={{
            padding: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>
            Could not load email status. Try again
          </span>
          <button
            type="button"
            data-testid="email-card-retry-button"
            onClick={() => refreshEmailStatus?.()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              background: '#ffffff',
              border: '1px solid #f87171',
              borderRadius: '4px',
              color: '#b91c1c',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : loadingEmail && !emailStatusData ? (
        /* Initial loading state */
        <div
          data-testid="email-card-loading-state"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {['Need reply', 'Unread', 'Flagged', 'Processed today'].map((label) => (
            <div
              key={label}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#94a3b8', lineHeight: 1 }}>
                ···
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Four stat tiles */
        <div
          data-testid="email-card-stat-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}
        >
          {[
            {
              label: 'Need reply',
              value: emailStatusData?.counts.needsReply ?? 0,
              color: '#f87171',
              link: '/email/reply-queue',
            },
            {
              label: 'Unread',
              value: emailStatusData?.counts.unread ?? 0,
              color: '#f3c958',
              link: '/email/all',
            },
            {
              label: 'Flagged',
              value: emailStatusData?.counts.flagged ?? 0,
              color: '#fb923c',
              link: '/email/security-review',
            },
            {
              label: 'Processed today',
              value: emailStatusData?.counts.processedToday ?? 0,
              color: '#4ade80',
              link: '/email/all',
            },
          ].map((stat) => (
            <Link
              key={stat.label}
              to={stat.link}
              data-testid={`stat-tile-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
              style={{
                textDecoration: 'none',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
                display: 'block',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                {stat.label}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Email preview rows */}
      {loadingEmail && !emailStatusData ? (
        <div style={{ color: '#475569', fontSize: '0.82rem', padding: '8px 0' }}>Loading email threads...</div>
      ) : !emailStatusData || emailStatusData.recentThreads.length === 0 ? (
        <div style={{ color: '#475569', fontSize: '0.82rem', padding: '8px 0' }}>No recent emails.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {emailStatusData.recentThreads.map((thread) => (
            <Link
              key={thread.id}
              to={`/email/thread/${thread.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 6px',
                borderBottom: '1px solid #f1f5f9',
                textDecoration: 'none',
                borderRadius: '4px',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.83rem',
                      color: '#16263f',
                      fontWeight: thread.isRead ? 500 : 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {thread.senderName}
                  </span>
                  {thread.clientOrProject && (
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      · {thread.clientOrProject}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {thread.subject}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                {thread.lastMessageAt && (
                  <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                    {new Date(thread.lastMessageAt).toLocaleTimeString('en-AU', {
                      timeZone: 'Australia/Melbourne',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                {thread.status === 'needs_reply' && (
                  <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    Reply
                  </span>
                )}
                {thread.status === 'flagged' && (
                  <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    Flagged
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        to="/email"
        style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}
      >
        Open Email Centre <ChevronRight size={13} />
      </Link>
    </div>
  );
};
