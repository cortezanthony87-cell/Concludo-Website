import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { getAuthErrorMessage } from '../lib/auth/authErrors';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { updatePassword, session } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    // Check URL hash and search params for errors from Supabase Auth link
    const hash = window.location.hash;
    const search = window.location.search;
    const fullParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : search);

    const errorCode = fullParams.get('error_code');
    const errorDesc = fullParams.get('error_description');

    if (
      errorCode === 'otp_expired' ||
      errorCode === 'access_denied' ||
      (errorDesc && errorDesc.toLowerCase().includes('expired')) ||
      (errorDesc && errorDesc.toLowerCase().includes('invalid'))
    ) {
      setLinkExpired(true);
      setErrorMessage('This password reset link is invalid or has expired. Please request a new password reset.');
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!password) {
      setErrorMessage('Please enter your new password.');
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
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      const formatted = getAuthErrorMessage(error);
      if (
        formatted.toLowerCase().includes('session') ||
        formatted.toLowerCase().includes('expired') ||
        formatted.toLowerCase().includes('token') ||
        !session
      ) {
        setLinkExpired(true);
        setErrorMessage('This password reset link is invalid or has expired. Please request a new password reset.');
      } else {
        setErrorMessage(formatted);
      }
      return;
    }

    setIsSuccess(true);
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
          <h1 className="auth-title">Set new password</h1>
          <p className="auth-subtitle">Create a secure password for your workspace account</p>
        </div>

        {errorMessage && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMessage}</div>
          </div>
        )}

        {linkExpired ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.6 }}>
              Reset links expire for your security. Please request a fresh reset link to continue.
            </p>
            <Link to="/forgot-password" className="btn-gold" style={{ width: '100%' }}>
              <span>Request New Reset Link</span>
              <ArrowRight size={18} />
            </Link>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/login" style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                Return to log in
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
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
                marginBottom: '16px',
                boxShadow: '0 0 24px rgba(226, 181, 60, 0.25)',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', fontWeight: 600, color: '#f8fafc' }}>
              Password updated successfully
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.6 }}>
              Your password has been changed. You can now access your workspace.
            </p>
            <button
              type="button"
              className="btn-gold"
              style={{ width: '100%' }}
              onClick={() => navigate('/dashboard', { replace: true })}
            >
              <span>Continue to Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} noValidate>
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="new-password"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Lock size={15} color="#f3c958" />
                <span>New password</span>
              </label>
              <input
                id="new-password"
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
                htmlFor="confirm-new-password"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Lock size={15} color="#f3c958" />
                <span>Confirm new password</span>
              </label>
              <input
                id="confirm-new-password"
                type="password"
                className="form-input"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                autoComplete="new-password"
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
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/login" style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                Return to log in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
