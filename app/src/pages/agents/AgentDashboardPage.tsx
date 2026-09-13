import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { fetchWorkflowExecutions, fetchWorkflowApprovals } from '../../lib/workflows/workflowService';
import { WorkflowExecutionRecord, WorkflowApprovalRecord } from '../../lib/workflows/types';
import { INITIAL_AGENTS } from '../../lib/agents/types';

export const AgentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [executions, setExecutions] = useState<WorkflowExecutionRecord[]>([]);
  const [approvals, setApprovals] = useState<WorkflowApprovalRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [execData, appData] = await Promise.all([
        fetchWorkflowExecutions({ userId: user.id }),
        fetchWorkflowApprovals({ userId: user.id }),
      ]);
      setExecutions(execData);
      setApprovals(appData);
    } catch (err: any) {
      setError('Failed to load agents dashboard. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const completedExecs = executions.filter((e) => e.status === 'completed').length;
  const totalExecs = executions.length;
  const successRate = totalExecs > 0 ? Math.round((completedExecs / totalExecs) * 100) : 100;
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#0E1726] text-[#F4F6FA] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#21395C] pb-6 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#E2B53C]/20 text-[#E2B53C] border border-[#E2B53C]/40">
                ENTERPRISE OPERATIONAL ANALYTICS
              </span>
              <span className="text-xs text-gray-400">Live Orchestration Health</span>
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mt-1">
              Agent & Workflow Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Performance telemetry, active pipeline metrics, and governance oversight.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/agents"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-white border border-[#21395C] rounded-lg text-sm font-medium transition"
            >
              ← Back to Agents
            </Link>
            <Link
              to="/approvals"
              className="px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] font-semibold rounded-lg text-sm transition shadow"
            >
              Pending Approvals ({pendingApprovalsCount})
            </Link>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
            <span>{error}</span>
            <button onClick={loadDashboardData} className="underline hover:text-white font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-5">
            <span className="text-xs text-gray-400 uppercase font-semibold">Active Agents</span>
            <div className="text-3xl font-bold text-white mt-2">{INITIAL_AGENTS.length}</div>
            <p className="text-xs text-gray-400 mt-1">All foundational agents operational</p>
          </div>

          <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-5">
            <span className="text-xs text-gray-400 uppercase font-semibold">Running Workflows</span>
            <div className="text-3xl font-bold text-[#E2B53C] mt-2">{totalExecs}</div>
            <p className="text-xs text-gray-400 mt-1">Total pipeline runs executed</p>
          </div>

          <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-5">
            <span className="text-xs text-gray-400 uppercase font-semibold">Pending Approvals</span>
            <div className="text-3xl font-bold text-amber-400 mt-2">{pendingApprovalsCount}</div>
            <p className="text-xs text-gray-400 mt-1">Requiring human administrator review</p>
          </div>

          <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-5">
            <span className="text-xs text-gray-400 uppercase font-semibold">Execution Success Rate</span>
            <div className="text-3xl font-bold text-emerald-400 mt-2">{successRate}%</div>
            <p className="text-xs text-gray-400 mt-1">Governance and pipeline SLA compliance</p>
          </div>
        </div>

        {/* Execution Health & Recovery Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Status Breakdown */}
          <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-6 lg:col-span-1">
            <h2 className="text-lg font-semibold font-heading text-white mb-4">Agent System Health</h2>
            <div className="space-y-3">
              {INITIAL_AGENTS.map((agent) => (
                <div
                  key={agent.id}
                  className="p-3 bg-[#0E1726]/60 rounded-lg border border-[#21395C] flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{agent.name}</p>
                    <p className="text-[11px] text-gray-400">{agent.category}</p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Executions Log */}
          <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-heading text-white">Recent Workflow Executions</h2>
              <button onClick={loadDashboardData} className="text-xs text-[#E2B53C] hover:underline">
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading Executions...</div>
            ) : executions.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-[#21395C] rounded-lg">
                No recent executions recorded yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="p-4 bg-[#0E1726]/60 rounded-lg border border-[#21395C] flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {exec.workflow?.name || 'Automated Pipeline Run'}
                      </p>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        Trigger: {exec.workflow?.trigger_type || 'Manual'} • Duration: {exec.execution_duration_ms}ms
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase ${
                          exec.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : exec.status === 'requires_approval'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {exec.status.replace('_', ' ')}
                      </span>
                      <span className="text-gray-500 text-[11px]">
                        {new Date(exec.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default AgentDashboardPage;
