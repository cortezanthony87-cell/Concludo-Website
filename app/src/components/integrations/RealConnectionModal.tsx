import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  ProviderDefinition,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import {
  connectPanelCopy,
  independenceLine,
  normaliseAvailability,
  connectionResultText,
  type CatalogueApp,
} from '../../lib/integrations/appCatalogue';
import { IntegrationIcon } from './IntegrationIcon';
import Nango from '@nangohq/frontend';

export interface RealConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ProviderDefinition | null;
  onSuccess?: (conn?: any) => void;
  isRequested?: boolean;
  onNotify?: (provider: ProviderDefinition) => void;
}

export const RealConnectionModal: React.FC<RealConnectionModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSuccess,
  isRequested = false,
  onNotify,
}) => {
  const [step, setStep] = useState<'idle' | 'starting' | 'waiting_auth' | 'checking' | 'completed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasRequestedLocal, setHasRequestedLocal] = useState(false);

  if (!isOpen || !provider) return null;

  const panel = connectPanelCopy(provider as unknown as CatalogueApp);
  const availability = normaliseAvailability(provider.availability);
  const requested = isRequested || hasRequestedLocal;

  const handleNotifyClick = async () => {
    try {
      if (onNotify) {
        onNotify(provider);
      } else {
        await integrationsHubService.requestApp(provider.id);
      }
      setHasRequestedLocal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not record request.');
    }
  };

  const handleStartConnect = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setStep('starting');

    try {
      const { token, nango_integration_id } = await integrationsHubService.startConnection(provider.id);

      setStep('waiting_auth');
      const nango = new Nango({ connectSessionToken: token, host: 'https://api.nango.dev' });

      let authSucceeded = false;
      try {
        await nango.auth(nango_integration_id);
        authSucceeded = true;
      } catch (authErr: any) {
        // If popup was blocked by browser, fallback to openConnectUI modal
        if (authErr?.type === 'blocked_by_browser') {
          await new Promise<void>((resolve, reject) => {
            const connectUI = nango.openConnectUI({
              sessionToken: token,
              onEvent: (event) => {
                if (event.type === 'connect') {
                  connectUI.close();
                  authSucceeded = true;
                  resolve();
                } else if (event.type === 'close') {
                  connectUI.close();
                  resolve();
                } else if (event.type === 'error') {
                  connectUI.close();
                  reject(new Error(event.payload.errorMessage));
                }
              },
            });
            connectUI.open();
          });
        } else {
          setStep('idle');
          setErrorMsg(connectionResultText('cancelled', provider.name));
          return;
        }
      }

      if (!authSucceeded) {
        setStep('idle');
        setErrorMsg(connectionResultText('cancelled', provider.name));
        return;
      }

      // Authorization completed in Nango. Now poll for webhook verification
      setStep('checking');
      let attempts = 0;
      const maxAttempts = 30; // 30 * 2s = 60s
      let verifiedConnection: any = null;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts += 1;

        const connections = await integrationsHubService.getConnections();
        const conn = connections.find((c) => c.provider_id === provider.id);

        if (conn) {
          if (conn.status === 'connected') {
            verifiedConnection = conn;
            break;
          } else if (conn.status === 'permission_required') {
            setErrorMsg(connectionResultText('permission_required', provider.name));
            setStep('idle');
            return;
          } else if (conn.status === 'failed') {
            setErrorMsg(connectionResultText('failed', provider.name));
            setStep('idle');
            return;
          }
        }
      }

      if (verifiedConnection) {
        setStep('completed');
        const account = (verifiedConnection as any).account_label;
        setSuccessMsg(connectionResultText('connected', provider.name, account));
        if (onSuccess) onSuccess(verifiedConnection);
      } else {
        setStep('idle');
        setErrorMsg(connectionResultText('unavailable', provider.name));
      }
    } catch (err: any) {
      setStep('idle');
      setErrorMsg(err.message || connectionResultText('failed', provider.name));
    }
  };

  const handleModalClose = () => {
    if (step === 'checking' || step === 'starting') return;
    setStep('idle');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
              <IntegrationIcon slug={provider.iconSlug || provider.id} size={36} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {panel.title}
              </h2>
              <span className="text-[11px] font-medium text-slate-400 block">{provider.category}</span>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
          {panel.body.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}

          {/* Scopes & Permissions Summary for available apps */}
          {availability === 'available' && panel.permissions && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2">
              <div>
                <strong className="text-white block mb-0.5">Concludo will be able to:</strong>
                <span className="text-slate-300">{panel.permissions.willBeAbleTo}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <strong className="text-white block mb-0.5">Concludo will not:</strong>
                <span className="text-slate-400">{panel.permissions.willNot}</span>
              </div>
            </div>
          )}

          {/* Status Notifications */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* In-flight feedback */}
          {step === 'starting' && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-[#E2B53C] animate-spin shrink-0" />
              <span>Preparing secure sign-in session...</span>
            </div>
          )}

          {step === 'waiting_auth' && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-[#E2B53C] animate-spin shrink-0" />
              <span>Waiting for sign-in on provider page...</span>
            </div>
          )}

          {step === 'checking' && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              <span>Checking the connection with the app...</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
          {step === 'completed' ? (
            <button
              type="button"
              onClick={handleModalClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Done
            </button>
          ) : availability === 'available' ? (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                disabled={step === 'checking' || step === 'starting'}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartConnect}
                disabled={step !== 'idle'}
                className="px-5 py-2 bg-[#E2B53C] hover:bg-[#d4a62f] active:bg-[#bc8a1c] text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {step === 'idle' ? panel.primary || 'Connect' : 'Connecting...'}
              </button>
            </>
          ) : availability === 'coming_soon' ? (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Close
              </button>
              {!requested ? (
                <button
                  type="button"
                  onClick={handleNotifyClick}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-xl text-xs transition"
                >
                  I want this app
                </button>
              ) : (
                <span className="text-xs text-slate-400 py-2">
                  Requested. Thanks for telling us you want this app.
                </span>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleModalClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
          )}
        </div>

        {/* Independence Line */}
        <div className="pt-2 border-t border-slate-800/80 text-[10.5px] text-slate-500 italic leading-normal">
          {independenceLine()}
        </div>
      </div>
    </div>
  );
};
