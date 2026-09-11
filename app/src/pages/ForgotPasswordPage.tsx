import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-logo">
            <span className="brand-gold-dot" style={{ width: '12px', height: '12px' }}></span>
            <span>Concludo</span>
          </div>
          <h1 className="auth-title">Reset password</h1>
          <p className="auth-subtitle">Enter your email to receive recovery instructions</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ color: '#16263f', marginBottom: '12px' }}>
              <CheckCircle2 size={44} style={{ color: '#bc8a1c', margin: '0 auto' }} />
            </div>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Recovery link prepared</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>
              If an account exists for <strong>{email}</strong>, instructions will be sent.
            </p>
            <Link to="/login" className="btn-secondary" style={{ width: '100%' }}>
              Return to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">
                Email address
              </label>
              <input
                id="reset-email"
                type="email"
                className="form-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ marginTop: '24px' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                <Mail size={18} />
                <span>Send Reset Link</span>
              </button>
            </div>

            <div className="auth-footer">
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={16} />
                <span>Back to log in</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
