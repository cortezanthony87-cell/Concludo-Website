import { useState, useEffect, useCallback } from 'react';
import { loadUserEmailAccounts } from './connectedMailboxes';
import { getDataset } from './data';
import { recordsFor } from './filters';
import { metricCounts } from './aggregation';
import { composeOverview } from './overview';
import { DEMO_NOW } from './data/clock';
import { AccountDataset } from './model';
import { accountNotificationsStore } from '../notifications/accountNotificationsStore';

export interface EmailStatusCounts {
  needsReply: number;
  unread: number;
  flagged: number;
  processedToday: number;
  urgentCount: number;
  highCount: number;
  analysedCount: number;
  totalCount: number;
}

export interface RecentEmailThreadSummary {
  id: string;
  senderName: string;
  subject: string;
  clientOrProject: string | null;
  lastMessageAt: string;
  status: 'needs_reply' | 'flagged' | 'normal';
  isRead: boolean;
}

export interface SharedEmailStatusResult {
  counts: EmailStatusCounts;
  recentThreads: RecentEmailThreadSummary[];
  accountId: string | null;
  accountLabel: string;
  hasLiveAccounts: boolean;
}

/** Formats date into YYYY-MM-DD in Australia/Melbourne */
export function getMelbourneDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Pure calculation function that produces the authoritative counts and recent threads
 * for any given AccountDataset. Both Dashboard and ECC rely on this exact logic.
 */
export function calculateEmailStatusFromDataset(
  dataset: AccountDataset,
  nowIso: string = DEMO_NOW
): { counts: EmailStatusCounts; recentThreads: RecentEmailThreadSummary[] } {
  const records = recordsFor(dataset);
  const countsList = metricCounts(records, nowIso);
  const overview = composeOverview(records, nowIso);

  const needsReplyCount = countsList.find((c) => c.key === 'replies_due')?.count ?? 0;
  const unreadCount = records.filter((r) => !r.thread.isRead).length;
  const flaggedCount = overview.security.length;
  const processedToday = records.filter((r) => r.analysis.currentStatus === 'resolved').length;

  const total = records.length;
  const analysed = records.filter((r) => r.analysis.analysed).length;
  const immediate = records.filter((r) => r.analysis.priorityBand === 'immediate').length;
  const today = records.filter((r) => r.analysis.priorityBand === 'today').length;

  // Up to 5 most recent threads sorted by lastMessageAt descending
  const sortedRecords = [...records].sort((a, b) => {
    const timeA = a.thread.lastMessageAt ? new Date(a.thread.lastMessageAt).getTime() : 0;
    const timeB = b.thread.lastMessageAt ? new Date(b.thread.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });

  const recentThreads: RecentEmailThreadSummary[] = sortedRecords.slice(0, 5).map((r) => {
    const lastMsg = r.messages[r.messages.length - 1];
    const sender = lastMsg?.participants.find((p) => p.role === 'from');
    const senderName = sender?.displayName || sender?.address || 'Unknown';

    let status: 'needs_reply' | 'flagged' | 'normal' = 'normal';
    if (r.analysis.securityAlert) {
      status = 'flagged';
    } else if (r.analysis.replyRequired) {
      status = 'needs_reply';
    }

    return {
      id: r.thread.id,
      senderName,
      subject: r.thread.subject || '(no subject)',
      clientOrProject: r.analysis.classification.category || null,
      lastMessageAt: r.thread.lastMessageAt,
      status,
      isRead: r.thread.isRead,
    };
  });

  return {
    counts: {
      needsReply: needsReplyCount,
      unread: unreadCount,
      flagged: flaggedCount,
      processedToday,
      urgentCount: immediate,
      highCount: today,
      analysedCount: analysed,
      totalCount: total,
    },
    recentThreads,
  };
}

/**
 * Fetches authoritative email status for the current user and active account.
 */
export async function fetchAuthoritativeEmailStatus(
  preferredAccountId?: string,
  nowIso: string = DEMO_NOW
): Promise<SharedEmailStatusResult> {
  const accountResult = await loadUserEmailAccounts();
  const accounts = accountResult.accounts;

  let activeAccountId = preferredAccountId || null;
  if (!activeAccountId && accounts.length > 0) {
    activeAccountId = accounts[0].id;
  }

  if (!activeAccountId) {
    throw new Error('No email accounts available');
  }

  const dataset = getDataset(activeAccountId);
  if (!dataset) {
    throw new Error(`Email dataset not found for account: ${activeAccountId}`);
  }

  const calculated = calculateEmailStatusFromDataset(dataset, nowIso);

  return {
    ...calculated,
    accountId: activeAccountId,
    accountLabel: dataset.account.label,
    hasLiveAccounts: accountResult.hasLiveAccounts,
  };
}

export interface UseSharedEmailStatusOptions {
  preferredAccountId?: string;
  pollIntervalMs?: number;
  pauseWhenHidden?: boolean;
}

export function useSharedEmailStatus(options: UseSharedEmailStatusOptions = {}) {
  const { preferredAccountId, pollIntervalMs = 60000, pauseWhenHidden = true } = options;

  const [data, setData] = useState<SharedEmailStatusResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAuthoritativeEmailStatus(preferredAccountId);
      setData(res);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [preferredAccountId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Window focus listener and dataset updated listener
  useEffect(() => {
    const handleFocus = () => {
      loadStatus();
    };

    const handleDatasetUpdated = () => {
      loadStatus();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('concludo:email:dataset-updated', handleDatasetUpdated);

    // Subscribe to account notifications store (triggers on kind: 'email' realtime push)
    let lastNotifCount = accountNotificationsStore.getNotifications().length;
    const unsubscribeNotifications = accountNotificationsStore.subscribe(() => {
      const current = accountNotificationsStore.getNotifications();
      if (current.length !== lastNotifCount) {
        lastNotifCount = current.length;
        const latest = current[0];
        if (latest && latest.kind === 'email') {
          loadStatus();
        }
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('concludo:email:dataset-updated', handleDatasetUpdated);
      unsubscribeNotifications();
    };
  }, [loadStatus]);

  // Polling timer (default 60s, paused when document is hidden)
  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;

    const intervalId = setInterval(() => {
      if (pauseWhenHidden && typeof document !== 'undefined' && document.hidden) {
        return; // Paused when document is hidden
      }
      loadStatus();
    }, pollIntervalMs);

    return () => clearInterval(intervalId);
  }, [loadStatus, pollIntervalMs, pauseWhenHidden]);

  return {
    data,
    loading,
    error,
    refresh: loadStatus,
  };
}
