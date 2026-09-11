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
  RotateCcw,
  Copy,
  Plus,
  Mail,
  CheckSquare,
  BookOpen,
  ListChecks,
  Briefcase,
  GitBranch,
  BarChart3
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
import {
  OutputRecord,
  OutputType,
  OUTPUT_TYPE_LABELS,
  ALLOWED_OUTPUT_TYPES
} from '../lib/outputs/types';
import {
  fetchProjectOutputs,
  saveOutput,
  updateOutput,
  softDeleteOutput
} from '../lib/outputs/outputClient';

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

  // Outputs State
  const [outputs, setOutputs] = useState<OutputRecord[]>([]);
  const [loadingOutputs, setLoadingOutputs] = useState<boolean>(false);
  const [outputsError, setOutputsError] = useState<string | null>(null);

  // Create Output State
  const [showCreateOutputForm, setShowCreateOutputForm] = useState<boolean>(false);
  const [newOutputType, setNewOutputType] = useState<OutputType>('summary');
  const [newOutputContent, setNewOutputContent] = useState<string>('');
  const [savingOutput, setSavingOutput] = useState<boolean>(false);
  const [saveOutputError, setSaveOutputError] = useState<string | null>(null);

  // Edit Output State
  const [editingOutputId, setEditingOutputId] = useState<string | null>(null);
  const [editOutputType, setEditOutputType] = useState<OutputType>('summary');
  const [editOutputContent, setEditOutputContent] = useState<string>('');
  const [updatingOutput, setUpdatingOutput] = useState<boolean>(false);
  const [updateOutputError, setUpdateOutputError] = useState<string | null>(null);

  // Delete Output State
  const [confirmDeleteOutputId, setConfirmDeleteOutputId] = useState<string | null>(null);
  const [deletingOutputId, setDeletingOutputId] = useState<string | null>(null);
  const [deleteOutputError, setDeleteOutputError] = useState<string | null>(null);

  // Copy Output State
  const [copiedOutputId, setCopiedOutputId] = useState<string | null>(null);

  const loadProject = async () => {
    if (!supabase || !id) return;
    setLoading(true);
    setLoadError(null);

    const result = await fetchProjectById(supabase, id);
    if (result.error || !result.data) {
      setLoadError(result.error?.message || 'Project not found');
      setProject(null);
    } else {
      setProject(result.data);
      setEditTitle(result.data.title);
      setEditMeetingType(result.data.meeting_type || '');
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

  const loadOutputs = async () => {
    if (!supabase || !id) return;
    setLoadingOutputs(true);
    setOutputsError(null);
    const result = await fetchProjectOutputs(supabase, id);
    if (result.error) {
      setOutputsError(result.error.message);
    } else {
      setOutputs(result.data || []);
    }
    setLoadingOutputs(false);
  };

  useEffect(() => {
    loadProject();
    loadTranscript();
    loadOutputs();
  }, [id, supabase]);

  const handleStartEditing = () => {
    if (!project) return;
    setEditTitle(project.title);
    setEditMeetingType(project.meeting_type || '');
    setEditClientOrProject(project.client_or_project || '');
    setEditMeetingDate(project.meeting_date || '');
    setUpdateError(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setUpdateError(null);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;

    if (!editTitle.trim()) {
      setUpdateError('Project title missing');
      return;
    }

    setUpdating(true);
    setUpdateError(null);

    const result = await updateProject(supabase, id, {
      title: editTitle.trim(),
      meeting_type: editMeetingType.trim() || undefined,
      client_or_project: editClientOrProject.trim() || undefined,
      meeting_date: editMeetingDate || undefined
    });

    if (result.error || !result.data) {
      setUpdateError(result.error?.message || 'Failed to update project');
    } else {
      setProject(result.data);
      setIsEditing(false);
    }
    setUpdating(false);
  };

  const handleDeleteProject = async () => {
    if (!supabase || !id) return;

    setDeleting(true);
    setDeleteError(null);

    const result = await softDeleteProject(supabase, id);
    if (!result.success) {
      setDeleteError(result.error?.message || 'Failed to delete project');
      setDeleting(false);
    } else {
      navigate('/projects');
    }
  };

  const handleSaveTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;

    if (!transcriptInput.trim()) {
      setTranscriptError('Transcript text cannot be empty');
      return;
    }

    setSavingTranscript(true);
    setTranscriptError(null);

    if (transcript && isEditingTranscript) {
      const updateResult = await updateTranscript(supabase, transcript.id, {
        raw_text: transcriptInput.trim()
      });

      if (updateResult.error || !updateResult.data) {
        setTranscriptError(updateResult.error?.message || 'Failed to update transcript');
      } else {
        setTranscript(updateResult.data);
        setIsEditingTranscript(false);
      }
    } else {
      const createResult = await saveTranscript(supabase, {
        project_id: id,
        raw_text: transcriptInput.trim(),
        source_type: 'pasted'
      });

      if (createResult.error || !createResult.data) {
        setTranscriptError(createResult.error?.message || 'Failed to save transcript');
      } else {
        setTranscript(createResult.data);
      }
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
    } else {
      setTranscript(null);
      setTranscriptInput('');
      setShowDeleteTranscriptConfirm(false);
      setDeletingTranscript(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Output Actions
  // ---------------------------------------------------------------------------
  const handleSaveOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;

    if (!newOutputType) {
      setSaveOutputError('Output type missing');
      return;
    }

    if (!newOutputContent.trim()) {
      setSaveOutputError('Output content missing');
      return;
    }

    setSavingOutput(true);
    setSaveOutputError(null);

    const result = await saveOutput(supabase, {
      project_id: id,
      output_type: newOutputType,
      content: newOutputContent.trim()
    });

    if (result.error || !result.data) {
      setSaveOutputError(result.error?.message || 'Failed to save output');
    } else {
      setOutputs((prev) => [result.data!, ...prev]);
      setNewOutputContent('');
      setShowCreateOutputForm(false);
    }
    setSavingOutput(false);
  };

  const handleStartEditOutput = (output: OutputRecord) => {
    setEditingOutputId(output.id);
    setEditOutputType(output.output_type);
    setEditOutputContent(output.content || '');
    setUpdateOutputError(null);
  };

  const handleCancelEditOutput = () => {
    setEditingOutputId(null);
    setUpdateOutputError(null);
  };

  const handleUpdateOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingOutputId) return;

    if (!editOutputContent.trim()) {
      setUpdateOutputError('Output content missing');
      return;
    }

    setUpdatingOutput(true);
    setUpdateOutputError(null);

    const result = await updateOutput(supabase, editingOutputId, {
      output_type: editOutputType,
      content: editOutputContent.trim()
    });

    if (result.error || !result.data) {
      setUpdateOutputError(result.error?.message || 'Failed to update output');
    } else {
      setOutputs((prev) =>
        prev.map((item) => (item.id === editingOutputId ? result.data! : item))
      );
      setEditingOutputId(null);
    }
    setUpdatingOutput(false);
  };

  const handleDeleteOutput = async (outputId: string) => {
    if (!supabase) return;

    setDeletingOutputId(outputId);
    setDeleteOutputError(null);

    const result = await softDeleteOutput(supabase, outputId);
    if (!result.success) {
      setDeleteOutputError(result.error?.message || 'Failed to delete output');
      setDeletingOutputId(null);
    } else {
      setOutputs((prev) => prev.filter((item) => item.id !== outputId));
      setConfirmDeleteOutputId(null);
      setDeletingOutputId(null);
    }
  };

  const handleCopyOutput = async (output: OutputRecord) => {
    if (!output.content) return;
    try {
      await navigator.clipboard.writeText(output.content);
      setCopiedOutputId(output.id);
      setTimeout(() => {
        setCopiedOutputId(null);
      }, 2500);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = output.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedOutputId(output.id);
      setTimeout(() => {
        setCopiedOutputId(null);
      }, 2500);
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

  const getOutputIcon = (type: OutputType) => {
    switch (type) {
      case 'summary':
        return <FileText size={16} color="#f3c958" />;
      case 'action_items':
        return <CheckSquare size={16} color="#38bdf8" />;
      case 'follow_up_email':
        return <Mail size={16} color="#a78bfa" />;
      case 'decision_log':
        return <BookOpen size={16} color="#34d399" />;
      case 'action_plan':
        return <ListChecks size={16} color="#fbbf24" />;
      case 'business_plan_draft':
        return <Briefcase size={16} color="#f472b6" />;
      case 'workflow_chart':
        return <GitBranch size={16} color="#c084fc" />;
      case 'endpoint_report':
        return <BarChart3 size={16} color="#60a5fa" />;
      default:
        return <Layers size={16} color="#f3c958" />;
    }
  };

  if (loading) {
    return (
      <div className="workspace-container">
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <Loader2 size={36} color="#f3c958" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Loading project detail...</h2>
        </div>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="workspace-container">
        <div style={{ marginBottom: '24px' }}>
          <Link to="/projects" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={16} />
            <span>Back to Projects</span>
          </Link>
        </div>

        <div className="content-card" style={{ textAlign: 'center', padding: '60px 24px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle size={44} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px' }}>Project Not Found</h2>
          <p style={{ color: '#94a3b8', maxWidth: '480px', margin: '0 auto 24px auto' }}>
            {loadError || 'The requested project could not be found or you do not have permission to access it.'}
          </p>
          <button type="button" onClick={() => navigate('/projects')} className="btn-gold">
            Return to Projects List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-container">
      {/* Back button */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#94a3b8',
            fontSize: '0.88rem',
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </Link>
      </div>

      {deleteError && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '0.9rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} />
          <span>{deleteError}</span>
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

          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirm(true);
              setDeleteError(null);
            }}
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
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.88rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={15} />
              <span>{updateError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProject}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">
                  Project Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={updating}
                  placeholder="e.g. Q4 Executive Strategy Review"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Meeting Type</label>
                <select
                  className="form-input"
                  value={editMeetingType}
                  onChange={(e) => setEditMeetingType(e.target.value)}
                  disabled={updating}
                >
                  <option value="">Select a type (optional)</option>
                  {COMMON_MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                  {!COMMON_MEETING_TYPES.includes(editMeetingType as any) && editMeetingType && (
                    <option value={editMeetingType}>{editMeetingType}</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Client or Project Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editClientOrProject}
                  onChange={(e) => setEditClientOrProject(e.target.value)}
                  disabled={updating}
                  placeholder="e.g. ACME Corp / Internal"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Meeting Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={editMeetingDate}
                  onChange={(e) => setEditMeetingDate(e.target.value)}
                  disabled={updating}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelEditing}
                className="btn-secondary"
                disabled={updating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-gold"
                disabled={updating}
              >
                {updating ? (
                  <>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Save Project Details</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project Meta Information Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '28px'
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
          Outputs {outputs.length > 0 && `(${outputs.length})`}
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
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Transcript</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(239, 68, 68, 0.18)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.35)'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>Confirm delete?</span>
                      <button
                        type="button"
                        onClick={handleDeleteTranscript}
                        disabled={deletingTranscript}
                        style={{
                          background: '#ef4444',
                          border: 'none',
                          color: '#ffffff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {deletingTranscript ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteTranscriptConfirm(false)}
                        disabled={deletingTranscript}
                        style={{
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

            {transcriptError && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.9rem',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} />
                <span>{transcriptError}</span>
              </div>
            )}

            {loadingTranscript ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <Loader2 size={24} color="#f3c958" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                <div>Loading transcript...</div>
              </div>
            ) : (
              <div>
                {/* Saved Transcript Display */}
                {transcript && !isEditingTranscript && (
                  <div style={{ marginBottom: '28px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px'
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                        Last updated: <span style={{ color: '#cbd5e1' }}>{formatTimestamp(transcript.updated_at)}</span>
                        <span style={{ margin: '0 8px' }}>•</span>
                        Source: <span style={{ color: '#f3c958', textTransform: 'capitalize' }}>{transcript.source_type}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingTranscript(true);
                          setTranscriptInput(transcript.raw_text);
                        }}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        <Edit3 size={14} />
                        <span>Edit / Replace Transcript</span>
                      </button>
                    </div>

                    <div
                      style={{
                        background: 'rgba(9, 14, 26, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '18px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.88rem',
                        lineHeight: 1.6,
                        color: '#e2e8f0',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '420px',
                        overflowY: 'auto'
                      }}
                    >
                      {transcript.raw_text}
                    </div>
                  </div>
                )}

                {/* Empty State when no transcript saved */}
                {!transcript && (
                  <div
                    style={{
                      background: 'rgba(9, 14, 26, 0.45)',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '24px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(33, 57, 92, 0.4)',
                        border: '1px solid rgba(226, 181, 60, 0.3)',
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
            {/* Outputs Section Header */}
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
                  Outputs
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                  Generated executive summaries, action item registers, and follow-up communications.
                </p>
              </div>

              {/* Action button to add output when list already has items */}
              {outputs.length > 0 && !showCreateOutputForm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateOutputForm(true);
                    setSaveOutputError(null);
                  }}
                  className="btn-gold"
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                >
                  <Plus size={15} />
                  <span>New Output</span>
                </button>
              )}
            </div>

            {/* General Errors */}
            {(outputsError || deleteOutputError) && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.9rem',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} />
                <span>{outputsError || deleteOutputError}</span>
              </div>
            )}

            {/* Loading Outputs State */}
            {loadingOutputs ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <Loader2 size={24} color="#f3c958" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                <div>Loading outputs...</div>
              </div>
            ) : (
              <div>
                {/* Empty State Banner (Shown when no outputs exist) */}
                {outputs.length === 0 && (
                  <div
                    style={{
                      background: 'rgba(9, 14, 26, 0.5)',
                      border: '1px dashed rgba(226, 181, 60, 0.25)',
                      borderRadius: '12px',
                      padding: '24px',
                      marginBottom: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.5) 0%, rgba(14, 23, 41, 0.9) 100%)',
                        border: '1px solid rgba(226, 181, 60, 0.35)',
                        color: '#f3c958',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Layers size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1rem' }}>
                        No outputs saved yet
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Create manual executive summaries, action items, or follow-up communications below.
                      </div>
                    </div>
                  </div>
                )}

                {/* Create Output Form (Always shown if 0 outputs, or toggled when outputs exist) */}
                {(outputs.length === 0 || showCreateOutputForm) && (
                  <div
                    style={{
                      background: 'rgba(9, 14, 26, 0.65)',
                      border: '1px solid rgba(226, 181, 60, 0.3)',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '28px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={16} color="#f3c958" />
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                          Create Output Record
                        </h3>
                      </div>
                      {outputs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateOutputForm(false);
                            setSaveOutputError(null);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {saveOutputError && (
                      <div
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          borderRadius: '8px',
                          color: '#fca5a5',
                          fontSize: '0.88rem',
                          marginBottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <AlertCircle size={15} />
                        <span>{saveOutputError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveOutput}>
                      {/* Output Type Selector */}
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">
                          Output Type <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          className="form-input"
                          value={newOutputType}
                          onChange={(e) => setNewOutputType(e.target.value as OutputType)}
                          disabled={savingOutput}
                        >
                          {ALLOWED_OUTPUT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {OUTPUT_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Output Content Area */}
                      <div className="form-group" style={{ marginBottom: '18px' }}>
                        <label className="form-label">
                          Output Content <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea
                          className="form-input"
                          rows={8}
                          placeholder="Paste or create output content here"
                          value={newOutputContent}
                          onChange={(e) => setNewOutputContent(e.target.value)}
                          disabled={savingOutput}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.88rem',
                            lineHeight: 1.6,
                            resize: 'vertical',
                            padding: '14px'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          type="submit"
                          className="btn-gold"
                          disabled={savingOutput}
                        >
                          {savingOutput ? (
                            <>
                              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                              <span>Saving output...</span>
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              <span>Save Output</span>
                            </>
                          )}
                        </button>

                        {outputs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateOutputForm(false);
                              setSaveOutputError(null);
                            }}
                            className="btn-secondary"
                            disabled={savingOutput}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                )}

                {/* Saved Output List */}
                {outputs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {outputs.map((output) => {
                      const isEditingThisOutput = editingOutputId === output.id;
                      const isDeletingThisOutput = deletingOutputId === output.id;
                      const isConfirmingDelete = confirmDeleteOutputId === output.id;
                      const isCopied = copiedOutputId === output.id;

                      return (
                        <div
                          key={output.id}
                          style={{
                            background: 'rgba(9, 14, 26, 0.75)',
                            border: isEditingThisOutput
                              ? '1px solid rgba(226, 181, 60, 0.5)'
                              : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            padding: '20px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {/* Output Card Header */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: '12px',
                              marginBottom: '14px',
                              paddingBottom: '12px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                            }}
                          >
                            {/* Title & Metadata */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <div
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(33, 57, 92, 0.5)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  {getOutputIcon(output.output_type)}
                                  <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                                    {OUTPUT_TYPE_LABELS[output.output_type] || output.output_type}
                                  </span>
                                </div>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                Created: <span style={{ color: '#cbd5e1' }}>{formatTimestamp(output.created_at)}</span>
                                <span style={{ margin: '0 8px' }}>•</span>
                                Last updated: <span style={{ color: '#cbd5e1' }}>{formatTimestamp(output.updated_at)}</span>
                              </div>
                            </div>

                            {/* Action Buttons: Copy, Edit, Delete Output */}
                            {!isEditingThisOutput && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {/* Copy Button */}
                                <button
                                  type="button"
                                  onClick={() => handleCopyOutput(output)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    background: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                    border: isCopied ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                                    color: isCopied ? '#34d399' : '#e2e8f0',
                                    fontSize: '0.82rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {isCopied ? (
                                    <>
                                      <Check size={14} color="#34d399" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={14} />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEditOutput(output)}
                                  className="btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                                >
                                  <Edit3 size={14} />
                                  <span>Edit</span>
                                </button>

                                {/* Delete Output Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDeleteOutputId(output.id);
                                    setDeleteOutputError(null);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#fca5a5',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <Trash2 size={13} />
                                  <span>Delete Output</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Content / Edit View */}
                          {isEditingThisOutput ? (
                            <form onSubmit={handleUpdateOutput}>
                              {updateOutputError && (
                                <div
                                  style={{
                                    padding: '10px 14px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    borderRadius: '8px',
                                    color: '#fca5a5',
                                    fontSize: '0.88rem',
                                    marginBottom: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                >
                                  <AlertCircle size={15} />
                                  <span>{updateOutputError}</span>
                                </div>
                              )}

                              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 300px) 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div className="form-group">
                                  <label className="form-label">Output Type</label>
                                  <select
                                    className="form-input"
                                    value={editOutputType}
                                    onChange={(e) => setEditOutputType(e.target.value as OutputType)}
                                    disabled={updatingOutput}
                                  >
                                    {ALLOWED_OUTPUT_TYPES.map((type) => (
                                      <option key={type} value={type}>
                                        {OUTPUT_TYPE_LABELS[type]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label className="form-label">Content</label>
                                <textarea
                                  className="form-input"
                                  rows={8}
                                  value={editOutputContent}
                                  onChange={(e) => setEditOutputContent(e.target.value)}
                                  disabled={updatingOutput}
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.88rem',
                                    lineHeight: 1.6,
                                    resize: 'vertical',
                                    padding: '14px'
                                  }}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                  type="submit"
                                  className="btn-gold"
                                  disabled={updatingOutput}
                                >
                                  {updatingOutput ? (
                                    <>
                                      <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                      <span>Updating output...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Save size={15} />
                                      <span>Save Changes</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditOutput}
                                  className="btn-secondary"
                                  disabled={updatingOutput}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div
                              style={{
                                background: 'rgba(9, 14, 26, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                padding: '16px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.88rem',
                                lineHeight: 1.6,
                                color: '#e2e8f0',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '360px',
                                overflowY: 'auto'
                              }}
                            >
                              {output.content}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Delete Confirmation Dialog (Step 1-4 Flow) */}
      {showDeleteConfirm && (
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
                disabled={deleting}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteProject}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease'
                }}
              >
                {deleting ? (
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

      {/* Output Delete Confirmation Dialog */}
      {confirmDeleteOutputId && (
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
              maxWidth: '440px',
              width: '100%',
              padding: '30px',
              borderRadius: '16px',
              background: '#16263F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Trash2 size={20} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Delete output?
                </h3>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '24px' }}>
              This output can be restored for 30 days.
            </p>

            {deleteOutputError && (
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
                {deleteOutputError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={deletingOutputId !== null}
                onClick={() => {
                  setConfirmDeleteOutputId(null);
                  setDeleteOutputError(null);
                }}
                className="btn-secondary"
                style={{ padding: '9px 16px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingOutputId !== null}
                onClick={() => handleDeleteOutput(confirmDeleteOutputId)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: deletingOutputId !== null ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {deletingOutputId !== null ? (
                  <>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Delete output</span>
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
