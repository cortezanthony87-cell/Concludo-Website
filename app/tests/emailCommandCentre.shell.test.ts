/**
 * Email Command Centre, Stage 2 shell tests.
 *
 * House style, matching tests/: plain assertions, no framework, exit code 1 on
 * any failure, nothing treated as a warning.
 *
 * Scope. These test the module's pure logic: view state, account resolution,
 * scroll memory, navigation configuration, and the shape and separation of the
 * synthetic data. They do not render React, because the repository has no
 * component testing framework and Stage 1 recorded that adding one is a separate
 * decision. Aggregation and filter tests belong to Stage 3.
 *
 * Run: bun app/tests/emailCommandCentre.shell.test.ts
 */
import {
  parseViewState,
  serialiseViewState,
  defaultViewState,
  resolveAccount,
  rememberScroll,
  recallScroll,
  clearRememberedScroll,
} from '../src/lib/email/viewState';
import {
  EMAIL_MODULE_DESTINATIONS,
  EMAIL_SAVED_VIEWS,
  destinationForPath,
} from '../src/lib/email/moduleNav';
import {
  SYNTHETIC_ACCOUNTS,
  DEFAULT_ACCOUNT_ID,
  syntheticMetrics,
  syntheticPanels,
  SYNTHETIC_ITEMS_BY_ACCOUNT,
} from '../src/lib/email/shellAdapter';

let failures = 0;
let checks = 0;

