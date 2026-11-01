import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterLessons, countByCategory, validateLesson, formatDay, describeLessonScope, sortTimeline } from '../src/lib/intel/memoryView.ts';

const L = (o: any) => ({ id: 'x', created_by: 'u', title: 't', summary: 's', outcome: 'o', cluster_category: 'compliance', created_at: '2026-01-01', updated_at: '2026-01-01', ...o });
const ids = (a: any[]) => a.map((r) => r.id);

describe('lessons', () => {
  const rows: any[] = [
    L({ id: '1', title: 'Rate limit test', cluster_category: 'risk_management', tags: ['api'] }),
    L({ id: '2', title: 'Consent wording', summary: 'Recording consent', cluster_category: 'compliance' }),
    L({ id: '3', title: 'Kickoff', outcome: 'Faster sign off', cluster_category: 'compliance' }),
  ];
  it('filters by category', () => assert.deepEqual(ids(filterLessons(rows, { query: '', category: 'compliance' })), ['2', '3']));
  it('searches title, summary, outcome and tags', () => {
    assert.deepEqual(ids(filterLessons(rows, { query: 'API', category: 'all' })), ['1']);
    assert.deepEqual(ids(filterLessons(rows, { query: 'sign off', category: 'all' })), ['3']);
    assert.deepEqual(ids(filterLessons(rows, { query: 'consent', category: 'all' })), ['2']);
  });
  it('returns nothing, not everything, for no match', () => assert.deepEqual(filterLessons(rows, { query: 'zzz', category: 'all' }), []));
  it('counts over the full list', () => assert.deepEqual(countByCategory(rows), { risk_management: 1, compliance: 2 }));
  it('validates required fields', () => {
    assert.deepEqual(Object.keys(validateLesson({ title: ' ', summary: '', outcome: '' })).sort(), ['outcome', 'summary', 'title']);
    assert.deepEqual(validateLesson({ title: 'a', summary: 'b', outcome: 'c' }), {});
    assert.match(validateLesson({ title: 'x'.repeat(141), summary: 'b', outcome: 'c' }).title!, /140/);
  });
  it('describes scope in plain words', () => {
    assert.equal(describeLessonScope({ shown: 0, total: 0, category: 'all', query: '' }), 'no lessons recorded yet');
    assert.equal(describeLessonScope({ shown: 2, total: 3, category: 'Compliance', query: 'a' }), '2 of 3 lessons in Compliance matching "a"');
  });
});

describe('dates and timeline', () => {
  it('does not shift date-only values', () => assert.equal(formatDay('2026-03-01'), '1 Mar 2026'));
  it('handles missing and bad dates', () => { assert.equal(formatDay(null), 'No date'); assert.equal(formatDay('nope'), 'No date'); });
  it('sorts newest first with undated last, stable', () => {
    const mk = (id: string, date: string) => ({ id, date } as any);
    assert.deepEqual(ids(sortTimeline([mk('a', '2026-01-01'), mk('b', 'bad'), mk('c', '2026-05-01'), mk('d', '2026-01-01')])), ['c', 'a', 'd', 'b']);
  });
});
