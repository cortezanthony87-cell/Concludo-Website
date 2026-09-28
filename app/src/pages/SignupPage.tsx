import { trackSignup } from '../lib/analytics';
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Mail, Lock, User, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { getAuthErrorMessage } from '../lib/auth/authErrors';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();
  const isDemo = new URLSearchParams(location.search).get('demo') === 'true';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password is too weak. Please choose a password with at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both passwords match.');
      return;
    }

    setLoading(true);
    const { session, needsConfirmation, error } = await signUp(trimmedEmail, password, fullName);
    setLoading(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    if (needsConfirmation) {
      trackSignup();
      setConfirmationSent(true);
    } else if (session) {
      trackSignup();
      if (window.self !== window.top) {
        const targetUrl = new URL('/dashboard', window.location.origin);
        if (session.access_token && session.refresh_token) {
          const hashParams = new URLSearchParams();
          hashParams.set('access_token', session.access_token);
          hashParams.set('refresh_token', session.refresh_token);
          hashParams.set('expires_in', String(session.expires_in || 3600));
          hashParams.set('token_type', 'bearer');
          targetUrl.hash = hashParams.toString();
        }
        const fullAppUrl = targetUrl.href;
        try {
          const opened = window.open(fullAppUrl, '_blank', 'noopener,noreferrer');
          if (!opened) {
            window.top!.location.href = fullAppUrl;
          }
        } catch {
          window.top!.location.href = fullAppUrl;
        }
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  };

  if (confirmationSent) {
    return (
      <div className="auth-page-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-header">
            <div className="auth-brand-logo">
              <img
                src="/brand/Concludo_logo_horizontal_reversed_for_dark.png"
                alt="Concludo"
                className="auth-brand-logo-img"
              />
              <span className="brand-title-badge">WORKSPACE</span>
            </div>
          </div>

          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(226, 181, 60, 0.15)',
              border: '1px solid rgba(226, 181, 60, 0.4)',
              color: '#f3c958',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 0 24px rgba(226, 181, 60, 0.25)',
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '10px', color: '#f8fafc' }}>
            Check your email
          </h2>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.92rem',
              lineHeight: 1.6,
              marginBottom: '16px',
            }}
          >
            We have sent a verification code to <strong style={{ color: '#f8fafc' }}>{email}</strong>.
            Please check your inbox and verify your email to activate your 14-day Pro subscription trial.
          </p>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '28px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              textAlign: 'left'
            }}
          >
            <strong>Important 24-Hour Notice:</strong> You must verify your account within 24 hours. Accounts not verified within 24 hours are automatically deleted for security and governance, requiring you to register again.
          </div>

          <Link to="/login" className="btn-gold" style={{ width: '100%' }}>
            <span>Return to Log in</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-logo">
            <img
              src="/brand/Concludo_logo_horizontal_reversed_for_dark.png"
              alt="Concludo"
              className="auth-brand-logo-img"
            />
            <span className="brand-title-badge">WORKSPACE</span>
          </div>
          <h1 className="auth-title">{isDemo ? 'Start 14-Day Pro Edition Demo' : 'Create your account'}</h1>
          <p className="auth-subtitle">
            {isDemo
              ? 'Create your account to activate your 14-day full Pro Edition trial.'
              : 'Sign up to access your Concludo Workspace'}
          </p>
        </div>

        {errorMessage && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSignup} noValidate>
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="signup-email"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Mail size={15} color="#f3c958" />
              <span>Email address</span>
            </label>
            <input
              id="signup-email"
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
            <label
              className="form-label"
              htmlFor="signup-password"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Lock size={15} color="#f3c958" />
              <span>Password</span>
            </label>
            <input
              id="signup-password"
              type="password"
              className="form-input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label
              className="form-label"
              htmlFor="signup-confirm-password"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Lock size={15} color="#f3c958" />
              <span>Confirm password</span>
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              className="form-input"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label
              className="form-label"
              htmlFor="signup-name"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <User size={15} color="#f3c958" />
              <span>Full name <span style={{ color: '#64748b', fontWeight: 400 }}>(optional)</span></span>
            </label>
            <input
              id="signup-name"
              type="text"
              className="form-input"
              placeholder="Anthony Cortez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
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
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>{isDemo ? 'Start 14-Day Pro Edition Demo' : 'Create Workspace Account'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};
