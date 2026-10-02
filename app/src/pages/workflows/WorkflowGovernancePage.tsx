import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  History,
  Activity,
  Sliders,
  Power,
  RotateCcw,
  Search,
  Filter,
  ArrowLeft,
  FileText,
  ExternalLink,
  Lock,
  Eye,
  Check,
  X,
  RefreshCw,
  Database,
  Cpu,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  WorkflowRecord,
  WorkflowRiskLevel,
  WorkflowIncidentRecord,
  WorkflowAuditEvent,
  WorkflowStatus,
} from '../../lib/workflows/types';
import { useAuth } from '../../lib/auth/AuthContext';
import { fetchWorkflows } from '../../lib/workflows/workflowService';
import { getOrganizationIncidents, acknowledgeIncident, resolveIncident, exportIncidentReport } from '../../lib/workflows/incidentService';
import { queryWorkflowAudits } from '../../lib/workflows/auditService';
import { getPlatformHealthOverview, PlatformHealthOverview } from '../../lib/workflows/observabilityService';
import { invokeEmergencyStop, releaseEmergencyStop } from '../../lib/workflows/governanceService';

export const WorkflowGovernancePage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'audit' | 'health' | 'policies' | 'killswitch'>('overview');
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [incidents, setIncidents] = useState<WorkflowIncidentRecord[]>([]);
  const [audits, setAudits] = useState<WorkflowAuditEvent[]>([]);
  const [health, setHealth] = useState<PlatformHealthOverview>(getPlatformHealthOverview());
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Incident Modal
  const [selectedIncident, setSelectedIncident] = useState<WorkflowIncidentRecord | null>(null);
  const [rootCauseInput, setRootCauseInput] = useState<string>('');
  const [preventiveInput, setPreventiveInput] = useState<string>('');

  // Emergency Stop Input
  const [stopScope, setStopScope] = useState<'workflow' | 'organisation' | 'connector'>('workflow');
  const [stopTarget, setStopTarget] = useState<string>('');
  const [stopReason, setStopReason] = useState<string>('');
  const [activeStops, setActiveStops] = useState<any[]>([]);

  const loadGovernanceData = async () => {
    setLoading(true);
    try {
      const orgId = 'org_concludo_default';
      const userId = user?.id || 'usr_concludo_system';
      const wfList = await fetchWorkflows({ userId, organizationId: orgId });
      setWorkflows(wfList);

      const incList = getOrganizationIncidents(orgId);
      setIncidents(incList);

      const audList = queryWorkflowAudits({ organizationId: orgId, limit: 100 });
      setAudits(audList);

      setHealth(getPlatformHealthOverview());
    } catch (err) {
      console.error('Failed to load governance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGovernanceData();
  }, [user]);

  const handleAcknowledgeIncident = (id: string) => {
    acknowledgeIncident(id, 'Anthony Cortez');
    setIncidents([...getOrganizationIncidents('org_concludo_default')]);
  };

  const handleResolveIncident = () => {
    if (!selectedIncident || !rootCauseInput.trim() || !preventiveInput.trim()) return;
    resolveIncident(selectedIncident.id, 'Anthony Cortez', {
      rootCause: rootCauseInput.trim(),
      preventiveAction: preventiveInput.trim(),
    });
    setSelectedIncident(null);
    setRootCauseInput('');
    setPreventiveInput('');
    setIncidents([...getOrganizationIncidents('org_concludo_default')]);
  };

  const handleExportIncident = (id: string) => {
    const jsonStr = exportIncidentReport(id);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident_report_${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInvokeEmergencyStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopTarget.trim() || !stopReason.trim()) return;
    const res = await invokeEmergencyStop({
      organizationId: 'org_concludo_default',
      scope: stopScope,
      targetId: stopTarget.trim(),
      reason: stopReason.trim(),
      invokedBy: 'auth_user_anthony',
    });
    setActiveStops([res, ...activeStops]);
    setStopTarget('');
    setStopReason('');
    await loadGovernanceData();
  };

  const handleReleaseEmergencyStop = async (stopId: string) => {
    await releaseEmergencyStop(stopId, 'auth_user_anthony', 'Resolved by administrator');
    setActiveStops(activeStops.filter((s) => s.id !== stopId));
    await loadGovernanceData();
  };

  const filteredWorkflows = workflows.filter((wf) => {
    const matchesSearch = wf.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (wf.status || (wf.is_active ? 'published' : 'draft')) === statusFilter;
    const matchesRisk = riskFilter === 'all' || (wf.risk_level || 'low') === riskFilter;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col font-sans">
      {/* Top Banner */}
      <header className="border-b border-slate-800 bg-[#16263F]/40 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            to="/workflows"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Workflows"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#E2B53C]" />
              <h1 className="text-xl font-bold tracking-tight text-white font-poppins">
                Workflow Governance Centre
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Phase 4 Production Hardened
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enterprise policy enforcement, multi-tenant isolation, immutable audit trails, and emergency controls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadGovernanceData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition-colors border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            to="/workflows/builder"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E2B53C] hover:bg-[#cfa533] text-slate-950 font-semibold text-xs transition-all shadow-md shadow-[#E2B53C]/10"
          >
            Open Workflow Architect
          </Link>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#16263F]/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">Total Workflows</span>
          <span className="text-2xl font-bold text-white mt-1">{workflows.length}</span>
        </div>
        <div className="bg-[#16263F]/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">Published Active</span>
          <span className="text-2xl font-bold text-emerald-400 mt-1">
            {workflows.filter((w) => w.is_active).length}
          </span>
        </div>
        <div className="bg-[#16263F]/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">High / Restricted Risk</span>
          <span className="text-2xl font-bold text-amber-400 mt-1">
            {workflows.filter((w) => w.risk_level === 'high' || w.risk_level === 'restricted').length}
          </span>
        </div>
        <div className="bg-[#16263F]/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">Open Incidents</span>
          <span className="text-2xl font-bold text-rose-400 mt-1">
            {incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed').length}
          </span>
        </div>
        <div className="bg-[#16263F]/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">Platform Health</span>
          <span className={`text-base font-bold mt-1 ${health.overallState === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {health.overallState}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="flex border-b border-slate-800 gap-6 text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Workflows Overview ({workflows.length})
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'incidents'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            Incident Centre ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Audit Explorer
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'health'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Platform Health & Alerts
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'policies'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Policies & Guardrails
          </button>
          <button
            onClick={() => setActiveTab('killswitch')}
            className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'killswitch'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Power className="w-4 h-4 text-rose-400" />
            Kill Switches
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <main className="max-w-7xl w-full mx-auto px-6 py-6 flex-1">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#16263F]/30 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by workflow name, owner, or trigger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                  <option value="degraded">Degraded</option>
                </select>
                <span className="text-xs text-slate-400 ml-2">Risk:</span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none"
                >
                  <option value="all">All Risks</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-[#16263F]/20 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16263F]/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Workflow</th>
                    <th className="py-3 px-3">Owner</th>
                    <th className="py-3 px-3">Risk Tier</th>
                    <th className="py-3 px-3">Trigger</th>
                    <th className="py-3 px-3">Approvals</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredWorkflows.map((wf) => {
                    const risk = wf.risk_level || 'low';
                    return (
                      <tr key={wf.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100">{wf.name}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{wf.description || 'No description'}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">Anthony Cortez</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              risk === 'restricted'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                : risk === 'high'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : risk === 'medium'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                            }`}
                          >
                            {risk}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{wf.trigger_type}</td>
                        <td className="py-3 px-3">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Enforced
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            wf.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {wf.is_active ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to="/workflows/builder"
                            className="text-[#E2B53C] hover:underline text-xs mr-3"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => {
                              setSelectedIncident({
                                id: `sim_${Date.now()}`,
                                organizationId: 'org_concludo_default',
                                workflowId: wf.id,
                                workflowName: wf.name,
                                stepKey: 'execute_step',
                                severity: 'SEV_3',
                                status: 'open',
                                summary: 'Simulated health inspection',
                                technicalClassification: 'DIAGNOSTIC_CHECK',
                                customerSafeExplanation: 'Workflow health is optimal.',
                                errorMessage: 'None',
                                firstDetected: new Date().toISOString(),
                                lastDetected: new Date().toISOString(),
                              });
                            }}
                            className="text-slate-400 hover:text-slate-200 text-xs"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWorkflows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No workflows match the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INCIDENTS TAB */}
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Active & Resolved Incidents (SEV 1–4)</h3>
                <p className="text-xs text-slate-400">
                  Every failure, circuit breaker trip, or outcome-uncertain execution is registered for auditing.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-[#16263F]/40 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inc.severity === 'SEV_1'
                            ? 'bg-red-600 text-white'
                            : inc.severity === 'SEV_2'
                            ? 'bg-amber-500 text-black'
                            : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span className="font-semibold text-white text-sm">{inc.summary}</span>
                      <span className="text-xs text-slate-400 font-mono">({inc.id})</span>
                    </div>
                    <div className="text-xs text-slate-300">{inc.customerSafeExplanation}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-4">
                      <span>Workflow: {inc.workflowName || inc.workflowId}</span>
                      <span>Step: {inc.stepKey}</span>
                      <span>Detected: {new Date(inc.firstDetected).toLocaleTimeString()}</span>
                      <span className="capitalize text-emerald-400 font-medium">Status: {inc.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {inc.status === 'open' && (
                      <button
                        onClick={() => handleAcknowledgeIncident(inc.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
                      >
                        Acknowledge
                      </button>
                    )}
                    {inc.status !== 'resolved' && (
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() => handleExportIncident(inc.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" /> Report
                    </button>
                  </div>
                </div>
              ))}
              {incidents.length === 0 && (
                <div className="bg-[#16263F]/20 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  No open or uncontained incidents. Platform operating within normal safety bounds.
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUDIT EXPLORER TAB */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Immutable Audit Explorer</h3>
                <p className="text-xs text-slate-400">
                  Who, what, when, why, and how. Sensitive credentials, passwords, and tokens are automatically redacted.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#E2B53C]" />
                Zero-Secret Redaction Enforced
              </span>
            </div>

            <div className="bg-[#16263F]/20 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16263F]/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Object</th>
                    <th className="py-2.5 px-3">Outcome</th>
                    <th className="py-2.5 px-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {audits.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{new Date(a.createdAt || '').toLocaleTimeString()}</td>
                      <td className="py-2 px-3 text-slate-200 font-semibold">{a.eventType}</td>
                      <td className="py-2 px-3 text-slate-300">{a.actorId || 'system'}</td>
                      <td className="py-2 px-3 text-slate-400">{a.objectType}:{a.objectId}</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          a.outcome === 'SUCCESS' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                        }`}>
                          {a.outcome}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 max-w-xs truncate">{JSON.stringify(a.metadata || {})}</td>
                    </tr>
                  ))}
                  {audits.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HEALTH & OBSERVABILITY TAB */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Platform Health & Telemetry</h3>
              <p className="text-xs text-slate-400">
                Continuous operational health monitoring across engine runtimes, connectors, and AI agents.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {health.components.map((comp) => (
                <div
                  key={comp.name}
                  className="bg-[#16263F]/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-sm font-medium text-white">{comp.name}</h4>
                    <span className="text-xs text-slate-500">Response Latency: {comp.latencyMs}ms</span>
                    {comp.recentIncident && (
                      <div className="text-xs text-amber-400 mt-1">{comp.recentIncident}</div>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      comp.state === 'HEALTHY'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {comp.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* POLICIES TAB */}
        {activeTab === 'policies' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Server-Enforced Governance Policies</h3>
              <p className="text-xs text-slate-400">
                Active policies evaluated server-side. No user interface manipulation can bypass these guardrails.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#16263F]/30 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Anti-Surveillance Mandate</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold">LOCKED</span>
                </div>
                <p className="text-xs text-slate-400">
                  Strictly prohibits employee ranking, individual productivity scoring, worker sentiment inference, or covert surveillance.
                </p>
              </div>

              <div className="bg-[#16263F]/30 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">External Action Human Sign-off</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold">ENFORCED</span>
                </div>
                <p className="text-xs text-slate-400">
                  Mandates human approval in Approval Centre before dispatching Slack messages, Teams notifications, external emails, or Calendar invites.
                </p>
              </div>

              <div className="bg-[#16263F]/30 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">SSRF & Domain Allowlist</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold">ENFORCED</span>
                </div>
                <p className="text-xs text-slate-400">
                  Blocks Custom API and webhook connectors from requesting localhost, private IP subnets (RFC 1918), or cloud instance metadata (169.254.169.254).
                </p>
              </div>

              <div className="bg-[#16263F]/30 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Batch & Retry Limits</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold">BOUNDED</span>
                </div>
                <p className="text-xs text-slate-400">
                  Enforces maximum batch sizes of 100 items, max loops of 100 iterations, and bounded exponential backoff retries of 3 attempts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KILL SWITCHES TAB */}
        {activeTab === 'killswitch' && (
          <div className="space-y-6">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                Emergency Suspension Controls
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Immediately block triggers and in-flight operations. Use during provider outages, security investigations, or suspected runaway executions.
              </p>
            </div>

            <form onSubmit={handleInvokeEmergencyStop} className="bg-[#16263F]/40 border border-slate-800 rounded-xl p-5 space-y-4 max-w-xl">
              <h4 className="text-sm font-semibold text-white">Invoke Emergency Stop</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Scope</label>
                  <select
                    value={stopScope}
                    onChange={(e: any) => setStopScope(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="workflow">Specific Workflow</option>
                    <option value="organisation">Whole Organisation</option>
                    <option value="connector">Specific Connector</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target Identifier</label>
                  <input
                    type="text"
                    placeholder="e.g. wf_123 or slack"
                    value={stopTarget}
                    onChange={(e) => setStopTarget(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Reason for Emergency Stop</label>
                <input
                  type="text"
                  placeholder="e.g. Upstream Slack API outage causing repeated failures"
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Power className="w-4 h-4" /> Trigger Emergency Stop
              </button>
            </form>

            {/* Active Stops */}
            {activeStops.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Emergency Stops</h4>
                {activeStops.map((stop) => (
                  <div key={stop.id} className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-rose-300">
                        {stop.scope.toUpperCase()}: {stop.targetId}
                      </div>
                      <div className="text-[11px] text-slate-400">{stop.reason}</div>
                    </div>
                    <button
                      onClick={() => handleReleaseEmergencyStop(stop.id)}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
                    >
                      Release Stop
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* RESOLVE INCIDENT MODAL */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16263F] border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Resolve Incident #{selectedIncident.incidentNumber || selectedIncident.id}</h3>
            <p className="text-xs text-slate-400">{selectedIncident.summary}</p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Identified Root Cause</label>
                <textarea
                  rows={2}
                  value={rootCauseInput}
                  onChange={(e) => setRootCauseInput(e.target.value)}
                  placeholder="e.g. OAuth token expired after provider credential reset."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Preventive Action Taken</label>
                <textarea
                  rows={2}
                  value={preventiveInput}
                  onChange={(e) => setPreventiveInput(e.target.value)}
                  placeholder="e.g. Reconnected OAuth session and updated automated refresh token handler."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveIncident}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
