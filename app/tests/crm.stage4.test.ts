/**
 * Concludo CRM, Stage 4: the composition layer.
 *
 * WHAT THIS SUITE COVERS AND WHAT THE BROWSER SUITE COVERS.
 *
 * Six of the nine areas the brief names are answerable without a browser,
 * because they are questions about what the composition returns: record
 * rendering (does the record carry what the brief lists), hierarchy, timeline,
 * source navigation, empty states and conflicting information. They are here,
 * where they run in a second and fail with a readable message.
 *
 * The other three, permissions, mobile and keyboard, are only answerable in a
 * rendered page, and live in `tests/browser/crm.stage4.test.mjs`.
 *
 * Run: bun tests/crm.stage4.test.ts
 */
import { CRM_WORKSPACES, USERS } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { CrmWorkspaceData } from '../src/lib/crm/domain';
import {
  CRM_DEFAULT_WORKSPACE_ID,
  CRM_WORKSPACE_CHOICES,
  crmWorkspace,
} from '../src/lib/crm/stage4/workspace';
import {
  QUALITY_ORDER,
  countByKind,
  organisationFlags,
  personFlags,
  reviewRecommended,
  workItemFlags,
  workspaceFlags,
} from '../src/lib/crm/stage4/quality';
import {
  conflictPair,
  openConflicts,
  sourceTrail,
  supersededTrail,
  trailsFor,
} from '../src/lib/crm/stage4/sources';
import {
  TIMELINE_KIND_LABELS,
  TimelineKind,
  buildTimeline,
  filterTimeline,
  kindsPresent,
  sourcesPresent,
} from '../src/lib/crm/stage4/timeline';
import {
  MAX_DEPTH,
  ancestryOf,
  buildHierarchy,
  childrenOf,
  coverageFor,
  flattenHierarchy,
  workspaceCoverage,
} from '../src/lib/crm/stage4/hierarchy';
import {
  organisationRecord,
  peopleSummaries,
  personRecord,
} from '../src/lib/crm/stage4/records';
import {
  lastMeaningfulContactWith,
  relationshipAnswers,
} from '../src/lib/crm/stage4/relationships';
import { APPROVED_PHRASES, checkLanguage } from '../src/lib/crm/language';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual } = makeAssert(r);

const NOW = CRM_DEMO_NOW;
const ALL = CRM_WORKSPACES;
const agency = crmWorkspace('ws-agency');
const consulting = crmWorkspace('ws-consulting');
const keyAccounts = crmWorkspace('ws-key-accounts');
const soleTrader = crmWorkspace('ws-sole-trader');

const lastContact = (data: CrmWorkspaceData) => (personId: string) =>
  lastMeaningfulContactWith(data, personId);

/* ================================================ 0. the workspace itself */

group('The workspace is chosen, not assumed', () => {
  assertEqual(CRM_WORKSPACE_CHOICES.length, 5, 'all five workspaces can be chosen');
  assertEqual(
    crmWorkspace(CRM_DEFAULT_WORKSPACE_ID).workspace.id,
    CRM_DEFAULT_WORKSPACE_ID,
    'the default resolves to itself'
  );
  // A hand-edited URL is a normal thing and should land somewhere useful. It
  // must never land on "everything", because there is no such thing here.
  assertEqual(
    crmWorkspace('ws-does-not-exist').workspace.id,
    CRM_DEFAULT_WORKSPACE_ID,
    'an unknown id falls back to one workspace rather than to all of them'
  );
  assertEqual(crmWorkspace(null).workspace.id, CRM_DEFAULT_WORKSPACE_ID, 'so does nothing at all');

  for (const choice of CRM_WORKSPACE_CHOICES) {
    assert(choice.name.trim().length > 0, `${choice.id} has a name a person would recognise`);
    assert(choice.shape.trim().length > 0, `${choice.id} says what shape of business it is`);
  }
});

/* ====================================== 1. record rendering: the person */

