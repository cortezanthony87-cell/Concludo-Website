import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, ArrowRight } from 'lucide-react';

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
            <span className="brand-gold-dot" style={{ width: '12px', height: '12px' }}></span>
            <span>Concludo</span>
          </div>
          <h1 className="auth-title">Log in to Workspace</h1>
          <p className="auth-subtitle">Enter your details to access your meeting projects</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email address
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>
                Password
              </label>
              <Link to="/forgot-password" style={{ fontSize: '0.82rem', color: '#21395c', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              <LogIn size={18} />
              <span>Log In</span>
            </button>
          </div>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
};
