import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  ShieldCheck,
  ArrowRight,
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
  RefreshCw,
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
  DocumentKind,
  parseDelimitedText,
  parseDocument,
  parseExcelBuffer,
  parsePdfBuffer,
  parseWordBuffer,
  ParsedDocument,
  TargetRecordKind,
} from '../../lib/crm/documentImporter';
import { sessionWorkspace } from '../../lib/crm/stage5/session';

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
  const [sourceTab, setSourceTab] = useState<'device' | 'project'>('device');
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
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <FileSpreadsheet className="text-emerald-400" size={18} />;
    if (ext === 'docx' || ext === 'doc') return <FileType className="text-blue-400" size={18} />;
    if (ext === 'pdf') return <FileText className="text-rose-400" size={18} />;
    return <FileCode className="text-amber-400" size={18} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="relative w-full max-w-2xl rounded-xl border border-slate-700 bg-[#0D1626] text-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-import-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-[#142036]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E2B53C]/20 text-[#E2B53C]">
              <Download size={20} />
            </div>
            <div>
              <h2 id="crm-import-title" className="text-lg font-semibold text-white">
                CRM Document Importer
              </h2>
              <p className="text-xs text-slate-400">
                Upload contacts, organisations, or pipeline records
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={committing || parsing}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Switcher Bar */}
        {onSwitchToCreate && !parsedDoc && (
          <div className="flex border-b border-slate-800 bg-[#0E182A] px-6" role="tablist" aria-label="Modal preview switcher">
            <button
              type="button"
              onClick={onSwitchToCreate}
              className="border-b-2 border-transparent py-2.5 px-3 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors min-h-[44px] flex items-center gap-2"
              role="tab"
              aria-selected="false"
            >
              <Building2 size={14} />
              Create Organisation CRM
            </button>
            <button
              type="button"
              className="border-b-2 border-[#E2B53C] py-2.5 px-3 text-xs font-semibold text-[#E2B53C] min-h-[44px] flex items-center gap-2"
              role="tab"
              aria-selected="true"
            >
              <Download size={14} />
              CRM Document Importer
            </button>
          </div>
        )}

        {/* Source Tabs */}
        {!parsedDoc && (
          <div className="flex border-b border-slate-800 bg-[#0E182A]">
            <button
              type="button"
              onClick={() => setSourceTab('device')}
              className={`flex-1 py-3 px-4 min-h-[44px] text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                sourceTab === 'device'
                  ? 'border-[#E2B53C] text-[#E2B53C] bg-[#142036]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive size={15} />
              <span>Upload from Device</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('project')}
              className={`flex-1 py-3 px-4 min-h-[44px] text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                sourceTab === 'project'
                  ? 'border-[#E2B53C] text-[#E2B53C] bg-[#142036]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen size={15} />
              <span>Import from Open Project</span>
            </button>
          </div>
        )}

        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-sm text-emerald-200 flex items-center gap-2">
              <Check size={18} className="text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Device Dropzone */}
          {!parsedDoc && sourceTab === 'device' && (
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
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#E2B53C] bg-[#E2B53C]/10'
                    : 'border-slate-700 bg-[#121E33] hover:border-slate-500 hover:bg-[#15233C]'
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-[#E2B53C] mb-3">
                  <Upload size={26} />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  Drop your file here, or browse
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Accepts all document types: Excel (.xlsx, .xls), Word (.docx), PDF (.pdf), spreadsheets (.csv, .tsv) and text documents.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300">
                  <span className="rounded bg-slate-800 px-2 py-0.5 border border-slate-700">Excel</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 border border-slate-700">PDF</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 border border-slate-700">Word</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 border border-slate-700">CSV/Spreadsheets</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Open Project Selector */}
          {!parsedDoc && sourceTab === 'project' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Select Open Project on Dashboard
                </label>
                {loadingProjects ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                    <Loader2 size={16} className="animate-spin text-[#E2B53C]" />
                    Loading projects...
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">No open projects found on your dashboard.</p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#16243D] px-3.5 py-2.5 text-sm text-white focus:border-[#E2B53C] focus:outline-none"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} {p.client_name ? `• ${p.client_name}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Stored Project Files */}
              {selectedProjectId && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Files in this Project
                    </h4>
                    {(() => {
                      const proj = projects.find((p) => p.id === selectedProjectId);
                      if (proj && (proj.transcript || proj.notes)) {
                        return (
                          <button
                            type="button"
                            onClick={() => handleImportTranscript(proj)}
                            className="text-xs text-[#E2B53C] hover:underline flex items-center gap-1 font-medium"
                          >
                            <span>Import Meeting Notes / Transcript</span>
                            <ChevronRight size={13} />
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {loadingFiles ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                      <Loader2 size={14} className="animate-spin text-[#E2B53C]" />
                      Loading project files...
                    </div>
                  ) : projectFiles.length === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-[#121E33] p-6 text-center">
                      <p className="text-xs text-slate-400 mb-2">No uploaded files stored in this project yet.</p>
                      {(() => {
                        const proj = projects.find((p) => p.id === selectedProjectId);
                        if (proj && (proj.transcript || proj.notes)) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleImportTranscript(proj)}
                              className="rounded-lg bg-[#E2B53C] text-[#0D1626] font-semibold text-xs px-3.5 py-2 hover:bg-[#d4a834]"
                            >
                              Import Project Notes & Transcripts
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-[#121E33] overflow-hidden max-h-60 overflow-y-auto">
                      {projectFiles.map((pf) => (
                        <li key={pf.id} className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0 pr-3">
                            {getFileIcon(pf.name)}
                            <div className="truncate">
                              <p className="text-xs font-medium text-white truncate">{pf.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {(pf.file_size_bytes / 1024).toFixed(1)} KB • {pf.file_type}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleProjectFileSelect(pf)}
                            className="shrink-0 rounded bg-slate-800 hover:bg-[#E2B53C] hover:text-[#0D1626] border border-slate-700 px-3 py-1 min-h-[44px] text-xs font-semibold text-slate-200 transition-colors"
                          >
                            Import File
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Parsed Document Preview & Configuration */}
          {parsedDoc && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-[#142036] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getFileIcon(parsedDoc.fileName)}
                  <div>
                    <h4 className="text-sm font-semibold text-white">{parsedDoc.fileName}</h4>
                    <p className="text-xs text-slate-400">
                      {parsedDoc.fileType.toUpperCase()} • {parsedDoc.totalRows} {parsedDoc.totalRows === 1 ? 'row' : 'rows'} detected
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setParsedDoc(null)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Change file
                </button>
              </div>

              {/* Target Kind Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Import As Record Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['contacts', 'organisations', 'opportunities', 'leads'] as TargetRecordKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setTargetKind(kind)}
                      className={`rounded-lg border py-2 px-3 min-h-[44px] text-xs font-medium capitalize text-center transition-all ${
                        targetKind === kind
                          ? 'border-[#E2B53C] bg-[#E2B53C]/15 text-[#E2B53C]'
                          : 'border-slate-700 bg-[#121E33] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview First Rows */}
              {parsedDoc.rows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-1.5">
                    Data Preview (First {Math.min(parsedDoc.rows.length, 4)} records)
                  </p>
                  <div className="rounded-lg border border-slate-800 bg-[#0D1626] overflow-x-auto max-h-48 text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                          {parsedDoc.headers.slice(0, 5).map((h) => (
                            <th key={h} className="p-2 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {parsedDoc.rows.slice(0, 4).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            {parsedDoc.headers.slice(0, 5).map((h) => (
                              <td key={h} className="p-2 truncate max-w-[150px]">
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

              {/* Plain text / Word snippet */}
              {parsedDoc.rawText && parsedDoc.rows.length === 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-1.5">Document Text Summary</p>
                  <div className="rounded-lg border border-slate-800 bg-[#0D1626] p-3 text-xs text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono">
                    {parsedDoc.rawText.slice(0, 800)}...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Privacy Note */}
          <div className="rounded-lg border border-slate-800 bg-[#142036] p-3 text-xs text-slate-400 flex items-start gap-2.5" role="note">
            <ShieldCheck size={16} className="text-[#E2B53C] shrink-0 mt-0.5" />
            <span>
              Nothing you import is sent anywhere, stored externally, or logged. All processing happens inside your workspace.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={committing || parsing}
              className="rounded-lg border border-slate-700 px-4 py-2 min-h-[44px] text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            {parsedDoc && (
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing || parsing}
                className="flex items-center gap-2 rounded-lg bg-[#E2B53C] hover:bg-[#d4a834] px-5 py-2 min-h-[44px] text-sm font-semibold text-[#0D1626] shadow-sm transition-all disabled:opacity-50"
              >
                {committing ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-[#0D1626]" />
                    <span>Importing into CRM...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Commit Import</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
