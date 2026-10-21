import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileType,
  FolderOpen,
  HardDrive,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import { fetchProjects } from '../../lib/projects/projectClient';
import {
  createProjectFile,
  downloadProjectFileBinary,
  fetchProjectFiles,
  ProjectFileRecord,
  uploadProjectFileBinary,
} from '../../lib/projects/projectFilesClient';
import { Project } from '../../lib/projects/types';
import {
  commitParsedDocumentToCrm,
  parseDocument,
  ParsedDocument,
  TargetRecordKind,
} from '../../lib/crm/documentImporter';
import { sessionWorkspace } from '../../lib/crm/stage5/session';
import '../../styles/crm-modals.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onImportComplete?: () => void;
  onSwitchToCreate?: () => void;
}

export const CrmImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  workspaceId,
  onImportComplete,
  onSwitchToCreate,
}) => {
  const [sourceTab, setSourceTab] = useState<'upload' | 'project'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRawFile, setSelectedRawFile] = useState<File | null>(null);

  // Open projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Parsing state
  const [parsing, setParsing] = useState(false);
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null);
  const [targetKind, setTargetKind] = useState<TargetRecordKind>('contacts');
  const [mappings, setMappings] = useState<Record<string, string>>({});

  // Committing state
  const [committing, setCommitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentWorkspace = sessionWorkspace(workspaceId);

  // Load open projects when tab or modal is active
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const res = await fetchProjects(supabase);
        if (isMounted && res.data) {
          setProjects(res.data);
          const linkedId = (currentWorkspace.workspace as any).linkedProjectId;
          const initialProjId = linkedId && res.data.some((p) => p.id === linkedId)
            ? linkedId
            : res.data[0]?.id || '';
          setSelectedProjectId(initialProjId);
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    };

    loadProjects();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workspaceId]);

  // Load project files when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectFiles([]);
      return;
    }
    let isMounted = true;

    const loadFiles = async () => {
      setLoadingFiles(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const res = await fetchProjectFiles(supabase, selectedProjectId);
        if (isMounted && res.data) {
          setProjectFiles(res.data);
        }
      } catch (err) {
        console.error('Failed to load project files:', err);
      } finally {
        if (isMounted) setLoadingFiles(false);
      }
    };

    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setParsing(true);
    setSuccessMessage(null);
    setSelectedRawFile(file);
    try {
      const parsed = await parseDocument(file);
      setParsedDoc(parsed);
      setTargetKind(parsed.detectedKind);
      setMappings(parsed.suggestedMappings);
    } catch (err: any) {
      console.error('Document parsing error:', err);
      setError(err?.message || 'Failed to parse document. Please check the file format.');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleProjectFileSelect = async (fileRecord: ProjectFileRecord) => {
    setError(null);
    setParsing(true);
    setSuccessMessage(null);
    setSelectedRawFile(null);
    try {
      const supabase = getSupabaseBrowserClient();
      let parsed: ParsedDocument;

      if (fileRecord.storage_path) {
        const { blob, error: dlErr } = await downloadProjectFileBinary(supabase, fileRecord.storage_path);
        if (dlErr || !blob) {
          throw dlErr || new Error('Failed to download project file binary');
        }
        const file = new File([blob], fileRecord.name, { type: fileRecord.mime_type || blob.type });
        parsed = await parseDocument(file);
      } else if (fileRecord.content) {
        const file = new File([fileRecord.content], fileRecord.name, { type: fileRecord.mime_type || 'text/plain' });
        parsed = await parseDocument(file);
      } else {
        throw new Error('Project file has no downloadable content or storage path.');
      }

      setParsedDoc(parsed);
      setTargetKind(parsed.detectedKind);
      setMappings(parsed.suggestedMappings);
    } catch (err: any) {
      console.error('Failed to import project file:', err);
      setError(err?.message || 'Could not import the selected project file.');
    } finally {
      setParsing(false);
    }
  };

  const handleImportTranscript = (project: Project) => {
    setSelectedRawFile(null);
    const text = project.transcript || project.notes || '';
    if (!text.trim()) {
      setError('This project does not have any recorded transcript or notes to import.');
      return;
    }
    const parsed: ParsedDocument = {
      fileName: `${project.title}_Meeting_Transcript.txt`,
      fileSize: new Blob([text]).size,
      fileType: 'meeting_transcript',
      mimeType: 'text/plain',
      rawText: text,
      headers: ['Section', 'Content'],
      rows: [{ Section: 'Meeting Output', Content: text.slice(0, 300) }],
      totalRows: 1,
      extractedEntities: [],
      detectedKind: 'activities_notes',
      suggestedMappings: {},
    };
    setParsedDoc(parsed);
    setTargetKind('activities_notes');
  };

  const handleCommit = async () => {
    if (!parsedDoc) return;
    setCommitting(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const res = commitParsedDocumentToCrm(
        currentWorkspace,
        parsedDoc,
        targetKind,
        mappings,
        user?.id
      );
      setSuccessMessage(res.summary);

      // If connected to a project, save a reference record into project_files and upload binary
      const linkedProjectId = (currentWorkspace.workspace as any).linkedProjectId || selectedProjectId;
      if (linkedProjectId) {
        try {
          let storagePath: string | null = null;
          if (user && selectedRawFile) {
            const uploadRes = await uploadProjectFileBinary(supabase, user.id, linkedProjectId, selectedRawFile);
            if (uploadRes.error) {
              console.warn('Storage upload notice:', uploadRes.error.message);
            }
            if (uploadRes.storagePath) {
              storagePath = uploadRes.storagePath;
            }
          }

          const createRes = await createProjectFile(supabase, {
            project_id: linkedProjectId,
            name: selectedRawFile ? selectedRawFile.name : `CRM_Import_${parsedDoc.fileName}`,
            file_type: parsedDoc.fileType === 'spreadsheet' ? 'spreadsheet' : 'document',
            mime_type: parsedDoc.mimeType,
            file_size_bytes: selectedRawFile ? selectedRawFile.size : parsedDoc.fileSize,
            storage_path: storagePath,
            source: selectedRawFile ? 'device_upload' : 'manual_creation',
            content: parsedDoc.rawText || `Imported ${res.createdCount} records into CRM`,
            description: `Imported into ${currentWorkspace.workspace.name} as ${targetKind}`,
            version: 1,
          });
          if (createRes.error) {
            console.warn('Project file creation notice:', createRes.error.message);
          }
        } catch (e) {
          console.warn('Could not record import in project files:', e);
        }
      }

      if (onImportComplete) {
        onImportComplete();
      }
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Commit import error:', err);
      setError(err?.message || 'Failed to commit import records.');
    } finally {
      setCommitting(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <FileSpreadsheet style={{ color: '#10b981' }} size={18} />;
    if (ext === 'docx' || ext === 'doc') return <FileType style={{ color: '#3b82f6' }} size={18} />;
    if (ext === 'pdf') return <FileText style={{ color: '#f43f5e' }} size={18} />;
    return <FileCode style={{ color: 'var(--crm-m-gold)' }} size={18} />;
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="crm-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="crm-modal-header">
          <div className="crm-modal-header-left">
            <div className="crm-modal-icon" aria-hidden="true">
              {/* upload-cloud icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4F6FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
              </svg>
            </div>
            <div>
              <div className="crm-modal-title" id="import-title">
                CRM Document Importer
              </div>
              <div className="crm-modal-sub">
                Upload contacts, organisations, or pipeline records.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={committing || parsing}
            className="crm-modal-close-btn"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Switcher Bar */}
        {onSwitchToCreate && !parsedDoc && (
          <div className="crm-modal-switcher" role="tablist" aria-label="Modal preview switcher">
            <button
              type="button"
              onClick={onSwitchToCreate}
              className="crm-modal-switcher-btn"
              role="tab"
              aria-selected="false"
            >
              <Building2 size={14} />
              Create Organisation CRM
            </button>
            <button
              type="button"
              className="crm-modal-switcher-btn active"
              role="tab"
              aria-selected="true"
            >
              <Download size={14} />
              CRM Document Importer
            </button>
          </div>
        )}

        {/* Import Source Tabs */}
        {!parsedDoc && (
          <div className="crm-modal-tab-bar" role="tablist" aria-label="Import source">
            <button
              type="button"
              onClick={() => setSourceTab('upload')}
              className={`crm-modal-tab-btn ${sourceTab === 'upload' ? 'active' : ''}`}
              role="tab"
              aria-selected={sourceTab === 'upload'}
            >
              Upload from device
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('project')}
              className={`crm-modal-tab-btn ${sourceTab === 'project' ? 'active' : ''}`}
              role="tab"
              aria-selected={sourceTab === 'project'}
            >
              Import from open project
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="crm-modal-body" style={{ gap: '16px' }}>
          {error && (
            <div style={{
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div style={{
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Check size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Device Upload Zone */}
          {!parsedDoc && sourceTab === 'upload' && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
                accept=".xlsx,.xls,.csv,.tsv,.docx,.doc,.pdf,.txt,.md,.json"
                style={{ display: 'none' }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`crm-modal-upload-zone ${dragActive ? 'active' : ''}`}
                tabIndex={0}
                role="button"
                aria-label="Drop files here or click to browse"
              >
                {/* cloud-upload icon */}
                <svg
                  className="crm-modal-upload-icon"
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                </svg>
                <div className="crm-modal-upload-title">Drop a file here</div>
                <div className="crm-modal-upload-sub">
                  or <a href="#" onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}>browse your device</a>
                </div>
                <div className="crm-modal-format-chips" aria-label="Supported formats">
                  <span className="crm-modal-chip">Excel</span>
                  <span className="crm-modal-chip">CSV</span>
                  <span className="crm-modal-chip">Word</span>
                  <span className="crm-modal-chip">PDF</span>
                  <span className="crm-modal-chip">Spreadsheets</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Open Project Tab */}
          {!parsedDoc && sourceTab === 'project' && (
            <div>
              {loadingProjects ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--crm-m-text-2)', padding: '24px 0', justifyContent: 'center' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading open projects...</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="crm-modal-empty-state">
                  <svg className="crm-modal-empty-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" /><polyline points="9 14 12 17 15 14" />
                  </svg>
                  <div className="crm-modal-empty-title">No open projects found</div>
                  <div className="crm-modal-empty-sub">
                    You do not have any projects open in this workspace yet. Create one to import records from it.
                  </div>
                  <div className="crm-modal-empty-actions">
                    {onSwitchToCreate && (
                      <button
                        className="crm-modal-btn crm-modal-btn-gold"
                        style={{ padding: '7px 16px', fontSize: '13px' }}
                        type="button"
                        onClick={onSwitchToCreate}
                      >
                        + Create new project
                      </button>
                    )}
                    <button
                      className="crm-modal-link-btn"
                      type="button"
                      onClick={() => setSourceTab('upload')}
                    >
                      Upload from device instead
                    </button>
                  </div>
                </div>
              ) : (
                <div className="crm-modal-field" style={{ gap: '12px' }}>
                  <label className="crm-modal-label" htmlFor="crm-import-project-select">
                    Select Open Project
                  </label>
                  <div className="crm-modal-select-wrap">
                    <select
                      id="crm-import-project-select"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="crm-modal-select"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} {p.client_name ? `(${p.client_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Project files listing */}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="crm-modal-label">Stored Files</span>
                      {(() => {
                        const proj = projects.find((p) => p.id === selectedProjectId);
                        if (proj && (proj.transcript || proj.notes)) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleImportTranscript(proj)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--crm-m-navy-2)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              Import Meeting Notes / Transcript
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {loadingFiles ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--crm-m-text-2)', padding: '16px 0', justifyContent: 'center' }}>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Loading files...</span>
                      </div>
                    ) : projectFiles.length === 0 ? (
                      <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        background: 'var(--crm-m-surface-2)',
                        borderRadius: '8px',
                        border: '1px solid var(--crm-m-border)',
                        fontSize: '12.5px',
                        color: 'var(--crm-m-text-2)'
                      }}>
                        No files uploaded in this project yet.
                      </div>
                    ) : (
                      <div style={{
                        borderRadius: '8px',
                        border: '1px solid var(--crm-m-border)',
                        background: 'var(--crm-m-surface)',
                        overflow: 'hidden',
                        maxHeight: '220px',
                        overflowY: 'auto'
                      }}>
                        {projectFiles.map((pf) => (
                          <div
                            key={pf.id}
                            style={{
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid var(--crm-m-border)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              {getFileIcon(pf.name)}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--crm-m-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {pf.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--crm-m-text-3)' }}>
                                  {(pf.file_size_bytes / 1024).toFixed(1)} KB • {pf.file_type}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleProjectFileSelect(pf)}
                              className="crm-modal-btn crm-modal-btn-ghost"
                              style={{ padding: '6px 12px', fontSize: '12px', minHeight: '36px' }}
                            >
                              Import
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Parsed Document Configuration */}
          {parsedDoc && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'var(--crm-m-surface-2)',
                border: '1px solid var(--crm-m-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getFileIcon(parsedDoc.fileName)}
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--crm-m-text)' }}>
                      {parsedDoc.fileName}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--crm-m-text-2)' }}>
                      {parsedDoc.fileType.toUpperCase()} • {parsedDoc.totalRows} {parsedDoc.totalRows === 1 ? 'record' : 'records'} detected
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setParsedDoc(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--crm-m-navy-2)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Change file
                </button>
              </div>

              {/* Target Record Kind */}
              <div className="crm-modal-field">
                <label className="crm-modal-label">Import As Record Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  {(['contacts', 'organisations', 'opportunities', 'leads'] as TargetRecordKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setTargetKind(kind)}
                      className={`crm-modal-btn ${targetKind === kind ? 'crm-modal-btn-gold' : 'crm-modal-btn-ghost'}`}
                      style={{ padding: '8px 12px', fontSize: '12.5px', textTransform: 'capitalize' }}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Preview */}
              {parsedDoc.rows.length > 0 && (
                <div className="crm-modal-field">
                  <label className="crm-modal-label">Data Preview</label>
                  <div style={{
                    borderRadius: '8px',
                    border: '1px solid var(--crm-m-border)',
                    background: 'var(--crm-m-surface)',
                    overflowX: 'auto',
                    maxHeight: '160px'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--crm-m-surface-2)', borderBottom: '1px solid var(--crm-m-border)' }}>
                          {parsedDoc.headers.slice(0, 4).map((h) => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--crm-m-text-2)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedDoc.rows.slice(0, 3).map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--crm-m-border)' }}>
                            {parsedDoc.headers.slice(0, 4).map((h) => (
                              <td key={h} style={{ padding: '8px 10px', color: 'var(--crm-m-text)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r[h] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Privacy Note */}
          <div className="crm-modal-privacy-note" role="note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              Nothing you import is sent anywhere, stored externally, or logged. All processing happens inside your workspace.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="crm-modal-footer">
          <button
            className="crm-modal-btn crm-modal-btn-ghost"
            type="button"
            onClick={onClose}
            disabled={committing || parsing}
          >
            Cancel
          </button>
          {parsedDoc ? (
            <button
              className="crm-modal-btn crm-modal-btn-primary"
              type="button"
              onClick={handleCommit}
              disabled={committing || parsing}
            >
              {committing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Importing records...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Import records</span>
                </>
              )}
            </button>
          ) : (
            <button
              className="crm-modal-btn crm-modal-btn-primary"
              type="button"
              onClick={() => {
                if (sourceTab === 'upload') {
                  fileInputRef.current?.click();
                } else if (projectFiles.length > 0) {
                  handleProjectFileSelect(projectFiles[0]);
                }
              }}
            >
              Import records
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
