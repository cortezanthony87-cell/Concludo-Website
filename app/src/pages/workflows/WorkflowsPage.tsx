import { Plus, Boxes, Edit3, Play, Trash2, Sparkles, FolderKanban, Pause, Bookmark } from 'lucide-react';
import { isAnthonyOrAuthorizedTeam, savePermanentTemplate, fetchPermanentTemplates } from '../../lib/workflows/permanentTemplates';
import { WorkflowTemplateMeta } from '../../lib/workflows/templates';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { integrationsHubService, IntegrationConnection } from '../../lib/integrations/hubRegistry';
import { isUsable } from '../../lib/integrations/connectionStatus';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  WorkflowRecord,
  WorkflowExecutionRecord,
  WorkflowTriggerType,
  WorkflowActionType,
  WorkflowExecutionType,
} from '../../lib/workflows/types';
import {
  fetchWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  triggerWorkflow,
  fetchWorkflowExecutions,
} from '../../lib/workflows/workflowService';

const TRIGGER_OPTIONS: { value: WorkflowTriggerType; label: string }[] = [
  { value: 'meeting_completed', label: 'Meeting Completed' },
  { value: 'project_created', label: 'Project Created' },
  { value: 'project_updated', label: 'Project Updated' },
  { value: 'action_created', label: 'Action Created' },
  { value: 'action_completed', label: 'Action Completed' },
  { value: 'decision_created', label: 'Decision Created' },
  { value: 'decision_updated', label: 'Decision Updated' },
  { value: 'report_generated', label: 'Report Generated' },
  { value: 'workflow_schedule', label: 'Workflow Schedule' },
  { value: 'webhook_event', label: 'Webhook Event' },
];

const ACTION_OPTIONS: { value: WorkflowActionType; label: string }[] = [
  { value: 'generate_summary', label: 'Generate Summary' },
  { value: 'generate_report', label: 'Generate Report' },
  { value: 'create_tasks', label: 'Create Tasks' },
  { value: 'create_planner_task', label: 'Create Microsoft Planner Task' },
  { value: 'create_todo_task', label: 'Create Microsoft To Do Task' },
  { value: 'send_teams_message', label: 'Send Teams Message' },
  { value: 'send_slack_message', label: 'Send Slack Message' },
  { value: 'create_notion_page', label: 'Create Notion Page' },
  { value: 'create_crm_note', label: 'Create CRM Note' },
  { value: 'generate_approval_request', label: 'Generate Approval Request' },
];

