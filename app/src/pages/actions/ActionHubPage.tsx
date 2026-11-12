import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  fetchActions,
  saveAction,
  updateAction,
  softDeleteAction,
  restoreAction,
  compareActionsByPriorityAndDue,
  canUserEditAction,
} from '../../lib/actions/actionClient';
import {
  ActionRecord,
  ActionStatus,
  ActionPriority,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '../../lib/actions/types';
import { approveCandidate, dismissCandidate, fetchCandidates } from '../../lib/actions/actionCandidates';
import { calculateActionBuckets, getActionBucket } from '../../lib/actions/actionBuckets';
import { melbourneToday } from '../../lib/intel/actionStatus';
import {
  parseActionRegisterCsv,
  importActionBatch,
  reverseImportBatch,
  restoreImportBatch,
  computeContentHash,
  checkDuplicateBatch,
  ImportedActionRow,
} from '../../lib/actions/actionImport';
import { parseUploadedFile } from '../../lib/intelligence/fileParser';
import {
  runDocumentActionAgent,
  saveDocumentActionsToHub,
  ExtractedDocumentAction,
  DocumentAgentRunResult,
} from '../../lib/actions/documentActionAgent';
import { createCalendarItem } from '../../lib/calendar/calendarClient';
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
  rawCandidate?: any;
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'document' | 'csv'>('document');
  // Document Agent state
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docExtracting, setDocExtracting] = useState(false);
  const [docExtractResult, setDocExtractResult] = useState<DocumentAgentRunResult | null>(null);
  const [docActions, setDocActions] = useState<ExtractedDocumentAction[]>([]);
  const [docRawText, setDocRawText] = useState('');
  const [docPromptDate, setDocPromptDate] = useState('');
  const [docGlobalCalendar, setDocGlobalCalendar] = useState(true);
  const [docSaving, setDocSaving] = useState(false);

  // CSV Import state
  const [importRows, setImportRows] = useState<ImportedActionRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importRawCsv, setImportRawCsv] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [lastBatchUndone, setLastBatchUndone] = useState(false);
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

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportRows([]);
    setDocFile(null);
    setDocExtractResult(null);
    setDocActions([]);
    setDocRawText('');
    setDocPromptDate('');
    setDuplicateWarning(null);
    setImportFileName('');
    setImportRawCsv('');
  };

  const handleImportDocumentActions = async () => {
    if (!user?.id || !docFile) return;
    setDocSaving(true);
    try {
      const res = await saveDocumentActionsToHub(supabase, user.id, {
        actions: docActions,
        documentName: docFile.name,
        documentRawText: docRawText,
        projectId: actions[0]?.project_id || null,
        globalDateOverride: docPromptDate || undefined,
      });
      if (res.success) {
        setLastBatchId(res.batchId);
        setLastBatchUndone(false);
        const calMsg = res.calendarCount > 0 ? ` and ${res.calendarCount} added to Calendar` : '';
        showToast(res.warning || `Successfully imported ${res.actionsCount} actions${calMsg}.`);
        handleCloseImportModal();
        const { data: refreshed } = await fetchActions(supabase);
        if (refreshed) setActions(refreshed);
      } else {
        showToast(`Import error: ${res.error || 'Server error'}`);
      }
    } catch (err: any) {
      showToast(`Import error: ${err?.message || 'Server error'}`);
    } finally {
      setDocSaving(false);
    }
  };

  const handleImportCsvActions = async () => {
    if (!user?.id) return;
    setImporting(true);
    try {
      const res = await importActionBatch(supabase, user.id, importRows, null, importFileName || 'action_plan.csv', importRawCsv);
      if (res.success) {
        setLastBatchId(res.batchId);
        setLastBatchUndone(false);
        showToast(res.warning || `Imported ${res.count} actions successfully.`);
        handleCloseImportModal();
        const { data: refreshed } = await fetchActions(supabase);
        if (refreshed) setActions(refreshed);
      } else {
        showToast(`Import error: ${res.error || 'Server error'}`);
      }
    } catch (err: any) {
      showToast(`Import error: ${err?.message || 'Server error'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleUndoBatch = async () => {
    if (!user?.id || !lastBatchId) return;
    const res = await reverseImportBatch(supabase, lastBatchId, user.id);
    if (res.success) {
      showToast('Import batch undone.');
      setLastBatchUndone(true);
      const { data: refreshed } = await fetchActions(supabase);
      if (refreshed) setActions(refreshed);
    } else {
      showToast(`Could not reverse batch: ${res.error || 'Server error'}`);
    }
  };

  const handleRestoreBatch = async () => {
    if (!user?.id || !lastBatchId) return;
    const res = await restoreImportBatch(supabase, lastBatchId, user.id);
    if (res.success) {
      showToast('Import batch restored.');
      setLastBatchUndone(false);
      const { data: refreshed } = await fetchActions(supabase);
      if (refreshed) setActions(refreshed);
    } else {
      showToast(`Could not restore batch: ${res.error || 'Server error'}`);
    }
  };

  // Action Command Hub Edit Controls state
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteModalTask, setDeleteModalTask] = useState<ActionRecord | null>(null);
  const [deleteCalendarItem, setDeleteCalendarItem] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastUndo, setToastUndo] = useState(false);
  const toastTimerRef = React.useRef<any>(null);
  const deletedActionsRef = React.useRef<ActionRecord[]>([]);
  const activeTriggerRef = React.useRef<HTMLElement | null>(null);

  const showToast = useCallback((msg: string, undo: boolean = false) => {
    setToastMsg(msg);
    setToastUndo(undo);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
      setToastUndo(false);
    }, 4500);
  }, []);

  // Close open dropdown when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.ach-dd')) {
        setOpenMenu(null);
        activeTriggerRef.current?.focus();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Suggestions state
  const [candidates, setCandidates] = useState<CandidateSuggestion[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Record<string, boolean>>({});

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => melbourneToday(now), [now]);

  // Load real candidates from Supabase (only if any exist)
  const loadCandidates = useCallback(async () => {
    if (!user?.id) {
      setCandidates([]);
      return;
    }
    try {
      const { data, error: cErr } = await fetchCandidates(supabase);
      if (!cErr && Array.isArray(data) && data.length > 0) {
        setCandidates(
          data.map((c: any) => ({
            id: c.id,
            title: c.title || 'Untitled task',
            ownerLabel: c.proposed_owner_label || 'unassigned',
            ownerBasis: c.owner_basis || 'inferred',
            priority: c.proposed_priority || 'medium',
            dueText: c.proposed_due || 'none found',
            dueBasis: c.due_basis || 'none',
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
    await handleSetStatus(action, nextStatus);
  };

  // Set status handler with optimistic UI and rollback
  const handleSetStatus = async (action: ActionRecord, nextStatus: ActionStatus) => {
    if (action.status === nextStatus) {
      setOpenMenu(null);
      return;
    }
    const prevActions = [...actions];
    const updated = {
      ...action,
      status: nextStatus,
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
      completed_by: nextStatus === 'completed' ? user?.id || null : null,
      updated_at: new Date().toISOString(),
    };
    setActions((prev) => prev.map((a) => (a.id === action.id ? updated : a)));
    setOpenMenu(null);

    activeTriggerRef.current?.focus();
    const { error: updErr } = await updateAction(supabase, action.id, {
      status: nextStatus,
      old_status: action.status,
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
      completed_by: nextStatus === 'completed' ? user?.id || null : null,
    });
    if (updErr) {
      setActions(prevActions);
      showToast(`Could not save status: ${updErr.message}`);
    } else {
      const label = STATUS_LABELS[nextStatus] || nextStatus;
      showToast(`Status saved: ${label}. Dashboard updated.`);
    }
  };

  // Set priority handler with optimistic UI, re-sort, and rollback
  const handleSetPriority = async (action: ActionRecord, nextPriority: ActionPriority) => {
    if (action.priority === nextPriority) {
      setOpenMenu(null);
      return;
    }
    const prevActions = [...actions];
    const updated = {
      ...action,
      priority: nextPriority,
      updated_at: new Date().toISOString(),
    };
    const sorted = prevActions
      .map((a) => (a.id === action.id ? updated : a))
      .sort(compareActionsByPriorityAndDue);

    setActions(sorted);
    setOpenMenu(null);

    activeTriggerRef.current?.focus();
    const { error: updErr } = await updateAction(supabase, action.id, {
      priority: nextPriority,
      old_priority: action.priority,
    });
    if (updErr) {
      setActions(prevActions);
      showToast(`Could not save priority: ${updErr.message}`);
    } else {
      const label = PRIORITY_LABELS[nextPriority] || nextPriority;
      showToast(`Priority saved: ${label}. List re-ordered. Dashboard updated.`);
    }
  };

  // Delete task handler with soft delete, 30-day retention, and toast undo
  const handleDeleteTask = async () => {
    if (!deleteModalTask) return;
    const target = deleteModalTask;
    const prevActions = [...actions];
    deletedActionsRef.current.push(target);
    setActions((prev) => prev.filter((a) => a.id !== target.id));
    setDeleteModalTask(null);
    setOpenMenu(null);

    const { success, error: delErr } = await softDeleteAction(supabase, target.id);
    if (!success || delErr) {
      setActions(prevActions);
      deletedActionsRef.current = deletedActionsRef.current.filter((a) => a.id !== target.id);
      showToast(`Could not delete task: ${delErr?.message || 'Server error'}`);
      return;
    }

    if (deleteCalendarItem && target.id) {
      try {
        await supabase
          .from('calendar_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('source_id', target.id);
      } catch {}
    }
    showToast('Task deleted. Dashboard updated.', true);
  };

  // Undo delete
  const handleUndoDelete = async () => {
    const restored = deletedActionsRef.current.pop();
    if (!restored) return;
    const { success, error: resErr } = await restoreAction(supabase, restored.id);
    if (success && !resErr) {
      if (restored.id) {
        try {
          await supabase
            .from('calendar_items')
            .update({ deleted_at: null })
            .eq('source_id', restored.id);
        } catch {}
      }
      setActions((prev) => [...prev, restored].sort(compareActionsByPriorityAndDue));
      showToast('Task restored.');
    } else {
      showToast(`Could not restore task: ${resErr?.message || 'Server error'}`);
    }
  };

  // Create task
  const handleSaveCreate = async () => {
    if (!createTitle.trim()) return;
    setCreateSaving(true);
    try {
      // Pick first project or null
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
        setActions((prev) => [...prev, data].sort(compareActionsByPriorityAndDue));

        // Also create Calendar item if user checked "Also add a calendar reminder"
        if (createCalendarReminder && user?.id && createDueDate) {
          try {
            await createCalendarItem(supabase, {
              creator_id: user.id,
              type: createKind === 'event' ? 'event' : 'task',
              title: createTitle.trim(),
              description: createDescription.trim() || undefined,
              due_date: createDueDate,
              status: 'open',
              priority: createPriority,
              source_type: 'other',
              source_title: 'Action Command Hub',
              source_reference: data.id,
              visibility: 'private',
            });
          } catch (calErr) {
            console.warn('Failed to add calendar item for created action:', calErr);
          }
        }

        setShowCreateModal(false);
        setCreateTitle('');
        setCreateDescription('');
        setCreateDueDate('');
        setCreateCalendarReminder(false);
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
            onClick={() => setShowImportModal(true)}
            aria-label="Import action register from CSV"
          >
            Import register
          </button>
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
            onClick={async () => {
              for (const c of candidates) {
                await dismissCandidate(supabase, c.id);
              }
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
              <b>{bucketCounts.waiting}</b>
              <span>Waiting</span>
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
      <div className="ach-card ach-table-wrapper">
        <table className="ach-table">
          <colgroup>
            <col style={{ width: '44px' }} />
            <col style={{ minWidth: '420px', width: 'auto' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '84px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '136px' }} />
            <col style={{ width: '84px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '84px' }} />
            <col style={{ width: '48px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ width: '44px', textAlign: 'center' }}>
                <input type="checkbox" aria-label="Select all" />
              </th>
              <th style={{ minWidth: '420px', whiteSpace: 'nowrap' }}>Task title</th>
              <th style={{ width: '104px', whiteSpace: 'nowrap' }}>Priority</th>
              <th style={{ width: '200px', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ width: '84px', whiteSpace: 'nowrap' }}>Assignee</th>
              <th style={{ width: '104px', whiteSpace: 'nowrap' }}>Due</th>
              <th style={{ width: '136px', whiteSpace: 'nowrap' }}>Project</th>
              <th style={{ width: '84px', whiteSpace: 'nowrap' }}>Source</th>
              <th style={{ width: '110px', whiteSpace: 'nowrap' }}>Calendar sync</th>
              <th style={{ width: '84px', whiteSpace: 'nowrap' }}>Updated</th>
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
                const pRaw = (row.priority || 'normal').toLowerCase();
                const pLabel = pRaw === 'high' ? 'High' : pRaw === 'medium' ? 'Medium' : pRaw === 'low' ? 'Low' : 'Normal';
                const pClass = pRaw === 'high' ? 'ach-pill-hi' : pRaw === 'medium' ? 'ach-pill-me' : pRaw === 'low' ? 'ach-pill-lo' : 'ach-pill-no';
                const sLabel = row.status === 'completed'
                  ? 'Complete'
                  : row.status === 'in_progress'
                  ? 'In progress'
                  : row.status === 'blocked'
                  ? 'Blocked'
                  : row.status === 'waiting'
                  ? 'Waiting on someone else'
                  : 'Not started';

                const isStatusMenuOpen = openMenu === 's-' + row.id;
                const isPriorityMenuOpen = openMenu === 'p-' + row.id;
                const isDotsMenuOpen = openMenu === 'm-' + row.id;
                const canEdit = canUserEditAction(row, user?.id);

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
                    <td style={{ overflow: 'visible' }}>
                      <div className="ach-dd">
                        <button
                          className="ach-ddb"
                          aria-haspopup="listbox"
                          aria-expanded={isPriorityMenuOpen}
                          disabled={!canEdit.allowed}
                          title={canEdit.reason}
                          onClick={(e) => {
                            e.stopPropagation();
                            activeTriggerRef.current = e.currentTarget;
                            setOpenMenu(isPriorityMenuOpen ? null : 'p-' + row.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              activeTriggerRef.current = e.currentTarget;
                              setOpenMenu(isPriorityMenuOpen ? null : 'p-' + row.id);
                            }
                          }}
                        >
                          <span className={`ach-pill ${pClass}`}>{pLabel}</span>
                          <span className="ach-car">&#9662;</span>
                        </button>
                        {isPriorityMenuOpen && (
                          <div className="ach-ddm" role="listbox">
                            {(['high', 'medium', 'normal', 'low'] as ActionPriority[]).map((pr) => {
                              const isSel = pRaw === pr;
                              return (
                                <div
                                  key={pr}
                                  role="option"
                                  aria-selected={isSel}
                                  tabIndex={0}
                                  className={`ach-ddm-item ${isSel ? 'sel' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetPriority(row, pr);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSetPriority(row, pr);
                                    }
                                  }}
                                >
                                  {isSel ? '✓ ' : ''}
                                  {PRIORITY_LABELS[pr]}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ overflow: 'visible' }}>
                      <div className="ach-dd">
                        <button
                          className="ach-ddb"
                          aria-haspopup="listbox"
                          aria-expanded={isStatusMenuOpen}
                          disabled={!canEdit.allowed}
                          title={canEdit.reason}
                          onClick={(e) => {
                            e.stopPropagation();
                            activeTriggerRef.current = e.currentTarget;
                            setOpenMenu(isStatusMenuOpen ? null : 's-' + row.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              activeTriggerRef.current = e.currentTarget;
                              setOpenMenu(isStatusMenuOpen ? null : 's-' + row.id);
                            }
                          }}
                        >
                          <span>{sLabel}</span>
                          <span className="ach-car">&#9662;</span>
                        </button>
                        {isStatusMenuOpen && (
                          <div className="ach-ddm" role="listbox">
                            {([
                              ['not_started', 'Not started'],
                              ['in_progress', 'In progress'],
                              ['completed', 'Complete'],
                              ['waiting', 'Waiting on someone else'],
                              ['blocked', 'Blocked'],
                            ] as [ActionStatus, string][]).map(([stVal, stText]) => {
                              const isSel = row.status === stVal;
                              return (
                                <div
                                  key={stVal}
                                  role="option"
                                  aria-selected={isSel}
                                  tabIndex={0}
                                  className={`ach-ddm-item ${isSel ? 'sel' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetStatus(row, stVal);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSetStatus(row, stVal);
                                    }
                                  }}
                                >
                                  {isSel ? '✓ ' : ''}
                                  {stText}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {isOverdue && row.status !== 'completed' && (
                        <div className="ach-od-line">&#9888; Overdue</div>
                      )}
                    </td>
                    <td>{row.assigned_user_name || row.owner_name || 'Anthony'}</td>
                    <td>{row.due_date ? row.due_date : 'Unscheduled'}</td>
                    <td>{row.projects?.title || row.projects?.project_name || 'Internal'}</td>
                    <td>{row.source_type || 'Meeting'}</td>
                    <td>Not linked</td>
                    <td>{row.updated_at ? row.updated_at.slice(0, 10) : 'Today'}</td>
                    <td style={{ overflow: 'visible', textAlign: 'center' }}>
                      <div className="ach-dd">
                        <button
                          className="ach-ddb-dots"
                          aria-label="More actions"
                          aria-haspopup="menu"
                          aria-expanded={isDotsMenuOpen}
                          disabled={!canEdit.allowed}
                          title={canEdit.reason}
                          onClick={(e) => {
                            e.stopPropagation();
                            activeTriggerRef.current = e.currentTarget;
                            setOpenMenu(isDotsMenuOpen ? null : 'm-' + row.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              activeTriggerRef.current = e.currentTarget;
                              setOpenMenu(isDotsMenuOpen ? null : 'm-' + row.id);
                            }
                          }}
                        >
                          &#8943;
                        </button>
                        {isDotsMenuOpen && (
                          <div className="ach-ddm ach-ddm-right" role="menu">
                            <div
                              role="menuitem"
                              tabIndex={0}
                              className="ach-ddm-item danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenu(null);
                                setDeleteModalTask(row);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenMenu(null);
                                  setDeleteModalTask(row);
                                }
                              }}
                            >
                              Delete task
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
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
          const pRaw = (row.priority || 'normal').toLowerCase();
          const pLabel = pRaw === 'high' ? 'High' : pRaw === 'medium' ? 'Medium' : pRaw === 'low' ? 'Low' : 'Normal';
          const pClass = pRaw === 'high' ? 'ach-pill-hi' : pRaw === 'medium' ? 'ach-pill-me' : pRaw === 'low' ? 'ach-pill-lo' : 'ach-pill-no';
          const sLabel = row.status === 'completed'
            ? 'Complete'
            : row.status === 'in_progress'
            ? 'In progress'
            : row.status === 'blocked'
            ? 'Blocked'
            : row.status === 'waiting'
            ? 'Waiting on someone else'
            : 'Not started';

          const isStatusMenuOpen = openMenu === 's-' + row.id;
          const isPriorityMenuOpen = openMenu === 'p-' + row.id;
          const isDotsMenuOpen = openMenu === 'm-' + row.id;
          const canEdit = canUserEditAction(row, user?.id);

          return (
            <div className="ach-row-card" key={row.id}>
              <b>{row.action_title}</b>
              <div className="f">
                <div className="ach-dd">
                  <button
                    className="ach-ddb"
                    aria-haspopup="listbox"
                    aria-expanded={isPriorityMenuOpen}
                    disabled={!canEdit.allowed}
                    title={canEdit.reason}
                    onClick={(e) => {
                      e.stopPropagation();
                      activeTriggerRef.current = e.currentTarget;
                      setOpenMenu(isPriorityMenuOpen ? null : 'p-' + row.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        activeTriggerRef.current = e.currentTarget;
                        setOpenMenu(isPriorityMenuOpen ? null : 'p-' + row.id);
                      }
                    }}
                  >
                    <span className={`ach-pill ${pClass}`}>{pLabel}</span>
                    <span className="ach-car">&#9662;</span>
                  </button>
                  {isPriorityMenuOpen && (
                    <div className="ach-ddm" role="listbox">
                      {(['high', 'medium', 'normal', 'low'] as ActionPriority[]).map((pr) => (
                        <div
                          key={pr}
                          role="option"
                          aria-selected={pRaw === pr}
                          tabIndex={0}
                          className={`ach-ddm-item ${pRaw === pr ? 'sel' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPriority(row, pr);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSetPriority(row, pr);
                            }
                          }}
                        >
                          {pRaw === pr ? '✓ ' : ''}
                          {PRIORITY_LABELS[pr]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ach-dd">
                  <button
                    className="ach-ddb"
                    aria-haspopup="listbox"
                    aria-expanded={isStatusMenuOpen}
                    disabled={!canEdit.allowed}
                    title={canEdit.reason}
                    onClick={(e) => {
                      e.stopPropagation();
                      activeTriggerRef.current = e.currentTarget;
                      setOpenMenu(isStatusMenuOpen ? null : 's-' + row.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        activeTriggerRef.current = e.currentTarget;
                        setOpenMenu(isStatusMenuOpen ? null : 's-' + row.id);
                      }
                    }}
                  >
                    <span>{sLabel}</span>
                    <span className="ach-car">&#9662;</span>
                  </button>
                  {isStatusMenuOpen && (
                    <div className="ach-ddm" role="listbox">
                      {([
                        ['not_started', 'Not started'],
                        ['in_progress', 'In progress'],
                        ['completed', 'Complete'],
                        ['waiting', 'Waiting on someone else'],
                        ['blocked', 'Blocked'],
                      ] as [ActionStatus, string][]).map(([stVal, stText]) => (
                        <div
                          key={stVal}
                          role="option"
                          aria-selected={row.status === stVal}
                          tabIndex={0}
                          className={`ach-ddm-item ${row.status === stVal ? 'sel' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetStatus(row, stVal);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSetStatus(row, stVal);
                            }
                          }}
                        >
                          {row.status === stVal ? '✓ ' : ''}
                          {stText}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="ach-tag">{row.due_date || 'Unscheduled'}</span>
                {isOverdue && row.status !== 'completed' && (
                  <span className="ach-overdue-badge">&#9888; Overdue</span>
                )}
                <div className="ach-dd" style={{ marginLeft: 'auto' }}>
                  <button
                    className="ach-ddb-dots"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={isDotsMenuOpen}
                    disabled={!canEdit.allowed}
                    title={canEdit.reason}
                    onClick={(e) => {
                      e.stopPropagation();
                      activeTriggerRef.current = e.currentTarget;
                      setOpenMenu(isDotsMenuOpen ? null : 'm-' + row.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        activeTriggerRef.current = e.currentTarget;
                        setOpenMenu(isDotsMenuOpen ? null : 'm-' + row.id);
                      }
                    }}
                  >
                    &#8943;
                  </button>
                  {isDotsMenuOpen && (
                    <div className="ach-ddm ach-ddm-right" role="menu">
                      <div
                        role="menuitem"
                        tabIndex={0}
                        className="ach-ddm-item danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(null);
                          setDeleteModalTask(row);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenu(null);
                            setDeleteModalTask(row);
                          }
                        }}
                      >
                        Delete task
                      </div>
                    </div>
                  )}
                </div>
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
              onClick={async () => {
                const toSave = candidates.filter((c) => selectedCandidateIds[c.id]);
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
            <div className="ach-modal-header">
              <h2 className="ach-heading" style={{ fontSize: '18px', margin: 0 }}>
                Create new item
              </h2>
              <button
                type="button"
                className="ach-btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="ach-modal-body">
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
                  {Array.from(new Set(actions.map((a) => a.projects?.title).filter(Boolean))).map((pName) => (
                    <option key={pName} value={pName as string}>{pName}</option>
                  ))}
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

            </div>
            <div className="ach-modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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

      {/* Import Action Register Modal (D9) */}
      {showImportModal && (
        <div className="ach-modal-backdrop" role="dialog" aria-modal="true" aria-label="Import action register">
          <div className="ach-modal-box ach-modal-box-wide">
            {/* Header - Fixed at top */}
            <div className="ach-modal-header">
              <h2 className="ach-heading" style={{ fontSize: '18px', margin: 0 }}>
                Import Document or Action Register
              </h2>
              <button
                type="button"
                className="ach-btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12.5px' }}
                onClick={handleCloseImportModal}
              >
                ✕ Close
              </button>
            </div>

            {/* Tabs - Fixed below header */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E4E8EF', paddingBottom: '10px', marginBottom: '14px', flexShrink: 0 }}>
              <button
                className={importTab === 'document' ? 'ach-btn-primary' : 'ach-btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '13px' }}
                onClick={() => setImportTab('document')}
              >
                📄 Document Agent (PDF, Word, Plans, Markdown)
              </button>
              <button
                className={importTab === 'csv' ? 'ach-btn-primary' : 'ach-btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '13px' }}
                onClick={() => setImportTab('csv')}
              >
                📊 CSV Register (Action Plan v1.0)
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="ach-modal-body">
              {/* TAB 1: Document Intelligence Agent */}
              {importTab === 'document' && (
                <div>
                  <p style={{ fontSize: '13px', color: '#5A6478', marginTop: 0, marginBottom: '12px' }}>
                    Import documents that contain actions or tasks (PDF, Word .docx, plan text, markdown). The workspace <b>Document Intelligence Agent</b> reads the document, sorts out tasks and events, and auto-fills dates. If dates are missing, pick a date and choose whether to add them to your Concludo Calendar.
                  </p>

                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.markdown"
                    id="ach-doc-upload"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setDocFile(f);
                      setDocExtracting(true);
                      setDuplicateWarning(null);
                      try {
                        const parsed = await parseUploadedFile(f);
                        setDocRawText(parsed.text);
                        const res = runDocumentActionAgent(parsed.text, f.name);
                        setDocExtractResult(res);
                        setDocActions(res.actions);

                        if (user?.id) {
                          const hash = await computeContentHash(parsed.text);
                          const dup = await checkDuplicateBatch(supabase, user.id, hash);
                          if (dup.isDuplicate) {
                            setDuplicateWarning(
                              `A document with identical content was already imported on ${new Date(
                                dup.importedAt || ''
                              ).toLocaleDateString('en-AU')}. Re-importing may create duplicate actions.`
                            );
                          }
                        }
                      } catch (err: any) {
                        showToast(`Failed to parse document: ${err?.message || 'Unknown error'}`);
                      } finally {
                        setDocExtracting(false);
                      }
                    }}
                  />

                  {docFile ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#FAFAFC',
                        border: '1px solid #D0D5DD',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontSize: '20px', flexShrink: 0 }}>📄</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#16263F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {docFile.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#5A6478' }}>
                            {(docFile.size / 1024).toFixed(0)} KB • Document Intelligence Agent ready
                          </div>
                        </div>
                      </div>
                      <label
                        htmlFor="ach-doc-upload"
                        className="ach-btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        Change file
                      </label>
                    </div>
                  ) : (
                    <div
                      style={{ border: '2px dashed #C9D0DC', borderRadius: '8px', padding: '18px 16px', background: '#FAFAFC', textAlign: 'center', marginBottom: '14px', cursor: 'pointer' }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const f = e.dataTransfer.files?.[0];
                        if (!f) return;
                        const inputEl = document.getElementById('ach-doc-upload') as HTMLInputElement;
                        if (inputEl) {
                          const dt = new DataTransfer();
                          dt.items.add(f);
                          inputEl.files = dt.files;
                          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                      }}
                    >
                      <label
                        htmlFor="ach-doc-upload"
                        style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                      >
                        <span style={{ fontSize: '24px' }}>📥</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#16263F' }}>
                          Choose a document (PDF, Word .docx, Markdown, Text)
                        </span>
                        <span style={{ fontSize: '12px', color: '#5A6478' }}>
                          Drag and drop or click to select file. Document Intelligence Agent will analyse immediately.
                        </span>
                      </label>
                    </div>
                  )}

                  {docExtracting && (
                    <div style={{ padding: '16px', textAlign: 'center', background: '#F4F6FA', borderRadius: '6px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#16263F', fontWeight: 600 }}>
                        🤖 Document Intelligence Agent is reading and extracting actions, tasks, and dates...
                      </span>
                    </div>
                  )}

                  {duplicateWarning && (
                    <div style={{ background: '#FDF6E2', border: '1px solid #E2B53C', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', fontSize: '12.5px', color: '#16263F' }}>
                      ⚠️ {duplicateWarning}
                    </div>
                  )}

                  {docExtractResult && docExtractResult.actions.length === 0 && (
                    <div style={{ background: '#FDF6E2', border: '1px solid #E2B53C', borderRadius: '6px', padding: '14px', marginBottom: '12px', fontSize: '13px', color: '#16263F' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        ⚠️ No action items were detected in {docFile?.name || 'this document'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#5A6478' }}>
                        The workspace Document Intelligence Agent scanned the document but found no checkboxes, action table rows, or task lists. Please ensure your document contains an action register, checklist, or next steps table.
                      </div>
                    </div>
                  )}

                  {docExtractResult && docExtractResult.actions.length > 0 && (
                    <div>
                      {/* Agent Status Badge */}
                      <div style={{ background: '#EAF3EC', border: '1px solid #1E7A4C', borderRadius: '6px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E7A4C' }}>
                            ✓ Assigned: {docExtractResult.agentUsed.name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#2B4D36' }}>
                            Extracted {docActions.length} action items ({docActions.filter(a => a.dueDate).length} dated, {docActions.filter(a => !a.dueDate).length} undated)
                            {docExtractResult.gatesCount > 0 ? ` • ${docExtractResult.gatesCount} decision gates detected` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', background: '#1E7A4C', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          Agent Active
                        </span>
                      </div>

                      {/* Missing Date Picker & Calendar Prompt */}
                      {docActions.some((a) => !a.dueDate) && (
                        <div style={{ background: '#FBF0D0', border: '1px solid #E2B53C', borderRadius: '6px', padding: '12px 14px', marginBottom: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#16263F', fontSize: '13px', marginBottom: '4px' }}>
                            📅 {docActions.filter((a) => !a.dueDate).length} items have no date stated in the document
                          </div>
                          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#4A5568' }}>
                            Pick a target date to continue, or apply dates individually below.
                          </p>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              Target date:
                              <input
                                type="date"
                                 value={docPromptDate}
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #C9D0DC', fontSize: '12px' }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDocPromptDate(val);
                                  if (val) {
                                    setDocActions((prev) =>
                                      prev.map((a) => (a.dueDate ? a : { ...a, dueDate: val, dueBasis: 'user_picked', addToCalendar: docGlobalCalendar }))
                                    );
                                  }
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="ach-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '11.5px' }}
                              onClick={() => {
                                if (!docPromptDate) return;
                                setDocActions((prev) =>
                                  prev.map((a) => (a.dueDate ? a : { ...a, dueDate: docPromptDate, dueBasis: 'user_picked', addToCalendar: docGlobalCalendar }))
                                );
                                showToast(`Applied ${docPromptDate} to undated items.`);
                              }}
                            >
                              Apply to all undated
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Concludo Calendar Integration Option */}
                      <div style={{ background: '#F4F6FA', border: '1px solid #C9D0DC', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#16263F' }}>
                            🗓️ Add to Concludo Calendar?
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#5A6478' }}>
                            Automatically sync scheduled tasks and events to your workspace calendar with timeline tracking.
                          </div>
                        </div>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={docGlobalCalendar}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDocGlobalCalendar(checked);
                              setDocActions((prev) => prev.map((a) => (a.dueDate ? { ...a, addToCalendar: checked } : a)));
                            }}
                          />
                          Sync dated items to Concludo Calendar
                        </label>
                      </div>

                      {/* Actions Table with Per-Item Edits */}
                      <div style={{ maxHeight: '340px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #E4E8EF', borderRadius: '6px', fontSize: '12px', marginBottom: '8px' }}>
                        <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#F4F6FA', borderBottom: '1px solid #E4E8EF', textAlign: 'left', position: 'sticky', top: 0, zIndex: 2 }}>
                              <th style={{ padding: '8px 10px', width: '55px', background: '#F4F6FA' }}>ID</th>
                              <th style={{ padding: '8px 10px', minWidth: '280px', background: '#F4F6FA' }}>Task / Event</th>
                              <th style={{ padding: '8px 10px', width: '140px', background: '#F4F6FA' }}>Owner</th>
                              <th style={{ padding: '8px 10px', width: '135px', background: '#F4F6FA' }}>Date</th>
                              <th style={{ padding: '8px 10px', width: '95px', textAlign: 'center', background: '#F4F6FA' }}>To Calendar?</th>
                            </tr>
                          </thead>
                          <tbody>
                            {docActions.map((act, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #F0F2F7', background: !act.dueDate ? '#FFFDF5' : '#FFFFFF' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#5A6478', verticalAlign: 'top' }}>{act.id}</td>
                                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                  <input
                                    type="text"
                                    value={act.title}
                                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E4E8EF', padding: '4px 6px', borderRadius: '4px', fontSize: '12px' }}
                                    onFocus={(e) => (e.target.style.borderColor = '#16263F')}
                                    onBlur={(e) => (e.target.style.borderColor = '#E4E8EF')}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setDocActions((prev) => prev.map((item, i) => (i === idx ? { ...item, title: v } : item)));
                                    }}
                                  />
                                  {act.stage && <span style={{ fontSize: '11px', color: '#5A6478', display: 'block', marginTop: '3px' }}>Stage: {act.stage}</span>}
                                </td>
                                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                  <input
                                    type="text"
                                    value={act.owner}
                                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E4E8EF', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px' }}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setDocActions((prev) => prev.map((item, i) => (i === idx ? { ...item, owner: v } : item)));
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                  <input
                                    type="date"
                                    value={act.dueDate}
                                    style={{ width: '100%', boxSizing: 'border-box', border: !act.dueDate ? '1px solid #E2B53C' : '1px solid #E4E8EF', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px', background: !act.dueDate ? '#FDF6E2' : '#FFFFFF' }}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setDocActions((prev) =>
                                        prev.map((item, i) => (i === idx ? { ...item, dueDate: v, dueBasis: v ? 'user_picked' : 'none', addToCalendar: v ? docGlobalCalendar : false } : item))
                                      );
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <input
                                    type="checkbox"
                                    checked={act.addToCalendar}
                                    disabled={!act.dueDate}
                                    onChange={(e) => {
                                      const c = e.target.checked;
                                      setDocActions((prev) => prev.map((item, i) => (i === idx ? { ...item, addToCalendar: c } : item)));
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CSV Action Register (D9) */}
              {importTab === 'csv' && (
                <div>
                  <p style={{ fontSize: '13px', color: '#5A6478', marginTop: 0, marginBottom: '12px' }}>
                    Upload an action plan CSV with stated and derived items. Each row carries its origin tag.
                  </p>

                  <div style={{ marginBottom: '14px' }}>
                    <input
                      type="file"
                      accept=".csv"
                      aria-label="Upload CSV file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setImportFileName(f.name);
                        setDuplicateWarning(null);
                        const r = new FileReader();
                        r.onload = (ev) => {
                          const txt = ev.target?.result as string;
                          if (txt) {
                            setImportRawCsv(txt);
                            const parsed = parseActionRegisterCsv(txt);
                            setImportRows(parsed);
                            if (user?.id) {
                              computeContentHash(txt).then((hash) => {
                                checkDuplicateBatch(supabase, user.id, hash).then((dup) => {
                                  if (dup.isDuplicate) {
                                    setDuplicateWarning(
                                      `A batch with this exact CSV content was already imported on ${new Date(
                                        dup.importedAt || ''
                                      ).toLocaleDateString('en-AU')}. Re-importing may create duplicate actions.`
                                    );
                                  }
                                });
                              });
                            }
                          }
                        };
                        r.readAsText(f);
                      }}
                    />
                  </div>

                  {duplicateWarning && (
                    <div style={{ background: '#FDF6E2', border: '1px solid #E2B53C', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', fontSize: '12.5px', color: '#16263F' }}>
                      ⚠️ {duplicateWarning}
                    </div>
                  )}

                  {importRows.length > 0 && (
                    <div>
                      <div style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #E4E8EF', borderRadius: '6px', fontSize: '12px', marginTop: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#F4F6FA', borderBottom: '1px solid #E4E8EF', textAlign: 'left', position: 'sticky', top: 0, zIndex: 2 }}>
                              <th style={{ padding: '8px 10px', background: '#F4F6FA' }}>ID</th>
                              <th style={{ padding: '8px 10px', background: '#F4F6FA' }}>Action</th>
                              <th style={{ padding: '8px 10px', background: '#F4F6FA' }}>Owner</th>
                              <th style={{ padding: '8px 10px', background: '#F4F6FA' }}>Due</th>
                              <th style={{ padding: '8px 10px', background: '#F4F6FA' }}>Origin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importRows.slice(0, 20).map((r, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #F0F2F7' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.id}</td>
                                <td style={{ padding: '8px 10px' }}>{r.action}</td>
                                <td style={{ padding: '8px 10px' }}>{r.owner || 'Unassigned'}</td>
                                <td style={{ padding: '8px 10px' }}>{r.due_date || r.due_text || 'Not stated'}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: r.origin === 'Stated in plan' ? '#EAF3EC' : '#FBF0D0',
                                    color: r.origin === 'Stated in plan' ? '#1E7A4C' : '#BC8A1C',
                                    fontWeight: 500,
                                    fontSize: '11px',
                                  }}>
                                    {r.origin}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importRows.length > 20 && (
                          <div style={{ padding: '8px 10px', color: '#5A6478', textAlign: 'center', background: '#FAFAFC' }}>
                            + {importRows.length - 20} more rows
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {lastBatchId && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #E4E8EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#5A6478' }}>
                    {lastBatchUndone ? 'Batch undone (soft-deleted)' : `Last imported batch: ${lastBatchId}`}
                  </span>
                  {!lastBatchUndone ? (
                    <button
                      type="button"
                      className="ach-btn-secondary"
                      style={{ color: '#A32A2A', borderColor: '#E8A0A0' }}
                      onClick={handleUndoBatch}
                    >
                      Undo import batch
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ach-btn-secondary"
                      style={{ color: '#16263F', borderColor: '#E2B53C' }}
                      onClick={handleRestoreBatch}
                    >
                      Restore import batch
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="ach-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#5A6478', maxWidth: '60%' }}>
                {importTab === 'document' ? (
                  docActions.length > 0 ? (
                    <span>
                      <b>{docActions.length}</b> actions ready •{' '}
                      <b>{docActions.filter((a) => a.addToCalendar && a.dueDate).length}</b> will sync to Calendar
                    </span>
                  ) : (
                    <span>Select or drop a plan document to analyse with Document Intelligence Agent.</span>
                  )
                ) : (
                  importRows.length > 0 ? (
                    <span>
                      <b>{importRows.length}</b> actions ready ({importRows.filter((r) => r.origin === 'Stated in plan').length} stated, {importRows.filter((r) => r.origin === 'Derived by reviewer').length} derived)
                    </span>
                  ) : (
                    <span>Upload an action plan CSV (Action Plan v1.0 format).</span>
                  )
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ach-btn-secondary"
                  onClick={handleCloseImportModal}
                >
                  Cancel
                </button>
                {importTab === 'document' ? (
                  <button
                    type="button"
                    className="ach-btn-primary"
                    disabled={docSaving || docActions.length === 0}
                    onClick={handleImportDocumentActions}
                  >
                    {docSaving ? 'Importing with Agent...' : `Import ${docActions.length} actions to Hub`}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ach-btn-primary"
                    disabled={importing || importRows.length === 0}
                    onClick={handleImportCsvActions}
                  >
                    {importing ? 'Importing...' : `Import ${importRows.length} actions`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Section 1.4) */}
      {deleteModalTask && (
        <div className="ach-modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete task">
          <div className="ach-modal-box" style={{ width: '460px', maxWidth: 'calc(100vw - 32px)' }}>
            <div className="ach-modal-header">
              <h2 className="ach-heading" style={{ fontSize: '18px', margin: 0 }}>
                Delete this task?
              </h2>
              <button
                type="button"
                className="ach-btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setDeleteModalTask(null)}
              >
                ✕
              </button>
            </div>
            <div className="ach-modal-body">
              <p style={{ fontSize: '13px', color: 'var(--ach-navy)', lineHeight: 1.5, margin: '8px 0 12px 0' }}>
                &ldquo;{deleteModalTask.action_title}&rdquo; will be removed from your Actions, the Dashboard and any linked project view. You can restore it for 30 days.
              </p>
              {(deleteModalTask.source_type === 'calendar' || Boolean(deleteModalTask.source_id)) && (
                <div style={{ margin: '12px 0' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ach-slate)' }}>
                    <input
                      type="checkbox"
                      checked={deleteCalendarItem}
                      onChange={(e) => setDeleteCalendarItem(e.target.checked)}
                    />
                    Also remove linked calendar item
                  </label>
                </div>
              )}
            </div>
            <div className="ach-modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="ach-btn-secondary" onClick={() => setDeleteModalTask(null)}>
                Cancel
              </button>
              <button
                className="ach-btn-primary"
                style={{ background: 'var(--ach-red)', color: '#ffffff' }}
                onClick={handleDeleteTask}
              >
                Delete task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Toast (Section 2.8) */}
      {toastMsg && (
        <div className="ach-toast" role="status">
          <span>{toastMsg}</span>
          {toastUndo && (
            <button onClick={handleUndoDelete}>Undo</button>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionHubPage;
