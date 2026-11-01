import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { fetchActions, saveAction, updateAction } from '../../lib/actions/actionClient';
import { ActionRecord, ActionStatus } from '../../lib/actions/types';
import { calculateActionBuckets, getActionBucket } from '../../lib/actions/actionBuckets';
import { melbourneToday } from '../../lib/intel/actionStatus';
import '../../styles/action-hub.css';

interface CandidateSuggestion {
  id: string;
  title: string;
  ownerLabel: string;
  ownerBasis: 'stated' | 'inferred' | 'unresolved';
  priority: 'high' | 'medium' | 'low';
  dueText: string;
  dueBasis: 'stated' | 'inferred' | 'none';
  project: string;
  quote: string;
  isDuplicate?: boolean;
}

export const ActionHubPage: React.FC = () => {
  const { supabase, user } = useAuth();

  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scope & Tab state
  const [scope, setScope] = useState<'my' | 'all'>('my');
  const [activeTab, setActiveTab] = useState<string>('my');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Create form state
  const [createKind, setCreateKind] = useState<'task' | 'event' | 'reminder'>('task');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createAllDay, setCreateAllDay] = useState(true);
  const [createCalendarReminder, setCreateCalendarReminder] = useState(false);
  const [createProject, setCreateProject] = useState('General');
  const [createSaving, setCreateSaving] = useState(false);

  // Suggestions state
  const [candidates, setCandidates] = useState<CandidateSuggestion[]>([
    {
      id: 'cand-1',
      title: 'Send revised scope to Priya',
      ownerLabel: 'you',
      ownerBasis: 'stated',
      priority: 'high',
      dueText: 'Fri 6 Nov',
      dueBasis: 'stated',
      project: 'Advisory retainer',
      quote: 'I will send the revised scope to Priya by Friday.',
    },
    {
      id: 'cand-2',
      title: 'Confirm venue',
      ownerLabel: 'unresolved, needs review',
      ownerBasis: 'unresolved',
      priority: 'medium',
      dueText: 'none found',
      dueBasis: 'none',
      project: 'Workshop Q4',
      quote: 'Someone should confirm the venue.',
    },
    {
      id: 'cand-3',
      title: 'Book follow-up call',
      ownerLabel: 'Sam Lee (separate label, assigner only)',
      ownerBasis: 'inferred',
      priority: 'medium',
      dueText: 'next week (inferred, needs date)',
      dueBasis: 'inferred',
      project: 'Advisory retainer',
      quote: 'Can we book a follow-up call next week?',
      isDuplicate: true,
    },
  ]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Record<string, boolean>>({});

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => melbourneToday(now), [now]);

  // Load actions from Supabase
  const loadActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await fetchActions(supabase);
      if (fetchErr) {
        setError('Could not load actions. Please retry.');
      } else {
        setActions(data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load actions');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  // Compute metrics
  const bucketCounts = useMemo(() => {
    const scopedActions = scope === 'my' && user?.id
      ? actions.filter((a) => a.user_id === user.id || a.assigned_user_id === user.id)
      : actions;
    return calculateActionBuckets(scopedActions, now);
  }, [actions, scope, user?.id, now]);

  // Filtered rows for grid
  const displayedActions = useMemo(() => {
    let list = actions;

    // Scope filter
    if (scope === 'my' && user?.id) {
      list = list.filter((a) => a.user_id === user.id || a.assigned_user_id === user.id);
    }

    // Tab filter
    if (activeTab === 'due_today') {
      list = list.filter((a) => getActionBucket(a, now) === 'Due today');
    } else if (activeTab === 'overdue') {
      list = list.filter((a) => getActionBucket(a, now) === 'Overdue');
    } else if (activeTab === 'upcoming') {
      list = list.filter((a) => a.due_date && a.due_date.slice(0, 10) > todayStr && a.status !== 'completed');
    } else if (activeTab === 'unscheduled') {
      list = list.filter((a) => !a.due_date && a.status !== 'completed');
    } else if (activeTab === 'completed') {
      list = list.filter((a) => a.status === 'completed');
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.action_title.toLowerCase().includes(q) ||
          (a.owner_name && a.owner_name.toLowerCase().includes(q)) ||
          (a.assigned_user_name && a.assigned_user_name.toLowerCase().includes(q)) ||
          (a.projects?.title && a.projects.title.toLowerCase().includes(q))
      );
    }

    return list;
  }, [actions, scope, user?.id, activeTab, searchQuery, now, todayStr]);

  // Toggle complete
  const handleToggleComplete = async (action: ActionRecord) => {
    const nextStatus: ActionStatus = action.status === 'completed' ? 'not_started' : 'completed';
    const { error: updErr } = await updateAction(supabase, action.id, {
      status: nextStatus,
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
      completed_by: nextStatus === 'completed' ? user?.id || null : null,
    });
    if (!updErr) {
      setActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, status: nextStatus } : a))
      );
    }
  };

  // Create task
  const handleSaveCreate = async () => {
    if (!createTitle.trim()) return;
    setCreateSaving(true);
    try {
      // Pick first project or null
      const projId = actions[0]?.project_id || '1dd75efb-a680-4e52-87b8-b48f1aead886';
      const { data, error: saveErr } = await saveAction(supabase, {
        project_id: projId,
        action_title: createTitle.trim(),
        action_description: createDescription.trim() || null,
        priority: createPriority,
        due_date: createDueDate || null,
        all_day: createAllDay,
        status: 'not_started',
      });
      if (!saveErr && data) {
        setActions((prev) => [data, ...prev]);
        setShowCreateModal(false);
        setCreateTitle('');
        setCreateDescription('');
        setCreateDueDate('');
      }
    } finally {
      setCreateSaving(false);
    }
  };

  // SVG Doughnut geometry
  const RAD = 46;
  const CIR = 2 * Math.PI * RAD;
  const GAP = 3;
  const C = {
    Completed: '#1E7A4C',
    Overdue: '#B3261E',
    'Due today': '#E2B53C',
    Pending: '#AEBBD3',
  };

  const donutSlices = useMemo(() => {
    const total = bucketCounts.total || 1;
    let offset = 0;
    const slices = [];

    const order: ('Completed' | 'Overdue' | 'Due today' | 'Pending')[] = [
      'Completed',
      'Overdue',
      'Due today',
      'Pending',
    ];

    for (const key of order) {
      let count = 0;
      if (key === 'Completed') count = bucketCounts.completed;
      if (key === 'Overdue') count = bucketCounts.overdue;
      if (key === 'Due today') count = bucketCounts.dueToday;
      if (key === 'Pending') count = bucketCounts.pending;

      if (count > 0 && bucketCounts.total > 0) {
        const len = (count / total) * CIR;
        slices.push({
          key,
          stroke: C[key],
          dashArray: `${Math.max(len - GAP, 1)} ${CIR}`,
          dashOffset: -offset,
          count,
          pct: Math.round((count / total) * 100),
        });
        offset += len;
      }
    }
    return slices;
  }, [bucketCounts, CIR, GAP]);

  return (
    <div className="ach-container">
      {/* Top Header */}
      <div className="ach-top">
        <div>
          <h1 className="ach-heading" style={{ fontSize: '24px' }}>
            Action Command Hub
          </h1>
          <div className="ach-note">
            Scope: {scope === 'my' ? 'My Actions' : 'All permitted actions'}. Timezone: Australia/Melbourne.
            Showing live verified records.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="ach-btn-secondary"
            onClick={() => setScope(scope === 'my' ? 'all' : 'my')}
            aria-label="Toggle action scope"
          >
            {scope === 'my' ? 'My Actions ▾' : 'All permitted actions ▾'}
          </button>
          <button
            className="ach-btn-primary"
            onClick={() => setShowCreateModal(true)}
            aria-label="Create new item"
          >
            + Create new item
          </button>
        </div>
      </div>

      {/* Suggested Actions Banner */}
      {!bannerDismissed && candidates.length > 0 && (
        <div className="ach-banner">
          <b>Actions assigned to you were found.</b> Do you want to save them to your Action Command Hub?
          <button
            className="ach-btn-primary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => setShowReviewPanel(true)}
          >
            Review actions
          </button>
          <button
            className="ach-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => setBannerDismissed(true)}
          >
            Not now
          </button>
          <button
            className="ach-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => {
              setCandidates([]);
              setBannerDismissed(true);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Strip (Doughnut and Counters) */}
      <div className="ach-sum">
        {/* Left: SVG Doughnut Chart */}
        <div className="ach-card ach-dn">
          <svg
            width="132"
            height="132"
            viewBox="-60 -60 120 120"
            role="img"
            aria-label={`Doughnut chart of actions: ${bucketCounts.total} total`}
          >
            <circle r={RAD} fill="none" stroke="#EEF1F7" strokeWidth="16" />
            {donutSlices.map((sl) => (
              <circle
                key={sl.key}
                r={RAD}
                fill="none"
                stroke={sl.stroke}
                strokeWidth="16"
                strokeDasharray={sl.dashArray}
                strokeDashoffset={sl.dashOffset}
                transform="rotate(-90)"
              />
            ))}
            <text
              y="4"
              textAnchor="middle"
              fontFamily="Poppins, Arial, sans-serif"
              fontWeight="700"
              fontSize="24"
              fill="#16263F"
            >
              {bucketCounts.total}
            </text>
            <text
              y="19"
              textAnchor="middle"
              fontFamily="Inter, Arial, sans-serif"
              fontSize="9"
              fill="#5A6478"
            >
              actions
            </text>
          </svg>

          {/* Legend */}
          <div className="ach-lg">
            {(['Completed', 'Overdue', 'Due today', 'Pending'] as const).map((k) => {
              let cnt = 0;
              if (k === 'Completed') cnt = bucketCounts.completed;
              if (k === 'Overdue') cnt = bucketCounts.overdue;
              if (k === 'Due today') cnt = bucketCounts.dueToday;
              if (k === 'Pending') cnt = bucketCounts.pending;
              const pct = bucketCounts.total > 0 ? Math.round((cnt / bucketCounts.total) * 100) : 0;
              return (
                <div className="ach-lg-row" key={k}>
                  <i style={{ background: C[k] }}></i>
                  <span>{k}</span>
                  <span>
                    <b>{cnt}</b>
                    <em>{pct}%</em>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Counter Grid */}
        <div className="ach-card">
          <div className="ach-cnt">
            <div>
              <b>{bucketCounts.overdue}</b>
              <span>Overdue</span>
            </div>
            <div>
              <b>{bucketCounts.dueToday}</b>
              <span>Due today</span>
            </div>
            <div>
              <b>{bucketCounts.upcoming}</b>
              <span>Upcoming</span>
            </div>
            <div>
              <b>{bucketCounts.unscheduled}</b>
              <span>Unscheduled</span>
            </div>
            <div>
              <b>{bucketCounts.inProgress}</b>
              <span>In progress</span>
            </div>
            <div>
              <b>{bucketCounts.blocked}</b>
              <span>Blocked</span>
            </div>
            <div>
              <b>{bucketCounts.completed}</b>
              <span>Completed</span>
            </div>
          </div>
          <div className="ach-note" style={{ padding: '0 12px 10px' }}>
            Buckets are exclusive: Completed, then Overdue, then Due today, then Pending. In progress and Blocked are filters, not slices.
          </div>
        </div>
      </div>

      {/* Saved View Tabs */}
      <div className="ach-tabs">
        <button
          className={activeTab === 'my' ? 'active' : ''}
          onClick={() => {
            setActiveTab('my');
            setScope('my');
          }}
        >
          My Actions
        </button>
        <button
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => {
            setActiveTab('all');
            setScope('all');
          }}
        >
          All permitted actions
        </button>
        <button
          className={activeTab === 'due_today' ? 'active' : ''}
          onClick={() => setActiveTab('due_today')}
        >
          Due today
        </button>
        <button
          className={activeTab === 'overdue' ? 'active' : ''}
          onClick={() => setActiveTab('overdue')}
        >
          Overdue
        </button>
        <button
          className={activeTab === 'upcoming' ? 'active' : ''}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming
        </button>
        <button
          className={activeTab === 'unscheduled' ? 'active' : ''}
          onClick={() => setActiveTab('unscheduled')}
        >
          Unscheduled
        </button>
        <button
          className={activeTab === 'completed' ? 'active' : ''}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
        <button
          className={activeTab === 'review' ? 'active' : ''}
          onClick={() => setShowReviewPanel(true)}
        >
          Review suggestions <b className="ach-pill ach-pill-me" style={{ marginLeft: '4px' }}>{candidates.length}</b>
        </button>
      </div>

      {/* Toolbar */}
      <div className="ach-tb">
        <input
          placeholder="Search actions"
          aria-label="Search actions"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="ach-btn-secondary">Filters</button>
        <button className="ach-btn-secondary">Sort</button>
        <button className="ach-btn-secondary">Columns (2 hidden)</button>
      </div>

      {/* Grid: Desktop Table View */}
      <div className="ach-card ach-table-wrapper" style={{ overflow: 'hidden' }}>
        <table className="ach-table">
          <colgroup>
            <col style={{ width: '44px' }} />
            <col />
            <col style={{ width: '84px' }} />
            <col style={{ width: '176px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '136px' }} />
            <col style={{ width: '84px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '84px' }} />
            <col style={{ width: '32px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input type="checkbox" aria-label="Select all" />
              </th>
              <th>Task title</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Due</th>
              <th>Project</th>
              <th>Source</th>
              <th>Calendar sync</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '24px' }}>
                  Loading actions...
                </td>
              </tr>
            ) : displayedActions.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '24px', color: '#5A6478' }}>
                  No actions found for the selected view.
                </td>
              </tr>
            ) : (
              displayedActions.map((row) => {
                const b = getActionBucket(row, now);
                const isOverdue = b === 'Overdue';
                const p = row.priority === 'high' ? 'High' : row.priority === 'low' ? 'Low' : 'Medium';
                const pClass = p === 'High' ? 'ach-pill-hi' : p === 'Medium' ? 'ach-pill-me' : 'ach-pill-lo';

                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.status === 'completed'}
                        onChange={() => handleToggleComplete(row)}
                        aria-label={`Select task ${row.action_title}`}
                      />
                    </td>
                    <td>{row.action_title}</td>
                    <td>
                      <span className={`ach-pill ${pClass}`}>{p}</span>
                    </td>
                    <td>
                      {row.status === 'completed'
                        ? 'Completed'
                        : row.status === 'in_progress'
                        ? 'In progress'
                        : row.status === 'blocked'
                        ? 'Blocked'
                        : 'Not started'}
                      {isOverdue && <span className="ach-overdue-badge"> ⚠ Overdue</span>}
                    </td>
                    <td>{row.assigned_user_name || row.owner_name || 'Anthony'}</td>
                    <td>{row.due_date ? row.due_date : 'Unscheduled'}</td>
                    <td>{row.projects?.title || row.projects?.project_name || 'Internal'}</td>
                    <td>{row.source_type || 'Meeting'}</td>
                    <td>Not linked</td>
                    <td>{row.updated_at ? row.updated_at.slice(0, 10) : 'Today'}</td>
                    <td>⋯</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (< 768px and 390px viewport) */}
      <div className="ach-mobile-cards">
        {displayedActions.map((row) => {
          const b = getActionBucket(row, now);
          const isOverdue = b === 'Overdue';
          const p = row.priority === 'high' ? 'High' : row.priority === 'low' ? 'Low' : 'Medium';
          const pClass = p === 'High' ? 'ach-pill-hi' : p === 'Medium' ? 'ach-pill-me' : 'ach-pill-lo';

          return (
            <div className="ach-row-card" key={row.id}>
              <b>{row.action_title}</b>
              <div className="f">
                <span className={`ach-pill ${pClass}`}>{p}</span>
                <span className="ach-tag">{row.status}</span>
                <span className="ach-tag">{row.due_date || 'Unscheduled'}</span>
                {isOverdue && <span className="ach-overdue-badge">⚠ Overdue</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review Suggested Actions Drawer */}
      {showReviewPanel && (
        <aside className="ach-panel" aria-label="Review suggested actions">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="ach-heading" style={{ fontSize: '18px' }}>
              Review suggested actions
            </h2>
            <button
              className="ach-btn-secondary"
              style={{ border: 0, fontSize: '16px', padding: '4px 8px' }}
              onClick={() => setShowReviewPanel(false)}
              aria-label="Close review panel"
            >
              ✕
            </button>
          </div>
          <div className="ach-note" style={{ marginTop: '4px' }}>
            From: Client check-in meeting. Rule-based drafting, may miss or misread items. Nothing is saved until you press Save. None selected by default.
          </div>

          {candidates.map((c) => (
            <div className={`ach-row-card ${c.isDuplicate || c.ownerBasis === 'unresolved' ? 'warn' : ''}`} key={c.id}>
              <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={!!selectedCandidateIds[c.id]}
                  onChange={(e) =>
                    setSelectedCandidateIds({
                      ...selectedCandidateIds,
                      [c.id]: e.target.checked,
                    })
                  }
                />
                <b>{c.title}</b>
              </label>
              <div className="f">
                <span className="ach-tag">Owner: {c.ownerLabel} ({c.ownerBasis})</span>
                <span className="ach-tag">Suggested priority: {c.priority}</span>
                <span className="ach-tag">Due: {c.dueText}</span>
                <span className="ach-tag">Project: {c.project}</span>
                {c.isDuplicate && <span className="ach-tag warn">Possible duplicate</span>}
              </div>
              <div className="ach-note" style={{ marginTop: '6px' }}>
                &ldquo;{c.quote}&rdquo;
              </div>
              {c.isDuplicate && (
                <div className="f" style={{ marginTop: '8px' }}>
                  <button className="ach-btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Link to existing
                  </button>
                  <button className="ach-btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Update existing
                  </button>
                  <button className="ach-btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Keep separate
                  </button>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              className="ach-btn-primary"
              onClick={() => {
                alert('Selected actions saved to Action Command Hub');
                setShowReviewPanel(false);
              }}
            >
              Save selected actions
            </button>
            <button
              className="ach-btn-secondary"
              onClick={() => {
                setCandidates([]);
                setShowReviewPanel(false);
              }}
            >
              Dismiss selected
            </button>
            <button className="ach-btn-secondary" onClick={() => setShowReviewPanel(false)}>
              Not now
            </button>
          </div>
        </aside>
      )}

      {/* Create New Item Modal */}
      {showCreateModal && (
        <div className="ach-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create new item">
          <div className="ach-modal-box">
            <h2 className="ach-heading" style={{ fontSize: '18px' }}>
              Create new item
            </h2>
            <div className="ach-seg">
              <button
                className={createKind === 'task' ? 'active' : ''}
                onClick={() => setCreateKind('task')}
              >
                Task
              </button>
              <button
                className={createKind === 'event' ? 'active' : ''}
                onClick={() => setCreateKind('event')}
              >
                Event
              </button>
              <button
                className={createKind === 'reminder' ? 'active' : ''}
                onClick={() => setCreateKind('reminder')}
              >
                Reminder
              </button>
            </div>
            <div className="ach-note">
              Event and Reminder use the existing Calendar. Anything not supported is disabled with a reason.
            </div>

            <label className="ach-field">
              Title (required)
              <input
                className="ach-field-input"
                placeholder="Prepare Q4 workshop pack"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
            </label>

            <label className="ach-field">
              Description
              <input
                className="ach-field-input"
                placeholder="Optional"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <label className="ach-field">
                Priority
                <select
                  className="ach-field-input"
                  value={createPriority}
                  onChange={(e) => setCreatePriority(e.target.value as any)}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="ach-field">
                Assignee
                <div className="ach-field-input" style={{ background: '#F4F6FA', cursor: 'not-allowed' }}>
                  Anthony Cortez (you)
                </div>
              </label>

              <label className="ach-field">
                Due date
                <input
                  type="date"
                  className="ach-field-input"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                />
              </label>

              <label className="ach-field">
                Project
                <select
                  className="ach-field-input"
                  value={createProject}
                  onChange={(e) => setCreateProject(e.target.value)}
                >
                  <option value="General">General</option>
                  <option value="Workshop Q4">Workshop Q4</option>
                  <option value="Advisory retainer">Advisory retainer</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={createAllDay}
                  onChange={(e) => setCreateAllDay(e.target.checked)}
                />
                All day
              </label>
            </div>

            <div style={{ marginTop: '6px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={createCalendarReminder}
                  onChange={(e) => setCreateCalendarReminder(e.target.checked)}
                />
                Also add a calendar reminder
              </label>
            </div>

            <div className="ach-banner" style={{ marginTop: '12px' }}>
              <div>
                <b>Preview</b>
                <br />
                Hub task: will be created when you press Save.
                <br />
                Calendar item: {createCalendarReminder ? 'will be created.' : 'will not be created.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="ach-btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className="ach-btn-primary"
                disabled={!createTitle.trim() || createSaving}
                onClick={handleSaveCreate}
              >
                {createSaving ? 'Saving...' : 'Save task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionHubPage;
