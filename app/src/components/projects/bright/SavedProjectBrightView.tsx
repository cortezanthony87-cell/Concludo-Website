import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Plus,
  Search,
  Clock,
  Calendar,
  FileText,
  Layers,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Edit3,
  MoreHorizontal,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  Download,
  Printer,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project } from '../../../lib/projects/types';
import { OutputRecord, OUTPUT_TYPE_LABELS } from '../../../lib/outputs/types';
import type { DecisionRecord } from '../../../lib/decisions/types';
import type { ActionRecord } from '../../../lib/actions/types';
import { ProjectSourceItem, parseProjectSources } from '../../../lib/intelligence/transcriptExtractor';
import { computeProjectEvolution, ProjectEvolutionMetrics } from '../../../lib/intelligence/projectEvolution';
import { calculateActionBuckets, ActionBucketCounts } from '../../../lib/actions/actionBuckets';
import { fetchCandidates, approveCandidate, dismissCandidate } from '../../../lib/actions/actionCandidates';
import { ProjectFilesSection } from '../ProjectFilesSection';
import { OutputDocumentRenderer } from '../../OutputDocumentRenderer';
import { generateMeetingPdf } from '../../../lib/reporting/meetingPdfGenerator';
import { renderConcludoReport } from '../../../lib/reporting/concludoReport';
import { parseOutputToPayload } from '../../../lib/reporting/payloadFromOutput';
import { toMarkdown } from '../../../lib/intelligence/meetingEngine';
import './saved-project-bright.css';

export interface SavedProjectBrightViewProps {
  project: Project;
  supabase: SupabaseClient;
  outputs: OutputRecord[];
  decisions: DecisionRecord[];
  actions: ActionRecord[];
  onUpdateProject: (fields: Partial<Project>) => Promise<boolean>;
  onDeleteProject: () => Promise<void>;
  onRefreshData: () => Promise<void>;
  onExtractOutputs: () => void;
  onCreateAction?: (title: string, dueDate: string | null, priority: string) => Promise<void>;
  onCreateDecision?: (title: string, summary: string, reasoning: string, date: string) => Promise<void>;
  onDeleteOutput?: (outputId: string) => Promise<void>;
}

function formatMelbourneDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Not recorded';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Not recorded';
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d).toLowerCase().replace('am', 'am').replace('pm', 'pm');
  } catch {
    return 'Not recorded';
  }
}

