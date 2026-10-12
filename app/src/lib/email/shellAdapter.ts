/**
 * The bridge between the Stage 3 model and the Stage 2 shell.
 *
 * This file exists so the components written in Stage 2 did not have to be
 * rewritten in Stage 3. It replaces `syntheticShellData.ts`, which held
 * hand-typed counts and hand-typed scores. Every number the dashboard now shows
 * is derived from the dataset by the aggregation layer, so a card and the page
 * behind it cannot disagree.
 *
 * It also does one job the model deliberately will not: it decides what the
 * shell is allowed to say. An inferred date never crosses this boundary as an
 * explicit one, and nothing here invents a figure the model did not produce.
 */
import {
  AsyncState,
  EmailAccountSummary,
  EmailMetric,
  EmailMetricKey,
  EmailPanelData,
  EmailPanelItem,
  EmailPanelKey,
  EmailSyncStatus,
  EmailModulePath,
} from './types';
import { ThreadFilter, QueueKey } from './model';
import { ACCOUNTS, DEFAULT_ACCOUNT_ID, getDataset } from './data';
import { DEMO_NOW } from './data/clock';
import { QUEUE_PREVIEW_SIZE, buildDashboard } from './aggregation';
import { ThreadRecord, recordsFor, applyFilter } from './filters';

export { DEFAULT_ACCOUNT_ID };

/** The shell's account summaries, projected from the full account records. */
export const SYNTHETIC_ACCOUNTS: readonly EmailAccountSummary[] = ACCOUNTS.map((a) => ({
  id: a.id,
  label: a.label,
  address: a.address,
  accountType: a.accountType,
  lastSynchronisedAt: a.lastSynchronisedAt,
  connected: a.connected,
}));

export function syntheticSyncStatus(accountId: string): EmailSyncStatus {
  const account = ACCOUNTS.find((a) => a.id === accountId);
  return {
    state: 'never',
    lastSynchronisedAt: account?.lastSynchronisedAt ?? null,
    message: 'Demonstration data. No mailbox is connected.',
  };
}

/* ------------------------------------------------------------- projections */

/** Where each count's card navigates to. */
export const METRIC_DESTINATION: Record<EmailMetricKey, EmailModulePath> = {
  needs_attention: '/email/needs-attention',
  replies_due: '/email/reply-queue',
  actions_required: '/email/actions-deadlines',
  deadlines: '/email/actions-deadlines',
  waiting_on_others: '/email/waiting',
  quick_wins: '/email/quick-wins',
  security_review: '/email/security-review',
  unprocessed: '/email/all',
};

/**
 * Turns a thread record into a panel row.
 *
 * `deadline` carries the STATED date only, and `deadlineIsExplicit` is true
 * whenever a date is shown. A suggested date is shown only when there is no
 * stated one, and then the flag is false so the interface can label it.
 */
export function toPanelItem(record: ThreadRecord): EmailPanelItem {
  const { thread, analysis } = record;
  const stated = record.nextStatedDeadline;
  const inferred = analysis.suggestedDates[0]?.dueAt ?? null;

  return {
    id: thread.id,
    accountId: thread.accountId,
    accountType: thread.accountType,
    sender: senderLabel(record),
    subject: thread.subject,
    summary: analysis.oneLineSummary,
    priorityScore: analysis.priorityScore,
    priorityBand: analysis.priorityBand,
    priorityReasons: [...analysis.priorityReasons],
    deadline: stated ?? inferred,
    deadlineIsExplicit: stated !== null,
    status: analysis.currentStatus,
    replyRecommended: analysis.replyRequired,
  };
}

/**
 * The name shown above a subject line.
 *
 * Corrected during Stage 3 verification. The first version appended the
 * organisation unconditionally, which produced "Northaxis Supply accounts,
 * Northaxis Supply" and "Velda Corp Ventures, Velda Corp Ventures" on every
 * row whose display name already carried the company. The organisation is now
 * added only when it says something the name does not.
 */
function senderLabel(record: ThreadRecord): string {
  const name = record.counterpartyName;
  const org = organisationOf(record);
  if (!org) return name;
  if (name.toLowerCase().includes(org.toLowerCase())) return name;
  return `${name}, ${org}`;
}

