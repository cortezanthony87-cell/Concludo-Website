import React, { useState, useEffect } from 'react';
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  CheckCircle,
  FileText,
  RefreshCw,
  Lock,
  ArrowUpRight,
  BarChart3,
  Users,
  Compass,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { ExecutiveIntelligenceData } from '../../lib/predictive/types';
import { getPredictiveAnalysis } from '../../lib/predictive/predictiveService';

export const ExecutiveIntelligencePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ExecutiveIntelligenceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEnterprise = profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.role === 'admin';

  const loadData = async () => {
    if (!user || !isEnterprise) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getPredictiveAnalysis({
        scope: 'organization',
        userId: user.id,
      });
      setData(result.executiveIntelligence);
    } catch (err: any) {
      setError(err?.message || 'Failed to load executive intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, profile?.plan]);

  if (!isEnterprise) {
    return (
      <div className="page-content">
        <div className="panel" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '640px', margin: '40px auto' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(226, 181, 60, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(226, 181, 60, 0.3)' }}>
            <Lock size={32} color="#e2b53c" />
          </div>
          <h2 style={{ color: '#f8fafc', fontSize: '1.4rem', fontWeight: 700, marginBottom: '10px' }}>
            Executive Intelligence is an Enterprise Capability
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Executive Intelligence provides board-ready strategic summaries, cross-organization momentum scoring, operational risk synthesis, and high-level leadership recommendations.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/predictive-intelligence" className="btn btn-secondary">
              Predictive Intelligence Overview
            </Link>
            <a href="mailto:hello@concludo.au?subject=Enterprise%20Upgrade%20Inquiry" className="btn btn-primary">
              Contact Enterprise Sales
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <RefreshCw size={36} className="spin-animation" style={{ color: '#e2b53c', marginBottom: '16px' }} />
        <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', marginBottom: '8px' }}>Generating Executive Intelligence...</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Aggregating board-level signals, cross-team health, and strategic trajectories...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-content">
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <AlertTriangle size={44} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#f8fafc', fontSize: '1.3rem', marginBottom: '8px' }}>Failed to load Executive Intelligence</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>{error}</p>
          <button type="button" className="btn btn-primary" onClick={loadData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
              Executive Intelligence
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', border: '1px solid rgba(226, 181, 60, 0.3)', fontWeight: 600 }}>
              Enterprise Leadership Portal
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            Executive-grade operational synthesis, organizational risk, and strategic guidance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <Link to="/executive-briefings" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} />
            <span>Generate Briefing</span>
          </Link>
        </div>
      </div>

      {/* Strategic Overview Hero */}
      <div className="panel" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(22, 38, 63, 0.95) 0%, rgba(33, 57, 92, 0.8) 100%)', border: '1px solid rgba(226, 181, 60, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Compass size={20} color="#e2b53c" />
          <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Strategic Leadership Overview
          </h2>
        </div>
        <p style={{ color: '#e2e8f0', fontSize: '1.05rem', lineHeight: 1.6, margin: 0, maxWidth: '900px' }}>
          {data.strategicOverview}
        </p>
      </div>

      {/* KPI Cards: Business Momentum, Execution Health, Decision Health, Collaboration Health, Operational Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Business Momentum</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>{data.businessMomentum.score}</span>
            <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}>Trend: {data.businessMomentum.trend.toUpperCase()}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0', lineHeight: 1.4 }}>
            {data.businessMomentum.commentary}
          </p>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Execution Health</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ade80' }}>{data.executionHealth}%</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0', lineHeight: 1.4 }}>
            Measured against deliverable milestones and sprint accountability.
          </p>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Decision Velocity</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>{data.decisionHealth}%</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0', lineHeight: 1.4 }}>
            Sign-off cadence across ratified architectural and commercial decisions.
          </p>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Operational Risk Exposure</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: data.operationalRisk.level === 'low' ? '#4ade80' : '#fb923c' }}>
              {data.operationalRisk.level.toUpperCase()}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '8px 0 0 0', lineHeight: 1.4 }}>
            {data.operationalRisk.summary}
          </p>
        </div>
      </div>

      {/* Growth Indicators & Key Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Growth Indicators */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart3 size={18} color="#38bdf8" />
            <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
              Organizational Growth Indicators
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.growthIndicators.map((ind, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '6px' }}>
                <CheckCircle size={16} color="#4ade80" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.4 }}>{ind}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Recommendations */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Sparkles size={18} color="#e2b53c" />
            <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
              Leadership Action Recommendations
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.keyRecommendations.map((rec) => (
              <div key={rec.id} style={{ padding: '12px 14px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.4)', borderLeft: '3px solid #e2b53c' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{rec.title}</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', textTransform: 'uppercase' }}>
                    {rec.priorityLevel}
                  </span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>{rec.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