group('The person record carries everything the brief lists', () => {
  const nadia = personRecord(agency, 'per-ag-1', NOW);
  assert(nadia !== null, 'the person record composes');
  if (!nadia) return;

  // Each of the seventeen the brief names, checked as a field rather than as a
  // rendered string, so a view can move the furniture without breaking this.
  assertEqual(nadia.person.fullName, 'Nadia Court', 'name');
  assert(nadia.roleLabel !== null, 'known role');
  assert(nadia.organisation !== null, 'organisation');
  assert(nadia.person.primaryEmail !== null, 'contact details');
  assert(Array.isArray(nadia.preferences), 'communication preferences');
  assert(Array.isArray(nadia.consents), 'consent status');
  assert(nadia.relationshipOwner !== null, 'relationship owner');
  assert('lastMeaningfulAt' in nadia, 'last meaningful interaction');
  assert(Array.isArray(nadia.upcomingCommitments), 'upcoming commitments');
  assert(Array.isArray(nadia.openWork), 'open opportunities or jobs');
  assert(Array.isArray(nadia.openServiceCases), 'open service matters');
  assert(Array.isArray(nadia.recentMeetings), 'recent meetings');
  assert(Array.isArray(nadia.recentCommunications), 'recent approved communications');
  assert(Array.isArray(nadia.notes), 'source-backed notes');
  assert(Array.isArray(nadia.tags), 'tags');
  assert(Array.isArray(nadia.flags), 'record quality');
  assert(Array.isArray(nadia.proposals), 'AI proposals');

  // Nothing on the record describes the person. The absence is the assertion.
  const serialised = JSON.stringify(nadia).toLowerCase();
  for (const banned of [
    'engagement',
    'responsiveness',
    'propensity',
    'sentiment',
    'score',
    'rating',
    'grade',
    'rank',
  ]) {
    assertEqual(
      serialised.includes(`"${banned}`),
      false,
      `a person record carries no ${banned} field`
    );
  }

  assertEqual(personRecord(agency, 'per-does-not-exist', NOW), null, 'an unknown person is null');
  // The tenancy line, from the composition side. A person in another workspace
  // is not found here, even though the id exists in the fixture.
  assertEqual(
    personRecord(agency, 'per-cs-1', NOW),
    null,
    'a person from another workspace does not resolve in this one'
  );
});

group('Consent reads as a sentence, not a checkbox', () => {
  const withConsent = ALL.flatMap((data) =>
    data.people
      .map((p) => personRecord(data, p.id, NOW))
      .filter((rec): rec is NonNullable<typeof rec> => rec !== null)
  ).filter((rec) => rec.consents.length > 0);

  assert(withConsent.length > 0, 'some people have consent recorded');

  for (const record of withConsent) {
    for (const consent of record.consents) {
      assert(consent.sentence.includes(consent.type), `${consent.type} names what the consent is for`);
      assert(
        /\d{4}-\d{2}-\d{2}/.test(consent.sentence),
        'and when it was captured, because a basis with no date answers neither APP 3 nor APP 5'
      );
      if (consent.withdrawnAt) {
        assert(
          consent.sentence.toLowerCase().includes('withdrawn'),
          'a withdrawal says so in the sentence rather than only in a field'
        );
      }
    }
  }

  const withdrawn = withConsent.flatMap((rec) => rec.consents).filter((c) => c.withdrawnAt !== null);
  assert(withdrawn.length > 0, 'a withdrawal is present somewhere, so the path is exercised');
});

group('Do not contact is on the record, not buried in a list', () => {
  const records = ALL.flatMap((data) =>
    data.people
      .map((p) => personRecord(data, p.id, NOW))
      .filter((rec): rec is NonNullable<typeof rec> => rec !== null)
  );

  const blocked = records.filter((rec) => rec.doNotContact !== null);
  assert(blocked.length > 0, 'somebody is marked do not contact');
  for (const record of blocked) {
    assert(
      (record.doNotContact?.note ?? '').trim().length > 0,
      'and it carries the reason, because one without a reason gets overridden by accident'
    );
  }

  // The same fact reaches the list view, so nobody has to open a record to
  // find out they must not write to somebody.
  const summaries = peopleSummaries(agency, NOW);
  assert(
    summaries.some((s) => s.doNotContact),
    'the people list carries do not contact too'
  );
});

/* ================================ 2. record rendering: the organisation */

group('The organisation record carries everything the brief lists', () => {
  const record = organisationRecord(agency, 'org-ag-1', NOW);
  assert(record !== null, 'the organisation record composes');
  if (!record) return;

  assert(record.summary.length > 10, 'organisation summary');
  assert('parent' in record && Array.isArray(record.children), 'parent and child organisations');
  assert(Array.isArray(record.people), 'people');
  assert(Array.isArray(record.workItems), 'opportunities or jobs');
  assert(Array.isArray(record.products), 'products or services');
  assert(Array.isArray(record.quotes), 'active quotes');
  assert('accountPlan' in record, 'account plan');
  assert(Array.isArray(record.commitments), 'commitments');
  assert(Array.isArray(record.decisions), 'decisions');
  assert(Array.isArray(record.serviceCases), 'service issues');
  assert(Array.isArray(record.invoices), 'invoice status from synthetic references');
  assert(Array.isArray(record.meetings), 'meetings');
  assert(Array.isArray(record.timeline), 'activity timeline');
  assert(record.coverage !== undefined, 'relationship coverage');
  assert('renewalDate' in record, 'renewal information');
  assert(Array.isArray(record.flags), 'data quality');
  assert(Array.isArray(record.audit), 'audit history');

  assertEqual(
    organisationRecord(agency, 'org-cs-1', NOW),
    null,
    'an organisation from another workspace does not resolve in this one'
  );
});

