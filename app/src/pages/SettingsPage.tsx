import React from 'react';
import { Link } from 'react-router-dom';
import { Sliders, Bell, Building, Sparkles, Database, ArrowRight, Trash2 } from 'lucide-react';

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
        <div
          style={{
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
          }}
        >
          <Sparkles size={20} />
          <span>Workspace settings coming soon</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Recently Deleted Card */}
          <Link
            to="/settings/deleted"
            style={{
              padding: '18px',
              background: 'rgba(239, 68, 68, 0.06)',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Trash2 size={22} color="#f87171" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                  Recently Deleted
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                  Recover deleted projects and outputs within 30 days or delete permanently
                </div>
              </div>
            </div>
            <ArrowRight size={18} color="#f87171" />
          </Link>

          {/* Supabase Connection Test Card */}
          <Link
            to="/test-connection"
            style={{
              padding: '18px',
              background: 'rgba(226, 181, 60, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(226, 181, 60, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Database size={22} color="#f3c958" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                  Supabase Database Diagnostics
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                  Test URL connection, client initialisation, and security boundaries
                </div>
              </div>
            </div>
            <ArrowRight size={18} color="#f3c958" />
          </Link>

          <div
            style={{
              padding: '18px',
              background: 'rgba(9, 14, 26, 0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <Building size={22} color="#f3c958" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                Organization Profile
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                Concludo Pty Ltd (Melbourne VIC) · ACN 701 605 898
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '18px',
              background: 'rgba(9, 14, 26, 0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <Sliders size={22} color="#f3c958" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                Localization & Language
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                Australian English (en-AU) · AEST / AEDT
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '18px',
              background: 'rgba(9, 14, 26, 0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <Bell size={22} color="#f3c958" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                Notifications & Alerts
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                Direct email alerts routed to hello@concludo.au
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
