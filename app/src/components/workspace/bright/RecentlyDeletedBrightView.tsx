import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../../../lib/projects/types';
import { DeletedOutputRecord } from '../../../lib/outputs/outputClient';
import { OUTPUT_TYPE_LABELS, OutputType } from '../../../lib/outputs/types';
import { DecisionRecord } from '../../../lib/decisions/types';
import { ActionRecord } from '../../../lib/actions/types';
import { EndpointReport } from '../../../lib/reports/types';
import { calculateDaysRemaining, formatDeletedDate } from '../../../lib/retention';
import '../../../styles/workspace-pages-bright.css';

export interface RecentlyDeletedBrightViewProps {
  deletedProjects: Project[];
  deletedOutputs: DeletedOutputRecord[];
  deletedDecisions: DecisionRecord[];
  deletedActions: ActionRecord[];
  deletedReports: Array<EndpointReport & { days_remaining: number }>;
  loading: boolean;
  loadError: string | null;
  actionSuccess: string | null;
  setActionSuccess: (s: string | null) => void;
  actionError: { title: string; message: string } | null;
  onRetry: () => void;
  onRestoreProject: (p: Project) => void;
  onRestoreOutput: (o: DeletedOutputRecord) => void;
  onRestoreDecision: (d: DecisionRecord) => void;
  onRestoreAction: (a: ActionRecord) => void;
  onRestoreReport: (r: EndpointReport & { days_remaining: number }) => void;
  onPermanentDeleteProject: (p: Project) => void;
  onPermanentDeleteOutput: (o: DeletedOutputRecord) => void;
  onPermanentDeleteDecision: (d: DecisionRecord) => void;
  onPermanentDeleteAction: (a: ActionRecord) => void;
  onPermanentDeleteReport: (r: EndpointReport & { days_remaining: number }) => void;
  onDeleteAllPermanently: () => Promise<void>;
  deletingAll: boolean;
}