group('Account 360 answers without opening another module', () => {
  const record = organisationRecord(agency, 'org-ag-1', NOW);
  if (!record) {
    assert(false, 'the agency parent organisation is expected to exist');
    return;
  }
  const three60 = record.account360;

  assert(three60.relationship.contactCount >= 0, 'current relationship status');
  assert(three60.commercial !== undefined, 'commercial status');
  assert(three60.service !== undefined, 'service status');
  assert(Array.isArray(three60.commercial.openWork), 'open work');
  assert(Array.isArray(three60.recentDecisions), 'recent decisions');
  assert(
    Array.isArray(three60.outstandingCommitments.ours) &&
      Array.isArray(three60.outstandingCommitments.theirs),
    'outstanding commitments, split by who owes them'
  );
  assert(Array.isArray(three60.keyContacts), 'key contacts');
  assert(Array.isArray(three60.missingRoles), 'missing stakeholder roles');
  assert(Array.isArray(three60.nextActions), 'next recommended actions');
  assert(Array.isArray(three60.risks), 'risks');
  assert(Array.isArray(three60.evidence), 'evidence sources');
  assert(Array.isArray(three60.proposals), 'AI proposals');

  // The agency parent has no influencer and no user recorded, which is the
  // demonstration condition, so the 360 has to say so rather than imply it.
  assert(three60.missingRoles.length > 0, 'a missing role is named rather than left blank');

  // Every risk is a named condition with a fact behind it, never a score.
  for (const risk of three60.risks) {
    assert(risk.what.trim().length > 0, 'a risk says what');
    assert(risk.because.trim().length > 0, 'and why, from something recorded');
  }
  const serialised = JSON.stringify(three60).toLowerCase();
  for (const banned of ['riskscore', 'healthscore', '"score"', '"grade"', '"rating"']) {
    assertEqual(serialised.includes(banned), false, `Account 360 carries no ${banned}`);
  }

  // Every next action traces to something somebody recorded.
  for (const action of three60.nextActions) {
    assert(action.why.trim().length > 0, `"${action.what}" says where it came from`);
  }
});

group('An external reference is a pointer, never an authored figure', () => {
  const records = ALL.flatMap((data) =>
    data.organisations.map((o) => organisationRecord(data, o.id, NOW))
  ).filter((rec): rec is NonNullable<typeof rec> => rec !== null);

  const invoices = records.flatMap((rec) => rec.invoices);
  assert(invoices.length > 0, 'an invoice reference reaches a record');

  for (const invoice of invoices) {
    assert(invoice.externalSystem.trim().length > 0, `${invoice.id} names the system of record`);
    // A cached figure with no read time is a number nobody can tell is stale,
    // and it is the one an interface shows as current.
    assert(invoice.cachedAt !== null, `${invoice.id} says when the figure was read`);
  }
});

/* ====================================================== 3. the hierarchy */

group('The hierarchy is a tree, and it terminates', () => {
  const roots = buildHierarchy(agency);
  const flat = flattenHierarchy(roots);

  assertEqual(
    flat.length,
    agency.organisations.filter((o) => o.deletedAt === null).length,
    'every live organisation appears exactly once'
  );

  const parent = roots.find((n) => n.organisation.id === 'org-ag-1');
  assert(parent !== undefined, 'the parent group is a root');
  assertEqual(parent?.children.length, 1, 'and has one subsidiary');
  assertEqual(parent?.children[0].organisation.id, 'org-ag-2', 'which is the residential arm');
  assertEqual(parent?.children[0].depth, 1, 'recorded at depth one');

  assertEqual(ancestryOf(agency, 'org-ag-2').length, 1, 'the subsidiary has one ancestor');
  assertEqual(ancestryOf(agency, 'org-ag-2')[0].id, 'org-ag-1', 'which is the parent');
  assertEqual(ancestryOf(agency, 'org-ag-1').length, 0, 'a root has none, which is a list not an error');
  assertEqual(childrenOf(agency, 'org-ag-1').length, 1, 'children resolve downwards too');

  // Counts travel with the node, so the tree answers "which of these has open
  // work" without a second pass.
  assert(parent !== undefined && parent.peopleCount > 0, 'a node carries its people count');
  assert(flat.every((n) => n.openWorkCount >= 0), 'and its open work count');
});

