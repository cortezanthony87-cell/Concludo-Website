import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  UploadCloud,
  Save,
  FolderPlus,
  Folder,
  Check,
  AlertCircle,
  Loader2,
  Layers,
  ArrowRight,
  Clock,
  Building,
  CheckSquare,
  BrainCircuit,
  FileCheck,
  X,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { Project, COMMON_MEETING_TYPES } from '../lib/projects/types';
import { fetchProjects, createProject } from '../lib/projects/projectClient';
import { fetchUserTeams } from '../lib/teams/teamClient';
import { Team } from '../lib/teams/types';
import { saveOutput } from '../lib/outputs/outputClient';
import { saveDecision } from '../lib/decisions/decisionClient';
import { saveAction } from '../lib/actions/actionClient';
import { createProjectFile } from '../lib/projects/projectFilesClient';
import { parseUploadedFile, ParsedDocument } from '../lib/intelligence/fileParser';
import { extractTranscriptIntelligence } from '../lib/intelligence/transcriptExtractor';
import { extractMetadataFromContent } from '../lib/intelligence/metadataExtractor';
import { refreshAllIntelligence } from '../lib/intelligence/intelligenceClient';

export const MeetingOutputPage: React.FC = () => {
  const { supabase, user } = useAuth();
  const navigate = useNavigate();

  // Input state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingType, setMeetingType] = useState('Operational Sync');
  const [clientOrOrg, setClientOrOrg] = useState('');
  const [projectName, setProjectName] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcriptText, setTranscriptText] = useState('');
  const [notesText, setNotesText] = useState('');

  // Imported files state
  const [importedFiles, setImportedFiles] = useState<ParsedDocument[]>([]);
  const [parsingFiles, setParsingFiles] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Output generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<{
    summary: string;
    actionPlan: string;
    decisionLog: string;
    payload: any;
    decisions: any[];
    actions: any[];
    discoveredTitle: string;
    discoveredClient: string;
    discoveredProject: string;
  } | null>(null);

  // Save Modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [existingProjects, setExistingProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [saveMode, setSaveMode] = useState<'existing' | 'new'>('existing');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [ownershipType, setOwnershipType] = useState<'personal' | 'team'>('personal');
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Load existing projects & user teams when save modal opens
  useEffect(() => {
    if (showSaveModal && supabase) {
      setLoadingProjects(true);
      fetchProjects(supabase)
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setExistingProjects(res.data);
            setSelectedProjectId(res.data[0].id);
            setSaveMode('existing');
          } else {
            setExistingProjects([]);
            setSaveMode('new');
          }
        })
        .finally(() => setLoadingProjects(false));

      fetchUserTeams(supabase)
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setUserTeams(res.data);
            setSelectedTeamId(res.data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [showSaveModal, supabase]);

  // Handle file uploads (e.g. .vtt, .srt, .docx, .pdf, .txt, .md)
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setParsingFiles(true);
    setParseError(null);

    try {
      const parsedDocs: ParsedDocument[] = [];
      let combinedTranscript = transcriptText;
      let combinedNotes = notesText;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const parsed = await parseUploadedFile(file);
        parsedDocs.push(parsed);

        if (parsed.type === 'vtt' || parsed.type === 'srt' || parsed.type === 'transcript') {
          combinedTranscript = (combinedTranscript ? combinedTranscript + '\n\n' : '') + parsed.text;
        } else {
          combinedNotes = (combinedNotes ? combinedNotes + '\n\n' : '') + parsed.text;
        }

        // Try extracting metadata from first valid file
        if (i === 0) {
          const meta = extractMetadataFromContent(parsed.text);
          if (meta.title && !meetingTitle) setMeetingTitle(meta.title);
          if (meta.clientName && !clientOrOrg) setClientOrOrg(meta.clientName);
          if (meta.projectName && !projectName) setProjectName(meta.projectName);
        }
      }

      setImportedFiles((prev) => [...prev, ...parsedDocs]);
      setTranscriptText(combinedTranscript);
      setNotesText(combinedNotes);
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse one or more files.');
    } finally {
      setParsingFiles(false);
    }
  };

  // Generate meeting output
  const handleGenerateOutput = () => {
    const primarySource = (transcriptText || notesText).trim();
    if (!primarySource) {
      setGenerateError('Please paste a transcript, upload a meeting document, or enter meeting notes before generating.');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const intel = extractTranscriptIntelligence(primarySource, {
        title: meetingTitle || 'Meeting Output',
        meetingType: meetingType,
        clientName: clientOrOrg || undefined,
        projectName: projectName || undefined,
        meetingDate: meetingDate,
        notes: notesText || undefined,
      });

      const discovered = extractMetadataFromContent(primarySource);
      setGeneratedResult({
        summary: intel.summary,
        actionPlan: intel.actionPlan,
        decisionLog: intel.decisionLog,
        payload: intel.payload,
        decisions: intel.decisions,
        actions: intel.actions,
        discoveredTitle: discovered.title || meetingTitle || 'Meeting Output',
        discoveredClient: discovered.clientName || clientOrOrg || 'Organisation',
        discoveredProject: discovered.projectName || projectName || 'Operational Initiative',
      });

      if (!meetingTitle && discovered.title) setMeetingTitle(discovered.title);
      if (!clientOrOrg && discovered.clientName) setClientOrOrg(discovered.clientName);
      if (!projectName && discovered.projectName) setProjectName(discovered.projectName);

      setNewProjectTitle(meetingTitle || discovered.title || 'Meeting Deliverable');
      setNewProjectClient(clientOrOrg || discovered.clientName || 'Organisation');
    } catch (err: any) {
      setGenerateError(err.message || 'Failed to generate meeting output.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save output to an existing project or create a new project
  const handleConfirmSave = async () => {
    if (!supabase || !generatedResult) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      let targetProjectId = selectedProjectId;
      let effectiveOwnership: 'personal' | 'team' = ownershipType;
      let effectiveTeamId: string | null = ownershipType === 'team' ? selectedTeamId || null : null;

      // If saving into an existing project, inherit that project's ownership and team_id
      if (saveMode === 'existing' && existingProjects.length > 0) {
        const found = existingProjects.find((p) => p.id === targetProjectId);
        if (found) {
          effectiveOwnership = found.ownership_type || (found.team_id ? 'team' : 'personal');
          effectiveTeamId = found.team_id || null;
        }
      } else {
        // Creating a new project
        const projectTitleToUse = (newProjectTitle || meetingTitle || generatedResult.discoveredTitle || 'Meeting Output').trim();
        const createRes = await createProject(supabase, {
          title: projectTitleToUse,
          meeting_type: meetingType,
          client_name: newProjectClient || clientOrOrg || generatedResult.discoveredClient || null,
          project_name: projectName || generatedResult.discoveredProject || projectTitleToUse,
          meeting_date: meetingDate,
          transcript: transcriptText || null,
          notes: notesText || null,
          ownership_type: effectiveOwnership,
          team_id: effectiveTeamId,
        });

        if (createRes.error || !createRes.data) {
          throw new Error(createRes.error?.message || 'Failed to create new project.');
        }
        targetProjectId = createRes.data.id;
      }

      // 1. Save Executive Summary Output
      const sumRes = await saveOutput(supabase, {
        project_id: targetProjectId,
        output_type: 'summary',
        content: generatedResult.summary,
        json_content: generatedResult.payload,
        model_used: 'Concludo Pipeline v1.0',
      });
      if (sumRes.error) throw new Error(`Summary save failed: ${sumRes.error.message}`);

      // 2. Save Operational Action Plan Output
      const actPlanRes = await saveOutput(supabase, {
        project_id: targetProjectId,
        output_type: 'action_plan',
        content: generatedResult.actionPlan,
        json_content: generatedResult.payload,
        model_used: 'Concludo Pipeline v1.0',
      });
      if (actPlanRes.error) throw new Error(`Action plan save failed: ${actPlanRes.error.message}`);

      // 3. Save Governed Decision Log Output
      const decLogRes = await saveOutput(supabase, {
        project_id: targetProjectId,
        output_type: 'decision_log',
        content: generatedResult.decisionLog,
        json_content: generatedResult.payload,
        model_used: 'Concludo Pipeline v1.0',
      });
      if (decLogRes.error) throw new Error(`Decision log save failed: ${decLogRes.error.message}`);

      // 4. Save Decisions to decision_memory with error tracking
      for (const dec of generatedResult.decisions) {
        const decRes = await saveDecision(supabase, {
          project_id: targetProjectId,
          decision_title: dec.title,
          decision_summary: dec.summary + (dec.context ? ` [Context: ${dec.context}]` : ''),
          decision_reasoning: (dec.reasoning || 'Confirmed in meeting output.') + (dec.tradeoffs ? ` [Trade-offs: ${dec.tradeoffs}]` : ''),
          decision_date: meetingDate || null,
          decision_owner: dec.owner || null,
          source_output_id: decLogRes.data?.id || null,
          ownership_type: effectiveOwnership,
          team_id: effectiveTeamId,
        });
        if (decRes.error) {
          console.warn('Decision record save warning:', decRes.error.message);
        }
      }

      // 5. Save Actions to action_tracker with error tracking
      for (const act of generatedResult.actions) {
        const actRes = await saveAction(supabase, {
          project_id: targetProjectId,
          action_title: act.title,
          action_description: act.description || act.title,
          owner_name: act.owner || 'Project Team',
          due_date: act.dueDate || null,
          status: 'not_started',
          source_output_id: actPlanRes.data?.id || null,
          ownership_type: effectiveOwnership,
          team_id: effectiveTeamId,
        });
        if (actRes.error) {
          console.warn('Action record save warning:', actRes.error.message);
        }
      }

      // 6. Save Meeting Output into project_files persistent storage
      const fileRes = await createProjectFile(supabase, {
        project_id: targetProjectId,
        name: `${(meetingTitle || 'Meeting Output').trim()} - Summary & Actions.md`,
        file_type: 'meeting_output',
        mime_type: 'text/markdown',
        source: 'meeting_output',
        content: `# ${(meetingTitle || 'Meeting Output').trim()}\n\n## Executive Summary\n${generatedResult.summary}\n\n## Operational Action Plan\n${generatedResult.actionPlan}\n\n## Governed Decision Log\n${generatedResult.decisionLog}`,
        description: `Generated meeting output for ${meetingDate} (${meetingType})`,
      });
      if (fileRes.error) {
        console.warn('Meeting output file save warning:', fileRes.error.message);
      }

      // 7. Save imported documents as persistent project_files if uploaded
      for (const doc of importedFiles) {
        const docRes = await createProjectFile(supabase, {
          project_id: targetProjectId,
          name: doc.name,
          file_type: doc.type === 'vtt' || doc.type === 'srt' ? 'transcript' : 'document',
          mime_type: 'text/plain',
          file_size_bytes: doc.size,
          source: 'device_upload',
          content: doc.text,
          description: `Imported file from device (${doc.type.toUpperCase()})`,
        });
        if (docRes.error) {
          console.warn('Imported document save warning:', docRes.error.message);
        }
      }

      // Trigger background intelligence refresh
      refreshAllIntelligence({ supabase }).catch(() => {});

      setSaveSuccess('Meeting output and files successfully saved to project.');
      setTimeout(() => {
        setShowSaveModal(false);
        navigate(`/projects/${targetProjectId}`);
      }, 900);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save meeting output.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <FileText size={22} color="#E2B53C" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#f8fafc', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
              Meeting Output
            </h1>
            <span style={{ fontSize: '0.74rem', background: 'rgba(226, 181, 60, 0.12)', color: '#E2B53C', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              TRANSCRIPT & OUTPUT STUDIO
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
            Paste a transcript or meeting notes, extract structured intelligence, and save directly into an existing or new project.
          </p>
        </div>

        {generatedResult && (
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #E2B53C 0%, #CA8A04 100%)',
              color: '#090E1A',
              fontWeight: 700,
              padding: '10px 20px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(226, 181, 60, 0.28)',
              minHeight: '44px',
            }}
          >
            <Save size={18} />
            <span>Save Output</span>
          </button>
        )}
      </div>

      {/* Main Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* Left Column: Input and Ingestion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metadata Card */}
          <div className="content-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#E2B53C" />
              <span>Meeting Context</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Meeting Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Executive Strategy Alignment"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Meeting Type
                  </label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {COMMON_MEETING_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Client or Organisation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Northbridge Industrial"
                    value={clientOrOrg}
                    onChange={(e) => setClientOrOrg(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Project Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Phase 2 Transformation"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Device Import Card */}
          <div className="content-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UploadCloud size={16} color="#E2B53C" />
                <span>Import Files from Device</span>
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>.vtt, .srt, .docx, .pdf, .txt</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".vtt,.srt,.docx,.pdf,.txt,.md,.csv,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFileUpload(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #1E293B',
                borderRadius: '8px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(11, 19, 34, 0.4)',
                transition: 'border-color 0.2s',
              }}
            >
              {parsingFiles ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={24} className="spin-animation" color="#E2B53C" />
                  <span style={{ fontSize: '0.85rem', color: '#E2B53C' }}>Extracting text from files...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <UploadCloud size={28} color="#64748B" />
                  <span style={{ fontSize: '0.88rem', color: '#F8FAFC', fontWeight: 500 }}>
                    Click to import transcripts or meeting notes
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Files will be added to this output and saved to your project file storage.
                  </span>
                </div>
              )}
            </div>

            {parseError && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '6px', color: '#EF4444', fontSize: '0.82rem' }}>
                {parseError}
              </div>
            )}

            {importedFiles.length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
                  Imported Files ({importedFiles.length}):
                </span>
                {importedFiles.map((doc, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#0B1322', borderRadius: '4px', fontSize: '0.8rem', color: '#F8FAFC' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                    <span style={{ color: '#E2B53C', fontSize: '0.72rem', textTransform: 'uppercase' }}>{doc.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paste Transcript Field */}
          <div className="content-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="#E2B53C" />
              <span>Paste Meeting Transcript</span>
            </h2>

            <textarea
              rows={8}
              placeholder="Paste meeting transcript here with speaker names and dialogue..."
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '0.86rem', fontFamily: 'monospace', lineHeight: 1.5, resize: 'vertical' }}
            />

            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                Supplementary Notes or Context (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Additional notes, attendee list, or key milestones..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px', borderRadius: '6px', fontSize: '0.84rem' }}
              />
            </div>

            {generateError && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '6px', color: '#EF4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>{generateError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateOutput}
              disabled={isGenerating || (!transcriptText.trim() && !notesText.trim())}
              className="btn btn-primary"
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                fontSize: '0.92rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '44px',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="spin-animation" />
                  <span>Synthesising Meeting Output...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate Meeting Output</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Output Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!generatedResult ? (
            <div className="content-card" style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <BrainCircuit size={48} color="#233554" style={{ marginBottom: '16px' }} />
              <h2 style={{ fontSize: '1.2rem', color: '#F8FAFC', fontWeight: 600, margin: '0 0 8px 0' }}>
                Ready to Process Meeting
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', maxWidth: '420px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                Enter your meeting transcript or notes on the left and select Generate. Concludo will extract the Executive Summary, Action Plan, and Governed Decision Log.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Executive Summary Output */}
              <div className="content-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={18} color="#E2B53C" />
                    <span>Executive Summary</span>
                  </h2>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                    Output #1
                  </span>
                </div>
                <div style={{ background: '#0B1322', border: '1px solid #1E293B', borderRadius: '6px', padding: '16px', color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {generatedResult.summary}
                </div>
              </div>

              {/* Action Plan Output */}
              <div className="content-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckSquare size={18} color="#10B981" />
                    <span>Operational Action Plan ({generatedResult.actions.length} items)</span>
                  </h2>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                    Output #2
                  </span>
                </div>
                <div style={{ background: '#0B1322', border: '1px solid #1E293B', borderRadius: '6px', padding: '16px', color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {generatedResult.actionPlan}
                </div>
              </div>

              {/* Decision Log Output */}
              <div className="content-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} color="#38BDF8" />
                    <span>Governed Decision Log ({generatedResult.decisions.length} items)</span>
                  </h2>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                    Output #3
                  </span>
                </div>
                <div style={{ background: '#0B1322', border: '1px solid #1E293B', borderRadius: '6px', padding: '16px', color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {generatedResult.decisionLog}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Output Modal */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 22, 38, 0.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#0F1A2E', border: '1px solid #233554', borderRadius: '12px', width: '100%', maxWidth: '580px', padding: '24px', boxShadow: '0 20px 48px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F8FAFC', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={20} color="#E2B53C" />
                <span>Save Meeting Output to Project</span>
              </h3>
              <button type="button" onClick={() => setShowSaveModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#94A3B8', margin: '0 0 20px 0' }}>
              Choose whether to append this meeting output and files into an ongoing project, or create a brand new workspace project.
            </p>

            {/* Mode selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setSaveMode('existing')}
                disabled={existingProjects.length === 0}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: saveMode === 'existing' ? '1px solid #E2B53C' : '1px solid #1E293B',
                  background: saveMode === 'existing' ? 'rgba(226, 181, 60, 0.1)' : '#0B1322',
                  color: saveMode === 'existing' ? '#E2B53C' : '#94A3B8',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: existingProjects.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: existingProjects.length > 0 ? 1 : 0.5,
                  minHeight: '44px',
                }}
              >
                Existing Project ({existingProjects.length})
              </button>

              <button
                type="button"
                onClick={() => setSaveMode('new')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: saveMode === 'new' ? '1px solid #E2B53C' : '1px solid #1E293B',
                  background: saveMode === 'new' ? 'rgba(226, 181, 60, 0.1)' : '#0B1322',
                  color: saveMode === 'new' ? '#E2B53C' : '#94A3B8',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Create New Project
              </button>
            </div>

            {/* Target selection */}
            {saveMode === 'existing' ? (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '6px' }}>
                  Select Ongoing Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '0.88rem' }}
                >
                  {existingProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.client_name ? `(${p.client_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '4px' }}>
                    New Project Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '4px' }}>
                    Client or Organisation
                  </label>
                  <input
                    type="text"
                    value={newProjectClient}
                    onChange={(e) => setNewProjectClient(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                  />
                </div>

                {userTeams.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '4px' }}>
                      Project Ownership
                    </label>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#F8FAFC', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="ownership"
                          value="personal"
                          checked={ownershipType === 'personal'}
                          onChange={() => setOwnershipType('personal')}
                        />
                        <span>Personal Project</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#F8FAFC', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="ownership"
                          value="team"
                          checked={ownershipType === 'team'}
                          onChange={() => setOwnershipType('team')}
                        />
                        <span>Team / Organisation</span>
                      </label>
                    </div>

                    {ownershipType === 'team' && (
                      <div style={{ marginTop: '10px' }}>
                        <select
                          value={selectedTeamId}
                          onChange={(e) => setSelectedTeamId(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          {userTeams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {saveError && (
              <div style={{ marginBottom: '14px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '6px', color: '#EF4444', fontSize: '0.84rem' }}>
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div style={{ marginBottom: '14px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', borderRadius: '6px', color: '#10B981', fontSize: '0.84rem' }}>
                {saveSuccess}
              </div>
            )}

            {/* Modal actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1E293B', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                style={{ background: 'transparent', border: '1px solid #233554', color: '#94A3B8', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', minHeight: '44px' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                style={{
                  background: 'linear-gradient(135deg, #E2B53C 0%, #CA8A04 100%)',
                  color: '#090E1A',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Saving to Project...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Confirm & Save</span>
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
