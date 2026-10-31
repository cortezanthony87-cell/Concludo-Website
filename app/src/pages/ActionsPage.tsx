import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowUpDown,
  User,
  Calendar,
  XCircle,
  Hourglass,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { fetchActions, updateActionStatus } from '../lib/actions/actionClient';
import { ActionRecord, ActionStatus, isActionOverdue } from '../lib/actions/types';
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader';
import { QuickActionModal } from '../components/workspace/QuickActionModal';
import { WorkspaceScopeToggle, WorkspaceScope } from '../components/workspace/WorkspaceScopeToggle';

export const ActionsPage: React.FC = () => {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const featureAccess = useFeatureAccess('action_tracker');

  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scope, setScope] = useState<WorkspaceScope>('all');

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

    try {
      setLoading(true);
      const res = await fetchActions(supabase, {
        workspaceScope: scope,
        projectId: searchParams.get('projectId') || undefined,
      });

      if (res.data) {
        setActions(res.data);
      }
    } catch (err) {
      console.error('Failed to load actions:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, featureAccess.isAllowed, scope, searchParams]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const handleToggleComplete = async (action: ActionRecord) => {
    const newStatus: ActionStatus = action.status === 'completed' ? 'not_started' : 'completed';
    setUpdatingId(action.id);
    try {
      const res = await updateActionStatus(supabase, action.id, newStatus);
      if (res.data) {
        setActions((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, status: newStatus } : a))
        );
      }
    } catch (err) {
      console.error('Failed to update action status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (actionId: string, newStatus: ActionStatus) => {
    setUpdatingId(actionId);
    try {
      const res = await updateActionStatus(supabase, actionId, newStatus);
      if (res.data) {
        setActions((prev) =>
          prev.map((a) => (a.id === actionId ? { ...a, status: newStatus } : a))
        );
      }
    } catch (err) {
      console.error('Failed to change status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered actions
  const filteredActions = actions.filter((act) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = act.action_title.toLowerCase().includes(q);
      const matchDesc = act.action_description?.toLowerCase().includes(q) || false;
      const matchOwner = act.owner_name?.toLowerCase().includes(q) || false;
      const matchProject = act.projects?.title?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchDesc && !matchOwner && !matchProject) return false;
    }

    if (statusFilter !== 'all' && act.status !== statusFilter) return false;

    if (ownerFilter.trim()) {
      const o = ownerFilter.toLowerCase();
      const matchOwner = act.owner_name?.toLowerCase().includes(o) || false;
      const matchAssigned = act.assigned_user_name?.toLowerCase().includes(o) || false;
      if (!matchOwner && !matchAssigned) return false;
    }

    if (projectFilter.trim()) {
      const pTitle = act.projects?.title?.toLowerCase() || '';
      if (!pTitle.includes(projectFilter.trim().toLowerCase())) return false;
    }

    if (dueDateFilter === 'overdue') {
      return isActionOverdue(act);
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
      default:
        return {
          label: 'Not Started',
          bg: 'rgba(148, 163, 184, 0.15)',
          color: '#cbd5e1',
          border: 'rgba(148, 163, 184, 0.3)',
          icon: <Clock size={13} />,
        };
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return 'No due date';
    try {
      const parsed = new Date(d);
      return parsed.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  // Metrics
  const totalCount = actions.length;
  const completedCount = actions.filter((a) => a.status === 'completed').length;
  const overdueCount = actions.filter((a) => a.status !== 'completed' && isActionOverdue(a)).length;
  const inProgressCount = actions.filter((a) => a.status === 'in_progress').length;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <WorkspaceHeader
        title="Action Tracker"
        subtitle="Manage and track decisions and actions generated from your meetings"
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <WorkspaceScopeToggle value={scope} onChange={setScope} />
          <QuickActionModal
            defaultType="action"
            onSuccess={loadActions}
            trigger={
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  backgroundColor: '#D4AF37',
                  color: '#0A1128',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(212, 175, 55, 0.25)',
                }}
              >
                <Plus size={16} />
                New Action
              </button>
            }
          />
        </div>
      </WorkspaceHeader>

      {/* Tier Gate Warning */}
      {!featureAccess.isAllowed && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <ShieldAlert size={28} color="#ef4444" />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 4px', color: '#fca5a5' }}>Feature Restricted</h4>
            <p style={{ margin: 0, color: '#f87171', fontSize: '0.88rem' }}>
              Action Tracker is available on Pro and Team plans. Upgrade your subscription to record, track, and complete actions across all meeting outputs.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings?tab=billing')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: '10px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Total Actions</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>{totalCount}</div>
        </div>

        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: '10px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>In Progress</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#60a5fa' }}>{inProgressCount}</div>
        </div>

        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: '10px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Overdue</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: overdueCount > 0 ? '#f87171' : '#94a3b8' }}>
            {overdueCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: '10px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Completed</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#4ade80' }}>{completedCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#1E293B',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'end',
        }}
      >
        {/* Search */}
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Search</label>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
            <input
              type="text"
              placeholder="Search actions, owners, projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

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
              padding: '8px 10px',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
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
              padding: '8px 10px',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">Any Due Date</option>
            <option value="overdue">Overdue Only</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        {/* Clear Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(statusFilter !== 'all' || dueDateFilter !== 'all' || searchQuery || ownerFilter || projectFilter) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setDueDateFilter('all');
                setSearchQuery('');
                setOwnerFilter('');
                setProjectFilter('');
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                borderRadius: '6px',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Action List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <Clock size={32} style={{ animation: 'spin 2s linear infinite', marginBottom: '12px' }} />
          <div>Loading actions...</div>
        </div>
      ) : filteredActions.length === 0 ? (
        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <CheckCircle2 size={40} color="#64748b" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#f8fafc' }}>No actions found</h3>
          <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '0.9rem' }}>
            {actions.length === 0
              ? 'Generate an output or add an action manually to start tracking commitments.'
              : 'No actions match the active filters.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredActions.map((action) => {
            const badge = getStatusBadge(action.status, action.due_date);
            const isCompleted = action.status === 'completed';

            return (
              <div
                key={action.id}
                style={{
                  backgroundColor: '#1E293B',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  border: isCompleted
                    ? '1px solid rgba(34, 197, 94, 0.2)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  transition: 'background-color 0.15s ease',
                  opacity: isCompleted ? 0.75 : 1,
                }}
              >
                {/* Complete checkbox */}
                <button
                  onClick={() => handleToggleComplete(action)}
                  disabled={updatingId === action.id}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    border: isCompleted
                      ? '2px solid #4ade80'
                      : '2px solid rgba(255, 255, 255, 0.3)',
                    backgroundColor: isCompleted ? '#22c55e' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginTop: '2px',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                >
                  {isCompleted && <Check size={16} color="#0A1128" strokeWidth={3} />}
                </button>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span
                      onClick={() => navigate(`/actions/${action.id}`)}
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: isCompleted ? '#94a3b8' : '#f8fafc',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {action.action_title}
                    </span>

                    {/* Status Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>

                  {action.action_description && (
                    <p
                      style={{
                        margin: '0 0 10px',
                        fontSize: '0.84rem',
                        color: '#94a3b8',
                        lineHeight: 1.4,
                      }}
                    >
                      {action.action_description}
                    </p>
                  )}

                  {/* Metadata Tags */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '14px',
                      fontSize: '0.78rem',
                      color: '#64748b',
                    }}
                  >
                    {action.projects?.title && (
                      <span
                        onClick={() => navigate(`/projects/${action.project_id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        <Layers size={13} color="#D4AF37" />
                        {action.projects.title}
                      </span>
                    )}

                    {(action.owner_name || action.assigned_user_name) && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <User size={13} />
                        {action.assigned_user_name || action.owner_name}
                      </span>
                    )}

                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color:
                          badge.label === 'Overdue'
                            ? '#f87171'
                            : '#64748b',
                      }}
                    >
                      <Calendar size={13} />
                      {formatDate(action.due_date)}
                    </span>
                  </div>
                </div>

                {/* Status Dropdown selector */}
                <div style={{ flexShrink: 0 }}>
                  <select
                    value={action.status === 'overdue' ? 'not_started' : action.status}
                    onChange={(e) => handleStatusChange(action.id, e.target.value as ActionStatus)}
                    disabled={updatingId === action.id}
                    style={{
                      backgroundColor: '#0f172a',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default ActionsPage;
