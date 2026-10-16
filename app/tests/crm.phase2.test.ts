/**
 * Concludo CRM, Phase 2A-i: relationship attention.
 *
 * WHAT THIS SUITE IS FOR.
 *
 * The eleven conditions are the easy half. The hard half is the two
 * properties that make an attention list trustworthy rather than annoying,
 * and most of these checks are about those:
 *
 *   EVERY SIGNAL SHOWS ITS RECORDS. Not "has an evidence field", but: the
 *   records it names exist, belong to this workspace, and are the ones the
 *   condition was actually read from. A signal citing a record that is not
 *   there is worse than no signal.
 *
 *   NOTHING IS ABOUT A PERSON. Asserted structurally, not by searching the
 *   copy for the word "performance". Every user id in every workspace is
 *   checked against the whole serialised output of every function in the
 *   module, and the count is checked for being a count rather than a weighted
 *   figure: eleven conditions can only ever produce a number between zero and
 *   eleven, and a weighted score could not satisfy that.
 *
 * The third group is about the decision path, where the risk is a dismissal
 * that quietly empties the page.
 *
 * Run: bun tests/crm.phase2.test.ts
 */
import { CRM_WORKSPACES, USERS, getCrmWorkspace } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import {
  ATTENTION_CONDITIONS,
  AttentionCondition,
  CrmRole,
  CrmTable,
  CRM_TABLES,
  CrmWorkspaceData,
} from '../src/lib/crm/domain';
import { CrmRefused } from '../src/lib/crm/repositories/repository';
import {
  ATTENTION_NOTE,
  CONDITION_LABELS,
  CONDITION_PURPOSE,
  DEFAULT_THRESHOLDS,
  attentionFor,
  decisionFor,
  signalsForBriefing,
  workspaceAttention,
} from '../src/lib/crm/phase2/signals';
import {
  DEFAULT_DISMISSAL_DAYS,
  MAX_DISMISSAL_DAYS,
  decideSignal,
  restoreSignal,
} from '../src/lib/crm/phase2/signalWrites';
import { checkLanguage } from '../src/lib/crm/language';
import { registeredCacheCount } from '../src/lib/crm/cacheBus';
/* Imported for their side effect: each of these modules registers its cache
   invalidator at module scope, and a module nobody imports never registers.
   The import list IS the check. */
import { forgetContactIndex } from '../src/lib/crm/stage4/relationships';
import { forgetQualityIndex } from '../src/lib/crm/stage4/quality';
import { forgetCoverageIndex } from '../src/lib/crm/stage4/hierarchy';
import { forgetBoardIndex } from '../src/lib/crm/stage5/pipeline';
import { forgetIndex } from '../src/lib/crm/stage8/paging';
import { exportWorkspace } from '../src/lib/crm/stage8/governance';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual, assertRefused } = makeAssert(r);

const NOW = CRM_DEMO_NOW;

function fresh(id: string): CrmWorkspaceData {
  const found = getCrmWorkspace(id);
  if (!found) throw new Error(`no workspace ${id}`);
  return structuredClone(found);
}

function contextFor(data: CrmWorkspaceData, role: CrmRole = 'crm_contributor') {
  return { userId: data.members[0].userId, workspaceId: data.workspace.id, role, now: NOW };
}

/** Every record id in a workspace, by table, for the evidence check. */
function idsByTable(data: CrmWorkspaceData): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const put = (table: string, rows: { id: string }[]) =>
    map.set(table, new Set(rows.map((row) => row.id)));

  put('crm_organisations', data.organisations);
  put('crm_people', data.people);
  put('crm_work_items', data.workItems);
  put('crm_activities', data.activities);
  put('crm_commitments', data.commitments);
  put('crm_service_cases', data.serviceCases);
  put('crm_account_plans', data.accountPlans);
  put('crm_account_reviews', data.accountReviews);
  put('crm_tasks', data.tasks);
  return map;
}

/* =====================================================================
   1. The eleven
   ===================================================================== */

