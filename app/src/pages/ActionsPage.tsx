import React from 'react';
import { CheckSquare, ListChecks, Calendar, UserCheck } from 'lucide-react';

export const ActionsPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Actions</h1>
        <p className="page-subtitle">Track deliverables, accountability, and deadlines across meetings.</p>
      </div>

      <div className="content-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#f4f6fa',
          color: '#16263f',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <CheckSquare size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Action Tracker coming soon</h2>
        <p style={{ color: '#64748b', maxWidth: '460px', margin: '0 auto', fontSize: '0.95rem' }}>
          The Action Tracker provides central governance for task assignments, completion milestones, and owner follow-up.
        </p>
      </div>
    </div>
  );
};
