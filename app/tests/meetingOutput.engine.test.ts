// Engine tests for meeting output v2. Run: npx tsx tests/meetingOutput.engine.test.ts
import assert from 'node:assert/strict';
import { analyseMeeting, refresh, resolveDue, normaliseDate, toMarkdown, followUpEmail } from '../src/lib/intelligence/meetingEngine';
import { SAMPLE_TRANSCRIPT, SAMPLE_DOC } from '../src/features/meeting-output/samples';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };
const sample = () => analyseMeeting([
  { name: 'transcript', kind: 'transcript', text: SAMPLE_TRANSCRIPT },
  { name: 'cutover-plan-notes.md', kind: 'document', text: SAMPLE_DOC },
]);

t('Dates resolve against a Tuesday meeting with no timezone drift', () => {
  const d = '2026-10-27';
  assert.equal(resolveDue('by Friday', d)?.iso, '2026-10-30');
  assert.equal(resolveDue('send it tomorrow', d)?.iso, '2026-10-28');
  assert.equal(resolveDue('by next Monday', d)?.iso, '2026-11-02');
  assert.equal(resolveDue('by end of month', d)?.iso, '2026-10-31');
  assert.equal(resolveDue('by 14 November', d)?.iso, '2026-11-14');
  assert.equal(resolveDue('by the 3rd', d)?.iso, '2026-11-03');
  assert.equal(resolveDue('the week of the 9th', d)?.approx, true);
  assert.equal(resolveDue('early December', d)?.approx, true);
  assert.equal(resolveDue('I like Friday drinks', d), null);
  assert.equal(normaliseDate('13/10/2026'), '2026-10-13');
});

t('Sample: counts, and every owner is a real participant', () => {
  const m = sample();
  assert.deepEqual([m.decisions.length, m.actions.length, m.risks.length, m.openItems.length], [4, 9, 4, 4]);
  const names = new Set(m.participants.map((p) => p.name));
  m.actions.forEach((a) => a.owner && assert.ok(names.has(a.owner), `owner ${a.owner} must be a participant`));
});

t('Nothing is invented: gaps stay gaps', () => {
  const m = sample();
  const unowned = m.actions.filter((a) => !a.owner);
  assert.equal(unowned.length, 1);
  assert.ok(unowned[0].gaps.includes('No owner named'));
  assert.equal(m.gate.status, 'Circulate after review');
  [...m.decisions, ...m.actions, ...m.risks, ...m.openItems].forEach((x) => assert.ok(x.evidence[0].quote.length > 5, `${x.id} has a quote`));
});

t('Merged risks quote every sentence they are built from', () => {
  const r = sample().risks.find((x) => /only person/.test(x.risk))!;
  assert.match(r.evidence[0].quote, /only person/);
  assert.match(r.evidence[0].quote, /roll back/);
});

t('refresh() recomputes after a person edits and excludes', () => {
  const m = sample();
  const a = m.actions.find((x) => !x.owner)!;
  a.owner = 'Jack Moretti';
  m.actions.filter((x) => !x.due).forEach((x) => (x.due = '2026-11-06'));
  refresh(m);
  assert.equal(m.gate.status, 'Ready to circulate');
  m.decisions[0].review = 'excluded';
  refresh(m);
  assert.equal(m.stats.decisions, 3);
});

t('WebVTT input', () => {
  const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nSam Lee: Decision: we renew the lease for two years.\n\n2\n00:00:05.000 --> 00:00:09.000\nAlex Park: I will send the signed lease to the landlord by Friday.';
  const m = analyseMeeting([{ name: 'call.vtt', kind: 'transcript', text: vtt }], { meetingDate: '2026-10-27' });
  assert.equal(m.decisions.length, 1);
  assert.equal(m.actions[0].owner, 'Alex Park');
  assert.equal(m.actions[0].due, '2026-10-30');
});

t('Notes without speakers use explicit markers only', () => {
  const m = analyseMeeting([{ name: 'notes.md', kind: 'notes', text: '# Ops sync\nDate: 2 November 2026\n- Decision: Move stocktake to Thursdays\n- Action: Jo Bright to update the roster by 9 November\n- Action: order new signage\n- Risk: supplier lead times are slipping' }]);
  assert.equal(m.meta.meetingDate, '2026-11-02');
  assert.equal(m.actions[1].owner, undefined);
  assert.ok(toMarkdown(m).includes('Not named'));
  assert.ok(followUpEmail(m).body.includes('Who will own this?'));
});

