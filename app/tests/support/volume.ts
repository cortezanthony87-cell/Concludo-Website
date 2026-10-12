/**
 * A synthetic dataset of any size, for load testing.
 *
 * The hand-written dataset is twenty-two threads, chosen because each one tests
 * a different behaviour. That is the right dataset for correctness and the
 * wrong one for performance: twenty-two threads make every selector look fast.
 *
 * This generator makes datasets of 100, 1,000 and 10,000 threads that are
 * shaped like real ones rather than copies of one row. It varies the things the
 * selectors actually branch on: status, band, score, deadlines, read state,
 * folder, sender, bulk mail, duplicates, security flags, message count and
 * message length. A dataset where every thread is identical would let an
 * accidental O(n squared) hide behind a cache line.
 *
 * It is deterministic. A seeded generator means a slow run can be investigated
 * rather than re-rolled.
 */
import {
  AccountDataset,
  Attachment,
  Classification,
  ConnectedAccount,
  EmailMessage,
  EmailThread,
  PriorityBand,
  ReplyDraft,
  SecurityAlert,
  ThreadAnalysis,
  ThreadStatus,
  UserPreference,
} from '../../src/lib/email/model';
import { buildPriority, factors } from '../../src/lib/email/priority';
import { DEMO_TIME_ZONE } from '../../src/lib/email/data/clock';

/** A small deterministic generator. Not cryptographic, and does not need to be. */
function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

const STATUSES: ThreadStatus[] = [
  'waiting_on_user',
  'waiting_on_other',
  'decision_required',
  'action_required',
  'information_only',
  'resolved',
  'unclear',
];

const FOLDERS = ['inbox', 'clients', 'suppliers', 'finance'];

const CATEGORIES: Classification['category'][] = [
  'customer_issue',
  'meeting',
  'request',
  'invoice_or_payment',
  'notification',
  'newsletter',
  'delivery',
  'employment',
  'other',
];

export interface VolumeOptions {
  accountId: string;
  threadCount: number;
  /** Changes nothing structural, only the generated values. */
  seed?: number;
}

