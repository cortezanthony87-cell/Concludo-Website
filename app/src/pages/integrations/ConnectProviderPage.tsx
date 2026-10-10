import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';
import {
  INTEGRATION_PROVIDERS_CATALOG,
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
import { IntegrationIcon } from '../../components/integrations/IntegrationIcon';
import Nango from '@nangohq/frontend';

export const ConnectProviderPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();

  const [provider, setProvider] = useState<ProviderDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'idle' | 'starting' | 'waiting_auth' | 'checking' | 'completed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRequested, setIsRequested] = useState(false);
  const [prefetchedSession, setPrefetchedSession] = useState<{ token: string; nango_integration_id: string; connection_id?: string } | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const providers = await integrationsHubService.getProviders();
        const found = providers.find((p) => p.id === providerId) ||
          INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === providerId);
        setProvider(found || null);

        const requests = await integrationsHubService.getAppRequests();
        if (providerId && requests.has(providerId)) {
          setIsRequested(true);
        }

        if (found && normaliseAvailability(found.availability) === 'available') {
          setIsPrefetching(true);
          integrationsHubService.startConnection(found.id)
            .then((session) => setPrefetchedSession(session))
            .catch((err) => console.warn('Pre-fetch connection session warning:', err))
            .finally(() => setIsPrefetching(false));
        }
      } catch (err: any) {
        console.error('Failed to load provider details:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [providerId]);

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-[#E2B53C] animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading app connection...</p>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300">
          <h2 className="text-lg font-bold text-white">App Not Found</h2>
          <p className="text-xs text-slate-400 mt-1">
            The requested app could not be located in the catalogue.
          </p>
        </div>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-[#E2B53C] rounded-lg text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Apps
        </Link>
      </div>
    );
  }

  const panel = connectPanelCopy(provider as unknown as CatalogueApp);
  const availability = normaliseAvailability(provider.availability);

  const handleNotifyClick = async () => {
    try {
      await integrationsHubService.requestApp(provider.id);
      setIsRequested(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not record request.');
    }
  };

  const handleStartConnect = async () => {
    if (!provider) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailHint = accountEmail.trim();
    let session = prefetchedSession;
    if (!session || emailHint) {
      setStep('starting');
      try {
        session = await integrationsHubService.startConnection(provider.id, {
          email_hint: emailHint || undefined,
          connection_id: prefetchedSession?.connection_id,
        });
        setPrefetchedSession(session);
      } catch (err: any) {
        setStep('idle');
        setErrorMsg(err.message || connectionResultText('failed', provider.name));
        return;
      }
    }

    setStep('waiting_auth');
    try {
      const nango = new Nango({ connectSessionToken: session.token, host: 'https://api.nango.dev' });

      const authOpts: any = {
        authorization_params: {
          prompt: 'select_account',
          ...(emailHint ? { login_hint: emailHint } : {}),
        },
      };

      let authSucceeded = false;
      try {
        await nango.auth(session.nango_integration_id, authOpts);
        authSucceeded = true;
      } catch (authErr: any) {
        console.warn('Nango auth error:', authErr);
        const isPopupBlocked =
          authErr?.type === 'blocked_by_browser' ||
          authErr?.message?.toLowerCase().includes('blocked') ||
          authErr?.message?.toLowerCase().includes('popup') ||
          authErr?.message?.toLowerCase().includes('modal') ||
          authErr?.message?.toLowerCase().includes('window');

        if (isPopupBlocked) {
          try {
            await new Promise<void>((resolve, reject) => {
              const connectUI = nango.openConnectUI({
                sessionToken: session!.token,
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
          } catch (uiErr: any) {
            setStep('idle');
            setErrorMsg(uiErr.message || 'Pop-up was blocked. Please allow pop-ups for app.concludo.com.au.');
            return;
          }
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

      setStep('checking');
      let attempts = 0;
      const maxAttempts = 30;
      let verifiedConnection: any = null;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts += 1;

        const connections = await integrationsHubService.getConnections();
        const targetId = session?.connection_id;
        const conn = targetId
          ? connections.find((c) => c.id === targetId) || connections.find((c) => c.provider_id === provider.id)
          : connections.find((c) => c.provider_id === provider.id);

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
      } else {
        setStep('idle');
        setErrorMsg(connectionResultText('unavailable', provider.name));
      }
    } catch (err: any) {
      setStep('idle');
      setErrorMsg(err.message || connectionResultText('failed', provider.name));
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Apps</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 shadow-md">
            <IntegrationIcon slug={provider.iconSlug || provider.id} size={40} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {panel.title}
            </h1>
            <span className="text-xs text-slate-400">{provider.category}</span>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
          {panel.body.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}

          {/* Account Email of user's choosing */}
          {availability === 'available' && step === 'idle' && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Email address of your choosing (optional)</span>
                <span className="text-[10.5px] font-normal text-slate-400">Choose which account to use</span>
              </label>
              <input
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="e.g. yourname@company.com or personal@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 outline-none transition"
              />
              <p className="text-[11px] text-slate-400 leading-normal">
                People may have multiple accounts. Enter the email address of your choosing to direct your sign-in to that specific account, or leave blank to choose during provider sign-in.
              </p>
            </div>
          )}

          {availability === 'available' && panel.permissions && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
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

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
          <Link
            to="/integrations"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
          >
            {step === 'completed' ? 'Back to Apps' : 'Close'}
          </Link>

          {availability === 'available' && step === 'waiting_auth' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartConnect}
                className="btn-connect-gold px-4 py-2 bg-[#E2B53C] hover:bg-[#d4a62f] active:bg-[#bc8a1c] text-[#16263F] font-bold rounded-lg text-xs transition flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Re-open sign-in window
              </button>
            </div>
          )}

          {availability === 'available' && step !== 'completed' && step !== 'waiting_auth' && (
            <button
              type="button"
              onClick={handleStartConnect}
              disabled={step !== 'idle' || isPrefetching}
              className="btn-connect-gold px-5 py-2.5 bg-[#E2B53C] hover:bg-[#d4a62f] active:bg-[#bc8a1c] text-[#16263F] font-bold rounded-lg text-xs transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isPrefetching ? 'Preparing sign-in...' : step === 'idle' ? panel.primary || 'Connect' : 'Connecting...'}
            </button>
          )}

          {availability === 'coming_soon' && !isRequested && (
            <button
              type="button"
              onClick={handleNotifyClick}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-lg text-xs transition"
            >
              I want this app
            </button>
          )}
          {availability === 'coming_soon' && isRequested && (
            <span className="text-xs text-slate-400">
              Requested. Thanks for telling us you want this app.
            </span>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 italic leading-normal">
          {independenceLine()}
        </div>
      </div>
    </div>
  );
};
