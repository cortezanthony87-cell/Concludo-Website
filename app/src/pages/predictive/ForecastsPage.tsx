import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  BarChart3,
  Layers,
  ArrowRight,
  RefreshCw,
  FolderKanban,
  CheckSquare,
  BrainCircuit,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import { ForecastTimeframe, ForecastOutput } from '../../lib/predictive/types';
import { getPredictiveAnalysis } from '../../lib/predictive/predictiveService';

export const ForecastsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<Record<ForecastTimeframe, ForecastOutput> | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<ForecastTimeframe>('90_day');
  const [activeCategory, setActiveCategory] = useState<'all' | 'projects' | 'actions' | 'decisions' | 'organization'>('all');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPredictiveAnalysis({
        scope: 'individual',
        userId: user.id,
      });
      setForecasts(result.forecasts);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate operational forecasts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <RefreshCw size={36} className="spin-animation" style={{ color: '#e2b53c', marginBottom: '16px' }} />
        <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', marginBottom: '8px' }}>Generating Operational Forecasts...</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Modeling completion trajectories, workload shifts, and organizational trends...</p>
      </div>
    );
  }

  if (error || !forecasts) {
    return (
      <div className="page-content">
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <AlertTriangle size={44} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#f8fafc', fontSize: '1.3rem', marginBottom: '8px' }}>Failed to generate forecasts</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>{error}</p>
          <button type="button" className="btn btn-primary" onClick={loadData}>
            Retry Forecast Generation
          </button>
        </div>
      </div>
    );
  }

  const currentForecast = forecasts[activeTimeframe] || forecasts['90_day'];

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
              Operational & Strategic Forecasts
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}>
              Predictive Trajectories
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            Multi-horizon project completion rates, workload changes, and capacity projections.
          </p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={15} />
          <span>Refresh Forecasts</span>
        </button>
      </div>

      {/* Timeframe Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: '30_day', label: '30 Day Forecast' },
          { id: '90_day', label: '90 Day Forecast' },
          { id: '180_day', label: '180 Day Forecast' },
          { id: '12_month', label: '12 Month Forecast' },
          { id: 'custom', label: 'Custom Range' },
        ].map((tf) => {
          const isActive = activeTimeframe === tf.id;
          return (
            <button
              key={tf.id}
              type="button"
              onClick={() => setActiveTimeframe(tf.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: isActive ? '1px solid #e2b53c' : '1px solid rgba(148, 163, 184, 0.2)',
                background: isActive ? 'rgba(226, 181, 60, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                color: isActive ? '#e2b53c' : '#94a3b8',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {/* Category Filter Tabs: Project, Action, Decision, Organization */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '10px' }}>
        {[
          { id: 'all', label: 'All Forecasts', icon: Layers },
          { id: 'projects', label: 'Project Forecasts', icon: FolderKanban },
          { id: 'actions', label: 'Action Forecasts', icon: CheckSquare },
          { id: 'decisions', label: 'Decision Forecasts', icon: BrainCircuit },
          { id: 'organization', label: 'Organization Forecasts', icon: Building2 },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards: Expected Completion Rates, Workload Changes, Project Growth, Activity Changes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Expected Completion Rate</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ade80' }}>
              {currentForecast.expectedCompletionRates.projectedPercent}%
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              (Current: {currentForecast.expectedCompletionRates.currentPercent}%)
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0' }}>
            {currentForecast.expectedCompletionRates.unit}
          </p>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Workload Trajectory</div>
          <div style={{ color: '#38bdf8', fontSize: '1.2rem', fontWeight: 700, marginTop: '6px' }}>
            {currentForecast.workloadChanges.projectLoadTrend}
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0' }}>
            {currentForecast.workloadChanges.actionVelocityTrend}
          </p>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Project Portfolio Growth</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>
              {currentForecast.projectGrowth.projectedCount}
            </span>
            <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 }}>
              +{currentForecast.projectGrowth.growthRatePercent}%
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0' }}>
            Active initiatives projected across this timeframe.
          </p>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Organizational Activity</div>
          <div style={{ color: '#e2b53c', fontSize: '1.2rem', fontWeight: 700, marginTop: '6px', textTransform: 'capitalize' }}>
            {currentForecast.activityChanges.trend}
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0' }}>
            {currentForecast.activityChanges.description}
          </p>
        </div>
      </div>

      {/* Projection Chart & Trajectory Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* SVG Trajectory Chart */}
        <div className="panel" style={{ padding: '20px' }}>
          <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#e2b53c" />
            <span>Projected Completion Trajectory</span>
          </h3>

          <div style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '16px 8px 0 8px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px' }}>
            {currentForecast.dataPoints.map((pt, idx) => (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                  {pt.forecast}%
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '40px',
                    height: `${(pt.forecast / 100) * 120}px`,
                    background: idx === 0 ? '#e2b53c' : 'linear-gradient(180deg, #38bdf8 0%, rgba(56, 189, 248, 0.3) 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '8px' }}>
                  {pt.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expected Trends */}
        <div className="panel" style={{ padding: '20px' }}>
          <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#4ade80" />
            <span>Expected Operational Trends</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentForecast.expectedTrends.map((trend, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '6px' }}>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>•</span>
                <span style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.4 }}>{trend}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Potential Risks & Organizational Signals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        <div className="panel" style={{ padding: '20px' }}>
          <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#f87171" />
            <span>Potential Forecast Risks</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentForecast.potentialRisks.map((risk, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #f87171' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.4 }}>{risk}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#e2b53c" />
            <span>Organizational Signals</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentForecast.organizationalSignals.map((signal, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #e2b53c' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.4 }}>{signal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
