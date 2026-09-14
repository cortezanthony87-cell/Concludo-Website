import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Layers,
  ChevronRight,
  Shield,
  Download,
  Share2,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import { ExecutiveBriefingRecord, ExecutiveReportType } from '../../lib/predictive/types';
import {
  createExecutiveBriefing,
  fetchExecutiveBriefings,
  softDeleteExecutiveBriefing,
} from '../../lib/predictive/executiveBriefingService';
import { getPredictiveAnalysis } from '../../lib/predictive/predictiveService';

export const ExecutiveBriefingsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [briefings, setBriefings] = useState<ExecutiveBriefingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBriefing, setSelectedBriefing] = useState<ExecutiveBriefingRecord | null>(null);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [briefingTitle, setBriefingTitle] = useState<string>('');
  const [reportType, setReportType] = useState<ExecutiveReportType>('executive_summary');
  const [generating, setGenerating] = useState<boolean>(false);

  const loadBriefings = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExecutiveBriefings({ userId: user.id });
      setBriefings(data);
      if (data.length > 0 && !selectedBriefing) {
        setSelectedBriefing(data[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load executive briefings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBriefings();
  }, [user]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !briefingTitle.trim()) return;

    setGenerating(true);
    try {
      const analysis = await getPredictiveAnalysis({
        scope: 'individual',
        userId: user.id,
      });

      const result = await createExecutiveBriefing({
        title: briefingTitle.trim(),
        reportType,
        userId: user.id,
        analysis,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate briefing.');
      }

      setBriefings([result.data, ...briefings]);
      setSelectedBriefing(result.data);
      setCreateModalOpen(false);
      setBriefingTitle('');
    } catch (err: any) {
      alert(`Error generating briefing: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this executive briefing? It will remain recoverable in Recently Deleted for 30 days.')) {
      return;
    }

    try {
      if (!user) return;
      await softDeleteExecutiveBriefing(id, user.id);
      const remaining = briefings.filter((b) => b.id !== id);
      setBriefings(remaining);
      if (selectedBriefing?.id === id) {
        setSelectedBriefing(remaining[0] || null);
      }
    } catch (err: any) {
      alert(`Failed to delete briefing: ${err.message}`);
    }
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
              Executive Briefings
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', border: '1px solid rgba(226, 181, 60, 0.3)', fontWeight: 600 }}>
              Strategic Artifacts
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            Formal leadership reports, operational risk assessments, and strategic health briefings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={loadBriefings} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setBriefingTitle(`Executive Briefing — ${new Date().toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`);
              setCreateModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Generate New Briefing</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} className="spin-animation" style={{ color: '#e2b53c', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8' }}>Loading executive briefings...</p>
        </div>
      ) : error ? (
        <div className="panel" style={{ padding: '30px', textAlign: 'center' }}>
          <AlertTriangle size={36} color="#f87171" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#f87171' }}>{error}</p>
        </div>
      ) : briefings.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <FileText size={48} color="#e2b53c" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', marginBottom: '8px' }}>No Executive Briefings Generated Yet</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 24px' }}>
            Executive Briefings synthesize current health scores, risk predictions, decision velocity, and strategic recommendations into formal board-ready documents.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setBriefingTitle(`Executive Briefing — ${new Date().toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`);
              setCreateModalOpen(true);
            }}
          >
            Generate Your First Briefing
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '20px', alignItems: 'flex-start' }}>
          {/* Briefing Sidebar List */}
          <div className="panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Saved Briefings ({briefings.length})
            </div>
            {briefings.map((b) => {
              const isSelected = selectedBriefing?.id === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBriefing(b)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(226, 181, 60, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                    border: isSelected ? '1px solid #e2b53c' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.88rem' }}>{b.title}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>{b.report_type.replace(/_/g, ' ')}</span>
                    <span>{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Briefing Viewer */}
          {selectedBriefing && (
            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ color: '#f8fafc', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px 0' }}>
                    {selectedBriefing.title}
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', color: '#94a3b8', fontSize: '0.82rem' }}>
                    <span>Type: <strong>{selectedBriefing.report_type.replace(/_/g, ' ').toUpperCase()}</strong></span>
                    <span>Generated: {new Date(selectedBriefing.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDelete(selectedBriefing.id)}
                    style={{ color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Briefing Sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {selectedBriefing.content?.sections ? (
                  selectedBriefing.content.sections.map((sec, idx) => (
                    <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px 20px', borderRadius: '8px', borderLeft: '3px solid #e2b53c' }}>
                      <h3 style={{ color: '#e2b53c', fontSize: '1.05rem', fontWeight: 600, margin: '0 0 10px 0' }}>
                        {sec.heading}
                      </h3>
                      <div style={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                        {sec.body}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#94a3b8' }}>{JSON.stringify(selectedBriefing.content, null, 2)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generation Modal */}
      {createModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="panel" style={{ width: '100%', maxWidth: '500px', padding: '24px', background: '#16263F', border: '1px solid rgba(226, 181, 60, 0.3)' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>
              Generate Executive Briefing
            </h3>
            <form onSubmit={handleGenerate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>
                  Briefing Title
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '6px', color: '#f8fafc' }}
                  value={briefingTitle}
                  onChange={(e) => setBriefingTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>
                  Report Type
                </label>
                <select
                  className="input"
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '6px', color: '#f8fafc' }}
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                >
                  <option value="executive_summary">Executive Summary</option>
                  <option value="strategic_health_report">Strategic Health Report</option>
                  <option value="risk_report">Risk Report</option>
                  <option value="opportunity_report">Opportunity Report</option>
                  <option value="operational_performance_report">Operational Performance Report</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={generating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={generating || !briefingTitle.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {generating && <RefreshCw size={14} className="spin-animation" />}
                  <span>{generating ? 'Generating Briefing...' : 'Generate Artifact'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
