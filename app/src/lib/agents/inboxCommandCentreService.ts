/**
 * Concludo Inbox Command Centre Agent Service
 * 
 * Implements hard security guards:
 * 1. Strict tool allowlist and denylist enforced in code (not in prompt).
 * 2. Absolute isolation between work and personal mailboxes.
 * 3. Weekly quota enforcement: 3 runs/week on Starter (weekly reset), unlimited on Pro and Team.
 * 4. Data-never-instruction prompt injection defence.
 */

export const FORBIDDEN_MAILBOX_TOOLS = new Set([
  'send_message',
  'reply',
  'forward',
  'trash_message',
  'trash_thread',
  'untrash_message',
  'untrash_thread',
  'label_message',
  'label_thread',
  'update_message_labels',
  'mark_message_spam',
  'delete_draft',
  'outlook_send_mail',
  'outlook_send_draft',
  'outlook_forward_mail',
  'outlook_batch_delete_messages',
  'outlook_trash_thread',
  'outlook_modify_labels',
  'outlook_batch_modify_labels',
  'outlook_create_filter',
  'outlook_delete_filter',
  'outlook_set_vacation',
  'outlook_create_event',
  'outlook_update_event',
  'outlook_delete_event',
  'outlook_respond_to_event',
]);

export const ALLOWED_READING_TOOLS = new Set([
  'mcp__Gmail__search_threads',
  'get_thread',
  'get_message',
  'list_labels',
  'list_drafts',
  'get_draft',
  'read_user_profile',
  'mcp__Microsoft_365__outlook_email_search',
  'read_resource',
  'get_me',
  'outlook_calendar_search',
  'search_people',
]);

export const ALLOWED_DRAFTING_TOOLS = new Set([
  'mcp__Gmail__create_draft',
  'update_draft',
  'mcp__Microsoft_365__outlook_create_draft',
  'outlook_create_reply_draft',
]);

export interface ToolInvocationRequest {
  toolName: string;
  args: Record<string, any>;
  userExplicitlyApprovedDraft?: boolean;
  accountId: string;
  accountType: 'work' | 'personal';
}

/**
 * Strict Code-Level Tool Execution Guard.
 * Throws immediately if a tool is on the denylist or not allowed.
 */
export function validateMailboxToolInvocation(req: ToolInvocationRequest): { allowed: boolean; reason?: string } {
  const name = req.toolName.trim();

  // Check denylist first
  if (
    FORBIDDEN_MAILBOX_TOOLS.has(name) ||
    /^untrash_/i.test(name) ||
    /send|trash|delete|archive/i.test(name) ||
    /label_message|label_thread|modify_labels/i.test(name)
  ) {
    throw new Error(
      `[INBOX_AGENT_SECURITY_VIOLATION] Tool '${name}' is strictly prohibited. The Inbox Command Centre Agent never sends, files, deletes, modifies or dispatches anything.`
    );
  }

  // Check draft writing tools
  if (ALLOWED_DRAFTING_TOOLS.has(name)) {
    if (!req.userExplicitlyApprovedDraft) {
      throw new Error(
        `[INBOX_AGENT_DRAFT_NOT_APPROVED] Draft creation/update requires explicit human approval of the exact drafted text before invocation.`
      );
    }
    return { allowed: true };
  }

  // Check reading tools
  if (ALLOWED_READING_TOOLS.has(name)) {
    return { allowed: true };
  }

  throw new Error(`[INBOX_AGENT_UNAUTHORISED_TOOL] Tool '${name}' is not on the authorised reading allowlist.`);
}

export interface MailboxThreadItem {
  threadId: string;
  accountId: string;
  accountType: 'work' | 'personal';
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  unread: boolean;
}

/**
 * Two-Account Isolation Validator.
 * Ensures no data leaks across work and personal mailboxes.
 */
export function isolateMailboxData(
  targetAccountType: 'work' | 'personal',
  items: MailboxThreadItem[]
): MailboxThreadItem[] {
  return items.filter((item) => {
    if (item.accountType !== targetAccountType) {
      return false;
    }
    return true;
  });
}

/**
 * Weekly Quota Tracker.
 * Starter: 3 runs/week, resetting weekly.
 * Pro and Team: Unlimited.
 */
export interface UserQuotaRecord {
  userId: string;
  tier: 'starter' | 'pro' | 'team';
  runsThisWeek: number;
  weekStartDate: string; // YYYY-MM-DD
}


/**
 * Calculates the Monday of the current week (YYYY-MM-DD) in Melbourne time.
 */
export function getMondayOfWeek(d: Date = new Date(), timeZone = "Australia/Melbourne"): string {
  // Format date parts in specified timeZone
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(d);
  let year = "", month = "", dayStr = "", weekday = "";
  for (const p of parts) {
    if (p.type === "year") year = p.value;
    if (p.type === "month") month = p.value;
    if (p.type === "day") dayStr = p.value;
    if (p.type === "weekday") weekday = p.value;
  }
  const dateObj = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(dayStr, 10)));
  const dayOfWeek = (dateObj.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
  dateObj.setUTCDate(dateObj.getUTCDate() - dayOfWeek);
  return dateObj.toISOString().slice(0, 10);
}

export function checkWeeklyQuota(
  quotaRecord: UserQuotaRecord,
  now: Date = new Date()
): { allowed: boolean; remainingRuns: number | 'unlimited'; error?: string } {
  // Pro and Team have unlimited quota
  if (quotaRecord.tier === 'pro' || quotaRecord.tier === 'team') {
    return { allowed: true, remainingRuns: 'unlimited' };
  }

  const currentMondayStr = getMondayOfWeek(now);

  // Check if we need to reset weekly
  let runs = quotaRecord.runsThisWeek;
  if (quotaRecord.weekStartDate !== currentMondayStr) {
    runs = 0;
  }

  if (runs >= 3) {
    return {
      allowed: false,
      remainingRuns: 0,
      error: 'Weekly quota reached (3/3 runs on Starter). Quota resets weekly or upgrade to Pro for unlimited runs.',
    };
  }

  return {
    allowed: true,
    remainingRuns: 3 - runs,
  };
}
