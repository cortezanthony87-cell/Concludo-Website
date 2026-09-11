import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="brand-emblem-large pulse">
          <div className="brand-emblem-inner-large" />
        </div>
        <div className="auth-loading-text">
          <span className="live-pulse-dot" />
          <span>VERIFYING CONCLUDO SESSION...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