export const WorkflowsPage: React.FC = () => {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecutionRecord[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [activeTab, setActiveTab] = useState<'workflows' | 'permanent' | 'history'>('workflows');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newWfName, setNewWfName] = useState<string>('');
  const [newWfDesc, setNewWfDesc] = useState<string>('');
  const [newWfTrigger, setNewWfTrigger] = useState<WorkflowTriggerType>('meeting_completed');
  const [newWfAction, setNewWfAction] = useState<WorkflowActionType>('generate_summary');
  const [newWfExecType, setNewWfExecType] = useState<WorkflowExecutionType>('approval_required');
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Triggering State
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const { profile } = useAuth();
  const isAuthorizedAdmin = isAnthonyOrAuthorizedTeam(user, profile);
  const [permanentTemplates, setPermanentTemplates] = useState<WorkflowTemplateMeta[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [wfData, execData, connData] = await Promise.all([
        fetchWorkflows({ userId: user.id }),
        fetchWorkflowExecutions({ userId: user.id }),
        integrationsHubService.getConnections().catch(() => []),
      ]);
      setConnections(connData);
      setWorkflows(wfData);
      setExecutions(execData);
    } catch (err: any) {
      setError('Failed to load workflows. Please check your permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (user && isAuthorizedAdmin) {
      fetchPermanentTemplates(user).then((tpls) => {
        setPermanentTemplates(tpls);
      });
    }
  }, [user, isAuthorizedAdmin]);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newWfName.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      await createWorkflow({
        owner_id: user.id,
        name: newWfName.trim(),
        description: newWfDesc.trim(),
        trigger_type: newWfTrigger,
        actions: [{ type: newWfAction, config: {} }],
        execution_type: newWfExecType,
      });
      setShowCreateModal(false);
      setNewWfName('');
      setNewWfDesc('');
      await loadData();
    } catch (err: any) {
      setCreateError(`Failed to create workflow: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (wf: WorkflowRecord) => {
    if (!user) return;
    try {
      await updateWorkflow(wf.id, { is_active: !wf.is_active }, user.id);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update workflow: ${err.message}`);
    }
  };

  const handleSavePermanentTemplate = async (wf: WorkflowRecord) => {
    if (!user) return;
    setSavingTemplateId(wf.id);
    try {
      const res = await savePermanentTemplate(wf, user);
      if (res.success) {
        setTriggerMessage(`Workflow "${wf.name}" saved to permanent templates! Your account and team can now access it anytime.`);
      } else {
        setTriggerMessage(res.error || 'Failed to save permanent template.');
      }
    } catch (err: any) {
      setTriggerMessage(`Error saving permanent template: ${err.message}`);
    } finally {
      setSavingTemplateId(null);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!user || !confirm('Are you sure you want to delete this workflow? It can be recovered within 30 days.')) return;
    try {
      await deleteWorkflow(id, user.id);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete workflow: ${err.message}`);
    }
  };

  const handleTriggerWorkflow = async (id: string) => {
    if (!user) return;
    setTriggeringId(id);
    setTriggerMessage(null);
    try {
      const result = await triggerWorkflow({
        workflowId: id,
        userId: user.id,
        triggerData: { manualTestRun: true, triggeredAt: new Date().toISOString() },
      });
      setTriggerMessage(
        result.approval
          ? 'Workflow pursued! Action item routed to Approval Centre for your sign-off. This step needs your approval if you want this workflow to activate.'
          : 'Workflow completed successfully.'
      );
      await loadData();
    } catch (err: any) {
      setTriggerMessage(`Failed to execute workflow: ${err.message}`);
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1726] text-[#F4F6FA] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#21395C] pb-6 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#E2B53C]/20 text-[#E2B53C] border border-[#E2B53C]/40">
                SAVED WORKFLOWS & ORCHESTRATION
              </span>
              <span className="text-xs text-gray-400">Triggers & Execution Pipelines</span>
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mt-1">
              Saved Workflows & Pipelines
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage your saved workflows file. Review, pursue on demand, edit in the visual builder, or pause and delete workflows.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/workflows/runs"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-white border border-[#21395C] rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
            >
              Workflow Runs
            </Link>
            <Link
              to="/workflows/governance"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-[#E2B53C] border border-[#E2B53C]/40 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
            >
              Governance Centre
            </Link>
            <Link
              to="/approvals"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-white border border-[#21395C] rounded-lg text-sm font-medium transition shadow-sm"
            >
              Approval Centre
            </Link>
            <Link
              to="/workflows/builder"
              className="px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] font-bold rounded-lg text-sm transition shadow flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#0E1726]" />
              <span>Create Workflow</span>
            </Link>
          </div>
        </div>

        {/* Feedback Messages */}
        {triggerMessage && (
          <div className="bg-[#16263F] border border-[#E2B53C]/40 text-[#E2B53C] p-4 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{triggerMessage}</span>
              <Link
                to="/approvals"
                className="text-white underline font-semibold ml-2 hover:text-[#E2B53C] transition"
              >
                Open Approval Centre &rarr;
              </Link>
            </div>
            <button onClick={() => setTriggerMessage(null)} className="text-xs text-gray-400 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
            <span>{error}</span>
            <button onClick={loadData} className="underline hover:text-white font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#21395C] gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'workflows'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Saved Workflows ({workflows.length})
          </button>
          {isAuthorizedAdmin && (
            <button
              onClick={() => setActiveTab('permanent')}
              className={`pb-3 border-b-2 transition ${
                activeTab === 'permanent'
                  ? 'border-[#E2B53C] text-[#E2B53C]'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Permanent Templates ({permanentTemplates.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Execution History ({executions.length})
          </button>
        </div>

        {/* Tab 1: Workflows List */}
        {activeTab === 'workflows' && (
          <div>
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading Workflows...</div>
            ) : workflows.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-[#21395C] rounded-xl p-8 space-y-4">
                <p className="text-gray-300 font-medium">No workflows configured yet.</p>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Create automated workflows to link completed meetings to summaries, tasks, and notifications with built-in human sign-off.
                </p>
                <Link
                  to="/workflows/builder"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] font-bold rounded-lg text-xs transition shadow"
                >
                  <Plus className="w-4 h-4 text-[#0E1726]" />
                  <span>Create First Workflow</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="bg-[#16263F] border border-[#21395C] hover:border-[#E2B53C]/70 rounded-2xl p-6 flex flex-col justify-between shadow-xl transition-all duration-200 relative overflow-hidden"
                    style={{ boxSizing: 'border-box' }}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        {(() => {
                          const isDraft = wf.status === "draft" || (wf.definition_json as any)?.status === "draft";
                          const statusLabel = !wf.is_active ? "Paused" : isDraft ? "Draft" : "Active";
                          const statusStyle = !wf.is_active
                            ? "bg-gray-800 text-gray-400 border border-gray-700"
                            : isDraft
                            ? "bg-slate-800 text-slate-300 border border-slate-600"
                            : "bg-emerald-950 text-emerald-400 border border-emerald-800";
                          return (
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md ${statusStyle}`}>
                              {statusLabel}
                            </span>
                          );
                        })()}

                        <span className="text-[11px] font-semibold text-[#E2B53C] bg-[#E2B53C]/10 border border-[#E2B53C]/30 px-2.5 py-0.5 rounded-md">
                          {wf.execution_type === 'approval_required' ? 'Approval Required' : wf.execution_type}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold font-heading text-white mt-3.5 leading-snug">{wf.name}</h3>
                      {wf.definition_json?.steps && Array.isArray((wf.definition_json as any).steps) && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#E2B53C] bg-[#E2B53C]/10 border border-[#E2B53C]/25 px-2.5 py-1 rounded-md w-fit">
                          <Sparkles className="w-3 h-3 text-[#E2B53C]" />
                          <span>Visual Workflow • {(wf.definition_json as any).steps.length} Steps</span>
                        </div>
                      )}

                      {(() => {
                        const usableSlugs = new Set(
                          connections.filter((c) => isUsable({ status: c.status, verified_at: (c as any).verified_at, last_test_at: (c as any).last_test_at, last_test_result: (c as any).last_test_result })).map((c) => c.provider_id)
                        );
                        const steps = (wf.definition_json as any)?.steps || [];
                        const unverifiedApps: string[] = [];
                        steps.forEach((s: any) => {
                          const app = s.application || "";
                          const isInternal = !app || app.startsWith("concludo_") || app === "logic" || app === "system" || app === "ai_agent";
                          if (!isInternal && !usableSlugs.has(app)) {
                            const name = app.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
                            if (!unverifiedApps.includes(name)) unverifiedApps.push(name);
                          }
                        });
                        if (unverifiedApps.length > 0) {
                          return (
                            <div className="mt-2 text-xs text-amber-400 font-medium flex items-center gap-1.5">
                              <span>Re-connect required: {unverifiedApps.join(", ")}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {wf.description && (
                        <p className="text-xs text-gray-300 mt-2 line-clamp-3 leading-relaxed">{wf.description}</p>
                      )}

                      <div className="mt-4 pt-3.5 border-t border-[#21395C] space-y-2 text-xs">
                        <div>
                          <span className="text-gray-400">Trigger:</span>{' '}
                          <span className="text-white font-mono bg-[#0E1726] px-1.5 py-0.5 rounded border border-[#21395C]">{wf.trigger_type}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Actions:</span>{' '}
                          <span className="text-white">
                            {wf.actions?.map((a: any) => a.type).join(', ') || 'Default pipeline'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Template Action Box - All Controls Strictly Contained Inside */}
                    <div className="mt-5 p-3.5 bg-[#0B1320] border border-[#21395C] rounded-xl space-y-2.5 w-full box-border">
                      {/* Row 1: Primary Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <Link
                          to={`/workflows/builder?id=${wf.id}`}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-[#E2B53C] to-[#BC8A1C] text-[#0E1726] font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition border border-[#E2B53C] hover:brightness-110"
                          title="Open and edit in visual workflow builder"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Open in Builder</span>
                        </Link>
                        <button
                          onClick={() => handleTriggerWorkflow(wf.id)}
                          disabled={triggeringId === wf.id}
                          className="w-full py-2.5 px-3 bg-[#16263F] hover:bg-[#21395C] text-[#E2B53C] border border-[#E2B53C] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                          title="Pursue / execute this workflow now"
                        >
                          <Play className="w-3 h-3" fill="currentColor" />
                          <span>{triggeringId === wf.id ? 'Running...' : 'Pursue / Run'}</span>
                        </button>
                      </div>

                      {/* Row 2: Pause and Delete (Separated Gold Boxes) */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {/* Option: Pause / Activate in Dedicated Gold Box */}
                        <button
                          onClick={() => handleToggleActive(wf)}
                          className="w-full py-2 px-2.5 bg-[#16263F] hover:bg-[#21395C] text-white hover:text-[#E2B53C] border border-[#E2B53C] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition"
                          title={wf.is_active ? 'Pause this workflow' : 'Activate this workflow'}
                        >
                            {wf.is_active ? (
                              <>
                                <Pause className="w-3 h-3 text-[#E2B53C]" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 text-[#E2B53C]" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>

                        {/* Option: Delete in Dedicated Gold Box with Two-Step Confirmation */}
                        <div className="w-full">
                          {confirmDeleteId === wf.id ? (
                            <div className="flex items-center justify-between w-full bg-[#16263F] border border-[#E2B53C] rounded-lg p-1 shadow">
                              <span className="text-[10px] text-[#E2B53C] px-1 font-semibold">Delete?</span>
                              <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  setConfirmDeleteId(null);
                                  try {
                                    await deleteWorkflow(wf.id, user?.id || "");
                                    await loadData();
                                  } catch (err: any) {
                                    alert("Failed to delete workflow: " + err.message);
                                  }
                                }}
                                className="px-2 py-1 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] rounded text-[10px] font-bold transition"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 bg-[#21395C] hover:bg-[#16263F] text-gray-300 rounded text-[10px] transition"
                              >
                                No
                              </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(wf.id)}
                              className="w-full py-2 px-2.5 bg-[#16263F] hover:bg-rose-950/30 text-[#E2B53C] hover:text-rose-300 border border-[#E2B53C] hover:border-rose-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition"
                              title="Delete this workflow"
                            >
                              <Trash2 className="w-3 h-3 text-[#E2B53C]" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Row 3: Save as Permanent Template (Anthony & Team Only) */}
                      {isAuthorizedAdmin && (
                        <div className="w-full pt-0.5">
                          <button
                            onClick={() => handleSavePermanentTemplate(wf)}
                            disabled={savingTemplateId === wf.id}
                            className="w-full py-2 px-3 bg-[#E2B53C]/10 hover:bg-[#E2B53C]/20 text-[#E2B53C] border border-[#E2B53C] rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow transition"
                            title="Save this workflow into permanent templates library (exclusive to your account and team)"
                          >
                            <Bookmark className="w-3.5 h-3.5 text-[#E2B53C]" />
                            <span>{savingTemplateId === wf.id ? 'Saving...' : 'Save as Permanent Template'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Permanent Templates (Executive & Team Only) */}
        {activeTab === 'permanent' && isAuthorizedAdmin && (
          <div>
            {permanentTemplates.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-[#21395C] rounded-xl p-8 space-y-4">
                <p className="text-gray-300 font-medium">No permanent templates saved yet.</p>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  You can save tested workflows from your Saved Workflows list directly into your permanent template library.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {permanentTemplates.map((tpl) => (
                  <div
                    key={tpl.templateKey}
                    className="bg-[#16263F] border border-[#E2B53C]/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl transition-all duration-200 relative overflow-hidden"
                    style={{ boxSizing: 'border-box' }}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-md bg-[#E2B53C]/10 text-[#E2B53C] border border-[#E2B53C]/40">
                          Permanent Template
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-md">
                          Verified & Tested
                        </span>
                      </div>
                      <h3 className="text-lg font-bold font-heading text-white mt-4 leading-snug">{tpl.name}</h3>
                      <p className="text-xs text-slate-300 mt-2.5 line-clamp-3 leading-relaxed">{tpl.description}</p>
                    </div>
                    <div className="mt-5 p-3.5 bg-[#0B1320] border border-[#21395C] rounded-xl w-full">
                      <Link
                        to={`/workflows/builder?template=${tpl.templateKey}`}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-[#E2B53C] to-[#BC8A1C] text-[#0E1726] font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow border border-[#E2B53C] hover:brightness-110 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Use Template in Builder</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Execution History */}
        {activeTab === 'history' && (
          <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-6">
            <h2 className="text-lg font-semibold font-heading text-white mb-4">Pipeline Execution History</h2>
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading History...</div>
            ) : executions.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No execution runs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0E1726]/60 text-gray-400 uppercase tracking-wider border-b border-[#21395C]">
                    <tr>
                      <th className="py-2.5 px-3">Workflow</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Steps Completed</th>
                      <th className="py-2.5 px-3">Executed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21395C]/50 text-gray-300">
                    {executions.map((ex) => (
                      <tr key={ex.id} className="hover:bg-[#21395C]/20 transition">
                        <td className="py-2.5 px-3 font-medium text-white">{ex.workflow?.name || 'Pipeline Run'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              ex.status === 'completed'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : ex.status === 'requires_approval'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-red-950 text-red-400 border border-red-800'
                            }`}
                          >
                            {ex.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{ex.execution_duration_ms}ms</td>
                        <td className="py-2.5 px-3">{ex.steps_completed?.length || 1} step(s)</td>
                        <td className="py-2.5 px-3 text-gray-400">
                          {new Date(ex.created_at).toLocaleString('en-AU')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Workflow Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#16263F] border border-[#21395C] rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>

              <h3 className="text-xl font-bold font-heading text-white mb-4">Create New Workflow</h3>

              {createError && (
                <div className="bg-red-900/30 border border-red-700 text-red-200 p-3 rounded-lg text-xs mb-4">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateWorkflow} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Workflow Name *</label>
                  <input
                    type="text"
                    required
                    value={newWfName}
                    onChange={(e) => setNewWfName(e.target.value)}
                    placeholder="e.g. Post-Meeting Executive Follow-Up"
                    className="w-full bg-[#0E1726] border border-[#21395C] rounded px-3 py-2 text-white focus:outline-none focus:border-[#E2B53C]"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-medium mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={newWfDesc}
                    onChange={(e) => setNewWfDesc(e.target.value)}
                    placeholder="Explain workflow purpose and governance targets"
                    className="w-full bg-[#0E1726] border border-[#21395C] rounded px-3 py-2 text-white focus:outline-none focus:border-[#E2B53C]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 font-medium mb-1">Trigger Event</label>
                    <select
                      value={newWfTrigger}
                      onChange={(e) => setNewWfTrigger(e.target.value as WorkflowTriggerType)}
                      className="w-full bg-[#0E1726] border border-[#21395C] rounded px-3 py-2 text-white focus:outline-none focus:border-[#E2B53C]"
                    >
                      {TRIGGER_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 font-medium mb-1">Target Action</label>
                    <select
                      value={newWfAction}
                      onChange={(e) => setNewWfAction(e.target.value as WorkflowActionType)}
                      className="w-full bg-[#0E1726] border border-[#21395C] rounded px-3 py-2 text-white focus:outline-none focus:border-[#E2B53C]"
                    >
                      {ACTION_OPTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 font-medium mb-1">Execution Governance Model</label>
                  <select
                    value={newWfExecType}
                    onChange={(e) => setNewWfExecType(e.target.value as WorkflowExecutionType)}
                    className="w-full bg-[#0E1726] border border-[#21395C] rounded px-3 py-2 text-white focus:outline-none focus:border-[#E2B53C]"
                  >
                    <option value="approval_required">Approval Required (Default - Human Sign-Off)</option>
                    <option value="automatic">Automatic (Internal Reports / Summaries Only)</option>
                    <option value="manual_only">Manual Only (Execute on Demand)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-[#21395C] flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-[#21395C] hover:bg-gray-700 text-white rounded font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] font-semibold rounded disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Workflow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default WorkflowsPage;
