import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BrainCircuit,
  Sparkles,
  Lock,
  Calendar,
  User,
  FolderKanban,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Loader2,
  FileText,
  Plus,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { fetchDecisions } from '../lib/decisions/decisionClient';
import { DecisionRecord } from '../lib/decisions/types';

export const DecisionMemoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { supabase } = useAuth();
  const featureAccess = useFeatureAccess('decision_memory');

  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDecisions = useCallback(async () => {
    if (!featureAccess.isAllowed) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await fetchDecisions(supabase);

    if (fetchErr) {
      setError(fetchErr.message || 'Failed to load decisions');
      setDecisions([]);
    } else {
      setDecisions(data || []);
    }
    setLoading(false);
  }, [supabase, featureAccess.isAllowed]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date recorded';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // If user lacks permission: Show "Available on Pro" and prevent access
  if (!featureAccess.isAllowed) {
    return (
      <div className="workspace-page-container">
        <div className="page-header">
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>INSTITUTIONAL KNOWLEDGE REPOSITORY</span>
          </div>
          <h1 className="page-title">Decision Memory</h1>
          <p className="page-subtitle">A historical record of organizational choices, context, and reasoning.</p>
        </div>

        <div
          className="content-card"
          style={{
            textAlign: 'center',
            padding: '72px 32px',
            backgroundColor: '#16263f',
            borderRadius: '16px',
            border: '1px solid rgba(226, 181, 60, 0.25)',
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '16px',
              backgroundColor: 'rgba(226, 181, 60, 0.12)',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              color: '#e2b53c',
            }}
          >
            <Lock size={32} />
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: 'rgba(226, 181, 60, 0.2)',
              color: '#f3c958',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '14px',
              border: '1px solid rgba(226, 181, 60, 0.4)',
            }}
          >
            Available on Pro
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>
            Decision Memory is a Pro Feature
          </h2>
          <p
            style={{
              color: '#94a3b8',
              maxWidth: '520px',
              margin: '0 auto 24px',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
          >
            Decision Memory indexes agreed decisions, rationale, and stakeholders across your meetings so you can easily
            track what was decided, by whom, and why.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/dashboard')}
            style={{ padding: '10px 24px', fontSize: '0.92rem' }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page-container">
      {/* Page Header */}
      <div className="page-header-row" style={{ marginBottom: '24px' }}>
        <div>
          <div className="page-breadcrumbs">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-active">Decision Memory</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BrainCircuit size={26} color="#e2b53c" />
            <span>Decision Memory</span>
          </h1>
          <p className="page-subtitle">A historical record of organizational choices, context, and reasoning.</p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div
          className="loading-container"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#16263f',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Loader2 size={32} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '6px' }}>Loading decisions</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Fetching indexed meeting decisions...</p>
        </div>
      )}

      {/* Error State with required retry support */}
      {!loading && error && (
        <div
          className="error-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={22} color="#f87171" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.95rem' }}>Failed to load decisions</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadDecisions}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && decisions.length === 0 && (
        <div
          style={{
            padding: '72px 24px',
            textAlign: 'center',
            backgroundColor: '#16263f',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <BrainCircuit size={40} color="#64748b" style={{ margin: '0 auto 18px' }} />
          <h2 style={{ color: '#f8fafc', fontSize: '1.3rem', fontWeight: 600, marginBottom: '8px' }}>
            No decisions saved yet
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 24px' }}>
            Saved decisions from Decision Logs will appear here.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/projects')}
            style={{ padding: '8px 20px', fontSize: '0.9rem' }}
          >
            Go to Projects
          </button>
        </div>
      )}

      {/* Decisions List */}
      {!loading && !error && decisions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {decisions.map((dec) => {
            const projectName = dec.projects?.title || dec.projects?.project_name || 'Untitled Project';

            return (
              <div
                key={dec.id}
                style={{
                  backgroundColor: '#16263f',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '20px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#93c5fd',
                      }}
                    >
                      <FolderKanban size={13} />
                      <span>{projectName}</span>
                    </span>

                    {dec.decision_owner && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.8rem',
                          color: '#e2b53c',
                          backgroundColor: 'rgba(226, 181, 60, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        <User size={12} />
                        <span>Owner: {dec.decision_owner}</span>
                      </span>
                    )}

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                      }}
                    >
                      <Calendar size={13} />
                      <span>{formatDate(dec.decision_date)}</span>
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 600,
                      color: '#f8fafc',
                      marginBottom: '8px',
                    }}
                  >
                    <Link
                      to={`/decision-memory/${dec.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#e2b53c')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#f8fafc')}
                    >
                      {dec.decision_title}
                    </Link>
                  </h3>

                  {dec.decision_summary && (
                    <p
                      style={{
                        color: '#cbd5e1',
                        fontSize: '0.92rem',
                        lineHeight: 1.55,
                        margin: '0 0 10px',
                      }}
                    >
                      {dec.decision_summary}
                    </p>
                  )}

                  {dec.decision_reasoning && (
                    <div
                      style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                        borderLeft: '3px solid #c084fc',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        fontStyle: 'italic',
                      }}
                    >
                      Reasoning: {dec.decision_reasoning}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/projects/${dec.project_id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                    }}
                    title="Open Source Project"
                  >
                    <span>Open Project</span>
                    <ExternalLink size={14} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/decision-memory/${dec.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span>Details</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
