/**
 * What the Email Command Centre is permitted to do with a mailbox.
 *
 * This is the enforcement point for every "disabled" item in the Stage 6
 * brief. The word "disabled" is doing a lot of work in a specification and
 * almost none in a codebase: a disabled feature is one flag away from being an
 * enabled feature, and flags get flipped by accident.
 *
 * So nothing here is disabled. The destructive operations are DENIED, the
 * denial is checked at the only place a provider call can be made, and there is
 * no implementation behind any of them to call even if a check were bypassed.
 *
 * Three layers, in order of how much they are worth:
 *
 *   1. The provider interface has no send, delete, archive, forward or
 *      unsubscribe method. Calling one is a compile error, which is the only
 *      guarantee in this file that cannot be worked around at runtime.
 *   2. Every capability is declared here with its state. A denied capability
 *      cannot be granted by configuration; `grantable` is false and nothing
 *      reads a setting to change it.
 *   3. `assertCapability` throws on anything not allowed, and the provider
 *      wrapper calls it before every request.
 */

export type CapabilityState =
  /** Always available. Read-only, and the module cannot work without it. */
  | 'allowed'
  /** Off by default. A person may turn it on, and it stays per account. */
  | 'opt_in'
  /** Not available, and not made available by any setting. */
  | 'denied';

export type CapabilityKey =
  // Reading
  | 'read_messages'
  | 'read_threads'
  | 'read_labels'
  | 'read_profile'
  | 'read_attachment_metadata'
  // Opt in
  | 'process_attachment_contents'
  | 'write_draft_to_mailbox'
  | 'combined_account_view'
  // Denied
  | 'send_message'
  | 'reply'
  | 'forward'
  | 'delete_message'
  | 'trash_message'
  | 'archive_message'
  | 'modify_labels'
  | 'mark_read'
  | 'mark_spam'
  | 'unsubscribe'
  | 'create_filter'
  | 'set_vacation'
  | 'create_external_task'
  | 'create_calendar_event'
  | 'download_attachment_to_disk'
  | 'execute_attachment'
  | 'read_other_account';

export interface Capability {
  key: CapabilityKey;
  state: CapabilityState;
  /** What it would do, in plain words. */
  description: string;
  /**
   * Why it is in this state. For a denial this is the reasoning a reviewer
   * should be able to disagree with, not a restatement of the state.
   */
  rationale: string;
  /**
   * False for every denied capability. Nothing in the codebase reads a setting
   * that could make one of these true.
   */
  grantable: boolean;
}

