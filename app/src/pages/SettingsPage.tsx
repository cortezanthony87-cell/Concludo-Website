import React from 'react';
import { Settings, Sliders, Users, Bell, Building, Sparkles } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>WORKSPACE CONFIGURATION</span>
        </div>
        <h1 className="page-title">Workspace Settings</h1>
        <p className="page-subtitle">Configure organization preferences and workspace defaults.</p>
      </div>

      <div className="content-card" style={{ maxWidth: '720px' }}>
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
          <span>Workspace settings coming soon</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '18px', background: 'rgba(9, 14, 26, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Building size={22} color="#f3c958" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>Organization Profile</div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Concludo Pty Ltd (Melbourne VIC) · ACN 701 605 898</div>
            </div>
          </div>

          <div style={{ padding: '18px', background: 'rgba(9, 14, 26, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Sliders size={22} color="#f3c958" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>Localization & Language</div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Australian English (en-AU) · AEST / AEDT</div>
            </div>
          </div>

          <div style={{ padding: '18px', background: 'rgba(9, 14, 26, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Bell size={22} color="#f3c958" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>Notifications & Alerts</div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Direct email alerts routed to hello@concludo.au</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
