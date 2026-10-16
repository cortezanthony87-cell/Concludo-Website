/**
 * Paging, and the indexes that make a page cheap.
 *
 * "Do not load the entire CRM into the browser" is in the brief, and it is two
 * separate problems.
 *
 * THE FIRST IS HOW MUCH IS FETCHED. A list asks for a page and a count, never
 * for a table. `pageOf` takes the whole collection here because this release
 * holds its synthetic data in memory, and it returns the same shape a cursor
 * query against PostgreSQL returns: the items, whether there are more, and the
 * cursor to ask for next. Swapping the in-memory source for a query means
 * replacing the body of one function, and the interface the pages are built
 * against does not change. A page component that received an array and sliced
 * it would have to be rewritten instead, which is the actual reason products
 * end up loading everything.
 *
 * THE SECOND IS HOW THE PAGE IS BUILT once the rows arrive. A list of fifty
 * organisations that calls `data.people.filter(...)` for each one is fifty
 * passes over a hundred thousand people, which is five million comparisons for
 * one screen. That is the shape that makes a CRM feel slow at size while every
 * individual query looks fine. `indexFor` builds the lookups once per dataset
 * and caches them against the dataset object, so the fifty lookups are fifty
 * map reads.
 *
 * WHAT IS DELIBERATELY NOT HERE. No count of the whole table on every page: a
 * count over a hundred thousand rows is itself a scan, so a list says "more"
 * rather than "page 4 of 2,137" unless somebody asks for the total. No
 * prefetch of the next page by default. No client-side sort of a collection
 * larger than a page.
 */

import { Activity, CrmWorkspaceData, Organisation, Person, WorkItem } from '../domain';
import { onWriteInvalidate } from '../cacheBus';

/* ===================================================== paging */

export interface PageRequest {
  /** Rows per page. The default is what a screen can show without scrolling far. */
  pageSize?: number;
  /** Opaque. The id of the last row of the previous page. */
  cursor?: string | null;
}

