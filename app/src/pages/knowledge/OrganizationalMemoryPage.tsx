import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  KnowledgeCluster,
  LessonLearned,
  KnowledgeClusterCategory,
  CLUSTER_CATEGORY_LABELS,
} from '../../lib/knowledge/types';

export const OrganizationalMemoryPage: React.FC = () => {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const [clusters, setClusters] = useState<KnowledgeCluster[]>([]);
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [historicalDecisions, setHistoricalDecisions] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<KnowledgeClusterCategory | 'all'>('all');

  // Form state
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newOutcome, setNewOutcome] = useState('');
  const [newCategory, setNewCategory] = useState<KnowledgeClusterCategory>('operational_excellence');

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading Organizational Memory...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemoryData();
  }, [user]);

  const loadMemoryData = async () => {
    if (!user) return;
    setLoading(true);
    setLoadingMessage('Loading Organizational Memory...');
    setError(null);

    try {
      // 1. Fetch clusters
      const resClusters = await fetch('/api/knowledge/clusters');
      if (resClusters.ok) {
        const json = await resClusters.json();
        setClusters(json.data || []);
      }

      // 2. Fetch lessons learned
      setLoadingMessage('Loading Lessons Learned...');
      const { data: lessonsData, error: lessonsErr } = await supabase
        .from('lessons_learned')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (lessonsErr) throw lessonsErr;
      setLessons(lessonsData || []);

      // 3. Fetch historical decisions
      const { data: decData } = await supabase
        .from('decision_memory')
        .select('id, title, decision_text, status, impact_level, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      setHistoricalDecisions(decData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizational memory');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim() || !newOutcome.trim()) return;

    try {
      const res = await fetch('/api/knowledge/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          summary: newSummary,
          outcome: newOutcome,
          cluster_category: newCategory,
        }),
      });

      if (!res.ok) throw new Error('Failed to create lesson learned');
      setShowLessonModal(false);
      setNewTitle('');
      setNewSummary('');
      setNewOutcome('');
      await loadMemoryData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Soft-delete this lesson learned?')) return;
    try {
      const res = await fetch(`/api/knowledge/lessons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete lesson');
      await loadMemoryData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredLessons = activeCategory === 'all'
    ? lessons
    : lessons.filter((l) => l.cluster_category === activeCategory);

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ color: '#f8fafc', fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
              Organizational Memory
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', fontWeight: 600 }}>
              Continuous Learning
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px' }}>
            Institutional memory repository aggregating historical decisions, lessons learned, and knowledge clusters across initiatives.
          </p>
        </div>

        <button
          onClick={() => setShowLessonModal(true)}
          className="btn btn-primary"
          style={{
            background: '#e2b53c',
            color: '#0f172a',
            fontWeight: 700,
            padding: '10px 18px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          + Record Lesson Learned
        </button>
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
          <div style={{ fontSize: '0.85rem' }}>Synthesizing knowledge clusters and lessons...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Section 1: Knowledge Clusters */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                Knowledge Clusters ({clusters.length})
              </h2>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Automatically grouped organizational themes</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {clusters.map((c) => (
                <div
                  key={c.category}
                  className="panel"
                  style={{
                    padding: '18px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{c.title}</h3>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', fontWeight: 700 }}>
                      {c.node_count} nodes
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.4, margin: '8px 0 12px 0' }}>
                    {c.description}
                  </p>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Key Focus Areas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {c.themes.map((th, i) => (
                        <span key={i} style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '3px', color: '#cbd5e1' }}>
                          {th}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Lessons Learned System */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                  Lessons Learned Repository ({lessons.length})
                </h2>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                  Shared reflections and verified outcomes preserved in the Knowledge Graph
                </div>
              </div>

              {/* Cluster Filter */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                <button
                  onClick={() => setActiveCategory('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    background: activeCategory === 'all' ? '#e2b53c' : '#1e293b',
                    color: activeCategory === 'all' ? '#0f172a' : '#cbd5e1',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  All ({lessons.length})
                </button>
                {Object.entries(CLUSTER_CATEGORY_LABELS).map(([catKey, label]) => (
                  <button
                    key={catKey}
                    onClick={() => setActiveCategory(catKey as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '0.75rem',
                      background: activeCategory === catKey ? '#e2b53c' : '#1e293b',
                      color: activeCategory === catKey ? '#0f172a' : '#cbd5e1',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredLessons.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {filteredLessons.map((l) => (
                  <div
                    key={l.id}
                    className="panel"
                    style={{
                      padding: '18px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                          {CLUSTER_CATEGORY_LABELS[l.cluster_category] || l.cluster_category}
                        </span>
                        <button
                          onClick={() => handleDeleteLesson(l.id)}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          ✕
                        </button>
                      </div>
                      <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600, margin: '4px 0 8px 0' }}>{l.title}</h3>
                      <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>{l.summary}</p>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 12px', borderRadius: '6px', marginTop: '14px' }}>
                      <div style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>Measured Outcome:</div>
                      <div style={{ color: '#f8fafc', fontSize: '0.82rem', marginTop: '2px' }}>{l.outcome}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                No lessons recorded under this category yet. Click "+ Record Lesson Learned" to add institutional learnings.
              </div>
            )}
          </div>

          {/* Section 3: Historical Decisions & Governance Memory */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                Historical Decisions & Lineage
              </h2>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Persistent decisions informing current actions</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {historicalDecisions.map((d) => (
                <div key={d.id} className="panel" style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', fontWeight: 600 }}>
                      {d.status || 'Active'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                      {new Date(d.created_at).toLocaleDateString('en-AU')}
                    </span>
                  </div>
                  <h4 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 600, margin: '4px 0' }}>{d.title}</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.4, margin: 0 }}>
                    {d.decision_text || d.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Lesson Learned */}
      {showLessonModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '540px',
              width: '100%',
            }}
          >
            <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px 0' }}>
              Record Lesson Learned
            </h2>

            <form onSubmit={handleCreateLesson} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                  Lesson Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Early third-party API rate limiting test"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#16263f',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                  Knowledge Cluster Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  style={{
                    width: '100%',
                    background: '#16263f',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                >
                  {Object.entries(CLUSTER_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                  Summary / What Was Learned
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail the experience, decision context, and what should be replicated or avoided..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#16263f',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                  Outcome / Actionable Takeaway
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mandated integration staging smoke tests prior to sprint sign-off."
                  value={newOutcome}
                  onChange={(e) => setNewOutcome(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#16263f',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#1e293b',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    background: '#e2b53c',
                    color: '#0f172a',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Save Lesson
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
