/**
 * Concludo CRM, Stage 2: the data and the language.
 *
 * House style, matching the existing tests directory: plain assertions, no
 * framework, exit code 1 on any failure, nothing treated as a warning.
 *
 * Scope. The synthetic workspace, its internal consistency, its provenance, and
 * the language rules. These do not render React, because the repository has no
 * component testing framework and adding one is a separate decision for the
 * application rather than something a new module should make on its own. The
 * browser suites cover rendering.
 *
 * Run: bun app/tests/crm.model.test.ts
 */
import { CRM_DATASET, CRM_DEFAULT_WORKSPACE_ID, getCrmDataset } from '../src/lib/crm/data/workspace';
import { CRM_DEMO_NOW, daysSince, daysUntil, ms } from '../src/lib/crm/data/clock';
import { BANNED_LANGUAGE, APPROVED_PHRASES, checkLanguage } from '../src/lib/crm/language';

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

const d = CRM_DATASET;

// ------------------------------------------------------- the dataset

group('The synthetic workspace is internally consistent', () => {
  assertEqual(getCrmDataset(CRM_DEFAULT_WORKSPACE_ID), d, 'the default workspace resolves');
  assertEqual(getCrmDataset('nope'), null, 'an unknown workspace is null, never an empty dataset');

  const orgIds = new Set(d.organisations.map((o) => o.id));
  const personIds = new Set(d.people.map((p) => p.id));
  const recordIds = new Set(d.records.map((r) => r.id));
  const stageIds = new Set(d.stages.map((s) => s.id));
  const pipelineIds = new Set(d.pipelines.map((p) => p.id));
  const activityIds = new Set(d.activities.map((a) => a.id));

  assertEqual(orgIds.size, d.organisations.length, 'organisation ids are unique');
  assertEqual(personIds.size, d.people.length, 'person ids are unique');
  assertEqual(recordIds.size, d.records.length, 'record ids are unique');

  assert(
    d.organisations.every((o) => o.parentOrganisationId === null || orgIds.has(o.parentOrganisationId)),
    'every parent organisation reference resolves'
  );
  assert(
    d.organisations.every((o) => o.parentOrganisationId !== o.id),
    'no organisation is its own parent'
  );
  assert(
    d.organisations.some((o) => o.parentOrganisationId !== null),
    'the workspace demonstrates a parent and child organisation'
  );

  assert(
    d.people.every((p) => p.organisationId === null || orgIds.has(p.organisationId)),
    'every person resolves to an organisation that exists, or to none'
  );
  assert(
    d.records.every((r) => orgIds.has(r.organisationId)),
    'every record belongs to an organisation that exists'
  );
  assert(
    d.records.every((r) => r.primaryPersonId === null || personIds.has(r.primaryPersonId)),
    'every record resolves to a person that exists, or to none'
  );
  assert(
    d.records.every((r) => stageIds.has(r.stageId) && pipelineIds.has(r.pipelineId)),
    'every record is in a stage and a pipeline that exist'
  );
  assert(
    d.stages.every((s) => pipelineIds.has(s.pipelineId)),
    'every stage belongs to a pipeline that exists'
  );
  assert(
    d.records.every((r) => {
      const stage = d.stages.find((s) => s.id === r.stageId);
      return stage !== undefined && stage.pipelineId === r.pipelineId;
    }),
    'no record is in a stage belonging to a different pipeline'
  );

  assert(
    d.activities.every((a) => a.organisationId === null || orgIds.has(a.organisationId)),
    'every activity resolves to an organisation that exists, or to none'
  );
  assert(
    d.activities.every((a) => a.peopleIds.every((id) => personIds.has(id))),
    'every attendee on an activity is a person that exists'
  );
  assert(
    d.commitments.every((c) => c.recordId === null || recordIds.has(c.recordId)),
    'every commitment resolves to a record that exists, or to none'
  );
  assert(
    d.serviceIssues.every((s) => orgIds.has(s.organisationId)),
    'every service issue belongs to an organisation that exists'
  );
  assert(
    d.accountPlans.every((p) => orgIds.has(p.organisationId)),
    'every account plan belongs to an organisation that exists'
  );
  assert(
    d.people.every((p) => p.origin.sourceId === null || p.origin.sourceKind !== 'meeting' || activityIds.has(p.origin.sourceId)),
    'a person captured from a meeting points at an activity that exists'
  );
});

// ----------------------------------------------------- the demo clock

group('Everything is dated against one fixed moment', () => {
  const now = ms(CRM_DEMO_NOW);

  assert(
    d.activities.every((a) => ms(a.occurredAt) <= now),
    'no activity is recorded in the future'
  );
  assert(
    d.people.every((p) => ms(p.createdAt) <= now),
    'no person was created in the future'
  );
  assert(
    d.records.every((r) => ms(r.enteredStageAt) <= now),
    'no record entered its stage in the future'
  );

  assertEqual(daysSince('2026-10-05T09:00:00+11:00'), 7, 'daysSince counts whole days back');
  assertEqual(daysUntil('2026-10-19T09:00:00+11:00'), 7, 'daysUntil counts whole days forward');
  assert(daysUntil('2026-09-30T09:00:00+10:00') < 0, 'a past date gives a negative daysUntil');
});

