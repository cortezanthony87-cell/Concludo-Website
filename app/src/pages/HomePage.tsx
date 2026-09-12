import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  FileText,
  BrainCircuit,
  CheckSquare,
  Lock,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';

export const HomePage: React.FC = () => {
  const { user, loading } = useAuth();

  // If already authenticated, redirect to /dashboard
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="auth-page-container" style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '840px', width: '100%', margin: '0 auto' }}>
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '48px',
            paddingBottom: '20px',
            borderBottom: '1px solid rgba(226, 181, 60, 0.15)',
          }}
        >
          <div className="auth-brand-logo" style={{ marginBottom: 0 }}>
            <div className="brand-emblem" style={{ width: '40px', height: '40px' }}>
              <div className="brand-emblem-inner" style={{ width: '16px', height: '16px' }} />
            </div>
            <span style={{ letterSpacing: '-0.02em', fontSize: '1.4rem' }}>CONCLUDO</span>
            <span className="brand-title-badge">WORKSPACE</span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link
              to="/login"
              className="btn-secondary"
              style={{ padding: '8px 18px', fontSize: '0.88rem', textDecoration: 'none' }}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="btn-gold"
              style={{ padding: '8px 18px', fontSize: '0.88rem', textDecoration: 'none' }}
            >
              <span>Create Account</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* Hero Card */}
        <div
          className="content-card"
          style={{
            padding: '48px 40px',
            textAlign: 'center',
            marginBottom: '32px',
            background: 'linear-gradient(180deg, rgba(22, 38, 63, 0.85) 0%, rgba(13, 22, 38, 0.95) 100%)',
            border: '1px solid rgba(226, 181, 60, 0.3)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(226, 181, 60, 0.12)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              color: '#f3c958',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginBottom: '20px',
            }}
          >
            <Sparkles size={14} />
            <span>EXECUTIVE MEETING INTELLIGENCE</span>
          </div>

          <h1
            style={{
              fontSize: '2.4rem',
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: '16px',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            Strategic Discussions. Permanent Records.
          </h1>

          <p
            style={{
              color: '#cbd5e1',
              fontSize: '1.05rem',
              lineHeight: 1.6,
              maxWidth: '620px',
              margin: '0 auto 32px',
            }}
          >
            Concludo Workspace captures dialogue, structures executive meeting outputs,
            maintains institutional memory, and enforces action accountability.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/login"
              className="btn-gold"
              style={{
                padding: '12px 28px',
                fontSize: '0.98rem',
                textDecoration: 'none',
              }}
            >
              <span>Sign In to Workspace</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/signup"
              className="btn-secondary"
              style={{
                padding: '12px 28px',
                fontSize: '0.98rem',
                textDecoration: 'none',
              }}
            >
              Create New Account
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          <div className="content-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(226, 181, 60, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f3c958',
                }}
              >
                <FileText size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Meeting Records
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
              Permanent project storage with raw transcript archives and speaker attribution.
            </p>
          </div>

          <div className="content-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}
              >
                <BrainCircuit size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Decision Memory
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
              Pro tier executive intelligence connecting decisions across meeting cycles.
            </p>
          </div>

          <div className="content-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(52, 211, 153, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34d399',
                }}
              >
                <CheckSquare size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Action Governance
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
              Accountability tracking from dialogue to execution with automated follow-ups.
            </p>
          </div>

          <div className="content-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c084fc',
                }}
              >
                <Shield size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Data Retention
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
              Row-level security with 30-day recovery grace period and automated purge governance.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.8rem',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={14} color="#e2b53c" />
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>
              Concludo Pty Ltd · Melbourne, Australia · ACN 701 605 898
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={12} />
            <span>Enterprise Supabase Auth · Australian English</span>
          </div>
        </div>
      </div>
    </div>
  );
};
