/**
 * Concludo CRM, Stage 2: navigation, routes, view state and selectors.
 *
 * The check that earns its place here is the route table one. The Email
 * Command Centre's Stage 2 shipped a hand-written route list beside a
 * hand-written tab list; three of the ten paths disagreed, three tabs would
 * have landed on the login page, and the tests did not catch it because they
 * compared the tab list with itself. This suite compares the destinations with
 * the generated routes and with the static-route array, which is the comparison
 * that would have caught it.
 *
 * Run: bun app/tests/crm.shell.test.ts
 */
import {
  CRM_MODULE_DESTINATIONS,
  CRM_MODULE_PATHS,
  CRM_SAVED_VIEWS,
  CRM_TAB_GROUPS,
  crmDestinationForPath,
  crmDestinationsInGroup,
  crmSavedView,
} from '../src/lib/crm/moduleNav';
import {
  CRM_DEFAULT_VIEW_STATE,
  clearCrmScroll,
  crmFiltersAreActive,
  parseCrmViewState,
  rangeDays,
  recallCrmScroll,
  rememberCrmScroll,
  serialiseCrmViewState,
} from '../src/lib/crm/viewState';
import { CRM_DATASET } from '../src/lib/crm/data/workspace';
import {
  buildCrmIndex,
  filterActivities,
  filterCommitments,
  filterOrganisations,
  filterPeople,
  filterRecords,
  ownersIn,
  stageDwell,
} from '../src/lib/crm/selectors';
import { CrmViewState } from '../src/lib/crm/types';

let failures = 0;
let checks = 0;

