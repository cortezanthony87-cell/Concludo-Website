/**
 * Incremental synchronisation, idempotency and failure recovery.
 *
 * The design rule throughout: a synchronisation that fails halfway must leave
 * the stored cursor where it was. Advancing a cursor past messages that were
 * never processed loses them silently and forever, and nobody notices until a
 * person asks why a thread never appeared. Every path below either completes a
 * page and advances, or fails and does not.
 */
import {
  ProviderError,
  ReadOnlyMailProvider,
  RawMessage,
  SyncCursor,
  TokenHandle,
} from '../providers/types';

/* ------------------------------------------------------------ idempotency */

/**
 * Seen event and message keys.
 *
 * Providers redeliver webhooks, and a retried page returns messages already
 * processed. Both are normal. The key is the provider's own id plus the
 * account, so the same message id on two accounts is two different things,
 * which it is.
 */
export class IdempotencyLedger {
  private readonly seen = new Set<string>();
  /** Bounded, so a long-running process does not grow without limit. */
  private readonly order: string[] = [];
  private readonly limit: number;

  constructor(limit = 50_000) {
    this.limit = limit;
  }

  private key(accountId: string, id: string): string {
    return `${accountId}::${id}`;
  }

  /** True the first time, false every time after. */
  claim(accountId: string, id: string): boolean {
    const key = this.key(accountId, id);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.order.push(key);
    if (this.order.length > this.limit) {
      const oldest = this.order.shift();
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }

  has(accountId: string, id: string): boolean {
    return this.seen.has(this.key(accountId, id));
  }

  get size(): number {
    return this.seen.size;
  }
}

/* ------------------------------------------------------------- backoff */

export interface BackoffPolicy {
  attempts: number;
  baseMs: number;
  maxMs: number;
  /** Random fraction added to each wait, so retries do not align. */
  jitter: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = {
  attempts: 5,
  baseMs: 1000,
  maxMs: 60_000,
  jitter: 0.2,
};

/**
 * How long to wait before attempt `n`.
 *
 * The provider's own Retry-After always wins. Guessing a shorter wait than the
 * provider asked for is how an account gets throttled harder, and guessing a
 * longer one wastes a window the provider has already reopened.
 */
export function backoffMs(
  attempt: number,
  policy: BackoffPolicy,
  retryAfterSeconds: number | null,
  random: () => number = Math.random
): number {
  if (retryAfterSeconds !== null) return retryAfterSeconds * 1000;
  const exponential = Math.min(policy.maxMs, policy.baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (1 + random() * policy.jitter));
}

/* -------------------------------------------------------------- the run */

export type SyncOutcome =
  | 'completed'
  | 'completed_with_resync'
  | 'rate_limited'
  | 'permission_expired'
  | 'credential_revoked'
  | 'provider_unavailable'
  | 'partial';

export interface SyncResult {
  accountId: string;
  outcome: SyncOutcome;
  /** New messages, already deduplicated. */
  messages: RawMessage[];
  removedMessageIds: string[];
  /** The cursor to store. Unchanged from the input on any failure. */
  cursor: SyncCursor;
  pagesFetched: number;
  duplicatesSkipped: number;
  /** Set on a failure. Written for a person, never carrying a token. */
  failure: { kind: string; message: string; retryAfterSeconds: number | null } | null;
  /** True when the cursor expired and a full resynchronisation was needed. */
  resynchronised: boolean;
}

export interface SyncOptions {
  folders: readonly string[];
  ledger: IdempotencyLedger;
  /** Safety valve. A runaway page loop is a provider bug, not a reason to spin. */
  maxPages?: number;
  backoff?: BackoffPolicy;
  /** Injected so tests do not wait. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/**
 * Runs one synchronisation for one account.
 *
 * On a rate limit it backs off and retries the same page. On an expired
 * permission or a revoked credential it stops immediately and does not retry,
 * because retrying a revoked credential is how an account gets locked. On an
 * expired cursor it starts again from nothing, which is the documented
 * recovery for both providers.
 */
export async function runSync(
  provider: ReadOnlyMailProvider,
  token: TokenHandle,
  startCursor: SyncCursor,
  options: SyncOptions
): Promise<SyncResult> {
  const maxPages = options.maxPages ?? 50;
  const policy = options.backoff ?? DEFAULT_BACKOFF;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = options.random ?? Math.random;

  const result: SyncResult = {
    accountId: token.accountId,
    outcome: 'completed',
    messages: [],
    removedMessageIds: [],
    cursor: startCursor,
    pagesFetched: 0,
    duplicatesSkipped: 0,
    failure: null,
    resynchronised: false,
  };

  // The account boundary, checked once and cheaply. A cursor from another
  // account reaching this function is a bug worth failing loudly on rather
  // than quietly correcting.
  if (startCursor.accountId !== token.accountId) {
    throw new Error(
      `Refusing to synchronise: the cursor is for ${startCursor.accountId} and the token is for ${token.accountId}.`
    );
  }

  let cursor = startCursor;
  let pageToken: string | null = null;
  let attempt = 0;

  for (let page = 0; page < maxPages; page += 1) {
    try {
      const response = await provider.syncPage(token, cursor, {
        folders: options.folders,
        pageToken,
      });

      if (response.cursorExpired) {
        // Documented recovery for both providers. Nothing collected so far is
        // kept, because a half-delta plus a full sync is a mess nobody can
        // reason about afterwards.
        result.resynchronised = true;
        result.messages = [];
        result.removedMessageIds = [];
        result.duplicatesSkipped = 0;
        cursor = { ...startCursor, value: null };
        pageToken = null;
        attempt = 0;
        continue;
      }

      attempt = 0;
      result.pagesFetched += 1;

      for (const message of response.messages) {
        if (!options.ledger.claim(token.accountId, message.providerMessageId)) {
          result.duplicatesSkipped += 1;
          continue;
        }
        result.messages.push(message);
      }
      result.removedMessageIds.push(...response.removedMessageIds);

      cursor = response.cursor;
      pageToken = response.nextPageToken;

      if (pageToken === null) {
        // Only now is the cursor advanced, and only because every page was
        // consumed. This is the line that makes a failed sync safe.
        result.cursor = cursor;
        result.outcome = result.resynchronised ? 'completed_with_resync' : 'completed';
        return result;
      }
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;

      result.failure = {
        kind: error.kind,
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      };

      if (error.kind === 'expired_permission') {
        result.outcome = 'permission_expired';
        return result;
      }
      if (error.kind === 'revoked_credential') {
        result.outcome = 'credential_revoked';
        return result;
      }
      if (!error.retryable) {
        result.outcome = 'partial';
        return result;
      }

      attempt += 1;
      if (attempt >= policy.attempts) {
        result.outcome =
          error.kind === 'rate_limited'
            ? 'rate_limited'
            : error.kind === 'provider_outage'
              ? 'provider_unavailable'
              : 'partial';
        return result;
      }

      await sleep(backoffMs(attempt, policy, error.retryAfterSeconds, random));
    }
  }

  // Ran out of pages. The cursor stays where it was, so the next run picks up
  // from the same place rather than skipping what was not fetched.
  result.outcome = 'partial';
  result.failure = {
    kind: 'partial_sync',
    message: `Stopped after ${maxPages} pages. The cursor is unchanged, so nothing is skipped on the next run.`,
    retryAfterSeconds: null,
  };
  return result;
}

/* ---------------------------------------------------------- webhook dedupe */

export interface ChangeNotification {
  /** The provider's own event id. */
  eventId: string;
  accountId: string;
  /** Provider subscription or channel id, checked against what we registered. */
  subscriptionId: string;
  receivedAt: string;
}

export interface NotificationDecision {
  accept: boolean;
  reason: string;
}

/**
 * Whether to act on a change notification.
 *
 * Providers deliver duplicates routinely and both document it. A notification
 * is also the one place an outside party can poke the system, so the
 * subscription id is checked against what was registered: an event for a
 * subscription we do not hold is not ours to act on.
 */
export function acceptNotification(
  notification: ChangeNotification,
  knownSubscriptions: ReadonlyMap<string, string>,
  ledger: IdempotencyLedger
): NotificationDecision {
  const owner = knownSubscriptions.get(notification.subscriptionId);

  if (!owner) {
    return {
      accept: false,
      reason: 'The subscription is not one this system registered. Ignored.',
    };
  }
  if (owner !== notification.accountId) {
    return {
      accept: false,
      reason:
        'The subscription belongs to a different account from the one the notification names. Ignored, and worth investigating.',
    };
  }
  if (!ledger.claim(notification.accountId, `evt:${notification.eventId}`)) {
    return { accept: false, reason: 'Already handled. Providers redeliver, and that is expected.' };
  }
  return { accept: true, reason: 'First delivery for a known subscription on the matching account.' };
}