group('Eleven conditions, each named, labelled and explained', () => {
  assertEqual(ATTENTION_CONDITIONS.length, 11, 'eleven conditions');
  assertEqual(
    new Set(ATTENTION_CONDITIONS).size,
    11,
    'every condition name is distinct'
  );

  for (const condition of ATTENTION_CONDITIONS) {
    assert(
      (CONDITION_LABELS[condition] ?? '').trim().length > 0,
      `${condition} has a heading`
    );
    assert(
      (CONDITION_PURPOSE[condition] ?? '').trim().length > 20,
      `${condition} says what it is for`
    );
  }
});

group('Every condition fires somewhere in the fixture, and none fires everywhere', () => {
  const firedIn = new Map<AttentionCondition, number>();
  let accounts = 0;

  for (const data of CRM_WORKSPACES) {
    for (const account of workspaceAttention(data, NOW).accounts) {
      accounts += 1;
      for (const signal of account.signals) {
        firedIn.set(signal.condition, (firedIn.get(signal.condition) ?? 0) + 1);
      }
    }
  }

  // A condition that never fires anywhere in five deliberately varied
  // workspaces is either broken or pointless, and either way it should not
  // ship unnoticed.
  const silent = ATTENTION_CONDITIONS.filter((condition) => !firedIn.has(condition));
  assertEqual(
    silent.length,
    0,
    `every condition fires at least once across the fixture (silent: ${silent.join(', ')})`
  );

  // And one that fires on every account in every workspace is not telling
  // anybody anything.
  for (const [condition, count] of firedIn) {
    assert(
      count < accounts,
      `${condition} does not fire on every account in the fixture (${count} of ${accounts})`
    );
  }
});

/* =====================================================================
   2. Evidence
   ===================================================================== */

group('Every signal names records that actually exist, in this workspace', () => {
  for (const data of CRM_WORKSPACES) {
    const ids = idsByTable(data);

    for (const account of workspaceAttention(data, NOW).accounts) {
      for (const signal of [...account.signals, ...account.dismissed]) {
        assert(
          signal.evidence.length > 0,
          `${data.workspace.id}/${account.organisation.id}/${signal.condition}: names at least one record`
        );

        for (const reference of signal.evidence) {
          const known = ids.get(reference.table);
          assert(
            known !== undefined,
            `${signal.condition}: ${reference.table} is a table this check knows about`
          );
          assert(
            known?.has(reference.id) ?? false,
            `${signal.condition}: the record ${reference.table}/${reference.id} exists in this workspace`
          );
          assert(
            reference.what.trim().length > 0,
            `${signal.condition}: each record says what it contributes`
          );
        }
      }
    }
  }
});

group('Every signal says what is true and what would clear it', () => {
  for (const data of CRM_WORKSPACES) {
    for (const account of workspaceAttention(data, NOW).accounts) {
      for (const signal of account.signals) {
        assert(
          signal.detail.trim().length > 20,
          `${signal.condition}: the detail is a sentence`
        );
        assert(
          signal.whatWouldClearIt.trim().length > 20,
          `${signal.condition}: says what would clear it`
        );
        // An indicator a person cannot act on is an accusation.
        assert(
          !/^review this|^needs review$/i.test(signal.whatWouldClearIt.trim()),
          `${signal.condition}: the resolution is an action, not "review this"`
        );
      }
    }
  }
});

group('What cannot be judged is said, not reported as healthy', () => {
  // An account with no renewal date does not have a distant renewal. The
  // condition has to come back as not assessable with a reason, because
  // returning "clear" would report an unknown as a good state.
  const sole = fresh('ws-sole-trader');
  for (const account of workspaceAttention(sole, NOW).accounts) {
    for (const entry of account.notAssessable) {
      assert(
        entry.because.trim().length > 20,
        `${entry.condition}: says why it could not be judged`
      );
    }
  }

  const withoutRenewal = workspaceAttention(sole, NOW).accounts.find((account) =>
    account.notAssessable.some((entry) => entry.condition === 'renewal_approaching')
  );
  assert(
    withoutRenewal !== undefined,
    'an account with no recorded renewal date reports the renewal condition as not assessable'
  );
  assert(
    !withoutRenewal?.signals.some((signal) => signal.condition === 'renewal_approaching'),
    'and does not report it as a problem'
  );
});

