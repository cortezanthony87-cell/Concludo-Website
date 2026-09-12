import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  FolderKanban,
  FileText,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  BrainCircuit,
  CheckSquare,
  User,
  Calendar,
  FileBarChart,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { Project } from '../lib/projects/types';
import {
  fetchDeletedProjects,
  restoreProject,
  permanentDeleteProject,
} from '../lib/projects/projectClient';
import {
  fetchDeletedOutputs,
  restoreOutput,
  permanentDeleteOutput,
  DeletedOutputRecord,
} from '../lib/outputs/outputClient';
import { OUTPUT_TYPE_LABELS, OutputType } from '../lib/outputs/types';
import {
  fetchDeletedDecisions,
  restoreDecision,
  permanentDeleteDecision,
} from '../lib/decisions/decisionClient';
import { DecisionRecord } from '../lib/decisions/types';
import {
  fetchDeletedActions,
  restoreAction,
  permanentDeleteAction,
} from '../lib/actions/actionClient';
import { ActionRecord, STATUS_LABELS, isActionOverdue } from '../lib/actions/types';
import {
  fetchDeletedEndpointReports,
  restoreEndpointReport,
  permanentDeleteEndpointReport,
} from '../lib/reports/reportClient';
import { EndpointReport } from '../lib/reports/types';
import {
  calculateDaysRemaining,
  formatDaysRemaining,
  formatDeletedDate,
} from '../lib/retention';

interface ActionErrorState {
  action:
    | 'restore_project'
    | 'restore_output'
    | 'delete_project'
    | 'delete_output'
    | 'restore_decision'
    | 'delete_decision'
    | 'restore_action'
    | 'delete_action'
    | 'restore_report'
    | 'delete_report';
  title: 'Failed to restore item' | 'Failed to delete item';
  message: string;
  targetProject?: Project;
  targetOutput?: DeletedOutputRecord;
  targetDecision?: DecisionRecord;
  targetAction?: ActionRecord;
  targetReport?: EndpointReport & { days_remaining: number };
}

interface ActionProgressState {
  type: 'restoring' | 'deleting';
  id: string;
}

