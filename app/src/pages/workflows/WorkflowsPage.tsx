import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const [activeTab, setActiveTab] = useState<'workflows' | 'history'>('workflows');
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
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [wfData, execData] = await Promise.all([
        fetchWorkflows({ userId: user.id }),
        fetchWorkflowExecutions({ userId: user.id }),
      ]);
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

  const handleDeleteWorkflow = async (id: string) => {
    if (!user || !confirm('Are you sure you want to delete this workflow?')) return;
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
          ? 'Workflow triggered! Generated human approval request staged in Approval Centre.'
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
                ENTERPRISE WORKFLOW ORCHESTRATION
              </span>
              <span className="text-xs text-gray-400">Triggers & Execution Pipelines</span>
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mt-1">
              Workflow Builder & Orchestrator
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Connect triggers, conditions, and operational actions with Human-in-the-Loop governance.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/approvals"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-white border border-[#21395C] rounded-lg text-sm font-medium transition"
            >
              Approval Centre
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] font-semibold rounded-lg text-sm transition shadow"
            >
              + Create Workflow
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {triggerMessage && (
          <div className="bg-[#16263F] border border-[#E2B53C]/40 text-[#E2B53C] p-4 rounded-xl text-sm flex items-center justify-between">
            <span>{triggerMessage}</span>
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
        <div className="flex border-b border-[#21395C] space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'workflows'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Configured Workflows ({workflows.length})
          </button>
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
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-[#E2B53C] text-[#0E1726] font-semibold rounded-lg text-xs"
                >
                  Create First Workflow
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
                            wf.is_active
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}
                        >
                          {wf.is_active ? 'Active' : 'Paused'}
                        </span>

                        <span className="text-[11px] text-[#E2B53C] bg-[#E2B53C]/10 border border-[#E2B53C]/30 px-2 py-0.5 rounded">
                          {wf.execution_type === 'approval_required' ? 'Approval Required' : wf.execution_type}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold font-heading text-white mt-3">{wf.name}</h3>
                      {wf.description && (
                        <p className="text-xs text-gray-300 mt-1 line-clamp-2">{wf.description}</p>
                      )}

                      <div className="mt-4 pt-4 border-t border-[#21395C] space-y-2 text-xs">
                        <div>
                          <span className="text-gray-400">Trigger:</span>{' '}
                          <span className="text-white font-mono">{wf.trigger_type}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Actions:</span>{' '}
                          <span className="text-white">
                            {wf.actions?.map((a: any) => a.type).join(', ') || 'Default pipeline'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#21395C] flex items-center justify-between text-xs">
                      <button
                        onClick={() => handleToggleActive(wf)}
                        className="text-gray-400 hover:text-white"
                      >
                        {wf.is_active ? 'Pause' : 'Activate'}
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleTriggerWorkflow(wf.id)}
                          disabled={triggeringId === wf.id || !wf.is_active}
                          className="px-3 py-1 bg-[#21395C] hover:bg-[#E2B53C] hover:text-[#0E1726] text-white rounded font-medium disabled:opacity-50"
                        >
                          {triggeringId === wf.id ? 'Running...' : 'Test Run'}
                        </button>
                        <button
                          onClick={() => handleDeleteWorkflow(wf.id)}
                          className="text-red-400 hover:text-red-300 px-2 py-1"
                        >
                          Delete
                        </button>
                      </div>
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
