import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Plus,
  Key,
  Webhook,
  Activity,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { CONNECTOR_MANIFESTS, ConnectorManifest } from '../../lib/workflows/connectorRegistry';

export const ConnectorCentrePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTab, setSelectedTab] = useState<'all' | 'connected' | 'available' | 'custom'>('all');
  const [connectModalConnector, setConnectModalConnector] = useState<ConnectorManifest | null>(null);

  const categories = [
    'All',
    'Concludo Native',
    'CRM & Sales',
    'Finance & Payments',
    'Productivity & Documents',
    'Communication',
    'Developer & Webhooks',
  ];

  const connectorList: ConnectorManifest[] = Object.values(CONNECTOR_MANIFESTS);
  const filteredConnectors = connectorList.filter((conn: ConnectorManifest) => {
    const matchesSearch =
      conn.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.connectorKey.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' ||
      (selectedCategory === 'Concludo Native' && conn.category === 'meetings') ||
      (selectedCategory === 'CRM & Sales' && (conn.category === 'integrations' && conn.connectorKey.includes('hubspot'))) ||
      (selectedCategory === 'Finance & Payments' && conn.connectorKey.includes('stripe')) ||
      (selectedCategory === 'Productivity & Documents' && (conn.connectorKey.includes('google') || conn.connectorKey.includes('microsoft'))) ||
      (selectedCategory === 'Communication' && (conn.connectorKey.includes('slack') || conn.connectorKey.includes('notifications')));

    const isConnected = conn.category === 'meetings' || conn.category === 'governance'; // Concludo native are active
    const matchesTab =
      selectedTab === 'all' ||
      (selectedTab === 'connected' && isConnected) ||
      (selectedTab === 'available' && !isConnected) ||
      (selectedTab === 'custom' && conn.connectorKey.startsWith('custom_'));

    return matchesSearch && matchesCategory && matchesTab;
  });

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 p-6 lg:p-10 font-['Inter']">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2 rounded-lg bg-[#16263F] text-[#E2B53C] border border-[#E2B53C]/20">
                <Boxes className="w-6 h-6" />
              </span>
              <h1 className="text-2xl lg:text-3xl font-bold font-['Poppins'] text-white">
                Connector Centre
              </h1>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl">
              Manage enterprise connections, authentication credentials, and discovery manifests for the Concludo Natural-Language Workflow Platform.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/workflows/builder"
              className="px-4 py-2 bg-gradient-to-r from-[#16263F] to-[#1E3A5F] hover:from-[#1E3A5F] hover:to-[#2A4D7A] border border-[#E2B53C]/30 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition"
            >
              <span>Open Workflow Builder</span>
              <ArrowRight className="w-4 h-4 text-[#E2B53C]" />
            </Link>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="max-w-7xl mx-auto mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Tabs */}
          <div className="flex items-center bg-[#111827] p-1 rounded-lg border border-slate-800 text-sm">
            {(['all', 'connected', 'available', 'custom'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-4 py-1.5 rounded-md font-medium capitalize transition ${
                  selectedTab === tab
                    ? 'bg-[#16263F] text-[#E2B53C] border border-[#E2B53C]/20 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search connectors or triggers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111827] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E2B53C]/50 transition"
            />
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full border transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#E2B53C]/10 border-[#E2B53C] text-[#E2B53C] font-semibold'
                  : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConnectors.map((conn) => {
            const isNative = conn.category === 'meetings' || conn.category === 'governance';
            return (
              <div
                key={conn.connectorKey}
                className="bg-[#111827] border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition group shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#16263F] border border-slate-700 flex items-center justify-center text-lg font-bold text-[#E2B53C]">
                        {conn.displayName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-[#E2B53C] transition">
                          {conn.displayName}
                        </h3>
                        <span className="text-[11px] text-slate-500 font-mono">
                          v{conn.version} • {conn.authenticationType}
                        </span>
                      </div>
                    </div>

                    {isNative ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        Available
                      </span>
                    )}
                  </div>

                  <p className="text-slate-400 text-xs mb-4 line-clamp-2">
                    {conn.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700">
                      {conn.triggers.length} Triggers
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700">
                      {conn.actions.length} Actions
                    </span>
                    {conn.webhookSupport && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                        Webhooks
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setConnectModalConnector(conn)}
                    className="text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#E2B53C]" />
                    <span>View Capabilities</span>
                  </button>

                  {isNative ? (
                    <span className="text-emerald-400 font-medium">Ready</span>
                  ) : (
                    <button
                      onClick={() => setConnectModalConnector(conn)}
                      className="px-3 py-1 bg-[#16263F] hover:bg-[#1E3A5F] border border-[#E2B53C]/30 text-[#E2B53C] rounded-md font-medium transition"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Capability / Connect Modal */}
      {connectModalConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#16263F] border border-slate-700 flex items-center justify-center text-lg font-bold text-[#E2B53C]">
                  {connectModalConnector.displayName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{connectModalConnector.displayName}</h3>
                  <p className="text-xs text-slate-400">Authentication: {connectModalConnector.authenticationType}</p>
                </div>
              </div>
              <button
                onClick={() => setConnectModalConnector(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <h4 className="text-xs font-semibold text-[#E2B53C] uppercase tracking-wider mb-2">Triggers</h4>
                <div className="flex flex-wrap gap-2">
                  {connectModalConnector.triggers.map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-[#E2B53C] uppercase tracking-wider mb-2">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {connectModalConnector.actions.map((a) => (
                    <span key={a} className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-[#E2B53C] uppercase tracking-wider mb-2">Required Scopes</h4>
                <div className="flex flex-wrap gap-2">
                  {connectModalConnector.requiredScopes.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded bg-slate-800/50 border border-slate-700 text-xs text-slate-400 font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setConnectModalConnector(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert(`Connection initiated for ${connectModalConnector.displayName} via OAuth/Secret Vault.`);
                  setConnectModalConnector(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#16263F] hover:bg-[#1E3A5F] border border-[#E2B53C]/40 text-[#E2B53C] text-sm font-semibold transition"
              >
                Start Authorisation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
