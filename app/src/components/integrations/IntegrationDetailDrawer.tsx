import React, { useState } from 'react';
import {
  X,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Check,
  ExternalLink,
  Zap,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  ProviderDefinition,
  IntegrationConnection,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import { IntegrationIcon } from './IntegrationIcon';

export interface IntegrationDetailDrawerProps {
  provider: ProviderDefinition | null;
  connection: IntegrationConnection | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (provider: ProviderDefinition) => void;
  onRefresh: () => Promise<void>;
}

export const IntegrationDetailDrawer: React.FC<IntegrationDetailDrawerProps> = ({
  provider,
  connection,
  isOpen,
  onClose,
  onConnect,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'triggers' | 'actions' | 'connection'>('overview');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(connection?.connection_name || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!isOpen || !provider) return null;

  const isConnected = !!connection && connection.status === 'connected';

  const handleTest = async () => {
    if (!connection) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await integrationsHubService.testConnection(connection.id);
      setTestResult({ success: res.success, message: res.message });
      await onRefresh();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveName = async () => {
    if (!connection || !newName.trim()) return;
    try {
      await integrationsHubService.renameConnection(connection.id, newName.trim());
      setIsRenaming(false);
      await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    if (!window.confirm(`Are you sure you want to disconnect ${connection.connection_name}? Workflows using this account will be paused.`)) return;
    setDisconnecting(true);
    try {
      await integrationsHubService.disconnect(connection.id);
      await onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-md">
              <IntegrationIcon slug={provider.iconSlug || provider.id} size={40} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">{provider.name}</h2>
                {isConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs mt-1">{provider.category} Integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-900/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('triggers')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'triggers'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Triggers ({provider.triggers.length})
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'actions'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Actions ({provider.actions.length})
          </button>
          <button
            onClick={() => setActiveTab('connection')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'connection'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Connection Management
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  About {provider.name}
                </h3>
                <p className="text-slate-200 text-sm leading-relaxed">{provider.description}</p>
              </div>

              {/* Authentication Details */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <Shield className="w-4 h-4" /> Secure Authentication & Zero-Secret Architecture
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Concludo authenticates directly using {provider.authenticationType.toUpperCase()}. Credentials and tokens are encrypted with multi-tenant boundaries and are never exposed to browser memory.
                </p>
              </div>

              {/* Quick capabilities summary */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Supported Workflow Capabilities
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-xl font-bold text-white">{provider.triggers.length}</span>
                    <span className="text-xs text-slate-400 block mt-0.5">Automated Triggers</span>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-xl font-bold text-white">{provider.actions.length}</span>
                    <span className="text-xs text-slate-400 block mt-0.5">Workflow Actions</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'triggers' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Workflows can be started automatically when these events occur in {provider.name}:
              </p>
              {provider.triggers.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No automated triggers registered for this provider.
                </div>
              ) : (
                provider.triggers.map((t) => (
                  <div key={t.key} className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">{t.name}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-400 border border-slate-700">
                        {t.triggerType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{t.description}</p>
                    <div className="text-[11px] font-mono text-slate-400 pt-1">
                      Event Key: <code className="text-slate-300">{t.key}</code>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Concludo workflows can execute the following actions in {provider.name}:
              </p>
              {provider.actions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No actions registered for this provider.
                </div>
              ) : (
                provider.actions.map((a) => (
                  <div key={a.key} className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">{a.name}</h4>
                      <span className="text-[10px] font-mono text-slate-400">Action Key: {a.key}</span>
                    </div>
                    <p className="text-xs text-slate-300">{a.description}</p>
                    {a.requiredScopes.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-500">Scopes:</span>
                        {a.requiredScopes.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'connection' && (
            <div className="space-y-6">
              {isConnected && connection ? (
                <>
                  <div className="p-5 bg-slate-950/80 rounded-xl border border-emerald-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Connection Status</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active & Healthy
                      </span>
                    </div>

                    {/* Friendly Name */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Connection Name
                      </label>
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="flex-1 bg-slate-900 border border-amber-400/50 rounded-lg px-3 py-1.5 text-xs text-white"
                          />
                          <button
                            onClick={handleSaveName}
                            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs text-white">
                          <span>{connection.connection_name}</span>
                          <button
                            onClick={() => {
                              setNewName(connection.connection_name);
                              setIsRenaming(true);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* External Account Email */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Connected Account
                      </span>
                      <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
                        {connection.external_account_reference || 'Authorised Identity'}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-400">
                      <div>
                        <span>Connected:</span>
                        <div className="text-slate-200 mt-0.5">
                          {new Date(connection.connected_at).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span>Last Verified:</span>
                        <div className="text-slate-200 mt-0.5">
                          {connection.last_tested_at ? new Date(connection.last_tested_at).toLocaleString() : 'Just now'}
                        </div>
                      </div>
                    </div>

                    {/* Test result message */}
                    {testResult && (
                      <div
                        className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                          testResult.success
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                        <span>{testResult.message}</span>
                      </div>
                    )}

                    {/* Management Action Buttons */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 border border-slate-700"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-amber-400' : ''}`} />
                        {testing ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        onClick={() => onConnect(provider)}
                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-semibold transition border border-slate-700"
                      >
                        Reconnect
                      </button>
                      <button
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold transition border border-rose-500/20 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Disconnect
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">No active connection found</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      Connect your {provider.name} account to enable automated actions and triggers across your Concludo workflows.
                    </p>
                  </div>
                  <button
                    onClick={() => onConnect(provider)}
                    className="py-2.5 px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition shadow-md"
                  >
                    Connect {provider.name} Now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer CTA */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Concludo Multi-Tenant Vault • Zero-Secret Architecture
          </div>
          {!isConnected && (
            <button
              onClick={() => onConnect(provider)}
              className="py-2 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Connect Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
