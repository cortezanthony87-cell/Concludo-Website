import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  Mail,
  Send,
  Lock,
  User,
  Plus,
  Eye,
  EyeOff,
  Shield,
  Sparkles,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  executeActionExport,
  executeDecisionExport,
  executeProjectExport,
  executeReportExport,
  executeBulkExport,
  fetchExportHistory,
  fetchIntegrations,
} from '../../lib/integrations/integrationClient';
import {
  AutomationExport,
  ExportType,
  Integration,
  PROVIDER_CATALOG,
  ProviderMeta,
} from '../../lib/integrations/types';
import { OAuthConnectModal } from '../../components/integrations/OAuthConnectModal';

export const AutomationExportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
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
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // Selected item IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>('microsoft_outlook');

  // Outlook Dispatch Form State
  const [userEmail, setUserEmail] = useState<string>('anthony@concludo.au');
  const [recipientEmails, setRecipientEmails] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [showEmailPreview, setShowEmailPreview] = useState<boolean>(true);
  const [authModalProvider, setAuthModalProvider] = useState<ProviderMeta | null>(null);

  const supabase = getSupabaseBrowserClient();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [actRes, decRes, projRes, repRes, histRes, integRes, authRes] = await Promise.all([
        supabase
          .from('action_tracker')
          .select('id, action_title, title, owner_name, owner, due_date, status, project_id')
          .is('deleted_at', null)
          .limit(40),
        supabase
          .from('decision_memory')
          .select('id, decision_title, decision_summary, decision_text, decision_owner, owner, decision_date')
          .is('deleted_at', null)
          .limit(40),
        supabase
          .from('projects')
          .select('id, title, client_name, project_name, meeting_date')
          .is('deleted_at', null)
          .limit(40),
        supabase
          .from('endpoint_reports')
          .select('id, title, created_at')
          .is('deleted_at', null)
          .limit(40),
        fetchExportHistory(20),
        fetchIntegrations(),
        supabase.auth.getUser(),
      ]);

      if (actRes.data) setActions(actRes.data);
      if (decRes.data) setDecisions(decRes.data);
      if (projRes.data) setProjects(projRes.data);
      if (repRes.data) setReports(repRes.data);
      if (histRes) setHistory(histRes);
      if (integRes) setIntegrations(integRes);
      if (authRes.data.user?.email) setUserEmail(authRes.data.user.email);
    } catch (err: any) {
      setError(err.message || 'Failed to load records for export.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle URL query parameter for destination if present
  useEffect(() => {
    const destParam = searchParams.get('destination');
    if (destParam) {
      setSelectedDestination(destParam);
    }
  }, [searchParams]);

  // Set default destination when tab changes (unless specified in query)
  useEffect(() => {
    setSelectedIds([]);
    setSuccessExport(null);
    const destParam = searchParams.get('destination');
    if (destParam) {
      setSelectedDestination(destParam);
    } else {
      if (activeTab === 'action') setSelectedDestination('microsoft_outlook');
      else if (activeTab === 'decision') setSelectedDestination('microsoft_outlook');
      else if (activeTab === 'project') setSelectedDestination('microsoft_outlook');
      else if (activeTab === 'report') setSelectedDestination('microsoft_outlook');
      else if (activeTab === 'bulk') setSelectedDestination('microsoft_outlook');
    }
  }, [activeTab]);

  // Dynamic email subject based on selection
  useEffect(() => {
    const count = selectedIds.length;
    const dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    if (activeTab === 'action') {
      setEmailSubject(`[Concludo Action Plan] ${count > 0 ? `${count} Action Items Assigned` : 'Executive Actions'} • ${dateStr}`);
    } else if (activeTab === 'decision') {
      setEmailSubject(`[Concludo Decisions] ${count > 0 ? `${count} Decisions Logged` : 'Executive Decisions'} • ${dateStr}`);
    } else if (activeTab === 'project') {
      setEmailSubject(`[Concludo Project Summary] Executive Briefing • ${dateStr}`);
    } else {
      setEmailSubject(`[Concludo Dispatch] Operational Briefing • ${dateStr}`);
    }
  }, [selectedIds, activeTab]);

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

  // Check if chosen destination is connected
  const getDestinationMeta = (destId: string) => {
    return PROVIDER_CATALOG.find((p) => p.id === destId);
  };

  const getConnectedIntegration = (destId: string) => {
    return integrations.find((i) => i.provider === destId && i.status === 'connected');
  };

  const isDestinationConnected = (destId: string): boolean => {
    if (destId === 'custom_webhook') return true;
    return !!getConnectedIntegration(destId);
  };

  const handleRunExport = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one record to export.');
      return;
    }

    if (!isDestinationConnected(selectedDestination)) {
      setError(`Please connect ${getDestinationMeta(selectedDestination)?.name || selectedDestination} first.`);
      return;
    }

    // For Outlook, validate recipients
    let recipientsList: string[] = [];
    if (selectedDestination === 'microsoft_outlook') {
      recipientsList = recipientEmails
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes('@'));

      if (recipientsList.length === 0) {
        setError('Please provide at least one valid recipient email address for Outlook dispatch.');
        return;
      }
    }

    setExporting(true);
    setError(null);
    setSuccessExport(null);

    try {
      let result: AutomationExport;
      const dispatchOptions =
        selectedDestination === 'microsoft_outlook'
          ? {
              recipients: recipientsList,
              subject: emailSubject,
              senderEmail: getConnectedIntegration('microsoft_outlook')?.settings?.account_email || userEmail,
            }
          : undefined;

      if (activeTab === 'action') {
        result = await executeActionExport(selectedIds, selectedDestination, { dispatchOptions });
      } else if (activeTab === 'decision') {
        result = await executeDecisionExport(selectedIds, selectedDestination, { dispatchOptions });
      } else if (activeTab === 'project') {
        result = await executeProjectExport(selectedIds, selectedDestination, { dispatchOptions });
      } else if (activeTab === 'report') {
        result = await executeReportExport(selectedIds, selectedDestination);
      } else {
        const bulkItems = selectedIds.map((id) => ({ type: 'action' as ExportType, id }));
        result = await executeBulkExport(bulkItems, selectedDestination);
      }

      setSuccessExport(result);
      setSelectedIds([]);
      // Reload history and integrations
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
          { id: 'microsoft_outlook', label: 'Microsoft Outlook (Direct Email Dispatch)' },
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
          { id: 'microsoft_outlook', label: 'Microsoft Outlook (Direct Email Dispatch)' },
          { id: 'notion', label: 'Notion' },
          { id: 'microsoft_teams', label: 'Microsoft Teams' },
          { id: 'slack', label: 'Slack' },
          { id: 'hubspot', label: 'HubSpot CRM' },
          { id: 'salesforce', label: 'Salesforce CRM' },
          { id: 'custom_webhook', label: 'Custom Outgoing Webhook' },
        ];
      case 'project':
        return [
          { id: 'microsoft_outlook', label: 'Microsoft Outlook (Direct Email Dispatch)' },
          { id: 'notion', label: 'Notion' },
          { id: 'microsoft_teams', label: 'Microsoft Teams' },
          { id: 'sharepoint', label: 'SharePoint' },
          { id: 'custom_webhook', label: 'Custom Outgoing Webhook' },
        ];
      case 'report':
      case 'bulk':
      default:
        return [
          { id: 'microsoft_outlook', label: 'Microsoft Outlook (Direct Email Dispatch)' },
          { id: 'notion', label: 'Notion' },
          { id: 'microsoft_teams', label: 'Microsoft Teams' },
          { id: 'slack', label: 'Slack' },
          { id: 'sharepoint', label: 'SharePoint' },
        ];
    }
  };

  const selectedRecordsList = () => {
    if (activeTab === 'action') {
      return actions.filter((a) => selectedIds.includes(a.id));
    }
    if (activeTab === 'decision') {
      return decisions.filter((d) => selectedIds.includes(d.id));
    }
    if (activeTab === 'project') {
      return projects.filter((p) => selectedIds.includes(p.id));
    }
    return [];
  };

  const currentConnected = getConnectedIntegration(selectedDestination);
  const isConnected = isDestinationConnected(selectedDestination);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Automation Exports & Dispatch</h1>
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
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <span className="font-semibold">
                Export successful: {successExport.records_count} record(s) dispatched to{' '}
                {successExport.destination.replace('_', ' ').toUpperCase()}!
              </span>
              {successExport.payload_summary?.dispatch?.recipients && (
                <div className="text-xs text-emerald-300 mt-0.5">
                  Delivered to: {successExport.payload_summary.dispatch.recipients.join(', ')}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setSuccessExport(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
            <div className="text-xs font-bold text-slate-100">Actions</div>
            <div className="text-[10px] text-slate-400">Outlook, Planner, To Do</div>
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
            <div className="text-[10px] text-slate-400">Outlook, Notion, Teams</div>
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
            <div className="text-[10px] text-slate-400">Outlook, Notion</div>
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

      {/* Main Export & Dispatch Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Record Selection (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
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
              {actions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">No active actions found.</div>
              ) : (
                actions.map((act) => (
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
                      <div className="font-semibold text-slate-100">{act.action_title || act.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Owner: {act.owner_name || act.owner || 'Unassigned'} • Due: {act.due_date || 'No Date'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(act.id)}
                      onChange={() => {}}
                      className="accent-amber-400"
                    />
                  </div>
                ))
              )}
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
              {decisions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">No active decisions found.</div>
              ) : (
                decisions.map((dec) => (
                  <div
                    key={dec.id}
                    onClick={() => toggleSelect(dec.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${
                      selectedIds.includes(dec.id)
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="pr-3">
                      <div className="font-semibold text-slate-100 line-clamp-1">
                        {dec.decision_title || dec.decision_summary || dec.decision_text}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Owner: {dec.decision_owner || dec.owner || 'Executive Team'} • Date: {dec.decision_date || 'N/A'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(dec.id)}
                      onChange={() => {}}
                      className="accent-amber-400"
                    />
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'project' ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              <div className="flex justify-end pb-1">
                <button
                  onClick={() => handleSelectAll(projects)}
                  className="text-xs text-slate-400 hover:text-white font-medium"
                >
                  {selectedIds.length === projects.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {projects.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">No active projects found.</div>
              ) : (
                projects.map((proj) => (
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
                      <div className="font-semibold text-slate-100">{proj.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Client: {proj.client_name || 'Internal'} • Date: {proj.meeting_date || 'N/A'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(proj.id)}
                      onChange={() => {}}
                      className="accent-amber-400"
                    />
                  </div>
                ))
              )}
            </div>
          ) : (
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
                    <div className="font-semibold text-slate-100">{act.action_title || act.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Owner: {act.owner_name || act.owner || 'Unassigned'} • Due: {act.due_date || 'No Date'}
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
          )}
        </div>

        {/* Right: Destination & Execution Dispatch Panel (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Destination & Delivery</h3>
              {isConnected ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Connection Required
                </span>
              )}
            </div>

            {/* Destination Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Export Destination</label>
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400 font-medium"
              >
                {getDestinationsForTab().map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Connection Gate Notice (if disconnected) */}
            {!isConnected && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                <div className="flex items-start gap-2.5 text-amber-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Sign-In Required</div>
                    <p className="text-[11px] text-amber-400/90 mt-0.5 leading-relaxed">
                      {getDestinationMeta(selectedDestination)?.name || selectedDestination} is not connected. Sign in and authorize your account to enable direct dispatch.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const meta = getDestinationMeta(selectedDestination);
                    if (meta) setAuthModalProvider(meta);
                  }}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Connect {getDestinationMeta(selectedDestination)?.name || selectedDestination}
                </button>
              </div>
            )}

            {/* Connected Account Badge */}
            {isConnected && currentConnected && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-300 font-mono text-[11px]">
                    {currentConnected.settings?.account_email || userEmail}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold">Active Session</span>
              </div>
            )}

            {/* Dedicated Microsoft Outlook Configuration Panel */}
            {selectedDestination === 'microsoft_outlook' && isConnected && (
              <div className="space-y-3 pt-1 border-t border-slate-800/80">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300 font-semibold">Recipients (Email)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const current = recipientEmails ? recipientEmails.split(',').map((s) => s.trim()) : [];
                        if (!current.includes(userEmail)) {
                          setRecipientEmails(current.length > 0 ? `${recipientEmails}, ${userEmail}` : userEmail);
                        }
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-medium"
                    >
                      + Add My Email
                    </button>
                  </div>
                  <input
                    type="text"
                    value={recipientEmails}
                    onChange={(e) => setRecipientEmails(e.target.value)}
                    placeholder="team@concludo.au, colleague@company.com"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Separate multiple recipient emails with commas.
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Email Subject Line</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Email Live Preview Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailPreview(!showEmailPreview)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-medium"
                  >
                    {showEmailPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showEmailPreview ? 'Hide Email Preview' : 'Show Live Email Preview'}</span>
                  </button>

                  {showEmailPreview && (
                    <div className="mt-2.5 rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden text-xs shadow-lg">
                      {/* Branded Outlook Email Header */}
                      <div className="bg-[#16263F] p-3 border-b border-amber-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold tracking-wider text-[11px]">CONCLUDO</span>
                          <span className="text-slate-400 text-[10px]">| Action Plan Briefing</span>
                        </div>
                        <span className="text-[10px] text-amber-300/80 font-mono">Microsoft Graph API</span>
                      </div>

                      {/* Email Meta Headers */}
                      <div className="p-3 border-b border-slate-800/80 space-y-1 text-[11px] bg-slate-900/40">
                        <div className="text-slate-400">
                          <span className="font-semibold text-slate-300">From: </span>
                          <span className="font-mono text-slate-300">
                            {currentConnected?.settings?.account_email || userEmail}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          <span className="font-semibold text-slate-300">To: </span>
                          <span className="font-mono text-amber-300">
                            {recipientEmails || 'recipient@company.com'}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          <span className="font-semibold text-slate-300">Subject: </span>
                          <span className="text-slate-200 font-medium">{emailSubject}</span>
                        </div>
                      </div>

                      {/* Email Body Content */}
                      <div className="p-3.5 space-y-3 bg-slate-950/70">
                        <p className="text-slate-300 text-xs leading-relaxed">
                          The following accountability items have been approved in Concludo Workspace:
                        </p>

                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {selectedRecordsList().length === 0 ? (
                            <div className="text-slate-500 italic text-[11px]">
                              Select records on the left to preview action items...
                            </div>
                          ) : (
                            selectedRecordsList().map((item) => (
                              <div
                                key={item.id}
                                className="p-2 rounded bg-slate-900 border border-slate-800/80 flex items-center justify-between text-[11px]"
                              >
                                <span className="font-medium text-slate-200 truncate mr-2">
                                  {item.action_title || item.title || item.decision_title || item.decision_text}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px] whitespace-nowrap">
                                  {item.owner_name || item.owner || 'Unassigned'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                          Dispatched securely from Concludo Workspace • Melbourne, Australia
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payload Compliance Callout */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-1.5">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Governance & Verification</span>
              </div>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                <li>• Soft-deleted and purged records strictly excluded</li>
                <li>• Delegated permissions enforced via API token</li>
                <li>• Immutable export audit trail recorded in database</li>
              </ul>
            </div>
          </div>

          {/* Action Dispatch Button */}
          <div className="pt-4">
            <button
              onClick={handleRunExport}
              disabled={exporting || selectedIds.length === 0 || !isConnected}
              className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                exporting || selectedIds.length === 0 || !isConnected
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching Records...
                </>
              ) : selectedDestination === 'microsoft_outlook' ? (
                <>
                  <Mail className="w-4 h-4" /> Dispatch Action Plan via Outlook ({selectedIds.length})
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Run Export ({selectedIds.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Export History Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Recent Automation Exports & Dispatches</h3>
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
                  <th className="py-2.5 px-3">Delivery Channel</th>
                  <th className="py-2.5 px-3 text-center">Count</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-sans capitalize text-white font-medium">{h.export_type}</td>
                    <td className="py-2.5 px-3 font-sans capitalize">{h.destination.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">
                      {h.payload_summary?.dispatch?.recipients ? (
                        <span className="text-amber-300">
                          Outlook ({h.payload_summary.dispatch.recipients.length} recipients)
                        </span>
                      ) : (
                        'Standard API Sync'
                      )}
                    </td>
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

      {/* OAuth Sign-In Modal */}
      <OAuthConnectModal
        isOpen={!!authModalProvider}
        provider={authModalProvider}
        onClose={() => setAuthModalProvider(null)}
        onSuccess={async () => {
          setAuthModalProvider(null);
          await loadData();
        }}
      />
    </div>
  );
};