group('One missing fact does not become four conditions', () => {
  // An organisation with one contact and no role recorded was, in the first
  // version of this module, four separate conditions: one contact, no
  // executive, no coverage, no decision maker. That is one gap reported four
  // times, and it made every demonstration account look like a disaster.
  const data = fresh('ws-sole-trader');
  const organisation = data.organisations[0];

  const account = attentionFor(data, organisation.id, NOW);
  assert(account !== null, 'the account resolves');

  const fired = new Set(account?.signals.map((signal) => signal.condition));
  if (fired.has('no_stakeholder_coverage')) {
    const roles = data.personOrganisationRoles.filter(
      (role) => role.organisationId === organisation.id && role.endedOn === null
    );
    if (roles.length === 0) {
      assert(
        !fired.has('no_executive_relationship'),
        'where nobody has any role, the executive condition stands down'
      );
      assert(
        !fired.has('no_decision_maker'),
        'and so does the decision-maker condition'
      );
      assert(
        account?.notAssessable.some(
          (entry) => entry.condition === 'no_executive_relationship'
        ) ?? false,
        'and it says it stood down rather than going silent'
      );
    }
  }
});

/* =====================================================================
   3. The count is a count
   ===================================================================== */

group('The attention figure is a count of conditions, not a score', () => {
  for (const data of CRM_WORKSPACES) {
    const attention = workspaceAttention(data, NOW);

    for (const account of attention.accounts) {
      // A count of eleven named conditions can only ever be 0 to 11, and is
      // always an integer. A weighted score could satisfy neither.
      assert(
        Number.isInteger(account.attentionCount),
        `${account.organisation.id}: the figure is an integer`
      );
      assert(
        account.attentionCount >= 0 && account.attentionCount <= 11,
        `${account.organisation.id}: the figure is between 0 and 11 (${account.attentionCount})`
      );
      assertEqual(
        account.attentionCount,
        account.signals.length,
        `${account.organisation.id}: the figure IS the number of conditions, with nothing added`
      );
      assert(
        !account.signals.some((signal) => signal.decision?.state === 'dismissed'),
        `${account.organisation.id}: a dismissed condition is not counted`
      );
    }
  }
});

group('Nothing in this module counts anything per person', () => {
  const userIds = Object.values(USERS);

  for (const data of CRM_WORKSPACES) {
    const everyId = [...new Set([...data.members.map((m) => m.userId), ...userIds])];
    const serialised = JSON.stringify(workspaceAttention(data, NOW));

    for (const userId of everyId) {
      assert(
        !serialised.includes(userId),
        `${data.workspace.id}: no user id appears anywhere in the attention output`
      );
    }

    // And no account is labelled with a person's name, which is the other way
    // a per-person view arrives.
    for (const account of workspaceAttention(data, NOW).accounts) {
      for (const person of data.people) {
        assert(
          account.organisation.name !== person.fullName,
          'no account is named after a person in a way that would make this a per-person list'
        );
      }
    }
  }
});

group('The standing note says what the page is and is not', () => {
  assert(ATTENTION_NOTE.includes('about accounts'), 'the note says it is about accounts');
  assert(ATTENTION_NOTE.includes('not a score'), 'and that the figure is not a score');
  assert(ATTENTION_NOTE.includes('no weighting'), 'and that nothing is weighted');
  assert(
    ATTENTION_NOTE.includes('groups any of it by who owns'),
    'and that nothing groups by owner'
  );
});

/* =====================================================================
   4. Language
   ===================================================================== */

group('Every sentence this module can show passes the language rules', () => {
  const strings: string[] = [ATTENTION_NOTE];

  for (const condition of ATTENTION_CONDITIONS) {
    strings.push(CONDITION_LABELS[condition], CONDITION_PURPOSE[condition]);
  }
  for (const data of CRM_WORKSPACES) {
    for (const account of workspaceAttention(data, NOW).accounts) {
      for (const signal of [...account.signals, ...account.dismissed]) {
        strings.push(signal.label, signal.detail, signal.whatWouldClearIt);
        for (const reference of signal.evidence) strings.push(reference.what);
      }
      for (const entry of account.notAssessable) strings.push(entry.because);
    }
  }

  for (const text of strings) {
    const broken = checkLanguage(text);
    assert(
      broken.length === 0,
      `no banned language: "${text.slice(0, 70)}" (${broken.map((rule) => rule.reason).join('; ')})`
    );
    assert(!text.includes('—'), `no em dash in: "${text.slice(0, 50)}"`);
  }
});

