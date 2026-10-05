import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowEdge,
  WorkflowBuildEvent,
} from '../../lib/workflows/schemas';
import {
  executeWorkflowArchitect,
  buildMeetingFollowthroughVerticalSlice,
} from '../../lib/workflows/workflowArchitectAgent';
import { validateWorkflowDefinition } from '../../lib/workflows/validation';
import { executeWorkflow, WorkflowRunRecord } from '../../lib/workflows/executionEngine';
import { calculateWorkflowRisk } from '../../lib/workflows/riskClassification';
import { CONNECTOR_MANIFESTS } from '../../lib/workflows/connectorRegistry';
import { WORKFLOW_TEMPLATES, WorkflowTemplateMeta } from '../../lib/workflows/templates';
import {
  RotateCcw,
  Network,
  ListOrdered,
  Sparkles,
  Layers,
  FileSearch,
  X,
  Code,
} from 'lucide-react';

import { TemplatePickerModal } from '../../components/workflows/TemplatePickerModal';
import { AddStepModal } from '../../components/workflows/AddStepModal';
import { ConnectedStepInspector } from '../../components/workflows/ConnectedStepInspector';
import { RealConnectionModal } from '../../components/integrations/RealConnectionModal';
import { WorkflowLifecyclePill, WorkflowUiState } from '../../components/workflows/WorkflowLifecyclePill';
import { PrimaryActionButton } from '../../components/workflows/PrimaryActionButton';
import { WorkflowMoreMenu } from '../../components/workflows/WorkflowMoreMenu';
import { WorkflowStepCard } from '../../components/workflows/WorkflowStepCard';
import { WorkflowStepsOutline } from '../../components/workflows/WorkflowStepsOutline';
import { WorkflowEmptyState } from '../../components/workflows/WorkflowEmptyState';
import { BuildProgressList } from '../../components/workflows/BuildProgressList';
import { ReviewCard, WhatChangedItem } from '../../components/workflows/ReviewCard';
import {
  integrationsHubService,
  IntegrationConnection,
  ProviderDefinition,
  INTEGRATION_PROVIDERS_CATALOG,
} from '../../lib/integrations/hubRegistry';

import './workflow-builder-template.css';

export function createEmptyWorkflowDefinition(userId?: string): WorkflowDefinition {
  return {
    schemaVersion: 1,
    workflowKey: `wf_${Date.now()}`,
    name: 'Untitled workflow',
    description: 'Custom workflow',
    version: 1,
    status: 'draft',
    organisationScope: { type: 'current_organisation' },
    owner: { type: 'user', value: userId || 'project_owner' },
    timezone: 'Australia/Melbourne',
    riskLevel: 'low',
    trigger: {
      triggerKey: 'manual.start',
      displayName: 'Manual Start',
      sourceService: 'system',
      configuration: {},
    },
    inputs: [],
    variables: [],
    steps: [],
    edges: [],
    errorHandling: {
      maxConsecutiveFailures: 3,
      notifyOwnerOnFailure: true,
    },
    audit: {
      recordExecutionHistory: true,
      auditClassification: 'standard',
    },
    monitoring: {},
    rollback: {
      canRollback: false,
    },
    layout: {
      nodes: {},
    },
  };
}

