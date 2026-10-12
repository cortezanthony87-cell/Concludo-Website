/**
 * A provider implementation over the synthetic dataset, with failure
 * injection.
 *
 * This is how every failure mode in the Stage 6 brief gets tested without a
 * real mailbox: expired permissions, rate limits, partial synchronisation,
 * duplicate events, outages, revoked credentials, missing attachment
 * permission and deleted source messages are all producible on demand.
 *
 * It is a test double, not a stub. It paginates, it expires cursors, it honours
 * folder selection and exclusions, and it refuses to return anything from an
 * account other than the one the token is for. A test double that cannot fail
 * tests nothing about failure handling.
 */
import { AccountDataset } from '../model';
import { getDataset } from '../data';
import {
  CapabilityGrants,
  assertCapability,
} from './capabilities';
import {
  FolderInfo,
  MailboxProfile,
  ProviderError,
  ProviderFailureKind,
  RawAttachmentMetadata,
  RawMessage,
  ReadOnlyMailProvider,
  SyncCursor,
  SyncPage,
  TokenHandle,
} from './types';
import { ProviderId } from './scopes';

/** What the mock should do next. Each entry fires once, in order. */
export interface InjectedFailure {
  kind: ProviderFailureKind;
  /** Which call it applies to. 'any' fires on the next call of any kind. */
  on: 'getProfile' | 'listFolders' | 'syncPage' | 'getAttachmentMetadata' | 'getAttachmentContents' | 'any';
  retryAfterSeconds?: number;
  message?: string;
}

export interface MockOptions {
  /** How many messages per sync page. Small, so pagination is exercised. */
  pageSize?: number;
  /** Failures to fire, consumed in order. */
  failures?: InjectedFailure[];
  /** When true, the next syncPage reports its cursor expired. */
  expireCursorOnce?: boolean;
  /** Message ids the provider reports as removed. */
  removedMessageIds?: string[];
}

export class MockMailProvider implements ReadOnlyMailProvider {
  readonly id: ProviderId;
  private readonly pageSize: number;
  private failures: InjectedFailure[];
  private expireCursorOnce: boolean;
  private readonly removedMessageIds: string[];
  /** Every call made, so tests can assert what was and was not requested. */
  readonly calls: { method: string; accountId: string; at: number }[] = [];

  constructor(id: ProviderId = 'microsoft365', options: MockOptions = {}) {
    this.id = id;
    this.pageSize = options.pageSize ?? 4;
    this.failures = [...(options.failures ?? [])];
    this.expireCursorOnce = options.expireCursorOnce ?? false;
    this.removedMessageIds = [...(options.removedMessageIds ?? [])];
  }

  /** Queues another failure after construction. */
  injectFailure(failure: InjectedFailure): void {
    this.failures.push(failure);
  }

  private maybeFail(method: string, accountId: string): void {
    const index = this.failures.findIndex((f) => f.on === method || f.on === 'any');
    if (index === -1) return;
    const [failure] = this.failures.splice(index, 1);
    throw new ProviderError({
      kind: failure.kind,
      accountId,
      message: failure.message ?? defaultMessage(failure.kind),
      retryAfterSeconds: failure.retryAfterSeconds ?? null,
    });
  }

  /**
   * Resolves the dataset for a token.
   *
   * This is the account boundary in the mock, and it is deliberately strict:
   * the dataset comes from the token's account id and from nowhere else. There
   * is no parameter by which a caller can ask this provider for a different
   * account's mail.
   */
  private datasetFor(token: TokenHandle): AccountDataset {
    const dataset = getDataset(token.accountId);
    if (!dataset) {
      throw new ProviderError({
        kind: 'not_found',
        accountId: token.accountId,
        message: `No mailbox for account ${token.accountId}.`,
        retryable: false,
      });
    }
    return dataset;
  }

  async getProfile(token: TokenHandle): Promise<MailboxProfile> {
    this.calls.push({ method: 'getProfile', accountId: token.accountId, at: Date.now() });
    this.maybeFail('getProfile', token.accountId);
    const dataset = this.datasetFor(token);
    return {
      accountId: dataset.account.id,
      primaryAddress: dataset.account.address,
      displayName: dataset.account.label,
      ownedAddresses: dataset.account.ownedAddresses,
      timeZone: dataset.account.timeZone,
    };
  }

