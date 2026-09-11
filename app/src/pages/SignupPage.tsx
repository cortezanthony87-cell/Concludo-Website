import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ArrowRight, User, Mail, Lock } from 'lucide-react';

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
            <div className="brand-emblem" style={{ width: '36px', height: '36px' }}>
              <div className="brand-emblem-inner" style={{ width: '14px', height: '14px' }} />
            </div>
            <span style={{ letterSpacing: '-0.02em' }}>CONCLUDO</span>
            <span className="brand-title-badge">WORKSPACE</span>
          </div>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Start turning meetings into finished deliverables</p>
        </div>

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} color="#f3c958" />
              <span>Full name</span>
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
            <label className="form-label" htmlFor="signup-email" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={15} color="#f3c958" />
              <span>Work email</span>
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
            <label className="form-label" htmlFor="signup-password" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={15} color="#f3c958" />
              <span>Password</span>
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

          <button type="submit" className="btn-gold" style={{ width: '100%', marginTop: '10px' }}>
            <span>Create Workspace Account</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};