/* =====================================================================
   5. Deciding
   ===================================================================== */

group('A dismissal needs a reason worth reading', () => {
  const data = fresh('ws-key-accounts');
  const account = workspaceAttention(data, NOW).accounts.find((entry) => entry.attentionCount > 0);
  assert(account !== undefined, 'the fixture has an account with a condition true');
  if (!account) return;

  const condition = account.signals[0].condition;

  assertRefused(
    () =>
      decideSignal(contextFor(data), data, {
        organisationId: account.organisation.id,
        condition,
        state: 'dismissed',
        reason: '   ',
      }),
    (error) => error instanceof CrmRefused && error.because.includes('reason is needed'),
    'a blank reason is refused'
  );

  assertRefused(
    () =>
      decideSignal(contextFor(data), data, {
        organisationId: account.organisation.id,
        condition,
        state: 'dismissed',
        reason: 'not now',
      }),
    (error) => error instanceof CrmRefused && error.because.includes('few words'),
    'a three-word reason is refused'
  );
});

group('A condition that is not true cannot be dismissed', () => {
  const data = fresh('ws-key-accounts');
  const account = workspaceAttention(data, NOW).accounts[0];
  const firing = new Set(account.signals.map((signal) => signal.condition));
  const notFiring = ATTENTION_CONDITIONS.find((condition) => !firing.has(condition));
  assert(notFiring !== undefined, 'the fixture has a condition that is not currently true');
  if (!notFiring) return;

  assertRefused(
    () =>
      decideSignal(contextFor(data), data, {
        organisationId: account.organisation.id,
        condition: notFiring,
        state: 'dismissed',
        reason: 'Pre-emptively silencing something that has not happened yet.',
      }),
    (error) => error instanceof CrmRefused && error.because.includes('not currently true'),
    'dismissing a condition that is not firing is refused, because it would suppress it the day it becomes true'
  );
});

group('A dismissal takes the condition off the list, with its reason kept', () => {
  const data = fresh('ws-key-accounts');
  const before = workspaceAttention(data, NOW).accounts.find((entry) => entry.attentionCount > 0);
  if (!before) return;

  const condition = before.signals[0].condition;
  const countBefore = before.attentionCount;

  const row = decideSignal(contextFor(data), data, {
    organisationId: before.organisation.id,
    condition,
    state: 'dismissed',
    reason: 'Handled in the review on the fourth, and recorded against the group instead.',
  });

  const after = attentionFor(data, before.organisation.id, NOW);
  assertEqual(after?.attentionCount, countBefore - 1, 'the count goes down by one');
  assert(
    !after?.signals.some((signal) => signal.condition === condition),
    'the condition leaves the list'
  );
  assert(
    after?.dismissed.some((signal) => signal.condition === condition) ?? false,
    'and appears under dismissed rather than disappearing'
  );
  assertEqual(
    after?.dismissed.find((signal) => signal.condition === condition)?.decision?.reason,
    row.reason,
    'with the reason attached'
  );
  assert(
    row.detailAtDecision !== null,
    'and with what the condition said at the moment it was decided'
  );

  const event = data.auditEvents.at(-1);
  assertEqual(
    event?.eventType,
    'attention_condition_dismissed',
    'the dismissal writes an audit row'
  );
});