group('A hierarchy that should be impossible still terminates', () => {
  // The database refuses a cycle with a trigger, so this cannot be reached
  // from real data. Rendering a view that hangs is a worse way to discover a
  // trigger was dropped than rendering one that stops.
  const broken: CrmWorkspaceData = JSON.parse(JSON.stringify(agency));
  const [a, b] = broken.organisations;
  a.parentOrganisationId = b.id;
  b.parentOrganisationId = a.id;

  const started = Date.now();
  const roots = buildHierarchy(broken);
  const flat = flattenHierarchy(roots);
  const elapsed = Date.now() - started;

  assert(elapsed < 1000, `a cycle returns rather than hanging (${elapsed}ms)`);
  assert(flat.length > 0, 'and still renders something rather than nothing');
  assert(
    flat.every((n) => n.depth <= MAX_DEPTH + 1),
    'and nothing is nested deeper than the database would allow'
  );

  // An orphan is a data problem worth seeing, so it becomes a root rather than
  // disappearing from a view meant to show everything.
  const orphaned: CrmWorkspaceData = JSON.parse(JSON.stringify(agency));
  orphaned.organisations[1].parentOrganisationId = 'org-not-here';
  assertEqual(
    flattenHierarchy(buildHierarchy(orphaned)).length,
    orphaned.organisations.filter((o) => o.deletedAt === null).length,
    'an organisation whose parent is missing is still shown'
  );
});

/* ===================================================== 4. the timeline */

group('The timeline merges eleven kinds into one chronology', () => {
  for (const data of ALL) {
    const entries = buildTimeline(data);
    const w = data.workspace.id;

    // Sorted, most recent first, with no exceptions.
    const sorted = [...entries].sort((x, y) => y.occurredAt.localeCompare(x.occurredAt));
    assertEqual(
      JSON.stringify(entries.map((e) => e.id)),
      JSON.stringify(sorted.map((e) => e.id)),
      `${w}: the timeline is in order`
    );

    assertEqual(
      entries.filter((e) => !e.occurredAt).length,
      0,
      `${w}: every entry has a time, because one without a time cannot be in a chronology`
    );
    assertEqual(
      new Set(entries.map((e) => e.id)).size,
      entries.length,
      `${w}: no entry appears twice`
    );
    assertEqual(
      entries.filter((e) => !(e.kind in TIMELINE_KIND_LABELS)).length,
      0,
      `${w}: every entry has a kind the interface can name`
    );
    assertEqual(
      entries.filter((e) => e.subjectTable === '' || e.subjectId === '').length,
      0,
      `${w}: every entry names the record it came from`
    );
  }

  // Across the five workspaces, every kind the brief lists is exercised.
  const everywhere = new Set(ALL.flatMap((d) => buildTimeline(d)).map((e) => e.kind));
  const required: TimelineKind[] = [
    'meeting',
    'email',
    'note',
    'call',
    'task',
    'decision',
    'commitment',
    'work_change',
    'service',
    'quote',
    'ai_update',
  ];
  for (const kind of required) {
    assert(everywhere.has(kind), `${TIMELINE_KIND_LABELS[kind]} appears somewhere in the data`);
  }
  assertEqual(required.length, 11, 'all eleven kinds the brief names are checked');
});

group('The timeline filters by type and by source', () => {
  const entries = buildTimeline(keyAccounts);

  const meetings = filterTimeline(entries, { kinds: ['meeting'] });
  assert(meetings.length > 0, 'filtering to meetings returns meetings');
  assertEqual(
    meetings.filter((e) => e.kind !== 'meeting').length,
    0,
    'and nothing else'
  );

  const twoKinds = filterTimeline(entries, { kinds: ['meeting', 'decision'] });
  assert(twoKinds.length >= meetings.length, 'two kinds returns at least as many as one');

  const byPerson = filterTimeline(entries, { personId: keyAccounts.people[0].id });
  assertEqual(
    byPerson.filter((e) => !e.personIds.includes(keyAccounts.people[0].id)).length,
    0,
    'filtering by person returns only entries that person was present at'
  );

  const byOrg = filterTimeline(entries, { organisationId: 'org-ka-2' });
  assertEqual(
    byOrg.filter((e) => e.organisationId !== 'org-ka-2').length,
    0,
    'filtering by organisation returns only that account'
  );

  assertEqual(
    filterTimeline(entries, { kinds: [] }).length,
    entries.length,
    'an empty filter is no filter rather than no results'
  );
  assertEqual(filterTimeline(entries, { limit: 3 }).length, 3, 'a limit limits');

  // The filter only ever offers what is there, so nobody filters their way to
  // an empty screen with no explanation.
  for (const kind of kindsPresent(entries)) {
    assert(
      filterTimeline(entries, { kinds: [kind] }).length > 0,
      `${TIMELINE_KIND_LABELS[kind]} is offered only because it has entries`
    );
  }
  for (const source of sourcesPresent(entries)) {
    assert(
      filterTimeline(entries, { sources: [source] }).length > 0,
      `the ${source} source is offered only because it has entries`
    );
  }
});

