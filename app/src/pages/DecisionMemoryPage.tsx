import React from 'react';
import { BrainCircuit, Sparkles, History, Archive, ShieldCheck } from 'lucide-react';

export const DecisionMemoryPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>INSTITUTIONAL KNOWLEDGE REPOSITORY</span>
        </div>
        <h1 className="page-title">Decision Memory</h1>
        <p className="page-subtitle">A historical record of organizational choices, context, and reasoning.</p>
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
          <BrainCircuit size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 600 }}>Decision Memory coming soon</h2>
        <p style={{ color: '#94a3b8', maxWidth: '480px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Decision Memory will automatically index agreed decisions, stakeholders, and rationale across all meeting transcripts.
        </p>
      </div>
    </div>
  );
};
