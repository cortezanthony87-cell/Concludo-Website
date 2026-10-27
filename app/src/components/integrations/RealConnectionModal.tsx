import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, RefreshCw, ExternalLink, Key, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import {
  ProviderDefinition,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import {
  connectPanelCopy,
  independenceLine,
  normaliseAvailability,
  connectionResultText,
  isNativeOAuthProvider,
  isDirectKeyProvider,
  getCredentialFieldInfo,
  type CatalogueApp,
} from '../../lib/integrations/appCatalogue';
import { IntegrationIcon } from './IntegrationIcon';
import Nango from '@nangohq/frontend';

export interface RealConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ProviderDefinition | null;
  existingConnection?: any;
  isNew?: boolean;
  onSuccess?: (conn?: any) => void;
  isRequested?: boolean;
  onNotify?: (provider: ProviderDefinition) => void;
}

export const RealConnectionModal: React.FC<RealConnectionModalProps> = ({
  isOpen,
  onClose,
  provider,
  existingConnection,
  isNew = false,
  onSuccess,
  isRequested = false,
  onNotify,
}) => {
  const [step, setStep] = useState<'idle' | 'starting' | 'waiting_auth' | 'checking' | 'completed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasRequestedLocal, setHasRequestedLocal] = useState(false);
  const [prefetchedSession, setPrefetchedSession] = useState<{ token: string; nango_integration_id: string; connection_id?: string } | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [credential, setCredential] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showCustomKey, setShowCustomKey] = useState(false);

  React.useEffect(() => {
    if (isOpen && provider) {
      setStep('idle');
      setErrorMsg(null);
      setSuccessMsg(null);
      setHasRequestedLocal(false);
      setPrefetchedSession(null);
      setActiveConnectionId(existingConnection?.id || null);
      setAccountEmail(existingConnection?.account_label || '');
      setCredential('');
      setSecondaryValue('');
      setShowSecret(false);

      const availability = normaliseAvailability(provider.availability);
      const isNative = isNativeOAuthProvider(provider);
      const isDirect = isDirectKeyProvider(provider);
      // Only pre-fetch session for third-party Nango integrations where available
      if (availability === 'available' && !isNative && !isDirect && provider.nango_integration_id) {
        setIsPrefetching(true);
        integrationsHubService.startConnection(provider.id, {
          connection_id: existingConnection?.id,
          is_new: isNew,
        })
          .then((session) => {
            setPrefetchedSession(session);
          })
          .catch((err) => {
            console.warn('Pre-fetch connection session warning:', err);
          })
          .finally(() => {
            setIsPrefetching(false);
          });
      }
    } else {
      setPrefetchedSession(null);
      setIsPrefetching(false);
    }
  }, [isOpen, provider?.id]);

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
    if (!provider) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailHint = accountEmail.trim();
    const isNative = isNativeOAuthProvider(provider);
    const isDirect = isDirectKeyProvider(provider);

    // Special handling for Anthropic Claude: Effortless 1-Click Workspace Connection
    if (provider.id === 'anthropic_claude') {
      setStep('starting');
      try {
        const cred = credential.trim();
        const conn = await integrationsHubService.connectDirect({
          provider_id: provider.id,
          credential: cred || 'native_workspace_ai',
          account_label: emailHint || 'el_cortez87@live.com',
          settings: {
            auth_mode: cred ? 'direct_api_key' : 'native',
            model: 'Claude 3.5 Sonnet',
            engine: 'Anthropic Claude 3.5 Sonnet',
          },
          connection_id: activeConnectionId || existingConnection?.id,
        });

        setActiveConnectionId(conn.id);
        setStep('checking');

        try {
          await integrationsHubService.testConnection(conn.id);
        } catch (testErr) {
          console.warn('Post-connect test warning:', testErr);
        }

        setStep('completed');
        const account = conn.account_label || emailHint || provider.name;
        setSuccessMsg(connectionResultText('connected', provider.name, account));
        if (onSuccess) onSuccess(conn);
        return;
      } catch (err: any) {
        setStep('idle');
        setErrorMsg(err.message || connectionResultText('failed', provider.name));
        return;
      }
    }

    // 1. Direct API Key / Secret / Personal Token / Webhook Connection ($0 fee per connection)
    if ((isDirect && !isNative) || credential.trim().length > 0) {
      const cred = credential.trim();
      if (!cred) {
        setErrorMsg(`Please enter your ${provider.name} API key, secret, or access token to connect.`);
        return;
      }

      const credInfo = getCredentialFieldInfo(provider);
      if (credInfo.requiresSecondary && !secondaryValue.trim()) {
        setErrorMsg(`Please enter your ${credInfo.secondaryLabel} to connect.`);
        return;
      }

      setStep('starting');
      try {
        const settingsPayload: Record<string, any> = {};
        if (credInfo.requiresSecondary && secondaryValue.trim()) {
          settingsPayload[credInfo.secondaryKey || 'secondary_value'] = secondaryValue.trim();
        }

        const conn = await integrationsHubService.connectDirect({
          provider_id: provider.id,
          credential: cred,
          account_label: emailHint || `${provider.name} Account`,
          settings: settingsPayload,
          connection_id: activeConnectionId || existingConnection?.id,
        });

        setActiveConnectionId(conn.id);
        setStep('checking');

        try {
          await integrationsHubService.testConnection(conn.id);
        } catch (testErr) {
          console.warn('Post-connect test warning:', testErr);
        }

        setStep('completed');
        const account = conn.account_label || emailHint || provider.name;
        setSuccessMsg(connectionResultText('connected', provider.name, account));
        if (onSuccess) onSuccess(conn);
        return;
      } catch (err: any) {
        setStep('idle');
        setErrorMsg(err.message || connectionResultText('failed', provider.name));
        return;
      }
    }

    // 1. Native Concludo OAuth ($0 fee per connection)
    if (isNative) {
      setStep('starting');
      let nativeSession: { auth_url: string; state: string; connection_id: string; provider_id: string };
      try {
        nativeSession = await integrationsHubService.startNativeOAuth(provider.id, {
          email_hint: emailHint || undefined,
          connection_id: activeConnectionId || existingConnection?.id,
          is_new: isNew,
        });
        setActiveConnectionId(nativeSession.connection_id);
      } catch (err: any) {
        setStep('idle');
        setErrorMsg(err.message || connectionResultText('failed', provider.name));
        return;
      }

      setStep('waiting_auth');
      const width = 560;
      const height = 680;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
      const popup = window.open(
        nativeSession.auth_url,
        'concludo_oauth_auth',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = nativeSession.auth_url;
        return;
      }

      let finished = false;

      const finishSuccess = async (connectionData: any) => {
        if (finished) return;
        finished = true;
        setStep('checking');
        const connections = await integrationsHubService.getConnections();
        const targetId = connectionData?.connection_id || nativeSession.connection_id || existingConnection?.id;
        const conn = targetId
          ? connections.find((c) => c.id === targetId) || connections.find((c) => c.provider_id === provider.id && c.status === 'connected')
          : connections.find((c) => c.provider_id === provider.id && c.status === 'connected');

        setStep('completed');
        const account = conn?.account_label || connectionData?.account_label || emailHint;
        setSuccessMsg(connectionResultText('connected', provider.name, account));
        if (onSuccess) onSuccess(conn || connectionData);
      };

      const handleOAuthMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'CONCLUDO_OAUTH_SUCCESS') {
          window.removeEventListener('message', handleOAuthMessage);
          if (timer) clearInterval(timer);
          finishSuccess(event.data.data);
        } else if (event.data?.type === 'CONCLUDO_OAUTH_ERROR') {
          window.removeEventListener('message', handleOAuthMessage);
          if (timer) clearInterval(timer);
          setStep('idle');
          setErrorMsg(event.data.error || connectionResultText('cancelled', provider.name));
        }
      };

      window.addEventListener('message', handleOAuthMessage);

      const timer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', handleOAuthMessage);

          if (!finished) {
            setStep('checking');
            const connections = await integrationsHubService.getConnections();
            const targetId = nativeSession.connection_id || existingConnection?.id;
            const conn = targetId
              ? connections.find((c) => c.id === targetId) || connections.find((c) => c.provider_id === provider.id && c.status === 'connected')
              : connections.find((c) => c.provider_id === provider.id && c.status === 'connected');

            if (conn && conn.status === 'connected') {
              finishSuccess(conn);
            } else {
              setStep('idle');
              try {
                await integrationsHubService.cancelConnection(targetId, provider.id);
              } catch (_) {}
              setErrorMsg(connectionResultText('cancelled', provider.name));
            }
          }
        }
      }, 1000);

      return;
    }

    // 2. Fallback for non-native integrations
    let session = prefetchedSession;
    if (!session && !provider.nango_integration_id) {
      // Direct token connection prompt
      setErrorMsg(`Please enter your ${provider.name} access token or API key above to connect your account.`);
      return;
    }

    // If user entered a specific email hint, re-fetch the session with it to configure login_hint and custom naming
    if (!session || emailHint) {
      setStep('starting');
      try {
        session = await integrationsHubService.startConnection(provider.id, {
          email_hint: emailHint || undefined,
          connection_id: prefetchedSession?.connection_id || existingConnection?.id,
          is_new: isNew && !prefetchedSession?.connection_id,
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

      // Authorization completed in Nango. Now poll for webhook verification
      setStep('checking');
      let attempts = 0;
      const maxAttempts = 30; // 30 * 2s = 60s
      let verifiedConnection: any = null;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts += 1;

        const connections = await integrationsHubService.getConnections();
        const targetId = session?.connection_id || existingConnection?.id;
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

  const handleModalClose = async () => {
    if (step === 'checking' || step === 'starting') return;
    // If not completed, cancel the pending authorising record so Connect button reappears
    if (step !== 'completed' && provider) {
      try {
        await integrationsHubService.cancelConnection(
          activeConnectionId || prefetchedSession?.connection_id || existingConnection?.id,
          provider.id
        );
      } catch (err) {
        console.warn('cancelConnection on modal close warning:', err);
      }
    }
    setStep('idle');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '32rem',
          backgroundColor: '#0f172a',
          borderColor: '#1e293b',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        }}
      >
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

          {/* Account Email of user's choosing */}
          {availability === 'available' && step === 'idle' && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Email address of your choosing (optional)</span>
                <span className="text-[10.5px] font-normal text-slate-400">Choose which account to use</span>
              </label>
              <input
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="e.g. yourname@company.com or personal@gmail.com"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 focus:border-[#E2B53C] focus:ring-1 focus:ring-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 outline-none transition"
              />
              <p className="text-[11px] text-slate-400 leading-normal">
                People may have multiple accounts. Enter the email address of your choosing to direct your sign-in to that specific account, or leave blank to choose during provider sign-in.
              </p>
            </div>
          )}

          {/* Anthropic Claude Effortless 1-Click Connection Card */}
          {availability === 'available' && step === 'idle' && provider.id === 'anthropic_claude' && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#E2B53C]">
                  <Sparkles className="w-4 h-4 text-[#E2B53C]" />
                  <span>Effortless Workspace AI</span>
                </div>
                <span className="text-[10.5px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Included in Plan
                </span>
              </div>
              <p className="text-[11.5px] text-slate-300 leading-normal">
                Anthropic Claude 3.5 Sonnet deep document reasoning, analysis, and strategic intelligence are included with your Concludo workspace. Click below to connect your account instantly with zero API keys or developer console setup required.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowCustomKey(!showCustomKey)}
                  className="text-[11px] text-slate-400 hover:text-[#E2B53C] transition flex items-center gap-1.5"
                >
                  <Key className="w-3 h-3 text-slate-400" />
                  <span>{showCustomKey ? 'Use effortless 1-click connection' : 'Have your own Anthropic Console API key? (Optional)'}</span>
                </button>
              </div>
              {showCustomKey && (
                <div className="pt-2 space-y-1.5 border-t border-slate-800/80 mt-2">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    <span>Custom Anthropic API Key</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Encrypted
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={credential}
                      onChange={(e) => setCredential(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full px-3 py-1.5 pr-9 bg-slate-900 border border-slate-700/80 focus:border-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white"
                      tabIndex={-1}
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* YouTube Optional Custom API Key toggle for developers */}
          {availability === 'available' && step === 'idle' && provider.id === 'youtube' && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowCustomKey(!showCustomKey)}
                className="text-[11px] text-slate-400 hover:text-[#E2B53C] transition flex items-center gap-1.5"
              >
                <Key className="w-3 h-3 text-slate-400" />
                <span>{showCustomKey ? 'Use effortless Google sign-in' : 'Have a custom YouTube API Key or Token? (Optional)'}</span>
              </button>
              {showCustomKey && (
                <div className="pt-2.5 space-y-1.5 mt-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    <span>Custom YouTube API Key or Token</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Encrypted
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={credential}
                      onChange={(e) => setCredential(e.target.value)}
                      placeholder="AIzaSy... or ya29...."
                      className="w-full px-3 py-1.5 pr-9 bg-slate-900 border border-slate-700/80 focus:border-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white"
                      tabIndex={-1}
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Optional: By default, Concludo connects directly to your YouTube channel via Google sign-in.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Credential input for Direct Key apps or token connections */}
          {availability === 'available' && step === 'idle' && provider.id !== 'anthropic_claude' && (!isNativeOAuthProvider(provider) || isDirectKeyProvider(provider)) && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              {(() => {
                const credInfo = getCredentialFieldInfo(provider);
                return (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-[#E2B53C]" />
                          {credInfo.label}
                        </span>
                        <span className="text-[10.5px] font-normal text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Encrypted
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSecret ? 'text' : 'password'}
                          value={credential}
                          onChange={(e) => setCredential(e.target.value)}
                          placeholder={credInfo.placeholder}
                          className="w-full px-3.5 py-2 pr-10 bg-slate-900 border border-slate-700/80 focus:border-[#E2B53C] focus:ring-1 focus:ring-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 outline-none transition font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white transition"
                          tabIndex={-1}
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        {credInfo.help}
                      </p>
                    </div>

                    {credInfo.requiresSecondary && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                          <span>{credInfo.secondaryLabel}</span>
                        </label>
                        <input
                          type="text"
                          value={secondaryValue}
                          onChange={(e) => setSecondaryValue(e.target.value)}
                          placeholder={credInfo.secondaryPlaceholder}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 focus:border-[#E2B53C] focus:ring-1 focus:ring-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 outline-none transition"
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

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
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-[#E2B53C] animate-spin shrink-0" />
                <span>Waiting for sign-in window to complete...</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-6">
                If a pop-up window did not open, check your browser address bar to allow pop-ups from app.concludo.com.au, or click the button below.
              </p>
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
          ) : step === 'waiting_auth' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartConnect}
                className="btn-connect-gold px-4 py-2 bg-[#E2B53C] hover:bg-[#d4a62f] active:bg-[#bc8a1c] text-[#16263F] font-bold rounded-xl text-xs transition flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Re-open sign-in window
              </button>
            </>
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
                disabled={step !== 'idle' || isPrefetching}
                className="btn-connect-gold px-5 py-2 bg-[#E2B53C] hover:bg-[#d4a62f] active:bg-[#bc8a1c] text-[#16263F] font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isPrefetching
                  ? 'Preparing sign-in...'
                  : step === 'idle'
                  ? showCustomKey && credential.trim().length > 0
                    ? 'Connect Account'
                    : panel.primary || 'Connect'
                  : 'Connecting...'}
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
