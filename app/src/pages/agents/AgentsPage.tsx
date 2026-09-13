import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { INITIAL_AGENTS, AgentDefinition, AgentType, AgentActivityRecord, AgentRunResult } from '../../lib/agents/types';
import { fetchAgentActivity } from '../../lib/agents/agentMemoryService';
import { runAgent } from '../../lib/agents/agentRunner';

export const AgentsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [agents] = useState<AgentDefinition[]>(INITIAL_AGENTS);
  const [activities, setActivities] = useState<AgentActivityRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Execution modal state
  const [runningAgent, setRunningAgent] = useState<AgentType | null>(null);
  const [executing, setExecuting] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<AgentRunResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const loadActivityLogs = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentActivity({ userId: user.id });
      setActivities(data);
    } catch (err: any) {
      setError('Failed to load agents activity logs. Please verify permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivityLogs();
  }, [user]);

  const handleRunAgent = async (agentType: AgentType) => {
    if (!user) return;
    setRunningAgent(agentType);
    setExecuting(true);
    setRunResult(null);
    setExecError(null);

    try {
      const result = await runAgent({
        agentType,
        userId: user.id,
      });
      setRunResult(result);
      await loadActivityLogs();
    } catch (err: any) {
      setExecError(`Failed to complete action: ${err.message || 'Execution error'}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1726] text-[#F4F6FA] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#21395C] pb-6 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#E2B53C]/20 text-[#E2B53C] border border-[#E2B53C]/40">
                ENTERPRISE OPERATIONAL AUTOMATION
              </span>
              <span className="text-xs text-gray-400">Tasklet 19 Foundation</span>
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mt-1">
              AI Agents & Operational Governance
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Autonomous assistants with mandatory Human-in-the-Loop approval controls for Concludo Workspace.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/agents/dashboard"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-[#E2B53C] border border-[#E2B53C]/40 rounded-lg text-sm font-medium transition"
            >
              Agent Dashboard
            </Link>
            <Link
              to="/workflows"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-white border border-[#21395C] rounded-lg text-sm font-medium transition"
            >
              Workflows
            </Link>
            <Link
              to="/approvals"
              className="px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] font-semibold rounded-lg text-sm transition shadow"
            >
              Approval Centre
            </Link>
          </div>
        </div>

        {/* Governance Banner */}
        <div className="bg-[#16263F]/80 border border-[#21395C] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-sm text-gray-300">
              <strong className="text-white">Governed Execution Model:</strong> All external system dispatches and escalation actions require human approval prior to release.
            </p>
          </div>
          <span className="text-xs bg-[#21395C] text-gray-300 px-3 py-1 rounded-full border border-gray-700">
            RLS Protected & Audited
          </span>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={loadActivityLogs}
              className="text-xs underline hover:text-white font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Initial Agents Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold font-heading text-white">Foundational AI Agents</h2>
            <span className="text-xs text-gray-400">{agents.length} Agents Available</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-[#16263F]/70 border border-[#21395C] hover:border-[#E2B53C]/50 rounded-xl p-5 flex flex-col justify-between transition group shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#21395C] text-gray-300">
                      {agent.category}
                    </span>
                    {agent.requiresReview ? (
                      <span className="text-[11px] text-[#E2B53C] bg-[#E2B53C]/10 border border-[#E2B53C]/30 px-2 py-0.5 rounded">
                        Review Required
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                        Autonomous Report
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold font-heading text-white mt-3 group-hover:text-[#E2B53C] transition">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                    {agent.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-[#21395C]">
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">
                      Deliverables:
                    </span>
                    <ul className="text-xs text-gray-300 space-y-1">
                      {agent.supportedOutputs.slice(0, 3).map((out, i) => (
                        <li key={i} className="flex items-center space-x-1.5">
                          <span className="text-[#E2B53C]">•</span>
                          <span>{out}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#21395C]/50 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Schedule: {agent.scheduleSupport ? 'Supported' : 'Manual'}
                  </span>
                  <button
                    onClick={() => handleRunAgent(agent.id)}
                    disabled={executing}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-[#21395C] hover:bg-[#E2B53C] hover:text-[#0E1726] text-white rounded transition disabled:opacity-50"
                  >
                    Run Agent
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution Result Modal */}
        {(executing || runResult || execError) && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#16263F] border border-[#21395C] rounded-xl max-w-2xl w-full p-6 shadow-2xl relative">
              <button
                onClick={() => {
                  setRunResult(null);
                  setExecError(null);
                  setRunningAgent(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>

              <h3 className="text-xl font-bold font-heading text-white mb-2">
                {executing ? 'Processing Agent...' : 'Agent Execution Result'}
              </h3>

              {executing && (
                <div className="py-8 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-[#E2B53C] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-300">Processing Agent and synthesizing outputs...</p>
                </div>
              )}

              {execError && (
                <div className="bg-red-900/30 border border-red-700 text-red-200 p-4 rounded-lg my-4 text-sm">
                  {execError}
                </div>
              )}

              {runResult && (
                <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto">
                  <div className="bg-[#0E1726] p-4 rounded-lg border border-[#21395C]">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <span>Agent: {runResult.agentType}</span>
                      <span>Duration: {runResult.executionDurationMs}ms</span>
                    </div>
                    <p className="text-sm text-emerald-400 font-medium">{runResult.summary}</p>
                  </div>

                  {runResult.requiresApproval && (
                    <div className="bg-[#E2B53C]/10 border border-[#E2B53C]/40 p-4 rounded-lg">
                      <p className="text-xs text-[#E2B53C] font-semibold mb-1">
                        Human Approval Requested
                      </p>
                      <p className="text-xs text-gray-300">
                        This agent generated external operational items or escalations. Action has been staged in the Approval Centre for administrator sign-off.
                      </p>
                      <Link
                        to="/approvals"
                        className="inline-block mt-2 text-xs text-[#E2B53C] underline hover:text-white"
                      >
                        Go to Approval Centre →
                      </Link>
                    </div>
                  )}

                  <div className="bg-[#0E1726] p-3 rounded-lg border border-[#21395C] text-xs font-mono text-gray-300 overflow-x-auto">
                    <pre>{JSON.stringify(runResult.data, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-[#21395C] flex justify-end">
                <button
                  onClick={() => {
                    setRunResult(null);
                    setExecError(null);
                    setRunningAgent(null);
                  }}
                  className="px-4 py-2 bg-[#21395C] hover:bg-gray-700 text-white rounded text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Agent Activity Logs */}
        <div className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold font-heading text-white">Agent Activity Logs</h2>
              <p className="text-xs text-gray-400">Real-time audit trail of automated actions and status changes</p>
            </div>
            <button
              onClick={loadActivityLogs}
              className="text-xs text-[#E2B53C] hover:underline"
            >
              Refresh Logs
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading Agents activity...</div>
          ) : activities.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-[#21395C] rounded-lg">
              No recent agent executions recorded. Trigger an agent above to view activity.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0E1726]/60 text-gray-400 uppercase tracking-wider border-b border-[#21395C]">
                  <tr>
                    <th className="py-2.5 px-3">Agent</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Result Summary</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21395C]/50 text-gray-300">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-[#21395C]/20 transition">
                      <td className="py-2.5 px-3 font-medium text-white">{act.agent_type}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-400">{act.action_type}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            act.status === 'success'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : act.status === 'requires_approval'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                        >
                          {act.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-gray-300">
                        {act.details?.summary || act.details?.error || 'Completed'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">
                        {new Date(act.created_at).toLocaleString('en-AU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AgentsPage;
