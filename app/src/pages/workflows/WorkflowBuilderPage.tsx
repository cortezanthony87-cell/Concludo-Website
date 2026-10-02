import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Shield,
  Send,
  Loader2,
  ChevronDown,
  Layers,
  History,
  CheckSquare,
  Activity,
  UserCheck,
  Calendar,
  FolderKanban,
  Video,
  FileText,
  Clock,
  Split,
  Plus,
  Trash2,
  Info
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import { WorkflowDefinition, WorkflowStep, WorkflowEdge, BuildEvent } from '../../lib/workflows/schemas';
import {
  executeWorkflowArchitect,
  buildMeetingFollowthroughVerticalSlice,
} from '../../lib/workflows/workflowArchitectAgent';
import { validateWorkflowDefinition, ValidationResult } from '../../lib/workflows/validation';
import { executeWorkflow, WorkflowRunResult } from '../../lib/workflows/executionEngine';
import { calculateWorkflowRisk } from '../../lib/workflows/riskClassification';
import { CONNECTOR_MANIFESTS } from '../../lib/workflows/connectorRegistry';

export const WorkflowBuilderPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Workflow Definition State
  const [definition, setDefinition] = useState<WorkflowDefinition>(() =>
    buildMeetingFollowthroughVerticalSlice()
  );
  const [historyStack, setHistoryStack] = useState<WorkflowDefinition[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Conversation & Agent Architect State
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'architect'; content: string; timestamp: string }>
  >([
    {
      id: 'm1',
      role: 'architect',
      content:
        'G’day! I am the Concludo Workflow Architect. Describe what you want automated in ordinary Australian English, or refine the draft workflow displayed on your canvas.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildEvents, setBuildEvents] = useState<BuildEvent[]>([]);

  // Selected Node & Inspector
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>('summarise_meeting');
  const [inspectorTab, setInspectorTab] = useState<'simple' | 'advanced'>('simple');

  // Bottom Tabs
  const [bottomTab, setBottomTab] = useState<
    'issues' | 'connections' | 'test_results' | 'run_history' | 'versions' | 'plain_review'
  >('plain_review');

  // Canvas Viewport Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [canvasOffset, setCanvasOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Execution & Testing
  const [testResult, setTestResult] = useState<WorkflowRunResult | null>(null);
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [runHistory, setRunHistory] = useState<WorkflowRunResult[]>([]);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'submitted' | 'published'>('draft');
  const [publishedVersion, setPublishedVersion] = useState<number>(1);
  const [rollbackAvailable, setRollbackAvailable] = useState<boolean>(false);

  // Validation
  const [validation, setValidation] = useState<ValidationResult>(() =>
    validateWorkflowDefinition(definition)
  );

  useEffect(() => {
    setValidation(validateWorkflowDefinition(definition));
  }, [definition]);

  const pushHistory = (newDef: WorkflowDefinition) => {
    setHistoryStack((prev) => [...prev.slice(0, historyIndex + 1), newDef]);
    setHistoryIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setDefinition(historyStack[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setDefinition(historyStack[historyIndex + 1]);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputPrompt;
    if (!textToSend.trim() || isBuilding) return;

    const userMsg = {
      id: `u_${Date.now()}`,
      role: 'user' as const,
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsBuilding(true);
    setBuildEvents([]);

    try {
      const response = await executeWorkflowArchitect(
        {
          instruction: textToSend.trim(),
          existingDefinition: definition,
          currentUserId: user?.id,
        },
        (evt) => {
          setBuildEvents((prev) => [...prev, evt]);
        }
      );

      // Apply newly generated workflow definition
      pushHistory(response.workflowDefinition);
      setDefinition(response.workflowDefinition);

      // Add architect explanation response
      const architectMsg = {
        id: `a_${Date.now()}`,
        role: 'architect' as const,
        content: `I’ve updated your workflow architecture:\n\n${response.plainLanguageExplanation.join(
          '\n'
        )}\n\n*Concludo proposes; a person disposes. Human approval has been enforced for all task and calendar modifications.*`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, architectMsg]);
    } catch (err: any) {
      const errMsg = {
        id: `err_${Date.now()}`,
        role: 'architect' as const,
        content: `Error interpreting instruction: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsBuilding(false);
    }
  };

  // Run Safe Dry Run
  const handleDryRun = async () => {
    setIsRunningTest(true);
    try {
      const res = await executeWorkflow({
        workflow: definition,
        inputs: {
          meetingId: 'meeting_dry_run_01',
          meetingTitle: 'Executive Operations Briefing',
        },
        userId: user?.id || 'usr_dev',
        isDryRun: true,
      });
      setTestResult(res);
      setBottomTab('test_results');
    } finally {
      setIsRunningTest(false);
    }
  };

  // Run Authorized Real Execution
  const handleRealExecution = async (injectFailure: boolean = false) => {
    setIsRunningTest(true);
    try {
      const res = await executeWorkflow({
        workflow: definition,
        inputs: {
          meetingId: `meeting_${Date.now()}`,
          meetingTitle: 'Enterprise Steering Committee',
          forceReplay: true,
        },
        userId: user?.id || 'usr_dev',
        isDryRun: false,
        failStepKey: injectFailure ? 'create_calendar_drafts' : undefined,
      });
      setTestResult(res);
      setRunHistory((prev) => [res, ...prev]);
      setBottomTab('run_history');
    } finally {
      setIsRunningTest(false);
    }
  };

  // Submit & Publish Handlers
  const handleSubmitForReview = () => {
    setPublishStatus('submitted');
    alert('Workflow submitted to Approval Centre for publication review.');
  };

  const handlePublish = () => {
    setPublishStatus('published');
    setPublishedVersion((prev) => prev + 1);
    setRollbackAvailable(true);
    alert(`Workflow v${publishedVersion} is now published and active.`);
  };

  const handleRollback = () => {
    if (confirm(`Roll back to previous published version v${publishedVersion - 1}?`)) {
      setPublishedVersion((prev) => Math.max(1, prev - 1));
      alert('Rolled back successfully to prior immutable version.');
    }
  };

  const selectedStep = definition.steps.find((s) => s.key === selectedStepKey);

  return (
    <div className="flex flex-col h-screen bg-[#0A0E17] text-[#F4F6FA] font-sans overflow-hidden">
      {/* 1. Header Bar */}
      <header className="h-14 border-b border-[#1E293B] bg-[#0D111A] px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-4">
          <Link
            to="/workflows"
            className="flex items-center text-xs text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Workflows
          </Link>
          <div className="h-4 w-[1px] bg-[#21395C]" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-white font-heading">{definition.name}</span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  publishStatus === 'published'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {publishStatus === 'published' ? `v${publishedVersion} Published` : 'Draft'}
              </span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  calculateWorkflowRisk(definition as any).effectiveRisk === 'restricted'
                    ? 'bg-red-950 text-red-400 border border-red-800'
                    : calculateWorkflowRisk(definition as any).effectiveRisk === 'high'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : calculateWorkflowRisk(definition as any).effectiveRisk === 'medium'
                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {calculateWorkflowRisk(definition as any).effectiveRisk} Risk
              </span>
              <Link
                to="/workflows/governance"
                className="text-[11px] text-[#E2B53C] hover:underline flex items-center gap-1 ml-2"
                title="Open Workflow Governance Centre"
              >
                <Shield className="w-3 h-3" /> Governance
              </Link>
            </div>
            <p className="text-[11px] text-gray-400">Trigger: {definition.trigger.displayName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleUndo}
            title="Undo"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#16263F] rounded"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDryRun}
            disabled={isRunningTest}
            className="px-3 py-1.5 bg-[#16263F] hover:bg-[#21395C] border border-[#21395C] rounded text-xs font-semibold text-white flex items-center space-x-1.5 transition"
          >
            <Play className="w-3.5 h-3.5 text-blue-400" />
            <span>Dry Run</span>
          </button>

          <button
            onClick={() => handleRealExecution(false)}
            disabled={isRunningTest}
            className="px-3 py-1.5 bg-[#16263F] hover:bg-[#21395C] border border-[#21395C] rounded text-xs font-semibold text-white flex items-center space-x-1.5 transition"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run Authorized Test</span>
          </button>

          {publishStatus === 'draft' ? (
            <button
              onClick={handleSubmitForReview}
              className="px-3 py-1.5 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0A0E17] font-semibold rounded text-xs transition"
            >
              Submit for Review
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition"
            >
              Publish Immutable
            </button>
          )}

          {rollbackAvailable && (
            <button
              onClick={handleRollback}
              className="px-2.5 py-1.5 bg-red-900/30 hover:bg-red-800/40 border border-red-700 text-red-300 font-semibold rounded text-xs transition"
            >
              Roll Back
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Work Area: Left Split (Architect) + Right Split (Live Canvas) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: 35% Width - Concludo Workflow Architect */}
        <div className="w-[35%] min-w-[340px] max-w-[460px] border-r border-[#1E293B] bg-[#0D111A] flex flex-col h-full z-10 shadow-lg">
          <div className="p-3.5 border-b border-[#1E293B] flex items-center justify-between bg-[#16263F]/40">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#E2B53C]" />
              <h2 className="text-sm font-bold text-white font-heading">
                Concludo Workflow Architect
              </h2>
            </div>
            <span className="text-[10px] text-gray-400 bg-[#0A0E17] px-2 py-0.5 rounded border border-[#1E293B]">
              Natural Language Engine
            </span>
          </div>

          {/* Chat / Event Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  m.role === 'architect'
                    ? 'bg-[#16263F]/70 border border-[#21395C] text-gray-200'
                    : 'bg-[#21395C]/80 border border-[#3B5B88] text-white ml-6'
                }`}
              >
                <div className="text-[10px] text-gray-400 mb-1 font-semibold flex items-center justify-between">
                  <span>{m.role === 'architect' ? 'Concludo Architect' : 'You (Anthony)'}</span>
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}

            {isBuilding && (
              <div className="bg-[#16263F]/90 border border-[#E2B53C]/40 p-3 rounded-xl text-xs space-y-2">
                <div className="flex items-center space-x-2 text-[#E2B53C] font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing workflow architecture...</span>
                </div>
                {buildEvents.slice(-3).map((evt) => (
                  <div key={evt.id} className="text-[11px] text-gray-300 font-mono">
                    &bull; {evt.message || evt.type}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-[#0A0E17] border-t border-[#1E293B] space-y-1">
            <span className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
              Quick Instructions
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() =>
                  handleSendMessage(
                    'When a meeting finishes, create a summary, extract the actions, ask the project owner to approve them, add approved actions to the project, add approved deadlines to the Calendar and create an incident if any step fails three times.'
                  )
                }
                className="text-[10px] bg-[#16263F] hover:bg-[#21395C] text-gray-300 px-2 py-1 rounded border border-[#21395C] transition"
              >
                Initial Meeting Vertical Slice
              </button>
              <button
                onClick={() =>
                  handleSendMessage('If no project is linked, ask me to select one instead of failing.')
                }
                className="text-[10px] bg-[#16263F] hover:bg-[#21395C] text-gray-300 px-2 py-1 rounded border border-[#21395C] transition"
              >
                Add Missing-Project Selection Branch
              </button>
              <button
                onClick={() => handleSendMessage('Retry the Calendar step three times.')}
                className="text-[10px] bg-[#16263F] hover:bg-[#21395C] text-gray-300 px-2 py-1 rounded border border-[#21395C] transition"
              >
                Retry Calendar 3x
              </button>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="p-3 border-t border-[#1E293B] bg-[#0D111A]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Describe your workflow or changes..."
                disabled={isBuilding}
                className="flex-1 bg-[#0A0E17] border border-[#21395C] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E2B53C]"
              />
              <button
                type="submit"
                disabled={isBuilding || !inputPrompt.trim()}
                className="p-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0A0E17] rounded-lg disabled:opacity-40 transition font-bold"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel: 65% Width - Live Workflow Canvas */}
        <div className="flex-1 flex flex-col h-full bg-[#0A0E17] relative overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="h-10 border-b border-[#1E293B] bg-[#0D111A]/80 px-4 flex items-center justify-between z-10 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span className="font-semibold text-white">Live Workflow Canvas</span>
              <span>&bull;</span>
              <span>{definition.steps.length} Steps</span>
              <span>&bull;</span>
              <span>{definition.edges.length} Edges</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
                className="p-1 text-gray-400 hover:text-white hover:bg-[#16263F] rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-gray-400 font-mono w-10 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                className="p-1 text-gray-400 hover:text-white hover:bg-[#16263F] rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1 text-gray-400 hover:text-white hover:bg-[#16263F] rounded"
                title="Fit View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Visual SVG / Interactive Nodes Canvas */}
          <div
            className="flex-1 overflow-auto p-8 relative bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px]"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
          >
            {/* SVG Connecting Edges */}
            <svg className="absolute inset-0 w-[2000px] h-[1000px] pointer-events-none z-0">
              {definition.edges.map((edge) => {
                const src = definition.steps.find((s) => s.key === edge.sourceStep);
                const dst = definition.steps.find((s) => s.key === edge.destinationStep);
                if (!src || !dst) return null;

                const x1 = (src.position?.x || 0) + 180;
                const y1 = (src.position?.y || 0) + 40;
                const x2 = dst.position?.x || 0;
                const y2 = (dst.position?.y || 0) + 40;

                const isFailure = edge.edgeType === 'failure';
                const strokeColor = isFailure ? '#EF4444' : '#E2B53C';

                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2"
                      strokeDasharray={isFailure ? '4,4' : undefined}
                      opacity="0.8"
                    />
                    {edge.branchLabel && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 8}
                        fill={isFailure ? '#FCA5A5' : '#E2B53C'}
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {edge.branchLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Step Cards */}
            {definition.steps.map((step) => {
              const isSelected = selectedStepKey === step.key;
              const isApproval = step.stepType === 'approval' || step.approvalRequirement?.required;
              const isFailHandler = step.key === 'handle_failure_incident';

              return (
                <div
                  key={step.key}
                  onClick={() => setSelectedStepKey(step.key)}
                  style={{
                    position: 'absolute',
                    left: `${step.position?.x || 50}px`,
                    top: `${step.position?.y || 100}px`,
                  }}
                  className={`w-44 p-3 rounded-xl border cursor-pointer select-none transition shadow-xl z-10 ${
                    isSelected
                      ? 'border-[#E2B53C] bg-[#16263F] ring-2 ring-[#E2B53C]/50'
                      : isFailHandler
                      ? 'border-red-800 bg-red-950/40 hover:border-red-600'
                      : 'border-[#21395C] bg-[#0D111A]/95 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase font-bold text-gray-400">
                      {step.stepType.replace('_', ' ')}
                    </span>
                    {isApproval && (
                      <span className="text-[9px] bg-amber-500/20 text-[#E2B53C] border border-[#E2B53C]/40 px-1.5 py-0.2 rounded font-bold">
                        Approval
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs font-bold text-white leading-tight font-heading">
                    {step.name || step.displayName}
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {step.userFacingExplanation}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-[#1E293B] flex items-center justify-between text-[9px] text-gray-400">
                    <span className="font-mono">{(step.service || step.application || 'system').replace('concludo_', '')}</span>
                    <span className="text-emerald-400">&bull; Valid</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simple & Advanced Node Inspector Flyout */}
          {selectedStep && (
            <div className="absolute top-12 right-4 w-80 bg-[#0D111A]/95 border border-[#21395C] rounded-xl p-4 shadow-2xl z-20 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 mb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#E2B53C]">
                    Node Inspector
                  </span>
                  <h4 className="text-xs font-bold text-white">{selectedStep.name || selectedStep.displayName}</h4>
                </div>
                <div className="flex border border-[#21395C] rounded text-[10px] overflow-hidden">
                  <button
                    onClick={() => setInspectorTab('simple')}
                    className={`px-2 py-0.5 ${
                      inspectorTab === 'simple' ? 'bg-[#E2B53C] text-[#0A0E17] font-bold' : 'text-gray-400'
                    }`}
                  >
                    Simple
                  </button>
                  <button
                    onClick={() => setInspectorTab('advanced')}
                    className={`px-2 py-0.5 ${
                      inspectorTab === 'advanced' ? 'bg-[#E2B53C] text-[#0A0E17] font-bold' : 'text-gray-400'
                    }`}
                  >
                    Advanced
                  </button>
                </div>
              </div>

              {inspectorTab === 'simple' ? (
                <div className="space-y-2.5 text-xs text-gray-300">
                  <div>
                    <span className="text-[10px] text-gray-400 block">What this step does:</span>
                    <p className="mt-0.5 text-white">{selectedStep.userFacingExplanation}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Application Service:</span>
                    <span className="text-[#E2B53C] font-mono text-[11px]">{selectedStep.service}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Human Approval Required:</span>
                    <span className="text-white">
                      {selectedStep.approvalRequirement?.required ? 'Yes (Project Owner)' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Failure Policy:</span>
                    <span className="text-white">
                      Retry up to {selectedStep.retryPolicy?.maxAttempts || 1} times, then escalate.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-[11px] text-gray-300 font-mono overflow-y-auto max-h-60">
                  <div>
                    <span className="text-gray-500">Step Key:</span> {selectedStep.key}
                  </div>
                  <div>
                    <span className="text-gray-500">Idempotency Template:</span>
                    <div className="text-[10px] text-gray-400 break-all">
                      {selectedStep.idempotencyPolicy?.keyTemplate}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Timeout:</span> {selectedStep.timeoutSeconds}s
                  </div>
                  <div>
                    <span className="text-gray-500">Retry Limit:</span>{' '}
                    {selectedStep.retryPolicy?.maxAttempts}x (factor{' '}
                    {selectedStep.retryPolicy?.backoffFactor})
                  </div>
                  <div>
                    <span className="text-gray-500">Raw Configuration:</span>
                    <pre className="bg-[#0A0E17] p-2 rounded text-[9px] text-gray-300 mt-1 overflow-x-auto">
                      {JSON.stringify(selectedStep.configuration, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Inspection & History Tabs */}
          <div className="h-44 border-t border-[#1E293B] bg-[#0D111A] flex flex-col z-10">
            <div className="flex border-b border-[#1E293B] px-4 space-x-4 text-xs font-medium">
              <button
                onClick={() => setBottomTab('plain_review')}
                className={`py-2 border-b-2 transition ${
                  bottomTab === 'plain_review'
                    ? 'border-[#E2B53C] text-[#E2B53C]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Plain-Language Review
              </button>
              <button
                onClick={() => setBottomTab('issues')}
                className={`py-2 border-b-2 transition flex items-center space-x-1 ${
                  bottomTab === 'issues'
                    ? 'border-[#E2B53C] text-[#E2B53C]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <span>Validation Issues</span>
                {validation.errors.length > 0 && (
                  <span className="bg-red-900 text-red-300 px-1.5 py-0.2 rounded-full text-[9px]">
                    {validation.errors.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setBottomTab('connections')}
                className={`py-2 border-b-2 transition ${
                  bottomTab === 'connections'
                    ? 'border-[#E2B53C] text-[#E2B53C]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Connected Services
              </button>
              <button
                onClick={() => setBottomTab('test_results')}
                className={`py-2 border-b-2 transition ${
                  bottomTab === 'test_results'
                    ? 'border-[#E2B53C] text-[#E2B53C]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Test Results
              </button>
              <button
                onClick={() => setBottomTab('run_history')}
                className={`py-2 border-b-2 transition ${
                  bottomTab === 'run_history'
                    ? 'border-[#E2B53C] text-[#E2B53C]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Execution History ({runHistory.length})
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto text-xs">
              {bottomTab === 'plain_review' && (
                <div className="space-y-1.5 text-gray-300">
                  <div className="font-semibold text-white mb-1">
                    Plain-Language Step-by-Step Story:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>When a meeting finishes, ingest the recording and speaker transcript.</li>
                    <li>Verify access permissions and ensure duplicate meeting events are not processed.</li>
                    <li>Call the Meeting AI Agent to summarize the discussion and extract concrete action items with verbatim citations.</li>
                    <li>Submit the extracted actions to Concludo Approval Centre for project owner sign-off.</li>
                    <li>Upon human approval, insert the approved tasks into Concludo Projects.</li>
                    <li>Stage action deadlines onto the Concludo Calendar with duplicate checking.</li>
                    <li>Send an internal workspace completion alert.</li>
                    <li>If any step fails three times, halt execution and log a high-severity incident.</li>
                  </ol>
                </div>
              )}

              {bottomTab === 'issues' && (
                <div className="space-y-2">
                  {validation.errors.length === 0 && validation.warnings.length === 0 ? (
                    <div className="text-emerald-400 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Zero validation errors or warnings. Ready for test run and publication.</span>
                    </div>
                  ) : (
                    <div>
                      {validation.errors.map((err, i) => (
                        <div key={i} className="text-red-400 flex items-center space-x-1.5">
                          <AlertCircle className="w-4 h-4" />
                          <span>[{err.code}] {err.message}</span>
                        </div>
                      ))}
                      {validation.warnings.map((warn, i) => (
                        <div key={i} className="text-amber-400 flex items-center space-x-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          <span>[{warn.code}] {warn.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {bottomTab === 'connections' && (
                <div className="grid grid-cols-3 gap-3">
                  {['concludo_meetings', 'concludo_ai_agents', 'concludo_approval_centre', 'concludo_projects', 'concludo_calendar', 'concludo_notifications'].map((key) => {
                    const c = CONNECTOR_MANIFESTS[key];
                    return (
                      <div key={key} className="bg-[#16263F]/50 border border-[#21395C] p-2.5 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">{c?.displayName || key}</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">&bull; Connected</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{c?.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {bottomTab === 'test_results' && (
                <div>
                  {testResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-white">Run ID: {testResult.runId}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                          {testResult.isDryRun ? 'Dry Run' : 'Real Execution'}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          testResult.status === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {testResult.status}
                        </span>
                        <span className="text-gray-400 text-xs">{testResult.durationMs}ms</span>
                      </div>
                      <div className="text-[11px] text-gray-300">
                        {testResult.approvalId && <div>Approval Staged: <span className="text-[#E2B53C]">{testResult.approvalId}</span> (Waiting for human review in Approval Centre)</div>}
                        {testResult.incidentId && <div className="text-red-400">Incident Escalated: {testResult.incidentId}</div>}
                        {testResult.createdTasks && <div>Tasks Created: {testResult.createdTasks.length} tasks</div>}
                        {testResult.createdCalendarItems && <div>Calendar Items: {testResult.createdCalendarItems.length} items</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400">No test runs executed yet. Click &lsquo;Dry Run&rsquo; or &lsquo;Run Authorized Test&rsquo; above.</div>
                  )}
                </div>
              )}

              {bottomTab === 'run_history' && (
                <div className="space-y-2">
                  {runHistory.length === 0 ? (
                    <div className="text-gray-400">No execution history recorded in this session.</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-[#21395C]">
                          <th className="pb-1">Run ID</th>
                          <th className="pb-1">Status</th>
                          <th className="pb-1">Duration</th>
                          <th className="pb-1">Tasks / Calendar Items</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#21395C]/40 text-gray-300">
                        {runHistory.map((r) => (
                          <tr key={r.runId}>
                            <td className="py-1.5 font-mono">{r.runId}</td>
                            <td className="py-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                                {r.status}
                              </span>
                            </td>
                            <td className="py-1.5">{r.durationMs}ms</td>
                            <td className="py-1.5">
                              {r.createdTasks?.length || 0} tasks &bull; {r.createdCalendarItems?.length || 0} calendar items
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default WorkflowBuilderPage;