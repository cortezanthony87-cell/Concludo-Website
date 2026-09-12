import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  FolderKanban,
  FileText,
  BrainCircuit,
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Lock,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { usePermissions } from '../lib/permissions/usePermissions';
import { fetchUserStats } from '../lib/intelligence/intelligenceClient';
import { StatsData, StatsPeriodFilter, TrendDataPoint } from '../lib/intelligence/types';

export const StatsPage: React.FC = () => {
  const { user } = useAuth();
  const { hasAccess, loading: checkingPermissions } = usePermissions('stats');

  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterPeriod, setFilterPeriod] = useState<StatsPeriodFilter>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Workspace Analytics & Stats — Concludo Workspace';
  }, []);

  const loadData = useCallback(async (period: StatsPeriodFilter, isRefresh = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchUserStats(period, { forceRefresh: isRefresh });
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (hasAccess) {
      loadData(filterPeriod, false);
    }
  }, [hasAccess, filterPeriod, loadData]);

  // Permission Gate
  if (!checkingPermissions && !hasAccess) {
    return (
      <div className="page-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            background: 'linear-gradient(145deg, #16263f 0%, #111d30 100%)',
            border: '1px solid rgba(226, 181, 60, 0.3)',
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(226, 181, 60, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              border: '1px solid #e2b53c',
            }}
          >
            <Lock size={32} color="#e2b53c" />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(226, 181, 60, 0.15)',
              border: '1px solid rgba(226, 181, 60, 0.4)',
              padding: '4px 12px',
              borderRadius: '20px',
              color: '#e2b53c',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '16px',
            }}
          >
            Available on Pro
          </div>

          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
            Workspace Analytics & Stats
          </h2>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '1rem',
              maxWidth: '560px',
              margin: '0 auto 28px auto',
              lineHeight: 1.6,
            }}
          >
            Unlock historical performance metrics across your meeting portfolio. Track decision volume,
            action item closure velocity, and transcript volume trends across custom reporting periods.
          </p>

          <Link to="/dashboard" className="action-button-secondary" style={{ textDecoration: 'none' }}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading && !stats) {
    return (
      <div className="page-container" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <Loader2 size={40} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 16px auto' }} />
        <h3 style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.2rem', marginBottom: '8px' }}>
          Loading statistics
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Generating analytics across projects, transcripts, and commitments...
        </p>
      </div>
    );
  }

  // Error State
  if (error && !stats) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <div className="error-banner" style={{ margin: '0 auto', maxWidth: '600px' }}>
          <AlertCircle size={20} color="#f87171" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{error}</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              Failed to compile workspace trend analytics.
            </div>
          </div>
          <button
            type="button"
            className="action-button-secondary"
            onClick={() => loadData(filterPeriod, true)}
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const trends = stats?.trends;

  // Chart rendering helper: Clean Bar Chart
  const renderBarChart = (
    data: TrendDataPoint[],
    color: string,
    barLabel: string,
    secondaryData?: TrendDataPoint[],
    secondaryColor?: string,
    secondaryLabel?: string
  ) => {
    const maxVal = Math.max(
      1,
      ...data.map((d) => d.count),
      ...(secondaryData ? secondaryData.map((d) => d.count) : [0])
    );

    return (
      <div style={{ width: '100%', marginTop: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            height: '140px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {data.map((item, idx) => {
            const hPercent = Math.max(8, Math.round((item.count / maxVal) * 100));
            const secHPercent = secondaryData
              ? Math.max(8, Math.round(((secondaryData[idx]?.count || 0) / maxVal) * 100))
              : 0;

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%' }}>
                  <div
                    style={{
                      width: secondaryData ? '14px' : '28px',
                      height: `${hPercent}%`,
                      background: color,
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                    title={`${item.period}: ${item.count} ${barLabel}`}
                  />
                  {secondaryData && (
                    <div
                      style={{
                        width: '14px',
                        height: `${secHPercent}%`,
                        background: secondaryColor || '#4ade80',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                      title={`${item.period}: ${secondaryData[idx]?.count || 0} ${secondaryLabel}`}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                    marginTop: '8px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '48px',
                    textAlign: 'center',
                  }}
                >
                  {item.period.split(' ')[0]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.78rem', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', background: color, borderRadius: '2px' }} />
            <span>{barLabel}</span>
          </div>
          {secondaryData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', background: secondaryColor || '#4ade80', borderRadius: '2px' }} />
              <span>{secondaryLabel}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-container" style={{ padding: '32px 24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header & Filter Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(226, 181, 60, 0.15)',
                border: '1px solid rgba(226, 181, 60, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BarChart3 size={20} color="#e2b53c" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Workspace Stats & Trends
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0 }}>
            Comprehensive analytics tracking meeting volume, decision capture, and action item closure rate.
          </p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Filter size={15} color="#94a3b8" />
          <span style={{ fontSize: '0.82rem', color: '#94a3b8', marginRight: '4px' }}>Range:</span>

          {[
            { key: '30d', label: 'Last 30 Days' },
            { key: '90d', label: 'Last 90 Days' },
            { key: '6m', label: 'Last 6 Months' },
            { key: '12m', label: 'Last 12 Months' },
            { key: 'all', label: 'All Time' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterPeriod(f.key as StatsPeriodFilter)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: filterPeriod === f.key ? 700 : 500,
                background: filterPeriod === f.key ? '#e2b53c' : 'rgba(255, 255, 255, 0.05)',
                color: filterPeriod === f.key ? '#0f172a' : '#cbd5e1',
                border: '1px solid',
                borderColor: filterPeriod === f.key ? '#e2b53c' : 'rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          ))}

          <button
            type="button"
            className="action-button-secondary"
            onClick={() => loadData(filterPeriod, true)}
            style={{ padding: '6px 12px', marginLeft: '4px' }}
            title="Refresh statistics"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid (10 Core Metrics) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {/* Total Projects */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Projects</span>
            <FolderKanban size={16} color="#e2b53c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {stats?.totalProjects ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            Saved project workspaces
          </div>
        </div>

        {/* Total Transcripts */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Transcripts</span>
            <FileText size={16} color="#e2b53c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {stats?.totalTranscripts ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            Transcript archives logged
          </div>
        </div>

        {/* Total Decisions */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Decisions</span>
            <BrainCircuit size={16} color="#e2b53c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {stats?.totalDecisions ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            Logged in Decision Memory
          </div>
        </div>

        {/* Total Actions */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Actions</span>
            <CheckSquare size={16} color="#e2b53c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {stats?.totalActions ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            Commitments tracked
          </div>
        </div>

        {/* Completed Actions */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Completed Actions</span>
            <CheckCircle2 size={16} color="#4ade80" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#4ade80', marginTop: '8px' }}>
            {stats?.completedActions ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            {stats?.actionCompletionRate ?? 0}% overall closure rate
          </div>
        </div>

        {/* Open Actions */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Open Actions</span>
            <Clock size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '8px' }}>
            {stats?.openActions ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            In-flight deliverables
          </div>
        </div>

        {/* Overdue Actions */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Overdue Actions</span>
            <AlertTriangle size={16} color="#f87171" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: (stats?.overdueActions || 0) > 0 ? '#f87171' : '#f8fafc', marginTop: '8px' }}>
            {stats?.overdueActions ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            Past target deadline
          </div>
        </div>

        {/* Projects This Month / Quarter / Year */}
        <div className="section-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Project Cadence</span>
            <Calendar size={16} color="#e2b53c" />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {stats?.projectsThisMonth ?? 0} <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 400 }}>mo</span> • {stats?.projectsThisQuarter ?? 0} <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 400 }}>qtr</span> • {stats?.projectsThisYear ?? 0} <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 400 }}>yr</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            Velocity this calendar year
          </div>
        </div>
      </div>

      {/* Visualisation Section: Interactive Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Monthly Project Activity & Meeting Volume */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#e2b53c" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Monthly Project Activity & Meeting Volume
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Last 6 months</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
            Frequency of recorded sessions and project workspaces initialized.
          </p>

          {trends ? (
            renderBarChart(trends.projectsCreated, '#e2b53c', 'Projects')
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No trend data</div>
          )}
        </div>

        {/* Monthly Actions: Created vs Completed */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={18} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Monthly Actions: Created vs Completed
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Execution velocity</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
            Comparison of new commitments tracked against closed deliverables.
          </p>

          {trends ? (
            renderBarChart(
              trends.actionsCreated,
              '#38bdf8',
              'Created',
              trends.actionsCompleted,
              '#4ade80',
              'Completed'
            )
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No trend data</div>
          )}
        </div>
      </div>

      {/* Second Row of Charts: Monthly Decisions & Completion Rates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        {/* Monthly Decisions */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BrainCircuit size={18} color="#e2b53c" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Monthly Decisions Recorded
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Decision Velocity</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
            Formal organizational decisions archived into Decision Memory.
          </p>

          {trends ? (
            renderBarChart(trends.decisionsCreated, '#bc8a1c', 'Decisions')
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No trend data</div>
          )}
        </div>

        {/* Completion Rates & Output Generation */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#e2b53c" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Output Generation Volume
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Synthesis rate</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
            Structured outputs (Action Plans, Decision Logs, Emails) generated.
          </p>

          {trends ? (
            renderBarChart(trends.outputGeneration, '#e2b53c', 'Outputs')
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No trend data</div>
          )}
        </div>
      </div>
    </div>
  );
};
