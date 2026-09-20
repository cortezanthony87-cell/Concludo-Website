import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  CheckSquare,
  BookOpen,
  FolderKanban,
  FileText,
  Boxes,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  History,
  X,
  ExternalLink,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  executeActionExport,
  executeDecisionExport,
  executeProjectExport,
  executeReportExport,
  executeBulkExport,
  fetchExportHistory,
} from '../../lib/integrations/integrationClient';
import { AutomationExport, ExportType } from '../../lib/integrations/types';

export const AutomationExportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ExportType>('action');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successExport, setSuccessExport] = useState<AutomationExport | null>(null);

  // Available data items for export
  const [actions, setActions] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [history, setHistory] = useState<AutomationExport[]>([]);

  // Selected item IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>('microsoft_planner');

  const supabase = getSupabaseBrowserClient();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [actRes, decRes, projRes, repRes, histRes] = await Promise.all([
        supabase.from('action_tracker').select('id, title, owner, due_date, status').is('deleted_at', null).limit(30),
        supabase.from('decision_memory').select('id, decision_text, owner, decision_date').is('deleted_at', null).limit(30),
        supabase.from('projects').select('id, title, client_name, project_name, meeting_date').is('deleted_at', null).limit(30),
        supabase.from('endpoint_reports').select('id, title, created_at').is('deleted_at', null).limit(30),
        fetchExportHistory(20),
      ]);

      if (actRes.data) setActions(actRes.data);
      if (decRes.data) setDecisions(decRes.data);
      if (projRes.data) setProjects(projRes.data);
      if (repRes.data) setReports(repRes.data);
      if (histRes) setHistory(histRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load records for export.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set default destination when tab changes
  useEffect(() => {
    setSelectedIds([]);
    setSuccessExport(null);
    if (activeTab === 'action') setSelectedDestination('microsoft_planner');
    else if (activeTab === 'decision') setSelectedDestination('notion');
    else if (activeTab === 'project') setSelectedDestination('notion');
    else if (activeTab === 'report') setSelectedDestination('microsoft_teams');
    else if (activeTab === 'bulk') setSelectedDestination('microsoft_teams');
  }, [activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (items: any[]) => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleRunExport = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one record to export.');
      return;
    }

    setExporting(true);
    setError(null);
    setSuccessExport(null);

    try {
      let result: AutomationExport;

      if (activeTab === 'action') {
        result = await executeActionExport(selectedIds, selectedDestination);
      } else if (activeTab === 'decision') {
        result = await executeDecisionExport(selectedIds, selectedDestination);
      } else if (activeTab === 'project') {
        result = await executeProjectExport(selectedIds, selectedDestination);
      } else if (activeTab === 'report') {
        result = await executeReportExport(selectedIds, selectedDestination);
      } else {
        const bulkItems = selectedIds.map((id) => ({ type: 'action' as ExportType, id }));
        result = await executeBulkExport(bulkItems, selectedDestination);
      }

      setSuccessExport(result);
      setSelectedIds([]);
      // Reload history
      const freshHistory = await fetchExportHistory(20);
      setHistory(freshHistory);
    } catch (err: any) {
      setError(err.message || 'Failed to export records.');
    } finally {
      setExporting(false);
    }
  };

  const getDestinationsForTab = () => {
    switch (activeTab) {
      case 'action':
        return [
          { id: 'microsoft_planner', label: 'Microsoft Planner' },
          { id: 'microsoft_todo', label: 'Microsoft To Do' },
          { id: 'trello', label: 'Trello' },
          { id: 'asana', label: 'Asana' },
          { id: 'monday', label: 'Monday.com' },
          { id: 'jira', label: 'Jira' },
          { id: 'clickup', label: 'ClickUp' },
        ];
      case 'decision':
        return [
          { id: 'notion', label: 'Notion' },
          { id: 'microsoft_teams', label: 'Microsoft Teams' },
          { id: 'slack', label: 'Slack' },
          { id: 'hubspot', label: 'HubSpot CRM' },
          { id: 'salesforce', label: 'Salesforce CRM' },
          { id: 'custom_webhook', label: 'Custom Outgoing Webhook' },
        ];
      case 'project':
        return [
          { id: 'notion', label: 'Notion' },
          { id: 'microsoft_teams', label: 'Microsoft Teams' },
          { id: 'sharepoint', label: 'SharePoint' },
          { id: 'custom_webhook', label: 'Custom Outgoing Webhook' },
        ];
      case 'report':
      case 'bulk':
      default:
        return [
          { id: 'notion', label: 'Notion' },
          { id: 'microsoft_teams', label: 'Microsoft Teams' },
          { id: 'slack', label: 'Slack' },
          { id: 'sharepoint', label: 'SharePoint' },
        ];
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Automation Exports</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Pro & Enterprise
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Dispatch structured decisions, action items, executive project summaries, and endpoint reports into operational work tools.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/webhooks"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition border border-slate-700"
          >
            Manage Webhooks
          </Link>
          <Link
            to="/integrations"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition border border-slate-700"
          >
            Connected Apps
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {successExport && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Export Successful!</span>
            </div>
            <button onClick={() => setSuccessExport(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-emerald-300">
            Exported {successExport.records_count} records to{' '}
            <strong className="capitalize">{successExport.destination.replace('_', ' ')}</strong> at{' '}
            {new Date(successExport.created_at).toLocaleTimeString()}.
          </p>
        </div>
      )}

      {/* Export Flow Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => setActiveTab('action')}
          className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
            activeTab === 'action'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <div>
            <div className="text-xs font-bold text-slate-100">Action Items</div>
            <div className="text-[10px] text-slate-400">Planner, Jira, Asana</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('decision')}
          className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
            activeTab === 'decision'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <div>
            <div className="text-xs font-bold text-slate-100">Decisions</div>
            <div className="text-[10px] text-slate-400">Notion, Teams, Slack</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('project')}
          className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
            activeTab === 'project'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FolderKanban className="w-5 h-5" />
          <div>
            <div className="text-xs font-bold text-slate-100">Projects</div>
            <div className="text-[10px] text-slate-400">Notion, SharePoint</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
            activeTab === 'report'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-5 h-5" />
          <div>
            <div className="text-xs font-bold text-slate-100">Endpoint Reports</div>
            <div className="text-[10px] text-slate-400">Executive Channels</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('bulk')}
          className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
            activeTab === 'bulk'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <div>
            <div className="text-xs font-bold text-slate-100">Bulk Export</div>
            <div className="text-[10px] text-slate-400">Cross-Platform Sync</div>
          </div>
        </button>
      </div>

      {/* Main Export Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Record Selection */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white">Select Records to Export</h3>
            <span className="text-xs text-amber-400 font-mono">
              {selectedIds.length} item(s) selected
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
              Loading records...
            </div>
          ) : activeTab === 'action' ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              <div className="flex justify-end pb-1">
                <button
                  onClick={() => handleSelectAll(actions)}
                  className="text-xs text-slate-400 hover:text-white font-medium"
                >
                  {selectedIds.length === actions.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {actions.map((act) => (
                <div
                  key={act.id}
                  onClick={() => toggleSelect(act.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${
                    selectedIds.includes(act.id)
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{act.title}</div>
                    <div className="text-[11px] text-slate-400">
                      Owner: {act.owner || 'Unassigned'} • Due: {act.due_date || 'No Date'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(act.id)}
                    onChange={() => {}}
                    className="accent-amber-400"
                  />
                </div>
              ))}
            </div>
          ) : activeTab === 'decision' ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              <div className="flex justify-end pb-1">
                <button
                  onClick={() => handleSelectAll(decisions)}
                  className="text-xs text-slate-400 hover:text-white font-medium"
                >
                  {selectedIds.length === decisions.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {decisions.map((dec) => (
                <div
                  key={dec.id}
                  onClick={() => toggleSelect(dec.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${
                    selectedIds.includes(dec.id)
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{dec.decision_text}</div>
                    <div className="text-[11px] text-slate-400">
                      Owner: {dec.owner || 'Leadership'} • Date: {dec.decision_date || 'N/A'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(dec.id)}
                    onChange={() => {}}
                    className="accent-amber-400"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => toggleSelect(proj.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${
                    selectedIds.includes(proj.id)
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{proj.title}</div>
                    <div className="text-[11px] text-slate-400">Client: {proj.client_name || 'Internal'}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(proj.id)}
                    onChange={() => {}}
                    className="accent-amber-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Destination & Execution Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">
              Destination & Delivery
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Export Destination</label>
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {getDestinationsForTab().map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-2">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Payload Mapping
              </div>
              <ul className="space-y-1 text-slate-300">
                <li>• Authoritative permissions enforced</li>
                <li>• Purged & soft-deleted records excluded</li>
                <li>• Active legal holds fully respected</li>
                <li>• Immutable audit event recorded</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleRunExport}
            disabled={exporting || selectedIds.length === 0}
            className={`w-full py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
              exporting || selectedIds.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
            }`}
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Exporting Records...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Run Export ({selectedIds.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Recent Automation Exports</h3>
          </div>
          <span className="text-xs text-slate-400">{history.length} records</span>
        </div>

        {history.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No export records found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3 text-center">Count</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-sans capitalize text-white">{h.export_type}</td>
                    <td className="py-2.5 px-3 font-sans capitalize">{h.destination.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-white">{h.records_count}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                        {h.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-sans">
                      {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
