import React, { useState, useRef } from 'react';
import {
  X,
  Folder,
  FileText,
  Upload,
  Download,
  Eye,
  History,
  MessageSquare,
  Shield,
  Paperclip,
  Check,
  Calendar,
  Users,
  Building2,
  Briefcase,
  Lock,
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'xls' | 'file';
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  linkedRecord: string;
  access: 'Internal only' | 'Customer shared' | 'Restricted' | 'Entire organisation';
  versions: { version: string; date: string; author: string; notes: string }[];
  comments: { id: string; author: string; text: string; date: string }[];
  attachedTo: { kind: 'crm_record' | 'message' | 'email' | 'project' | 'account' | 'customer'; label: string }[];
}

const INITIAL_FILES: FileItem[] = [
  {
    id: 'f-01',
    name: 'Decision log, operating model session.pdf',
    type: 'pdf',
    size: '1.4 MB',
    uploadedBy: 'Maya Chen',
    uploadedAt: '21 Oct 2026',
    linkedRecord: 'Northbridge Industrial · S03: Account Room',
    access: 'Internal only',
    versions: [
      { version: 'v1.1', date: '21 Oct 2026', author: 'Maya Chen', notes: 'Incorporated Tuesday decision points' },
      { version: 'v1.0', date: '19 Oct 2026', author: 'Maya Chen', notes: 'Initial draft from workshop notes' },
    ],
    comments: [
      { id: 'c1', author: 'Tom Reyes', text: 'Verified scope items against phase 1 deliverables.', date: '21 Oct 2026' },
    ],
    attachedTo: [
      { kind: 'account', label: 'Northbridge Industrial' },
      { kind: 'crm_record', label: 'Operations review, phase 2' },
    ],
  },
  {
    id: 'f-02',
    name: 'Revised scope draft.docx',
    type: 'doc',
    size: '840 KB',
    uploadedBy: 'Tom Reyes',
    uploadedAt: 'Today, 09:15',
    linkedRecord: 'Northbridge Industrial · S03: Account Room',
    access: 'Customer shared',
    versions: [
      { version: 'v2.0', date: '21 Oct 2026', author: 'Tom Reyes', notes: 'Updated for multi site rollout' },
      { version: 'v1.0', date: '18 Oct 2026', author: 'Maya Chen', notes: 'Base requirements outline' },
    ],
    comments: [
      { id: 'c2', author: 'Maya Chen', text: 'Priya requested this before Friday committee session.', date: 'Today' },
    ],
    attachedTo: [
      { kind: 'customer', label: 'Northbridge Industrial' },
      { kind: 'project', label: 'Site 1 and 2 modernization roadmap' },
    ],
  },
  {
    id: 'f-03',
    name: 'Site data, two sites.xlsx',
    type: 'xls',
    size: '2.1 MB',
    uploadedBy: 'Sarah Jenkins',
    uploadedAt: '17 Oct 2026',
    linkedRecord: 'Northbridge Industrial · S03: Account Room',
    access: 'Entire organisation',
    versions: [
      { version: 'v1.0', date: '17 Oct 2026', author: 'Sarah Jenkins', notes: 'Full diagnostic equipment metrics' },
    ],
    comments: [],
    attachedTo: [
      { kind: 'account', label: 'Northbridge Industrial' },
      { kind: 'email', label: 'Procurement timeline request' },
    ],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
}

export const FileSharingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  roomName = 'Northbridge Account Room',
}) => {
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [selectedFileId, setSelectedFileId] = useState<string>(INITIAL_FILES[0].id);
  const [activeTab, setActiveTab] = useState<'details' | 'versions' | 'comments' | 'attach' | 'preview'>('details');
  const [newComment, setNewComment] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [attachSelection, setAttachSelection] = useState<string>('crm_record');
  const [attachLabel, setAttachLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const type: FileItem['type'] =
      ext === 'pdf' ? 'pdf' : ext === 'doc' || ext === 'docx' ? 'doc' : ext === 'xls' || ext === 'xlsx' ? 'xls' : 'file';

    const sizeStr = file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;

    const newFileItem: FileItem = {
      id: `f-${Date.now()}`,
      name: file.name,
      type,
      size: sizeStr,
      uploadedBy: 'Maya Chen',
      uploadedAt: 'Just now',
      linkedRecord: roomName,
      access: 'Internal only',
      versions: [{ version: 'v1.0', date: 'Just now', author: 'Maya Chen', notes: 'Initial upload from device' }],
      comments: [],
      attachedTo: [{ kind: 'crm_record', label: roomName }],
    };

    setFiles((prev) => [newFileItem, ...prev]);
    setSelectedFileId(newFileItem.id);
    setUploadSuccess(`Successfully uploaded \"${file.name}\" from device.`);
    setTimeout(() => setUploadSuccess(null), 3000);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentObj = {
      id: `c-${Date.now()}`,
      author: 'Maya Chen',
      text: newComment.trim(),
      date: 'Just now',
    };

    setFiles((prev) =>
      prev.map((f) => (f.id === selectedFile.id ? { ...f, comments: [...f.comments, commentObj] } : f))
    );
    setNewComment('');
  };

  const handleAttach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachLabel.trim()) return;

    const newAttach = {
      kind: attachSelection as FileItem['attachedTo'][0]['kind'],
      label: attachLabel.trim(),
    };

    setFiles((prev) =>
      prev.map((f) => (f.id === selectedFile.id ? { ...f, attachedTo: [...f.attachedTo, newAttach] } : f))
    );
    setAttachLabel('');
    setUploadSuccess(`Attached to ${newAttach.kind.replace(/_/g, ' ')}: ${newAttach.label}`);
    setTimeout(() => setUploadSuccess(null), 3000);
  };

  const handleDownload = (file: FileItem) => {
    setUploadSuccess(`Downloaded \"${file.name}\" to your device.`);
    setTimeout(() => setUploadSuccess(null), 3000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13, 22, 38, 0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10002,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          width: '820px',
          maxWidth: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.28)',
          boxSizing: 'border-box',
          border: '1px solid #D9DFE9',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            flexWrap: 'wrap',
            gap: '10px',
            borderBottom: '1px solid #EDF2F7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={18} color="#D4AF37" />
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#16263F', fontFamily: 'Poppins, sans-serif' }}>
              File Sharing and Collaboration
            </h3>
            <span style={{ fontSize: '12px', color: '#8898AA' }}>· {roomName}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              aria-label="Upload file from device"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#16263F',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                minHeight: '44px',
                fontSize: '12.5px',
                fontWeight: 650,
                cursor: 'pointer',
              }}
            >
              <Upload size={14} />
              <span>Upload from Device</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close file sharing modal"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#8898AA',
                padding: '10px',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {uploadSuccess && (
          <div
            style={{
              background: '#F0FDF4',
              borderBottom: '1px solid #BBF7D0',
              padding: '8px 24px',
              fontSize: '12px',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Main Content: Left File List + Right Details / Actions */}
        <div className="file-modal-layout">
          {/* Left File List */}
          <div
            style={{
              borderRight: '1px solid #EDF2F7',
              background: '#FAFBFD',
              padding: '12px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#8898AA', padding: '4px 8px' }}>
              Files in Room ({files.length})
            </div>
            {files.map((file) => {
              const isSelected = file.id === selectedFile.id;
              return (
                <div
                  key={file.id}
                  onClick={() => {
                    setSelectedFileId(file.id);
                    if (activeTab === 'preview') setActiveTab('details');
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: isSelected ? '#FFFFFF' : 'transparent',
                    border: isSelected ? '1px solid #D4AF37' : '1px solid transparent',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color={isSelected ? '#D4AF37' : '#64748B'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 650 : 500,
                          color: '#16263F',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {file.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8898AA', marginTop: '2px' }}>
                        {file.size} · {file.uploadedAt}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Detail Pane */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Tabs for Selected File */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 20px',
                borderBottom: '1px solid #EDF2F7',
                background: '#FFFFFF',
              }}
            >
              {[
                { id: 'details', label: 'Details and Permissions', icon: <Shield size={13} /> },
                { id: 'preview', label: 'Preview', icon: <Eye size={13} /> },
                { id: 'versions', label: `Version History (${selectedFile.versions.length})`, icon: <History size={13} /> },
                { id: 'comments', label: `Comments (${selectedFile.comments.length})`, icon: <MessageSquare size={13} /> },
                { id: 'attach', label: `Attach To (${selectedFile.attachedTo.length})`, icon: <Paperclip size={13} /> },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      background: isActive ? '#16263F' : '#F1F5F9',
                      color: isActive ? '#FFFFFF' : '#5A6478',
                      fontSize: '12px',
                      fontWeight: isActive ? 650 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* 1. Details and Permissions */}
              {activeTab === 'details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#16263F' }}>
                        {selectedFile.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#8898AA' }}>
                        Uploaded by {selectedFile.uploadedBy} on {selectedFile.uploadedAt} · Size: {selectedFile.size}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(selectedFile)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#FFFFFF',
                        border: '1px solid #D9DFE9',
                        color: '#16263F',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12.5px',
                        fontWeight: 650,
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </button>
                  </div>

                  <div style={{ background: '#FAFBFD', border: '1px solid #EDF2F7', borderRadius: '8px', padding: '14px 16px' }}>
                    <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                      Permissions and Access Control
                    </h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Lock size={15} color="#D4AF37" />
                      <select
                        value={selectedFile.access}
                        onChange={(e) => {
                          const val = e.target.value as FileItem['access'];
                          setFiles((prev) =>
                            prev.map((f) => (f.id === selectedFile.id ? { ...f, access: val } : f))
                          );
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #D9DFE9',
                          fontSize: '12.5px',
                          color: '#16263F',
                          background: '#FFFFFF',
                        }}
                      >
                        <option value="Internal only">Internal only (Kestrel Advisory)</option>
                        <option value="Customer shared">Customer shared (Northbridge Industrial)</option>
                        <option value="Entire organisation">Entire organisation</option>
                        <option value="Restricted">Restricted (Room members only)</option>
                      </select>
                    </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#8898AA' }}>
                      Access rules enforce strict tenant isolation and role-based permissions across workspaces.
                    </p>
                  </div>

                  <div>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                      Currently Attached To:
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedFile.attachedTo.map((att, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: '#E8EDF5',
                            color: '#16263F',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {att.kind.replace(/_/g, ' ').toUpperCase()}: {att.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Preview */}
              {activeTab === 'preview' && (
                <div style={{ textAlign: 'center', padding: '36px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                  <FileText size={48} color="#D4AF37" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#16263F' }}>
                    {selectedFile.name}
                  </h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#5A6478' }}>
                    High fidelity document preview ready. File type: {selectedFile.type.toUpperCase()} ({selectedFile.size}).
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedFile)}
                    style={{
                      background: '#16263F',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 18px',
                      fontSize: '13px',
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    Download File
                  </button>
                </div>
              )}

              {/* 3. Version History */}
              {activeTab === 'versions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                    Audit Trail and Version History
                  </h5>
                  {selectedFile.versions.map((v, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '6px',
                        border: '1px solid #EDF2F7',
                        background: idx === 0 ? '#FAFBFD' : '#FFFFFF',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <strong style={{ fontSize: '13px', color: '#16263F' }}>{v.version}</strong>
                        <span style={{ fontSize: '11px', color: '#8898AA' }}>{v.date} · {v.author}</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#5A6478' }}>{v.notes}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 4. Comments */}
              {activeTab === 'comments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h5 style={{ margin: '0', fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                    File Comments and Review Notes
                  </h5>
                  {selectedFile.comments.length === 0 ? (
                    <div style={{ color: '#8898AA', fontSize: '12.5px', padding: '16px 0' }}>
                      No comments recorded for this file yet.
                    </div>
                  ) : (
                    selectedFile.comments.map((c) => (
                      <div key={c.id} style={{ padding: '10px 12px', borderRadius: '6px', background: '#F8FAFC', border: '1px solid #EDF2F7' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <strong style={{ fontSize: '12.5px', color: '#16263F' }}>{c.author}</strong>
                          <span style={{ fontSize: '11px', color: '#8898AA' }}>{c.date}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#5A6478' }}>{c.text}</p>
                      </div>
                    ))
                  )}

                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      type="text"
                      placeholder="Add a comment on this document..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #D9DFE9',
                        fontSize: '12.5px',
                        color: '#16263F',
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        background: '#16263F',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 14px',
                        fontSize: '12.5px',
                        fontWeight: 650,
                        cursor: 'pointer',
                      }}
                    >
                      Post
                    </button>
                  </form>
                </div>
              )}

              {/* 5. Attach To */}
              {activeTab === 'attach' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                    Attach File to Other CRM Entities
                  </h5>
                  <p style={{ margin: 0, fontSize: '12px', color: '#5A6478' }}>
                    Link this file to CRM Records, Messages, Emails, Projects, Accounts, or Customers.
                  </p>

                  <form onSubmit={handleAttach} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px' }}>
                      <select
                        value={attachSelection}
                        onChange={(e) => setAttachSelection(e.target.value)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #D9DFE9',
                          fontSize: '12.5px',
                          color: '#16263F',
                          background: '#FFFFFF',
                        }}
                      >
                        <option value="crm_record">CRM Record</option>
                        <option value="message">Message</option>
                        <option value="email">Email</option>
                        <option value="project">Project</option>
                        <option value="account">Account</option>
                        <option value="customer">Customer</option>
                      </select>

                      <input
                        type="text"
                        required
                        placeholder="Name or identifier (e.g. Phase 2 Scope)"
                        value={attachLabel}
                        onChange={(e) => setAttachLabel(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #D9DFE9',
                          fontSize: '12.5px',
                          color: '#16263F',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      style={{
                        alignSelf: 'flex-start',
                        background: '#16263F',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        fontSize: '12.5px',
                        fontWeight: 650,
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      Attach to Entity
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