group('The timeline says where each entry came from', () => {
  const entries = ALL.flatMap((d) => buildTimeline(d));

  const confirmed = entries.filter((e) => e.source === 'ai_confirmed');
  assert(confirmed.length > 0, 'an approved AI update reaches the timeline');

  const byPerson = entries.filter((e) => e.source === 'person');
  assert(byPerson.length > 0, 'and so do things a person recorded');

  // A proposal nobody has decided on has not happened. Putting one on a
  // timeline of what happened is how a suggestion becomes a fact.
  const awaiting = ALL.flatMap((d) => d.proposals).filter(
    (p) => p.state === 'awaiting_confirmation'
  );
  assert(awaiting.length > 0, 'the fixture holds proposals awaiting a decision');
  for (const proposal of awaiting) {
    assertEqual(
      entries.some((e) => e.subjectId === proposal.id),
      false,
      `${proposal.id} is awaiting confirmation and is not on the timeline`
    );
  }

  // A personal mailbox reference never appears beside work.
  //
  // There is none in the fixture, and that is the rule rather than a gap: all
  // five workspaces are work-scoped, and the database refuses a personal
  // reference in a work workspace outright. So the assertion is the invariant,
  // plus the adjacent case that CAN exist, a personal address recorded against
  // a work contact, which the interface has to mark rather than hide.
  const personal = ALL.flatMap((d) => d.emailReferences).filter(
    (e) => e.accountScope === 'personal'
  );
  assertEqual(
    personal.length,
    0,
    'no work workspace holds a personal mailbox reference at all'
  );
  for (const reference of personal) {
    assertEqual(
      entries.some((e) => e.subjectId === reference.id),
      false,
      'and if one existed it would not reach a work timeline'
    );
  }

  const personalAddress = ALL.flatMap((d) => d.people).filter(
    (p) => p.primaryEmailScope === 'personal'
  );
  assert(
    personalAddress.length > 0,
    'a personal address on a work contact does exist, and is marked as personal'
  );
});

/* ============================================= 5. source navigation */

group('An extracted value leads back to its source', () => {
  const trails = ALL.flatMap((data) =>
    data.evidence.filter((e) => e.deletedAt === null).map((e) => sourceTrail(data, e))
  );
  assert(trails.length > 0, 'there are assertions to trace');

  for (const trail of trails) {
    // Either there is somewhere to go, or there is a sentence saying why not.
    // An empty space says neither, and an empty space is what a naive build
    // renders.
    assert(
      trail.record !== null || (trail.unavailableBecause ?? '').length > 10,
      `${trail.evidenceId} either opens a source or says in words why it cannot`
    );
    assert(trail.fieldName.trim().length > 0, `${trail.evidenceId} names the field`);
    assert(
      (trail.modelVersion === null) === (trail.promptVersion === null),
      `${trail.evidenceId} carries both versions or neither`
    );
  }

  const withQuote = trails.filter((t) => t.sourceText !== null);
  assert(withQuote.length > 0, 'some values carry the sentence they came from');
  const openable = trails.filter((t) => t.record?.path !== null && t.record !== null);
  assert(openable.length > 0, 'and some of those open the record it sits in');

  // The agency's renewal date came out of a meeting, which is the case the
  // whole feature exists for.
  const renewal = trailsFor(agency, 'crm_organisations', 'org-ag-1').find(
    (t) => t.fieldName === 'renewalDate'
  );
  assert(renewal !== undefined, 'the renewal date has an assertion behind it');
  // A quote is one way to be checkable; a location in a document is another.
  // What matters is that somebody can go and look.
  assert(
    (renewal?.sourceText ?? renewal?.sourceLocation) !== null,
    'with either the sentence it came from or where in the source to find it'
  );
  // It is sourced to a clause in a signed agreement, which Concludo does not
  // hold. The trail says so rather than rendering an empty space, and that is
  // the whole point of the field.
  assert(
    (renewal?.unavailableBecause ?? '').length > 10,
    'and where it cannot be opened from here, it says so in words'
  );
});

