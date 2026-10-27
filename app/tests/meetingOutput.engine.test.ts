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
  assert.ok(followUpEmail(m).body.includes('Owner to be named'));
});

t('Empty input is rejected', () => {
  assert.throws(() => analyseMeeting([{ name: 'x', kind: 'transcript', text: '   ' }]));
});

t('No em or en dash in any generated text', () => {
  const m = sample();
  assert.ok(!/[–—]/.test(toMarkdown(m) + followUpEmail(m).body + m.bottomLine));
});

console.log(`\n${n} engine tests passed`);
