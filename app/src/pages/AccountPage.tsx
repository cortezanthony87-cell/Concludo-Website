import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Shield,
  Zap,
  Calendar,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { PLAN_LABELS, ROLE_LABELS } from '../lib/profiles/types';

export const AccountPage: React.FC = () => {
  const { user, profile, profileLoading, updateFullName, refreshProfile } = useAuth();

  const [fullNameInput, setFullNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [repairing, setRepairing] = useState(false);

  // Sync input with profile when loaded
  useEffect(() => {
    if (profile) {
      setFullNameInput(profile.full_name || '');
    }
  }, [profile]);

  const handleUpdateFullName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    setSaving(true);
    const { profile: updated, error } = await updateFullName(fullNameInput);
    setSaving(false);

    if (error) {
      setErrorMessage(error.message || 'Failed to update full name. Please try again.');
    } else if (updated) {
      setSuccessMessage('Full name updated successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  const handleManualRepair = async () => {
    setRepairing(true);
    setErrorMessage('');
    try {
      await refreshProfile();
    } catch (err: any) {
      setErrorMessage(err.message || 'Profile repair attempt failed.');
    } finally {
      setRepairing(false);
    }
  };

  // Format created date to Australian English locale
  const formatAustralianDate = (isoString?: string) => {
    if (!isoString) return 'Not available';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  // 1. Loading State
  if (profileLoading && !profile) {
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

        <div className="content-card" style={{ maxWidth: '680px', padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={36} className="spin-animation" style={{ color: '#f3c958', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Retrieving Profile Data
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
            Fetching authenticated identity records from Supabase...
          </p>
        </div>
      </div>
    );
  }

  // 2. Empty State (Missing Profile Record with Automatic/Manual Repair)
  if (!profile) {
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

        <div className="content-card" style={{ maxWidth: '680px', textAlign: 'center', padding: '36px 24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px',
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            No Profile Record Found
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            An authenticated user session was detected for <strong style={{ color: '#f8fafc' }}>{user?.email}</strong>,
            but a corresponding database profile record is missing.
          </p>
          <button
            type="button"
            className="btn-gold"
            onClick={handleManualRepair}
            disabled={repairing}
            style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {repairing ? <Loader2 size={16} className="spin-animation" /> : <RefreshCw size={16} />}
            <span>Repair Profile Record</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Normal State with Real Profile Data
  const currentPlan = profile.plan;
  const planLabel = PLAN_LABELS[currentPlan] || currentPlan;
  const roleLabel = ROLE_LABELS[profile.role] || profile.role;
  const userInitial = (profile.full_name?.trim() ? profile.full_name.trim().charAt(0) : profile.email.charAt(0)).toUpperCase();

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
        {/* Profile Avatar Lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '28px' }}>
          <div
            style={{
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
              fontSize: '1.4rem',
              boxShadow: '0 0 16px rgba(226, 181, 60, 0.25)',
              flexShrink: 0,
            }}
          >
            {userInitial}
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
              {profile.full_name || 'Anonymous User'}
            </h2>
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '2px' }}>
              {profile.email}
            </div>
          </div>
        </div>

        {/* Notifications & Status Alerts */}
        {successMessage && (
          <div
            style={{
              background: 'rgba(52, 211, 153, 0.1)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#34d399',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
            }}
            role="status"
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-alert-error" style={{ marginBottom: '20px' }} role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Form: Editable Full Name */}
        <form onSubmit={handleUpdateFullName} style={{ marginBottom: '28px' }}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label
              className="form-label"
              htmlFor="profile-full-name"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={15} color="#f3c958" />
                <span>Full name</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 500 }}>Editable</span>
            </label>
            <input
              id="profile-full-name"
              type="text"
              className="form-input"
              placeholder="e.g. Anthony Cortez"
              value={fullNameInput}
              onChange={(e) => setFullNameInput(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn-gold"
              disabled={saving || fullNameInput.trim() === (profile.full_name || '').trim()}
              style={{ padding: '8px 20px', fontSize: '0.88rem' }}
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="spin-animation" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Save Full Name</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Read-only Immutable Fields */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>
            System Attributes (Protected)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Email (Read-only) */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Mail size={17} color="#94a3b8" />
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Email address</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{profile.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem' }}>
                <Lock size={12} />
                <span>Auth Managed</span>
              </div>
            </div>

            {/* Plan (Read-only) */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Zap size={17} color="#f3c958" />
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Plan</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{planLabel}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#f3c958',
                    border: '1px solid rgba(226, 181, 60, 0.35)',
                    background: 'rgba(226, 181, 60, 0.1)',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontWeight: 600,
                  }}
                >
                  {planLabel}
                </span>
                <span title="Plan is managed server-side" style={{ display: 'flex', alignItems: 'center' }}>
                  <Lock size={12} color="#64748b" />
                </span>
              </div>
            </div>

            {/* Role (Read-only) */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Shield size={17} color="#94a3b8" />
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Role</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{roleLabel}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: profile.role === 'admin' ? '#f3c958' : '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '3px 10px',
                    borderRadius: '20px',
                  }}
                >
                  {roleLabel}
                </span>
                <span title="Role is policy-governed" style={{ display: 'flex', alignItems: 'center' }}>
                  <Lock size={12} color="#64748b" />
                </span>
              </div>
            </div>

            {/* Created date (Read-only) */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Calendar size={17} color="#94a3b8" />
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Created date</div>
                  <div style={{ fontWeight: 500, fontSize: '0.88rem', color: '#f8fafc' }}>
                    {formatAustralianDate(profile.created_at)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem' }}>
                <Lock size={12} />
                <span>Immutable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
