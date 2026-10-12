/**
 * The two synthetic account datasets.
 *
 * Each account owns its own threads, messages, analyses, drafts, alerts and
 * audit trail. Nothing is held in a shared pool keyed by account id, because a
 * shared pool is one missing filter away from showing a personal thread in a
 * work queue. Here, reaching the wrong account's data means asking for the
 * wrong dataset, which is visible in a diff.
 */
import {
  AccountDataset,
  AnalysisVersion,
  AuditEvent,
  ConnectedAccount,
  UserCorrection,
  UserPreference,
} from '../model';
import { Scenario } from './builders';
import { WORK_SCENARIOS } from './workThreads';
import { PERSONAL_SCENARIOS } from './personalThreads';
import { DEMO_TIME_ZONE } from './clock';

export const WORK_ACCOUNT: ConnectedAccount = {
  id: 'acct-work-01',
  label: 'Work',
  address: 'you@your-practice.example',
  accountType: 'work',
  provider: 'synthetic',
  connected: false,
  lastSynchronisedAt: '2026-10-12T08:28:00+11:00',
  ownedAddresses: ['you@your-practice.example'],
  excludedFolders: ['archive', 'sent'],
  timeZone: DEMO_TIME_ZONE,
};

export const PERSONAL_ACCOUNT: ConnectedAccount = {
  id: 'acct-personal-01',
  label: 'Personal',
  address: 'you@personal.example',
  accountType: 'personal',
  provider: 'synthetic',
  connected: false,
  lastSynchronisedAt: '2026-10-12T08:14:00+11:00',
  ownedAddresses: ['you@personal.example'],
  excludedFolders: ['archive', 'sent'],
  timeZone: DEMO_TIME_ZONE,
};

const WORK_PREFERENCE: UserPreference = {
  accountId: WORK_ACCOUNT.id,
  workingHours: { start: '08:30', end: '17:30', days: [1, 2, 3, 4, 5] },
  timeZone: DEMO_TIME_ZONE,
  replyTone: 'plain',
  signOff: 'Thanks',
  priorityContacts: ['dana.prosser@linwood-property.example', 'g.arcuri@brunswick-holdings.example'],
  priorityDomains: ['linwood-property.example', 'brunswick-holdings.example'],
  alwaysEscalate: ['outage', 'tender', 'bank details'],
  excludedSenders: [],
  excludedFolders: ['archive', 'sent'],
  mayWriteDraftsToMailbox: false,
  analysisRetentionDays: 90,
};

const PERSONAL_PREFERENCE: UserPreference = {
  ...WORK_PREFERENCE,
  accountId: PERSONAL_ACCOUNT.id,
  priorityContacts: [],
  priorityDomains: [],
  alwaysEscalate: [],
  replyTone: 'warm',
};

/** Builds the analysis version record for each analysed thread. */
function versionsFor(scenarios: readonly Scenario[]): AnalysisVersion[] {
  return scenarios
    .filter((s) => s.analysis.analysed && s.analysis.analysisVersionId)
    .map((s) => ({
      id: s.analysis.analysisVersionId as string,
      threadId: s.thread.id,
      version: 1,
      analysedAt: '2026-10-12T08:29:00+11:00',
      engine: { name: 'concludo-inbox', version: '0.3.0', promptVersion: 'icc-2026-10' },
      supersededAt: null,
      supersededBy: null,
      messageCountAtAnalysis: s.thread.messageIds.length,
    }));
}

/**
 * The audit trail.
 *
 * Every analysis, every withheld draft and every security alert is recorded.
 * There is no 'draft_written_to_mailbox' event and no 'approval_granted' event
 * anywhere in this dataset, because neither has happened and neither can
 * happen in Stage 3.
 */