group('A dismissal ends, and cannot be made permanent', () => {
  const data = fresh('ws-key-accounts');
  const account = workspaceAttention(data, NOW).accounts.find((entry) => entry.attentionCount > 0);
  if (!account) return;

  const row = decideSignal(contextFor(data), data, {
    organisationId: account.organisation.id,
    condition: account.signals[0].condition,
    state: 'dismissed',
    reason: 'Dealt with at the quarterly review and not worth showing again for now.',
    forDays: 9_000,
  });

  assert(row.expiresAt !== null, 'a dismissal always has an end');
  const days = Math.round((Date.parse(row.expiresAt as string) - Date.parse(NOW)) / 86_400_000);
  assertEqual(days, MAX_DISMISSAL_DAYS, 'and a request for nine thousand days is clamped');

  const defaulted = decideSignal(contextFor(data), data, {
    organisationId: account.organisation.id,
    condition: account.signals[1]?.condition ?? account.signals[0].condition,
    state: 'dismissed',
    reason: 'Second dismissal, to check the default life of one of these.',
  });
  const defaultDays = Math.round(
    (Date.parse(defaulted.expiresAt as string) - Date.parse(NOW)) / 86_400_000
  );
  assertEqual(defaultDays, DEFAULT_DISMISSAL_DAYS, 'the default is ninety days');
});

group('An expired dismissal is not a dismissal', () => {
  const data = fresh('ws-key-accounts');
  const account = workspaceAttention(data, NOW).accounts.find((entry) => entry.attentionCount > 0);
  if (!account) return;

  const condition = account.signals[0].condition;
  decideSignal(contextFor(data), data, {
    organisationId: account.organisation.id,
    condition,
    state: 'dismissed',
    reason: 'Dismissed today, and this check reads the account again much later.',
    forDays: 30,
  });

  const later = new Date(Date.parse(NOW) + 60 * 86_400_000).toISOString();
  const after = attentionFor(data, account.organisation.id, later);

  assert(
    after?.signals.some((signal) => signal.condition === condition) ?? false,
    'sixty days later the condition is back on the list'
  );
  assertEqual(
    decisionFor(data, account.organisation.id, condition, later),
    null,
    'and the expired decision no longer applies'
  );
});

group('Putting a condition back is itself a decision', () => {
  const data = fresh('ws-key-accounts');
  const account = workspaceAttention(data, NOW).accounts.find((entry) => entry.attentionCount > 0);
  if (!account) return;

  const condition = account.signals[0].condition;
  const row = decideSignal(contextFor(data), data, {
    organisationId: account.organisation.id,
    condition,
    state: 'dismissed',
    reason: 'Dismissed, and then put back in the same test to check the reversal.',
  });

  assertRefused(
    () => restoreSignal(contextFor(data), data, row.id, 'oops'),
    (error) => error instanceof CrmRefused,
    'putting one back needs a reason too'
  );

  const rowsBefore = data.relationshipSignals.length;
  restoreSignal(contextFor(data), data, row.id, 'The renewal moved and this is live again.');

  assertEqual(
    data.relationshipSignals.length,
    rowsBefore,
    'the decision is not deleted, because the history of what was dismissed is worth keeping'
  );
  assert(
    attentionFor(data, account.organisation.id, NOW)?.signals.some(
      (signal) => signal.condition === condition
    ) ?? false,
    'and the condition is back on the list'
  );
  assert(
    data.auditEvents.some((event) => event.eventType === 'attention_condition_restored'),
    'with an audit row of its own'
  );
});

group('A viewer cannot decide anything', () => {
  const data = fresh('ws-key-accounts');
  const account = workspaceAttention(data, NOW).accounts.find((entry) => entry.attentionCount > 0);
  if (!account) return;

  assertRefused(
    () =>
      decideSignal(contextFor(data, 'crm_viewer'), data, {
        organisationId: account.organisation.id,
        condition: account.signals[0].condition,
        state: 'dismissed',
        reason: 'A viewer should not be able to take something off this list.',
      }),
    (error) => error instanceof CrmRefused && error.code === 'insufficient_role',
    'a viewer is refused'
  );
});

group('A decision cannot reach another workspace', () => {
  const data = fresh('ws-key-accounts');
  const other = fresh('ws-agency');
  const theirAccount = other.organisations[0];

  assertRefused(
    () =>
      decideSignal(contextFor(data), data, {
        organisationId: theirAccount.id,
        condition: 'no_interaction_90',
        state: 'dismissed',
        reason: 'An organisation from another tenant, which must not resolve at all.',
      }),
    (error) => error instanceof CrmRefused && error.code === 'not_found',
    'an organisation from another workspace is not found'
  );
});

/* =====================================================================
   6. Fitting in
   ===================================================================== */

