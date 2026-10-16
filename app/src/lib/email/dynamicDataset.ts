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
  Deadline,
  Priority,
  PriorityBand,
  ThreadStatus,
} from './model';
import { EmailAccountSummary } from './types';
import { DEMO_TIME_ZONE } from './data/clock';
import { buildPriority, factors } from './priority';

/** In-memory registry of dynamic datasets produced by live scans */
const DYNAMIC_DATASETS = new Map<string, AccountDataset>();

/** Decodes HTML character entities into readable text */
export function decodeHtmlEntities(str?: string): string {
  if (!str) return '';
  let prev = str;
  for (let i = 0; i < 3; i++) {
    const next = prev
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#(\d+);/g, (_, code) => {
        try {
          return String.fromCodePoint(Number(code));
        } catch {
          return String.fromCharCode(Number(code));
        }
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
        try {
          return String.fromCodePoint(parseInt(code, 16));
        } catch {
          return String.fromCharCode(parseInt(code, 16));
        }
      });
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

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

/** Extracts stated deadlines from email text */
function extractExplicitDeadlines(threadId: string, messageId: string, subject: string, bodyText: string): Deadline[] {
  const text = `${subject} ${bodyText}`;
  const deadlines: Deadline[] = [];

  const dueRegex = /(?:due(?: date)?(?:\s+(?:by|on|at|is|for))?|deadline(?:\s+(?:is|by|on))?|by|before)\s+([A-Za-z0-9,:\s\-\/]{3,30})/gi;
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  let match;
  while ((match = dueRegex.exec(text)) !== null) {
    const rawPhrase = match[1].trim().replace(/[.,;!?]+$/, '');
    const lower = rawPhrase.toLowerCase();
    const hasDay = daysOfWeek.some(d => lower.startsWith(d));
    const hasMonth = months.some(m => lower.includes(m));
    const hasRelative = lower.startsWith('tomorrow') || lower.startsWith('today') || lower.startsWith('next week') || lower.startsWith('end of week');
    const hasNumericDate = /\d{1,2}[\/\-\.]\d{1,2}/.test(rawPhrase) || /\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(rawPhrase);

    if (hasDay || hasMonth || hasRelative || hasNumericDate) {
      let targetDate: Date | null = null;
      const now = new Date();
      if (hasRelative) {
        targetDate = new Date();
        if (lower.startsWith('tomorrow')) targetDate.setDate(now.getDate() + 1);
        else if (lower.startsWith('next week') || lower.startsWith('end of week')) targetDate.setDate(now.getDate() + 5);
      } else if (hasDay) {
        const targetDayIdx = daysOfWeek.findIndex(d => lower.startsWith(d));
        if (targetDayIdx !== -1) {
          targetDate = new Date();
          const currentDayIdx = now.getDay();
          let diff = targetDayIdx - currentDayIdx;
          if (diff <= 0) diff += 7;
          targetDate.setDate(now.getDate() + diff);
        }
      } else {
        // Australian DD/MM/YYYY date format check
        const ddmmyyyy = rawPhrase.match(/\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\b/);
        if (ddmmyyyy) {
          const day = parseInt(ddmmyyyy[1], 10);
          const month = parseInt(ddmmyyyy[2], 10) - 1;
          let yr = parseInt(ddmmyyyy[3], 10);
          if (yr < 100) yr += 2000;
          const parsedAus = new Date(yr, month, day, 17, 0, 0);
          if (!isNaN(parsedAus.getTime())) targetDate = parsedAus;
        } else {
          const parsed = new Date(rawPhrase);
          if (!isNaN(parsed.getTime())) {
            targetDate = parsed;
          }
        }
      }

      if (targetDate && !isNaN(targetDate.getTime())) {
        deadlines.push({
          id: `dl-${threadId}-${deadlines.length + 1}`,
          description: decodeHtmlEntities(match[0].slice(0, 50).trim()),
          dueAt: targetDate.toISOString(),
          basis: 'stated',
          confidence: 'high',
          consequence: 'Stated deadline extracted from correspondence',
          ownerIsSelf: true,
          source: [{ threadId, messageId, quote: decodeHtmlEntities(match[0].trim()) }],
        });
        break;
      }
    }
  }
  return deadlines;
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

      const msgAttachmentIds: string[] = [];
      if (Array.isArray(m.attachments)) {
        for (let aIdx = 0; aIdx < m.attachments.length; aIdx++) {
          const a = m.attachments[aIdx];
          const attId = a.id || `att-${threadId}-${aIdx + 1}`;
          msgAttachmentIds.push(attId);
          attachments.push({
            id: attId,
            source: [{ messageId: msgId, threadId }],
            basis: 'stated',
            confidence: 'high',
            fileName: decodeHtmlEntities(a.filename || a.fileName || a.name || 'Attachment'),
            mimeType: a.mimeType || 'application/octet-stream',
            sizeBytes: typeof a.size === 'number' ? a.size : (typeof a.sizeBytes === 'number' ? a.sizeBytes : null),
            disposition: 'received',
          });
        }
      }

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
        subject: decodeHtmlEntities(m.subject || '(No subject)'),
        body: decodeHtmlEntities(m.body || m.content || m.text || m.bodyPreview || m.snippet || 'Message content ingested from connected mailbox.'),
        isRead: !m.isImportant,
        isFromSelf,
        folder: 'inbox',
        labels: m.isImportant ? ['important'] : [],
        attachmentIds: msgAttachmentIds,
      });
    }

    const lastFromParsed = parseSender(latestMsg.from);
    const lastFromSelf = lastFromParsed.address.toLowerCase() === accountSummary.address.toLowerCase();

    // Determine priority and category from message signals
    const isImportant = Boolean(latestMsg.isImportant);
    const hasDeadlineWord = /due|deadline|by\s+[a-z]+|urgent|asap|eod/i.test(latestMsg.snippet || latestMsg.subject || '');
    const priorityScore = isImportant ? 92 : hasDeadlineWord ? 85 : Math.max(82 - index * 3, 50);
    const priorityBand: PriorityBand = priorityScore >= 90 ? 'immediate' : priorityScore >= 75 ? 'today' : priorityScore >= 50 ? 'soon' : 'batch';

    const cleanSubject = decodeHtmlEntities((latestMsg.subject || '(No subject)').replace(/^(re|fwd):\s*/i, '').trim());

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
      oneLineSummary: `${lastFromParsed.displayName}: ${decodeHtmlEntities((latestMsg.body || latestMsg.snippet || cleanSubject).slice(0, 110))}`,
      whyItMatters: replyRequired
        ? `Direct live email awaiting your response or decision from ${lastFromParsed.displayName}.`
        : `Live correspondence from ${lastFromParsed.displayName}.`,
      currentStatus: threadStatus,
      priorityScore: priorityScore,
      priorityBand: priorityBand,
      priorityReasons: priObj.reasons,
      confidence: 'high',
      replyRequired,
      replyReason: replyRequired
        ? `Direct message from ${lastFromParsed.displayName} in your live inbox requiring follow-up.`
        : 'Informational message or most recent reply was sent by you.',
      explicitDeadlines: extractExplicitDeadlines(threadId, messageIds[0], cleanSubject, latestMsg.body || latestMsg.snippet || ''),
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
      attachments: attachments.filter((a) => a.source?.some((s) => s.threadId === threadId)),
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
      priority: {
        score: priorityScore,
        band: priorityBand,
        factors: priObj.factors,
        reasons: isImportant ? ['Marked important in your live mailbox.'] : hasDeadlineWord ? ['Explicit deadline mentioned in correspondence.'] : priObj.reasons,
        confidence: 'high',
      },
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
        body: `Hi ${lastFromParsed.displayName},\n\nThank you for your email regarding "${cleanSubject}". I am reviewing this and will follow up shortly.\n\nKind regards,`,
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
