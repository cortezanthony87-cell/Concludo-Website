/**
 * The module shell. One sidebar entry leads here; the eleven destinations are tabs.
 *
 * This renders inside the existing WorkspaceLayout Outlet. It does not replace
 * the sidebar, the top bar or the mobile drawer, and it adds no second layout.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { Sparkles, X, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { EMAIL_MODULE_DESTINATIONS, destinationForPath } from '../../lib/email/moduleNav';
import { useEmailViewState, useEmailScrollMemory } from '../../lib/email/useEmailViewState';
import { resolveAccount } from '../../lib/email/viewState';
import { SYNTHETIC_ACCOUNTS, syntheticSyncStatus } from '../../lib/email/shellAdapter';
import { EmailDashboardHeader } from './EmailDashboardHeader';
import { EmailConnectModal } from './EmailConnectModal';
import { LocalActionProvider } from '../../lib/email/localActions';
import { loadUserEmailAccounts } from '../../lib/email/connectedMailboxes';
import { EmailAccountSummary, EmailViewState } from '../../lib/email/types';
import { useAuth } from '../../lib/auth/AuthContext';
import { runAgent } from '../../lib/agents/agentRunner';
import { AgentRunResult } from '../../lib/agents/types';
import { noteVisit } from '../../lib/email/lastDestination';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import '../../styles/email-command-centre.css';
import '../../styles/email-bright.css';

/** Resolves a lucide icon by name, falling back to a neutral mark. */
function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const Component = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[name];
  const Fallback = Icons.Circle;
  const Resolved = Component ?? Fallback;
  return <Resolved size={size} />;
}

export interface EmailModuleContext {
  accountId: string;
  refreshToken: number;
  linkTo: (path: string) => string;
  viewState?: EmailViewState;
  setViewState?: (patch: Partial<EmailViewState>) => void;
}