function organisationOf(record: ThreadRecord): string | undefined {
  for (const message of record.messages) {
    const sender = message.participants.find(
      (p) => p.role === 'from' && p.address === record.counterpartyAddress
    );
    if (sender?.organisation) return sender.organisation;
  }
  return undefined;
}

/* ----------------------------------------------------------------- metrics */

/**
 * The eight cards for one account.
 *
 * `state` is still a parameter so loading, empty and error can be shown without
 * a network. A count of zero is a real answer and renders as the card's empty
 * state, which is usually good news rather than a failure.
 */
export function syntheticMetrics(
  accountId: string,
  state: AsyncState = 'ready',
  now: string = DEMO_NOW,
  extra: ThreadFilter = {}
): EmailMetric[] {
  const dataset = getDataset(accountId);

  const shell = (key: EmailMetricKey, label: string, explanation: string): Omit<EmailMetric, 'count' | 'state'> => ({
    key,
    label,
    explanation,
    destination: METRIC_DESTINATION[key],
    ...(key === 'security_review' ? { emphasis: 'attention' as const } : {}),
  });

  if (!dataset) {
    return buildDashboard(
      // No dataset means no account. Rather than returning an empty dashboard,
      // which reads as "nothing to do", every card says it could not be worked
      // out. Silence and zero must never look the same.
      { ...emptyDataset(accountId) },
      now
    ).metrics.map((m) => ({
      ...shell(m.key, m.label, m.explanation),
      count: null,
      state: 'error' as const,
      errorMessage: 'This account is not available. Nothing has been hidden; check the account selector.',
    }));
  }

  const dashboard = buildDashboard(dataset, now, extra);

  return dashboard.metrics.map((m) => {
    const base = shell(m.key, m.label, m.explanation);
    if (state === 'loading') return { ...base, count: null, state: 'loading' as const };
    if (state === 'error') {
      return {
        ...base,
        count: null,
        state: 'error' as const,
        errorMessage: 'This count could not be worked out. Nothing has been missed; try refreshing.',
      };
    }
    if (state === 'empty') return { ...base, count: 0, state: 'empty' as const };
    return { ...base, count: m.count, state: m.count === 0 ? ('empty' as const) : ('ready' as const) };
  });
}

/* ------------------------------------------------------------------ panels */

/** The shell has seven panels; the model has five queues plus two of its own. */
const PANEL_FROM_QUEUE: Partial<Record<EmailPanelKey, QueueKey>> = {
  handle_first: 'handle_first',
  todays_workload: 'todays_workload',
  reply_queue: 'reply_queue',
  waiting_on_others: 'waiting',
  quick_wins: 'quick_wins',
};

const PANEL_DESTINATION: Record<EmailPanelKey, EmailModulePath> = {
  handle_first: '/email/needs-attention',
  todays_workload: '/email/actions-deadlines',
  reply_queue: '/email/reply-queue',
  quick_wins: '/email/quick-wins',
  waiting_on_others: '/email/waiting',
  security_review: '/email/security-review',
  inbox_intelligence: '/email/all',
};

export function syntheticPanels(
  accountId: string,
  state: AsyncState = 'ready',
  now: string = DEMO_NOW,
  extra: ThreadFilter = {}
): EmailPanelData[] {
  const dataset = getDataset(accountId);

  const blank = (
    key: EmailPanelKey,
    title: string,
    description: string,
    emptyMessage: string
  ): EmailPanelData => ({
    key,
    title,
    description,
    state,
    items: [],
    emptyMessage,
    totalItems: 0,
    destination: PANEL_DESTINATION[key],
    ...(state === 'error'
      ? { errorMessage: 'This panel could not be built. Nothing has been missed; try refreshing.' }
      : {}),
  });

  if (!dataset || state === 'loading' || state === 'error' || state === 'empty') {
    return PANEL_ORDER.map((p) => blank(p.key, p.title, p.description, p.emptyMessage));
  }

  const dashboard = buildDashboard(dataset, now, extra);
  const records = dashboard.records;

  return PANEL_ORDER.map((p) => {
    const queueKey = PANEL_FROM_QUEUE[p.key];
    let items: EmailPanelItem[];
    let totalItems: number;

    if (queueKey) {
      const queue = dashboard.queues.find((q) => q.key === queueKey);
      // Already capped at QUEUE_PREVIEW_SIZE by buildDashboard, which is where
      // the cap belongs: capping here would still have built every row.
      items = (queue?.records ?? []).map(toPanelItem);
      totalItems = queue?.totalRecords ?? 0;
    } else if (p.key === 'security_review') {
      const flagged = applyFilter(records, { securityFlagged: true, includeBulk: true });
      items = flagged.slice(0, QUEUE_PREVIEW_SIZE).map(toPanelItem);
      totalItems = flagged.length;
    } else {
      // Inbox Intelligence is a pattern panel, not a thread list. It carries no
      // rows until there is enough analysed material to say something true, and
      // it never reports a pattern as a count against a named person.
      items = [];
      totalItems = 0;
    }

    return {
      key: p.key,
      title: p.title,
      description: p.description,
      state: items.length === 0 ? ('empty' as const) : ('ready' as const),
      items,
      totalItems,
      emptyMessage: p.emptyMessage,
      destination: PANEL_DESTINATION[p.key],
    };
  });
}

