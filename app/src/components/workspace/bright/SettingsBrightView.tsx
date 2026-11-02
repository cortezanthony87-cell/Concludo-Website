import React from 'react';
import { Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../../../lib/profiles/types';
import '../../../styles/workspace-pages-bright.css';

export interface SettingsBrightViewProps {
  user: User | null;
  profile: UserProfile | null;
  country: string;
  setCountry: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  timezone: string;
  setTimezone: (val: string) => void;
  savingLocation: boolean;
  locationSavedFeedback: boolean;
  locationError: string | null;
  handleSaveLocation: (e: React.FormEvent) => void;
  handleLogout: () => void;
  loggingOut: boolean;
  authStatus: string;
}

export const SettingsBrightView: React.FC<SettingsBrightViewProps> = ({
  user,
  profile,
  country,
  setCountry,
  city,
  setCity,
  timezone,
  setTimezone,
  savingLocation,
  locationSavedFeedback,
  locationError,
  handleSaveLocation,
  handleLogout,
  loggingOut,
  authStatus,
}) => {
  return (
    <div className="ws-shell">
      {/* Header */}
      <div className="ws-top">
        <div>
          <div className="ws-eyebrow">
            <i />
            <span>WORKSPACE CONFIGURATION</span>
          </div>
          <h1>Workspace settings</h1>
          <p>Configure organisation preferences and workspace defaults.</p>
        </div>
      </div>

      {/* Card 1: Account and session */}
      <div className="ws-card">
        <div className="ws-row" style={{ paddingTop: 0 }}>
          <div>
            <h2>Account and session</h2>
            <div className="ws-sub" style={{ margin: '2px 0 0' }}>
              Signed in as <b>{user?.email || 'authenticated user'}</b>. Your session is secured by Supabase Auth.
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut || authStatus === 'signing_out'}
            className="ws-btn2"
          >
            {loggingOut ? 'Signing out...' : 'Log out'}
          </button>
        </div>
      </div>

      {/* Card 2: Data retention */}
      <div className="ws-card">
        <div className="ws-row" style={{ paddingTop: 0 }}>
          <div>
            <h2>Data retention</h2>
            <div className="ws-sub" style={{ margin: '2px 0 0' }}>
              Lifecycle governance and automatic purge policy
            </div>
          </div>
          <span className="ws-pill ws-ok">ACTIVE POLICY</span>
        </div>
        <p style={{ margin: '6px 0', color: 'var(--ws-navy)' }}>
          Deleted records are recoverable for 30 days before permanent removal.
        </p>
        <div className="ws-stat">
          <div>
            <b>Recovery window</b>
            <span>30 days grace period</span>
          </div>
          <div>
            <b>Automated purge</b>
            <span>Daily backend worker</span>
          </div>
          <div>
            <b>Team overrides</b>
            <span>Ready for Team tiers</span>
          </div>
        </div>
        <div className="ws-ban ws-red">
          <div>
            <b>Recently deleted items</b>
            <div className="ws-note">
              Inspect soft-deleted records, restore items or trigger permanent deletion.
            </div>
          </div>
          <Link to="/settings/deleted" className="ws-btn2">
            View recently deleted &rarr;
          </Link>
        </div>
      </div>

      {/* Card 3: Workspace preferences and organisation defaults */}
      <div className="ws-card">
        <div className="ws-ban" style={{ border: 0, padding: 0, marginBottom: '8px' }}>
          <h2>Workspace preferences and organisation defaults</h2>
        </div>

        <div className="ws-grid2" style={{ marginTop: '8px' }}>
          <div className="ws-card" style={{ margin: 0 }}>
            <b>Supabase database diagnostics</b>
            <div className="ws-note">
              Test URL connection, client initialisation and security boundaries.
            </div>
            <div style={{ marginTop: '8px' }}>
              <Link to="/test-connection" className="ws-btn2">
                Run diagnostics
              </Link>
            </div>
          </div>
          <div className="ws-card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <b>Team workspace and seats</b>
              <span className="ws-pill">Available on Team</span>
            </div>
            <div className="ws-note">Member seat availability and tier eligibility.</div>
            <div style={{ marginTop: '8px' }}>
              <Link to="/team/settings" className="ws-btn2">
                Open team settings
              </Link>
            </div>
          </div>
        </div>

        <div className="ws-card" style={{ margin: '14px 0 0' }}>
          <b>Organisation profile</b>
          <div className="ws-note">
            Concludo Pty Ltd (Melbourne VIC) &middot; ACN 701 605 898
          </div>
        </div>

        <div className="ws-card" style={{ margin: '14px 0 0' }}>
          <h2 style={{ fontSize: '16px' }}>Location, calendar timezone and localisation</h2>
          <div className="ws-note">
            Controls the Concludo calendar date, commitments schedule and time calculations.
          </div>
          <form onSubmit={handleSaveLocation}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginTop: '10px',
              }}
            >
              <label className="ws-label">
                Country
                <input
                  className="ws-in"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Australia"
                />
              </label>
              <label className="ws-label">
                City
                <input
                  className="ws-in"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Melbourne"
                />
              </label>
              <label className="ws-label">
                Timezone (IANA)
                <select
                  className="ws-in"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="Australia/Melbourne">
                    Australia / Melbourne (AEST/AEDT UTC+10/+11)
                  </option>
                  <option value="Australia/Sydney">
                    Australia / Sydney (AEST/AEDT UTC+10/+11)
                  </option>
                  <option value="Australia/Brisbane">Australia / Brisbane (AEST UTC+10)</option>
                  <option value="Australia/Perth">Australia / Perth (AWST UTC+8)</option>
                  <option value="Australia/Adelaide">
                    Australia / Adelaide (ACST/ACDT UTC+9:30/+10:30)
                  </option>
                  <option value="UTC">UTC</option>
                </select>
              </label>
            </div>
            {locationError && (
              <div className="ws-note" style={{ color: 'var(--ws-red)', marginTop: '8px' }}>
                {locationError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
              <button type="submit" disabled={savingLocation} className="ws-btn">
                {savingLocation ? 'Saving...' : 'Update location and timezone'}
              </button>
              {locationSavedFeedback && <span className="ws-pill ws-ok">&#10003; Saved</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