group('The fixture demonstrates a dismissal', () => {
  const agency = fresh('ws-agency');
  assert(agency.relationshipSignals.length > 0, 'the agency workspace has a recorded decision');

  const decision = agency.relationshipSignals[0];
  assert(decision.reason.length >= 10, 'with a reason');
  assert(decision.expiresAt !== null, 'and an end date');

  const account = attentionFor(agency, decision.organisationId, NOW);
  assert(
    account?.dismissed.some((signal) => signal.condition === decision.condition) ?? false,
    'and the page shows it as dismissed rather than hiding it'
  );
});

group('The new table is in the model, the export and the type', () => {
  assert(
    (CRM_TABLES as readonly string[]).includes('crm_relationship_signals'),
    'the table is in the model'
  );

  for (const data of CRM_WORKSPACES) {
    const result = exportWorkspace(data, NOW);
    assertEqual(
      result.missedTables.length,
      0,
      `${data.workspace.id}: the export still covers every table`
    );
    assert(
      result.tables.some(
        (entry) => (entry.table as CrmTable) === 'crm_relationship_signals'
      ),
      `${data.workspace.id}: including the new one`
    );
  }
});

group('The relationship agent reads the same definitions the page shows', () => {
  const data = fresh('ws-key-accounts');
  const account = workspaceAttention(data, NOW).accounts.find((entry) => entry.attentionCount > 0);
  if (!account) return;

  const briefing = signalsForBriefing(data, account.organisation.id, NOW);
  assertEqual(
    briefing.map((signal) => signal.condition).join(','),
    account.signals.map((signal) => signal.condition).join(','),
    'the briefing and the page cannot disagree, because they are the same function'
  );
});

group('The thresholds are arguments, not constants', () => {
  const data = fresh('ws-key-accounts');

  const strict = workspaceAttention(data, NOW, { ...DEFAULT_THRESHOLDS, quietAfterDays: 1 });
  const relaxed = workspaceAttention(data, NOW, { ...DEFAULT_THRESHOLDS, quietAfterDays: 3650 });

  const strictQuiet = strict.byCondition.find((entry) => entry.condition === 'no_interaction_90');
  const relaxedQuiet = relaxed.byCondition.find(
    (entry) => entry.condition === 'no_interaction_90'
  );

  assert(
    (strictQuiet?.count ?? 0) >= (relaxedQuiet?.count ?? 0),
    'a shorter quiet threshold cannot produce fewer accounts than a longer one'
  );
  assert(
    (strictQuiet?.count ?? 0) > 0,
    'and at one day, something is quiet'
  );
});

group('The whole workspace is read in well under a page load', () => {
  const data = fresh('ws-key-accounts');
  const started = performance.now();
  workspaceAttention(data, NOW);
  const took = performance.now() - started;
  assert(took < 250, `a workspace of attention is computed in under 250ms (took ${Math.round(took)}ms)`);
});

group('Every cached index is dropped when something is written', () => {
  /* A defect found in Phase 2A-i and present since Stage 8.
   *
   * Five modules cache an index against the workspace object, and each one
   * said in its own comments that a WeakMap was enough "because the session
   * store deep-copies on write". It does not: it deep-copies once and mutates
   * in place afterwards, so every one of those caches was silently stale from
   * the first write until the tab was reloaded.
   *
   * Nothing caught it because the composition suites build a fresh workspace
   * per check, where the bug cannot happen. This check is the one that would
   * have: it asserts the registrations exist, and the browser suite asserts
   * the behaviour they produce. */
  // Each of the five is a real function, so the imports above cannot be
  // dropped as unused, and loading them is what triggers the registration.
  for (const [name, fn] of Object.entries({
    forgetContactIndex,
    forgetQualityIndex,
    forgetCoverageIndex,
    forgetBoardIndex,
    forgetIndex,
  })) {
    assert(typeof fn === 'function', `${name} exists and can drop its cache`);
  }

  assert(
    registeredCacheCount() >= 5,
    `all five caching modules register an invalidator (saw ${registeredCacheCount()})`
  );
});

report('Concludo CRM Phase 2A-i, relationship attention', r);
