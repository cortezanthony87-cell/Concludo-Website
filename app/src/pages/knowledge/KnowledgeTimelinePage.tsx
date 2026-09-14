import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  KnowledgeTimelineItem,
  KnowledgeJourney,
} from '../../lib/knowledge/types';

export const KnowledgeTimelinePage: React.FC = () => {
  const { user } = useAuth();

  const [timeline, setTimeline] = useState<KnowledgeTimelineItem[]>([]);
  const [journey, setJourney] = useState<KnowledgeJourney | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading Timeline...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTimelineData();
  }, [user]);

  const loadTimelineData = async () => {
    if (!user) return;
    setLoading(true);
    setLoadingMessage('Loading Timeline...');
    setError(null);
    try {
      const res = await fetch('/api/knowledge/timeline');
      if (!res.ok) throw new Error('Failed to load knowledge timeline');
      const json = await res.json();
      const items: KnowledgeTimelineItem[] = json.data || [];
      setTimeline(items);

      if (items.length > 0 && !selectedTargetId) {
        loadJourney(items[0].node.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const loadJourney = async (targetId: string) => {
    setSelectedTargetId(targetId);
    try {
      const res = await fetch(`/api/knowledge/journey/${targetId}`);
      if (!res.ok) throw new Error('Failed to load knowledge journey');
      const json = await res.json();
      setJourney(json.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ color: '#f8fafc', fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Knowledge Timeline & Strategic Journey
          </h1>
          <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 600 }}>
            Lineage & Provenance
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px' }}>
          Chronological sequence answering: "When was this first discussed?", "What decisions led to this outcome?", and "How did we arrive here?"
        </p>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ color: '#e2b53c', fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
            {loadingMessage}
          </div>
          <div style={{ fontSize: '0.85rem' }}>Tracing chronological records and relationships...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(360px, 1fr)', gap: '24px' }}>
          {/* Left Column: Chronological Event Stream */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
                Chronological Milestones ({timeline.length})
              </h2>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Select an event to reconstruct its journey</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {timeline.map((item) => {
                const isSelected = selectedTargetId === item.node.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => loadJourney(item.node.id)}
                    className="panel"
                    style={{
                      padding: '16px',
                      background: isSelected ? 'rgba(226, 181, 60, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                      border: isSelected ? '1px solid #e2b53c' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.event_type}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {new Date(item.date).toLocaleDateString('en-AU', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <span style={{ color: '#e2b53c', fontSize: '0.75rem', fontWeight: 600 }}>
                        {item.connected_nodes_count} connected
                      </span>
                    </div>

                    <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: '4px 0 6px 0' }}>
                      {item.node.title}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.4, margin: 0 }}>
                      {item.node.summary || 'Operational record'}
                    </p>

                    {item.relationships.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {item.relationships.slice(0, 3).map((r, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              borderRadius: '3px',
                              color: '#cbd5e1',
                            }}
                          >
                            {r.relationship_type.replace(/_/g, ' ')}: {r.target_node_title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Knowledge Journey "How did we arrive here?" */}
          <div>
            <div style={{ position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
                  Knowledge Journey Explorer
                </h2>
                <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>How did we arrive here?</span>
              </div>

              {journey ? (
                <div
                  className="panel"
                  style={{
                    padding: '20px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(226, 181, 60, 0.25)',
                    borderRadius: '8px',
                  }}
                >
                  <h3 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 10px 0' }}>
                    {journey.title}
                  </h3>

                  <div style={{ background: '#0b1322', padding: '12px 14px', borderRadius: '6px', marginBottom: '18px' }}>
                    <div style={{ color: '#e2b53c', fontSize: '0.78rem', fontWeight: 600 }}>Relationship Chain:</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontFamily: 'monospace', marginTop: '4px' }}>
                      {journey.relationship_path.join(' ')}
                    </div>
                  </div>

                  {/* Step by Step Journey */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
                    {journey.steps.map((step) => (
                      <div
                        key={step.step_number}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          paddingLeft: '4px',
                        }}
                      >
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: '#e2b53c',
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {step.step_number}
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: '#e2b53c', fontWeight: 600 }}>
                              {step.role_in_journey}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {new Date(step.date).toLocaleDateString('en-AU')}
                            </span>
                          </div>
                          <div style={{ color: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, marginTop: '2px' }}>
                            {step.node.title}
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginTop: '4px' }}>
                            {step.outcome}
                          </div>
                          {step.relationship_to_next && (
                            <div style={{ color: '#38bdf8', fontSize: '0.72rem', marginTop: '6px', fontStyle: 'italic' }}>
                              ↓ Leads to next step via: {step.relationship_to_next.replace(/_/g, ' ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Evidence Chain */}
                  <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Evidence Chain Verification:
                    </div>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', color: '#cbd5e1', fontSize: '0.78rem' }}>
                      {journey.evidence_chain.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>Select a milestone on the left to reconstruct its journey.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
