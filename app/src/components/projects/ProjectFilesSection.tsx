import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  FileText,
  FileSpreadsheet,
  Upload,
  Plus,
  Edit2,
  Trash2,
  Download,
  Eye,
  Check,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  ProjectFileRecord,
  ProjectFileType,
  ProjectFileSource,
  fetchProjectFiles,
  createProjectFile,
  updateProjectFile,
  deleteProjectFile,
  uploadProjectFileBinary,
  downloadProjectFileBinary,
} from '../../lib/projects/projectFilesClient';
import { parseUploadedFile } from '../../lib/intelligence/fileParser';

interface Props {
  projectId: string;
  projectTitle: string;
}

export const ProjectFilesSection: React.FC<Props> = ({ projectId, projectTitle }) => {
  const { supabase, user } = useAuth();
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New file modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<ProjectFileType>('notes');
  const [newFileContent, setNewFileContent] = useState('');
  const [newFileDesc, setNewFileDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit file modal state
  const [editingFile, setEditingFile] = useState<ProjectFileRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Preview file state
  const [previewFile, setPreviewFile] = useState<ProjectFileRecord | null>(null);

  // File input ref for device uploads
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = async () => {
    if (!supabase || !projectId) return;
    setLoading(true);
    const res = await fetchProjectFiles(supabase, projectId);
    if (res.data) {
      setFiles(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFiles();
  }, [supabase, projectId]);

  // Handle Device File Upload (Uploads binary to storage + creates metadata row)
  const handleUploadFromDevice = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !supabase || !user) return;
    setUploading(true);
    setError(null);
    setSuccess(null);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        let textContent = '';
        let fileType: ProjectFileType = 'document';

        // Extract text if document format
        try {
          const parsed = await parseUploadedFile(file);
          textContent = parsed.text;
          if (parsed.type === 'vtt' || parsed.type === 'srt') fileType = 'transcript';
          else if (parsed.type === 'csv') fileType = 'spreadsheet';
        } catch {
          textContent = await file.text().catch(() => '');
        }

        // Upload original binary file to storage bucket
        const { storagePath, error: uploadErr } = await uploadProjectFileBinary(
          supabase,
          user.id,
          projectId,
          file
        );

        if (uploadErr) {
          errors.push(`${file.name}: Storage upload failed (${uploadErr.message})`);
          continue;
        }

        const createRes = await createProjectFile(supabase, {
          project_id: projectId,
          name: file.name,
          file_type: fileType,
          mime_type: file.type || 'application/octet-stream',
          file_size_bytes: file.size,
          source: 'device_upload',
          content: textContent || null,
          storage_path: storagePath || null,
          description: `Imported from device (${file.type || 'document'})`,
        });

        if (createRes.error) {
          errors.push(`${file.name}: ${createRes.error.message}`);
        } else {
          successCount++;
        }
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message || 'Upload error'}`);
      }
    }

    setUploading(false);

    if (errors.length > 0) {
      setError(`Encountered issues with ${errors.length} file(s): ${errors.join(', ')}`);
    }
    if (successCount > 0) {
      setSuccess(`Successfully imported ${successCount} file(s) into project file storage.`);
      await loadFiles();
    }
  };

  // Handle Manual File Creation
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newFileName.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await createProjectFile(supabase, {
        project_id: projectId,
        name: newFileName.trim(),
        file_type: newFileType,
        mime_type: 'text/markdown',
        source: 'manual_creation',
        content: newFileContent,
        description: newFileDesc || null,
      });

      if (res.error) throw res.error;

      setShowCreateModal(false);
      setNewFileName('');
      setNewFileContent('');
      setNewFileDesc('');
      setSuccess('File created successfully.');
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to create file.');
    } finally {
      setCreating(false);
    }
  };

  // Handle Edit File
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingFile) return;
    setSavingEdit(true);
    setError(null);

    try {
      const res = await updateProjectFile(supabase, editingFile.id, {
        name: editName.trim(),
        content: editContent,
        description: editDesc,
      });

      if (res.error) throw res.error;

      setEditingFile(null);
      setSuccess('File updated.');
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to update file.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Delete File
  const handleDelete = async (fileId: string) => {
    if (!supabase) return;
    if (!window.confirm('Are you sure you want to delete this file from the project?')) return;
    try {
      const res = await deleteProjectFile(supabase, fileId);
      if (res.error) {
        setError(res.error.message || 'Failed to delete file.');
        return;
      }
      setSuccess('File removed from project.');
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to delete file.');
    }
  };

  // Download File (Downloads from Storage bucket if available, else text payload)
  const handleDownload = async (file: ProjectFileRecord) => {
    if (supabase && file.storage_path) {
      const { blob, error: dlErr } = await downloadProjectFileBinary(supabase, file.storage_path);
      if (blob && !dlErr) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    }

    // Fallback to text content blob
    const blob = new Blob([file.content || ''], { type: file.mime_type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredFiles = files.filter((f) => {
    if (filterType === 'all') return true;
    return f.file_type === filterType;
  });

  const getFileIcon = (file: ProjectFileRecord) => {
    switch (file.file_type) {
      case 'meeting_output':
        return <Sparkles size={16} color="#E2B53C" />;
      case 'transcript':
        return <FileText size={16} color="#38BDF8" />;
      case 'spreadsheet':
        return <FileSpreadsheet size={16} color="#10B981" />;
      case 'teams_import':
        return <Users size={16} color="#818CF8" />;
      default:
        return <File size={16} color="#94A3B8" />;
    }
  };

  return (
    <section className="content-card" style={{ marginBottom: '28px', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={20} color="#E2B53C" />
            <span>Project File Storage ({files.length})</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
            Store, manage, and edit meeting outputs, device imports, and project documents.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv,.json,.vtt,.srt"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleUploadFromDevice(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="spin-animation" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Upload from Device</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn"
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #E2B53C 0%, #CA8A04 100%)',
              color: '#090E1A',
              fontWeight: 600,
              minHeight: '44px',
            }}
          >
            <Plus size={14} />
            <span>Create File</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '6px', color: '#EF4444', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', borderRadius: '6px', color: '#10B981', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Check size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['all', 'meeting_output', 'document', 'transcript', 'notes'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterType(tab)}
            style={{
              background: filterType === tab ? 'rgba(226, 181, 60, 0.15)' : 'rgba(15, 23, 42, 0.6)',
              color: filterType === tab ? '#E2B53C' : '#94A3B8',
              border: filterType === tab ? '1px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '44px',
            }}
          >
            {tab === 'all' && `All Files (${files.length})`}
            {tab === 'meeting_output' && `Meeting Outputs (${files.filter((f) => f.file_type === 'meeting_output').length})`}
            {tab === 'document' && `Documents (${files.filter((f) => f.file_type === 'document').length})`}
            {tab === 'transcript' && `Transcripts (${files.filter((f) => f.file_type === 'transcript').length})`}
            {tab === 'notes' && `Notes (${files.filter((f) => f.file_type === 'notes').length})`}
          </button>
        ))}
      </div>

      {/* Files Grid / List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: '#94A3B8' }}>
          <Loader2 size={24} className="spin-animation" style={{ margin: '0 auto 8px', color: '#E2B53C' }} />
          <span style={{ fontSize: '0.86rem' }}>Loading project files...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 20px', background: 'rgba(9, 14, 26, 0.5)', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
          <Folder size={32} color="#64748B" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
          <p style={{ color: '#F8FAFC', fontSize: '0.92rem', fontWeight: 500, margin: '0 0 4px 0' }}>
            No files found
          </p>
          <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: 0 }}>
            Upload documents from your device, save meeting outputs, or create notes to organise this project.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              style={{
                background: 'rgba(9, 14, 26, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {getFileIcon(file)}
                    <strong style={{ fontSize: '0.88rem', color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
                      {file.name}
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#E2B53C', background: 'rgba(226, 181, 60, 0.12)', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize', flexShrink: 0 }}>
                    {file.source.replace('_', ' ')}
                  </span>
                </div>

                {file.description && (
                  <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                    {file.description}
                  </p>
                )}

                <div style={{ fontSize: '0.74rem', color: '#64748B', display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <span>{file.file_size_bytes ? `${Math.round(file.file_size_bytes / 1024)} KB` : 'Text'}</span>
                  <span>v{file.version}</span>
                  <span>{new Date(file.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px' }}>
                {file.content && (
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    title="Preview file"
                    aria-label={`Preview ${file.name}`}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '8px', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Eye size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setEditingFile(file);
                    setEditName(file.name);
                    setEditContent(file.content || '');
                    setEditDesc(file.description || '');
                  }}
                  title="Edit file"
                  aria-label={`Edit ${file.name}`}
                  style={{ background: 'transparent', border: 'none', color: '#E2B53C', cursor: 'pointer', padding: '8px', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Edit2 size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  title="Download file"
                  aria-label={`Download ${file.name}`}
                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '8px', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Download size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(file.id)}
                  title="Delete file"
                  aria-label={`Delete ${file.name}`}
                  style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '8px', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create File Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 22, 38, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#0F1A2E', border: '1px solid #233554', borderRadius: '12px', width: '100%', maxWidth: '560px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#F8FAFC', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#E2B53C" />
                <span>Create New Project File</span>
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>File Name</label>
                <input
                  type="text"
                  required
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. Stakeholder Notes.md"
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>File Type</label>
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value as ProjectFileType)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                >
                  <option value="notes">Project Notes</option>
                  <option value="document">Document</option>
                  <option value="meeting_output">Meeting Output</option>
                  <option value="transcript">Transcript</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>Description (Optional)</label>
                <input
                  type="text"
                  value={newFileDesc}
                  onChange={(e) => setNewFileDesc(e.target.value)}
                  placeholder="Short description of this file"
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>Content (Markdown / Text)</label>
                <textarea
                  rows={6}
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="Enter notes or document content..."
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.86rem', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: '1px solid #233554', color: '#94A3B8', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', minHeight: '44px' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newFileName.trim()}
                  style={{ background: '#E2B53C', color: '#090E1A', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}
                >
                  {creating ? 'Creating...' : 'Create File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit File Modal */}
      {editingFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 22, 38, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#0F1A2E', border: '1px solid #233554', borderRadius: '12px', width: '100%', maxWidth: '560px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#F8FAFC', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="#E2B53C" />
                <span>Edit Project File</span>
              </h3>
              <button type="button" onClick={() => setEditingFile(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>File Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>Content (Markdown / Text)</label>
                <textarea
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0B1322', border: '1px solid #1E293B', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '0.86rem', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditingFile(null)} style={{ background: 'transparent', border: '1px solid #233554', color: '#94A3B8', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', minHeight: '44px' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editName.trim()}
                  style={{ background: '#E2B53C', color: '#090E1A', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview File Modal */}
      {previewFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 22, 38, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#0F1A2E', border: '1px solid #233554', borderRadius: '12px', width: '100%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#E2B53C" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>
                  {previewFile.name}
                </h3>
              </div>
              <button type="button" onClick={() => setPreviewFile(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: '#0B1322', border: '1px solid #1E293B', borderRadius: '8px', padding: '16px', color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {previewFile.content || 'No text content available for preview.'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => handleDownload(previewFile)}
                style={{ background: 'transparent', border: '1px solid #233554', color: '#E2B53C', padding: '8px 14px', borderRadius: '6px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minHeight: '44px' }}
              >
                <Download size={14} />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                style={{ background: '#E2B53C', color: '#090E1A', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', minHeight: '44px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