export const RecentlyDeletedPage: React.FC = () => {
  const { supabase, user } = useAuth();

  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [deletedOutputs, setDeletedOutputs] = useState<DeletedOutputRecord[]>([]);
  const [deletedDecisions, setDeletedDecisions] = useState<DecisionRecord[]>([]);
  const [deletedActions, setDeletedActions] = useState<ActionRecord[]>([]);
  const [deletedReports, setDeletedReports] = useState<Array<EndpointReport & { days_remaining: number }>>([]);

  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [loadingOutputs, setLoadingOutputs] = useState<boolean>(true);
  const [loadingDecisions, setLoadingDecisions] = useState<boolean>(true);
  const [loadingActions, setLoadingActions] = useState<boolean>(true);
  const [loadingReports, setLoadingReports] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Action feedback & state
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionErrorState | null>(null);
  const [actionProgress, setActionProgress] = useState<ActionProgressState | null>(null);

  // Permanent Delete Confirmation Modals
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);
  const [confirmDeleteOutput, setConfirmDeleteOutput] = useState<DeletedOutputRecord | null>(null);
  const [confirmDeleteDecision, setConfirmDeleteDecision] = useState<DecisionRecord | null>(null);
  const [confirmDeleteAction, setConfirmDeleteAction] = useState<ActionRecord | null>(null);
  const [confirmDeleteReport, setConfirmDeleteReport] = useState<(EndpointReport & { days_remaining: number }) | null>(null);

  const loadDeletedItems = async () => {
    if (!supabase || !user) return;
    setLoadingProjects(true);
    setLoadingOutputs(true);
    setLoadingDecisions(true);
    setLoadingActions(true);
    setLoadingReports(true);
    setLoadError(null);
    setActionError(null);

    try {
      const [projectsRes, outputsRes, decisionsRes, actionsRes, reportsRes] = await Promise.all([
        fetchDeletedProjects(supabase),
        fetchDeletedOutputs(supabase),
        fetchDeletedDecisions(supabase),
        fetchDeletedActions(supabase),
        fetchDeletedEndpointReports({ supabase }),
      ]);

      if (projectsRes.error || outputsRes.error || decisionsRes.error || actionsRes.error) {
        setLoadError(
          projectsRes.error?.message ||
            outputsRes.error?.message ||
            decisionsRes.error?.message ||
            actionsRes.error?.message ||
            'Failed to load deleted items'
        );
      } else {
        setDeletedProjects(projectsRes.data || []);
        setDeletedOutputs(outputsRes.data || []);
        setDeletedDecisions(decisionsRes.data || []);
        setDeletedActions(actionsRes.data || []);
        setDeletedReports(reportsRes || []);
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load deleted items');
    } finally {
      setLoadingProjects(false);
      setLoadingOutputs(false);
      setLoadingDecisions(false);
      setLoadingActions(false);
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    loadDeletedItems();
  }, [supabase, user]);

  // Handle Restore Project
  const handleRestoreProject = async (project: Project) => {
    if (!supabase) return;
    setActionProgress({ type: 'restoring', id: project.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await restoreProject(supabase, project.id);
    if (!result.success) {
      setActionError({
        action: 'restore_project',
        title: 'Failed to restore item',
        message: result.error?.message || 'Failed to restore item',
        targetProject: project,
      });
      setActionProgress(null);
    } else {
      setDeletedProjects((prev) => prev.filter((p) => p.id !== project.id));
      setActionSuccess(`"${project.title}" has been restored to your active projects.`);
      setActionProgress(null);
    }
  };

  // Handle Permanent Delete Project
  const handlePermanentDeleteProject = async (project: Project) => {
    if (!supabase) return;
    setActionProgress({ type: 'deleting', id: project.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await permanentDeleteProject(supabase, project.id);
    if (!result.success) {
      setActionError({
        action: 'delete_project',
        title: 'Failed to delete item',
        message: result.error?.message || 'Failed to delete item',
        targetProject: project,
      });
      setActionProgress(null);
    } else {
      setDeletedProjects((prev) => prev.filter((p) => p.id !== project.id));
      setDeletedOutputs((prev) => prev.filter((o) => o.project_id !== project.id));
      setDeletedDecisions((prev) => prev.filter((d) => d.project_id !== project.id));
      setDeletedActions((prev) => prev.filter((a) => a.project_id !== project.id));
      setActionSuccess(`"${project.title}" was permanently deleted.`);
      setActionProgress(null);
      setConfirmDeleteProject(null);
    }
  };

  // Handle Restore Output
  const handleRestoreOutput = async (output: DeletedOutputRecord) => {
    if (!supabase) return;
    setActionProgress({ type: 'restoring', id: output.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await restoreOutput(supabase, output.id);
    if (!result.success) {
      setActionError({
        action: 'restore_output',
        title: 'Failed to restore item',
        message: result.error?.message || 'Failed to restore item',
        targetOutput: output,
      });
      setActionProgress(null);
    } else {
      setDeletedOutputs((prev) => prev.filter((o) => o.id !== output.id));
      const typeLabel = OUTPUT_TYPE_LABELS[output.output_type as OutputType] || output.output_type;
      setActionSuccess(`${typeLabel} output has been restored.`);
      setActionProgress(null);
    }
  };

  // Handle Permanent Delete Output
  const handlePermanentDeleteOutput = async (output: DeletedOutputRecord) => {
    if (!supabase) return;
    setActionProgress({ type: 'deleting', id: output.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await permanentDeleteOutput(supabase, output.id);
    if (!result.success) {
      setActionError({
        action: 'delete_output',
        title: 'Failed to delete item',
        message: result.error?.message || 'Failed to delete item',
        targetOutput: output,
      });
      setActionProgress(null);
    } else {
      setDeletedOutputs((prev) => prev.filter((o) => o.id !== output.id));
      const typeLabel = OUTPUT_TYPE_LABELS[output.output_type as OutputType] || output.output_type;
      setActionSuccess(`${typeLabel} output was permanently deleted.`);
      setActionProgress(null);
      setConfirmDeleteOutput(null);
    }
  };

  // Handle Restore Decision
  const handleRestoreDecision = async (decision: DecisionRecord) => {
    if (!supabase) return;
    setActionProgress({ type: 'restoring', id: decision.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await restoreDecision(supabase, decision.id);
    if (!result.success) {
      setActionError({
        action: 'restore_decision',
        title: 'Failed to restore item',
        message: result.error?.message || 'Failed to restore item',
        targetDecision: decision,
      });
      setActionProgress(null);
    } else {
      setDeletedDecisions((prev) => prev.filter((d) => d.id !== decision.id));
      setActionSuccess(`Decision "${decision.decision_title}" has been restored.`);
      setActionProgress(null);
    }
  };

  // Handle Permanent Delete Decision
  const handlePermanentDeleteDecision = async (decision: DecisionRecord) => {
    if (!supabase) return;
    setActionProgress({ type: 'deleting', id: decision.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await permanentDeleteDecision(supabase, decision.id);
    if (!result.success) {
      setActionError({
        action: 'delete_decision',
        title: 'Failed to delete item',
        message: result.error?.message || 'Failed to delete item',
        targetDecision: decision,
      });
      setActionProgress(null);
    } else {
      setDeletedDecisions((prev) => prev.filter((d) => d.id !== decision.id));
      setActionSuccess(`Decision "${decision.decision_title}" was permanently deleted.`);
      setActionProgress(null);
      setConfirmDeleteDecision(null);
    }
  };

  // Handle Restore Action
  const handleRestoreAction = async (actionItem: ActionRecord) => {
    if (!supabase) return;
    setActionProgress({ type: 'restoring', id: actionItem.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await restoreAction(supabase, actionItem.id);
    if (!result.success) {
      setActionError({
        action: 'restore_action',
        title: 'Failed to restore item',
        message: result.error?.message || 'Failed to restore item',
        targetAction: actionItem,
      });
      setActionProgress(null);
    } else {
      setDeletedActions((prev) => prev.filter((a) => a.id !== actionItem.id));
      setActionSuccess(`Action "${actionItem.action_title}" has been restored.`);
      setActionProgress(null);
    }
  };

  // Handle Permanent Delete Action
  const handlePermanentDeleteAction = async (actionItem: ActionRecord) => {
    if (!supabase) return;
    setActionProgress({ type: 'deleting', id: actionItem.id });
    setActionError(null);
    setActionSuccess(null);

    const result = await permanentDeleteAction(supabase, actionItem.id);
    if (!result.success) {
      setActionError({
        action: 'delete_action',
        title: 'Failed to delete item',
        message: result.error?.message || 'Failed to delete item',
        targetAction: actionItem,
      });
      setActionProgress(null);
    } else {
      setDeletedActions((prev) => prev.filter((a) => a.id !== actionItem.id));
      setActionSuccess(`Action "${actionItem.action_title}" was permanently deleted.`);
      setActionProgress(null);
      setConfirmDeleteAction(null);
    }
  };

  // Handle Restore Report
  const handleRestoreReport = async (report: EndpointReport & { days_remaining: number }) => {
    if (!supabase) return;
    setActionProgress({ type: 'restoring', id: report.id });
    setActionError(null);
    setActionSuccess(null);

    try {
      await restoreEndpointReport(report.id, { supabase });
      setDeletedReports((prev) => prev.filter((r) => r.id !== report.id));
      setActionSuccess(`Report "${report.title}" has been restored.`);
    } catch (err: any) {
      setActionError({
        action: 'restore_report',
        title: 'Failed to restore item',
        message: err.message || 'Failed to restore item',
        targetReport: report,
      });
    } finally {
      setActionProgress(null);
    }
  };

  // Handle Permanent Delete Report
  const handlePermanentDeleteReport = async (report: EndpointReport & { days_remaining: number }) => {
    if (!supabase) return;
    setActionProgress({ type: 'deleting', id: report.id });
    setActionError(null);
    setActionSuccess(null);

    try {
      await permanentDeleteEndpointReport(report.id, { supabase });
      setDeletedReports((prev) => prev.filter((r) => r.id !== report.id));
      setActionSuccess(`Report "${report.title}" was permanently deleted.`);
      setConfirmDeleteReport(null);
    } catch (err: any) {
      setActionError({
        action: 'delete_report',
        title: 'Failed to delete item',
        message: err.message || 'Failed to delete item',
        targetReport: report,
      });
    } finally {
      setActionProgress(null);
    }
  };

  // Handle Retry Action for Failed Restores or Deletions
  const handleRetryAction = () => {
    if (!actionError) return;
    const current = { ...actionError };
    setActionError(null);

    if (current.action === 'restore_project' && current.targetProject) {
      handleRestoreProject(current.targetProject);
    } else if (current.action === 'restore_output' && current.targetOutput) {
      handleRestoreOutput(current.targetOutput);
    } else if (current.action === 'delete_project' && current.targetProject) {
      handlePermanentDeleteProject(current.targetProject);
    } else if (current.action === 'delete_output' && current.targetOutput) {
      handlePermanentDeleteOutput(current.targetOutput);
    } else if (current.action === 'restore_decision' && current.targetDecision) {
      handleRestoreDecision(current.targetDecision);
    } else if (current.action === 'delete_decision' && current.targetDecision) {
      handlePermanentDeleteDecision(current.targetDecision);
    } else if (current.action === 'restore_action' && current.targetAction) {
      handleRestoreAction(current.targetAction);
    } else if (current.action === 'delete_action' && current.targetAction) {
      handlePermanentDeleteAction(current.targetAction);
    } else if (current.action === 'restore_report' && current.targetReport) {
      handleRestoreReport(current.targetReport);
    } else if (current.action === 'delete_report' && current.targetReport) {
      handlePermanentDeleteReport(current.targetReport);
    }
  };

  const isLoading =
    loadingProjects || loadingOutputs || loadingDecisions || loadingActions || loadingReports;
  const isOverallEmpty =
    !isLoading &&
    !loadError &&
    deletedProjects.length === 0 &&
    deletedOutputs.length === 0 &&
    deletedDecisions.length === 0 &&
    deletedActions.length === 0 &&
    deletedReports.length === 0;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Link
            to="/settings"
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={14} />
            <span>Settings</span>
          </Link>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Clock size={12} />
            <span>30-Day Recovery Period</span>
          </div>
        </div>

        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0 0 8px 0', color: '#f8fafc' }}>
          Recently Deleted
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
          Soft-deleted projects, outputs, decisions, and actions remain recoverable for 30 days before being permanently purged.
        </p>
      </div>

      {/* Action Success Banner */}
      {actionSuccess && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '20px',
            color: '#86efac',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} color="#22c55e" />
            <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            style={{ background: 'none', border: 'none', color: '#86efac', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Action Error Banner with Retry Button */}
      {actionError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '20px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertCircle size={20} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc', marginBottom: '2px' }}>
                {actionError.title}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#fca5a5' }}>
                {actionError.message}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleRetryAction}
              className="btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '0.84rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(239, 68, 68, 0.2)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setActionError(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Loading States */}
      {isLoading && (
        <div className="content-card" style={{ textAlign: 'center', padding: '64px 24px', marginBottom: '24px' }}>
          <Loader2
            size={36}
            color="#f3c958"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}
          />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Loading deleted items...
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Scanning 30-day retention storage in Supabase.
          </p>
        </div>
      )}

      {/* Error State with Retry Button */}
      {!isLoading && loadError && (
        <div className="content-card" style={{ textAlign: 'center', padding: '56px 24px', marginBottom: '24px' }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            Failed to load deleted items
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 24px auto' }}>
            {loadError}
          </p>
          <button onClick={loadDeletedItems} className="btn-secondary">
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Overall Empty State */}
      {isOverallEmpty && (
        <div className="content-card" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.9) 100%)',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              color: '#f3c958',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 0 24px rgba(226, 181, 60, 0.2)',
            }}
          >
            <Trash2 size={36} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 600 }}>
            Nothing in Recently Deleted
          </h2>
          <p
            style={{
              color: '#94a3b8',
              maxWidth: '480px',
              margin: '0 auto 28px auto',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
          >
            Deleted projects, outputs, decisions, and actions will remain here for 30 days before permanent removal.
          </p>
          <Link to="/projects" className="btn-secondary">
            <span>Back to Projects</span>
          </Link>
        </div>
      )}

      {/* Content Display when items exist */}
      {!isLoading && !loadError && !isOverallEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* DELETED PROJECTS SECTION */}
          {deletedProjects.length > 0 && (
            <section>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FolderKanban size={20} color="#f3c958" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Deleted Projects
                  </h2>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1',
                    }}
                  >
                    {deletedProjects.length}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deletedProjects.map((project) => {
                  const daysRemaining = calculateDaysRemaining(project.purge_after);
                  const isCritical = daysRemaining <= 7;
                  const isProcessing =
                    actionProgress?.id === project.id;

                  return (
                    <div
                      key={project.id}
                      className="content-card"
                      style={{
                        padding: '18px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                        borderLeft: isCritical
                          ? '3px solid #ef4444'
                          : '3px solid rgba(226, 181, 60, 0.4)',
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {project.title}
                          </h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span>Deleted: {formatDeletedDate(project.deleted_at)}</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isCritical ? '#f87171' : '#f3c958',
                              fontWeight: 600,
                            }}
                          >
                            <Clock size={12} />
                            {formatDaysRemaining(daysRemaining)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => handleRestoreProject(project)}
                          className="btn-secondary"
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {isProcessing && actionProgress?.type === 'restoring' ? (
                            <>
                              <Loader2 size={14} className="spin-animation" />
                              <span>Restoring record...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw size={14} />
                              <span>Restore</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => setConfirmDeleteProject(project)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.84rem',
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* DELETED OUTPUTS SECTION */}
          {deletedOutputs.length > 0 && (
            <section>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={20} color="#f3c958" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Deleted Outputs
                  </h2>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1',
                    }}
                  >
                    {deletedOutputs.length}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deletedOutputs.map((output) => {
                  const daysRemaining = calculateDaysRemaining(output.purge_after);
                  const isCritical = daysRemaining <= 7;
                  const isProcessing = actionProgress?.id === output.id;
                  const typeLabel =
                    OUTPUT_TYPE_LABELS[output.output_type as OutputType] || output.output_type;

                  return (
                    <div
                      key={output.id}
                      className="content-card"
                      style={{
                        padding: '18px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                        borderLeft: isCritical
                          ? '3px solid #ef4444'
                          : '3px solid rgba(56, 189, 248, 0.4)',
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              fontWeight: 600,
                            }}
                          >
                            {typeLabel}
                          </span>
                          {output.projects && (
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              Project: {output.projects.title}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span>Deleted: {formatDeletedDate(output.deleted_at)}</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isCritical ? '#f87171' : '#f3c958',
                              fontWeight: 600,
                            }}
                          >
                            <Clock size={12} />
                            {formatDaysRemaining(daysRemaining)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => handleRestoreOutput(output)}
                          className="btn-secondary"
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {isProcessing && actionProgress?.type === 'restoring' ? (
                            <>
                              <Loader2 size={14} className="spin-animation" />
                              <span>Restoring record...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw size={14} />
                              <span>Restore</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => setConfirmDeleteOutput(output)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.84rem',
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* DELETED DECISIONS SECTION (Tasklet 14 Retention) */}
          {deletedDecisions.length > 0 && (
            <section>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BrainCircuit size={20} color="#f3c958" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Deleted Decisions
                  </h2>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1',
                    }}
                  >
                    {deletedDecisions.length}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deletedDecisions.map((decision) => {
                  const daysRemaining = calculateDaysRemaining(decision.purge_after);
                  const isCritical = daysRemaining <= 7;
                  const isProcessing = actionProgress?.id === decision.id;

                  return (
                    <div
                      key={decision.id}
                      className="content-card"
                      style={{
                        padding: '18px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                        borderLeft: isCritical
                          ? '3px solid #ef4444'
                          : '3px solid rgba(226, 181, 60, 0.4)',
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {decision.decision_title}
                          </h3>
                          {decision.projects && (
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              Project: {decision.projects.title}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span>Deleted: {formatDeletedDate(decision.deleted_at)}</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isCritical ? '#f87171' : '#f3c958',
                              fontWeight: 600,
                            }}
                          >
                            <Clock size={12} />
                            {formatDaysRemaining(daysRemaining)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => handleRestoreDecision(decision)}
                          className="btn-secondary"
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {isProcessing && actionProgress?.type === 'restoring' ? (
                            <>
                              <Loader2 size={14} className="spin-animation" />
                              <span>Restoring record...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw size={14} />
                              <span>Restore</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => setConfirmDeleteDecision(decision)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.84rem',
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* DELETED ACTIONS SECTION (Tasklet 14 Retention) */}
          {deletedActions.length > 0 && (
            <section>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckSquare size={20} color="#f3c958" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Deleted Actions
                  </h2>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1',
                    }}
                  >
                    {deletedActions.length}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deletedActions.map((actionItem) => {
                  const daysRemaining = calculateDaysRemaining(actionItem.purge_after);
                  const isCritical = daysRemaining <= 7;
                  const isProcessing = actionProgress?.id === actionItem.id;

                  return (
                    <div
                      key={actionItem.id}
                      className="content-card"
                      style={{
                        padding: '18px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                        borderLeft: isCritical
                          ? '3px solid #ef4444'
                          : '3px solid rgba(148, 163, 184, 0.4)',
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {actionItem.action_title}
                          </h3>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(148, 163, 184, 0.15)',
                              color: '#cbd5e1',
                            }}
                          >
                            {STATUS_LABELS[actionItem.status] || actionItem.status}
                          </span>
                          {actionItem.projects && (
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              Project: {actionItem.projects.title}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span>Deleted: {formatDeletedDate(actionItem.deleted_at)}</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isCritical ? '#f87171' : '#f3c958',
                              fontWeight: 600,
                            }}
                          >
                            <Clock size={12} />
                            {formatDaysRemaining(daysRemaining)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => handleRestoreAction(actionItem)}
                          className="btn-secondary"
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {isProcessing && actionProgress?.type === 'restoring' ? (
                            <>
                              <Loader2 size={14} className="spin-animation" />
                              <span>Restoring record...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw size={14} />
                              <span>Restore</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => setConfirmDeleteAction(actionItem)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.84rem',
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* SECTION 5: DELETED ENDPOINT REPORTS */}
          {deletedReports.length > 0 && (
            <section style={{ marginBottom: '36px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FileBarChart size={18} color="#e2b53c" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Endpoint Reports ({deletedReports.length})
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deletedReports.map((report) => {
                  const daysRemaining = report.days_remaining ?? 30;
                  const isCritical = daysRemaining <= 3;
                  const isProcessing = actionProgress?.id === report.id;

                  return (
                    <div
                      key={report.id}
                      className="content-card"
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {report.title}
                          </h3>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(226, 181, 60, 0.15)',
                              color: '#e2b53c',
                              fontWeight: 600,
                            }}
                          >
                            {report.report_period}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span>Deleted: {formatDeletedDate(report.deleted_at)}</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isCritical ? '#f87171' : '#f3c958',
                              fontWeight: 600,
                            }}
                          >
                            <Clock size={12} />
                            {formatDaysRemaining(daysRemaining)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => handleRestoreReport(report)}
                          className="btn-secondary"
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {isProcessing && actionProgress?.type === 'restoring' ? (
                            <>
                              <Loader2 size={14} className="spin-animation" />
                              <span>Restoring record...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw size={14} />
                              <span>Restore</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={actionProgress !== null}
                          onClick={() => setConfirmDeleteReport(report)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.84rem',
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* MODAL: Permanent Delete Project Confirmation Prompt */}
      {confirmDeleteProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '32px',
              borderRadius: '16px',
              background: '#16263F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Permanently delete?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Are you sure you want to permanently delete project <strong>"{confirmDeleteProject.title}"</strong>?
            </p>
            <p style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.5, marginBottom: '24px' }}>
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => setConfirmDeleteProject(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => handlePermanentDeleteProject(confirmDeleteProject)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {actionProgress?.type === 'deleting' && actionProgress.id === confirmDeleteProject.id ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Deleting record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Permanent Delete Output Confirmation Prompt */}
      {confirmDeleteOutput && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '32px',
              borderRadius: '16px',
              background: '#16263F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Permanently delete?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Are you sure you want to permanently delete this{' '}
              <strong>
                {OUTPUT_TYPE_LABELS[confirmDeleteOutput.output_type as OutputType] ||
                  confirmDeleteOutput.output_type}
              </strong>{' '}
              output?
            </p>
            <p style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.5, marginBottom: '24px' }}>
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => setConfirmDeleteOutput(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => handlePermanentDeleteOutput(confirmDeleteOutput)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {actionProgress?.type === 'deleting' && actionProgress.id === confirmDeleteOutput.id ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Deleting record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Permanent Delete Decision Confirmation Prompt */}
      {confirmDeleteDecision && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '32px',
              borderRadius: '16px',
              background: '#16263F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Permanently delete?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Are you sure you want to permanently delete decision{' '}
              <strong>"{confirmDeleteDecision.decision_title}"</strong>?
            </p>
            <p style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.5, marginBottom: '24px' }}>
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => setConfirmDeleteDecision(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => handlePermanentDeleteDecision(confirmDeleteDecision)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {actionProgress?.type === 'deleting' && actionProgress.id === confirmDeleteDecision.id ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Deleting record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Permanent Delete Action Confirmation Prompt */}
      {confirmDeleteAction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '32px',
              borderRadius: '16px',
              background: '#16263F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Permanently delete?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Are you sure you want to permanently delete action{' '}
              <strong>"{confirmDeleteAction.action_title}"</strong>?
            </p>
            <p style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.5, marginBottom: '24px' }}>
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => setConfirmDeleteAction(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => handlePermanentDeleteAction(confirmDeleteAction)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {actionProgress?.type === 'deleting' && actionProgress.id === confirmDeleteAction.id ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Deleting record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Permanent Delete Report Confirmation Prompt */}
      {confirmDeleteReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '32px',
              borderRadius: '16px',
              background: '#16263F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Permanently delete?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Are you sure you want to permanently delete report{' '}
              <strong>"{confirmDeleteReport.title}"</strong>?
            </p>
            <p style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.5, marginBottom: '24px' }}>
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => setConfirmDeleteReport(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProgress !== null}
                onClick={() => handlePermanentDeleteReport(confirmDeleteReport)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: actionProgress !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {actionProgress?.type === 'deleting' && actionProgress.id === confirmDeleteReport.id ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Deleting record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
