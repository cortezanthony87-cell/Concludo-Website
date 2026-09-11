import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { getAuthErrorMessage } from '../lib/auth/authErrors';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(trimmedEmail);
    setLoading(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    setSubmitted(true);
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
          <h1 className="auth-title">Reset password</h1>
          <p className="auth-subtitle">Enter your email to receive recovery instructions</p>
        </div>

        {errorMessage && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMessage}</div>
          </div>
        )}

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
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
              Recovery link sent
            </h2>
            <p
              style={{
                color: '#94a3b8',
                fontSize: '0.92rem',
                marginBottom: '24px',
                lineHeight: 1.6,
              }}
            >
              If an account exists for <strong style={{ color: '#f8fafc' }}>{email}</strong>, we
              have sent password reset instructions. Please check your inbox and spam folder.
            </p>
            <Link to="/login" className="btn-secondary" style={{ width: '100%' }}>
              Return to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="reset-email"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Mail size={15} color="#f3c958" />
                <span>Email address</span>
              </label>
              <input
                id="reset-email"
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

            <button
              type="submit"
              className="btn-gold"
              style={{ width: '100%', marginTop: '10px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-animation" />
                  <span>Sending instructions...</span>
                </>
              ) : (
                <span>Send Recovery Instructions</span>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#94a3b8',
                  fontSize: '0.88rem',
                }}
              >
                <ArrowLeft size={15} />
                <span>Back to sign in</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
