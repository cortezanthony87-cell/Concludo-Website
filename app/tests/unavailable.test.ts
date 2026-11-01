import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UNAVAILABLE_SPECS } from '../src/pages/UnavailablePages.tsx';

describe('unavailable pages', () => {
  const specs = Object.values(UNAVAILABLE_SPECS);
  it('show no digits that could read as a measurement', () => {
    for (const s of specs) for (const t of [s.purpose, s.why, ...s.needs]) {
      const nums = (t.match(/\d+/g) || []).filter((n) => !['3', '5', '8'].includes(n));
      assert.deepEqual(nums, [], `${s.title}: ${t}`);
    }
  });
  it('contain no dashes', () => { const bad = new RegExp('[' + [0x2012, 0x2013, 0x2014, 0x2015].map((c) => String.fromCharCode(c)).join('') + ']'); for (const s of specs) assert.ok(!bad.test(JSON.stringify(s)), s.title); });
  it('every page states what it needs and where to look today', () => { for (const s of specs) { assert.ok(s.needs.length > 0); assert.ok(s.today.length > 0); } });
});
