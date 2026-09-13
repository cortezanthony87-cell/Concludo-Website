import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RotateCw,
  Copy,
  Check,
  X,
  Code2,
  Lock,
  ExternalLink,
  Shield,
  Layers,
  Terminal,
} from 'lucide-react';
import {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
} from '../../lib/integrations/integrationClient';
import { ApiKey } from '../../lib/integrations/types';

export const ApiAccessPage: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Key creation modal & state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number>(90);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApiKeys();
      setApiKeys(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      setError('Please provide a name for the API key.');
      return;
    }

    setActionLoading('Generating secure API key...');
    setError(null);
    try {
      const result = await createApiKey(keyName.trim(), expiresInDays);
      setNewlyCreatedKey(result.apiKey);
      setShowCreateModal(false);
      setKeyName('');
      setSuccessMessage('API key generated successfully! Please store it securely.');
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to create API key.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action is irreversible.')) return;
    setActionLoading('Revoking API key...');
    try {
      await revokeApiKey(id);
      setSuccessMessage('API key has been revoked.');
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRotate = async (id: string) => {
    if (!window.confirm('Rotating this key will revoke the existing key and generate a new key immediately. Proceed?')) return;
    setActionLoading('Rotating API key...');
    try {
      const result = await rotateApiKey(id);
      setNewlyCreatedKey(result.apiKey);
      setSuccessMessage('Key rotated successfully. Save the new key now.');
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to rotate API key.');
    } finally {
      setActionLoading(null);
    }
  };

  const endpoints = [
    {
      method: 'GET',
      path: '/api/v1/projects',
      desc: 'Retrieve active project transcripts, meeting summaries, and client metadata.',
    },
    {
      method: 'GET',
      path: '/api/v1/outputs',
      desc: 'Query structured executive briefs, memos, and action items generated from sessions.',
    },
    {
      method: 'GET',
      path: '/api/v1/decisions',
      desc: 'Access verified decision memory records, rationale, decision dates, and owners.',
    },
    {
      method: 'GET',
      path: '/api/v1/actions',
      desc: 'Fetch accountability action items, assignees, due dates, and completion status.',
    },
    {
      method: 'GET',
      path: '/api/v1/reports',
      desc: 'Retrieve multi-section endpoint executive reports and session intelligence.',
    },
    {
      method: 'GET',
      path: '/api/v1/insights',
      desc: 'Query recurring themes, top risks, strategic opportunities, and bottlenecks.',
    },
    {
      method: 'GET',
      path: '/api/v1/stats',
      desc: 'Access aggregated metrics, completion rates, and meeting volume trends.',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold tracking-wider uppercase mb-1">
            <Code2 className="w-4 h-4" />
            <span>Developer Platform</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Public API & Access Keys</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Authenticate programmatic requests to Concludo Workspace using SHA-256 encrypted API keys.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadKeys}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition border border-slate-700 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Create API Key
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionLoading && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
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

      {/* One-Time API Key Banner */}
      {newlyCreatedKey && (
        <div className="p-5 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white">Save Your API Key Now</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                For security reasons, this key will <strong>never be shown again</strong>. Store it in a secure password manager or secret store.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs">
            <span className="text-amber-300 select-all flex-1 break-all">{newlyCreatedKey}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold rounded text-xs flex items-center gap-1.5 transition"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey ? 'Copied' : 'Copy Key'}
            </button>
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-xs rounded transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Active API Keys Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" /> Your API Keys
          </h2>
          <span className="text-xs text-slate-400">
            {apiKeys.filter((k) => k.status === 'active').length} Active Key(s)
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-amber-400" />
            <p className="text-sm">Loading API Keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-10 text-center text-slate-400 space-y-3">
            <KeyRound className="w-10 h-10 mx-auto text-slate-500" />
            <h3 className="text-sm font-semibold text-white">No API Keys Configured</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-400">
              Generate an API key to integrate external tools, scripts, or continuous deployment pipelines.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Key Name</th>
                    <th className="py-3.5 px-4">Key Prefix</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">Created Date</th>
                    <th className="py-3.5 px-4">Last Used</th>
                    <th className="py-3.5 px-4">Expires</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {apiKeys.map((key) => {
                    const isRevoked = key.status === 'revoked';
                    return (
                      <tr key={key.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-sans font-medium text-white">
                          {key.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-amber-300">
                          {key.key_prefix}
                        </td>
                        <td className="py-3.5 px-4 text-center font-sans">
                          {isRevoked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              Revoked
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-sans text-slate-400 text-[11px]">
                          {new Date(key.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 font-sans text-slate-400 text-[11px]">
                          {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3.5 px-4 font-sans text-slate-400 text-[11px]">
                          {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-sans">
                          {!isRevoked && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRotate(key.id)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition border border-slate-700 flex items-center gap-1"
                                title="Rotate API Key"
                              >
                                <RotateCw className="w-3 h-3 text-amber-400" /> Rotate
                              </button>
                              <button
                                onClick={() => handleRevoke(key.id)}
                                className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition"
                                title="Revoke Key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* API Reference & Authentication Documentation */}
      <div className="space-y-4 pt-4 border-t border-slate-700/60">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" /> Public API Specification
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Authenticate requests by providing your API key in the Authorization header or x-api-key header.
          </p>
        </div>

        {/* Curl Example */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
          <div className="text-slate-400 font-sans text-[11px] font-semibold uppercase tracking-wider">
            Example Request
          </div>
          <pre className="text-slate-200 overflow-x-auto p-2 bg-slate-900 rounded">
            {`curl -X GET https://app.concludo.com/api/v1/projects \\
  -H "Authorization: Bearer cnc_live_your_api_key_here" \\
  -H "Content-Type: application/json"`}
          </pre>
        </div>

        {/* Endpoints Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {endpoints.map((ep) => (
            <div
              key={ep.path}
              className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20 font-mono">
                  {ep.method}
                </span>
                <span className="font-mono text-xs text-white font-semibold">{ep.path}</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{ep.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Create New API Key</h3>
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
                  Key Name / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CI/CD Integration, HubSpot Sync Worker"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expiration Period
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={180}>180 Days</option>
                  <option value={365}>1 Year</option>
                  <option value={0}>No Expiration</option>
                </select>
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
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" /> Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