// ---------------------------------------------------- provenance

group('Every derived fact says where it came from', () => {
  const traceables = [
    ...d.people.map((p) => ({ what: `person ${p.id}`, t: p.origin })),
    ...d.activities.map((a) => ({ what: `activity ${a.id}`, t: a.source })),
    ...d.commitments.map((c) => ({ what: `commitment ${c.id}`, t: c.source })),
    ...d.proposals.map((p) => ({ what: `proposal ${p.id}`, t: p.evidence })),
  ];

  assert(traceables.length > 30, 'there are enough traceable values to be worth testing');

  for (const { what, t } of traceables) {
    assert(
      ['stated', 'inferred', 'calculated', 'unknown'].includes(t.basis),
      `${what} has a valid basis`
    );
    // The one rule that makes the basis worth having: anything other than
    // unknown must carry the evidence, and unknown must not pretend to.
    if (t.basis === 'unknown') {
      assertEqual(t.evidence, null, `${what} is unknown, so it carries no evidence`);
    } else {
      assert(
        typeof t.evidence === 'string' && t.evidence.trim().length > 10,
        `${what} carries real evidence, not a placeholder`
      );
    }
  }

  assert(
    d.people.some((p) => p.origin.basis === 'inferred'),
    'the workspace demonstrates a person captured from a meeting rather than typed'
  );
  assert(
    d.activities.some((a) => a.source.basis === 'unknown'),
    'the workspace demonstrates a source that needs review'
  );
  assert(
    d.records.some((r) => r.valueBasis === 'inferred') && d.records.some((r) => r.valueBasis === 'stated'),
    'a stated value and an inferred value both exist, so the interface has to tell them apart'
  );
  assert(
    d.records.some((r) => r.value === null && r.valueBasis === 'unknown'),
    'an unrecorded value is unknown rather than zero'
  );
});

// ------------------------------------------------------- proposals

group('A proposal is a staged change, never an applied one', () => {
  assert(d.proposals.length >= 6, 'there are enough proposals to fill the queue');

  for (const proposal of d.proposals) {
    assert(proposal.changes.length > 0, `proposal ${proposal.id} says what would change`);
    assert(
      proposal.changes.every((c) => c.to.trim().length > 0),
      `proposal ${proposal.id} has a target value for every field`
    );
    assert(
      proposal.rationale.trim().length > 20,
      `proposal ${proposal.id} explains itself in more than a phrase`
    );
    assert(
      ['high', 'moderate', 'low'].includes(proposal.confidence),
      `proposal ${proposal.id} states confidence as a word, not a false percentage`
    );
    assert(
      ['awaiting_confirmation', 'confirmed', 'declined'].includes(proposal.state),
      `proposal ${proposal.id} has a valid state`
    );
    // Nothing in this release may be in a state that implies it was applied.
    assert(
      !('appliedAt' in (proposal as unknown as Record<string, unknown>)),
      `proposal ${proposal.id} carries no applied timestamp, because nothing applies`
    );
  }

  assert(
    d.proposals.some((p) => p.destructive),
    'a merge proposal exists, so the destructive path is visible'
  );
  assert(
    d.proposals.filter((p) => p.destructive).every((p) => p.kind === 'merge_duplicate'),
    'only a merge is marked destructive'
  );
  assert(
    d.proposals.some((p) => p.state === 'awaiting_confirmation'),
    'proposals are waiting, which is the whole point of the queue'
  );
});

// --------------------------------------------------- consent and duplicates

group('Consent and duplicate handling are recorded, not assumed', () => {
  assert(
    d.people.every((p) => ['open', 'limited', 'do_not_contact'].includes(p.contactPreference)),
    'every person has a recorded contact preference'
  );
  assert(
    d.people.every((p) => p.contactPreferenceNote.trim().length > 0),
    'every contact preference says what it means, including when nothing is recorded'
  );
  assert(
    d.people.some((p) => p.contactPreference === 'do_not_contact'),
    'the workspace demonstrates a do-not-contact, so the interface has to respect one'
  );

  assert(d.duplicates.length >= 3, 'there are enough duplicate candidates to be worth a view');
  assert(
    d.duplicates.every((pair) => pair.matching.length > 0 && pair.differing.length > 0),
    'every duplicate candidate shows what matches and what differs'
  );
  assert(
    d.duplicates.some((pair) => pair.recommendation === 'likely_separate'),
    'at least one candidate is recommended as separate, so the list is not a merge queue'
  );
  assert(
    d.duplicates.every((pair) => pair.reason.trim().length > 20),
    'every duplicate candidate explains the recommendation'
  );
});

// ------------------------------------------------------- the language

