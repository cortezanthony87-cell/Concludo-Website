import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Sparkles,
  Calendar,
  Tag,
  User,
  FileText,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { createProject } from '../lib/projects/projectClient';
import { COMMON_MEETING_TYPES } from '../lib/projects/types';

export const NewProjectPage: React.FC = () => {
  const { supabase } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('Strategy & Planning');
  const [clientOrProject, setClientOrProject] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Project title missing');
      return;
    }

    if (!supabase) {
      setErrorMessage('Workspace database connection unavailable');
      return;
    }

    setLoading(true);

    const result = await createProject(supabase, {
      title: trimmedTitle,
      meeting_type: meetingType || null,
      client_or_project: clientOrProject.trim() || null,
      meeting_date: meetingDate || null
    });

    if (result.error || !result.data) {
      setErrorMessage(result.error?.message || 'Failed to create project');
      setLoading(false);
      return;
    }

    // Redirect to the new project detail page
    navigate(`/projects/${result.data.id}`);
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '22px' }}>
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

      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>WORKSPACE CONFIGURATION</span>
        </div>
        <h1 className="page-title">Create Project</h1>
        <p className="page-subtitle">Configure the meeting details to begin processing your transcript.</p>
      </div>

      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '22px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ fontSize: '0.92rem' }}>{errorMessage}</span>
        </div>
      )}

      <div className="content-card">
        <form onSubmit={handleSubmit}>
          {/* Project Title (Required) */}
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="project-title"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={15} color="#f3c958" />
              <span>Project title</span>
              <span style={{ color: '#f3c958' }}>*</span>
            </label>
            <input
              id="project-title"
              type="text"
              className="form-input"
              placeholder="e.g. Executive Strategy Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Meeting Type (Optional) */}
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="meeting-type"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Tag size={15} color="#f3c958" />
              <span>Meeting type</span>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 400 }}>(Optional)</span>
            </label>
            <select
              id="meeting-type"
              className="form-select"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              disabled={loading}
            >
              {COMMON_MEETING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Client or project name (Optional) */}
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="client-project-name"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <User size={15} color="#f3c958" />
              <span>Client or project name</span>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              id="client-project-name"
              type="text"
              className="form-input"
              placeholder="e.g. Concludo Operations or Client Acme Corp"
              value={clientOrProject}
              onChange={(e) => setClientOrProject(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Meeting Date (Optional) */}
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="meeting-date"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={15} color="#f3c958" />
              <span>Meeting date</span>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              id="meeting-date"
              type="date"
              className="form-input"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '28px' }}>
            <button type="submit" className="btn-gold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Creating project...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Create Project</span>
                </>
              )}
            </button>
            <Link to="/projects" className="btn-secondary" style={{ pointerEvents: loading ? 'none' : 'auto' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
