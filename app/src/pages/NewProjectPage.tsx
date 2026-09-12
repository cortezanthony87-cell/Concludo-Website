import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  Tag,
  User,
  Building,
  FileText,
  AlertCircle,
  Loader2,
  Check,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { createProject } from '../lib/projects/projectClient';
import { COMMON_MEETING_TYPES, OwnershipType } from '../lib/projects/types';
import { fetchUserTeams } from '../lib/teams/teamClient';
import { Team, TeamRole } from '../lib/teams/types';

export const NewProjectPage: React.FC = () => {
  const { supabase, user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('Strategy & Planning');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');

  // Workspace ownership
  const [ownershipType, setOwnershipType] = useState<OwnershipType>('personal');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [userTeams, setUserTeams] = useState<(Team & { currentRole: TeamRole })[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      if (!supabase) return;
      setLoadingTeams(true);
      const res = await fetchUserTeams(supabase);
      if (res.data && res.data.length > 0) {
        setUserTeams(res.data);
        setSelectedTeamId(res.data[0].id);
      }
      setLoadingTeams(false);
    }
    loadTeams();
  }, [supabase]);

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Project title is required.');
      return;
    }

    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      setErrorMessage('Transcript is required.');
      return;
    }

    if (ownershipType === 'team' && !selectedTeamId) {
      setErrorMessage('Please select a Team Workspace for this project.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Failed to create project: Database connection unavailable.');
      return;
    }

    setSaving(true);

    const result = await createProject(supabase, {
      title: trimmedTitle,
      meeting_type: meetingType || null,
      client_name: clientName.trim() || null,
      project_name: projectName.trim() || null,
      meeting_date: meetingDate || null,
      transcript: trimmedTranscript,
      notes: notes.trim() || null,
      ownership_type: ownershipType,
      team_id: ownershipType === 'team' ? selectedTeamId : null,
    });

    if (result.error || !result.data) {
      setErrorMessage(result.error?.message || 'Failed to create project');
      setSaving(false);
      return;
    }

    // Redirect to the created project view
    navigate(`/projects/${result.data.id}`);
  };

  return (
    <div style={{ maxWidth: '820px' }}>
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
            textDecoration: 'none',
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
        <p className="page-subtitle">
          Save a meeting record and transcript to establish your Meeting Memory.
        </p>
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
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span style={{ fontSize: '0.92rem' }}>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => handleCreate()}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      <div className="content-card">
        <form onSubmit={handleCreate}>
          {/* Workspace Destination Selector */}
          {userTeams.length > 0 && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '16px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '24px',
              }}
            >
              <label
                className="form-label"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}
              >
                <Users size={15} color="#f3c958" />
                <span>Workspace Destination</span>
              </label>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                  }}
                >
                  <input
                    type="radio"
                    name="workspace"
                    checked={ownershipType === 'personal'}
                    onChange={() => setOwnershipType('personal')}
                    disabled={saving}
                  />
                  <span>Personal Workspace</span>
                </label>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                  }}
                >
                  <input
                    type="radio"
                    name="workspace"
                    checked={ownershipType === 'team'}
                    onChange={() => setOwnershipType('team')}
                    disabled={saving}
                  />
                  <span>Team Workspace</span>
                </label>

                {ownershipType === 'team' && (
                  <select
                    className="form-select"
                    style={{ minWidth: '220px', padding: '6px 12px', fontSize: '0.88rem' }}
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    disabled={saving}
                  >
                    {userTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Project Title (Required) */}
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="project-title"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={15} color="#f3c958" />
              <span>Project Title</span>
              <span style={{ color: '#f3c958' }}>*</span>
            </label>
            <input
              id="project-title"
              type="text"
              className="form-input"
              placeholder="e.g. Executive Strategy Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Meeting Type */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="meeting-type"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Tag size={15} color="#f3c958" />
                <span>Meeting Type</span>
              </label>
              <select
                id="meeting-type"
                className="form-select"
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                disabled={saving}
              >
                {COMMON_MEETING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Meeting Date */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="meeting-date"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Calendar size={15} color="#f3c958" />
                <span>Meeting Date</span>
              </label>
              <input
                id="meeting-date"
                type="date"
                className="form-input"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Client Name */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="client-name"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Building size={15} color="#f3c958" />
                <span>Client Name</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                id="client-name"
                type="text"
                className="form-input"
                placeholder="e.g. Concludo Pty Ltd or Client Org"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Project Name */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="project-name"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <User size={15} color="#f3c958" />
                <span>Project Name</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                id="project-name"
                type="text"
                className="form-input"
                placeholder="e.g. Workspace SaaS Modernisation"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Transcript (Required) */}
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="project-transcript"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={15} color="#f3c958" />
              <span>Transcript</span>
              <span style={{ color: '#f3c958' }}>*</span>
            </label>
            <textarea
              id="project-transcript"
              className="form-input"
              rows={8}
              placeholder="Paste conversation transcript or meeting audio transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={saving}
              required
              style={{ fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.5 }}
            />
          </div>

          {/* Notes (Optional) */}
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="project-notes"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={15} color="#94a3b8" />
              <span>Notes</span>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              id="project-notes"
              className="form-input"
              rows={4}
              placeholder="Additional agenda items, participant observations, or context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
            />
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '28px' }}>
            <button type="submit" className="btn-gold" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving project...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Create Project</span>
                </>
              )}
            </button>
            <Link to="/projects" className="btn-secondary" style={{ pointerEvents: saving ? 'none' : 'auto' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
