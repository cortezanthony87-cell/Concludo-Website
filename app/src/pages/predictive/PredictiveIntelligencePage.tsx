import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Shield,
  Activity,
  Compass,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart2,
  ChevronRight,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { PredictiveAnalysisResult, StrategicRecommendation, RiskPrediction } from '../../lib/predictive/types';
import { getPredictiveAnalysis } from '../../lib/predictive/predictiveService';

export const PredictiveIntelligencePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>('Loading Strategic Signals...');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PredictiveAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'risks' | 'opportunities' | 'recommendations' | 'decisions'>('overview');

  const loadData = async (refreshSnapshot = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setLoadingText(refreshSnapshot ? 'Refreshing Predictive Models...' : 'Calculating Health Score...');

    try {
      const result = await getPredictiveAnalysis({
        scope: 'individual',
        userId: user.id,
        saveSnapshot: refreshSnapshot,
      });
      setAnalysis(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load predictive intelligence. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const getRiskBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'high':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.3)' };
      case 'moderate':
        return { bg: 'rgba(234, 179, 8, 0.15)', text: '#fde047', border: 'rgba(234, 179, 8, 0.3)' };
      default:
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' };
    }
  };

  const getHealthCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'excellent':
        return { label: 'Excellent', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)' };
      case 'strong':
        return { label: 'Strong', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
      case 'stable':
        return { label: 'Stable', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)' };
      case 'at_risk':
        return { label: 'At Risk', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' };
      default:
        return { label: 'Critical Attention Needed', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' };
    }
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <RefreshCw size={36} className="spin-animation" style={{ color: '#e2b53c', marginBottom: '16px' }} />
        <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', marginBottom: '8px' }}>{loadingText}</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Analyzing project trajectories, decision velocity, and risk patterns...</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="page-content">
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <AlertCircle size={44} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#f8fafc', fontSize: '1.3rem', marginBottom: '8px' }}>Failed to load predictive intelligence</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>{error}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => loadData(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} />
            <span>Retry Analysis</span>
          </button>
        </div>
      </div>
    );
  }

  const healthBadge = getHealthCategoryBadge(analysis.healthScore.category);

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
              Predictive Intelligence
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', border: '1px solid rgba(226, 181, 60, 0.3)', fontWeight: 600 }}>
              Advisory AI
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            Strategic trajectory modeling, business risk prediction, and executive recommendations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadData(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} />
            <span>Recalculate Models</span>
          </button>
          <Link
            to="/forecasts"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <TrendingUp size={15} />
            <span>View Forecasts</span>
          </Link>
          <Link
            to="/executive-briefings"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <FileText size={15} />
            <span>Executive Briefing</span>
          </Link>
        </div>
      </div>

      {/* Top Health Scoring Hero Banner */}
      <div className="panel" style={{ marginBottom: '24px', padding: '24px', background: 'linear-gradient(135deg, rgba(22, 38, 63, 0.95) 0%, rgba(33, 57, 92, 0.8) 100%)', border: '1px solid rgba(226, 181, 60, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: `3px solid ${healthBadge.color}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 20px ${healthBadge.bg}`,
              }}
            >
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
                {analysis.healthScore.overallScore}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                / 100
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Organisational Health Standing
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, background: healthBadge.bg, color: healthBadge.color }}>
                  {healthBadge.label}
                </span>
              </div>
              <p style={{ color: '#f8fafc', margin: 0, fontSize: '0.98rem', maxWidth: '640px', lineHeight: 1.5 }}>
                {analysis.executiveIntelligence.strategicOverview}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', background: 'rgba(15, 23, 42, 0.5)', padding: '12px 18px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Active Momentum</div>
              <div style={{ color: '#38bdf8', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={16} />
                <span>{analysis.executiveIntelligence.businessMomentum.score}/100</span>
              </div>
            </div>
            <div style={{ width: '1px', background: 'rgba(148, 163, 184, 0.2)' }} />
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Operational Risk</div>
              <div style={{ color: getRiskBadgeColor(analysis.executiveIntelligence.operationalRisk.level).text, fontSize: '1.1rem', fontWeight: 700 }}>
                {analysis.executiveIntelligence.operationalRisk.level.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Component Category Scores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.15)' }}>
          {Object.entries(analysis.healthScore.categoryScores).map(([key, score]) => {
            const labelMap: Record<string, string> = {
              execution: 'Execution',
              delivery: 'Delivery',
              collaboration: 'Collaboration',
              decisionVelocity: 'Decision Velocity',
              actionCompletion: 'Action Completion',
              projectPerformance: 'Project Perf.',
              riskExposure: 'Risk Control',
            };
            return (
              <div key={key} style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '8px 12px', borderRadius: '6px' }} title={analysis.healthScore.explanations[key as keyof typeof analysis.healthScore.categoryScores]}>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'capitalize' }}>{labelMap[key] || key}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1rem' }}>{score}%</span>
                  <div style={{ width: '40px', height: '4px', background: 'rgba(148, 163, 184, 0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${score}%`, height: '100%', background: score >= 75 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', marginBottom: '20px', gap: '8px' }}>
        {[
          { id: 'overview', label: 'Predictions & Overview', icon: Compass },
          { id: 'risks', label: `Risks (${analysis.riskPredictions.length})`, icon: AlertTriangle },
          { id: 'opportunities', label: `Opportunities (${analysis.opportunitySignals.length})`, icon: Lightbulb },
          { id: 'recommendations', label: `Recommendations (${analysis.strategicRecommendations.length})`, icon: Sparkles },
          { id: 'decisions', label: `Decision Quality (${analysis.decisionQuality.decisions.length})`, icon: BarChart2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #e2b53c' : '2px solid transparent',
                color: isActive ? '#f8fafc' : '#94a3b8',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              <Icon size={16} color={isActive ? '#e2b53c' : '#94a3b8'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Top Strategic Recommendations */}
          <div className="panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#e2b53c" />
                <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                  Priority Strategic Recommendations
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('recommendations')}
                style={{ background: 'none', border: 'none', color: '#e2b53c', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>All ({analysis.strategicRecommendations.length})</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {analysis.strategicRecommendations.slice(0, 3).map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    padding: '14px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    borderLeft: `3px solid ${rec.priorityLevel === 'critical' ? '#f87171' : rec.priorityLevel === 'high' ? '#fb923c' : '#e2b53c'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem' }}>{rec.title}</span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.1)', color: '#e2b53c', textTransform: 'uppercase' }}>
                      {rec.priorityLevel}
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 8px 0', lineHeight: 1.4 }}>{rec.summary}</p>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                    Potential Benefit: {rec.potentialBenefits[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Risk Radar */}
          <div className="panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#f87171" />
                <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                  Active Risk Predictions
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('risks')}
                style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>All ({analysis.riskPredictions.length})</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {analysis.riskPredictions.map((risk) => {
                const badge = getRiskBadgeColor(risk.riskLevel);
                return (
                  <div
                    key={risk.id}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.88rem' }}>{risk.title}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: badge.bg, color: badge.text }}>
                        {risk.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>{risk.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategic Signals */}
          <div className="panel" style={{ padding: '20px', gridColumn: '1 / -1' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
              Predictive Strategic Signals
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {analysis.predictiveSignals.map((sig) => (
                <div key={sig.id} style={{ padding: '14px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.88rem' }}>{sig.title}</span>
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                      {sig.signalType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 8px 0', lineHeight: 1.4 }}>{sig.description}</p>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Evidence: {sig.evidence.join(' • ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Risks with Explicit Explanations */}
      {activeTab === 'risks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <h4 style={{ color: '#f8fafc', margin: '0 0 6px 0', fontSize: '0.95rem' }}>Risk Score Transparency</h4>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>
              Every risk score is backed by empirical operational records (overdue actions, blocked dependencies, pending decision latency). Scores range from Low to Critical.
            </p>
          </div>

          {analysis.riskPredictions.map((risk) => {
            const badge = getRiskBadgeColor(risk.riskLevel);
            return (
              <div
                key={risk.id}
                className="panel"
                style={{
                  padding: '20px',
                  borderLeft: `4px solid ${badge.text}`,
                  background: 'rgba(22, 38, 63, 0.7)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                      {risk.title}
                    </h3>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                      Category: {risk.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Risk Score: <strong>{risk.score}/100</strong></span>
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                      {risk.riskLevel.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '12px 16px', borderRadius: '6px', marginBottom: '12px' }}>
                  <div style={{ color: '#e2b53c', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Why this risk was identified:
                  </div>
                  <p style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                    {risk.explanation}
                  </p>
                </div>

                {risk.affectedEntities.length > 0 && (
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>Affected Items:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {risk.affectedEntities.map((item, idx) => (
                        <span key={idx} style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.1)', color: '#cbd5e1', fontSize: '0.78rem' }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Opportunities */}
      {activeTab === 'opportunities' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {analysis.opportunitySignals.map((opp) => (
            <div key={opp.id} className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{opp.title}</h3>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', fontWeight: 600, textTransform: 'uppercase' }}>
                    {opp.impact} Impact
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '12px' }}>
                  Category: {opp.category.replace(/_/g, ' ')}
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 14px 0' }}>{opp.summary}</p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '10px 12px', borderRadius: '6px' }}>
                <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>Estimated Operational Gain:</div>
                <div style={{ color: '#f8fafc', fontSize: '0.82rem', marginTop: '2px' }}>{opp.potentialGain}</div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '6px' }}>
                  Confidence: {opp.confidence.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Strategic Recommendations */}
      {activeTab === 'recommendations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {analysis.strategicRecommendations.map((rec) => (
            <div key={rec.id} className="panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px 0' }}>{rec.title}</h3>
                  <span style={{ color: '#e2b53c', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                    Target: {rec.category.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', textTransform: 'uppercase' }}>
                    Priority: {rec.priorityLevel}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    {rec.confidenceIndicator.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <p style={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '14px' }}>{rec.summary}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', background: 'rgba(15, 23, 42, 0.4)', padding: '14px', borderRadius: '6px' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Supporting Evidence:</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    {rec.supportingEvidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Potential Benefits:</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    {rec.potentialBenefits.map((ben, i) => (
                      <li key={i}>{ben}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Decision Quality Dashboard */}
      {activeTab === 'decisions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>High-Impact Decisions</div>
              <div style={{ color: '#f8fafc', fontSize: '1.6rem', fontWeight: 700, marginTop: '4px' }}>
                {analysis.decisionQuality.highImpactCount}
              </div>
            </div>
            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Successful Decisions</div>
              <div style={{ color: '#4ade80', fontSize: '1.6rem', fontWeight: 700, marginTop: '4px' }}>
                {analysis.decisionQuality.successfulCount}
              </div>
            </div>
            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Delayed / Unresolved</div>
              <div style={{ color: '#fb923c', fontSize: '1.6rem', fontWeight: 700, marginTop: '4px' }}>
                {analysis.decisionQuality.delayedCount + analysis.decisionQuality.unresolvedCount}
              </div>
            </div>
            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Decision Velocity Avg</div>
              <div style={{ color: '#38bdf8', fontSize: '1.6rem', fontWeight: 700, marginTop: '4px' }}>
                {analysis.decisionQuality.decisionVelocityDaysAverage} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>days</span>
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: '20px' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>
              Historical Decisions & Implementation Effectiveness
            </h3>
            {analysis.decisionQuality.decisions.length === 0 ? (
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>No decisions tracked yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analysis.decisionQuality.decisions.map((dec) => (
                  <div
                    key={dec.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: '6px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem' }}>{dec.decisionTitle}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                        {dec.projectName} • Date: {dec.decisionDate} • Velocity: {dec.decisionVelocityDays} days
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.1)', color: '#e2b53c' }}>
                        {dec.impact.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: dec.outcomeStatus === 'successful' ? '#4ade80' : '#fb923c' }}>
                        {dec.outcomeStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
