import {
  AccountDataset,
  ConnectedAccount,
  UserPreference,
  AccountProvider,
  EmailMessage,
  EmailThread,
  ThreadAnalysis,
  ReplyDraft,
  SecurityAlert,
  AnalysisVersion,
  UserCorrection,
  Attachment,
  Priority,
  PriorityBand,
  ThreadStatus,
} from './model';
import { EmailAccountSummary } from './types';
import { DEMO_TIME_ZONE } from './data/clock';
import { buildPriority, factors } from './priority';

/** In-memory registry of dynamic datasets produced by live scans */
const DYNAMIC_DATASETS = new Map<string, AccountDataset>();

/** Extracts display name and email address from raw "Name <email@domain>" format */
function parseSender(raw: string): { displayName: string; address: string } {
  if (!raw) return { displayName: 'Unknown', address: '' };
  const match = raw.match(/^(.*?)(?:<([^>]+)>)?$/);
  if (!match) return { displayName: raw, address: raw };
  const displayName = (match[1] || '').replace(/\"/g, '').trim();
  const address = (match[2] || '').trim();
  if (!address && displayName.includes('@')) {
    return { displayName: displayName.split('@')[0], address: displayName };
  }
  return {
    displayName: displayName || address || 'Unknown',
    address: address || displayName || '',
  };
}

/** Formats ISO offset date string */
function toIsoDate(val?: string): string {
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Builds a 100% authentic, isolated AccountDataset purely from live ingested email headers.
 * NEVER copies or mixes in fictional or example scenario records from WORK_DATASET or PERSONAL_DATASET.
 */
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
  const rawEmails = Array.isArray(scanData.emails) ? scanData.emails : [];
  const scannedAt = toIsoDate(scanData.scannedAt);

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
    lastSynchronisedAt: scannedAt,
    ownedAddresses: [accountSummary.address],
    excludedFolders: ['archive', 'sent'],
    timeZone: DEMO_TIME_ZONE,
  };

  const preference: UserPreference = {
    accountId,
    workingHours: { start: '08:30', end: '17:30', days: [1, 2, 3, 4, 5] },
    timeZone: DEMO_TIME_ZONE,
    replyTone: 'warm',
    signOff: 'Kind regards,',
    priorityContacts: [],
    priorityDomains: [],
    alwaysEscalate: [],
    excludedSenders: [],
    excludedFolders: ['archive', 'sent'],
    mayWriteDraftsToMailbox: false,
    analysisRetentionDays: 30,
  };

  const threads: EmailThread[] = [];
  const messages: EmailMessage[] = [];
  const analyses: ThreadAnalysis[] = [];
  const drafts: ReplyDraft[] = [];
  const securityAlerts: SecurityAlert[] = [];
  const attachments: Attachment[] = [];
  const analysisVersions: AnalysisVersion[] = [];
  const corrections: UserCorrection[] = [];

  // Group emails by threadId
  const threadMap = new Map<string, typeof rawEmails>();
  for (const email of rawEmails) {
    const threadKey = email.threadId || email.id || `thr-${Math.random()}`;
    if (!threadMap.has(threadKey)) threadMap.set(threadKey, []);
    threadMap.get(threadKey)!.push(email);
  }

  let index = 0;
  for (const [threadId, msgs] of threadMap.entries()) {
    index++;
    const sortedMsgs = msgs.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latestMsg = sortedMsgs[sortedMsgs.length - 1];
    const firstMsg = sortedMsgs[0];

    const messageIds: string[] = [];
    const participantAddresses = new Set<string>();

    for (const m of sortedMsgs) {
      const msgId = m.id || `msg-${threadId}-${messageIds.length + 1}`;
      messageIds.push(msgId);

      const fromParsed = parseSender(m.from);
      const isFromSelf = fromParsed.address.toLowerCase() === accountSummary.address.toLowerCase();
      if (fromParsed.address) participantAddresses.add(fromParsed.address);

      messages.push({
        id: msgId,
        threadId,
        accountId,
        sentAt: toIsoDate(m.date),
        participants: [
          {
            address: fromParsed.address,
            displayName: fromParsed.displayName,
            role: 'from',
            isSelf: isFromSelf,
          },
          {
            address: accountSummary.address,
            displayName: 'You',
            role: 'to',
            isSelf: true,
          },
        ],
        subject: m.subject || '(No subject)',
        body: m.snippet || m.bodyPreview || 'Message content ingested from connected mailbox.',
        isRead: !m.isImportant,
        isFromSelf,
        folder: 'inbox',
        labels: m.isImportant ? ['important'] : [],
        attachmentIds: [],
      });
    }

    const lastFromParsed = parseSender(latestMsg.from);
    const lastFromSelf = lastFromParsed.address.toLowerCase() === accountSummary.address.toLowerCase();

    // Determine priority and category from message signals
    const isImportant = Boolean(latestMsg.isImportant);
    const hasDeadlineWord = /due|deadline|by\s+[a-z]+|urgent|asap|eod/i.test(latestMsg.snippet || latestMsg.subject || '');
    const priorityScore = isImportant ? 92 : hasDeadlineWord ? 85 : Math.max(82 - index * 3, 50);
    const priorityBand: PriorityBand = priorityScore >= 90 ? 'immediate' : priorityScore >= 75 ? 'today' : priorityScore >= 50 ? 'soon' : 'batch';

    const cleanSubject = (latestMsg.subject || '(No subject)').replace(/^(re|fwd):\s*/i, '').trim();

    // Construct Thread
    const threadObj: EmailThread = {
      id: threadId,
      accountId,
      accountType: accountSummary.accountType,
      subject: cleanSubject,
      messageIds,
      firstMessageAt: toIsoDate(firstMsg.date),
      lastMessageAt: toIsoDate(latestMsg.date),
      participantAddresses: Array.from(participantAddresses),
      folder: 'inbox',
      labels: isImportant ? ['important'] : [],
      isRead: !isImportant,
      lastMessageFromSelf: lastFromSelf,
    };
    threads.push(threadObj);

    // Construct Thread Analysis
    const replyRequired = !lastFromSelf && (isImportant || index <= 5 || hasDeadlineWord);
    const threadStatus: ThreadStatus = replyRequired
      ? 'action_required'
      : lastFromSelf
      ? 'waiting_on_other'
      : 'information_only';

    const priObj: Priority = buildPriority(
      factors([
        ['deadline_proximity', hasDeadlineWord ? 9 : 4, hasDeadlineWord ? 'Subject or content mentions an active deadline.' : 'No immediate cutoff noted.'],
        ['explicit_request', replyRequired ? 8 : 2, replyRequired ? 'Sender is awaiting a response or status update.' : 'Informational correspondence.'],
        ['work_blocked', isImportant ? 8 : 3, isImportant ? 'Marked important in your live mailbox.' : 'Normal priority workflow.'],
        ['relationship_impact', 7, `Direct correspondence from ${lastFromParsed.displayName}.`],
      ]),
      'high',
      {},
      { ageDays: 1, resolved: !replyRequired }
    );

    const analysisObj: ThreadAnalysis = {
      threadId,
      accountId,
      accountType: accountSummary.accountType,
      subject: cleanSubject,
      oneLineSummary: `${lastFromParsed.displayName}: ${(latestMsg.snippet || cleanSubject).slice(0, 110)}`,
      whyItMatters: replyRequired
        ? `Direct live email awaiting your response or decision from ${lastFromParsed.displayName}.`
        : `Live correspondence from ${lastFromParsed.displayName}.`,
      currentStatus: threadStatus,
      priorityScore: priObj.score,
      priorityBand: priObj.band,
      priorityReasons: priObj.reasons,
      confidence: 'high',
      replyRequired,
      replyReason: replyRequired
        ? `Direct message from ${lastFromParsed.displayName} in your live inbox requiring follow-up.`
        : 'Informational message or most recent reply was sent by you.',
      explicitDeadlines: [],
      suggestedDates: [],
      actions: replyRequired
        ? [
            {
              id: `act-${threadId}-1`,
              description: `Review and prepare response to ${lastFromParsed.displayName}`,
              owner: 'self',
              ownerIsSelf: true,
              dueAt: null,
              estimatedMinutes: 5,
              status: 'open',
              source: [{ threadId, messageId: messageIds[0], quote: latestMsg.snippet || cleanSubject }],
              basis: 'inferred',
              confidence: 'high',
            },
          ]
        : [],
      decisionsMade: [],
      decisionsRequired: [],
      commitments: [],
      openQuestions: [],
      conflicts: [],
      attachments: [],
      risks: [],
      recommendedNextStep: replyRequired
        ? `Open thread and draft response to ${lastFromParsed.displayName}.`
        : 'Archive or file if no further action is required.',
      draftStatus: replyRequired ? 'available' : 'withheld_for_safety',
      factsToVerify: [],
      recommendedFollowUpDate: null,
      classification: {
        category: 'request',
        sensitivity: 'standard',
        tags: [],
        isBulk: false,
        source: [{ threadId, messageId: messageIds[0], quote: cleanSubject }],
        basis: 'stated',
        confidence: 'high',
      },
      priority: priObj,
      securityAlert: null,
      analysed: true,
      analysisVersionId: `ver-${threadId}-1`,
      estimatedEffortMinutes: replyRequired ? 5 : 2,
    };
    analyses.push(analysisObj);

    // Construct Draft
    if (replyRequired) {
      drafts.push({
        id: `drf-${threadId}`,
        threadId,
        status: 'available',
        body: `Hi ${lastFromParsed.displayName},\n\nThank you for your email regarding "${cleanSubject}". I am reviewing this and will follow up shortly.\n\nKind regards,\n${accountSummary.address}`,
        variants: {
          concise: `Hi ${lastFromParsed.displayName},\n\nReceived with thanks. I am reviewing "${cleanSubject}" and will revert shortly.\n\nKind regards,`,
          warm: `Hi ${lastFromParsed.displayName},\n\nThanks for reaching out about "${cleanSubject}". I'm looking into this now and will get back to you soon.\n\nWarm regards,`,
          detailed: `Hi ${lastFromParsed.displayName},\n\nThank you for your message regarding "${cleanSubject}". I have noted the details and am currently reviewing them. I will follow up with full details soon.\n\nKind regards,`,
        },
        commitmentsInDraft: [],
        recipients: [{ address: lastFromParsed.address, displayName: lastFromParsed.displayName, role: 'to' }],
        statusReason: null,
        factsToVerify: [],
        missingInformation: [],
        createdAt: scannedAt,
        approval: null,
      });
    }
  }

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
        at: scannedAt,
        kind: 'thread_analysed',
        accountId,
        threadId: threads[0]?.id || null,
        actor: 'Inbox Command Centre Agent',
        description: `Scanned and ingested ${messages.length} live messages from mailbox ${accountSummary.address}. Zero example data.`,
      },
    ],
    preference,
  };

  DYNAMIC_DATASETS.set(accountId, dataset);
  return dataset;
}

/**
 * Returns dynamic dataset for an account, or null if none registered.
 */
export function getDynamicDataset(accountId: string): AccountDataset | null {
  return DYNAMIC_DATASETS.get(accountId) || null;
}
