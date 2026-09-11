import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';

export const PublicAuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
          <span>CHECKING CONCLUDO SESSION...</span>
        </div>
      </div>
    );
  }

  if (user) {
    const from = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};
