import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { fetchActions, saveAction, updateAction } from '../../lib/actions/actionClient';
import { ActionRecord, ActionStatus } from '../../lib/actions/types';
import { approveCandidate, dismissCandidate, fetchCandidates } from '../../lib/actions/actionCandidates';
import { calculateActionBuckets, getActionBucket } from '../../lib/actions/actionBuckets';
import { melbourneToday } from '../../lib/intel/actionStatus';
import '../../styles/action-hub.css';

interface CandidateSuggestion {
  id: string;
  title: string;
  source: string;
  ownerLabel: string;
  dueText: string;
  dueBasis: 'stated' | 'approximate' | 'none';
  priority: string;
  project: string;
  quote: string;
  isDuplicate?: boolean;
  rawCandidate?: any;
}

export const ActionHubPage: React.FC = () => {
  const { supabase, user } = useAuth();
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab: 'all' | 'mine' | 'overdue' | 'due_week' | 'no_date' | 'completed' | 'suggestions'
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Candidate suggestions state - strictly populated from authentic database records
  const [candidates, setCandidates] = useState<CandidateSuggestion[]>([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Record<string, boolean>>({});
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // New action modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newProject, setNewProject] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => melbourneToday(), []);

  // Authentic user projects
  const [userProjects, setUserProjects] = useState<Array<{ id: string; title: string }>>([]);

  // Load authentic candidates from Supabase
  const loadCandidates = useCallback(async () => {
    if (!supabase || !user?.id) {
      setCandidates([]);
      return;
    }
    try {
      const { data, error: cErr } = await fetchCandidates(supabase);
      if (!cErr && Array.isArray(data) && data.length > 0) {
        setCandidates(
          data.map((c: any) => ({
            id: c.id,
            title: c.candidate_title || 'Untitled task',
            source: c.source_type ? `${c.source_type.toUpperCase()} excerpt` : 'Meeting notes',
            ownerLabel: c.suggested_owner || 'Unassigned',
            dueText: c.suggested_due_date || 'No stated date',
            dueBasis: c.suggested_due_date ? 'stated' : 'none',
            priority: c.confidence && c.confidence > 0.8 ? 'high' : 'medium',
            project: 'General',
            quote: c.source_excerpt || '',
            isDuplicate: !!c.duplicate_of_action_id,
            rawCandidate: c,
          }))
        );
      } else {
        setCandidates([]);
      }
    } catch {
      setCandidates([]);
    }
  }, [supabase]);

  // Load actions from Supabase
  const loadActions = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchActions(supabase, {
        ownership: 'all',
        includeCompleted: true,
      });
      if (res.error) {
        setError(res.error.message || 'Failed to load actions');
      } else {
        setActions(res.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching actions');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Load user projects for authentic assignment
  useEffect(() => {
    if (!supabase || !user?.id) return;
    supabase
      .from('projects')
      .select('id, title')
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setUserProjects(data);
      });
  }, [supabase, user?.id]);

  useEffect(() => {
    loadActions();
    loadCandidates();
  }, [loadActions, loadCandidates]);

  // Canonical bucket summary calculation
  const buckets = useMemo(() => {
    return calculateActionBuckets(actions, now);
  }, [actions, now]);

  // Filter actions based on active tab and controls
  const displayedActions = useMemo(() => {
    return actions.filter((act) => {
      // Tab filter
      if (activeTab === 'mine') {
        const isMine =
          act.assigned_user_id === user?.id ||
          act.owner_name?.toLowerCase().includes('anthony') ||
          act.assigned_user_name?.toLowerCase().includes('anthony');
        if (!isMine) return false;
      } else if (activeTab === 'overdue') {
        if (getActionBucket(act, now) !== 'Overdue') return false;
      } else if (activeTab === 'due_week') {
        const b = getActionBucket(act, now);
        if (b !== 'DueToday' && b !== 'DueThisWeek') return false;
      } else if (activeTab === 'no_date') {
        if (getActionBucket(act, now) !== 'NoDueDate') return false;
      } else if (activeTab === 'completed') {
        if (act.status !== 'completed') return false;
      } else {
        // 'all' tab: show non-completed by default, or all
        if (statusFilter === 'all' && act.status === 'completed') return false;
      }

      // Priority filter
      if (priorityFilter !== 'all' && act.priority !== priorityFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && act.status !== statusFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = act.action_title.toLowerCase().includes(q);
        const matchesOwner = (act.assigned_user_name || act.owner_name || '').toLowerCase().includes(q);
        const matchesProject = (act.projects?.title || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesOwner && !matchesProject) return false;
      }

      return true;
    });
  }, [actions, activeTab, priorityFilter, statusFilter, searchQuery, now, user?.id]);

  // Donut chart SVG calculations
  const totalOpen = buckets.totalOpen;
  const overdueRatio = totalOpen > 0 ? buckets.overdueCount / totalOpen : 0;
  const todayRatio = totalOpen > 0 ? buckets.dueTodayCount / totalOpen : 0;
  const weekRatio = totalOpen > 0 ? buckets.dueThisWeekCount / totalOpen : 0;
  const laterRatio = totalOpen > 0 ? (buckets.dueLaterCount + buckets.noDueDateCount) / totalOpen : 0;

  // Donut stroke offsets (circumference = 2 * PI * 42 ~= 263.89)
  const C = 263.89;
  const strokeOverdue = overdueRatio * C;
  const strokeToday = todayRatio * C;
  const strokeWeek = weekRatio * C;
  const strokeLater = laterRatio * C;

  const offsetOverdue = 0;
  const offsetToday = -strokeOverdue;
  const offsetWeek = -(strokeOverdue + strokeToday);
  const offsetLater = -(strokeOverdue + strokeToday + strokeWeek);

  // Toggle complete
  const handleToggleComplete = async (action: ActionRecord) => {
    if (!supabase) return;
    const newStatus: ActionStatus = action.status === 'completed' ? 'not_started' : 'completed';
    await updateAction(supabase, action.id, { status: newStatus });
    loadActions();
  };

  // Create manual action
  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await saveAction(supabase, {
        action_title: newTitle.trim(),
        priority: newPriority,
        due_date: newDueDate || null,
        owner_name: newOwner.trim() || 'Anthony',
        project_id: newProject || null,
        status: 'not_started',
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDueDate('');
      setNewOwner('');
      setNewProject('');
      loadActions();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ach-container">
      {/* Top Header */}
      <div className="ach-top">
        <div>
          <h1 className="ach-heading" style={{ fontSize: '26px' }}>
            Action Command Hub
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--ach-slate)', fontSize: '13px' }}>
            One trusted place to see, prioritise and complete pending work.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="ach-btn-secondary"
            onClick={loadActions}
            title="Refresh actions from database"
          >
            ↻ Refresh
          </button>
          <button
            className="ach-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Create item
          </button>
        </div>
      </div>

      {/* Suggested Actions Banner (only shown if authentic candidates exist) */}
      {candidates.length > 0 && !bannerDismissed && (
        <div className="ach-banner" role="status">
          <div style={{ flex: 1, minWidth: '220px' }}>
            <strong style={{ color: 'var(--ach-navy)', fontSize: '14px' }}>
              ✦ {candidates.length} suggested action{candidates.length > 1 ? 's' : ''} detected
            </strong>
            <div style={{ fontSize: '12.5px', color: 'var(--ach-slate)', marginTop: '2px' }}>
              Extracted from recent meeting records and communications for your review.
            </div>
          </div>
          <button
            className="ach-btn-primary"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setShowReviewPanel(true)}
          >
            Review suggestions ({candidates.length})
          </button>
          <button
            className="ach-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={async () => {
              for (const c of candidates) {
                await dismissCandidate(supabase, c.id);
              }
              setCandidates([]);
              setBannerDismissed(true);
            }}
          >
            Dismiss all
          </button>
        </div>
      )}

      {/* Summary KPI Strip & Donut */}
      <div className="ach-sum">
        {/* KPI Counts Card */}
        <div className="ach-card ach-cnt">
          <div>
            <span>Total open</span>
            <b>{buckets.totalOpen}</b>
          </div>
          <div style={{ borderLeft: '3px solid var(--ach-red)' }}>
            <span style={{ color: 'var(--ach-red)' }}>Overdue</span>
            <b style={{ color: 'var(--ach-red)' }}>{buckets.overdueCount}</b>
          </div>
          <div style={{ borderLeft: '3px solid var(--ach-gold)' }}>
            <span style={{ color: '#9E740A' }}>Due this week</span>
            <b>{buckets.dueTodayCount + buckets.dueThisWeekCount}</b>
          </div>
          <div>
            <span>Completed</span>
            <b>{buckets.completedCount}</b>
          </div>
        </div>

        {/* Breakdown Donut & Legend */}
        <div className="ach-card ach-dn">
          <svg width="100" height="100" viewBox="0 0 100 100" aria-label="Action breakdown donut">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E4E8EF" strokeWidth="12" />
            {totalOpen > 0 && (
              <>
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--ach-red)"
                  strokeWidth="12"
                  strokeDasharray={`${strokeOverdue} ${C}`}
                  strokeDashoffset={offsetOverdue}
                  transform="rotate(-90 50 50)"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--ach-gold)"
                  strokeWidth="12"
                  strokeDasharray={`${strokeToday} ${C}`}
                  strokeDashoffset={offsetToday}
                  transform="rotate(-90 50 50)"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--ach-navy2)"
                  strokeWidth="12"
                  strokeDasharray={`${strokeWeek} ${C}`}
                  strokeDashoffset={offsetWeek}
                  transform="rotate(-90 50 50)"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--ach-slate)"
                  strokeWidth="12"
                  strokeDasharray={`${strokeLater} ${C}`}
                  strokeDashoffset={offsetLater}
                  transform="rotate(-90 50 50)"
                />
              </>
            )}
            <text
              x="50"
              y="47"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="var(--ach-navy)"
              fontFamily="Poppins, sans-serif"
            >
              {totalOpen}
            </text>
            <text
              x="50"
              y="61"
              textAnchor="middle"
              fontSize="9"
              fill="var(--ach-slate)"
              fontFamily="Inter, sans-serif"
            >
              Open
            </text>
          </svg>

          <div className="ach-lg">
            <div className="ach-lg-row">
              <i style={{ background: 'var(--ach-red)' }}></i>
              <span>Overdue</span>
              <b>
                {buckets.overdueCount}
                <em>{totalOpen > 0 ? Math.round((buckets.overdueCount / totalOpen) * 100) : 0}%</em>
              </b>
            </div>
            <div className="ach-lg-row">
              <i style={{ background: 'var(--ach-gold)' }}></i>
              <span>Due today / this week</span>
              <b>
                {buckets.dueTodayCount + buckets.dueThisWeekCount}
                <em>
                  {totalOpen > 0
                    ? Math.round(
                        ((buckets.dueTodayCount + buckets.dueThisWeekCount) / totalOpen) * 100
                      )
                    : 0}
                  %
                </em>
              </b>
            </div>
            <div className="ach-lg-row">
              <i style={{ background: 'var(--ach-navy2)' }}></i>
              <span>Due later</span>
              <b>
                {buckets.dueLaterCount}
                <em>{totalOpen > 0 ? Math.round((buckets.dueLaterCount / totalOpen) * 100) : 0}%</em>
              </b>
            </div>
            <div className="ach-lg-row">
              <i style={{ background: 'var(--ach-slate)' }}></i>
              <span>No stated date</span>
              <b>
                {buckets.noDueDateCount}
                <em>{totalOpen > 0 ? Math.round((buckets.noDueDateCount / totalOpen) * 100) : 0}%</em>
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ach-tabs">
        <button
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => setActiveTab('all')}
        >
          All actions ({actions.filter((a) => a.status !== 'completed').length})
        </button>
        <button
          className={activeTab === 'mine' ? 'active' : ''}
          onClick={() => setActiveTab('mine')}
        >
          Assigned to me
        </button>
        <button
          className={activeTab === 'overdue' ? 'active' : ''}
          onClick={() => setActiveTab('overdue')}
        >
          Overdue ({buckets.overdueCount})
        </button>
        <button
          className={activeTab === 'due_week' ? 'active' : ''}
          onClick={() => setActiveTab('due_week')}
        >
          Due this week ({buckets.dueTodayCount + buckets.dueThisWeekCount})
        </button>
        <button
          className={activeTab === 'no_date' ? 'active' : ''}
          onClick={() => setActiveTab('no_date')}
        >
          No stated date ({buckets.noDueDateCount})
        </button>
        <button
          className={activeTab === 'completed' ? 'active' : ''}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({buckets.completedCount})
        </button>
        {candidates.length > 0 && (
          <button
            className={activeTab === 'suggestions' ? 'active' : ''}
            onClick={() => setShowReviewPanel(true)}
            style={{ color: '#9E740A' }}
          >
            Review suggestions ({candidates.length})
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="ach-tb">
        <input
          type="search"
          placeholder="Filter actions by title, owner or project..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Filter actions"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="ach-btn-secondary"
          style={{ padding: '8px 12px' }}
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ach-btn-secondary"
          style={{ padding: '8px 12px' }}
          aria-label="Filter by status"
        >
          <option value="all">Active statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="completed">Completed</option>
        </select>
        <button className="ach-btn-secondary">Sort</button>
        <button className="ach-btn-secondary">Columns (2 hidden)</button>
      </div>

      {/* Grid: Desktop Table View */}
      <div className="ach-card ach-table-wrapper">
        <table className="ach-table">
          <colgroup>
            <col style={{ width: '48px' }} />
            <col style={{ minWidth: '420px', width: 'auto' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '84px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '48px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ width: '48px', textAlign: 'center' }}>
                <input type="checkbox" aria-label="Select all" />
              </th>
              <th style={{ minWidth: '420px', whiteSpace: 'nowrap' }}>Task title</th>
              <th style={{ width: '90px', whiteSpace: 'nowrap' }}>Priority</th>
              <th style={{ width: '150px', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ width: '120px', whiteSpace: 'nowrap' }}>Assignee</th>
              <th style={{ width: '110px', whiteSpace: 'nowrap' }}>Due</th>
              <th style={{ width: '150px', whiteSpace: 'nowrap' }}>Project</th>
              <th style={{ width: '84px', whiteSpace: 'nowrap' }}>Source</th>
              <th style={{ width: '120px', whiteSpace: 'nowrap' }}>Calendar sync</th>
              <th style={{ width: '100px', whiteSpace: 'nowrap' }}>Updated</th>
              <th style={{ width: '48px' }}></th>
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
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={row.status === 'completed'}
                        onChange={() => handleToggleComplete(row)}
                        aria-label={`Select task ${row.action_title}`}
                      />
                    </td>
                    <td
                      style={{
                        minWidth: '420px',
                        whiteSpace: 'nowrap',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        fontWeight: 600,
                        color: 'var(--ach-navy)',
                        letterSpacing: 'normal',
                        wordBreak: 'keep-all',
                      }}
                    >
                      <span className="ach-task-title">{row.action_title}</span>
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
            Concludo detected {candidates.length} suggested action{candidates.length > 1 ? 's' : ''} from
            your transcripts and communications.
          </div>

          <div style={{ margin: '14px 0' }}>
            {candidates.map((c) => {
              const checked = selectedCandidateIds[c.id] ?? true;
              return (
                <div key={c.id} className={`ach-row-card ${c.isDuplicate ? 'warn' : ''}`}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedCandidateIds((prev) => ({
                          ...prev,
                          [c.id]: e.target.checked,
                        }))
                      }
                      style={{ marginTop: '3px' }}
                      aria-label={`Select candidate ${c.title}`}
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '13.5px', color: 'var(--ach-navy)' }}>
                        {c.title}
                      </strong>
                      <div className="f">
                        <span className="ach-tag">{c.source}</span>
                        <span className="ach-tag">Owner: {c.ownerLabel}</span>
                        <span className="ach-tag">Due: {c.dueText}</span>
                        {c.isDuplicate && (
                          <span
                            className="ach-tag"
                            style={{ background: '#FFE194', color: '#684B00', fontWeight: 600 }}
                          >
                            ⚠ Possible duplicate
                          </span>
                        )}
                      </div>
                      {c.quote && (
                        <blockquote
                          style={{
                            margin: '8px 0 0 0',
                            padding: '6px 10px',
                            background: '#F4F6FA',
                            borderLeft: '3px solid var(--ach-line)',
                            fontSize: '12px',
                            color: 'var(--ach-slate)',
                            fontStyle: 'italic',
                          }}
                        >
                          "{c.quote}"
                        </blockquote>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              className="ach-btn-primary"
              style={{ flex: 1 }}
              onClick={async () => {
                const toSave = candidates.filter((c) => selectedCandidateIds[c.id] ?? true);
                if (toSave.length === 0) {
                  setShowReviewPanel(false);
                  return;
                }
                for (const c of toSave) {
                  await approveCandidate(supabase, c.rawCandidate || c);
                }
                setShowReviewPanel(false);
                await Promise.all([loadActions(), loadCandidates()]);
              }}
            >
              Save selected actions
            </button>
            <button
              className="ach-btn-secondary"
              onClick={async () => {
                const toDismiss = candidates.filter((c) => selectedCandidateIds[c.id]);
                for (const c of toDismiss) {
                  await dismissCandidate(supabase, c.id);
                }
                setShowReviewPanel(false);
                await loadCandidates();
              }}
            >
              Dismiss selected
            </button>
          </div>
        </aside>
      )}

      {/* Create Manual Item Modal */}
      {showCreateModal && (
        <div className="ach-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create Action Item">
          <div className="ach-modal-box">
            <h2 className="ach-heading" style={{ fontSize: '18px' }}>
              Create Action Item
            </h2>
            <p className="ach-note" style={{ margin: '4px 0 14px 0' }}>
              Add a new governed task to the Action Command Hub.
            </p>

            <form onSubmit={handleCreateAction}>
              <label className="ach-field">
                Task title *
                <input
                  type="text"
                  className="ach-field-input"
                  required
                  placeholder="e.g. Finalise and issue agreed contract"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="ach-field">Priority</label>
              <div className="ach-seg">
                <button
                  type="button"
                  className={newPriority === 'low' ? 'active' : ''}
                  onClick={() => setNewPriority('low')}
                >
                  Low
                </button>
                <button
                  type="button"
                  className={newPriority === 'medium' ? 'active' : ''}
                  onClick={() => setNewPriority('medium')}
                >
                  Medium
                </button>
                <button
                  type="button"
                  className={newPriority === 'high' ? 'active' : ''}
                  onClick={() => setNewPriority('high')}
                >
                  High
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="ach-field">
                  Due date
                  <input
                    type="date"
                    className="ach-field-input"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </label>
                <label className="ach-field">
                  Assignee
                  <input
                    type="text"
                    className="ach-field-input"
                    placeholder="e.g. Anthony"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                  />
                </label>
              </div>

              <label className="ach-field">
                Project
                <select
                  className="ach-field-input"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                >
                  <option value="">No project (General / Standalone)</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
                <button
                  type="button"
                  className="ach-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ach-btn-primary"
                  disabled={isSubmitting || !newTitle.trim()}
                >
                  {isSubmitting ? 'Creating...' : 'Create item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionHubPage;
