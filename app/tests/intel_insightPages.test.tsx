import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InsightOverviewPage } from '../src/pages/InsightOverviewPage.tsx';
import { StatsOverviewPage } from '../src/pages/StatsOverviewPage.tsx';
describe('insight pages (initial render)', () => {
  it('start in a loading state with one h1 and no figures', () => {
    const h = renderToStaticMarkup(<InsightOverviewPage loader={() => new Promise(() => {})} />);
    assert.equal((h.match(/<h1/g) || []).length, 1); assert.match(h, /Loading insight/); assert.ok(!/\d+\/100/.test(h));
  });
  it('stats starts loading', () => { assert.match(renderToStaticMarkup(<StatsOverviewPage loader={() => new Promise(() => {})} />), /Loading stats/); });

  const never = () => new Promise<any>(() => {});
  it('insight with data shows counts, the calculated date, no canned items and no person names', () => {
    const h = renderToStaticMarkup(<InsightOverviewPage loader={never} initial={{
      topRisks: [{ id: 'risk-overdue-actions', title: 'Delivery', count: 6, description: '6 overdue' }, { id: 'risk-scope-governance', title: 'Alignment canned', count: 1, description: 'x' }],
      topOpportunities: [{ id: 'opp-workspace-scale' }],
      projectIntelligenceSummary: { totalProjects: 4, avgDecisionsPerProject: 1, avgActionsPerProject: 2 },
      openActionTrends: { notStarted: 2, inProgress: 3, blocked: 1, totalOpen: 6 }, overdueActionTrends: { count: 3 },
      generatedAt: '2026-10-30T14:30:00Z', frequentlyAssignedActions: [{ owner: 'Sam Example', total: 9 }],
    } as any} />);
    assert.match(h, /Last calculated 31 October 2026/); assert.match(h, /3 of 6 open \(50%\)/);
    assert.ok(!h.includes('Alignment canned')); assert.ok(!h.includes('Sam Example')); assert.ok(!/Account Expansion/.test(h));
  });
  it('insight with no projects says so instead of showing zeros as findings', () => {
    const h = renderToStaticMarkup(<InsightOverviewPage loader={never} initial={{ projectIntelligenceSummary: { totalProjects: 0, avgDecisionsPerProject: 0, avgActionsPerProject: 0 } } as any} />);
    assert.match(h, /No saved projects yet/);
  });
  it('stats with few actions abstains instead of showing 0 percent', () => {
    const h = renderToStaticMarkup(<StatsOverviewPage loader={never} initial={{ totalProjects: 1, totalDecisions: 0, totalActions: 0, completedActions: 0, openActions: 0, overdueActions: 0 }} />);
    assert.match(h, /Not enough evidence yet/); assert.ok(!h.includes('0%'));
  });
});
