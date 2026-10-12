/**
 * The eleven Email Command Centre destinations.
 *
 * Stage 1 decision, confirmed by Anthony on 12 October 2026: one sidebar entry,
 * module tabs rather than sidebar links. The sidebar already carries 40 links,
 * and eleven more would make fifty-one. This matches how /workflows and /agents
 * already behave.
 *
 * Stage 7 added the eleventh tab, Clear Backlog. The reasoning is in
 * `types.ts` beside `EmailModulePath`.
 */
import { EmailModuleDestination, EmailSavedView, EmailDateRange } from './types';

export const EMAIL_MODULE_ROOT = '/email' as const;

export const EMAIL_MODULE_DESTINATIONS: readonly EmailModuleDestination[] = [
  {
    path: '/email',
    label: 'Overview',
    iconName: 'LayoutDashboard',
    accessibleDescription: 'Overview. The prioritised dashboard.',
  },
  {
    path: '/email/needs-attention',
    label: 'Needs Attention',
    iconName: 'AlertCircle',
    accessibleDescription: 'Needs Attention. Threads with the highest consequence.',
  },
  {
    path: '/email/reply-queue',
    label: 'Reply Queue',
    iconName: 'Reply',
    accessibleDescription: 'Reply Queue. Threads waiting on a reply from you.',
  },
  {
    path: '/email/actions-deadlines',
    label: 'Actions & Deadlines',
    iconName: 'CalendarClock',
    accessibleDescription: 'Actions and Deadlines. Commitments with a date.',
  },
  {
    path: '/email/waiting',
    label: 'Waiting',
    iconName: 'Hourglass',
    accessibleDescription: 'Waiting. Threads where someone else owns the next step.',
  },
  {
    path: '/email/quick-wins',
    label: 'Quick Wins',
    iconName: 'Zap',
    accessibleDescription: 'Quick Wins. Threads that can probably be closed in under two minutes.',
  },
  {
    path: '/email/clear-backlog',
    label: 'Clear Backlog',
    iconName: 'ListChecks',
    accessibleDescription:
      'Clear Backlog. Work through a chosen set of threads one at a time. Can be paused and resumed.',
  },
  {
    path: '/email/all',
    label: 'All Email',
    iconName: 'Inbox',
    accessibleDescription: 'All Email. Every analysed thread in the selected account.',
  },
  {
    path: '/email/outputs',
    label: 'Outputs',
    iconName: 'FileOutput',
    accessibleDescription:
      'Outputs. Finished documents built from a conversation, and the replies prepared for your review. Nothing is sent from here.',
  },
  {
    path: '/email/security-review',
    label: 'Security Review',
    iconName: 'ShieldAlert',
    accessibleDescription: 'Security Review. Threads flagged as possibly unsafe.',
  },
  {
    path: '/email/settings',
    label: 'Email Settings',
    iconName: 'Settings2',
    accessibleDescription: 'Email Settings. Accounts, exclusions and preferences.',
  },
] as const;

/** The eight default saved views. Read-only in Stage 2. */
export const EMAIL_SAVED_VIEWS: readonly EmailSavedView[] = [
  { key: 'morning_review', label: 'Morning Review', description: 'Everything unresolved, ranked.' },
  { key: 'handle_today', label: 'Handle Today', description: 'Immediate and today bands only.' },
  { key: 'quick_replies', label: 'Quick Replies', description: 'Short answers, no research needed.' },
  { key: 'waiting_this_week', label: 'Waiting This Week', description: 'Owed to you, due within seven days.' },
  { key: 'needs_a_decision', label: 'Needs a Decision', description: 'A choice is blocked on you.' },
  { key: 'needs_an_attachment', label: 'Needs an Attachment', description: 'A reply needs a file first.' },
  { key: 'security_review', label: 'Security Review', description: 'Flagged as possibly unsafe.' },
  { key: 'unprocessed', label: 'Unprocessed', description: 'Not yet analysed.' },
] as const;

export const EMAIL_DATE_RANGES: readonly { value: EmailDateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All unresolved' },
] as const;

/** Folder and label options. Synthetic in Stage 2. */
export const EMAIL_FOLDERS: readonly { value: string; label: string }[] = [
  { value: 'all', label: 'All folders' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'clients', label: 'Clients' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'finance', label: 'Finance' },
  { value: 'archive', label: 'Archive' },
] as const;

/** Resolves a pathname to its destination, for the active tab and the page title. */
export function destinationForPath(pathname: string): EmailModuleDestination {
  const exact = EMAIL_MODULE_DESTINATIONS.find((d) => d.path === pathname);
  if (exact) return exact;
  const nested = EMAIL_MODULE_DESTINATIONS.filter((d) => d.path !== '/email').find((d) =>
    pathname.startsWith(d.path)
  );
  return nested ?? EMAIL_MODULE_DESTINATIONS[0];
}
