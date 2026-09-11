import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  FolderKanban,
  FileText,
  CheckCircle2,
  BrainCircuit,
  ArrowRight,
  Sparkles,
  Layers,
  Activity,
  Shield,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';

export const DashboardPage: React.FC = () => {
  const { supabase, user } = useAuth();
  const [activeProjectsCount, setActiveProjectsCount] = useState<number | null>(null);

  useEffect(() => {
    async function loadActiveProjectsCount() {
      if (!supabase || !user) return;
      try {
        const { count, error } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null);

        if (!error && typeof count === 'number') {
          setActiveProjectsCount(count);
        }
      } catch {
        // Fallback silently if offline or loading
      }
    }

    loadActiveProjectsCount();
  }, [supabase, user]);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>WORKSPACE INTELLIGENCE SHELL</span>
        </div>
        <h1 className="page-title">
          Welcome to <span style={{ background: 'linear-gradient(135deg, #f8fafc 40%, #f3c958 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Concludo Workspace</span>
        </h1>
        <p className="page-subtitle">
          Turn meeting conversations into finished work, clear action plans, and structured decisions.
        </p>
      </div>

      {/* Primary Action Buttons */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link to="/projects/new" className="btn-gold">
          <PlusCircle size={18} />
          <span>Create New Project</span>
        </Link>
        <Link to="/projects" className="btn-secondary">
          <FolderKanban size={18} />
          <span>Open Projects</span>
        </Link>
      </div>

      {/* Telemetry HUD Grid */}
      <div className="telemetry-grid">
        <div className="telemetry-card">
          <div className="telemetry-label">Active Projects</div>
          <div className="telemetry-value">
            {activeProjectsCount !== null ? activeProjectsCount : '—'}
          </div>
          <div className="telemetry-subtext">
            <span className="live-pulse-dot" style={{ width: '5px', height: '5px' }} />
            <span>
              {activeProjectsCount && activeProjectsCount > 0
                ? `${activeProjectsCount} active workspace${activeProjectsCount > 1 ? 's' : ''}`
                : 'Ready for first project'}
            </span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">Transcript Pipeline</div>
          <div className="telemetry-value">Idle</div>
          <div className="telemetry-subtext">
            <span>Awaiting input</span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">Decision Memory</div>
          <div className="telemetry-value">Standby</div>
          <div className="telemetry-subtext">
            <span>Registry initialized</span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">Action Governance</div>
          <div className="telemetry-value">Standby</div>
          <div className="telemetry-subtext">
            <span>Tracker ready</span>
          </div>
        </div>
      </div>

      {/* Feature Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '22px' }}>
        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.8) 100%)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              color: '#f3c958',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(226, 181, 60, 0.15)'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.18rem', fontWeight: 600 }}>Meeting Transcripts</h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ingestion Engine</span>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
            Paste raw audio transcripts or meeting notes to extract action items, decisions, and follow-ups.
          </p>
          <Link to="/projects/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f3c958', fontWeight: 600, fontSize: '0.88rem' }}>
            <span>Start new transcript</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(226, 181, 60, 0.15) 0%, rgba(14, 23, 41, 0.8) 100%)',
              border: '1px solid rgba(226, 181, 60, 0.4)',
              color: '#f3c958',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(226, 181, 60, 0.2)'
            }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.18rem', fontWeight: 600 }}>Action Governance</h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accountability</span>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
            Track commitments across meetings with clear owners, agreed timelines, and verifiable accountability.
          </p>
          <Link to="/actions" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f3c958', fontWeight: 600, fontSize: '0.88rem' }}>
            <span>View action tracker</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.8) 100%)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              color: '#f3c958',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(226, 181, 60, 0.15)'
            }}>
              <BrainCircuit size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.18rem', fontWeight: 600 }}>Decision Memory</h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Institutional Recall</span>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
            Maintain an audit-ready log of organizational decisions so rationale and consensus are never lost.
          </p>
          <Link to="/decision-memory" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f3c958', fontWeight: 600, fontSize: '0.88rem' }}>
            <span>Explore decision memory</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};
