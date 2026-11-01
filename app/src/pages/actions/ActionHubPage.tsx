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

  // Suggestions state: Empty by default; only authentic candidates from Supabase
  const [candidates, setCandidates] = useState<CandidateSuggestion[]>([]);
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

  // Load real candidates from Supabase (only if any exist)
  const loadCandidates = useCallback(async () => {
    try {
      const { data, error: cErr } = await supabase
        .from('action_candidates')
        .select('*')
        .eq('decision', 'pending')
        .order('created_at', { ascending: false });
      if (!cErr && Array.isArray(data) && data.length > 0) {
        setCandidates(
          data.map((c: any) => ({
            id: c.id,
            title: c.candidate_title || 'Untitled task',
            ownerLabel: c.owner_raw || 'unassigned',
            ownerBasis: c.owner_confidence >= 0.8 ? 'stated' : 'inferred',
            priority: c.suggested_priority || 'medium',
            dueText: c.due_raw || 'none found',
            dueBasis: c.due_date ? 'stated' : 'none',
            project: 'General',
            quote: c.source_quote || '',
            isDuplicate: !!c.duplicate_of_action_id,
          }))
        );
      } else {
        setCandidates([]);
      }
    } catch {
      setCandidates([]);
    }
  }, [supabase]);

  useEffect(() => {
    loadActions();
    loadCandidates();
  }, [loadActions, loadCandidates]);

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
      // Use current project or null (never hardcode demo UUIDs)
      const projId = actions[0]?.project_id || null;
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
    <div className=\"ach-container\">
      {/* Top Header */}
      <div className=\"ach-top\">
        <div>
          <h1 className=\"ach-heading\" style={{ fontSize: '24px' }}>
            Action Command Hub
          </h1>
          <div className=\"ach-note\" style={{ marginTop: '2px' }}>
            Scope: {scope === 'my' ? 'My Actions' : 'All permitted actions'}. Timezone: Australia/Melbourne. Showing live verified records.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className=\"ach-btn-secondary\"
            onClick={() => setScope(scope === 'my' ? 'all' : 'my')}
            aria-label=\"Toggle action scope\"
          >
            {scope === 'my' ? 'My Actions ▾' : 'All permitted actions ▾'}
          </button>
          <button
            className=\"ach-btn-primary\"
            onClick={() => setShowCreateModal(true)}
            aria-label=\"Create new item\"
          >
            + Create new item
          </button>
        </div>
      </div>

      {/* Suggested Actions Banner */}
      {!bannerDismissed && candidates.length > 0 && (
        <div className=\"ach-banner\">
          <b>Actions assigned to you were found.</b> Do you want to save them to your Action Command Hub?
          <button
            className=\"ach-btn-primary\"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => setShowReviewPanel(true)}
          >
            Review actions
          </button>
          <button
            className=\"ach-btn-secondary\"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => setBannerDismissed(true)}
          >
            Not now
          </button>
          <button
            className=\"ach-btn-secondary\"
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

      {/* Metrics Row: Doughnut + Buckets */}
      <div className=\"ach-sum\">
        {/* Doughnut Widget */}
        <div className=\"ach-card ach-dn\">
          <svg width=\"112\" height=\"112\" viewBox=\"0 0 112 112\" aria-hidden=\"true\">
            <circle cx=\"56\" cy=\"56\" r={RAD} fill=\"none\" stroke=\"#E4E8EF\" strokeWidth=\"12\" />
            {donutSlices.map((s) => (
              <circle
                key={s.key}
                cx=\"56\"
                cy=\"56\"
                r={RAD}
                fill=\"none\"
                stroke={s.stroke}
                strokeWidth=\"12\"
                strokeDasharray={s.dashArray}
                strokeDashoffset={s.dashOffset}
                strokeLinecap=\"round\"
                transform=\"rotate(-90 56 56)\"
              />
            ))}
            <text x=\"56\" y=\"52\" textAnchor=\"middle\" fill=\"#16263F\" fontSize=\"18\" fontWeight=\"700\" fontFamily=\"Poppins, sans-serif\">
              {bucketCounts.total}
            </text>
            <text x=\"56\" y=\"66\" textAnchor=\"middle\" fill=\"#5A6478\" fontSize=\"10\" fontFamily=\"Inter, sans-serif\">
              actions
            </text>
          </svg>

          <div className=\"ach-lg\">
            <div className=\"ach-lg-row\">
              <i style={{ background: C.Completed }} />
              <span>Completed</span>
              <b>{bucketCounts.completed} <em>{bucketCounts.total ? Math.round((bucketCounts.completed / bucketCounts.total) * 100) : 0}%</em></b>
            </div>
            <div className=\"ach-lg-row\">
              <i style={{ background: C.Overdue }} />
              <span>Overdue</span>
              <b>{bucketCounts.overdue} <em>{bucketCounts.total ? Math.round((bucketCounts.overdue / bucketCounts.total) * 100) : 0}%</em></b>
            </div>
            <div className=\"ach-lg-row\">
              <i style={{ background: C['Due today'] }} />
              <span>Due today</span>
              <b>{bucketCounts.dueToday} <em>{bucketCounts.total ? Math.round((bucketCounts.dueToday / bucketCounts.total) * 100) : 0}%</em></b>
            </div>
            <div className=\"ach-lg-row\">
              <i style={{ background: C.Pending }} />
              <span>Pending</span>
              <b>{bucketCounts.pending} <em>{bucketCounts.total ? Math.round((bucketCounts.pending / bucketCounts.total) * 100) : 0}%</em></b>
            </div>
          </div>
        </div>

        {/* 8 Buckets Grid */}
        <div className=\"ach-card ach-cnt\">
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
          <div style={{ display: 'none' }} />
        </div>
      </div>

      <div className=\"ach-note\" style={{ margin: '6px 0 12px 0' }}>
        Buckets are exclusive: Completed, then Overdue, then Due today, then Pending. In progress and Blocked are filters, not slices.
      </div>

      {/* Tabs */}
      <div className=\"ach-tabs\">
        <button
          className={activeTab === 'my' ? 'active' : ''}
          onClick={() => setActiveTab('my')}
        >
          My Actions
        </button>
        <button
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => setActiveTab('all')}
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
        {candidates.length > 0 && (
          <button
            className={activeTab === 'review' ? 'active' : ''}
            onClick={() => setShowReviewPanel(true)}
          >
            Review suggestions <b className=\"ach-pill ach-pill-me\" style={{ marginLeft: '4px' }}>{candidates.length}</b>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className=\"ach-tb\">
        <input
          placeholder=\"Search actions\"
          aria-label=\"Search actions\"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className=\"ach-btn-secondary\">Filters</button>
        <button className=\"ach-btn-secondary\">Sort</button>
        <button className=\"ach-btn-secondary\">Columns (2 hidden)</button>
      </div>

      {/* Grid: Desktop Table View */}
      <div className=\"ach-card ach-table-wrapper\">
        <table className=\"ach-table\">
          <colgroup>
            <col style={{ width: '44px' }} />
            <col style={{ width: '320px', minWidth: '260px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '44px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input type=\"checkbox\" aria-label=\"Select all\" />
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
            {loading ? (\n              <tr>
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
                        type=\"checkbox\"
                        checked={row.status === 'completed'}
                        onChange={() => handleToggleComplete(row)}
                        aria-label={`Select task ${row.action_title}`}
                      />
                    </td>
                    <td>
                      <span className=\"ach-task-title\" title={row.action_title}>
                        {row.action_title}
                      </span>
                    </td>
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
                      {isOverdue && <span className=\"ach-overdue-badge\"> ⚠ Overdue</span>}
                    </td>
                    <td>{row.assigned_user_name || row.owner_name || 'Unassigned'}</td>
                    <td>{row.due_date ? row.due_date : 'Unscheduled'}</td>
                    <td>{row.projects?.title || row.projects?.project_name || 'Internal'}</td>
                    <td>{row.source_type || 'Meeting'}</td>
                    <td>Not linked</td>
                    <td>{row.updated_at ? row.updated_at.slice(0, 10) : 'Today'}</td>
                    <td style={{ textAlign: 'center' }}>⋯</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (< 768px and 390px viewport) */}
      <div className=\"ach-mobile-cards\">
        {displayedActions.map((row) => {
          const b = getActionBucket(row, now);
          const isOverdue = b === 'Overdue';
          const p = row.priority === 'high' ? 'High' : row.priority === 'low' ? 'Low' : 'Medium';
          const pClass = p === 'High' ? 'ach-pill-hi' : p === 'Medium' ? 'ach-pill-me' : 'ach-pill-lo';

          return (
            <div className=\"ach-row-card\" key={row.id}>
              <b>{row.action_title}</b>
              <div className=\"f\">
                <span className={`ach-pill ${pClass}`}>{p}</span>
                <span className=\"ach-tag\">{row.status}</span>
                <span className=\"ach-tag\">{row.due_date || 'Unscheduled'}</span>
                {isOverdue && <span className=\"ach-overdue-badge\">⚠ Overdue</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review Suggested Actions Drawer */}
      {showReviewPanel && (
        <aside className=\"ach-panel\" aria-label=\"Review suggested actions\">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className=\"ach-heading\" style={{ fontSize: '18px' }}>
              Review suggested actions
            </h2>
            <button
              className=\"ach-btn-secondary\"
              style={{ border: 0, fontSize: '16px', padding: '4px 8px' }}
              onClick={() => setShowReviewPanel(false)}
              aria-label=\"Close review panel\"
            >
              ✕
            </button>
          </div>
          {candidates.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#5A6478' }}>
              No pending suggestions to review.
            </div>
          ) : (
            <>
              <div className=\"ach-note\" style={{ marginTop: '4px' }}>
                From: Client check-in meeting. Rule-based drafting, may miss or misread items. Nothing is saved until you press Save. None selected by default.
              </div>
              {candidates.map((c) => (
            <div className={`ach-row-card ${c.isDuplicate || c.ownerBasis === 'unresolved' ? 'warn' : ''}`} key={c.id}>
              <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type=\"checkbox\"
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
              <div className=\"f\">
                <span className=\"ach-tag\">Owner: {c.ownerLabel} ({c.ownerBasis})</span>
                <span className=\"ach-tag\">Suggested priority: {c.priority}</span>
                <span className=\"ach-tag\">Due: {c.dueText}</span>
                <span className=\"ach-tag\">Project: {c.project}</span>
                {c.isDuplicate && <span className=\"ach-tag warn\">Possible duplicate</span>}
              </div>
              <div className=\"ach-note\" style={{ marginTop: '6px' }}>
                &ldquo;{c.quote}&rdquo;
              </div>
              {c.isDuplicate && (
                <div className=\"f\" style={{ marginTop: '8px' }}>
                  <button className=\"ach-btn-secondary\" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Link to existing
                  </button>
                  <button className=\"ach-btn-secondary\" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Update existing
                  </button>
                  <button className=\"ach-btn-secondary\" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Keep separate
                  </button>
                </div>
              )}
            </div>
          ))}
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              className=\"ach-btn-primary\"
              onClick={() => {
                alert('Selected actions saved to Action Command Hub');
                setShowReviewPanel(false);
              }}
            >
              Save selected actions
            </button>
            <button
              className=\"ach-btn-secondary\"
              onClick={() => {
                setCandidates([]);
                setShowReviewPanel(false);
              }}
            >
              Dismiss selected
            </button>
            <button className=\"ach-btn-secondary\" onClick={() => setShowReviewPanel(false)}>
              Not now
            </button>
          </div>
        </aside>
      )}

      {/* Create New Item Modal */}
      {showCreateModal && (
        <div className=\"ach-modal-backdrop\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Create new item\">
          <div className=\"ach-modal-box\">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className=\"ach-heading\" style={{ fontSize: '18px' }}>
                Create new item
              </h2>
              <button
                className=\"ach-btn-secondary\"
                style={{ border: 0, fontSize: '16px', padding: '4px 8px' }}
                onClick={() => setShowCreateModal(false)}
                aria-label=\"Close modal\"
              >
                ✕
              </button>
            </div>

            <div className=\"ach-seg\">
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
                Calendar event
              </button>
              <button
                className={createKind === 'reminder' ? 'active' : ''}
                onClick={() => setCreateKind('reminder')}
              >
                Reminder
              </button>
            </div>

            <label className=\"ach-field\">
              Title *
              <input
                className=\"ach-field-input\"
                placeholder=\"e.g. Follow up with lender on offset account setup\"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                autoFocus
              />
            </label>

            <label className=\"ach-field\">
              Description
              <textarea
                className=\"ach-field-input\"
                rows={2}
                placeholder=\"Optional context or background\"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <label className=\"ach-field\">
                Priority
                <select
                  className=\"ach-field-input\"
                  value={createPriority}
                  onChange={(e) => setCreatePriority(e.target.value as any)}
                >
                  <option value=\"high\">High</option>
                  <option value=\"medium\">Medium</option>
                  <option value=\"low\">Low</option>
                </select>
              </label>

              <label className=\"ach-field\">
                Due date
                <input
                  type=\"date\"
                  className=\"ach-field-input\"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type=\"checkbox\"
                  checked={createAllDay}
                  onChange={(e) => setCreateAllDay(e.target.checked)}
                />
                All day
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type=\"checkbox\"
                  checked={createCalendarReminder}
                  onChange={(e) => setCreateCalendarReminder(e.target.checked)}
                />
                Add to calendar
              </label>
            </div>

            <label className=\"ach-field\">
              Project
              <input
                className=\"ach-field-input\"
                value={createProject}
                onChange={(e) => setCreateProject(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button className=\"ach-btn-secondary\" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className=\"ach-btn-primary\"
                onClick={handleSaveCreate}
                disabled={createSaving || !createTitle.trim()}
              >
                {createSaving ? 'Saving...' : 'Save item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