export const CAPABILITIES: readonly Capability[] = [
  /* ------------------------------------------------------------- allowed */
  {
    key: 'read_messages',
    state: 'allowed',
    description: 'Read message headers and bodies from selected folders.',
    rationale: 'Analysis of a conversation is the product. Nothing works without it.',
    grantable: true,
  },
  {
    key: 'read_threads',
    state: 'allowed',
    description: 'Read thread and conversation structure.',
    rationale: 'The unit of work is the thread, not the message.',
    grantable: true,
  },
  {
    key: 'read_labels',
    state: 'allowed',
    description: 'List folders and labels.',
    rationale: 'Needed so a person can choose which folders are analysed and which are excluded.',
    grantable: true,
  },
  {
    key: 'read_profile',
    state: 'allowed',
    description: 'Read the account holder’s own address and display name.',
    rationale:
      'Deciding who owes what depends on knowing which addresses are the person’s own. Without it, every "waiting on you" is a guess.',
    grantable: true,
  },
  {
    key: 'read_attachment_metadata',
    state: 'allowed',
    description: 'Read attachment names, sizes and types. Not their contents.',
    rationale:
      'A thread that says "the signed variation is attached" means something different when nothing is attached. The filename answers that; the contents are not needed for it.',
    grantable: true,
  },

  /* -------------------------------------------------------------- opt in */
  {
    key: 'process_attachment_contents',
    state: 'opt_in',
    description: 'Open and read the contents of attachments.',
    rationale:
      'Off by default because an attachment is the highest-risk content in a mailbox, and because a person who connected an inbox has not thereby agreed to have every document in it read. Turning it on is per account and reversible.',
    grantable: true,
  },
  {
    key: 'write_draft_to_mailbox',
    state: 'opt_in',
    description: 'Save an approved reply into the mailbox as a draft.',
    rationale:
      'Off by default, and even when on it needs a per-draft approval of that exact text. It writes a draft; it cannot send one.',
    grantable: true,
  },
  {
    key: 'combined_account_view',
    state: 'opt_in',
    description: 'Show work and personal accounts in one list.',
    rationale:
      'Off by default. The separation is the safety property; combining is a deliberate choice a person makes, not a default they discover.',
    grantable: true,
  },

  /* -------------------------------------------------------------- denied */
  {
    key: 'send_message',
    state: 'denied',
    description: 'Send an email.',
    rationale:
      'The product proposes and a person disposes. A system that can send under a person’s name is a system that can be made to send under a person’s name, by a message in the inbox it is reading.',
    grantable: false,
  },
  {
    key: 'reply',
    state: 'denied',
    description: 'Reply to a thread.',
    rationale:
      'A reply is a send, and it is the send a person is most likely to assume was reviewed. Drafts are written for a person to read, correct and send themselves, in their own mail client.',
    grantable: false,
  },
  {
    key: 'forward',
    state: 'denied',
    description: 'Forward a message to another address.',
    rationale:
      'Forwarding is the cheapest exfiltration path in any mailbox integration, and it is what a prompt-injection attempt asks for first.',
    grantable: false,
  },
  {
    key: 'delete_message',
    state: 'denied',
    description: 'Delete a message permanently.',
    rationale: 'Irreversible, and never necessary to analyse a conversation.',
    grantable: false,
  },
  {
    key: 'trash_message',
    state: 'denied',
    description: 'Move a message to the bin.',
    rationale: 'Reversible for thirty days and then not. Still never necessary for analysis.',
    grantable: false,
  },
  {
    key: 'archive_message',
    state: 'denied',
    description: 'Archive a message out of the inbox.',
    rationale:
      'A thread a person cannot find is a thread the product has taken from them. Deferring inside Concludo does not touch the mailbox.',
    grantable: false,
  },
  {
    key: 'modify_labels',
    state: 'denied',
    description: 'Add or remove labels and folders.',
    rationale: 'Changes how the person’s own filters and rules behave, in ways they did not ask for.',
    grantable: false,
  },
  {
    key: 'mark_read',
    state: 'denied',
    description: 'Mark a message as read or unread.',
    rationale:
      'Read state is how a person tracks their own inbox. Analysis must not consume it, and must not look like the person has already seen something.',
    grantable: false,
  },
  {
    key: 'mark_spam',
    state: 'denied',
    description: 'Mark a message as spam.',
    rationale:
      'Trains the provider’s filters against a sender on evidence the person never saw. Security Review advises; it does not act.',
    grantable: false,
  },
  {
    key: 'unsubscribe',
    state: 'denied',
    description: 'Follow an unsubscribe link or send an unsubscribe request.',
    rationale:
      'Following a link in an untrusted message is the thing this product most needs not to do. An unsubscribe link is also a reliable way to confirm an address is live.',
    grantable: false,
  },
  {
    key: 'create_filter',
    state: 'denied',
    description: 'Create a server-side rule or filter.',
    rationale: 'Persists after Concludo is disconnected, and silently changes where a person’s mail goes.',
    grantable: false,
  },
  {
    key: 'set_vacation',
    state: 'denied',
    description: 'Set an automatic reply.',
    rationale: 'An automatic reply is a send, on a schedule, with nobody reading it first.',
    grantable: false,
  },
  {
    key: 'create_external_task',
    state: 'denied',
    description: 'Create a task in an external system.',
    rationale:
      'Out of scope for a mailbox integration, and it would put Concludo’s reading of a thread into a system other people act on. Task and reminder controls produce text to copy.',
    grantable: false,
  },
  {
    key: 'create_calendar_event',
    state: 'denied',
    description: 'Create a calendar event.',
    rationale:
      'A date extracted from an email can be wrong, and a wrong calendar entry is acted on by other people before anybody checks it.',
    grantable: false,
  },
  {
    key: 'download_attachment_to_disk',
    state: 'denied',
    description: 'Write an attachment to the server filesystem.',
    rationale:
      'Attachment processing, where enabled, happens in memory with a size and type limit. Nothing from a mailbox reaches a disk path.',
    grantable: false,
  },
  {
    key: 'execute_attachment',
    state: 'denied',
    description: 'Execute or evaluate anything taken from a message or attachment.',
    rationale: 'There is no interpreter, no eval and no shell anywhere in this module.',
    grantable: false,
  },
  {
    key: 'read_other_account',
    state: 'denied',
    description: 'Read a different connected account while working on this one.',
    rationale:
      'The account boundary is the strongest promise in the product. A cross-account read is not a feature with a risk; it is the failure itself.',
    grantable: false,
  },
];

