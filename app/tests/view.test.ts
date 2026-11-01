import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDecisionDate, todayInZone, periodStart, filterDecisions, undatedCount, projectOptions, describeScope,
} from '../src/lib/intel/decisionMemoryView';

const d = (o: any) => ({
  id: 'x', user_id: 'u', project_id: 'p1', decision_title: 'T', decision_summary: null, decision_reasoning: null,
  decision_owner: null, decision_date: '2026-10-01', source_output_id: null, created_at: '', updated_at: '',
  deleted_at: null, deleted_by: null, purge_after: null, projects: { id: 'p1', title: 'Alpha' }, ...o,
});
const NOW = new Date('2026-10-30T02:00:00Z'); // 13:00 in Melbourne

test('R1 date-only values are not shifted by the viewer time zone', () => {
  assert.equal(formatDecisionDate('2026-10-01'), '1 Oct 2026');
  assert.equal(formatDecisionDate('2026-01-01'), '1 Jan 2026');
});
test('R2 missing or malformed dates are reported honestly, not as Invalid Date', () => {
  assert.equal(formatDecisionDate(null), 'No date recorded');
  assert.equal(formatDecisionDate(''), 'No date recorded');
  assert.equal(formatDecisionDate('not a date'), 'No date recorded');
});
test('R3 today is worked out in Melbourne, not UTC', () => {
  // 20:00 UTC on 29 Oct is already 30 Oct 07:00 in Melbourne (AEDT, UTC+11)
  assert.equal(todayInZone(new Date('2026-10-29T20:00:00Z')), '2026-10-30');
  assert.equal(todayInZone(new Date('2026-10-29T12:00:00Z')), '2026-10-29');
});
test('R4 period start is exact', () => {
  assert.equal(periodStart('30d', NOW), '2026-09-30');
  assert.equal(periodStart('all', NOW), null);
});
test('R5 period filter keeps boundary day and drops older', () => {
  const rows = [d({ id: 'a', decision_date: '2026-09-30' }), d({ id: 'b', decision_date: '2026-09-29' })];
  const out = filterDecisions(rows as any, { query: '', period: '30d', projectId: 'all' }, NOW);
  assert.deepEqual(out.map((r) => r.id), ['a']);
});
test('R6 undated records are left out of a period and counted, never silently included', () => {
  const rows = [d({ id: 'a', decision_date: null }), d({ id: 'b' })];
  const f = { query: '', period: '90d' as const, projectId: 'all' };
  assert.deepEqual(filterDecisions(rows as any, f, NOW).map((r) => r.id), ['b']);
  assert.equal(undatedCount(rows as any, f), 1);
  assert.equal(undatedCount(rows as any, { ...f, period: 'all' }), 0);
});
test('R7 search covers title, summary, reasoning and owner, case-insensitively', () => {
  const rows = [
    d({ id: 'a', decision_title: 'Adopt Gateway' }), d({ id: 'b', decision_owner: 'Priya' }),
    d({ id: 'c', decision_reasoning: 'lower cost' }), d({ id: 'e', decision_summary: 'Hire' }),
  ];
  const q = (s: string) => filterDecisions(rows as any, { query: s, period: 'all', projectId: 'all' }, NOW).map((r) => r.id);
  assert.deepEqual(q('GATEWAY'), ['a']); assert.deepEqual(q('priya'), ['b']);
  assert.deepEqual(q('cost'), ['c']); assert.deepEqual(q('hire'), ['e']); assert.deepEqual(q('  '), ['a', 'b', 'c', 'e']);
});
test('R8 project filter and sorted project options', () => {
  const rows = [d({ id: 'a', project_id: 'p2', projects: { id: 'p2', title: 'Zed' } }), d({ id: 'b' })];
  assert.deepEqual(projectOptions(rows as any).map((p) => p.name), ['Alpha', 'Zed']);
  assert.deepEqual(filterDecisions(rows as any, { query: '', period: 'all', projectId: 'p2' }, NOW).map((r) => r.id), ['a']);
});
test('R9 scope sentence states what is on screen, with singular and plural', () => {
  const s = describeScope({ shown: 1, total: 1, scope: 'personal', period: '30d', query: '', projectLabel: null, undated: 0 });
  assert.equal(s, '1 of 1 decision, your personal decisions, the last 30 days');
  const t = describeScope({ shown: 2, total: 9, scope: 'all', period: 'all', query: 'gate', projectLabel: 'Alpha', undated: 2 });
  assert.match(t, /2 of 9 decisions/); assert.match(t, /project: Alpha/); assert.match(t, /matching "gate"/); assert.match(t, /2 with no decision date are left out/);
});
test('R10 no dash characters in any user-facing string', () => {
  const sample = [describeScope({ shown: 0, total: 0, scope: 'all', period: 'all', query: '', projectLabel: null, undated: 1 }), formatDecisionDate(null)].join(' ');
  assert.ok(!/[\u2012-\u2015]/.test(sample));
});
