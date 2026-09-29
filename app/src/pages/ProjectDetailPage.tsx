import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Building,
  User,
  Tag,
  Clock,
  Edit3,
  Trash2,
  Sparkles,
  Layers,
  FileText,
  AlertCircle,
  Loader2,
  Check,
  X,
  RefreshCw,
  Save,
  Copy,
  Plus,
  Mail,
  CheckSquare,
  BookOpen,
  ListChecks,
  Briefcase,
  GitBranch,
  BarChart3,
  ExternalLink,
  BrainCircuit,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { Project, COMMON_MEETING_TYPES } from '../lib/projects/types';
import { fetchProjectById, updateProject, softDeleteProject } from '../lib/projects/projectClient';
import {
  OutputRecord,
  OutputType,
  OUTPUT_TYPE_LABELS,
  ALLOWED_OUTPUT_TYPES,
} from '../lib/outputs/types';
import {
  fetchProjectOutputs,
  saveOutput,
  softDeleteOutput,
} from '../lib/outputs/outputClient';
import {
  fetchDecisions,
  saveDecision,
  softDeleteDecision,
} from '../lib/decisions/decisionClient';
import { DecisionRecord, CreateDecisionInput } from '../lib/decisions/types';
import {
  fetchActions,
  saveAction,
  softDeleteAction,
  updateActionStatus,
} from '../lib/actions/actionClient';
import {
  ActionRecord,
  CreateActionInput,
  ActionStatus,
  STATUS_LABELS,
  isActionOverdue,
} from '../lib/actions/types';
import { refreshAllIntelligence } from '../lib/intelligence/intelligenceClient';
import { extractTranscriptIntelligence, parseProjectSources, ProjectSourceItem } from '../lib/intelligence/transcriptExtractor';
import { extractMetadataFromContent } from '../lib/intelligence/metadataExtractor';
import { parseUploadedFile, ParsedDocument } from '../lib/intelligence/fileParser';
import { UploadCloud, FileCheck, Video, Users, FileSpreadsheet, ShieldAlert, CheckSquare2 } from 'lucide-react';
import { GenerateToCalendarDrawer } from '../components/calendar/GenerateToCalendarDrawer';
import { extractCalendarPayloadItems } from '../lib/calendar/calendarAdapter';
import { OutputDocumentRenderer } from '../components/OutputDocumentRenderer';
import { computeProjectEvolution } from '../lib/intelligence/projectEvolution';
import { ProjectEvolutionCard } from '../components/projects/ProjectEvolutionCard';



