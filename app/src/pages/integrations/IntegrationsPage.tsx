import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  RefreshCw,
  History,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
} from 'lucide-react';
import {
  INTEGRATION_PROVIDERS_CATALOG,
  INTEGRATION_CATEGORIES,
  IntegrationCategory,
  ProviderDefinition,
  IntegrationConnection,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import {
  isUsable,
  statusSortRank,
  ConnectionEvidence,
} from '../../lib/integrations/connectionStatus';
import { IntegrationCard } from '../../components/integrations/IntegrationCard';
import { IntegrationDetailDrawer } from '../../components/integrations/IntegrationDetailDrawer';

export const IntegrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory>('All Apps');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'not_connected'>('all');
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Drawer State
  const [selectedProvider, setSelectedProvider] = useState<ProviderDefinition | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const data = await integrationsHubService.getConnections();
      setConnections(data);
    } catch (err: any) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const connectionsMap = useMemo(() => {
    const map = new Map<string, IntegrationConnection>();
    for (const c of connections) {
      map.set(c.provider_id, c);
    }
    return map;
  }, [connections]);

  const toEvidence = (c?: IntegrationConnection | null): ConnectionEvidence => ({
    status: c?.status || 'not_connected',
    verified_at: (c as any)?.verified_at || null,
    last_test_at: (c as any)?.last_test_at || null,
    last_test_result: (c as any)?.last_test_result || null,
  });

  const connectedCount = useMemo(() => {
    return connections.filter((c) => isUsable(toEvidence(c))).length;
  }, [connections]);

  // Enhanced search across app name, category, and capabilities
  const filteredProviders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = INTEGRATION_PROVIDERS_CATALOG.filter((p) => {
      const conn = connectionsMap.get(p.id) || null;
      const usable = isUsable(toEvidence(conn));

      // 1. Category Filter
      if (selectedCategory === 'Connected') {
        if (!usable) return false;
      } else if (selectedCategory !== 'All Apps' && p.category !== selectedCategory) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter === 'connected') {
        if (!usable) return false;
      } else if (statusFilter === 'not_connected') {
        if (usable) return false;
      }

      // 3. Search Query Filter
      if (!q) return true;

      const matchName = p.name.toLowerCase().includes(q);
      const matchCat = p.category.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchTriggers = p.triggers.some((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      const matchActions = p.actions.some((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));

      const isEmailQuery = q === 'email' || q === 'mail';
      const isEmailProvider = p.id === 'microsoft_outlook' || p.id === 'gmail' || p.id === 'mailchimp' || p.id === 'email_universal';

      const isAccountingQuery = q === 'accounting' || q === 'finance' || q === 'invoice';
      const isAccountingProvider = p.category === 'Accounting & Finance' || p.id === 'xero' || p.id === 'myob' || p.id === 'quickbooks';

      const isCrmQuery = q === 'crm' || q === 'sales' || q === 'leads';
      const isCrmProvider = p.category === 'CRM & Sales' || p.id === 'salesforce' || p.id === 'hubspot' || p.id === 'dynamics_365';

      return (
        matchName ||
        matchCat ||
        matchDesc ||
        matchTriggers ||
        matchActions ||
        (isEmailQuery && isEmailProvider) ||
        (isAccountingQuery && isAccountingProvider) ||
        (isCrmQuery && isCrmProvider)
      );
    });

    // Sort by statusSortRank so items needing attention come first
    return list.sort((a, b) => {
      const connA = connectionsMap.get(a.id) || null;
      const connB = connectionsMap.get(b.id) || null;
      const rankA = statusSortRank(toEvidence(connA));
      const rankB = statusSortRank(toEvidence(connB));
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, selectedCategory, statusFilter, connectionsMap]);

  const handleOpenManage = (provider: ProviderDefinition, connection: IntegrationConnection) => {
    setSelectedProvider(provider);
    setIsDrawerOpen(true);
  };

  const handleStartConnect = (provider: ProviderDefinition) => {
    navigate(`/integrations/connect/${provider.id}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Breadcrumb Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Integrations Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
              {connectedCount} Connected
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Connect your organisation's business applications to execute automated workflow triggers and actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/workflows/builder"
            className="px-4 py-2 bg-[#E2B53C] hover:bg-[#d4a62f] active:bg-[#bc8a1c] text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-2 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Open Workflow Builder
          </Link>
          <Link
            to="/integrations/history"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition border border-slate-700 flex items-center gap-2"
          >
            <History className="w-3.5 h-3.5" /> Sync Logs
          </Link>
        </div>
      </div>

      {/* Dismissible Informational Banner */}
      {!isBannerDismissed && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#E2B53C] flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white block mb-0.5">
                Concludo now checks every connection with the app itself.
              </strong>
              Connections added before 6 October 2026 are marked Not verified, because Concludo never signed in to those apps. Secure sign-in for Microsoft 365 is being set up. Until then, no app is shown as connected.
            </div>
          </div>
          <button
            onClick={() => setIsBannerDismissed(true)}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between shadow-lg transition-all animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Global Search Bar */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search integrations by name, category, or capability..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Connection Status Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-medium w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Apps
          </button>
          <button
            onClick={() => setStatusFilter('connected')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              statusFilter === 'connected' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Connected ({connectedCount})
          </button>
          <button
            onClick={() => setStatusFilter('not_connected')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'not_connected' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Available to Connect
          </button>
        </div>
      </div>

      {/* Categories Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800/80">
        {INTEGRATION_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition ${
                isActive
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* App Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading Integrations Catalogue...</p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
          <Filter className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No integrations match your search</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search terms or filter category to discover available business applications.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All Apps');
              setStatusFilter('all');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => {
            const conn = connectionsMap.get(provider.id) || null;
            return (
              <IntegrationCard
                key={provider.id}
                provider={provider}
                connection={conn}
                onConnect={handleStartConnect}
                onManage={handleOpenManage}
              />
            );
          })}
        </div>
      )}

      {/* Integration Detail Drawer */}
      <IntegrationDetailDrawer
        provider={selectedProvider}
        connection={selectedProvider ? connectionsMap.get(selectedProvider.id) || null : null}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedProvider(null);
        }}
        onConnect={handleStartConnect}
        onRefresh={loadConnections}
      />
    </div>
  );
};