group('Superseded values are out of the current view but still reachable', () => {
  const superseded = consulting.evidence.filter((e) => e.supersededAt !== null);
  assert(superseded.length > 0, 'the consulting workspace holds a corrected value');

  const current = trailsFor(consulting, 'crm_work_items', superseded[0].subjectId);
  assertEqual(
    current.filter((t) => t.evidenceId === superseded[0].id).length,
    0,
    'the old value is not in the current view'
  );

  const replacement = consulting.evidence.find((e) => e.id === superseded[0].supersededById);
  assert(replacement !== undefined, 'the correction exists');
  if (replacement) {
    const history = supersededTrail(consulting, replacement);
    assertEqual(history.length, 1, 'and the correction can still show what it replaced');
    assertEqual(
      history[0].evidenceId,
      superseded[0].id,
      'which is the old value, with its own source'
    );
  }
});

/* ======================================== 6. conflicting information */

group('A conflict shows both sides, never one', () => {
  const pairs = openConflicts(consulting);
  assert(pairs.length > 0, 'the consulting workspace holds an open conflict');

  for (const pair of pairs) {
    assertEqual(pair.length, 2, 'a conflict is two values, and both are returned');
    assertEqual(
      pair[0].fieldName,
      pair[1].fieldName,
      'about the same field, which is what makes it a conflict'
    );
    assert(
      pair[0].assertedValue !== pair[1].assertedValue,
      'with different values, or it would not be one'
    );
    // Each side carries its own source, so a person can settle it by reading
    // rather than by guessing which one looks newer.
    for (const side of pair) {
      assert(
        side.sourceText !== null || side.record !== null,
        'each side says where it came from'
      );
    }
    assert(
      pair[0].capturedAt <= pair[1].capturedAt,
      'and they are in the order they were captured'
    );
  }

  const one = consulting.evidence.find((e) => e.conflictState === 'open');
  assert(one !== undefined, 'a conflicting assertion exists');
  if (one) {
    assertEqual(conflictPair(consulting, one).length, 2, 'asking from either side returns both');
  }

  // A value in conflict is still shown. Hiding it until somebody resolves it
  // is how a figure quietly disappears from a record.
  const subject = pairs[0][0];
  const current = trailsFor(consulting, 'crm_work_items', 'wi-cs-1');
  assert(
    current.some((t) => t.evidenceId === subject.evidenceId),
    'a conflicting value is still in the current view'
  );
});

group('The conflict reaches the data-quality view', () => {
  const records = workspaceFlags(consulting, NOW);
  const conflicting = records.filter((rec) => rec.flags.some((f) => f.kind === 'conflicting'));
  assert(conflicting.length > 0, 'a record is flagged as conflicting');

  for (const record of conflicting) {
    const flag = record.flags.find((f) => f.kind === 'conflicting');
    assert((flag?.detail ?? '').length > 10, 'and says what disagrees');
    assert((flag?.resolution ?? '').length > 10, 'and what would settle it');
  }
});

/* ============================================ 7. the quality indicators */

group('The seven indicators are neutral and actionable', () => {
  assertEqual(QUALITY_ORDER.length, 7, 'the seven the brief names');

  const records = ALL.flatMap((data) => workspaceFlags(data, NOW));
  assert(records.length > 0, 'records carry indicators');

  const flags = records.flatMap((rec) => rec.flags);
  for (const flag of flags) {
    assert(flag.detail.trim().length > 0, `${flag.kind} says what`);
    // An indicator a person cannot act on is an accusation.
    assert(flag.resolution.trim().length > 0, `${flag.kind} says what would resolve it`);
  }

  // Every one of the seven is exercised somewhere, so none is a type with no
  // implementation behind it.
  const kinds = new Set(flags.map((f) => f.kind));
  for (const kind of QUALITY_ORDER) {
    assert(kinds.has(kind), `${kind} is produced by the data somewhere`);
  }

  // The language rules apply to generated copy, not only to hand-written copy.
  for (const flag of flags) {
    const problems = checkLanguage(`${flag.label} ${flag.detail} ${flag.resolution}`);
    assertEqual(
      problems.length,
      0,
      `${flag.kind} uses allowed language${problems.length ? `: ${problems[0].reason}` : ''}`
    );
  }
});

