/**
 * The module shell. One sidebar entry leads here; the eleven destinations are tabs.
 *
 * This renders inside the existing WorkspaceLayout Outlet. It does not replace
 * the sidebar, the top bar or the mobile drawer, and it adds no second layout.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { Sparkles, X, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { EMAIL_MODULE_DESTINATIONS, destinationForPath } from '../../lib/email/moduleNav';
import { useEmailViewState, useEmailScrollMemory } from '../../lib/email/useEmailViewState';
import { resolveAccount } from '../../lib/email/viewState';
import { SYNTHETIC_ACCOUNTS, syntheticSyncStatus } from '../../lib/email/shellAdapter';
import { EmailDashboardHeader } from './EmailDashboardHeader';
import { LocalActionProvider } from '../../lib/email/localActions';
import { loadUserEmailAccounts } from '../../lib/email/connectedMailboxes';
import { EmailAccountSummary } from '../../lib/email/types';
import { useAuth } from '../../lib/auth/AuthContext';
import { runAgent } from '../../lib/agents/agentRunner';
import { AgentRunResult } from '../../lib/agents/types';
import '../../styles/email-command-centre.css';

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
}

export const EmailModuleLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { viewState, setViewState, linkTo } = useEmailViewState();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEmailScrollMemory(scrollRef as React.RefObject<HTMLElement>);

  const [availableAccounts, setAvailableAccounts] = useState<readonly EmailAccountSummary[]>(SYNTHETIC_ACCOUNTS);
  const [hasLiveAccounts, setHasLiveAccounts] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  // Scan emails state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<AgentRunResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);

  // Load connected mailboxes from integration_connections if user is authenticated
  useEffect(() => {
    let active = true;
    const fetchAccounts = async () => {
      try {
        const result = await loadUserEmailAccounts();
        if (active) {
          setAvailableAccounts(result.accounts);
          setHasLiveAccounts(result.hasLiveAccounts);
        }
      } catch (err) {
        console.warn('Failed to load email accounts:', err);
      }
    };
    fetchAccounts();
    return () => {
      active = false;
    };
  }, [user]);

  const { account, substituted } = useMemo(() => {
    const resolved = resolveAccount(availableAccounts, viewState.accountId);
    return { account: resolved.account, substituted: resolved.substituted };
  }, [availableAccounts, viewState.accountId]);

  const syncStatus = useMemo(
    () => syntheticSyncStatus(account?.id ?? viewState.accountId),
    [account, viewState.accountId]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshToken((token) => token + 1);
      setRefreshing(false);
    }, 450);
  }, []);

  const handlePersonalise = useCallback(() => {
    navigate(linkTo('/email/settings'));
  }, [linkTo, navigate]);

  const handleScanEmails = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanResult(null);
    setScanError(null);
    setShowScanModal(true);

    try {
      const activeAccount = account || availableAccounts[0];
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

  const context: EmailModuleContext = {
    accountId: account?.id ?? viewState.accountId,
    refreshToken,
    linkTo,
  };

  return (
    <LocalActionProvider>
    <div className="ecc-module">
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
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </LocalActionProvider>
  );
};

/** Convenience export so pages do not repeat the path lookup. */
export { destinationForPath };
