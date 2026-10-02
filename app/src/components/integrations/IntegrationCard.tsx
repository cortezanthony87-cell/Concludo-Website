import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Settings,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ProviderDefinition, IntegrationConnection } from '../../lib/integrations/hubRegistry';
import { IntegrationIcon } from './IntegrationIcon';

export interface IntegrationCardProps {
  provider: ProviderDefinition;
  connection?: IntegrationConnection | null;
  onConnect: (provider: ProviderDefinition) => void;
  onManage: (provider: ProviderDefinition, connection: IntegrationConnection) => void;
  onTest: (connection: IntegrationConnection) => void;
  isTesting?: boolean;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  provider,
  connection,
  onConnect,
  onManage,
  onTest,
  isTesting = false,
}) => {
  const isConnected = !!connection && connection.status === 'connected';
  const hasIssue = !!connection && (connection.status === 'needs_reauth' || connection.status === 'service_issue');
  const isPermRequired = !!connection && connection.status === 'permission_required';

  const isAustralian = provider.id === 'xero' || provider.id === 'myob';

  return (
    <div
      className={`group relative bg-slate-900/80 hover:bg-slate-900 border rounded-xl p-5 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md ${
        isConnected
          ? 'border-emerald-500/30 hover:border-emerald-500/50'
          : hasIssue
          ? 'border-amber-500/30 hover:border-amber-500/50'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div>
        {/* Top Header: Framed Vector Logo + Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="relative p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner group-hover:border-slate-700 transition">
            <IntegrationIcon slug={provider.iconSlug || provider.id} size={32} />
            {isAustralian && (
              <span
                className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#E2B53C] text-slate-950 uppercase tracking-tighter shadow-sm"
                title="Australian Business Standard"
              >
                AU
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            {isConnected ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : hasIssue ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Needs Attention
              </span>
            ) : isPermRequired ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                Permission Required
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                Not connected
              </span>
            )}

            {provider.isTier1 && (
              <span className="text-[10px] font-semibold text-amber-400/80 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" /> Core Tier 1
              </span>
            )}
          </div>
        </div>

        {/* Application Name & Category */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-amber-400 transition-colors">
              {provider.name}
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mt-0.5">
            {provider.category}
          </span>
        </div>

        {/* Short Description */}
        <p className="text-slate-300 text-xs mt-2.5 line-clamp-2 leading-relaxed">
          {provider.description}
        </p>

        {/* Connected Account Preview if active */}
        {connection && connection.external_account_reference && (
          <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/90 text-[11px] text-slate-300 flex items-center justify-between">
            <span className="text-slate-400 truncate max-w-[170px]" title={connection.connection_name}>
              {connection.connection_name}
            </span>
            <span className="font-mono text-emerald-400 text-[10px] truncate max-w-[120px]">
              {connection.external_account_reference}
            </span>
          </div>
        )}

        {/* Trigger and Action Capabilities Pills */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded bg-[#16263F] border border-[#21395C] text-slate-300">
            {provider.triggers.length} {provider.triggers.length === 1 ? 'Trigger' : 'Triggers'}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#16263F] border border-[#21395C] text-slate-300">
            {provider.actions.length} {provider.actions.length === 1 ? 'Action' : 'Actions'}
          </span>
        </div>
      </div>

      {/* Primary Card Actions */}
      <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
        {isConnected ? (
          <>
            <button
              onClick={() => onManage(provider, connection)}
              className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" /> Manage Connection
            </button>
            <button
              onClick={() => onTest(connection)}
              disabled={isTesting}
              title="Test real connection status"
              className="py-1.5 px-3 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition border border-slate-700/60 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
              Test
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnect(provider)}
            className="w-full py-2 px-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Connect {provider.name}
          </button>
        )}
      </div>
    </div>
  );
};
