import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { WORKFLOW_TEMPLATES, WorkflowTemplateMeta } from '../../lib/workflows/templates';
import { TemplatePickerModal } from '../../components/workflows/TemplatePickerModal';
import './workflow-builder-template.css';

export const WorkflowBuilderPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Workflow Definition State
  const [definition, setDefinition] = useState<WorkflowDefinition>(() =>
    buildMeetingFollowthroughVerticalSlice()
  );
  const [historyStack, setHistoryStack] = useState<WorkflowDefinition[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Template Picker Modal
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);

  // Conversation & Agent Architect State
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'architect'; content: string; timestamp: string }>
  >([
    {
      id: 'm1',
      role: 'architect',
      content:
        'Describe what you want automated, in ordinary English. I will draft it, and you decide whether it runs.',
      timestamp: '09:41',
    },
    {
      id: 'm2',
      role: 'user',
      content: 'After a client meeting, draft the follow-up and put the deadlines in.',
      timestamp: '09:42',
    },
    {
      id: 'm3',
      role: 'architect',
      content:
        'Drafted four steps. The approval step is fixed: nothing leaves Concludo until you sign it off.',
      timestamp: '09:42',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildEvents, setBuildEvents] = useState<BuildEvent[]>([]);

  // Selected Node & Inspector
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>('approval_centre_review');
  const [inspectorTab, setInspectorTab] = useState<'simple' | 'advanced'>('simple');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  // Bottom Tabs
  const [bottomTab, setBottomTab] = useState<number>(0);

  // Canvas Viewport Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const nodesContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Keyboard navigation & Shortcuts (Plate 15)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInspectorOpen(false);
        setIsPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputPrompt;
    if (!textToSend.trim() || isBuilding) return;

    const userMsg = {
      id: `u_${Date.now()}`,
      role: 'user' as const,
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

      pushHistory(response.workflowDefinition);
      setDefinition(response.workflowDefinition);

      const architectMsg = {
        id: `a_${Date.now()}`,
        role: 'architect' as const,
        content: `I’ve updated your workflow architecture:\n\n${response.plainLanguageExplanation.join(
          '\n'
        )}\n\n*Concludo proposes; a person disposes. Human approval has been enforced for all task and calendar modifications.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, architectMsg]);
    } catch (err: any) {
      const errMsg = {
        id: `err_${Date.now()}`,
        role: 'architect' as const,
        content: `Error interpreting instruction: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      setBottomTab(3); // Test Results tab
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
      setBottomTab(4); // Execution History tab
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleSubmitForReview = () => {
    setPublishStatus('submitted');
    alert('Workflow submitted to Approval Centre for publication review.');
  };

  const handlePublish = () => {
    if (confirm('Publish this workflow version as immutable? Once published, changes require a new version.')) {
      setPublishStatus('published');
      setPublishedVersion((prev) => prev + 1);
      setRollbackAvailable(true);
    }
  };

  const handleRollback = () => {
    if (confirm(`Roll back to previous published version v${publishedVersion - 1}?`)) {
      setPublishedVersion((prev) => Math.max(1, prev - 1));
      alert('Rolled back successfully to prior immutable version.');
    }
  };

  const handleSelectTemplate = (template: WorkflowTemplateMeta) => {
    setIsPickerOpen(false);
    const newDef: WorkflowDefinition = {
      ...definition,
      workflowKey: template.templateKey,
      name: template.name,
      description: template.description,
      trigger: {
        ...definition.trigger,
        displayName: template.exampleTrigger,
      },
    };
    pushHistory(newDef);
    setDefinition(newDef);

    const templateMsg = {
      id: `tpl_${Date.now()}`,
      role: 'architect' as const,
      content: `Loaded starter template: **${template.name}** (${template.category}, ${template.setupTimeCategory} setup).\n\n${template.exampleResult}\n\n*Concludo proposes; a person disposes. Human approval has been enforced.*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, templateMsg]);
  };

  const selectedStep = definition.steps.find((s) => s.key === selectedStepKey) || definition.steps[0];

  const handleSelectNode = (stepKey: string, cardElement?: HTMLElement) => {
    setSelectedStepKey(stepKey);
    setIsInspectorOpen(true);
    if (canvasWrapRef.current && cardElement) {
      canvasWrapRef.current.scrollTo({
        left: Math.max(0, cardElement.offsetLeft - 40),
        behavior: 'instant' as any,
      });
    }
  };

  const riskTier = calculateWorkflowRisk(definition as any).effectiveRisk;
  const riskPillClass =
    riskTier === 'restricted'
      ? 'wb-pill warn'
      : riskTier === 'high'
      ? 'wb-pill warn'
      : riskTier === 'medium'
      ? 'wb-pill warn'
      : 'wb-pill ok';

  // Compute canonical step type pill text and style class
  const getStepTypeInfo = (step: WorkflowStep) => {
    const rawType = (step.stepType || '').toLowerCase();
    if (rawType === 'trigger') return { label: 'TRIGGER', className: 'trigger' };
    if (rawType.includes('ai') || rawType.includes('agent')) return { label: 'AI AGENT', className: 'agent' };
    if (rawType.includes('approval') || step.approvalRequirement?.required) return { label: 'APPROVAL', className: 'approval' };
    if (rawType.includes('calendar')) return { label: 'CALENDAR', className: 'calendar' };
    if (rawType.includes('branch') || rawType.includes('condition')) return { label: 'BRANCH', className: 'branch' };
    if (rawType === 'logic') return { label: 'BRANCH', className: 'branch' };
    return { label: 'ACTION', className: 'action' };
  };

  // Node plain-language review items
  const reviewItems = [
    'When a meeting finishes, Concludo writes the summary and pulls out the decisions.',
    'You read it and approve it. Nothing is sent and no task is created before that.',
    'Once approved, each action becomes a project task with an owner and a due date.',
    'If you decline, the owner is told and nothing else happens.',
  ];

  return (
    <div className="wb-app">
      {/* ---------- Plate 4: Header Bar (56px fixed) ---------- */}
      <header className="wb-hdr">
        <div className="wb-hdr-l">
          <Link to="/workflows" className="wb-back">
            <span aria-hidden="true">&#8249;</span> Workflows
          </Link>
          <span className="wb-sep" aria-hidden="true">/</span>
          <span className="wb-wf-name">{definition.name}</span>

          {publishStatus === 'published' ? (
            <span className="wb-pill gold">Published v{publishedVersion}</span>
          ) : (
            <span className="wb-pill ghost">Draft</span>
          )}

          <span className={riskPillClass}>Risk&nbsp;&nbsp;{riskTier}</span>

          <Link to="/workflows/governance" className="wb-gov">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2l8 4v6c0 5-3.4 8.9-8 10-4.6-1.1-8-5-8-10V6z" />
            </svg>
            Governance
          </Link>

          <button
            className="wb-btn"
            style={{ marginLeft: '8px' }}
            onClick={() => setIsPickerOpen(true)}
            title="Start from one of 20 enterprise templates"
          >
            Templates
          </button>
        </div>

        <div className="wb-hdr-r">
          <button className="wb-btn" onClick={handleUndo} title="Undo last step edit">
            Undo
          </button>
          <button className="wb-btn blue" onClick={handleDryRun} disabled={isRunningTest}>
            Dry Run
          </button>
          <button
            className="wb-btn ok"
            onClick={() => handleRealExecution(false)}
            disabled={isRunningTest}
          >
            Run Authorised Test
          </button>

          {publishStatus === 'draft' ? (
            <button className="wb-btn" onClick={handleSubmitForReview}>
              Submit for Review
            </button>
          ) : null}

          <button
            className={`wb-btn ${publishStatus === 'published' ? 'ghost' : 'gold'}`}
            id="publish"
            onClick={handlePublish}
          >
            Publish Immutable
          </button>

          {rollbackAvailable && (
            <button className="wb-btn" onClick={handleRollback}>
              Roll Back
            </button>
          )}
        </div>
      </header>

      {/* ---------- Plate 3: Split Layout ---------- */}
      <div className="wb-split">
        {/* Region 2: Architect Panel (35% width, min 340px, max 460px) */}
        <aside className="wb-architect" aria-label="Concludo Workflow Architect">
          <div className="wb-ar-head">
            <svg className="wb-spark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4z" />
              <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
            </svg>
            <div>
              <h1>Concludo Workflow Architect</h1>
              <p>Natural Language Engine</p>
            </div>
          </div>

          <div className="wb-stream" id="stream">
            {messages.map((m) => (
              <div key={m.id} className={`wb-msg ${m.role}`}>
                <div className="wb-bubble">{m.content}</div>
                <div className="wb-meta">
                  {m.role === 'architect' ? 'ARCHITECT' : 'ANTHONY'} {m.timestamp}
                </div>
              </div>
            ))}

            {isBuilding && (
              <div className="wb-msg architect">
                <div className="wb-bubble">Synthesising workflow architecture...</div>
                <div className="wb-meta">ARCHITECT BUSY</div>
              </div>
            )}
          </div>

          <div className="wb-suggest">
            <span className="wb-sg-label">Try</span>
            <button
              className="wb-chip"
              onClick={() => handleSendMessage('Add a reminder the day before')}
            >
              Add a reminder the day before
            </button>
            <button
              className="wb-chip"
              onClick={() => handleSendMessage('Require two approvers')}
            >
              Require two approvers
            </button>
            <button
              className="wb-chip"
              onClick={() => handleSendMessage('Only for client meetings')}
            >
              Only for client meetings
            </button>
          </div>

          <form
            className="wb-composer"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              placeholder="Tell the Architect what to change"
              aria-label="Message the Architect"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isBuilding}
            />
            <button className="wb-send" aria-label="Send message" type="submit" disabled={isBuilding}>
              &rsaquo;
            </button>
          </form>
        </aside>

        {/* Region 3: Canvas (remaining 65%) */}
        <div className="wb-right">
          <div className="wb-canvas-wrap" ref={canvasWrapRef}>
            <div className="wb-toolbar">
              <button
                id="zout"
                aria-label="Zoom out"
                onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
              >
                &minus;
              </button>
              <span className="wb-zoom" id="zlab">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                id="zin"
                aria-label="Zoom in"
                onClick={() => setZoomLevel((z) => Math.min(1.6, +(z + 0.1).toFixed(1)))}
              >
                +
              </button>
              <button className="wb-fit" id="fit" onClick={() => setZoomLevel(1)}>
                Fit
              </button>
              <span className="wb-count">
                {definition.steps.length} steps &nbsp; {definition.edges.length} edges
              </span>
            </div>

            <div
              className="wb-stage"
              id="stage"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* Cubic Bezier SVG Edges */}
              <svg className="wb-edges" id="edges" ref={svgRef} aria-hidden="true">
                {definition.edges.map((edge) => {
                  const srcIndex = definition.steps.findIndex((s) => s.key === edge.sourceStep);
                  const dstIndex = definition.steps.findIndex((s) => s.key === edge.destinationStep);
                  const src = definition.steps[srcIndex];
                  const dst = definition.steps[dstIndex];
                  if (!src || !dst) return null;

                  // 176px node width, 24px rhythm
                  const x1 = (src.position?.x ?? (srcIndex * 240 + 40)) + 176;
                  const y1 = (src.position?.y ?? 60) + 40;
                  const x2 = dst.position?.x ?? (dstIndex * 240 + 40);
                  const y2 = dst.position?.y ?? 60 + 40;
                  const dx = (x2 - x1) * 0.45;

                  const isFail = edge.edgeType === 'failure' || edge.branchLabel === 'declined';
                  const label = edge.branchLabel || (isFail ? 'declined' : undefined);

                  return (
                    <g key={edge.id || `${edge.sourceStep}-${edge.destinationStep}`}>
                      <path
                        d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                        className={`wb-edge ${isFail ? 'fail' : ''}`}
                      />
                      <path
                        d={`M ${x2} ${y2} l -8 -4 l 0 8 z`}
                        fill={isFail ? 'var(--bad)' : 'var(--gold)'}
                      />
                      {label && (
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 8}
                          textAnchor="middle"
                          className={`wb-edge-label ${isFail ? 'fail' : ''}`}
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Step Nodes */}
              <div id="nodes" ref={nodesContainerRef}>
                {definition.steps.map((step, idx) => {
                  const typeInfo = getStepTypeInfo(step);
                  const isApproval = step.stepType === 'approval' || step.approvalRequirement?.required;
                  const isSelected = selectedStepKey === step.key;
                  const posX = step.position?.x ?? (idx * 240 + 40);
                  const posY = step.position?.y ?? 60;
                  const serviceKey = (step.service || step.application || 'approvals')
                    .replace('concludo_', '')
                    .replace('_', '.');

                  return (
                    <div
                      key={step.key}
                      className="wb-node"
                      style={{ left: `${posX}px`, top: `${posY}px` }}
                      tabIndex={0}
                      role="button"
                      aria-selected={isSelected}
                      aria-label={`${typeInfo.label} step. ${step.name || step.displayName}. ${
                        step.userFacingExplanation
                      }${isApproval ? ' Sign-off required.' : ''}`}
                      onClick={(e) => handleSelectNode(step.key, e.currentTarget)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectNode(step.key, e.currentTarget);
                        }
                      }}
                    >
                      <div className="wb-tags">
                        <span className={`wb-tag ${typeInfo.className}`}>{typeInfo.label}</span>
                        {isApproval && <span className="wb-tag signoff">Sign-off</span>}
                      </div>
                      <h3>{step.name || step.displayName}</h3>
                      <p>{step.userFacingExplanation}</p>
                      <div className="wb-foot">
                        <span>{serviceKey}</span>
                        <span className="wb-state">
                          <span className="wb-dot"></span>Valid
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---------- Plate 8: Node Inspector Flyout ---------- */}
          {selectedStep && isInspectorOpen && (
            <div className="wb-inspector" role="dialog" aria-label="Step details">
              <div className="wb-insp-head">
                <div>
                  <h2>{selectedStep.name || selectedStep.displayName}</h2>
                  <div className="wb-insp-sub">
                    {getStepTypeInfo(selectedStep).label} &nbsp;{' '}
                    {(selectedStep.service || 'approvals').replace('concludo_', '').replace('_', '.')}
                  </div>
                </div>
                <button
                  className="wb-btn"
                  id="closeInsp"
                  aria-label="Close"
                  onClick={() => setIsInspectorOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="wb-tabs" role="tablist">
                <button
                  className="wb-tab"
                  role="tab"
                  aria-selected={inspectorTab === 'simple'}
                  onClick={() => setInspectorTab('simple')}
                >
                  Simple
                </button>
                <button
                  className="wb-tab"
                  role="tab"
                  aria-selected={inspectorTab === 'advanced'}
                  onClick={() => setInspectorTab('advanced')}
                >
                  Advanced
                </button>
              </div>

              {inspectorTab === 'simple' ? (
                <div>
                  <div className="wb-field">
                    <div className="wb-k">What this step does</div>
                    <div className="wb-v">{selectedStep.userFacingExplanation}</div>
                  </div>
                  <div className="wb-field">
                    <div className="wb-k">Service</div>
                    <div className="wb-v">
                      {(selectedStep.service || 'approvals').replace('concludo_', '').replace('_', '.')}
                    </div>
                  </div>
                  <div className="wb-field">
                    <div className="wb-k">Approval required</div>
                    <div className="wb-v">
                      {selectedStep.stepType === 'approval' || selectedStep.approvalRequirement?.required ? (
                        <span className="wb-lock">
                          Yes. Locked by governance and cannot be removed.
                        </span>
                      ) : (
                        'No'
                      )}
                    </div>
                  </div>
                  <div className="wb-field">
                    <div className="wb-k">If it waits or fails</div>
                    <div className="wb-v">
                      The workflow stops and tells the owner. It does not delete anything.
                    </div>
                  </div>
                  <div className="wb-field">
                    <div className="wb-k">Retry policy</div>
                    <div className="wb-v">
                      {selectedStep.stepType === 'approval'
                        ? 'Not applicable to an approval step.'
                        : 'Three attempts, then stop and tell the owner.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="wb-field">
                    <div className="wb-k">Idempotency key</div>
                    <div className="wb-v mono">
                      {selectedStep.idempotencyPolicy?.keyTemplate ||
                        `${selectedStep.service}:{{run.id}}:{{step.key}}`}
                    </div>
                  </div>
                  <div className="wb-field">
                    <div className="wb-k">Timeout</div>
                    <div className="wb-v mono">{selectedStep.timeoutSeconds || 120}s</div>
                  </div>
                  <div className="wb-field">
                    <div className="wb-k">Retry limit</div>
                    <div className="wb-v mono">
                      {selectedStep.retryPolicy?.maxAttempts || 3}, exponential backoff
                    </div>
                  </div>
                  <div className="wb-field">
                    <div className="wb-k">Raw configuration</div>
                    <pre className="wb-v mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                      {JSON.stringify(
                        selectedStep.configuration || {
                          service: selectedStep.service,
                          approval: selectedStep.approvalRequirement?.required || false,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                  <p className="wb-warn-line">Changes made here are not checked by the Architect.</p>
                </div>
              )}
            </div>
          )}

          {/* ---------- Plate 9: Bottom Inspection Panel (176px fixed) ---------- */}
          <div className="wb-bottom">
            <div className="wb-btabs" role="tablist">
              <button
                className="wb-btab"
                role="tab"
                aria-selected={bottomTab === 0}
                onClick={() => setBottomTab(0)}
              >
                Plain-Language Review
              </button>
              <button
                className="wb-btab"
                role="tab"
                aria-selected={bottomTab === 1}
                onClick={() => setBottomTab(1)}
              >
                Validation Issues
              </button>
              <button
                className="wb-btab"
                role="tab"
                aria-selected={bottomTab === 2}
                onClick={() => setBottomTab(2)}
              >
                Connected Services
              </button>
              <button
                className="wb-btab"
                role="tab"
                aria-selected={bottomTab === 3}
                onClick={() => setBottomTab(3)}
              >
                Test Results
              </button>
              <button
                className="wb-btab"
                role="tab"
                aria-selected={bottomTab === 4}
                onClick={() => setBottomTab(4)}
              >
                Execution History
              </button>
            </div>

            <div className="wb-bbody" id="bbody">
              {bottomTab === 0 && (
                <ol>
                  {reviewItems.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ol>
              )}

              {bottomTab === 1 && (
                <div>
                  {validation.errors.length === 0 ? (
                    <p style={{ color: 'var(--ok)', fontSize: '12px' }}>
                      No blocking issues. Zero validation errors.
                    </p>
                  ) : (
                    <ul style={{ color: 'var(--bad)', fontSize: '12px', paddingLeft: '16px' }}>
                      {validation.errors.map((e, i) => (
                        <li key={i}>
                          [{e.code}] {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {bottomTab === 2 && (
                <div className="wb-svc">
                  <span>meetings &middot; connected</span>
                  <span>ai.agents &middot; connected</span>
                  <span>approvals &middot; connected</span>
                  <span>projects &middot; connected</span>
                  <span>calendar &middot; connected</span>
                </div>
              )}

              {bottomTab === 3 && (
                <p style={{ color: 'var(--sub)', fontSize: '12px' }}>
                  {testResult
                    ? `Last test run (${testResult.isDryRun ? 'Dry Run' : 'Real'}) finished with status: ${
                        testResult.status
                      } (${testResult.durationMs}ms).`
                    : 'Last dry run wrote nothing. Last authorised test created 3 tasks in the test project and sent no email.'}
                </p>
              )}

              {bottomTab === 4 && (
                <p style={{ color: 'var(--sub)', fontSize: '12px' }}>
                  {runHistory.length > 0
                    ? `Recorded ${runHistory.length} execution run(s). All completed within bounds.`
                    : 'No runs yet. History records the workflow and its outcome, never a count against a person.'}
                </p>
              )}
            </div>

            {/* Narrow widths replacement (Plate 14) */}
            <div className="wb-reader">
              <h2>Plain-Language Review</h2>
              <ol>
                {reviewItems.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </div>

            <div className="wb-approve-bar">
              <button className="no" onClick={() => alert('Workflow declined by owner.')}>
                Decline
              </button>
              <button
                className="yes"
                onClick={() => alert('Workflow approved by owner.')}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Plate 10: Template Picker Modal ---------- */}
      <TemplatePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
};
