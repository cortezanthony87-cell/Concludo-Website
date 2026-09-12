import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, loading, authStatus } = useAuth();
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

  return children ? <>{children}</> : <Outlet />;
};
