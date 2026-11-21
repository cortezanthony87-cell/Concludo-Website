import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { updateUserLegalTermsAcceptance } from '../lib/profiles/profileClient';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, authStatus, signOut, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    const statusText =
      authStatus === 'loading_profile'
        ? 'LOADING USER PROFILE...'
        : authStatus === 'loading_permissions'
        ? 'CHECKING PERMISSIONS...'
        : authStatus === 'loading_account'
        ? 'LOADING ACCOUNT...'
        : 'CHECKING SESSION...';

    return (
      <div className="auth-loading-screen">
        <div className="brand-emblem-large pulse">
          <div className="brand-emblem-inner-large" />
        </div>
        <div className="auth-loading-text">
          <span className="live-pulse-dot" />
          <span>{statusText}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Pre-release preview terms acceptance enforcement (existing users)
  const [modalAccepted, setModalAccepted] = React.useState(false);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [modalError, setModalError] = React.useState('');

  const needsTermsAcceptance = Boolean(
    user &&
    profile &&
    !profile.legal_terms_accepted_at &&
    !user.user_metadata?.legal_terms_accepted_at
  );

  const handleAcceptTerms = async () => {
    if (!user) return;
    setModalLoading(true);
    setModalError('');
    try {
      const res = await updateUserLegalTermsAcceptance(user.id);
      if (res.error) {
        setModalError(res.error.message || 'Failed to record terms acceptance. Please try again.');
        setModalLoading(false);
        return;
      }
      await refreshProfile();
      setModalLoading(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error recording acceptance');
      setModalLoading(false);
    }
  };

  if (needsTermsAcceptance) {
    return (
      <div
        className="auth-loading-screen"
        style={{
          flexDirection: 'column',
          padding: '24px',
          background: '#0a111e',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="auth-card"
          style={{
            maxWidth: '560px',
            width: '100%',
            background: 'rgba(14, 23, 38, 0.95)',
            border: '1px solid rgba(226, 181, 60, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div className="auth-brand-logo" style={{ justifyContent: 'center', marginBottom: '12px' }}>
              <img
                src="/brand/Concludo_logo_horizontal_reversed_for_dark.png"
                alt="Concludo"
                className="auth-brand-logo-img"
              />
              <span className="brand-title-badge">WORKSPACE</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', fontFamily: 'Poppins, sans-serif' }}>
              Pre-Release Preview Terms
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
              To continue using the Concludo Workspace preview, please confirm your acceptance of the updated preview terms:
            </p>
          </div>

          {modalError && (
            <div className="auth-alert-error" role="alert" style={{ marginBottom: '16px' }}>
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{modalError}</div>
            </div>
          )}

          <div
            style={{
              background: 'rgba(226, 181, 60, 0.08)',
              border: '1px solid rgba(226, 181, 60, 0.25)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            <label
              htmlFor="modal-terms"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontSize: '0.86rem',
                lineHeight: 1.5,
                color: '#e2e8f0',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                id="modal-terms"
                type="checkbox"
                checked={modalAccepted}
                onChange={(e) => {
                  setModalAccepted(e.target.checked);
                  if (modalError) setModalError('');
                }}
                style={{
                  marginTop: '3px',
                  width: '18px',
                  height: '18px',
                  accentColor: '#f3c958',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <span>
                I understand the Concludo Workspace is a pre-release preview. I will use sample information only, not real client transcripts, recordings or personal information about other people. I have read the{' ' }
                <a
                  href="https://www.concludo.au/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#f3c958', textDecoration: 'underline' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>{' ' }
                and{' ' }
                <a
                  href="https://www.concludo.au/terms-of-service/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#f3c958', textDecoration: 'underline' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </a>
                .
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleAcceptTerms}
              className="btn-gold"
              disabled={!modalAccepted || modalLoading}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                fontWeight: 700,
                opacity: !modalAccepted && !modalLoading ? 0.6 : 1,
              }}
            >
              <span>{modalLoading ? 'Recording acceptance...' : 'Accept and continue'}</span>
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 18px',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
              }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 14-Day Demo / Trial Period Expiration Enforcement
  const isTrialExpired = (() => {
    if (!profile) return false;
    // Admins and full paying subscribers never expire via trial cutoff
    if (profile.role === 'admin' || (profile.plan as string) === 'admin' || (profile.plan as string) === 'team' || (profile.plan as string) === 'pro_subscription' || (profile.plan as string) === 'pro' || (profile.plan as string) === 'starter') {
      return false;
    }
    if (profile.trial_end_date) {
      try {
        const endDate = new Date(profile.trial_end_date);
        return endDate.getTime() < Date.now();
      } catch {
        return false;
      }
    }
    return false;
  })();

  if (isTrialExpired) {
    return (
      <div
        className="auth-loading-screen"
        style={{
          flexDirection: 'column',
          padding: '32px',
          textAlign: 'center',
          background: '#0a111e',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(226, 181, 60, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            border: '1px solid rgba(226, 181, 60, 0.4)',
            boxShadow: '0 0 24px rgba(226, 181, 60, 0.25)',
          }}
        >
          <Clock size={32} color="#e2b53c" />
        </div>
        <h2
          style={{
            fontSize: '1.6rem',
            fontWeight: 700,
            color: '#f8fafc',
            marginBottom: '10px',
            fontFamily: 'Poppins, sans-serif'
          }}
        >
          14-Day Demo Period Has Concluded
        </h2>
        <p
          style={{
            maxWidth: '520px',
            color: '#94a3b8',
            fontSize: '0.96rem',
            lineHeight: 1.6,
            marginBottom: '28px',
          }}
        >
          Your 14-day Pro subscription demo has ended. To continue managing meeting memory, automated actions, decision tracking, and boardroom outputs without interruption, choose a plan to activate your workspace.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/checkout"
            className="btn-gold"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              fontWeight: 700,
              textDecoration: 'none',
              borderRadius: '8px'
            }}
          >
            <span>Choose a Subscription Plan</span>
            <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px'
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Enterprise User Suspension Enforcement
  if (profile?.is_suspended) {
    return (
      <div
        className="auth-loading-screen"
        style={{
          flexDirection: 'column',
          padding: '32px',
          textAlign: 'center',
          background: '#0e1726',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
          }}
        >
          <ShieldAlert size={32} color="#ef4444" />
        </div>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#f8fafc',
            marginBottom: '8px',
          }}
        >
          Account Suspended
        </h2>
        <p
          style={{
            maxWidth: '460px',
            color: '#94a3b8',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          Your account has been suspended by an enterprise administrator. Access to Concludo Workspace is restricted. Your project and meeting records remain safely preserved under organizational governance.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