function formatMelbourneDate(dateStr?: string | null): string {
  if (!dateStr) return 'Not recorded';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

const STAGES_LIST = [
  { num: 1, name: 'Initiation' },
  { num: 2, name: 'Discovery' },
  { num: 3, name: 'Planning' },
  { num: 4, name: 'Execution' },
  { num: 5, name: 'Review and QA' },
  { num: 6, name: 'Closeout' },
];

export const SavedProjectBrightView: React.FC<SavedProjectBrightViewProps> = ({
  project,
  supabase,
  outputs,
  decisions,
  actions,
  onUpdateProject,
  onDeleteProject,
  onRefreshData,
  onExtractOutputs,
  onCreateAction,
  onCreateDecision,
  onDeleteOutput,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab management via ?tab= query param
  const activeTab = (searchParams.get('tab') || 'overview').toLowerCase();
  const setTab = useCallback((tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Copy feedback
  const [idCopied, setIdCopied] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  // Candidate staging
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [showCandidateDrawer, setShowCandidateDrawer] = useState(false);
  const [candidateActionLoading, setCandidateActionLoading] = useState<string | null>(null);

  // Document viewer state (sources tab)
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [sourceSearch, setSourceSearch] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const LINES_PER_PAGE = 80;

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [viewingOutput, setViewingOutput] = useState<OutputRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const [showAddDecisionModal, setShowAddDecisionModal] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState(project.title);
  const [editMeetingType, setEditMeetingType] = useState(project.meeting_type || '');
  const [editClientName, setEditClientName] = useState(project.client_name || '');
  const [editProjectName, setEditProjectName] = useState(project.project_name || '');
  const [editMeetingDate, setEditMeetingDate] = useState(project.meeting_date || '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // New action form state
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDue, setNewActionDue] = useState('');
  const [newActionPriority, setNewActionPriority] = useState('Medium');
  const [savingAction, setSavingAction] = useState(false);

  // New decision form state
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionSummary, setNewDecisionSummary] = useState('');
  const [newDecisionReasoning, setNewDecisionReasoning] = useState('');
  const [newDecisionDate, setNewDecisionDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingDecision, setSavingDecision] = useState(false);

  // Parse sources from project transcript
  const sources = useMemo<ProjectSourceItem[]>(() => {
    return parseProjectSources(project.transcript || '', project.notes || null);
  }, [project.transcript, project.notes]);

  // Active source
  const activeSource = sources[activeSourceIdx] || sources[0] || {
    id: 'src-default',
    kind: 'meeting',
    title: 'Primary Session Transcript',
    content: project.transcript || '',
    wordCount: (project.transcript || '').split(/\s+/).filter(Boolean).length,
  };

  // Canonical Action Buckets
  const actionBuckets = useMemo<ActionBucketCounts>(() => {
    return calculateActionBuckets(actions);
  }, [actions]);

  // Project Evolution Metrics
  const evolution = useMemo<ProjectEvolutionMetrics>(() => {
    return computeProjectEvolution({
      projectTitle: project.title,
      meetingType: project.meeting_type,
      sources,
      actions: actions.map((a) => ({
        id: a.id,
        action_title: a.action_title,
        status: a.status,
        due_date: a.due_date,
      })),
      decisionsCount: decisions.length,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  }, [project.title, project.meeting_type, sources, actions, decisions.length, project.created_at, project.updated_at]);

  // Load candidates for this project
  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const res = await fetchCandidates(supabase, project.id);
      setCandidates(res.data || []);
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      setLoadingCandidates(false);
    }
  }, [supabase, project.id]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Copy project ID handler
  const handleCopyId = () => {
    navigator.clipboard.writeText(project.id);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  // Copy transcript handler (copies raw text WITHOUT line numbers)
  const handleCopyTranscript = () => {
    const rawText = activeSource.content || '';
    navigator.clipboard.writeText(rawText);
    setTranscriptCopied(true);
    setTimeout(() => setTranscriptCopied(false), 2000);
  };

  // Approve Candidate Handler
  const handleApproveCandidate = async (candidateId: string) => {
    setCandidateActionLoading(candidateId);
    try {
      const res = await approveCandidate(supabase, candidateId);
      if (res.error) {
        alert(`Approval error: ${res.error.message || res.error}`);
      } else {
        await Promise.all([loadCandidates(), onRefreshData()]);
      }
    } finally {
      setCandidateActionLoading(null);
    }
  };

  // Dismiss Candidate Handler
  const handleDismissCandidate = async (candidateId: string) => {
    setCandidateActionLoading(candidateId);
    try {
      const res = await dismissCandidate(supabase, candidateId);
      if (res.error) {
        alert(`Dismiss error: ${res.error.message || res.error}`);
      } else {
        await loadCandidates();
      }
    } finally {
      setCandidateActionLoading(null);
    }
  };

  // Save project edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const ok = await onUpdateProject({
        title: editTitle,
        meeting_type: editMeetingType || null,
        client_name: editClientName || null,
        project_name: editProjectName || null,
        meeting_date: editMeetingDate || null,
      });
      if (ok) setShowEditModal(false);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete project
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await onDeleteProject();
    } finally {
      setDeleteLoading(false);
    }
  };

  // Add action
  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim() || !onCreateAction) return;
    setSavingAction(true);
    try {
      await onCreateAction(newActionTitle.trim(), newActionDue || null, newActionPriority);
      setNewActionTitle('');
      setNewActionDue('');
      setShowAddActionModal(false);
      await onRefreshData();
    } finally {
      setSavingAction(false);
    }
  };

  // Add decision
  const handleAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecisionTitle.trim() || !onCreateDecision) return;
    setSavingDecision(true);
    try {
      await onCreateDecision(newDecisionTitle.trim(), newDecisionSummary.trim(), newDecisionReasoning.trim(), newDecisionDate);
      setNewDecisionTitle('');
      setNewDecisionSummary('');
      setNewDecisionReasoning('');
      setShowAddDecisionModal(false);
      await onRefreshData();
    } finally {
      setSavingDecision(false);
    }
  };

  // Parse lines for document viewer
  const transcriptLines = useMemo(() => {
    const raw = activeSource.content || '';
    const lines = raw.split(/\r?\n/);
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      // Check speaker pattern (e.g. "Anthony: text" or "Anthony Cortez: text")
      const speakerMatch = trimmed.match(/^([A-Za-z\s]+):\s*(.*)$/);
      const isDecision = /decision:|we decided|agreed:|resolved:/i.test(trimmed);
      return {
        lineNum: idx + 1,
        speaker: speakerMatch ? speakerMatch[1] : null,
        text: speakerMatch ? speakerMatch[2] : trimmed,
        isDecision,
        raw: line,
      };
    });
  }, [activeSource.content]);

  // Filtered transcript lines for search
  const filteredLines = useMemo(() => {
    if (!sourceSearch.trim()) return transcriptLines;
    const q = sourceSearch.toLowerCase();
    return transcriptLines.filter((l) => l.raw.toLowerCase().includes(q));
  }, [transcriptLines, sourceSearch]);

  // Paginated transcript lines
  const totalPages = Math.max(1, Math.ceil(filteredLines.length / LINES_PER_PAGE));
  const paginatedLines = useMemo(() => {
    const start = (pageNumber - 1) * LINES_PER_PAGE;
    return filteredLines.slice(start, start + LINES_PER_PAGE);
  }, [filteredLines, pageNumber]);

  // Data points count for subline
  const dataPointsCount = sources.length + actions.length + decisions.length;

  // Nearest deadline task title
  const nearestUpcomingAction = actions.find(
    (a) => a.due_date && a.status !== 'completed' && a.due_date === evolution.nearestDeadline
  );
  const firstOverdueAction = actions.find(
    (a) => a.due_date && a.status !== 'completed' && a.due_date < new Date().toISOString().slice(0, 10)
  );

  // Open full meeting output report
  const handleSeeFullReport = () => {
    if (outputs.length === 0) {
      onExtractOutputs();
      return;
    }
    const summaryOut = outputs.find((o) => o.output_type === 'summary') || outputs[0];
    setViewingOutput(summaryOut);
  };

  // Action CSV formatter supporting both MeetingModel actions and ActionRecord items
  const formatActionsToCsv = (acts: any[]): string => {
    const esc = (s: any) => `"${String(s || '').replace(/"/g, '""')}"`;
    const headers = ['ID', 'Task', 'Owner', 'Due Date', 'Status', 'Priority', 'Definition of Done', 'Evidence Quote', 'Source'];
    const rows = (acts || []).map((a, i) => {
      const id = a.id || `ACT-${i + 1}`;
      const task = a.task || a.action_title || a.title || '';
      const owner = a.owner || a.owner_name || '';
      const due = a.due || a.due_date || '';
      const status = a.status || '';
      const priority = a.priority || '';
      const done = a.doneDefinition || a.deliverable || '';
      const ev = (a.evidence && a.evidence[0]?.quote) || a.source_excerpt || '';
      const src = (a.evidence && a.evidence[0]?.sourceName) || a.source || '';
      return [esc(id), esc(task), esc(owner), esc(due), esc(status), esc(priority), esc(done), esc(ev), esc(src)].join(',');
    });
    return [headers.join(','), ...rows].join('\r\n');
  };

  // Download Boardroom PDF
  const handleDownloadPdf = async (targetOutput?: OutputRecord) => {
    const out = targetOutput || viewingOutput;
    if (!out) return;
    setIsExporting(true);
    try {
      let pdfBytes: Uint8Array;
      const baseName = (project.title || 'Meeting_Record')
        .replace(/[^\w]+/g, '_')
        .replace(/^_+|_+$/g, '');

      if (out.json_content && out.json_content.version === '2.0' && Array.isArray(out.json_content.actions)) {
        pdfBytes = await generateMeetingPdf(out.json_content);
      } else if (out.json_content && out.json_content.document && out.json_content.meeting) {
        const res = await renderConcludoReport(out.json_content);
        pdfBytes = new Uint8Array(res.pdfBytes);
      } else {
        const payload = parseOutputToPayload(
          out.output_type,
          out.content || '',
          project.title,
          project.meeting_date || new Date().toISOString().slice(0, 10),
          project.client_name || 'Concludo Client',
          'starter'
        );
        const res = await renderConcludoReport(payload);
        pdfBytes = new Uint8Array(res.pdfBytes);
      }

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${baseName}_${out.output_type || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF document: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  // Download complete archive (.zip)
  const handleDownloadZip = async (targetOutput?: OutputRecord) => {
    const out = targetOutput || viewingOutput;
    if (!out) return;
    setIsExporting(true);
    try {
      const { default: JSZipModule } = await import('jszip');
      const JSZip = (JSZipModule as any)?.default || JSZipModule;
      const zip = new JSZip();
      const baseName = (project.title || 'Meeting_Record')
        .replace(/[^\w]+/g, '_')
        .replace(/^_+|_+$/g, '');

      // 1. PDF
      try {
        let pdfBytes: Uint8Array | null = null;
        if (out.json_content && out.json_content.version === '2.0' && Array.isArray(out.json_content.actions)) {
          pdfBytes = await generateMeetingPdf(out.json_content);
        } else if (out.json_content && out.json_content.document && out.json_content.meeting) {
          const res = await renderConcludoReport(out.json_content);
          pdfBytes = new Uint8Array(res.pdfBytes);
        } else {
          const payload = parseOutputToPayload(
            out.output_type,
            out.content || '',
            project.title,
            project.meeting_date || new Date().toISOString().slice(0, 10),
            project.client_name || 'Concludo Client',
            'starter'
          );
          const res = await renderConcludoReport(payload);
          pdfBytes = new Uint8Array(res.pdfBytes);
        }
        if (pdfBytes) {
          zip.file(`${baseName}_report.pdf`, pdfBytes);
        }
      } catch (e) {
        console.warn('PDF zip inclusion failed:', e);
      }

      // 2. Markdown
      const mdContent = out.content || (out.json_content?.version === '2.0' ? toMarkdown(out.json_content) : '');
      if (mdContent) {
        zip.file(`${baseName}_report.md`, mdContent);
      }

      // 3. CSV actions
      const acts = out.json_content?.actions || actions;
      if (acts && acts.length > 0) {
        zip.file(`${baseName}_actions.csv`, formatActionsToCsv(acts));
      }

      // 4. JSON record
      if (out.json_content) {
        zip.file(`${baseName}_record.json`, JSON.stringify(out.json_content, null, 2));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${baseName}_package.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (err: any) {
      console.error('Failed to export ZIP package:', err);
      alert('Failed to generate ZIP package: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  // Download Action Tracker (.csv)
  const handleDownloadCsv = (targetOutput?: OutputRecord) => {
    const out = targetOutput || viewingOutput;
    const acts = out?.json_content?.actions || actions;
    if (!acts || acts.length === 0) {
      alert('No actions found to export to CSV.');
      return;
    }
    const baseName = (project.title || 'Meeting_Actions')
      .replace(/[^\w]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const csvText = formatActionsToCsv(acts);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${baseName}_actions.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 60000);
  };

  // Print via browser
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="sp-shell">
      {/* Breadcrumb */}
      <div className="sp-crumb">
        <Link to="/projects">Projects</Link>
        <span>/</span>
        <span>{project.title}</span>
      </div>

      {/* Header Top Row */}
      <div className="sp-top">
        <div>
          <div className="sp-eyebrow">
            <span className="sp-tag">MEETING MEMORY</span>
            <span className="sp-tag">
              {project.ownership_type === 'team' ? 'Team project' : 'Personal project'}
            </span>
          </div>
          <h1 className="sp-title">{project.title}</h1>
          <div className="sp-id-row sp-mono">
            <span>ID {project.id}</span>
            <button
              type="button"
              onClick={handleCopyId}
              style={{ background: 'none', border: 0, padding: 0, color: 'var(--sp-navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', font: 'inherit' }}
            >
              {idCopied ? <Check size={12} color="var(--sp-grn)" /> : <Copy size={12} />}
              <span>{idCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="sp-btn"
            onClick={handleSeeFullReport}
            title="See full meeting output report"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={14} />
            <span>See full report</span>
          </button>
          <button
            type="button"
            className="sp-btn2"
            onClick={() => navigate('/search')}
          >
            <Search size={14} />
            <span>Search meeting history</span>
          </button>
          <button
            type="button"
            className="sp-btn2"
            onClick={() => setShowEditModal(true)}
          >
            <Edit3 size={14} />
            <span>Edit details</span>
          </button>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="sp-btn2"
              onClick={() => setShowMoreMenu((v) => !v)}
            >
              <MoreHorizontal size={14} />
              <span>More</span>
            </button>
            {showMoreMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid var(--sp-line)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(22, 38, 63, 0.1)',
                  zIndex: 20,
                  minWidth: '160px',
                  padding: '4px 0',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDeleteModal(true);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'none',
                    border: 0,
                    color: 'var(--sp-red)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete project</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata Strip */}
      <div className="sp-card" style={{ padding: '12px 16px' }}>
        <div className="sp-meta">
          <div>
            <small>Meeting type</small>
            <span>{project.meeting_type || 'General'}</span>
          </div>
          <div>
            <small>Client</small>
            <span>{project.client_name || 'Internal'}</span>
          </div>
          <div>
            <small>Project stream</small>
            <span>{project.project_name || 'Standard'}</span>
          </div>
          <div>
            <small>Meeting date</small>
            <span>{formatMelbourneDate(project.meeting_date)}</span>
          </div>
          <div>
            <small>Created</small>
            <span>{formatMelbourneDateTime(project.created_at)}</span>
          </div>
          <div>
            <small>Last updated</small>
            <span>{formatMelbourneDateTime(project.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="sp-tabs">
        <button
          type="button"
          className={`sp-tab ${activeTab === 'overview' ? 'on' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`sp-tab ${activeTab === 'sources' ? 'on' : ''}`}
          onClick={() => setTab('sources')}
        >
          Sources
        </button>
        <button
          type="button"
          className={`sp-tab ${activeTab === 'outputs' ? 'on' : ''}`}
          onClick={() => setTab('outputs')}
        >
          Outputs
        </button>
        <button
          type="button"
          className={`sp-tab ${activeTab === 'decisions' ? 'on' : ''}`}
          onClick={() => setTab('decisions')}
        >
          Decisions and actions
          {actionBuckets.overdue + actionBuckets.dueToday + actionBuckets.pending > 0 && (
            <span
              className="sp-pill"
              style={{
                background: 'var(--sp-gold)',
                borderColor: 'var(--sp-gold-deep)',
                fontWeight: 700,
                padding: '1px 6px',
                fontSize: '11px',
              }}
            >
              {actionBuckets.overdue + actionBuckets.dueToday + actionBuckets.pending}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`sp-tab ${activeTab === 'files' ? 'on' : ''}`}
          onClick={() => setTab('files')}
        >
          Files
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="sp-g2">
          <div>
            {/* Card: Where this project is */}
            <div className="sp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '16px' }}>Where this project is</h3>
                {actionBuckets.overdue > 0 ? (
                  <span className="sp-warn">
                    <AlertTriangle size={13} />
                    <span>{actionBuckets.overdue} overdue action{actionBuckets.overdue === 1 ? '' : 's'}</span>
                  </span>
                ) : (
                  <span className="sp-pill sp-pill-completed">
                    <Check size={12} />
                    <span>On track</span>
                  </span>
                )}
              </div>

              <div style={{ marginTop: '6px', fontSize: '14px', lineHeight: '1.6' }}>
                <b>Best match: Stage {evolution.currentStage.stageNumber}, {evolution.currentStage.shortLabel}</b>
                <span className="sp-note" style={{ marginLeft: '8px' }}>
                  Based on {dataPointsCount} data points across {sources.length} source{sources.length === 1 ? '' : 's'}. Stages show where evidence was found, not that the work is finished.
                </span>
              </div>

              {/* 6 Stage Boxes */}
              <div className="sp-stages">
                {STAGES_LIST.map((st) => {
                  const isBestMatch = st.num === evolution.currentStage.stageNumber;
                  const hasEvidence = st.num <= evolution.currentStage.stageNumber;
                  const stateClass = isBestMatch ? 'cur' : hasEvidence ? 'ev' : 'no';
                  const stateText = isBestMatch ? 'Best match' : hasEvidence ? 'Evidence found' : 'No evidence yet';

                  return (
                    <div
                      key={st.num}
                      className={`sp-st ${stateClass}`}
                      title={!hasEvidence ? 'Red means no evidence found yet, not failure.' : undefined}
                    >
                      <small>STAGE {st.num}</small>
                      <b>
                        {st.name}
                        {isBestMatch && <span className="sp-tick">✓</span>}
                      </b>
                      <small>{stateText}</small>
                      <i className="sp-bar" />
                    </div>
                  );
                })}
              </div>

              {/* KPI Strip */}
              <div className="sp-kpi">
                <div className="sp-kpi-box">
                  <small className="sp-note">ACTION PROGRESS</small>
                  {actionBuckets.total === 0 ? (
                    <>
                      <b style={{ fontSize: '15px' }}>Open / Pending Actions</b>
                      <span className="sp-note">No actions logged</span>
                    </>
                  ) : (
                    <>
                      <b>{actionBuckets.completed} of {actionBuckets.total}</b>
                      <span className="sp-note">complete ({Math.round((actionBuckets.completed / actionBuckets.total) * 100)}%)</span>
                    </>
                  )}
                </div>

                <div className="sp-kpi-box">
                  <small className="sp-note">NEXT DEADLINE</small>
                  {evolution.nearestDeadline ? (
                    <>
                      <b>{formatMelbourneDate(evolution.nearestDeadline)}</b>
                      <span className="sp-note">{nearestUpcomingAction?.action_title || 'Next action'}</span>
                    </>
                  ) : (
                    <>
                      <b>{actionBuckets.overdue > 0 ? `${actionBuckets.overdue} Overdue` : 'No upcoming deadline'}</b>
                      <span className="sp-note">{actionBuckets.overdue > 0 ? 'Behind deadline' : 'Clear schedule'}</span>
                    </>
                  )}
                </div>

                <div className="sp-kpi-box">
                  <small className="sp-note">OVERDUE</small>
                  <b style={{ color: actionBuckets.overdue > 0 ? 'var(--sp-red)' : 'inherit' }}>
                    {actionBuckets.overdue}
                  </b>
                  <span className="sp-note">
                    {actionBuckets.overdue > 0
                      ? (firstOverdueAction?.action_title || 'Action requires review')
                      : 'None overdue'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card: Evidence base */}
            <div className="sp-card">
              <h3 style={{ fontSize: '16px' }}>Evidence base</h3>
              <div className="sp-note" style={{ margin: '2px 0 10px' }}>
                {sources.length} sources: {sources.filter((s) => s.kind === 'meeting').length} meeting{sources.filter((s) => s.kind === 'meeting').length === 1 ? '' : 's'}, {sources.filter((s) => s.kind === 'document').length} document{sources.filter((s) => s.kind === 'document').length === 1 ? '' : 's'}. All sources feed summaries, action plans and decision logs.
              </div>

              <div>
                {sources.map((s, idx) => (
                  <span
                    key={s.id || idx}
                    className="sp-src"
                    onClick={() => {
                      setActiveSourceIdx(idx);
                      setTab('sources');
                    }}
                  >
                    <span className="sp-tag">{s.kind === 'meeting' ? 'MEETING' : s.fileType?.toUpperCase() || 'DOCUMENT'}</span>
                    <span style={{ fontWeight: 600 }}>{s.title}</span>
                    {s.wordCount && <span className="sp-note">{s.wordCount.toLocaleString()} words</span>}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="sp-btn2"
                  onClick={() => setShowEditModal(true)}
                >
                  + Add meeting transcript
                </button>
                <button
                  type="button"
                  className="sp-btn2"
                  onClick={() => setTab('files')}
                >
                  Import more files
                </button>
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div>
            {/* Card: Next step */}
            <div className="sp-card" style={{ borderLeft: '4px solid var(--sp-gold)' }}>
              <h3 style={{ fontSize: '15px' }}>Next step</h3>
              <div className="sp-note" style={{ margin: '6px 0 12px' }}>
                {outputs.length > 0
                  ? 'View the complete meeting output report or extract fresh outputs from your sources.'
                  : 'Draft your outputs from the sources. Suggested actions wait for your approval.'}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="sp-btn"
                  onClick={handleSeeFullReport}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileText size={14} />
                  <span>See full report</span>
                </button>
                <button
                  type="button"
                  className="sp-btn2"
                  onClick={onExtractOutputs}
                >
                  Extract and generate outputs
                </button>
              </div>
            </div>

            {/* Card: Latest outputs */}
            <div className="sp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <h3 style={{ fontSize: '15px', margin: 0 }}>Latest outputs</h3>
                {outputs.length > 0 && (
                  <button
                    type="button"
                    className="sp-btn"
                    style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={handleSeeFullReport}
                  >
                    <FileText size={12} />
                    <span>See full report</span>
                  </button>
                )}
              </div>
              {outputs.length === 0 ? (
                <div className="sp-note" style={{ margin: '10px 0' }}>
                  No outputs generated yet. Click Extract and generate outputs above.
                </div>
              ) : (
                <>
                  {outputs.slice(0, 5).map((o) => (
                    <div key={o.id} className="sp-row">
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{OUTPUT_TYPE_LABELS[o.output_type] || o.output_type}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="sp-btn2"
                          onClick={() => setViewingOutput(o)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="sp-btn2"
                          onClick={() => handleDownloadPdf(o)}
                          title="Save PDF to device"
                        >
                          <Download size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="sp-btn2"
                    style={{ width: '100%', marginTop: '10px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleSeeFullReport}
                  >
                    <FileText size={13} />
                    <span>See full report</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SOURCES */}
      {activeTab === 'sources' && (
        <div className="sp-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px' }}>Evidence base</h3>
              <div className="sp-note">
                {sources.length} sources: {sources.filter((s) => s.kind === 'meeting').length} meeting, {sources.filter((s) => s.kind === 'document').length} document
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="sp-btn2" onClick={() => setShowEditModal(true)}>
                + Add meeting transcript
              </button>
              <button type="button" className="sp-btn2" onClick={() => setTab('files')}>
                Import more files
              </button>
              <button type="button" className="sp-btn2" onClick={handleCopyTranscript}>
                {transcriptCopied ? <Check size={13} color="var(--sp-grn)" /> : <Copy size={13} />}
                <span>{transcriptCopied ? 'Copied' : 'Copy transcript'}</span>
              </button>
              <button type="button" className="sp-btn" onClick={onExtractOutputs}>
                Extract and generate outputs
              </button>
            </div>
          </div>

          {/* Source chips */}
          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            {sources.map((s, idx) => (
              <span
                key={s.id || idx}
                className={`sp-src ${idx === activeSourceIdx ? 'active' : ''}`}
                onClick={() => {
                  setActiveSourceIdx(idx);
                  setPageNumber(1);
                }}
              >
                <span className="sp-tag">{s.kind === 'meeting' ? 'MEETING' : s.fileType?.toUpperCase() || 'DOCUMENT'}</span>
                <span style={{ fontWeight: 600 }}>{s.title}</span>
              </span>
            ))}
          </div>

          {/* Search inside source and view toggles */}
          <div style={{ display: 'flex', gap: '8px', margin: '6px 0 12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={14} color="var(--sp-slate)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => {
                  setSourceSearch(e.target.value);
                  setPageNumber(1);
                }}
                placeholder="Search inside this source"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 30px',
                  border: '1px solid var(--sp-line)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--sp-navy)',
                }}
              />
            </div>
            <button
              type="button"
              className={`sp-btn2 ${showTimestamps ? 'active' : ''}`}
              onClick={() => setShowTimestamps((v) => !v)}
            >
              {showTimestamps ? 'Hide timestamps' : 'Show timestamps'}
            </button>
            <button
              type="button"
              className={`sp-btn2 ${wrapLines ? 'active' : ''}`}
              onClick={() => setWrapLines((v) => !v)}
            >
              {wrapLines ? 'Unwrap lines' : 'Wrap lines'}
            </button>
          </div>

          {/* Word Document Viewer */}
          <div className="sp-doc">
            <div className="sp-page" style={{ whiteSpace: wrapLines ? 'normal' : 'nowrap' }}>
              <h4>{activeSource.title}</h4>
              <div className="sp-m">
                Confidential · Attendees: {project.client_name || 'Project Team'} · {formatMelbourneDate(project.meeting_date)}
              </div>

              {paginatedLines.length === 0 ? (
                <p className="sp-note">No matching lines found for query "{sourceSearch}".</p>
              ) : (
                paginatedLines.map((l) => (
                  <p key={l.lineNum} className={l.isDecision ? 'sp-dc' : ''}>
                    <i className="sp-ln">{l.lineNum}</i>
                    {l.speaker && <b className="sp-spk">{l.speaker}:</b>}
                    <span>{l.text}</span>
                  </p>
                ))
              )}
            </div>
          </div>

          {/* Pagination controls for long transcripts */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <span className="sp-note">
                Showing page {pageNumber} of {totalPages} ({filteredLines.length} lines total)
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="sp-btn2"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="sp-btn2"
                  disabled={pageNumber >= totalPages}
                  onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="sp-note" style={{ marginTop: '10px' }}>
            Illustrative text. Extraction is rule based drafting. It can miss or misread items, so review before you use it.
          </div>
        </div>
      )}

      {/* TAB 3: OUTPUTS */}
      {activeTab === 'outputs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div className="sp-note">{outputs.length} saved output{outputs.length === 1 ? '' : 's'}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {outputs.length > 0 && (
                <button
                  type="button"
                  className="sp-btn"
                  onClick={handleSeeFullReport}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileText size={14} />
                  <span>See full report</span>
                </button>
              )}
              <button type="button" className="sp-btn2" onClick={onExtractOutputs}>
                + Create output
              </button>
            </div>
          </div>

          {outputs.length === 0 ? (
            <div className="sp-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <FileText size={32} color="var(--sp-slate)" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>No saved outputs yet</h3>
              <p className="sp-note" style={{ maxWidth: '460px', margin: '0 auto 16px' }}>
                Generate an Executive Boardroom Summary, Action Plan, Decision Log, Follow-up Email or Client Deck from your project evidence base.
              </p>
              <button type="button" className="sp-btn" onClick={onExtractOutputs}>
                Extract and generate outputs
              </button>
            </div>
          ) : (
            <div className="sp-grid3">
              {outputs.map((o) => {
                const isDeck = o.output_type === 'deck' || o.output_type === 'client_deck';
                const isEmail = o.output_type === 'email' || o.output_type === 'follow_up_email';
                const tagLabel = isDeck ? 'PPTX' : isEmail ? 'EMAIL' : 'A4';

                return (
                  <div key={o.id} className="sp-card" style={{ margin: 0 }}>
                    <span className="sp-tag">{tagLabel}</span>
                    <h3 style={{ fontSize: '15px', margin: '8px 0 4px' }}>
                      {OUTPUT_TYPE_LABELS[o.output_type] || o.output_type}
                    </h3>
                    <div className="sp-note">
                      {formatMelbourneDateTime(o.created_at)}
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="sp-btn"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => setViewingOutput(o)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="sp-btn2"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleDownloadPdf(o)}
                        title="Save PDF to device"
                      >
                        <Download size={12} />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        className="sp-btn2"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleDownloadZip(o)}
                        title="Download complete archive (.zip)"
                      >
                        <Layers size={12} />
                        <span>ZIP</span>
                      </button>
                      <button
                        type="button"
                        className="sp-btn2"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => {
                          navigator.clipboard.writeText(o.content || '');
                          alert('Copied output content to clipboard');
                        }}
                      >
                        Copy
                      </button>
                      {onDeleteOutput && (
                        <button
                          type="button"
                          className="sp-btn2"
                          style={{ padding: '4px 8px' }}
                          onClick={() => {
                            if (confirm('Delete this saved output?')) {
                              onDeleteOutput(o.id);
                            }
                          }}
                          title="Delete output"
                        >
                          <Trash2 size={13} color="var(--sp-red)" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DECISIONS AND ACTIONS */}
      {activeTab === 'decisions' && (
        <div>
          {/* Candidate suggestions banner */}
          <div className="sp-ban">
            <div>
              <b>{candidates.length} suggested action{candidates.length === 1 ? '' : 's'} to review.</b>
              <span className="sp-note" style={{ marginLeft: '6px' }}>
                Nothing is added to your Actions until you approve it.
              </span>
            </div>
            <button
              type="button"
              className="sp-btn"
              onClick={() => setShowCandidateDrawer((v) => !v)}
            >
              {showCandidateDrawer ? 'Hide suggestions' : 'Review suggestions'}
            </button>
          </div>

          {/* Candidate suggestions drawer / panel */}
          {showCandidateDrawer && (
            <div className="sp-card" style={{ borderLeft: '4px solid var(--sp-gold)', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Unapproved Action Candidates</h3>
              {loadingCandidates ? (
                <div className="sp-note"><Loader2 size={14} className="spin" /> Loading suggestions...</div>
              ) : candidates.length === 0 ? (
                <div className="sp-note">No pending candidate actions for this project.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {candidates.map((cand) => (
                    <div
                      key={cand.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--sp-line)',
                        borderRadius: '6px',
                        background: '#FAFBFD',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <b style={{ fontSize: '13px', display: 'block' }}>{cand.title}</b>
                        {cand.source_excerpt && (
                          <div className="sp-note" style={{ fontStyle: 'italic', marginTop: '2px' }}>
                            "{cand.source_excerpt}"
                          </div>
                        )}
                        <div className="sp-note" style={{ marginTop: '2px' }}>
                          Proposed owner: {cand.proposed_owner_label || 'Unassigned'} · Proposed due: {cand.proposed_due ? formatMelbourneDate(cand.proposed_due) : 'None'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="sp-btn"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          disabled={candidateActionLoading === cand.id}
                          onClick={() => handleApproveCandidate(cand.id)}
                        >
                          <Check size={12} />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          className="sp-btn2"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          disabled={candidateActionLoading === cand.id}
                          onClick={() => handleDismissCandidate(cand.id)}
                        >
                          <X size={12} />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2-Column Grid: Left Decisions, Right Actions */}
          <div className="sp-g2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Decisions Column */}
            <div className="sp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '16px' }}>Decisions ({decisions.length})</h3>
                <button
                  type="button"
                  className="sp-btn2"
                  onClick={() => setShowAddDecisionModal(true)}
                >
                  + Log decision
                </button>
              </div>

              {decisions.length === 0 ? (
                <div className="sp-note" style={{ margin: '12px 0' }}>
                  No decisions logged yet. Use + Log decision to record a strategic consensus.
                </div>
              ) : (
                decisions.map((dec) => (
                  <div key={dec.id} className="sp-dec">
                    <b>{dec.decision_title}</b>
                    <div className="sp-note">
                      {formatMelbourneDate(dec.decision_date)} · Owner: {dec.decision_owner || 'Unassigned'} · <span className="sp-pill">Agreed</span>
                    </div>
                    {dec.decision_summary && (
                      <>
                        <div className="sp-k">Rationale</div>
                        <div style={{ fontSize: '13px' }}>{dec.decision_summary}</div>
                      </>
                    )}
                    {dec.decision_reasoning && (
                      <>
                        <div className="sp-k">Alternatives considered</div>
                        <div style={{ fontSize: '13px' }}>{dec.decision_reasoning}</div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Actions Column */}
            <div className="sp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '16px' }}>Actions ({actions.length})</h3>
                <button
                  type="button"
                  className="sp-btn2"
                  onClick={() => setShowAddActionModal(true)}
                >
                  + Add action
                </button>
              </div>

              {actions.length === 0 ? (
                <div className="sp-note" style={{ margin: '12px 0' }}>
                  No actions logged yet. Extract outputs or approve candidates to populate actions.
                </div>
              ) : (
                actions.map((act) => {
                  const isOverdue =
                    act.status !== 'completed' &&
                    act.due_date &&
                    act.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
                  const isCompleted = act.status === 'completed';

                  return (
                    <div key={act.id} className="sp-row">
                      <div>
                        <b>{act.action_title}</b>
                        <div className="sp-note">
                          Due {act.due_date ? formatMelbourneDate(act.due_date) : 'No date'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className="sp-pill">{act.priority || 'Medium'}</span>
                        <span
                          className={`sp-pill ${isOverdue ? 'sp-pill-overdue' : isCompleted ? 'sp-pill-completed' : ''}`}
                        >
                          {isOverdue ? 'Overdue' : isCompleted ? 'Completed' : act.status === 'in_progress' ? 'In progress' : 'Not started'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="sp-note" style={{ marginTop: '12px' }}>
                <Link to="/work/actions" style={{ color: 'var(--sp-navy)', fontWeight: 600 }}>
                  Open in Action Command Hub →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FILES */}
      {activeTab === 'files' && (
        <div className="sp-card">
          <ProjectFilesSection projectId={project.id} projectTitle={project.title} />
        </div>
      )}

      {/* EDIT PROJECT MODAL */}
      {showEditModal && (
        <div className="sp-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="sp-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Edit Project Details</h3>
              <button type="button" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Client Name</label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Project Stream</label>
                  <input
                    type="text"
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Meeting Type</label>
                  <input
                    type="text"
                    value={editMeetingType}
                    onChange={(e) => setEditMeetingType(e.target.value)}
                    placeholder="e.g. Strategy and Planning"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Meeting Date</label>
                  <input
                    type="date"
                    value={editMeetingDate}
                    onChange={(e) => setEditMeetingDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="sp-btn2" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="sp-btn" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PROJECT MODAL (30-day soft delete confirm) */}
      {showDeleteModal && (
        <div className="sp-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="sp-modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', color: 'var(--sp-red)', marginBottom: '8px' }}>Delete Project?</h3>
            <p className="sp-note" style={{ marginBottom: '16px' }}>
              This project will be moved to Recently Deleted with a 30-day retention guarantee. You can restore it anytime within 30 days before permanent deletion.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="sp-btn2" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="sp-btn3"
                style={{ background: 'var(--sp-red)' }}
                disabled={deleteLoading}
                onClick={handleDelete}
              >
                {deleteLoading ? 'Deleting...' : 'Move to Recently Deleted'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ACTION MODAL */}
      {showAddActionModal && (
        <div className="sp-modal-overlay" onClick={() => setShowAddActionModal(false)}>
          <div className="sp-modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3>Add New Action</h3>
              <button type="button" onClick={() => setShowAddActionModal(false)} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAction} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Action Title *</label>
                <input
                  type="text"
                  required
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  placeholder="e.g. Send revised scope to Priya"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Due Date</label>
                  <input
                    type="date"
                    value={newActionDue}
                    onChange={(e) => setNewActionDue(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Priority</label>
                  <select
                    value={newActionPriority}
                    onChange={(e) => setNewActionPriority(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px', background: '#fff' }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="sp-btn2" onClick={() => setShowAddActionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="sp-btn" disabled={savingAction}>
                  {savingAction ? 'Saving...' : 'Add action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DECISION MODAL */}
      {showAddDecisionModal && (
        <div className="sp-modal-overlay" onClick={() => setShowAddDecisionModal(false)}>
          <div className="sp-modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3>Log Project Decision</h3>
              <button type="button" onClick={() => setShowAddDecisionModal(false)} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddDecision} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Decision Title *</label>
                <input
                  type="text"
                  required
                  value={newDecisionTitle}
                  onChange={(e) => setNewDecisionTitle(e.target.value)}
                  placeholder="e.g. Monthly check-ins continue through December"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Rationale / Summary</label>
                <textarea
                  rows={3}
                  value={newDecisionSummary}
                  onChange={(e) => setNewDecisionSummary(e.target.value)}
                  placeholder="Why this decision was made..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Alternatives Considered</label>
                <textarea
                  rows={2}
                  value={newDecisionReasoning}
                  onChange={(e) => setNewDecisionReasoning(e.target.value)}
                  placeholder="Options evaluated and deferred..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--sp-line)', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="sp-btn2" onClick={() => setShowAddDecisionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="sp-btn" disabled={savingDecision}>
                  {savingDecision ? 'Saving...' : 'Log decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW OUTPUT / FULL REPORT MODAL */}
      {viewingOutput && (
        <div className="sp-modal-overlay" onClick={() => setViewingOutput(null)}>
          <div
            className="sp-modal-content"
            style={{
              maxWidth: '1080px',
              width: '95vw',
              maxHeight: '94vh',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--sp-line)',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span className="sp-tag" style={{ background: 'var(--sp-gold-bg)', color: 'var(--sp-gold-deep)', fontWeight: 700 }}>
                    MEETING OUTPUT REPORT
                  </span>
                  <span className="sp-tag">
                    {OUTPUT_TYPE_LABELS[viewingOutput.output_type] || viewingOutput.output_type}
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', margin: '2px 0' }}>{project.title}</h3>
                <div className="sp-note">
                  Saved {formatMelbourneDateTime(viewingOutput.created_at)}
                  {project.client_name ? ` · Client: ${project.client_name}` : ''}
                  {project.meeting_date ? ` · Meeting: ${formatMelbourneDate(project.meeting_date)}` : ''}
                </div>
              </div>

              {/* Action Buttons to Save to Laptop, Computer, Phone */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(viewingOutput)}
                  disabled={isExporting}
                  className="sp-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '6px 12px' }}
                  title="Save PDF directly to laptop, computer or phone"
                >
                  <Download size={14} />
                  <span>{isExporting ? 'Saving...' : 'Save as PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadZip(viewingOutput)}
                  disabled={isExporting}
                  className="sp-btn2"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '6px 12px' }}
                  title="Download complete archive (.zip) with PDF, Markdown, CSV, and JSON"
                >
                  <Layers size={14} />
                  <span>Package (.zip)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadCsv(viewingOutput)}
                  className="sp-btn2"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '6px 12px' }}
                  title="Download action tracker spreadsheet (.csv)"
                >
                  <FileText size={14} />
                  <span>Action tracker (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="sp-btn2"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '6px 12px' }}
                  title="Print or Save as PDF via browser"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingOutput(null)}
                  className="sp-btn2"
                  style={{ padding: '6px 10px' }}
                  title="Close report"
                >
                  <X size={16} />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Document Switcher if multiple outputs exist */}
            {outputs.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="sp-note" style={{ fontSize: '12px', marginRight: '4px' }}>
                  Document view:
                </span>
                {outputs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setViewingOutput(o)}
                    className={`sp-btn2 ${viewingOutput.id === o.id ? 'active' : ''}`}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      fontWeight: viewingOutput.id === o.id ? 600 : 400,
                      background: viewingOutput.id === o.id ? 'var(--sp-gold-bg)' : undefined,
                      borderColor: viewingOutput.id === o.id ? 'var(--sp-gold)' : undefined,
                    }}
                  >
                    {OUTPUT_TYPE_LABELS[o.output_type] || o.output_type}
                  </button>
                ))}
              </div>
            )}

            {/* Document Renderer Container */}
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 'calc(94vh - 130px)' }}>
              <OutputDocumentRenderer
                outputType={viewingOutput.output_type}
                rawContent={viewingOutput.content || ''}
                jsonPayload={viewingOutput.json_content}
                projectTitle={project.title}
                meetingDate={project.meeting_date || undefined}
                organisationName={project.client_name || undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedProjectBrightView;
