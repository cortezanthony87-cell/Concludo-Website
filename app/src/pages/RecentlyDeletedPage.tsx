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
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { Project } from '../lib/projects/types';
import {
  fetchDeletedProjects,
  restoreProject,
  permanentDeleteProject
} from '../lib/projects/projectClient';
import {
  fetchDeletedOutputs,
  restoreOutput,
  permanentDeleteOutput,
  DeletedOutputRecord
} from '../lib/outputs/outputClient';
import { OUTPUT_TYPE_LABELS, OutputType } from '../lib/outputs/types';
import {
  calculateDaysRemaining,
  formatDaysRemaining,
  formatDeletedDate
} from '../lib/retention';

export const RecentlyDeletedPage: React.FC = () => {
  const { supabase, user } = useAuth();

  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [deletedOutputs, setDeletedOutputs] = useState<DeletedOutputRecord[]>([]);

  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [loadingOutputs, setLoadingOutputs] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Action feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // In-flight action tracking
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Permanent Delete Confirmation Modals
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);
  const [confirmDeleteOutput, setConfirmDeleteOutput] = useState<DeletedOutputRecord | null>(null);

  const loadDeletedItems = async () => {
    if (!supabase || !user) return;
    setLoadingProjects(true);
    setLoadingOutputs(true);
    setLoadError(null);
    setActionError(null);

    try {
      const [projectsRes, outputsRes] = await Promise.all([
        fetchDeletedProjects(supabase),
        fetchDeletedOutputs(supabase)
      ]);

      if (projectsRes.error || outputsRes.error) {
        setLoadError(
          projectsRes.error?.message ||
            outputsRes.error?.message ||
            'Failed to load deleted items'
        );
      } else {
        setDeletedProjects(projectsRes.data || []);
        setDeletedOutputs(outputsRes.data || []);
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load deleted items');
    } finally {
      setLoadingProjects(false);
      setLoadingOutputs(false);
    }
  };

  useEffect(() => {
    loadDeletedItems();
  }, [supabase, user]);

  // Handle Restore Project
  const handleRestoreProject = async (project: Project) => {
    if (!supabase) return;
    setProcessingId(project.id);
    setActionError(null);
    setActionSuccess(null);

    const result = await restoreProject(supabase, project.id);
    if (!result.success) {
      setActionError(result.error?.message || 'Failed to restore project');
      setProcessingId(null);
    } else {
      setDeletedProjects((prev) => prev.filter((p) => p.id !== project.id));
      setActionSuccess(`"${project.title}" has been restored to your active projects.`);
      setProcessingId(null);
    }
  };

  // Handle Permanent Delete Project
  const handlePermanentDeleteProject = async (project: Project) => {
    if (!supabase) return;
    setProcessingId(project.id);
    setActionError(null);
    setActionSuccess(null);

    const result = await permanentDeleteProject(supabase, project.id);
    if (!result.success) {
      setActionError(result.error?.message || 'Failed to permanently delete project');
      setProcessingId(null);
    } else {
      setDeletedProjects((prev) => prev.filter((p) => p.id !== project.id));
      // Also remove any outputs that belonged to this project
      setDeletedOutputs((prev) => prev.filter((o) => o.project_id !== project.id));
      setActionSuccess(`"${project.title}" was permanently deleted.`);
      setProcessingId(null);
      setConfirmDeleteProject(null);
    }
  };

  // Handle Restore Output
  const handleRestoreOutput = async (output: DeletedOutputRecord) => {
    if (!supabase) return;
    setProcessingId(output.id);
    setActionError(null);
    setActionSuccess(null);

    const result = await restoreOutput(supabase, output.id);
    if (!result.success) {
      setActionError(result.error?.message || 'Failed to restore output');
      setProcessingId(null);
    } else {
      setDeletedOutputs((prev) => prev.filter((o) => o.id !== output.id));
      const typeLabel = OUTPUT_TYPE_LABELS[output.output_type as OutputType] || output.output_type;
      setActionSuccess(`${typeLabel} output has been restored.`);
      setProcessingId(null);
    }
  };

  // Handle Permanent Delete Output
  const handlePermanentDeleteOutput = async (output: DeletedOutputRecord) => {
    if (!supabase) return;
    setProcessingId(output.id);
    setActionError(null);
    setActionSuccess(null);

    const result = await permanentDeleteOutput(supabase, output.id);
    if (!result.success) {
      setActionError(result.error?.message || 'Failed to permanently delete output');
      setProcessingId(null);
    } else {
      setDeletedOutputs((prev) => prev.filter((o) => o.id !== output.id));
      const typeLabel = OUTPUT_TYPE_LABELS[output.output_type as OutputType] || output.output_type;
      setActionSuccess(`${typeLabel} output was permanently deleted.`);
      setProcessingId(null);
      setConfirmDeleteOutput(null);
    }
  };

  const isLoading = loadingProjects || loadingOutputs;
  const isOverallEmpty =
    !isLoading &&
    !loadError &&
    deletedProjects.length === 0 &&
    deletedOutputs.length === 0;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Link
            to="/settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={14} />
            <span>Settings</span>
          </Link>
        </div>
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>DATA RETENTION & RECOVERY</span>
        </div>
        <h1 className="page-title">Recently Deleted</h1>
        <p className="page-subtitle">
          Deleted records remain recoverable for 30 days before permanent removal.
        </p>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            color: '#86efac',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <CheckCircle2 size={18} color="#22c55e" />
          <span style={{ fontSize: '0.92rem' }}>{actionSuccess}</span>
        </div>
      )}

      {/* Action Error Notification */}
      {actionError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ fontSize: '0.92rem' }}>{actionError}</span>
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
            {loadingProjects ? 'Loading deleted projects...' : 'Loading deleted outputs...'}
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
              boxShadow: '0 0 24px rgba(226, 181, 60, 0.2)'
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
              lineHeight: 1.6
            }}
          >
            Deleted projects and outputs will remain here for 30 days before permanent removal.
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
          <section>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
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
                    color: '#94a3b8'
                  }}
                >
                  {deletedProjects.length}
                </span>
              </div>
            </div>

            {deletedProjects.length === 0 ? (
              <div
                className="content-card"
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.9rem'
                }}
              >
                No deleted projects
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {deletedProjects.map((project) => {
                  const daysRemaining = calculateDaysRemaining(
                    project.purge_after,
                    project.deleted_at
                  );
                  const isProcessing = processingId === project.id;

                  return (
                    <div
                      key={project.id}
                      className="content-card"
                      style={{
                        padding: '20px 24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <h3
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 600,
                            color: '#f8fafc',
                            marginBottom: '8px'
                          }}
                        >
                          {project.title}
                        </h3>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '16px',
                            fontSize: '0.84rem',
                            color: '#94a3b8'
                          }}
                        >
                          <div>
                            <span style={{ color: '#64748b' }}>Deleted Date: </span>
                            <span style={{ color: '#cbd5e1' }}>
                              {formatDeletedDate(project.deleted_at)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="#f3c958" />
                            <span
                              style={{
                                color: daysRemaining <= 3 ? '#f87171' : '#f3c958',
                                fontWeight: 500
                              }}
                            >
                              {formatDaysRemaining(daysRemaining)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Buttons: Restore & Delete Permanently */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRestoreProject(project)}
                          className="btn-secondary"
                          style={{
                            padding: '8px 16px',
                            fontSize: '0.88rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isProcessing ? (
                            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <RotateCcw size={15} color="#f3c958" />
                          )}
                          <span>Restore</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => setConfirmDeleteProject(project)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#fca5a5',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={15} />
                          <span>Delete Permanently</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* DELETED OUTPUTS SECTION */}
          <section>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
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
                    color: '#94a3b8'
                  }}
                >
                  {deletedOutputs.length}
                </span>
              </div>
            </div>

            {deletedOutputs.length === 0 ? (
              <div
                className="content-card"
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.9rem'
                }}
              >
                No deleted outputs
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {deletedOutputs.map((output) => {
                  const daysRemaining = calculateDaysRemaining(
                    output.purge_after,
                    output.deleted_at
                  );
                  const isProcessing = processingId === output.id;
                  const typeLabel =
                    OUTPUT_TYPE_LABELS[output.output_type as OutputType] ||
                    output.output_type;
                  const projectName = output.projects?.title || 'Linked Project';

                  return (
                    <div
                      key={output.id}
                      className="content-card"
                      style={{
                        padding: '20px 24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '6px'
                          }}
                        >
                          <span
                            style={{
                              background: 'rgba(226, 181, 60, 0.15)',
                              border: '1px solid rgba(226, 181, 60, 0.3)',
                              color: '#f3c958',
                              padding: '2px 10px',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600
                            }}
                          >
                            {typeLabel}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>in</span>
                          <span
                            style={{
                              color: '#e2e8f0',
                              fontSize: '0.92rem',
                              fontWeight: 500
                            }}
                          >
                            {projectName}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '16px',
                            fontSize: '0.84rem',
                            color: '#94a3b8'
                          }}
                        >
                          <div>
                            <span style={{ color: '#64748b' }}>Deleted Date: </span>
                            <span style={{ color: '#cbd5e1' }}>
                              {formatDeletedDate(output.deleted_at)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="#f3c958" />
                            <span
                              style={{
                                color: daysRemaining <= 3 ? '#f87171' : '#f3c958',
                                fontWeight: 500
                              }}
                            >
                              {formatDaysRemaining(daysRemaining)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Buttons: Restore & Delete Permanently */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRestoreOutput(output)}
                          className="btn-secondary"
                          style={{
                            padding: '8px 16px',
                            fontSize: '0.88rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isProcessing ? (
                            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <RotateCcw size={15} color="#f3c958" />
                          )}
                          <span>Restore</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => setConfirmDeleteOutput(output)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#fca5a5',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={15} />
                          <span>Delete Permanently</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL: Permanent Delete Project Confirmation */}
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
            padding: '20px'
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
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
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
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Permanently delete project?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Are you sure you want to permanently delete <strong>"{confirmDeleteProject.title}"</strong>?
            </p>
            <p style={{ color: '#f87171', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              This will permanently remove this project and all associated transcripts and outputs. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => setConfirmDeleteProject(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => handlePermanentDeleteProject(confirmDeleteProject)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: processingId !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease'
                }}
              >
                {processingId === confirmDeleteProject.id ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Deleting permanently...</span>
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

      {/* MODAL: Permanent Delete Output Confirmation */}
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
            padding: '20px'
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
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
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
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Permanently delete output?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Are you sure you want to permanently delete this{' '}
              <strong>
                {OUTPUT_TYPE_LABELS[confirmDeleteOutput.output_type as OutputType] ||
                  confirmDeleteOutput.output_type}
              </strong>{' '}
              record?
            </p>
            <p style={{ color: '#f87171', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              This record will be permanently purged from Supabase. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => setConfirmDeleteOutput(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => handlePermanentDeleteOutput(confirmDeleteOutput)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: processingId !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease'
                }}
              >
                {processingId === confirmDeleteOutput.id ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Deleting permanently...</span>
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
