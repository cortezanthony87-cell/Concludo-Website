import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Webhook as WebhookIcon,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  X,
  History,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchWebhooks,
  createWebhook,
  deleteWebhook,
  triggerWebhookTest,
  fetchWebhookLogs,
} from '../../lib/integrations/integrationClient';
import {
  Webhook,
  WebhookEventType,
  WebhookLog,
} from '../../lib/integrations/types';

export const WebhooksPage: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    'action_created',
    'decision_created',
    'report_generated',
  ]);

  // One-time secret display after creation
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Delivery Logs Modal
  const [selectedWebhookLogs, setSelectedWebhookLogs] = useState<{ webhook: Webhook; logs: WebhookLog[] } | null>(null);

  const allEvents: { id: WebhookEventType; label: string; group: string }[] = [
    { id: 'project_created', label: 'Project Created', group: 'Projects' },
    { id: 'project_updated', label: 'Project Updated', group: 'Projects' },
    { id: 'project_deleted', label: 'Project Deleted', group: 'Projects' },
    { id: 'decision_created', label: 'Decision Created', group: 'Decisions' },
    { id: 'decision_updated', label: 'Decision Updated', group: 'Decisions' },
    { id: 'decision_deleted', label: 'Decision Deleted', group: 'Decisions' },
    { id: 'action_created', label: 'Action Created', group: 'Actions' },
    { id: 'action_updated', label: 'Action Updated', group: 'Actions' },
    { id: 'action_completed', label: 'Action Completed', group: 'Actions' },
    { id: 'action_deleted', label: 'Action Deleted', group: 'Actions' },
    { id: 'report_generated', label: 'Report Generated', group: 'Reports' },
  ];

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWebhooks();
      setWebhooks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load webhooks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !endpointUrl.trim()) {
      setError('Name and valid Endpoint URL are required.');
      return;
    }
    if (selectedEvents.length === 0) {
      setError('Please subscribe to at least one event.');
      return;
    }

    setActionLoading('Creating Webhook...');
    setError(null);
    try {
      const res = await createWebhook(name.trim(), endpointUrl.trim(), selectedEvents);
      setShowCreateModal(false);
      setName('');
      setEndpointUrl('');
      setCreatedSecret(res.signingSecret);
      setSuccessMessage('Webhook created successfully! Please save your signing secret.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create webhook.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;
    setActionLoading('Deleting Webhook...');
    try {
      await deleteWebhook(id);
      setSuccessMessage('Webhook deleted.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete webhook.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestPing = async (webhookId: string) => {
    setActionLoading('Sending test ping to endpoint...');
    setError(null);
    try {
      const log = await triggerWebhookTest(webhookId);
      setSuccessMessage(
        `Test ping result: Status ${log.status.toUpperCase()} (HTTP ${log.response_code})`
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to trigger test ping.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewLogs = async (webhook: Webhook) => {
    setActionLoading('Loading delivery logs...');
    try {
      const logs = await fetchWebhookLogs(webhook.id);
      setSelectedWebhookLogs({ webhook, logs });
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery logs.');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleEvent = (eventId: WebhookEventType) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold tracking-wider uppercase mb-1">
            <WebhookIcon className="w-4 h-4" />
            <span>Workflow Connectivity</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Webhooks & Event Streams</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Deliver real-time events for decisions, actions, projects, and executive reports to external endpoints.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition border border-slate-700 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Webhook
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionLoading && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-xs flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>{actionLoading}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Secret Display Banner (Shown ONLY once upon creation) */}
      {createdSecret && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-300">Webhook Signing Secret Generated</h3>
              <p className="text-xs text-slate-300">
                Please copy your webhook secret now. For security purposes, this secret key will <strong>never</strong> be shown again.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 font-mono text-xs">
            <span className="text-amber-200 select-all flex-1 break-all">{createdSecret}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdSecret);
                setCopiedSecret(true);
                setTimeout(() => setCopiedSecret(false), 2000);
              }}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-semibold rounded text-xs flex items-center gap-1.5 transition"
            >
              {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSecret ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setCreatedSecret(null)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-xs rounded transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Webhooks Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
          <p className="text-sm">Loading Webhook Subscriptions...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-4">
          <WebhookIcon className="w-12 h-12 mx-auto text-slate-500" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No Webhook Endpoints Configured</h3>
            <p className="text-xs max-w-md mx-auto text-slate-400">
              Create an incoming or outgoing webhook to synchronize actions, decisions, and meeting summaries to your operational infrastructure.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create First Webhook
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Webhook Name</th>
                  <th className="py-3.5 px-4">Endpoint URL</th>
                  <th className="py-3.5 px-4">Subscribed Events</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {webhooks.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-sans font-medium text-white">
                      {w.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300 max-w-xs truncate" title={w.endpoint_url}>
                      {w.endpoint_url}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {w.events.map((e) => (
                          <span
                            key={e}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] border border-slate-700/60"
                          >
                            {e.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleTestPing(w.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700 transition flex items-center gap-1"
                          title="Trigger a test ping event"
                        >
                          <Play className="w-3 h-3 text-indigo-400" /> Test Ping
                        </button>
                        <button
                          onClick={() => handleViewLogs(w)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700 transition flex items-center gap-1"
                          title="View delivery logs"
                        >
                          <Activity className="w-3 h-3 text-amber-400" /> Logs
                        </button>
                        <button
                          onClick={() => handleDelete(w.id)}
                          className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition"
                          title="Delete webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <WebhookIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Create New Webhook</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Webhook Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zapier Action Dispatcher, AWS Lambda Gateway"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Destination Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks/concludo"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Subscribed Event Triggers
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                  {allEvents.map((evt) => {
                    const isSelected = selectedEvents.includes(evt.id);
                    return (
                      <label
                        key={evt.id}
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition ${
                          isSelected
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEvent(evt.id)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span className="text-[11px] font-sans">{evt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Logs Modal */}
      {selectedWebhookLogs && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Delivery Logs: {selectedWebhookLogs.webhook.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedWebhookLogs.webhook.endpoint_url}
                </p>
              </div>
              <button
                onClick={() => setSelectedWebhookLogs(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedWebhookLogs.logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No delivery attempts recorded yet. Click "Test Ping" to send a sample verification payload.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedWebhookLogs.logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-semibold text-white uppercase text-[11px]">
                        Event: {log.event_type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          log.status === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.status.toUpperCase()} (HTTP {log.response_code})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      Attempt {log.attempt_count} • Executed: {new Date(log.created_at).toLocaleString()}
                    </div>
                    <pre className="p-2 bg-slate-900 rounded text-[11px] text-slate-300 overflow-x-auto">
                      {JSON.stringify(log.request_payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
