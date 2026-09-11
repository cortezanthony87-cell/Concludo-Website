import React from 'react';
import { User, Shield, Key, Sparkles, Building2, CheckCircle2 } from 'lucide-react';

export const AccountPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>IDENTITY & CREDENTIALS</span>
        </div>
        <h1 className="page-title">Account</h1>
        <p className="page-subtitle">Manage personal profile details and security credentials.</p>
      </div>

      <div className="content-card" style={{ maxWidth: '680px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '26px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #16263f 0%, #21395c 100%)',
            border: '2px solid #e2b53c',
            color: '#f3c958',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.35rem',
            boxShadow: '0 0 16px rgba(226, 181, 60, 0.25)'
          }}>
            AC
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>Anthony Cortez</h2>
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '2px' }}>hello@concludo.au</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(226, 181, 60, 0.1)',
          border: '1px solid rgba(226, 181, 60, 0.35)',
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '26px',
          color: '#f3c958',
          fontWeight: 600,
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 0 16px rgba(226, 181, 60, 0.1)'
        }}>
          <Sparkles size={20} />
          <span>Account settings coming soon</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '22px' }}>
          <div style={{ padding: '16px 18px', background: 'rgba(9, 14, 26, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building2 size={18} color="#f3c958" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Enterprise Entity</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Concludo Pty Ltd (Melbourne VIC)</div>
              </div>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#f3c958', border: '1px solid rgba(226, 181, 60, 0.3)', padding: '3px 10px', borderRadius: '20px' }}>Owner</span>
          </div>

          <div style={{ padding: '16px 18px', background: 'rgba(9, 14, 26, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shield size={18} color="#f3c958" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Authentication Protocol</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Configured for upcoming auth rollout</div>
              </div>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '3px 10px', borderRadius: '20px' }}>Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
