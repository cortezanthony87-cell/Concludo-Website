/**
 * What the person has chosen, and how it survives moving between views.
 *
 * The brief's rule is that filters, the selected organisation and the dashboard
 * position must not be lost when moving between CRM views. The cheapest way to
 * break that rule is to hold the state in React, because then every route
 * change resets it and every shared link loses it.
 *
 * So every choice lives in the query string. A reload, a back navigation, a
 * link pasted into a message and a second device all show the same thing, and
 * "preserved across views" is a property of the URL rather than a promise about
 * component lifetimes. Scroll position is remembered separately, per path,
 * because a URL cannot sensibly carry it.
 */
import { CrmViewState } from './types';
import { crmSavedView } from './moduleNav';
import { CRM_DEFAULT_WORKSPACE_ID } from './stage4/workspace';
import { getActiveWorkspaceId } from './customWorkspaceStore';

export const CRM_DEFAULT_VIEW_STATE: CrmViewState = {
  workspaceId: CRM_DEFAULT_WORKSPACE_ID,
  organisationId: 'all',
  pipelineId: 'all',
  owner: 'all',
  dateRange: 'last_30',
  recordType: 'all',
  search: '',
  savedView: null,
};

const DATE_RANGES: CrmViewState['dateRange'][] = ['last_7', 'last_30', 'last_90', 'all'];
const RECORD_TYPES: CrmViewState['recordType'][] = [
  'all',
  'opportunity',
  'job',
  'case',
  'application',
];

export const CRM_DATE_RANGE_LABELS: Record<CrmViewState['dateRange'], string> = {
  last_7: 'Last 7 days',
  last_30: 'Last 30 days',
  last_90: 'Last 90 days',
  all: 'All time',
};

/** Days in a range, or null for all time. */
export function rangeDays(range: CrmViewState['dateRange']): number | null {
  if (range === 'last_7') return 7;
  if (range === 'last_30') return 30;
  if (range === 'last_90') return 90;
  return null;
}

/**
 * Reads the state out of a query string.
 *
 * Unknown values fall back to the default rather than throwing. A hand-edited
 * URL is a normal thing for a person to do and it should not produce an error
 * page; it should produce the nearest sensible view.
 */
export function parseCrmViewState(search: string): CrmViewState {
  const params = new URLSearchParams(search);

  const rawRange = params.get('range') as CrmViewState['dateRange'] | null;
  const rawType = params.get('type') as CrmViewState['recordType'] | null;

  const state: CrmViewState = {
    workspaceId: params.get('w') || getActiveWorkspaceId() || CRM_DEFAULT_WORKSPACE_ID,
    organisationId: params.get('org') || 'all',
    pipelineId: params.get('pipeline') || 'all',
    owner: params.get('owner') || 'all',
    dateRange: rawRange && DATE_RANGES.includes(rawRange) ? rawRange : CRM_DEFAULT_VIEW_STATE.dateRange,
    recordType: rawType && RECORD_TYPES.includes(rawType) ? rawType : 'all',
    search: params.get('q') ?? '',
    savedView: params.get('view'),
  };

  // A saved view names a set of filters. Applying it here rather than in a
  // component means the URL and the view can never disagree about what is on.
  const saved = crmSavedView(state.savedView);
  return saved ? { ...state, ...saved.patch, savedView: state.savedView } : state;
}

/**
 * Writes the state back to a query string.
 *
 * Only values that differ from the default are written, so a clean view has a
 * clean URL and the address bar stays readable.
 */
export function serialiseCrmViewState(state: CrmViewState): string {
  const params = new URLSearchParams();
  if (state.workspaceId !== CRM_DEFAULT_WORKSPACE_ID) params.set('w', state.workspaceId);
  if (state.organisationId !== 'all') params.set('org', state.organisationId);
  if (state.pipelineId !== 'all') params.set('pipeline', state.pipelineId);
  if (state.owner !== 'all') params.set('owner', state.owner);
  if (state.dateRange !== CRM_DEFAULT_VIEW_STATE.dateRange) params.set('range', state.dateRange);
  if (state.recordType !== 'all') params.set('type', state.recordType);
  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.savedView) params.set('view', state.savedView);

  const query = params.toString();
  return query ? `?${query}` : '';
}

/** True when anything is narrowing the view. Drives the compact summary. */
export function crmFiltersAreActive(state: CrmViewState): boolean {
  return (
    state.organisationId !== 'all' ||
    state.pipelineId !== 'all' ||
    state.owner !== 'all' ||
    state.recordType !== 'all' ||
    state.search.trim().length > 0 ||
    state.savedView !== null ||
    state.dateRange !== CRM_DEFAULT_VIEW_STATE.dateRange
  );
}

/* ------------------------------------------------------- scroll memory */

const scrollByPath = new Map<string, number>();

export function rememberCrmScroll(path: string, offset: number): void {
  scrollByPath.set(path, Math.max(0, Math.round(offset)));
}

export function recallCrmScroll(path: string): number {
  return scrollByPath.get(path) ?? 0;
}

export function clearCrmScroll(): void {
  scrollByPath.clear();
}