function assert(condition: boolean, description: string): void {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${description}`);
}

function assertEqual<T>(actual: T, expected: T, description: string): void {
  assert(
    actual === expected,
    `${description}  (expected ${String(expected)}, got ${String(actual)})`
  );
}

function group(name: string, body: () => void): void {
  console.log(`\n${name}`);
  body();
}

// ------------------------------------------------------------ view state

group('View state survives a round trip', () => {
  const state = {
    accountId: 'acct-work-01',
    dateRange: '7d' as const,
    folder: 'clients',
    search: 'harrington fit-out',
    savedView: 'handle_today' as const,
    filters: ['has_attachment', 'unread'],
  };

  const round = parseViewState(`?${serialiseViewState(state)}`, DEFAULT_ACCOUNT_ID);

  assertEqual(round.accountId, state.accountId, 'account survives');
  assertEqual(round.dateRange, state.dateRange, 'date range survives');
  assertEqual(round.folder, state.folder, 'folder survives');
  assertEqual(round.search, state.search, 'search survives');
  assertEqual(round.savedView, state.savedView, 'saved view survives');
  assertEqual(round.filters.join(','), state.filters.join(','), 'filters survive');
});

group('Defaults are omitted from the URL, and the account never is', () => {
  const query = serialiseViewState(defaultViewState('acct-work-01'));
  assert(query.includes('account=acct-work-01'), 'account is always written');
  assert(!query.includes('range='), 'default date range is omitted');
  assert(!query.includes('folder='), 'default folder is omitted');
  assert(!query.includes('q='), 'empty search is omitted');
  assert(!query.includes('view='), 'absent saved view is omitted');
});

group('Unknown values fall back rather than throwing', () => {
  const state = parseViewState('?range=last_century&view=not_a_view', DEFAULT_ACCOUNT_ID);
  assertEqual(state.dateRange, '14d', 'unknown date range falls back to the default');
  assertEqual(state.savedView, null, 'unknown saved view falls back to none');
  assertEqual(state.accountId, DEFAULT_ACCOUNT_ID, 'missing account falls back to the default');
});

group('Search terms with spaces and punctuation survive encoding', () => {
  const state = defaultViewState('acct-work-01');
  state.search = 'invoice #4471, remittance & bank details';
  const round = parseViewState(`?${serialiseViewState(state)}`, DEFAULT_ACCOUNT_ID);
  assertEqual(round.search, state.search, 'search is encoded and decoded intact');
});

// ------------------------------------------------- account separation

group('Work and personal never merge', () => {
  const work = SYNTHETIC_ACCOUNTS.find((a) => a.accountType === 'work');
  const personal = SYNTHETIC_ACCOUNTS.find((a) => a.accountType === 'personal');

  assert(Boolean(work && personal), 'both account types exist in the synthetic set');
  if (!work || !personal) return;

  const workItems = SYNTHETIC_ITEMS_BY_ACCOUNT[work.id] ?? [];
  const personalItems = SYNTHETIC_ITEMS_BY_ACCOUNT[personal.id] ?? [];

  assert(workItems.length > 0, 'the work account has threads');
  assert(personalItems.length > 0, 'the personal account has threads');

  assert(
    workItems.every((item) => item.accountId === work.id && item.accountType === 'work'),
    'every work thread is stamped with the work account'
  );
  assert(
    personalItems.every(
      (item) => item.accountId === personal.id && item.accountType === 'personal'
    ),
    'every personal thread is stamped with the personal account'
  );

  const workIds = new Set(workItems.map((i) => i.id));
  assert(
    personalItems.every((item) => !workIds.has(item.id)),
    'no thread identifier appears in both accounts'
  );

  const workPanels = syntheticPanels(work.id);
  const leaked = workPanels.flatMap((p) => p.items).filter((i) => i.accountType !== 'work');
  assertEqual(leaked.length, 0, 'no personal thread appears in a work panel');

  const personalPanels = syntheticPanels(personal.id);
  const leakedBack = personalPanels
    .flatMap((p) => p.items)
    .filter((i) => i.accountType !== 'personal');
  assertEqual(leakedBack.length, 0, 'no work thread appears in a personal panel');
});

group('A missing account substitutes visibly, never silently', () => {
  const missing = resolveAccount(SYNTHETIC_ACCOUNTS, 'acct-does-not-exist');
  assert(missing.account !== null, 'an account is still resolved');
  assertEqual(missing.substituted, true, 'the substitution is reported');

  const exact = resolveAccount(SYNTHETIC_ACCOUNTS, DEFAULT_ACCOUNT_ID);
  assertEqual(exact.substituted, false, 'an exact match is not reported as a substitution');

  const typed = resolveAccount(SYNTHETIC_ACCOUNTS, 'acct-missing', 'personal');
  assertEqual(
    typed.account?.accountType,
    'personal',
    'a preferred type is honoured when substituting'
  );

  const none = resolveAccount([], 'anything');
  assertEqual(none.account, null, 'no accounts resolves to null rather than inventing one');
});

// ------------------------------------------------------------- metrics

group('Metric cards are complete and honest', () => {
  const metrics = syntheticMetrics(DEFAULT_ACCOUNT_ID);
  assertEqual(metrics.length, 8, 'eight metric cards, as the brief requires');

  assert(
    metrics.every((m) => m.label.length > 0 && m.explanation.length > 0),
    'every card has a label and an explanation'
  );
  assert(
    metrics.every((m) => m.destination.startsWith('/email')),
    'every card navigates inside the module'
  );

  const security = metrics.find((m) => m.key === 'security_review');
  assertEqual(security?.emphasis, 'attention', 'security review is emphasised');
  assert(
    (security?.explanation ?? '').toLowerCase().includes('advisory'),
    'the security card states that detection is advisory'
  );

  assert(
    metrics.every((m) => !/\b(saved|save|minutes saved|faster)\b/i.test(m.explanation)),
    'no card claims a time saving'
  );
});

group('Metric states are exhaustive', () => {
  const loading = syntheticMetrics(DEFAULT_ACCOUNT_ID, 'loading');
  assert(
    loading.every((m) => m.state === 'loading' && m.count === null),
    'loading cards carry no count'
  );

  const errored = syntheticMetrics(DEFAULT_ACCOUNT_ID, 'error');
  assert(
    errored.every((m) => m.state === 'error' && Boolean(m.errorMessage)),
    'error cards carry a message a person can read'
  );

  const personal = syntheticMetrics('acct-personal-01');
  const zero = personal.find((m) => m.count === 0);
  assertEqual(zero?.state, 'empty', 'a count of zero renders as empty, not as an error');
});

// -------------------------------------------------------------- panels

group('Panels are complete and state aware', () => {
  const panels = syntheticPanels(DEFAULT_ACCOUNT_ID);
  assertEqual(panels.length, 7, 'seven panels, as the brief requires');

  assert(
    panels.every((p) => p.title.length > 0 && p.description.length > 0 && p.emptyMessage.length > 0),
    'every panel has a title, a description and an empty message'
  );
  assert(
    panels.every((p) => (p.state === 'ready' ? p.items.length > 0 : true)),
    'a ready panel always has at least one row'
  );
  assert(
    panels.every((p) => (p.items.length === 0 ? p.state !== 'ready' : true)),
    'an empty panel is never reported as ready'
  );

  const security = panels.find((p) => p.key === 'security_review');
  assert(
    (security?.emptyMessage ?? '').toLowerCase().includes('not proof'),
    'an empty security panel does not imply the inbox is safe'
  );

  const loading = syntheticPanels(DEFAULT_ACCOUNT_ID, 'loading');
  assert(loading.every((p) => p.state === 'loading' && p.items.length === 0), 'loading panels are empty');

  const errored = syntheticPanels(DEFAULT_ACCOUNT_ID, 'error');
  assert(
    errored.every((p) => p.state === 'error' && Boolean(p.errorMessage)),
    'error panels carry a message'
  );
});

group('Handle First is ordered by consequence', () => {
  // Updated in Stage 3. Ordering is by BAND first and score second, because the
  // escalation rules can raise a thread's band above what its raw score gives.
  // A suspected payment attack scores 69 and still belongs at the top.
  const BANDS = ['low', 'batch', 'soon', 'today', 'immediate'];
  const handleFirst = syntheticPanels(DEFAULT_ACCOUNT_ID).find((p) => p.key === 'handle_first');
  const items = handleFirst?.items ?? [];
  let ordered = true;
  for (let i = 1; i < items.length; i += 1) {
    const a = items[i - 1];
    const b = items[i];
    if (BANDS.indexOf(a.priorityBand) < BANDS.indexOf(b.priorityBand)) ordered = false;
    if (a.priorityBand === b.priorityBand && a.priorityScore < b.priorityScore) ordered = false;
  }
  assert(ordered, 'rows run loudest band first, then by score within a band');
  assert(items.length > 0, 'Handle First has rows in the synthetic work account');
});

group('Inferred dates are never presented as stated dates', () => {
  const everyItem = Object.values(SYNTHETIC_ITEMS_BY_ACCOUNT).flat();
  assert(
    everyItem.every((i) => (i.deadline === null ? i.deadlineIsExplicit === false : true)),
    'a thread with no deadline is never marked as having an explicit one'
  );
  assert(
    everyItem.every((i) => typeof i.deadlineIsExplicit === 'boolean'),
    'every thread records whether its date was stated or inferred'
  );
});

group('Priority reasons name a consequence', () => {
  const everyItem = Object.values(SYNTHETIC_ITEMS_BY_ACCOUNT).flat();
  // Updated in Stage 3. A newsletter or an acknowledgement carries no reasons,
  // because there is no consequence to name and a blank line under a row tells
  // the person nothing. The promise that matters is narrower: anything the
  // module actually puts in front of you says why it is there.
  const inQueues = syntheticPanels(DEFAULT_ACCOUNT_ID)
    .filter((p) => p.key !== 'inbox_intelligence')
    .flatMap((p) => p.items);
  assert(
    everyItem.every((i) => i.priorityReasons.length <= 3),
    'no thread carries more than three reasons'
  );
  assert(
    inQueues.every((i) => i.priorityReasons.length >= 1),
    'every thread shown in a queue says why it is there'
  );
  assert(
    everyItem.every((i) => i.priorityReasons.every((r) => r.length > 3)),
    'no reason is a single word'
  );
  assert(
    everyItem.every((i) => i.priorityScore >= 0 && i.priorityScore <= 100),
    'every score is within 0 to 100'
  );
});

// ---------------------------------------------------------- navigation

group('Navigation is complete and internal', () => {
  // Ten in Stage 1, eleven from Stage 7, which added Clear Backlog so a paused
  // backlog session can be reopened from a URL rather than only from inside a
  // mode on the Overview page.
  assertEqual(EMAIL_MODULE_DESTINATIONS.length, 11, 'eleven module destinations');
  assertEqual(EMAIL_SAVED_VIEWS.length, 8, 'eight saved views');

  assert(
    EMAIL_MODULE_DESTINATIONS.every((d) => d.path.startsWith('/email')),
    'every destination is inside the module'
  );
  assert(
    EMAIL_MODULE_DESTINATIONS.every((d) => d.accessibleDescription.length > 10),
    'every destination has a description for a screen reader'
  );

  const paths = EMAIL_MODULE_DESTINATIONS.map((d) => d.path);
  assertEqual(new Set(paths).size, paths.length, 'no duplicate paths');

  assertEqual(destinationForPath('/email').label, 'Overview', 'the root resolves to Overview');
  assertEqual(
    destinationForPath('/email/security-review').label,
    'Security Review',
    'a child path resolves to its own destination'
  );
  assertEqual(
    destinationForPath('/email/unknown-child').label,
    'Overview',
    'an unknown child falls back to Overview rather than throwing'
  );
});

// ------------------------------------------------------- scroll memory

group('Scroll memory is per path and never negative', () => {
  clearRememberedScroll();
  assertEqual(recallScroll('/email'), 0, 'an unseen path starts at the top');

  rememberScroll('/email', 420.6);
  rememberScroll('/email/waiting', 88);
  assertEqual(recallScroll('/email'), 421, 'offsets are rounded');
  assertEqual(recallScroll('/email/waiting'), 88, 'paths are remembered independently');

  rememberScroll('/email', -50);
  assertEqual(recallScroll('/email'), 0, 'a negative offset is clamped');

  clearRememberedScroll();
  assertEqual(recallScroll('/email'), 0, 'clearing resets every path');
});

// -------------------------------------------------------------- report

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre Stage 2 shell: all checks passed.');
