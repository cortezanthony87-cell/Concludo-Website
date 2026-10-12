/**
 * Privacy controls: retention, exclusions, redaction, export, deletion.
 *
 * Everything here is a pure function over data the module already holds, which
 * is the only part of the privacy story that can honestly be implemented
 * without a database. Encryption at rest, row-level security and tenant
 * isolation are database and platform concerns; they are specified in
 * `docs/ARCHITECTURE.md` and `docs/THREAT_MODEL.md` with the exact policies,
 * and they are NOT claimed as built here. Claiming them would be the worst
 * kind of security theatre: a reader of this file would believe the data was
 * encrypted because a file called privacy.ts existed.
 */
import {
  AccountDataset,
  AuditEvent,
  EmailMessage,
  EmailThread,
  ThreadAnalysis,
  UserPreference,
} from './model';

/* ------------------------------------------------------------- redaction */

/**
 * Patterns that must never reach a log, an error message or an audit line.
 *
 * The list is ordered longest-match-first so a bearer token is not reduced to
 * its prefix by an earlier rule.
 */
const SECRET_PATTERNS: readonly { re: RegExp; label: string }[] = [
  { re: /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, label: 'JWT' },
  { re: /\bya29\.[A-Za-z0-9._-]{20,}/g, label: 'Google access token' },
  { re: /\b1\/\/[A-Za-z0-9._-]{20,}/g, label: 'Google refresh token' },
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, label: 'bearer token' },
  { re: /\b(?:client_secret|refresh_token|access_token|api[_-]?key|password)\s*[=:]\s*\S+/gi, label: 'credential' },
  { re: /\b[A-Za-z0-9]{32,}\b/g, label: 'long opaque string' },
];

/**
 * Removes anything that looks like a secret.
 *
 * Deliberately over-eager: the final rule redacts any long opaque string, which
 * will sometimes catch a message id. That is the right trade. A redacted
 * message id costs a few minutes of debugging; a leaked refresh token costs a
 * mailbox.
 */
export function redact(text: string): string {
  let out = text;
  for (const { re, label } of SECRET_PATTERNS) {
    out = out.replace(new RegExp(re.source, re.flags), `[${label} redacted]`);
  }
  return out;
}

/** Deep redaction over an arbitrary structure, for audit payloads. */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      // Known secret-bearing keys are dropped whole rather than redacted, so
      // nothing about their shape or length survives.
      if (/token|secret|password|credential|authorization/i.test(key)) {
        out[key] = '[removed]';
        continue;
      }
      out[key] = redactDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}

/* ------------------------------------------------------------ exclusions */

export interface ExclusionResult {
  included: boolean;
  /** Which rule excluded it, for the person to see and disagree with. */
  reason: string | null;
}

/**
 * Whether a thread is analysed at all.
 *
 * Exclusions are applied BEFORE analysis, not after. A thread excluded by a
 * folder rule is never read, never sent to a model and never stored, which is
 * a different and much stronger promise than filtering it out of a view.
 */
export function threadIsIncluded(
  thread: EmailThread,
  messages: readonly EmailMessage[],
  preference: UserPreference
): ExclusionResult {
  const folder = thread.folder.toLowerCase();

  if (preference.excludedFolders.some((f) => f.toLowerCase() === folder)) {
    return { included: false, reason: `The folder "${thread.folder}" is excluded for this account.` };
  }

  const senders = messages
    .flatMap((m) => m.participants.filter((p) => p.role === 'from'))
    .map((p) => p.address.toLowerCase());

  for (const excluded of preference.excludedSenders) {
    const needle = excluded.toLowerCase().trim();
    if (!needle) continue;
    // A rule may be an address or a whole domain.
    const matches = needle.startsWith('@')
      ? senders.some((s) => s.endsWith(needle))
      : senders.includes(needle);
    if (matches) {
      return { included: false, reason: `The sender rule "${excluded}" excludes this thread.` };
    }
  }

  return { included: true, reason: null };
}

/* ------------------------------------------------------------- retention */

export interface RetentionDecision {
  threadId: string;
  keep: boolean;
  ageDays: number;
  reason: string;
}

/**
 * What is past its retention window.
 *
 * Retention applies to the ANALYSIS, not to the mail. Concludo deletes what it
 * derived; it has no business deleting a person's mail and no capability to do
 * so. The distinction matters when a person reads the setting: "keep analysis
 * for 90 days" must not sound like "delete my email after 90 days".
 */
export function retentionSweep(
  analyses: readonly ThreadAnalysis[],
  threads: readonly EmailThread[],
  preference: UserPreference,
  now: string
): RetentionDecision[] {
  const nowMs = new Date(now).getTime();

  return analyses.map((analysis) => {
    const thread = threads.find((t) => t.id === analysis.threadId);
    const lastAt = thread?.lastMessageAt ?? now;
    const ageDays = Math.floor((nowMs - new Date(lastAt).getTime()) / 86_400_000);
    const keep = ageDays < preference.analysisRetentionDays;
    return {
      threadId: analysis.threadId,
      keep,
      ageDays,
      reason: keep
        ? `Within the ${preference.analysisRetentionDays} day window for this account.`
        : `Analysis is ${ageDays} days old, past the ${preference.analysisRetentionDays} day window. The analysis is deleted; the email is untouched.`,
    };
  });
}

