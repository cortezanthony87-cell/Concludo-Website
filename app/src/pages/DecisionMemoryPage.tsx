import React from 'react';
import { BrainCircuit, History, Archive, ShieldCheck } from 'lucide-react';

export const DecisionMemoryPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Decision Memory</h1>
        <p className="page-subtitle">A historical record of organizational choices, context, and reasoning.</p>
      </div>

      <div className="content-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#fff9e6',
          color: '#bc8a1c',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <BrainCircuit size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Decision Memory coming soon</h2>
        <p style={{ color: '#64748b', maxWidth: '460px', margin: '0 auto', fontSize: '0.95rem' }}>
          Decision Memory will automatically index agreed decisions, stakeholders, and rationale across all meeting transcripts.
        </p>
      </div>
    </div>
  );
};
