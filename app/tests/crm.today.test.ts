/**
 * Concludo CRM, Stage 2: the Today composition.
 *
 * The brief's two hardest requirements are tested here, because neither
 * survives on discipline alone:
 *
 * 1. **Every item explains why it appears.** Asserted on every item in every
 *    panel, and the reason has to name something specific rather than restate
 *    the title.
 * 2. **No anxiety-producing language.** Every string the composition can
 *    render is scanned, not just the ones somebody remembered to check.
 *
 * It also holds the lesson from the Email Command Centre's dashboard, which
 * showed the single most consequential thread four times across four panels
 * before it was rebuilt: **nothing appears twice on this page.**
 *
 * Run: bun app/tests/crm.today.test.ts
 */
import { CRM_DATASET } from '../src/lib/crm/data/workspace';
import { CRM_DEFAULT_VIEW_STATE } from '../src/lib/crm/viewState';
import { PANEL_SIZE, composeToday, todayStrings } from '../src/lib/crm/today';
import { APPROVED_PHRASES, checkLanguage } from '../src/lib/crm/language';
import { CRM_MODULE_PATHS } from '../src/lib/crm/moduleNav';

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

const composition = composeToday(CRM_DATASET, CRM_DEFAULT_VIEW_STATE);
const allItems = composition.panels.flatMap((panel) => panel.items);

// ------------------------------------------------------------ the shape

group('Today has the twelve cards and the ten panels the brief asks for', () => {
  assertEqual(composition.cards.length, 12, 'twelve dashboard cards');
  assertEqual(composition.panels.length, 10, 'ten panels');

  const expectedPanels = [
    'Handle first',
    'Follow-ups due',
    'Commitments and promises',
    'New relationships',
    'Pipeline movement',
    'Meetings requiring follow-through',
    'Customers that may need attention',
    'AI proposal queue',
    'Data quality review',
    'Upcoming renewals',
  ];
  for (const title of expectedPanels) {
    assert(
      composition.panels.some((panel) => panel.title === title),
      `the "${title}" panel exists`
    );
  }

  assertEqual(composition.panels[0].title, 'Handle first', 'Handle first leads the page');
  assert(
    composition.panels.every((panel) => panel.items.length <= PANEL_SIZE),
    'no panel draws more than four rows'
  );
  assert(
    composition.panels.every((panel) => panel.total >= panel.items.length),
    'every panel reports a true total at least as large as what it drew'
  );
});

// -------------------------------------------------- no decorative numbers

group('No card is a number with nowhere to go', () => {
  for (const card of composition.cards) {
    assert(card.label.trim().length > 0, `card ${card.key} has a label`);
    assert(card.note.trim().length > 15, `card ${card.key} says why the count matters`);
    assert(
      CRM_MODULE_PATHS.includes(card.destination),
      `card ${card.key} leads to a destination that exists`
    );
    assert(Number.isInteger(card.count) && card.count >= 0, `card ${card.key} has a whole count`);
    assert(
      !card.note.toLowerCase().includes(card.label.toLowerCase()),
      `card ${card.key} does not restate its own label as the note`
    );
  }

  // The brief's twelve, by subject rather than by wording.
  const subjects = [
    'relationships_attention',
    'new_leads',
    'follow_ups',
    'commitments_due',
    'at_risk',
    'meetings_outstanding',
    'service_issues',
    'proposals',
    'records_review',
    'duplicates',
    'renewals',
    'missing_next_steps',
  ];
  for (const key of subjects) {
    assert(
      composition.cards.some((card) => card.key === key),
      `a card exists for ${key}`
    );
  }
});

// -------------------------------------------------- every item has a reason

group('Every item explains why it appears', () => {
  assert(allItems.length > 20, 'there are enough items for the check to mean something');

  for (const item of allItems) {
    assert(item.title.trim().length > 0, `item ${item.id} has a title`);
    assert(item.context.trim().length > 0, `item ${item.id} says what it belongs to`);
    assert(
      (APPROVED_PHRASES as readonly string[]).includes(item.standing),
      `item ${item.id} uses one of the approved phrases, not an invented one`
    );
    assert(item.reason.trim().length > 15, `item ${item.id} carries a real reason`);
    assert(
      item.reason.trim() !== item.title.trim(),
      `item ${item.id} does not restate its title as the reason`
    );
    assert(
      CRM_MODULE_PATHS.includes(item.destination),
      `item ${item.id} leads to a destination that exists`
    );
    assert(
      ['open', 'waiting', 'review', 'none'].includes(item.statusShape),
      `item ${item.id} has a status shape, so status is never colour alone`
    );
  }

  // The reasons are specific, not boilerplate. A reason that appears on more
  // than a third of the items is a template rather than an explanation.
  const counts = new Map<string, number>();
  for (const item of allItems) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  const worst = [...counts.values()].sort((a, b) => b - a)[0] ?? 0;
  assert(
    worst <= Math.ceil(allItems.length / 3),
    `no single reason is reused across more than a third of the items (worst was ${worst} of ${allItems.length})`
  );
});

