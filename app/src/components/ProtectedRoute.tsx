import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, authStatus, signOut } = useAuth();
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
