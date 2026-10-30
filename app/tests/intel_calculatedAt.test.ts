import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeCalculatedAt } from '../src/lib/intel/calculatedAt.ts';
describe('calculated at', () => {
  it('uses the Melbourne day', () => { assert.equal(describeCalculatedAt('2026-10-30T14:30:00Z'), 'Last calculated 31 October 2026.'); });
  it('says not recorded when missing or invalid', () => { assert.equal(describeCalculatedAt(null), 'Last calculated: not recorded.'); assert.equal(describeCalculatedAt('nope'), 'Last calculated: not recorded.'); });
});
