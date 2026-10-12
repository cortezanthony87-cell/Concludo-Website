/**
 * OAuth scopes, with the justification for each one.
 *
 * Every scope here is read-only. That is not a coincidence of the current
 * feature set; it is the design. The one write that the product will ever want,
 * saving an approved draft, is listed separately and is not requested at
 * connection time, so a person who never turns it on never grants it.
 *
 * `FORBIDDEN_SCOPES` lists the scopes this product must never request, with the
 * reason. It exists so a reviewer can check the request against a list of what
 * was deliberately left out, rather than only against what was included. Asking
 * "why is this scope here" is easy. Asking "what is missing that should be"
 * is the question that catches an over-broad grant, and it needs a list.
 */

export type ProviderId = 'microsoft365' | 'google';

export interface ScopeDefinition {
  /** The scope string exactly as the provider defines it. */
  scope: string;
  /** What it permits. */
  grants: string;
  /** Why the product needs it. One sentence, specific. */
  justification: string;
  /** The module capability it backs. */
  backs: string;
  /** True for a scope requested at connection; false for one requested later. */
  requestedAtConnection: boolean;
  readOnly: boolean;
}

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  /** The API the integration speaks to. */
  api: string;
  authorityUrl: string;
  tokenUrl: string;
  /** Scopes requested when a person connects an account. */
  baseScopes: readonly ScopeDefinition[];
  /** Scopes requested only when a person turns on an opt-in capability. */
  incrementalScopes: readonly ScopeDefinition[];
  /**
   * Whether the provider supports delta or history based incremental sync,
   * which decides how the sync stage is written.
   */
  incrementalSync: 'delta_token' | 'history_id';
  /** The documented rate limit shape, for the backoff policy. */
  rateLimit: string;
}

/* ------------------------------------------------------- Microsoft 365 */

const MICROSOFT_BASE: readonly ScopeDefinition[] = [
  {
    scope: 'offline_access',
    grants: 'A refresh token, so the connection survives without the person signing in repeatedly.',
    justification:
      'Analysis runs on a schedule. Without it, every synchronisation would need an interactive sign-in, which in practice means people leave the browser tab open and signed in instead.',
    backs: 'incremental synchronisation',
    requestedAtConnection: true,
    readOnly: true,
  },
  {
    scope: 'User.Read',
    grants: 'The signed-in user’s own profile: display name and primary address.',
    justification:
      'Deciding whether a thread is waiting on the person or on someone else requires knowing which addresses are theirs. This is the narrowest scope that provides it.',
    backs: 'read_profile',
    requestedAtConnection: true,
    readOnly: true,
  },
  {
    scope: 'Mail.Read',
    grants: 'Read access to the signed-in user’s own mail, including message bodies.',
    justification:
      'Reading the conversation is the product. Mail.ReadBasic was considered and rejected: it withholds message bodies, and an analysis of subject lines alone would be guesswork presented as a summary.',
    backs: 'read_messages, read_threads, read_attachment_metadata',
    requestedAtConnection: true,
    readOnly: true,
  },
  {
    scope: 'MailboxSettings.Read',
    grants: 'The mailbox time zone and working hours.',
    justification:
      'A deadline belongs to the person’s working day. Without the mailbox time zone, every date is interpreted in the server’s zone, which was a real defect in an earlier stage of this module.',
    backs: 'deadline interpretation',
    requestedAtConnection: true,
    readOnly: true,
  },
];

const MICROSOFT_INCREMENTAL: readonly ScopeDefinition[] = [
  {
    scope: 'Mail.ReadWrite',
    grants: 'Create and modify mail, including saving drafts.',
    justification:
      'Requested ONLY when a person turns on saving approved drafts to the mailbox, and not before. Microsoft Graph has no narrower scope for creating a draft; this is the smallest grant that achieves it, and it is why the capability is off by default. It does not permit sending, which needs Mail.Send.',
    backs: 'write_draft_to_mailbox',
    requestedAtConnection: false,
    readOnly: false,
  },
];

/* -------------------------------------------------------------- Google */

const GOOGLE_BASE: readonly ScopeDefinition[] = [
  {
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    grants: 'Read access to mail and settings. No modification of any kind.',
    justification:
      'Reading the conversation is the product. gmail.metadata was considered and rejected for the same reason as Mail.ReadBasic: without bodies there is nothing to analyse.',
    backs: 'read_messages, read_threads, read_labels, read_attachment_metadata',
    requestedAtConnection: true,
    readOnly: true,
  },
  {
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    grants: 'The signed-in account’s own email address.',
    justification:
      'Identifies which addresses belong to the person, which is what every "waiting on you" determination rests on.',
    backs: 'read_profile',
    requestedAtConnection: true,
    readOnly: true,
  },
];

