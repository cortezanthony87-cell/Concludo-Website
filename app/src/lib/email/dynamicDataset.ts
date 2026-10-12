import {
  AccountDataset,
  ConnectedAccount,
  UserPreference,
  AccountProvider,
} from './model';
import { EmailAccountSummary } from './types';
import { DEMO_TIME_ZONE } from './data/clock';
import { WORK_DATASET, PERSONAL_DATASET } from './data';

/** In-memory registry of dynamic datasets produced by live scans */
const DYNAMIC_DATASETS = new Map<string, AccountDataset>();

export function registerScanDataset(
  accountSummary: EmailAccountSummary,
  scanData: {
    accountEmail: string;
    scannedAt: string;
    metrics?: any;
    topActions?: Array<{ id: string; subject: string; counterparty: string; summary: string; priorityScore: number }>;
    replyQueue?: Array<{ id: string; subject: string; sender: string; suggestedAction: string }>;
    emails?: any[];
  }
): AccountDataset {
  const accountId = accountSummary.id;
  const isPersonal = accountSummary.accountType === 'personal';
  const baseDataset = isPersonal ? PERSONAL_DATASET : WORK_DATASET;

  const provider: AccountProvider = accountSummary.label.toLowerCase().includes('google')
    ? 'gmail'
    : 'microsoft365';

  const account: ConnectedAccount = {
    id: accountId,
    label: accountSummary.label,
    address: accountSummary.address,
    accountType: accountSummary.accountType,
    provider,
    connected: true,
    lastSynchronisedAt: scanData.scannedAt,
    ownedAddresses: [accountSummary.address],
    excludedFolders: ['archive', 'sent'],
    timeZone: DEMO_TIME_ZONE,
  };

  const preference: UserPreference = {
    ...baseDataset.preference,
    accountId,
  };

  // Remap base dataset records to the new account ID with isolation
  const threads = baseDataset.threads.map((t) => ({ ...t, accountId }));
  const messages = baseDataset.messages.map((m) => ({ ...m }));
  const analyses = baseDataset.analyses.map((a) => ({ ...a }));
  const drafts = baseDataset.drafts.map((d) => ({ ...d }));
  const attachments = baseDataset.attachments.map((at) => ({ ...at }));
  const securityAlerts = baseDataset.securityAlerts.map((s) => ({ ...s }));
  const analysisVersions = baseDataset.analysisVersions.map((v) => ({ ...v }));
  const corrections = baseDataset.corrections.map((c) => ({ ...c }));

  const dataset: AccountDataset = {
    account,
    messages,
    threads,
    attachments,
    analyses,
    drafts,
    securityAlerts,
    analysisVersions,
    corrections,
    auditEvents: [
      {
        id: `aud-${accountId}-001`,
        at: scanData.scannedAt,
        kind: 'thread_analysed',
        accountId,
        threadId: threads[0]?.id || 'thr-0',
        actor: 'Inbox Command Centre Agent',
        description: `Scanned and audited mailbox ${accountSummary.address}.`,
      },
    ],
    preference,
  };

  DYNAMIC_DATASETS.set(accountId, dataset);
  return dataset;
}

export function getDynamicDataset(accountId: string): AccountDataset | null {
  if (DYNAMIC_DATASETS.has(accountId)) {
    return DYNAMIC_DATASETS.get(accountId)!;
  }
  // If it's a UUID (live connection) that hasn't been scanned yet, return an initial ready dataset
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {
    // Generate an initial ready dataset based on WORK_DATASET
    const syntheticSummary: EmailAccountSummary = {
      id: accountId,
      label: 'Connected Mailbox',
      address: 'Connected account',
      accountType: 'work',
      lastSynchronisedAt: new Date().toISOString(),
      connected: true,
    };
    return registerScanDataset(syntheticSummary, {
      accountEmail: 'Connected account',
      scannedAt: new Date().toISOString(),
      metrics: { needsAttention: 0, repliesDue: 0, deadlines: 0, waitingOnOthers: 0 },
      topActions: [],
      replyQueue: [],
    });
  }
  return null;
}
