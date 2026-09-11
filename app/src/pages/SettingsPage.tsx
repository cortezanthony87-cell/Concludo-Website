import React from 'react';
import { Settings, Sliders, Users, Bell, Building } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Workspace Settings</h1>
        <p className="page-subtitle">Configure organization preferences and workspace defaults.</p>
      </div>

      <div className="content-card" style={{ maxWidth: '680px' }}>
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
          Workspace settings coming soon
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Building size={20} color="#16263f" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Organization Profile</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Concludo Pty Ltd (Melbourne VIC)</div>
            </div>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Sliders size={20} color="#16263f" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Localization & Language</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Australian English (en-AU) · AEST / AEDT</div>
            </div>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Bell size={20} color="#16263f" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Direct email alerts to hello@concludo.au</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