  async listFolders(token: TokenHandle): Promise<readonly FolderInfo[]> {
    this.calls.push({ method: 'listFolders', accountId: token.accountId, at: Date.now() });
    this.maybeFail('listFolders', token.accountId);
    const dataset = this.datasetFor(token);
    const names = [...new Set(dataset.threads.map((t) => t.folder))];
    const always = ['inbox', 'sent', 'archive', 'spam', 'bin'];
    return [...new Set([...names, ...always])].map((name) => ({
      id: name,
      name,
      // Spam, bin and sent are excluded by default. Analysing a person's bin
      // and telling them about it is a good way to be uninstalled.
      excludedByDefault: ['spam', 'bin', 'sent', 'archive'].includes(name),
    }));
  }

  async syncPage(
    token: TokenHandle,
    cursor: SyncCursor,
    options: { folders: readonly string[]; pageToken?: string | null }
  ): Promise<SyncPage> {
    this.calls.push({ method: 'syncPage', accountId: token.accountId, at: Date.now() });
    this.maybeFail('syncPage', token.accountId);

    if (cursor.accountId !== token.accountId) {
      throw new ProviderError({
        kind: 'not_found',
        accountId: token.accountId,
        message: 'The cursor belongs to a different account. Refusing to synchronise across accounts.',
        retryable: false,
      });
    }

    const dataset = this.datasetFor(token);

    if (this.expireCursorOnce) {
      this.expireCursorOnce = false;
      return {
        messages: [],
        removedMessageIds: [],
        nextPageToken: null,
        cursor: { ...cursor, value: null, updatedAt: new Date().toISOString() },
        cursorExpired: true,
      };
    }

    const selected = new Set(options.folders);
    const eligible = dataset.messages
      .filter((m) => {
        const thread = dataset.threads.find((t) => t.id === m.threadId);
        return thread ? selected.has(thread.folder) : false;
      })
      .slice()
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    const start = options.pageToken ? Number(options.pageToken) : 0;
    const slice = eligible.slice(start, start + this.pageSize);
    const next = start + this.pageSize < eligible.length ? String(start + this.pageSize) : null;

    return {
      messages: slice.map((m) => toRaw(m, dataset)),
      removedMessageIds: next === null ? this.removedMessageIds : [],
      nextPageToken: next,
      cursor: {
        ...cursor,
        value: `cursor-${eligible.length}-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      },
      cursorExpired: false,
    };
  }

  async getAttachmentMetadata(
    token: TokenHandle,
    providerMessageId: string
  ): Promise<readonly RawAttachmentMetadata[]> {
    this.calls.push({ method: 'getAttachmentMetadata', accountId: token.accountId, at: Date.now() });
    this.maybeFail('getAttachmentMetadata', token.accountId);

    const dataset = this.datasetFor(token);
    const message = dataset.messages.find((m) => m.id === providerMessageId);
    if (!message) {
      throw new ProviderError({
        kind: 'not_found',
        accountId: token.accountId,
        message: `Message ${providerMessageId} no longer exists. It may have been deleted at the provider.`,
        retryable: false,
      });
    }
    return message.attachmentIds.map((id) => {
      const a = dataset.attachments.find((x) => x.id === id);
      return {
        providerAttachmentId: id,
        fileName: a?.fileName ?? 'unknown',
        mimeType: a?.mimeType ?? 'application/octet-stream',
        sizeBytes: a?.sizeBytes ?? 0,
        isInline: false,
      };
    });
  }

  async getAttachmentContents(
    token: TokenHandle,
    grants: CapabilityGrants,
    providerMessageId: string,
    providerAttachmentId: string,
    maxBytes: number
  ): Promise<{ bytes: Uint8Array; truncated: boolean }> {
    this.calls.push({ method: 'getAttachmentContents', accountId: token.accountId, at: Date.now() });

    // The capability gate runs BEFORE the failure injection and before any
    // lookup, so a test proving attachment reads are blocked proves it about
    // the first line of the method rather than about an error that happened to
    // arrive first.
    assertCapability('process_attachment_contents', grants);
    this.maybeFail('getAttachmentContents', token.accountId);

    const dataset = this.datasetFor(token);
    const attachment = dataset.attachments.find((a) => a.id === providerAttachmentId);
    if (!attachment) {
      throw new ProviderError({
        kind: 'not_found',
        accountId: token.accountId,
        message: `Attachment ${providerAttachmentId} not found on ${providerMessageId}.`,
        retryable: false,
      });
    }

    const size = attachment.sizeBytes ?? 0;
    const length = Math.min(size, maxBytes);
    return { bytes: new Uint8Array(length), truncated: size > maxBytes };
  }
}

function defaultMessage(kind: ProviderFailureKind): string {
  switch (kind) {
    case 'expired_permission':
      return 'The permission granted for this mailbox has expired. The person needs to reconnect it.';
    case 'revoked_credential':
      return 'Access to this mailbox was revoked. Stop synchronising and delete the stored token.';
    case 'rate_limited':
      return 'The provider is rate limiting this mailbox. Back off and retry after the stated delay.';
    case 'provider_outage':
      return 'The provider is unavailable. This is temporary and the sync resumes from the stored cursor.';
    case 'partial_sync':
      return 'The provider returned part of the page and then stopped. The stored cursor is unchanged.';
    case 'not_found':
      return 'The item no longer exists at the provider.';
    case 'attachment_permission_missing':
      return 'Reading attachment contents is not enabled for this account.';
    case 'network':
      return 'The request did not reach the provider.';
  }
}

/** Projects a synthetic message into the shape a provider would return. */
function toRaw(
  message: AccountDataset['messages'][number],
  dataset: AccountDataset
): RawMessage {
  const thread = dataset.threads.find((t) => t.id === message.threadId);
  const from = message.participants.find((p) => p.role === 'from');

  return {
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    internalDate: message.sentAt,
    subject: message.subject,
    from: { address: from?.address ?? '', displayName: from?.displayName ?? '' },
    to: message.participants.filter((p) => p.role === 'to').map((p) => ({ address: p.address, displayName: p.displayName })),
    cc: message.participants.filter((p) => p.role === 'cc').map((p) => ({ address: p.address, displayName: p.displayName })),
    bcc: [],
    ...(message.replyToAddress
      ? { replyTo: { address: message.replyToAddress, displayName: '' } }
      : {}),
    // The quoted history is appended back on, because that is how it arrives
    // from a provider. Separating it again is the job of the reduction stage,
    // and a pipeline stage that is handed its own output has not been tested.
    body: message.quotedHistory ? `${message.body}\n\n${message.quotedHistory}` : message.body,
    bodyFormat: 'text',
    isRead: message.isRead,
    folder: thread?.folder ?? 'inbox',
    labels: thread?.labels ?? [],
    attachments: message.attachmentIds.map((id) => {
      const a = dataset.attachments.find((x) => x.id === id);
      return {
        providerAttachmentId: id,
        fileName: a?.fileName ?? 'unknown',
        mimeType: a?.mimeType ?? 'application/octet-stream',
        sizeBytes: a?.sizeBytes ?? 0,
        isInline: false,
      };
    }),
    headers: {
      'message-id': `<${message.id}@synthetic.example>`,
      ...(message.replyToAddress ? { 'reply-to': message.replyToAddress } : {}),
    },
  };
}

/** A token handle for the mock. Carries no token, because none exists. */
export function mockToken(accountId: string, provider: ProviderId, scopes: string[]): TokenHandle {
  return {
    handle: `mock-handle-${accountId}`,
    accountId,
    provider,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    grantedScopes: scopes,
  };
}

export function freshCursor(accountId: string, provider: ProviderId): SyncCursor {
  return {
    accountId,
    provider,
    kind: provider === 'google' ? 'history_id' : 'delta_token',
    value: null,
    updatedAt: new Date().toISOString(),
  };
}
