import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  PlusCircle,
  Sparkles,
  Calendar,
  User,
  Tag,
  Clock,
  ArrowRight,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { Project } from '../lib/projects/types';
import { fetchProjects, softDeleteProject } from '../lib/projects/projectClient';

export const ProjectsPage: React.FC = () => {
  const { supabase, user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Deletion modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadUserProjects = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setLoadError(null);

    const result = await fetchProjects(supabase);
    if (result.error) {
      setLoadError(result.error.message || 'Failed to load projects');
    } else {
      setProjects(result.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUserProjects();
  }, [supabase, user]);

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    setDeletingId(id);
    setDeleteError(null);

    const result = await softDeleteProject(supabase, id);
    if (!result.success) {
      setDeleteError(result.error?.message || 'Failed to delete project');
      setDeletingId(null);
    } else {
      // Remove from state immediately (soft-deleted records disappear from normal views)
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeletingId(null);
      setDeleteConfirmId(null);
      setDeleteError(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const projectToConfirm = projects.find((p) => p.id === deleteConfirmId);

  return (
    <div>
      {/* Page Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>WORKSPACE REPOSITORY</span>
          </div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            Manage meeting projects, transcripts, and generated workspace outputs.
          </p>
        </div>
        <Link to="/projects/new" className="btn-gold">
          <PlusCircle size={18} />
          <span>Create New Project</span>
        </Link>
      </div>

      {/* Delete Error Banner */}
      {deleteError && (
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
          <span style={{ fontSize: '0.92rem' }}>{deleteError}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="content-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <Loader2
            size={36}
            color="#f3c958"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}
          />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Loading projects...
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Retrieving your workspace records from Supabase.
          </p>
        </div>
      )}

      {/* Error State */}
      {!loading && loadError && (
        <div className="content-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            Failed to load projects
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 24px auto' }}>
            {loadError}
          </p>
          <button onClick={loadUserProjects} className="btn-secondary">
            <RefreshCw size={16} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !loadError && projects.length === 0 && (
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
            <FolderKanban size={36} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 600 }}>No projects yet</h2>
          <p
            style={{
              color: '#94a3b8',
              maxWidth: '440px',
              margin: '0 auto 28px auto',
              fontSize: '0.95rem',
              lineHeight: 1.6
            }}
          >
            Get started by creating your first meeting workspace. Paste a transcript or notes to generate summaries and outputs.
          </p>
          <Link to="/projects/new" className="btn-gold">
            <PlusCircle size={18} />
            <span>Create your first project</span>
          </Link>
        </div>
      )}

      {/* Projects List */}
      {!loading && !loadError && projects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projects.map((project) => {
            return (
              <div
                key={project.id}
                className="content-card"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}
                >
                  <div style={{ flex: '1 1 340px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Link
                        to={`/projects/${project.id}`}
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>{project.title}</span>
                      </Link>
                    </div>

                    {/* Metadata chips */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        fontSize: '0.84rem',
                        color: '#94a3b8'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={14} color="#f3c958" />
                        <span style={{ color: '#cbd5e1' }}>
                          {project.meeting_type || 'Unspecified Type'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} color="#f3c958" />
                        <span style={{ color: '#cbd5e1' }}>
                          {project.client_or_project || 'Internal'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="#f3c958" />
                        <span>Meeting: {formatDate(project.meeting_date)}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} color="#94a3b8" />
                        <span>Last updated: {formatTimestamp(project.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <Link
                      to={`/projects/${project.id}`}
                      className="btn-primary"
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.88rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>Open project</span>
                      <ArrowRight size={15} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmId(project.id);
                        setDeleteError(null);
                      }}
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
                      <span>Delete project</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Delete Confirmation Dialog */}
      {deleteConfirmId && (
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
              maxWidth: '460px',
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
                <Trash2 size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Delete project?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              This project will be moved to Recently Deleted.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              You can restore it for 30 days.
            </p>

            {deleteError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '20px',
                  color: '#fca5a5',
                  fontSize: '0.85rem'
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteError(null);
                }}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: deletingId !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease'
                }}
              >
                {deletingId !== null ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Deleting project...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete project</span>
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