export const EmailModuleLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  // The Overview keeps the layout it has. Every other destination, and the
  // thread workspace, takes the bright theme. The class is the only thing this
  // file adds for it, and it is absent on `/email`, so the Overview renders
  // exactly as before.
  const isOverview = location.pathname.replace(/\/$/, '') === '/email';
  useEffect(() => {
    noteVisit(location.pathname);
  }, [location.pathname]);
  const { viewState, setViewState, linkTo } = useEmailViewState();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEmailScrollMemory(scrollRef as React.RefObject<HTMLElement>);

  const [availableAccounts, setAvailableAccounts] = useState<readonly EmailAccountSummary[]>(SYNTHETIC_ACCOUNTS);
  const [hasLiveAccounts, setHasLiveAccounts] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [realtimeNotification, setRealtimeNotification] = useState<{
    id: string;
    sender: string;
    summary: string;
  } | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Scan emails state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<AgentRunResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);

  // Load connected mailboxes from integration_connections if user is authenticated
  const fetchAccounts = useCallback(async () => {
    try {
      const result = await loadUserEmailAccounts();
      setAvailableAccounts(result.accounts);
      setHasLiveAccounts(result.hasLiveAccounts);
      if (result.hasLiveAccounts && result.accounts.length > 0) {
        // If no explicit account was chosen, default to the first live account
        const currentParams = new URLSearchParams(window.location.search);
        if (!currentParams.has('account')) {
          setViewState({ accountId: result.accounts[0].id });
        }
      }
    } catch (err) {
      console.warn('Failed to load email accounts:', err);
    }
  }, [setViewState]);

  useEffect(() => {
    fetchAccounts();
  }, [user, fetchAccounts]);

  const hasAccountInUrl = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('account') && Boolean(params.get('account'));
    } catch {
      return false;
    }
  }, []);

  const { account, substituted } = useMemo(() => {
    const resolved = resolveAccount(availableAccounts, viewState.accountId);
    return {
      account: resolved.account,
      substituted: hasAccountInUrl ? resolved.substituted : false,
    };
  }, [availableAccounts, viewState.accountId, hasAccountInUrl]);

  const syncStatus = useMemo(() => {
    if (account?.connected && hasLiveAccounts) {
      return {
        state: (account.lastSynchronisedAt ? 'synchronised' : 'never') as any,
        lastSynchronisedAt: account.lastSynchronisedAt || null,
        message: account.lastSynchronisedAt
          ? `Connected • Last synchronised ${new Date(account.lastSynchronisedAt).toLocaleString('en-AU', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}`
          : 'Connected • Ready to scan emails',
      };
    }
    return {
      state: 'never' as any,
      lastSynchronisedAt: null,
      message: 'Demonstration data. Connect your mailbox above to scan live emails.',
    };
  }, [account, hasLiveAccounts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    let notice: { type: 'success' | 'warning'; message: string } | null = null;
    try {
      await fetchAccounts();
      const activeAccount = account || availableAccounts[0];
      if (user && hasLiveAccounts && activeAccount?.connected) {
        try {
          await runAgent({
            agentType: 'inbox_command_centre',
            userId: user.id,
            parameters: {
              accountId: activeAccount.id,
              accountEmail: activeAccount.address,
            },
          });
          notice = {
            type: 'success',
            message: `Mailbox synchronized for ${activeAccount.address}. Latest emails and threads are up to date.`,
          };
        } catch (scanErr: any) {
          console.warn('Mailbox refresh scan notice:', scanErr);
          notice = {
            type: 'warning',
            message: scanErr?.message || 'Mailbox refresh completed with a provider notice.',
          };
        }
      } else {
        notice = {
          type: 'success',
          message: 'Inbox Command Centre views, actions, and thread statuses refreshed.',
        };
      }
      setRefreshToken((token) => token + 1);
      try {
        window.dispatchEvent(
          new CustomEvent('concludo:email:dataset-updated', {
            detail: { accountId: activeAccount?.id },
          })
        );
      } catch (_) {}
      if (notice) {
        setRefreshNotice(notice);
        window.setTimeout(() => {
          setRefreshNotice(null);
        }, 5000);
      }
    } catch (err: any) {
      console.warn('Inbox refresh warning:', err);
      setRefreshNotice({
        type: 'warning',
        message: err?.message || 'Could not complete mailbox refresh.',
      });
      window.setTimeout(() => {
        setRefreshNotice(null);
      }, 6000);
    } finally {
      window.setTimeout(() => {
        setRefreshing(false);
      }, 350);
    }
  }, [fetchAccounts, account, availableAccounts, hasLiveAccounts, user]);

  // Realtime subscription to live incoming email webhooks
  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel('email-realtime-mailbox-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row && (row.kind === 'email' || row.kind === 'email_scan')) {
            setRealtimeNotification({
              id: row.id,
              sender: row.sender_name || 'Inbox Mailbox',
              summary: row.summary || 'New email received and synchronized',
            });
            handleRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleRefresh]);

  const handlePersonalise = useCallback(() => {
    navigate(linkTo('/email/settings'));
  }, [linkTo, navigate]);

  const handleScanEmails = useCallback(async () => {
    if (isScanning) return;

    const activeAccount = account || availableAccounts[0];

    // If no live mailbox is connected, guide the user to connect via OAuth
    if (!hasLiveAccounts || !activeAccount?.connected) {
      setShowScanModal(true);
      setScanResult(null);
      setScanError('No mailbox is connected yet. Please connect your Microsoft Outlook or Google Workspace account via OAuth to scan and prioritize live emails.');
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setScanError(null);
    setShowScanModal(true);

    try {
      if (!activeAccount) {
        throw new Error('No mailbox account is selected.');
      }

      // If in live mode, ensure we have an authentic connection
      if (hasLiveAccounts && !user) {
        throw new Error('Please sign in to scan your live connected mailboxes.');
      }

      const targetUserId = user?.id || 'demo_user';

      const result = await runAgent({
        agentType: 'inbox_command_centre',
        userId: targetUserId,
        parameters: {
          accountId: activeAccount?.id,
          accountEmail: activeAccount?.address,
        },
      });

      setScanResult(result);
      setRefreshToken((token) => token + 1);
    } catch (err: any) {
      console.error('Scan emails failed:', err);
      let errMsg = err.message || 'Failed to complete mailbox scan.';
      if (errMsg.includes('403') || errMsg.includes('reconnect_required') || errMsg.includes('permission not granted')) {
        errMsg = `${errMsg} To scan live emails, please open Settings > Integrations and re-connect your mailbox with read permissions.`;
      }
      setScanError(err.message || 'Failed to complete mailbox scan.');
      setScanError(errMsg);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, account, availableAccounts, user]);

  const handleCloseModal = useCallback(() => {
    setShowScanModal(false);
    setScanResult(null);
    setScanError(null);
  }, []);

  const handleConnectSuccess = useCallback(async (conn?: any) => {
    await fetchAccounts();
    if (conn?.id) {
      setViewState({ accountId: conn.id });
    }
    setShowConnectModal(false);
  }, [fetchAccounts, setViewState]);

  const context: EmailModuleContext = {
    accountId: account?.id ?? viewState.accountId,
    refreshToken,
    linkTo,
    viewState,
    setViewState,
  };

  return (
    <LocalActionProvider>
    <div className={isOverview ? 'ecc-module' : 'ecc-module ecc-bright'}>
      {refreshNotice && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: refreshNotice.type === 'success' ? '#065F46' : '#92400E',
            borderBottom: '2px solid #E2B53C',
            color: '#FFFFFF',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {refreshNotice.type === 'success' ? (
              <CheckCircle2 size={16} color="#34D399" />
            ) : (
              <AlertCircle size={16} color="#FBBF24" />
            )}
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
              {refreshNotice.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRefreshNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
            aria-label="Dismiss refresh notice"
          >
            <X size={15} />
          </button>
        </aside>
      )}
      {realtimeNotification && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'linear-gradient(135deg, #16263F 0%, #21395C 100%)',
            borderBottom: '2px solid #E2B53C',
            color: '#FFFFFF',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={16} color="#E2B53C" />
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
              New email received from <strong style={{ color: '#E2B53C' }}>{realtimeNotification.sender}</strong>: {realtimeNotification.summary}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRealtimeNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </aside>
      )}
      <a href="#ecc-main" className="ecc-skip-link">
        Skip to the dashboard
      </a>

      <EmailDashboardHeader
        accounts={availableAccounts}
        account={account}
        viewState={viewState}
        setViewState={setViewState}
        syncStatus={syncStatus}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onPersonalise={handlePersonalise}
        accountSubstituted={substituted}
        onScanEmails={handleScanEmails}
        isScanning={isScanning}
        onOpenConnectModal={() => setShowConnectModal(true)}
      />

      <nav className="ecc-tabs" aria-label="Email Command Centre sections">
        <ul className="ecc-tab-list">
          {EMAIL_MODULE_DESTINATIONS.map((destination) => (
            <li key={destination.path}>
              <NavLink
                to={linkTo(destination.path)}
                end={destination.path === '/email'}
                className={({ isActive }) => (isActive ? 'ecc-tab ecc-tab-active' : 'ecc-tab')}
                title={destination.accessibleDescription}
              >
                <Icon name={destination.iconName} />
                <span>{destination.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ecc-main" id="ecc-main" ref={scrollRef} tabIndex={-1}>
        <Outlet context={context} />
      </div>

      <p className="ecc-foot-note">
        Concludo proposes; a person disposes. This module reads and recommends. It never sends,
        files, deletes or archives a message.
      </p>

      {/* Inbox Command Centre Scan Modal */}
      {showScanModal && (
        <div className="ecc-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ecc-modal-title">
          <div className="ecc-modal-box">
            <button
              type="button"
              onClick={handleCloseModal}
              className="ecc-modal-close"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div className="ecc-modal-header">
              <div className="ecc-modal-icon-wrap">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 id="ecc-modal-title" className="ecc-modal-title">
                  {isScanning ? 'Inbox Command Centre Agent at Work' : scanError ? 'Scan Notice' : 'Scan Audit Complete'}
                </h3>
                <p className="ecc-modal-subtitle">
                  {account?.label}: {account?.address}
                </p>
              </div>
            </div>

            {isScanning && (
              <div className="ecc-modal-loading">
                <div className="ecc-spinner" />
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 6px' }}>
                  Scanning mailbox and synthesizing attention queues...
                </p>
                <p style={{ color: 'var(--ecc-text-quiet)', fontSize: '0.8rem', margin: 0 }}>
                  Auditing threads, decisions, deadlines and extracting work product recommendations.
                </p>
              </div>
            )}

            {scanError && (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', margin: '16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 600, marginBottom: '6px' }}>
                  <AlertCircle size={16} />
                  <span>Scan encountered an issue</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: 0 }}>
                  {scanError}
                </p>
              </div>
            )}

            {scanResult && !isScanning && (
              <div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
                  {scanResult.summary}
                </p>

                {scanResult.data?.metrics && (
                  <div className="ecc-scan-metrics-grid">
                    <div className="ecc-scan-metric-card">
                      <div className="ecc-scan-metric-label">Needs Attention</div>
                      <div className="ecc-scan-metric-val">{scanResult.data.metrics.needsAttention}</div>
                    </div>
                    <div className="ecc-scan-metric-card">
                      <div className="ecc-scan-metric-label">Replies Due</div>
                      <div className="ecc-scan-metric-val">{scanResult.data.metrics.repliesDue}</div>
                    </div>
                    <div className="ecc-scan-metric-card">
                      <div className="ecc-scan-metric-label">Deadlines</div>
                      <div className="ecc-scan-metric-val">{scanResult.data.metrics.deadlines}</div>
                    </div>
                    <div className="ecc-scan-metric-card">
                      <div className="ecc-scan-metric-label">Waiting on Others</div>
                      <div className="ecc-scan-metric-val">{scanResult.data.metrics.waitingOnOthers}</div>
                    </div>
                  </div>
                )}

                {scanResult.data?.topActions && scanResult.data.topActions.length > 0 && (
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.84rem', color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                      Top Attention Items
                    </h4>
                    <div className="ecc-scan-actions-list">
                      {scanResult.data.topActions.map((act: any, idx: number) => (
                        <div key={idx} className="ecc-scan-action-item">
                          <div className="ecc-scan-action-title">{act.subject}</div>
                          <div className="ecc-scan-action-desc">
                            From {act.counterparty}: {act.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="ecc-modal-footer">
              {scanResult && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      handleCloseModal();
                      navigate(linkTo('/email/needs-attention'));
                    }}
                  >
                    View Needs Attention
                  </button>
                  <button
                    type="button"
                    className="btn-gold"
                    onClick={() => {
                      handleCloseModal();
                      navigate(linkTo('/email/outputs'));
                    }}
                  >
                    View Outputs <ArrowRight size={14} />
                  </button>
                </>
              )}
              {(!scanResult || scanError) && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCloseModal}
                  >
                    Close
                  </button>
                  {(!hasLiveAccounts || !account?.connected) && (
                    <button
                      type="button"
                      className="btn-gold"
                      onClick={() => {
                        handleCloseModal();
                        setShowConnectModal(true);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Sparkles size={14} /> Connect Mailbox Now
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Native OAuth Connect Modal */}
      <EmailConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onSuccess={handleConnectSuccess}
        defaultEmail={user?.email || 'el_cortez87@live.com'}
      />
    </div>
    </LocalActionProvider>
  );
};

/** Convenience export so pages do not repeat the path lookup. */
export { destinationForPath };
