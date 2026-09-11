import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, ArrowRight, Sparkles, Lock, Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Authentication placeholder for Tasklet 1
    navigate('/dashboard');
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
          <p className="auth-subtitle">Enter your details to access your meeting projects</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={15} color="#f3c958" />
              <span>Email address</span>
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} color="#f3c958" />
                <span>Password</span>
              </label>
              <Link to="/forgot-password" style={{ fontSize: '0.82rem', color: '#f3c958', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-gold" style={{ width: '100%', marginTop: '10px' }}>
            <span>Sign in to Workspace</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account yet?{' '}
          <Link to="/signup">Create account</Link>
        </div>
      </div>
    </div>
  );
};