export interface Page<T> {
  items: T[];
  /** The cursor to pass back for the next page, or null at the end. */
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
  /**
   * Set only where the caller asked for it, because counting a large table is
   * a scan and a page does not need one.
   */
  total: number | null;
  /** What the list says under itself. Never a page count nobody computed. */
  footer: string;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/**
 * One page of a collection, by cursor.
 *
 * Cursor paging rather than offset paging, because offset paging over a list
 * somebody is also writing to shows a row twice or skips one, and the row it
 * skips is the one that was just created.
 */
export function pageOf<T extends { id: string }>(
  rows: T[],
  request: PageRequest = {},
  options: { withTotal?: boolean; label?: string } = {}
): Page<T> {
  const pageSize = Math.min(Math.max(request.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  let start = 0;
  if (request.cursor) {
    const index = rows.findIndex((row) => row.id === request.cursor);
    // A cursor that no longer resolves means the row was deleted between
    // pages. Starting again from the top is wrong and silently skipping to the
    // end is worse, so the page restarts and says so in the footer.
    start = index === -1 ? 0 : index + 1;
  }

  const items = rows.slice(start, start + pageSize);
  const hasMore = start + pageSize < rows.length;
  const label = options.label ?? 'records';

  const cursorLost = Boolean(request.cursor) && !rows.some((row) => row.id === request.cursor);

  return {
    items,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    hasMore,
    pageSize,
    total: options.withTotal ? rows.length : null,
    footer: cursorLost
      ? `Showing the first ${items.length} ${label}. The record this page followed is no longer there, so the list has started again.`
      : options.withTotal
        ? `Showing ${start + 1} to ${start + items.length} of ${rows.length.toLocaleString('en-AU')} ${label}.`
        : hasMore
          ? `Showing ${items.length} ${label}. There are more.`
          : `Showing all ${items.length} ${label}.`,
  };
}

/* ===================================================== indexes */

export interface WorkspaceIndex {
  peopleByOrganisation: Map<string, Person[]>;
  peopleById: Map<string, Person>;
  organisationsById: Map<string, Organisation>;
  organisationsByParent: Map<string, Organisation[]>;
  workItemsByOrganisation: Map<string, WorkItem[]>;
  workItemsByStage: Map<string, WorkItem[]>;
  activitiesByOrganisation: Map<string, Activity[]>;
  activitiesByPerson: Map<string, Activity[]>;
  /** Person ids on each activity, so a caller never scans the participant table. */
  participantsByActivity: Map<string, string[]>;
  consentByPerson: Map<string, CrmWorkspaceData['consentRecords']>;
  /** Live rows only, sorted, so a list does not sort on every render. */
  livePeople: Person[];
  liveOrganisations: Organisation[];
  liveActivities: Activity[];
  openWorkItems: WorkItem[];
  builtFrom: { people: number; organisations: number; activities: number };
}

const cache = new WeakMap<CrmWorkspaceData, WorkspaceIndex>();

const COLLATOR = new Intl.Collator('en-AU');

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

/**
 * Builds every lookup a list page needs, in one pass per collection, and caches
 * it against the dataset.
 *
 * The cache is a WeakMap keyed on the dataset object, so it is dropped when
 * the dataset is. That alone is NOT enough: the session store mutates one
 * workspace object in place rather than replacing it, so the cache is also
 * dropped on every write, through `onWriteInvalidate` at the bottom of this
 * file.
 */
export function indexFor(data: CrmWorkspaceData): WorkspaceIndex {
  const cached = cache.get(data);
  if (cached) return cached;

  const index: WorkspaceIndex = {
    peopleByOrganisation: new Map(),
    peopleById: new Map(),
    organisationsById: new Map(),
    organisationsByParent: new Map(),
    workItemsByOrganisation: new Map(),
    workItemsByStage: new Map(),
    activitiesByOrganisation: new Map(),
    activitiesByPerson: new Map(),
    participantsByActivity: new Map(),
    consentByPerson: new Map(),
    livePeople: [],
    liveOrganisations: [],
    liveActivities: [],
    openWorkItems: [],
    builtFrom: {
      people: data.people.length,
      organisations: data.organisations.length,
      activities: data.activities.length,
    },
  };

  for (const person of data.people) {
    index.peopleById.set(person.id, person);
    if (person.deletedAt !== null || person.mergedIntoPersonId !== null) continue;
    index.livePeople.push(person);
    if (person.organisationId) push(index.peopleByOrganisation, person.organisationId, person);
  }

  for (const organisation of data.organisations) {
    index.organisationsById.set(organisation.id, organisation);
    if (organisation.deletedAt !== null) continue;
    index.liveOrganisations.push(organisation);
    if (organisation.parentOrganisationId) {
      push(index.organisationsByParent, organisation.parentOrganisationId, organisation);
    }
  }

  for (const item of data.workItems) {
    if (item.deletedAt !== null) continue;
    if (item.organisationId) push(index.workItemsByOrganisation, item.organisationId, item);
    push(index.workItemsByStage, item.stageId, item);
    if (item.status === 'open') index.openWorkItems.push(item);
  }

  // Participants are walked once to build the person index, rather than once
  // per person. At a hundred thousand activities the difference is the page
  // loading or not.
  const participantsByActivity = index.participantsByActivity;
  for (const participant of data.activityParticipants) {
    if (participant.personId === null) continue;
    push(participantsByActivity, participant.activityId, participant.personId);
  }

  for (const activity of data.activities) {
    if (activity.deletedAt !== null) continue;
    index.liveActivities.push(activity);
    if (activity.organisationId) push(index.activitiesByOrganisation, activity.organisationId, activity);
    for (const personId of participantsByActivity.get(activity.id) ?? []) {
      push(index.activitiesByPerson, personId, activity);
    }
  }

  for (const record of data.consentRecords) {
    push(index.consentByPerson, record.personId, record);
  }

  // Sorted once. A list that sorts on every render sorts a hundred thousand
  // rows to show fifty.
  //
  // One Collator, reused. String.prototype.localeCompare builds a collator per
  // call, which at a hundred thousand names is most of the time the sort takes.
  index.livePeople.sort((a, b) => COLLATOR.compare(a.fullName, b.fullName));
  index.liveOrganisations.sort((a, b) => COLLATOR.compare(a.name, b.name));
  index.liveActivities.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  cache.set(data, index);
  return index;
}

/** Drops the cached index, for a test that mutates a dataset in place. */
export function forgetIndex(data: CrmWorkspaceData): void {
  cache.delete(data);
}

/* ===================================================== list pages */

export interface ListFilter {
  /** Matched against the name, case-insensitively. */
  search?: string;
  organisationId?: string | null;
  /** Organisations only. */
  lifecycleState?: Organisation['lifecycleState'] | null;
}

export function peoplePage(
  data: CrmWorkspaceData,
  request: PageRequest = {},
  filter: ListFilter = {}
): Page<Person> {
  const index = indexFor(data);

  let rows = filter.organisationId
    ? (index.peopleByOrganisation.get(filter.organisationId) ?? [])
    : index.livePeople;

  if (filter.search) {
    const needle = filter.search.toLowerCase();
    rows = rows.filter(
      (person) =>
        person.fullName.toLowerCase().includes(needle) ||
        (person.primaryEmail ?? '').toLowerCase().includes(needle)
    );
  }

  return pageOf(rows, request, { label: 'contacts', withTotal: rows.length <= 5_000 });
}

export function organisationsPage(
  data: CrmWorkspaceData,
  request: PageRequest = {},
  filter: ListFilter = {}
): Page<Organisation> {
  const index = indexFor(data);
  let rows = index.liveOrganisations;

  if (filter.lifecycleState) {
    rows = rows.filter((organisation) => organisation.lifecycleState === filter.lifecycleState);
  }
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    rows = rows.filter((organisation) => organisation.name.toLowerCase().includes(needle));
  }

  return pageOf(rows, request, { label: 'organisations', withTotal: rows.length <= 5_000 });
}

export function activityPage(
  data: CrmWorkspaceData,
  request: PageRequest = {},
  filter: ListFilter = {}
): Page<Activity> {
  const index = indexFor(data);
  const rows = filter.organisationId
    ? (index.activitiesByOrganisation.get(filter.organisationId) ?? [])
    : index.liveActivities;

  return pageOf(rows, { pageSize: 25, ...request }, { label: 'conversations' });
}

/**
 * What one organisation's page needs, in map reads rather than scans.
 *
 * This is the function the Account 360 page should call at size. It does not
 * return the organisation's whole activity history; it returns the first page
 * of it and says there is more.
 */
export interface AccountSlice {
  organisation: Organisation | null;
  people: Person[];
  openWork: WorkItem[];
  recentActivity: Page<Activity>;
  children: Organisation[];
  /** How many rows were read to build this. Shown in the performance report. */
  rowsRead: number;
}

export function accountSlice(
  data: CrmWorkspaceData,
  organisationId: string,
  activityPageSize = 10
): AccountSlice {
  const index = indexFor(data);
  const organisation = index.organisationsById.get(organisationId) ?? null;
  const people = index.peopleByOrganisation.get(organisationId) ?? [];
  const work = (index.workItemsByOrganisation.get(organisationId) ?? []).filter(
    (item) => item.status === 'open'
  );
  const activities = index.activitiesByOrganisation.get(organisationId) ?? [];
  const children = index.organisationsByParent.get(organisationId) ?? [];

  return {
    organisation,
    people,
    openWork: work,
    recentActivity: pageOf(activities, { pageSize: activityPageSize }, { label: 'conversations' }),
    children,
    rowsRead: 1 + people.length + work.length + Math.min(activities.length, activityPageSize) + children.length,
  };
}

/*
 * Drop the workspace index whenever anything is written.
 *
 * The session store mutates one workspace object in place, so a cache keyed on
 * that object outlives the data it was built from. Registering here means the
 * cache is dropped by the thing that knows a write happened, rather than by
 * every caller remembering to.
 */
onWriteInvalidate(forgetIndex);
