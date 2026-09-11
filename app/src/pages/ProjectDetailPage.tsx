import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  User,
  Tag,
  Clock,
  Edit3,
  Trash2,
  Sparkles,
  Layers,
  FileText,
  Terminal,
  AlertCircle,
  Loader2,
  Check,
  X,
  RefreshCw,
  Mic,
  MicOff,
  Save,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { Project, COMMON_MEETING_TYPES } from '../lib/projects/types';
import { fetchProjectById, updateProject, softDeleteProject } from '../lib/projects/projectClient';
import { Transcript } from '../lib/transcripts/types';
import {
  fetchProjectTranscript,
  saveTranscript,
  updateTranscript,
  softDeleteTranscript
} from '../lib/transcripts/transcriptClient';

type TabKey = 'overview' | 'transcript' | 'outputs';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Edit Project State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editMeetingType, setEditMeetingType] = useState<string>('');
  const [editClientOrProject, setEditClientOrProject] = useState<string>('');
  const [editMeetingDate, setEditMeetingDate] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete Project State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Transcript State
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState<boolean>(false);
  const [transcriptInput, setTranscriptInput] = useState<string>('');
  const [savingTranscript, setSavingTranscript] = useState<boolean>(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [showDeleteTranscriptConfirm, setShowDeleteTranscriptConfirm] = useState<boolean>(false);
  const [deletingTranscript, setDeletingTranscript] = useState<boolean>(false);

  const loadProject = async () => {
    if (!supabase || !id) return;
    setLoading(true);
    setLoadError(null);

    const result = await fetchProjectById(supabase, id);
    if (result.error || !result.data) {
      const errMsg = result.error?.message || 'Project not found';
      if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('denied')) {
        setLoadError('Permission denied');
      } else {
        setLoadError(errMsg);
      }
      setProject(null);
    } else {
      setProject(result.data);
      setEditTitle(result.data.title);
      setEditMeetingType(result.data.meeting_type || 'Strategy & Planning');
      setEditClientOrProject(result.data.client_or_project || '');
      setEditMeetingDate(result.data.meeting_date || '');
    }
    setLoading(false);
  };

  const loadTranscript = async () => {
    if (!supabase || !id) return;
    setLoadingTranscript(true);
    const result = await fetchProjectTranscript(supabase, id);
    if (result.data) {
      setTranscript(result.data);
      setTranscriptInput(result.data.raw_text);
    } else {
      setTranscript(null);
      setTranscriptInput('');
    }
    setLoadingTranscript(false);
  };

  useEffect(() => {
    loadProject();
    loadTranscript();
  }, [supabase, id]);

  const handleStartEditing = () => {
    if (!project) return;
    setEditTitle(project.title);
    setEditMeetingType(project.meeting_type || 'Strategy & Planning');
    setEditClientOrProject(project.client_or_project || '');
    setEditMeetingDate(project.meeting_date || '');
    setUpdateError(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setUpdateError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setUpdateError('Project title missing');
      return;
    }

    setUpdating(true);
    setUpdateError(null);

    const result = await updateProject(supabase, id, {
      title: trimmedTitle,
      meeting_type: editMeetingType || null,
      client_or_project: editClientOrProject.trim() || null,
      meeting_date: editMeetingDate || null
    });

    if (result.error || !result.data) {
      setUpdateError(result.error?.message || 'Failed to update project');
      setUpdating(false);
      return;
    }

    setProject(result.data);
    setUpdating(false);
    setIsEditing(false);
  };

  const handleDeleteProject = async () => {
    if (!supabase || !id) return;
    setDeleting(true);
    setDeleteError(null);

    const result = await softDeleteProject(supabase, id);
    if (!result.success) {
      setDeleteError(result.error?.message || 'Failed to delete project');
      setDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }

    navigate('/projects');
  };

  // Transcript Handlers
  const handleSaveTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;

    const trimmedText = transcriptInput.trim();
    if (!trimmedText) {
      setTranscriptError('Transcript text cannot be empty');
      return;
    }

    setSavingTranscript(true);
    setTranscriptError(null);

    if (transcript) {
      // Update existing transcript
      const result = await updateTranscript(supabase, transcript.id, {
        raw_text: transcriptInput
      });

      if (result.error || !result.data) {
        setTranscriptError(result.error?.message || 'Failed to update transcript');
        setSavingTranscript(false);
        return;
      }

      setTranscript(result.data);
      setIsEditingTranscript(false);
    } else {
      // Create new transcript
      const result = await saveTranscript(supabase, {
        project_id: id,
        raw_text: transcriptInput,
        source_type: 'pasted'
      });

      if (result.error || !result.data) {
        setTranscriptError(result.error?.message || 'Failed to save transcript');
        setSavingTranscript(false);
        return;
      }

      setTranscript(result.data);
      setIsEditingTranscript(false);
    }

    setSavingTranscript(false);
  };

  const handleDeleteTranscript = async () => {
    if (!supabase || !transcript) return;
    setDeletingTranscript(true);
    setTranscriptError(null);

    const result = await softDeleteTranscript(supabase, transcript.id);
    if (!result.success) {
      setTranscriptError(result.error?.message || 'Failed to delete transcript');
      setDeletingTranscript(false);
      setShowDeleteTranscriptConfirm(false);
      return;
    }

    setTranscript(null);
    setTranscriptInput('');
    setIsEditingTranscript(false);
    setShowDeleteTranscriptConfirm(false);
    setDeletingTranscript(false);
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

  const formatTimestamp = (dateStr: string | null) => {
    if (!dateStr) return 'Not available';
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

  // Loading State
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <Link
            to="/projects"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.88rem',
              fontWeight: 500,
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Projects</span>
          </Link>
        </div>
        <div className="content-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <Loader2
            size={36}
            color="#f3c958"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}
          />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Loading project detail...
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Retrieving project details from Supabase.
          </p>
        </div>
      </div>
    );
  }

  // Error State: Project Not Found / Permission Denied
  if (loadError || !project) {
    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <Link
            to="/projects"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.88rem',
              fontWeight: 500,
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Projects</span>
          </Link>
        </div>
        <div className="content-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <AlertCircle size={42} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            {loadError === 'Permission denied' ? 'Permission denied' : 'Project not found'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.94rem', maxWidth: '440px', margin: '0 auto 24px auto' }}>
            {loadError === 'Permission denied'
              ? 'You do not have permission to access this project.'
              : 'The requested project could not be found or has been removed.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/projects" className="btn-gold">
              <span>Return to Projects</span>
            </Link>
            <button onClick={loadProject} className="btn-secondary">
              <RefreshCw size={15} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top back navigation */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#94a3b8',
            fontSize: '0.88rem',
            fontWeight: 500,
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
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

      {/* Page Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>PROJECT WORKSPACE</span>
          </div>
          <h1 className="page-title">{project.title}</h1>
          <p className="page-subtitle">
            ID: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{project.id}</span>
          </p>
        </div>

        {/* Action Buttons: Edit & Delete */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isEditing && (
            <button type="button" onClick={handleStartEditing} className="btn-secondary">
              <Edit3 size={15} />
              <span>Edit project details</span>
            </button>
          )}

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.88rem',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
            >
              <Trash2 size={16} />
              <span>Delete project</span>
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.18)',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.4)'
              }}
            >
              <span style={{ fontSize: '0.84rem', color: '#fca5a5' }}>
                Soft delete this project?
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteProject}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Deleting project...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#94a3b8',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form Modal/Card (if active) */}
      {isEditing && (
        <div
          className="content-card"
          style={{
            marginBottom: '28px',
            border: '1px solid rgba(226, 181, 60, 0.4)',
            boxShadow: '0 0 24px rgba(226, 181, 60, 0.1)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} color="#f3c958" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Edit Project Details</h2>
            </div>
            <button
              type="button"
              onClick={handleCancelEditing}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {updateError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '18px',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ fontSize: '0.88rem' }}>{updateError}</span>
            </div>
          )}

          <form onSubmit={handleSaveEdit}>
            <div className="form-group">
              <label
                htmlFor="edit-title"
                className="form-label"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={14} color="#f3c958" />
                <span>Project title</span>
                <span style={{ color: '#f3c958' }}>*</span>
              </label>
              <input
                id="edit-title"
                type="text"
                className="form-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={updating}
                required
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}
            >
              <div className="form-group">
                <label
                  htmlFor="edit-meeting-type"
                  className="form-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Tag size={14} color="#f3c958" />
                  <span>Meeting type</span>
                </label>
                <select
                  id="edit-meeting-type"
                  className="form-select"
                  value={editMeetingType}
                  onChange={(e) => setEditMeetingType(e.target.value)}
                  disabled={updating}
                >
                  {COMMON_MEETING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label
                  htmlFor="edit-client"
                  className="form-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <User size={14} color="#f3c958" />
                  <span>Client or project name</span>
                </label>
                <input
                  id="edit-client"
                  type="text"
                  className="form-input"
                  value={editClientOrProject}
                  onChange={(e) => setEditClientOrProject(e.target.value)}
                  disabled={updating}
                />
              </div>

              <div className="form-group">
                <label
                  htmlFor="edit-date"
                  className="form-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Calendar size={14} color="#f3c958" />
                  <span>Meeting date</span>
                </label>
                <input
                  id="edit-date"
                  type="date"
                  className="form-input"
                  value={editMeetingDate}
                  onChange={(e) => setEditMeetingDate(e.target.value)}
                  disabled={updating}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="submit" className="btn-gold" disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Updating project...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelEditing}
                className="btn-secondary"
                disabled={updating}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project Meta Information Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '26px'
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            background: 'rgba(9, 14, 26, 0.65)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.8rem',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <Tag size={14} color="#f3c958" />
            <span>Meeting Type</span>
          </div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1rem' }}>
            {project.meeting_type || 'Unspecified'}
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            background: 'rgba(9, 14, 26, 0.65)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.8rem',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <User size={14} color="#f3c958" />
            <span>Client or Project</span>
          </div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1rem' }}>
            {project.client_or_project || 'Internal'}
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            background: 'rgba(9, 14, 26, 0.65)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.8rem',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <Calendar size={14} color="#f3c958" />
            <span>Meeting Date</span>
          </div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1rem' }}>
            {formatDate(project.meeting_date)}
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            background: 'rgba(9, 14, 26, 0.65)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.8rem',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <Clock size={14} color="#f3c958" />
            <span>Created Date</span>
          </div>
          <div style={{ fontWeight: 500, color: '#f8fafc', fontSize: '0.92rem' }}>
            {formatTimestamp(project.created_at)}
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            background: 'rgba(9, 14, 26, 0.65)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.8rem',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <Clock size={14} color="#f3c958" />
            <span>Last Updated</span>
          </div>
          <div style={{ fontWeight: 500, color: '#f8fafc', fontSize: '0.92rem' }}>
            {formatTimestamp(project.updated_at)}
          </div>
        </div>
      </div>

      {/* Tabs container */}
      <div className="tabs-container">
        <button
          type="button"
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'outputs' ? 'active' : ''}`}
          onClick={() => setActiveTab('outputs')}
        >
          Outputs
        </button>
      </div>

      {/* Tab content area */}
      <div className="content-card">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', fontWeight: 600 }}>Project Overview</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Project overview will appear here
            </p>

            <div
              style={{
                background: 'rgba(33, 57, 92, 0.25)',
                border: '1px solid rgba(226, 181, 60, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                fontSize: '0.9rem',
                color: '#cbd5e1'
              }}
            >
              <div style={{ color: '#f3c958', fontWeight: 600, marginBottom: '6px' }}>
                Concludo Workspace Pipeline
              </div>
              <div>
                This project workspace is configured and ready. Transcripts and generated executive outputs link into this project workspace.
              </div>
            </div>
          </div>
        )}

        {/* TRANSCRIPT TAB */}
        {activeTab === 'transcript' && (
          <div>
            {/* Section Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Transcript
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                  Raw meeting dialogue, speaker attribution, and source text archive.
                </p>
              </div>

              {/* Status Badge & Actions if transcript exists */}
              {transcript && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Speaker Label Detection Badge */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: transcript.speaker_labels_detected
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(148, 163, 184, 0.12)',
                      border: transcript.speaker_labels_detected
                        ? '1px solid rgba(16, 185, 129, 0.35)'
                        : '1px solid rgba(148, 163, 184, 0.25)',
                      color: transcript.speaker_labels_detected ? '#34d399' : '#94a3b8'
                    }}
                  >
                    {transcript.speaker_labels_detected ? (
                      <>
                        <Mic size={14} color="#34d399" />
                        <span>Speaker labels detected</span>
                      </>
                    ) : (
                      <>
                        <MicOff size={14} color="#94a3b8" />
                        <span>No speaker labels detected</span>
                      </>
                    )}
                  </div>

                  {/* Delete Transcript Button */}
                  {!showDeleteTranscriptConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteTranscriptConfirm(true)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Delete Transcript</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.4)'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>Delete?</span>
                      <button
                        type="button"
                        disabled={deletingTranscript}
                        onClick={handleDeleteTranscript}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          background: '#ef4444',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: deletingTranscript ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {deletingTranscript ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteTranscriptConfirm(false)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {transcriptError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  color: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.9rem'
                }}
              >
                <AlertCircle size={16} color="#ef4444" />
                <span>{transcriptError}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {loadingTranscript ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <Loader2
                  size={32}
                  color="#f3c958"
                  style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}
                />
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading transcript archive...</p>
              </div>
            ) : transcript && !isEditingTranscript ? (
              /* SAVED TRANSCRIPT VIEW */
              <div>
                {/* Meta details bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'rgba(9, 14, 26, 0.75)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '16px',
                    fontSize: '0.86rem',
                    color: '#94a3b8'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="#f3c958" />
                      <span>Last updated: <strong style={{ color: '#f8fafc' }}>{formatTimestamp(transcript.updated_at)}</strong></span>
                    </div>
                    <div>
                      Source: <strong style={{ color: '#f8fafc', textTransform: 'capitalize' }}>{transcript.source_type}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptInput(transcript.raw_text);
                      setIsEditingTranscript(true);
                      setTranscriptError(null);
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.84rem' }}
                  >
                    <Edit3 size={14} />
                    <span>Edit or Replace Transcript</span>
                  </button>
                </div>

                {/* Saved Transcript Display Area */}
                <div
                  style={{
                    background: 'rgba(6, 10, 18, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    maxHeight: '480px',
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                    lineHeight: '1.7',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  {transcript.raw_text}
                </div>
              </div>
            ) : (
              /* EMPTY STATE OR EDITING TRANSCRIPT FORM */
              <div>
                {!transcript && (
                  <div
                    style={{
                      background: 'rgba(33, 57, 92, 0.2)',
                      border: '1px solid rgba(226, 181, 60, 0.25)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'rgba(226, 181, 60, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f3c958'
                      }}
                    >
                      <Terminal size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
                        No transcript saved yet
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Paste meeting audio transcripts, Teams/Zoom output, or rough notes below to archive.
                      </div>
                    </div>
                  </div>
                )}

                {isEditingTranscript && transcript && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '14px'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', color: '#f3c958', fontWeight: 600 }}>
                      Editing Saved Transcript
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingTranscript(false);
                        setTranscriptInput(transcript.raw_text);
                        setTranscriptError(null);
                      }}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    >
                      <RotateCcw size={13} />
                      <span>Cancel Edit</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleSaveTranscript}>
                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <textarea
                      className="form-input"
                      rows={12}
                      placeholder="Paste transcript here"
                      value={transcriptInput}
                      onChange={(e) => setTranscriptInput(e.target.value)}
                      disabled={savingTranscript}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        resize: 'vertical',
                        padding: '16px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      type="submit"
                      className="btn-gold"
                      disabled={savingTranscript}
                    >
                      {savingTranscript ? (
                        <>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          <span>Saving Transcript...</span>
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>Save Transcript</span>
                        </>
                      )}
                    </button>

                    {isEditingTranscript && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingTranscript(false);
                          if (transcript) setTranscriptInput(transcript.raw_text);
                          setTranscriptError(null);
                        }}
                        className="btn-secondary"
                        disabled={savingTranscript}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* OUTPUTS TAB */}
        {activeTab === 'outputs' && (
          <div>
            <div style={{ marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', fontWeight: 600 }}>Workspace Outputs</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                Generated outputs will appear here
              </p>
            </div>

            <div
              style={{
                background: 'rgba(9, 14, 26, 0.6)',
                border: '2px dashed rgba(226, 181, 60, 0.25)',
                borderRadius: '16px',
                padding: '56px 24px',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.9) 100%)',
                  border: '1px solid rgba(226, 181, 60, 0.35)',
                  color: '#f3c958',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <Layers size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', fontWeight: 600 }}>
                Generated outputs will appear here
              </h3>
              <p style={{ color: '#94a3b8', maxWidth: '440px', margin: '0 auto', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Synthesised executive summaries, action item registers, and decision records will populate here once generation is executed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
