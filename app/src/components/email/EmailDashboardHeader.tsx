/**
 * The module header: title, supporting text and the ten controls.
 *
 * The account indicator is the most important control on this bar. Work and
 * personal are never combined, so the account is always named, always visible,
 * and carries a word as well as a colour.
 */
import React from 'react';
import { RefreshCw, Search, SlidersHorizontal, Settings2, Briefcase, House, Sparkles, MailPlus } from 'lucide-react';
import {
  EmailAccountSummary,
  EmailViewState,
  EmailDateRange,
  EmailSavedViewKey,
  EmailSyncStatus,
} from '../../lib/email/types';
import { EMAIL_SAVED_VIEWS, EMAIL_DATE_RANGES, EMAIL_FOLDERS } from '../../lib/email/moduleNav';

interface Props {
  accounts: readonly EmailAccountSummary[];
  account: EmailAccountSummary | null;
  viewState: EmailViewState;
  setViewState: (patch: Partial<EmailViewState>) => void;
  syncStatus: EmailSyncStatus;
  onRefresh: () => void;
  refreshing: boolean;
  onPersonalise: () => void;
  /** True when the requested account was missing and another was used. */
  accountSubstituted: boolean;
  onScanEmails?: () => void;
  isScanning?: boolean;
  onOpenConnectModal?: () => void;
}

function syncText(status: EmailSyncStatus): string {
  if (status.state === 'synchronising') return 'Synchronising now';
  if (status.state === 'error') return 'Last synchronisation failed';
  if (status.message) return status.message;
  if (status.state === 'never' || !status.lastSynchronisedAt) return status.message;
  const when = new Date(status.lastSynchronisedAt);
  return `Last synchronised ${when.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export const EmailDashboardHeader: React.FC<Props> = ({
  accounts,
  account,
  viewState,
  setViewState,
  syncStatus,
  onRefresh,
  refreshing,
  onPersonalise,
  accountSubstituted,
  onScanEmails,
  isScanning = false,
  onOpenConnectModal,
}) => {
  const isWork = account?.accountType === 'work';

  return (
    <header className="ecc-header">
      <div className="page-header ecc-header-titles">
        <p className="page-eyebrow">Email Command Centre</p>
        <h1 className="page-title">Email Command Centre</h1>
        <p className="page-subtitle">
          A prioritised view of the messages, decisions, deadlines and replies that need your
          attention.
        </p>
      </div>

      {accountSubstituted ? (
        <p className="ecc-substituted" role="status">
          The account in the link is not available, so another has been opened. Check the account
          shown below before acting on anything.
        </p>
      ) : null}

      <div className="ecc-controls" role="group" aria-label="Inbox filters and account">
        {/* Account, and the work or personal indicator. Always named. */}
        <div className="ecc-control ecc-control-account">
          <label className="ecc-control-label" htmlFor="ecc-account">
            Account
          </label>
          <div className="ecc-account-row">
            <select
              id="ecc-account"
              className="ecc-select"
              value={viewState.accountId}
              onChange={(event) => {
                if (event.target.value === '__connect_new__') {
                  if (onOpenConnectModal) onOpenConnectModal();
                } else {
                  setViewState({ accountId: event.target.value });
                }
              }}
            >
              {accounts.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}, {option.address} {option.connected ? '(Connected)' : ''}
                </option>
              ))}
              <option value="__connect_new__">+ Connect email account (OAuth)...</option>
            </select>
            <span
              className={`ecc-account-badge ${isWork ? 'ecc-account-work' : 'ecc-account-personal'}`}
            >
              {isWork ? (
                <Briefcase size={12} aria-hidden="true" />
              ) : (
                <House size={12} aria-hidden="true" />
              )}
              {isWork ? 'Work' : 'Personal'}
            </span>
          </div>
          <p className="ecc-control-note">
            Work and personal are never combined. One account is shown at a time.
          </p>
        </div>

        <div className="ecc-control">
          <label className="ecc-control-label" htmlFor="ecc-range">
            Date range
          </label>
          <select
            id="ecc-range"
            className="ecc-select"
            value={viewState.dateRange}
            onChange={(event) => setViewState({ dateRange: event.target.value as EmailDateRange })}
          >
            {EMAIL_DATE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ecc-control">
          <label className="ecc-control-label" htmlFor="ecc-folder">
            Folder or label
          </label>
          <select
            id="ecc-folder"
            className="ecc-select"
            value={viewState.folder}
            onChange={(event) => setViewState({ folder: event.target.value })}
          >
            {EMAIL_FOLDERS.map((folder) => (
              <option key={folder.value} value={folder.value}>
                {folder.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ecc-control ecc-control-search">
          <label className="ecc-control-label" htmlFor="ecc-search">
            Search
          </label>
          <div className="ecc-search-wrap">
            <Search size={14} aria-hidden="true" className="ecc-search-icon" />
            <input
              id="ecc-search"
              type="search"
              className="ecc-input"
              placeholder="Sender, subject or words in a thread"
              value={viewState.search}
              onChange={(event) => setViewState({ search: event.target.value })}
            />
          </div>
        </div>

        <div className="ecc-control">
          <label className="ecc-control-label" htmlFor="ecc-saved-view">
            Saved view
          </label>
          <select
            id="ecc-saved-view"
            className="ecc-select"
            value={viewState.savedView ?? ''}
            onChange={(event) =>
              setViewState({
                savedView: event.target.value ? (event.target.value as EmailSavedViewKey) : null,
              })
            }
          >
            <option value="">No saved view</option>
            {EMAIL_SAVED_VIEWS.map((view) => (
              <option key={view.key} value={view.key}>
                {view.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ecc-control ecc-control-buttons">
          {onOpenConnectModal && (
            <button
              type="button"
              className="ecc-connect-email-btn"
              onClick={onOpenConnectModal}
              aria-label="Connect mailbox via OAuth"
              title="Connect your Microsoft Outlook or Gmail account"
            >
              <MailPlus size={14} aria-hidden="true" />
              <span>Connect Mailbox</span>
            </button>
          )}

          {onScanEmails && (
            <button
              type="button"
              className="btn-gold ecc-scan-emails-btn"
              onClick={onScanEmails}
              disabled={isScanning}
              aria-label={isScanning ? 'Inbox Command Centre Agent scanning emails...' : 'Scan emails with Inbox Command Centre Agent'}
            >
              <Sparkles size={14} aria-hidden="true" className={isScanning ? 'ecc-spin' : undefined} />
              <span>{isScanning ? 'Scanning emails...' : 'Scan emails'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn-secondary ecc-icon-button"
            aria-label="Filter threads"
            aria-expanded={false}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            Filter
            {viewState.filters.length > 0 ? (
              <span className="ecc-filter-count">{viewState.filters.length}</span>
            ) : null}
          </button>

          <button
            type="button"
            className="btn-secondary ecc-icon-button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshing ? 'Refreshing the dashboard' : 'Refresh the dashboard'}
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={refreshing ? 'ecc-spin' : undefined}
            />
            Refresh
          </button>

          <button
            type="button"
            className="btn-secondary ecc-icon-button"
            onClick={onPersonalise}
            aria-label="Personalise this dashboard"
          >
            <Settings2 size={14} aria-hidden="true" />
            Personalise
          </button>
        </div>
      </div>

      <p className="ecc-sync" role="status" aria-live="polite">
        <span className={`ecc-sync-dot ecc-sync-${syncStatus.state}`} aria-hidden="true" />
        {syncText(syncStatus)}
      </p>
    </header>
  );
};
