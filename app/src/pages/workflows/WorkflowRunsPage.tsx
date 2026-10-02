import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Search,
  Filter,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { IntegrationExecutionLogService, IntegrationExecutionLogRecord } from '../../lib/integrations/integrationExecutionLogService';
import { IntegrationIcon } from '../../components/integrations/IntegrationIcon';

export const WorkflowRunsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const runFilterParam = searchParams.get('runId') || '';

  const [logs, setLogs] = useState<IntegrationExecutionLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(runFilterParam);
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const allLogs = await IntegrationExecutionLogService.getRecentLogs(100);
      setLogs(allLogs);
    } catch {
      // In-memory logs available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter logs by runId, provider, action, and status
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.workflowRunId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.providerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.workflowStepId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actionOrTriggerKey.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ? true : log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Group logs by workflowRunId for structured run cards
  const groupedRuns = filteredLogs.reduce((acc, log) => {
    if (!acc[log.workflowRunId]) {
      acc[log.workflowRunId] = [];
    }
    acc[log.workflowRunId].push(log);
    return acc;
  }, {} as Record<string, IntegrationExecutionLogRecord[]>);

  const runIds = Object.keys(groupedRuns);

  return (
    <div className="min-h-screen bg-[#0E1726] text-[#F4F6FA] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#21395C] pb-6 gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/workflows"
              className="p-2.5 bg-[#16263F] hover:bg-[#21395C] text-slate-300 rounded-lg transition border border-[#21395C]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-[#E2B53C]/20 text-[#E2B53C] border border-[#E2B53C]/40 uppercase tracking-wider">
                  AUDITED EXECUTION RUNS
                </span>
                <span className="text-xs text-slate-400">Zero-Secret Multi-Tenant Trail</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
                Workflow Run History
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Inspect step-by-step external integration requests, duration metrics, retry cycles, and sanitized payloads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2 bg-[#16263F] hover:bg-[#21395C] text-slate-300 rounded-lg text-xs font-medium transition border border-[#21395C] flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <Link
              to="/workflows/builder"
              className="px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-[#0E1726] rounded-lg text-xs font-semibold transition"
            >
              Open Builder
            </Link>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 bg-[#16263F]/70 border border-[#21395C] p-3 rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Run ID (#run_...), App (Outlook, Xero), or Step Key..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#0E1726] border border-[#21395C] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#E2B53C]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <div className="flex rounded-lg bg-[#0E1726] p-0.5 border border-[#21395C] text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded transition ${statusFilter === 'all' ? 'bg-[#21395C] text-[#E2B53C] font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('succeeded')}
                className={`px-3 py-1 rounded transition ${statusFilter === 'succeeded' ? 'bg-[#21395C] text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                Succeeded
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1 rounded transition ${statusFilter === 'failed' ? 'bg-[#21395C] text-rose-400 font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                Failed
              </button>
            </div>
          </div>
        </div>

        {/* Runs Content */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#E2B53C]" />
            <p className="text-sm">Loading execution logs...</p>
          </div>
        ) : runIds.length === 0 ? (
          <div className="bg-[#16263F]/50 border border-dashed border-[#21395C] rounded-xl p-12 text-center text-slate-400 space-y-3">
            <Layers className="w-10 h-10 mx-auto text-slate-500" />
            <h3 className="text-base font-semibold text-white">No Execution Runs Found</h3>
            <p className="text-xs max-w-sm mx-auto">
              Workflow execution and integration dispatch records appear here after running live automations or executing dry runs.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {runIds.map((runId) => {
              const runSteps = groupedRuns[runId];
              const isFailed = runSteps.some((s) => s.status === 'failed');
              const totalDuration = runSteps.reduce((sum, s) => sum + s.durationMs, 0);

              return (
                <div
                  key={runId}
                  className="bg-[#16263F]/80 border border-[#21395C] rounded-xl overflow-hidden shadow-lg transition"
                >
                  {/* Run Card Header */}
                  <div className="p-4 bg-[#16263F] border-b border-[#21395C] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {isFailed ? (
                        <div className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                          <XCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white tracking-wide">
                            Run #{runId.slice(0, 16)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              isFailed
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isFailed ? 'Action Required / Failed' : 'All Steps Succeeded'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Started {new Date(runSteps[0]?.startedAt).toLocaleString('en-AU')} • Total Step Latency: {totalDuration}ms
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 bg-[#0E1726] px-2.5 py-1 rounded border border-[#21395C]">
                        {runSteps.length} integration {runSteps.length === 1 ? 'step' : 'steps'}
                      </span>
                    </div>
                  </div>

                  {/* Steps Breakdown */}
                  <div className="divide-y divide-[#21395C]/50">
                    {runSteps.map((step, idx) => {
                      const isExpanded = expandedLogId === step.id;
                      return (
                        <div key={step.id} className="p-4 hover:bg-[#21395C]/20 transition">
                          <div
                            onClick={() => setExpandedLogId(isExpanded ? null : step.id)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400 w-5">
                                #{idx + 1}
                              </span>
                              <IntegrationIcon providerId={step.providerId} size="sm" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white">
                                    {step.actionOrTriggerKey.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    ({step.workflowStepId})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>Latency: {step.durationMs}ms</span>
                                  <span>•</span>
                                  <span>Attempts: {step.attemptCount}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {step.status === 'succeeded' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Succeeded
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-medium border border-rose-500/20">
                                  <XCircle className="w-3 h-3" /> Failed
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Step Detail Drawer */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-[#21395C]/60 space-y-3">
                              {step.safeErrorMessage && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="font-semibold block">Error Category: {step.errorCategory || 'PROVIDER_ERROR'}</span>
                                    <span>{step.safeErrorMessage}</span>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div className="bg-[#0E1726] p-3 rounded-lg border border-[#21395C]">
                                  <div className="flex items-center justify-between text-slate-400 mb-1.5 font-semibold text-[11px]">
                                    <span>Sanitized Input Arguments</span>
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  </div>
                                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-[#16263F] rounded">
                                    {JSON.stringify(step.safeInputSummary, null, 2)}
                                  </pre>
                                </div>

                                <div className="bg-[#0E1726] p-3 rounded-lg border border-[#21395C]">
                                  <div className="flex items-center justify-between text-slate-400 mb-1.5 font-semibold text-[11px]">
                                    <span>Sanitized External Output</span>
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  </div>
                                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-[#16263F] rounded">
                                    {JSON.stringify(step.safeOutputSummary, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowRunsPage;
