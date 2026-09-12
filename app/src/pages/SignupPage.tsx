import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, User, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { getAuthErrorMessage } from '../lib/auth/authErrors';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();

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
      setConfirmationSent(true);
    } else if (session) {
      navigate('/dashboard', { replace: true });
    }
  };

  if (confirmationSent) {
    return (
      <div className="auth-page-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-header">
            <div className="auth-brand-logo">
              <div className="brand-emblem" style={{ width: '36px', height: '36px' }}>
                <div className="brand-emblem-inner" style={{ width: '14px', height: '14px' }} />
              </div>
              <span style={{ letterSpacing: '-0.02em' }}>CONCLUDO</span>
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
              marginBottom: '28px',
            }}
          >
            We have sent a verification link to <strong style={{ color: '#f8fafc' }}>{email}</strong>.
            Please open the link to confirm your email and activate your account.
          </p>

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
            <div className="brand-emblem" style={{ width: '36px', height: '36px' }}>
              <div className="brand-emblem-inner" style={{ width: '14px', height: '14px' }} />
            </div>
            <span style={{ letterSpacing: '-0.02em' }}>CONCLUDO</span>
            <span className="brand-title-badge">WORKSPACE</span>
          </div>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Sign up to access your Concludo Workspace</p>
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
                <span>Create Workspace Account</span>
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