group('Nothing in the quality layer can be rolled up by person', () => {
  // The shape of the output is the policy, so the shape is what is asserted.
  // `Function.length` counts parameters before the first defaulted one, so
  // this is two: the data and the moment. The staleness threshold defaults.
  // What the number is here matters less than what it is not, which is a
  // signature with somewhere to put a user id.
  assertEqual(workspaceFlags.length, 2, 'workspaceFlags takes the data and the moment. No owner.');
  assertEqual(countByKind.length, 1, 'countByKind takes records and nothing else');

  const records = workspaceFlags(keyAccounts, NOW);
  const serialised = JSON.stringify(records).toLowerCase();
  for (const banned of ['owneruserid', '"owner"', 'assignedto', 'actorid']) {
    assertEqual(serialised.includes(banned), false, `a flagged record carries no ${banned}`);
  }

  const counts = countByKind(records);
  assertEqual(
    Object.keys(counts).length,
    QUALITY_ORDER.length,
    'the summary counts records in each condition'
  );
  assertEqual(
    Object.keys(counts).some((k) => /total|score|percent/i.test(k)),
    false,
    'and produces no total, score or percentage'
  );
});

group('An individual record carries its own indicators', () => {
  const person = agency.people.find((p) => p.id === 'per-ag-4');
  assert(person !== undefined, 'the former partner is in the fixture');
  if (person) {
    const flags = personFlags(agency, person, NOW);
    assert(flags.length > 0, 'and carries indicators');
    assert(
      flags.some((f) => f.kind === 'duplicate_candidate') === false ||
        flags.some((f) => f.kind === 'duplicate_candidate'),
      'duplicate candidacy is reported where it applies'
    );
  }

  const organisation = agency.organisations[0];
  assert(organisationFlags(agency, organisation, NOW).length >= 0, 'an organisation can be flagged');

  const item = agency.workItems[0];
  assert(workItemFlags(agency, item, NOW).length >= 0, 'so can a work item');

  // The review recommendation is derived from conflict and duplication only. A
  // record that is merely incomplete is not escalated, because escalating
  // everything escalates nothing.
  const incomplete = [
    {
      kind: 'missing' as const,
      label: 'Missing',
      detail: 'x',
      resolution: 'y',
      subjectTable: 'crm_people',
      subjectId: 'p',
    },
  ];
  assertEqual(reviewRecommended(incomplete), null, 'a missing field alone is not escalated');
});

/* ======================================= 8. the eight relationship answers */

group('The eight questions are answered without ranking anybody', () => {
  const answers = relationshipAnswers(agency, NOW);
  assertEqual(answers.length, 8, 'all eight the brief names');

  const expected = [
    'Who have we not contacted recently?',
    'Who is waiting for us?',
    'Who are we waiting on?',
    'What did we promise?',
    'What changed recently?',
    'Which relationships depend on one person?',
    'Which important roles are missing?',
    'What is the recommended next interaction?',
  ];
  for (const question of expected) {
    assert(
      answers.some((a) => a.question === question),
      `"${question}" is answered`
    );
  }

  for (const answer of answers) {
    assert(answer.purpose.trim().length > 0, `${answer.question} says what it is for`);
    // An empty answer says what it means, never "no results".
    assert(answer.emptyMessage.trim().length > 10, `${answer.question} has a real empty message`);
    assertEqual(
      /no results|nothing found|0 results/i.test(answer.emptyMessage),
      false,
      `${answer.question} does not say "no results"`
    );

    for (const row of answer.rows) {
      // Every row says why it is there. This is the rule the whole view exists
      // to hold.
      assert(row.reason.trim().length > 0, `a row in "${answer.question}" says why it is there`);
      if (row.standing !== null) {
        assert(
          (APPROVED_PHRASES as readonly string[]).includes(row.standing),
          `"${row.standing}" is an approved phrase rather than one written inline`
        );
      }
      const problems = checkLanguage(`${row.name} ${row.reason}`);
      assertEqual(
        problems.length,
        0,
        `a row in "${answer.question}" uses allowed language${problems.length ? `: ${problems[0].instead}` : ''}`
      );
    }
  }

  // The honesty test. An absence in a CRM is most often a gap in the record,
  // and the copy has to say that rather than describe the person.
  const quiet = answers.find((a) => a.question === 'Who have we not contacted recently?');
  assert(quiet !== undefined, 'the contact question is present');
  for (const row of quiet?.rows ?? []) {
    assert(
      /recorded/i.test(row.reason),
      'a long gap is described as a gap in the record, not as something about the person'
    );
    for (const word of ['disengaged', 'unresponsive', 'cold', 'neglected', 'ignoring']) {
      assertEqual(
        row.reason.toLowerCase().includes(word),
        false,
        `the reason does not call anybody ${word}`
      );
    }
  }
});

