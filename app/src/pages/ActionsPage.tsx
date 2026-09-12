import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckSquare,
  Sparkles,
  Lock,
  Calendar,
  User,
  FolderKanban,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Loader2,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Hourglass,
  CircleDot,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { fetchActions, updateActionStatus } from '../lib/actions/actionClient';
import { ActionRecord, ActionStatus, isActionOverdue } from '../lib/actions/types';

export const ActionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { supabase } = useAuth();
  const featureAccess = useFeatureAccess('action_tracker');

  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [dueDateFilter, setDueDateFilter] = useState<string>('all'); // 'all', 'overdue', 'today', 'upcoming'

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    if (!featureAccess.isAllowed) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await fetchActions(supabase, {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      owner: ownerFilter.trim() || undefined,
    });

    if (fetchErr) {
      setError(fetchErr.message || 'Failed to load actions');
      setActions([]);
    } else {
      setActions(data || []);
    }
    setLoading(false);
  }, [supabase, featureAccess.isAllowed, statusFilter, ownerFilter]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const handleStatusChange = async (actionId: string, newStatus: ActionStatus) => {
    setUpdatingId(actionId);
    const { data, error: updateErr } = await updateActionStatus(supabase, actionId, newStatus);
    setUpdatingId(null);

    if (updateErr) {
      setError(updateErr.message || 'Failed to update action');
    } else if (data) {
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: data.status, updated_at: data.updated_at } : a))
      );
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

  // Filter actions based on client-side project and dueDate options
  const filteredActions = actions.filter((act) => {
    if (projectFilter.trim()) {
      const pTitle = act.projects?.title?.toLowerCase() || '';
      if (!pTitle.includes(projectFilter.trim().toLowerCase())) return false;
    }

    if (dueDateFilter === 'overdue') {
      return act.status === 'overdue' || (act.status !== 'completed' && isActionOverdue(act));
    }
    if (dueDateFilter === 'today') {
      if (!act.due_date) return false;
      const todayStr = new Date().toISOString().slice(0, 10);
      return act.due_date.startsWith(todayStr);
    }
    if (dueDateFilter === 'upcoming') {
      if (!act.due_date || act.status === 'completed') return false;
      return !isActionOverdue(act);
    }

    return true;
  });

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
          icon: <AlertTriangle size={13} />,
        };
      case 'completed':
        return {
          label: 'Completed',
          bg: 'rgba(34, 197, 94, 0.15)',
          color: '#4ade80',
          border: 'rgba(74, 222, 128, 0.35)',
          icon: <CheckCircle2 size={13} />,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          bg: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: 'rgba(96, 165, 250, 0.35)',
          icon: <Hourglass size={13} />,
        };
      case 'blocked':
        return {
          label: 'Blocked',
          bg: 'rgba(249, 115, 22, 0.15)',
          color: '#fb923c',
          border: 'rgba(251, 146, 60, 0.35)',
          icon: <XCircle size={13} />,
        };
      case 'not_started':
      default:
        return {
          label: 'Not Started',
          bg: 'rgba(148, 163, 184, 0.15)',
          color: '#cbd5e1',
          border: 'rgba(148, 163, 184, 0.3)',
          icon: <CircleDot size={13} />,
        };
    }
  };

  // If user lacks permission: Show "Available on Pro" and prevent access
  if (!featureAccess.isAllowed) {
    return (
      <div className="workspace-page-container">
        <div className="page-header">
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>GOVERNANCE & ACCOUNTABILITY</span>
          </div>
          <h1 className="page-title">Action Accountability Tracker</h1>
          <p className="page-subtitle">Track deliverables, accountability, and deadlines across meetings.</p>
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
            Action Accountability Tracker is a Pro Feature
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
            Track agreed deliverables across meetings, assign ownership, monitor due dates, and identify overdue actions
            in one centralised governance view.
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
            <span className="breadcrumb-active">Action Tracker</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckSquare size={26} color="#e2b53c" />
            <span>Action Accountability Tracker</span>
          </h1>
          <p className="page-subtitle">Track deliverables, accountability, and deadlines across meetings.</p>
        </div>
      </div>

      {/* Action Filters Bar */}
      <div
        style={{
          backgroundColor: '#16263f',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {/* Status Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {/* Owner Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Owner</label>
          <input
            type="text"
            placeholder="Filter by owner..."
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          />
        </div>

        {/* Due Date Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Due Date</label>
          <select
            value={dueDateFilter}
            onChange={(e) => setDueDateFilter(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">All Dates</option>
            <option value="overdue">Overdue Only</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming (Active)</option>
          </select>
        </div>

        {/* Project Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Project</label>
          <input
            type="text"
            placeholder="Filter by project..."
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          />
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
          <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '6px' }}>Loading actions</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Fetching action deliverables and deadlines...</p>
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
              <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.95rem' }}>Failed to load actions</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadActions}
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
      {!loading && !error && filteredActions.length === 0 && (
        <div
          style={{
            padding: '72px 24px',
            textAlign: 'center',
            backgroundColor: '#16263f',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <CheckSquare size={40} color="#64748b" style={{ margin: '0 auto 18px' }} />
          <h2 style={{ color: '#f8fafc', fontSize: '1.3rem', fontWeight: 600, marginBottom: '8px' }}>
            No actions tracked yet
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 24px' }}>
            Actions saved from meeting outputs will appear here.
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

      {/* Actions List */}
      {!loading && !error && filteredActions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredActions.map((act) => {
            const badge = getStatusBadge(act.status, act.due_date);
            const projectName = act.projects?.title || act.projects?.project_name || 'Untitled Project';
            const isUpdating = updatingId === act.id;

            return (
              <div
                key={act.id}
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
                    {/* Status Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '3px 9px',
                        borderRadius: '4px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    {/* Linked Project */}
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

                    {/* Owner */}
                    {act.owner_name && (
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
                        <span>Owner: {act.owner_name}</span>
                      </span>
                    )}

                    {/* Due Date */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.8rem',
                        color: badge.label === 'Overdue' ? '#f87171' : '#94a3b8',
                        fontWeight: badge.label === 'Overdue' ? 600 : 400,
                      }}
                    >
                      <Calendar size={13} />
                      <span>Due: {formatDate(act.due_date)}</span>
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
                      to={`/actions/${act.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#e2b53c')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#f8fafc')}
                    >
                      {act.action_title}
                    </Link>
                  </h3>

                  {act.action_description && (
                    <p
                      style={{
                        color: '#cbd5e1',
                        fontSize: '0.92rem',
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {act.action_description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/projects/${act.project_id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                    }}
                    title="Open Project"
                  >
                    <span>Open project</span>
                    <ExternalLink size={14} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/actions/${act.id}`)}
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

                  {/* Quick status cycle button */}
                  <div style={{ marginTop: '4px' }}>
                    {act.status !== 'completed' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(act.id, 'completed')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4ade80',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                        }}
                      >
                        {isUpdating ? <Loader2 size={12} className="spin-animation" /> : <CheckCircle2 size={12} />}
                        <span>Mark Complete</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(act.id, 'in_progress')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                        }}
                      >
                        <span>Reopen</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