t('Empty input is rejected', () => {
  assert.throws(() => analyseMeeting([{ name: 'x', kind: 'transcript', text: '   ' }]));
});

t('No em or en dash in any generated text', () => {
  const m = sample();
  assert.ok(!/[–—]/.test(toMarkdown(m) + followUpEmail(m).body + m.bottomLine));
});

/* ------------------------------------------------ Follow-up email v1 brief tests */

t('1. Client version contains no RISKS section, no score and no recommendation', () => {
  const m = sample();
  const clientEmail = followUpEmail(m, { audience: 'client' });
  assert.ok(!clientEmail.body.includes('RISKS'), 'Client email must have no RISKS section');
  assert.ok(!/score|health|recommendation/i.test(clientEmail.body), 'Client email must not contain scores or recommendations');
});

t('2. Internal version includes confirmed risks only', () => {
  const m = sample();
  // Initially sample risks are proposed or unreviewed; confirm one risk
  m.risks[0].review = 'confirmed';
  m.risks[1].review = 'proposed';
  const internalEmail = followUpEmail(m, { audience: 'internal' });
  assert.ok(internalEmail.body.includes('RISKS'), 'Internal email must have a RISKS section when confirmed risks exist');
  assert.ok(internalEmail.body.includes(m.risks[0].id), 'Must include confirmed risk R-01');
  assert.ok(!internalEmail.body.includes(m.risks[1].id), 'Must not include unconfirmed proposed risk R-02');
});

t('3. Missing due date prints Can you confirm a date?; missing owner prints Who will own this?', () => {
  const m = sample();
  const email = followUpEmail(m);
  assert.ok(email.body.includes('Who will own this?'), 'Missing owner must print "Who will own this?"');
  assert.ok(email.body.includes('Can you confirm a date?'), 'Missing due date must print "Can you confirm a date?"');
});

t('4. Correction deadline from a Friday meeting resolves to Monday 12 pm, Melbourne', () => {
  const m = analyseMeeting([
    { name: 'friday.md', kind: 'notes', text: '# Friday sync\nDate: 2026-10-30\n- Decision: Proceed with staging review' }
  ], { meetingDate: '2026-10-30' });
  const email = followUpEmail(m);
  assert.ok(email.body.includes('12 pm Monday 2 November'), `Expected 12 pm Monday 2 November, got email body: ${email.body}`);
});

t('5. Subject follows the convention and is under 120 characters', () => {
  const m = sample();
  const email = followUpEmail(m);
  assert.ok(email.subject.length < 120, `Subject length ${email.subject.length} must be < 120`);
  assert.match(email.subject, /^.+ (?:Meeting|Sync|Workshop|Board|Review), \d+ \w+: .+/i, 'Subject must follow format [Client/meeting] [type], [d Mon]: [headline]');
});

t('6. Zero en dashes and zero em dashes in any output', () => {
  const m = sample();
  m.risks.forEach((r) => (r.review = 'confirmed'));
  const client = followUpEmail(m, { audience: 'client' });
  const internal = followUpEmail(m, { audience: 'internal' });
  assert.ok(!/[–—]/.test(client.subject + client.body), 'Client email must have zero en or em dashes');
  assert.ok(!/[–—]/.test(internal.subject + internal.body), 'Internal email must have zero en or em dashes');
});

t('7. Empty meeting: no invented decision or action; NEXT MEETING reads No next meeting set', () => {
  const m = analyseMeeting([
    { name: 'empty.md', kind: 'notes', text: '# Brief standup\nDate: 2026-10-28\nAttendees: Alice, Bob\nQuick greeting with no formal decisions taken.' }
  ], { meetingDate: '2026-10-28' });
  const email = followUpEmail(m);
  assert.ok(!email.body.includes('DECISIONS'), 'No DECISIONS section when none agreed');
  assert.ok(!email.body.includes('ACTIONS'), 'No ACTIONS section when none agreed');
  assert.ok(email.body.includes('NEXT MEETING\nNo next meeting set'), 'NEXT MEETING must read "No next meeting set"');
});

console.log(`\n${n} engine tests passed`);