// ----------------------------------------------------- nothing repeats

group('Nothing appears twice on the page', () => {
  // The defect this prevents: the Email Command Centre's dashboard showed one
  // invoice thread in four separate panels, which made the inbox look larger
  // than it was and buried the thing that mattered among copies of itself.
  const titles = allItems.map((item) => `${item.title}|${item.context}`);
  const unique = new Set(titles);
  assertEqual(unique.size, titles.length, 'no item is drawn twice across the ten panels');

  const handleFirst = composition.panels[0];
  assert(handleFirst.items.length > 0, 'Handle first has something in it');
  assertEqual(handleFirst.alreadyShown, 0, 'Handle first claims nothing from itself');

  // Every panel that Handle first took from reports what it gave up, so the
  // count a reader sees is still the true count.
  const gave = composition.panels.filter((panel) => panel.alreadyShown > 0);
  assert(gave.length > 0, 'at least one panel reports an item shown in Handle first');
  for (const panel of gave) {
    assert(
      panel.total > panel.items.length,
      `${panel.title} still reports its true total after giving one up`
    );
  }

  // Handle first draws from more than one source, which is its whole purpose.
  const standings = new Set(handleFirst.items.map((item) => item.standing));
  assert(standings.size >= 3, 'Handle first gathers from several places rather than one list');
});

// --------------------------------------------------------- the language

group('No banned language reaches the page', () => {
  const strings = todayStrings(composition);
  assert(strings.length > 150, 'the scan covers the whole composition');

  let offenders = 0;
  for (const text of strings) {
    const broken = checkLanguage(text);
    if (broken.length > 0) {
      offenders += 1;
      console.error(`  FAIL  "${text}" breaks: ${broken.map((r) => r.reason).join(' ')}`);
    }
  }
  checks += 1;
  if (offenders > 0) failures += 1;
  assert(offenders === 0, 'no string in the composition breaks a language rule');

  assertEqual(
    strings.filter((text) => text.includes('\u2014')).length,
    0,
    'no em dash in the composition'
  );
});

// ----------------------------------------------------- filters apply

group('The composition answers to the filters', () => {
  const narrowed = composeToday(CRM_DATASET, {
    ...CRM_DEFAULT_VIEW_STATE,
    organisationId: 'org-03',
    dateRange: 'all',
  });
  const narrowedItems = narrowed.panels.flatMap((panel) => panel.items);
  assert(narrowedItems.length > 0, 'narrowing to one organisation still shows something');
  assert(
    narrowedItems.length < allItems.length,
    'narrowing to one organisation shows less than the whole workspace'
  );

  const byOwner = composeToday(CRM_DATASET, {
    ...CRM_DEFAULT_VIEW_STATE,
    owner: 'Tom Whitfield',
    dateRange: 'all',
  });
  assert(
    byOwner.panels.flatMap((p) => p.items).length < allItems.length,
    'filtering by owner narrows the page'
  );

  // The proposals count is deliberately not filtered by organisation: a
  // proposal awaiting a decision does not stop existing because the reader
  // narrowed their view to a different account.
  assertEqual(
    narrowed.awaitingConfirmation,
    composition.awaitingConfirmation,
    'the proposals indicator counts every proposal, whatever the filters'
  );
});

// ------------------------------------------------------ the empty case

group('An empty workspace says so, and says it as an outcome', () => {
  const empty = composeToday(
    {
      ...CRM_DATASET,
      organisations: [],
      people: [],
      leads: [],
      records: [],
      activities: [],
      commitments: [],
      serviceIssues: [],
      accountPlans: [],
      proposals: [],
      duplicates: [],
      reviewItems: [],
    },
    CRM_DEFAULT_VIEW_STATE
  );

  assertEqual(empty.allClear, true, 'an empty workspace reports all clear');
  assertEqual(empty.cards.length, 12, 'the cards are still there, reading zero');
  assert(
    empty.cards.every((card) => card.count === 0),
    'every card reads zero rather than disappearing'
  );
  assert(
    empty.panels.every((panel) => panel.items.length === 0),
    'every panel is empty'
  );
  assert(
    empty.panels.every((panel) => panel.emptyMessage.trim().length > 10),
    'every panel says what its emptiness means'
  );
  assert(
    empty.panels.every((panel) => checkLanguage(panel.emptyMessage).length === 0),
    'no empty message uses banned language'
  );
  // An empty message is an outcome, not a failure or an instruction.
  assert(
    empty.panels.every((panel) => !/^(add|create|get started|set up)/i.test(panel.emptyMessage)),
    'an empty panel reports a state rather than issuing an instruction'
  );
});

// -------------------------------------------------------------- report

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Concludo CRM Stage 2 Today: all checks passed.');
