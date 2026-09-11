import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, FolderKanban, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Welcome to Concludo Workspace</h1>
        <p className="page-subtitle">
          Turn meeting conversations into finished work, clear action plans, and structured decisions.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <Link to="/projects/new" className="btn-gold">
          <PlusCircle size={18} />
          <span>Create New Project</span>
        </Link>
        <Link to="/projects" className="btn-secondary">
          <FolderKanban size={18} />
          <span>Open Projects</span>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', background: '#f4f6fa', borderRadius: '8px', color: '#16263f' }}>
              <FileText size={22} />
            </div>
            <h2 style={{ fontSize: '1.15rem' }}>Meeting Transcripts</h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
            Paste raw audio transcripts or meeting notes to extract action items, decisions, and follow-ups.
          </p>
          <Link to="/projects/new" style={{ color: '#21395c', fontWeight: 600, fontSize: '0.88rem' }}>
            Start new transcript →
          </Link>
        </div>

        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', background: '#fff9e6', borderRadius: '8px', color: '#bc8a1c' }}>
              <CheckCircle2 size={22} />
            </div>
            <h2 style={{ fontSize: '1.15rem' }}>Action Governance</h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
            Track commitments across meetings with clear owners, agreed timelines, and verifiable accountability.
          </p>
          <Link to="/actions" style={{ color: '#21395c', fontWeight: 600, fontSize: '0.88rem' }}>
            View action tracker →
          </Link>
        </div>

        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', background: '#f4f6fa', borderRadius: '8px', color: '#16263f' }}>
              <ShieldCheck size={22} />
            </div>
            <h2 style={{ fontSize: '1.15rem' }}>Decision Memory</h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
            Maintain an audit-ready log of organizational decisions so rationale and consensus are never lost.
          </p>
          <Link to="/decision-memory" style={{ color: '#21395c', fontWeight: 600, fontSize: '0.88rem' }}>
            Explore decision memory →
          </Link>
        </div>
      </div>
    </div>
  );
};
