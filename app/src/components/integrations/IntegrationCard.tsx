import React from 'react';
import {
  ProviderDefinition,
  IntegrationConnection,
} from '../../lib/integrations/hubRegistry';
import {
  describeStatus,
  lastCheckedText,
  isUsable,
  ConnectionEvidence,
} from '../../lib/integrations/connectionStatus';
import { IntegrationIcon } from './IntegrationIcon';

export interface IntegrationCardProps {
  provider: ProviderDefinition;
  connection?: IntegrationConnection | null;
  onConnect: (provider: ProviderDefinition) => void;
  onManage: (provider: ProviderDefinition, connection: IntegrationConnection) => void;
  onTest?: (connection: IntegrationConnection) => void;
  isTesting?: boolean;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  provider,
  connection,
  onConnect,
  onManage,
}) => {
  const isAustralian = provider.id === 'xero' || provider.id === 'myob';

  // Status mapping via connectionStatus.ts
  const connEvidence: ConnectionEvidence = {
    status: connection?.status || 'not_connected',
    verified_at: (connection as any)?.verified_at || null,
    last_test_at: (connection as any)?.last_test_at || null,
    last_test_result: (connection as any)?.last_test_result || null,
  };

  const statusMeta = describeStatus(connEvidence);
  const usable = connection ? isUsable(connEvidence) : false;

  // Tone pill styles: green only for 'ok' (which no row can be in Phase 0)
  const tonePillClass =
    statusMeta.tone === 'ok'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : statusMeta.tone === 'attention'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : statusMeta.tone === 'failed'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      : 'bg-slate-800/80 text-slate-400 border-slate-700/60';

  return (
    <div
      className={`group relative bg-slate-900/80 hover:bg-slate-900 border rounded-xl p-5 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md h-full ${
        usable
          ? 'border-emerald-500/30 hover:border-emerald-500/50'
          : statusMeta.tone === 'attention'
          ? 'border-amber-500/30 hover:border-amber-500/50'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex-1 flex flex-col">
        {/* Top Header: Framed Vector Logo + Status Pill */}
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

          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${tonePillClass}`}
            >
              {statusMeta.tone === 'ok' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* Application Name & Category */}
        <div className="mt-4 min-h-[48px] flex flex-col justify-start">
          <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-amber-400 transition-colors line-clamp-1 leading-snug">
            {provider.name}
          </h3>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mt-0.5">
            {provider.category}
          </span>
        </div>

        {/* Short Description */}
        <p className="text-slate-300 text-xs mt-2.5 line-clamp-2 leading-relaxed min-h-[38px]">
          {provider.description}
        </p>

        {/* Account Line: account_label if present, otherwise Account not confirmed */}
        {connection && (
          <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/90 text-[11px] flex items-center justify-between">
            <span className="text-slate-400 truncate max-w-[170px]" title={connection.connection_name}>
              {connection.connection_name}
            </span>
            <span className="text-slate-400 text-[11px] truncate max-w-[140px]">
              {(connection as any).account_label || 'Account not confirmed'}
            </span>
          </div>
        )}

        {/* Last Checked Text */}
        {connection && (
          <div className="mt-2 text-[10.5px] text-slate-400">
            {lastCheckedText(connEvidence)}
          </div>
        )}

        {/* Trigger and Action Capabilities Pills */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#16263F] border border-[#21395C] text-slate-300 font-medium">
            {provider.triggers.length} {provider.triggers.length === 1 ? 'Trigger' : 'Triggers'}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#16263F] border border-[#21395C] text-slate-300 font-medium">
            {provider.actions.length} {provider.actions.length === 1 ? 'Action' : 'Actions'}
          </span>
        </div>
      </div>

      {/* Primary Card Actions */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
        {connection ? (
          <>
            <button
              onClick={() => onConnect(provider)}
              className="flex-1 min-h-[40px] py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 border border-slate-700 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              Reconnect
            </button>
            <button
              onClick={() => onManage(provider, connection)}
              className="min-h-[40px] py-2 px-3 bg-slate-800/60 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 rounded-lg text-xs font-medium transition border border-slate-700/60 flex items-center justify-center shrink-0"
              title="Remove connection"
            >
              Remove
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnect(provider)}
            className="w-full min-h-[40px] py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition flex items-center justify-center gap-1.5 border border-slate-700 leading-normal whitespace-nowrap overflow-hidden text-ellipsis"
            title={`Sign-in coming soon for ${provider.name}`}
          >
            Sign-in coming soon
          </button>
        )}
      </div>
    </div>
  );
};
