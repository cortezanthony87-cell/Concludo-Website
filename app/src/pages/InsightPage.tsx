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
  Users,
  User,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { usePermissions } from '../lib/permissions/usePermissions';
import { fetchUserInsights, fetchTeamInsights } from '../lib/intelligence/intelligenceClient';
import { InsightData } from '../lib/intelligence/types';
import { fetchUserTeams } from '../lib/teams/teamClient';
import { Team, TeamRole } from '../lib/teams/types';

export const InsightPage: React.FC = () => {
  const { user, supabase } = useAuth();
  const { hasAccess, loading: checkingPermissions } = usePermissions('insight');
  const { hasAccess: hasTeamAccess } = usePermissions('team_workspace');

  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Workspace Scope
  const [workspaceMode, setWorkspaceMode] = useState<'personal' | 'team'>('personal');
  const [userTeams, setUserTeams] = useState<(Team & { currentRole: TeamRole })[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    document.title = 'Conversation Intelligence — Concludo Workspace';
  }, []);

  // Load user teams if team access is enabled
  useEffect(() => {
    async function loadTeams() {
      if (!supabase || !hasTeamAccess) return;
      const res = await fetchUserTeams(supabase);
      if (res.data && res.data.length > 0) {
        setUserTeams(res.data);
        setSelectedTeamId(res.data[0].id);
      }
    }
    loadTeams();
  }, [supabase, hasTeamAccess]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user || !supabase) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      let data: InsightData;
      if (workspaceMode === 'team' && selectedTeamId) {
        data = await fetchTeamInsights(selectedTeamId, { supabase, forceRefresh: isRefresh });
      } else {
        data = await fetchUserInsights({ supabase, forceRefresh: isRefresh });
      }
      setInsights(data);
    } catch (err: any) {
      console.error('Failed to load insights:', err);
      setError(isRefresh ? 'Failed to refresh intelligence' : 'Failed to load insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, supabase, workspaceMode, selectedTeamId]);

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
              background: 'rgba(226, 181, 60, 0.1)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
            }}
          >
            <Lock size={28} color="#e2b53c" />
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
        {/* Workspace Mode Bar */}
        {hasTeamAccess && userTeams.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => setWorkspaceMode('personal')}
              className={workspaceMode === 'personal' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <User size={14} />
              <span>Personal Intelligence</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode('team')}
              className={workspaceMode === 'team' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <Users size={14} />
              <span>Team Intelligence</span>
            </button>
          </div>
        )}

        <div
          style={{
            background: 'linear-gradient(145deg, #16263f 0%, #111d30 100%)',
            border: '1px solid rgba(226, 181, 60, 0.2)',
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(226, 181, 60, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <Lightbulb size={28} color="#e2b53c" />
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
            {workspaceMode === 'team'
              ? 'Create more shared team projects to unlock team insights. Team intelligence maps patterns across all shared records in this team.'
              : 'Create more projects to unlock insights. As you upload transcripts, record decisions, and track action items, Concludo Workspace will automatically map trends, recurring risks, and opportunities.'}
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
              {workspaceMode === 'team' ? 'TEAM INTELLIGENCE' : 'PRO INTELLIGENCE'}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0 }}>
            Structured patterns, recurring risks, and opportunities distilled across {summary.totalProjects} {workspaceMode === 'team' ? 'team' : 'saved'} meeting projects.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Workspace Mode Selector */}
          {hasTeamAccess && userTeams.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#16263f', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setWorkspaceMode('personal')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: workspaceMode === 'personal' ? '#e2b53c' : 'transparent',
                  color: workspaceMode === 'personal' ? '#0f172a' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <User size={13} />
                <span>Personal</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('team')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: workspaceMode === 'team' ? '#e2b53c' : 'transparent',
                  color: workspaceMode === 'team' ? '#0f172a' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Users size={13} />
                <span>Team</span>
              </button>

              {workspaceMode === 'team' && userTeams.length > 1 && (
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                  }}
                >
                  {userTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

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
      </div>

      {/* Project Intelligence Summary Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #16263f 0%, #1a2f4d 100%)',
          border: '1px solid rgba(226, 181, 60, 0.3)',
          borderRadius: '14px',
          padding: '24px 28px',
          marginBottom: '28px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Sparkles size={18} color="#e2b53c" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Executive Intelligence Summary
          </h2>
        </div>

        <p style={{ color: '#cbd5e1', fontSize: '0.98rem', lineHeight: 1.6, margin: '0 0 20px 0' }}>
          {summary.summaryText}
        </p>

        {/* Metric Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Workspace Health
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: summary.meetingHealthScore > 70 ? '#4ade80' : summary.meetingHealthScore > 40 ? '#facc15' : '#f87171', marginTop: '2px' }}>
              {summary.meetingHealthScore}/100
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Analyzed Projects
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {summary.totalProjects}
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Decisions / Project
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2b53c', marginTop: '2px' }}>
              {summary.avgDecisionsPerProject.toFixed(1)}
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Actions / Project
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
              {summary.avgActionsPerProject.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Themes, Risks, Opportunities */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Key Themes */}
        <div style={{ background: '#16263f', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={18} color="#e2b53c" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Key Themes
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {keyThemes.map((th, idx) => (
              <div key={idx} style={{ background: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.92rem' }}>{th.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#e2b53c', background: 'rgba(226, 181, 60, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    {th.count} mentions
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {th.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Risks */}
        <div style={{ background: '#16263f', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShieldAlert size={18} color="#f87171" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Top Risks
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topRisks.map((rk, idx) => (
              <div key={idx} style={{ background: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#fecaca', fontSize: '0.92rem' }}>{rk.title}</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: rk.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                      color: rk.severity === 'high' ? '#f87171' : '#facc15',
                    }}
                  >
                    {rk.severity}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4, marginBottom: '6px' }}>
                  {rk.description}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#e2b53c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Mitigation:</span>
                  <span style={{ color: '#cbd5e1' }}>{rk.mitigationRecommendation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Opportunities */}
        <div style={{ background: '#16263f', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award size={18} color="#4ade80" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Top Opportunities
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topOpportunities.map((op, idx) => (
              <div key={idx} style={{ background: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#bbf7d0', fontSize: '0.92rem' }}>{op.title}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80' }}>
                    {op.impact}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4, marginBottom: '6px' }}>
                  {op.nextStep}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision Trends & Action Trends */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Recurring Decisions */}
        <div style={{ background: '#16263f', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BrainCircuit size={18} color="#e2b53c" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Recurring Decisions
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recurringDecisions.map((dec, idx) => (
              <div key={idx} style={{ background: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {dec.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Owner: {dec.owner || 'Unassigned'}</span>
                  <span>{dec.date || ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Trends & Bottlenecks */}
        <div style={{ background: '#16263f', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <CheckSquare size={18} color="#38bdf8" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Action Trends & Bottlenecks
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Open</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>{openActionTrends.totalOpen}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>In Progress</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#facc15' }}>{openActionTrends.inProgress}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Overdue</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171' }}>{overdueActionTrends.count}</div>
            </div>
          </div>

          {frequentlyAssigned.length > 0 && (
            <div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '8px' }}>
                Frequently Assigned Owners:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {frequentlyAssigned.map((as, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', background: '#0f172a', padding: '6px 10px', borderRadius: '6px' }}>
                    <span style={{ color: '#f1f5f9' }}>{as.owner}</span>
                    <span style={{ color: '#94a3b8' }}>{as.total} actions ({as.overdue} overdue)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
