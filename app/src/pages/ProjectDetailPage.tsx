import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, Layers, Calendar, User, Tag } from 'lucide-react';

type TabKey = 'overview' | 'transcript' | 'outputs';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [transcriptText, setTranscriptText] = useState('');

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.88rem', fontWeight: 500 }}>
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </Link>
      </div>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Project: {id || 'Executive Review'}</h1>
          <p className="page-subtitle">Project ID: {id} · Status: Draft</p>
        </div>
      </div>

      {/* Placeholder tabs */}
      <div className="tabs-container">
        <button
          type="button"
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'outputs' ? 'active' : ''}`}
          onClick={() => setActiveTab('outputs')}
        >
          Outputs
        </button>
      </div>

      {/* Tab content area */}
      <div className="content-card">
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Project Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <Tag size={16} />
                  <span>Meeting Type</span>
                </div>
                <div style={{ fontWeight: 600, color: '#16263f' }}>Strategy & Planning</div>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <User size={16} />
                  <span>Client or Project</span>
                </div>
                <div style={{ fontWeight: 600, color: '#16263f' }}>Concludo Operations</div>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <Calendar size={16} />
                  <span>Meeting Date</span>
                </div>
                <div style={{ fontWeight: 600, color: '#16263f' }}>{new Date().toLocaleDateString('en-AU')}</div>
              </div>
            </div>

            <p style={{ color: '#64748b', fontSize: '0.92rem' }}>
              Navigate to the <strong>Transcript</strong> tab to paste your conversation text, or view generated results in the <strong>Outputs</strong> tab.
            </p>
          </div>
        )}

        {activeTab === 'transcript' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Meeting Transcript</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                Paste transcript here
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="transcript-input" className="form-label">
                Raw Transcript Text
              </label>
              <textarea
                id="transcript-input"
                className="form-textarea"
                rows={12}
                placeholder="Paste transcript here"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
              />
              <p className="form-helper">
                Paste meeting audio transcripts from Microsoft Teams, Zoom, Otter, or phone recordings.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'outputs' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Workspace Outputs</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                Generated outputs will appear here
              </p>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fff9e6',
                color: '#bc8a1c',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px'
              }}>
                <Layers size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Generated outputs will appear here</h3>
              <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto', fontSize: '0.9rem' }}>
                Once transcript processing is initiated, executive summaries, decision logs, and action items will populate in this section.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
