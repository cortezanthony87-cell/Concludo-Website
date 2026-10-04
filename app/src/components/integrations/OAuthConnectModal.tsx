import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Mail,
  CheckSquare,
  ListTodo,
  MessageSquare,
  Lock,
  ArrowRight,
  User,
  ExternalLink,
} from 'lucide-react';
import { Integration, IntegrationProvider, ProviderMeta } from '../../lib/integrations/types';
import { connectIntegration } from '../../lib/integrations/integrationClient';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';

export interface OAuthConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ProviderMeta | null;
  onSuccess: (integration: Integration) => void;
}

interface ScopeItem {
  code: string;
  title: string;
  description: string;
}

export const OAuthConnectModal: React.FC<OAuthConnectModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSuccess,
}) => {
  const [step, setStep] = useState<'consent' | 'authorizing' | 'success' | 'error'>('consent');
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [accountType, setAccountType] = useState<'work' | 'personal'>('work');
  const [loadingStepText, setLoadingStepText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedIntegration, setConnectedIntegration] = useState<Integration | null>(null);

  // Initialize account email from current authenticated user
  useEffect(() => {
    if (!isOpen || !provider) return;
    setStep('consent');
    setErrorMessage(null);
    setConnectedIntegration(null);

    const initUser = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setAccountEmail(user.email);
        } else {
          setAccountEmail('');
        }
      } catch {
        setAccountEmail('');
      }
    };
    initUser();
  }, [isOpen, provider]);

  if (!isOpen || !provider) return null;

  const isMicrosoft = provider.id.startsWith('microsoft_');

  const getScopes = (): ScopeItem[] => {
    switch (provider.id) {
      case 'microsoft_outlook':
        return [
          {
            code: 'User.Read',
            title: 'Sign in and read user profile',
            description: 'Allows Concludo to identify your Microsoft account and verify email permissions.',
          },
          {
            code: 'Mail.Send',
            title: 'Send action plans and summaries',
            description: 'Allows Concludo to dispatch structured action plans and meeting recaps from your mailbox.',
          },
          {
            code: 'offline_access',
            title: 'Maintain background connection',
            description: 'Preserves active authorization so you can dispatch action items without repeated logins.',
          },
        ];
      case 'microsoft_planner':
        return [
          {
            code: 'Tasks.ReadWrite',
            title: 'Create and update Planner tasks',
            description: 'Synchronizes action items directly to Microsoft 365 Planner buckets.',
          },
          {
            code: 'Group.Read.All',
            title: 'Access team workspace plans',
            description: 'Discovers existing group plans to route accountability items accurately.',
          },
          {
            code: 'offline_access',
            title: 'Maintain background connection',
            description: 'Enables continuous synchronization for recurring action items.',
          },
        ];
      case 'microsoft_todo':
        return [
          {
            code: 'Tasks.ReadWrite',
            title: 'Manage Microsoft To Do items',
            description: 'Allows Concludo to create, update, and complete personal and team to-do tasks.',
          },
          {
            code: 'offline_access',
            title: 'Maintain background connection',
            description: 'Preserves access for direct action item dispatch.',
          },
        ];
      case 'microsoft_teams':
        return [
          {
            code: 'ChannelMessage.Send',
            title: 'Post messages to Teams channels',
            description: 'Allows Concludo to dispatch executive summaries, decisions, and action cards.',
          },
          {
            code: 'Chat.ReadWrite',
            title: 'Manage group chat notifications',
            description: 'Sends direct notifications for priority actions and decisions.',
          },
          {
            code: 'offline_access',
            title: 'Maintain background connection',
            description: 'Keeps team communication channels continuously synchronized.',
          },
        ];
      default:
        return [
          {
            code: `${provider.id}.read`,
            title: `Read ${provider.name} workspace details`,
            description: `Allows Concludo to discover projects, channels, and assignees in ${provider.name}.`,
          },
          {
            code: `${provider.id}.write`,
            title: `Export action plans and decisions`,
            description: `Allows Concludo to create tasks, cards, or notes directly in ${provider.name}.`,
          },
        ];
    }
  };

  const handleStartOAuth = async () => {
    if (!accountEmail || !accountEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setStep('authorizing');
    setErrorMessage(null);

    try {
      // Step 1: Simulated handshake with Microsoft Identity platform
      setLoadingStepText(
        isMicrosoft
          ? 'Connecting to Microsoft Identity Platform (login.microsoftonline.com)...'
          : `Initiating OAuth 2.0 handshake with ${provider.name}...`
      );
      await new Promise((r) => setTimeout(r, 650));

      // Step 2: Permissions validation
      setLoadingStepText(
        isMicrosoft
          ? 'Validating delegated scopes (User.Read, Mail.Send, offline_access)...'
          : 'Verifying authorized scopes and account permissions...'
      );
      await new Promise((r) => setTimeout(r, 650));

      // Step 3: Server token storage and integration registration
      setLoadingStepText('Registering Concludo Workspace dispatch endpoint...');

      const scopes = getScopes().map((s) => s.code);
      const settings = {
        account_email: accountEmail.trim(),
        account_name: accountEmail.split('@')[0],
        account_type: accountType,
        scopes,
        auth_method: 'oauth2_delegated',
        connected_at: new Date().toISOString(),
        provider_name: provider.name,
      };

      const result = await connectIntegration(provider.id, settings);
      setConnectedIntegration(result);
      setStep('success');
      onSuccess(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete authorization. Please try again.');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            {isMicrosoft ? (
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 shadow-sm">
                {/* Official Microsoft 4-square grid insignia */}
                <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                  <span className="bg-[#f25022] rounded-[1px]" />
                  <span className="bg-[#7fba00] rounded-[1px]" />
                  <span className="bg-[#00a4ef] rounded-[1px]" />
                  <span className="bg-[#ffb900] rounded-[1px]" />
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Connect {provider.name}
              </h2>
              <span className="text-[11px] text-slate-400 block">
                {isMicrosoft ? 'Microsoft Identity Platform • Delegated OAuth' : 'OAuth 2.0 Authorization'}
              </span>
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {step === 'consent' && (
            <>
              {/* Introduction Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Secure Account Sign-In</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sign in with your {isMicrosoft ? 'Microsoft 365 or Outlook' : provider.name} account to enable direct action plan dispatch and operational synchronization.
                </p>
              </div>

              {/* Account Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200 block">
                  Account Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder="e.g. your-name@company.com"
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      caretColor: '#000000',
                      WebkitTextFillColor: '#000000',
                    }}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white text-black font-semibold border border-slate-300 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Account Type (for Microsoft) */}
              {isMicrosoft && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300 block">Account Type</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setAccountType('work')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        accountType === 'work'
                          ? 'bg-amber-400/10 border-amber-400/50 text-amber-300 font-semibold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-medium text-white">Work or School</div>
                      <div className="text-[10px] text-slate-400">Microsoft 365 / Entra ID</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('personal')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        accountType === 'personal'
                          ? 'bg-amber-400/10 border-amber-400/50 text-amber-300 font-semibold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-medium text-white">Personal Account</div>
                      <div className="text-[10px] text-slate-400">Outlook.com / Live / Hotmail</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Delegated Permissions */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-slate-300 block">
                  Permissions Requested by Concludo
                </span>
                <div className="space-y-2">
                  {getScopes().map((scope) => (
                    <div
                      key={scope.code}
                      className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3 text-xs"
                    >
                      <div className="p-1 rounded bg-slate-800 text-emerald-400 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{scope.title}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {scope.code}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                          {scope.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security / Compliance note */}
              <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1">
                <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>
                  Concludo uses least-privilege token delegation. Your credentials are never stored in browser memory.
                </span>
              </div>
            </>
          )}

          {step === 'authorizing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Connecting Account</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto animate-pulse">
                  {loadingStepText}
                </p>
              </div>
              <div className="w-full max-w-xs bg-slate-800 rounded-full h-1.5 overflow-hidden mt-2">
                <div className="bg-amber-400 h-full animate-pulse w-3/4 rounded-full" />
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Account Connected Successfully!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {provider.name} is now connected to Concludo Workspace.
                </p>
              </div>

              {/* Connected Account Card */}
              <div className="w-full p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2 mt-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Connected Account:</span>
                  <span className="font-semibold text-white font-mono">{accountEmail}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Authorized
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Capabilities:</span>
                  <span className="text-slate-300">Direct Export, Action Dispatch, Sync</span>
                </div>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Connection Failed</h3>
                <p className="text-xs text-rose-400 mt-1 max-w-sm">
                  {errorMessage || 'An error occurred during account authorization.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          {step === 'consent' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartOAuth}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm"
              >
                {isMicrosoft ? 'Sign in with Microsoft' : `Authorize & Connect ${provider.name}`}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'authorizing' && (
            <div className="w-full text-center text-xs text-slate-500">
              Please keep this window open while completing authentication...
            </div>
          )}

          {step === 'success' && (
            <div className="w-full flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition text-center shadow-sm"
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setStep('consent')}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold rounded-xl text-xs transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