export const RecentlyDeletedBrightView: React.FC<RecentlyDeletedBrightViewProps> = ({
  deletedProjects,
  deletedOutputs,
  deletedDecisions,
  deletedActions,
  deletedReports,
  loading,
  loadError,
  actionSuccess,
  setActionSuccess,
  actionError,
  onRetry,
  onRestoreProject,
  onRestoreOutput,
  onRestoreDecision,
  onRestoreAction,
  onRestoreReport,
  onPermanentDeleteProject,
  onPermanentDeleteOutput,
  onPermanentDeleteDecision,
  onPermanentDeleteAction,
  onPermanentDeleteReport,
  onDeleteAllPermanently,
  deletingAll,
}) => {
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'projects' | 'outputs' | 'decisions' | 'actions' | 'reports'
  >('all');

  // Modal states
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'project' | 'output' | 'decision' | 'action' | 'report';
    title: string;
    item: any;
  } | null>(null);

  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [confirmDeleteAllInput, setConfirmDeleteAllInput] = useState('');

  const totalCount =
    deletedProjects.length +
    deletedOutputs.length +
    deletedDecisions.length +
    deletedActions.length +
    deletedReports.length;

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'project') onPermanentDeleteProject(itemToDelete.item);
    else if (itemToDelete.type === 'output') onPermanentDeleteOutput(itemToDelete.item);
    else if (itemToDelete.type === 'decision') onPermanentDeleteDecision(itemToDelete.item);
    else if (itemToDelete.type === 'action') onPermanentDeleteAction(itemToDelete.item);
    else if (itemToDelete.type === 'report') onPermanentDeleteReport(itemToDelete.item);
    setItemToDelete(null);
  };

  const handleConfirmDeleteAll = async () => {
    if (confirmDeleteAllInput !== 'DELETE ALL') return;
    await onDeleteAllPermanently();
    setDeleteAllOpen(false);
    setConfirmDeleteAllInput('');
  };

  return (
    <div className="ws-shell">
      {/* Back link */}
      <Link to="/settings" className="ws-back">
        &larr; Settings
      </Link>

      {/* Header */}
      <div className="ws-top">
        <div>
          <div style={{ marginBottom: '6px' }}>
            <span className="ws-pill ws-dg">30-day recovery period</span>
          </div>
          <h1>Recently deleted</h1>
          <p>
            Soft-deleted projects, outputs, decisions, actions and reports remain recoverable for 30 days before being permanently purged.
          </p>
        </div>
        {totalCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setDeleteAllOpen(true);
              setConfirmDeleteAllInput('');
            }}
            className="ws-bd"
          >
            Delete all permanently
          </button>
        )}
      </div>

      {/* Feedback Banners */}
      {actionSuccess && (
        <div className="ws-ban ws-grn">
          <span>
            <b>{actionSuccess}</b>
          </span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="ws-btn2"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="ws-ban ws-red">
          <div>
            <b>{actionError.title}</b>
            <div className="ws-note">{actionError.message}</div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="ws-btn2"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Retry
          </button>
        </div>
      )}

      {loadError && (
        <div className="ws-ban ws-red">
          <div>
            <b>Failed to load recently deleted items</b>
            <div className="ws-note">{loadError}</div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="ws-btn2"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="ws-seg">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`ws-chip ${activeFilter === 'all' ? 'ws-on' : ''}`}
        >
          All ({totalCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('projects')}
          className={`ws-chip ${activeFilter === 'projects' ? 'ws-on' : ''}`}
        >
          Projects ({deletedProjects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('outputs')}
          className={`ws-chip ${activeFilter === 'outputs' ? 'ws-on' : ''}`}
        >
          Outputs ({deletedOutputs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('decisions')}
          className={`ws-chip ${activeFilter === 'decisions' ? 'ws-on' : ''}`}
        >
          Decisions ({deletedDecisions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('actions')}
          className={`ws-chip ${activeFilter === 'actions' ? 'ws-on' : ''}`}
        >
          Actions ({deletedActions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('reports')}
          className={`ws-chip ${activeFilter === 'reports' ? 'ws-on' : ''}`}
        >
          Reports ({deletedReports.length})
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="ws-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="ws-sub">Retrieving soft-deleted records...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && totalCount === 0 && (
        <div className="ws-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2>No recently deleted items</h2>
          <p className="ws-note" style={{ maxWidth: '440px', margin: '8px auto 0 auto' }}>
            Records you delete are retained for 30 days before being permanently purged.
          </p>
        </div>
      )}

      {/* Groups */}
      {!loading && (
        <>
          {/* 1. Projects */}
          {(activeFilter === 'all' || activeFilter === 'projects') && deletedProjects.length > 0 && (
            <div className="ws-card">
              <h2>Projects ({deletedProjects.length})</h2>
              {deletedProjects.map((p) => {
                const daysLeft = calculateDaysRemaining(p.purge_after, p.deleted_at);
                return (
                  <div key={p.id} className="ws-row">
                    <div>
                      <b>{p.title}</b>
                      <div className="ws-note">
                        Project &middot; Deleted {formatDeletedDate(p.deleted_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className={`ws-days ${daysLeft <= 3 ? 'ws-low' : ''}`}>
                        {daysLeft} days left
                      </span>
                      <button
                        type="button"
                        onClick={() => onRestoreProject(p)}
                        className="ws-btn2"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({ type: 'project', title: p.title, item: p })
                        }
                        className="ws-bd"
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. Outputs */}
          {(activeFilter === 'all' || activeFilter === 'outputs') && deletedOutputs.length > 0 && (
            <div className="ws-card">
              <h2>Outputs ({deletedOutputs.length})</h2>
              {deletedOutputs.map((o) => {
                const daysLeft = calculateDaysRemaining(o.purge_after, o.deleted_at);
                const outputLabel = OUTPUT_TYPE_LABELS[o.output_type as OutputType] || o.output_type;
                const displayTitle = o.projects?.title ? `${outputLabel} (${o.projects.title})` : outputLabel;
                return (
                  <div key={o.id} className="ws-row">
                    <div>
                      <b>{displayTitle}</b>
                      <div className="ws-note">
                        {o.output_type} &middot; Deleted {formatDeletedDate(o.deleted_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className={`ws-days ${daysLeft <= 3 ? 'ws-low' : ''}`}>
                        {daysLeft} days left
                      </span>
                      <button
                        type="button"
                        onClick={() => onRestoreOutput(o)}
                        className="ws-btn2"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({
                            type: 'output',
                            title: displayTitle,
                            item: o,
                          })
                        }
                        className="ws-bd"
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. Decisions */}
          {(activeFilter === 'all' || activeFilter === 'decisions') && deletedDecisions.length > 0 && (
            <div className="ws-card">
              <h2>Decisions ({deletedDecisions.length})</h2>
              {deletedDecisions.map((d) => {
                const daysLeft = calculateDaysRemaining(d.purge_after, d.deleted_at);
                return (
                  <div key={d.id} className="ws-row">
                    <div>
                      <b>{d.decision_title}</b>
                      <div className="ws-note">
                        Decision &middot; Deleted {formatDeletedDate(d.deleted_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className={`ws-days ${daysLeft <= 3 ? 'ws-low' : ''}`}>
                        {daysLeft} days left
                      </span>
                      <button
                        type="button"
                        onClick={() => onRestoreDecision(d)}
                        className="ws-btn2"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({
                            type: 'decision',
                            title: d.decision_title,
                            item: d,
                          })
                        }
                        className="ws-bd"
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. Actions */}
          {(activeFilter === 'all' || activeFilter === 'actions') && deletedActions.length > 0 && (
            <div className="ws-card">
              <h2>Actions ({deletedActions.length})</h2>
              {deletedActions.map((a) => {
                const daysLeft = calculateDaysRemaining(a.purge_after, a.deleted_at);
                return (
                  <div key={a.id} className="ws-row">
                    <div>
                      <b>{a.action_title}</b>
                      <div className="ws-note">
                        Action, deleted from Action Command Hub &middot; Deleted {formatDeletedDate(a.deleted_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className={`ws-days ${daysLeft <= 3 ? 'ws-low' : ''}`}>
                        {daysLeft} days left
                      </span>
                      <button
                        type="button"
                        onClick={() => onRestoreAction(a)}
                        className="ws-btn2"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({ type: 'action', title: a.action_title, item: a })
                        }
                        className="ws-bd"
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 5. Reports */}
          {(activeFilter === 'all' || activeFilter === 'reports') && deletedReports.length > 0 && (
            <div className="ws-card">
              <h2>Reports ({deletedReports.length})</h2>
              {deletedReports.map((r) => {
                const daysLeft = r.days_remaining ?? calculateDaysRemaining((r as any).purge_after, r.deleted_at);
                return (
                  <div key={r.id} className="ws-row">
                    <div>
                      <b>{r.title}</b>
                      <div className="ws-note">
                        Report &middot; Deleted {formatDeletedDate(r.deleted_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className={`ws-days ${daysLeft <= 3 ? 'ws-low' : ''}`}>
                        {daysLeft} days left
                      </span>
                      <button
                        type="button"
                        onClick={() => onRestoreReport(r)}
                        className="ws-btn2"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({
                            type: 'report',
                            title: r.title,
                            item: r,
                          })
                        }
                        className="ws-bd"
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Single Permanent Delete Modal */}
      {itemToDelete && (
        <div className="ws-modal-backdrop">
          <div className="ws-mb" role="dialog" aria-modal="true">
            <h2>Delete permanently?</h2>
            <p>
              &ldquo;{itemToDelete.title}&rdquo; will be removed for good and cannot be restored. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="ws-btn2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="ws-bdf"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Modal with typed confirmation */}
      {deleteAllOpen && (
        <div className="ws-modal-backdrop">
          <div className="ws-mb" role="dialog" aria-modal="true">
            <h2>Delete all items permanently?</h2>
            <p>
              This will permanently remove all {totalCount} soft-deleted items across projects, outputs, decisions, actions and reports. This cannot be undone.
            </p>
            <label className="ws-label">
              Type <b>DELETE ALL</b> to confirm:
              <input
                type="text"
                className="ws-in"
                value={confirmDeleteAllInput}
                onChange={(e) => setConfirmDeleteAllInput(e.target.value)}
                placeholder="DELETE ALL"
              />
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                disabled={deletingAll}
                onClick={() => {
                  setDeleteAllOpen(false);
                  setConfirmDeleteAllInput('');
                }}
                className="ws-btn2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmDeleteAllInput !== 'DELETE ALL' || deletingAll}
                onClick={handleConfirmDeleteAll}
                className="ws-bdf"
              >
                {deletingAll ? 'Deleting all...' : 'Delete all permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
