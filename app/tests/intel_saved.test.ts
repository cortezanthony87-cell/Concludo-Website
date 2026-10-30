import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortNewestFirst, EARLIER_VERSION_LABEL } from '../src/lib/intel/savedBriefings.ts';
describe('saved briefings', () => {
  it('sorts newest first without changing the input', () => {
    const rows = [{ id: 'a', title: 'a', created_at: '2026-09-01' }, { id: 'b', title: 'b', created_at: '2026-10-01' }];
    assert.deepEqual(sortNewestFirst(rows).map((r) => r.id), ['b', 'a']);
    assert.equal(rows[0].id, 'a');
  });
  it('label says it is not a record of the work', () => { assert.match(EARLIER_VERSION_LABEL, /not a record of your work/); });
});
