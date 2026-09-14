import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { KnowledgeAnalyticsData, CLUSTER_CATEGORY_LABELS } from '../../lib/knowledge/types';

export const KnowledgeAnalyticsPage: React.FC = () => {
  const { user } = useAuth();

  const [analytics, setAnalytics] = useState<KnowledgeAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge/analytics');
      if (!res.ok) throw new Error('Failed to load knowledge analytics');
      const json = await res.json();
      setAnalytics(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ color: '#f8fafc', fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Knowledge Analytics & Network Metrics
          </h1>
          <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.2)', color: '#e2b53c', fontWeight: 600 }}>
            Graph Topology
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px' }}>
          Quantitative metrics across node distribution, relationship density, most connected initiatives, and growing knowledge areas.
        </p>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading || !analytics ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ color: '#e2b53c', fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
            Loading Analytics...
          </div>
          <div style={{ fontSize: '0.85rem' }}>Computing graph density and topological metrics...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Metrics Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Total Knowledge Nodes</div>
              <div style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>
                {analytics.total_nodes}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>Across workspace</div>
            </div>

            <div className="panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Total Relationships</div>
              <div style={{ color: '#e2b53c', fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>
                {analytics.total_relationships}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>Discovered connections</div>
            </div>

            <div className="panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Graph Density</div>
              <div style={{ color: '#38bdf8', fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>
                {analytics.density}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>Interconnectivity ratio</div>
            </div>

            <div className="panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Fastest Growing Cluster</div>
              <div style={{ color: '#4ade80', fontSize: '1.25rem', fontWeight: 700, marginTop: '6px' }}>
                {CLUSTER_CATEGORY_LABELS[analytics.fastest_growing_areas[0]?.cluster] || 'Operational'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
                +{analytics.fastest_growing_areas[0]?.growth_rate_pct || 30}% (30d)
              </div>
            </div>
          </div>

          {/* Connected Entities & Themes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Most Connected Projects */}
            <div className="panel" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: '0 0 12px 0' }}>
                Most Connected Projects
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analytics.most_connected_projects.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                    <span style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{p.title}</span>
                    <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700 }}>{p.connections} connections</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Referenced Themes */}
            <div className="panel" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: '0 0 12px 0' }}>
                Most Referenced Themes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analytics.most_referenced_themes.map((th, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                    <span style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{th.theme}</span>
                    <span style={{ color: '#e2b53c', fontSize: '0.85rem', fontWeight: 700 }}>{th.references} refs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fastest Growing Areas */}
          <div className="panel" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.7)' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: '0 0 12px 0' }}>
              Fastest Growing Knowledge Areas (30-Day Window)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {analytics.fastest_growing_areas.map((area) => (
                <div key={area.cluster} style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', borderLeft: '3px solid #4ade80' }}>
                  <div style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    {CLUSTER_CATEGORY_LABELS[area.cluster] || area.cluster}
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: '1.3rem', fontWeight: 700, marginTop: '6px' }}>
                    +{area.growth_rate_pct}%
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                    +{area.new_nodes_30d} new nodes created
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