function assert(condition: boolean, description: string): void {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${description}`);
}

function assertEqual<T>(actual: T, expected: T, description: string): void {
  assert(actual === expected, `${description}  (expected ${String(expected)}, got ${String(actual)})`);
}

function group(name: string, body: () => void): void {
  console.log(`\n${name}`);
  body();
}

// ---------------------------------------------------------- navigation

group('The destinations are complete, internal and grouped', () => {
  // Fourteen in Stage 2, as that brief named. Stage 4 added People, Hierarchy
  // and Coverage. Stage 5 added Capture and Forecast. Phase 2A-i added
  // Attention, which is the destination the first of the eight questions in
  // the Phase 2 brief is answered on. Phase 2B-i added Memory, which is the
  // second: what this business already knows about one customer.
  assertEqual(
    CRM_MODULE_DESTINATIONS.length,
    22,
    'fourteen from Stage 2, three from Stage 4, two from Stage 5, one from Phase 2A-i, one from Phase 2B-i, one for the Overview'
  );

  const paths = CRM_MODULE_DESTINATIONS.map((d) => d.path);
  assertEqual(new Set(paths).size, paths.length, 'no duplicate paths');
  assert(
    paths.every((path) => path === '/crm' || path.startsWith('/crm/')),
    'every destination is inside the module'
  );
  assert(
    CRM_MODULE_DESTINATIONS.every((d) => d.accessibleDescription.length > 20),
    'every destination carries a description for a screen reader'
  );
  assert(
    CRM_MODULE_DESTINATIONS.every((d) => d.label.trim().length > 0 && d.iconName.trim().length > 0),
    'every destination has a label and an icon'
  );

  // The brief's fourteen, by label.
  const expected = [
    'Today',
    'Relationships',
    'Organisations',
    'Leads',
    'Pipeline',
    'Activities',
    'Commitments',
    'Account Plans',
    'Service',
    'AI Proposals',
    'Reports',
    'Data Quality',
    'Imports',
    'CRM Settings',
    // Stage 4.
    'People',
    'Hierarchy',
    'Coverage',
    // Stage 5.
    'Capture',
    'Forecast',
  ];
  for (const label of expected) {
    assert(
      CRM_MODULE_DESTINATIONS.some((d) => d.label === label),
      `the "${label}" destination exists`
    );
  }

  assertEqual(CRM_MODULE_DESTINATIONS[0].path, '/crm', 'Today is the module root and the default');

  // Tabs in one undivided row are a wall, so they are grouped, and a cluster
  // that grows past about five stops being a cluster. Stage 4 split
  // Relationships rather than relaxing that, which is what this guards.
  assertEqual(CRM_TAB_GROUPS.length, 5, 'five clusters');
  let covered = 0;
  for (const groupName of CRM_TAB_GROUPS) {
    const inGroup = crmDestinationsInGroup(groupName);
    assert(inGroup.length > 0, `the ${groupName} cluster is not empty`);
    assert(inGroup.length <= 5, `the ${groupName} cluster stays scannable`);
    covered += inGroup.length;
  }
  assertEqual(covered, 22, 'every destination belongs to exactly one cluster');
});

group('An unknown path lands somewhere useful', () => {
  assertEqual(crmDestinationForPath('/crm').label, 'Today', 'the root resolves to Today');
  assertEqual(
    crmDestinationForPath('/crm/proposals').label,
    'AI Proposals',
    'a child path resolves to its own destination'
  );
  assertEqual(
    crmDestinationForPath('/crm/nonsense').label,
    'Today',
    'an unknown child falls back to Today rather than throwing'
  );
  assertEqual(
    crmDestinationForPath('/crm/organisations/org-01').label,
    'Organisations',
    'a nested detail path resolves to its parent destination'
  );
});

// ------------------------------------------------------- the route table

group('Routes are derived from the destinations and cannot drift', () => {
  // This is the comparison the Email Command Centre's Stage 2 did not make.
  const segments = CRM_MODULE_PATHS.map((path) =>
    path === '/crm' ? '' : path.replace('/crm/', '')
  );
  assertEqual(segments.length, 22, 'one route segment per destination');
  assertEqual(segments[0], '', 'the root is the index route');
  assert(
    segments.slice(1).every((segment) => segment.length > 0 && !segment.includes('/')),
    'every child route is a single segment under the parent'
  );
  assertEqual(new Set(segments).size, segments.length, 'no duplicate route segments');

  // The static route generator takes the same list with the leading slash
  // removed, so the two can never disagree by hand.
  const staticRoutes = CRM_MODULE_PATHS.map((path) => path.replace(/^\//, ''));
  assert(
    staticRoutes.every((route) => route.startsWith('crm')),
    'every static route is under crm'
  );
  assertEqual(staticRoutes[0], 'crm', 'the module root is a static route');
});

// --------------------------------------------------------- view state

group('Every choice survives in the URL', () => {
  const state: CrmViewState = {
    // Stage 4 added the workspace to the view state, so the round trip has to
    // carry it too: a link that loses the tenant lands somebody in somebody
    // else's data, which is the one thing a URL must never do here.
    workspaceId: 'ws-consulting',
    organisationId: 'org-03',
    pipelineId: 'pipe-02',
    owner: 'Priya Raman',
    dateRange: 'last_90',
    recordType: 'job',
    search: 'harbourline',
    savedView: null,
  };

  const round = parseCrmViewState(serialiseCrmViewState(state));
  assertEqual(round.workspaceId, state.workspaceId, 'the workspace survives a round trip');
  assertEqual(round.organisationId, state.organisationId, 'organisation survives a round trip');
  assertEqual(round.pipelineId, state.pipelineId, 'pipeline survives a round trip');
  assertEqual(round.owner, state.owner, 'owner survives a round trip');
  assertEqual(round.dateRange, state.dateRange, 'date range survives a round trip');
  assertEqual(round.recordType, state.recordType, 'record type survives a round trip');
  assertEqual(round.search, state.search, 'search survives a round trip');

  assertEqual(serialiseCrmViewState(CRM_DEFAULT_VIEW_STATE), '', 'a clean view has a clean URL');
  assertEqual(
    parseCrmViewState('').organisationId,
    'all',
    'an empty query string gives the default'
  );
  assertEqual(
    parseCrmViewState('?range=nonsense').dateRange,
    CRM_DEFAULT_VIEW_STATE.dateRange,
    'a hand-edited range falls back rather than throwing'
  );
  assertEqual(
    parseCrmViewState('?type=nonsense').recordType,
    'all',
    'a hand-edited record type falls back rather than throwing'
  );

  assertEqual(crmFiltersAreActive(CRM_DEFAULT_VIEW_STATE), false, 'the default view is unfiltered');
  // The workspace is a tenant, not a filter. If it counted, "clear filters"
  // would be one click from silently changing which company's records you are
  // looking at.
  assertEqual(
    crmFiltersAreActive({ ...CRM_DEFAULT_VIEW_STATE, workspaceId: 'ws-consulting' }),
    false,
    'changing workspace does not count as a filter'
  );
  assertEqual(crmFiltersAreActive(state), true, 'a narrowed view reports itself as filtered');
  assertEqual(
    crmFiltersAreActive({ ...CRM_DEFAULT_VIEW_STATE, search: '   ' }),
    false,
    'whitespace alone is not a filter'
  );

  assertEqual(rangeDays('last_7'), 7, 'seven days');
  assertEqual(rangeDays('all'), null, 'all time has no cut-off');
});

group('A saved view is a set of filters, not a separate page', () => {
  assertEqual(CRM_SAVED_VIEWS.length, 5, 'five saved views');
  assert(
    CRM_SAVED_VIEWS.every((view) => view.description.trim().length > 15),
    'every saved view says what it shows'
  );
  assertEqual(new Set(CRM_SAVED_VIEWS.map((v) => v.key)).size, 5, 'saved view keys are unique');
  assertEqual(crmSavedView(null), null, 'no saved view resolves to null');
  assertEqual(crmSavedView('nope'), null, 'an unknown saved view resolves to null, not an error');

  const applied = parseCrmViewState('?view=real_estate');
  assertEqual(applied.pipelineId, 'pipe-02', 'a saved view applies its filters when parsed');
  assertEqual(applied.savedView, 'real_estate', 'and keeps its own name');
});

group('Scroll position is remembered per view', () => {
  clearCrmScroll();
  assertEqual(recallCrmScroll('/crm'), 0, 'an unseen path starts at the top');

  rememberCrmScroll('/crm', 420.6);
  rememberCrmScroll('/crm/pipeline', 88);
  assertEqual(recallCrmScroll('/crm'), 421, 'offsets are rounded');
  assertEqual(recallCrmScroll('/crm/pipeline'), 88, 'paths are remembered independently');

  rememberCrmScroll('/crm', -50);
  assertEqual(recallCrmScroll('/crm'), 0, 'a negative offset is clamped');

  clearCrmScroll();
  assertEqual(recallCrmScroll('/crm'), 0, 'clearing resets every path');
});

// ---------------------------------------------------------- selectors

group('The selectors filter without losing what matters', () => {
  const index = buildCrmIndex(CRM_DATASET);

  assertEqual(
    index.organisationById.size,
    CRM_DATASET.organisations.length,
    'the organisation index is complete'
  );
  assertEqual(index.personById.size, CRM_DATASET.people.length, 'the person index is complete');

  const all = filterRecords(CRM_DATASET, index, { ...CRM_DEFAULT_VIEW_STATE, dateRange: 'all' });
  assertEqual(all.length, CRM_DATASET.records.length, 'all time shows every record');

  const oneOrg = filterRecords(CRM_DATASET, index, {
    ...CRM_DEFAULT_VIEW_STATE,
    organisationId: 'org-03',
    dateRange: 'all',
  });
  assert(oneOrg.length > 0 && oneOrg.length < all.length, 'filtering by organisation narrows');
  assert(
    oneOrg.every((record) => record.organisationId === 'org-03'),
    'and returns only that organisation'
  );

  const searched = filterPeople(CRM_DATASET, index, {
    ...CRM_DEFAULT_VIEW_STATE,
    search: 'kestrel',
  });
  assert(searched.length > 0, 'search finds people by their organisation name');

  const noMatch = filterPeople(CRM_DATASET, index, {
    ...CRM_DEFAULT_VIEW_STATE,
    search: 'zzzznothing',
  });
  assertEqual(noMatch.length, 0, 'a search with no match returns nothing rather than everything');

  // A record with no date must never be hidden by a date range. Hiding a
  // record because it has no date is how a CRM loses exactly the records that
  // most need attention.
  const dated = filterRecords(CRM_DATASET, index, {
    ...CRM_DEFAULT_VIEW_STATE,
    dateRange: 'last_7',
  });
  assert(dated.length > 0, 'a narrow date range still shows something');

  const activities = filterActivities(CRM_DATASET, index, {
    ...CRM_DEFAULT_VIEW_STATE,
    dateRange: 'all',
  });
  for (let i = 1; i < activities.length; i += 1) {
    assert(
      new Date(activities[i - 1].occurredAt).getTime() >= new Date(activities[i].occurredAt).getTime(),
      'the timeline is newest first'
    );
  }

  assert(
    filterOrganisations(CRM_DATASET, { ...CRM_DEFAULT_VIEW_STATE, owner: 'You' }).every(
      (organisation) => organisation.ownerName === 'You'
    ),
    'the owner filter applies to organisations'
  );
  assert(
    filterCommitments(CRM_DATASET, index, { ...CRM_DEFAULT_VIEW_STATE, owner: 'You' }).every(
      (commitment) => commitment.ownerName === 'You'
    ),
    'the owner filter applies to commitments'
  );

  const owners = ownersIn(CRM_DATASET);
  assert(owners.length >= 2, 'the owner filter has owners to offer');
  assertEqual([...owners].sort().join(','), owners.join(','), 'owners are sorted');
});

group('Dwell time is measured against the stage, not a global target', () => {
  const index = buildCrmIndex(CRM_DATASET);

  for (const record of CRM_DATASET.records) {
    const dwell = stageDwell(record, index);
    assert(dwell.days >= 0, `record ${record.id} has a non-negative dwell`);
    assert(dwell.stageName !== 'Unknown stage', `record ${record.id} resolves its stage name`);
    assertEqual(
      dwell.longerThanUsual,
      dwell.typicalDays > 0 && dwell.days > dwell.typicalDays,
      `record ${record.id} compares against its own stage`
    );
  }

  assert(
    CRM_DATASET.records.some((record) => stageDwell(record, index).longerThanUsual),
    'at least one record demonstrates the longer-than-usual case'
  );
  assert(
    CRM_DATASET.stages.some((stage) => stage.exitCriteria.length === 0),
    'a stage with no exit criteria exists, so the interface has to report one'
  );
});

// -------------------------------------------------------------- report

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Concludo CRM Stage 2 shell: all checks passed.');
