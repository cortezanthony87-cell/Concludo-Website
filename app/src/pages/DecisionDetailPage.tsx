import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BrainCircuit,
  ArrowLeft,
  Calendar,
  User,
  FolderKanban,
  FileText,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { fetchDecisionById } from '../lib/decisions/decisionClient';
import { DecisionRecord } from '../lib/decisions/types';

export const DecisionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase } = useAuth();
  const featureAccess = useFeatureAccess('decision_memory');

  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDecision = useCallback(async () => {
    if (!id) return;
    if (!featureAccess.isAllowed) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await fetchDecisionById(supabase, id);

    if (fetchErr) {
      setError(fetchErr.message || 'Failed to load decision');
      setDecision(null);
    } else {
      setDecision(data);
    }
    setLoading(false);
  }, [supabase, id, featureAccess.isAllowed]);

  useEffect(() => {
    loadDecision();
  }, [loadDecision]);

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

  if (!featureAccess.isAllowed) {
    return (
      <div className="workspace-page-container">
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
              width: '64px',
              height: '64px',
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
      {/* Back button & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/decision-memory')}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Decision Memory</span>
        </button>
        <div className="page-breadcrumbs">
          <Link to="/decision-memory" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Decision Memory
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-active">Decision Detail</span>
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
          <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '6px' }}>Loading decision</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Fetching decision context and reasoning...</p>
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
              <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.95rem' }}>Failed to load decision</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadDecision}
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

      {/* Decision Detail Content */}
      {!loading && !error && decision && (
        <div
          style={{
            backgroundColor: '#16263f',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '32px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '24px',
              marginBottom: '24px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc',
                  border: '1px solid rgba(192, 132, 252, 0.3)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '12px',
                }}
              >
                <BrainCircuit size={14} />
                <span>Decision Record</span>
              </div>

              <h1
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  marginBottom: '12px',
                  lineHeight: 1.3,
                }}
              >
                {decision.decision_title}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', color: '#94a3b8', fontSize: '0.88rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} color="#e2b53c" />
                  <span>Decision Date: {formatDate(decision.decision_date)}</span>
                </span>

                {decision.decision_owner && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'rgba(226, 181, 60, 0.12)',
                      color: '#e2b53c',
                      padding: '2px 10px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <User size={13} />
                    <span>Decision Owner: {decision.decision_owner}</span>
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/projects/${decision.project_id}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: '0.92rem',
                fontWeight: 600,
              }}
            >
              <span>Open source project button</span>
              <ExternalLink size={15} />
            </button>
          </div>

          {/* Decision Summary */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
              Summary
            </h3>
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '16px 20px',
                color: '#f1f5f9',
                fontSize: '0.98rem',
                lineHeight: 1.6,
              }}
            >
              {decision.decision_summary || 'No summary recorded.'}
            </div>
          </div>

          {/* Decision Reasoning */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
              Reasoning
            </h3>
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderLeft: '4px solid #c084fc',
                borderRadius: '8px',
                padding: '16px 20px',
                color: '#cbd5e1',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              {decision.decision_reasoning || 'No reasoning or context specified.'}
            </div>
          </div>

          {/* Linked Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '24px',
            }}
          >
            {/* Linked project */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#93c5fd', fontSize: '0.82rem', fontWeight: 600 }}>
                <FolderKanban size={15} />
                <span>Linked Project</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                {decision.projects?.title || 'Unknown Project'}
              </div>
              {decision.projects?.client_name && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Client: {decision.projects.client_name}
                </div>
              )}
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate(`/projects/${decision.project_id}`)}
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                >
                  View Project
                </button>
              </div>
            </div>

            {/* Linked source output */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#e2b53c', fontSize: '0.82rem', fontWeight: 600 }}>
                <FileText size={15} />
                <span>Linked Source Output</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                {decision.outputs ? decision.outputs.output_type : 'Decision Log'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                {decision.source_output_id ? `Output ID: ${decision.source_output_id.slice(0, 8)}...` : 'Created directly or extracted from meeting notes'}
              </div>
              {decision.source_output_id && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/projects/${decision.project_id}`)}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    View Source Output
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
