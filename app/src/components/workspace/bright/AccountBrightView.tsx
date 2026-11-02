import React from 'react';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../../../lib/profiles/types';
import '../../../styles/workspace-pages-bright.css';

export interface AccountBrightViewProps {
  user: User | null;
  profile: UserProfile | null;
  fullName: string;
  setFullName: (name: string) => void;
  savingName: boolean;
  nameSaved: boolean;
  nameError: string | null;
  handleSaveName: (e: React.FormEvent) => void;
  tierLabel: string;
  downloadLoading: boolean;
  handleDownloadPack: () => void;
}

export const AccountBrightView: React.FC<AccountBrightViewProps> = ({
  user,
  profile,
  fullName,
  setFullName,
  savingName,
  nameSaved,
  nameError,
  handleSaveName,
  tierLabel,
  downloadLoading,
  handleDownloadPack,
}) => {
  const initial =
    fullName?.trim()?.charAt(0)?.toUpperCase() ||
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'A';

  return (
    <div className="ws-shell">
      {/* Header */}
      <div className="ws-top">
        <div>
          <div className="ws-eyebrow">
            <i />
            <span>IDENTITY &amp; CREDENTIALS</span>
          </div>
          <h1>Account and purchases</h1>
        </div>
      </div>

      {/* Card 1: Profile */}
      <div className="ws-card">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '14px' }}>
          <div className="ws-av">{initial}</div>
          <div>
            <h2>{profile?.full_name || 'Concludo Member'}</h2>
            <div className="ws-note">{user?.email}</div>
          </div>
        </div>
        <form onSubmit={handleSaveName} style={{ maxWidth: '480px' }}>
          <label className="ws-label">
            Full name
            <input
              className="ws-in"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Anthony Cortez"
              required
            />
          </label>
          {nameError && (
            <div className="ws-note" style={{ color: 'var(--ws-red)', marginTop: '8px' }}>
              {nameError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
            <button type="submit" disabled={savingName} className="ws-btn">
              {savingName ? 'Saving...' : 'Save full name'}
            </button>
            {nameSaved && <span className="ws-pill ws-ok">&#10003; Saved</span>}
          </div>
        </form>
      </div>

      {/* Card 2: Plan and payment (C6 compliant) */}
      <div className="ws-card">
        <h2>Plan and payment</h2>
        <div className="ws-sub">Current tier</div>
        <div className="ws-stat" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <b>Current tier</b>
            <span>{tierLabel}</span>
          </div>
          <div>
            <b>Billing</b>
            <span>Not yet verified</span>
          </div>
        </div>
        {/* Per C6: Hide the Stripe portal button until billing is live */}
        <div className="ws-note" style={{ marginTop: '8px' }}>
          Billing: Not yet verified. Manage payment methods and invoices in Stripe will appear once billing is verified.
        </div>
      </div>

      {/* Card 3: Licences and downloads */}
      <div className="ws-card">
        <h2>Licences and downloads</h2>
        <div className="ws-sub">Workbook licences you own appear here.</div>
        <div className="ws-row">
          <div>
            <b>Licence pack</b>
            <div className="ws-note">
              Meeting Mastery Workbook and executive materials package.
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadPack}
            disabled={downloadLoading}
            className="ws-btn2"
          >
            {downloadLoading ? 'Generating link...' : 'Download pack (ZIP)'}
          </button>
        </div>
      </div>
    </div>
  );
};
