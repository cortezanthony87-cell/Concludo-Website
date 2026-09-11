import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = (e: React.FormEvent) => {
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
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Start turning meetings into finished deliverables</p>
        </div>

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">
              Full name
            </label>
            <input
              id="signup-name"
              type="text"
              className="form-input"
              placeholder="e.g. Anthony Cortez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">
              Work email
            </label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              className="form-input"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="btn-gold" style={{ width: '100%' }}>
              <UserPlus size={18} />
              <span>Create Account</span>
            </button>
          </div>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
};
