import test from 'node:test';
import assert from 'node:assert/strict';
import { rate, trendAllowed, weeksOfHistory, forecastAllowed, MIN_RATE_DENOMINATOR } from '../src/lib/intel/evidence';

test('E1 rate abstains below 5 records and says why', () => {
  const r = rate(2, 4); assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /4 records, and at least 5/);
});
test('E2 rate shows at exactly the threshold with numerator and denominator', () => {
  const r = rate(3, MIN_RATE_DENOMINATOR); assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { numerator: 3, denominator: 5, percent: 60 });
});
test('E3 empty workspace never scores 100 (D3 regression)', () => {
  const r = rate(0, 0); assert.equal(r.ok, false);
});
test('E4 impossible counts are rejected, not rounded', () => {
  assert.equal(rate(6, 5).ok, false); assert.equal(rate(-1, 5).ok, false); assert.equal(rate(NaN, 5).ok, false);
});
test('E5 trend needs 3 real snapshots (no back-filled history, D9 regression)', () => {
  assert.equal(trendAllowed(2).ok, false); assert.equal(trendAllowed(3).ok, true);
});
test('E6 weeks of history is whole weeks across real dates', () => {
  assert.equal(weeksOfHistory(['2026-09-01', '2026-10-27']), 8);
  assert.equal(weeksOfHistory(['2026-09-01', '2026-10-26']), 7);
  assert.equal(weeksOfHistory(['2026-09-01']), 0); assert.equal(weeksOfHistory([]), 0);
});
test('E7 forecast needs 8 weeks and reports what is missing', () => {
  const no = forecastAllowed(['2026-09-01', '2026-10-01']); assert.equal(no.ok, false);
  if (!no.ok) assert.match(no.reason, /4 weeks of history, and at least 8/);
  assert.equal(forecastAllowed(['2026-09-01', '2026-10-27']).ok, true);
});
test('E8 messages contain no dash characters', () => {
  const m = [rate(1, 2), trendAllowed(0), forecastAllowed([])].map((x) => (x.ok ? '' : x.reason)).join(' ');
  assert.ok(!/[\u2012-\u2015]/.test(m));
});
