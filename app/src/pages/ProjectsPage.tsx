import React from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, PlusCircle } from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage meeting projects, transcripts, and generated workspace outputs.</p>
        </div>
        <Link to="/projects/new" className="btn-primary">
          <PlusCircle size={18} />
          <span>New Project</span>
        </Link>
      </div>

      <div className="content-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#f4f6fa',
          color: '#21395c',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <FolderKanban size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>No projects yet</h2>
        <p style={{ color: '#64748b', maxWidth: '420px', margin: '0 auto 24px auto', fontSize: '0.95rem' }}>
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
