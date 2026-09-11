import React from 'react';
import { User, Shield, Key } from 'lucide-react';

export const AccountPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Account</h1>
        <p className="page-subtitle">Manage personal profile details and security credentials.</p>
      </div>

      <div className="content-card" style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#16263f',
            border: '2px solid #e2b53c',
            color: '#e2b53c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.2rem'
          }}>
            AC
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>Anthony Cortez</h2>
            <div style={{ color: '#64748b', fontSize: '0.88rem' }}>hello@concludo.au</div>
          </div>
        </div>

        <div style={{
          background: '#fff9e6',
          border: '1px solid #fef0c7',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          color: '#bc8a1c',
          fontWeight: 600,
          fontSize: '0.95rem'
        }}>
          Account settings coming soon
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Account Role</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Owner / Administrator</div>
            </div>
            <span style={{ fontSize: '0.82rem', padding: '4px 10px', background: '#f1f5f9', borderRadius: '6px', color: '#475569', fontWeight: 600 }}>
              Default
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Authentication Provider</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Preparing authentication integration</div>
            </div>
            <span style={{ fontSize: '0.82rem', padding: '4px 10px', background: '#f1f5f9', borderRadius: '6px', color: '#475569', fontWeight: 600 }}>
              Tasklet 2
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
