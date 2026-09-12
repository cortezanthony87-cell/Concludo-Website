import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckSquare,
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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Hourglass,
  CircleDot,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { fetchActionById, updateActionStatus } from '../lib/actions/actionClient';
import { ActionRecord, ActionStatus, isActionOverdue } from '../lib/actions/types';

export const ActionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase } = useAuth();
  const featureAccess = useFeatureAccess('action_tracker');

  const [action, setAction] = useState<ActionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAction = useCallback(async () => {
    if (!id) return;
    if (!featureAccess.isAllowed) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await fetchActionById(supabase, id);

    if (fetchErr) {
      setError(fetchErr.message || 'Failed to load action');
      setAction(null);
    } else {
      setAction(data);
    }
    setLoading(false);
  }, [supabase, id, featureAccess.isAllowed]);

  useEffect(() => {
    loadAction();
  }, [loadAction]);

  const handleStatusChange = async (newStatus: ActionStatus) => {
    if (!id) return;
    setUpdating(true);
    setError(null);

    const { data, error: updateErr } = await updateActionStatus(supabase, id, newStatus);
    setUpdating(false);

    if (updateErr) {
      setError(updateErr.message || 'Failed to update action');
    } else if (data) {
      setAction(data);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
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

  const getStatusBadge = (status: ActionStatus, dueDate: string | null) => {
    const overdue = status !== 'completed' && isActionOverdue({ status, due_date: dueDate });
    const effectiveStatus = overdue ? 'overdue' : status;

    switch (effectiveStatus) {
      case 'overdue':
        return {
          label: 'Overdue',
          bg: 'rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          border: 'rgba(239, 68, 68, 0.45)',
          icon: <AlertTriangle size={15} />,
        };
      case 'completed':
        return {
          label: 'Completed',
          bg: 'rgba(34, 197, 94, 0.15)',
          color: '#4ade80',
          border: 'rgba(74, 222, 128, 0.35)',
          icon: <CheckCircle2 size={15} />,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          bg: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: 'rgba(96, 165, 250, 0.35)',
          icon: <Hourglass size={15} />,
        };
      case 'blocked':
        return {
          label: 'Blocked',
          bg: 'rgba(249, 115, 22, 0.15)',
          color: '#fb923c',
          border: 'rgba(251, 146, 60, 0.35)',
          icon: <XCircle size={15} />,
        };
      case 'not_started':
      default:
        return {
          label: 'Not Started',
          bg: 'rgba(148, 163, 184, 0.15)',
          color: '#cbd5e1',
          border: 'rgba(148, 163, 184, 0.3)',
          icon: <CircleDot size={15} />,
        };
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
            Action Accountability Tracker is a Pro Feature
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
          onClick={() => navigate('/actions')}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Action Tracker</span>
        </button>
        <div className="page-breadcrumbs">
          <Link to="/actions" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Actions
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-active">Action Detail</span>
        </div>
      </div>

      {/* Loading States */}
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
          <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '6px' }}>Loading action</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Fetching action deliverables and details...</p>
        </div>
      )}

      {updating && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(226, 181, 60, 0.15)',
            border: '1px solid rgba(226, 181, 60, 0.3)',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '16px',
            color: '#f3c958',
            fontSize: '0.88rem',
          }}
        >
          <Loader2 size={16} className="spin-animation" />
          <span>Updating action status...</span>
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
              <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.95rem' }}>Failed to load action</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadAction}
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

      {/* Action Detail Content */}
      {!loading && !error && action && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {(() => {
                  const badge = getStatusBadge(action.status, action.due_date);
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  );
                })()}

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <CheckSquare size={14} />
                  <span>Action Item</span>
                </div>
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
                {action.action_title}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', color: '#94a3b8', fontSize: '0.88rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} color="#e2b53c" />
                  <span>Due Date: {formatDate(action.due_date)}</span>
                </span>

                {action.owner_name && (
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
                    <span>Owner: {action.owner_name}</span>
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/projects/${action.project_id}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: '0.92rem',
                fontWeight: 600,
              }}
            >
              <span>Open project button</span>
              <ExternalLink size={15} />
            </button>
          </div>

          {/* Action Description */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
              Description
            </h3>
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '18px 20px',
                color: '#f1f5f9',
                fontSize: '0.98rem',
                lineHeight: 1.6,
              }}
            >
              {action.action_description || 'No detailed description provided.'}
            </div>
          </div>

          {/* Status Update Control */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '18px 20px',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                Status Governance
              </div>
              <div style={{ fontSize: '0.9rem', color: '#f8fafc' }}>
                Update deliverable progress across workspace tracking
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {(
                [
                  { val: 'not_started', label: 'Not Started' },
                  { val: 'in_progress', label: 'In Progress' },
                  { val: 'completed', label: 'Completed' },
                  { val: 'blocked', label: 'Blocked' },
                ] as const
              ).map((st) => (
                <button
                  key={st.val}
                  type="button"
                  disabled={updating}
                  onClick={() => handleStatusChange(st.val)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: action.status === st.val ? '1px solid #e2b53c' : '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: action.status === st.val ? 'rgba(226, 181, 60, 0.2)' : '#16263f',
                    color: action.status === st.val ? '#f3c958' : '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  {st.label}
                </button>
              ))}
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
                {action.projects?.title || 'Unknown Project'}
              </div>
              {action.projects?.client_name && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Client: {action.projects.client_name}
                </div>
              )}
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate(`/projects/${action.project_id}`)}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#4ade80', fontSize: '0.82rem', fontWeight: 600 }}>
                <FileText size={15} />
                <span>Linked Source Output</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                {action.outputs ? action.outputs.output_type : 'Action Items'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                {action.source_output_id ? `Output ID: ${action.source_output_id.slice(0, 8)}...` : 'Extracted from meeting action items'}
              </div>
              {action.source_output_id && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/projects/${action.project_id}`)}
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