const GOOGLE_INCREMENTAL: readonly ScopeDefinition[] = [
  {
    scope: 'https://www.googleapis.com/auth/gmail.compose',
    grants: 'Create, read, update and delete drafts. Also permits sending.',
    justification:
      'Requested ONLY when a person turns on saving approved drafts, and not before. This scope is broader than the product needs, because Google offers no draft-only scope that excludes sending. Concludo does not implement sending: there is no send method on the provider interface, and send_message is a denied capability. That is a code guarantee, not a scope guarantee, and it is written up as a known limitation rather than glossed over.',
    backs: 'write_draft_to_mailbox',
    requestedAtConnection: false,
    readOnly: false,
  },
];

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: 'microsoft365',
    label: 'Microsoft 365',
    api: 'Microsoft Graph',
    authorityUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    baseScopes: MICROSOFT_BASE,
    incrementalScopes: MICROSOFT_INCREMENTAL,
    incrementalSync: 'delta_token',
    rateLimit: 'Per-mailbox throttling with Retry-After on 429. Back off and honour the header.',
  },
  {
    id: 'google',
    label: 'Gmail and Google Workspace',
    api: 'Gmail API',
    authorityUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    baseScopes: GOOGLE_BASE,
    incrementalScopes: GOOGLE_INCREMENTAL,
    incrementalSync: 'history_id',
    rateLimit: 'Per-user quota units per second. 429 and 403 rateLimitExceeded both mean back off.',
  },
];

export function provider(id: ProviderId): ProviderDefinition {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown provider: ${id}`);
  return found;
}

/**
 * Scopes this product must never request.
 *
 * A reviewer checking an OAuth consent screen should be able to read this list
 * and confirm none of it appears. Several are the obvious ones. The less
 * obvious ones are the directory and drive scopes: they are the scopes a
 * mailbox integration acquires by accident, usually because one library asked
 * for a convenience bundle.
 */
export const FORBIDDEN_SCOPES: readonly { scope: string; why: string }[] = [
  { scope: 'Mail.Send', why: 'Sending is denied by design. There is no code path that sends.' },
  {
    scope: 'https://www.googleapis.com/auth/gmail.send',
    why: 'Sending is denied by design. There is no code path that sends.',
  },
  {
    scope: 'https://mail.google.com/',
    why: 'Full mailbox control including permanent deletion. Never necessary to read a conversation.',
  },
  {
    scope: 'Mail.ReadWrite.All',
    why: 'Reads every mailbox in the tenant, not the signed-in person’s. A tenant-wide grant for a per-person product.',
  },
  {
    scope: 'Mail.Read.All',
    why: 'Same, read-only. Still every mailbox in the organisation.',
  },
  {
    scope: 'https://www.googleapis.com/auth/gmail.settings.basic',
    why: 'Filters, forwarding and vacation responders. All three are denied capabilities.',
  },
  {
    scope: 'https://www.googleapis.com/auth/gmail.settings.sharing',
    why: 'Delegation and send-as. Would let the product act as another person.',
  },
  {
    scope: 'Directory.Read.All',
    why: 'The organisation’s whole directory. A mailbox integration has no need of it, and it is the scope most often acquired by accident.',
  },
  {
    scope: 'https://www.googleapis.com/auth/drive',
    why: 'File storage. Attachment processing, where enabled, works on the attachment in memory.',
  },
  {
    scope: 'Files.ReadWrite.All',
    why: 'The same file storage reach on the Microsoft side, with write access as well. Nothing in this module writes a file to anyone’s storage.',
  },
  {
    scope: 'Calendars.ReadWrite',
    why: 'Creating calendar events is a denied capability. A date read out of an email can be wrong.',
  },
  {
    scope: 'https://www.googleapis.com/auth/calendar',
    why: 'Writes to the person’s calendar. Creating an event from a date read out of an email is a denied capability, because a misread date becomes a meeting nobody attends.',
  },
  {
    scope: 'Contacts.Read',
    why: 'Not needed. Participants come from the messages themselves.',
  },
];

const FORBIDDEN_SET = new Set(FORBIDDEN_SCOPES.map((f) => f.scope.toLowerCase()));

/**
 * The guard that keeps the list above honest.
 *
 * Called before an authorisation URL is built. A scope list that drifts past
 * the declared set fails here rather than at a consent screen a person is about
 * to click through.
 */
export function assertScopesPermitted(id: ProviderId, requested: readonly string[]): void {
  const definition = provider(id);
  const declared = new Set(
    [...definition.baseScopes, ...definition.incrementalScopes].map((s) => s.scope.toLowerCase())
  );

  for (const scope of requested) {
    const normalised = scope.toLowerCase();
    if (FORBIDDEN_SET.has(normalised)) {
      const reason = FORBIDDEN_SCOPES.find((f) => f.scope.toLowerCase() === normalised)?.why ?? '';
      throw new Error(`Scope "${scope}" is on the forbidden list and must never be requested. ${reason}`);
    }
    if (!declared.has(normalised)) {
      throw new Error(
        `Scope "${scope}" is not declared for ${definition.label}. Every scope must be declared with its justification before it can be requested.`
      );
    }
  }
}

/** The scopes requested at connection. Nothing else is asked for up front. */
export function connectionScopes(id: ProviderId): string[] {
  return provider(id)
    .baseScopes.filter((s) => s.requestedAtConnection)
    .map((s) => s.scope);
}

/**
 * The extra scope needed for an opt-in capability, or null.
 *
 * Returning null rather than an empty array matters: a caller that gets null
 * knows no incremental consent is needed, rather than silently requesting
 * nothing and believing it succeeded.
 */
export function incrementalScopeFor(id: ProviderId, backs: string): string | null {
  const found = provider(id).incrementalScopes.find((s) => s.backs === backs);
  return found ? found.scope : null;
}
