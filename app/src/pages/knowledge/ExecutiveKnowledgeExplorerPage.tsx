import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { KnowledgeCluster, KnowledgeAnalyticsData, CLUSTER_CATEGORY_LABELS } from '../../lib/knowledge/types';

export const ExecutiveKnowledgeExplorerPage: React.FC = () => {
  const { user, profile } = useAuth();

  const [data, setData] = useState<{
    clusters: KnowledgeCluster[];
    analytics: KnowledgeAnalyticsData;
    timeline: any[];
    strategicThemes: string[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExecutiveData();
  }, [user]);

  const loadExecutiveData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/executive-explorer');
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Executive Knowledge Explorer is restricted to Enterprise and Admin plans.');
        }
        throw new Error('Failed to load executive knowledge explorer');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isEnterpriseOrAdmin = profile?.plan === 'enterprise' || profile?.plan === 'admin';

  if (!isEnterpriseOrAdmin) {
    return (
      <div className="container" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div className="panel" style={{ padding: '32px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(226, 181, 60, 0.3)' }}>
          <div style={{ color: '#e2b53c', fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ color: '#f8fafc', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0' }}>
            Enterprise Access Only
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
            The Executive Knowledge Explorer synthesizes cross-team knowledge clusters, strategic themes, recurring risk networks, and organizational lineage. This feature requires an Enterprise subscription.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ color: '#f8fafc', fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Executive Knowledge Explorer
          </h1>
          <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.2)', color: '#e2b53c', fontWeight: 700 }}>
            Enterprise Leadership
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px' }}>
          Strategic view across cross-team knowledge clusters, organizational learning patterns, recurring risks, and executive decision lineage.
        </p>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading || !data ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ color: '#e2b53c', fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
            Loading Executive Explorer...
          </div>
          <div style={{ fontSize: '0.85rem' }}>Aggregating strategic themes and organizational memory...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Row: Strategic Themes */}
          <div className="panel" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.7)' }}>
            <h2 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 12px 0' }}>
              Strategic Themes & Organizational Focus Areas
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {data.strategicThemes.map((theme, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '6px',
                    borderLeft: '3px solid #e2b53c',
                  }}
                >
                  <div style={{ color: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{theme}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>Active organizational theme</div>
                </div>
              ))}
            </div>
          </div>

          {/* Middle Row: Recurring Risks & Decision Lineage */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            <div className="panel" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                  Recurring Risk Networks
                </h3>
                <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>Active Patterns</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.analytics.most_common_risks.map((r, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600 }}>{r.risk}</span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', background: '#ef4444', color: '#ffffff', fontWeight: 700 }}>
                        {r.severity}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                      Detected in {r.frequency} cross-project workstreams
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                  Most Connected Decisions (Lineage)
                </h3>
                <span style={{ color: '#e2b53c', fontSize: '0.75rem', fontWeight: 600 }}>High Leverage</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.analytics.most_connected_decisions.length > 0 ? (
                  data.analytics.most_connected_decisions.map((d) => (
                    <div key={d.id} style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600 }}>{d.title}</span>
                        <span style={{ color: '#e2b53c', fontSize: '0.75rem', fontWeight: 700 }}>{d.connections} links</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                        Informs downstream actions and milestone dependencies
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#64748b', fontSize: '0.82rem' }}>No decision connections mapped yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Knowledge Clusters Overview */}
          <div className="panel" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.7)' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 14px 0' }}>
              Knowledge Cluster Distribution & Growth
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {data.clusters.map((c) => (
                <div key={c.category} style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                  <div style={{ color: '#38bdf8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    {CLUSTER_CATEGORY_LABELS[c.category] || c.category}
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: '1.4rem', fontWeight: 700, margin: '6px 0 2px 0' }}>
                    {c.node_count}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Associated records in graph</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
