import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanInsight, cleanStats, removedItemCount } from '../src/lib/intel/insightView.ts';

const base = {
  topRisks: [
    { id: 'risk-overdue-actions', title: 'Delivery', count: 4, description: 'x' },
    { id: 'risk-scope-governance', title: 'Alignment', count: 1, description: 'canned' },
  ],
  topOpportunities: [{ id: 'opp-workspace-scale' }, { id: 'opp-automation-velocity' }],
  projectIntelligenceSummary: { totalProjects: 3, avgDecisionsPerProject: 1, avgActionsPerProject: 2 },
  openActionTrends: { notStarted: 1, inProgress: 2, blocked: 1, totalOpen: 4 },
  overdueActionTrends: { count: 2 },
  generatedAt: '2026-10-30T14:30:00Z',
  frequentlyAssignedActions: [{ owner: 'Sam', total: 9, open: 3, completed: 6, overdue: 2 }],
  projectIntelligenceSummaryHealth: 85,
};
describe('insight view', () => {
  it('drops the canned alignment risk and counts removals', () => {
    const v = cleanInsight(base as any);
    assert.deepEqual(v.risks.map((r) => r.id), ['risk-overdue-actions']);
    assert.equal(removedItemCount(base as any), 3);
  });
  it('exposes no health figure and no per-person ranking', () => {
    const v = cleanInsight(base as any) as any;
    assert.equal(v.health, undefined); assert.equal(v.frequentlyAssigned, undefined); assert.equal(v.owners, undefined);
    assert.ok(!JSON.stringify(v).includes('Sam'));
  });
  it('overdue rate abstains under 5 open actions', () => { assert.equal(cleanInsight(base as any).overdueOfOpen.ok, false); });
  it('shows when it was calculated', () => { assert.equal(cleanInsight(base as any).calculated, 'Last calculated 31 October 2026.'); });
  it('stats drops the participation table and abstains on small counts', () => {
    const s = cleanStats({ totalProjects: 2, totalDecisions: 1, totalActions: 3, completedActions: 1, openActions: 2, overdueActions: 1, teamParticipation: [{ name: 'Sam' }] });
    assert.equal(s.hasParticipationTable, false); assert.equal(s.completion.ok, false); assert.ok(!JSON.stringify(s).includes('Sam'));
  });
  it('stats shows a rate with n over d from 5 up', () => {
    const s = cleanStats({ totalProjects: 5, totalDecisions: 5, totalActions: 10, completedActions: 4, openActions: 6, overdueActions: 3 }) as any;
    assert.equal(s.completion.ok, true); assert.equal(s.completion.value.percent, 40); assert.equal(s.overdueOfOpen.value.denominator, 6);
  });
});