const PANEL_ORDER: readonly {
  key: EmailPanelKey;
  title: string;
  description: string;
  emptyMessage: string;
}[] = [
  {
    key: 'handle_first',
    title: 'Handle First',
    description: 'Highest consequence if left until tomorrow.',
    emptyMessage: 'Nothing is urgent. That is a real answer, not an empty list.',
  },
  {
    key: 'todays_workload',
    title: "Today's Workload",
    description: 'What is realistically on today, in order.',
    emptyMessage: 'Nothing is dated today.',
  },
  {
    key: 'reply_queue',
    title: 'Reply Queue',
    description: 'Threads where someone is waiting on your answer.',
    emptyMessage: 'Nobody is waiting on a reply from you.',
  },
  {
    key: 'quick_wins',
    title: 'Quick Wins',
    description: 'Probably closeable in under two minutes each.',
    emptyMessage: 'No two minute jobs waiting.',
  },
  {
    key: 'waiting_on_others',
    title: 'Waiting on Others',
    description: 'You have done your part. The next step is theirs.',
    emptyMessage: 'Nothing is outstanding from anyone else.',
  },
  {
    key: 'inbox_intelligence',
    title: 'Inbox Intelligence',
    description: 'Patterns across threads, not a count against any person.',
    emptyMessage: 'Not enough analysed threads to show a pattern yet.',
  },
  {
    key: 'security_review',
    title: 'Security Review',
    description: 'Flagged as possibly unsafe. Advisory only, and never a guarantee.',
    // An empty security panel must not read as "your inbox is safe". The module
    // checks for a known set of patterns; it does not certify anything.
    emptyMessage: 'Nothing is flagged. That is not proof an inbox is safe, only that nothing matched.',
  },
];

/** Every row for one account, used by the list pages. */
export function itemsForAccount(accountId: string, now: string = DEMO_NOW): EmailPanelItem[] {
  const dataset = getDataset(accountId);
  if (!dataset) return [];
  return recordsFor(dataset).map(toPanelItem);
}

/** Kept for the Stage 2 tests, which assert that the two accounts never merge. */
export const SYNTHETIC_ITEMS_BY_ACCOUNT: Readonly<Record<string, EmailPanelItem[]>> =
  Object.fromEntries(ACCOUNTS.map((a) => [a.id, itemsForAccount(a.id)]));

/** An empty dataset shell, used only to build the eight error cards above. */
function emptyDataset(accountId: string) {
  return {
    account: {
      id: accountId,
      label: 'Unknown',
      address: '',
      accountType: 'work' as const,
      provider: 'synthetic' as const,
      connected: false,
      lastSynchronisedAt: null,
      ownedAddresses: [],
      excludedFolders: [],
      timeZone: 'Australia/Melbourne',
    },
    messages: [],
    threads: [],
    attachments: [],
    analyses: [],
    drafts: [],
    securityAlerts: [],
    analysisVersions: [],
    corrections: [],
    auditEvents: [],
    preference: {
      accountId,
      workingHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
      timeZone: 'Australia/Melbourne',
      replyTone: 'plain' as const,
      signOff: '',
      priorityContacts: [],
      priorityDomains: [],
      alwaysEscalate: [],
      excludedSenders: [],
      excludedFolders: [],
      mayWriteDraftsToMailbox: false,
      analysisRetentionDays: 90,
    },
  };
}
