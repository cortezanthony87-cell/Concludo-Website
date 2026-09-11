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
            <div className="brand-emblem" style={{ width: '36px', height: '36px' }}>
              <div className="brand-emblem-inner" style={{ width: '14px', height: '14px' }} />
            </div>
            <span style={{ letterSpacing: '-0.02em' }}>CONCLUDO</span>
            <span className="brand-title-badge">WORKSPACE</span>
          </div>
          <h1 className="auth-title">Reset password</h1>
          <p className="auth-subtitle">Enter your email to receive recovery instructions</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
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
              boxShadow: '0 0 20px rgba(226, 181, 60, 0.2)'
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', fontWeight: 600 }}>Recovery link prepared</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.6 }}>
              If an account exists for <strong style={{ color: '#f8fafc' }}>{email}</strong>, instructions will be sent.
            </p>
            <Link to="/login" className="btn-secondary" style={{ width: '100%' }}>
              Return to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={15} color="#f3c958" />
                <span>Email address</span>
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

            <button type="submit" className="btn-gold" style={{ width: '100%', marginTop: '10px' }}>
              Send Recovery Instructions
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.88rem' }}>
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
