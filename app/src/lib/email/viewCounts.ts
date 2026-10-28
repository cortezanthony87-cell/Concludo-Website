/**
 * Live counts for the views a person can move between.
 *
 * Each count is produced by the same function the view itself calls, with the
 * same inputs, so a number shown beside a link cannot disagree with the list it
 * leads to. There is no estimate and no second definition of "waiting".
 *
 * Counts describe work, never people.
 */
import { ThreadRecord } from './filters';
import { AccountType } from './model';
import { EmailModulePath } from './types';
import {
  datedItems,
  needsAttentionItems,
  quickWinItems,
  replyQueueItems,
  securityItems,
  waitingItems,
  UserDate,
} from './views';
import { ReplyDraft } from './model';
import { DEFAULT_BACKLOG_SELECTION, buildBacklogBatch } from './backlog';

export interface ViewCounts {
  '/email/needs-attention': number;
  '/email/reply-queue': number;
  '/email/actions-deadlines': number;
  '/email/waiting': number;
  '/email/quick-wins': number;
  '/email/clear-backlog': number;
  '/email/security-review': number;
}

export type CountedView = keyof ViewCounts;

export const COUNTED_VIEWS: readonly CountedView[] = [
  '/email/needs-attention',
  '/email/reply-queue',
  '/email/actions-deadlines',
  '/email/waiting',
  '/email/quick-wins',
  '/email/clear-backlog',
  '/email/security-review',
];

export interface ViewCountInput {
  /** Records after this visit's deferrals, as the working views receive them. */
  records: readonly ThreadRecord[];
  drafts: readonly ReplyDraft[];
  accountId: string;
  accountLabel: string;
  accountType: AccountType;
  now: string;
  userDates: readonly UserDate[];
}

export function viewCounts(input: ViewCountInput): ViewCounts {
  const { records, drafts, accountId, accountLabel, accountType, now, userDates } = input;
  return {
    '/email/needs-attention': needsAttentionItems(records, accountLabel, now).length,
    '/email/reply-queue': replyQueueItems(records, drafts, now).length,
    '/email/actions-deadlines': datedItems(records, now, userDates).length,
    '/email/waiting': waitingItems(records, now).length,
    '/email/quick-wins': quickWinItems(records, now).length,
    // The number Clear Backlog itself prints as "N threads match this selection".
    '/email/clear-backlog': buildBacklogBatch(
      records,
      { ...DEFAULT_BACKLOG_SELECTION, accountId, accountType },
      now
    ).totalMatched,
    '/email/security-review': securityItems(records).length,
  };
}

export function isCountedView(path: EmailModulePath): path is CountedView {
  return (COUNTED_VIEWS as readonly string[]).includes(path);
}