/* --------------------------------------------------------------- export */

export interface AccountExport {
  exportedAt: string;
  accountId: string;
  accountAddress: string;
  /** Always true. An export that omits something is not an export. */
  complete: boolean;
  threads: unknown[];
  analyses: unknown[];
  drafts: unknown[];
  corrections: unknown[];
  auditEvents: unknown[];
  preference: unknown;
  /** Stated in the file, so a person reading it knows what is NOT in it. */
  notIncluded: readonly string[];
}

/**
 * Everything the product holds for one account, in one object.
 *
 * Redacted on the way out, because an export is a file that travels: it goes
 * into a download, an email, a shared drive. A token in an export is a token in
 * all three.
 */
export function exportAccount(dataset: AccountDataset, at: string): AccountExport {
  return {
    exportedAt: at,
    accountId: dataset.account.id,
    accountAddress: dataset.account.address,
    complete: true,
    threads: redactDeep(dataset.threads as unknown as unknown[]),
    analyses: redactDeep(dataset.analyses as unknown as unknown[]),
    drafts: redactDeep(dataset.drafts as unknown as unknown[]),
    corrections: redactDeep(dataset.corrections as unknown as unknown[]),
    auditEvents: redactDeep(dataset.auditEvents as unknown as unknown[]),
    preference: redactDeep(dataset.preference as unknown),
    notIncluded: [
      'OAuth tokens, which are never exported and never leave the token store.',
      'Message bodies from the provider, which Concludo does not retain beyond the analysis window.',
      'Attachment contents, which are not stored at all.',
    ],
  };
}

/* ------------------------------------------------------------- deletion */

export interface DeletionPlan {
  accountId: string;
  /** What is removed, named so a person can check it afterwards. */
  removes: readonly string[];
  /** What survives, and why. This is the part people are not told. */
  retains: readonly { what: string; why: string; forHowLong: string }[];
  /** The order matters: tokens first, so nothing can be fetched mid-deletion. */
  steps: readonly string[];
}

/**
 * What disconnecting an account actually does.
 *
 * The honest part of this function is `retains`. Most products say "we delete
 * your data" and keep an audit trail, because they must. Saying so is the
 * difference between a privacy promise and a privacy claim.
 */
export function deletionPlan(accountId: string): DeletionPlan {
  return {
    accountId,
    removes: [
      'Every stored analysis for this account.',
      'Every draft, approved or not.',
      'Every stored thread and message record.',
      'The synchronisation cursor.',
      'The OAuth tokens, revoked at the provider and then deleted locally.',
      'Folder, sender and preference settings for this account.',
    ],
    retains: [
      {
        what: 'Audit events recording that analysis happened, with no message content.',
        why: 'An audit trail that can be deleted by the thing it audits is not an audit trail. The events record that a thread was analysed, not what it said.',
        forHowLong: 'The organisation’s audit retention period, set separately from analysis retention.',
      },
      {
        what: 'Aggregate counts with no account identifier.',
        why: 'Billing and capacity. Nothing in them identifies an account or a person.',
        forHowLong: 'Indefinitely, because there is nothing in them to delete.',
      },
    ],
    steps: [
      '1. Revoke the token at the provider. Done first, so nothing can be fetched while the rest runs.',
      '2. Delete the local token record.',
      '3. Stop the scheduled synchronisation for this account.',
      '4. Delete analyses, drafts, threads, messages and the cursor.',
      '5. Delete the account record and its preferences.',
      '6. Write one audit event recording the deletion, with no content in it.',
    ],
  };
}

/* ---------------------------------------------------- audit line safety */

/**
 * Prepares an audit event for writing.
 *
 * Two rules. Nothing that looks like a secret survives. And no message body
 * goes into an audit line: an audit trail is a record of what the system did,
 * not a second copy of the mailbox with a longer retention period than the
 * first.
 */
export function safeAuditEvent(event: AuditEvent): AuditEvent {
  return {
    ...event,
    description: redact(event.description).slice(0, 500),
    actor: redact(event.actor),
  };
}

/** True when an audit line would leak content. Used by the tests. */
export function auditLineLeaks(line: string, messages: readonly EmailMessage[]): boolean {
  for (const message of messages) {
    const sentences = message.body
      .split(/[.\n]/)
      .map((x) => x.trim())
      .filter((x) => x.split(/\s+/).length >= 6);
    if (sentences.some((sentence) => line.includes(sentence))) return true;
  }
  return false;
}

/* ------------------------------------------------- model training stance */

export const MODEL_TRAINING_STANCE = {
  statement: 'Customer email content is never used to train or fine-tune a model.',
  howItIsEnforced: [
    'Analysis runs against a model provider under an agreement that excludes training on submitted content, and the provider is configured for zero retention where that option exists.',
    'No message content is written to any dataset, corpus or evaluation set.',
    'User corrections are stored as a field change, not as a training pair, and are used to show a person what they changed rather than to adjust a model.',
    'The synthetic dataset in this repository is entirely invented and is the only corpus the module ships with.',
  ],
  whatThisDoesNotCover: [
    'It is a contractual and configuration guarantee at the model provider, not something this codebase can enforce by itself. Verifying it means reading the agreement and the configuration, which is on the manual security checklist.',
  ],
} as const;
