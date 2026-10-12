/**
 * The mailbox provider interface.
 *
 * Read this looking for what is NOT here. There is no send, no reply, no
 * forward, no delete, no trash, no archive, no label modification, no mark as
 * read, no filter creation and no vacation responder. Their absence is the
 * strongest guarantee in the integration, because it is the only one that
 * cannot be undone at runtime: calling a method that does not exist on an
 * interface is a compile error, not a permission failure.
 *
 * The one write the product will ever want, saving an approved draft, is on a
 * SEPARATE interface that a provider implementation may or may not have, and
 * which is only reachable when the person has turned that capability on. It
 * cannot send what it saves.
 */
import { CapabilityGrants } from './capabilities';
import { ProviderId } from './scopes';

/* ----------------------------------------------------------------- tokens */

/**
 * A token reference, never a token.
 *
 * The handle is an opaque pointer into the token store. The access and refresh
 * tokens themselves never appear in this type, never appear in a log line, and
 * never cross a function boundary outside the store. Several of the worst
 * mailbox-integration incidents on record are a refresh token in an error
 * message, and the only reliable fix is for the value not to be reachable from
 * the code that writes error messages.
 */
export interface TokenHandle {
  /** Opaque. Means nothing outside the token store. */
  readonly handle: string;
  readonly accountId: string;
  readonly provider: ProviderId;
  /** When the access token expires. Used to refresh before a call, not after. */
  readonly expiresAt: string;
  /** The scopes actually granted, which may be fewer than those requested. */
  readonly grantedScopes: readonly string[];
}

/* ----------------------------------------------------------- raw messages */

/** A message as the provider returns it, before normalisation. */
export interface RawMessage {
  providerMessageId: string;
  providerThreadId: string;
  internalDate: string;
  subject: string;
  from: { address: string; displayName: string };
  to: readonly { address: string; displayName: string }[];
  cc: readonly { address: string; displayName: string }[];
  bcc: readonly { address: string; displayName: string }[];
  replyTo?: { address: string; displayName: string };
  /** Plain text where the provider offers it, otherwise HTML to be reduced. */
  body: string;
  bodyFormat: 'text' | 'html';
  isRead: boolean;
  folder: string;
  labels: readonly string[];
  /** Metadata only. Contents are fetched separately and only when enabled. */
  attachments: readonly RawAttachmentMetadata[];
  /** Provider headers kept for threading and security screening. */
  headers: Readonly<Record<string, string>>;
}

export interface RawAttachmentMetadata {
  providerAttachmentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isInline: boolean;
}

export interface FolderInfo {
  id: string;
  name: string;
  /** True for folders the product excludes by default, such as Spam and Bin. */
  excludedByDefault: boolean;
}

export interface MailboxProfile {
  accountId: string;
  primaryAddress: string;
  displayName: string;
  /** Every address that is the person's own, including aliases. */
  ownedAddresses: readonly string[];
  timeZone: string;
}

/* ----------------------------------------------------- incremental sync */

/**
 * The cursor for incremental synchronisation.
 *
 * Microsoft Graph gives a delta token, Gmail a history id. Both are opaque and
 * both can expire, which is a normal event rather than an error: the recovery
 * is a full resynchronisation, and the shape below makes the caller handle it.
 */
export interface SyncCursor {
  accountId: string;
  provider: ProviderId;
  kind: 'delta_token' | 'history_id';
  value: string | null;
  updatedAt: string;
}

export interface SyncPage {
  messages: readonly RawMessage[];
  /** Message ids the provider reports as removed since the cursor. */
  removedMessageIds: readonly string[];
  /** Null when this is the last page. */
  nextPageToken: string | null;
  /** The cursor to store once every page has been consumed. */
  cursor: SyncCursor;
  /**
   * True when the provider reported the cursor as expired and the caller must
   * fall back to a full synchronisation.
   */
  cursorExpired: boolean;
}

/* ------------------------------------------------------------- failures */

export type ProviderFailureKind =
  | 'expired_permission'
  | 'revoked_credential'
  | 'rate_limited'
  | 'provider_outage'
  | 'partial_sync'
  | 'not_found'
  | 'attachment_permission_missing'
  | 'network';

export class ProviderError extends Error {
  readonly kind: ProviderFailureKind;
  /** Seconds to wait before retrying, where the provider says. */
  readonly retryAfterSeconds: number | null;
  /** True where retrying the same request may succeed. */
  readonly retryable: boolean;
  readonly accountId: string;

  constructor(options: {
    kind: ProviderFailureKind;
    message: string;
    accountId: string;
    retryAfterSeconds?: number | null;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = 'ProviderError';
    this.kind = options.kind;
    this.accountId = options.accountId;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.retryable =
      options.retryable ?? ['rate_limited', 'provider_outage', 'network', 'partial_sync'].includes(options.kind);
  }
}

/* ------------------------------------------------------- the interface */

export interface ReadOnlyMailProvider {
  readonly id: ProviderId;

  /** The person's own identity on this account. */
  getProfile(token: TokenHandle): Promise<MailboxProfile>;

  /** Folders and labels, so a person can choose which are analysed. */
  listFolders(token: TokenHandle): Promise<readonly FolderInfo[]>;

  /** One page of changes since the cursor. */
  syncPage(
    token: TokenHandle,
    cursor: SyncCursor,
    options: { folders: readonly string[]; pageToken?: string | null }
  ): Promise<SyncPage>;

  /** Metadata only. Contents need the opt-in capability and a separate call. */
  getAttachmentMetadata(
    token: TokenHandle,
    providerMessageId: string
  ): Promise<readonly RawAttachmentMetadata[]>;

  /**
   * Attachment contents. Present on the interface because reading one is a
   * legitimate opt-in feature; guarded because it is the highest-risk read in
   * the integration.
   *
   * Implementations must call `assertCapability('process_attachment_contents')`
   * before doing anything, and must honour the byte limit rather than
   * streaming an arbitrary file into memory.
   */
  getAttachmentContents(
    token: TokenHandle,
    grants: CapabilityGrants,
    providerMessageId: string,
    providerAttachmentId: string,
    maxBytes: number
  ): Promise<{ bytes: Uint8Array; truncated: boolean }>;
}

/**
 * The only write, on its own interface.
 *
 * A provider implementation may omit this entirely, and the module works
 * without it. Where it exists, `saveDraft` takes the approval record because
 * the approval is the authorisation: without one, there is nothing to check the
 * content against, and the implementation must refuse.
 *
 * There is no `send`, and no parameter that makes `saveDraft` send.
 */
export interface DraftWritingMailProvider {
  saveDraft(
    token: TokenHandle,
    grants: CapabilityGrants,
    draft: {
      threadId: string;
      subject: string;
      body: string;
      to: readonly string[];
      cc: readonly string[];
      bcc: readonly string[];
    },
    approval: { fingerprint: string; approvedAt: string }
  ): Promise<{ providerDraftId: string }>;
}

/** Narrowing helper, so a caller must check before reaching for the write. */
export function canWriteDrafts(
  p: ReadOnlyMailProvider
): p is ReadOnlyMailProvider & DraftWritingMailProvider {
  return typeof (p as Partial<DraftWritingMailProvider>).saveDraft === 'function';
}