function auditFor(scenarios: readonly Scenario[], accountId: string): AuditEvent[] {
  const events: AuditEvent[] = [];
  let n = 0;
  const id = () => `aud-${accountId}-${String(++n).padStart(3, '0')}`;

  for (const s of scenarios) {
    if (s.analysis.analysed) {
      events.push({
        id: id(),
        at: '2026-10-12T08:29:00+11:00',
        kind: 'thread_analysed',
        accountId,
        threadId: s.thread.id,
        actor: 'concludo-inbox 0.3.0',
        description: `Analysed "${s.thread.subject}" across ${s.thread.messageIds.length} message(s).`,
        analysisVersionId: s.analysis.analysisVersionId ?? undefined,
      });
    }
    if (s.securityAlert) {
      events.push({
        id: id(),
        at: '2026-10-12T08:29:00+11:00',
        kind: 'security_alert_raised',
        accountId,
        threadId: s.thread.id,
        actor: 'concludo-inbox 0.3.0',
        description: `Raised a ${s.securityAlert.severity} severity advisory: ${s.securityAlert.flags.join(', ')}.`,
      });
    }
    if (s.draft.status === 'withheld_for_safety') {
      events.push({
        id: id(),
        at: '2026-10-12T08:29:00+11:00',
        kind: 'draft_withheld',
        accountId,
        threadId: s.thread.id,
        actor: 'concludo-inbox 0.3.0',
        description: s.draft.statusReason ?? 'Draft withheld.',
      });
    } else if (s.draft.status === 'available') {
      events.push({
        id: id(),
        at: '2026-10-12T08:29:00+11:00',
        kind: 'draft_generated',
        accountId,
        threadId: s.thread.id,
        actor: 'concludo-inbox 0.3.0',
        description: 'Draft prepared for review. Not written to the mailbox and not sent.',
      });
    }
  }
  return events;
}

/**
 * One recorded correction, so the shape is demonstrated rather than described.
 *
 * A correction is a record of what the person changed. It does not alter the
 * analysis retrospectively and it does not change behaviour on its own.
 */
const WORK_CORRECTIONS: UserCorrection[] = [
  {
    id: 'cor-w-001',
    threadId: 'thr-w-009',
    analysisVersionId: 'ver-thr-w-009-1',
    field: 'reply_required',
    wasValue: 'true',
    nowValue: 'false',
    note: 'Courier notifications come from a no-reply address.',
    correctedAt: '2026-10-05T09:12:00+11:00',
    correctedBy: 'you@your-practice.example',
  },
];

function datasetFor(
  account: ConnectedAccount,
  scenarios: readonly Scenario[],
  preference: UserPreference,
  corrections: UserCorrection[]
): AccountDataset {
  return {
    account,
    messages: scenarios.flatMap((s) => s.messages),
    threads: scenarios.map((s) => s.thread),
    attachments: scenarios.flatMap((s) => s.attachments),
    analyses: scenarios.map((s) => s.analysis),
    drafts: scenarios.map((s) => s.draft),
    securityAlerts: scenarios.flatMap((s) => (s.securityAlert ? [s.securityAlert] : [])),
    analysisVersions: versionsFor(scenarios),
    corrections,
    auditEvents: auditFor(scenarios, account.id),
    preference,
  };
}

export const WORK_DATASET: AccountDataset = datasetFor(
  WORK_ACCOUNT,
  WORK_SCENARIOS,
  WORK_PREFERENCE,
  WORK_CORRECTIONS
);

export const PERSONAL_DATASET: AccountDataset = datasetFor(
  PERSONAL_ACCOUNT,
  PERSONAL_SCENARIOS,
  PERSONAL_PREFERENCE,
  []
);

export const ACCOUNTS: readonly ConnectedAccount[] = [WORK_ACCOUNT, PERSONAL_ACCOUNT];
export const DEFAULT_ACCOUNT_ID = WORK_ACCOUNT.id;

const BY_ID: Readonly<Record<string, AccountDataset>> = {
  [WORK_ACCOUNT.id]: WORK_DATASET,
  [PERSONAL_ACCOUNT.id]: PERSONAL_DATASET,
};

/**
 * The only way to reach an account's data.
 *
 * Returns null for an unknown id rather than falling back to the work account.
 * A silent fallback here would show one person's work inbox under another
 * account's name, which is the single worst thing this module could do.
 */
export function datasetFor_(accountId: string): AccountDataset | null {
  return BY_ID[accountId] ?? null;
}

export { datasetFor_ as getDataset };
export { WORK_SCENARIOS, PERSONAL_SCENARIOS };
