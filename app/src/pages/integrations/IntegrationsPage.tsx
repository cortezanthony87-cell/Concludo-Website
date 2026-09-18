import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  ListTodo,
  MessageSquare,
  Mail,
  Columns3,
  CheckCircle2,
  CalendarCheck,
  Boxes,
  CheckCircle,
  BookOpen,
  Hash,
  Briefcase,
  Cloud,
  RefreshCw,
  History,
  ExternalLink,
  Settings,
  AlertCircle,
  Check,
  X,
  Plus,
  Play,
} from 'lucide-react';
import {
  fetchIntegrations,
  connectIntegration,
  reconnectIntegration,
  disconnectIntegration,
  triggerSync,
  updateIntegrationSettings,
} from '../../lib/integrations/integrationClient';
import {
  Integration,
  IntegrationProvider,
  PROVIDER_CATALOG,
  ProviderMeta,
} from '../../lib/integrations/types';

export const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedProvider, setSelectedProvider] = useState<ProviderMeta | null>(null);
  const [configSettings, setConfigSettings] = useState<string>('{}');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIntegrations();
      setIntegrations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load integrations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getIntegrationForProvider = (providerId: IntegrationProvider) => {
    return integrations.find((i) => i.provider === providerId);
  };

  const handleConnect = async (provider: IntegrationProvider) => {
    setActionLoading(`Connecting to ${provider}...`);
    setError(null);
    try {
      await connectIntegration(provider);
      setSuccessMessage(`Successfully connected to ${provider.replace('_', ' ').toUpperCase()}!`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to connect integration.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setActionLoading('Disconnecting integration...');
    setError(null);
    try {
      await disconnectIntegration(integrationId);
      setSuccessMessage('Integration disconnected successfully.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect integration.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async (integrationId: string) => {
    setActionLoading('Syncing data...');
    setError(null);
    try {
      const log = await triggerSync(integrationId);
      setSuccessMessage(
        `Sync completed: ${log.records_processed} records processed in ${log.duration_ms}ms.`
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to sync records.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedProvider) return;
    const existing = getIntegrationForProvider(selectedProvider.id);
    if (!existing) return;

    setActionLoading('Saving settings...');
    try {
      const parsed = JSON.parse(configSettings);
      await updateIntegrationSettings(existing.id, parsed);
      setSelectedProvider(null);
      setSuccessMessage('Integration settings updated successfully.');
      await loadData();
    } catch (err: any) {
      setError('Invalid JSON settings format.');
    } finally {
      setActionLoading(null);
    }
  };

  const categories = ['All', 'Project Management', 'Collaboration', 'Documentation', 'CRM'];

  const filteredCatalog = PROVIDER_CATALOG.filter(
    (p) => selectedCategory === 'All' || p.category === selectedCategory
  );

  const getIcon = (name: string) => {
    switch (name) {
      case 'CheckSquare':
        return <CheckSquare className="w-6 h-6 text-indigo-400" />;
      case 'ListTodo':
        return <ListTodo className="w-6 h-6 text-blue-400" />;
      case 'MessageSquare':
        return <MessageSquare className="w-6 h-6 text-purple-400" />;
      case 'Mail':
        return <Mail className="w-6 h-6 text-sky-400" />;
      case 'Trello':
        return <Columns3 className="w-6 h-6 text-blue-500" />;
      case 'CheckCircle2':
        return <CheckCircle2 className="w-6 h-6 text-rose-400" />;
      case 'CalendarCheck':
        return <CalendarCheck className="w-6 h-6 text-yellow-400" />;
      case 'Boxes':
        return <Boxes className="w-6 h-6 text-blue-600" />;
      case 'CheckCircle':
        return <CheckCircle className="w-6 h-6 text-pink-400" />;
      case 'BookOpen':
        return <BookOpen className="w-6 h-6 text-emerald-400" />;
      case 'Hash':
        return <Hash className="w-6 h-6 text-teal-400" />;
      case 'Briefcase':
        return <Briefcase className="w-6 h-6 text-orange-400" />;
      case 'Cloud':
        return <Cloud className="w-6 h-6 text-sky-500" />;
      default:
        return <CheckCircle className="w-6 h-6 text-amber-400" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Integrations & Workflows</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Pro & Enterprise
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Connect operational tools, task managers, documentation wikis, and CRMs to automate action and decision dispatch.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/automation-export"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Export Actions & Decisions
          </Link>
          <Link
            to="/integrations/history"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition border border-slate-700 flex items-center gap-2"
          >
            <History className="w-4 h-4" /> View Sync Logs
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

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionLoading && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm flex items-center gap-2 animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>{actionLoading}</span>
        </div>
      )}

      {/* Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-amber-400 text-slate-900 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Integrations Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-amber-400" />
          <p className="text-sm">Loading Integrations...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCatalog.map((provider) => {
            const connected = getIntegrationForProvider(provider.id);
            const isConnected = connected && connected.status === 'connected';
            const isSyncing = connected && connected.status === 'syncing';

            return (
              <div
                key={provider.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
                      {getIcon(provider.iconName)}
                    </div>
                    {isConnected ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
                      </span>
                    ) : isSyncing ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Disconnected
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-white mt-4">{provider.name}</h3>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mt-0.5">
                    {provider.category}
                  </span>
                  <p className="text-slate-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                    {provider.description}
                  </p>

                  {connected?.last_sync_at && (
                    <div className="mt-3 text-[11px] text-slate-400">
                      Last sync: {new Date(connected.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => handleSync(connected.id)}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400" /> Sync Now
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedProvider(provider);
                            setConfigSettings(JSON.stringify(connected.settings, null, 2));
                          }}
                          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                          title="Configure"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDisconnect(connected.id)}
                          disabled={actionLoading !== null}
                          className="px-2.5 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded text-xs font-medium transition"
                        >
                          Disconnect
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(provider.id)}
                      disabled={actionLoading !== null}
                      className="btn-connect-gold w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Connect {provider.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Configure {selectedProvider.name}</h3>
              <button
                onClick={() => setSelectedProvider(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Provide JSON settings for webhook destination channels, workspace target identifiers, or sync intervals.
            </p>
            <textarea
              value={configSettings}
              onChange={(e) => setConfigSettings(e.target.value)}
              rows={6}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedProvider(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
