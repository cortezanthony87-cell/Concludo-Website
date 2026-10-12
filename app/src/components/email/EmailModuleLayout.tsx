/**
 * The module shell. One sidebar entry leads here; the eleven destinations are tabs.
 *
 * This renders inside the existing WorkspaceLayout Outlet. It does not replace
 * the sidebar, the top bar or the mobile drawer, and it adds no second layout.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { EMAIL_MODULE_DESTINATIONS, destinationForPath } from '../../lib/email/moduleNav';
import { useEmailViewState, useEmailScrollMemory } from '../../lib/email/useEmailViewState';
import { resolveAccount } from '../../lib/email/viewState';
import { SYNTHETIC_ACCOUNTS, syntheticSyncStatus } from '../../lib/email/shellAdapter';
import { loadUserEmailAccounts } from '../../lib/email/connectedMailboxes';
import { EmailDashboardHeader } from './EmailDashboardHeader';
import { LocalActionProvider } from '../../lib/email/localActions';
import '../../styles/email-command-centre.css';
import { EmailAccountSummary } from '../../lib/email/types';

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
  const { viewState, setViewState, linkTo } = useEmailViewState();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEmailScrollMemory(scrollRef as React.RefObject<HTMLElement>);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [accounts, setAccounts] = useState<readonly EmailAccountSummary[]>(SYNTHETIC_ACCOUNTS);

  // Dynamic connected accounts detection from Supabase integration_connections
  useEffect(() => {
    let mounted = true;
    loadUserEmailAccounts().then(({ accounts: liveAccounts, hasLiveAccounts }) => {
      if (!mounted) return;
      if (hasLiveAccounts && liveAccounts.length > 0) {
        setAccounts(liveAccounts);
        // If current selected accountId is synthetic or not in live list, switch to first live account
        if (!liveAccounts.some((a) => a.id === viewState.accountId)) {
          setViewState({ accountId: liveAccounts[0].id });
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const { account, substituted } = useMemo(() => {
    const resolved = resolveAccount(accounts, viewState.accountId);
    return { account: resolved.account, substituted: resolved.substituted };
  }, [accounts, viewState.accountId]);

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
    window.location.assign(linkTo('/email/settings'));
  }, [linkTo]);

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
        accounts={accounts}
        account={account}
        viewState={viewState}
        setViewState={setViewState}
        syncStatus={syncStatus}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onPersonalise={handlePersonalise}
        accountSubstituted={substituted}
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
    </div>
    </LocalActionProvider>
  );
};

/** Convenience export so pages do not repeat the path lookup. */
export { destinationForPath };
