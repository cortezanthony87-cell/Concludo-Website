import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  BrainCircuit,
  CheckSquare,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
  ShieldAlert,
  Flame,
  Award,
  BarChart2,
  Calendar,
  Layers,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { usePermissions } from '../lib/permissions/usePermissions';
import { fetchUserInsights } from '../lib/intelligence/intelligenceClient';
import { InsightData } from '../lib/intelligence/types';

export const InsightPage: React.FC = () => {
  const { user } = useAuth();
  const { hasAccess, loading: checkingPermissions } = usePermissions('insight');

  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Conversation Intelligence — Concludo Workspace';
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchUserInsights({ forceRefresh: isRefresh });
      setInsights(data);
    } catch (err: any) {
      console.error('Failed to load insights:', err);
      setError(isRefresh ? 'Failed to refresh intelligence' : 'Failed to load insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (hasAccess) {
      loadData(false);
    }
  }, [hasAccess, loadData]);

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
            Conversation Intelligence & Insights
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
            Synthesize organizational memory across all meeting transcripts, decisions, and action items.
            Identify recurring risks, breakthrough opportunities, and execution bottlenecks automatically.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <Link
              to="/dashboard"
              className="action-button-secondary"
              style={{ textDecoration: 'none' }}
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading || checkingPermissions) {
    return (
      <div className="page-container" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <Loader2 size={40} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 16px auto' }} />
        <h3 style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.2rem', marginBottom: '8px' }}>
          Loading insights
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Synthesizing patterns across meetings, decisions, and tracked actions...
        </p>
      </div>
    );
  }

  // Error State
  if (error && !insights) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <div className="error-banner" style={{ margin: '0 auto', maxWidth: '600px' }}>
          <AlertCircle size={20} color="#f87171" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{error}</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              An error occurred while compiling your meeting intelligence.
            </div>
          </div>
          <button
            type="button"
            className="action-button-secondary"
            onClick={() => loadData(false)}
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasHistory = (insights?.projectIntelligenceSummary.totalProjects || 0) > 0;

  // Empty State: Not enough meeting history yet
  if (!hasHistory || (insights?.keyThemes.length === 0 && insights?.topRisks.length === 0)) {
    return (
      <div className="page-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            background: 'linear-gradient(145deg, #16263f 0%, #111d30 100%)',
            border: '1px solid rgba(226, 181, 60, 0.2)',
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
              border: '1px solid rgba(226, 181, 60, 0.4)',
            }}
          >
            <Sparkles size={32} color="#e2b53c" />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            Not enough meeting history yet.
          </h2>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.98rem',
              maxWidth: '500px',
              margin: '0 auto 28px auto',
              lineHeight: 1.6,
            }}
          >
            Create more projects to unlock insights. As you upload transcripts, record decisions, and track action items, Concludo Workspace will automatically map trends, recurring risks, and opportunities.
          </p>

          <Link
            to="/projects/new"
            className="action-button-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <span>Create Project</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const summary = insights!.projectIntelligenceSummary;
  const keyThemes = insights!.keyThemes;
  const topRisks = insights!.topRisks;
  const topOpportunities = insights!.topOpportunities;
  const recurringDecisions = insights!.recurringDecisions;
  const frequentlyAssigned = insights!.frequentlyAssignedActions;
  const discussedTopics = insights!.mostDiscussedTopics;
  const openActionTrends = insights!.openActionTrends;
  const overdueActionTrends = insights!.overdueActionTrends;

  return (
    <div className="page-container" style={{ padding: '32px 24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
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
              <Lightbulb size={20} color="#e2b53c" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Conversation Intelligence
            </h1>
            <span
              style={{
                background: 'rgba(226, 181, 60, 0.15)',
                border: '1px solid rgba(226, 181, 60, 0.3)',
                padding: '2px 8px',
                borderRadius: '12px',
                color: '#e2b53c',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              PRO INTELLIGENCE
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0 }}>
            Structured patterns, recurring risks, and opportunities distilled across {summary.totalProjects} saved meeting projects.
          </p>
        </div>

        <button
          type="button"
          className="action-button-secondary"
          onClick={() => loadData(true)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
        >
          {refreshing ? (
            <>
              <Loader2 size={16} className="spin-animation" color="#e2b53c" />
              <span>Refreshing intelligence...</span>
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              <span>Refresh Intelligence</span>
            </>
          )}
        </button>
      </div>

      {/* Project Intelligence Summary Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(22, 38, 63, 0.9) 0%, rgba(33, 57, 92, 0.8) 100%)',
          border: '1px solid rgba(226, 181, 60, 0.3)',
          borderRadius: '14px',
          padding: '24px',
          marginBottom: '32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Award size={18} color="#e2b53c" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Executive Intelligence Synthesis
            </h3>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.55, margin: 0 }}>
            {summary.summaryText}
          </p>
        </div>

        <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
            Meeting Health Score
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: summary.meetingHealthScore >= 75 ? '#4ade80' : '#f59e0b' }}>
            {summary.meetingHealthScore}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
            Execution velocity & action reliability
          </div>
        </div>

        <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
            Avg Commitments / Meeting
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#f8fafc' }}>
            {summary.avgDecisionsPerProject} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 400 }}>dec</span> / {summary.avgActionsPerProject} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 400 }}>act</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
            Conversion from dialogue to output
          </div>
        </div>
      </div>

      {/* Grid: Key Themes & Top Opportunities */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Key Themes Cards */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#e2b53c" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Key Themes
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {keyThemes.length} identified
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {keyThemes.map((theme: any) => (
              <div
                key={theme.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                    {theme.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(226, 181, 60, 0.15)',
                      color: '#e2b53c',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {theme.relevance}% relevance
                  </span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                  {theme.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Opportunities Cards */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#4ade80" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Top Opportunities
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {topOpportunities.length} high value
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topOpportunities.map((opp: any) => (
              <div
                key={opp.id}
                style={{
                  background: 'rgba(74, 222, 128, 0.04)',
                  border: '1px solid rgba(74, 222, 128, 0.2)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                    {opp.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(74, 222, 128, 0.15)',
                      color: '#4ade80',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {opp.impact} impact
                  </span>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: '0 0 6px 0', lineHeight: 1.45 }}>
                  {opp.description}
                </p>
                <div style={{ fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Next Step:</span>
                  <span style={{ color: '#94a3b8' }}>{opp.nextStep}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Top Risks & Action Trends */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Top Risks Cards */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#f87171" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Top Risks & Blockers
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {topRisks.length} flagged
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topRisks.map((risk: any) => (
              <div
                key={risk.id}
                style={{
                  background: 'rgba(248, 113, 113, 0.05)',
                  border: '1px solid rgba(248, 113, 113, 0.25)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                    {risk.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      background: risk.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: risk.severity === 'high' ? '#f87171' : '#fbbf24',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {risk.severity} risk
                  </span>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: '0 0 6px 0', lineHeight: 1.45 }}>
                  {risk.description}
                </p>
                <div style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Mitigation:</span>
                  <span style={{ color: '#94a3b8' }}>{risk.mitigationRecommendation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Trends & Overdue Action Trends */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={18} color="#e2b53c" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Action Trends & Bottlenecks
              </h3>
            </div>
            <Link to="/actions" style={{ color: '#e2b53c', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
              View all actions
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>Not Started</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>{openActionTrends.notStarted}</div>
            </div>

            <div
              style={{
                background: 'rgba(226, 181, 60, 0.05)',
                border: '1px solid rgba(226, 181, 60, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#e2b53c', marginBottom: '4px' }}>In Progress</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2b53c' }}>{openActionTrends.inProgress}</div>
            </div>

            <div
              style={{
                background: overdueActionTrends.count > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: overdueActionTrends.count > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: overdueActionTrends.count > 0 ? '#f87171' : '#94a3b8', marginBottom: '4px' }}>
                Overdue
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: overdueActionTrends.count > 0 ? '#f87171' : '#94a3b8' }}>
                {overdueActionTrends.count}
              </div>
            </div>
          </div>

          {/* Frequently Assigned Owners */}
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>
              Frequently Assigned Owners
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {frequentlyAssigned.map((item: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    fontSize: '0.84rem',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{item.owner}</span>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                    <span style={{ color: '#94a3b8' }}>{item.total} total</span>
                    <span style={{ color: '#4ade80' }}>{item.completed} done</span>
                    {item.overdue > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>{item.overdue} overdue</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Recurring Decisions & Most Discussed Topics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Recurring Decisions */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BrainCircuit size={18} color="#e2b53c" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Decision Patterns
              </h3>
            </div>
            <Link to="/decision-memory" style={{ color: '#e2b53c', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
              Decision Memory
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recurringDecisions.map((dec: any) => (
              <div
                key={dec.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem', marginBottom: '4px' }}>
                  {dec.title}
                </div>
                {dec.summary && (
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                    {dec.summary}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748b' }}>
                  <span>Owner: {dec.owner || 'Executive Committee'}</span>
                  {dec.date && <span>{dec.date}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Discussed Topics */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={18} color="#e2b53c" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Most Discussed Topics
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Frequency distribution
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {discussedTopics.map((topic: any, idx: number) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '4px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 500 }}>{topic.topic}</span>
                  <span style={{ color: '#e2b53c', fontWeight: 600 }}>{topic.mentions} occurrences</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(10, Math.min(100, topic.percentage))}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #e2b53c 0%, #bc8a1c 100%)',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
