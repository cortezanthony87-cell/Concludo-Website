import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { KnowledgeClient } from '../lib/knowledge/knowledgeClient';
import { KnowledgeTimelineItem, KnowledgeJourney } from '../lib/knowledge/types';
import { PageHeader, StatePanel, ProvenanceChip } from '../components/intel/IntelKit';
import { sortTimeline, formatDay, eventLabel } from '../lib/intel/memoryView';
import '../styles/intel-bright.css';

/**
 * Memory > Timeline. One job: show what happened in order, and how one item connects to others.
 * Uses the browser-side KnowledgeClient. The old /api/knowledge/timeline and /journey routes are not called.
 * Links between items are "Inferred" because the graph builder derives them from saved records.
 */
export const MemoryTimelinePage: React.FC = () => {
  const { supabase } = useAuth();
  const access = useFeatureAccess('meeting_memory');
  const client = useMemo(() => new KnowledgeClient(supabase), [supabase]);

  const [items, setItems] = useState<KnowledgeTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [journey, setJourney] = useState<KnowledgeJourney | null>(null);
  const [jLoading, setJLoading] = useState(false);
  const [jError, setJError] = useState<string | null>(null);

  const openJourney = useCallback(async (nodeId: string) => {
    setSelected(nodeId);
    setJLoading(true);
    setJError(null);
    try {
      setJourney(await client.getKnowledgeJourney(nodeId));
    } catch (e: any) {
      setJourney(null);
      setJError(e?.message || 'The connections for this item could not be loaded.');
    }
    setJLoading(false);
  }, [client]);

  const load = useCallback(async () => {
    if (!access.isAllowed) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = sortTimeline(await client.getKnowledgeTimeline());
      setItems(data);
      if (data.length) openJourney(data[0].node.id);
    } catch (e: any) {
      setError(e?.message || 'The timeline could not be loaded.');
      setItems([]);
    }
    setLoading(false);
  }, [client, access.isAllowed, openJourney]);

  useEffect(() => { load(); }, [load]);

  const header = <PageHeader title="Timeline" purpose="What happened, newest first. Pick an item to see what it connects to." crumbs={[{ label: 'Memory' }, { label: 'Timeline' }]} />;

  if (!access.isAllowed) {
    return (
      <div className="ib">{header}
        <StatePanel kind="denied" title="Timeline is not part of your current plan" body="Prices are indicative until validated with real buyers."
          action={<Link className="ib-btn ib-btn--primary" to="/dashboard">Back to dashboard</Link>} />
      </div>
    );
  }

  return (
    <div className="ib">
      {header}
      {loading && <StatePanel kind="loading" title="Loading timeline" />}
      {!loading && error && <StatePanel kind="error" title="The timeline could not be loaded" body={error} action={<button type="button" className="ib-btn" onClick={load}>Try again</button>} />}
      {!loading && !error && items.length === 0 && (
        <StatePanel kind="empty" title="Nothing on the timeline yet" body="Items appear after decisions and lessons are saved and the knowledge graph has been built." action={<Link className="ib-btn ib-btn--primary" to="/projects">Go to projects</Link>} />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="ib-split">
          <ul className="ib-list" aria-label="Timeline items">
            {items.map((it) => (
              <li key={it.id} className={`ib-card${selected === it.node.id ? ' ib-card--selected' : ''}`}>
                <button type="button" className="ib-linkbtn" aria-pressed={selected === it.node.id} onClick={() => openJourney(it.node.id)}>
                  <span className="ib-card__meta">
                    <ProvenanceChip kind="recorded" />
                    <span>{eventLabel(it.event_type)}</span>
                    <span>{formatDay(it.date)}</span>
                    <span>{it.connected_nodes_count} connected</span>
                  </span>
                  <span className="ib-card__title" style={{ display: 'block' }}>{it.node.title}</span>
                  <span className="ib-card__body" style={{ display: 'block' }}>{it.node.summary || 'No summary was saved with this record.'}</span>
                </button>
              </li>
            ))}
          </ul>

          <section aria-label="Connections for the selected item" aria-live="polite">
            <h2 className="ib-card__title">What it connects to</h2>
            {jLoading && <StatePanel kind="loading" title="Loading connections" />}
            {!jLoading && jError && <StatePanel kind="error" title="Connections unavailable" body={jError} action={selected ? <button type="button" className="ib-btn" onClick={() => openJourney(selected)}>Try again</button> : undefined} />}
            {!jLoading && !jError && journey && journey.steps.length <= 1 && (
              <StatePanel kind="insufficient" title="No connections found yet" body="Not enough evidence yet: this item is not linked to any other saved record." />
            )}
            {!jLoading && !jError && journey && journey.steps.length > 1 && (
              <ol className="ib-steps">
                {journey.steps.map((s) => (
                  <li key={s.step_number} className="ib-card">
                    <div className="ib-card__meta">
                      <ProvenanceChip kind="inferred" />
                      <span>Step {s.step_number}</span>
                      <span>{formatDay(s.date)}</span>
                    </div>
                    <h3 className="ib-card__title">{s.node.title}</h3>
                    {s.relationship_to_next && <p className="ib-card__body">Leads to the next step through: {eventLabel(s.relationship_to_next)}</p>}
                  </li>
                ))}
              </ol>
            )}
            <p className="ib-note">Connections are worked out from saved records. Check the source before relying on one. Step roles and triggers are not shown, because nobody recorded them.</p>
          </section>
        </div>
      )}
    </div>
  );
};
