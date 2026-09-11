import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, Layers, Calendar, User, Tag, Sparkles, Terminal } from 'lucide-react';

type TabKey = 'overview' | 'transcript' | 'outputs';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [transcriptText, setTranscriptText] = useState('');

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500 }}>
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </Link>
      </div>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>PROJECT WORKSPACE</span>
          </div>
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
            <h2 style={{ fontSize: '1.3rem', marginBottom: '18px', fontWeight: 600 }}>Project Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '26px' }}>
              <div style={{ padding: '18px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.82rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Tag size={15} color="#f3c958" />
                  <span>Meeting Type</span>
                </div>
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem' }}>Strategy & Planning</div>
              </div>

              <div style={{ padding: '18px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.82rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <User size={15} color="#f3c958" />
                  <span>Client or Project</span>
                </div>
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem' }}>Concludo Operations</div>
              </div>

              <div style={{ padding: '18px', background: 'rgba(9, 14, 26, 0.65)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.82rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Calendar size={15} color="#f3c958" />
                  <span>Meeting Date</span>
                </div>
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem' }}>{new Date().toLocaleDateString('en-AU')}</div>
              </div>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Navigate to the <strong style={{ color: '#f8fafc' }}>Transcript</strong> tab to paste your conversation text, or view generated results in the <strong style={{ color: '#f8fafc' }}>Outputs</strong> tab.
            </p>
          </div>
        )}

        {activeTab === 'transcript' && (
          <div>
            <div style={{ marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: '4px', fontWeight: 600 }}>Meeting Transcript</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Paste transcript here
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="transcript-input" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={15} color="#f3c958" />
                <span>Raw Transcript Ingestion Buffer</span>
              </label>
              <textarea
                id="transcript-input"
                className="form-textarea"
                rows={12}
                placeholder="Paste transcript here"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}
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
              <h2 style={{ fontSize: '1.3rem', marginBottom: '4px', fontWeight: 600 }}>Workspace Outputs</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Generated outputs will appear here
              </p>
            </div>

            <div style={{
              background: 'rgba(9, 14, 26, 0.6)',
              border: '2px dashed rgba(226, 181, 60, 0.25)',
              borderRadius: '16px',
              padding: '56px 24px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.9) 100%)',
                border: '1px solid rgba(226, 181, 60, 0.35)',
                color: '#f3c958',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: '0 0 20px rgba(226, 181, 60, 0.2)'
              }}>
                <Layers size={30} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', fontWeight: 600 }}>Generated outputs will appear here</h3>
              <p style={{ color: '#94a3b8', maxWidth: '460px', margin: '0 auto', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Once transcript processing is initiated, executive summaries, decision logs, and action items will populate in this section.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