const BY_KEY: Readonly<Record<CapabilityKey, Capability>> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.key, c])
) as Record<CapabilityKey, Capability>;

export function capability(key: CapabilityKey): Capability {
  const found = BY_KEY[key];
  if (!found) throw new Error(`Unknown capability: ${key}`);
  return found;
}

/** Per-account opt-ins. Only `opt_in` capabilities can appear here. */
export interface CapabilityGrants {
  accountId: string;
  granted: readonly CapabilityKey[];
  /** When each was granted, for the audit trail. */
  grantedAt: Readonly<Record<string, string>>;
}

export function noGrants(accountId: string): CapabilityGrants {
  return { accountId, granted: [], grantedAt: {} };
}

/**
 * Grants an opt-in capability.
 *
 * Throws on a denied capability rather than ignoring it. A silent no-op here
 * would let a caller believe sending had been enabled, and the first sign
 * otherwise would be a support ticket.
 */
export function grant(
  grants: CapabilityGrants,
  key: CapabilityKey,
  at: string
): CapabilityGrants {
  const c = capability(key);
  if (!c.grantable) {
    throw new Error(
      `Capability "${key}" cannot be granted. It is denied by design: ${c.rationale}`
    );
  }
  if (c.state === 'allowed') return grants;
  if (grants.granted.includes(key)) return grants;
  return {
    ...grants,
    granted: [...grants.granted, key],
    grantedAt: { ...grants.grantedAt, [key]: at },
  };
}

export function revoke(grants: CapabilityGrants, key: CapabilityKey): CapabilityGrants {
  const grantedAt = { ...grants.grantedAt };
  delete grantedAt[key];
  return { ...grants, granted: grants.granted.filter((k) => k !== key), grantedAt };
}

export function isAllowed(key: CapabilityKey, grants: CapabilityGrants): boolean {
  const c = capability(key);
  if (c.state === 'denied') return false;
  if (c.state === 'allowed') return true;
  return grants.granted.includes(key);
}

export class CapabilityError extends Error {
  readonly capability: CapabilityKey;
  readonly state: CapabilityState;

  constructor(key: CapabilityKey, state: CapabilityState, message: string) {
    super(message);
    this.name = 'CapabilityError';
    this.capability = key;
    this.state = state;
  }
}

/**
 * The gate. Called before every provider request.
 *
 * It throws rather than returning false, so a caller that forgets to check the
 * return value still fails closed. A permission check whose result can be
 * ignored is a permission check that will be ignored.
 */
export function assertCapability(key: CapabilityKey, grants: CapabilityGrants): void {
  const c = capability(key);
  if (c.state === 'denied') {
    throw new CapabilityError(
      key,
      'denied',
      `"${key}" is denied by design and cannot be enabled. ${c.rationale}`
    );
  }
  if (c.state === 'opt_in' && !grants.granted.includes(key)) {
    throw new CapabilityError(
      key,
      'opt_in',
      `"${key}" is off for this account. It can be turned on per account, and until it is, this request does not happen.`
    );
  }
}

/** Everything denied, for the settings screen and the security checklist. */
export const DENIED_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (c) => c.state === 'denied'
);

export const OPT_IN_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (c) => c.state === 'opt_in'
);
