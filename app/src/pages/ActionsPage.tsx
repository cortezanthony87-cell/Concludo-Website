import React from 'react';
import { CheckSquare, Sparkles, ListChecks, Calendar, UserCheck } from 'lucide-react';

export const ActionsPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>GOVERNANCE & ACCOUNTABILITY</span>
        </div>
        <h1 className="page-title">Actions</h1>
        <p className="page-subtitle">Track deliverables, accountability, and deadlines across meetings.</p>
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
          <CheckSquare size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 600 }}>Action Tracker coming soon</h2>
        <p style={{ color: '#94a3b8', maxWidth: '480px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.6 }}>
          The Action Tracker provides central governance for task assignments, completion milestones, and owner follow-up.
        </p>
      </div>
    </div>
  );
};
