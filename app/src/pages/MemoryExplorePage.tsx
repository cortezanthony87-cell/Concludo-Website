import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { KnowledgeClient } from '../lib/knowledge/knowledgeClient';
import { KnowledgeNode, KnowledgeRelationship, DecisionNetwork, ProjectNetwork } from '../lib/knowledge/types';
import { PageHeader, ScopeBar, StatePanel, ProvenanceChip, ConfirmDialog } from '../components/intel/IntelKit';
import { filterNodes, typeCounts, typeLabel, connectionsFor, connectionSentence, describeExploreScope } from '../lib/intel/exploreView';
import { formatDay } from '../lib/intel/memoryView';
import '../styles/intel-bright.css';

/**
 * Memory > Explore. One job: find a saved record and see what it is linked to.
 * Replaces the five-tab Knowledge Explorer. Uses the browser-side KnowledgeClient, no /api/knowledge/* call.
 * Removed on purpose: the confidence percentages (fixed constants in the engine) and the force-graph canvas
 * (not yet inspected). The search box filters the loaded records by title and summary.
 */
export const MemoryExplorePage: React.FC = () => {
  const { supabase } = useAuth();
  const access = useFeatureAccess('meeting_memory');
  const client = useMemo(() => new KnowledgeClient(supabase), [supabase]);

  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [rels, setRels] = useState<KnowledgeRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [net, setNet] = useState<DecisionNetwork | ProjectNetwork | null>(null);
  const [netLoading, setNetLoading] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);

  const [confirmSync, setConfirmSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!access.isAllowed) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [n, r] = await Promise.all([client.fetchNodes(), client.fetchRelationships()]);
      setNodes(n);
      setRels(r);
    } catch (e: any) {
      setError(e?.message || 'The knowledge graph could not be loaded.');
      setNodes([]);
      setRels([]);
    }
    setLoading(false);
  }, [client, access.isAllowed]);

  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const counts = useMemo(() => typeCounts(nodes), [nodes]);
  const shown = useMemo(() => filterNodes(nodes, { query, type }), [nodes, query, type]);
  const selected = selectedId ? byId.get(selectedId) || null : null;
  const links = useMemo(() => (selected ? connectionsFor(selected.id, rels, byId) : []), [selected, rels, byId]);

  const select = async (n: KnowledgeNode) => {
    setSelectedId(n.id);
    setNet(null);
    setNetError(null);
    if (n.node_type !== 'decision' && n.node_type !== 'project') return;
    setNetLoading(true);
    try {
      setNet(n.node_type === 'decision' ? await client.getDecisionNetwork(n.id) : await client.getProjectNetwork(n.id));
    } catch (e: any) {
      setNetError(e?.message || 'The wider network could not be loaded.');
    }
    setNetLoading(false);
  };

  const rebuild = async () => {
    setSyncing(true);
    try {
      const r = await client.syncKnowledgeGraph();
      setNotice(`Links rebuilt: ${r.nodesCount} records and ${r.relationshipsCount} links.`);
      await load();
    } catch (e: any) {
      setNotice(`The links could not be rebuilt. ${e?.message || ''}`.trim());
    }
    setSyncing(false);
    setConfirmSync(false);
  };

  const header = (
    <PageHeader
      title="Explore"
      purpose="Find a saved record and see what it is linked to."
      crumbs={[{ label: 'Memory' }, { label: 'Explore' }]}
      actions={access.isAllowed ? <button type="button" className="ib-btn" onClick={() => setConfirmSync(true)}>Rebuild links</button> : undefined}
    />
  );

  if (!access.isAllowed) {
    return (
      <div className="ib">{header}
        <StatePanel kind="denied" title="Explore is not part of your current plan" body="Prices are indicative until validated with real buyers."
          action={<Link className="ib-btn ib-btn--primary" to="/dashboard">Back to dashboard</Link>} />
      </div>
    );
  }

  const groups = (items: KnowledgeNode[] | undefined, label: string) =>
    items && items.length > 0 ? (
      <div className="ib-why"><strong>{label} ({items.length}): </strong>{items.map((i) => i.title).join('; ')}</div>
    ) : null;

  return (
    <div className="ib">
      {header}
      {notice && <p className="ib-note" role="status">{notice}</p>}

      <ScopeBar summary={loading ? 'waiting for the records to load' : error ? 'nothing yet, because the records did not load' : describeExploreScope({ shown: shown.length, total: nodes.length, type: type === 'all' ? 'all' : typeLabel(type), query })}>
        <div className="ib-field ib-field--grow">
          <label className="ib-label" htmlFor="mx-search">Search</label>
          <input id="mx-search" className="ib-input" type="search" placeholder="Title or summary" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="ib-field">
          <label className="ib-label" htmlFor="mx-type">Type</label>
          <select id="mx-type" className="ib-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types ({nodes.length})</option>
            {Object.keys(counts).sort().map((t) => <option key={t} value={t}>{typeLabel(t)} ({counts[t]})</option>)}
          </select>
        </div>
      </ScopeBar>

      {loading && <StatePanel kind="loading" title="Loading records" />}
      {!loading && error && <StatePanel kind="error" title="The knowledge graph could not be loaded" body={error} action={<button type="button" className="ib-btn" onClick={load}>Try again</button>} />}
      {!loading && !error && nodes.length === 0 && (
        <StatePanel kind="empty" title="No records in the graph yet" body="Save decisions, lessons or outputs first, then choose Rebuild links to connect them." action={<button type="button" className="ib-btn ib-btn--primary" onClick={() => setConfirmSync(true)}>Rebuild links</button>} />
      )}
      {!loading && !error && nodes.length > 0 && shown.length === 0 && (
        <StatePanel kind="empty" title="Nothing matches these filters" body="Clear the search or choose all types." action={<button type="button" className="ib-btn" onClick={() => { setQuery(''); setType('all'); }}>Clear filters</button>} />
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="ib-split">
          <ul className="ib-list" aria-label="Records">
            {shown.map((n) => (
              <li key={n.id} className={`ib-card${selectedId === n.id ? ' ib-card--selected' : ''}`}>
                <button type="button" className="ib-linkbtn" aria-pressed={selectedId === n.id} onClick={() => select(n)}>
                  <span className="ib-card__meta"><ProvenanceChip kind="recorded" /><span>{typeLabel(n.node_type)}</span><span>{formatDay(n.created_at)}</span></span>
                  <span className="ib-card__title" style={{ display: 'block' }}>{n.title}</span>
                  <span className="ib-card__body" style={{ display: 'block' }}>{n.summary || 'No summary was saved with this record.'}</span>
                </button>
              </li>
            ))}
          </ul>

          <section aria-label="Links for the selected record" aria-live="polite">
            <h2 className="ib-card__title">{selected ? selected.title : 'Links'}</h2>
            {!selected && <StatePanel kind="empty" title="Pick a record" body="Its links appear here." />}
            {selected && links.length === 0 && <StatePanel kind="insufficient" title="No links found" body="Not enough evidence yet: this record is not linked to any other saved record." />}
            {selected && links.length > 0 && (
              <ul className="ib-steps">
                {links.map((c) => (
                  <li key={c.id} className="ib-card">
                    <div className="ib-card__meta"><ProvenanceChip kind="inferred" />{c.other && <span>{typeLabel(c.other.node_type)}</span>}</div>
                    <p className="ib-card__body">{connectionSentence(c, selected.title)}</p>
                  </li>
                ))}
              </ul>
            )}
            {netLoading && <StatePanel kind="loading" title="Loading the wider network" />}
            {netError && <StatePanel kind="error" title="Wider network unavailable" body={netError} />}
            {net && 'decision' in net && (
              <div className="ib-card" style={{ marginTop: 12 }}>
                <div className="ib-card__meta"><ProvenanceChip kind="inferred" /><span>Around this decision</span></div>
                {groups(net.related_decisions, 'Related decisions')}
                {groups(net.dependent_actions, 'Actions that depend on it')}
                {groups(net.affected_projects, 'Projects affected')}
              </div>
            )}
            {net && 'project' in net && (
              <div className="ib-card" style={{ marginTop: 12 }}>
                <div className="ib-card__meta"><ProvenanceChip kind="inferred" /><span>Around this project</span></div>
                {groups(net.linked_decisions, 'Linked decisions')}
                {groups(net.connected_projects, 'Connected projects')}
                {groups(net.related_risks, 'Risks')}
              </div>
            )}
            <p className="ib-note">Links are worked out from saved records when you rebuild them. Check the source before relying on one. No confidence percentage is shown, because the old figure was a fixed number.</p>
          </section>
        </div>
      )}

      <ConfirmDialog open={confirmSync} title="Rebuild links?" body="This reads your saved decisions, projects and actions and updates the derived link records. Your original records are not changed." confirmLabel="Rebuild links" busy={syncing} onConfirm={rebuild} onCancel={() => setConfirmSync(false)} />
    </div>
  );
};