group('The language rules hold against every string in the dataset', () => {
  assertEqual(BANNED_LANGUAGE.length, 12, 'twelve banned patterns');
  assert(
    BANNED_LANGUAGE.every((rule) => rule.reason.trim().length > 20 && rule.instead.trim().length > 0),
    'every rule says why it exists and what to write instead'
  );
  assertEqual(
    APPROVED_PHRASES.length,
    11,
    'the seven approved phrases from the Stage 2 brief, plus the four Stage 4 added'
  );
  // The point of the list is that it is a list. A phrase written straight into
  // a component is one nobody reviewed, so the Stage 4 additions are asserted
  // by name rather than by count alone.
  for (const phrase of ['Waiting on us', 'Waiting on them', 'No recorded activity', 'Needs review']) {
    assert(
      (APPROVED_PHRASES as readonly string[]).includes(phrase),
      `"${phrase}" is in the approved list rather than written inline`
    );
  }

  // The rules catch what they are for.
  assert(checkLanguage('Team leaderboard').length > 0, 'a leaderboard is caught');
  assert(checkLanguage('Your productivity score is 72').length > 0, 'a productivity score is caught');
  assert(checkLanguage('You are behind on this').length > 0, 'anxiety language is caught');
  assert(checkLanguage('URGENT: act now').length > 0, 'pressure language is caught');
  assert(checkLanguage('This deal is guaranteed to close').length > 0, 'false certainty is caught');
  assert(checkLanguage('A hot lead').length > 0, 'temperature scoring of a person is caught');
  assert(checkLanguage('Compared to the team average').length > 0, 'peer comparison is caught');

  // And do not catch ordinary business language.
  assert(checkLanguage('No next step recorded').length === 0, 'an approved phrase passes');
  assert(checkLanguage('Relationship may need attention').length === 0, 'an approved phrase passes');
  assert(
    checkLanguage('Send two workshop dates to Elena by Monday').length === 0,
    'an ordinary commitment passes'
  );
  assert(
    checkLanguage('The proposal input brief was sent on 9 October').length === 0,
    'an ordinary activity summary passes'
  );

  // Every string the dataset can show.
  const strings: string[] = [];
  for (const o of d.organisations) strings.push(o.name, o.healthReason, o.industry);
  for (const p of d.people) {
    strings.push(p.fullName, p.roleLabel, p.contactPreferenceNote);
    if (p.attentionReason) strings.push(p.attentionReason);
    if (p.origin.evidence) strings.push(p.origin.evidence);
  }
  for (const l of d.leads) strings.push(l.summary, l.source, ...l.missing);
  for (const s of d.stages) strings.push(s.name, ...s.exitCriteria);
  for (const r of d.records) {
    strings.push(r.title);
    if (r.nextStep) strings.push(r.nextStep);
  }
  for (const a of d.activities) {
    strings.push(a.title, a.summary);
    if (a.followThroughReason) strings.push(a.followThroughReason);
    if (a.source.evidence) strings.push(a.source.evidence);
  }
  for (const c of d.commitments) strings.push(c.description);
  for (const s of d.serviceIssues) strings.push(s.title, s.relationshipEffect);
  for (const p of d.accountPlans) {
    strings.push(p.objective, ...p.outcomes.map((o) => `${o.label} ${o.measure}`));
  }
  for (const p of d.proposals) strings.push(p.headline, p.rationale, p.subjectLabel);
  for (const p of d.duplicates) strings.push(p.reason, ...p.matching, ...p.differing);
  for (const r of d.reviewItems) strings.push(r.label, r.reason, r.suggestedCheck);

  assert(strings.length > 150, 'the scan covers the whole dataset');

  let offenders = 0;
  for (const text of strings) {
    const broken = checkLanguage(text);
    if (broken.length > 0) {
      offenders += 1;
      console.error(`  FAIL  banned language: "${text}" breaks ${broken.map((r) => r.reason).join(' ')}`);
    }
  }
  checks += 1;
  if (offenders > 0) failures += 1;
  assert(offenders === 0, 'no string in the dataset breaks a language rule');

  // Australian English and no em dash, which are project rules.
  const emDashes = strings.filter((text) => text.includes('\u2014'));
  assertEqual(emDashes.length, 0, 'no em dash anywhere in the dataset');
  const americanisms = strings.filter((text) => /\borganiz|\bprioritiz|\brecogniz|\bcenter\b/i.test(text));
  assertEqual(americanisms.length, 0, 'no American spellings in the dataset');
});

// ----------------------------------------------- nothing is real

group('Nothing in the workspace could reach a real person', () => {
  const addresses = [
    ...d.people.map((p) => p.email),
    ...d.leads.map(() => null),
  ].filter((value): value is string => typeof value === 'string');

  assert(addresses.length > 5, 'there are addresses to check');
  assert(
    addresses.every((address) => address.endsWith('.example')),
    'every address uses the reserved .example domain and can never be registered'
  );

  const phones = d.people.map((p) => p.phone).filter((v): v is string => typeof v === 'string');
  assert(
    phones.every((phone) => phone.includes('5550')),
    'every phone number uses a reserved fictional range'
  );
});

// -------------------------------------------------------------- report

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Concludo CRM Stage 2 model: all checks passed.');
