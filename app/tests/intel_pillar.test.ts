import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MEMORY_PILLAR, BRIEFINGS_PILLAR, FORECASTS_PILLAR, INSIGHT_PILLAR, LEGACY_REDIRECTS, resolveLegacy, activeTab } from '../src/lib/intel/pillarRoutes.ts';

describe('pillar routes', () => {
  it('redirects exact legacy paths only', () => {
    assert.equal(resolveLegacy('/decision-memory'), '/memory/decisions');
    assert.equal(resolveLegacy('/decision-memory/'), '/memory/decisions');
    assert.equal(resolveLegacy('/decision-memory/abc-123'), null);
    assert.equal(resolveLegacy('/knowledge/timeline'), '/memory/timeline');
  });
  it('does not redirect pages whose replacement is not ready', () => {
    assert.equal(resolveLegacy('/insight'), null);
    assert.equal(resolveLegacy('/memory'), null);
  });
  it('sends the stopped generator pages to honest replacements', () => {
    assert.equal(resolveLegacy('/executive-briefings'), '/briefings/saved');
    assert.equal(resolveLegacy('/predictive-intelligence'), '/forecasts/predictive');
  });
  it('every active target is a real tab', () => {
    const tabs = [...MEMORY_PILLAR.tabs, ...BRIEFINGS_PILLAR.tabs, ...FORECASTS_PILLAR.tabs, ...INSIGHT_PILLAR.tabs].map((t) => t.to);
    for (const r of LEGACY_REDIRECTS.filter((x) => x.ready)) assert.ok(tabs.includes(r.to), r.to);
  });
  it('no redirect loops and defaults are tabs', () => {
    for (const r of LEGACY_REDIRECTS) assert.notEqual(r.from, r.to);
    assert.ok(MEMORY_PILLAR.tabs.some((t) => t.to === MEMORY_PILLAR.defaultTab));
    assert.ok(BRIEFINGS_PILLAR.tabs.some((t) => t.to === BRIEFINGS_PILLAR.defaultTab));
  });
  it('active tab matches nested paths', () => {
    assert.equal(activeTab(MEMORY_PILLAR, '/memory/lessons')?.id, 'lessons');
    assert.equal(activeTab(MEMORY_PILLAR, '/memory/decisions/42')?.id, 'decisions');
    assert.equal(activeTab(MEMORY_PILLAR, '/memory'), undefined);
  });
  it('no dashes', () => { const bad = new RegExp('[' + [0x2012, 0x2013, 0x2014, 0x2015].map((c) => String.fromCharCode(c)).join('') + ']'); assert.ok(!bad.test(JSON.stringify([MEMORY_PILLAR, BRIEFINGS_PILLAR, FORECASTS_PILLAR, INSIGHT_PILLAR, LEGACY_REDIRECTS]))); });
});
