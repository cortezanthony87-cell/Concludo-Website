/**
 * View state: pure functions, no React.
 *
 * The brief requires the selected account, filters, search, saved view and
 * scroll position to survive navigation. The URL is the store, so state also
 * survives a reload, the back button and a link sent to a colleague.
 *
 * These functions are pure so they can be tested without a DOM.
 */
import {
  EmailViewState,
  EmailDateRange,
  EmailSavedViewKey,
  EmailAccountSummary,
  EmailAccountType,
} from './types';

const DATE_RANGES: readonly EmailDateRange[] = ['today', '7d', '14d', '30d', 'all'];

const SAVED_VIEW_KEYS: readonly EmailSavedViewKey[] = [
  'morning_review',
  'handle_today',
  'quick_replies',
  'waiting_this_week',
  'needs_a_decision',
  'needs_an_attachment',
  'security_review',
  'unprocessed',
];

export function defaultViewState(accountId: string): EmailViewState {
  return {
    accountId,
    dateRange: '14d',
    folder: 'all',
    search: '',
    savedView: null,
    filters: [],
  };
}

/** Reads view state from a query string. Unknown values fall back to defaults. */
export function parseViewState(search: string, fallbackAccountId: string): EmailViewState {
  const params = new URLSearchParams(search);
  const base = defaultViewState(fallbackAccountId);

  const accountId = params.get('account');
  const dateRange = params.get('range') as EmailDateRange | null;
  const folder = params.get('folder');
  const query = params.get('q');
  const savedView = params.get('view') as EmailSavedViewKey | null;
  const filters = params.get('filters');

  return {
    accountId: accountId && accountId.length > 0 ? accountId : base.accountId,
    dateRange: dateRange && DATE_RANGES.includes(dateRange) ? dateRange : base.dateRange,
    folder: folder && folder.length > 0 ? folder : base.folder,
    search: query ?? base.search,
    savedView: savedView && SAVED_VIEW_KEYS.includes(savedView) ? savedView : base.savedView,
    filters: filters && filters.length > 0 ? filters.split(',').filter(Boolean) : base.filters,
  };
}

/**
 * Writes view state to a query string. Default values are omitted so a clean
 * state produces a clean URL. The account is always written, because an implicit
 * account is how work and personal get confused.
 */
export function serialiseViewState(state: EmailViewState): string {
  const params = new URLSearchParams();
  params.set('account', state.accountId);
  if (state.dateRange !== '14d') params.set('range', state.dateRange);
  if (state.folder !== 'all') params.set('folder', state.folder);
  if (state.search.trim().length > 0) params.set('q', state.search.trim());
  if (state.savedView) params.set('view', state.savedView);
  if (state.filters.length > 0) params.set('filters', state.filters.join(','));
  return params.toString();
}

/** Round trip helper used by the tests and by the tab links. */
export function viewStateQuery(state: EmailViewState): string {
  const q = serialiseViewState(state);
  return q.length > 0 ? `?${q}` : '';
}

/**
 * Resolves the active account.
 *
 * Returns the requested account only when it exists. Never falls back silently
 * to an account of a different type: if the requested account is missing, the
 * first account of the same type is preferred, and only then the first account
 * of any type. The caller is told which happened so the interface can say so.
 */
export function resolveAccount(
  accounts: readonly EmailAccountSummary[],
  requestedId: string,
  preferredType?: EmailAccountType
): { account: EmailAccountSummary | null; substituted: boolean } {
  if (accounts.length === 0) return { account: null, substituted: false };

  const exact = accounts.find((a) => a.id === requestedId);
  if (exact) return { account: exact, substituted: false };

  if (preferredType) {
    const sameType = accounts.find((a) => a.accountType === preferredType);
    if (sameType) return { account: sameType, substituted: true };
  }

  return { account: accounts[0], substituted: true };
}

/**
 * Scroll position, held per module path for the life of the tab.
 *
 * sessionStorage is not used, because the Workspace already resets scroll on
 * every route change in WorkspaceLayout. An in-memory map is enough, it is
 * cleared when the tab closes, and it never persists anything about a person.
 */
const scrollPositions = new Map<string, number>();

export function rememberScroll(path: string, offset: number): void {
  scrollPositions.set(path, Math.max(0, Math.round(offset)));
}

export function recallScroll(path: string): number {
  return scrollPositions.get(path) ?? 0;
}

export function clearRememberedScroll(): void {
  scrollPositions.clear();
}
