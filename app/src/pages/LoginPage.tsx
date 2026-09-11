import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { getAuthErrorMessage } from '../lib/auth/authErrors';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    const { error } = await signIn(trimmedEmail, password);
    setLoading(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    const from = (location.state as any)?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-logo">
            <div className="brand-emblem" style={{ width: '36px', height: '36px' }}>
              <div className="brand-emblem-inner" style={{ width: '14px', height: '14px' }} />
            </div>
            <span style={{ letterSpacing: '-0.02em' }}>CONCLUDO</span>
            <span className="brand-title-badge">WORKSPACE</span>
          </div>
          <h1 className="auth-title">Log in to Workspace</h1>
          <p className="auth-subtitle">Enter your email and password to access your workspace</p>
        </div>

        {errorMessage && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="login-email"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Mail size={15} color="#f3c958" />
              <span>Email address</span>
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                alignItems: 'center',
              }}
            >
              <label
                className="form-label"
                htmlFor="login-password"
                style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Lock size={15} color="#f3c958" />
                <span>Password</span>
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: '0.82rem', color: '#f3c958', fontWeight: 500 }}
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-gold"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <span>Sign in to Workspace</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account yet? <Link to="/signup">Create account</Link>
        </div>
      </div>
    </div>
  );
};
