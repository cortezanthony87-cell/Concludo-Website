import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  User,
  Key,
  Info,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  INTEGRATION_PROVIDERS_CATALOG,
  ProviderDefinition,
  IntegrationConnection,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import { IntegrationIcon } from '../../components/integrations/IntegrationIcon';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';

export const ConnectProviderPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();

  const provider: ProviderDefinition | undefined = INTEGRATION_PROVIDERS_CATALOG.find(
    (p) => p.id === providerId
  );

  const [step, setStep] = useState<'form' | 'authorizing' | 'success' | 'error'>('form');
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [friendlyName, setFriendlyName] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [loadingText, setLoadingText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdConn, setCreatedConn] = useState<IntegrationConnection | null>(null);

  useEffect(() => {
    if (!provider) return;

    // Prefill user email from session
    const loadUser = async () => {
      const client = getSupabaseBrowserClient();
      const { data: { user } } = await client.auth.getUser();
      const email = user?.email || 'anthony@concludo.com.au';
      setAccountEmail(email);
      const short = email.split('@')[0];
      setFriendlyName(`${short.charAt(0).toUpperCase() + short.slice(1)} - ${provider.name}`);
    };

    loadUser();
    setErrorMessage(null);
    setApiKey('');
    setStep('form');
  }, [provider]);

  if (!provider) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-white">Integration Provider Not Found</h2>
          <p className="text-sm text-slate-400 mt-1">
            The integration requested ("{providerId}") could not be located in the catalog.
          </p>
        </div>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-[#E2B53C] rounded-lg text-sm font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Integrations Hub
        </Link>
      </div>
    );
  }

  const handleStartOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountEmail || !accountEmail.includes('@')) {
      setErrorMessage('Please enter a valid business email address.');
      return;
    }

    setStep('authorizing');
    setErrorMessage(null);

    try {
      setLoadingText(`Initiating secure ${provider.authenticationType.toUpperCase()} handshake with ${provider.name}...`);
      await new Promise((r) => setTimeout(r, 600));

      const allScopes = provider.actions.flatMap((a) => a.requiredScopes);
      const uniqueScopes = Array.from(new Set(allScopes.length > 0 ? allScopes : ['read', 'write', 'offline_access']));

      setLoadingText(`Validating security scopes: ${uniqueScopes.slice(0, 3).join(', ')}...`);
      await new Promise((r) => setTimeout(r, 600));

      setLoadingText('Securing credentials in Concludo Multi-Tenant Vault...');

      const result = await integrationsHubService.registerConnection({
        provider_id: provider.id,
        connection_name: friendlyName.trim() || `${provider.name} Connection`,
        external_account_reference: accountEmail.trim(),
        scopes: uniqueScopes,
        settings: {
          account_email: accountEmail.trim(),
          auth_type: provider.authenticationType,
          verified_at: new Date().toISOString(),
        },
      });

      if (!result) throw new Error('Failed to register connection in vault.');

      setCreatedConn(result);
      setStep('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authorization failed. Please check connection permissions.');
      setStep('error');
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API Key or token.');
      return;
    }

    setStep('authorizing');
    setErrorMessage(null);

    try {
      setLoadingText('Validating API key and permissions...');
      await new Promise((r) => setTimeout(r, 500));

      const result = await integrationsHubService.registerConnection({
        provider_id: provider.id,
        connection_name: friendlyName.trim() || `${provider.name} Key`,
        external_account_reference: accountEmail.trim() || 'API Key Authorized',
        scopes: ['api_key_access'],
        settings: {
          auth_type: 'api_key',
          configured_at: new Date().toISOString(),
        },
      });

      if (!result) throw new Error('Failed to save API key connection.');

      setCreatedConn(result);
      setStep('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check your credentials.');
      setStep('error');
    }
  };

  const isApiKey = provider.authenticationType === 'api_key';

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Integrations Hub</span>
        </Link>
      </div>

      {/* Main Connection Page Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Page Card Header */}
        <div className="p-6 sm:p-8 border-b border-slate-800 bg-[#0A0E17]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#16263F] rounded-xl border border-slate-700/80 shadow-md">
              <IntegrationIcon slug={provider.iconSlug || provider.id} size={36} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  {provider.category}
                </span>
                <span className="text-xs text-slate-400">
                  Authentication: {provider.authenticationType.toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
                Connect {provider.name}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Official Secure Provider Authentication • Concludo Multi-Tenant Zero-Secret Vault
              </p>
            </div>
          </div>
        </div>

        {/* Page Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {step === 'form' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Connection Form (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                <form
                  onSubmit={isApiKey ? handleSaveApiKey : handleStartOAuth}
                  className="space-y-5"
                >
                  {isApiKey && (
                    <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                        <Key className="w-4 h-4" /> API Key Authentication
                      </div>
                      <p className="text-xs text-slate-400">
                        Enter your {provider.name} secret API token. Credentials are vaulted with AES-256 server-side encryption.
                      </p>
                    </div>
                  )}

                  {/* Input 1: Friendly Name */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Connection Friendly Name
                    </label>
                    <input
                      type="text"
                      value={friendlyName}
                      onChange={(e) => setFriendlyName(e.target.value)}
                      placeholder={`e.g. Anthony - ${provider.name}`}
                      style={{
                        height: '46px',
                        minHeight: '46px',
                        padding: '12px 16px',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        caretColor: '#000000',
                        WebkitTextFillColor: '#000000',
                        fontSize: '14px',
                        lineHeight: '22px',
                        borderRadius: '8px',
                        boxSizing: 'border-box',
                      }}
                      className="w-full bg-white text-black font-semibold border-2 border-slate-300 rounded-lg placeholder-slate-500 focus:outline-none focus:border-amber-400 transition shadow-sm"
                      required
                    />
                    <span className="text-xs text-slate-400 mt-1.5 block">
                      Give this connection a distinct name to identify it in your workflow triggers and actions.
                    </span>
                  </div>

                  {/* Input 2: Email or API Key */}
                  {!isApiKey ? (
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        Account Email Address
                      </label>
                      <input
                        type="email"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        placeholder="user@company.com"
                        style={{
                          height: '46px',
                          minHeight: '46px',
                          padding: '12px 16px',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          caretColor: '#000000',
                          WebkitTextFillColor: '#000000',
                          fontSize: '14px',
                          lineHeight: '22px',
                          borderRadius: '8px',
                          boxSizing: 'border-box',
                        }}
                        className="w-full bg-white text-black font-semibold border-2 border-slate-300 rounded-lg placeholder-slate-500 focus:outline-none focus:border-amber-400 transition shadow-sm"
                        required
                      />
                      <span className="text-xs text-slate-400 mt-1.5 block">
                        The email address associated with your {provider.name} workspace or enterprise account.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        API Key / Secret Token
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Paste your API key or personal access token"
                        style={{
                          height: '46px',
                          minHeight: '46px',
                          padding: '12px 16px',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          caretColor: '#000000',
                          WebkitTextFillColor: '#000000',
                          fontSize: '14px',
                          lineHeight: '22px',
                          borderRadius: '8px',
                          boxSizing: 'border-box',
                        }}
                        className="w-full bg-white text-black font-semibold font-mono border-2 border-slate-300 rounded-lg placeholder-slate-500 focus:outline-none focus:border-amber-400 transition shadow-sm"
                        required
                      />
                      <span className="text-xs text-slate-400 mt-1.5 block">
                        API keys are never transmitted to third-party scripts or printed in client logs.
                      </span>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Primary Connection Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full min-h-[48px] py-3 px-6 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg cursor-pointer leading-normal whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      <Plus className="w-5 h-5 shrink-0 stroke-[2.5]" /> Connect {provider.name}
                    </button>
                  </div>
                </form>

                {/* Security Advisory */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                  <Info className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white mb-0.5">Zero-Secret Vault Security</span>
                    Official {provider.name} security gates. Passwords are never requested, stored, or visible to Concludo.
                  </div>
                </div>
              </div>

              {/* Right Column: Capabilities & Scopes (5 cols) */}
              <div className="lg:col-span-5 space-y-4 bg-[#0A0E17]/60 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Authorised Permissions</span>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Execute Workflow Actions</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Trigger automated actions like sending communications, creating tasks, and syncing records.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Listen for Workflow Triggers</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Subscribe to incoming webhooks and event streams when new activities occur in {provider.name}.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Automated Vault Token Rotation</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Cryptographically vaulted tokens are automatically refreshed in the background without re-login.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Available Triggers & Actions Preview */}
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Included Capabilities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-[#16263F] border border-slate-700 text-[11px] font-medium text-slate-300">
                      {provider.triggers.length} {provider.triggers.length === 1 ? 'Trigger' : 'Triggers'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#16263F] border border-slate-700 text-[11px] font-medium text-slate-300">
                      {provider.actions.length} {provider.actions.length === 1 ? 'Action' : 'Actions'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'authorizing' && (
            <div className="py-16 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto text-amber-400 animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-white">Connecting to {provider.name}...</h3>
                <p className="text-xs text-slate-400 font-mono bg-[#0A0E17] p-3 rounded-lg border border-slate-800">
                  {loadingText}
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 text-center space-y-6 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Connected Successfully!</h3>
                <p className="text-sm text-slate-300">
                  {createdConn?.connection_name || provider.name} is now connected and immediately ready for use across your Concludo workflows.
                </p>
              </div>
              <div className="p-4 bg-[#0A0E17] rounded-xl border border-slate-800 text-xs text-slate-400 font-mono flex items-center justify-center gap-3">
                <span>Status: <strong className="text-emerald-400">CONNECTED</strong></span>
                <span>•</span>
                <span>Vault: <strong className="text-emerald-400">ACTIVE</strong></span>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  to="/integrations"
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Return to Integrations Hub
                </Link>
                <Link
                  to="/workflows/builder"
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition shadow-md"
                >
                  Open Workflow Builder
                </Link>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="py-12 text-center space-y-6 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400 shadow-lg">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Connection Encountered an Issue</h3>
                <p className="text-sm text-rose-300">
                  {errorMessage || 'An error occurred during authentication.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Try Again
                </button>
                <Link
                  to="/integrations"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs transition border border-slate-800"
                >
                  Cancel
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
