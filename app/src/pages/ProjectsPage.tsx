import React from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, PlusCircle, Sparkles, Layers } from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>WORKSPACE REPOSITORY</span>
          </div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage meeting projects, transcripts, and generated workspace outputs.</p>
        </div>
        <Link to="/projects/new" className="btn-primary">
          <PlusCircle size={18} />
          <span>New Project</span>
        </Link>
      </div>

      <div className="content-card" style={{ textAlign: 'center', padding: '72px 32px' }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.9) 100%)',
          border: '1px solid rgba(226, 181, 60, 0.35)',
          color: '#f3c958',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          boxShadow: '0 0 24px rgba(226, 181, 60, 0.2)'
        }}>
          <FolderKanban size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 600 }}>No projects yet</h2>
        <p style={{ color: '#94a3b8', maxWidth: '440px', margin: '0 auto 28px auto', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Get started by creating your first meeting workspace. Paste a transcript or notes to generate summaries and outputs.
        </p>
        <Link to="/projects/new" className="btn-gold">
          <PlusCircle size={18} />
          <span>Create your first project</span>
        </Link>
      </div>
    </div>
  );
};