export const WorkflowBuilderPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Definition State (Starts empty for Stage A)
  const [definition, setDefinition] = useState<WorkflowDefinition>(() =>
    createEmptyWorkflowDefinition(user?.id)
  );

  // History stack for Undo
  const [historyStack, setHistoryStack] = useState<WorkflowDefinition[]>(() => [definition]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Stage & View Mode State
  const [stage, setStage] = useState<'A' | 'B' | 'C'>('A');
  const [activeCanvasView, setActiveCanvasView] = useState<'diagram' | 'steps'>('diagram');
  const [mobileTab, setMobileTab] = useState<'architect' | 'workflow' | 'review' | 'runs'>('workflow');

  // Integrations & Real Connectors
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [isAddStepOpen, setIsAddStepOpen] = useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [connectModalProvider, setConnectModalProvider] = useState<ProviderDefinition | null>(null);
  const [isRawDefinitionModalOpen, setIsRawDefinitionModalOpen] = useState<boolean>(false);

  // Load existing connections
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const conns = await integrationsHubService.getConnections();
        setConnections(conns);
      } catch (err) {
        console.warn('Could not load connections:', err);
      }
    };
    fetchConnections();
  }, []);

  // Conversation & Agent Architect State
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'architect'; content: string; timestamp?: string }>
  >([]);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [currentBrief, setCurrentBrief] = useState<string>('');
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [buildEvents, setBuildEvents] = useState<WorkflowBuildEvent[]>([]);
  const [plainLanguageExplanation, setPlainLanguageExplanation] = useState<string[]>([]);
  const [recentChanges, setRecentChanges] = useState<WhatChangedItem[] | undefined>(undefined);
  const [proposedStepKeys, setProposedStepKeys] = useState<Set<string>>(new Set());

  // Selected Node & Inspector
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  // Bottom Tabs (Collapsed by default to 40px)
  const [isDrawerExpanded, setIsDrawerExpanded] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<number>(0);

  // Viewport Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Execution & Testing
  const [testResult, setTestResult] = useState<WorkflowRunRecord | null>(null);
  const [testDefinitionHash, setTestDefinitionHash] = useState<string | null>(null);
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [stepTestStatuses, setStepTestStatuses] = useState<
    Record<string, 'passed' | 'failed' | 'skipped' | 'running'>
  >({});
  const [runHistory, setRunHistory] = useState<WorkflowRunRecord[]>([]);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  // Validation
  const validation = useMemo(() => validateWorkflowDefinition(definition), [definition]);

  // Push new definition to history stack
  const updateDefinitionWithHistory = (newDef: WorkflowDefinition, newProposed?: Set<string>) => {
    const nextIndex = historyIndex + 1;
    const nextStack = [...historyStack.slice(0, nextIndex), newDef];
    setHistoryStack(nextStack);
    setHistoryIndex(nextIndex);
    setDefinition(newDef);
    if (newProposed) setProposedStepKeys(newProposed);
    // Invalidate test results on edit
    setTestResult(null);
    setTestDefinitionHash(null);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setDefinition(historyStack[prevIndex]);
      setProposedStepKeys(new Set());
      setRecentChanges(undefined);
    }
  };

  const handleKeepChanges = () => {
    setProposedStepKeys(new Set());
    setRecentChanges(undefined);
  };

  // Connected apps check
  const activeConnectedSlugs = useMemo(() => {
    return new Set(connections.filter((c) => c.status === 'connected').map((c) => c.provider_id));
  }, [connections]);

  const missingConnections = useMemo(() => {
    const list: Array<{ stepKey: string; appName: string }> = [];
    definition.steps.forEach((s) => {
      const app = s.application || '';
      const isInternal =
        !app || app.startsWith('concludo_') || app === 'logic' || app === 'system';
      if (!isInternal && !activeConnectedSlugs.has(app)) {
        list.push({
          stepKey: s.key,
          appName: app.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        });
      }
    });
    return list;
  }, [definition.steps, activeConnectedSlugs]);

  const unconnectedStepKeys = useMemo(() => {
    return new Set(missingConnections.map((m) => m.stepKey));
  }, [missingConnections]);

  // Derived UI State (first match wins per 3.2)
  const currentDefHash = useMemo(() => JSON.stringify(definition), [definition]);
  const isTestResultValidForCurrentDef = testDefinitionHash === currentDefHash;

  const derivedUiState: WorkflowUiState = useMemo(() => {
    if (isBuilding) return 'building';
    if (isRunningTest) return 'testing';
    if (definition.steps.length === 0) return 'empty';
    if (definition.status === 'paused') return 'paused';
    if (definition.status === 'published') return 'active';
    if (definition.status === 'submitted_for_review') return 'waiting_sign_off';
    if (recentChanges && recentChanges.length > 0) return 'review_changes';
    if (validation.errors.length > 0 || missingConnections.length > 0) return 'needs_attention';
    if (isTestResultValidForCurrentDef && testResult) {
      return testResult.status === 'completed' ? 'ready_to_activate' : 'test_failed';
    }
    return 'ready_to_test';
  }, [
    isBuilding,
    isRunningTest,
    definition.steps.length,
    definition.status,
    recentChanges,
    validation.errors.length,
    missingConnections.length,
    isTestResultValidForCurrentDef,
    testResult,
  ]);

  const effectiveRiskLevel = useMemo(() => {
    try {
      return calculateWorkflowRisk(definition).effectiveRisk;
    } catch {
      return definition.riskLevel || 'low';
    }
  }, [definition]);

  const isHighOrRestricted = effectiveRiskLevel === 'high' || effectiveRiskLevel === 'restricted';

  // Handle building new workflow from brief
  const handleBuildWorkflow = async (brief: string) => {
    setCurrentBrief(brief);
    setClarificationQuestion(null);
    setIsBuilding(true);
    setStage('B');

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: brief,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await executeWorkflowArchitect({
        naturalLanguagePrompt: brief,
        connectedApplications: connections.map((c) => c.provider_id),
        mode: 'build',
      });

      setBuildEvents(result.buildEvents || []);

      if (result.buildStatus === 'needs_clarification') {
        const question = result.questions?.[0] || 'Could you clarify what should trigger this workflow?';
        setClarificationQuestion(question);
        setMessages((prev) => [
          ...prev,
          {
            id: `arch_${Date.now()}`,
            role: 'architect',
            content: question,
          },
        ]);
        setStage('A');
        setIsBuilding(false);
        return;
      }

      const generatedDef = result.workflowDefinition;
      setPlainLanguageExplanation(result.plainLanguageExplanation || []);
      updateDefinitionWithHistory(generatedDef);

      if (generatedDef.steps.length > 0) {
        setSelectedStepKey(generatedDef.steps[0].key);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `arch_${Date.now()}`,
          role: 'architect',
          content: result.plainLanguageExplanation?.join(' ') || 'Workflow synthesised successfully.',
        },
      ]);
    } catch (err: any) {
      console.error('Build workflow error:', err);
      setStage('A');
    } finally {
      setIsBuilding(false);
    }
  };

  // Handle conversational edit
  const handleSendEditMessage = async (promptText: string) => {
    setIsBuilding(true);
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: promptText,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await executeWorkflowArchitect({
        naturalLanguagePrompt: promptText,
        existingDefinition: definition,
        connectedApplications: connections.map((c) => c.provider_id),
      });

      if (result.mode === 'explain') {
        setMessages((prev) => [
          ...prev,
          {
            id: `arch_${Date.now()}`,
            role: 'architect',
            content: result.answer?.join('\n') || 'Explanation generated.',
          },
        ]);
        setIsBuilding(false);
        return;
      }

      if (result.buildStatus === 'needs_clarification') {
        const question =
          result.questions?.[0] || result.answer?.[0] || 'Could you clarify what you would like to change?';
        setMessages((prev) => [
          ...prev,
          {
            id: `arch_${Date.now()}`,
            role: 'architect',
            content: question,
          },
        ]);
        setIsBuilding(false);
        return;
      }

      if (result.buildStatus === 'failed') {
        setMessages((prev) => [
          ...prev,
          {
            id: `arch_${Date.now()}`,
            role: 'architect',
            content: result.answer?.join('\n') || 'Unable to apply this change safely.',
          },
        ]);
        setIsBuilding(false);
        return;
      }

      // Applied Edit
      const nextDef = result.workflowDefinition;
      setPlainLanguageExplanation(result.plainLanguageExplanation || []);

      const changesList: WhatChangedItem[] = (result.changes || []).map((c) => {
        let type: WhatChangedItem['type'] = 'CHANGED';
        const kind = c.kind || '';
        if (kind === 'added') type = 'ADDED';
        else if (kind === 'removed') type = 'REMOVED';
        else if (kind === 'moved') type = 'MOVED';
        else if (kind === 'renamed') type = 'RENAMED';
        return { type, description: c.summary || `${c.kind} step ${c.stepKey || ''}` };
      });
      setRecentChanges(changesList);

      // Identify newly added steps as proposed
      const existingStepKeys = new Set(definition.steps.map((s: WorkflowStep) => s.key));
      const newStepKeys = new Set<string>(
        nextDef.steps.filter((s: WorkflowStep) => !existingStepKeys.has(s.key)).map((s: WorkflowStep) => s.key)
      );
      updateDefinitionWithHistory(nextDef, newStepKeys);

      setMessages((prev) => [
        ...prev,
        {
          id: `arch_${Date.now()}`,
          role: 'architect',
          content: `Updated workflow: ${result.changes?.map((c) => c.summary).join(', ') || 'Changes applied.'}`,
        },
      ]);
    } catch (err: any) {
      console.error('Edit error:', err);
    } finally {
      setIsBuilding(false);
    }
  };

  // Run dry run test
  const handleRunTest = async () => {
    setIsRunningTest(true);
    setTestNotice('Concludo runs each step with sample data. Nothing is sent, created or changed.');

    const initialStatuses: Record<string, 'passed' | 'failed' | 'skipped' | 'running'> = {};
    definition.steps.forEach((s) => {
      initialStatuses[s.key] = 'running';
    });
    setStepTestStatuses(initialStatuses);

    try {
      const res = await executeWorkflow({
        workflow: definition,
        inputs: {
          testMode: true,
          meetingId: 'demo_meeting_123',
          timestamp: new Date().toISOString(),
        },
        isDryRun: true,
      });

      setTestResult(res);
      setTestDefinitionHash(JSON.stringify(definition));
      setRunHistory((prev) => [res, ...prev]);

      const updatedStatuses: Record<string, 'passed' | 'failed' | 'skipped' | 'running'> = {};
      definition.steps.forEach((s) => {
        const isApproval = s.stepType === 'approval' || s.approvalRequirement?.required;
        if (isApproval) {
          updatedStatuses[s.key] = 'skipped';
        } else {
          updatedStatuses[s.key] = res.status === 'completed' ? 'passed' : 'failed';
        }
      });
      setStepTestStatuses(updatedStatuses);
    } catch (err: any) {
      console.error('Test run failed:', err);
    } finally {
      setIsRunningTest(false);
    }
  };

  // Primary action button handler
  const handlePrimaryAction = (actionType: string) => {
    switch (actionType) {
      case 'build':
        setStage('A');
        break;
      case 'test':
      case 'fix_and_retest':
        handleRunTest();
        break;
      case 'activate':
        if (isHighOrRestricted) {
          setDefinition((prev) => ({ ...prev, status: 'submitted_for_review' }));
        } else {
          setDefinition((prev) => ({ ...prev, status: 'published', version: prev.version + 1 }));
        }
        break;
      case 'pause':
        setDefinition((prev) => ({ ...prev, status: 'paused' }));
        break;
      case 'resume':
        setDefinition((prev) => ({ ...prev, status: 'published' }));
        break;
      case 'keep_changes':
        handleKeepChanges();
        break;
      case 'fix_issue':
        if (missingConnections.length > 0) {
          const appName = missingConnections[0].appName;
          const provider = INTEGRATION_PROVIDERS_CATALOG_LOOKUP(appName);
          if (provider) setConnectModalProvider(provider);
        } else if (validation.errors.length > 0) {
          setIsDrawerExpanded(true);
          setDrawerTab(1); // Validation tab
        }
        break;
      case 'stop_building':
        setIsBuilding(false);
        break;
    }
  };

  const handleSelectTemplate = (template: WorkflowTemplateMeta) => {
    setIsPickerOpen(false);
    const demo = buildMeetingFollowthroughVerticalSlice();
    demo.name = template.name;
    demo.workflowKey = `wf_${template.templateKey}_${Date.now()}`;
    updateDefinitionWithHistory(demo);
    setPlainLanguageExplanation([template.description]);
    setStage('C');
  };

  const handleBuildManually = () => {
    const emptyDef = createEmptyWorkflowDefinition(user?.id);
    updateDefinitionWithHistory(emptyDef);
    setStage('C');
  };

  const handleAddCustomStep = (stepInput: Partial<WorkflowStep>) => {
    setIsAddStepOpen(false);
    const fullStep: WorkflowStep = {
      key: stepInput.key || `step_${Date.now()}`,
      displayName: stepInput.displayName || 'Custom step',
      name: stepInput.name || stepInput.displayName || 'Custom step',
      stepType: stepInput.stepType || 'action',
      purpose: stepInput.purpose || 'Custom step action',
      application: stepInput.application || 'system',
      service: stepInput.service || stepInput.application || 'system',
      inputMapping: stepInput.inputMapping || {},
      outputSchema: stepInput.outputSchema || {},
      configuration: stepInput.configuration || {},
      position: stepInput.position || { x: definition.steps.length * 240 + 40, y: 60 },
      userFacingExplanation: stepInput.userFacingExplanation || 'Executes custom action.',
      approvalRequirement: stepInput.approvalRequirement,
      retryPolicy: stepInput.retryPolicy,
      idempotencyPolicy: stepInput.idempotencyPolicy,
    };

    const updatedSteps = [...definition.steps, fullStep];
    let updatedEdges = [...definition.edges];

    if (definition.steps.length > 0) {
      const lastStep = definition.steps[definition.steps.length - 1];
      const newEdge: WorkflowEdge = {
        id: `e_${lastStep.key}_${fullStep.key}`,
        sourceStep: lastStep.key,
        sourceStepKey: lastStep.key,
        destinationStep: fullStep.key,
        destinationStepKey: fullStep.key,
        edgeType: 'success',
      };
      updatedEdges.push(newEdge);
    }

    const updatedDef: WorkflowDefinition = {
      ...definition,
      steps: updatedSteps,
      edges: updatedEdges,
    };
    updateDefinitionWithHistory(updatedDef);
    setSelectedStepKey(fullStep.key);
    setIsInspectorOpen(true);
  };

  const selectedStep = useMemo(() => {
    return definition.steps.find((s) => s.key === selectedStepKey) || null;
  }, [definition.steps, selectedStepKey]);

  return (
    <div className="wb-app">
      {/* 3.1 Header: Back link, name, lifecycle pill, Undo, Primary Button, More */}
      <header className="wb-head" role="banner">
        <div className="wb-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            to="/workflows"
            className="wb-back"
            aria-label="Back to Workflows"
            style={{ color: 'var(--sub)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
          >
            &larr; <span style={{ marginLeft: '4px', fontSize: '13px' }}>Workflows</span>
          </Link>
          <span style={{ color: 'var(--navy2)', fontSize: '16px' }}>/</span>
          <span
            style={{
              fontFamily: 'var(--font-h)',
              fontSize: '14.5px',
              fontWeight: 600,
              color: 'var(--light)',
            }}
          >
            {definition.name}
          </span>
          <WorkflowLifecyclePill uiState={derivedUiState} />
        </div>

        <div className="wb-right-acts" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {stage !== 'A' && (
            <button
              type="button"
              className="wb-icon-btn"
              aria-label="Undo"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              style={{
                background: 'transparent',
                border: '1px solid var(--navy2)',
                borderRadius: '6px',
                color: historyIndex > 0 ? 'var(--light)' : 'var(--sub)',
                padding: '6px 8px',
                cursor: historyIndex > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: historyIndex > 0 ? 1 : 0.5,
              }}
              title="Undo"
            >
              <RotateCcw size={15} />
            </button>
          )}

          {stage !== 'A' && (
            <PrimaryActionButton
              uiState={derivedUiState}
              isHighOrRestrictedRisk={isHighOrRestricted}
              onAction={handlePrimaryAction}
              disabled={isRunningTest}
            />
          )}

          <WorkflowMoreMenu
            onOpenTemplates={() => setIsPickerOpen(true)}
            onOpenRawDefinition={() => setIsRawDefinitionModalOpen(true)}
            onSimulatedTest={() => handleRunTest()}
            canRollback={definition.version > 1}
            onRollback={() => {
              setDefinition((prev) => ({ ...prev, version: Math.max(1, prev.version - 1) }));
            }}
          />
        </div>
      </header>

      {/* Stage A: Single Centred Column Empty State */}
      {stage === 'A' && (
        <WorkflowEmptyState
          connections={connections}
          onBuild={handleBuildWorkflow}
          onOpenTemplates={() => setIsPickerOpen(true)}
          onBuildManually={handleBuildManually}
          onConnectAnotherApp={() => setIsAddStepOpen(true)}
          isBuilding={isBuilding}
          initialBrief={currentBrief}
          clarificationQuestion={clarificationQuestion || undefined}
        />
      )}

      {/* Stage B & C: Split Screen Layout */}
      {stage !== 'A' && (
        <div className="wb-split" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Panel: Stage B Progress List OR Stage C Review Card */}
          <aside
            className="wb-architect"
            aria-label="Concludo Workflow Architect"
            style={{
              width: '35%',
              minWidth: '340px',
              maxWidth: '460px',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--navy)',
              borderRight: '1px solid var(--navy2)',
              overflow: 'hidden',
            }}
          >
            {stage === 'B' ? (
              <BuildProgressList
                events={buildEvents}
                brief={currentBrief}
                onFinish={() => setStage('C')}
              />
            ) : (
              <ReviewCard
                definition={definition}
                plainLanguageExplanation={plainLanguageExplanation}
                riskSentence={
                  isHighOrRestricted
                    ? 'A person must approve this before it can run.'
                    : undefined
                }
                missingConnections={missingConnections}
                validationErrors={validation.errors}
                changes={recentChanges}
                onKeepChanges={handleKeepChanges}
                onUndoChanges={handleUndo}
                onConnectApp={(appName) => {
                  const prov = INTEGRATION_PROVIDERS_CATALOG_LOOKUP(appName);
                  if (prov) setConnectModalProvider(prov);
                }}
                onSelectStep={(key) => {
                  setSelectedStepKey(key);
                  setIsInspectorOpen(true);
                }}
                messages={messages}
                onSendMessage={handleSendEditMessage}
                isBuilding={isBuilding}
              />
            )}
          </aside>

          {/* Right Region: Canvas / Steps Outline */}
          <div
            className="wb-right"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              position: 'relative',
              background: 'var(--ground)',
              overflow: 'hidden',
            }}
          >
            {/* View Switcher: Diagram vs Steps Toggle */}
            <div
              style={{
                position: 'absolute',
                top: '14px',
                left: '16px',
                zIndex: 10,
                display: 'flex',
                background: 'var(--surface)',
                border: '1px solid var(--navy2)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveCanvasView('diagram')}
                style={{
                  background: activeCanvasView === 'diagram' ? 'var(--navy2)' : 'transparent',
                  color: activeCanvasView === 'diagram' ? 'var(--light)' : 'var(--sub)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-m)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Network size={13} />
                <span>Diagram</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCanvasView('steps')}
                style={{
                  background: activeCanvasView === 'steps' ? 'var(--navy2)' : 'transparent',
                  color: activeCanvasView === 'steps' ? 'var(--light)' : 'var(--sub)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-m)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ListOrdered size={13} />
                <span>Steps</span>
              </button>
            </div>

            {/* Test notice banner if run */}
            {testNotice && (
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: '200px',
                  right: '180px',
                  zIndex: 9,
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid var(--blue)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  color: 'var(--light)',
                  fontFamily: 'var(--font-m)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{testNotice}</span>
                <button
                  type="button"
                  onClick={() => setTestNotice(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>
            )}

            {/* Canvas View: Diagram */}
            {activeCanvasView === 'diagram' && (
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
                  <button
                    className="wb-fit"
                    style={{
                      background: 'var(--gold)',
                      color: 'var(--navy)',
                      fontWeight: 700,
                      marginLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={() => setIsAddStepOpen(true)}
                    title="Add integration step"
                  >
                    + Add Step
                  </button>
                  <span className="wb-count">
                    {definition.steps.length} steps &nbsp; {definition.edges.length} edges
                  </span>
                </div>

                <div className="wb-stage" id="stage" style={{ transform: `scale(${zoomLevel})` }}>
                  {/* SVG Edges */}
                  <svg className="wb-edges" id="edges" ref={svgRef} aria-hidden="true">
                    {definition.edges.map((edge) => {
                      const srcKey = edge.sourceStepKey ?? edge.sourceStep;
                      const dstKey = edge.destinationStepKey ?? edge.destinationStep;
                      const srcIndex = definition.steps.findIndex((s) => s.key === srcKey);
                      const dstIndex = definition.steps.findIndex((s) => s.key === dstKey);
                      const src = definition.steps[srcIndex];
                      const dst = definition.steps[dstIndex];
                      if (!src || !dst) return null;

                      const x1 = (src.position?.x ?? srcIndex * 240 + 40) + 176;
                      const y1 = (src.position?.y ?? 60) + 40;
                      const x2 = dst.position?.x ?? dstIndex * 240 + 40;
                      const y2 = (dst.position?.y ?? 60) + 40;
                      const dx = (x2 - x1) * 0.45;

                      const isFail =
                        edge.edgeType === 'failure' ||
                        edge.edgeType === 'approval_rejected' ||
                        edge.branchLabel === 'declined';
                      const label = edge.branchLabel || (isFail ? 'declined' : undefined);

                      return (
                        <g key={edge.id || `${srcKey}-${dstKey}`}>
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

                  {/* Nodes */}
                  <div id="nodes">
                    {definition.steps.map((step, idx) => (
                      <WorkflowStepCard
                        key={step.key}
                        step={step}
                        index={idx}
                        isSelected={selectedStepKey === step.key}
                        isProposed={proposedStepKeys.has(step.key)}
                        testStatus={stepTestStatuses[step.key]}
                        missingConnection={unconnectedStepKeys.has(step.key)}
                        validationError={
                          validation.errors.find((e) => e.stepKey === step.key)?.message
                        }
                        onClick={(key) => {
                          setSelectedStepKey(key);
                          setIsInspectorOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Canvas View: Steps Outline */}
            {activeCanvasView === 'steps' && (
              <WorkflowStepsOutline
                definition={definition}
                selectedStepKey={selectedStepKey}
                onSelectStep={(key) => {
                  setSelectedStepKey(key);
                  setIsInspectorOpen(true);
                }}
                stepTestStatuses={stepTestStatuses}
                unconnectedStepKeys={unconnectedStepKeys}
              />
            )}

            {/* Inspector Flyout */}
            {selectedStep && isInspectorOpen && (
              <ConnectedStepInspector
                step={selectedStep}
                allSteps={definition.steps}
                connections={connections}
                onUpdateStep={(updated) => {
                  const updatedSteps = definition.steps.map((s) =>
                    s.key === updated.key ? updated : s
                  );
                  updateDefinitionWithHistory({ ...definition, steps: updatedSteps });
                }}
                onDeleteStep={(stepKey) => {
                  const updatedSteps = definition.steps.filter((s) => s.key !== stepKey);
                  const updatedEdges = definition.edges.filter(
                    (e) =>
                      (e.sourceStepKey ?? e.sourceStep) !== stepKey &&
                      (e.destinationStepKey ?? e.destinationStep) !== stepKey
                  );
                  updateDefinitionWithHistory({
                    ...definition,
                    steps: updatedSteps,
                    edges: updatedEdges,
                  });
                  setIsInspectorOpen(false);
                }}
                onClose={() => setIsInspectorOpen(false)}
                onOpenConnectModal={(prov) => setConnectModalProvider(prov)}
              />
            )}

            {/* Bottom Drawer: 40px collapsed */}
            <div
              className={`wb-bottom ${isDrawerExpanded ? 'expanded' : 'collapsed'}`}
              style={{
                height: isDrawerExpanded ? '180px' : '40px',
                transition: 'height 0.2s ease',
                background: 'var(--surface)',
                borderTop: '1px solid var(--navy2)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                className="wb-btabs"
                role="tablist"
                style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  gap: '8px',
                }}
              >
                <button
                  className="wb-btab"
                  role="tab"
                  aria-selected={drawerTab === 0}
                  onClick={() => {
                    setDrawerTab(0);
                    setIsDrawerExpanded(true);
                  }}
                >
                  In plain English
                </button>
                <button
                  className="wb-btab"
                  role="tab"
                  aria-selected={drawerTab === 1}
                  onClick={() => {
                    setDrawerTab(1);
                    setIsDrawerExpanded(true);
                  }}
                >
                  Needs attention ({validation.errors.length + missingConnections.length})
                </button>
                <button
                  className="wb-btab"
                  role="tab"
                  aria-selected={drawerTab === 2}
                  onClick={() => {
                    setDrawerTab(2);
                    setIsDrawerExpanded(true);
                  }}
                >
                  Test
                </button>
                <button
                  className="wb-btab"
                  role="tab"
                  aria-selected={drawerTab === 3}
                  onClick={() => {
                    setDrawerTab(3);
                    setIsDrawerExpanded(true);
                  }}
                >
                  Runs ({runHistory.length})
                </button>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--sub)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-m)',
                    cursor: 'pointer',
                  }}
                >
                  {isDrawerExpanded ? 'Collapse \u2193' : 'Expand \u2191'}
                </button>
              </div>

              {isDrawerExpanded && (
                <div
                  className="wb-bbody"
                  style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', fontSize: '12px' }}
                >
                  {drawerTab === 0 && (
                    <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--light)', lineHeight: 1.5 }}>
                      {plainLanguageExplanation.length > 0 ? (
                        plainLanguageExplanation.map((line, i) => <li key={i}>{line}</li>)
                      ) : (
                        <li>No plain English summary available yet.</li>
                      )}
                    </ol>
                  )}

                  {drawerTab === 1 && (
                    <div>
                      {validation.errors.length === 0 && missingConnections.length === 0 ? (
                        <p style={{ color: 'var(--ok)', margin: 0 }}>
                          No blocking issues. Zero validation errors.
                        </p>
                      ) : (
                        <ul style={{ color: 'var(--bad)', margin: 0, paddingLeft: '18px' }}>
                          {missingConnections.map((c, i) => (
                            <li key={`mc-${i}`}>Connect {c.appName} to authorise workflow actions.</li>
                          ))}
                          {validation.errors.map((e, i) => (
                            <li key={`ve-${i}`}>
                              [{e.code}] {e.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {drawerTab === 2 && (
                    <p style={{ color: 'var(--sub)', margin: 0 }}>
                      {testResult
                        ? `Last test run finished with status: ${testResult.status} (${testResult.durationMs}ms).`
                        : 'No test has been run yet for this draft definition.'}
                    </p>
                  )}

                  {drawerTab === 3 && (
                    <p style={{ color: 'var(--sub)', margin: 0 }}>
                      {runHistory.length > 0
                        ? `Recorded ${runHistory.length} execution run(s). All completed within bounds.`
                        : 'No execution runs yet. Execution history records outcomes, never counts against people.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <TemplatePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      <AddStepModal
        isOpen={isAddStepOpen}
        onClose={() => setIsAddStepOpen(false)}
        onAddStep={handleAddCustomStep}
        onConnectProvider={(prov) => setConnectModalProvider(prov)}
        connections={connections}
        existingStepsCount={definition.steps.length}
      />

      <RealConnectionModal
        isOpen={!!connectModalProvider}
        provider={connectModalProvider}
        onClose={() => setConnectModalProvider(null)}
        onSuccess={(newConn) => {
          setConnections((prev) => [newConn, ...prev.filter((c) => c.id !== newConn.id)]);
          setConnectModalProvider(null);
        }}
      />

      {/* Raw Definition Modal (Advanced Inspection) */}
      {isRawDefinitionModalOpen && (
        <div
          className="wb-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="raw-def-title"
          onClick={() => setIsRawDefinitionModalOpen(false)}
        >
          <div
            className="wb-modal"
            style={{ maxWidth: '720px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wb-modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--navy2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} color="var(--gold)" />
                <h2 id="raw-def-title" style={{ margin: 0, fontSize: '16px', color: 'var(--light)' }}>
                  Raw Workflow Definition (SchemaVersion 1)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRawDefinitionModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', padding: '4px' }}
                aria-label="Close raw definition"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', marginTop: '12px', background: 'var(--ground)', padding: '12px', borderRadius: '6px', border: '1px solid var(--navy2)' }}>
              <pre style={{ margin: 0, fontSize: '11.5px', fontFamily: 'var(--font-m)', color: 'var(--light)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(definition, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper lookup for integration provider definition
function INTEGRATION_PROVIDERS_CATALOG_LOOKUP(appName: string): ProviderDefinition | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, '');
  const target = norm(appName);
  return (
    INTEGRATION_PROVIDERS_CATALOG.find(
      (p) => norm(p.id) === target || norm(p.name) === target || target.includes(norm(p.name))
    ) || null
  );
}
