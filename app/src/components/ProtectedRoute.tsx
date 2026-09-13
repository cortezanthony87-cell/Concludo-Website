import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
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
