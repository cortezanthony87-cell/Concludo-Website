import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PillarShell } from '../src/components/intel/PillarTabs.tsx';
import { MEMORY_PILLAR } from '../src/lib/intel/pillarRoutes.ts';

const render = (url: string, canUse?: (f: string) => boolean) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/memory" element={<PillarShell pillar={MEMORY_PILLAR} canUse={canUse} />}>
      <Route path="lessons" element={<h1>Lessons page</h1>} />
    </Route></Routes>
  </MemoryRouter>);

describe('pillar shell', () => {
  it('renders four tabs, marks the current one, and adds no second h1', () => {
    const h = render('/memory/lessons');
    assert.equal((h.match(/<h1/g) || []).length, 1);
    assert.equal((h.match(/class="ib-tab[ "]/g) || []).length, 4);
    assert.match(h, /aria-current="page"[^>]*>Lessons|>Lessons<\/a>/);
    assert.match(h, /aria-label="Memory sections"/);
  });
  it('hides tabs the plan does not include', () => {
    const h = render('/memory/lessons', (f) => f !== 'decision_memory');
    assert.ok(!h.includes('>Decisions<'));
    assert.ok(h.includes('>Lessons<'));
  });
});