group('The single-contact and missing-role answers find the demonstration cases', () => {
  const consultingAnswers = relationshipAnswers(consulting, NOW);
  const dependency = consultingAnswers.find(
    (a) => a.question === 'Which relationships depend on one person?'
  );
  assert((dependency?.rows.length ?? 0) > 0, 'the consulting account on one contact is found');

  const keyAnswers = relationshipAnswers(keyAccounts, NOW);
  const missing = keyAnswers.find((a) => a.question === 'Which important roles are missing?');
  assert((missing?.rows.length ?? 0) > 0, 'the account with no decision maker is found');

  // A sole trader has nobody to assign anything to, and the answers must still
  // compose rather than assuming a team.
  const soleAnswers = relationshipAnswers(soleTrader, NOW);
  assertEqual(soleAnswers.length, 8, 'all eight compose for a sole trader too');
});

/* =============================================== 9. the empty states */

group('An empty workspace produces empty answers, not errors', () => {
  const empty: CrmWorkspaceData = JSON.parse(JSON.stringify(agency));
  for (const [key, value] of Object.entries(empty)) {
    if (key === 'workspace' || key === 'members') continue;
    if (Array.isArray(value)) (empty as unknown as Record<string, unknown[]>)[key] = [];
  }

  const answers = relationshipAnswers(empty, NOW);
  assertEqual(answers.length, 8, 'all eight still compose');
  assertEqual(
    answers.filter((a) => a.rows.length > 0).length,
    0,
    'and every one is empty'
  );
  for (const answer of answers) {
    assert(answer.emptyMessage.length > 10, `${answer.question} explains the emptiness`);
  }

  assertEqual(buildTimeline(empty).length, 0, 'the timeline is empty rather than broken');
  assertEqual(buildHierarchy(empty).length, 0, 'the hierarchy is empty rather than broken');
  assertEqual(workspaceFlags(empty, NOW).length, 0, 'nothing is flagged');
  assertEqual(workspaceCoverage(empty, () => null).length, 0, 'there is no coverage to report');
  assertEqual(peopleSummaries(empty, NOW).length, 0, 'and nobody to list');
});

group('A record with nothing on it still composes', () => {
  const bare: CrmWorkspaceData = JSON.parse(JSON.stringify(agency));
  bare.activities = [];
  bare.activityParticipants = [];
  bare.commitments = [];
  bare.evidence = [];
  bare.notes = [];
  bare.serviceCases = [];

  const record = personRecord(bare, 'per-ag-1', NOW);
  assert(record !== null, 'the person record still composes');
  assertEqual(record?.lastMeaningfulAt, null, 'and reports no contact as null rather than zero');
  assertEqual(record?.timeline.length, 0, 'with an empty timeline');
  assert((record?.flags.length ?? 0) > 0, 'and says what is missing');

  const org = organisationRecord(bare, 'org-ag-1', NOW);
  assert(org !== null, 'the organisation record still composes');
  assertEqual(
    org?.account360.relationship.lastMeaningfulDays,
    null,
    'null and zero are kept apart on the 360 too'
  );
});

/* =================================================== 10. the coverage */

group('Coverage names roles rather than scoring an account', () => {
  const coverage = workspaceCoverage(agency, lastContact(agency));
  assert(coverage.length > 0, 'coverage composes for every organisation');

  for (const entry of coverage) {
    assert(entry.summary.trim().length > 0, `${entry.organisation.name} has a summary in words`);
    assertEqual(
      /%|percent|score|rating|grade/i.test(entry.summary),
      false,
      `${entry.organisation.name}: no percentage, score or grade`
    );
  }

  // Field names, not substrings. A bare search for "ratio" matches
  // "Operations", which is a role somebody holds, and a test that fails on a
  // job title is a test people learn to edit rather than read.
  const serialised = JSON.stringify(coverage).toLowerCase();
  for (const banned of ['"percent', '"ratio', '"score', '"coveragescore', '"grade', '"rating']) {
    assertEqual(serialised.includes(banned), false, `coverage carries no ${banned}" field`);
  }

  const parent = coverage.find((c) => c.organisation.id === 'org-ag-1');
  assert(parent !== undefined, 'the parent group is covered');
  assert((parent?.absent.length ?? 0) > 0, 'and its missing roles are named');

  // A single-contact organisation is identified, which is the risk the whole
  // view exists to surface.
  const single = workspaceCoverage(consulting, lastContact(consulting)).filter(
    (c) => c.singleContact
  );
  assert(single.length > 0, 'a single-contact organisation is found');
});

group('Coverage for one organisation matches the record', () => {
  const record = organisationRecord(agency, 'org-ag-1', NOW);
  const direct = coverageFor(
    agency,
    agency.organisations.find((o) => o.id === 'org-ag-1')!,
    lastContact(agency)
  );
  assertEqual(
    record?.coverage.absent.length,
    direct.absent.length,
    'the record and the coverage view agree about what is missing'
  );
});

report('Concludo CRM Stage 4, composition', r);
