import React, { useState, useEffect, useRef } from 'react';
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
  UploadCloud,
  File,
  X,
  FileCheck,
  Info,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { createProject } from '../lib/projects/projectClient';
import { COMMON_MEETING_TYPES, OwnershipType } from '../lib/projects/types';
import { fetchUserTeams } from '../lib/teams/teamClient';
import { Team, TeamRole } from '../lib/teams/types';
import { parseUploadedFile, ParsedDocument } from '../lib/intelligence/fileParser';

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

  // Imported Document Files State
  const [importedFiles, setImportedFiles] = useState<ParsedDocument[]>([]);
  const [parsingFiles, setParsingFiles] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setParsingFiles(true);
    setParseError(null);

    const newlyParsed: ParsedDocument[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const parsed = await parseUploadedFile(file);
        newlyParsed.push(parsed);
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message || 'Failed to parse file'}`);
      }
    }

    if (newlyParsed.length > 0) {
      setImportedFiles((prev) => [...prev, ...newlyParsed]);
      // If project title is empty, infer from first uploaded document
      if (!title.trim()) {
        const cleanedName = newlyParsed[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
        const autoTitle = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
        setTitle(autoTitle);
      }
    }

    if (errors.length > 0) {
      setParseError(errors.join('; '));
    }
    setParsingFiles(false);
  };

  const handleRemoveFile = (index: number) => {
    setImportedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Project title is required.');
      return;
    }

    const trimmedTranscript = transcript.trim();
    const hasImportedFiles = importedFiles.length > 0;
    const trimmedNotes = notes.trim();

    // A project requires either a transcript, imported notes/documents, or meeting notes
    if (!trimmedTranscript && !hasImportedFiles && !trimmedNotes) {
      setErrorMessage(
        'Please provide a meeting transcript, upload project notes/PDF files, or add meeting notes so your AI agents can build a case around the project.'
      );
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

    // Consolidate project content
    // If no verbatim transcript is provided, assemble imported document texts into the primary intelligence body
    let finalTranscript = trimmedTranscript;
    if (!finalTranscript && hasImportedFiles) {
      finalTranscript = importedFiles
        .map(
          (doc) =>
            `# Document Import: ${doc.name} (${doc.type.toUpperCase()})\n\n${doc.text}`
        )
        .join('\n\n---\n\n');
    }

    // Build consolidated notes including file registry
    let finalNotes = trimmedNotes;
    if (hasImportedFiles) {
      const fileListSummary = importedFiles
        .map((doc) => `- ${doc.name} (${doc.type.toUpperCase()}, ${Math.round(doc.size / 1024)} KB)`)
        .join('\n');
      const attachmentNote = `### Imported Files (${importedFiles.length}):\n${fileListSummary}`;
      finalNotes = finalNotes ? `${finalNotes}\n\n${attachmentNote}` : attachmentNote;
    }

    const result = await createProject(supabase, {
      title: trimmedTitle,
      meeting_type: meetingType || null,
      client_name: clientName.trim() || null,
      project_name: projectName.trim() || null,
      meeting_date: meetingDate || null,
      transcript: finalTranscript || null,
      notes: finalNotes || null,
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
          Save a meeting record, transcript, or imported meeting notes and PDFs to establish your Meeting Memory.
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

          {/* FILE IMPORT & UPLOAD SECTION */}
          <div
            style={{
              marginTop: '10px',
              marginBottom: '24px',
              padding: '18px',
              background: 'rgba(226, 181, 60, 0.04)',
              border: '1px dashed rgba(226, 181, 60, 0.35)',
              borderRadius: '12px',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleFilesSelected(e.dataTransfer.files);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label
                  className="form-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: '#f3c958', fontWeight: 600 }}
                >
                  <UploadCloud size={17} color="#f3c958" />
                  <span>Import Project Files & Meeting Notes</span>
                </label>
                <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                  Upload PDFs, Word documents (.docx), or text notes. If your project has no transcript, the 7 AI agents parse your imported files to understand the project and build intelligence around it.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.csv,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingFiles || saving}
                className="btn btn-secondary"
                style={{
                  padding: '7px 14px',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isDragOver ? 'rgba(226, 181, 60, 0.2)' : undefined,
                }}
              >
                {parsingFiles ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    <span>Extracting Text...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} />
                    <span>Browse Files</span>
                  </>
                )}
              </button>
            </div>

            {parseError && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  color: '#fca5a5',
                  fontSize: '0.84rem',
                  marginBottom: '12px',
                }}
              >
                {parseError}
              </div>
            )}

            {/* Display list of uploaded and parsed files */}
            {importedFiles.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {importedFiles.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(9, 14, 26, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileCheck size={18} color="#34d399" />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {doc.type.toUpperCase()} • {Math.round(doc.size / 1024)} KB • {doc.text.length.toLocaleString()} characters extracted
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={saving}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '16px 12px',
                  color: '#64748b',
                  fontSize: '0.84rem',
                  border: '1px dashed rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  background: 'rgba(9, 14, 26, 0.4)',
                }}
              >
                Drag and drop PDF meeting packs, Word docs, or notes here, or click Browse Files.
              </div>
            )}
          </div>

          {/* Transcript (Optional if Files/Notes Provided) */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                className="form-label"
                htmlFor="project-transcript"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
              >
                <FileText size={15} color={importedFiles.length > 0 ? '#94a3b8' : '#f3c958'} />
                <span>Meeting Transcript</span>
                {importedFiles.length === 0 && <span style={{ color: '#f3c958' }}>*</span>}
                {importedFiles.length > 0 && (
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 400 }}>
                    (Optional — files already attached)
                  </span>
                )}
              </label>
            </div>
            <textarea
              id="project-transcript"
              className="form-input"
              rows={6}
              placeholder={
                importedFiles.length > 0
                  ? 'Verbatim audio transcript (optional). Your imported files above will be parsed as primary project intelligence.'
                  : 'Paste conversation transcript or meeting audio transcript here, or import your PDF/Word files above...'
              }
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={saving}
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
              <span>Project Notes & Context</span>
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

          {/* AI AGENTS ASSURANCE BANNER */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '12px 16px',
              background: 'rgba(22, 38, 63, 0.6)',
              border: '1px solid rgba(33, 57, 92, 0.8)',
              borderRadius: '8px',
              marginBottom: '24px',
            }}
          >
            <Info size={16} color="#38bdf8" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              <strong style={{ color: '#f8fafc' }}>7 AI Agents Multi-Stream Processing:</strong> When you create this project with either a transcript or imported files, Concludo’s 7 AI Agents (Meeting Follow-Up, Decision Follow-Up, Action Accountability, Project Intelligence, Risk Monitoring, Report Generation, and Workflow Coordinator) synthesize the documents to extract action milestones, detect risks, record governed decisions, and track accountability.
            </div>
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
