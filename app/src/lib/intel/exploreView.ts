/** Pure view logic for Memory > Explore. No network. */
import type { KnowledgeNode, KnowledgeRelationship } from '../knowledge/types';

export const TYPE_LABELS: Record<string, string> = {
  project: 'Project', transcript: 'Transcript', output: 'Output', decision: 'Decision', action: 'Action', insight: 'Insight',
  risk: 'Risk', opportunity: 'Opportunity', recommendation: 'Recommendation', report: 'Report', forecast: 'Forecast',
  team: 'Team', user: 'Person', organization: 'Organisation',
};

export const typeLabel = (t: string): string => TYPE_LABELS[t] || (t || 'Record').replace(/_/g, ' ');

export function filterNodes(nodes: KnowledgeNode[], f: { query: string; type: string }): KnowledgeNode[] {
  const q = f.query.trim().toLowerCase();
  return nodes.filter((n) => {
    if (f.type !== 'all' && n.node_type !== f.type) return false;
    if (!q) return true;
    return `${n.title} ${n.summary || ''}`.toLowerCase().includes(q);
  });
}

export function typeCounts(nodes: KnowledgeNode[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of nodes) out[n.node_type] = (out[n.node_type] || 0) + 1;
  return out;
}

export interface Connection {
  id: string;
  other: KnowledgeNode | null;
  otherId: string;
  direction: 'out' | 'in';
  kind: string;
}

/** Relationships touching one node. A link whose other end is missing is kept, so nothing is silently dropped. */
export function connectionsFor(nodeId: string, rels: KnowledgeRelationship[], byId: Map<string, KnowledgeNode>): Connection[] {
  const out: Connection[] = [];
  for (const r of rels) {
    if (r.source_node_id === nodeId) out.push({ id: r.id, direction: 'out', kind: r.relationship_type, otherId: r.target_node_id, other: r.target_node || byId.get(r.target_node_id) || null });
    else if (r.target_node_id === nodeId) out.push({ id: r.id, direction: 'in', kind: r.relationship_type, otherId: r.source_node_id, other: r.source_node || byId.get(r.source_node_id) || null });
  }
  return out;
}

export function connectionSentence(c: Connection, title: string): string {
  const kind = c.kind.replace(/_/g, ' ');
  return c.direction === 'out' ? `${title} ${kind} ${c.other?.title || 'a record that is no longer available'}` : `${c.other?.title || 'A record that is no longer available'} ${kind} ${title}`;
}

export function describeExploreScope(a: { shown: number; total: number; type: string; query: string }): string {
  if (a.total === 0) return 'no records in the knowledge graph yet';
  const parts = [`${a.shown} of ${a.total} records`];
  if (a.type !== 'all') parts.push(`of type ${a.type}`);
  if (a.query.trim()) parts.push(`matching "${a.query.trim()}"`);
  return parts.join(' ');
}