export function generateVolumeDataset(options: VolumeOptions): AccountDataset {
  const { accountId, threadCount } = options;
  const random = seeded(options.seed ?? 20261012);
  const self = `you@volume-${accountId}.example`;
  const baseTime = Date.parse('2026-10-12T08:30:00+11:00');

  const account: ConnectedAccount = {
    id: accountId,
    label: `Volume ${threadCount}`,
    address: self,
    accountType: 'work',
    provider: 'synthetic',
    connected: false,
    lastSynchronisedAt: '2026-10-12T08:28:00+11:00',
    ownedAddresses: [self],
    excludedFolders: ['archive', 'sent'],
    timeZone: DEMO_TIME_ZONE,
  };

  const threads: EmailThread[] = [];
  const messages: EmailMessage[] = [];
  const analyses: ThreadAnalysis[] = [];
  const attachments: Attachment[] = [];
  const drafts: ReplyDraft[] = [];
  const securityAlerts: SecurityAlert[] = [];

  for (let i = 0; i < threadCount; i += 1) {
    const threadId = `vol-${i}`;
    const status = STATUSES[i % STATUSES.length];
    const folder = FOLDERS[i % FOLDERS.length];
    const category = CATEGORIES[i % CATEGORIES.length];
    const counterparty = `person${i % 97}@client-${i % 23}.example`;
    const messageCount = 1 + (i % 4);
    const ageDays = Math.floor(random() * 60);
    const lastAt = new Date(baseTime - ageDays * 24 * 3600_000).toISOString();
    const firstAt = new Date(
      baseTime - (ageDays + messageCount) * 24 * 3600_000
    ).toISOString();
    const isBulk = i % 11 === 0;
    const flagged = i % 97 === 0;
    const duplicate = i % 53 === 0 && i > 0;
    const hasDeadline = i % 3 === 0;
    const messageIds: string[] = [];

    for (let m = 0; m < messageCount; m += 1) {
      const id = `vol-m-${i}-${m}`;
      messageIds.push(id);
      const fromSelf = m % 2 === 1;
      messages.push({
        id,
        threadId,
        accountId,
        sentAt: new Date(
          Date.parse(firstAt) + m * 6 * 3600_000
        ).toISOString(),
        participants: fromSelf
          ? [
              { address: self, displayName: 'You', role: 'from', isSelf: true },
              { address: counterparty, displayName: `Person ${i % 97}`, role: 'to', isSelf: false },
            ]
          : [
              {
                address: counterparty,
                displayName: `Person ${i % 97}`,
                role: 'from',
                isSelf: false,
                ...(i % 17 === 0 ? { isPriorityContact: true } : {}),
              },
              { address: self, displayName: 'You', role: 'to', isSelf: true },
            ],
        subject: `${m === 0 ? '' : 'RE: '}Thread ${i} about ${category.replace('_', ' ')}`,
        // Long enough to be realistic. A one-word body makes any text scan
        // look free, and several selectors search the body.
        body: `Message ${m} of thread ${i}. ${'This is a sentence of ordinary business correspondence. '.repeat(
          3 + (i % 5)
        )}`,
        isRead: i % 4 !== 0,
        isFromSelf: fromSelf,
        folder,
        labels: i % 5 === 0 ? ['clients'] : [],
        attachmentIds: i % 13 === 0 && m === 0 ? [`vol-att-${i}`] : [],
      });
    }

    if (i % 13 === 0) {
      attachments.push({
        id: `vol-att-${i}`,
        messageId: `vol-m-${i}-0`,
        threadId,
        fileName: `document-${i}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 100_000 + i,
        contentsRead: false,
        whyNotRead: 'Attachment contents are not read unless the person turns it on.',
      });
    }

    threads.push({
      id: threadId,
      accountId,
      accountType: 'work',
      subject: `Thread ${i} about ${category.replace('_', ' ')}`,
      messageIds,
      firstMessageAt: firstAt,
      lastMessageAt: lastAt,
      participantAddresses: [self, counterparty],
      folder,
      labels: i % 5 === 0 ? ['clients'] : [],
      isRead: i % 4 !== 0,
      lastMessageFromSelf: (messageCount - 1) % 2 === 1,
      ...(duplicate ? { duplicateOf: `vol-${i - 1}` } : {}),
    });

    const alert: SecurityAlert | null = flagged
      ? {
          id: `vol-sec-${i}`,
          threadId,
          flags: ['suspicious_link'],
          severity: 'medium',
          explanation: 'The link in this message does not go where the text says it goes.',
          recommendedCheck: 'Ring the sender on a number you already have.',
          disposition: 'advisory',
          source: [{ threadId, messageId: `vol-m-${i}-0`, quote: 'click here to confirm' }],
          basis: 'stated',
          confidence: 'medium',
        }
      : null;
    if (alert) securityAlerts.push(alert);

    const deadlineAt = new Date(baseTime + ((i % 20) - 5) * 24 * 3600_000).toISOString();
    const priority = buildPriority(
      factors([
        ['deadline_proximity', hasDeadline ? (i % 11) : 0, hasDeadline ? 'A date is stated.' : ''],
        ['consequence_of_delay', i % 10, 'Generated for load testing.'],
        ['explicit_request', i % 7, ''],
        ['work_blocked', i % 5, ''],
        ['sensitivity', flagged ? 9 : i % 4, ''],
        ['prior_commitment', i % 3, ''],
        ['unanswered_follow_ups', i % 4, ''],
        ['relationship_impact', i % 6, ''],
        ['ease_of_resolution', i % 9, ''],
      ]),
      i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
      flagged ? { securityFlagged: true } : {},
      { ageDays, resolved: status === 'resolved' }
    );

    analyses.push({
      threadId,
      accountId,
      accountType: 'work',
      subject: `Thread ${i} about ${category.replace('_', ' ')}`,
      oneLineSummary: `Thread ${i}: a generated conversation for load testing.`,
      whyItMatters: 'Generated. The consequence of ignoring it is nothing, because it is not real.',
      currentStatus: status,
      priorityScore: priority.score,
      priorityBand: priority.band as PriorityBand,
      priorityReasons: priority.reasons.slice(0, 3),
      confidence: priority.confidence,
      replyRequired: status === 'waiting_on_user' || status === 'action_required',
      replyReason: 'Generated for load testing.',
      explicitDeadlines: hasDeadline
        ? [
            {
              id: `vol-dl-${i}`,
              threadId,
              description: `Deadline for thread ${i}`,
              dueAt: deadlineAt,
              consequence: 'Generated.',
              ownerIsSelf: i % 2 === 0,
              basis: 'stated',
              confidence: 'high',
              source: [{ threadId, messageId: `vol-m-${i}-0`, quote: 'by Friday' }],
            },
          ]
        : [],
      suggestedDates: [],
      actions:
        i % 2 === 0
          ? [
              {
                id: `vol-act-${i}`,
                threadId,
                description: `Action for thread ${i}`,
                owner: i % 4 === 0 ? 'You' : `Person ${i % 97}`,
                ownerIsSelf: i % 4 === 0,
                dueAt: hasDeadline ? deadlineAt : null,
                estimatedMinutes: 5 + (i % 40),
                status: 'open',
                basis: 'stated',
                confidence: 'medium',
                source: [{ threadId, messageId: `vol-m-${i}-0`, quote: 'please action' }],
              },
            ]
          : [],
      decisionsMade: [],
      decisionsRequired: [],
      commitments: [],
      openQuestions: [],
      conflicts: [],
      attachments: attachments.filter((a) => a.threadId === threadId),
      risks: [],
      recommendedNextStep: `Decide what to do about thread ${i}.`,
      draftStatus: i % 6 === 0 ? 'available' : 'not_recommended',
      factsToVerify: [],
      recommendedFollowUpDate: null,
      classification: {
        category: isBulk ? 'newsletter' : category,
        sensitivity: i % 29 === 0 ? 'sensitive' : 'standard',
        tags: [],
        isBulk,
        basis: 'stated',
        confidence: 'high',
        source: [{ threadId, messageId: `vol-m-${i}-0`, quote: 'generated' }],
      },
      priority,
      securityAlert: alert,
      analysed: i % 31 !== 0,
      analysisVersionId: i % 31 !== 0 ? `vol-ver-${i}` : null,
      estimatedEffortMinutes: i % 7 === 0 ? 2 : 5 + (i % 50),
    });
  }

  const preference: UserPreference = {
    accountId,
    workingHours: { start: '08:30', end: '17:30', days: [1, 2, 3, 4, 5] },
    timeZone: DEMO_TIME_ZONE,
    replyTone: 'plain',
    signOff: 'Thanks',
    priorityContacts: [],
    priorityDomains: [],
    alwaysEscalate: [],
    excludedSenders: [],
    excludedFolders: ['archive', 'sent'],
    mayWriteDraftsToMailbox: false,
    analysisRetentionDays: 90,
  };

  return {
    account,
    messages,
    threads,
    attachments,
    analyses,
    drafts,
    securityAlerts,
    analysisVersions: [],
    corrections: [],
    auditEvents: [],
    preference,
  };
}
