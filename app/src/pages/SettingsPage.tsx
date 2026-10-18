import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sliders,
  Bell,
  Building,
  Sparkles,
  Database,
  ArrowRight,
  Trash2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  LogOut,
  Loader2,
  UserCheck,
  Globe,
  MapPin,
  Check,
  Save,
} from 'lucide-react';
import { updateUserLocation } from '../lib/profiles/profileClient';
import { useAuth } from '../lib/auth/AuthContext';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut, authStatus } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // Location & Timezone State
  const [country, setCountry] = useState(profile?.country || 'Australia');
  const [city, setCity] = useState(profile?.city || 'Melbourne');
  const [timezone, setTimezone] = useState(profile?.timezone || 'Australia/Melbourne');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSavedFeedback, setLocationSavedFeedback] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Sync state if profile loads asynchronously
  React.useEffect(() => {
    if (profile) {
      if (profile.country) setCountry(profile.country);
      if (profile.city) setCity(profile.city);
      if (profile.timezone) setTimezone(profile.timezone);
    }
  }, [profile]);

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingLocation(true);
    setLocationError(null);
    const res = await updateUserLocation(user.id, {
      country: country.trim() || 'Australia',
      city: city.trim() || 'Melbourne',
      timezone: timezone || 'Australia/Melbourne',
    });
    setSavingLocation(false);
    if (res.error) {
      setLocationError(res.error.message);
    } else {
      setLocationSavedFeedback(true);
      await refreshProfile();
      setTimeout(() => setLocationSavedFeedback(false), 3000);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    setLoggingOut(false);
    navigate('/', { replace: true });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>WORKSPACE CONFIGURATION</span>
        </div>
        <h1 className="page-title">Workspace Settings</h1>
        <p className="page-subtitle">Configure organisation preferences and workspace defaults.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>
        {/* ACCOUNT & SESSION SECTION */}
        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(243, 201, 88, 0.1)',
                  border: '1px solid rgba(243, 201, 88, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f3c958',
                }}
              >
                <UserCheck size={19} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Account & Session
                </h2>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  Authenticated as <strong style={{ color: '#f8fafc' }}>{user?.email}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut || authStatus === 'signing_out'}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                fontSize: '0.86rem',
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.35)',
              }}
            >
              {loggingOut ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut size={16} />
                  <span>Log out</span>
                </>
              )}
            </button>
          </div>

          <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
            Active session secured with Supabase Auth. Logging out clears local credentials and returns to the home page.
          </div>
        </div>

        {/* DATA RETENTION SECTION */}
        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(243, 201, 88, 0.1)',
                  border: '1px solid rgba(243, 201, 88, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f3c958'
                }}
              >
                <Clock size={19} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Data Retention
                </h2>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  Lifecycle governance and automatic purge policy
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                letterSpacing: '0.04em'
              }}
            >
              ACTIVE POLICY
            </span>
          </div>

          <p
            style={{
              color: '#e2e8f0',
              fontSize: '0.94rem',
              lineHeight: 1.6,
              marginBottom: '18px'
            }}
          >
            Deleted records are recoverable for 30 days before permanent removal.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '14px',
              background: 'rgba(15, 23, 42, 0.65)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={16} color="#34d399" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Recovery Window</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                  30 Days Grace Period
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <ShieldCheck size={16} color="#f3c958" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Automated Purge</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                  Daily Backend Worker
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Users size={16} color="#a78bfa" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Team Overrides</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                  Ready for Team Tiers
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.22)',
              borderRadius: '10px',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Trash2 size={20} color="#f87171" />
              <div>
                <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>
                  Recently Deleted Items
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                  Inspect soft-deleted records, restore items, or trigger permanent deletion
                </div>
              </div>
            </div>

            <Link
              to="/settings/deleted"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '0.88rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <span>View Recently Deleted</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* GENERAL SETTINGS CARD */}
        <div className="content-card">
          <div
            style={{
              background: 'rgba(226, 181, 60, 0.1)',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              borderRadius: '12px',
              padding: '16px 18px',
              marginBottom: '20px',
              color: '#f3c958',
              fontWeight: 600,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 0 16px rgba(226, 181, 60, 0.08)'
            }}
          >
            <Sparkles size={18} />
          <span>Workspace preferences and organisation defaults</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Supabase Connection Diagnostics */}
            <Link
              to="/test-connection"
              style={{
                padding: '16px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Database size={20} color="#f3c958" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f8fafc' }}>
                    Supabase Database Diagnostics
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Test URL connection, client initialisation, and security boundaries
                  </div>
                </div>
              </div>
              <ArrowRight size={16} color="#f3c958" />
            </Link>

            {/* Team Workspace (Locked) */}
            <div
              style={{
                padding: '16px',
                background: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Users size={20} color="#a78bfa" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f8fafc' }}>
                    Team Workspace & Member Seats
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Multi-user collaborative spaces and shared meeting intelligence
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc',
                  border: '1px solid rgba(168, 85, 247, 0.3)'
                }}
              >
                Available on Team
              </span>
            </div>

            {/* Organisation Profile */}
            <div
              style={{
                padding: '16px',
                background: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <Building size={20} color="#f3c958" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f8fafc' }}>
                  Organisation Profile
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                  Concludo Pty Ltd (Melbourne VIC) · ACN 701 605 898
                </div>
              </div>
            </div>

            {/* Location, Calendar Timezone & Localization */}
            <div
              style={{
                padding: '18px',
                background: 'rgba(9, 14, 26, 0.75)',
                borderRadius: '12px',
                border: '1px solid rgba(226, 181, 60, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(243, 201, 88, 0.1)',
                      border: '1px solid rgba(243, 201, 88, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f3c958',
                    }}
                  >
                    <Globe size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.94rem', color: '#f8fafc' }}>
                      Location & Calendar Timezone
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      Controls your Concludo calendar current date, commitments schedule, and time calculations
                    </div>
                  </div>
                </div>

                {locationSavedFeedback && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#34d399',
                      background: 'rgba(52, 211, 153, 0.12)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                    }}
                  >
                    <Check size={14} /> Saved
                  </span>
                )}
              </div>

              {locationError && (
                <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '12px' }}>
                  {locationError}
                </div>
              )}

              <form onSubmit={handleSaveLocation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>
                      <Globe size={13} color="#f3c958" />
                      <span>Country</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Australia"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(15, 23, 42, 0.8)',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>
                      <MapPin size={13} color="#f3c958" />
                      <span>City</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Melbourne"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(15, 23, 42, 0.8)',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>
                    <Sliders size={13} color="#f3c958" />
                    <span>Timezone (IANA)</span>
                  </label>
                  <select
                    className="form-select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                    }}
                  >
                    <option value="Australia/Melbourne">Australia / Melbourne (AEST/AEDT UTC+10/+11)</option>
                    <option value="Australia/Sydney">Australia / Sydney (AEST/AEDT UTC+10/+11)</option>
                    <option value="Australia/Brisbane">Australia / Brisbane (AEST UTC+10)</option>
                    <option value="Australia/Adelaide">Australia / Adelaide (ACST/ACDT UTC+9:30/+10:30)</option>
                    <option value="Australia/Perth">Australia / Perth (AWST UTC+8)</option>
                    <option value="Australia/Darwin">Australia / Darwin (ACST UTC+9:30)</option>
                    <option value="Australia/Hobart">Australia / Hobart (AEST/AEDT UTC+10/+11)</option>
                    <option value="Pacific/Auckland">New Zealand (Auckland/Wellington UTC+12/+13)</option>
                    <option value="Asia/Singapore">Singapore / Hong Kong (UTC+8)</option>
                    <option value="Asia/Tokyo">Japan / Tokyo (JST UTC+9)</option>
                    <option value="Europe/London">UK / London (GMT/BST UTC+0/+1)</option>
                    <option value="America/New_York">US Eastern (New York UTC-5/-4)</option>
                    <option value="America/Chicago">US Central (Chicago UTC-6/-5)</option>
                    <option value="America/Denver">US Mountain (Denver UTC-7/-6)</option>
                    <option value="America/Los_Angeles">US Pacific (Los Angeles UTC-8/-7)</option>
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    disabled={savingLocation}
                    className="btn-gold"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                    }}
                  >
                    {savingLocation ? (
                      <>
                        <Loader2 size={15} className="spin-animation" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>Update Location & Timezone</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Notifications */}
            <div
              style={{
                padding: '16px',
                background: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <Bell size={20} color="#f3c958" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f8fafc' }}>
                  Notifications & Alerts
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                  Direct email alerts routed to hello@concludo.au
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
