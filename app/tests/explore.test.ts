import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterNodes, typeCounts, connectionsFor, connectionSentence, describeExploreScope, typeLabel } from '../src/lib/intel/exploreView.ts';

const N = (id: string, node_type: string, title: string, summary: string | null = null) => ({ id, node_type, title, summary }) as any;
const nodes = [N('a', 'decision', 'Fortnightly reporting', 'client asked'), N('b', 'project', 'Alpha'), N('c', 'action', 'Send list')];
const R = (id: string, s: string, t: string, k: string, extra: any = {}) => ({ id, source_node_id: s, target_node_id: t, relationship_type: k, ...extra }) as any;

describe('explore', () => {
  it('filters by type and text', () => {
    assert.equal(filterNodes(nodes, { query: '', type: 'project' }).length, 1);
    assert.equal(filterNodes(nodes, { query: 'asked', type: 'all' })[0].id, 'a');
    assert.equal(filterNodes(nodes, { query: 'zzz', type: 'all' }).length, 0);
  });
  it('counts types over everything', () => assert.deepEqual(typeCounts(nodes), { decision: 1, project: 1, action: 1 }));
  it('finds links in both directions', () => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const c = connectionsFor('a', [R('1', 'a', 'b', 'influences'), R('2', 'c', 'a', 'depends_on'), R('3', 'b', 'c', 'blocks')], byId);
    assert.deepEqual(c.map((x) => [x.id, x.direction, x.other?.id]), [['1', 'out', 'b'], ['2', 'in', 'c']]);
  });
  it('keeps a link whose other end is missing', () => {
    const c = connectionsFor('a', [R('1', 'a', 'gone', 'references')], new Map(nodes.map((n) => [n.id, n])));
    assert.equal(c.length, 1);
    assert.match(connectionSentence(c[0], 'A'), /no longer available/);
  });
  it('writes a readable sentence', () => {
    const c = connectionsFor('a', [R('1', 'a', 'b', 'contributes_to')], new Map(nodes.map((n) => [n.id, n])));
    assert.equal(connectionSentence(c[0], 'Fortnightly reporting'), 'Fortnightly reporting contributes to Alpha');
  });
  it('labels types, including unknown ones', () => { assert.equal(typeLabel('user'), 'Person'); assert.equal(typeLabel('new_kind'), 'new kind'); });
  it('describes scope', () => {
    assert.equal(describeExploreScope({ shown: 0, total: 0, type: 'all', query: '' }), 'no records in the knowledge graph yet');
    assert.equal(describeExploreScope({ shown: 1, total: 3, type: 'Project', query: 'a' }), '1 of 3 records of type Project matching "a"');
  });
});
