import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  ProviderDefinition,
  IntegrationConnection,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import {
  describeStatus,
  lastCheckedText,
  ConnectionEvidence,
} from '../../lib/integrations/connectionStatus';
import { independenceLine } from '../../lib/integrations/appCatalogue';
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
  onRefresh,
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  if (!isOpen || !provider) return null;

  const connEvidence: ConnectionEvidence = {
    status: connection?.status || 'not_connected',
    verified_at: (connection as any)?.verified_at || null,
    last_test_at: (connection as any)?.last_test_at || null,
    last_test_result: (connection as any)?.last_test_result || null,
  };

  const statusMeta = describeStatus(connEvidence);
  const isMicrosoft = provider.provider_family === 'microsoft' || provider.id.startsWith('microsoft_');

  const handleConfirmRemove = async () => {
    if (!connection) return;
    setIsRemoving(true);
    setErrorMsg(null);
    try {
      await integrationsHubService.disconnect(connection.id);
      setRemoved(true);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove connection.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden justify-between p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <IntegrationIcon slug={provider.iconSlug || provider.id} size={36} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{provider.name}</h2>
                <span className="text-xs text-slate-400">{provider.category}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status info if connected */}
          {connection && !removed && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-semibold text-slate-200">{statusMeta.label}</span>
              </div>
              {(connection as any)?.account_label && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Account</span>
                  <span className="text-slate-300 font-mono">
                    {(connection as any).account_label}
                  </span>
                </div>
              )}
              <div className="text-[10.5px] text-slate-500 pt-1 border-t border-slate-800/60">
                {lastCheckedText(connEvidence)}
              </div>
            </div>
          )}

          {/* Remove Section */}
          {!removed ? (
            <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">
                Remove {provider.name}?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Concludo will delete its sign-in for {provider.name}. Workflows that use it will stop at that step until you connect again.
              </p>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={handleConfirmRemove}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {isRemoving ? 'Removing...' : 'Remove'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">
                {provider.name} removed
              </h3>
              {isMicrosoft ? (
                <p className="text-xs text-slate-300 leading-relaxed">
                  To remove Concludo's approval from your Microsoft account too, go to{' '}
                  <a
                    href="https://myapps.microsoft.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#E2B53C] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    your Microsoft account's apps page <ExternalLink className="w-3 h-3 inline" />
                  </a>.
                </p>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  Concludo has revoked the sign-in with Google and removed the connection.
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Independence line */}
        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 italic leading-normal">
          {independenceLine()}
        </div>
      </div>
    </div>
  );
};