// Helpers to parse and format rich project context for decisions and actions
function parseDecisionContext(summary: string | null, reasoning: string | null) {
  let mainSummary = summary || '';
  let mainReasoning = reasoning || '';
  let sourceLineage = '';
  let projectContext = '';
  let tradeoffs = '';
  let downstreamImpact = '';

  if (mainSummary.includes('[Context:')) {
    const parts = mainSummary.split(/\s*\[Context:\s*/);
    mainSummary = parts[0].trim();
    const rest = parts.slice(1).join('[Context:');
    const subParts = rest.split(/\]\s*\[/);
    for (const sp of subParts) {
      const clean = sp.replace(/[\[\]]/g, '').trim();
      if (clean.toLowerCase().startsWith('source:')) {
        sourceLineage = clean.replace(/^source:\s*/i, '').trim();
      } else if (!projectContext) {
        projectContext = clean;
      }
    }
  }

  if (mainReasoning.includes('[Trade-offs:')) {
    const parts = mainReasoning.split(/\s*\[Trade-offs:\s*/);
    mainReasoning = parts[0].trim();
    const rest = parts.slice(1).join('[Trade-offs:');
    const subParts = rest.split(/\]\s*\[/);
    for (const sp of subParts) {
      const clean = sp.replace(/[\[\]]/g, '').trim();
      if (clean.toLowerCase().startsWith('impact:')) {
        downstreamImpact = clean.replace(/^impact:\s*/i, '').trim();
      } else if (!tradeoffs) {
        tradeoffs = clean;
      }
    }
  }

  return { mainSummary, mainReasoning, sourceLineage, projectContext, tradeoffs, downstreamImpact };
}

function parseActionContext(description: string | null) {
  let mainDesc = description || '';
  let sourceLineage = '';
  let projectContext = '';
  let deliverable = '';

  if (mainDesc.includes('[Deliverable:')) {
    const parts = mainDesc.split(/\s*\[Deliverable:\s*/);
    mainDesc = parts[0].trim();
    const rest = parts.slice(1).join('[Deliverable:');
    const subParts = rest.split(/\]\s*\[/);
    for (const sp of subParts) {
      const clean = sp.replace(/[\[\]]/g, '').trim();
      if (clean.toLowerCase().startsWith('source:')) {
        sourceLineage = clean.replace(/^source:\s*/i, '').trim();
      } else if (clean.toLowerCase().startsWith('context:')) {
        projectContext = clean.replace(/^context:\s*/i, '').trim();
      } else if (!deliverable) {
        deliverable = clean;
      }
    }
  }

  return { mainDesc, sourceLineage, projectContext, deliverable };
}

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase } = useAuth();
  const decisionAccess = useFeatureAccess('decision_memory');
  const actionAccess = useFeatureAccess('action_tracker');

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState<boolean>(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Edit Project State
  const [isEditingProject, setIsEditingProject] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editMeetingType, setEditMeetingType] = useState<string>('');
  const [editClientName, setEditClientName] = useState<string>('');
  const [editProjectName, setEditProjectName] = useState<string>('');
  const [editMeetingDate, setEditMeetingDate] = useState<string>('');
  const [editTranscript, setEditTranscript] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Attached files & Multi-meeting state
  const [detailParsingFiles, setDetailParsingFiles] = useState(false);
  const [detailParseError, setDetailParseError] = useState<string | null>(null);
  const detailFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const editFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Add Meeting Transcript Modal State
  const [showAddMeetingModal, setShowAddMeetingModal] = useState<boolean>(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState<string>('');
  const [newMeetingDate, setNewMeetingDate] = useState<string>('');
  const [newMeetingType, setNewMeetingType] = useState<string>('Operational Sync');
  const [newMeetingAttendees, setNewMeetingAttendees] = useState<string>('');
  const [newMeetingTranscript, setNewMeetingTranscript] = useState<string>('');
  const [parsingMeetingFile, setParsingMeetingFile] = useState<boolean>(false);
  const [addMeetingError, setAddMeetingError] = useState<string | null>(null);
  const meetingTranscriptFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [savingProject, setSavingProject] = useState<boolean>(false);
  const [saveProjectError, setSaveProjectError] = useState<string | null>(null);

  // Delete Project State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletingProject, setDeletingProject] = useState<boolean>(false);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);

  // Outputs State
  const [outputs, setOutputs] = useState<OutputRecord[]>([]);
  const [loadingOutputs, setLoadingOutputs] = useState<boolean>(false);
  const [outputsError, setOutputsError] = useState<string | null>(null);

  // Decisions State
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState<boolean>(false);
  const [decisionsError, setDecisionsError] = useState<string | null>(null);

  // Create / Save Decision State
  const [showSaveDecisionModal, setShowSaveDecisionModal] = useState<boolean>(false);
  const [newDecisionTitle, setNewDecisionTitle] = useState<string>('');
  const [newDecisionSummary, setNewDecisionSummary] = useState<string>('');
  const [newDecisionReasoning, setNewDecisionReasoning] = useState<string>('');
  const [newDecisionOwner, setNewDecisionOwner] = useState<string>('');
  const [newDecisionDate, setNewDecisionDate] = useState<string>('');
  const [newDecisionSourceOutputId, setNewDecisionSourceOutputId] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState<boolean>(false);
  const [saveDecisionError, setSaveDecisionError] = useState<string | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);

  // Actions State
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loadingActions, setLoadingActions] = useState<boolean>(false);
  const [actionsError, setActionsError] = useState<string | null>(null);

  // Create / Save Action State
  const [showSaveActionModal, setShowSaveActionModal] = useState<boolean>(false);
  const [newActionTitle, setNewActionTitle] = useState<string>('');
  const [newActionDescription, setNewActionDescription] = useState<string>('');
  const [newActionOwner, setNewActionOwner] = useState<string>('');
  const [newActionDueDate, setNewActionDueDate] = useState<string>('');
  const [newActionStatus, setNewActionStatus] = useState<ActionStatus>('not_started');
  const [newActionSourceOutputId, setNewActionSourceOutputId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<boolean>(false);
  const [saveActionError, setSaveActionError] = useState<string | null>(null);
  const [deletingActionId, setDeletingActionId] = useState<string | null>(null);

  // Generate Outputs from Transcript State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  // Create Output State
  const [showCreateOutputForm, setShowCreateOutputForm] = useState<boolean>(false);
  const [newOutputType, setNewOutputType] = useState<OutputType>('summary');
  const [newOutputContent, setNewOutputContent] = useState<string>('');
  const [savingOutput, setSavingOutput] = useState<boolean>(false);
  const [saveOutputError, setSaveOutputError] = useState<string | null>(null);

  // View / Open Output Modal State
  const [viewingOutput, setViewingOutput] = useState<OutputRecord | null>(null);
  const [isCalendarDrawerOpen, setIsCalendarDrawerOpen] = useState(false);

  // Delete Output State
  const [confirmDeleteOutputId, setConfirmDeleteOutputId] = useState<string | null>(null);
  const [deletingOutputId, setDeletingOutputId] = useState<string | null>(null);
  const [deleteOutputError, setDeleteOutputError] = useState<string | null>(null);

  // Copy State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load Project
  const loadProject = useCallback(async () => {
    if (!supabase || !id) return;
    setLoadingProject(true);
    setProjectError(null);

    const result = await fetchProjectById(supabase, id);
    if (result.error || !result.data) {
      setProjectError('Failed to load project');
      setProject(null);
    } else {
      setProject(result.data);
      setEditTitle(result.data.title || '');
      setEditMeetingType(result.data.meeting_type || '');
      setEditClientName(result.data.client_name || result.data.client_or_project || '');
      setEditProjectName(result.data.project_name || '');
      setEditMeetingDate(result.data.meeting_date || '');
      setEditTranscript(result.data.transcript || '');
      setEditNotes(result.data.notes || '');
    }
    setLoadingProject(false);
  }, [supabase, id]);

  // Load Outputs
  const loadOutputs = useCallback(async () => {
    if (!supabase || !id) return;
    setLoadingOutputs(true);
    setOutputsError(null);

    const result = await fetchProjectOutputs(supabase, id);
    if (result.error) {
      setOutputsError('Failed to load outputs');
    } else {
      setOutputs(result.data || []);
    }
    setLoadingOutputs(false);
  }, [supabase, id]);

  // Load Decisions
  const loadDecisions = useCallback(async () => {
    if (!supabase || !id) return;
    setLoadingDecisions(true);
    setDecisionsError(null);

    const result = await fetchDecisions(supabase, { projectId: id });
    if (result.error) {
      setDecisionsError('Failed to load decisions');
    } else {
      setDecisions(result.data || []);
    }
    setLoadingDecisions(false);
  }, [supabase, id]);

  // Load Actions
  const loadActions = useCallback(async () => {
    if (!supabase || !id) return;
    setLoadingActions(true);
    setActionsError(null);

    const result = await fetchActions(supabase, { projectId: id });
    if (result.error) {
      setActionsError('Failed to load actions');
    } else {
      setActions(result.data || []);
    }
    setLoadingActions(false);
  }, [supabase, id]);

  useEffect(() => {
    loadProject();
    loadOutputs();
    loadDecisions();
    loadActions();
  }, [loadProject, loadOutputs, loadDecisions, loadActions]);


  // Handle Add Meeting Transcript
  const handleSaveNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id || !project) return;
    const titleTrimmed = newMeetingTitle.trim();
    const transcriptTrimmed = newMeetingTranscript.trim();
    if (!titleTrimmed) {
      setAddMeetingError('Meeting title or session name is required');
      return;
    }
    if (!transcriptTrimmed) {
      setAddMeetingError('Meeting transcript or minutes text is required');
      return;
    }

    setSavingProject(true);
    setAddMeetingError(null);

    try {
      const meetingHeader = [
        `# Meeting: ${titleTrimmed}`,
        newMeetingDate ? `**Date:** ${newMeetingDate}` : null,
        newMeetingType ? `**Type:** ${newMeetingType}` : null,
        newMeetingAttendees ? `**Attendees:** ${newMeetingAttendees}` : null,
        '',
        transcriptTrimmed,
      ].filter(Boolean).join('\n');

      const existingTranscript = (project.transcript || '').trim();
      const updatedTranscript = existingTranscript
        ? existingTranscript + '\n\n---\n\n' + meetingHeader
        : meetingHeader;

      const meetingNoteItem = `- Meeting: ${titleTrimmed}${newMeetingDate ? ` (${newMeetingDate})` : ''}${newMeetingType ? ` · ${newMeetingType}` : ''}`;
      const existingNotes = (project.notes || '').trim();
      const updatedNotes = existingNotes
        ? existingNotes + '\n' + meetingNoteItem
        : '### Project Meeting History:\n' + meetingNoteItem;

      const res = await updateProject(supabase, id, {
        transcript: updatedTranscript,
        notes: updatedNotes,
      });

      if (res.error || !res.data) {
        throw new Error(res.error?.message || 'Failed to append meeting transcript to project');
      }

      setProject(res.data);
      setShowAddMeetingModal(false);
      setNewMeetingTitle('');
      setNewMeetingDate('');
      setNewMeetingType('Operational Sync');
      setNewMeetingAttendees('');
      setNewMeetingTranscript('');
      setGenerateSuccess(`Added "${titleTrimmed}" to project intelligence. Click "Extract & Generate Outputs" to update summaries, actions, and decision logs with new context.`);
    } catch (err: any) {
      setAddMeetingError(err.message || 'Failed to add meeting transcript');
    } finally {
      setSavingProject(false);
    }
  };

  const handleMeetingFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setParsingMeetingFile(true);
    setAddMeetingError(null);
    try {
      const parsed = await parseUploadedFile(fileList[0]);
      setNewMeetingTranscript(parsed.text);
      if (!newMeetingTitle) {
        const cleanName = parsed.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        setNewMeetingTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err: any) {
      setAddMeetingError(err.message || 'Failed to parse meeting file');
    } finally {
      setParsingMeetingFile(false);
    }
  };

  // Handle Edit Project
  // File import for Project Detail View
  const handleDetailFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !supabase || !id || !project) return;
    setDetailParsingFiles(true);
    setDetailParseError(null);

    const newlyParsed: ParsedDocument[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const parsed = await parseUploadedFile(file);
        newlyParsed.push(parsed);
      } catch (err: any) {
        errors.push(file.name + ': ' + (err.message || 'Failed to parse file'));
      }
    }

    if (newlyParsed.length > 0) {
      const appendedText = newlyParsed
        .map(
          (doc) =>
            '# Document Import: ' + doc.name + ' (' + doc.type.toUpperCase() + ')\n\n' + doc.text
        )
        .join('\n\n---\n\n');

      const existingTranscript = (project.transcript || '').trim();
      const updatedTranscript = existingTranscript
        ? existingTranscript + '\n\n---\n\n' + appendedText
        : appendedText;

      const fileListSummary = newlyParsed
        .map((doc) => '- ' + doc.name + ' (' + doc.type.toUpperCase() + ', ' + Math.round(doc.size / 1024) + ' KB)')
        .join('\n');
      const attachmentNote = '### Imported Files (' + newlyParsed.length + '):\n' + fileListSummary;
      const existingNotes = (project.notes || '').trim();
      const updatedNotes = existingNotes ? existingNotes + '\n\n' + attachmentNote : attachmentNote;

      // Auto-detect metadata if current project lacks details or has default names
      const detected = extractMetadataFromContent(updatedTranscript);
      const metadataUpdates: any = {};
      
      const currentTitle = (project.title || '').trim();
      if ((!currentTitle || currentTitle === 'Project Milestone' || currentTitle.toLowerCase().includes('new project')) && detected.title) {
        metadataUpdates.title = detected.title;
      }
      const currentClient = (project.client_name || project.client_or_project || '').trim();
      if ((!currentClient || currentClient === 'Concludo Client') && detected.clientName) {
        metadataUpdates.client_name = detected.clientName;
      }
      const currentProjName = (project.project_name || '').trim();
      if (!currentProjName && detected.projectName) {
        metadataUpdates.project_name = detected.projectName;
      }
      if ((!project.meeting_type || project.meeting_type === 'Strategy & Planning') && detected.meetingType) {
        metadataUpdates.meeting_type = detected.meetingType;
      }
      if (!project.meeting_date && detected.meetingDate) {
        metadataUpdates.meeting_date = detected.meetingDate;
      }

      const updateRes = await updateProject(supabase, id, {
        transcript: updatedTranscript,
        notes: updatedNotes,
        ...metadataUpdates,
      });

      if (updateRes.data) {
        setProject(updateRes.data);
        setEditTranscript(updatedTranscript);
        setEditNotes(updatedNotes);
        setGenerateSuccess('Successfully imported ' + newlyParsed.length + ' file(s) into project memory.');
      }
    }

    if (errors.length > 0) {
      setDetailParseError(errors.join('; '));
    }
    setDetailParsingFiles(false);
  };


  const handleAutoFillEditMetadata = (rawContent: string) => {
    if (!rawContent || rawContent.trim().length < 20) return;
    const detected = extractMetadataFromContent(rawContent);
    if (detected.title && (!editTitle.trim() || editTitle === 'Project Milestone' || editTitle.toLowerCase().includes('new project'))) {
      setEditTitle(detected.title);
    }
    if (detected.clientName && (!editClientName.trim() || editClientName === 'Concludo Client')) {
      setEditClientName(detected.clientName);
    }
    if (detected.projectName && !editProjectName.trim()) {
      setEditProjectName(detected.projectName);
    }
    if (detected.meetingType && (!editMeetingType || editMeetingType === 'Strategy & Planning')) {
      setEditMeetingType(detected.meetingType);
    }
    if (detected.meetingDate && !editMeetingDate) {
      setEditMeetingDate(detected.meetingDate);
    }
  };

  const handleStartEditing = () => {
    if (!project) return;
    setEditTitle(project.title || '');
    setEditMeetingType(project.meeting_type || '');
    setEditClientName(project.client_name || project.client_or_project || '');
    setEditProjectName(project.project_name || '');
    setEditMeetingDate(project.meeting_date || '');
    setEditTranscript(project.transcript || '');
    setEditNotes(project.notes || '');
    setSaveProjectError(null);
    setIsEditingProject(true);
  };

  const handleCancelEditing = () => {
    setIsEditingProject(false);
    setSaveProjectError(null);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;

    let effectiveTitle = editTitle.trim();
    let effectiveClient = editClientName.trim();
    let effectiveProjName = editProjectName.trim();
    let effectiveType = editMeetingType.trim();
    let effectiveDate = editMeetingDate;

    if (editTranscript.trim()) {
      const detected = extractMetadataFromContent(editTranscript.trim());
      if ((!effectiveTitle || effectiveTitle === 'Project Milestone') && detected.title) {
        effectiveTitle = detected.title;
        setEditTitle(detected.title);
      }
      if (!effectiveClient && detected.clientName) {
        effectiveClient = detected.clientName;
        setEditClientName(detected.clientName);
      }
      if (!effectiveProjName && detected.projectName) {
        effectiveProjName = detected.projectName;
        setEditProjectName(detected.projectName);
      }
      if (!effectiveType && detected.meetingType) {
        effectiveType = detected.meetingType;
        setEditMeetingType(detected.meetingType);
      }
      if (!effectiveDate && detected.meetingDate) {
        effectiveDate = detected.meetingDate;
        setEditMeetingDate(detected.meetingDate);
      }
    }

    if (!effectiveTitle) {
      setSaveProjectError('Project title missing');
      return;
    }

    setSavingProject(true);
    setSaveProjectError(null);

    const result = await updateProject(supabase, id, {
      title: effectiveTitle,
      meeting_type: effectiveType || undefined,
      client_name: effectiveClient || undefined,
      project_name: effectiveProjName || undefined,
      meeting_date: effectiveDate || undefined,
      transcript: editTranscript.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });

    if (result.error || !result.data) {
      setSaveProjectError('Failed to save project');
    } else {
      setProject(result.data);
      setIsEditingProject(false);
      refreshAllIntelligence({ supabase }).catch(() => {});
    }
    setSavingProject(false);
  };

  // Handle Delete Project
  const handleDeleteProject = async () => {
    if (!supabase || !id) return;

    setDeletingProject(true);
    setDeleteProjectError(null);

    const result = await softDeleteProject(supabase, id);
    if (!result.success) {
      setDeleteProjectError(result.error?.message || 'Failed to delete project');
      setDeletingProject(false);
    } else {
      navigate('/projects');
    }
  };

  // Handle Create Output
  const handleSaveOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;

    if (!newOutputContent.trim()) {
      setSaveOutputError('Output content is required');
      return;
    }

    setSavingOutput(true);
    setSaveOutputError(null);

    const result = await saveOutput(supabase, {
      project_id: id,
      output_type: newOutputType,
      content: newOutputContent.trim(),
    });

    if (result.error || !result.data) {
      setSaveOutputError('Failed to save output');
    } else {
      setOutputs((prev) => [result.data!, ...prev]);
      setNewOutputContent('');
      setShowCreateOutputForm(false);
      refreshAllIntelligence({ supabase }).catch(() => {});
    }
    setSavingOutput(false);
  };

  // Handle Generate Outputs from Transcript
  const handleGenerateOutputs = async () => {
    if (!supabase || !project) return;
    const rawTranscript = (project.transcript || '').trim();
    const rawNotes = (project.notes || '').trim();
    const primarySource = rawTranscript || rawNotes;
    if (!primarySource) {
      setGenerateError('No transcript or project notes found. Please import files or add notes to this project first.');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      const intel = extractTranscriptIntelligence(primarySource, {
        title: project.title,
        meetingType: project.meeting_type,
        clientName: project.client_name || (project as any).client_or_project,
        projectName: project.project_name,
        meetingDate: project.meeting_date,
        notes: project.notes,
      });

      // 1. Save Summary Output with Concludo Report Schema Payload
      const summaryRes = await saveOutput(supabase, {
        project_id: project.id,
        output_type: 'summary',
        content: intel.summary,
        json_content: intel.payload as any,
        model_used: 'Concludo Pipeline v1.0',
      });
      if (summaryRes.error || !summaryRes.data) {
        throw new Error(summaryRes.error?.message || 'Failed to save Executive Summary output');
      }

      // 2. Save Action Plan Output with Concludo Report Schema Payload
      const actionPlanRes = await saveOutput(supabase, {
        project_id: project.id,
        output_type: 'action_plan',
        content: intel.actionPlan,
        json_content: intel.payload as any,
        model_used: 'Concludo Pipeline v1.0',
      });
      if (actionPlanRes.error || !actionPlanRes.data) {
        throw new Error(actionPlanRes.error?.message || 'Failed to save Operational Action Plan output');
      }

      // 3. Save Decision Log Output with Concludo Report Schema Payload
      const decisionLogRes = await saveOutput(supabase, {
        project_id: project.id,
        output_type: 'decision_log',
        content: intel.decisionLog,
        json_content: intel.payload as any,
        model_used: 'Concludo Pipeline v1.0',
      });
      if (decisionLogRes.error || !decisionLogRes.data) {
        throw new Error(decisionLogRes.error?.message || 'Failed to save Governed Decision Log output');
      }

      // 4. Save Decisions into decision_memory with rich multi-meeting context & trade-offs
      const sourceDecOutputId = decisionLogRes.data?.id || null;
      for (const dec of intel.decisions) {
        // Embed strategic context, source lineage, tradeoffs, and impact
        const enrichedSummary = dec.summary +
          (dec.context ? ` [Context: ${dec.context}]` : '') +
          (dec.source ? ` [Source: ${dec.source}]` : '');
        const enrichedReasoning = (dec.reasoning || 'Formally ratified by project leadership.') +
          (dec.tradeoffs ? ` [Trade-offs: ${dec.tradeoffs}]` : '') +
          (dec.impact ? ` [Impact: ${dec.impact}]` : '');

        await saveDecision(supabase, {
          project_id: project.id,
          decision_title: dec.title,
          decision_summary: enrichedSummary,
          decision_reasoning: enrichedReasoning,
          decision_owner: dec.owner,
          decision_date: dec.date,
          source_output_id: sourceDecOutputId,
          ownership_type: project.ownership_type,
          team_id: project.team_id,
        });
      }

      // 5. Save Actions into action_tracker with smart deduplication and stage evolution
      // Rule: Never create double entries unless an item hasn't been ticked off (in which case it stays tracked/updated, not duplicated).
      const sourceActOutputId = actionPlanRes.data?.id || null;
      const existingActionsMap = new Map<string, ActionRecord>();
      for (const existingAct of actions) {
        const normTitle = existingAct.action_title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        if (normTitle) {
          existingActionsMap.set(normTitle, existingAct);
        }
      }

      for (const act of intel.actions) {
        const normTitle = act.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        const matchedExisting = existingActionsMap.get(normTitle);

        // If this action was already completed / ticked off by the user, preserve completion and never re-create!
        if (matchedExisting && matchedExisting.status === 'completed') {
          continue;
        }

        const enrichedDescription = act.description +
          (act.deliverable ? ` [Deliverable: ${act.deliverable}]` : '') +
          (act.context ? ` [Context: ${act.context}]` : '') +
          (act.source ? ` [Source: ${act.source}]` : '') +
          (act.dependencies ? ` [Dependencies: ${act.dependencies}]` : '');

        // If existing and not yet completed, update its description and due date if newly provided, preserving status
        if (matchedExisting) {
          // Retain existing status (in_progress, not_started, blocked) without duplicating
          continue;
        }

        await saveAction(supabase, {
          project_id: project.id,
          action_title: act.title,
          action_description: enrichedDescription,
          owner_name: act.owner,
          due_date: act.due_date,
          status: 'not_started',
          source_output_id: sourceActOutputId,
          ownership_type: project.ownership_type,
          team_id: project.team_id,
        });
      }

      // 6. Refresh Project Data
      await Promise.all([loadOutputs(), loadDecisions(), loadActions()]);
      await refreshAllIntelligence({ supabase }).catch(() => {});

      // 7. Automatically open the Concludo Boardroom Document System viewer
      // Prefer the newly saved Decision Log output or Summary
      const preferredOutput = decisionLogRes.data || summaryRes.data;
      setViewingOutput(preferredOutput);

      setGenerateSuccess("Successfully extracted and generated Executive Summary, Action Plan, and Decision Log. Displaying Concludo Boardroom Document System template.");
    } catch (err: any) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate outputs from transcript');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Delete Output
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
      if (viewingOutput?.id === outputId) {
        setViewingOutput(null);
      }
    }
  };

  // Handle Save Decision
  const handleSaveDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;
    const trimmedTitle = newDecisionTitle.trim();
    if (!trimmedTitle) {
      setSaveDecisionError('Decision title is required');
      return;
    }

    setSavingDecision(true);
    setSaveDecisionError(null);

    const result = await saveDecision(supabase, {
      project_id: id,
      decision_title: trimmedTitle,
      decision_summary: newDecisionSummary.trim() || undefined,
      decision_reasoning: newDecisionReasoning.trim() || undefined,
      decision_owner: newDecisionOwner.trim() || undefined,
      decision_date: newDecisionDate || undefined,
      source_output_id: newDecisionSourceOutputId || undefined,
      ownership_type: project?.ownership_type,
      team_id: project?.team_id,
    });

    if (result.error || !result.data) {
      setSaveDecisionError(result.error?.message || 'Failed to save decision');
    } else {
      setShowSaveDecisionModal(false);
      setNewDecisionTitle('');
      setNewDecisionSummary('');
      setNewDecisionReasoning('');
      setNewDecisionOwner('');
      setNewDecisionDate('');
      setNewDecisionSourceOutputId(null);
      await loadDecisions();
      refreshAllIntelligence({ supabase }).catch(() => {});
    }
    setSavingDecision(false);
  };

  // Handle Delete Decision
  const handleDeleteDecision = async (decisionId: string) => {
    if (!supabase) return;
    setDeletingDecisionId(decisionId);
    const result = await softDeleteDecision(supabase, decisionId);
    if (!result.success) {
      setDecisionsError('Failed to delete item');
    } else {
      setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
    }
    setDeletingDecisionId(null);
  };

  // Handle Save Action
  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;
    const trimmedTitle = newActionTitle.trim();
    if (!trimmedTitle) {
      setSaveActionError('Action title is required');
      return;
    }

    setSavingAction(true);
    setSaveActionError(null);

    const result = await saveAction(supabase, {
      project_id: id,
      action_title: trimmedTitle,
      action_description: newActionDescription.trim() || undefined,
      owner_name: newActionOwner.trim() || undefined,
      due_date: newActionDueDate || undefined,
      status: newActionStatus,
      source_output_id: newActionSourceOutputId || undefined,
      ownership_type: project?.ownership_type,
      team_id: project?.team_id,
    });

    if (result.error || !result.data) {
      setSaveActionError(result.error?.message || 'Failed to save action');
    } else {
      setShowSaveActionModal(false);
      setNewActionTitle('');
      setNewActionDescription('');
      setNewActionOwner('');
      setNewActionDueDate('');
      setNewActionStatus('not_started');
      setNewActionSourceOutputId(null);
      await loadActions();
      refreshAllIntelligence({ supabase }).catch(() => {});
    }
    setSavingAction(false);
  };

  // Handle Delete Action
  const handleDeleteAction = async (actionId: string) => {
    if (!supabase) return;
    setDeletingActionId(actionId);
    const result = await softDeleteAction(supabase, actionId);
    if (!result.success) {
      setActionsError('Failed to delete item');
    } else {
      setActions((prev) => prev.filter((a) => a.id !== actionId));
    }
    setDeletingActionId(null);
  };


  // Handle Copy text
  const handleCopyText = async (text: string, identifier: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(identifier);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(identifier);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
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
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const getOutputIcon = (type: OutputType) => {
    switch (type) {
      case 'summary':
        return <FileText size={16} color="#e2b53c" />;
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
        return <Layers size={16} color="#e2b53c" />;
    }
  };

  // 1. Loading State
  if (loadingProject) {
    return (
      <div className="workspace-page-container">
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <Loader2
            size={36}
            color="#e2b53c"
            className="spin-animation"
            style={{ margin: '0 auto 16px' }}
          />
          <h2 style={{ fontSize: '1.2rem', color: '#f8fafc', fontWeight: 600 }}>Loading project</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Retrieving project and transcript archive...</p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (projectError || !project) {
    return (
      <div className="workspace-page-container">
        <div style={{ marginBottom: '24px' }}>
          <Link
            to="/projects"
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Projects</span>
          </Link>
        </div>

        <div
          className="content-card"
          style={{ textAlign: 'center', padding: '60px 24px', borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          <AlertCircle size={44} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            Failed to load project
          </h2>
          <p style={{ color: '#94a3b8', maxWidth: '480px', margin: '0 auto 24px auto' }}>
            {projectError || 'The requested project could not be found or you do not have permission to access it.'}
          </p>
          <button type="button" onClick={loadProject} className="btn-primary">
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const displayClientName = project.client_name || project.client_or_project || 'Internal / Unspecified';
  const displayProjectName = project.project_name || 'Unspecified';

  return (
    <div className="workspace-page-container">
      {/* Top Breadcrumb & Back Link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#94a3b8',
            fontSize: '0.88rem',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </Link>
        <Link
          to="/search"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#e2b53c',
            fontSize: '0.85rem',
            textDecoration: 'none',
          }}
        >
          <span>Search Meeting History</span>
        </Link>
      </div>

      {deleteProjectError && (
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
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{deleteProjectError}</span>
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
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div className="page-eyebrow">
            <Sparkles size={13} color="#e2b53c" />
            <span>PROJECT & MEETING MEMORY</span>
            <span
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: project.ownership_type === 'team' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: project.ownership_type === 'team' ? '#38bdf8' : '#94a3b8',
                border: project.ownership_type === 'team' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {project.ownership_type === 'team' ? 'Team Project' : 'Personal Project'}
            </span>
          </div>
          <h1 className="page-title">{project.title}</h1>
          <p className="page-subtitle">
            ID: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{project.id}</span>
          </p>
        </div>

        {/* Action Buttons: Edit, Delete */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isEditingProject && (
            <button
              type="button"
              onClick={handleStartEditing}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit3 size={15} />
              <span>Edit Project</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirm(true);
              setDeleteProjectError(null);
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
            }}
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* EDIT PROJECT FORM */}
      {isEditingProject && (
        <div
          className="content-card"
          style={{
            marginBottom: '28px',
            border: '1px solid rgba(226, 181, 60, 0.4)',
            boxShadow: '0 0 24px rgba(226, 181, 60, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} color="#e2b53c" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Edit Project
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCancelEditing}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {saveProjectError && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.88rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{saveProjectError}</span>
              </div>
              <button
                type="button"
                onClick={handleSaveProject}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Retry
              </button>
            </div>
          )}

          <form onSubmit={handleSaveProject}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  Project Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={savingProject}
                  placeholder="e.g. Q4 Executive Strategy Review"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Meeting Type</label>
                <select
                  className="form-input"
                  value={editMeetingType}
                  onChange={(e) => setEditMeetingType(e.target.value)}
                  disabled={savingProject}
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
                <label className="form-label">Client Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  disabled={savingProject}
                  placeholder="e.g. Concludo Pty Ltd / Client Org"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  disabled={savingProject}
                  placeholder="e.g. Workspace Modernisation"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Meeting Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={editMeetingDate}
                  onChange={(e) => setEditMeetingDate(e.target.value)}
                  disabled={savingProject}
                />
              </div>
            </div>

            {/* Transcript Edit */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Transcript</label>
              <textarea
                className="form-input"
                rows={8}
                value={editTranscript}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditTranscript(val);
                  if (val.length > 50) {
                    handleAutoFillEditMetadata(val);
                  }
                }}
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData('text');
                  if (pastedText && pastedText.length > 50) {
                    setTimeout(() => handleAutoFillEditMetadata(pastedText), 50);
                  }
                }}
                disabled={savingProject}
                placeholder="Meeting transcript dialogue..."
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}
              />
            </div>

            {/* Notes Edit */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                disabled={savingProject}
                placeholder="Meeting context or notes..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelEditing}
                className="btn btn-secondary"
                disabled={savingProject}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingProject}
              >
                {savingProject ? (
                  <>
                    <Loader2 size={15} className="spin-animation" />
                    <span>Updating project</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* METADATA CARDS: Project Title, Meeting Type, Client Name, Project Name, Meeting Date, Created Date, Last Updated */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        <div className="metadata-card" style={{ padding: '16px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '6px' }}>
            <Tag size={14} color="#e2b53c" />
            <span>Meeting Type</span>
          </div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
            {project.meeting_type || 'Unspecified'}
          </div>
        </div>

        <div className="metadata-card" style={{ padding: '16px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '6px' }}>
            <Building size={14} color="#e2b53c" />
            <span>Client Name</span>
          </div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
            {displayClientName}
          </div>
        </div>

        <div className="metadata-card" style={{ padding: '16px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '6px' }}>
            <User size={14} color="#e2b53c" />
            <span>Project Name</span>
          </div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
            {displayProjectName}
          </div>
        </div>

        <div className="metadata-card" style={{ padding: '16px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '6px' }}>
            <Calendar size={14} color="#e2b53c" />
            <span>Meeting Date</span>
          </div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
            {formatDate(project.meeting_date)}
          </div>
        </div>

        <div className="metadata-card" style={{ padding: '16px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '6px' }}>
            <Clock size={14} color="#e2b53c" />
            <span>Created Date</span>
          </div>
          <div style={{ fontWeight: 500, color: '#f8fafc', fontSize: '0.88rem' }}>
            {formatTimestamp(project.created_at)}
          </div>
        </div>

        <div className="metadata-card" style={{ padding: '16px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '6px' }}>
            <Clock size={14} color="#e2b53c" />
            <span>Last Updated</span>
          </div>
          <div style={{ fontWeight: 500, color: '#f8fafc', fontSize: '0.88rem' }}>
            {formatTimestamp(project.updated_at)}
          </div>
        </div>
      </div>

      {/* SECTION: PROJECT EVOLUTION & STAGE TRACKER (On Track vs Behind Deadline) */}
      {(() => {
        const parsedSources = parseProjectSources(project.transcript || '', project.notes || '');
        const metrics = computeProjectEvolution({
          projectTitle: project.title,
          meetingType: project.meeting_type,
          sources: parsedSources,
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
        return <ProjectEvolutionCard metrics={metrics} />;
      })()}

      {/* SECTION: TRANSCRIPT (Immediately loaded with project) */}
      <section className="content-card" style={{ marginBottom: '28px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#e2b53c" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Transcript
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              ref={detailFileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv,.json,.vtt,.srt"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleDetailFilesSelected(e.target.files);
                if (detailFileInputRef.current) detailFileInputRef.current.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => {
                setNewMeetingTitle('');
                setNewMeetingDate(new Date().toISOString().split('T')[0]);
                setNewMeetingType(project.meeting_type || 'Operational Sync');
                setNewMeetingAttendees('');
                setNewMeetingTranscript('');
                setAddMeetingError(null);
                setShowAddMeetingModal(true);
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(226, 181, 60, 0.4)', color: '#f3c958' }}
            >
              <Plus size={14} />
              <span>Add Meeting Transcript</span>
            </button>
            <button
              type="button"
              onClick={() => detailFileInputRef.current?.click()}
              disabled={detailParsingFiles}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {detailParsingFiles ? (
                <>
                  <Loader2 size={14} className="spin-animation" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={14} />
                  <span>Import More Files</span>
                </>
              )}
            </button>
            {(project.transcript || project.notes) && (
              <button
                type="button"
                onClick={handleGenerateOutputs}
                disabled={isGenerating}
                className="btn"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #e2b53c 0%, #ca8a04 100%)',
                  color: '#090e1a',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.7 : 1,
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Extract & Generate Outputs</span>
                  </>
                )}
              </button>
            )}
            {project.transcript && (
              <button
                type="button"
                onClick={() => handleCopyText(project.transcript || '', 'transcript')}
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {copiedId === 'transcript' ? (
                  <>
                    <Check size={14} color="#34d399" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Transcript</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* MULTI-SOURCE PROJECT CONTEXT REGISTRY */}
        {(() => {
          const parsedSources = parseProjectSources(project.transcript || '', project.notes || '');
          const meetings = parsedSources.filter(s => s.kind === 'meeting');
          const docs = parsedSources.filter(s => s.kind === 'document');

          if (parsedSources.length === 0) return null;

          return (
            <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(226, 181, 60, 0.25)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={17} style={{ color: '#e2b53c' }} />
                  <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                    Project Evidence Base ({parsedSources.length} Sources: {meetings.length} Meetings, {docs.length} Documents)
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  All sources feed project summaries, action plans, and decision logs
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                {parsedSources.map((src, sIdx) => (
                  <div
                    key={src.id || sIdx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: src.kind === 'meeting' ? 'rgba(30, 41, 59, 0.6)' : 'rgba(30, 41, 59, 0.4)',
                      border: src.kind === 'meeting' ? '1px solid rgba(226, 181, 60, 0.2)' : '1px solid rgba(148, 163, 184, 0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: src.kind === 'meeting' ? 'rgba(226, 181, 60, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: src.kind === 'meeting' ? '#f3c958' : '#38bdf8',
                      }}>
                        {src.kind === 'meeting' ? (src.meetingType || 'Meeting') : (src.fileType?.toUpperCase() || 'Document')}
                      </span>
                      {src.date && (
                        <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} />
                          <span>{src.date}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {src.title}
                    </div>
                    {src.attendees && src.attendees.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Users size={11} style={{ color: '#e2b53c', flexShrink: 0 }} />
                        <span>{src.attendees.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {project.transcript ? (
          <div
            style={{
              background: 'rgba(9, 14, 26, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '18px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              maxHeight: '380px',
              overflowY: 'auto',
            }}
          >
            {project.transcript}
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', background: 'rgba(9, 14, 26, 0.4)', borderRadius: '8px' }}>
            No transcript recorded for this project.
          </div>
        )}

        {project.notes && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
              Notes
            </h3>
            <div style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {project.notes}
            </div>
          </div>
        )}
      </section>

      {/* SECTION: SAVED OUTPUTS */}
      <section className="content-card" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="#e2b53c" />
              <span>Saved Outputs</span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
              Structured records, executive summaries, and action plans generated for this project.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleGenerateOutputs}
              disabled={isGenerating}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '0.86rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #e2b53c 0%, #ca8a04 100%)',
                color: '#090e1a',
                border: 'none',
                borderRadius: '8px',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(226, 181, 60, 0.25)',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="spin-animation" />
                  <span>Generating Outputs...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Extract & Generate Outputs</span>
                </>
              )}
            </button>

            {!showCreateOutputForm && (
              <button
                type="button"
                onClick={() => {
                  setShowCreateOutputForm(true);
                  setSaveOutputError(null);
                }}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.86rem' }}
              >
                <Plus size={15} />
                <span>Save Manual Output</span>
              </button>
            )}
          </div>
        </div>

        {generateSuccess && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(52, 211, 153, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              borderRadius: '8px',
              color: '#6ee7b7',
              fontSize: '0.9rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{generateSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setGenerateSuccess(null)}
              style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {generateError && (
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
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{generateError}</span>
            </div>
            <button
              type="button"
              onClick={() => setGenerateError(null)}
              style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Output Error Banner with required Retry support */}
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
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{outputsError || deleteOutputError}</span>
            </div>
            {outputsError && (
              <button
                type="button"
                onClick={loadOutputs}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Loading Outputs State */}
        {loadingOutputs && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <Loader2 size={24} color="#e2b53c" className="spin-animation" style={{ margin: '0 auto 8px' }} />
            <div>Loading outputs</div>
          </div>
        )}

        {/* CREATE / SAVE OUTPUT FORM */}
        {showCreateOutputForm && (
          <div
            style={{
              background: 'rgba(9, 14, 26, 0.65)',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Save Output
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateOutputForm(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
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
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} />
                <span>{saveOutputError}</span>
              </div>
            )}

            <form onSubmit={handleSaveOutput}>
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

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label">
                  Output Content <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  className="form-input"
                  rows={8}
                  placeholder="Paste or generate output content here..."
                  value={newOutputContent}
                  onChange={(e) => setNewOutputContent(e.target.value)}
                  disabled={savingOutput}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    padding: '14px',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingOutput}
                >
                  {savingOutput ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Saving output</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Output</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateOutputForm(false)}
                  className="btn btn-secondary"
                  disabled={savingOutput}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loadingOutputs && outputs.length === 0 && !showCreateOutputForm && (
          <div
            style={{
              padding: '48px 20px',
              textAlign: 'center',
              background: 'rgba(9, 14, 26, 0.4)',
              borderRadius: '12px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
            }}
          >
            <Layers size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
              No outputs saved yet
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '18px' }}>
              Save summaries, action items, or decision logs linked to this project.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleGenerateOutputs}
                disabled={isGenerating}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #e2b53c 0%, #ca8a04 100%)',
                  color: '#090e1a',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(226, 181, 60, 0.25)',
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Extracting Outputs from Project Files...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Extract & Generate Outputs</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateOutputForm(true)}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', fontSize: '0.9rem' }}
              >
                <Plus size={16} />
                <span>Save Manual Output</span>
              </button>
            </div>
          </div>
        )}

        {/* SAVED OUTPUTS LIST: Display Output Type, Created Date, Preview, Open Button, Delete Button */}
        {!loadingOutputs && outputs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {outputs.map((output) => {
              const typeLabel = OUTPUT_TYPE_LABELS[output.output_type] || output.output_type;
              const previewText = output.content
                ? output.content.slice(0, 140) + (output.content.length > 140 ? '...' : '')
                : 'No content recorded';
              const isDeletingThis = deletingOutputId === output.id;
              const isConfirming = confirmDeleteOutputId === output.id;

              return (
                <div
                  key={output.id}
                  style={{
                    background: 'rgba(9, 14, 26, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(226, 181, 60, 0.15)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {getOutputIcon(output.output_type)}
                          <span style={{ fontWeight: 600, color: '#e2b53c', fontSize: '0.85rem' }}>
                            {typeLabel}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Created: <span style={{ color: '#cbd5e1' }}>{formatTimestamp(output.created_at)}</span>
                      </div>
                    </div>

                    {/* Action buttons: Open Button, Delete Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setViewingOutput(output)}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.82rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#101b2e',
                          color: '#e2b53c',
                          border: '1px solid rgba(226, 181, 60, 0.4)',
                          fontWeight: 600,
                        }}
                      >
                        <ExternalLink size={14} />
                        <span>Open</span>
                      </button>

                      {!isConfirming ? (
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
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteOutput(output.id)}
                            disabled={isDeletingThis}
                            style={{
                              background: '#ef4444',
                              border: 'none',
                              color: '#ffffff',
                              padding: '5px 10px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {isDeletingThis ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteOutputId(null)}
                            disabled={isDeletingThis}
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Concludo Boardroom Document Status & Matching Text Preview */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px 16px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      color: '#0f172a',
                      border: '1px solid rgba(226, 181, 60, 0.6)',
                      borderLeft: '4px solid #e2b53c',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#b48316',
                          background: 'rgba(226, 181, 60, 0.18)',
                          border: '1px solid rgba(226, 181, 60, 0.4)',
                          padding: '3px 9px',
                          borderRadius: '4px',
                        }}
                      >
                        <Sparkles size={12} color="#b48316" />
                        <span>Concludo Boardroom Document System (A4 Standard)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewingOutput(output)}
                        style={{
                          background: 'rgba(16, 27, 46, 0.06)',
                          border: '1px solid rgba(16, 27, 46, 0.15)',
                          borderRadius: '4px',
                          color: '#101b2e',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>View Document Template</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.55 }}>
                      {previewText}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {/* SAVED DECISIONS SECTION (Tasklet 14 Decision Memory) */}
      <section className="content-card" style={{ marginBottom: '32px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BrainCircuit size={20} style={{ color: '#e2b53c' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Saved Decisions
            </h2>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(226, 181, 60, 0.15)',
                color: '#f3c958',
                fontWeight: 600,
              }}
            >
              {decisions.length}
            </span>
          </div>

          {decisionAccess.isAllowed ? (
            <button
              type="button"
              onClick={() => {
                setNewDecisionTitle('');
                setNewDecisionSummary('');
                setNewDecisionReasoning('');
                setNewDecisionOwner('');
                setNewDecisionDate(new Date().toISOString().split('T')[0]);
                setNewDecisionSourceOutputId(null);
                setSaveDecisionError(null);
                setShowSaveDecisionModal(true);
              }}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <Plus size={15} />
              <span>Save Decision</span>
            </button>
          ) : (
            <span
              style={{
                fontSize: '0.8rem',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(226, 181, 60, 0.1)',
                border: '1px solid rgba(226, 181, 60, 0.3)',
                color: '#e2b53c',
                fontWeight: 600,
              }}
            >
              Available on Pro
            </span>
          )}
        </div>

        {!decisionAccess.isAllowed ? (
          <div
            style={{
              padding: '24px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px dashed rgba(226, 181, 60, 0.3)',
              textAlign: 'center',
            }}
          >
            <BrainCircuit size={28} style={{ color: '#e2b53c', marginBottom: '8px', opacity: 0.8 }} />
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '0 0 4px 0', fontWeight: 500 }}>
              Decision Memory is available on Pro
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              Track what was decided, by whom, and why across your meetings.
            </p>
          </div>
        ) : loadingDecisions ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px', gap: '10px', color: '#94a3b8' }}>
            <Loader2 size={20} className="spin-animation" style={{ color: '#e2b53c' }} />
            <span>Loading decisions</span>
          </div>
        ) : decisionsError ? (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
              <AlertCircle size={18} />
              <span>Failed to load decisions</span>
            </div>
            <button
              type="button"
              onClick={loadDecisions}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            >
              Retry
            </button>
          </div>
        ) : decisions.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.3)',
              border: '1px dashed rgba(148, 163, 184, 0.2)',
              textAlign: 'center',
            }}
          >
            <BrainCircuit size={32} style={{ color: '#64748b', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: '0 0 6px 0' }}>
              No decisions saved yet
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
              Saved decisions from Decision Logs will appear here.
            </p>
            <button
              type="button"
              onClick={() => {
                setNewDecisionTitle('');
                setNewDecisionSummary('');
                setNewDecisionReasoning('');
                setNewDecisionOwner('');
                setNewDecisionDate(new Date().toISOString().split('T')[0]);
                setNewDecisionSourceOutputId(null);
                setSaveDecisionError(null);
                setShowSaveDecisionModal(true);
              }}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <Plus size={15} />
              <span>Save Decision</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {decisions.map((decision) => (
              <div
                key={decision.id}
                style={{
                  padding: '16px 20px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid rgba(226, 181, 60, 0.5)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b48316', margin: 0 }}>
                      {decision.decision_title}
                    </h3>
                    {decision.source_output_id && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          fontWeight: 500,
                        }}
                      >
                        Linked to Output
                      </span>
                    )}
                  </div>
                  {(() => {
                    const parsed = parseDecisionContext(decision.decision_summary, decision.decision_reasoning);
                    return (
                      <>
                        {parsed.mainSummary && (
                          <p style={{ color: '#0f172a', fontSize: '0.88rem', margin: '0 0 8px 0', lineHeight: 1.5, fontWeight: 500 }}>
                            {parsed.mainSummary}
                          </p>
                        )}
                        {parsed.projectContext && (
                          <div style={{ margin: '0 0 8px 0', padding: '6px 10px', borderRadius: '6px', background: 'rgba(226, 181, 60, 0.08)', borderLeft: '3px solid #b48316', fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
                            <strong style={{ color: '#b48316' }}>Project Context: </strong>
                            {parsed.projectContext}
                          </div>
                        )}
                        {parsed.mainReasoning && (
                          <p style={{ color: '#1e293b', fontSize: '0.82rem', margin: '0 0 6px 0', fontStyle: 'italic', lineHeight: 1.4 }}>
                            <strong style={{ fontStyle: 'normal', color: '#0f172a', fontWeight: 600 }}>Rationale: </strong>
                            {parsed.mainReasoning}
                          </p>
                        )}
                        {parsed.tradeoffs && (
                          <p style={{ color: '#475569', fontSize: '0.78rem', margin: '0 0 4px 0', lineHeight: 1.35 }}>
                            <strong style={{ color: '#1e293b', fontWeight: 600 }}>Trade-offs: </strong>
                            {parsed.tradeoffs}
                          </p>
                        )}
                        {parsed.downstreamImpact && (
                          <p style={{ color: '#0369a1', fontSize: '0.78rem', margin: '0 0 8px 0', lineHeight: 1.35 }}>
                            <strong style={{ fontWeight: 600 }}>Project Impact: </strong>
                            {parsed.downstreamImpact}
                          </p>
                        )}
                        {parsed.sourceLineage && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: '#64748b', marginBottom: '8px', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9' }}>
                            <GitBranch size={11} style={{ color: '#b48316' }} />
                            <span>Source: {parsed.sourceLineage}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: '#475569', flexWrap: 'wrap' }}>
                    {decision.decision_owner && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <User size={13} style={{ color: '#e2b53c' }} />
                        <span>{decision.decision_owner}</span>
                      </span>
                    )}
                    {decision.decision_date && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={13} />
                        <span>{decision.decision_date}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link
                    to={`/decision-memory/${decision.id}`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#101b2e', color: '#e2b53c', border: '1px solid rgba(226, 181, 60, 0.4)', fontWeight: 600 }}
                  >
                    <ExternalLink size={14} />
                    <span>Open</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteDecision(decision.id)}
                    disabled={deletingDecisionId === decision.id}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '6px 10px',
                      color: '#f87171',
                      borderColor: 'rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    {deletingDecisionId === decision.id ? (
                      <Loader2 size={14} className="spin-animation" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SAVED ACTIONS SECTION (Tasklet 14 Action Tracker) */}
      <section className="content-card" style={{ marginBottom: '32px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckSquare size={20} style={{ color: '#e2b53c' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Saved Actions
            </h2>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(226, 181, 60, 0.15)',
                color: '#f3c958',
                fontWeight: 600,
              }}
            >
              {actions.length}
            </span>
          </div>

          {actionAccess.isAllowed ? (
            <button
              type="button"
              onClick={() => {
                setNewActionTitle('');
                setNewActionDescription('');
                setNewActionOwner('');
                setNewActionDueDate('');
                setNewActionStatus('not_started');
                setNewActionSourceOutputId(null);
                setSaveActionError(null);
                setShowSaveActionModal(true);
              }}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <Plus size={15} />
              <span>Save Action</span>
            </button>
          ) : (
            <span
              style={{
                fontSize: '0.8rem',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(226, 181, 60, 0.1)',
                border: '1px solid rgba(226, 181, 60, 0.3)',
                color: '#e2b53c',
                fontWeight: 600,
              }}
            >
              Available on Pro
            </span>
          )}
        </div>

        {!actionAccess.isAllowed ? (
          <div
            style={{
              padding: '24px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px dashed rgba(226, 181, 60, 0.3)',
              textAlign: 'center',
            }}
          >
            <CheckSquare size={28} style={{ color: '#e2b53c', marginBottom: '8px', opacity: 0.8 }} />
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '0 0 4px 0', fontWeight: 500 }}>
              Action Accountability Tracker is available on Pro
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              Assign owners, track deadlines, and monitor completion across your meetings.
            </p>
          </div>
        ) : loadingActions ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px', gap: '10px', color: '#94a3b8' }}>
            <Loader2 size={20} className="spin-animation" style={{ color: '#e2b53c' }} />
            <span>Loading actions</span>
          </div>
        ) : actionsError ? (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
              <AlertCircle size={18} />
              <span>Failed to load actions</span>
            </div>
            <button
              type="button"
              onClick={loadActions}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            >
              Retry
            </button>
          </div>
        ) : actions.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.3)',
              border: '1px dashed rgba(148, 163, 184, 0.2)',
              textAlign: 'center',
            }}
          >
            <CheckSquare size={32} style={{ color: '#64748b', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: '0 0 6px 0' }}>
              No actions tracked yet
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
              Actions saved from meeting outputs will appear here.
            </p>
            <button
              type="button"
              onClick={() => {
                setNewActionTitle('');
                setNewActionDescription('');
                setNewActionOwner('');
                setNewActionDueDate('');
                setNewActionStatus('not_started');
                setNewActionSourceOutputId(null);
                setSaveActionError(null);
                setShowSaveActionModal(true);
              }}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <Plus size={15} />
              <span>Save Action</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {actions.map((action) => {
              const overdue = isActionOverdue(action);
              return (
                <div
                  key={action.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: overdue
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : '1px solid rgba(148, 163, 184, 0.15)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                        {action.action_title}
                      </h3>
                      {overdue && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            fontWeight: 700,
                          }}
                        >
                          Overdue
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background:
                            action.status === 'completed'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : action.status === 'in_progress'
                              ? 'rgba(56, 189, 248, 0.15)'
                              : action.status === 'blocked'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                          color:
                            action.status === 'completed'
                              ? '#4ade80'
                              : action.status === 'in_progress'
                              ? '#38bdf8'
                              : action.status === 'blocked'
                              ? '#f87171'
                              : '#94a3b8',
                          fontWeight: 600,
                        }}
                      >
                        {STATUS_LABELS[action.status] || action.status}
                      </span>
                      {action.source_output_id && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            fontWeight: 500,
                          }}
                        >
                          Linked to Output
                        </span>
                      )}
                    </div>

                    {(() => {
                      const parsed = parseActionContext(action.action_description);
                      return (
                        <>
                          {parsed.mainDesc && (
                            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                              {parsed.mainDesc}
                            </p>
                          )}
                          {parsed.deliverable && (
                            <div style={{ margin: '0 0 8px 0', padding: '6px 10px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.08)', borderLeft: '3px solid #38bdf8', fontSize: '0.82rem', color: '#e0f2fe', lineHeight: 1.4 }}>
                              <strong style={{ color: '#38bdf8' }}>Expected Deliverable: </strong>
                              {parsed.deliverable}
                            </div>
                          )}
                          {parsed.projectContext && (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                              <strong style={{ color: '#cbd5e1' }}>Project Context: </strong>
                              {parsed.projectContext}
                            </p>
                          )}
                          {parsed.sourceLineage && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '8px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)' }}>
                              <GitBranch size={11} style={{ color: '#e2b53c' }} />
                              <span>Source: {parsed.sourceLineage}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                      {action.owner_name && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <User size={13} style={{ color: '#e2b53c' }} />
                          <span>{action.owner_name}</span>
                        </span>
                      )}
                      {action.due_date && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: overdue ? '#f87171' : '#94a3b8' }}>
                          <Calendar size={13} />
                          <span>Due: {action.due_date}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={action.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value as ActionStatus;
                        if (!supabase) return;
                        const res = await updateActionStatus(supabase, action.id, newStatus);
                        if (res.data) {
                          setActions((prev) =>
                            prev.map((a) => (a.id === action.id ? res.data! : a))
                          );
                          refreshAllIntelligence({ supabase }).catch(() => {});
                        }
                      }}
                      className="form-input"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        color: '#f8fafc',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                      }}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                      <option value="overdue">Overdue</option>
                    </select>

                    <Link
                      to={`/actions/${action.id}`}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <ExternalLink size={14} />
                      <span>Open</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDeleteAction(action.id)}
                      disabled={deletingActionId === action.id}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.8rem',
                        padding: '6px 10px',
                        color: '#f87171',
                        borderColor: 'rgba(239, 68, 68, 0.25)',
                      }}
                    >
                      {deletingActionId === action.id ? (
                        <Loader2 size={14} className="spin-animation" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {/* VIEW OUTPUT MODAL (Claude Designed PDF Template System) */}
      {viewingOutput && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 11, 20, 0.92)",
            backdropFilter: "blur(10px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              width: "96%",
              padding: "24px",
              borderRadius: "14px",
              background: "#16263F",
              border: "1px solid rgba(226, 181, 60, 0.4)",
              boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.85)",
              maxHeight: "96vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {getOutputIcon(viewingOutput.output_type)}
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                  {OUTPUT_TYPE_LABELS[viewingOutput.output_type] || viewingOutput.output_type}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarDrawerOpen(true)}
                style={{
                  background: '#E2B53C',
                  color: '#16263F',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  marginRight: '12px',
                }}
              >
                <Sparkles size={15} />
                <span>Generate to Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingOutput(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: "14px" }}>
              Created: <span style={{ color: "#cbd5e1" }}>{formatTimestamp(viewingOutput.created_at)}</span>
              <span style={{ margin: "0 8px" }}>•</span>
              Last updated: <span style={{ color: "#cbd5e1" }}>{formatTimestamp(viewingOutput.updated_at)}</span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: "16px",
                borderRadius: "8px",
              }}
            >
              <OutputDocumentRenderer
                outputType={viewingOutput.output_type}
                rawContent={viewingOutput.content || ""}
                jsonPayload={viewingOutput.json_content}
                projectTitle={project?.title || "Project Deliverable"}
                meetingDate={project?.meeting_date || new Date().toISOString().slice(0, 10)}
                organisationName={project?.client_name || (project as any)?.client_or_project || "Concludo Client"}
                onCopy={() => handleCopyText(viewingOutput.content || "", viewingOutput.id)}
                copied={copiedId === viewingOutput.id}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {viewingOutput.output_type === "decision_log" && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewDecisionTitle(project?.title ? `Decision: ${project.title}` : "Meeting Decision");
                      setNewDecisionSummary((viewingOutput.content || "").slice(0, 240));
                      setNewDecisionReasoning((viewingOutput.content || "").slice(0, 400));
                      setNewDecisionDate(project?.meeting_date || new Date().toISOString().slice(0, 10));
                      setNewDecisionSourceOutputId(viewingOutput.id);
                      setSaveDecisionError(null);
                      setShowSaveDecisionModal(true);
                      setViewingOutput(null);
                    }}
                    className="btn btn-secondary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#f3c958", borderColor: "rgba(226, 181, 60, 0.4)" }}
                  >
                    <BrainCircuit size={15} />
                    <span>Save Decision</span>
                  </button>
                )}

                {viewingOutput.output_type === "action_items" && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewActionTitle(project?.title ? `Action: ${project.title}` : "Action Item");
                      setNewActionDescription((viewingOutput.content || "").slice(0, 300));
                      setNewActionSourceOutputId(viewingOutput.id);
                      setNewActionStatus("not_started");
                      setSaveActionError(null);
                      setShowSaveActionModal(true);
                      setViewingOutput(null);
                    }}
                    className="btn btn-secondary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#f3c958", borderColor: "rgba(226, 181, 60, 0.4)" }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Save Actions</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsCalendarDrawerOpen(true)}
                style={{
                  background: '#E2B53C',
                  color: '#16263F',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  marginRight: '12px',
                }}
              >
                <Sparkles size={15} />
                <span>Generate to Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingOutput(null)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT DELETE CONFIRMATION DIALOG (Tasklet 11 Retentive Soft Delete) */}
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
            padding: '20px',
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
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
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
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={22} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Delete project?
              </h3>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              This project will be moved to Recently Deleted.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              You can restore it for 30 days before permanent removal.
            </p>

            {deleteProjectError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '20px',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                }}
              >
                {deleteProjectError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={deletingProject}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteProjectError(null);
                }}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingProject}
                onClick={handleDeleteProject}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: deletingProject ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {deletingProject ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Deleting project</span>
                  </>
                ) : (
                  <span>Delete project</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE DECISION MODAL (Tasklet 14 Decision Memory) */}
      {showSaveDecisionModal && (
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
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '28px',
              borderRadius: '14px',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BrainCircuit size={20} style={{ color: '#e2b53c' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Save Decision
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveDecisionModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {saveDecisionError && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  color: '#f87171',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} />
                  <span>{saveDecisionError}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleSaveDecision(e)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleSaveDecision} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Decision Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Approve Q4 Vendor Contract"
                  value={newDecisionTitle}
                  onChange={(e) => setNewDecisionTitle(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Decision Summary
                </label>
                <textarea
                  rows={3}
                  placeholder="What was agreed upon..."
                  value={newDecisionSummary}
                  onChange={(e) => setNewDecisionSummary(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Reasoning / Why
                </label>
                <textarea
                  rows={2}
                  placeholder="Key rationale, trade-offs, or justification..."
                  value={newDecisionReasoning}
                  onChange={(e) => setNewDecisionReasoning(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Decision Owner
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Anthony Cortez"
                    value={newDecisionOwner}
                    onChange={(e) => setNewDecisionOwner(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Decision Date
                  </label>
                  <input
                    type="date"
                    value={newDecisionDate}
                    onChange={(e) => setNewDecisionDate(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowSaveDecisionModal(false)}
                  className="btn btn-secondary"
                  disabled={savingDecision}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDecision || !newDecisionTitle.trim()}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {savingDecision ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Saving decisions</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Decision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAVE ACTION MODAL (Tasklet 14 Action Tracker) */}
      {showSaveActionModal && (
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
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '28px',
              borderRadius: '14px',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={20} style={{ color: '#e2b53c' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Save Action
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveActionModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {saveActionError && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  color: '#f87171',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} />
                  <span>{saveActionError}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleSaveAction(e)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleSaveAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Action Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Send finalized proposal"
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Details, requirements, or scope..."
                  value={newActionDescription}
                  onChange={(e) => setNewActionDescription(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Owner
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    value={newActionOwner}
                    onChange={(e) => setNewActionOwner(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newActionDueDate}
                    onChange={(e) => setNewActionDueDate(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Status
                  </label>
                  <select
                    value={newActionStatus}
                    onChange={(e) => setNewActionStatus(e.target.value as ActionStatus)}
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowSaveActionModal(false)}
                  className="btn btn-secondary"
                  disabled={savingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAction || !newActionTitle.trim()}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {savingAction ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Saving actions</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Actions</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEETING TRANSCRIPT MODAL */}
      {showAddMeetingModal && (
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
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '640px',
              width: '100%',
              padding: '28px',
              borderRadius: '14px',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={20} style={{ color: '#e2b53c' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Add Meeting Transcript to Project
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMeetingModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: '-10px', marginBottom: '18px', lineHeight: 1.5 }}>
              Append a new meeting or workshop session to this project. All attached meetings and documents are synthesised together to provide deeper project context.
            </p>

            {addMeetingError && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#f87171',
                  fontSize: '0.85rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{addMeetingError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Meeting / Session Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architecture Review or Sprint 4 Planning"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={newMeetingDate}
                    onChange={(e) => setNewMeetingDate(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Meeting Type
                  </label>
                  <select
                    value={newMeetingType}
                    onChange={(e) => setNewMeetingType(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                  >
                    {COMMON_MEETING_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="Architecture Review">Architecture Review</option>
                    <option value="Steering Committee">Steering Committee</option>
                    <option value="Workshop">Workshop</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Attendees (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Raman, Mark Ellison, Sarah Jenkins"
                  value={newMeetingAttendees}
                  onChange={(e) => setNewMeetingAttendees(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                    Transcript or Minutes Text *
                  </label>
                  <input
                    ref={meetingTranscriptFileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json,.vtt,.srt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleMeetingFileUpload(e.target.files);
                      if (meetingTranscriptFileInputRef.current) meetingTranscriptFileInputRef.current.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => meetingTranscriptFileInputRef.current?.click()}
                    disabled={parsingMeetingFile}
                    className="btn btn-secondary"
                    style={{ padding: '3px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    {parsingMeetingFile ? (
                      <>
                        <Loader2 size={12} className="spin-animation" />
                        <span>Parsing...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={12} />
                        <span>Upload File (.vtt, .srt, .docx, .txt)</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  required
                  rows={8}
                  placeholder="Paste meeting dialogue or upload transcript file..."
                  value={newMeetingTranscript}
                  onChange={(e) => setNewMeetingTranscript(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddMeetingModal(false)}
                  className="btn btn-secondary"
                  disabled={savingProject}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProject || !newMeetingTitle.trim() || !newMeetingTranscript.trim()}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {savingProject ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Appending Meeting...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Add Meeting to Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate to Calendar Drawer */}
      <GenerateToCalendarDrawer
        isOpen={isCalendarDrawerOpen}
        onClose={() => setIsCalendarDrawerOpen(false)}
        outputTitle={project?.title || 'Meeting Deliverable'}
        projectId={id || ''}
        outputId={viewingOutput?.id}
        sourceReference="TR-001"
        occurredAt={project?.meeting_date || undefined}
        initialItems={extractCalendarPayloadItems(viewingOutput, project?.meeting_date)}
      />
    </div>
  );
};
